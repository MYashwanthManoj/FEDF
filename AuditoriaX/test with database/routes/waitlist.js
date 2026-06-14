/**
 * routes/waitlist.js — FUTURE-04: Waitlist System
 *
 * Endpoints:
 *   POST   /api/waitlist/:eventId/join      — join the queue for a full event
 *   DELETE /api/waitlist/:eventId/leave     — leave the queue voluntarily
 *   GET    /api/waitlist/:eventId           — admin: view the full queue
 *   GET    /api/waitlist/my                 — student: their own waitlist entries
 *   GET    /api/waitlist/claim/:token       — claim a seat using an emailed token
 *
 * Internal helper (not a route):
 *   notifyNextInLine(eventId, io, appUrl)   — called from bookings.js on seat-free
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const Waitlist = require('../models/Waitlist');
const Event    = require('../models/Event');
const SeatMap  = require('../models/SeatMap');
const { verifyToken, verifyAdmin, verifyRoles } = require('../middleware/auth');
const { sendWaitlistNotification } = require('../utils/mailer');
const logger   = require('../utils/logger');

const NOTIFY_WINDOW_MIN = Number(process.env.WAITLIST_NOTIFY_WINDOW_MIN) || 30;

// ─── Helper: notify the first waiting person when a seat is freed ────────────
async function notifyNextInLine(eventId, io, appUrl) {
  try {
    const entry = await Waitlist.findOne({ eventId, status: 'waiting' }).sort({ position: 1 });
    if (!entry) return;

    const event = await Event.findById(eventId).lean();
    if (!event) return;

    // Generate a one-time token valid for NOTIFY_WINDOW_MIN minutes
    const token   = crypto.randomBytes(32).toString('hex');
    const expiry  = new Date(Date.now() + NOTIFY_WINDOW_MIN * 60 * 1000);

    entry.notifyToken  = token;
    entry.notifyExpiry = expiry;
    entry.notified     = true;
    entry.notifiedAt   = new Date();
    entry.status       = 'notified';
    await entry.save();

    const dateFormatted = new Date(event.date).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const bookingUrl = `${appUrl || process.env.APP_URL || 'http://localhost:3000'}/?waitlist_token=${token}`;

    // Emit a real-time event so the student UI can show a modal if they're online
    if (io) {
      io.emit('waitlist_seat_available', { eventId, userEmail: entry.userEmail, token, expiresAt: expiry });
    }

    // Also send an email (non-blocking)
    sendWaitlistNotification({
      to:          entry.userEmail,
      name:        entry.userName,
      eventTitle:  event.title,
      eventDate:   dateFormatted,
      bookingUrl,
      expiresInMin: NOTIFY_WINDOW_MIN
    }).catch(e => logger.warn('Waitlist email send failed', { error: e.message }));

    logger.info('Waitlist: notified next in line', { email: entry.userEmail, eventId, windowMin: NOTIFY_WINDOW_MIN });
  } catch (err) {
    logger.error('Waitlist notifyNextInLine error', { error: err.message });
  }
}

// ─── POST /api/waitlist/:eventId/join ────────────────────────────────────────
router.post('/:eventId/join', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userEmail   = req.user.email;

    // Check event exists
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check seat map — only allow join if event is actually full
    const sm = await SeatMap.findOne({ eventId }).lean();
    if (sm) {
      const freeSeats = (sm.seats || []).filter(s => !s).length;
      if (freeSeats > 0) {
        return res.status(400).json({ error: 'Event still has available seats. You can book directly.' });
      }
    }

    // Prevent duplicate
    const existing = await Waitlist.findOne({ eventId, userEmail });
    if (existing) {
      return res.status(409).json({
        error: 'You are already on this waitlist',
        position: existing.position,
        status: existing.status
      });
    }

    // Determine next position
    const lastEntry = await Waitlist.findOne({ eventId, status: { $in: ['waiting', 'notified'] } })
      .sort({ position: -1 });
    const position = lastEntry ? lastEntry.position + 1 : 1;

    const entry = await Waitlist.create({
      eventId,
      userEmail,
      userName:      req.user.name || req.user.email.split('@')[0],
      institutionId: req.user.institutionId || null,
      position
    });

    res.status(201).json({
      message: `You're #${position} in the waitlist for "${event.title}"`,
      position,
      eventId
    });
  } catch (err) {
    logger.error('Waitlist join error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/waitlist/:eventId/leave ─────────────────────────────────────
router.delete('/:eventId/leave', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await Waitlist.findOneAndUpdate(
      { eventId, userEmail: req.user.email, status: { $in: ['waiting', 'notified'] } },
      { $set: { status: 'cancelled' } }
    );
    if (!result) return res.status(404).json({ error: 'Not found on this waitlist' });
    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/waitlist/my ─────────────────────────────────────────────────────
router.get('/my', verifyToken, async (req, res) => {
  try {
    const entries = await Waitlist.find({
      userEmail: req.user.email,
      status: { $in: ['waiting', 'notified'] }
    }).sort({ createdAt: -1 });

    // Enrich with event titles
    const eventIds = [...new Set(entries.map(e => e.eventId))];
    const events   = await Event.find({ _id: { $in: eventIds } }, 'title date').lean();
    const evtMap   = Object.fromEntries(events.map(e => [String(e._id), e]));

    const result = entries.map(e => ({
      id:        e._id,
      eventId:   e.eventId,
      eventTitle: evtMap[e.eventId]?.title || 'Unknown Event',
      eventDate:  evtMap[e.eventId]?.date,
      position:  e.position,
      status:    e.status,
      notified:  e.notified,
      notifiedAt: e.notifiedAt,
      joinedAt:  e.createdAt
    }));

    res.json({ waitlist: result });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/waitlist/:eventId — admin view full queue ──────────────────────
router.get('/:eventId', verifyToken, verifyRoles('admin', 'institution_admin', 'pseudo_admin'), async (req, res) => {
  try {
    const entries = await Waitlist.find({ eventId: req.params.eventId })
      .sort({ position: 1 });
    res.json({
      total:   entries.length,
      waiting: entries.filter(e => e.status === 'waiting').length,
      entries: entries.map(e => ({
        position:  e.position,
        userEmail: e.userEmail,
        userName:  e.userName,
        status:    e.status,
        notified:  e.notified,
        notifiedAt: e.notifiedAt,
        joinedAt:  e.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/waitlist/claim/:token — validate a claim token ─────────────────
router.get('/claim/:token', async (req, res) => {
  try {
    const entry = await Waitlist.findOne({
      notifyToken: req.params.token,
      status: 'notified'
    });

    if (!entry) return res.status(404).json({ error: 'Invalid or already used token' });
    if (new Date() > entry.notifyExpiry) {
      entry.status = 'expired';
      await entry.save();
      // Notify next in line
      const io = req.app.get('io');
      await notifyNextInLine(entry.eventId, io, process.env.APP_URL);
      return res.status(410).json({ error: 'Token expired. The seat has been offered to the next person.' });
    }

    const event = await Event.findById(entry.eventId, 'title date auditoriumId price category').lean();
    res.json({
      valid:     true,
      eventId:   entry.eventId,
      event,
      userEmail: entry.userEmail,
      expiresAt: entry.notifyExpiry
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, notifyNextInLine };
