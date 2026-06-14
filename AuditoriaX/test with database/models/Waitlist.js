/**
 * Waitlist — FUTURE-04
 * When an event is full, students can join a waitlist.
 * When a seat is freed (admin cancel or student self-cancel),
 * the first person in line is notified with a time-limited booking token.
 */
const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  eventId:       { type: String, required: true, index: true },
  userEmail:     { type: String, required: true, lowercase: true, trim: true },
  userName:      { type: String, default: '' },
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },

  // Position in queue (lower = higher priority)
  position:      { type: Number, required: true },

  // Notification token — sent via email, lets the user book without re-queuing
  notifyToken:   { type: String, default: null, index: true },
  notifyExpiry:  { type: Date,   default: null },
  notified:      { type: Boolean, default: false },
  notifiedAt:    { type: Date,   default: null },

  // Outcome
  status: {
    type: String,
    enum: ['waiting', 'notified', 'booked', 'expired', 'cancelled'],
    default: 'waiting',
    index: true
  }
}, { timestamps: true });

// Compound unique: one entry per user per event
waitlistSchema.index({ eventId: 1, userEmail: 1 }, { unique: true });
// Fast queue fetch: event + status + position
waitlistSchema.index({ eventId: 1, status: 1, position: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
