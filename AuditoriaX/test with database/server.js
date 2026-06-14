require('dotenv').config();

// ─── Environment Variable Validation ─────────────────────────────────────────
// Check for all required variables before anything else starts.
// A missing JWT_SECRET means tokens can't be signed. A missing Razorpay key
// means payments silently fail. Catch these at startup, not at runtime.
const REQUIRED_ENV = [
  { key: 'JWT_SECRET',           fatal: true,  hint: 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"' },
  { key: 'REFRESH_TOKEN_SECRET', fatal: true,  hint: 'Must be different from JWT_SECRET' },
  { key: 'MONGO_URI',            fatal: false, hint: 'Defaults to mongodb://127.0.0.1:27017/auditoriax' },
  { key: 'RAZORPAY_KEY_ID',      fatal: false, hint: 'Required for paid events. Get from https://dashboard.razorpay.com' },
  { key: 'RAZORPAY_KEY_SECRET',  fatal: false, hint: 'Required for paid events and refunds' },
];

const isProduction = process.env.NODE_ENV === 'production';
let envErrors = 0;

// Logger is not yet available at this point (env validation runs first),
// so we keep console.error here intentionally.
for (const { key, fatal, hint } of REQUIRED_ENV) {
  const val = process.env[key];
  const isMissing = !val || val.trim() === '';
  const isPlaceholder = val && (
    val.includes('replace_with') ||
    val.includes('your_') ||
    val.includes('XXXXXXXX')
  );

  if (isMissing || isPlaceholder) {
    const level = (fatal || isProduction) ? '❌ FATAL' : '⚠️  WARN ';
    console.error(`${level}  Missing env var: ${key}`);
    if (hint) console.error(`         Hint: ${hint}`);
    if (fatal || isProduction) envErrors++;
  }
}

if (envErrors > 0) {
  console.error('\n💥 Server startup aborted: fix the missing environment variables above.');
  console.error('   Copy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

// ─── Logger (FUTURE-07) ───────────────────────────────────────────────────────
const logger = require('./utils/logger');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes        = require('./routes/auth');
const auditoriumRoutes  = require('./routes/auditoriums');
const eventRoutes       = require('./routes/events');
const bookingRoutes     = require('./routes/bookings');
const paymentRoutes     = require('./routes/payments');
const institutionRoutes = require('./routes/institutions');
const { router: waitlistRoutes } = require('./routes/waitlist'); // FUTURE-04

const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const app    = express();
const server = http.createServer(app);

// --- Production Security & Performance ---
app.use(compression()); // Compress all responses
app.use(helmet({ contentSecurityPolicy: false })); // Basic security headers

// --- HTTP Request Logging (FUTURE-07) ---
// Skip logging for static assets to reduce noise
const morganFormat = isProduction ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: logger.stream,
  skip: (req) => req.url.startsWith('/socket.io') || /\.(js|css|png|ico|json|woff|woff2|ttf)$/.test(req.url),
}));

