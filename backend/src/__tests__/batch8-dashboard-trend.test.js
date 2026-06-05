'use strict';

/**
 * Batch 8 — Dashboard Trend Endpoint (TDD)
 *
 * Tests for GET /api/dashboard/trend?startDate=&endDate=[&currency=]
 * Written BEFORE implementation (Red → Green).
 *
 * Decisions baked in:
 *   D3  Invoice.date is the aggregation date field
 *   D4  currency optional; omitting aggregates all currencies
 *   D5  Invoice.status='draft' excluded from invoiceTotal
 *   D7  Frontend sends YYYY-MM-DD; backend parses as UTC day boundaries
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');

process.env.JWT_SECRET = 'test-jwt-secret-batch8';
process.env.NODE_ENV = 'test';

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

async function seedAdminAndLogin() {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const admin = await Admin.create({
    email: 'batch8@test.com',
    name: 'Batch',
    surname: 'Eight',
    enabled: true,
    removed: false,
  });

  const salt = 'batch8salt';
  const hash = bcrypt.hashSync(salt + 'Pass1234!', 10);
  await AdminPassword.create({
    user: admin._id,
    password: hash,
    salt,
    loggedSessions: [],
    removed: false,
  });

  const res = await request(app)
    .post('/api/login')
    .send({ email: admin.email, password: 'Pass1234!' });

  return { admin, token: res.body.result.token };
}

async function seedClient() {
  const Client = mongoose.model('Client');
  return Client.create({ name: 'Test Client', removed: false });
}

function makeInvoice({ adminId, clientId, date, total, currency = 'USD', status = 'pending', removed = false }) {
  const Invoice = mongoose.model('Invoice');
  return Invoice.create({
    createdBy: adminId,
    client: clientId,
    number: Math.floor(Math.random() * 10000),
    year: new Date(date).getFullYear(),
    date: new Date(date),
    expiredDate: new Date(date),
    items: [{ itemName: 'Service', quantity: 1, price: total, total }],
    subTotal: total,
    taxTotal: 0,
    total,
    currency,
    status,
    removed,
  });
}

function makePayment({ adminId, clientId, invoiceId, date, amount, currency = 'USD', removed = false }) {
  const Payment = mongoose.model('Payment');
  return Payment.create({
    createdBy: adminId,
    client: clientId,
    invoice: invoiceId,
    number: Math.floor(Math.random() * 10000),
    date: new Date(date),
    amount,
    currency,
    removed,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Batch 8 — Dashboard Trend Endpoint', () => {

  // ── Auth ───────────────────────────────────────────────────────────────────

  describe('8-a: no token → 401', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-01-01&endDate=2026-01-31');
      expect(res.status).toBe(401);
    });
  });

  // ── Parameter validation ───────────────────────────────────────────────────

  describe('8-b: missing startDate → 400', () => {
    it('returns 400 when startDate is absent', async () => {
      const { token } = await seedAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?endDate=2026-01-31')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('8-c: missing endDate → 400', () => {
    it('returns 400 when endDate is absent', async () => {
      const { token } = await seedAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-01-01')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('8-d: endDate < startDate → 400', () => {
    it('returns 400 when range is inverted', async () => {
      const { token } = await seedAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-01-31&endDate=2026-01-01')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('8-e: range > 366 days → 400', () => {
    it('returns 400 when date range exceeds 366 days', async () => {
      const { token } = await seedAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2025-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Core behavior ──────────────────────────────────────────────────────────

  describe('8-f: empty DB → full zero-filled days array', () => {
    it('returns 31 days all zeroed for January 2026 with no data', async () => {
      const { token } = await seedAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { days } = res.body.result;
      expect(days).toHaveLength(31);
      expect(days[0]).toEqual({ date: '2026-01-01', invoiceTotal: 0, paymentAmount: 0 });
      expect(days[30]).toEqual({ date: '2026-01-31', invoiceTotal: 0, paymentAmount: 0 });
      days.forEach((d) => {
        expect(d.invoiceTotal).toBe(0);
        expect(d.paymentAmount).toBe(0);
      });
    });
  });

  describe('8-g: single-day range → 1 element', () => {
    it('returns exactly 1 day when startDate equals endDate', async () => {
      const { token } = await seedAdminAndLogin();
      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-06-05&endDate=2026-06-05')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const { days } = res.body.result;
      expect(days).toHaveLength(1);
      expect(days[0].date).toBe('2026-06-05');
    });
  });

  describe('8-h: invoiceTotal sums Invoice.total for the matching date', () => {
    it('accumulates two invoices on the same day', async () => {
      const { admin, token } = await seedAdminAndLogin();
      const client = await seedClient();

      await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 1000 });
      await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 500 });
      await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-15', total: 200 });

      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-05-01&endDate=2026-05-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const { days } = res.body.result;
      const may10 = days.find((d) => d.date === '2026-05-10');
      const may15 = days.find((d) => d.date === '2026-05-15');
      expect(may10.invoiceTotal).toBe(1500);
      expect(may15.invoiceTotal).toBe(200);
    });
  });

  describe('8-i: paymentAmount sums Payment.amount for the matching date', () => {
    it('accumulates two payments on the same day', async () => {
      const { admin, token } = await seedAdminAndLogin();
      const client = await seedClient();
      const inv = await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-01', total: 5000 });

      await makePayment({ adminId: admin._id, clientId: client._id, invoiceId: inv._id, date: '2026-05-12', amount: 800 });
      await makePayment({ adminId: admin._id, clientId: client._id, invoiceId: inv._id, date: '2026-05-12', amount: 200 });

      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-05-01&endDate=2026-05-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const { days } = res.body.result;
      const may12 = days.find((d) => d.date === '2026-05-12');
      expect(may12.paymentAmount).toBe(1000);
    });
  });

  describe('8-j: removed records excluded', () => {
    it('does not count removed:true invoices or payments', async () => {
      const { admin, token } = await seedAdminAndLogin();
      const client = await seedClient();
      const inv = await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 999, removed: true });
      await makePayment({ adminId: admin._id, clientId: client._id, invoiceId: inv._id, date: '2026-05-10', amount: 999, removed: true });

      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-05-01&endDate=2026-05-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const { days } = res.body.result;
      const may10 = days.find((d) => d.date === '2026-05-10');
      expect(may10.invoiceTotal).toBe(0);
      expect(may10.paymentAmount).toBe(0);
    });
  });

  describe('8-k: draft invoices excluded (D5)', () => {
    it('does not count Invoice.status=draft in invoiceTotal', async () => {
      const { admin, token } = await seedAdminAndLogin();
      const client = await seedClient();

      await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 500, status: 'draft' });
      await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 300, status: 'pending' });

      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-05-01&endDate=2026-05-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const { days } = res.body.result;
      const may10 = days.find((d) => d.date === '2026-05-10');
      expect(may10.invoiceTotal).toBe(300);
    });
  });

  describe('8-l: currency filter applied to both Invoice and Payment', () => {
    it('returns only matching-currency amounts when currency param provided', async () => {
      const { admin, token } = await seedAdminAndLogin();
      const client = await seedClient();
      const inv = await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 1000, currency: 'USD' });

      await makeInvoice({ adminId: admin._id, clientId: client._id, date: '2026-05-10', total: 800, currency: 'EUR' });
      await makePayment({ adminId: admin._id, clientId: client._id, invoiceId: inv._id, date: '2026-05-10', amount: 500, currency: 'USD' });
      await makePayment({ adminId: admin._id, clientId: client._id, invoiceId: inv._id, date: '2026-05-10', amount: 300, currency: 'EUR' });

      const res = await request(app)
        .get('/api/dashboard/trend?startDate=2026-05-01&endDate=2026-05-31&currency=USD')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const { days } = res.body.result;
      const may10 = days.find((d) => d.date === '2026-05-10');
      expect(may10.invoiceTotal).toBe(1000);
      expect(may10.paymentAmount).toBe(500);
    });
  });

});
