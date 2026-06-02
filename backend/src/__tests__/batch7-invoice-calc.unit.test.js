'use strict';

/**
 * Batch 7 — Invoice Amount Calculation Unit Tests
 *
 * Covers T4 (链路3): 后端金额计算逻辑（subTotal / taxTotal / total）。
 * Tested through POST /api/invoice/create and verified against the response
 * body, which reflects the values actually stored in the DB.
 *
 * Calculation logic (from invoiceController/create.js):
 *   item.total  = quantity × price           (per item)
 *   subTotal    = Σ item.total
 *   taxTotal    = subTotal × (taxRate / 100)
 *   total       = subTotal + taxTotal
 *
 * Note: Invoice.total does NOT deduct discount — discount is stored separately
 * and only used to derive paymentStatus. This is the actual codebase behaviour.
 *
 * Test cases:
 *   7-a  single item, taxRate=0     → subTotal=qty×price, taxTotal=0, total=subTotal
 *   7-b  single item, taxRate=10    → taxTotal=subTotal×0.1, total=subTotal+taxTotal
 *   7-c  two items, taxRate=0       → subTotal=sum of (qty×price) per item
 *   7-d  floating-point safety      → currency.js prevents accumulation errors (0.1×3=0.3, not 0.30000000000000004)
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createTestAdmin, loginAndGetToken, createClient, buildInvoiceBody } = require('./helpers');

process.env.JWT_SECRET = 'test-jwt-secret-batch7';

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

async function createInvoiceViaApi({ token, clientId, items, taxRate = 0 }) {
  return request(app)
    .post('/api/invoice/create')
    .set('Authorization', `Bearer ${token}`)
    .send(buildInvoiceBody({ clientId, items, taxRate }));
}

describe('Batch 7 — Invoice Amount Calculation (Unit via API)', () => {
  let token;
  let clientId;

  beforeEach(async () => {
    const { admin, plainPassword } = await createTestAdmin(mongoose);
    token = await loginAndGetToken(request, app, admin.email, plainPassword);
    const client = await createClient(mongoose, admin._id);
    clientId = client._id;
  });

  describe('7-a: single item, taxRate = 0', () => {
    it('subTotal = qty × price; taxTotal = 0; total = subTotal', async () => {
      const res = await createInvoiceViaApi({
        token, clientId,
        items: [{ itemName: 'Widget', quantity: 3, price: 100, total: 300 }],
        taxRate: 0,
      });

      expect(res.status).toBe(200);
      const { subTotal, taxTotal, total } = res.body.result;
      expect(subTotal).toBe(300);   // 3 × 100
      expect(taxTotal).toBe(0);
      expect(total).toBe(300);
    });
  });

  describe('7-b: single item, taxRate = 10%', () => {
    it('taxTotal = subTotal × 0.1; total = subTotal + taxTotal', async () => {
      const res = await createInvoiceViaApi({
        token, clientId,
        items: [{ itemName: 'Widget', quantity: 2, price: 100, total: 200 }],
        taxRate: 10,
      });

      expect(res.status).toBe(200);
      const { subTotal, taxTotal, total } = res.body.result;
      expect(subTotal).toBe(200);   // 2 × 100
      expect(taxTotal).toBe(20);    // 200 × 0.10
      expect(total).toBe(220);      // 200 + 20
    });
  });

  describe('7-c: two items, taxRate = 0', () => {
    it('subTotal = sum of (qty × price) for each item', async () => {
      const res = await createInvoiceViaApi({
        token, clientId,
        items: [
          { itemName: 'Item A', quantity: 2, price: 50,  total: 100 },
          { itemName: 'Item B', quantity: 3, price: 200, total: 600 },
        ],
        taxRate: 0,
      });

      expect(res.status).toBe(200);
      const { subTotal, taxTotal, total } = res.body.result;
      expect(subTotal).toBe(700);  // (2×50) + (3×200) = 100 + 600
      expect(taxTotal).toBe(0);
      expect(total).toBe(700);
    });
  });

  describe('7-d: floating-point safety (currency.js prevents accumulation error)', () => {
    it('0.1 × 3 = 0.3 exactly, not 0.30000000000000004', async () => {
      const res = await createInvoiceViaApi({
        token, clientId,
        items: [{ itemName: 'Precise Item', quantity: 3, price: 0.1, total: 0.3 }],
        taxRate: 0,
      });

      expect(res.status).toBe(200);
      const { subTotal, total } = res.body.result;
      // Native JS: 0.1 * 3 === 0.30000000000000004 → fails
      // currency.js: 0.1 * 3 === 0.3 → passes
      expect(subTotal).toBe(0.3);
      expect(total).toBe(0.3);
    });
  });
});
