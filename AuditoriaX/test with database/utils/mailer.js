const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter — uses Gmail with App Password
// To enable: go to Google Account → Security → 2FA → App Passwords → generate one
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send a booking confirmation email with ticket details.
 * Fails silently if email is not configured so the booking still succeeds.
 */
async function sendBookingConfirmation({ to, booking }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER === 'your_gmail@gmail.com') {
    logger.debug('Email sending skipped (credentials not configured)');
    return;
  }

  const dateFormatted = new Date(booking.date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background:#06070B; color:#fff; margin:0; padding:0; }
        .container { max-width:520px; margin:32px auto; background:#0E111A; border:1px solid #262D42; border-radius:16px; overflow:hidden; }
        .header { background:#F84464; padding:28px 32px; text-align:center; }
        .header h1 { margin:0; font-size:1.6rem; color:#fff; letter-spacing:-0.02em; }
        .header p { margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:0.9rem; }
        .body { padding:28px 32px; }
        .success { text-align:center; margin-bottom:24px; }
        .success .icon { font-size:3rem; }
        .success h2 { font-size:1.3rem; margin:8px 0 4px; color:#fff; }
        .success p { color:#9AA0B8; font-size:0.88rem; }
        .ticket-box { background:#151926; border:1px solid #262D42; border-radius:12px; overflow:hidden; margin:20px 0; }
        .ticket-row { display:flex; justify-content:space-between; padding:12px 18px; border-bottom:1px solid #1C2132; font-size:0.88rem; }
        .ticket-row:last-child { border-bottom:none; }
        .ticket-row span { color:#626A85; }
        .ticket-row strong { color:#fff; text-align:right; }
        .ticket-id { text-align:center; padding:16px; background:#1C2132; font-family:monospace; font-size:1rem; color:#F84464; letter-spacing:0.1em; font-weight:700; }
        .footer { padding:20px 32px; text-align:center; border-top:1px solid #262D42; }
        .footer p { color:#626A85; font-size:0.78rem; margin:0; }
        .footer a { color:#F84464; text-decoration:none; }
        .cta { display:block; text-align:center; margin:20px 0; }
        .cta a { background:#F84464; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.95rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⬡ AuditoriaX</h1>
          <p>Your ticket is confirmed</p>
        </div>
        <div class="body">
          <div class="success">
            <div class="icon">🎟️</div>
            <h2>Booking Confirmed!</h2>
            <p>Your seat has been reserved. Show this email or the QR code in the app at the venue.</p>
          </div>
          <div class="ticket-box">
            <div class="ticket-row"><span>Event</span><strong>${booking.eventTitle}</strong></div>
            <div class="ticket-row"><span>Venue</span><strong>${booking.auditoriumName}</strong></div>
            <div class="ticket-row"><span>Date</span><strong>${dateFormatted}</strong></div>
            <div class="ticket-row"><span>Time</span><strong>${booking.time}</strong></div>
            <div class="ticket-row"><span>Seat Number</span><strong>#${booking.seat}</strong></div>
            ${booking.price > 0 ? `<div class="ticket-row"><span>Amount Paid</span><strong>₹${booking.price}</strong></div>` : ''}
            <div class="ticket-id">${booking.ticketId}</div>
          </div>
          <div class="cta">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}">Open AuditoriaX →</a>
          </div>
          <p style="color:#626A85;font-size:0.8rem;text-align:center;margin-top:16px;">
            To cancel this booking, open AuditoriaX → My Bookings → Cancel.
          </p>
        </div>
        <div class="footer">
          <p>AuditoriaX — Multi-college Event Ticketing Platform<br/>
          <a href="${process.env.APP_URL || 'http://localhost:3000'}">auditoriax.app</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"AuditoriaX" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🎟️ Booking Confirmed — ${booking.eventTitle} (Seat #${booking.seat})`,
      html
    });
    logger.info('Booking confirmation email sent', { to });
  } catch (err) {
    logger.warn('Email send failed (non-fatal)', { to, error: err.message });
  }
}

// ─── Shared email guard ───────────────────────────────────────────────────────
function emailConfigured() {
  return (
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com' &&
    !process.env.EMAIL_PASS.includes('xxxx')
  );
}

/**
 * Send email verification link on signup.
 * Token expires in 24 hours.
 */
async function sendVerificationEmail({ to, token }) {
  if (!emailConfigured()) {
    logger.debug('Verification email skipped (credentials not configured)', { token });
    return;
  }

  const link = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background:#06070B; color:#fff; margin:0; padding:0; }
        .container { max-width:520px; margin:32px auto; background:#0E111A; border:1px solid #262D42; border-radius:16px; overflow:hidden; }
        .header { background:#F84464; padding:28px 32px; text-align:center; }
        .header h1 { margin:0; font-size:1.6rem; color:#fff; }
        .header p  { margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:0.9rem; }
        .body { padding:28px 32px; text-align:center; }
        .body p { color:#9AA0B8; font-size:0.92rem; line-height:1.6; }
        .cta { display:inline-block; margin:24px 0; background:#F84464; color:#fff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.95rem; }
        .expiry { color:#626A85; font-size:0.8rem; margin-top:8px; }
        .footer { padding:20px 32px; text-align:center; border-top:1px solid #262D42; }
        .footer p { color:#626A85; font-size:0.78rem; margin:0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>⬡ AuditoriaX</h1><p>Verify your email address</p></div>
        <div class="body">
          <p>Thanks for signing up! Click the button below to verify your email address and activate your account.</p>
          <a class="cta" href="${link}">Verify My Email →</a>
          <p class="expiry">This link expires in 24 hours.</p>
          <p style="font-size:0.78rem;color:#626A85;margin-top:16px;">
            If you didn't create an AuditoriaX account, you can safely ignore this email.
          </p>
        </div>
        <div class="footer"><p>AuditoriaX — Multi-college Event Ticketing Platform</p></div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"AuditoriaX" <${process.env.EMAIL_USER}>`,
      to,
      subject: '✅ Verify your AuditoriaX email',
      html
    });
    logger.info('Verification email sent', { to });
  } catch (err) {
    logger.warn('Verification email failed (non-fatal)', { to, error: err.message });
  }
}

/**
 * Send password reset link.
 * Token expires in 1 hour.
 */
async function sendPasswordResetEmail({ to, token }) {
  if (!emailConfigured()) {
    logger.debug('Password reset email skipped (credentials not configured)', { token });
    return;
  }

  const link = `${process.env.APP_URL || 'http://localhost:3000'}/?resetToken=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background:#06070B; color:#fff; margin:0; padding:0; }
        .container { max-width:520px; margin:32px auto; background:#0E111A; border:1px solid #262D42; border-radius:16px; overflow:hidden; }
        .header { background:#F84464; padding:28px 32px; text-align:center; }
        .header h1 { margin:0; font-size:1.6rem; color:#fff; }
        .header p  { margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:0.9rem; }
        .body { padding:28px 32px; text-align:center; }
        .body p { color:#9AA0B8; font-size:0.92rem; line-height:1.6; }
        .cta { display:inline-block; margin:24px 0; background:#F84464; color:#fff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.95rem; }
        .expiry { color:#626A85; font-size:0.8rem; margin-top:8px; }
        .footer { padding:20px 32px; text-align:center; border-top:1px solid #262D42; }
        .footer p { color:#626A85; font-size:0.78rem; margin:0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>⬡ AuditoriaX</h1><p>Password reset request</p></div>
        <div class="body">
          <p>We received a request to reset your AuditoriaX password. Click the button below to set a new password.</p>
          <a class="cta" href="${link}">Reset My Password →</a>
          <p class="expiry">⚠️ This link expires in 1 hour.</p>
          <p style="font-size:0.78rem;color:#626A85;margin-top:16px;">
            If you didn't request a password reset, you can safely ignore this email. Your password will not change.
          </p>
        </div>
        <div class="footer"><p>AuditoriaX — Multi-college Event Ticketing Platform</p></div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"AuditoriaX" <${process.env.EMAIL_USER}>`,
      to,
      subject: '🔐 Reset your AuditoriaX password',
      html
    });
    logger.info('Password reset email sent', { to });
  } catch (err) {
    logger.warn('Password reset email failed (non-fatal)', { to, error: err.message });
  }
}

// ─── FUTURE-04: Waitlist Seat-Available Notification ─────────────────────────

/**
 * Notify a waitlisted student that a seat just opened up.
 * @param {{ to: string, name: string, eventTitle: string, eventDate: string, bookingUrl: string, expiresInMin: number }} opts
 */
async function sendWaitlistNotification({ to, name, eventTitle, eventDate, bookingUrl, expiresInMin = 30 }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER === 'your_gmail@gmail.com') {
    logger.debug('Waitlist email skipped (credentials not configured)');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #06070B; color: #E0E0E0; margin: 0; padding: 0; }
        .wrap { max-width: 560px; margin: 32px auto; background: #0E111A; border-radius: 12px; overflow: hidden; border: 1px solid #262D42; }
        .header { background: linear-gradient(135deg, #F84464, #E84C88); padding: 28px 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 1.4rem; color: #fff; }
        .body { padding: 28px 32px; }
        .body p { color: #9AA0B8; line-height: 1.7; margin: 0 0 16px; }
        .event-box { background: #151926; border: 1px solid #262D42; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .event-box strong { color: #fff; font-size: 1.05rem; display: block; margin-bottom: 6px; }
        .event-box span { color: #9AA0B8; font-size: 0.88rem; }
        .cta { display: block; background: #F84464; color: #fff !important; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 1rem; margin: 24px 0; border-radius: 8px; }
        .timer { background: rgba(248,68,100,0.1); border: 1px solid rgba(248,68,100,0.3); border-radius: 8px; padding: 10px 16px; font-size: 0.85rem; color: #F84464; text-align: center; margin-bottom: 20px; }
        .footer { padding: 16px 32px; border-top: 1px solid #262D42; font-size: 0.75rem; color: #626A85; text-align: center; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <h1>🎟 A Seat Just Opened Up!</h1>
        </div>
        <div class="body">
          <p>Hey <strong style="color:#fff">${name || 'there'}</strong>,</p>
          <p>Great news — someone cancelled their booking and you're <strong style="color:#fff">next in the waitlist</strong> for:</p>
          <div class="event-box">
            <strong>${eventTitle}</strong>
            <span>📅 ${eventDate}</span>
          </div>
          <div class="timer">⏱ This offer expires in <strong>${expiresInMin} minutes</strong> — act fast!</div>
          <a href="${bookingUrl}" class="cta">Claim My Seat →</a>
          <p style="font-size:0.8rem;color:#626A85">If you no longer want this seat, simply ignore this email. The spot will move to the next person in line.</p>
        </div>
        <div class="footer"><p>AuditoriaX — Multi-college Event Ticketing Platform</p></div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"AuditoriaX" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🎟 Seat available: ${eventTitle} — claim it in ${expiresInMin} min!`,
      html
    });
    logger.info('Waitlist notification email sent', { to });
  } catch (err) {
    logger.warn('Waitlist email failed (non-fatal)', { to, error: err.message });
  }
}

module.exports = { sendBookingConfirmation, sendVerificationEmail, sendPasswordResetEmail, sendWaitlistNotification };
