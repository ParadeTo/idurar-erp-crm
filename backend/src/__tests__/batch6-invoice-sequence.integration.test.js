'use strict';

/**
 * Batch 6 — Invoice Create → last_invoice_number Auto-Increment (Integration Test)
 *
 * Covers T5 (链路3): POST /api/invoice/create 调用 increaseBySettingKey() ——
 * 这是一个 fire-and-forget 调用（非 await），在响应返回后异步写库。
 * 测试需要等待该操作完成后再断言。
 *
 * Test cases:
 *   6-a  create one invoice → last_invoice_number +1
 *   6-b  create two invoices → last_invoice_number +2, no gaps
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createTestAdmin, loginAndGetToken, createClient, buildInvoiceBody } = require('./helpers');

process.env.JWT_SECRET = 'test-jwt-secret-batch6';

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

// increaseBySettingKey is fire-and-forget (not awaited in the controller).
// Give the event loop a moment to flush the async DB write before asserting.
const waitForIncrement = () => new Promise((resolve) => setTimeout(resolve, 100));

async function createInvoiceViaApi({ token, clientId, invoiceNumber }) {
  return request(app)
    .post('/api/invoice/create')
    .set('Authorization', `Bearer ${token}`)
    .send(buildInvoiceBody({ clientId, number: invoiceNumber }));
}

describe('Batch 6 — Invoice Sequence Number Auto-Increment (Integration)', () => {
  describe('6-a: create one invoice → last_invoice_number +1', () => {
    it('Setting.last_invoice_number increments by 1 after a single invoice creation', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose);
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);

      // Seed the setting with a known initial value
      const Setting = mongoose.model('Setting');
      await Setting.create({ settingKey: 'last_invoice_number', settingValue: 100, settingCategory: 'invoice', removed: false });

      const res = await createInvoiceViaApi({ token, clientId: client._id, invoiceNumber: 101 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      await waitForIncrement();

      const setting = await Setting.findOne({ settingKey: 'last_invoice_number' });
      expect(setting.settingValue).toBe(101);
    });
  });

  describe('6-b: create two invoices → last_invoice_number +2, no gaps', () => {
    it('each invoice creation increments the counter exactly once', async () => {
      const { admin, plainPassword } = await createTestAdmin(mongoose, { email: 'admin2@test.com' });
      const token = await loginAndGetToken(request, app, admin.email, plainPassword);
      const client = await createClient(mongoose, admin._id);

      const Setting = mongoose.model('Setting');
      await Setting.create({ settingKey: 'last_invoice_number', settingValue: 200, settingCategory: 'invoice', removed: false });

      await createInvoiceViaApi({ token, clientId: client._id, invoiceNumber: 201 });
      await createInvoiceViaApi({ token, clientId: client._id, invoiceNumber: 202 });

      await waitForIncrement();

      const setting = await Setting.findOne({ settingKey: 'last_invoice_number' });
      expect(setting.settingValue).toBe(202);
    });
  });
});
