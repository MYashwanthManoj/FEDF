const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  evtId:          { type: String, required: true, unique: true },
  institutionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  title:          { type: String, required: true },
  category:       { type: String, required: true },
  auditoriumId:   { type: String, required: true },
  college:        { type: String, required: true },
  date:           { type: String, required: true },
  time:           { type: String, required: true },
  duration:       { type: Number, default: 2 },
  clusters:       { type: [String], default: [] },
  price:          { type: Number, default: 0 },
  color:          { type: String, default: '#6c63ff' },
  description:    { type: String, default: '' },
  createdBy:      { type: String, default: '' },
  createdAt:      { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);
