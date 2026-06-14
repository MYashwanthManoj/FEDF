/* =====================================================
   AUDITORIAX — FULL APPLICATION LOGIC
   Multi-college auditorium booking platform
   Features: Auth, Events, Seat Selection, Payment, Admin
====================================================== */

// ===== CONSTANTS =====
const SK = { USERS: 'ax_users', AUDITORIUMS: 'ax_auds', EVENTS: 'ax_evts', BOOKINGS: 'ax_bkgs', SESSION: 'ax_session' };
const CATEGORIES = { tech:'🖥 Tech', cultural:'🎭 Cultural', lecture:' Lecture', sports:'⚽ Sports', other:'📌 Other' };
const CATEGORY_COLORS = { tech:'#5b8dee', cultural:'#f472b6', lecture:'#22d87a', sports:'#fb923c', other:'#8888a8' };

// ===== STATE =====
let state = {
  currentUser: null,
  currentUserData: null,
  isAdmin: false,
  bookingContext: { event: null, auditorium: null, seat: null },
  pendingPayment: null,
  filterMode: 'all',
  searchTerm: ''
};

// ===== IN-MEMORY CACHE (loaded from MongoDB API) =====
let cache = { auditoriums: [], events: [], allSeats: {}, myBookings: [], allBookings: [] };

// Session stored in localStorage (DEPRECATED - now using HTTP-only cookies via /api/auth/me)
const getSession = () => null; 
const setSession = (v) => {};
const clearSession = () => {};

// Compatibility shim: get() reads from cache
function get(k, def=null) {
  if (k === SK.AUDITORIUMS) return cache.auditoriums;
  if (k === SK.EVENTS) return cache.events;
  if (k === SK.BOOKINGS) return cache.bookingsCompat;
  return def;
}
function set(k, v) { /* no-op: writes go through API now */ }

// ===== DATA INIT =====
const futureDate = d => { const dt=new Date(); dt.setDate(dt.getDate()+d); return dt.toISOString().split('T')[0]; };

// Helper: compute default seat allocation from capacity (used as fallback)
function defaultSeatAlloc(cap) {
  const teacher = Math.min(20, Math.floor(cap * 0.15));
  const girl = Math.min(Math.floor((cap - teacher) * 0.4), cap - teacher);
  const boy = cap - teacher - girl;
  return { teacherSeats: teacher, girlSeats: girl, boySeats: boy };
}

const defaultAuditoriums = [
  { id:'aud_1', college:'KL University', name:'KLU Main Auditorium', capacity:300, city:'Vijayawada', facilities:['AC','Projector','Wi-Fi','Parking'], teacherSeats:30, girlSeats:108, boySeats:162, createdAt:new Date().toISOString() },
  { id:'aud_2', college:'KL University', name:'KLU Seminar Hall', capacity:150, city:'Vijayawada', facilities:['AC','Projector'], teacherSeats:20, girlSeats:52, boySeats:78, createdAt:new Date().toISOString() },
  { id:'aud_3', college:'VIT University', name:'VIT Auditorium', capacity:500, city:'Vellore', facilities:['AC','Stage Lighting','Sound System','Recording Studio'], teacherSeats:20, girlSeats:192, boySeats:288, createdAt:new Date().toISOString() },
  { id:'aud_4', college:'SRM University', name:'SRM Convention Hall', capacity:200, city:'Chennai', facilities:['AC','Projector','Wi-Fi'], teacherSeats:20, girlSeats:72, boySeats:108, createdAt:new Date().toISOString() },
];

const defaultEvents = [
  { id:'evt_1', title:'TechFest 2025', category:'tech', auditoriumId:'aud_1', college:'KL University', date:futureDate(3), time:'10:00', duration:6, clusters:['1','2','3'], price:0, color:'#5b8dee', description:'KLU\'s biggest annual tech symposium! Hackathons, robotics competitions, AI workshops, and prize pool of ₹5 lakhs.', createdBy:'admin@system.com', createdAt:new Date().toISOString() },
  { id:'evt_2', title:'Cultural Fiesta 2025', category:'cultural', auditoriumId:'aud_2', college:'KL University', date:futureDate(7), time:'17:00', duration:5, clusters:['1','2','3','4','5'], price:0, color:'#f472b6', description:'An evening of dance, music, drama, and fashion. Clusters 1-5 welcome! Performances by 30+ student groups.', createdBy:'admin@system.com', createdAt:new Date().toISOString() },
  { id:'evt_3', title:'AI Revolution: Guest Lecture', category:'lecture', auditoriumId:'aud_3', college:'VIT University', date:futureDate(2), time:'11:00', duration:3, clusters:['1','2','3','4','5'], price:250, color:'#22d87a', description:'Keynote by Dr. Rajeev Menon, Chief AI Officer at Infosys. Topics: LLMs, Generative AI, and the future of work. Open to all colleges.', createdBy:'admin@system.com', createdAt:new Date().toISOString() },
  { id:'evt_4', title:'National Coding Championship', category:'tech', auditoriumId:'aud_4', college:'SRM University', date:futureDate(10), time:'09:00', duration:8, clusters:['1','2','3','4','5'], price:199, color:'#fb923c', description:'Compete against coders from 100+ colleges. DSA rounds, system design, and a final hackathon. Top 3 win cash prizes + internship offers.', createdBy:'admin@system.com', createdAt:new Date().toISOString() },
  { id:'evt_5', title:'Inter-College Debate Championship', category:'cultural', auditoriumId:'aud_1', college:'KL University', date:futureDate(14), time:'14:00', duration:4, clusters:['2','3','4'], price:0, color:'#a78bfa', description:'Regional debate championship open to all colleges. Topics include climate policy, AI ethics, and economic reforms. Register your 2-member team.', createdBy:'admin@system.com', createdAt:new Date().toISOString() },
  { id:'evt_6', title:'Startup Pitch Day 2025', category:'other', auditoriumId:'aud_3', college:'VIT University', date:futureDate(5), time:'13:00', duration:5, clusters:['1','2','3','4','5'], price:149, color:'#34d399', description:'Present your startup idea to a panel of VCs and angel investors. Best pitch wins ₹1 Lakh funding + mentorship. Open to all college teams.', createdBy:'admin@system.com', createdAt:new Date().toISOString() },
];

// ===== LOAD CACHE FROM API =====
async function loadCache() {
  try {
    const [auds, evts, allSeats] = await Promise.all([
      api.getAuditoriums(),
      api.getEvents(),
      api.getAllSeats()
    ]);
    cache.auditoriums = auds;
    cache.events = evts;
    cache.allSeats = allSeats;
    rebuildBookingsCompat();
  } catch(e) { console.error('Cache load error:', e); }
}

async function loadMyBookings() {
  if (!state.currentUser) return;
  try { cache.myBookings = await api.getMyBookings(state.currentUser); } catch(e) { cache.myBookings = []; }
}

async function loadAllBookings() {
  try { cache.allBookings = await api.getAllBookings(); } catch(e) { cache.allBookings = []; }
}

// Build backwards-compatible bookings object for rendering code
function rebuildBookingsCompat() {
  cache.bookingsCompat = { student: {}, teacher: {}, seats: cache.allSeats };
  // Will be populated per-view from API data
}

// ===== TOAST =====
let toastTimer;
function toast(msg, type='info', duration=3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ===== AUTH =====
function showAuthTab(tab) {
  document.getElementById('loginTabBtn').classList.toggle('active', tab==='login');
  document.getElementById('signupTabBtn').classList.toggle('active', tab==='signup');
  document.getElementById('loginForm').classList.toggle('active', tab==='login');
  document.getElementById('signupForm').classList.toggle('active', tab==='signup');
}

const PERSONAL_DOMAINS = ['gmail.com','yahoo.com','yahoo.in','outlook.com','hotmail.com','live.com','aol.com','icloud.com','protonmail.com','zoho.com','rediffmail.com','ymail.com','msn.com','mail.com'];

function isPersonalEmail(email) {
  const domain = email.split('@')[1] || '';
  return PERSONAL_DOMAINS.includes(domain);
}

function onSignupEmailInput() {
  const email = document.getElementById('signupEmail').value.toLowerCase().trim();
  const isPersonal = isPersonalEmail(email);
  const isKLH = email.endsWith('@klh.edu.in');
  const hasEmail = email.includes('@');

  // Hide college name for personal emails
  document.getElementById('collegeField').style.display = isPersonal ? 'none' : '';
  if (isPersonal) document.getElementById('signupCollege').value = '';

  // Show gender for ALL users once they've typed an email with @
  document.getElementById('genderField').style.display = hasEmail ? '' : 'none';

  // Show cluster field only for KLH students
  const sf = document.getElementById('studentFields');
  if (sf) sf.style.display = isKLH ? 'block' : 'none';
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (inp.type === 'password') { inp.type='text'; btn.textContent='🙈'; }
  else { inp.type='password'; btn.textContent='👁'; }
}

// Helper: Get Cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const authPage = document.getElementById('authPage');
    const lf = document.getElementById('loginForm');
    if (authPage && authPage.classList.contains('active') && lf && lf.classList.contains('active')) {
      handleLogin();
    }
  }
});

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;
  if (!email || !pw) { toast('Please fill in all fields','error'); return; }

  const btn = document.getElementById('loginBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    const userData = await api.login(email, pw);
    state.currentUser = userData.email;
    state.currentUserData = userData;
    state.isAdmin = (userData.role === 'admin'); // Super admin only
    state.isSuper = state.isAdmin;
    state.isStaff = ['admin', 'pseudo_admin', 'scanner'].includes(userData.role);
    
    await loadCache();
    await loadMyBookings();
    showMainApp();
    toast(`Welcome back, ${email.split('@')[0]}! 👋`, 'success');
  } catch(e) { 
    toast(e.message || 'Invalid email or password','error'); 
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleSignup() {
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const college = document.getElementById('signupCollege').value.trim();
  const pw = document.getElementById('signupPassword').value;
  const cpw = document.getElementById('signupConfirm').value;

  const isKLH = email.endsWith('@klh.edu.in');
  const isPersonal = isPersonalEmail(email);
  if (!email || !pw) { toast('Please fill all required fields','error'); return; }
  if (!isPersonal && !college) { toast('Please enter your college name','error'); return; }
  if (pw.length < 6) { toast('Password must be at least 6 characters','error'); return; }
  if (pw !== cpw) { toast('Passwords do not match','error'); return; }

  const g = document.getElementById('signupGender').value;
  if (!g) { toast('Please select your gender','error'); return; }
  if (isKLH) {
    const c = document.getElementById('signupCluster').value;
    if (!c) { toast('Please select your cluster','error'); return; }
  }

  try {
    const userData = await api.signup({
      email, college: isPersonal ? 'General Public' : college, password: pw,
      gender: document.getElementById('signupGender').value,
      cluster: isKLH ? document.getElementById('signupCluster').value : null
    });
    state.currentUser = userData.email;
    state.currentUserData = userData;
    state.isAdmin = userData.isAdmin;
    await loadCache();
    await loadMyBookings();
    toast('Account created! Welcome aboard! 🎉','success');
    showMainApp();
  } catch(e) { toast(e.message || 'Signup failed','error'); }
}

function showMainApp() {
  const user = state.currentUserData;
  const email = state.currentUser;
  const role = user.role || 'student';

  // State Helpers
  state.isSuper = (role === 'admin');
  state.isStaff = ['admin', 'pseudo_admin', 'scanner'].includes(role);

  document.getElementById('authPage').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  document.getElementById('mainApp').style.display = 'block';

  const initials = email ? email.split('@')[0].slice(0,2).toUpperCase() : '??';
  document.getElementById('navAvatar').textContent = initials;
  document.getElementById('navUsername').textContent = email ? email.split('@')[0] : 'User';
  
  const roleLabels = { admin: 'Super Admin', pseudo_admin: 'Pseudo Admin', scanner: 'Verifier', student: 'Student', teacher: 'Teacher' };
  document.getElementById('navRoleBadge').textContent = roleLabels[role] || 'Member';
  document.getElementById('navCollege').textContent = user.college || '';

  // Role-Based UI visibility
  if (state.isStaff) {
    document.getElementById('adminTabBtn').classList.remove('hidden');
    document.getElementById('adminDropLink').classList.remove('hidden');
    
    // Hide System and Users tabs for Pseudo Admins/Scanners
    const sysTab = document.getElementById('tab-system');
    const usersTab = document.getElementById('tab-users');
    if (sysTab) sysTab.style.display = state.isSuper ? 'inline-block' : 'none';
    if (usersTab) usersTab.style.display = state.isSuper ? 'inline-block' : 'none';
    
    // Hide everything but Scanner for Scanners
    if (role === 'scanner') {
      ['tab-events', 'tab-bookings', 'tab-auditoriums', 'tab-users'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      // Hide Explore and My Bookings main tabs
      const exploreTab = document.getElementById('exploreTabBtn');
      const bookingsTab = document.getElementById('bookingsTabBtn');
      if (exploreTab) exploreTab.style.display = 'none';
      if (bookingsTab) bookingsTab.style.display = 'none';
      // Hide dropdown links for Explore/Bookings
      const bookingsDrop = document.getElementById('bookingsDropLink');
      if (bookingsDrop) bookingsDrop.style.display = 'none';
      switchMainTab('admin');
      switchAdminTab('scanner');
    }
  } else {
    document.getElementById('adminTabBtn').classList.add('hidden');
    document.getElementById('adminDropLink').classList.add('hidden');
  }

  if (role !== 'scanner') switchMainTab('explore');

  // Show "Register Institution" button for admins/institution_admins without an institution
  const hasInstitution = !!(user.institutionId);
  const canRegister = ['admin','institution_admin'].includes(role) || state.isAdmin;
  let regBtn = document.getElementById('registerInstFloatBtn');
  if (!regBtn && !hasInstitution && canRegister) {
    regBtn = document.createElement('button');
    regBtn.id = 'registerInstFloatBtn';
    regBtn.className = 'btn-secondary';
    regBtn.title = 'Register your institution';
    regBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:8000;padding:10px 18px;font-size:0.85rem;border-radius:10px;background:var(--surface2);border:1px solid var(--accent);color:var(--accent);box-shadow:0 4px 20px rgba(248,68,100,0.25);display:flex;align-items:center;gap:8px';
    regBtn.innerHTML = '🏛 Register Your Institution';
    regBtn.onclick = showRegisterInstitution;
    document.body.appendChild(regBtn);
  } else if (regBtn && (hasInstitution || !canRegister)) {
    regBtn.remove();
  }
}

// loginUser() removed — was dead code calling nonexistent api.getUser()

async function handleLogout() {
  try { await api.logout(); } catch(e) {}
  state.currentUser = null;
  state.currentUserData = null;
  state.isAdmin = false;
  location.reload();
}

function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-user') && !e.target.closest('.user-dropdown')) {
    document.getElementById('userDropdown').classList.add('hidden');
  }
});

