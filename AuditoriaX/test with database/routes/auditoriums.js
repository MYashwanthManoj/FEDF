const express = require('express');
const router = express.Router();
const xss = require('xss');
const Auditorium = require('../models/Auditorium');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const SeatMap = require('../models/SeatMap');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { resolveTenant } = require('../middleware/tenant');
const User = require('../models/User');
const Institution = require('../models/Institution');

// Permission guard: mirrors the one in events.js
function verifyPermission(permissionKey) {
  return [verifyToken, async (req, res, next) => {
    try {
      if (req.user.role === 'admin' || req.user.role === 'institution_admin') return next();
      const user = await User.findOne({ email: req.user.email.toLowerCase() });
      if (!user) return res.status(401).json({ error: 'User not found' });
      if (user.permissions && user.permissions[permissionKey] === true) return next();
      return res.status(403).json({
        error: `Access denied. You do not have the '${permissionKey}' permission.`
      });
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  }];
}

// GET /api/auditoriums
router.get('/', async (req, res) => {
  try {
    const auds = await Auditorium.find().sort({ createdAt: 1 });
    // Map to frontend-compatible shape
    res.json(auds.map(a => ({
      id: a.audId,
      institutionId: a.institutionId || null,
      college: a.college,
      name: a.name,
      capacity: a.capacity,
      city: a.city,
      facilities: a.facilities,
      teacherSeats: a.teacherSeats,
      girlSeats: a.girlSeats,
      boySeats: a.boySeats,
      createdAt: a.createdAt
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auditoriums  — requires 'addAuditoriums' permission
router.post('/', verifyPermission('addAuditoriums'), async (req, res) => {
  try {
    const { college, name, capacity, city, facilities, teacherSeats, girlSeats, boySeats } = req.body;
    if (!college || !name || !city) return res.status(400).json({ error: 'Fill all auditorium fields' });
    if (!capacity || capacity < 50 || capacity > 1000) return res.status(400).json({ error: 'Capacity must be 50–1000' });
    if (teacherSeats + girlSeats + boySeats !== capacity) return res.status(400).json({ error: 'Seat allocation must equal capacity' });

    // Resolve the user's institution for tenant scoping
    const user = await User.findById(req.user.id).lean();
    const institutionId = user?.institutionId || null;

    // FUTURE-02: Enforce plan-based auditorium limit
    if (institutionId) {
      const inst = await Institution.findById(institutionId).select('plan settings name').lean();
      if (inst) {
        const maxAuds = inst.settings?.maxAuditoriums ?? 3;
        const currentCount = await require('../models/Auditorium').countDocuments({ institutionId });
        if (currentCount >= maxAuds) {
          return res.status(403).json({
            error: `Plan limit reached: your ${inst.plan} plan allows ${maxAuds} auditorium${maxAuds !== 1 ? 's' : ''}. You currently have ${currentCount}. Upgrade your plan to add more.`,
            limit: maxAuds,
            current: currentCount,
            plan: inst.plan
          });
        }
      }
    }

    const audId = 'aud_' + Date.now();

    const cleanCollege = xss(college);
    const cleanName = xss(name);
    const cleanCity = xss(city);
    const cleanFacilities = (facilities || []).map(f => xss(f));

    await Auditorium.create({
      audId, institutionId, college: cleanCollege, name: cleanName, capacity, city: cleanCity,
      facilities: cleanFacilities,
      teacherSeats, girlSeats, boySeats
    });

    res.status(201).json({ message: 'Auditorium added!', id: audId });
  } catch (err) {
    console.error('Add auditorium error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// DELETE /api/auditoriums/:id  — requires 'deleteAuditoriums' permission
router.delete('/:id', verifyPermission('deleteAuditoriums'), async (req, res) => {
  try {
    const audId = req.params.id;
    await Auditorium.deleteOne({ audId });

    // Delete associated events
    const events = await Event.find({ auditoriumId: audId });
    const eventIds = events.map(e => e.evtId);
    await Event.deleteMany({ auditoriumId: audId });

    // Delete associated bookings and seat maps
    await Booking.deleteMany({ auditoriumId: audId });
    await SeatMap.deleteMany({ eventId: { $in: eventIds } });

    res.json({ message: 'Auditorium deleted' });
  } catch (err) {
    console.error('Delete auditorium error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
