'use strict';

/**
 * Batch 5 — Invoice Update Preserves Old Credit (Integration Test)
 *
 * Covers T6 (链路4): PATCH /api/invoice/update/:id
 * 关键不变式：update.js 从 DB 读旧 credit，用新 total 重算 paymentStatus，
 * 但不修改 credit 本身。
 *
 * Test cases:
 *   5-a  increase total (items price doubled): credit unchanged, paymentStatus stays "partially"
 *   5-b  decrease total to equal existing credit: credit unchanged, paymentStatus flips to "paid"
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createTestAdmin, loginAndGetToken, createClient, seedInvoice, buildInvoiceBody } = require('./helpers');

process.env.JWT_SECRET = 'test-jwt-secret-batch5';

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

async function updateInvoiceViaApi({ token, invoiceId, clientId, items, taxRate = 0 }) {
  return request(app)
    .patch(`/api/invoice/update/${invoiceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(buildInvoiceBody({ clientId, items, taxRate }));
}

describe('Batch 5 — Invoice Update Preserves Old Credit (Integration)', () => {
  describe('5-a: increase total → credit unchanged, paymentStatus stays "partially"', () => {
    it('old credit (500) not touched when total doubles to 2000', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose);
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);
      // Invoice: total=1000
      const invoice = await seedInvoice(mongoose, { adminId: admin._id, clientId: client._id, total: 1000 });

      // Partial payment of 500 → credit=500, "partially"
      await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 500 });

      const Invoice = mongoose.model('Invoice');
      const beforeUpdate = await Invoice.findById(invoice._id).lean();
      expect(beforeUpdate.credit).toBe(500);
      expect(beforeUpdate.paymentStatus).toBe('partially');

      // Update invoice: new total = 2000 (qty=1, price=2000)
      const updateRes = await updateInvoiceViaApi({
        token,
        invoiceId: invoice._id,
        clientId: client._id,
        items: [{ itemName: 'Upgraded Item', quantity: 1, price: 2000, total: 2000 }],
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      const afterUpdate = await Invoice.findById(invoice._id).lean();
      // Credit must be unchanged (update.js does not write credit)
      expect(afterUpdate.credit).toBe(500);
      // paymentStatus recalculated: total(2000) - discount(0) = 2000 ≠ credit(500) → "partially"
      expect(afterUpdate.paymentStatus).toBe('partially');
      // Total was recalculated from items
      expect(afterUpdate.total).toBe(2000);
    });
  });

  describe('5-b: reduce total to match existing credit → credit unchanged, paymentStatus flips to "paid"', () => {
    it('old credit (500) not touched; paymentStatus = "paid" when new total equals credit', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose, { email: 'admin2@test.com' });
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);
      const invoice = await seedInvoice(mongoose, { adminId: admin._id, clientId: client._id, total: 1000 });

      // Partial payment of 500 → credit=500, "partially"
      await createPaymentViaApi({ token, invoiceId: invoice._id, clientId: client._id, amount: 500 });

      // Update invoice: new total = 500 (equal to existing credit)
      const updateRes = await updateInvoiceViaApi({
        token,
        invoiceId: invoice._id,
        clientId: client._id,
        items: [{ itemName: 'Reduced Item', quantity: 1, price: 500, total: 500 }],
      });
      expect(updateRes.status).toBe(200);

      const Invoice = mongoose.model('Invoice');
      const afterUpdate = await Invoice.findById(invoice._id).lean();
      // Credit must be unchanged
      expect(afterUpdate.credit).toBe(500);
      // paymentStatus: total(500) - discount(0) = 500 === credit(500) → "paid"
      expect(afterUpdate.paymentStatus).toBe('paid');
    });
  });
});