function switchAdminTab(tab) {
  const userRole = state.currentUserData.role;
  
  // SCANNER ROLE PROTECTION
  if (userRole === 'scanner' && tab !== 'scanner') {
    toast('Access Denied', 'error');
    switchAdminTab('scanner');
    return;
  }
  
  // PSEUDO ADMIN PROTECTION
  if (userRole === 'pseudo_admin' && (tab === 'system' || tab === 'users')) {
    toast('Access Denied: Super Admin only.', 'error');
    return;
  }

  document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-pane').forEach(pane => {
    pane.classList.remove('active');
    pane.classList.add('hidden');
  });

  const btn = document.getElementById(`tab-${tab}`) || document.querySelector(`.admin-tab[onclick*="'${tab}'"]`);
  if (btn) btn.classList.add('active');
  
  const pane = document.getElementById(`${tab}AdminPane`) || document.getElementById(`${tab}Pane`);
  if (pane) {
    pane.classList.add('active');
    pane.classList.remove('hidden');
    pane.style.display = ''; // Clear inline styles that override classes
  }

  if (tab === 'events') renderEventsAdmin();
  if (tab === 'bookings') renderBookingsAdmin();
  if (tab === 'system') renderSystemAdmin();
  if (tab === 'users') loadAndRenderUsers();
  if (tab === 'analytics') setTimeout(renderAnalytics, 50);
  if (tab === 'billing') renderBillingAdmin();

  // QR Scanner initialization
  if (tab === 'scanner') {
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: 250,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      });
      html5QrcodeScanner.render(onScanSuccess, onScanError);
    }
  } else {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner", err));
      html5QrcodeScanner = null;
    }
  }
}

function renderSystemAdmin() {
  const pane = document.getElementById('systemAdminPane');
  if (!pane) return;
  
  // Only Super Admin can see destructive buttons
  if (!state.isSuper) {
    pane.innerHTML = '<div class="empty-state"><h4>Restricted Access</h4><p>Destructive operations are only available to the Super Admin.</p></div>';
    return;
  }
}

async function exportAttendeesCSV() {
  try {
    // Open in a new tab to trigger the download with cookies
    const url = '/api/bookings/export-csv';
    window.open(url, '_blank');
    toast('✅ Preparing CSV download...', 'success');
  } catch(e) { toast('Failed to export CSV', 'error'); }
}

// ===== MAIN NAVIGATION =====
async function switchMainTab(tab) {
  // Block scanner from accessing explore or myBookings
  const userRole = state.currentUserData?.role;
  if (userRole === 'scanner' && (tab === 'explore' || tab === 'myBookings')) {
    toast('Access Denied: Scanner accounts can only use the Scanner.', 'error');
    return;
  }

  document.querySelectorAll('.mtab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tab+'Pane');
    p.classList.toggle('hidden', p.id !== tab+'Pane');
  });
  document.getElementById('userDropdown').classList.add('hidden');

  await loadCache();
  if (tab === 'explore') renderEvents();
  else if (tab === 'myBookings') await renderMyBookings();
  else if (tab === 'profile') renderProfile();
  else if (tab === 'admin' && state.isStaff) await renderAdminPanel();
}

// ===== HERO =====
function updateHero() {
  const events = get(SK.EVENTS, []);
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events.filter(e => new Date(e.date) >= today).sort((a,b) => new Date(a.date)-new Date(b.date));
  if (!upcoming.length) { document.querySelector('.hero-section').style.display='none'; return; }

  const ev = upcoming[0];
  state.heroEvent = ev;
  document.getElementById('heroEventName').textContent = ev.title;
  const auds = get(SK.AUDITORIUMS, []);
  const aud = auds.find(a => a.id === ev.auditoriumId);
  document.getElementById('heroEventMeta').textContent = `${ev.college} · ${formatDate(ev.date)} at ${ev.time} · ${aud?.name || ''}`;

  const tagsEl = document.getElementById('heroEventTags');
  tagsEl.innerHTML = `
    <span class="hero-tag accent">${CATEGORIES[ev.category]||ev.category}</span>
    <span class="hero-tag">${ev.price === 0 ? '🆓 Free Entry' : `₹${ev.price}`}</span>
    <span class="hero-tag">⏱ ${ev.duration}h</span>
  `;

  document.querySelector('.hero-section').style.borderLeft = `4px solid ${ev.color}`;
}

function handleHeroBook() {
  if (!state.heroEvent) return;
  openBookingModal(state.heroEvent);
}

// ===== EVENTS =====
function filterEvents(mode, btn) {
  state.filterMode = mode;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderEvents();
}

function handleSearch() {
  state.searchTerm = document.getElementById('globalSearch').value.toLowerCase();
  renderEvents();
}

function getFilteredEvents() {
  let events = get(SK.EVENTS, []);
  const today = new Date(); today.setHours(0,0,0,0);
  events = events.filter(e => new Date(e.date) >= today);

  const { searchTerm, filterMode } = state;

  if (searchTerm) {
    events = events.filter(e =>
      e.title.toLowerCase().includes(searchTerm) ||
      e.college.toLowerCase().includes(searchTerm) ||
      (e.description||'').toLowerCase().includes(searchTerm) ||
      e.category.includes(searchTerm)
    );
  }

  const now = new Date();
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate()+7);
  const ud = state.currentUserData;

  switch(filterMode) {
    case 'today': events = events.filter(e => e.date === now.toISOString().split('T')[0]); break;
    case 'this_week': events = events.filter(e => { const d=new Date(e.date); return d>=today && d<=weekEnd; }); break;
    case 'tech': events = events.filter(e => e.category==='tech'); break;
    case 'cultural': events = events.filter(e => e.category==='cultural'); break;
    case 'lecture': events = events.filter(e => e.category==='lecture'); break;
    case 'sports': events = events.filter(e => e.category==='sports'); break;
    case 'free': events = events.filter(e => e.price===0); break;
    case 'paid': events = events.filter(e => e.price>0); break;
    case 'my_college': events = events.filter(e => ud && e.college.toLowerCase() === (ud.college||'').toLowerCase()); break;
  }

  return events.sort((a,b) => new Date(a.date)-new Date(b.date));
}

function renderEvents() {
  updateHero();
  const events = getFilteredEvents();
  const grid = document.getElementById('eventsGrid');
  const noMsg = document.getElementById('noEventsMsg');
  const countEl = document.getElementById('eventCount');

  // If cache is empty and we just started, show skeletons
  if (!cache.events.length && state.searchTerm === '') {
    renderSkeletons(grid);
    return;
  }

  countEl.textContent = `${events.length} event${events.length!==1?'s':''}`;

  if (!events.length) { grid.innerHTML=''; noMsg.classList.remove('hidden'); return; }
  noMsg.classList.add('hidden');
  grid.innerHTML = events.map(ev => eventCardHTML(ev)).join('');

  grid.querySelectorAll('.event-card:not(.event-not-eligible)').forEach(card => {
    card.addEventListener('click', () => {
      const evId = card.dataset.evId;
      const ev = events.find(e => e.id===evId);
      if (ev) openBookingModal(ev);
    });
  });
}

