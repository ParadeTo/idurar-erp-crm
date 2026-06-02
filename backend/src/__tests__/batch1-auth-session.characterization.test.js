'use strict';

/**
 * Batch 1 — Auth Session Characterization Tests
 *
 * Covers T7 (JWT valid but not in loggedSessions → 401) and T8 (login/logout
 * token lifecycle). These are Characterization Tests: assertions are derived
 * from running the code and recording actual behaviour, not from spec.
 *
 * Test cases:
 *   1-a  valid JWT + token in loggedSessions  → protected route 200
 *   1-b  valid JWT + token NOT in loggedSessions → 401 + jwtExpired:true
 *   1-c  POST /api/login → token written to AdminPassword.loggedSessions
 *   1-d  POST /api/logout → token removed from AdminPassword.loggedSessions
 *   1-e  after logout, same token on protected route → 401 + jwtExpired:true
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Must be set before any module that reads process.env.JWT_SECRET is required
process.env.JWT_SECRET = 'test-jwt-secret-batch1';

// ── Model registration ────────────────────────────────────────────────────────
// createCRUDController (called eagerly by each *Controller/index.js) resolves
// mongoose.model() at require-time, so all models must be registered before
// app.js is loaded.
require('../models/coreModels/Admin');
require('../models/coreModels/AdminPassword');
require('../models/coreModels/Setting');
require('../models/coreModels/Upload');
require('../models/appModels/Client');
require('../models/appModels/Invoice');
require('../models/appModels/Payment');

// Load app after models so createCRUDController finds them
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

async function createTestAdmin({ email = 'admin@test.com', plainPassword = 'Pass1234!' } = {}) {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const admin = await Admin.create({
    email,
    name: 'Test',
    surname: 'Admin',
    enabled: true,
    removed: false,
  });

  const salt = 'testsalt';
  const hashedPassword = bcrypt.hashSync(salt + plainPassword, 10);

  await AdminPassword.create({
    user: admin._id,
    password: hashedPassword,
    salt,
    loggedSessions: [],
    removed: false,
  });

  return { admin, plainPassword };
}

async function loginViaApi(email, password) {
  return request(app).post('/api/login').send({ email, password });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Batch 1 — Auth Session Characterization', () => {
  describe('1-a: valid JWT + token in loggedSessions → protected route passes', () => {
    it('returns 200 on GET /api/setting/list', async () => {
      const { admin, plainPassword } = await createTestAdmin();
      const loginRes = await loginViaApi(admin.email, plainPassword);

      // Characterize: record actual login response shape
      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toMatchObject({ success: true });
      expect(typeof loginRes.body.result.token).toBe('string');

      const { token } = loginRes.body.result;

      const res = await request(app)
        .get('/api/setting/list')
        .set('Authorization', `Bearer ${token}`);

      // Characterize: empty Setting collection → 203 ("Collection is Empty"),
      // NOT 401. Auth passed; 203 is a success variant used by paginatedList.
      expect(res.status).toBe(203);
      expect(res.body.success).toBe(true);
      expect(res.body).not.toHaveProperty('jwtExpired');
    });
  });

  describe('1-b: valid JWT + token NOT in loggedSessions → 401 + jwtExpired', () => {
    it('returns 401 with jwtExpired:true for an orphan token', async () => {
      const { admin } = await createTestAdmin();

      // Manually sign a valid JWT — never pushed to loggedSessions
      const orphanToken = jwt.sign(
        { id: admin._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const res = await request(app)
        .get('/api/setting/list')
        .set('Authorization', `Bearer ${orphanToken}`);

      // Characterize: isValidAuthToken returns exactly 401 + jwtExpired:true
      expect(res.status).toBe(401);
      expect(res.body.jwtExpired).toBe(true);
      expect(res.body.success).toBe(false);
    });
  });

  describe('1-c: POST /api/login → token written to loggedSessions', () => {
    it('token appears in AdminPassword.loggedSessions immediately after login', async () => {
      const { admin, plainPassword } = await createTestAdmin();
      const loginRes = await loginViaApi(admin.email, plainPassword);

      expect(loginRes.status).toBe(200);
      const { token } = loginRes.body.result;

      const AdminPassword = mongoose.model('AdminPassword');
      const record = await AdminPassword.findOne({ user: admin._id });

      // Characterize: $push is used, so token must appear in the array
      expect(record.loggedSessions).toContain(token);
    });
  });

  describe('1-d: POST /api/logout → token removed from loggedSessions', () => {
    it('token is absent from loggedSessions after logout', async () => {
      const { admin, plainPassword } = await createTestAdmin();
      const loginRes = await loginViaApi(admin.email, plainPassword);
      const { token } = loginRes.body.result;

      const logoutRes = await request(app)
        .post('/api/logout')
        .set('Authorization', `Bearer ${token}`);

      // Characterize: logout response shape
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      const AdminPassword = mongoose.model('AdminPassword');
      const record = await AdminPassword.findOne({ user: admin._id });

      // Characterize: $pull removes only this token, array still exists
      expect(record.loggedSessions).not.toContain(token);
    });
  });

  describe('1-e: after logout, same token → 401 + jwtExpired', () => {
    it('reusing a logged-out token on a protected route returns 401', async () => {
      const { admin, plainPassword } = await createTestAdmin();
      const loginRes = await loginViaApi(admin.email, plainPassword);
      const { token } = loginRes.body.result;

      await request(app)
        .post('/api/logout')
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get('/api/setting/list')
        .set('Authorization', `Bearer ${token}`);

      // Characterize: same auth check as 1-b — loggedSessions no longer contains the token
      expect(res.status).toBe(401);
      expect(res.body.jwtExpired).toBe(true);
    });
  });
});
