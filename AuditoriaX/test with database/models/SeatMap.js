const mongoose = require('mongoose');

const seatMapSchema = new mongoose.Schema({
  eventId:       { type: String, required: true, unique: true },
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  capacity:   { type: Number, required: true },
  seats:      { type: [Boolean], required: true }   // true = booked, false = available
});

module.exports = mongoose.model('SeatMap', seatMapSchema);
