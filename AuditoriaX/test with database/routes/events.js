const express = require('express');
const router = express.Router();
const xss = require('xss');
const Event = require('../models/Event');
const Auditorium = require('../models/Auditorium');
const Booking = require('../models/Booking');
const SeatMap = require('../models/SeatMap');
const { verifyToken, verifyAdmin, verifyRoles } = require('../middleware/auth');
const User = require('../models/User');
const Institution = require('../models/Institution');

// Permission guard: allows any role where the specific permission boolean is true
function verifyPermission(permissionKey) {
  return [verifyToken, async (req, res, next) => {
    try {
      // Super admin and institution admin always pass
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

// GET /api/events
router.get('/', async (req, res) => {
  try {
    const evts = await Event.find().sort({ date: 1 });
    res.json(evts.map(e => ({
      id: e.evtId,
      institutionId: e.institutionId || null,
      title: e.title,
      category: e.category,
      auditoriumId: e.auditoriumId,
      college: e.college,
      date: e.date,
      time: e.time,
      duration: e.duration,
      clusters: e.clusters,
      price: e.price,
      color: e.color,
      description: e.description,
      createdBy: e.createdBy,
      createdAt: e.createdAt
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events  — requires 'createEvents' permission
router.post('/', verifyPermission('createEvents'), async (req, res) => {
  try {
    const { title, category, auditoriumId, date, time, duration, price, color, description, createdBy } = req.body;
    if (!title || !auditoriumId || !date || !time) return res.status(400).json({ error: 'Missing required fields' });

    // Reject events scheduled in the past
    const eventDate = new Date(date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isNaN(eventDate.getTime())) return res.status(400).json({ error: 'Invalid date format' });
    if (eventDate < today) return res.status(400).json({ error: 'Event date cannot be in the past' });

    const aud = await Auditorium.findOne({ audId: auditoriumId });
    if (!aud) return res.status(404).json({ error: 'Selected auditorium not found' });

    // --- Venue conflict check ---
    // Prevent double-booking the same auditorium on the same date and overlapping time.
    const newDuration = Number(duration) || 2;
    const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const newStart = toMins(time);
    const newEnd   = newStart + newDuration * 60;

    const sameDay = await Event.find({ auditoriumId, date });
    const conflict = sameDay.find(ev => {
      const evStart = toMins(ev.time);
      const evEnd   = evStart + (ev.duration || 2) * 60;
      // Overlap: new event starts before existing ends AND ends after existing starts
      return newStart < evEnd && newEnd > evStart;
    });

    if (conflict) {
      const conflictEnd = `${String(Math.floor(toMins(conflict.time) / 60 + (conflict.duration || 2))).padStart(2,'0')}:${String((toMins(conflict.time) % 60)).padStart(2,'0')}`;
      return res.status(409).json({
        error: `Venue conflict: "${conflict.title}" is already scheduled in this auditorium from ${conflict.time}–${conflictEnd} on this date. Choose a different auditorium, date, or time.`
      });
    }

    // FUTURE-02: Enforce plan-based monthly event limit
    const instId = aud.institutionId || null;
    if (instId) {
      const inst = await Institution.findById(instId).select('plan settings').lean();
      if (inst) {
        const maxEvents = inst.settings?.maxEventsPerMonth ?? 10;
        // Count events this institution created in the current calendar month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const eventsThisMonth = await Event.countDocuments({
          institutionId: instId,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });
        if (eventsThisMonth >= maxEvents) {
          return res.status(403).json({
            error: `Plan limit reached: your ${inst.plan} plan allows ${maxEvents} events per month. You've created ${eventsThisMonth} this month. Upgrade your plan or wait until next month.`,
            limit: maxEvents,
            current: eventsThisMonth,
            plan: inst.plan
          });
        }
      }
    }

    const evtId = 'evt_' + Date.now();
    
    // Sanitize inputs
    const cleanTitle = xss(title);
    const cleanDesc = xss(description);

    const newEvent = await Event.create({
      evtId, institutionId: aud.institutionId || null,
      title: cleanTitle, category, auditoriumId,
      college: aud.college, date, time,
      duration: duration || 2,
      price: price || 0,
      color: color || '#6c63ff',
      description: cleanDesc || '',
      createdBy: createdBy || ''
    });

    // Create seat map for this event
    await SeatMap.create({
      eventId: evtId,
      institutionId: aud.institutionId || null,
      capacity: aud.capacity,
      seats: Array(aud.capacity).fill(false)
    });

    // Broadcast to all connected clients so explore page updates instantly
    const io = req.app.get('io');
    if (io) {
      io.emit('event_created', {
        id: evtId,
        institutionId: aud.institutionId || null,
        title: cleanTitle,
        category,
        auditoriumId,
        college: aud.college,
        date, time,
        duration: duration || 2,
        price: price || 0,
        color: color || '#6c63ff',
        description: cleanDesc || '',
        createdBy: createdBy || '',
        createdAt: newEvent.createdAt
      });
    }

    res.status(201).json({ message: 'Event published!', id: evtId });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// DELETE /api/events/:id  — requires 'deleteEvents' permission
router.delete('/:id', verifyPermission('deleteEvents'), async (req, res) => {
  try {
    const evtId = req.params.id;
    await Event.deleteOne({ evtId });
    await Booking.deleteMany({ eventId: evtId });
    await SeatMap.deleteOne({ eventId: evtId });

    // Broadcast deletion to all connected clients
    const io = req.app.get('io');
    if (io) io.emit('event_deleted', { id: evtId });

    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
