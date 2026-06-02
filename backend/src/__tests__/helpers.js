'use strict';

/**
 * Shared test helpers for all batch test files.
 * Each helper receives mongoose as a parameter so it works in any
 * test file's isolated module context.
 */

const bcrypt = require('bcryptjs');

async function createTestAdmin(mongoose, { email = 'admin@test.com', plainPassword = 'Pass1234!' } = {}) {
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
  await AdminPassword.create({
    user: admin._id,
    password: bcrypt.hashSync(salt + plainPassword, 10),
    salt,
    loggedSessions: [],
    removed: false,
  });

  return { admin, plainPassword };
}

async function loginAndGetToken(request, app, email, plainPassword = 'Pass1234!') {
  const res = await request(app).post('/api/login').send({ email, password: plainPassword });
  return res.body.result.token;
}

async function createClient(mongoose, adminId) {
  return mongoose.model('Client').create({ name: 'Test Client', createdBy: adminId, removed: false });
}

/**
 * Seed an invoice directly into DB (bypasses invoice API).
 * Use when the path under test is downstream (e.g. payment create/update).
 */
async function seedInvoice(mongoose, { adminId, clientId, total = 1000, discount = 0, credit = 0, paymentStatus = 'unpaid' } = {}) {
  return mongoose.model('Invoice').create({
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
    credit,
    currency: 'USD',
    paymentStatus,
    removed: false,
  });
}

/**
 * Build a valid request body for POST /api/invoice/create
 * and PATCH /api/invoice/update/:id (Joi schema is shared).
 */
function buildInvoiceBody({ clientId, items, taxRate = 0, number = 1, year = 2024, status = 'draft' } = {}) {
  return {
    client: clientId.toString(),
    number,
    year,
    status,
    date: new Date().toISOString(),
    expiredDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    taxRate,
    items: items || [{ itemName: 'Test Item', quantity: 1, price: 1000, total: 1000 }],
  };
}

module.exports = { createTestAdmin, loginAndGetToken, createClient, seedInvoice, buildInvoiceBody };
