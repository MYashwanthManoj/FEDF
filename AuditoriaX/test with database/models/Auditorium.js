const mongoose = require('mongoose');

const auditoriumSchema = new mongoose.Schema({
  audId:          { type: String, required: true, unique: true },
  institutionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  college:        { type: String, required: true },
  name:           { type: String, required: true },
  capacity:       { type: Number, required: true },
  city:           { type: String, required: true },
  facilities:     { type: [String], default: [] },
  teacherSeats:   { type: Number, default: 0 },
  girlSeats:      { type: Number, default: 0 },
  boySeats:       { type: Number, default: 0 },
  createdAt:      { type: Date, default: Date.now }
});

module.exports = mongoose.model('Auditorium', auditoriumSchema);