function renderSkeletons(grid) {
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="event-card skeleton-card">
      <div class="event-banner skeleton" style="height:110px"></div>
      <div class="event-body">
        <div class="skeleton skeleton-text" style="width:40%"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="event-meta">
          <div class="skeleton skeleton-text" style="width:70%"></div>
          <div class="skeleton skeleton-text" style="width:50%"></div>
        </div>
        <div class="event-foot" style="border:none">
          <div class="skeleton skeleton-text" style="width:30%"></div>
          <div class="skeleton skeleton-btn"></div>
        </div>
      </div>
    </div>
  `).join('');
}

function eventCardHTML(ev) {
  const auds = get(SK.AUDITORIUMS, []);
  const aud = auds.find(a => a.id === ev.auditoriumId);
  const seats = cache.allSeats[ev.id] || [];
  const totalSeats = aud ? aud.capacity : 0;
  const bookedSeats = seats.filter(Boolean).length;
  const availableSeats = totalSeats - bookedSeats;
  const pct = totalSeats ? availableSeats/totalSeats : 1;

  const ud = state.currentUserData;
  const isSameCollege = ud && ud.college && ev.college.toLowerCase() === ud.college.toLowerCase();
  const isStudent = ud && ud.role === 'student';
  // Check if this student already has a booking specifically for THIS event
  const alreadyBooked = isStudent && cache.myBookings && cache.myBookings.some(b => b.eventId === ev.id);

  const dotClass = pct > 0.5 ? 'dot-green' : pct > 0.2 ? 'dot-yellow' : 'dot-red';
  const availLabel = pct > 0.5 ? 'Available' : pct > 0.2 ? 'Filling fast' : pct > 0 ? 'Almost full' : 'Sold out';

  let priceLabel, priceClass;
  if (!isStudent) {
    priceLabel = ev.price === 0 ? '🆓 Free' : `₹${ev.price}`;
    priceClass = ev.price === 0 ? 'price-free' : 'price-paid';
  } else if (isSameCollege) {
    priceLabel = '🆓 Free (your college)';
    priceClass = 'price-free';
  } else {
    priceLabel = ev.price === 0 ? '🆓 Free' : `₹${ev.price} (external)`;
    priceClass = ev.price === 0 ? 'price-free' : 'price-paid';
  }

  const bgGradient = `linear-gradient(135deg, ${ev.color}33 0%, ${ev.color}11 50%, #111118 100%)`;

  let footerAction = '';
  if (alreadyBooked) {
    footerAction = `<span style="font-size:0.75rem;color:var(--green);font-weight:600;">✓ Booked</span>`;
  } else if (availableSeats <= 0) {
    // FUTURE-04: Waitlist — check if already in queue
    const myWL = cache.myWaitlist || [];
    const wlEntry = myWL.find(w => w.eventId === ev.id);
    if (wlEntry) {
      footerAction = `<span style="font-size:0.75rem;color:var(--orange);font-weight:600;">📋 In Queue #${wlEntry.position}</span>`;
    } else {
      footerAction = `<button class="btn-secondary" style="font-size:0.78rem;padding:7px 14px;border-color:var(--orange);color:var(--orange);" onclick="joinWaitlist('${ev.id}','${escH(ev.title)}',event)">📋 Join Waitlist</button>`;
    }
  } else {
    footerAction = `<button class="btn-primary" style="font-size:0.8rem;padding:8px 16px;">Book Seat →</button>`;
  }

  return `
    <div class="event-card" data-ev-id="${ev.id}">
      <div class="event-banner" style="background:${bgGradient}">
        <div></div>
        <span class="event-category-badge">${CATEGORIES[ev.category]||ev.category}</span>
        <span class="event-price-badge ${priceClass}">${priceLabel}</span>
      </div>
      <div class="event-body">
        <div>
          <div class="event-college-tag">🏛 ${escH(ev.college)}</div>
          <div class="event-title" style="margin-top:8px">${escH(ev.title)}</div>
        </div>
        <div class="event-meta">
          <div class="event-meta-item">📅 ${formatDate(ev.date)} · ${ev.time}–${addHours(ev.time,ev.duration)}</div>
          <div class="event-meta-item">🎪 ${escH(aud?.name||'TBA')} · ${escH(aud?.city||'')}</div>
          <div class="event-meta-item">⏱ ${ev.duration} hour${ev.duration!==1?'s':''}</div>
        </div>
        <p class="event-desc">${escH(ev.description||'')}</p>
        <div class="event-foot">
          <span class="event-availability">
            <span class="availability-dot ${dotClass}"></span>
            ${availableSeats} seats · ${availLabel}
          </span>
          ${footerAction}
        </div>
      </div>
    </div>`;
}

// ===== BOOKING MODAL =====
async function openBookingModal(ev) {
  state.bookingContext = { event: ev, auditorium: null, seat: null };
  document.getElementById('modalTitle').textContent = ev.title;
  const auds = get(SK.AUDITORIUMS, []);
  const aud = auds.find(a => a.id === ev.auditoriumId);
  document.getElementById('modalMeta').textContent = `${ev.college} · ${formatDate(ev.date)} at ${ev.time}`;

  document.getElementById('modalStep1').classList.remove('hidden');
  document.getElementById('modalStep2').classList.add('hidden');
  document.getElementById('bookingModal').classList.remove('hidden');

  if (aud) {
    state.bookingContext.auditorium = aud;
    document.getElementById('modalStep1').classList.add('hidden');
    await renderSeatMap(aud, ev);
    document.getElementById('modalStep2').classList.remove('hidden');
  } else {
    renderAuditoriumCards(ev);
  }
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.add('hidden');
  state.bookingContext = { event:null, auditorium:null, seat:null };
}

function renderAuditoriumCards(ev) {
  const auds = get(SK.AUDITORIUMS, []).filter(a => a.id === ev.auditoriumId);
  const bkgs_aud = {seats: cache.allSeats};
  const html = auds.map(a => {
    const seats = bkgs_aud.seats[ev.id] || Array(a.capacity).fill(false);
    const avail = seats.filter(s=>!s).length;
    return `<div class="aud-card" onclick="selectAuditorium('${a.id}')">
      <div class="aud-card-name">🎪 ${escH(a.name)}</div>
      <div class="aud-card-meta">🏛 ${escH(a.college)}<br>📍 ${escH(a.city)}<br>💺 Capacity: ${a.capacity}</div>
      <div class="aud-card-avail">✅ ${avail} seats available</div>
    </div>`;
  }).join('');
  document.getElementById('auditoriumCards').innerHTML = html || '<p style="color:var(--text-muted)">No auditoriums available.</p>';
}

async function selectAuditorium(audId) {
  const auds = get(SK.AUDITORIUMS, []);
  const aud = auds.find(a => a.id === audId);
  if (!aud) return;
  state.bookingContext.auditorium = aud;
  document.getElementById('modalStep1').classList.add('hidden');
  await renderSeatMap(aud, state.bookingContext.event);
  document.getElementById('modalStep2').classList.remove('hidden');
}

async function renderSeatMap(aud, ev) {
  const seatData = await api.getSeats(ev.id);
  const seats = seatData.seats || [];
  const cap = aud.capacity;

  const alloc = defaultSeatAlloc(cap);
  const teacherCount = aud.teacherSeats ?? alloc.teacherSeats;
  const girlCount    = aud.girlSeats    ?? alloc.girlSeats;
  const boyCount     = cap - teacherCount - girlCount;
  const femaleEnd    = teacherCount + girlCount;

  const ud = state.currentUserData;
  const isStudent = ud && ud.role === 'student';
  const isSameCollege = isStudent && ud.college && ev.college.toLowerCase() === (ud.college||'').toLowerCase();
  const isExternalStudent = isStudent && !isSameCollege;

  let minSeat=1, maxSeat=cap;
  if (isStudent) {
    if (ud.gender === 'F') { minSeat = teacherCount+1; maxSeat = femaleEnd; }
    else { minSeat = femaleEnd+1; maxSeat = cap; }
  } else if (ud && ud.role === 'teacher' && !state.isAdmin) {
    minSeat = 1; maxSeat = teacherCount;
  }

  document.getElementById('sumEvent').textContent = ev.title;
  document.getElementById('sumAud').textContent = aud.name;
  document.getElementById('sumDate').textContent = formatDate(ev.date);
  document.getElementById('sumTime').textContent = `${ev.time} – ${addHours(ev.time, ev.duration)}`;
  document.getElementById('sumSeatRow').style.display = 'none';

  const price = isExternalStudent ? ev.price : 0;
  document.getElementById('sumPrice').textContent = price === 0 ? '🆓 Free' : `₹${price}`;
  document.getElementById('sumPriceRow').style.display = '';

  if (isStudent) {
    const priceSuffix = isSameCollege ? ' · 🆓 Free (your college event)' : (ev.price > 0 ? ' · Payment required (external)' : '');
    document.getElementById('sectionInfo').textContent = `Your section: Seats ${minSeat}–${maxSeat} (${ud.gender==='F'?'Girls':'Boys'} Section)${priceSuffix}`;
  } else if (!state.isAdmin && ud?.role==='teacher') {
    document.getElementById('sectionInfo').textContent = `Teacher section: Seats 1–${teacherCount}`;
  } else {
    document.getElementById('sectionInfo').textContent = `Admin: Full access to all seats`;
  }

  document.getElementById('confirmBtn').disabled = true;
  document.getElementById('confirmBtn').textContent = 'Select a seat to continue';
  state.bookingContext.seat = null;

  const container = document.getElementById('seatMapContainer');
  container.innerHTML = '';

  const sections = [
    { label: ` TEACHER SECTION · Seats 1–${teacherCount} (${teacherCount} seats)`, from:1, to:teacherCount, seatClass:'seat-teacher' },
    { label: ` FEMALE STUDENT SECTION · Seats ${teacherCount+1}–${femaleEnd} (${girlCount} seats)`, from:teacherCount+1, to:femaleEnd, seatClass:'seat-girl' },
    { label: ` MALE STUDENT SECTION · Seats ${femaleEnd+1}–${cap} (${boyCount} seats)`, from:femaleEnd+1, to:cap, seatClass:'seat-boy' },
  ];

  sections.forEach(sec => {
    if (sec.from > sec.to) return;
    const secDiv = document.createElement('div');
    const labelDiv = document.createElement('div');
    labelDiv.className = 'seat-section-label';
    labelDiv.textContent = sec.label;
    secDiv.appendChild(labelDiv);

    const seatsPerRow = sec.seatClass === 'seat-teacher' ? 10 : 12;
    let s = sec.from;
    let rowNum = 1;
    while (s <= sec.to) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'seat-row';
      const rowLbl = document.createElement('span');
      rowLbl.className = 'seat-row-label';
      rowLbl.textContent = String.fromCharCode(64+rowNum);
      rowDiv.appendChild(rowLbl);
      const seatsDiv = document.createElement('div');
      seatsDiv.className = 'seats-in-row';

      let colInRow = 0;
      while (s <= sec.to && colInRow < seatsPerRow) {
        if (colInRow === 4 || (seatsPerRow === 12 && colInRow === 8)) {
          const aisle = document.createElement('div'); aisle.className='seat-aisle'; seatsDiv.appendChild(aisle);
        }
        const seatDiv = document.createElement('div');
        seatDiv.className = 'seat';
        seatDiv.textContent = s;
        seatDiv.dataset.seatNum = s;

        if (seats[s-1]) {
          seatDiv.classList.add('seat-booked');
          seatDiv.title = 'Already booked';
        } else {
          seatDiv.classList.add(sec.seatClass);
          const canSelect = state.isAdmin || (s >= minSeat && s <= maxSeat);
          if (canSelect) {
            seatDiv.classList.add('seat-selectable');
            const seatNum = s;
            seatDiv.addEventListener('click', () => selectSeat(seatNum, seatDiv));
          } else {
            seatDiv.classList.add('seat-dim');
            seatDiv.title = `Not in your section`;
          }
        }
        seatsDiv.appendChild(seatDiv);
        s++; colInRow++;
      }
      rowDiv.appendChild(seatsDiv);
      secDiv.appendChild(rowDiv);
      rowNum++;
    }
    container.appendChild(secDiv);
  });

  if (window.seatPanzoomInstance) {
    window.seatPanzoomInstance.destroy();
  }
  
  if (typeof Panzoom !== 'undefined') {
    const viewport = document.querySelector('.seat-map-viewport');
    window.seatPanzoomInstance = Panzoom(container, {
      maxScale: 3,
      minScale: 0.3,
      step: 0.3
    });
    
    // Add wheel listener for mouse zooming
    viewport.addEventListener('wheel', window.seatPanzoomInstance.zoomWithWheel);
    
    // Wire up buttons
    document.getElementById('zoomInBtn').onclick = () => window.seatPanzoomInstance.zoomIn();
    document.getElementById('zoomOutBtn').onclick = () => window.seatPanzoomInstance.zoomOut();
    document.getElementById('zoomResetBtn').onclick = () => window.seatPanzoomInstance.reset();
  }
}

function selectSeat(num, el) {
  document.querySelectorAll('.seat.seat-selected').forEach(s => s.classList.remove('seat-selected'));
  el.classList.add('seat-selected');
  state.bookingContext.seat = num;

  document.getElementById('sumSeat').textContent = `Seat #${num}`;
  document.getElementById('sumSeatRow').style.display = '';

  document.getElementById('confirmBtn').disabled = false;
  document.getElementById('confirmBtn').textContent = `Confirm Seat ${num} →`;
}

async function confirmBooking() {
  const { event, auditorium, seat } = state.bookingContext;
  if (!seat) { toast('Please select a seat first','error'); return; }

  const ud = state.currentUserData;
  const isSameCollege = event.college.toLowerCase() === (ud.college||'').toLowerCase();
  const price = (ud.role==='student' && !isSameCollege) ? event.price : 0;

  // Disable confirm button while locking
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Checking seat...';

  try {
    // Try to lock the seat on the server first
    await api.lockSeat(event.id, seat);
  } catch(e) {
    // Seat already taken or locked by someone else
    toast(e.message || 'Seat unavailable. Please select another.', 'error');
    btn.disabled = false;
    btn.textContent = `Confirm Seat ${seat} →`;
    // Refresh the seat map so this seat appears booked
    await renderSeatMap(auditorium, event);
    return;
  }

  if (price > 0) {
    closeBookingModal();
    openPaymentModal(price, event, auditorium, seat);
  } else {
    // Free booking — finalize immediately, lock will be cleaned up by finalizeBooking
    await finalizeBooking(event, auditorium, seat, 0, null);
    closeBookingModal();
  }
}

// ===== PAYMENT (RAZORPAY) =====
let selectedPM = 'upi';

function openPaymentModal(price, event, auditorium, seat) {
  state.pendingPayment = { price, event, auditorium, seat };
  selectedPM = 'upi';
  document.getElementById('payAmount').textContent = `₹${price}`;
  document.getElementById('payNowBtn').querySelector('#payBtnText').textContent = `Pay ₹${price} via UPI`;
  document.getElementById('payNowBtn').disabled = false;
  document.getElementById('paymentModal').classList.remove('hidden');
  // Reset selection
  document.querySelectorAll('.pm-option').forEach((o, i) => {
    o.classList.toggle('selected', i === 0);
  });
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
  // Release the seat lock when user closes/cancels the payment modal
  if (state.pendingPayment) {
    api.unlockSeat(state.pendingPayment.event.id).catch(() => {});
  }
  state.pendingPayment = null;
}

function selectPM(el, method) {
  selectedPM = method;
  document.querySelectorAll('.pm-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const price = state.pendingPayment?.price || 0;
  const labels = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet' };
  document.getElementById('payBtnText').textContent = `Pay ₹${price} via ${labels[method] || 'Razorpay'}`;
}

async function initiateRazorpayPayment() {
  const btn = document.getElementById('payNowBtn');
  const btnTxt = document.getElementById('payBtnText');
  const { price, event, auditorium, seat } = state.pendingPayment;

  btnTxt.innerHTML = '<span class="spinner"></span> Creating order...';
  btn.disabled = true;

  try {
    // Step 1: Create order on backend
    const order = await api.createPaymentOrder({
      amount: price,
      eventTitle: event.title,
      eventId: event.id,
      seat: seat
    });

    // Map selected method to Razorpay's method config
    const methodConfig = {
      upi: { netbanking: false, card: false, upi: true, wallet: false },
      card: { netbanking: false, card: true, upi: false, wallet: false },
      netbanking: { netbanking: true, card: false, upi: false, wallet: false },
      wallet: { netbanking: false, card: false, upi: false, wallet: true }
    };

    // Step 2: Open Razorpay checkout popup with selected method
    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'AuditoriaX',
      description: `${event.title} — Seat #${seat}`,
      theme: { color: '#6c63ff' },
      prefill: {
        email: state.currentUser,
        contact: '',
        method: selectedPM === 'netbanking' ? 'netbanking' : selectedPM
      },
      config: {
        display: {
          blocks: {
            selected: {
              name: selectedPM === 'upi' ? 'Pay via UPI' : selectedPM === 'card' ? 'Pay via Card' : selectedPM === 'netbanking' ? 'Pay via Net Banking' : 'Pay via Wallet',
              instruments: [{ method: selectedPM === 'netbanking' ? 'netbanking' : selectedPM }]
            },
            other: {
              name: 'Other Payment Methods',
              instruments: [
                { method: 'upi' },
                { method: 'card' },
                { method: 'netbanking' },
                { method: 'wallet' }
              ]
            }
          },
          sequence: ['block.selected', 'block.other'],
          preferences: { show_default_blocks: false }
        }
      },
      handler: async function(response) {
        // Step 3: Verify payment on backend + record platform fee
        btnTxt.innerHTML = '<span class="spinner"></span> Verifying...';
        try {
          const verification = await api.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            // FUTURE-02: needed for platform revenue recording
            eventId:    event.id,
            seat:       seat,
            eventTitle: event.title,
            totalAmount: price,
            bookingId:  `${event.id}_${seat}_${Date.now()}`
          });

          if (verification.verified) {
            closePaymentModal();
            await finalizeBooking(event, auditorium, seat, price, verification.paymentId);
            toast('Payment successful! 🎉', 'success');
          }
        } catch(e) {
          toast('Payment verification failed: ' + (e.message || 'Unknown error'), 'error');
          btn.disabled = false;
          btnTxt.textContent = `Pay ₹${price} via ${selectedPM.toUpperCase()}`;
        }
      },
      modal: {
        ondismiss: function() {
          btn.disabled = false;
          const labels = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet' };
          btnTxt.textContent = `Pay ₹${price} via ${labels[selectedPM] || 'Razorpay'}`;
          // Release seat lock on payment dismiss
          api.unlockSeat(event.id).catch(() => {});
          toast('Payment cancelled — seat unlocked', 'info');
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
      toast('Payment failed: ' + (response.error.description || 'Please try again'), 'error');
      btn.disabled = false;
      const labels = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet' };
      btnTxt.textContent = `Pay ₹${price} via ${labels[selectedPM] || 'Razorpay'}`;
      // Release seat lock on payment failure too
      api.unlockSeat(event.id).catch(() => {});
    });
    rzp.open();

  } catch(e) {
    toast('Failed to create payment order: ' + (e.message || 'Server error'), 'error');
    btn.disabled = false;
    const labels = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', wallet: 'Wallet' };
    btnTxt.textContent = `Pay ₹${price} via ${labels[selectedPM] || 'Razorpay'}`;
  }
}

// ===== FINALIZE BOOKING =====
async function finalizeBooking(event, auditorium, seat, price, txId) {
  const ud = state.currentUserData;
  try {
    const booking = await api.createBooking({
      userEmail: state.currentUser,
      userRole: ud.role === 'student' ? 'student' : (state.isAdmin ? 'admin' : 'teacher'),
      eventId: event.id,
      eventTitle: event.title,
      auditoriumId: auditorium.id,
      auditoriumName: auditorium.name,
      eventCollege: event.college,
      date: event.date,
      time: event.time,
      seat, price: price || 0,
      txId: txId || null,
      category: event.category,
      color: event.color
    });
    await loadCache();
    await loadMyBookings();
    showTicketModal(booking, auditorium);
  } catch(e) {
    toast(e.message || 'Booking failed','error');
    await renderSeatMap(auditorium, event);
  }
}

