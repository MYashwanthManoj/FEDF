# AuditoriaX — Project Changelog

> Every change made to this project is logged here in order.
> Format: `[SESSION] — [FILE(S)] — [WHAT CHANGED] — [WHY]`

---

## Session 9 — FUTURE-10: Public Landing Page + Production Deployment

**Date:** June 2026 | **Status:** ✅ Complete

### FUTURE-10A: Premium Landing Page — `public/landing.html`
- **Replaced** the old placeholder landing page with a fully redesigned, production-grade marketing page.
- **Sections built:**
  - **Navbar** — Glassmorphic blur-on-scroll nav with Sign In / Get Started CTAs
  - **Hero** — Animated gradient headline, floating orb glows, live ticket mockup card, mini seat-map card, notification card, avatar stack social proof
  - **Marquee** — Infinite-scroll tech feature strip
  - **Stats strip** — Animated count-up on scroll (50+ colleges, 2400+ events, 98K+ seats, 99.9% uptime)
  - **Features grid** — 6-card grid (Real-time seats, QR scanning, Razorpay, Multi-tenant, Analytics, Waitlist) with hover lift animation
  - **How it works** — 3-step connected timeline
  - **Pricing** — Free / Basic / Premium cards with real fee rates from env
  - **Testimonials** — 3 review cards with star ratings
  - **Final CTA** — Gradient glow card
  - **Footer** — 4-column with live "All systems operational" indicator
- **Visual effects:** Floating canvas particles, scroll-reveal fade-slide animations, glassmorphism cards.
- **Why:** The old landing page was a plain placeholder. Any new visitor needed a professional first impression.

