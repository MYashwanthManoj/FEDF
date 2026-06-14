const mongoose = require('mongoose');

// Institution represents a college / university that has onboarded onto AuditoriaX.
// Every tenant-scoped resource (auditorium, event, booking) belongs to exactly one institution.
const institutionSchema = new mongoose.Schema({
  slug:           { type: String, required: true, unique: true, lowercase: true, trim: true },  // URL-safe identifier, e.g. "kl-university"
  name:           { type: String, required: true, trim: true },  // Display name, e.g. "KL University"
  domain:         { type: String, default: null, lowercase: true, trim: true },  // Email domain for auto-association, e.g. "klh.edu.in"
  city:           { type: String, default: '' },
  state:          { type: String, default: '' },
  contactEmail:   { type: String, default: '', lowercase: true, trim: true },
  logo:           { type: String, default: null },   // URL to institution logo (optional)
  plan:           { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },  // FUTURE-02 billing plan
  status:         { type: String, enum: ['pending', 'active', 'suspended'], default: 'active' },
  ownerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // User who registered this institution

  // FUTURE-02: Razorpay linked account (for future direct transfers)
  razorpayAccountId: { type: String, default: null },

  // FUTURE-02: Billing running totals — updated atomically on each paid booking.
  // These cached totals let the billing dashboard render without expensive aggregations.
  billing: {
    totalRevenue:      { type: Number, default: 0 },  // Total ₹ students paid to this institution's events
    platformFeePaid:   { type: Number, default: 0 },  // Total platform fees deducted
    pendingPayout:     { type: Number, default: 0 },  // ₹ owed to institution but not yet paid out
    lifetimePayout:    { type: Number, default: 0 },  // Total ₹ ever paid out to institution
  },

  settings: {
    maxAuditoriums:     { type: Number, default: 3 },          // Free: 3, Basic: 10, Premium: unlimited (999)
    maxEventsPerMonth:  { type: Number, default: 10 },         // Free: 10, Basic: 50, Premium: unlimited (9999)
    allowPublicEvents:  { type: Boolean, default: true },      // Events visible to students from other institutions
    requireApproval:    { type: Boolean, default: false }      // New members need approval to join
  },
  createdAt:      { type: Date, default: Date.now }
});

// Index for fast lookup by email domain (used during signup auto-association)
institutionSchema.index({ domain: 1 }, { sparse: true });

module.exports = mongoose.model('Institution', institutionSchema);
