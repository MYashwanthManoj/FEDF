const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');  // built-in — no install needed
const xss = require('xss');
const User = require('../models/User');
const Institution = require('../models/Institution');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const logger = require('../utils/logger');

// Load master admin emails from env — NEVER hardcode personal emails in source
const MASTER_ADMINS = (process.env.MASTER_ADMINS || 'admin@system.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_PERMS = {
  admin:              { createEvents: true, deleteEvents: true, viewBookings: true, cancelBookings: true, addAuditoriums: true, deleteAuditoriums: true, scanTickets: true, viewAnalytics: true, manageUsers: true },
  institution_admin:  { createEvents: true, deleteEvents: true, viewBookings: true, cancelBookings: true, addAuditoriums: true, deleteAuditoriums: true, scanTickets: true, viewAnalytics: true, manageUsers: true },
  pseudo_admin:       { createEvents: true, deleteEvents: false, viewBookings: true, cancelBookings: true, addAuditoriums: true, deleteAuditoriums: false, scanTickets: true, viewAnalytics: true, manageUsers: false },
  scanner:            { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: true, viewAnalytics: false, manageUsers: false },
  teacher:            { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: false, viewAnalytics: false, manageUsers: false },
  student:            { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: false, viewAnalytics: false, manageUsers: false }
};

// Helper: build user response payload
// Optionally pass institution data to avoid an extra DB query
function userPayload(user, institution) {
  return {
    email: user.email,
    role: user.role,
    college: user.college,
    gender: user.gender,
    cluster: user.cluster,
    lastClusterChange: user.lastClusterChange,
    lastProfileChange: user.lastProfileChange,
    createdAt: user.createdAt,
    isAdmin: MASTER_ADMINS.includes(user.email) || user.role === 'admin',
    permissions: user.permissions || DEFAULT_PERMS[user.role] || DEFAULT_PERMS.student,
    institutionId: user.institutionId || null,
    institutionName: institution ? institution.name : null,
    institutionSlug: institution ? institution.slug : null
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Please fill in all fields' });

    const emailLower = email.trim().toLowerCase();

    // Auto-create master admin on first login attempt
    if (MASTER_ADMINS.includes(emailLower)) {
      const existing = await User.findOne({ email: emailLower });
      if (!existing) {
        const hash = await bcrypt.hash(password, 10);
        await User.create({
          email: emailLower,
          password: hash,
          role: 'admin',
          college: 'System Admin',
          permissions: DEFAULT_PERMS.admin
        });
      }
    }

    const user = await User.findOne({ email: emailLower });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const isAdmin = MASTER_ADMINS.includes(emailLower) || user.role === 'admin';
    const userRole = isAdmin ? 'admin' : user.role;

    // Resolve institution for JWT and response
    let institution = null;
    if (user.institutionId) {
      institution = await Institution.findById(user.institutionId).lean();
    }

    // JWT payload includes institutionId for tenant-scoped requests
    const jwtPayload = { id: user._id, email: user.email, role: userRole };
    if (user.institutionId) jwtPayload.institutionId = user.institutionId;

    // Short-lived access token (15 minutes)
    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '15m' });

    // Long-lived refresh token (7 days)
    const refreshToken = jwt.sign(jwtPayload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000          // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json(userPayload(user, institution));
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, college, password, gender, cluster } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Please fill all required fields' });

    const emailLower = email.trim().toLowerCase();
    const isValidEmail = emailLower.includes('@') && emailLower.split('@')[1]?.includes('.');
    if (!isValidEmail) return res.status(400).json({ error: 'Please enter a valid email address' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(409).json({ error: 'Account already exists. Please sign in.' });

    const isTeacher = emailLower.endsWith('@teacher.com');
    const isKLH = emailLower.endsWith('@klh.edu.in');
    const hash = await bcrypt.hash(password, 10);
    const cleanCollege = xss((college || 'General Public').trim());
    const role = isTeacher ? 'teacher' : 'student';

    // Auto-associate with institution by email domain
    const emailDomain = emailLower.split('@')[1];
    let institution = null;
    if (emailDomain) {
      institution = await Institution.findOne({ domain: emailDomain, status: 'active' }).lean();
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const newUser = new User({
      email: emailLower,
      password: hash,
      role: role,
      college: cleanCollege,
      gender: gender || null,
      cluster: isKLH ? (cluster || null) : null,
      lastClusterChange: isKLH ? new Date() : null,
      permissions: DEFAULT_PERMS[role],
      institutionId: institution ? institution._id : null,
      emailVerified: MASTER_ADMINS.includes(emailLower),
      verificationToken,
      verificationExpiry
    });
    const user = await newUser.save();

    const isAdmin = MASTER_ADMINS.includes(emailLower) || user.role === 'admin';
    const userRole = isAdmin ? 'admin' : role;

    // JWT payload includes institutionId for tenant-scoped requests
    const jwtPayload = { id: user._id, email: user.email, role: userRole };
    if (user.institutionId) jwtPayload.institutionId = user.institutionId;

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(jwtPayload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json(userPayload(user, institution));

    // Send verification email asynchronously (non-blocking — signup succeeds either way)
    sendVerificationEmail({ to: user.email, token: verificationToken }).catch(() => {});
  } catch (err) {
    logger.error('Signup error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/password
router.put('/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const email = req.user.email;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Fill all fields' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password too short' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated!' });
  } catch (err) {
    logger.error('Password change error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { gender, cluster } = req.body;
    const email = req.user.email;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isKLH = user.email.endsWith('@klh.edu.in');
    const cooldownMs = isKLH ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    if (user.lastProfileChange && (now - new Date(user.lastProfileChange)) < cooldownMs) {
      const nextChangeDate = new Date(new Date(user.lastProfileChange).getTime() + cooldownMs);
      const daysLeft = Math.ceil((nextChangeDate - now) / (24 * 60 * 60 * 1000));
      return res.status(403).json({ error: `Profile locked. ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.` });
    }

    if (isKLH) {
      user.cluster = cluster;
      user.lastClusterChange = now;
    }
    user.lastProfileChange = now;
    await user.save();

    res.json(userPayload(user));
  } catch (err) {
    logger.error('Profile update error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Resolve institution for response
    let institution = null;
    if (user.institutionId) {
      institution = await Institution.findById(user.institutionId).lean();
    }

    res.json(userPayload(user, institution));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('refreshToken');  // also clear refresh token
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh — get a new access token using the refresh token
// The frontend should call this automatically when a 401 is received.
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token. Please log in again.' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Issue a new short-lived access token (includes institutionId if present)
    const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
    if (decoded.institutionId) payload.institutionId = decoded.institutionId;

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (err) {
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'Refresh token expired or invalid. Please log in again.' });
  }
});

// ==========================================
// EMAIL VERIFICATION (FUTURE-06)
// ==========================================

// GET /api/auth/verify-email?token=xxx  — user clicks link from email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing verification token.');

    const user = await User.findOne({
      verificationToken: token,
      verificationExpiry: { $gt: new Date() } // not expired
    });

    if (!user) {
      // Redirect to app with error param so the UI can show a message
      return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/?verified=expired`);
    }

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationExpiry = null;
    await user.save();

    // Redirect to app with success param
    res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/?verified=true`);
  } catch (err) {
    logger.error('Email verification error', { error: err.message });
    res.status(500).send('Server error during verification.');
  }
});

