const express = require('express');
const router = express.Router();
const xss = require('xss');
const Institution = require('../models/Institution');
const User = require('../models/User');
const Auditorium = require('../models/Auditorium');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { resolveTenant, requireInstitutionAdmin } = require('../middleware/tenant');
const logger = require('../utils/logger');

// Helper: generate a URL-safe slug from a name
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// Default permissions for institution_admin role
const INSTITUTION_ADMIN_PERMS = {
  createEvents: true, deleteEvents: true,
  viewBookings: true, cancelBookings: true,
  addAuditoriums: true, deleteAuditoriums: true,
  scanTickets: true, viewAnalytics: true,
  manageUsers: true
};

// ==========================================
// PUBLIC: Browse institutions
// ==========================================

// GET /api/institutions — list all active institutions (public)
router.get('/', async (req, res) => {
  try {
    const filter = { status: 'active' };

    // Platform admin can see all statuses
    // (check for token but don't require it)
    const token = req.cookies?.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
          delete filter.status; // Show all statuses for platform admin
        }
      } catch (e) { /* ignore — treat as unauthenticated */ }
    }

    const institutions = await Institution.find(filter)
      .select('-settings')
      .sort({ createdAt: -1 })
      .lean();

    res.json(institutions.map(inst => ({
      id: inst._id,
      slug: inst.slug,
      name: inst.name,
      domain: inst.domain,
      city: inst.city,
      state: inst.state,
      contactEmail: inst.contactEmail,
      logo: inst.logo,
      plan: inst.plan,
      status: inst.status,
      createdAt: inst.createdAt
    })));
  } catch (err) {
    logger.error('List institutions error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/institutions/:slug — get institution details
router.get('/:slug', async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug }).lean();
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    // Count stats
    const [auditoriumCount, eventCount, memberCount] = await Promise.all([
      Auditorium.countDocuments({ institutionId: inst._id }),
      Event.countDocuments({ institutionId: inst._id }),
      User.countDocuments({ institutionId: inst._id })
    ]);

    res.json({
      id: inst._id,
      slug: inst.slug,
      name: inst.name,
      domain: inst.domain,
      city: inst.city,
      state: inst.state,
      contactEmail: inst.contactEmail,
      logo: inst.logo,
      plan: inst.plan,
      status: inst.status,
      settings: inst.settings,
      stats: { auditoriums: auditoriumCount, events: eventCount, members: memberCount },
      createdAt: inst.createdAt
    });
  } catch (err) {
    logger.error('Get institution error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// SELF-ONBOARDING: Register a new institution
// ==========================================

// POST /api/institutions/register — create a new institution
// The authenticated user becomes the institution_admin.
router.post('/register', verifyToken, async (req, res) => {
  try {
    // Check if registration is enabled
    const regEnabled = process.env.INSTITUTION_REGISTRATION_ENABLED !== 'false';
    if (!regEnabled) {
      return res.status(403).json({ error: 'Institution registration is currently disabled.' });
    }

    const { name, domain, city, state, contactEmail } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Institution name is required.' });
    }

    // Check if user already owns an institution
    const existingOwned = await Institution.findOne({ ownerId: req.user.id });
    if (existingOwned) {
      return res.status(409).json({
        error: `You already own an institution: "${existingOwned.name}". Each account can own one institution.`
      });
    }

    // Generate slug and ensure uniqueness
    let slug = slugify(name);
    if (!slug) slug = 'institution';
    const existingSlug = await Institution.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Validate domain if provided
    const cleanDomain = domain ? domain.trim().toLowerCase().replace(/^@/, '') : null;
    if (cleanDomain) {
      const domainTaken = await Institution.findOne({ domain: cleanDomain });
      if (domainTaken) {
        return res.status(409).json({
          error: `The email domain "${cleanDomain}" is already registered to another institution.`
        });
      }
    }

    const institution = await Institution.create({
      slug,
      name: xss(name.trim()),
      domain: cleanDomain,
      city: xss((city || '').trim()),
      state: xss((state || '').trim()),
      contactEmail: (contactEmail || req.user.email).trim().toLowerCase(),
      ownerId: req.user.id,
      status: 'active',
      plan: 'free',
      // FUTURE-02: Apply plan limits from env for free tier
      settings: {
        maxAuditoriums:    parseInt(process.env.PLAN_FREE_MAX_AUDS)    || 3,
        maxEventsPerMonth: parseInt(process.env.PLAN_FREE_MAX_EVENTS)  || 10,
        allowPublicEvents: true,
        requireApproval:   false
      }
    });

    // Promote the registering user to institution_admin
    await User.findByIdAndUpdate(req.user.id, {
      role: 'institution_admin',
      institutionId: institution._id,
      permissions: INSTITUTION_ADMIN_PERMS
    });

    logger.info('New institution registered', { name: institution.name, slug: institution.slug, owner: req.user.email });

    res.status(201).json({
      message: 'Institution registered successfully! You are now the Institution Admin.',
      institution: {
        id: institution._id,
        slug: institution.slug,
        name: institution.name,
        domain: institution.domain,
        city: institution.city,
        state: institution.state,
        status: institution.status
      },
      // Include updated user info so frontend can update state
      user: {
        role: 'institution_admin',
        institutionId: institution._id,
        institutionName: institution.name,
        permissions: INSTITUTION_ADMIN_PERMS
      }
    });
  } catch (err) {
    logger.error('Register institution error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// INSTITUTION ADMIN: Manage institution
// ==========================================

// PUT /api/institutions/:slug — update institution details
router.put('/:slug', verifyToken, resolveTenant, async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    // Authorization: must be institution owner or platform admin
    const isOwner = inst.ownerId.toString() === req.user.id;
    const isPlatformAdmin = req.user.role === 'admin';
    if (!isOwner && !isPlatformAdmin) {
      return res.status(403).json({ error: 'Only the institution owner or platform admin can update this institution.' });
    }

    const { name, domain, city, state, contactEmail, logo, settings } = req.body;

    if (name) inst.name = xss(name.trim());
    if (city !== undefined) inst.city = xss(city.trim());
    if (state !== undefined) inst.state = xss(state.trim());
    if (contactEmail) inst.contactEmail = contactEmail.trim().toLowerCase();
    if (logo !== undefined) inst.logo = logo;

    // Domain change: validate uniqueness
    if (domain !== undefined) {
      const cleanDomain = domain ? domain.trim().toLowerCase().replace(/^@/, '') : null;
      if (cleanDomain && cleanDomain !== inst.domain) {
        const domainTaken = await Institution.findOne({ domain: cleanDomain, _id: { $ne: inst._id } });
        if (domainTaken) {
          return res.status(409).json({ error: `Domain "${cleanDomain}" is already registered.` });
        }
      }
      inst.domain = cleanDomain;
    }

    // Settings update (partial merge)
    if (settings && typeof settings === 'object') {
      inst.settings = { ...(inst.settings?.toObject?.() || inst.settings || {}), ...settings };
      inst.markModified('settings');
    }

    // Platform admin can also change plan and status
    if (isPlatformAdmin) {
      if (req.body.plan) inst.plan = req.body.plan;
      if (req.body.status) inst.status = req.body.status;
    }

    await inst.save();

    res.json({
      message: 'Institution updated',
      institution: {
        id: inst._id,
        slug: inst.slug,
        name: inst.name,
        domain: inst.domain,
        city: inst.city,
        state: inst.state,
        contactEmail: inst.contactEmail,
        logo: inst.logo,
        plan: inst.plan,
        status: inst.status,
        settings: inst.settings
      }
    });
  } catch (err) {
    logger.error('Update institution error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// MEMBERS: Manage institution members
// ==========================================

// GET /api/institutions/:slug/members — list members of an institution
router.get('/:slug/members', verifyToken, resolveTenant, async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    // Authorization: institution admin/owner or platform admin
    const isOwner = inst.ownerId.toString() === req.user.id;
    const isPlatformAdmin = req.user.role === 'admin';
    const isInstAdmin = req.user.role === 'institution_admin' &&
                        req.institution && req.institution._id.toString() === inst._id.toString();

    if (!isOwner && !isPlatformAdmin && !isInstAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const members = await User.find({ institutionId: inst._id }, '-password -resetToken -resetTokenExpiry -verificationToken -verificationExpiry')
      .sort({ createdAt: -1 })
      .lean();

    res.json(members.map(m => ({
      id: m._id,
      email: m.email,
      role: m.role,
      college: m.college,
      permissions: m.permissions,
      emailVerified: m.emailVerified,
      createdAt: m.createdAt
    })));
  } catch (err) {
    logger.error('List members error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/institutions/:slug/join — user joins an institution
router.post('/:slug/join', verifyToken, async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug, status: 'active' });
    if (!inst) return res.status(404).json({ error: 'Institution not found or is not active.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user is already in an institution
    if (user.institutionId) {
      if (user.institutionId.toString() === inst._id.toString()) {
        return res.status(400).json({ error: 'You are already a member of this institution.' });
      }
      return res.status(409).json({
        error: 'You are already affiliated with another institution. Leave your current institution first.'
      });
    }

    // If institution requires approval, we'd add a pending member queue here
    // For now, auto-approve
    user.institutionId = inst._id;
    await user.save();

    res.json({
      message: `You have joined "${inst.name}" successfully.`,
      institutionId: inst._id,
      institutionName: inst.name
    });
  } catch (err) {
    logger.error('Join institution error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/institutions/:slug/leave — user leaves an institution
router.post('/:slug/leave', verifyToken, async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.institutionId || user.institutionId.toString() !== inst._id.toString()) {
      return res.status(400).json({ error: 'You are not a member of this institution.' });
    }

    // Institution owner cannot leave
    if (inst.ownerId.toString() === req.user.id) {
      return res.status(403).json({
        error: 'As the institution owner, you cannot leave. Transfer ownership first or delete the institution.'
      });
    }

    // If they had an institution-level role, reset to student
    if (['institution_admin', 'pseudo_admin', 'scanner'].includes(user.role)) {
      user.role = 'student';
      user.permissions = {
        createEvents: false, deleteEvents: false,
        viewBookings: false, cancelBookings: false,
        addAuditoriums: false, deleteAuditoriums: false,
        scanTickets: false, viewAnalytics: false,
        manageUsers: false
      };
    }
    user.institutionId = null;
    await user.save();

    res.json({ message: `You have left "${inst.name}".` });
  } catch (err) {
    logger.error('Leave institution error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// FUTURE-02: BILLING
// ==========================================

// GET /api/institutions/:slug/billing — institution admin: billing summary
router.get('/:slug/billing', verifyToken, async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug }).lean();
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    // Authorization: owner, institution_admin of this institution, or platform admin
    const isOwner = inst.ownerId.toString() === req.user.id;
    const isPlatformAdmin = req.user.role === 'admin';
    const isInstAdmin = req.user.role === 'institution_admin' &&
                        req.user.institutionId &&
                        req.user.institutionId.toString() === inst._id.toString();
    if (!isOwner && !isPlatformAdmin && !isInstAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const PlatformRevenue = require('../models/PlatformRevenue');

    // Recent transactions (last 20)
    const recent = await PlatformRevenue.find({ institutionId: inst._id })
      .sort({ createdAt: -1 }).limit(20).lean();

    // Monthly breakdown: aggregate by month for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthly = await PlatformRevenue.aggregate([
      { $match: { institutionId: inst._id, createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        totalAmount: { $sum: '$totalAmount' },
        platformFee: { $sum: '$platformFee' },
        institutionAmount: { $sum: '$institutionAmount' },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Platform fee % for this plan
    const PlatformRevRoutes = require('./payments');
    const feePercent = (() => {
      switch((inst.plan || 'free').toLowerCase()) {
        case 'premium': return parseFloat(process.env.PLATFORM_FEE_PREMIUM) || 5;
        case 'basic':   return parseFloat(process.env.PLATFORM_FEE_BASIC)   || 7;
        default:        return parseFloat(process.env.PLATFORM_FEE_FREE)    || 10;
      }
    })();

    res.json({
      institution: {
        name: inst.name,
        slug: inst.slug,
        plan: inst.plan,
        settings: inst.settings
      },
      billing: inst.billing || { totalRevenue: 0, platformFeePaid: 0, pendingPayout: 0, lifetimePayout: 0 },
      platformFeePercent: feePercent,
      monthly: monthly.map(m => ({
        year: m._id.year,
        month: m._id.month,
        label: new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
        totalAmount: m.totalAmount,
        platformFee: m.platformFee,
        institutionAmount: m.institutionAmount,
        transactions: m.count
      })),
      recent: recent.map(r => ({
        id: r._id,
        bookingId: r.bookingId,
        eventTitle: r.eventTitle,
        seat: r.seat,
        totalAmount: r.totalAmount,
        platformFee: r.platformFee,
        institutionAmount: r.institutionAmount,
        payoutStatus: r.payoutStatus,
        payoutDate: r.payoutDate,
        createdAt: r.createdAt
      }))
    });
  } catch (err) {
    logger.error('Billing endpoint error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/institutions/:slug/plan — platform admin: change institution plan
router.put('/:slug/plan', verifyAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'basic', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be free, basic, or premium.' });
    }
    const inst = await Institution.findOne({ slug: req.params.slug });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    inst.plan = plan;
    // Update plan limits from env
    const limits = {
      free:    { maxAuditoriums: parseInt(process.env.PLAN_FREE_MAX_AUDS)    || 3,   maxEventsPerMonth: parseInt(process.env.PLAN_FREE_MAX_EVENTS)    || 10 },
      basic:   { maxAuditoriums: parseInt(process.env.PLAN_BASIC_MAX_AUDS)   || 10,  maxEventsPerMonth: parseInt(process.env.PLAN_BASIC_MAX_EVENTS)   || 50 },
      premium: { maxAuditoriums: parseInt(process.env.PLAN_PREMIUM_MAX_AUDS) || 999, maxEventsPerMonth: parseInt(process.env.PLAN_PREMIUM_MAX_EVENTS) || 9999 }
    };
    inst.settings.maxAuditoriums    = limits[plan].maxAuditoriums;
    inst.settings.maxEventsPerMonth = limits[plan].maxEventsPerMonth;
    inst.markModified('settings');
    await inst.save();

    logger.info('Institution plan changed', { name: inst.name, plan, by: req.user.email });
    res.json({
      message: `Plan updated to ${plan}`,
      plan: inst.plan,
      settings: inst.settings
    });
  } catch (err) {
    logger.error('Plan upgrade error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// PLATFORM ADMIN: Institution management
// ==========================================

// DELETE /api/institutions/:slug — delete an institution (Platform Admin only)
router.delete('/:slug', verifyAdmin, async (req, res) => {
  try {
    const inst = await Institution.findOne({ slug: req.params.slug });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });

    // Remove institution association from all members
    await User.updateMany(
      { institutionId: inst._id },
      { $set: { institutionId: null } }
    );

    // Note: We do NOT delete auditoriums/events/bookings here — they remain as orphaned data.
    // A separate cleanup route or cron job should handle data deletion.
    // This prevents accidental mass data loss.

    await Institution.deleteOne({ _id: inst._id });
    logger.info('Institution deleted', { name: inst.name, slug: inst.slug, by: req.user.email });

    res.json({ message: `Institution "${inst.name}" has been deleted.` });
  } catch (err) {
    logger.error('Delete institution error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