// ===== TICKET =====
function showTicketModal(booking, aud) {
  document.getElementById('ticketSubtitle').textContent = `Your ticket for ${booking.eventTitle} is confirmed`;
  document.getElementById('tEvent').textContent = booking.eventTitle;
  document.getElementById('tVenue').textContent = booking.auditoriumName;
  document.getElementById('tDateTime').textContent = `${formatDate(booking.date)} · ${booking.time}`;
  document.getElementById('tSeat').textContent = `#${booking.seat}`;
  document.getElementById('tId').textContent = booking.id;

  const amountRow = document.getElementById('tAmountRow');
  if (booking.price > 0) {
    document.getElementById('tAmount').textContent = `₹${booking.price} · ${booking.txId}`;
    amountRow.style.display='';
  } else {
    amountRow.style.display='none';
  }

  const bc = document.getElementById('barcodeLines');
  bc.innerHTML = '';
  for (let i=0; i<50; i++) {
    const s=document.createElement('span');
    const w = [1,2,3,4][Math.floor(Math.random()*4)];
    s.style.cssText = `width:${w}px;height:${Math.random()>0.3?50:30}px;background:var(--text-primary);flex-shrink:0`;
    bc.appendChild(s);
  }
  // Call the pro-level QR generation function
  if (typeof generateQR === 'function') {
    generateQR(booking.id);
  }
  
  const viewBookingsBtn = document.querySelector('.ticket-actions .btn-primary');
  if (viewBookingsBtn) {
    if (document.getElementById('myBookingsPane').classList.contains('active')) {
      viewBookingsBtn.textContent = 'Close Ticket';
    } else {
      viewBookingsBtn.textContent = 'View My Bookings';
    }
  }

  document.getElementById('ticketModal').classList.remove('hidden');
}

function closeTicketModal() {
  document.getElementById('ticketModal').classList.add('hidden');
  renderEvents();
}

// ===== MY BOOKINGS =====
async function renderMyBookings() {
  await loadMyBookings();
  const ud = state.currentUserData;
  const container = document.getElementById('bookingsContainer');

  let myBookings = cache.myBookings || [];


  if (!myBookings.length) {
    container.innerHTML = `<div class="no-bookings-msg">
      <div style="font-size:3rem;margin-bottom:16px">🎟️</div>
      <h4 style="font-size:1.2rem;color:var(--text-secondary);margin-bottom:8px">No bookings yet</h4>
      <p>Browse events and book your first seat!</p>
      <br><a onclick="switchMainTab('explore')">→ Explore Events</a>
    </div>`;
    return;
  }

  container.innerHTML = myBookings.map(b => bookingTicketHTML(b)).join('');
  container.querySelectorAll('.cancel-booking-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelBooking(btn.dataset.id);
    });
  });
  container.querySelectorAll('.show-qr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bId = btn.dataset.id;
      const b = cache.myBookings.find(x => x.id === bId);
      if (b) {
        showTicketModal(b);
        document.getElementById('ticketSubtitle').textContent = 'Ticket Details';
      }
    });
  });
}

