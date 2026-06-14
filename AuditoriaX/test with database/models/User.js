const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:           { type: String, required: true },
  role:               { type: String, enum: ['student', 'teacher', 'admin', 'institution_admin', 'pseudo_admin', 'scanner'], default: 'student' },
  college:            { type: String, default: '' },
  institutionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null },
  gender:             { type: String, default: null },
  cluster:            { type: String, default: null },
  lastClusterChange:  { type: Date, default: null },
  lastProfileChange:  { type: Date, default: null },
  permissions: {
    createEvents:     { type: Boolean, default: false },
    deleteEvents:     { type: Boolean, default: false },
    viewBookings:     { type: Boolean, default: false },
    cancelBookings:   { type: Boolean, default: false },
    addAuditoriums:   { type: Boolean, default: false },
    deleteAuditoriums:{ type: Boolean, default: false },
    scanTickets:      { type: Boolean, default: false },
    viewAnalytics:    { type: Boolean, default: false },
    manageUsers:      { type: Boolean, default: false }
  },
  // Email verification (FUTURE-06)
  emailVerified:        { type: Boolean, default: false },
  verificationToken:    { type: String,  default: null },
  verificationExpiry:   { type: Date,    default: null },
  // Password reset (FUTURE-09)
  resetToken:           { type: String,  default: null },
  resetTokenExpiry:     { type: Date,    default: null },

  createdAt:          { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
