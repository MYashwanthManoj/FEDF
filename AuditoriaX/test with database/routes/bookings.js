const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Booking = require('../models/Booking');
const SeatMap = require('../models/SeatMap');
const Event = require('../models/Event');
const Auditorium = require('../models/Auditorium');
const User = require('../models/User');
const SeatLock = require('../models/SeatLock');
const { verifyToken, verifyAdmin, verifyRoles } = require('../middleware/auth');
const { sendBookingConfirmation } = require('../utils/mailer');
const { Parser } = require('json2csv');
const logger = require('../utils/logger');
// FUTURE-04: Waitlist — notify next person when a seat is freed
const { notifyNextInLine } = require('./waitlist');

// GET /api/bookings/seats/:eventId  — get seat map for an event
router.get('/seats/:eventId', async (req, res) => {
  try {
    const sm = await SeatMap.findOne({ eventId: req.params.eventId });
    if (!sm) return res.json({ seats: [] });
    res.json({ seats: sm.seats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/allseats — get all seat maps (bulk, for event grid availability)
// Requires auth — prevents anonymous callers from seeing all seat occupancy data.
// Scoped to the user's institution (or global for super admins with no institutionId).
router.get('/allseats', verifyToken, async (req, res) => {
  try {
    // Scope to the calling user's institution if they have one
    let query = {};
    if (req.user.institutionId) {
      // Find only eventIds belonging to this institution
      const institutionEvents = await Event.find({ institutionId: req.user.institutionId }, '_id').lean();
      const eventIds = institutionEvents.map(e => String(e._id));
      query = { eventId: { $in: eventIds } };
    }
    const maps = await SeatMap.find(query);
    const result = {};
    maps.forEach(m => { result[m.eventId] = m.seats; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/my/:email — get bookings for a specific user
router.get('/my/:email', verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userEmail: req.params.email.toLowerCase() }).sort({ date: 1 });
    res.json(bookings.map(b => ({
      id: b.ticketId,
      eventId: b.eventId,
      eventTitle: b.eventTitle,
      auditoriumId: b.auditoriumId,
      auditoriumName: b.auditoriumName,
      eventCollege: b.eventCollege,
      date: b.date,
      time: b.time,
      seat: b.seat,
      price: b.price,
      txId: b.txId,
      category: b.category,
      color: b.color,
      bookedAt: b.bookedAt
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/all — get all bookings (Admin, Institution Admin & Pseudo Admin)
router.get('/all', verifyRoles(['admin', 'institution_admin', 'pseudo_admin']), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ bookedAt: -1 });
    res.json(bookings.map(b => ({
      id: b.ticketId,
      userEmail: b.userEmail,
      userRole: b.userRole,
      eventId: b.eventId,
      eventTitle: b.eventTitle,
      auditoriumId: b.auditoriumId,
      auditoriumName: b.auditoriumName,
      eventCollege: b.eventCollege,
      date: b.date,
      time: b.time,
      seat: b.seat,
      price: b.price,
      txId: b.txId,
      category: b.category,
      color: b.color,
      bookedAt: b.bookedAt
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/export-csv (Admin, Institution Admin & Pseudo Admin)
router.get('/export-csv', verifyRoles(['admin', 'institution_admin', 'pseudo_admin']), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ eventTitle: 1 });
    if (!bookings.length) return res.status(404).json({ error: 'No bookings to export' });

    const fields = [
      { label: 'Ticket ID', value: 'ticketId' },
      { label: 'Email', value: 'userEmail' },
      { label: 'Role', value: 'userRole' },
      { label: 'Event', value: 'eventTitle' },
      { label: 'Venue', value: 'auditoriumName' },
      { label: 'Seat', value: 'seat' },
      { label: 'Amount', value: 'price' },
      { label: 'Transaction ID', value: 'txId' },
      { label: 'Booked At', value: 'bookedAt' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(bookings);

    res.header('Content-Type', 'text/csv');
    res.attachment(`auditoriax_attendees_${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    logger.error('Export CSV error', { error: err.message });
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
});

// POST /api/bookings/lock — temporarily lock a seat before payment
router.post('/lock', verifyToken, async (req, res) => {
  try {
    const { eventId, seat } = req.body;
    const userEmail = req.user.email.toLowerCase();

    if (!eventId || seat == null) return res.status(400).json({ error: 'Missing eventId or seat' });

    // Check if seat is already permanently booked
    const sm = await SeatMap.findOne({ eventId });
    if (sm && sm.seats[seat - 1] === true) {
      return res.status(409).json({ error: 'This seat has already been booked. Please select another seat.' });
    }

    // Release any previous lock this same user held for this event
    await SeatLock.deleteOne({ eventId, userEmail });

    // Try to create the lock — unique index prevents two users from locking same seat
    try {
      await SeatLock.create({ eventId, seat, userEmail });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        // Another user already has this seat locked
        const existing = await SeatLock.findOne({ eventId, seat });
        if (existing && existing.userEmail !== userEmail) {
          return res.status(409).json({ error: 'This seat is currently being reserved by someone else. Please select another seat.' });
        }
      }
      throw dupErr;
    }

    res.json({ locked: true, seat, eventId, expiresIn: 300 });
  } catch (err) {
    logger.error('Seat lock error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bookings/lock — release a seat lock (on payment cancel/fail)
router.delete('/lock', verifyToken, async (req, res) => {
  try {
    const { eventId } = req.body;
    const userEmail = req.user.email.toLowerCase();
    await SeatLock.deleteOne({ eventId, userEmail });
    res.json({ unlocked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookings — create a booking
router.post('/', verifyToken, async (req, res) => {
  try {
    const { eventId, auditoriumId, auditoriumName, eventCollege, date, time, seat, txId } = req.body;
    
    // SECURITY: Use authenticated user details, ignore client spoofing
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.user.role;

    if (!eventId || seat == null) return res.status(400).json({ error: 'Missing required fields' });

    // SECURITY: Fetch event details from DB instead of trusting client
    const event = await Event.findOne({ evtId: eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    // SECURITY: Fetch user details to determine exact price
    const userObj = await User.findOne({ email: userEmail });
    const isSameCollege = userObj && event.college.toLowerCase() === (userObj.college || '').toLowerCase();
    
    // Only students from external colleges pay for paid events
    const actualPrice = (userRole === 'student' && !isSameCollege) ? event.price : 0;

    if (actualPrice > 0 && !txId) {
      return res.status(400).json({ error: 'Payment transaction ID is required for paid events.' });
    }

    const eventTitle = event.title;
    const price = actualPrice;
    const category = event.category;
    const color = event.color;

    // Check if student already booked this event
    if (userRole === 'student') {
      const existing = await Booking.findOne({ userEmail: userEmail.toLowerCase(), eventId });
      if (existing) return res.status(409).json({ error: 'You already have a seat booked for this event.' });
    }

    // Check teacher booking limit (max 5 total)
    if (userRole === 'teacher') {
      const teacherCount = await Booking.countDocuments({ userEmail: userEmail.toLowerCase(), userRole: 'teacher' });
      if (teacherCount >= 5) return res.status(409).json({ error: 'Teachers can book maximum 5 seats total' });
    }

    // Check seat availability in seat map (atomic findOneAndUpdate to prevent race conditions)
    const seatIndex = seat - 1;
    const seatField = `seats.${seatIndex}`;
    const sm = await SeatMap.findOneAndUpdate(
      { eventId, [seatField]: false },
      { $set: { [seatField]: true } },
      { new: true }
    );
    if (!sm) return res.status(409).json({ error: 'That seat was just taken! Please choose another.' });

    const ticketId = 'AX' + Date.now().toString(36).toUpperCase().slice(-8);
    const booking = await Booking.create({
      ticketId,
      institutionId: event.institutionId || null,
      userEmail: userEmail.toLowerCase(),
      userRole,
      eventId,
      eventTitle,
      auditoriumId,
      auditoriumName,
      eventCollege: eventCollege || '',
      date, time, seat,
      price: price || 0,
      txId: txId || null,
      category: category || '',
      color: color || ''
    });

    const responseData = {
      id: booking.ticketId,
      eventId: booking.eventId,
      eventTitle: booking.eventTitle,
      auditoriumId: booking.auditoriumId,
      auditoriumName: booking.auditoriumName,
      eventCollege: booking.eventCollege,
      date: booking.date,
      time: booking.time,
      seat: booking.seat,
      price: booking.price,
      txId: booking.txId,
      category: booking.category,
      color: booking.color,
      bookedAt: booking.bookedAt
    };

    // Emit real-time socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('seat_booked', { eventId, seatIndex });
    }

    // Send confirmation email (non-blocking — booking succeeds regardless)
    sendBookingConfirmation({
      to: userEmail,
      booking: {
        ticketId: booking.ticketId,
        eventTitle: booking.eventTitle,
        auditoriumName: booking.auditoriumName,
        date: booking.date,
        time: booking.time,
        seat: booking.seat,
        price: booking.price
      }
    });

    res.status(201).json(responseData);
  } catch (err) {
    logger.error('Create booking error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== IMPORTANT: Specific DELETE routes BEFORE the /:ticketId wildcard =====

// DELETE /api/bookings/clear/all — clear all bookings (SUPER ADMIN ONLY)
router.delete('/clear/all', verifyAdmin, async (req, res) => {
  try {
    await Booking.deleteMany({});
    
    // Reset all seat maps
    const maps = await SeatMap.find();
    for (const sm of maps) {
      sm.seats = Array(sm.capacity).fill(false);
      await sm.save();
    }

    res.json({ message: 'All bookings cleared' });
  } catch (err) {
    logger.error('Clear bookings error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bookings/reset/system — reset entire system (SUPER ADMIN ONLY)
router.delete('/reset/system', verifyAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      await mongoose.connection.db.dropCollection(col.name);
    }
    res.json({ message: 'System reset complete' });
  } catch (err) {
    logger.error('System reset error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bookings/:ticketId — cancel a booking (Admin, Institution Admin & Pseudo Admin)
router.delete('/:ticketId', verifyRoles(['admin', 'institution_admin', 'pseudo_admin']), async (req, res) => {
  try {
    const booking = await Booking.findOne({ ticketId: req.params.ticketId });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // --- RAZORPAY REFUND (legal requirement) ---
    // If the student paid for this booking, issue a full refund before cancelling.
    if (booking.txId && booking.price > 0) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        await razorpay.payments.refund(booking.txId, {
          amount: Math.round(booking.price * 100), // paise
          notes: {
            reason: 'Booking cancelled by admin',
            ticketId: booking.ticketId,
            cancelledBy: req.user.email
          }
        });
        logger.info('Refund issued by admin', { ticketId: booking.ticketId, amount: booking.price, paymentId: booking.txId });
      } catch (refundErr) {
        // Log the error but do not block the cancellation — admin must manually refund if Razorpay API fails
        logger.error('Razorpay admin refund failed', { ticketId: booking.ticketId, error: refundErr.message });
        // Return error so the admin knows the refund didn't go through
        return res.status(502).json({
          error: 'Refund failed via Razorpay. Please issue the refund manually from the Razorpay dashboard, then try cancelling again.',
          razorpayError: refundErr.message
        });
      }
    }

    // Free the seat in the seat map
    const seatIndex = booking.seat - 1;
    const seatField = `seats.${seatIndex}`;
    await SeatMap.findOneAndUpdate(
      { eventId: booking.eventId },
      { $set: { [seatField]: false } }
    );

    await Booking.deleteOne({ ticketId: req.params.ticketId });

    // Emit real-time socket event so seat map updates for all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('seat_freed', { eventId: booking.eventId, seatIndex });
    }

    // FUTURE-04: Notify next waitlisted student (non-blocking)
    notifyNextInLine(booking.eventId, io, process.env.APP_URL).catch(e => logger.warn('Waitlist notify failed (admin cancel)', { error: e.message }));

    res.json({
      message: 'Booking cancelled' + (booking.txId && booking.price > 0 ? ` and ₹${booking.price} refunded` : ''),
      refunded: !!(booking.txId && booking.price > 0)
    });
  } catch (err) {
    logger.error('Admin cancel booking error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bookings/scan — scan a ticket QR code (Admin, Institution Admin, Pseudo Admin, Scanner)
router.post('/scan', verifyRoles(['admin', 'institution_admin', 'pseudo_admin', 'scanner']), async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'Ticket ID required' });

    const booking = await Booking.findOne({ ticketId });
    if (!booking) return res.status(404).json({ error: 'Invalid ticket — not found' });

    if (booking.attended) {
      return res.status(409).json({ error: 'Ticket has already been scanned for entry!', booking });
    }

    booking.attended = true;
    await booking.save();

    res.json({ message: 'Ticket scanned successfully. Entry granted.', booking });
  } catch (err) {
    logger.error('Scan ticket error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/bookings/mine/:ticketId — student cancels their own booking
// Rules:
//   1. You can only cancel a booking that belongs to your account.
//   2. Cancellation closes CANCEL_CUTOFF_HOURS before event start (default: 2h).
//   3. If the ticket was paid, a full Razorpay refund is issued automatically.
router.delete('/mine/:ticketId', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ ticketId: req.params.ticketId });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // --- Ownership check ---
    if (booking.userEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'You can only cancel your own bookings.' });
    }

    // --- Cut-off time check ---
    const event = await Event.findOne({ evtId: booking.eventId });
    if (event) {
      const cutoffHours = Number(process.env.CANCEL_CUTOFF_HOURS) || 2;
      const [h, m] = (event.time || '00:00').split(':').map(Number);
      const eventStart = new Date(event.date);
      eventStart.setHours(h, m, 0, 0);
      const cutoffTime = new Date(eventStart.getTime() - cutoffHours * 60 * 60 * 1000);

      if (new Date() > cutoffTime) {
        return res.status(400).json({
          error: `Cancellations are closed. You can only cancel up to ${cutoffHours} hour${cutoffHours !== 1 ? 's' : ''} before the event starts.`
        });
      }
    }

    // --- Refund (if paid) ---
    if (booking.txId && booking.price > 0) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        await razorpay.payments.refund(booking.txId, {
          amount: Math.round(booking.price * 100),
          notes: { reason: 'Student self-cancellation', ticketId: booking.ticketId }
        });
        logger.info('Student self-refund issued', { ticketId: booking.ticketId, amount: booking.price });
      } catch (refundErr) {
        logger.error('Student self-refund failed', { ticketId: booking.ticketId, error: refundErr.message });
        return res.status(502).json({
          error: 'Refund could not be processed automatically. Please contact support to cancel.',
          detail: refundErr.message
        });
      }
    }

    // --- Free the seat ---
    const seatIndex = booking.seat - 1;
    await SeatMap.findOneAndUpdate(
      { eventId: booking.eventId },
      { $set: { [`seats.${seatIndex}`]: false } }
    );

    await Booking.deleteOne({ ticketId: req.params.ticketId });

    const io = req.app.get('io');
    if (io) io.emit('seat_freed', { eventId: booking.eventId, seatIndex });

    // FUTURE-04: Notify next waitlisted student
    notifyNextInLine(booking.eventId, io, process.env.APP_URL).catch(e => logger.warn('Waitlist notify failed (student cancel)', { error: e.message }));

    res.json({
      message: 'Booking cancelled' + (booking.txId && booking.price > 0 ? ` and ₹${booking.price} refunded` : ''),
      refunded: !!(booking.txId && booking.price > 0)
    });
  } catch (err) {
    logger.error('Student cancel error', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
