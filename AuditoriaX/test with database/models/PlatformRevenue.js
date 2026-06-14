const mongoose = require('mongoose');

/**
 * PlatformRevenue — FUTURE-02: Billing Model
 *
 * Records the platform fee collected on every paid booking.
 * This is the audit trail for AuditoriaX revenue and institution payouts.
 *
 * Flow:
 *   Student pays ₹200 → Razorpay collects full amount → payment verified →
 *   PlatformRevenue record created → institution owes platform its fee cut →
 *   Platform pays institution (totalAmount - platformFee) on agreed schedule.
 */
const platformRevenueSchema = new mongoose.Schema({
  // References
  bookingId:          { type: String, required: true, unique: true },    // ticketId from Booking
  institutionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  eventId:            { type: String, required: true },
  userEmail:          { type: String, required: true, lowercase: true, trim: true },
  razorpayPaymentId:  { type: String, required: true },
  razorpayOrderId:    { type: String, default: null },

  // Amounts (all in ₹, stored as numbers with 2dp precision)
  totalAmount:        { type: Number, required: true },   // What student paid
  platformFeePercent: { type: Number, required: true },   // Fee % applied (e.g. 10)
  platformFee:        { type: Number, required: true },   // ₹ kept by platform  = totalAmount * (feePercent/100)
  institutionAmount:  { type: Number, required: true },   // ₹ owed to institution = totalAmount - platformFee

  // Payout tracking
  payoutStatus:  { type: String, enum: ['pending', 'paid'], default: 'pending' },
  payoutDate:    { type: Date,   default: null },
  payoutNote:    { type: String, default: '' },  // e.g. "Paid via NEFT on 01-Jul-2025"

  // Metadata
  eventTitle:    { type: String, default: '' },
  seat:          { type: Number, default: null },

  createdAt:     { type: Date, default: Date.now }
});

// Indexes for dashboard queries
platformRevenueSchema.index({ institutionId: 1, createdAt: -1 });
platformRevenueSchema.index({ payoutStatus: 1 });
platformRevenueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PlatformRevenue', platformRevenueSchema);
