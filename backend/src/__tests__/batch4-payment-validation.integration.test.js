'use strict';

/**
 * Batch 4 — Payment Amount Over-Limit Validation (Integration Test)
 *
 * Covers T1 (链路1): 付款金额超出发票余额时请求被拒。
 *
 * Characterization note: the controller returns HTTP 202 (not 400/422) for
 * over-limit amounts — that is the actual codebase behaviour.
 *
 * Test cases:
 *   4-a  amount > remaining → 202 + success:false, Payment not created, Invoice.credit unchanged
 *   4-b  amount = remaining exactly → 200, paymentStatus = "paid"
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createTestAdmin, loginAndGetToken, createClient, seedInvoice } = require('./helpers');

process.env.JWT_SECRET = 'test-jwt-secret-batch4';

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

describe('Batch 4 — Payment Amount Validation (Integration)', () => {
  describe('4-a: amount > remaining → rejected, Invoice.credit unchanged', () => {
    it('returns 202 + success:false; no Payment doc written; Invoice.credit stays 0', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose);
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);
      // Invoice: total=1000, credit=0 → remaining = 1000
      const invoice = await seedInvoice(mongoose, { adminId: admin._id, clientId: client._id, total: 1000 });

      const res = await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 1001 });

      // Characterize: codebase uses 202 for over-limit (not 400/422)
      expect(res.status).toBe(202);
      expect(res.body.success).toBe(false);

      // No Payment document must exist
      const Payment = mongoose.model('Payment');
      const count = await Payment.countDocuments({ invoice: invoice._id });
      expect(count).toBe(0);

      // Invoice.credit must be unchanged
      const Invoice = mongoose.model('Invoice');
      const inv = await Invoice.findById(invoice._id).lean();
      expect(inv.credit).toBe(0);
    });
  });

  describe('4-b: amount = remaining exactly → accepted, paymentStatus = "paid"', () => {
    it('returns 200; Invoice.credit = total; paymentStatus = "paid"', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose, { email: 'admin2@test.com' });
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);
      const invoice = await seedInvoice(mongoose, { adminId: admin._id, clientId: client._id, total: 1000 });

      // First partial payment of 300
      await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 300 });

      // Pay exact remainder: 1000 - 300 = 700
      const res = await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 700 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const Invoice = mongoose.model('Invoice');
      const inv = await Invoice.findById(invoice._id).lean();
      expect(inv.credit).toBe(1000);
      expect(inv.paymentStatus).toBe('paid');
    });
  });
});
