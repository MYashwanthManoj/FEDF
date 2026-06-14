'use strict';
/**
 * utils/logger.js — AuditoriaX structured logger (FUTURE-07)
 *
 * Dev  → colorized, human-readable console output with timestamps
 * Prod → JSON console output + rotating files (logs/app.log, logs/error.log)
 *
 * Usage anywhere in the codebase:
 *   const logger = require('../utils/logger');
 *   logger.info('User logged in', { email, role });
 *   logger.warn('Rate limit hit', { ip });
 *   logger.error('Payment failed', { error: err.message, bookingId });
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs   = require('fs');

const isProd = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

// ── Ensure logs/ directory exists (production only) ──────────────────────────
const logsDir = path.join(__dirname, '..', 'logs');
if (isProd && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ── Shared format pieces ──────────────────────────────────────────────────────
const timestamp  = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });
const errorStack = format.errors({ stack: true });
const splat      = format.splat();

// ── Development format: colorized only in real TTY terminals ─────────────────
// VS Code Output panel is NOT a TTY — raw ANSI codes appear as garbled text.
// PowerShell / CMD / bash terminals ARE TTYs — they render colors correctly.
const isTTY = process.stdout.isTTY === true;

const devFormat = format.combine(
  timestamp,
  errorStack,
  splat,
  ...(isTTY ? [format.colorize({ all: true })] : []),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '  ' + JSON.stringify(meta)
      : '';
    return `${timestamp} [${level}] ${message}${stack ? '\n' + stack : ''}${metaStr}`;
  })
);

// ── Production format: JSON, machine-readable ─────────────────────────────────
const prodFormat = format.combine(
  timestamp,
  errorStack,
  splat,
  format.json()
);

// ── Build transport list ──────────────────────────────────────────────────────
const activeTransports = [
  new transports.Console({
    format: isProd ? prodFormat : devFormat,
  }),
];

// In production: also write to rotating log files
if (isProd) {
  activeTransports.push(
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level:    'error',
      format:   prodFormat,
      maxsize:  10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
    new transports.File({
      filename: path.join(logsDir, 'app.log'),
      format:   prodFormat,
      maxsize:  20 * 1024 * 1024, // 20 MB
      maxFiles: 10,
      tailable: true,
    })
  );
}

// ── Create logger ─────────────────────────────────────────────────────────────
const logger = createLogger({
  level:      LOG_LEVEL,
  transports: activeTransports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Morgan stream — pipes HTTP request logs into Winston at 'http' level.
 * Use with: app.use(morgan('combined', { stream: logger.stream }));
 */
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
