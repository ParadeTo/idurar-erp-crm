'use strict';

/**
 * Batch 9 — appApi Route Registration Characterization
 *
 * Locks down the current state of backend/src/routes/appRoutes/appApi.js
 * BEFORE the /dashboard/trend route is manually added (P03).
 *
 * Key behaviors being locked:
 *   9-a  existing entity routes require JWT: no token → 401
 *   9-b  GET /api/invoice/summary works with valid token
 *   9-c  GET /api/payment/summary works with valid token
 *   9-d  GET /api/dashboard/trend returns 404 with valid token (not yet registered)
 *
 * Assertions are derived from running the code, not from spec.
 * If any assertion breaks after our change, we introduced a regression.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');

process.env.JWT_SECRET = 'test-jwt-secret-batch9';
process.env.NODE_ENV = 'test';

// Models must be registered before app.js is loaded (createCRUDController
// resolves mongoose.model() eagerly at require-time).
require('../models/coreModels/Admin');
require('../models/coreModels/AdminPassword');
require('../models/coreModels/Setting');
require('../models/coreModels/Upload');
require('../models/appModels/Client');
require('../models/appModels/Invoice');
require('../models/appModels/Payment');

const app = require('../app');

// ── DB lifecycle ──────────────────────────────────────────────────────────────

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createAdminAndLogin() {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const admin = await Admin.create({
    email: 'batch9@test.com',
    name: 'Batch',
    surname: 'Nine',
    enabled: true,
    removed: false,
  });

  const salt = 'batch9salt';
  const password = 'Pass1234!';
  const hash = bcrypt.hashSync(salt + password, 10);

  await AdminPassword.create({
    user: admin._id,
    password: hash,
    salt,
    loggedSessions: [],
    removed: false,
  });

  const res = await request(app)
    .post('/api/login')
    .send({ email: admin.email, password });

  return res.body.result.token;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Batch 9 — appApi Route Registration Characterization', () => {

  describe('9-a: existing entity routes require JWT (no token → 401)', () => {
    const protectedRoutes = [
      'GET /api/invoice/list',
      'GET /api/payment/list',
      'GET /api/client/list',
      'GET /api/invoice/summary',
      'GET /api/payment/summary',
    ];

    protectedRoutes.forEach((entry) => {
      const [method, path] = entry.split(' ');
      it(`${entry} → 401 without token`, async () => {
        const res = await request(app)[method.toLowerCase()](path);
        // Characterize: isValidAuthToken returns 401 for any missing/invalid token
        expect(res.status).toBe(401);
      });
    });
  });

  describe('9-b: GET /api/invoice/summary → 200 with valid token', () => {
    it('returns success:true and expected result shape', async () => {
      const token = await createAdminAndLogin();
      const res = await request(app)
        .get('/api/invoice/summary')
        .set('Authorization', `Bearer ${token}`);

      // Characterize: empty collection → 200 with zeroed result
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result).toMatchObject({
        total_undue: expect.any(Number),
        performance: expect.any(Array),
      });
    });
  });

  describe('9-c: GET /api/payment/summary → 200 with valid token', () => {
    it('returns success:true and expected result shape', async () => {
      const token = await createAdminAndLogin();
      const res = await request(app)
        .get('/api/payment/summary')
        .set('Authorization', `Bearer ${token}`);

      // Characterize: empty collection → 200 with zero count and total
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result).toMatchObject({
        count: expect.any(Number),
        total: expect.any(Number),
      });
    });
  });

  describe('9-d: GET /api/dashboard/trend → 200 with valid token (route now registered by P03)', () => {
    it('returns 200 and days array after P03 implementation', async () => {
      const token = await createAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-01-01&endDate=2026-01-07')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.days).toHaveLength(7);
    });
  });

});