function bookingTicketHTML(b) {
  const color = b.color || '#5b8dee';
  const cat = CATEGORIES[b.category] || '📌';
  return `<div class="booking-ticket">
    <div class="booking-ticket-accent" style="background:${color}"></div>
    <div class="booking-ticket-body">
      <div class="booking-ticket-top">
        <div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">${cat}</div>
          <div class="booking-ticket-title">${escH(b.eventTitle)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">🏛 ${escH(b.eventCollege||'')} · 🎪 ${escH(b.auditoriumName)}</div>
        </div>
        <span class="booking-ticket-status">✓ Confirmed</span>
      </div>
      <div class="booking-ticket-grid">
        <div class="bt-item"><div class="bt-label">Date</div><div class="bt-value">${formatDate(b.date)}</div></div>
        <div class="bt-item"><div class="bt-label">Time</div><div class="bt-value">${b.time}</div></div>
        <div class="bt-item"><div class="bt-label">Seat</div><div class="bt-value" style="color:${color};font-size:1.1rem">#${b.seat}</div></div>
        <div class="bt-item"><div class="bt-label">Amount</div><div class="bt-value">${b.price>0?`₹${b.price}`:'Free'}</div></div>
      </div>
      <div class="booking-ticket-foot">
        <span class="ticket-id-display">🎟 ${b.id}</span>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary show-qr-btn" data-id="${b.id}" style="padding:6px 14px;font-size:0.78rem">Show QR</button>
          <button class="btn-danger cancel-booking-btn" data-id="${b.id}" style="padding:6px 14px;font-size:0.78rem">Cancel</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function cancelBooking(bookingId) {
  if (!confirm('Cancel this booking? This cannot be undone.')) return;
  try {
    const result = await api.cancelMyBooking(bookingId);
    await loadCache();
    toast(result.message || 'Booking cancelled','success');
    await renderMyBookings();
  } catch(e) { toast(e.message || 'Cancel failed','error'); }
}

// ===== PROFILE =====
function renderProfile() {
  const ud = state.currentUserData;
  const initials = ud.email.split('@')[0].slice(0,2).toUpperCase();

  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = ud.email.split('@')[0];
  document.getElementById('profileRoleTag').textContent = state.isAdmin ? ' Admin' : ud.role === 'student' ? ` Student` : ' Teacher';
  document.getElementById('profileCollegeName').textContent = ud.college || '';
  document.getElementById('pEmail').textContent = ud.email;
  document.getElementById('pCollege').textContent = ud.college || '—';
  document.getElementById('pSince').textContent = new Date(ud.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});

  const isKLH = ud.role === 'student' && ud.email && ud.email.endsWith('@klh.edu.in');

  const cooldownMs = isKLH ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const cooldownLabel = isKLH ? '3 months' : '1 month';

  // Gender is always shown (read-only, set at signup)
  document.getElementById('pGenderRow').classList.remove('hidden');
  document.getElementById('pGender').textContent = ud.gender === 'F' ? 'Female' : 'Male';

  if (ud.role === 'student') {
    document.getElementById('editStudentSection').style.display = 'block';

    // Show locked gender in edit section
    const genderLockedEl = document.getElementById('pGenderLocked');
    genderLockedEl.innerHTML = `${ud.gender === 'F' ? 'Female' : 'Male'} <span style="color:var(--text-muted);font-size:0.75rem">🔒 Permanent</span>`;

    if (isKLH) {
      document.getElementById('pClusterRow').classList.remove('hidden');
      document.getElementById('pCluster').textContent = `Cluster ${ud.cluster}`;
      document.getElementById('editClusterRow').style.display = '';
      document.getElementById('editCluster').value = ud.cluster || '1';

      // Cluster cooldown logic
      const lastChange = ud.lastProfileChange ? new Date(ud.lastProfileChange) : null;
      const now = new Date();
      const inCooldown = lastChange && (now - lastChange) < cooldownMs;
      const editCluster = document.getElementById('editCluster');
      const saveBtn = document.getElementById('saveProfileBtn');
      let notice = document.getElementById('profileCooldownNotice');

      if (inCooldown) {
        const nextChangeDate = new Date(lastChange.getTime() + cooldownMs);
        const daysLeft = Math.ceil((nextChangeDate - now) / (24 * 60 * 60 * 1000));
        editCluster.disabled = true;
        if (saveBtn) saveBtn.disabled = true;
        if (!notice) {
          notice = document.createElement('p');
          notice.id = 'profileCooldownNotice';
          notice.style.cssText = 'color:#f59e0b;font-size:0.8rem;margin-top:10px;line-height:1.5';
          document.getElementById('editStudentSection').appendChild(notice);
        }
        notice.textContent = `🔒 Cluster locked · Next edit in ${daysLeft} day${daysLeft!==1?'s':''} (${cooldownLabel} cooldown · unlocks ${nextChangeDate.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})})`;
      } else {
        editCluster.disabled = false;
        if (saveBtn) saveBtn.disabled = false;
        if (notice) notice.remove();
      }
    } else {
      document.getElementById('pClusterRow').classList.add('hidden');
      document.getElementById('editClusterRow').style.display = 'none';
      // Non-KLH students: hide save button if nothing to edit
      document.getElementById('saveProfileBtn').style.display = 'none';
    }
  } else {
    // Teachers/admins
    document.getElementById('pClusterRow').classList.add('hidden');
    document.getElementById('editStudentSection').style.display = 'none';
  }
}

async function saveStudentInfo() {
  const ud = state.currentUserData;
  const c = document.getElementById('editCluster')?.value;

  try {
    const updated = await api.updateProfile({ gender: ud.gender, cluster: c });
    state.currentUserData = updated;
    const isKLH = updated.email && updated.email.endsWith('@klh.edu.in');
    if (isKLH) {
      document.getElementById('navRoleBadge').textContent = `Student · C${updated.cluster}`;
    }
    const cooldownLabel = isKLH ? '3 months' : '1 month';
    toast('Cluster updated! Next edit available in ' + cooldownLabel + '.', 'success');
    renderProfile();
  } catch(e) { toast(e.message || 'Update failed','error'); }
}

function toggleChangePw() {
  document.getElementById('changePwForm').classList.toggle('hidden');
}

async function handleChangePw() {
  const cur = document.getElementById('curPw').value;
  const nw = document.getElementById('newPw').value;
  const cf = document.getElementById('confirmPw').value;
  if (!cur || !nw || !cf) { toast('Fill all fields','error'); return; }
  if (nw.length < 6) { toast('New password too short','error'); return; }
  if (nw !== cf) { toast('Passwords do not match','error'); return; }

  try {
    await api.changePassword(cur, nw);
    toast('Password updated!','success');
    document.getElementById('changePwForm').classList.add('hidden');
    document.getElementById('curPw').value='';document.getElementById('newPw').value='';document.getElementById('confirmPw').value='';
  } catch(e) { toast(e.message || 'Password change failed','error'); }
}

// ===== ADMIN PANEL =====
async function renderAdminPanel() {
  await loadCache();
  await loadAllBookings();
  renderAudListAdmin();
  renderEventsAdmin();
  renderBookingsAdmin();
  populateAuditoriumSelect();
  renderAnalytics();
}


// ===== EVENT ANALYTICS (FUTURE-11: Chart.js Real Charts) =====

// Store chart instances so we can destroy before re-rendering (prevents memory leaks)
const _charts = {};
function _destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function renderAnalytics() {
  const evts = cache.events;
  const allSeats = cache.allSeats;
  const auds = cache.auditoriums;

  // ─── Compute totals ──────────────────────────────────────────────────────
  let totalRev = 0, totalBkgs = 0, totalCap = 0;
  const byCat = {}, byMonthLabel = {}, byAud = {}, revMap = {}, byDow = { Sun:0, Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0 };
  const MONTHS_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  evts.forEach(e => {
    const aud  = auds.find(a => a.id === e.auditoriumId);
    const cap  = aud ? aud.capacity : 0;
    const seats = allSeats[e.id] || [];
    const bCount = seats.filter(Boolean).length;

    totalBkgs += bCount;
    totalCap  += cap;
    totalRev  += bCount * (e.price || 0);

    const cat = e.category || 'other';
    byCat[cat] = (byCat[cat] || 0) + 1;

    const d = new Date(e.date);
    if (!isNaN(d)) {
      const mo = d.toLocaleString('default', { month: 'short' });
      byMonthLabel[mo] = (byMonthLabel[mo] || 0) + bCount;
      const dow = DAYS[d.getDay()];
      byDow[dow] += bCount;
    }

    if (aud) {
      if (!byAud[aud.name]) byAud[aud.name] = { b: 0, c: 0 };
      byAud[aud.name].b += bCount;
      byAud[aud.name].c += cap;
    }
    revMap[e.title] = (revMap[e.title] || 0) + bCount * (e.price || 0);
  });

  // ─── KPI Row ─────────────────────────────────────────────────────────────
  const occupancyPct = totalCap ? Math.round((totalBkgs / totalCap) * 100) : 0;
  document.getElementById('analyticsKPIRow').innerHTML = `
    <div class="analytics-kpi"><div class="kpi-val">${evts.length}</div><div class="kpi-lbl">Total Events</div></div>
    <div class="analytics-kpi"><div class="kpi-val">${totalBkgs}</div><div class="kpi-lbl">Total Bookings</div></div>
    <div class="analytics-kpi"><div class="kpi-val">${occupancyPct}%</div><div class="kpi-lbl">Avg. Occupancy</div></div>
    <div class="analytics-kpi"><div class="kpi-val">₹${totalRev.toLocaleString('en-IN')}</div><div class="kpi-lbl">Total Revenue</div></div>
  `;

  // ─── Chart defaults ───────────────────────────────────────────────────────
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet — retrying in 300ms');
    setTimeout(renderAnalytics, 300);
    return;
  }
  Chart.defaults.color = '#9AA0B8';
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.tooltip.padding = 10;

  const gridColor = 'rgba(255,255,255,0.06)';

  // ─── CHART 1: Events by Category (Doughnut) ───────────────────────────────
  _destroyChart('chartCategory');
  const catLabels = Object.keys(byCat);
  const catColors = ['#F84464','#2B8DE3','#2DC492','#FF9900','#a855f7','#E84C88'];
  _charts['chartCategory'] = new Chart(document.getElementById('chartCategory'), {
    type: 'doughnut',
    data: {
      labels: catLabels.map(c => ({ tech:'Tech', cultural:'Cultural', lecture:'Lecture', sports:'Sports', other:'Other' }[c] || c)),
      datasets: [{ data: catLabels.map(k => byCat[k]), backgroundColor: catColors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } } }
    }
  });

  // ─── CHART 2: Monthly Booking Trend (Line) ────────────────────────────────
  _destroyChart('chartMonthly');
  const monthlyOrdered = MONTHS_ORDER.filter(m => byMonthLabel[m]);
  _charts['chartMonthly'] = new Chart(document.getElementById('chartMonthly'), {
    type: 'line',
    data: {
      labels: monthlyOrdered,
      datasets: [{
        label: 'Bookings',
        data: monthlyOrdered.map(m => byMonthLabel[m] || 0),
        borderColor: '#2DC492',
        backgroundColor: 'rgba(45,196,146,0.12)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#2DC492',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: gridColor }, ticks: { font: { size: 11 } } },
        y: { grid: { color: gridColor }, beginAtZero: true, ticks: { font: { size: 11 }, precision: 0 } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // ─── CHART 3: Venue Occupancy % (Horizontal Bar) ─────────────────────────
  _destroyChart('chartOccupancy');
  const audNames = Object.keys(byAud);
  const occVals  = audNames.map(k => Math.round((byAud[k].b / Math.max(byAud[k].c, 1)) * 100));
  _charts['chartOccupancy'] = new Chart(document.getElementById('chartOccupancy'), {
    type: 'bar',
    data: {
      labels: audNames.map(n => n.length > 16 ? n.slice(0,14)+'…' : n),
      datasets: [{
        label: 'Occupancy %',
        data: occVals,
        backgroundColor: occVals.map(v => v >= 80 ? '#F84464' : v >= 50 ? '#FF9900' : '#2B8DE3'),
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: gridColor }, min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% occupancy` } } }
    }
  });

  // ─── CHART 4: Revenue by Event Top 5 (Bar) ───────────────────────────────
  _destroyChart('chartRevenue');
  const topRevEntries = Object.entries(revMap).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).slice(0,5);
  _charts['chartRevenue'] = new Chart(document.getElementById('chartRevenue'), {
    type: 'bar',
    data: {
      labels: topRevEntries.map(([k]) => k.length > 14 ? k.slice(0,12)+'…' : k),
      datasets: [{
        label: 'Revenue (₹)',
        data: topRevEntries.map(([,v]) => v),
        backgroundColor: 'rgba(248,68,100,0.7)',
        borderColor: '#F84464',
        borderWidth: 1.5,
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: gridColor }, beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN'), font: { size: 10 } } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // ─── CHART 5: Bookings by Day of Week (Polar Area) ────────────────────────
  _destroyChart('chartDayOfWeek');
  _charts['chartDayOfWeek'] = new Chart(document.getElementById('chartDayOfWeek'), {
    type: 'polarArea',
    data: {
      labels: DAYS,
      datasets: [{
        data: DAYS.map(d => byDow[d]),
        backgroundColor: ['rgba(248,68,100,0.7)','rgba(43,141,227,0.7)','rgba(45,196,146,0.7)','rgba(255,153,0,0.7)','rgba(168,85,247,0.7)','rgba(232,76,136,0.7)','rgba(100,116,139,0.7)'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { grid: { color: gridColor }, ticks: { display: false }, pointLabels: { font: { size: 11 }, color: '#9AA0B8' } } },
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 12 } } }
    }
  });

  // ─── Top Events Table ─────────────────────────────────────────────────────
  const topEvts = evts
    .map(e => ({ t: e.title, d: e.date, b: (allSeats[e.id]||[]).filter(Boolean).length, rev: (allSeats[e.id]||[]).filter(Boolean).length * (e.price||0) }))
    .sort((a,b) => b.b - a.b).slice(0, 8);

  let tbl = `<table style="width:100%;text-align:left;font-size:0.83rem;border-collapse:collapse">
    <thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
      <th style="padding:8px 6px">#</th>
      <th style="padding:8px 6px">Event</th>
      <th style="padding:8px 6px">Date</th>
      <th style="padding:8px 6px">Bookings</th>
      <th style="padding:8px 6px">Revenue</th>
    </tr></thead><tbody>`;
  topEvts.forEach((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1) + '.';
    tbl += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:8px 6px;color:var(--text-muted)">${medal}</td>
      <td style="padding:8px 6px;font-weight:600;color:var(--text-primary)">${escH(t.t)}</td>
      <td style="padding:8px 6px;color:var(--text-muted)">${formatDate(t.d)}</td>
      <td style="padding:8px 6px;color:var(--green);font-weight:700">${t.b}</td>
      <td style="padding:8px 6px;color:var(--accent)">₹${t.rev.toLocaleString('en-IN')}</td>
    </tr>`;
  });
  tbl += '</tbody></table>';
  document.getElementById('analyticsTopEventsTable').innerHTML = tbl;
}

// ===== ADMIN SEAT ALLOCATION HELPERS =====
function onAudCapacityInput() {
  const cap = parseInt(document.getElementById('aCapacity').value) || 0;
  const alloc = defaultSeatAlloc(Math.max(cap, 0));
  document.getElementById('aTeacherSeats').value = alloc.teacherSeats;
  document.getElementById('aGirlSeats').value    = alloc.girlSeats;
  document.getElementById('aBoySeats').value     = alloc.boySeats;
  onSeatAllocInput();
}

function onSeatAllocInput() {
  const cap     = parseInt(document.getElementById('aCapacity').value)     || 0;
  const teacher = parseInt(document.getElementById('aTeacherSeats').value) || 0;
  const girl    = parseInt(document.getElementById('aGirlSeats').value)    || 0;
  const boy     = parseInt(document.getElementById('aBoySeats').value)     || 0;
  const total   = teacher + girl + boy;

  document.getElementById('seatAllocTotal').textContent = total;
  document.getElementById('seatAllocCap').textContent   = cap;
  const pct = cap > 0 ? Math.min((total / cap) * 100, 100) : 0;
  const fill = document.getElementById('seatAllocFill');
  const msg  = document.getElementById('seatAllocMsg');
  fill.style.width = pct + '%';
  if (total === cap) {
    fill.style.background = 'var(--green)'; msg.style.color = 'var(--green)';
    msg.textContent = '✓ Allocation matches capacity';
  } else if (total > cap) {
    fill.style.background = '#ef4444'; msg.style.color = '#ef4444';
    msg.textContent = `⚠ Over by ${total - cap} seat${total - cap !== 1 ? 's' : ''}`;
  } else {
    fill.style.background = '#f59e0b'; msg.style.color = '#f59e0b';
    msg.textContent = `⚠ ${cap - total} seat${cap - total !== 1 ? 's' : ''} unallocated`;
  }
}

async function addAuditorium() {
  const college  = document.getElementById('aCollege').value.trim();
  const name     = document.getElementById('aName').value.trim();
  const cap      = parseInt(document.getElementById('aCapacity').value);
  const city     = document.getElementById('aCity').value.trim();
  const fac      = document.getElementById('aFacilities').value.split(',').map(s=>s.trim()).filter(Boolean);
  const teacher  = parseInt(document.getElementById('aTeacherSeats').value) || 0;
  const girl     = parseInt(document.getElementById('aGirlSeats').value)    || 0;
  const boy      = parseInt(document.getElementById('aBoySeats').value)     || 0;

  if (!college || !name || !city) { toast('Fill all auditorium fields','error'); return; }
  if (isNaN(cap) || cap < 50 || cap > 1000) { toast('Capacity must be 50–1000','error'); return; }
  if (teacher + girl + boy !== cap) { toast(`Seat allocation must equal capacity`, 'error'); return; }

  try {
    await api.createAuditorium({ college, name, capacity:cap, city, facilities:fac, teacherSeats:teacher, girlSeats:girl, boySeats:boy });
    await loadCache();
    toast('Auditorium added!','success');
    document.getElementById('aCollege').value=''; document.getElementById('aName').value='';
    document.getElementById('aCapacity').value='200'; document.getElementById('aCity').value='';
    document.getElementById('aFacilities').value='';
    document.getElementById('aTeacherSeats').value='20';
    document.getElementById('aGirlSeats').value='80';
    document.getElementById('aBoySeats').value='100';
    onSeatAllocInput();
    renderAudListAdmin();
    populateAuditoriumSelect();
  } catch(e) { toast(e.message || 'Failed','error'); }
}

function renderAudListAdmin() {
  const auds = cache.auditoriums;
  const evts = cache.events;
  const allSeats = cache.allSeats;
  document.getElementById('audListAdmin').innerHTML = auds.map(a => {
    // Count booked seats across ALL events in this auditorium
    const audEvents = evts.filter(e => e.auditoriumId === a.id);
    let booked = 0;
    audEvents.forEach(e => { booked += (allSeats[e.id]||[]).filter(Boolean).length; });
    const t = a.teacherSeats ?? '—';
    const g = a.girlSeats    ?? '—';
    const b = a.boySeats     ?? '—';
    return `<div class="admin-list-item">
      <div class="admin-list-item-title">🎪 ${escH(a.name)}</div>
      <div class="admin-list-item-meta">🏛 ${escH(a.college)} · 📍 ${escH(a.city)} · 💺 ${a.capacity} seats · ${booked} booked</div>
      <div class="admin-list-item-meta" style="display:flex;gap:12px;margin-top:4px">
        <span title="Teacher seats"> ${t}</span>
        <span title="Girls seats"> ${g}</span>
        <span title="Boys seats"> ${b}</span>
      </div>
      ${a.facilities?.length ? `<div class="admin-list-item-meta">🔧 ${a.facilities.join(', ')}</div>` : ''}
      ${state.isSuper ? `<div class="admin-list-actions">
        <button class="admin-del-btn" onclick="deleteAuditorium('${a.id}')">Delete</button>
      </div>` : ''}
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">No auditoriums yet.</p>';
}

async function deleteAuditorium(id) {
  if (!confirm('Delete this auditorium? This also deletes all associated events and bookings.')) return;
  try {
    await api.deleteAuditorium(id);
    await loadCache();
    toast('Auditorium deleted','success');
    renderAudListAdmin();
    populateAuditoriumSelect();
  } catch(e) { toast(e.message || 'Delete failed','error'); }
}

function populateAuditoriumSelect() {
  const auds = get(SK.AUDITORIUMS, []);
  const sel = document.getElementById('evtAuditorium');
  if (!sel) return; // guard: element may not exist yet
  sel.innerHTML = '<option value="">Select Auditorium</option>' +
    auds.map(a => `<option value="${a.id}">${escH(a.name)} — ${escH(a.college)}</option>`).join('');
}

async function adminSubmitEvent() {
  const audId = document.getElementById('evtAuditorium').value;
  const title = document.getElementById('evtTitle').value.trim();
  const cat   = document.getElementById('evtCategory').value;
  const date  = document.getElementById('evtDate').value;
  const time  = document.getElementById('evtTime').value;
  const dur   = parseInt(document.getElementById('evtDuration').value) || 2;
  const price = parseInt(document.getElementById('evtPrice').value) || 0;
  const desc  = document.getElementById('evtDesc').value.trim();
  const color = document.getElementById('evtColor').value;

  if (!title) { toast('Please enter an event title','error'); return; }
  if (!audId) { toast('Please select an auditorium','error'); return; }
  if (!date)  { toast('Please select an event date','error'); return; }
  if (!time)  { toast('Please select an event time','error'); return; }

  try {
    await api.createEvent({ title, category:cat, auditoriumId:audId, date, time, duration:dur, price, color, description:desc, createdBy:state.currentUser });
    await loadCache();
    toast('🎉 Event published successfully!','success');
    document.getElementById('evtTitle').value='';
    document.getElementById('evtDate').value='';
    document.getElementById('evtTime').value='';
    document.getElementById('evtDesc').value='';
    document.getElementById('evtDuration').value='2';
    document.getElementById('evtPrice').value='0';
    document.getElementById('evtAuditorium').value='';
    document.getElementById('evtCategory').value='tech';
    document.getElementById('evtColor').value='#6c63ff';
    renderEventsAdmin();
    switchAdminTab('events');
  } catch(e) { toast(e.message || 'Event creation failed','error'); }
}

// ===== RENDER EVENTS ADMIN (FIXED: use event ID for delete, not array index) =====
function renderEventsAdmin() {
  const evts = cache.events;
  const auds = cache.auditoriums;
  const allSeats = cache.allSeats;

  if (!evts.length) {
    document.getElementById('eventsAdminList').innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">No events yet. Create one using the form.</p>';
    return;
  }

  document.getElementById('eventsAdminList').innerHTML = evts.map(ev => {
    const aud = auds.find(a => a.id === ev.auditoriumId);
    const bookedCount = (allSeats[ev.id] || []).filter(Boolean).length;
    const capacity = aud ? aud.capacity : 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const isPast = new Date(ev.date) < today;
    return `<div class="admin-list-item" style="border-left:3px solid ${ev.color||'#5b8dee'};${isPast ? 'opacity:0.6;' : ''}">
      <div class="admin-list-item-title">${escH(ev.title)} ${isPast ? '<span style="font-size:0.7rem;color:#f59e0b;margin-left:6px">[PAST]</span>' : ''}</div>
      <div class="admin-list-item-meta">🏛 ${escH(ev.college)} · 🎪 ${escH(aud?.name||'Unknown')} · 📅 ${formatDate(ev.date)} ${ev.time} · ⏱${ev.duration}h · ${ev.price>0?`₹${ev.price}`:'Free'}</div>
      <div class="admin-list-item-meta">
        ${CATEGORIES[ev.category]||ev.category} &nbsp;·&nbsp;
        💺 ${bookedCount}/${capacity} booked
      </div>
      ${state.isSuper ? `<div class="admin-list-actions">
        <button class="admin-del-btn" onclick="adminRemoveEvent('${ev.id}')">Delete</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

// FIX: adminRemoveEvent now takes event ID (string) instead of array index (number)
// This prevents index-mismatch bugs when events are reordered or filtered
async function adminRemoveEvent(evtId) {
  if (!confirm('Delete this event? All bookings for this event will also be removed.')) return;
  try {
    await api.deleteEvent(evtId);
    await loadCache();
    toast('Event deleted','success');
    renderEventsAdmin();
  } catch(e) { toast(e.message || 'Delete failed','error'); }
}

function renderBookingsAdmin(filter='') {
  const auds = cache.auditoriums;
  const bookings = cache.allBookings || [];
  let html = '';

  bookings.forEach(b => {
    if (!b) return;
    const key = b.userEmail || '';
    if (filter && !key.includes(filter) && !String(b.seat).includes(filter) && !b.eventTitle.toLowerCase().includes(filter)) return;
    const aud = auds.find(a => a.id===b.auditoriumId);
    const isAdm = b.userRole === 'admin';
    const icon = b.userRole === 'student' ? '' : (isAdm ? '' : '');
    html += `<div class="admin-list-item">
      <div class="admin-list-item-title">${icon} ${escH(b.userEmail)}</div>
      <div class="admin-list-item-meta">🎭 ${escH(b.eventTitle)} · 🎪 ${escH(aud?.name||'Unknown')} · 💺 Seat #${b.seat} · ${b.price>0?`₹${b.price}`:'Free'}</div>
      <div class="admin-list-item-meta">🎫 ${b.id} · ${formatDateTime(b.bookedAt)}</div>
      <div class="admin-list-actions"><button class="admin-del-btn" onclick="adminCancelBooking('${b.id}')">Cancel Booking</button></div>
    </div>`;
  });

  document.getElementById('allBookingsAdmin').innerHTML = html || '<p style="color:var(--text-muted);font-size:0.85rem;padding:16px">No bookings found.</p>';
}

function adminSearchBookings() {
  renderBookingsAdmin(document.getElementById('adminSearch').value.toLowerCase().trim());
}

async function adminCancelBooking(ticketId) {
  if (!confirm('Cancel this booking?')) return;
  try {
    await api.cancelBooking(ticketId);
    await loadCache();
    await loadAllBookings();
    toast('Booking cancelled','success');
    renderBookingsAdmin();
  } catch(e) { toast(e.message || 'Cancel failed','error'); }
}

let clearClicks = 0;
async function clearAllBookings(btn) {
  if (clearClicks === 0) {
    clearClicks = 1;
    const oldText = btn.innerText;
    btn.innerText = "Click again to Confirm";
    btn.style.background = "var(--red)";
    btn.style.color = "white";
    setTimeout(() => {
      clearClicks = 0;
      btn.innerText = oldText;
      btn.style.background = "";
      btn.style.color = "";
    }, 3000);
    return;
  }
  
  clearClicks = 0;
  btn.innerText = "Clearing...";
  try {
    await api.clearAllBookings();
    await loadCache();
    await loadAllBookings();
    toast('All bookings cleared','success');
    renderBookingsAdmin();
  } catch(e) { toast(e.message || 'Failed','error'); }
  finally { btn.innerText = "Clear Bookings"; }
}

let resetClicks = 0;
async function resetSystem(btn) {
  if (resetClicks === 0) {
    resetClicks = 1;
    const oldText = btn.innerText;
    btn.innerText = "Click again to Reset All";
    btn.style.background = "var(--red)";
    btn.style.color = "white";
    setTimeout(() => {
      resetClicks = 0;
      btn.innerText = oldText;
      btn.style.background = "";
      btn.style.color = "";
    }, 3000);
    return;
  }

  resetClicks = 0;
  btn.innerText = "Resetting...";
  try {
    await api.resetSystem();
    clearSession();
    location.reload();
  } catch(e) { toast(e.message || 'Reset failed','error'); }
}

// ===== UTILITIES =====
function escH(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
}

function formatDateTime(isoStr) {
  return new Date(isoStr).toLocaleString('en-IN', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function addHours(timeStr, hours) {
  const [h,m] = timeStr.split(':').map(Number);
  const end = (h + hours) % 24;
  return `${String(end).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ===== USER MANAGEMENT (Super Admin) =====
const PERM_LABELS = {
  createEvents: '📅 Create Events',
  deleteEvents: '🗑️ Delete Events',
  viewBookings: '📑 View Bookings',
  cancelBookings: '❌ Cancel Bookings',
  addAuditoriums: '🏛 Add Auditoriums',
  deleteAuditoriums: '🗑️ Delete Auditoriums',
  scanTickets: '🔍 Scan Tickets',
  viewAnalytics: '📈 View Analytics',
  manageUsers: '👥 Manage Users'
};

const ROLE_DEFAULT_PERMS = {
  pseudo_admin: { createEvents: true, deleteEvents: false, viewBookings: true, cancelBookings: true, addAuditoriums: true, deleteAuditoriums: false, scanTickets: true, viewAnalytics: true, manageUsers: false },
  scanner:      { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: true, viewAnalytics: false, manageUsers: false },
  teacher:      { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: false, viewAnalytics: false, manageUsers: false },
  student:      { createEvents: false, deleteEvents: false, viewBookings: false, cancelBookings: false, addAuditoriums: false, deleteAuditoriums: false, scanTickets: false, viewAnalytics: false, manageUsers: false }
};

const ROLE_LABELS_FULL = { admin: 'Super Admin', pseudo_admin: 'Pseudo Admin', scanner: 'Scanner', student: 'Student', teacher: 'Teacher' };

let cachedUsers = [];

function buildPermsGrid(containerId, perms, prefix) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Object.entries(PERM_LABELS).map(([key, label]) => {
    const checked = perms[key] ? 'checked' : '';
    return `<div class="perm-toggle">
      <label for="${prefix}_${key}">${label}</label>
      <div class="toggle-switch">
        <input type="checkbox" id="${prefix}_${key}" ${checked} />
        <span class="slider"></span>
      </div>
    </div>`;
  }).join('');
}

function readPermsFromGrid(prefix) {
  const perms = {};
  Object.keys(PERM_LABELS).forEach(key => {
    const el = document.getElementById(`${prefix}_${key}`);
    perms[key] = el ? el.checked : false;
  });
  return perms;
}

window.onNewUserRoleChange = function() {
  const role = document.getElementById('newUserRole').value;
  const section = document.getElementById('newUserPermsSection');
  if (['pseudo_admin', 'scanner'].includes(role)) {
    section.style.display = 'block';
    buildPermsGrid('newUserPermsGrid', ROLE_DEFAULT_PERMS[role] || {}, 'newPerm');
  } else {
    section.style.display = 'none';
  }
};

async function loadAndRenderUsers() {
  try {
    cachedUsers = await api.getUsers();
    renderUsersAdmin();
  } catch(e) {
    toast(e.message || 'Failed to load users', 'error');
  }
}

window.renderUsersAdmin = function() {
  const filter = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
  const list = cachedUsers.filter(u => {
    if (!filter) return true;
    return u.email.includes(filter) || u.role.includes(filter) || (u.college||'').toLowerCase().includes(filter);
  });

  document.getElementById('userCountBadge').textContent = `${cachedUsers.length} users`;

  document.getElementById('usersAdminList').innerHTML = list.map(u => {
    const isMasterAdmin = u.role === 'admin';
    const perms = u.permissions || {};
    const permPills = Object.entries(PERM_LABELS).map(([key, label]) => {
      const on = perms[key];
      return `<span class="perm-pill ${on ? 'perm-on' : 'perm-off'}">${label.split(' ').slice(1).join(' ')}</span>`;
    }).join('');

    return `<div class="admin-list-item">
      <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;">
        <div>
          <div class="admin-list-item-title" style="display:flex;align-items:center;gap:8px;">
            ${escH(u.email)}
            <span class="user-role-badge role-${u.role}">${ROLE_LABELS_FULL[u.role] || u.role}</span>
          </div>
          <div class="admin-list-item-meta">${escH(u.college || '')} · Joined ${formatDate(u.createdAt)}</div>
        </div>
        ${!isMasterAdmin ? `<div class="admin-list-actions" style="margin-top:0;">
          <button class="btn-secondary" style="font-size:0.75rem;padding:5px 10px;" onclick="openEditUser('${escH(u.email)}')">Edit</button>
          <button class="admin-del-btn" onclick="adminDeleteUser('${escH(u.email)}')">Delete</button>
        </div>` : `<span style="font-size:0.72rem;color:var(--text-muted);font-style:italic;">Protected</span>`}
      </div>
      <div class="user-perms-inline">${permPills}</div>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:0.85rem;padding:16px;">No users found.</p>';
};

window.adminCreateUser = async function() {
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;
  const college = document.getElementById('newUserCollege').value.trim();

  if (!email || !password) { toast('Email and password are required', 'error'); return; }

  let permissions;
  if (['pseudo_admin', 'scanner'].includes(role)) {
    permissions = readPermsFromGrid('newPerm');
  } else {
    permissions = ROLE_DEFAULT_PERMS[role] || {};
  }

  try {
    await api.createUser({ email, password, role, college, permissions });
    toast(`✅ Account created: ${email}`, 'success');
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserCollege').value = '';
    document.getElementById('newUserRole').value = 'student';
    document.getElementById('newUserPermsSection').style.display = 'none';
    await loadAndRenderUsers();
  } catch(e) { toast(e.message || 'Failed to create user', 'error'); }
};

window.openEditUser = function(email) {
  const user = cachedUsers.find(u => u.email === email);
  if (!user) return;

  const perms = user.permissions || ROLE_DEFAULT_PERMS[user.role] || {};
  const roleOpts = ['student', 'teacher', 'pseudo_admin', 'scanner'].map(r => {
    return `<option value="${r}" ${r === user.role ? 'selected' : ''}>${ROLE_LABELS_FULL[r] || r}</option>`;
  }).join('');

  const permsHtml = Object.entries(PERM_LABELS).map(([key, label]) => {
    const checked = perms[key] ? 'checked' : '';
    return `<div class="perm-toggle">
      <label for="editPerm_${key}">${label}</label>
      <div class="toggle-switch">
        <input type="checkbox" id="editPerm_${key}" ${checked} />
        <span class="slider"></span>
      </div>
    </div>`;
  }).join('');

  // Replace the user's list item with an inline edit form
  const container = document.getElementById('usersAdminList');
  const items = container.querySelectorAll('.admin-list-item');
  for (const item of items) {
    if (item.querySelector('.admin-list-item-title')?.textContent?.includes(email)) {
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <strong style="font-size:0.95rem;">Editing: ${escH(email)}</strong>
        </div>
        <div class="form-field" style="margin-bottom:10px;">
          <label>Role</label>
          <select id="editUserRole" onchange="onEditRoleChange()">${roleOpts}</select>
        </div>
        <label style="font-size:0.78rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.06em;">Feature Permissions</label>
        <div class="perms-grid" style="margin:10px 0;">${permsHtml}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn-primary" style="font-size:0.85rem;padding:8px 16px;" onclick="saveEditUser('${escH(email)}')">Save Changes</button>
          <button class="btn-secondary" style="font-size:0.85rem;padding:8px 16px;" onclick="loadAndRenderUsers()">Cancel</button>
        </div>
      `;
      break;
    }
  }
};

window.onEditRoleChange = function() {
  const role = document.getElementById('editUserRole').value;
  const defaults = ROLE_DEFAULT_PERMS[role] || {};
  Object.keys(PERM_LABELS).forEach(key => {
    const el = document.getElementById(`editPerm_${key}`);
    if (el) el.checked = !!defaults[key];
  });
};

window.saveEditUser = async function(email) {
  const role = document.getElementById('editUserRole').value;
  const permissions = readPermsFromGrid('editPerm');

  try {
    await api.updateUserRole(email, { role, permissions });
    toast(`✅ Updated: ${email}`, 'success');
    await loadAndRenderUsers();
  } catch(e) { toast(e.message || 'Update failed', 'error'); }
};

window.adminDeleteUser = async function(email) {
  if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return;
  try {
    await api.deleteUser(email);
    toast(`User ${email} deleted`, 'success');
    await loadAndRenderUsers();
  } catch(e) { toast(e.message || 'Delete failed', 'error'); }
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Bind buttons FIRST so they work immediately
  const lBtn = document.getElementById('loginBtn');
  const sBtn = document.getElementById('signupBtn');
  if (lBtn) lBtn.onclick = handleLogin;
  if (sBtn) sBtn.onclick = handleSignup;

  // 2. Load basic cache
  await loadCache();

  // 3. PWA: Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('✅ SW registered');
    }).catch(e => console.warn('SW failed'));
  }

  // 4. PWA: Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._deferredInstallPrompt = e;
    showInstallBanner();
  });

  // 5. Auto-login
  try {
    const userData = await api.getMe();
    if (userData && userData.email) {
      state.currentUser = userData.email;
      state.currentUserData = userData;
      state.isAdmin = userData.isAdmin;
      try {
        await loadMyBookings();
        showMainApp();
      } catch(e) { 
        showMainApp(); // Show app even if bookings fail
      }
      return;
    }
  } catch(e) { /* ignore auto-login failure */ }
  
  document.getElementById('authPage').classList.add('active');

  // Handle URL params: ?resetToken=... and ?verified=...
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('resetToken');
  const verified   = params.get('verified');

  if (resetToken) {
    window._resetToken = resetToken;
    window.history.replaceState({}, document.title, '/');
    showResetPasswordModal();
  } else if (verified === 'true') {
    window.history.replaceState({}, document.title, '/');
    toast('✅ Email verified! You can now sign in.', 'success', 5000);
  } else if (verified === 'expired') {
    window.history.replaceState({}, document.title, '/');
    toast('⚠️ Verification link expired. Sign in and request a new one.', 'error', 5000);
  }

  // FUTURE-04: Waitlist token in URL — user clicked email link
  const waitlistToken = params.get('waitlist_token');
  if (waitlistToken) {
    window.history.replaceState({}, document.title, '/');
    claimWaitlistSeat(waitlistToken);
  }
});

// ===== PWA Install Banner =====
function showInstallBanner() {
  if (document.getElementById('pwaInstallBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwaInstallBanner';
  banner.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: #1C2132; border: 1px solid #F84464; border-radius: 14px;
    padding: 14px 20px; display: flex; align-items: center; gap: 14px;
    box-shadow: 0 8px 32px rgba(248,68,100,0.25); z-index: 9998;
    font-family: 'DM Sans', sans-serif; max-width: 340px; width: 90%;
    animation: toastIn 0.3s ease;
  `;
  banner.innerHTML = `
    <span style="font-size:1.8rem">⬡</span>
    <div style="flex:1">
      <div style="font-weight:700;font-size:0.9rem;color:#fff">Install AuditoriaX</div>
      <div style="font-size:0.78rem;color:#9AA0B8">Add to home screen for quick access</div>
    </div>
    <button id="pwaInstallBtn" style="background:#F84464;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:0.82rem;cursor:pointer;">Install</button>
    <button id="pwaDismissBtn" style="background:none;border:none;color:#626A85;cursor:pointer;font-size:1.1rem;padding:4px;">✕</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwaInstallBtn').onclick = async () => {
    if (window._deferredInstallPrompt) {
      window._deferredInstallPrompt.prompt();
      const { outcome } = await window._deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') toast('✅ AuditoriaX added to home screen!', 'success');
    }
    banner.remove();
  };
  document.getElementById('pwaDismissBtn').onclick = () => banner.remove();
}

// Duplicate beforeinstallprompt listener removed (already handled inside DOMContentLoaded)


// ==========================================
// PRO-LEVEL UPGRADES: WebSockets, QR, PDF
// ==========================================

// 1. Real-time WebSockets
const socket = io();
socket.on('seat_booked', (data) => {
  if (state.bookingContext.event && state.bookingContext.event.id === data.eventId) {
    const seatIdParam = data.seatIndex + 1;
    const seatEl = document.querySelector(`.seat[data-seat-num="${seatIdParam}"]`);
    if (seatEl) {
      seatEl.className = 'seat seat-booked';
      seatEl.onclick = null;
      seatEl.title = 'Already booked';
    }
  }
});

socket.on('seat_freed', (data) => {
  if (state.bookingContext.event && state.bookingContext.event.id === data.eventId) {
    // Re-render seat map to easily restore the original seat category colors
    renderSeatMap(state.bookingContext.auditorium, state.bookingContext.event);
  }
  // Refresh event grid so cards update available count + waitlist button
  renderEventsGrid();
});

// FUTURE-04: Waitlist — real-time seat-available notification
socket.on('waitlist_seat_available', (data) => {
  const user = state.currentUserData;
  if (!user || user.email !== data.userEmail) return;

  // Find the event
  const ev = cache.events.find(e => e.id === data.eventId);
  const title = ev ? ev.title : 'the event';

  // Show an urgent modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:#0E111A;border:1px solid #F84464;border-radius:16px;padding:32px;max-width:420px;width:90%;text-align:center;box-shadow:0 0 48px rgba(248,68,100,0.3)">
      <div style="font-size:3rem;margin-bottom:12px">🎟</div>
      <h3 style="font-family:'Syne',sans-serif;font-size:1.3rem;color:#fff;margin-bottom:8px">A Seat Just Opened!</h3>
      <p style="color:#9AA0B8;margin-bottom:20px;font-size:0.9rem">You're next in line for <strong style="color:#fff">${escH(title)}</strong>.<br>Claim it before it's gone!</p>
      <div style="background:rgba(248,68,100,0.1);border:1px solid rgba(248,68,100,0.3);border-radius:8px;padding:10px;margin-bottom:20px;font-size:0.85rem;color:#F84464" id="wl_countdown"></div>
      <button onclick="claimWaitlistSeat('${data.token}')" style="background:#F84464;color:#fff;border:none;border-radius:8px;padding:14px 28px;font-weight:700;font-size:1rem;cursor:pointer;width:100%;margin-bottom:10px">Claim My Seat →</button>
      <button onclick="this.closest('[style*=position]').remove()" style="background:none;border:none;color:#626A85;cursor:pointer;font-size:0.85rem">Not interested</button>
    </div>`;
  document.body.appendChild(overlay);

  // Countdown timer
  const expiry = new Date(data.expiresAt);
  const tick = () => {
    const rem = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    const cd = document.getElementById('wl_countdown');
    if (!cd) return;
    const m = Math.floor(rem / 60), s = rem % 60;
    cd.textContent = `⏱ ${m}:${s.toString().padStart(2,'0')} remaining`;
    if (rem > 0) setTimeout(tick, 1000);
    else { cd.textContent = '⏱ Expired — seat moved to next person'; cd.style.color = '#626A85'; }
  };
  tick();
});

socket.on('seats_reset', () => {
  if (state.bookingContext.event && state.bookingContext.auditorium) {
    renderSeatMap(state.bookingContext.auditorium, state.bookingContext.event);
  }
});

// Real-time: new event published by admin
socket.on('event_created', async (newEvent) => {
  // Only add if not already in cache (avoid duplicates)
  if (!cache.events.find(e => e.id === newEvent.id)) {
    cache.events.push(newEvent);
  }
  // Also refresh seat availability cache for the new event
  try {
    const seatData = await api.getSeats(newEvent.id);
    cache.allSeats[newEvent.id] = seatData.seats || [];
  } catch(e) {}
  // Re-render explore tab if it is currently visible
  const explorePane = document.getElementById('explorePane');
  if (explorePane && !explorePane.classList.contains('hidden')) {
    renderEvents();
    toast('🎭 New event published: ' + newEvent.title, 'success', 4000);
  }
});

// Real-time: event deleted by admin
socket.on('event_deleted', (data) => {
  cache.events = cache.events.filter(e => e.id !== data.id);
  delete cache.allSeats[data.id];
  const explorePane = document.getElementById('explorePane');
  if (explorePane && !explorePane.classList.contains('hidden')) {
    renderEvents();
  }
});

// 2. QR Code Generation
let currentQrCode = null;
function generateQR(ticketId) {
  const container = document.getElementById('actualQRCode');
  if (!container) return;
  container.innerHTML = '';
  currentQrCode = new QRCode(container, {
    text: ticketId,
    width: 128,
    height: 128,
    colorDark : "#06070B",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });
}

// 2b. Add to Google Calendar
window.addToGoogleCalendar = function() {
  const title = document.getElementById('tEvent')?.textContent || '';
  const venue = document.getElementById('tVenue')?.textContent || '';
  const dateTime = document.getElementById('tDateTime')?.textContent || '';

  // Parse "Fri, 16 May 2026 · 10:00" → Google Calendar date format
  // Try to extract from booking context if available
  let startIso = '', endIso = '';
  const ev = state.bookingContext?.event;
  if (ev && ev.date && ev.time) {
    const [h, m] = ev.time.split(':').map(Number);
    const start = new Date(ev.date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setHours(h + (ev.duration || 2), m, 0, 0);
    const fmt = d => d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    startIso = fmt(start);
    endIso = fmt(end);
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `AuditoriaX: ${title}`,
    details: `Ticket booked via AuditoriaX\nVenue: ${venue}`,
    location: venue,
    ...(startIso && { dates: `${startIso}/${endIso}` })
  });
  window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank');
};

// 3. Download PDF
window.downloadTicketPDF = function() {
  const ticketPanel = document.querySelector('.ticket-panel');
  const ticketId = document.getElementById('tId').innerText;
  const opt = {
    margin:       0.5,
    filename:     'AuditoriaX_Ticket_' + ticketId + '.pdf',
    image:        { type: 'jpeg', quality: 1.0 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  
  const btnRow = document.querySelector('.ticket-actions');
  const closeBtn = document.querySelector('.ticket-header .modal-close');
  
  btnRow.style.display = 'none'; // hide buttons before PDF
  if(closeBtn) closeBtn.style.display = 'none';

  // Fix for html2canvas not rendering QRCode canvas correctly
  const qrCanvas = document.querySelector('#actualQRCode canvas');
  const qrImg = document.querySelector('#actualQRCode img');
  if (qrCanvas && qrImg) {
    if (!qrImg.src || qrImg.src === '') {
      qrImg.src = qrCanvas.toDataURL('image/png');
    }
    qrImg.style.display = 'inline-block';
    qrCanvas.style.display = 'none';
  }
  
  html2pdf().set(opt).from(ticketPanel).save().then(() => {
    btnRow.style.display = 'flex'; // restore buttons
    if(closeBtn) closeBtn.style.display = 'flex';
    if (qrCanvas && qrImg) {
      qrImg.style.display = 'none';
      qrCanvas.style.display = 'inline-block';
    }
  });
};

// 4. Admin QR Scanner Logic
let html5QrcodeScanner = null;

async function onScanSuccess(decodedText, decodedResult) {
  // Pause scanning temporarily
  if (html5QrcodeScanner) {
    html5QrcodeScanner.pause();
  }
  await processTicketScan(decodedText);
}

function onScanError(errorMessage) {
  // handle partial or failed scans silently
}

window.handleManualScan = async function() {
  const id = document.getElementById('manualScanId').value.trim();
  if (!id) return;
  await processTicketScan(id);
};

window.handleQRImageUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('uploadScanStatus');
  const label = document.getElementById('qrUploadLabel');

  statusEl.textContent = '⏳ Reading QR code...';
  statusEl.style.color = 'var(--text-muted)';
  if (label) label.style.opacity = '0.6';

  // Create a hidden temp div for Html5Qrcode if it doesn't exist
  let tempEl = document.getElementById('uploadQrTempEl');
  if (!tempEl) {
    tempEl = document.createElement('div');
    tempEl.id = 'uploadQrTempEl';
    tempEl.style.display = 'none';
    document.body.appendChild(tempEl);
  }

  try {
    const html5QrCode = new Html5Qrcode('uploadQrTempEl');
    const result = await html5QrCode.scanFile(file, /* showImage= */ false);

    statusEl.textContent = '✅ QR read! Verifying...';
    statusEl.style.color = 'var(--green)';
    await processTicketScan(result);
    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = '❌ Could not read QR from this image. Try a clearer, well-lit screenshot.';
    statusEl.style.color = '#ef4444';
  } finally {
    if (label) label.style.opacity = '1';
    event.target.value = ''; // allow re-selecting same file
  }
};


async function processTicketScan(ticketId) {
  const resDiv = document.getElementById('scanResult');
  resDiv.style.display = 'block';
  resDiv.className = '';
  resDiv.innerHTML = '<span class="spinner"></span> Verifying ticket...';
  
  try {
    const data = await api.scanTicket(ticketId);
    
    resDiv.style.background = 'rgba(45, 196, 146, 0.15)';
    resDiv.style.border = '1px solid var(--green)';
    resDiv.innerHTML = `
      <h4 style="color: var(--green); margin-bottom: 8px;">✅ Entry Granted</h4>
      <p><strong>Ticket ID:</strong> ${data.booking.ticketId}</p>
      <p><strong>Event:</strong> ${data.booking.eventTitle}</p>
      <p><strong>Seat:</strong> #${data.booking.seat}</p>
    `;
  } catch (err) {
    if (err.message && !err.message.includes('Network')) {
      resDiv.style.background = 'rgba(248, 68, 100, 0.15)';
      resDiv.style.border = '1px solid var(--accent)';
      resDiv.innerHTML = `
        <h4 style="color: var(--accent); margin-bottom: 8px;">❌ Access Denied</h4>
        <p>${escH(err.message)}</p>
      `;
    } else {
      resDiv.innerHTML = '<span style="color:var(--accent)">Network error during verification.</span>';
    }
  }
  
  // Resume scanner after 4 seconds
  setTimeout(() => {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.resume();
    }
    resDiv.style.display = 'none';
    document.getElementById('manualScanId').value = '';
  }, 4000);
}

// Duplicate getCookie() removed — already defined at line 146

// ─── Session Expired Handler ─────────────────────────────────────────────────
window.addEventListener('auditoriax:session-expired', () => {
  state.currentUser = null;
  state.currentUserData = null;
  state.isAdmin = false;
  state.isSuper = false;
  state.isStaff = false;
  cache.auditoriums = [];
  cache.events = [];
  cache.allSeats = {};
  cache.myBookings = [];
  cache.allBookings = [];

  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.add('hidden');

  const mainApp = document.getElementById('mainApp');
  const authPage = document.getElementById('authPage');
  if (mainApp) { mainApp.classList.remove('active'); mainApp.style.display = 'none'; }
  if (authPage) authPage.classList.add('active');

  toast('Your session has expired. Please log in again.', 'error', 5000);
  showAuthTab('login');
});

// ===== FORGOT PASSWORD MODAL =====
function showForgotPasswordModal() {
  const modal = document.getElementById('forgotPwModal');
  if (!modal) return;
  document.getElementById('forgotPwEmail').value = '';
  document.getElementById('forgotPwMsg').textContent = '';
  const btn = document.getElementById('forgotPwBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link →'; }
  modal.classList.remove('hidden');
}

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgotPwModal');
  if (modal) modal.classList.add('hidden');
}

async function handleForgotPassword() {
  const email = (document.getElementById('forgotPwEmail')?.value || '').trim().toLowerCase();
  const msg = document.getElementById('forgotPwMsg');
  const btn = document.getElementById('forgotPwBtn');
  if (!email) { if (msg) { msg.textContent = 'Please enter your email.'; msg.style.color = '#ef4444'; } return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    await api.forgotPassword(email);
    if (msg) {
      msg.textContent = '✅ If that email exists, a reset link has been sent. Check your inbox.';
      msg.style.color = 'var(--green)';
    }
    if (btn) btn.textContent = 'Sent!';
  } catch(e) {
    if (msg) { msg.textContent = e.message || 'Failed to send reset email.'; msg.style.color = '#ef4444'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link →'; }
  }
}

// ===== RESET PASSWORD MODAL =====
function showResetPasswordModal() {
  const modal = document.getElementById('resetPwModal');
  if (!modal) return;
  document.getElementById('resetPwNew').value = '';
  document.getElementById('resetPwConfirm').value = '';
  document.getElementById('resetPwMsg').textContent = '';
  const btn = document.getElementById('resetPwBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Set New Password →'; }
  modal.classList.remove('hidden');
}

async function handleResetPassword() {
  const token = window._resetToken;
  const newPw = (document.getElementById('resetPwNew')?.value || '').trim();
  const confirm = (document.getElementById('resetPwConfirm')?.value || '').trim();
  const msg = document.getElementById('resetPwMsg');
  const btn = document.getElementById('resetPwBtn');

  if (!token) { if (msg) { msg.textContent = 'Invalid reset link. Please request a new one.'; msg.style.color = '#ef4444'; } return; }
  if (newPw.length < 6) { if (msg) { msg.textContent = 'Password must be at least 6 characters.'; msg.style.color = '#ef4444'; } return; }
  if (newPw !== confirm) { if (msg) { msg.textContent = 'Passwords do not match.'; msg.style.color = '#ef4444'; } return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
  try {
    await api.resetPassword(token, newPw);
    if (msg) {
      msg.textContent = '✅ Password updated! You can now sign in.';
      msg.style.color = 'var(--green)';
    }
    if (btn) btn.textContent = 'Done!';
    window._resetToken = null;
    // Clear the token from URL without reload
    window.history.replaceState({}, document.title, '/');
    setTimeout(() => {
      const modal = document.getElementById('resetPwModal');
      if (modal) modal.classList.add('hidden');
      toast('Password updated! Please sign in.', 'success', 4000);
      showAuthTab('login');
    }, 1500);
  } catch(e) {
    if (msg) { msg.textContent = e.message || 'Reset failed. The link may have expired.'; msg.style.color = '#ef4444'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Set New Password →'; }
  }
}

// ===== INSTITUTION REGISTRATION MODAL =====
function showRegisterInstitution() {
  const modal = document.getElementById('registerInstModal');
  if (!modal) return;
  ['instName','instSlug','instDomain','instCity','instState','instContact'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('registerInstMsg').textContent = '';
  const btn = document.getElementById('registerInstBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Register Institution →'; }
  modal.classList.remove('hidden');
}

function closeRegisterInstitution() {
  const modal = document.getElementById('registerInstModal');
  if (modal) modal.classList.add('hidden');
}

async function handleRegisterInstitution() {
  const name    = (document.getElementById('instName')?.value || '').trim();
  const slug    = (document.getElementById('instSlug')?.value || '').trim();
  const domain  = (document.getElementById('instDomain')?.value || '').trim().toLowerCase();
  const city    = (document.getElementById('instCity')?.value || '').trim();
  const state   = (document.getElementById('instState')?.value || '').trim();
  const contact = (document.getElementById('instContact')?.value || '').trim().toLowerCase();
  const msg     = document.getElementById('registerInstMsg');
  const btn     = document.getElementById('registerInstBtn');

  if (!name)  { if (msg) { msg.textContent = 'Institution name is required.'; msg.style.color = '#ef4444'; } return; }
  if (!slug)  { if (msg) { msg.textContent = 'URL slug is required.'; msg.style.color = '#ef4444'; } return; }
  if (!/^[a-z0-9-]+$/.test(slug)) { if (msg) { msg.textContent = 'Slug may only contain lowercase letters, numbers, and hyphens.'; msg.style.color = '#ef4444'; } return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Registering...'; }
  try {
    await api.registerInstitution({ name, slug, domain: domain || null, city, state, contactEmail: contact });
    if (msg) {
      msg.textContent = `✅ Institution "${name}" registered! You are now an institution admin.`;
      msg.style.color = 'var(--green)';
    }
    if (btn) btn.textContent = 'Registered!';
    // Refresh user data so institutionId appears in JWT
    try {
      const userData = await api.getMe();
      if (userData) { state.currentUserData = userData; }
    } catch(e) {}
    toast(`🏛 Institution "${name}" registered successfully!`, 'success', 4000);
    setTimeout(closeRegisterInstitution, 1800);
  } catch(e) {
    if (msg) { msg.textContent = e.message || 'Registration failed.'; msg.style.color = '#ef4444'; }
    if (btn) { btn.disabled = false; btn.textContent = 'Register Institution →'; }
  }
}
// ===== FUTURE-02: BILLING DASHBOARD =====

async function renderBillingAdmin() {
  const pane = document.getElementById('billingAdminPane') || document.getElementById('billingPane');
  if (!pane) return;

  const user = state.currentUserData;
  const isSuper = state.isSuper;
  const isInstAdmin = user?.role === 'institution_admin' || user?.role === 'admin';

  pane.innerHTML = '<div style="padding:24px;text-align:center"><span class="spinner"></span> Loading billing data...</div>';
  pane.classList.remove('hidden');
  pane.style.display = '';

  try {
    if (isSuper) {
      // ── Super Admin: Platform-wide revenue view ──────────────────────
      const [data, plans] = await Promise.all([
        api.getAllRevenue(1, 50),
        api.getPlans()
      ]);

      const p = data.platform;
      const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      pane.innerHTML = `
        <div class="billing-dashboard">
          <div class="billing-header">
            <h3>💰 Platform Revenue</h3>
            <p class="billing-subtitle">All fees collected across institutions</p>
          </div>

          <div class="billing-stats-grid">
            <div class="billing-stat-card">
              <div class="bstat-label">Total Collected</div>
              <div class="bstat-value">${formatINR(p.totalCollected)}</div>
              <div class="bstat-sub">from all ticket sales</div>
            </div>
            <div class="billing-stat-card accent-green">
              <div class="bstat-label">Platform Revenue</div>
              <div class="bstat-value">${formatINR(p.totalPlatformFees)}</div>
              <div class="bstat-sub">AuditoriaX earnings</div>
            </div>
            <div class="billing-stat-card accent-yellow">
              <div class="bstat-label">Pending Payout</div>
              <div class="bstat-value">${formatINR(p.pendingPayout)}</div>
              <div class="bstat-sub">owed to institutions</div>
            </div>
            <div class="billing-stat-card">
              <div class="bstat-label">Paid Out</div>
              <div class="bstat-value">${formatINR(p.paidOut)}</div>
              <div class="bstat-sub">lifetime institution payouts</div>
            </div>
          </div>

          <div class="billing-section">
            <div class="billing-section-header">
              <h4>📋 Recent Transactions</h4>
              <span class="billing-total">${data.pagination.total} total</span>
            </div>
            <div class="billing-table-wrap">
              <table class="billing-table">
                <thead><tr>
                  <th>Event</th><th>Seat</th><th>Total</th><th>Fee %</th><th>Platform Cut</th><th>Inst. Gets</th><th>Status</th><th>Date</th><th>Action</th>
                </tr></thead>
                <tbody>${data.records.map(r => `
                  <tr>
                    <td>${r.eventTitle || '—'}</td>
                    <td>#${r.seat || '—'}</td>
                    <td><strong>${formatINR(r.totalAmount)}</strong></td>
                    <td>${r.platformFeePercent}%</td>
                    <td class="fee-col">${formatINR(r.platformFee)}</td>
                    <td class="inst-col">${formatINR(r.institutionAmount)}</td>
                    <td><span class="payout-badge ${r.payoutStatus}">${r.payoutStatus}</span></td>
                    <td>${new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>${r.payoutStatus === 'pending' ?
                      `<button class="btn-xs" onclick="markPayoutPaid('${r.id}')">Mark Paid</button>` :
                      '<span style="color:var(--text-muted);font-size:0.75rem">✓ Done</span>'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="billing-section">
            <h4>🏷 Plan Tiers</h4>
            <div class="plans-grid">
              ${plans.plans.map(pl => `
                <div class="plan-card ${pl.id}">
                  <div class="plan-name">${pl.name}</div>
                  <div class="plan-price">${pl.price === 0 ? 'Free' : '₹' + pl.price + '/mo'}</div>
                  <div class="plan-fee">${pl.platformFeePercent}% platform fee</div>
                  <ul class="plan-features">${pl.features.map(f => `<li>${f}</li>`).join('')}</ul>
                </div>`).join('')}
            </div>
          </div>
        </div>`;

    } else if (isInstAdmin && user?.institutionSlug) {
      // ── Institution Admin: Own billing summary ───────────────────────
      const data = await api.getInstitutionBilling(user.institutionSlug);
      const formatINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const b = data.billing || {};

      pane.innerHTML = `
        <div class="billing-dashboard">
          <div class="billing-header">
            <h3>💳 Billing — ${data.institution?.name || 'Your Institution'}</h3>
            <span class="plan-badge ${data.institution?.plan}">${(data.institution?.plan || 'free').toUpperCase()} PLAN</span>
          </div>

          <div class="billing-fee-notice">
            AuditoriaX deducts a <strong>${data.platformFeePercent}% platform fee</strong> from each paid ticket on your plan.
          </div>

          <div class="billing-stats-grid">
            <div class="billing-stat-card">
              <div class="bstat-label">Gross Revenue</div>
              <div class="bstat-value">${formatINR(b.totalRevenue)}</div>
              <div class="bstat-sub">total ticket sales</div>
            </div>
            <div class="billing-stat-card">
              <div class="bstat-label">Platform Fees</div>
              <div class="bstat-value fee-col">${formatINR(b.platformFeePaid)}</div>
              <div class="bstat-sub">deducted by AuditoriaX</div>
            </div>
            <div class="billing-stat-card accent-green">
              <div class="bstat-label">Pending Payout</div>
              <div class="bstat-value">${formatINR(b.pendingPayout)}</div>
              <div class="bstat-sub">owed to you</div>
            </div>
            <div class="billing-stat-card">
              <div class="bstat-label">Total Received</div>
              <div class="bstat-value">${formatINR(b.lifetimePayout)}</div>
              <div class="bstat-sub">lifetime payouts</div>
            </div>
          </div>

          <div class="billing-section">
            <h4>📅 Monthly Breakdown</h4>
            <div class="billing-table-wrap">
              <table class="billing-table">
                <thead><tr><th>Month</th><th>Tickets</th><th>Gross</th><th>Platform Fee</th><th>Your Amount</th></tr></thead>
                <tbody>${(data.monthly || []).length === 0 ?
                  '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No revenue data yet</td></tr>' :
                  data.monthly.map(m => `
                  <tr>
                    <td><strong>${m.label}</strong></td>
                    <td>${m.transactions}</td>
                    <td>${formatINR(m.totalAmount)}</td>
                    <td class="fee-col">${formatINR(m.platformFee)}</td>
                    <td class="inst-col">${formatINR(m.institutionAmount)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="billing-section">
            <h4>🧾 Recent Transactions</h4>
            <div class="billing-table-wrap">
              <table class="billing-table">
                <thead><tr><th>Event</th><th>Seat</th><th>Paid</th><th>Fee</th><th>Your Share</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>${(data.recent || []).length === 0 ?
                  '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No paid transactions yet</td></tr>' :
                  data.recent.map(r => `
                  <tr>
                    <td>${r.eventTitle || '—'}</td>
                    <td>#${r.seat || '—'}</td>
                    <td>${formatINR(r.totalAmount)}</td>
                    <td class="fee-col">${formatINR(r.platformFee)}</td>
                    <td class="inst-col">${formatINR(r.institutionAmount)}</td>
                    <td><span class="payout-badge ${r.payoutStatus}">${r.payoutStatus}</span></td>
                    <td>${new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="billing-section">
            <h4>📦 Plan Limits</h4>
            <div class="plan-limits-grid">
              <div class="limit-item">
                <span class="limit-label">Auditoriums</span>
                <span class="limit-value">${data.institution?.settings?.maxAuditoriums ?? '?'} max</span>
              </div>
              <div class="limit-item">
                <span class="limit-label">Events / Month</span>
                <span class="limit-value">${data.institution?.settings?.maxEventsPerMonth ?? '?'} max</span>
              </div>
            </div>
            <p style="margin-top:12px;font-size:0.82rem;color:var(--text-muted)">Contact <a href="mailto:support@auditoriax.app">support@auditoriax.app</a> to upgrade your plan.</p>
          </div>
        </div>`;
    } else {
      pane.innerHTML = '<div class="empty-state"><h4>No Billing Data</h4><p>Billing information is available for institution admins.</p></div>';
    }
  } catch(e) {
    pane.innerHTML = `<div class="empty-state"><h4>Failed to load billing data</h4><p>${e.message}</p></div>`;
  }
}

async function markPayoutPaid(id) {
  const note = prompt('Enter payout note (e.g. "NEFT on 01-Jul-2025"):');
  if (note === null) return; // cancelled
  try {
    await api.markPayoutPaid(id, note);
    toast('✅ Payout marked as paid', 'success');
    renderBillingAdmin(); // refresh
  } catch(e) {
    toast('Failed: ' + e.message, 'error');
  }
}

// ===== FUTURE-04: WAITLIST FUNCTIONS =====

/** Load the current user's waitlist entries into cache */
async function loadMyWaitlist() {
  if (!state.currentUserData) return;
  try {
    const data = await api.getMyWaitlist();
    cache.myWaitlist = data.waitlist || [];
  } catch (e) {
    cache.myWaitlist = [];
  }
}

/** Join the waitlist for a sold-out event */
async function joinWaitlist(eventId, eventTitle, clickEvent) {
  if (clickEvent) clickEvent.stopPropagation(); // prevent opening booking modal
  if (!state.currentUserData) {
    toast('Please sign in to join the waitlist', 'error');
    return;
  }
  try {
    const res = await api.joinWaitlist(eventId);
    toast(`📋 ${res.message}`, 'success', 5000);
    // Update local cache so button changes immediately
    if (!cache.myWaitlist) cache.myWaitlist = [];
    cache.myWaitlist.push({ eventId, position: res.position, status: 'waiting' });
    renderEventsGrid();
  } catch (e) {
    const msg = e.message || 'Failed to join waitlist';
    if (msg.includes('already')) {
      toast('You are already on this waitlist', 'info');
    } else {
      toast(msg, 'error');
    }
  }
}

/** Claim a waitlisted seat using a token (from email link or socket notification) */
async function claimWaitlistSeat(token) {
  try {
    const data = await api.claimWaitlistSeat(token);
    if (!data.valid) {
      toast('⚠️ This seat claim link is invalid or already used.', 'error');
      return;
    }
    // Open the booking modal for the event
    const ev = cache.events.find(e => e.id === data.eventId);
    if (ev) {
      toast('🎟 Seat reserved for you! Complete your booking below.', 'success', 6000);
      openBookingModal(ev);
    } else {
      // Event not in cache yet — reload
      await loadCache();
      const ev2 = cache.events.find(e => e.id === data.eventId);
      if (ev2) openBookingModal(ev2);
      else toast('Could not find event. Please refresh.', 'error');
    }
    // Remove from myWaitlist cache
    cache.myWaitlist = (cache.myWaitlist || []).filter(w => w.eventId !== data.eventId);
    renderEventsGrid();
  } catch (e) {
    if (e.message?.includes('expired') || e.status === 410) {
      toast('⏱ Your claim window expired. The seat was given to the next person.', 'error', 6000);
    } else {
      toast(e.message || 'Failed to claim seat', 'error');
    }
  }
}

// Load waitlist data alongside the regular cache on init
const _origLoadCache = loadCache;
loadCache = async function() {
  await _origLoadCache();
  await loadMyWaitlist();
};
