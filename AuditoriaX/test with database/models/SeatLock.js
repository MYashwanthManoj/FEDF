const mongoose = require('mongoose');

// Temporarily locks a seat for a user during the payment flow.
// Lock expires automatically after TTL seconds (5 minutes).
const seatLockSchema = new mongoose.Schema({
  eventId:       { type: String, required: true },
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  seat:       { type: Number, required: true },
  userEmail:  { type: String, required: true },
  lockedAt:   { type: Date, default: Date.now, expires: 300 } // auto-delete after 5 mins
});

// Compound unique index: only ONE lock per (eventId, seat) at a time
seatLockSchema.index({ eventId: 1, seat: 1 }, { unique: true });

module.exports = mongoose.model('SeatLock', seatLockSchema);
