const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const Institution = require('../models/Institution');
const PlatformRevenue = require('../models/PlatformRevenue');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ─── Helper: Get platform fee % for a given plan ─────────────────────────────
function getPlatformFeePercent(plan) {
  switch ((plan || 'free').toLowerCase()) {
    case 'premium': return parseFloat(process.env.PLATFORM_FEE_PREMIUM) || 5;
    case 'basic':   return parseFloat(process.env.PLATFORM_FEE_BASIC)   || 7;
    default:        return parseFloat(process.env.PLATFORM_FEE_FREE)    || 10;
  }
}

// POST /api/payments/create-order — create a Razorpay order
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { amount, eventTitle, eventId, seat } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `r_${String(eventId).slice(-6)}_${seat}_${Date.now().toString(36)}`.slice(0, 40),
      notes: {
        eventTitle: eventTitle || '',
        eventId: eventId || '',
        seat: seat || '',
        userEmail: req.user.email,
        institutionId: req.user.institutionId || 'none'
      }
    };

    const order = await razorpay.orders.create(options);

    // Look up the platform fee for this institution's plan so frontend can show it
    let platformFeePercent = getPlatformFeePercent('free');
    let institutionAmount = amount;
    let platformFee = 0;
    if (req.user.institutionId) {
      const inst = await Institution.findById(req.user.institutionId).select('plan').lean();
      if (inst) {
        platformFeePercent = getPlatformFeePercent(inst.plan);
        platformFee = parseFloat((amount * platformFeePercent / 100).toFixed(2));
        institutionAmount = parseFloat((amount - platformFee).toFixed(2));
      }
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      // FUTURE-02: fee breakdown for frontend display
      platformFeePercent,
      platformFee,
      institutionAmount
    });
  } catch (err) {
    logger.error('Razorpay order creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payments/verify — verify payment signature + record platform fee
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature,
            eventId, seat, eventTitle, totalAmount, bookingId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification data' });
    }

    // 1. Verify the payment signature using HMAC SHA256
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    // 2. FUTURE-02: Record platform revenue and update institution billing totals
    let platformFeePercent = 0;
    let platformFee = 0;
    let institutionAmount = totalAmount || 0;

    if (totalAmount && totalAmount > 0 && req.user.institutionId) {
      try {
        const inst = await Institution.findById(req.user.institutionId).select('plan billing').lean();
        if (inst) {
          platformFeePercent = getPlatformFeePercent(inst.plan);
          platformFee = parseFloat((totalAmount * platformFeePercent / 100).toFixed(2));
          institutionAmount = parseFloat((totalAmount - platformFee).toFixed(2));

          // Create revenue record (idempotent — skip if bookingId already recorded)
          const revenueData = {
            bookingId: bookingId || razorpay_payment_id,
            institutionId: req.user.institutionId,
            eventId: eventId || '',
            userEmail: req.user.email,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            totalAmount,
            platformFeePercent,
            platformFee,
            institutionAmount,
            eventTitle: eventTitle || '',
            seat: seat || null,
            payoutStatus: 'pending'
          };

          await PlatformRevenue.findOneAndUpdate(
            { bookingId: revenueData.bookingId },
            { $setOnInsert: revenueData },
            { upsert: true, new: false }
          );

          // Atomically update institution billing running totals
          await Institution.findByIdAndUpdate(req.user.institutionId, {
            $inc: {
              'billing.totalRevenue':    totalAmount,
              'billing.platformFeePaid': platformFee,
              'billing.pendingPayout':   institutionAmount
            }
          });

          logger.info('Platform revenue recorded', { institutionId: req.user.institutionId, fee: platformFee, total: totalAmount });
        }
      } catch (revenueErr) {
        // Non-fatal: log but don't block the booking confirmation
        logger.warn('Revenue recording failed (non-fatal)', { error: revenueErr.message });
      }
    }

    res.json({
      verified: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      // FUTURE-02: fee info returned to frontend for display
      platformFeePercent,
      platformFee,
      institutionAmount
    });
  } catch (err) {
    logger.error('Payment verification error', { error: err.message });
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ==========================================
// FUTURE-02: BILLING / REVENUE ENDPOINTS
// ==========================================

// GET /api/payments/revenue/my — institution admin: own revenue summary
router.get('/revenue/my', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    if (!['admin', 'institution_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied. Institution admin required.' });
    }

    const institutionId = req.user.institutionId;
    if (!institutionId && userRole !== 'admin') {
      return res.status(400).json({ error: 'You are not associated with any institution.' });
    }

    const query = institutionId ? { institutionId } : {};
    const [records, institution] = await Promise.all([
      PlatformRevenue.find(query).sort({ createdAt: -1 }).limit(100).lean(),
      institutionId ? Institution.findById(institutionId).select('name plan billing').lean() : null
    ]);

    const summary = {
      totalRevenue: 0, totalPlatformFees: 0,
      totalInstitutionAmount: 0, pendingPayout: 0, paidOut: 0
    };
    records.forEach(r => {
      summary.totalRevenue        += r.totalAmount      || 0;
      summary.totalPlatformFees   += r.platformFee      || 0;
      summary.totalInstitutionAmount += r.institutionAmount || 0;
      if (r.payoutStatus === 'pending') summary.pendingPayout += r.institutionAmount || 0;
      else summary.paidOut        += r.institutionAmount || 0;
    });

    res.json({
      institution: institution ? {
        name: institution.name,
        plan: institution.plan,
        billing: institution.billing
      } : null,
      summary,
      records: records.map(r => ({
        id: r._id,
        bookingId: r.bookingId,
        eventTitle: r.eventTitle,
        seat: r.seat,
        userEmail: r.userEmail,
        totalAmount: r.totalAmount,
        platformFeePercent: r.platformFeePercent,
        platformFee: r.platformFee,
        institutionAmount: r.institutionAmount,
        payoutStatus: r.payoutStatus,
        payoutDate: r.payoutDate,
        payoutNote: r.payoutNote,
        createdAt: r.createdAt
      }))
    });
  } catch (err) {
    logger.error('Revenue/my error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/revenue/all — super admin: all platform revenue
router.get('/revenue/all', verifyAdmin, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(200, parseInt(req.query.limit) || 50);
    const skip    = (page - 1) * limit;
    const status  = req.query.status; // 'pending' | 'paid' | undefined
    const query   = status ? { payoutStatus: status } : {};

    const [records, total] = await Promise.all([
      PlatformRevenue.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PlatformRevenue.countDocuments(query)
    ]);

    // Platform-wide aggregate totals
    const [agg] = await PlatformRevenue.aggregate([
      { $group: {
        _id: null,
        totalCollected: { $sum: '$totalAmount' },
        totalPlatformFees: { $sum: '$platformFee' },
        totalInstitutionOwed: { $sum: '$institutionAmount' },
        pendingPayout: { $sum: { $cond: [{ $eq: ['$payoutStatus','pending'] }, '$institutionAmount', 0] } },
        paidOut: { $sum: { $cond: [{ $eq: ['$payoutStatus','paid'] }, '$institutionAmount', 0] } }
      }}
    ]).exec().catch(() => [{}]);

    res.json({
      platform: {
        totalCollected:       agg?.totalCollected       || 0,
        totalPlatformFees:    agg?.totalPlatformFees    || 0,
        totalInstitutionOwed: agg?.totalInstitutionOwed || 0,
        pendingPayout:        agg?.pendingPayout        || 0,
        paidOut:              agg?.paidOut              || 0
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      records: records.map(r => ({
        id: r._id,
        bookingId: r.bookingId,
        institutionId: r.institutionId,
        eventTitle: r.eventTitle,
        seat: r.seat,
        userEmail: r.userEmail,
        totalAmount: r.totalAmount,
        platformFeePercent: r.platformFeePercent,
        platformFee: r.platformFee,
        institutionAmount: r.institutionAmount,
        payoutStatus: r.payoutStatus,
        payoutDate: r.payoutDate,
        payoutNote: r.payoutNote,
        createdAt: r.createdAt
      }))
    });
  } catch (err) {
    logger.error('Revenue/all error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/payments/revenue/:id/mark-paid — super admin: mark payout as completed
router.put('/revenue/:id/mark-paid', verifyAdmin, async (req, res) => {
  try {
    const { payoutNote } = req.body;
    const record = await PlatformRevenue.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Revenue record not found' });
    if (record.payoutStatus === 'paid') return res.status(400).json({ error: 'Already marked as paid' });

    record.payoutStatus = 'paid';
    record.payoutDate   = new Date();
    record.payoutNote   = payoutNote || '';
    await record.save();

    // Update institution billing: move pendingPayout → lifetimePayout
    if (record.institutionId) {
      await Institution.findByIdAndUpdate(record.institutionId, {
        $inc: {
          'billing.pendingPayout':   -record.institutionAmount,
          'billing.lifetimePayout':   record.institutionAmount
        }
      });
    }

    res.json({ message: 'Payout marked as paid', record: { id: record._id, payoutStatus: record.payoutStatus, payoutDate: record.payoutDate } });
  } catch (err) {
    logger.error('Mark-paid error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/plans — public: get plan details and current fee rates
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        platformFeePercent: parseFloat(process.env.PLATFORM_FEE_FREE)    || 10,
        maxAuditoriums:     parseInt(process.env.PLAN_FREE_MAX_AUDS)      || 3,
        maxEventsPerMonth:  parseInt(process.env.PLAN_FREE_MAX_EVENTS)    || 10,
        features: ['Up to 3 auditoriums', 'Up to 10 events/month', '10% platform fee', 'Basic analytics']
      },
      {
        id: 'basic',
        name: 'Basic',
        price: 999,
        platformFeePercent: parseFloat(process.env.PLATFORM_FEE_BASIC)   || 7,
        maxAuditoriums:     parseInt(process.env.PLAN_BASIC_MAX_AUDS)     || 10,
        maxEventsPerMonth:  parseInt(process.env.PLAN_BASIC_MAX_EVENTS)   || 50,
        features: ['Up to 10 auditoriums', 'Up to 50 events/month', '7% platform fee', 'Full analytics', 'Priority support']
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 2999,
        platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PREMIUM) || 5,
        maxAuditoriums:     parseInt(process.env.PLAN_PREMIUM_MAX_AUDS)   || 999,
        maxEventsPerMonth:  parseInt(process.env.PLAN_PREMIUM_MAX_EVENTS) || 9999,
        features: ['Unlimited auditoriums', 'Unlimited events', '5% platform fee', 'Advanced analytics', 'Custom branding', 'Dedicated support']
      }
    ]
  });
});

module.exports = router;
