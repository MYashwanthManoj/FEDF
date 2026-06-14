/**
 * AuditoriaX — Automated Integration Test Suite
 *
 * Tests the full backend API: auth, booking race conditions, payments, RBAC.
 * Run with:  node tests/run_tests.js
 *
 * Uses only Node.js built-ins (no test framework required).
 */

'use strict';

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const isHttps = BASE_URL.startsWith('https');

// ────────────────────────────────────────────────────────────────────────────
// Minimal HTTP client (no axios, no node-fetch required)
// ────────────────────────────────────────────────────────────────────────────

function request(method, path, body, cookieJar = []) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(cookieJar.length ? { Cookie: cookieJar.join('; ') } : {})
      }
    };

    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Collect Set-Cookie headers
        const cookies = res.headers['set-cookie'] || [];
        const newJar = [...cookieJar];
        cookies.forEach(c => {
          const [nameValue] = c.split(';');
          const [name] = nameValue.split('=');
          // Replace existing cookie of same name
          const idx = newJar.findIndex(existing => existing.startsWith(name + '='));
          if (idx >= 0) newJar[idx] = nameValue.trim();
          else newJar.push(nameValue.trim());
        });

        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), cookies: newJar });
        } catch {
          resolve({ status: res.statusCode, body: data, cookies: newJar });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Test runner
// ────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL  ${name}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Test suites
// ────────────────────────────────────────────────────────────────────────────

async function testAuthFlow() {
  console.log('\n📋 Auth Flow Tests');

  let adminCookies = [];
  let studentCookies = [];

  await test('Admin login with valid credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@auditoria.x',
      password: 'password123'
    });
    assertEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.email, 'No email in response');
    assertEqual(res.body.role, 'admin', `Expected role admin, got ${res.body.role}`);
    adminCookies = res.cookies;
  });

  await test('Login with wrong password returns 401', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@auditoria.x',
      password: 'wrongpassword'
    });
    assertEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert(res.body.error, 'No error message in 401 response');
  });

  await test('Login with missing fields returns 400', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'admin@auditoria.x' });
    assertEqual(res.status, 400, `Expected 400, got ${res.status}`);
  });

  await test('GET /api/auth/me returns user for authenticated request', async () => {
    const res = await request('GET', '/api/auth/me', null, adminCookies);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.email, 'No email in /me response');
  });

  await test('GET /api/auth/me returns 401 without token', async () => {
    const res = await request('GET', '/api/auth/me');
    assertEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await test('POST /api/auth/refresh returns new token', async () => {
    const res = await request('POST', '/api/auth/refresh', null, adminCookies);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await test('Student signup creates account', async () => {
    const unique = Date.now();
    const res = await request('POST', '/api/auth/signup', {
      email: `testuser_${unique}@test.com`,
      password: 'password123',
      college: 'Test College',
      gender: 'male'
    });
    assertEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.email, 'No email in signup response');
    assertEqual(res.body.role, 'student', `Expected student role, got ${res.body.role}`);
    studentCookies = res.cookies;
  });

  await test('Duplicate signup returns 409', async () => {
    const res = await request('POST', '/api/auth/signup', {
      email: 'admin@auditoria.x',
      password: 'password123',
      college: 'Test'
    });
    assertEqual(res.status, 409, `Expected 409, got ${res.status}`);
  });

  await test('Logout clears session', async () => {
    const res = await request('POST', '/api/auth/logout', null, adminCookies);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  return { adminCookies, studentCookies };
}

async function testRBAC(adminCookies, studentCookies) {
  console.log('\n🔐 RBAC / Permission Tests');

  await test('Admin can access /api/auth/users', async () => {
    const res = await request('GET', '/api/auth/users', null, adminCookies);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(Array.isArray(res.body), 'Expected array of users');
  });

  await test('Student cannot access /api/auth/users (403)', async () => {
    const res = await request('GET', '/api/auth/users', null, studentCookies);
    assertEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await test('Unauthenticated request to admin route returns 401', async () => {
    const res = await request('GET', '/api/auth/users');
    assertEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await test('Admin can list all bookings', async () => {
    const res = await request('GET', '/api/bookings/all', null, adminCookies);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(Array.isArray(res.body), 'Expected array of bookings');
  });

  await test('Student cannot list all bookings (403)', async () => {
    const res = await request('GET', '/api/bookings/all', null, studentCookies);
    assertEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });
}

async function testEventsAndAuditoriums(adminCookies) {
  console.log('\n🏛️  Events & Auditoriums Tests');

  let auditoriumId = null;
  let eventId = null;

  await test('Admin can create an auditorium', async () => {
    const res = await request('POST', '/api/auditoriums', {
      college: 'Test College',
      name: 'Test Hall',
      capacity: 100,
      city: 'Hyderabad',
      facilities: ['AC', 'Projector'],
      teacherSeats: 10,
      girlSeats: 45,
      boySeats: 45
    }, adminCookies);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.id, 'No auditorium id in response');
    auditoriumId = res.body.id;
  });

  await test('Auditorium list includes newly created venue', async () => {
    const res = await request('GET', '/api/auditoriums');
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body), 'Expected array');
    const found = res.body.some(a => a.id === auditoriumId);
    assert(found, `Auditorium ${auditoriumId} not found in listing`);
  });

  await test('Auditorium creation fails with mismatched seat allocation', async () => {
    const res = await request('POST', '/api/auditoriums', {
      college: 'X', name: 'Y', capacity: 100, city: 'Z',
      teacherSeats: 10, girlSeats: 10, boySeats: 10 // sum = 30, not 100
    }, adminCookies);
    assertEqual(res.status, 400, `Expected 400, got ${res.status}`);
  });

  await test('Admin can create an event', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const res = await request('POST', '/api/events', {
      title: 'Test Event',
      category: 'Tech',
      auditoriumId,
      date: tomorrow.toISOString().split('T')[0],
      time: '10:00',
      duration: 2,
      price: 0,
      color: '#6c63ff',
      description: 'Automated test event',
      createdBy: 'admin@auditoria.x'
    }, adminCookies);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.id, 'No event id in response');
    eventId = res.body.id;
  });

  await test('Event list includes newly created event', async () => {
    const res = await request('GET', '/api/events');
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const found = res.body.some(e => e.id === eventId);
    assert(found, `Event ${eventId} not found in listing`);
  });

  await test('Seat map created for new event', async () => {
    const res = await request('GET', `/api/bookings/seats/${eventId}`);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.seats), 'Expected seats array');
    assertEqual(res.body.seats.length, 100, `Expected 100 seats, got ${res.body.seats.length}`);
    assert(res.body.seats.every(s => s === false), 'All seats should start as available (false)');
  });

  return { auditoriumId, eventId };
}

async function testBookingFlow(studentCookies, adminCookies, eventId) {
  console.log('\n🎟️  Booking Flow Tests');

  let ticketId = null;

  await test('Student can lock a seat', async () => {
    const res = await request('POST', '/api/bookings/lock', { eventId, seat: 1 }, studentCookies);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.locked, 'Expected locked: true');
  });

  await test('Student can book a free seat', async () => {
    const res = await request('POST', '/api/bookings', {
      eventId,
      auditoriumId: 'dummy_aud',
      auditoriumName: 'Test Hall',
      eventCollege: 'Test College',
      date: '2026-12-01',
      time: '10:00',
      seat: 1
    }, studentCookies);
    assertEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.id, 'No ticket id in response');
    ticketId = res.body.id;
  });

  await test('Student cannot book the same event twice', async () => {
    const res = await request('POST', '/api/bookings', {
      eventId, auditoriumId: 'dummy', auditoriumName: 'Test Hall',
      eventCollege: 'Test College', date: '2026-12-01', time: '10:00', seat: 2
    }, studentCookies);
    assertEqual(res.status, 409, `Expected 409 (already booked), got ${res.status}`);
  });

  await test('Booked seat shows as taken in seat map', async () => {
    const res = await request('GET', `/api/bookings/seats/${eventId}`);
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assertEqual(res.body.seats[0], true, 'Seat 1 should be marked taken (true)');
  });

  await test('Admin can cancel a booking', async () => {
    const res = await request('DELETE', `/api/bookings/${ticketId}`, null, adminCookies);
    // 200 = cancelled (free ticket), 502 = Razorpay refund failed (paid ticket in test mode)
    assert(res.status === 200 || res.status === 502,
      `Expected 200 or 502, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  await test('Cancelled seat is freed in seat map', async () => {
    const res = await request('GET', `/api/bookings/seats/${eventId}`);
    assertEqual(res.body.seats[0], false, 'Seat 1 should be freed (false) after cancellation');
  });
}

async function testRaceCondition(studentCookies, adminCookies, eventId) {
  console.log('\n⚡ Race Condition / Double-Booking Test');

  // Create two separate student accounts and try to book the same seat simultaneously
  const [s1Res, s2Res] = await Promise.all([
    request('POST', '/api/auth/signup', {
      email: `racer1_${Date.now()}@test.com`, password: 'password123', college: 'A'
    }),
    request('POST', '/api/auth/signup', {
      email: `racer2_${Date.now() + 1}@test.com`, password: 'password123', college: 'B'
    })
  ]);

  const c1 = s1Res.cookies;
  const c2 = s2Res.cookies;

  await test('Two simultaneous bookings for seat 50 — only one succeeds', async () => {
    const booking = {
      eventId, auditoriumId: 'dummy', auditoriumName: 'Test Hall',
      eventCollege: 'Test College', date: '2026-12-01', time: '10:00', seat: 50
    };
    const [r1, r2] = await Promise.all([
      request('POST', '/api/bookings', booking, c1),
      request('POST', '/api/bookings', booking, c2)
    ]);

    const statuses = [r1.status, r2.status].sort();
    assert(
      statuses.includes(201) && statuses.includes(409),
      `Expected one 201 and one 409, got ${r1.status} and ${r2.status}`
    );
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log('\n🚀 AuditoriaX — Integration Test Suite');
  console.log(`   Target: ${BASE_URL}`);
  console.log('─'.repeat(50));

  // Re-login as admin (logout happened in auth tests)
  const adminLoginRes = await request('POST', '/api/auth/login', {
    email: 'admin@auditoria.x',
    password: 'password123'
  });

  if (adminLoginRes.status !== 200) {
    console.error('\n❌ Cannot log in as admin. Is the server running?');
    console.error('   Start the server with: node server.js');
    process.exit(1);
  }

  const adminCookies = adminLoginRes.cookies;

  const { adminCookies: _, studentCookies } = await testAuthFlow();
  // Re-login fresh student after auth tests created one
  const freshStudentRes = await request('POST', '/api/auth/signup', {
    email: `student_main_${Date.now()}@test.com`,
    password: 'password123',
    college: 'Test College'
  });
  const freshStudentCookies = freshStudentRes.cookies;

  await testRBAC(adminCookies, freshStudentCookies);
  const { eventId } = await testEventsAndAuditoriums(adminCookies);

  if (eventId) {
    await testBookingFlow(freshStudentCookies, adminCookies, eventId);
    await testRaceCondition(freshStudentCookies, adminCookies, eventId);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. See above for details.\n`);
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('\n💥 Test runner crashed:', err.message);
  process.exit(1);
});
