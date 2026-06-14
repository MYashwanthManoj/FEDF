/**
 * AuditoriaX — Frontend API Abstraction Layer
 *
 * All fetch calls go through apiFetch(), which handles:
 *  - Automatic token refresh on 401 (so users are never randomly logged out)
 *  - Consistent error handling
 *  - JSON serialization
 */

const API = '/api';

// Track if a refresh is already in progress to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let refreshQueue = []; // Pending requests waiting for refresh to complete

function processQueue(error) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  refreshQueue = [];
}

async function apiFetch(url, options = {}, _isRetry = false) {
  const defaultOptions = {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  };

  const r = await fetch(url, defaultOptions);

  // --- Auto-refresh on 401 ---
  if (r.status === 401 && !_isRetry) {
    // Don't try to refresh if this IS the refresh request or a login/signup request
    if (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/signup')) {
      const d = await r.json();
      throw new Error(d.error || 'Authentication failed');
    }

    if (isRefreshing) {
      // Wait for the in-progress refresh to finish, then retry
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then(() => apiFetch(url, options, true));
    }

    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!refreshRes.ok) {
        // Refresh failed — user must log in again
        processQueue(new Error('Session expired'));
        // Dispatch a global event so the app can show the login screen
        window.dispatchEvent(new CustomEvent('auditoriax:session-expired'));
        throw new Error('Session expired. Please log in again.');
      }

      processQueue(null);
      return apiFetch(url, options, true); // Retry the original request with new token
    } catch (err) {
      processQueue(err);
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

const api = {
  // Auth
  async login(email, password) {
    return apiFetch(`${API}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  async signup(data) {
    // data = { email, password, college, gender, cluster }
    return apiFetch(`${API}/auth/signup`, { method: 'POST', body: JSON.stringify(data) });
  },

  async logout() {
    return apiFetch(`${API}/auth/logout`, { method: 'POST' });
  },
  async getMe() {
    return apiFetch(`${API}/auth/me`);
  },
  async changePassword(currentPassword, newPassword) {
    return apiFetch(`${API}/auth/password`, { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
  },
  async updateProfile(data) {
    return apiFetch(`${API}/auth/profile`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async refresh() {
    return apiFetch(`${API}/auth/refresh`, { method: 'POST' });
  },
  async forgotPassword(email) {
    return apiFetch(`${API}/auth/forgot-password`, { method: 'POST', body: JSON.stringify({ email }) });
  },
  async resetPassword(token, newPassword) {
    return apiFetch(`${API}/auth/reset-password`, { method: 'POST', body: JSON.stringify({ token, newPassword }) });
  },

  // Events
  async getEvents() {
    return apiFetch(`${API}/events`);
  },
  async createEvent(data) {
    return apiFetch(`${API}/events`, { method: 'POST', body: JSON.stringify(data) });
  },
  async deleteEvent(id) {
    return apiFetch(`${API}/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // Auditoriums
  async getAuditoriums() {
    return apiFetch(`${API}/auditoriums`);
  },
  async createAuditorium(data) {
    return apiFetch(`${API}/auditoriums`, { method: 'POST', body: JSON.stringify(data) });
  },
  async deleteAuditorium(id) {
    return apiFetch(`${API}/auditoriums/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // Bookings
  async getMyBookings(email) {
    return apiFetch(`${API}/bookings/my/${encodeURIComponent(email)}`);
  },
  async getAllBookings() {
    return apiFetch(`${API}/bookings/all`);
  },
  async getAllSeats() {
    return apiFetch(`${API}/bookings/allseats`);
  },
  async getSeats(eventId) {
    return apiFetch(`${API}/bookings/seats/${encodeURIComponent(eventId)}`);
  },
  async createBooking(data) {
    return apiFetch(`${API}/bookings`, { method: 'POST', body: JSON.stringify(data) });
  },
  async cancelBooking(ticketId) {
    return apiFetch(`${API}/bookings/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
  },
  async cancelMyBooking(ticketId) {
    return apiFetch(`${API}/bookings/mine/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
  },
  async clearAllBookings() {
    return apiFetch(`${API}/bookings/clear/all`, { method: 'DELETE' });
  },
  async resetSystem() {
    return apiFetch(`${API}/bookings/reset/system`, { method: 'DELETE' });
  },
  async exportCSV() {
    // Returns raw response (not JSON) — caller handles the blob download
    const r = await fetch(`${API}/bookings/export-csv`, { credentials: 'include' });
    if (!r.ok) {
      const d = await r.json();
      throw new Error(d.error || 'Export failed');
    }
    return r; // caller: const blob = await r.blob();
  },
  async scanTicket(ticketId) {
    return apiFetch(`${API}/bookings/scan`, { method: 'POST', body: JSON.stringify({ ticketId }) });
  },

  // Seat Locking
  async lockSeat(eventId, seat) {
    return apiFetch(`${API}/bookings/lock`, { method: 'POST', body: JSON.stringify({ eventId, seat }) });
  },
  async unlockSeat(eventId) {
    return apiFetch(`${API}/bookings/lock`, { method: 'DELETE', body: JSON.stringify({ eventId }) });
  },

  // Payments
  async createPaymentOrder(data) {
    return apiFetch(`${API}/payments/create-order`, { method: 'POST', body: JSON.stringify(data) });
  },
  async verifyPayment(data) {
    return apiFetch(`${API}/payments/verify`, { method: 'POST', body: JSON.stringify(data) });
  },

  // User Management (Admin only)
  async getUsers() {
    return apiFetch(`${API}/auth/users`);
  },
  async createUser(data) {
    return apiFetch(`${API}/auth/users/create`, { method: 'POST', body: JSON.stringify(data) });
  },
  async updateUserRole(email, data) {
    return apiFetch(`${API}/auth/users/${encodeURIComponent(email)}/role`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteUser(email) {
    return apiFetch(`${API}/auth/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
  },

  // Institutions (Multi-tenant)
  async getInstitutions() {
    return apiFetch(`${API}/institutions`);
  },
  async getInstitution(slug) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}`);
  },
  async registerInstitution(data) {
    return apiFetch(`${API}/institutions/register`, { method: 'POST', body: JSON.stringify(data) });
  },
  async updateInstitution(slug, data) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async joinInstitution(slug) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}/join`, { method: 'POST' });
  },
  async leaveInstitution(slug) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}/leave`, { method: 'POST' });
  },
  async getInstitutionMembers(slug) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}/members`);
  },
  async deleteInstitution(slug) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  },

  // ─── FUTURE-02: Billing / Revenue ─────────────────────────────────────────
  // Institution admin: own revenue + payout summary
  async getMyRevenue() {
    return apiFetch(`${API}/payments/revenue/my`);
  },
  // Super admin: all platform revenue (paginated)
  async getAllRevenue(page = 1, limit = 50, status = '') {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    return apiFetch(`${API}/payments/revenue/all?${params}`);
  },
  // Super admin: mark a revenue record payout as completed
  async markPayoutPaid(id, payoutNote = '') {
    return apiFetch(`${API}/payments/revenue/${encodeURIComponent(id)}/mark-paid`, {
      method: 'PUT', body: JSON.stringify({ payoutNote })
    });
  },
  // Institution admin: full billing dashboard data
  async getInstitutionBilling(slug) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}/billing`);
  },
  // Super admin: change institution plan
  async updateInstitutionPlan(slug, plan) {
    return apiFetch(`${API}/institutions/${encodeURIComponent(slug)}/plan`, {
      method: 'PUT', body: JSON.stringify({ plan })
    });
  },
  // Public: get plan details + fee rates
  async getPlans() {
    return apiFetch(`${API}/payments/plans`);
  },

  // ── FUTURE-04: Waitlist ───────────────────────────────────────────────────
  async joinWaitlist(eventId) {
    return apiFetch(`${API}/waitlist/${eventId}/join`, { method: 'POST' });
  },
  async leaveWaitlist(eventId) {
    return apiFetch(`${API}/waitlist/${eventId}/leave`, { method: 'DELETE' });
  },
  async getMyWaitlist() {
    return apiFetch(`${API}/waitlist/my`);
  },
  async getEventWaitlist(eventId) {
    return apiFetch(`${API}/waitlist/${eventId}`);
  },
  async claimWaitlistSeat(token) {
    return apiFetch(`${API}/waitlist/claim/${token}`);
  }
};