// POST /api/auth/resend-verification  — resend verification email
router.post('/resend-verification', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email is already verified.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.verificationToken = token;
    user.verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail({ to: user.email, token });
    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// PASSWORD RESET (FUTURE-09)
// ==========================================

// POST /api/auth/forgot-password  — sends reset link to email
// Always returns 200 to prevent email enumeration attacks.
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Always respond 200 — don't reveal if an account exists
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    // Do the work asynchronously after responding
    const user = await User.findOne({ email });
    if (!user) return; // silent — already responded

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    sendPasswordResetEmail({ to: user.email, token }).catch(() => {});
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
  }
});

// POST /api/auth/reset-password  — set new password using token from email
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() } // not expired
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired. Please request a new one.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    // Clear any active sessions (force re-login with new password)
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// SUPER ADMIN: USER MANAGEMENT
// ==========================================

// GET /api/auth/users — list all users (Super Admin only)
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users.map(u => ({
      email: u.email,
      role: u.role,
      college: u.college,
      permissions: u.permissions || DEFAULT_PERMS[u.role] || DEFAULT_PERMS.student,
      createdAt: u.createdAt
    })));
  } catch (err) {
    logger.error('List users error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/users/create — create a new account with role + permissions (Super Admin only)
router.post('/users/create', verifyAdmin, async (req, res) => {
  try {
    const { email, password, role, college, permissions } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: 'Email, password and role are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const validRoles = ['student', 'teacher', 'institution_admin', 'pseudo_admin', 'scanner'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role. Cannot create platform admin accounts.' });

    const emailLower = email.trim().toLowerCase();
    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(409).json({ error: 'Account already exists with this email' });

    const hash = await bcrypt.hash(password, 10);
    const perms = permissions || DEFAULT_PERMS[role] || DEFAULT_PERMS.student;

    const user = await User.create({
      email: emailLower,
      password: hash,
      role,
      college: xss((college || '').trim()) || 'Unassigned',
      permissions: perms
    });

    res.status(201).json({
      email: user.email,
      role: user.role,
      college: user.college,
      permissions: user.permissions,
      createdAt: user.createdAt
    });
  } catch (err) {
    logger.error('Create user error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/users/:email/role — update user role + permissions (Super Admin only)
router.put('/users/:email/role', verifyAdmin, async (req, res) => {
  try {
    const targetEmail = decodeURIComponent(req.params.email).toLowerCase();
    const { role, permissions } = req.body;

    if (MASTER_ADMINS.includes(targetEmail)) {
      return res.status(403).json({ error: 'Cannot modify master admin accounts' });
    }

    const user = await User.findOne({ email: targetEmail });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validRoles = ['student', 'teacher', 'institution_admin', 'pseudo_admin', 'scanner'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role) user.role = role;
    if (permissions) {
      user.permissions = { ...(user.permissions?.toObject?.() || user.permissions || {}), ...permissions };
    }
    user.markModified('permissions');
    await user.save();

    res.json({
      email: user.email,
      role: user.role,
      college: user.college,
      permissions: user.permissions,
      createdAt: user.createdAt
    });
  } catch (err) {
    logger.error('Update user role error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/auth/users/:email — delete a user account (Super Admin only)
router.delete('/users/:email', verifyAdmin, async (req, res) => {
  try {
    const targetEmail = decodeURIComponent(req.params.email).toLowerCase();

    if (MASTER_ADMINS.includes(targetEmail)) {
      return res.status(403).json({ error: 'Cannot delete master admin accounts' });
    }

    const user = await User.findOne({ email: targetEmail });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin accounts' });

    await User.deleteOne({ email: targetEmail });
    res.json({ message: 'User deleted' });
  } catch (err) {
    logger.error('Delete user error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
