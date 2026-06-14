const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  ticketId:         { type: String, required: true, unique: true },
  institutionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  userEmail:        { type: String, required: true },
  userRole:         { type: String, required: true },
  eventId:          { type: String, required: true },
  eventTitle:       { type: String, required: true },
  auditoriumId:     { type: String, required: true },
  auditoriumName:   { type: String, required: true },
  eventCollege:     { type: String, default: '' },
  date:             { type: String, required: true },
  time:             { type: String, required: true },
  seat:             { type: Number, required: true },
  price:            { type: Number, default: 0 },
  txId:             { type: String, default: null },
  category:         { type: String, default: '' },
  color:            { type: String, default: '' },
  attended:         { type: Boolean, default: false },
  bookedAt:         { type: Date, default: Date.now }
});

// Compound index: one booking per student per event
bookingSchema.index({ userEmail: 1, eventId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