// --- CORS: only allow explicitly listed origins ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Socket.io — uses the same CORS allowlist as Express
// Must be initialized after allowedOrigins is computed.
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin SPA requests
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Socket.io CORS: origin '${origin}' is not allowed`));
    },
    credentials: true
  }
});
app.set('io', io);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true
}));

// --- Rate limiting ---
// Tight limit on auth routes: prevents brute-force password attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,                   // raised: handles full class logging in at once
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API limit: protects against scrapers and abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,                 // raised: handles 1,000 users on shared campus Wi-Fi
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/',            apiLimiter);
app.use(express.json());
app.use(cookieParser());

// ── Health check — used by Render.com and uptime monitors ────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// --- Routes ---
app.use('/api/auth',         authRoutes);
app.use('/api/auditoriums',  auditoriumRoutes);
app.use('/api/events',       eventRoutes);
app.use('/api/bookings',     bookingRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/waitlist',     waitlistRoutes); // FUTURE-04

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── FUTURE-10: Routing ────────────────────────────────────────────────────────
// GET /           → public landing page
// GET /app        → SPA (login/app shell)
// GET /app/*      → SPA fallback (client-side routing)
// GET /api/*      → API (handled above)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get(['/app', '/app/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API 404 handler — must be BEFORE the SPA fallback.
// Without this, typos like /api/evnts would silently return the HTML page,
// causing confusing "Unexpected token <" errors when debugging fetch calls.
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// Fallback: any other non-API route → SPA (handles direct URL access)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  logger.error('Unhandled request error', { error: err.message, stack: err.stack, method: req.method, url: req.url });
  res.status(err.status || 500).json({
    error: isProduction
      ? 'An internal server error occurred'
      : err.message
  });
});

const PORT      = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auditoriax';

// Connect to MongoDB and start server
async function startServer() {
  let uri = MONGO_URI;

  try {
    // Try connecting to configured MongoDB
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    logger.info('Connected to MongoDB', { uri: uri.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (err) {
    if (isProduction) {
      // In production: a DB failure is fatal — never use in-memory as a fallback
      logger.error('Cannot connect to MongoDB in production. Shutting down.', { error: err.message });
      logger.error('Check your MONGO_URI in the .env file or hosting dashboard.');
      process.exit(1);
    }
    // Development only: fall back to in-memory MongoDB for convenience
    logger.warn('Local MongoDB not available. Starting in-memory MongoDB (DEV ONLY — data will not persist).');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      await mongoose.connect(uri);
      logger.info('Connected to in-memory MongoDB [DEVELOPMENT ONLY]');
    } catch (memErr) {
      logger.error('Failed to start in-memory MongoDB', { error: memErr.message });
      process.exit(1);
    }
  }

  // After successful connection, seed test accounts
  try {
    const User    = require('./models/User');
    const bcrypt  = require('bcryptjs');
    const hashedPw = await bcrypt.hash('password123', 10);

    const defaultPerms = {
      admin:             { createEvents: true,  deleteEvents: true,  viewBookings: true,  cancelBookings: true,  addAuditoriums: true,  deleteAuditoriums: true,  scanTickets: true,  viewAnalytics: true,  manageUsers: true  },
      institution_admin: { createEvents: true,  deleteEvents: true,  viewBookings: true,  cancelBookings: true,  addAuditoriums: true,  deleteAuditoriums: true,  scanTickets: true,  viewAnalytics: true,  manageUsers: true  },
      pseudo_admin:      { createEvents: true,  deleteEvents: false, viewBookings: true,  cancelBookings: false, addAuditoriums: true,  deleteAuditoriums: false, scanTickets: true,  viewAnalytics: false, manageUsers: true  },
      scanner:           { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: true,  viewAnalytics: false, manageUsers: false },
      teacher:           { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: false, viewAnalytics: false, manageUsers: false },
      student:           { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: false, viewAnalytics: false, manageUsers: false },
    };

    // ─── Default Institution Seed ─────────────────────────────────────────
    // Create a default institution so existing data and test accounts have
    // a valid institutional context. This is the migration path for pre-
    // multi-tenant data.
    const Institution = require('./models/Institution');
    let defaultInst = await Institution.findOne({ slug: 'default' });
    if (!defaultInst) {
      // We need a user to be the owner — create admin first if needed
      const adminEmail = (process.env.MASTER_ADMINS || 'admin@system.com').split(',')[0].trim().toLowerCase();
      let adminUser = await User.findOne({ email: adminEmail });
      if (!adminUser) {
        adminUser = await User.create({
          email:       adminEmail,
          password:    hashedPw,
          role:        'admin',
          college:     'System',
          permissions: defaultPerms.admin
        });
        logger.info('Seeded admin account', { email: adminEmail });
      }
      defaultInst = await Institution.create({
        slug:    'default',
        name:    'Default Institution',
        domain:  null,
        city:    'System',
        ownerId: adminUser._id,
        status:  'active'
      });
      logger.info('Seeded default institution');
    }

    const testAccounts = [
      { email: 'admin@auditoria.x',   role: 'admin',        college: 'System'       },
      { email: 'pseudo@auditoria.x',  role: 'pseudo_admin', college: 'Staff'        },
      { email: 'scan@auditoria.x',    role: 'scanner',      college: 'Gate Control' },
      { email: 'teacher@auditoria.x', role: 'teacher',      college: 'KL University'},
      { email: 'student@auditoria.x', role: 'student',      college: 'KL University'},
    ];

    // DEV ONLY: seed demo accounts with a known password.
    // In production these accounts are NOT created, preventing a known-password
    // backdoor from being deployed to a live server.
    if (!isProduction) {
      for (const acc of testAccounts) {
        const exists = await User.findOne({ email: acc.email });
        if (!exists) {
          await User.create({
            ...acc,
            password:      hashedPw,
            permissions:   defaultPerms[acc.role] || defaultPerms.student,
            institutionId: defaultInst._id
          });
          logger.info('Seeded test account', { role: acc.role, email: acc.email });
        }
      }
    } else {
      logger.info('Production mode: skipping demo account seeding.');
    }
  } catch (seedErr) {
    logger.warn('Seeding failed — non-fatal', { error: seedErr.message });
  }

  server.listen(PORT, () => {
    logger.info(`AuditoriaX server started`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    logger.info(`Landing page → http://localhost:${PORT}/`);
    logger.info(`App          → http://localhost:${PORT}/app`);
  });
}

startServer();

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
// Properly close the HTTP server and MongoDB connection on process exit.
// This prevents data corruption, leaked connections, and zombie processes.
// Triggered by: Ctrl+C (SIGINT), docker stop / systemd stop (SIGTERM), nodemon restart

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully...`);

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error('Error closing HTTP server', { error: err.message });
      process.exit(1);
    }
    logger.info('HTTP server closed');

    // Close MongoDB connection
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (dbErr) {
      logger.error('Error closing MongoDB connection', { error: dbErr.message });
    }

    logger.info('AuditoriaX shut down cleanly');
    process.exit(0);
  });

  // Force kill if graceful shutdown takes more than 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions — log and exit so the process manager can restart
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — forcing exit', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection — forcing exit', { reason: String(reason) });
  process.exit(1);
});