### FUTURE-10B: Production Deployment — Render.com + MongoDB Atlas
- **`render.yaml`** — Already committed from a prior session. Contains all non-secret env defaults and auto-deploy config pointing to Singapore region.
- **MongoDB Atlas M0 (Free)** cluster created: `auditoriax` on AWS Hyderabad (ap-south-2).
  - Database user: `yashwanthmanoj623_db_user`
  - Network access: `0.0.0.0/0` (required for Render's dynamic IPs)
- **Render.com Web Service** deployed from `MYashwanthManoj/AditoriaX` → `main` branch.
  - Live URL: **https://auditoriax.onrender.com**
  - All 20+ secret environment variables added via Render Environment dashboard.
  - Auto-deploy enabled — every `git push origin main` redeploys automatically.
- **GitHub repo:** https://github.com/MYashwanthManoj/AditoriaX
  - Initial push included merge of remote history (`test.txt.txt` from prior repo init).

### `seed-college-events.js` — New production seed script *(new file)*
- **What:** Seeds 10 realistic college events (Hackathon, Music Night, Research Presentation, Entrepreneurship Summit, Drama Fest, Cybersecurity Workshop, Sports Conclave, AI Symposium, Literary Festival, Career Fair) with future dates, multiple colleges, price tiers (free/₹30/₹50/₹149/₹199/₹299).
- Requires at least one auditorium to exist in DB (uses round-robin assignment).
- Creates matching `SeatMap` per event.
- **Why:** Fresh production deployments have empty databases. This enables quick demo data without manual UI entry.

### Git commit: `128156f`
- Files changed: `CHANGELOG.md`, `middleware/tenant.js`, `public/landing.html`, `seed-college-events.js`, `utils/logger.js`
- 1,335 insertions, 399 deletions

---

## Session 8 — FUTURE-06 Audit + FUTURE-07: Structured Logging Completion

**Date:** June 2026 | **Status:** ✅ Complete

### FUTURE-06: Email Verification — Confirmed Already Complete
- Implemented as FIX-19 in Session 4. Fully operational:
  - `GET /api/auth/verify-email?token=xxx` — validates token, marks `emailVerified: true`, redirects to app
  - `POST /api/auth/resend-verification` — regenerates and resends token
  - On signup: 64-char hex token (24h expiry) generated and emailed non-blockingly
  - Master admin emails auto-verified on creation

### FUTURE-07: Structured Logging — Final Straggler Fixed
- `utils/logger.js` and `winston` were already in place across all routes and utilities
- **Fix:** `middleware/tenant.js` had one remaining `console.error('Tenant resolution error:', err)` — replaced with `logger.error('Tenant resolution error', { error: err.message, stack: err.stack })`
- Winston logger import added to `middleware/tenant.js`
- **Result:** Zero `console.log/warn/error` calls remain anywhere in production backend code

---

## Session 1 — 2026-05-18 — Security & Architecture Hardening

### ✅ FIX-01 · `.env`, `routes/auth.js` — Hardcoded personal emails removed
- **What:** Added `MASTER_ADMINS` env variable (comma-separated). `auth.js` reads from `process.env.MASTER_ADMINS` instead of a hardcoded array.
- **Why:** Personal emails were hardcoded in source. Any git commit would expose them permanently.

### ✅ FIX-02 · `server.js` — `mongodb-memory-server` removed as production fallback
- **What:** In-memory MongoDB fallback now only runs in `development`. In `production`, server exits immediately with a clear error if MongoDB is unreachable.
- **Why:** In-memory DB wipes all data on every server restart. Catastrophic data loss in production.

### ✅ FIX-03 · `routes/bookings.js` — Razorpay refund triggered on admin cancellation
- **What:** `DELETE /api/bookings/:ticketId` now calls `razorpay.payments.refund()` before deleting a paid booking. If the refund fails, returns 502 and does NOT delete.
- **Why:** Money was being kept while cancelling paid bookings — a legal violation under Indian consumer law.

### ✅ FIX-04 · `routes/auth.js`, `.env` — Refresh token system
- **What:** Access token reduced 7d → 15min. Separate `refreshToken` cookie (7 days, httpOnly) issued at login/signup. New `POST /api/auth/refresh` endpoint. Logout clears both cookies.
- **Why:** A non-revocable 7-day access token is a security risk. Short-lived tokens limit blast radius if stolen.

### ✅ FIX-05 · `middleware/auth.js` — Auto-refresh on expired access token
- **What:** `verifyToken` silently calls `attemptRefresh()` on expiry, issues a new cookie, and continues the request without returning 401.
- **Why:** Without this, every request after 15 minutes would fail and randomly log users out.

### ✅ FIX-06 · `server.js`, `.env` — CORS restricted to allowlist
- **What:** Replaced `cors({ origin: true })` with a function reading `ALLOWED_ORIGINS` from env. All other origins blocked.
- **Why:** `origin: true` allows any website to make authenticated cross-origin requests — a CSRF risk.

### ✅ FIX-07 · `server.js` — Rate limiting split: auth vs general
- **What:** Auth routes (login/signup): **20 req / 15 min**. All other API routes: **300 req / 15 min**.
- **Why:** Previous limit was 1000/15min — useless against brute-force attacks.

### ✅ FIX-08 · `tests/run_tests.js` — Automated integration test suite *(new file)*
- **What:** Full test suite using only Node.js built-ins. Tests: auth flow, RBAC, CRUD, booking lifecycle, race condition (double-booking prevention).
- **Why:** No automated tests existed. Bugs were only found when users lost money or got locked out.

---

## Session 2 — 2026-05-18 — Permissions, Security & Reliability

### ✅ FIX-09 · `.gitignore`, `.env.example` — Secrets protection *(new files)*
- **What:** `.gitignore` excludes `.env`, `node_modules/`, logs, OS files. `.env.example` is a safe template safe to commit.
- **Why:** Without `.gitignore`, a `git add .` would commit real API keys, JWT secrets, and personal emails.

### ✅ FIX-10 · `routes/events.js`, `routes/auditoriums.js` — Permission-based auth guards
- **What:** Replaced `verifyAdmin` (super-admin only) with `verifyPermission(key)` middleware that checks `user.permissions[key] === true` in DB. Added past-date validation on event creation.
- **Why:** Pseudo-admins with `createEvents: true` in DB couldn't actually create events — the entire RBAC permission system was ignored at the route level.

### ✅ FIX-11 · `server.js` — Graceful shutdown on SIGTERM / SIGINT
- **What:** Handlers for `SIGTERM`, `SIGINT`, `uncaughtException`, `unhandledRejection`. Stops HTTP server → closes MongoDB → exits clean. Force-kills after 10s if hung.
- **Why:** Without this, `Ctrl+C` or deploy restarts killed the process mid-request, risking corrupt writes and leaked DB connections.

### ✅ FIX-12 · `public/app.js` — Session-expired UI handler
- **What:** Added `window.addEventListener('auditoriax:session-expired', ...)` — clears state, closes modals, shows login, displays clear toast.
- **Why:** `api.js` fired this event but nothing listened. Users saw a silently broken UI with no explanation.

---

## Session 3 — 2026-05-18 — Bug Fixes

### ✅ FIX-13 · `server.js` — Socket.io CORS was still `origin: true`
- **What:** Moved Socket.io init to after `allowedOrigins` is computed. Now uses the same function as Express CORS.
- **Why:** All Express CORS work was bypassed via the WebSocket endpoint — any foreign origin could connect to real-time seat events.

### ✅ FIX-14 · `public/api.js` — `api.signup()` signature mismatch *(broken signup)*
- **What:** Changed `signup(email, password, college, gender, cluster)` → `signup(data)` to match how `app.js` calls it with an object.
- **Why:** The object was being passed as the `email` argument. **Every new user registration was silently broken.**

### ✅ FIX-15 · `server.js` — Startup environment variable validation
- **What:** Validation block runs immediately after `dotenv.config()`. Checks all required vars. In production: fatal exit on missing. In development: warning with a fix hint.
- **Why:** Server was starting with empty `JWT_SECRET` (tokens trivially forgeable) or placeholder Razorpay keys (runtime crash on first payment).

---

## Session 4 — 2026-05-19 — Feature Completions

### ✅ FIX-16 · `routes/events.js` — Venue double-booking prevention (FUTURE-05)
- **What:** Before saving a new event, converts all times to minutes and checks every existing event on the same `auditoriumId + date` for a time overlap. Returns 409 with the conflicting event's name and time range.
- **Why:** Two events could be scheduled in the same auditorium at the same time. Students would arrive at a double-booked venue.

### ✅ FIX-17 · `routes/bookings.js`, `.env` — Student self-cancellation (FUTURE-03)
- **What:** New `DELETE /api/bookings/mine/:ticketId`. Enforces: (1) ownership check, (2) cut-off `CANCEL_CUTOFF_HOURS` before event (default 2h, configurable), (3) auto Razorpay refund for paid bookings, (4) seat freed + socket event emitted.
- **Why:** Only admins could cancel bookings. Students with changed plans had no recourse.

### ✅ FIX-18 · `routes/auth.js`, `utils/mailer.js`, `models/User.js` — Password reset via email (FUTURE-09)
- **What:**
  - `POST /api/auth/forgot-password` — always 200 (anti-enumeration), generates 64-char hex token (1h expiry), sends branded reset email asynchronously
  - `POST /api/auth/reset-password` — validates token + expiry, hashes new password with bcrypt, clears token, forces re-login by clearing cookies
- **Why:** Users with forgotten passwords were permanently locked out with no recovery path.

### ✅ FIX-19 · `routes/auth.js`, `utils/mailer.js`, `models/User.js` — Email verification on signup (FUTURE-06)
- **What:**
  - `models/User.js` gets: `emailVerified` (bool), `verificationToken` (string), `verificationExpiry` (Date), `resetToken` (string), `resetTokenExpiry` (Date)
  - On signup: generates 64-char hex token (24h expiry), saves to user, sends verification email non-blockingly
  - `GET /api/auth/verify-email?token=xxx` — validates token, marks `emailVerified: true`, redirects to app
  - `POST /api/auth/resend-verification` — regenerates token, resends email (requires login)
  - Master admin emails are auto-verified on creation
- **Why:** Anyone could register with a fake or typo email. No way to reach users who made mistakes.

---

## Session 5 — 2026-05-19 — Multi-Tenant Architecture (FUTURE-01)

### ✅ FIX-20 · `models/Institution.js` *(new file)* — Institution model
- **What:** New Mongoose schema for institutions. Fields: `slug` (URL-safe unique ID), `name`, `domain` (email domain for auto-association), `city`, `state`, `contactEmail`, `logo`, `plan` (free/basic/premium — reserved for FUTURE-02 billing), `status` (pending/active/suspended), `ownerId` (User ref), `settings` (maxAuditoriums, maxEventsPerMonth, allowPublicEvents, requireApproval).
- **Why:** No institution concept existed. All data was flat — there was no way to separate one college's data from another's or enforce per-college admin boundaries.

### ✅ FIX-21 · `models/User.js`, `models/Auditorium.js`, `models/Event.js`, `models/Booking.js`, `models/SeatMap.js`, `models/SeatLock.js` — `institutionId` on all tenant-scoped models
- **What:** Added `institutionId: { type: ObjectId, ref: 'Institution', default: null }` to every data model. Added `institution_admin` to the User role enum. All `null` defaults ensure zero-downtime backward compatibility — no existing documents break.
- **Why:** Every resource must be attributable to a tenant so queries can be scoped per institution.

### ✅ FIX-22 · `middleware/tenant.js` *(new file)* — Tenant resolution middleware
- **What:** Three middleware functions: `resolveTenant` (looks up the user's institution, attaches `req.institution`; returns 403 for suspended institutions), `requireTenant` (blocks requests without an institution context), `requireInstitutionAdmin` (guards institution management routes to owners and platform admins).
- **Why:** Without centralised tenant resolution, every route would duplicate the "which institution does this user belong to?" lookup.

### ✅ FIX-23 · `routes/institutions.js` *(new file)* — Institution CRUD + self-onboarding
- **What:** Full institution API: `GET /api/institutions` (public list), `GET /api/institutions/:slug` (detail + live stats), `POST /api/institutions/register` (self-onboarding — promotes registering user to `institution_admin`), `PUT /api/institutions/:slug` (update, owner/platform admin only), `GET /api/institutions/:slug/members`, `POST /api/institutions/:slug/join`, `POST /api/institutions/:slug/leave`, `DELETE /api/institutions/:slug` (platform admin only). Email domain uniqueness validated on registration.
- **Why:** Core of FUTURE-01. A college admin must be able to register their institution without any platform developer involvement.

### ✅ FIX-24 · `routes/auth.js`, `middleware/auth.js` — `institutionId` in JWT
- **What:** JWT access and refresh tokens now include `institutionId`. `attemptRefresh` propagates `institutionId` to new tokens. Login, signup, and `/api/auth/me` responses include `institutionId`, `institutionName`, `institutionSlug`. Signup auto-associates new users with an institution if their email domain matches a registered one. `institution_admin` added to valid assignable roles.
- **Why:** Without `institutionId` in the token, every authenticated request would need a separate DB lookup just to know which tenant the user belongs to.

### ✅ FIX-25 · `routes/auditoriums.js`, `routes/events.js`, `routes/bookings.js`, `routes/payments.js` — Tenant scoping
- **What:** `institution_admin` role granted access alongside `admin` in all admin-level routes. Auditoriums, events, bookings, and seat maps now store `institutionId` at creation time (events/seatmaps inherit from their auditorium). Razorpay order notes include `institutionId` for billing reconciliation.
- **Why:** Without this, any institution admin would silently see and manage every other institution's data.

### ✅ FIX-26 · `routes/bookings.js` line 413 — **CRITICAL BUGFIX: `booking.email` → `booking.userEmail`**
- **What:** The ownership check in student self-cancellation used `booking.email` — a field that does not exist on the Booking model (which only has `userEmail`). Fixed to `booking.userEmail`.
- **Why:** Every student attempting to self-cancel received an unhandled TypeError crash. The self-cancellation feature added in FIX-17 was completely broken in production.

### ✅ FIX-27 · `server.js` — Default institution seeding + `institution_admin` permissions
- **What:** On startup, creates a `slug: 'default'` institution if none exists and associates all seeded test accounts with it. `institution_admin` added to the default permissions map.
- **Why:** Migration path for pre-multi-tenant data. Existing auditoriums and events have `institutionId: null` and continue to function unchanged.

### ✅ FIX-28 · `public/api.js` — Institution API methods
- **What:** Added `api.getInstitutions()`, `api.getInstitution(slug)`, `api.registerInstitution(data)`, `api.updateInstitution(slug, data)`, `api.joinInstitution(slug)`, `api.leaveInstitution(slug)`, `api.getInstitutionMembers(slug)`, `api.deleteInstitution(slug)`.
- **Why:** Frontend needs these methods to build the institution onboarding and management UI.

### ✅ FIX-29 · `.env.example` — `INSTITUTION_REGISTRATION_ENABLED` + `CANCEL_CUTOFF_HOURS`
- **What:** `INSTITUTION_REGISTRATION_ENABLED=true` — set to `'false'` to disable self-registration. `CANCEL_CUTOFF_HOURS=2` was already in `.env` but missing from the example template.
- **Why:** Platform operators may want to gatekeep institution onboarding. Template must match all variables used in code.

---

## Remaining Planned Work

> Priority: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low

| # | Priority | Item | Status |
|---|---|---|---|
| FUTURE-01 | 🔴 | Multi-tenant architecture (institution self-onboarding) | ✅ Done (Session 5) |
| FUTURE-02 | 🔴 | Platform fee / billing model (Razorpay split) | ✅ Done (Session 6) |
| FUTURE-04 | 🟠 | Waitlist system (notify on cancellation) | ✅ Done (Session 7) |
| FUTURE-06 | 🟠 | Email verification on signup | ✅ Done (Session 4) |
| FUTURE-07 | 🟡 | Structured logging (replace console.log with winston) | ✅ Done (Session 8) |
| FUTURE-08 | 🟡 | Frontend code split (split monolithic app.js) | Pending |
| FUTURE-10 | 🟡 | Public landing page + deployment (Render/Railway) | ✅ Done (Session 9) |
| FUTURE-11 | 🟢 | Analytics dashboard with real charts (Chart.js) | ✅ Done (Session 7) |
| FUTURE-12 | 🟢 | Mobile push notifications (Web Push API via existing PWA) | Pending |

---

## Session 7 — FUTURE-11 + FUTURE-04

**Date:** June 2025 | **Status:** ✅ Complete

### FUTURE-11: Real Analytics Charts (Chart.js)

- Replaced hand-drawn canvas bars with **5 Chart.js charts**:
  - 🗂 **Doughnut** — Events by Category
  - 📅 **Line** — Monthly Booking Trend (filled, smooth)
  - 🏛 **Horizontal Bar** — Venue Occupancy % (color-coded: green/orange/red)
  - 💰 **Bar** — Revenue by Event (Top 5)
  - 📆 **Polar Area** — Bookings by Day of Week (new insight)
- Chart instances stored in `_charts` object and destroyed before re-render — **no memory leaks**
- Chart.js fallback: if CDN not loaded yet, retries after 300ms
- **Top Events table** upgraded: medals 🥇🥈🥉, revenue column added, top 8 events
- **Export CSV** button added to analytics header
- Removed hardcoded placeholder feedback widget

### FUTURE-04: Waitlist System

**Backend:**
- `models/Waitlist.js` — per-event queue: position, notify token, status, compound unique index
- `routes/waitlist.js` — 5 endpoints: join, leave, my-waitlist, admin queue view, token claim
- `notifyNextInLine(eventId, io, appUrl)` — called from both cancellation paths in `bookings.js`
- `utils/mailer.js` — `sendWaitlistNotification()` — branded email with countdown timer and CTA link
- Both admin cancel and student self-cancel now trigger `notifyNextInLine` (non-blocking)
- `server.js` — `/api/waitlist` route registered

**Frontend:**
- Event cards show **📋 Join Waitlist** button when `availableSeats <= 0`
- If already in queue, shows **📋 In Queue #N** instead
- `socket.on('waitlist_seat_available')` — real-time modal with live countdown timer
- `?waitlist_token=` URL param — student can click email link and get booking modal opened
- `loadMyWaitlist()` — loaded alongside regular cache on app init
- `claimWaitlistSeat(token)` — validates token, opens booking modal

---

## File Index — What Each Changed File Does

| File | Role | Last Modified |
|---|---|---|
| `server.js` | Entry point: CORS, Socket.io, rate limiting, MongoDB, env validation, graceful shutdown, institution seeding | Session 5 |
| `middleware/auth.js` | JWT verification + silent auto-refresh middleware (now preserves `institutionId`) | Session 5 |
| `middleware/tenant.js` | Tenant resolution: resolves institution from user, enforces tenant boundaries | Session 5 *(new)* |
| `models/Institution.js` | Institution schema — slug, domain, plan, settings, owner | Session 5 *(new)* |
| `models/User.js` | User schema — added `institutionId`, `institution_admin` role | Session 5 |
| `models/Auditorium.js` | Auditorium schema — added `institutionId` | Session 5 |
| `models/Event.js` | Event schema — added `institutionId` | Session 5 |
| `models/Booking.js` | Booking schema — added `institutionId` | Session 5 |
| `models/SeatMap.js` | SeatMap schema — added `institutionId` | Session 5 |
| `models/SeatLock.js` | SeatLock schema — added `institutionId` | Session 5 |
| `routes/auth.js` | Login/signup/refresh now include `institutionId` in JWT; email-domain auto-association on signup | Session 5 |
| `routes/institutions.js` | Institution CRUD, self-onboarding, member join/leave, platform admin delete | Session 5 *(new)* |
| `routes/bookings.js` | Booking creation stores `institutionId`; `institution_admin` allowed; critical `booking.userEmail` bugfix | Session 5 |
| `routes/events.js` | Event creation stores `institutionId` from auditorium; `institution_admin` allowed | Session 5 |
| `routes/auditoriums.js` | Auditorium creation stores `institutionId`; `institution_admin` allowed | Session 5 |
| `routes/payments.js` | **FUTURE-02:** Razorpay order + verify rewired; platform fee computed; `/revenue/my`, `/revenue/all`, `/mark-paid`, `/plans` added | Session 6 |
| `routes/institutions.js` | **FUTURE-02:** Plan limits applied on register; `/billing` and `/plan` endpoints added | Session 6 |
| `models/PlatformRevenue.js` | **[NEW] FUTURE-02:** Audit trail for every platform fee collected | Session 6 |
| `utils/mailer.js` | Email templates: booking confirmation, email verification, password reset | Session 4 |
| `public/api.js` | Frontend fetch abstraction — added institution + **FUTURE-02** billing API methods | Session 6 |
| `public/app.js` | All frontend UI logic (~2,600 lines) + billing dashboard + payout views | Session 6 |
| `public/index.html` | Added 💳 Billing tab in admin panel + `billingAdminPane` | Session 6 |
| `public/sstyle.css` | **FUTURE-02:** Billing dashboard styles — stat cards, tables, plan tiers, badges | Session 6 |
| `tests/run_tests.js` | Automated integration test suite (no external deps) | Session 1 |
| `.env` | Environment variables — never commit | Session 4 |
| `.env.example` | Added `PLATFORM_FEE_*`, `PLAN_*_MAX_*` billing env vars | Session 6 |
| `.gitignore` | Prevents secrets and node_modules from being committed | Session 2 |
| `CHANGELOG.md` | This file | Session 6 |

---

## Session 6 — FUTURE-02: Platform Fee / Billing Model

**Date:** June 2025 | **Status:** ✅ Complete

### What was built

**1. Per-ticket platform fee (revenue split)**
Every paid booking now deducts a platform fee from the ticket price before recording how much the institution is owed:
- Free plan: **10% fee** · Basic: **7%** · Premium: **5%** (configurable via `.env`)
- Fee is computed in `routes/payments.js` on every `/api/payments/verify` call.
- A `PlatformRevenue` record is saved per booking — full audit trail.
- Institution's `billing.totalRevenue`, `billing.platformFeePaid`, `billing.pendingPayout` are updated atomically via `$inc`.

**2. Plan limits enforced**
- `routes/auditoriums.js` — rejects creation if institution is at/over `maxAuditoriums` for their plan.
- `routes/events.js` — rejects creation if institution has hit `maxEventsPerMonth` for the current calendar month.
- Both return a 403 with `plan`, `limit`, and `current` fields so the frontend can show a meaningful error.

**3. New model: `PlatformRevenue`**
Fields: `bookingId`, `institutionId`, `eventId`, `userEmail`, `razorpayPaymentId`, `totalAmount`, `platformFeePercent`, `platformFee`, `institutionAmount`, `payoutStatus` (pending/paid), `payoutDate`, `payoutNote`, `eventTitle`, `seat`.

**4. New backend endpoints**
| Endpoint | Role | Purpose |
|----------|------|---------|
| `GET /api/payments/revenue/my` | institution_admin | Own revenue + recent transactions |
| `GET /api/payments/revenue/all` | super admin | All platform revenue, paginated |
| `PUT /api/payments/revenue/:id/mark-paid` | super admin | Mark institution payout as completed |
| `GET /api/payments/plans` | public | Plan tier details + fee rates |
| `GET /api/institutions/:slug/billing` | institution_admin | Full billing dashboard with monthly aggregation |
| `PUT /api/institutions/:slug/plan` | super admin | Change institution plan + update limits |

**5. Billing Dashboard (Frontend)**
- New **💳 Billing** tab in Admin Panel (visible to institution_admin and super admin).
- **Super admin view:** Platform-wide KPIs (total collected, platform earnings, pending payouts, paid out) + transaction table with "Mark Paid" action + plan tier overview.
- **Institution admin view:** Gross revenue, platform fees deducted, pending payout, lifetime received + monthly breakdown table + recent transactions + plan limits display.
