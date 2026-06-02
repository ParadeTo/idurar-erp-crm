'use strict';

/**
 * Batch 3 — Payment Update Delta (Integration Test)
 *
 * Covers T3 (链路2): PATCH /api/payment/update/:id
 * 关键不变式：Invoice.credit 通过 $inc(changedAmount) 修改，
 * changedAmount = newAmount − oldAmount，不是直接覆盖为新金额。
 *
 * Test cases:
 *   3-a  increase amount (100→150): Invoice.credit += 50, stays "partially"
 *   3-b  decrease amount (1000→600): Invoice.credit -= 400, status regresses "paid"→"partially"
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createTestAdmin, loginAndGetToken, createClient, seedInvoice } = require('./helpers');

process.env.JWT_SECRET = 'test-jwt-secret-batch3';

require('../models/coreModels/Admin');
require('../models/coreModels/AdminPassword');
require('../models/coreModels/Setting');
require('../models/coreModels/Upload');
require('../models/appModels/Client');
require('../models/appModels/Invoice');
require('../models/appModels/Payment');

const app = require('../app');

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
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

// ── Fixture helpers ───────────────────────────────────────────────────────────

let paySeq = 0;

async function createPaymentViaApi({ token, invoiceId, clientId, amount }) {
  paySeq += 1;
  return request(app)
    .post('/api/payment/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      invoice: invoiceId.toString(),
      client: clientId.toString(),
      number: paySeq,
      date: new Date().toISOString(),
      amount,
      currency: 'USD',
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Batch 3 — Payment Update Delta (Integration)', () => {
  describe('3-a: increase amount (100 → 150) → Invoice.credit += 50, not set to 150', () => {
    it('delta +50 is applied to Invoice.credit via $inc', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose);
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);
      const invoice = await seedInvoice(mongoose, { adminId: admin._id, clientId: client._id, total: 1000 });

      // Create initial payment of 100
      const createRes = await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 100 });
      expect(createRes.status).toBe(200);
      const paymentId = createRes.body.result._id;

      // Verify invoice state after initial payment
      const Invoice = mongoose.model('Invoice');
      const afterCreate = await Invoice.findById(invoice._id).lean();
      expect(afterCreate.credit).toBe(100);

      // Update payment: 100 → 150 (changedAmount = +50)
      const updateRes = await request(app)
        .patch(`/api/payment/update/${paymentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 150 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      // Invoice.credit must be 150 (100 + delta 50), not a direct set to 150
      const afterUpdate = await Invoice.findById(invoice._id).lean();
      expect(afterUpdate.credit).toBe(150);
      expect(afterUpdate.paymentStatus).toBe('partially');
    });
  });

  describe('3-b: decrease amount (1000 → 600) → Invoice.credit -= 400, paymentStatus regresses to "partially"', () => {
    it('delta -400 applied; status regresses from "paid" to "partially"', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose, { email: 'admin2@test.com' });
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);
      const invoice = await seedInvoice(mongoose, { adminId: admin._id, clientId: client._id, total: 1000 });

      // Full payment → "paid"
      const createRes = await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 1000 });
      expect(createRes.status).toBe(200);
      const paymentId = createRes.body.result._id;

      const Invoice = mongoose.model('Invoice');
      const afterFull = await Invoice.findById(invoice._id).lean();
      expect(afterFull.paymentStatus).toBe('paid');

      // Reduce payment: 1000 → 600 (changedAmount = -400)
      const updateRes = await request(app)
        .patch(`/api/payment/update/${paymentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 600 });

      expect(updateRes.status).toBe(200);

      const afterUpdate = await Invoice.findById(invoice._id).lean();
      expect(afterUpdate.credit).toBe(600);           // 1000 + (-400)
      expect(afterUpdate.paymentStatus).toBe('partially'); // regressed from "paid"
    });
  });
});
