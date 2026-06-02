'use strict';

/**
 * Batch 2 — Payment Create → Invoice Cascade Characterization Tests
 *
 * Covers T2 (链路1): POST /api/payment/create 触发两次无事务 DB 写入后
 * Invoice.credit 累加、paymentStatus 状态机跃迁是否符合当前行为。
 *
 * Characterization 原则：先运行代码，把实际行为记录为断言。
 *
 * Test cases:
 *   2-a  partial payment (amount < remaining)
 *        → Invoice.credit += amount, paymentStatus = "partially"
 *   2-b  full payment (amount = remaining)
 *        → Invoice.credit = total, paymentStatus = "paid"
 *   2-c  two partial payments summing to full amount
 *        → credit accumulates (not overwritten), final paymentStatus = "paid"
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');

process.env.JWT_SECRET = 'test-jwt-secret-batch2';

// All models must be registered before app.js is required, because
// createCRUDController calls mongoose.model() eagerly at require-time.
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

async function createTestAdmin() {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const admin = await Admin.create({
    email: 'admin@batch2.com',
    name: 'Batch2',
    surname: 'Admin',
    enabled: true,
    removed: false,
  });

  const salt = 'testsalt';
  const hashedPassword = bcrypt.hashSync(salt + 'Pass1234!', 10);
  await AdminPassword.create({
    user: admin._id,
    password: hashedPassword,
    salt,
    loggedSessions: [],
    removed: false,
  });

  return admin;
}

async function loginAndGetToken(email, password = 'Pass1234!') {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.body.result.token;
}

async function createClient(adminId) {
  const Client = mongoose.model('Client');
  return Client.create({ name: 'Test Client', createdBy: adminId, removed: false });
}

// Creates an invoice directly in DB (bypasses invoice API — not the path under test here)
async function createInvoice({ adminId, clientId, total = 1000, discount = 0 }) {
  const Invoice = mongoose.model('Invoice');
  return Invoice.create({
    createdBy: adminId,
    client: clientId,
    number: 1,
    year: 2024,
    date: new Date(),
    expiredDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    items: [{ itemName: 'Test Item', quantity: 1, price: total, total }],
    subTotal: total,
    taxTotal: 0,
    total,
    discount,
    credit: 0,
    currency: 'USD',
    paymentStatus: 'unpaid',
    removed: false,
  });
}

let paymentSeq = 0;
async function createPaymentViaApi({ token, invoiceId, clientId, amount }) {
  paymentSeq += 1;
  return request(app)
    .post('/api/payment/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      invoice: invoiceId.toString(),
      client: clientId.toString(),
      number: paymentSeq,
      date: new Date().toISOString(),
      amount,
      currency: 'USD',
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Batch 2 — Payment Create → Invoice Cascade Characterization', () => {
  describe('2-a: partial payment → Invoice.credit accumulates, paymentStatus = "partially"', () => {
    it('credit increases by payment amount; paymentStatus set to "partially"', async () => {
      const admin = await createTestAdmin();
      const token = await loginAndGetToken(admin.email);
      const client = await createClient(admin._id);
      const invoice = await createInvoice({ adminId: admin._id, clientId: client._id, total: 1000 });

      const res = await createPaymentViaApi({
        token,
        invoiceId: invoice._id,
        clientId: client._id,
        amount: 500,
      });

      // Characterize: API response
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Payment Invoice created successfully');

      // Characterize: Invoice state after payment (fetch fresh from DB)
      const Invoice = mongoose.model('Invoice');
      const updated = await Invoice.findById(invoice._id).lean();
      expect(updated.credit).toBe(500);
      expect(updated.paymentStatus).toBe('partially');
    });
  });

  describe('2-b: full payment (amount = remaining) → paymentStatus = "paid"', () => {
    it('credit equals total, paymentStatus set to "paid"', async () => {
      const admin = await createTestAdmin();
      const token = await loginAndGetToken(admin.email);
      const client = await createClient(admin._id);
      const invoice = await createInvoice({ adminId: admin._id, clientId: client._id, total: 1000 });

      const res = await createPaymentViaApi({
        token,
        invoiceId: invoice._id,
        clientId: client._id,
        amount: 1000,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const Invoice = mongoose.model('Invoice');
      const updated = await Invoice.findById(invoice._id).lean();
      expect(updated.credit).toBe(1000);
      expect(updated.paymentStatus).toBe('paid');
    });
  });

  describe('2-c: two partial payments summing to full amount → credit accumulates, final paymentStatus = "paid"', () => {
    it('credit is $inc (not replaced); second payment tips status to "paid"', async () => {
      const admin = await createTestAdmin();
      const token = await loginAndGetToken(admin.email);
      const client = await createClient(admin._id);
      const invoice = await createInvoice({ adminId: admin._id, clientId: client._id, total: 1000 });

      const Invoice = mongoose.model('Invoice');

      // First payment: partial
      const res1 = await createPaymentViaApi({
        token,
        invoiceId: invoice._id,
        clientId: client._id,
        amount: 400,
      });
      expect(res1.status).toBe(200);

      // Characterize intermediate state
      const afterFirst = await Invoice.findById(invoice._id).lean();
      expect(afterFirst.credit).toBe(400);
      expect(afterFirst.paymentStatus).toBe('partially');

      // Second payment: remainder
      const res2 = await createPaymentViaApi({
        token,
        invoiceId: invoice._id,
        clientId: client._id,
        amount: 600,
      });
      expect(res2.status).toBe(200);

      // Characterize final state: credit is 400+600=1000, not overwritten
      const afterSecond = await Invoice.findById(invoice._id).lean();
      expect(afterSecond.credit).toBe(1000);
      expect(afterSecond.paymentStatus).toBe('paid');
    });
  });
});
