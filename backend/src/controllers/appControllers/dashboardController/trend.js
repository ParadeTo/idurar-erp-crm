'use strict';

const mongoose = require('mongoose');
const moment = require('moment');

const Invoice = mongoose.model('Invoice');
const Payment = mongoose.model('Payment');

const trend = async (req, res) => {
  const { startDate, endDate, currency } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'startDate and endDate are required (YYYY-MM-DD)',
    });
  }

  const startMoment = moment.utc(startDate, 'YYYY-MM-DD', true);
  const endMoment = moment.utc(endDate, 'YYYY-MM-DD', true);

  if (!startMoment.isValid() || !endMoment.isValid()) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid date format. Use YYYY-MM-DD.',
    });
  }

  if (endMoment.isBefore(startMoment)) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'endDate must be >= startDate',
    });
  }

  const dayCount = endMoment.diff(startMoment, 'days') + 1;
  if (dayCount > 366) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Date range must not exceed 366 days',
    });
  }

  const startUtc = startMoment.clone().startOf('day').toDate();
  const endUtc = endMoment.clone().endOf('day').toDate();
  const dateRange = { $gte: startUtc, $lte: endUtc };

  const currencyFilter = currency ? { currency } : {};

  const [invoiceData, paymentData] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          removed: false,
          status: { $ne: 'draft' },
          date: dateRange,
          ...currencyFilter,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          invoiceTotal: { $sum: '$total' },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          removed: false,
          date: dateRange,
          ...currencyFilter,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          paymentAmount: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const invoiceMap = {};
  invoiceData.forEach(({ _id, invoiceTotal }) => {
    invoiceMap[_id] = invoiceTotal;
  });

  const paymentMap = {};
  paymentData.forEach(({ _id, paymentAmount }) => {
    paymentMap[_id] = paymentAmount;
  });

  const days = [];
  const cursor = startMoment.clone().startOf('day');
  const endDay = endMoment.clone().startOf('day');

  while (cursor.isSameOrBefore(endDay)) {
    const dateStr = cursor.format('YYYY-MM-DD');
    days.push({
      date: dateStr,
      invoiceTotal: invoiceMap[dateStr] ?? 0,
      paymentAmount: paymentMap[dateStr] ?? 0,
    });
    cursor.add(1, 'day');
  }

  return res.status(200).json({
    success: true,
    result: { days },
    message: 'Successfully fetched dashboard trend',
  });
};

module.exports = trend;
