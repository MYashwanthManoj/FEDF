/* =====================================================
   AUDITORIAX — FULL APPLICATION LOGIC
   Multi-college auditorium booking platform
   Features: Auth, Events, Seat Selection, Payment, Admin
====================================================== */

// ===== CONSTANTS =====
const MASTER_ADMINS = ['admin@system.com', 'manneyashwanthmanoj@klh.edu.in', 'rajaboinavishnuvardhan@klh.edu.in'];
const SK = { USERS: 'ax_users', AUDITORIUMS: 'ax_auds', EVENTS: 'ax_evts', BOOKINGS: 'ax_bkgs', SESSION: 'ax_session' };
const CATEGORIES = { tech:'🖥 Tech', cultural:'🎭 Cultural', lecture:'🎓 Lecture', sports:'⚽ Sports', other:'📌 Other' };
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

// ===== STORAGE =====
const get = (k, def=null) => { try { const d=localStorage.getItem(k); return d ? JSON.parse(d) : def; } catch { return def; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

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

function initData() {
  let auds = get(SK.AUDITORIUMS);
  if (!auds || auds.length === 0) { auds = defaultAuditoriums; set(SK.AUDITORIUMS, auds); }

  let evts = get(SK.EVENTS);
  if (!evts || evts.length === 0) { evts = defaultEvents; set(SK.EVENTS, evts); }

  let users = get(SK.USERS, {});
  if (!users['admin@system.com']) {
    users['admin@system.com'] = { email:'admin@system.com', password:'admin123', role:'admin', college:'System Admin', gender:null, cluster:null, createdAt:new Date().toISOString() };
    set(SK.USERS, users);
  }

  let bkgs = get(SK.BOOKINGS, { student:{}, teacher:{}, seats:{} });
  if (!bkgs.student) bkgs.student = {};
  if (!bkgs.teacher) bkgs.teacher = {};
  if (!bkgs.seats) bkgs.seats = {};

  // ── MIGRATION: convert old-format student bookings (key = email) to
  //    new format (key = email:eventId) so multiple event bookings work.
  let migrated = false;
  Object.keys(bkgs.student).forEach(k => {
    const val = bkgs.student[k];
    // Old format: key is plain email, value is a booking object with eventId
    if (val && val.eventId && !k.includes(':')) {
      const newKey = k + ':' + val.eventId;
      if (!bkgs.student[newKey]) {
        bkgs.student[newKey] = val;
      }
      delete bkgs.student[k];
      migrated = true;
    }
  });

  // Seats are now keyed per-event (bkgs.seats[evt.id]) so each event
  // has its own independent seat availability grid.
  evts.forEach(ev => {
    const aud = auds.find(a => a.id === ev.auditoriumId);
    if (!aud) return;
    if (!bkgs.seats[ev.id]) bkgs.seats[ev.id] = Array(aud.capacity).fill(false);
    else if (bkgs.seats[ev.id].length !== aud.capacity) {
      const ns = Array(aud.capacity).fill(false);
      bkgs.seats[ev.id].slice(0, aud.capacity).forEach((v,i) => { ns[i]=v; });
      bkgs.seats[ev.id] = ns;
    }
  });

  // Back-fill seat allocation for auditoriums that predate this feature
  let audUpdated = false;
  auds.forEach(a => {
    if (a.teacherSeats == null || a.girlSeats == null || a.boySeats == null) {
      const alloc = defaultSeatAlloc(a.capacity);
      a.teacherSeats = alloc.teacherSeats;
      a.girlSeats    = alloc.girlSeats;
      a.boySeats     = alloc.boySeats;
      audUpdated = true;
    }
  });
  if (audUpdated) set(SK.AUDITORIUMS, auds);

  set(SK.BOOKINGS, bkgs);
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

function onSignupEmailInput() {
  const email = document.getElementById('signupEmail').value.toLowerCase();
  document.getElementById('studentFields').style.display = email.endsWith('@klh.edu.in') ? 'flex' : 'none';
  document.getElementById('studentFields').style.flexDirection = 'column';
  document.getElementById('studentFields').style.gap = '14px';
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (inp.type === 'password') { inp.type='text'; btn.textContent='🙈'; }
  else { inp.type='password'; btn.textContent='👁'; }
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

function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;
  if (!email || !pw) { toast('Please fill in all fields','error'); return; }

  let users = get(SK.USERS, {});

  if (MASTER_ADMINS.includes(email) && !users[email]) {
    users[email] = { email, password:pw, role:'admin', college:'System Admin', gender:null, cluster:null, createdAt:new Date().toISOString() };
    set(SK.USERS, users);
  }

  const user = users[email];
  if (!user || user.password !== pw) { toast('Invalid email or password','error'); return; }

  loginUser(email);
}

function handleSignup() {
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const college = document.getElementById('signupCollege').value.trim();
  const pw = document.getElementById('signupPassword').value;
  const cpw = document.getElementById('signupConfirm').value;

  const isKLH = email.endsWith('@klh.edu.in');
  const isValidEmail = email.includes('@') && email.split('@')[1]?.includes('.');

  if (!email || !college || !pw) { toast('Please fill all required fields','error'); return; }
  if (!isValidEmail) { toast('Please enter a valid email address','error'); return; }
  if (pw.length < 6) { toast('Password must be at least 6 characters','error'); return; }
  if (pw !== cpw) { toast('Passwords do not match','error'); return; }

  if (isKLH) {
    const g = document.getElementById('signupGender').value;
    const c = document.getElementById('signupCluster').value;
    if (!g || !c) { toast('Please select gender and cluster','error'); return; }
  }

  const users = get(SK.USERS, {});
  if (users[email]) { toast('Account already exists. Please sign in.','error'); return; }

  const isTeacher = email.endsWith('@teacher.com');
  users[email] = {
    email, college,
    password: pw,
    role: isTeacher ? 'teacher' : 'student',
    gender: isKLH ? document.getElementById('signupGender').value : null,
    cluster: isKLH ? document.getElementById('signupCluster').value : null,
    lastClusterChange: isKLH ? new Date().toISOString() : null,
    createdAt: new Date().toISOString()
  };
  set(SK.USERS, users);
  toast('Account created! Welcome aboard! 🎉','success');
  loginUser(email);
}

function loginUser(email) {
  const users = get(SK.USERS, {});
  const user = users[email];
  if (!user) return;

  state.currentUser = email;
  state.currentUserData = user;
  state.isAdmin = MASTER_ADMINS.includes(email) || user.role === 'admin';

  set(SK.SESSION, { email });

  document.getElementById('authPage').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  document.getElementById('mainApp').style.display = 'block';

  const initials = email.split('@')[0].slice(0,2).toUpperCase();
  document.getElementById('navAvatar').textContent = initials;
  document.getElementById('navUsername').textContent = email.split('@')[0];
  document.getElementById('navRoleBadge').textContent = state.isAdmin ? '👑 Admin' : user.role === 'student' ? (user.cluster ? `Student · C${user.cluster}` : 'Student') : 'Teacher';
  document.getElementById('navCollege').textContent = user.college || '';

  if (state.isAdmin) {
    document.getElementById('adminTabBtn').classList.remove('hidden');
    document.getElementById('adminDropLink').classList.remove('hidden');
  }

  switchMainTab('explore');
  toast(`Welcome back, ${email.split('@')[0]}! 👋`, 'success');
}

function handleLogout() {
  state.currentUser = null;
  state.currentUserData = null;
  state.isAdmin = false;
  localStorage.removeItem(SK.SESSION);
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authPage').classList.add('active');
  document.getElementById('userDropdown').classList.add('hidden');
  document.getElementById('adminTabBtn').classList.add('hidden');
  document.getElementById('adminDropLink').classList.add('hidden');
  toast('Signed out successfully','info');
}

function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-user') && !e.target.closest('.user-dropdown')) {
    document.getElementById('userDropdown').classList.add('hidden');
  }
});

// ===== MAIN NAVIGATION =====
function switchMainTab(tab) {
  document.querySelectorAll('.mtab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tab+'Pane');
    p.classList.toggle('hidden', p.id !== tab+'Pane');
  });
  document.getElementById('userDropdown').classList.add('hidden');

  if (tab === 'explore') renderEvents();
  else if (tab === 'myBookings') renderMyBookings();
  else if (tab === 'profile') renderProfile();
  else if (tab === 'admin' && state.isAdmin) renderAdminPanel();
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

function eventCardHTML(ev) {
  const auds = get(SK.AUDITORIUMS, []);
  const aud = auds.find(a => a.id === ev.auditoriumId);
  const bkgs = get(SK.BOOKINGS, {seats:{}});
  const seats = bkgs.seats[ev.id] || [];
  const totalSeats = aud ? aud.capacity : 0;
  const bookedSeats = seats.filter(Boolean).length;
  const availableSeats = totalSeats - bookedSeats;
  const pct = totalSeats ? availableSeats/totalSeats : 1;

  const ud = state.currentUserData;
  const isSameCollege = ud && ud.college && ev.college.toLowerCase() === ud.college.toLowerCase();
  const isStudent = ud && ud.role === 'student';
  // Check if this student already has a booking specifically for THIS event
  const studentEventKey = state.currentUser + ':' + ev.id;
  const alreadyBooked = isStudent && bkgs.student && bkgs.student[studentEventKey];

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
function openBookingModal(ev) {
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
    renderSeatMap(aud, ev);
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
  const bkgs = get(SK.BOOKINGS, {seats:{}});
  const html = auds.map(a => {
    const seats = bkgs.seats[ev.id] || Array(a.capacity).fill(false);
    const avail = seats.filter(s=>!s).length;
    return `<div class="aud-card" onclick="selectAuditorium('${a.id}')">
      <div class="aud-card-name">🎪 ${escH(a.name)}</div>
      <div class="aud-card-meta">🏛 ${escH(a.college)}<br>📍 ${escH(a.city)}<br>💺 Capacity: ${a.capacity}</div>
      <div class="aud-card-avail">✅ ${avail} seats available</div>
    </div>`;
  }).join('');
  document.getElementById('auditoriumCards').innerHTML = html || '<p style="color:var(--text-muted)">No auditoriums available.</p>';
}

function selectAuditorium(audId) {
  const auds = get(SK.AUDITORIUMS, []);
  const aud = auds.find(a => a.id === audId);
  if (!aud) return;
  state.bookingContext.auditorium = aud;
  document.getElementById('modalStep1').classList.add('hidden');
  renderSeatMap(aud, state.bookingContext.event);
  document.getElementById('modalStep2').classList.remove('hidden');
}

function renderSeatMap(aud, ev) {
  const bkgs = get(SK.BOOKINGS, {seats:{}});
  const seats = bkgs.seats[ev.id] || Array(aud.capacity).fill(false);
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
    { label: `👨‍🏫 TEACHER SECTION · Seats 1–${teacherCount} (${teacherCount} seats)`, from:1, to:teacherCount, seatClass:'seat-teacher' },
    { label: `👩 FEMALE STUDENT SECTION · Seats ${teacherCount+1}–${femaleEnd} (${girlCount} seats)`, from:teacherCount+1, to:femaleEnd, seatClass:'seat-girl' },
    { label: `👦 MALE STUDENT SECTION · Seats ${femaleEnd+1}–${cap} (${boyCount} seats)`, from:femaleEnd+1, to:cap, seatClass:'seat-boy' },
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

function confirmBooking() {
  const { event, auditorium, seat } = state.bookingContext;
  if (!seat) { toast('Please select a seat first','error'); return; }

  const ud = state.currentUserData;
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});

  // One seat per student per event (different events are allowed)
  const studentEventKey = state.currentUser + ':' + event.id;
  if (ud.role === 'student' && bkgs.student[studentEventKey]) {
    toast('You already have a seat booked for this event. Cancel it first to rebook.','error'); return;
  }
  if (ud.role === 'teacher' && !state.isAdmin) {
    const tList = bkgs.teacher[state.currentUser] || [];
    if (tList.length >= 5) { toast('Teachers can book maximum 5 seats total','error'); return; }
  }

  if (bkgs.seats[event.id] && bkgs.seats[event.id][seat-1]) {
    toast('That seat was just taken! Please choose another.','error');
    renderSeatMap(auditorium, event);
    return;
  }

  const isSameCollege = event.college.toLowerCase() === (ud.college||'').toLowerCase();
  const price = (ud.role==='student' && !isSameCollege) ? event.price : 0;

  if (price > 0) {
    closeBookingModal();
    openPaymentModal(price, event, auditorium, seat);
  } else {
    finalizeBooking(event, auditorium, seat, 0, null);
    closeBookingModal();
  }
}

// ===== PAYMENT =====
let selectedPM = 'upi';

function openPaymentModal(price, event, auditorium, seat) {
  state.pendingPayment = { price, event, auditorium, seat };
  document.getElementById('payAmount').textContent = `₹${price}`;
  document.getElementById('payNowBtn').querySelector('#payBtnText').textContent = `Pay ₹${price}`;
  document.getElementById('paymentModal').classList.remove('hidden');
  selectPM(document.querySelector('.pm-option'), 'upi');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
  state.pendingPayment = null;
}

function selectPM(el, method) {
  selectedPM = method;
  document.querySelectorAll('.pm-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('upiSection').classList.toggle('hidden', method!=='upi');
  document.getElementById('cardSection').classList.toggle('hidden', method!=='card');
  document.getElementById('netbankSection').classList.toggle('hidden', method!=='netbank');
}

function simulatePayment() {
  const btn = document.getElementById('payNowBtn');
  const btnTxt = document.getElementById('payBtnText');

  if (selectedPM==='upi' && !document.getElementById('upiId').value.trim()) {
    toast('Please enter your UPI ID','error'); return;
  }
  if (selectedPM==='card') {
    if (!document.getElementById('cardNum').value.trim() || !document.getElementById('cardExp').value.trim() || !document.getElementById('cardCvv').value.trim()) {
      toast('Please fill all card details','error'); return;
    }
  }
  if (selectedPM==='netbank' && !document.getElementById('bankSelect').value) {
    toast('Please select a bank','error'); return;
  }

  btnTxt.innerHTML = '<span class="spinner"></span> Processing...';
  btn.disabled = true;

  setTimeout(() => {
    const { price, event, auditorium, seat } = state.pendingPayment;
    const txId = 'TXN' + Date.now().toString(36).toUpperCase();
    closePaymentModal();
    finalizeBooking(event, auditorium, seat, price, txId);
  }, 2200);
}

// ===== FINALIZE BOOKING =====
function finalizeBooking(event, auditorium, seat, price, txId) {
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  if (!bkgs.seats[event.id]) bkgs.seats[event.id] = Array(auditorium.capacity).fill(false);
  bkgs.seats[event.id][seat-1] = true;

  const ticketId = 'AX' + Date.now().toString(36).toUpperCase().slice(-8);
  const booking = {
    id: ticketId,
    eventId: event.id,
    eventTitle: event.title,
    auditoriumId: auditorium.id,
    auditoriumName: auditorium.name,
    eventCollege: event.college,
    date: event.date,
    time: event.time,
    seat,
    price,
    txId,
    bookedAt: new Date().toISOString(),
    category: event.category,
    color: event.color
  };

  const ud = state.currentUserData;
  if (ud.role === 'student') {
    // Key by "email:eventId" so one booking per event per student is allowed
    const studentEventKey = state.currentUser + ':' + event.id;
    bkgs.student[studentEventKey] = booking;
  } else {
    if (!bkgs.teacher[state.currentUser]) bkgs.teacher[state.currentUser] = [];
    bkgs.teacher[state.currentUser].push(booking);
  }
  set(SK.BOOKINGS, bkgs);

  showTicketModal(booking, auditorium);
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
  document.getElementById('ticketQrCode').textContent = booking.id;
  document.getElementById('ticketModal').classList.remove('hidden');
}

function closeTicketModal() {
  document.getElementById('ticketModal').classList.add('hidden');
  renderEvents();
}

// ===== MY BOOKINGS =====
function renderMyBookings() {
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  const ud = state.currentUserData;
  const container = document.getElementById('bookingsContainer');

  let myBookings = [];
  if (ud.role === 'student') {
    // Collect all bookings for this student across all events (keyed as "email:eventId")
    const prefix = state.currentUser + ':';
    myBookings = Object.keys(bkgs.student)
      .filter(k => k.startsWith(prefix))
      .map(k => bkgs.student[k])
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  } else {
    myBookings = bkgs.teacher[state.currentUser] || [];
  }

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
    btn.addEventListener('click', () => cancelBooking(btn.dataset.id));
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
        <button class="btn-danger cancel-booking-btn" data-id="${b.id}" style="padding:6px 14px;font-size:0.78rem">Cancel</button>
      </div>
    </div>
  </div>`;
}

function cancelBooking(bookingId) {
  if (!confirm('Cancel this booking? This cannot be undone.')) return;
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  const ud = state.currentUserData;

  if (ud.role === 'student') {
    // Find the booking key across all events for this student
    const prefix = state.currentUser + ':';
    const key = Object.keys(bkgs.student).find(k => k.startsWith(prefix) && bkgs.student[k]?.id === bookingId);
    if (key) {
      const b = bkgs.student[key];
      if (bkgs.seats[b.eventId]) bkgs.seats[b.eventId][b.seat-1] = false;
      delete bkgs.student[key];
    }
  } else {
    const list = bkgs.teacher[state.currentUser] || [];
    const idx = list.findIndex(b => b.id === bookingId);
    if (idx !== -1) {
      const b = list[idx];
      if (bkgs.seats[b.eventId]) bkgs.seats[b.eventId][b.seat-1] = false;
      list.splice(idx, 1);
      if (!list.length) delete bkgs.teacher[state.currentUser];
    }
  }
  set(SK.BOOKINGS, bkgs);
  toast('Booking cancelled','success');
  renderMyBookings();
}

// ===== PROFILE =====
function renderProfile() {
  const ud = state.currentUserData;
  const initials = ud.email.split('@')[0].slice(0,2).toUpperCase();

  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = ud.email.split('@')[0];
  document.getElementById('profileRoleTag').textContent = state.isAdmin ? '👑 Admin' : ud.role === 'student' ? `🎓 Student` : '👨‍🏫 Teacher';
  document.getElementById('profileCollegeName').textContent = ud.college || '';
  document.getElementById('pEmail').textContent = ud.email;
  document.getElementById('pCollege').textContent = ud.college || '—';
  document.getElementById('pSince').textContent = new Date(ud.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});

  const isKLH = ud.role === 'student' && ud.email && ud.email.endsWith('@klh.edu.in');

  const cooldownMs = isKLH ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const cooldownLabel = isKLH ? '3 months' : '1 month';

  if (ud.role === 'student') {
    const lastChange = ud.lastProfileChange ? new Date(ud.lastProfileChange) : null;
    const now = new Date();
    const inCooldown = lastChange && (now - lastChange) < cooldownMs;
    const saveBtn = document.getElementById('saveProfileBtn');

    document.getElementById('editStudentSection').style.display = 'block';

    if (isKLH) {
      document.getElementById('pGenderRow').classList.remove('hidden');
      document.getElementById('pClusterRow').classList.remove('hidden');
      document.getElementById('pGender').textContent = ud.gender === 'F' ? 'Female' : 'Male';
      document.getElementById('pCluster').textContent = `Cluster ${ud.cluster}`;
      document.getElementById('editClusterRow').style.display = '';
      document.getElementById('editGender').value = ud.gender || 'M';
      document.getElementById('editCluster').value = ud.cluster || '1';
    } else {
      document.getElementById('pGenderRow').classList.remove('hidden');
      document.getElementById('pClusterRow').classList.add('hidden');
      document.getElementById('pGender').textContent = ud.gender === 'F' ? 'Female' : 'Male';
      document.getElementById('editClusterRow').style.display = 'none';
      document.getElementById('editGender').value = ud.gender || 'M';
    }

    const editGender = document.getElementById('editGender');
    const editCluster = document.getElementById('editCluster');
    let notice = document.getElementById('profileCooldownNotice');

    if (inCooldown) {
      const nextChangeDate = new Date(lastChange.getTime() + cooldownMs);
      const daysLeft = Math.ceil((nextChangeDate - now) / (24 * 60 * 60 * 1000));
      editGender.disabled = true;
      editCluster.disabled = true;
      if (saveBtn) saveBtn.disabled = true;
      if (!notice) {
        notice = document.createElement('p');
        notice.id = 'profileCooldownNotice';
        notice.style.cssText = 'color:#f59e0b;font-size:0.8rem;margin-top:10px;line-height:1.5';
        document.getElementById('editStudentSection').appendChild(notice);
      }
      notice.textContent = `🔒 Profile locked · Next edit in ${daysLeft} day${daysLeft!==1?'s':''} (${cooldownLabel} cooldown · unlocks ${nextChangeDate.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})})`;
    } else {
      editGender.disabled = false;
      editCluster.disabled = false;
      if (saveBtn) saveBtn.disabled = false;
      if (notice) notice.remove();
    }
  } else {
    document.getElementById('pGenderRow').classList.add('hidden');
    document.getElementById('pClusterRow').classList.add('hidden');
    document.getElementById('editStudentSection').style.display = 'none';
  }
}

function saveStudentInfo() {
  const ud = state.currentUserData;
  const isKLH = ud.email && ud.email.endsWith('@klh.edu.in');
  const cooldownMs = isKLH ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const cooldownLabel = isKLH ? '3 months' : '1 month';

  const users = get(SK.USERS, {});
  const user = users[state.currentUser];
  const now = new Date();

  const lastChange = user.lastProfileChange ? new Date(user.lastProfileChange) : null;
  if (lastChange && (now - lastChange) < cooldownMs) {
    const nextChangeDate = new Date(lastChange.getTime() + cooldownMs);
    const daysLeft = Math.ceil((nextChangeDate - now) / (24 * 60 * 60 * 1000));
    toast(`Profile locked. ${daysLeft} day${daysLeft!==1?'s':''} remaining (${cooldownLabel} cooldown).`, 'error');
    return;
  }

  const g = document.getElementById('editGender').value;
  user.gender = g;
  if (isKLH) {
    user.cluster = document.getElementById('editCluster').value;
    user.lastClusterChange = now.toISOString();
  }
  user.lastProfileChange = now.toISOString();

  set(SK.USERS, users);
  state.currentUserData = users[state.currentUser];
  if (isKLH) {
    document.getElementById('navRoleBadge').textContent = `Student · C${user.cluster}`;
  }
  toast('Profile saved! Next edit available in ' + cooldownLabel + '.', 'success');
  renderProfile();
}

function toggleChangePw() {
  document.getElementById('changePwForm').classList.toggle('hidden');
}

function handleChangePw() {
  const cur = document.getElementById('curPw').value;
  const nw = document.getElementById('newPw').value;
  const cf = document.getElementById('confirmPw').value;
  if (!cur || !nw || !cf) { toast('Fill all fields','error'); return; }
  if (cur !== state.currentUserData.password) { toast('Current password is incorrect','error'); return; }
  if (nw.length < 6) { toast('New password too short','error'); return; }
  if (nw !== cf) { toast('Passwords do not match','error'); return; }
  const users = get(SK.USERS, {});
  users[state.currentUser].password = nw;
  set(SK.USERS, users);
  state.currentUserData.password = nw;
  toast('Password updated!','success');
  document.getElementById('changePwForm').classList.add('hidden');
  document.getElementById('curPw').value='';document.getElementById('newPw').value='';document.getElementById('confirmPw').value='';
}

// ===== ADMIN PANEL =====
function renderAdminPanel() {
  renderAudListAdmin();
  renderEventsAdmin();
  renderBookingsAdmin();
  populateAuditoriumSelect();
  renderAnalytics();
}

// ===== FIX: Robust admin tab switcher =====
// Uses explicit pane ID mapping to avoid ambiguous class-based toggling,
// and always clears inline display style that can override class-based hiding.
function switchAdminTab(tab) {
  // Map each tab name to its exact pane element ID
  const paneMap = {
    aud:       'audPane',
    events:    'eventsAdminPane',
    bookings:  'bookingsAdminPane',
    analytics: 'analyticsAdminPane',
    system:    'systemAdminPane'
  };

  // Update tab button active states
  const tabOrder = ['aud','events','bookings','analytics','system'];
  document.querySelectorAll('.admin-tab').forEach((t, i) => {
    t.classList.toggle('active', tabOrder[i] === tab);
  });

  // Show/hide each pane explicitly using its ID — no class-based guesswork
  Object.entries(paneMap).forEach(([t, paneId]) => {
    const pane = document.getElementById(paneId);
    if (!pane) return;
    if (t === tab) {
      pane.classList.add('active');
      pane.classList.remove('hidden');
      pane.style.display = '';          // clear any inline display:none
    } else {
      pane.classList.remove('active');
      pane.classList.add('hidden');
      pane.style.display = 'none';     // enforce hiding even for analytics pane
    }
  });

  // Re-render analytics charts only when that tab is actually visible
  if (tab === 'analytics') {
    setTimeout(renderAnalytics, 50);
  }
}

// ===== EVENT ANALYTICS =====
function renderAnalytics() {
  const evts = get(SK.EVENTS, []);
  if (!evts.length) return;
  const bkgs = get(SK.BOOKINGS, {seats:{}});
  const auds = get(SK.AUDITORIUMS, []);

  let totalRev = 0, totalBkgs = 0, totalCap = 0;
  const byCat = {}, byMonth = {}, byAud = {}, revMap = {};

  evts.forEach(e => {
    const aud = auds.find(a => a.id === e.auditoriumId);
    const capacity = aud ? aud.capacity : 0;
    const seats = bkgs.seats[e.id] || [];
    const bCount = seats.filter(Boolean).length;

    totalBkgs += bCount;
    totalCap += capacity;
    totalRev += bCount * (e.price || 0);

    byCat[e.category] = (byCat[e.category] || 0) + 1;
    const mo = new Date(e.date).toLocaleString('default', {month:'short'});
    byMonth[mo] = (byMonth[mo] || 0) + bCount;

    if (aud) {
      if (!byAud[aud.name]) byAud[aud.name] = {b: 0, c: 0};
      byAud[aud.name].b += bCount;
      byAud[aud.name].c += capacity;
    }

    revMap[e.title] = bCount * (e.price || 0);
  });

  const kpiHTML = `
    <div class="analytics-kpi"><div class="kpi-val">${evts.length}</div><div class="kpi-lbl">Total Events</div></div>
    <div class="analytics-kpi"><div class="kpi-val">${totalBkgs}</div><div class="kpi-lbl">Total Bookings</div></div>
    <div class="analytics-kpi"><div class="kpi-val">${totalCap?Math.round((totalBkgs/totalCap)*100):0}%</div><div class="kpi-lbl">Avg. Occupancy</div></div>
    <div class="analytics-kpi"><div class="kpi-val">₹${totalRev.toLocaleString()}</div><div class="kpi-lbl">Total Revenue</div></div>
  `;
  document.getElementById('analyticsKPIRow').innerHTML = kpiHTML;

  const drawBars = (cid, dataObj, color) => {
    const c = document.getElementById(cid);
    if(!c) return;
    if(c.offsetWidth) { c.width = c.offsetWidth; c.height = 180; }
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0,0,W,H);
    const keys = Object.keys(dataObj);
    if (!keys.length) return;
    const mx = Math.max(...Object.values(dataObj), 1);
    const bw = Math.min(60, Math.floor((W - 20) / keys.length) - 10);

    keys.forEach((k, i) => {
      const v = dataObj[k];
      const h = Math.max(10, Math.floor((v/mx) * (H-40)));
      const x = 20 + i * (bw + 10);
      ctx.fillStyle = color;
      ctx.fillRect(x, H-25-h, bw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(v, x+bw/2, H-30-h);
      ctx.fillText(k.slice(0,6), x+bw/2, H-10);
    });
  };

  const occMap = {};
  for (const [k,v] of Object.entries(byAud)) occMap[k] = Math.round((v.b/Math.max(v.c,1))*100);

  drawBars('chartCategory', byCat, '#3b82f6');
  drawBars('chartMonthly', byMonth, '#22d87a');
  drawBars('chartOccupancy', occMap, '#a855f7');

  const topRev = Object.fromEntries(Object.entries(revMap).sort((a,b)=>b[1]-a[1]).slice(0,5));
  drawBars('chartRevenue', topRev, '#f59e0b');

  const topEvts = evts.map(e => ({ t: e.title, d: e.date, b: (bkgs.seats[e.id]||[]).filter(Boolean).length }))
                      .sort((a,b)=>b.b-a.b).slice(0,6);
  let tbl = '<table style="width:100%;text-align:left;font-size:0.9rem;border-collapse:collapse">';
  tbl += '<tr style="border-bottom:1px solid var(--border);color:var(--text-muted)"><th style="padding:8px">Event</th><th style="padding:8px">Date</th><th style="padding:8px">Registrations</th></tr>';
  topEvts.forEach(t => {
    tbl += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:8px;font-weight:500">${escH(t.t)}</td><td style="padding:8px;color:var(--text-muted)">${formatDate(t.d)}</td><td style="padding:8px;color:var(--green)">${t.b}</td></tr>`;
  });
  tbl += '</table>';
  document.getElementById('analyticsTopEventsTable').innerHTML = tbl;

  const feedbacks = [
    { ev: "TechFest 2025", rate: "⭐⭐⭐⭐⭐", msg: "Amazing coding competition!" },
    { ev: "AI Lecture", rate: "⭐⭐⭐⭐", msg: "Very informative, but AC was too cold." },
    { ev: "Cultural Fiesta", rate: "⭐⭐⭐⭐⭐", msg: "Loved the performances and food." },
    { ev: "Startup Pitch", rate: "⭐⭐⭐", msg: "Schedule was a bit delayed." },
    { ev: "Sports Day", rate: "⭐⭐⭐⭐⭐", msg: "Great energy and well organized." }
  ];
  let fHtml = '<div style="display:flex;flex-direction:column;gap:12px;">';
  feedbacks.forEach(f => {
    fHtml += `<div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.05)">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <strong style="color:var(--accent);font-size:0.9rem">${escH(f.ev)}</strong>
        <span style="font-size:0.8rem">${f.rate}</span>
      </div>
      <div style="color:#bbb;font-size:0.85rem">${escH(f.msg)}</div>
    </div>`;
  });
  fHtml += '</div>';
  const flist = document.getElementById('analyticsFeedbackList');
  if (flist) flist.innerHTML = fHtml;
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

function addAuditorium() {
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
  if (teacher < 0 || girl < 0 || boy < 0) { toast('Seat counts cannot be negative','error'); return; }
  if (teacher + girl + boy !== cap) {
    toast(`Seat allocation (${teacher+girl+boy}) must equal total capacity (${cap})`, 'error'); return;
  }

  const auds = get(SK.AUDITORIUMS, []);
  const id = 'aud_' + Date.now();
  auds.push({ id, college, name, capacity:cap, city, facilities:fac, teacherSeats:teacher, girlSeats:girl, boySeats:boy, createdAt:new Date().toISOString() });
  set(SK.AUDITORIUMS, auds);

  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  bkgs.seats[id] = Array(cap).fill(false);
  set(SK.BOOKINGS, bkgs);

  toast('Auditorium added!','success');
  document.getElementById('aCollege').value=''; document.getElementById('aName').value='';
  document.getElementById('aCapacity').value='200'; document.getElementById('aCity').value='';
  document.getElementById('aFacilities').value='';
  document.getElementById('aTeacherSeats').value='20';
  document.getElementById('aGirlSeats').value='80';
  document.getElementById('aBoySeats').value='100';
  onSeatAllocInput();
  renderAudListAdmin();

  // FIX: Refresh the auditorium dropdown in the Create Event form after adding a new one
  populateAuditoriumSelect();
}

function renderAudListAdmin() {
  const auds = get(SK.AUDITORIUMS, []);
  const bkgs = get(SK.BOOKINGS, {seats:{}});
  document.getElementById('audListAdmin').innerHTML = auds.map(a => {
    const booked = (bkgs.seats[a.id]||[]).filter(Boolean).length;
    const t = a.teacherSeats ?? '—';
    const g = a.girlSeats    ?? '—';
    const b = a.boySeats     ?? '—';
    return `<div class="admin-list-item">
      <div class="admin-list-item-title">🎪 ${escH(a.name)}</div>
      <div class="admin-list-item-meta">🏛 ${escH(a.college)} · 📍 ${escH(a.city)} · 💺 ${a.capacity} seats · ${booked} booked</div>
      <div class="admin-list-item-meta" style="display:flex;gap:12px;margin-top:4px">
        <span title="Teacher seats">👨‍🏫 ${t}</span>
        <span title="Girls seats">👩 ${g}</span>
        <span title="Boys seats">👦 ${b}</span>
      </div>
      ${a.facilities?.length ? `<div class="admin-list-item-meta">🔧 ${a.facilities.join(', ')}</div>` : ''}
      <div class="admin-list-actions">
        <button class="admin-del-btn" onclick="deleteAuditorium('${a.id}')">Delete</button>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">No auditoriums yet.</p>';
}

function deleteAuditorium(id) {
  if (!confirm('Delete this auditorium? This also deletes all associated events and bookings.')) return;
  let auds = get(SK.AUDITORIUMS, []);
  auds = auds.filter(a => a.id !== id);
  set(SK.AUDITORIUMS, auds);

  let evts = get(SK.EVENTS, []);
  const eventsToDelete = evts.filter(e => e.auditoriumId === id);
  evts = evts.filter(e => e.auditoriumId !== id);
  set(SK.EVENTS, evts);

  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  
  // Clean up seats mapping for all events in this auditorium
  eventsToDelete.forEach(ev => {
    delete bkgs.seats[ev.id];
  });
  
  for (const k in bkgs.student) { if (bkgs.student[k]?.auditoriumId === id) delete bkgs.student[k]; }
  for (const k in bkgs.teacher) { bkgs.teacher[k] = (bkgs.teacher[k]||[]).filter(b => b.auditoriumId !== id); if (!bkgs.teacher[k].length) delete bkgs.teacher[k]; }
  set(SK.BOOKINGS, bkgs);

  toast('Auditorium deleted','success');
  renderAudListAdmin();
  populateAuditoriumSelect();
}

function populateAuditoriumSelect() {
  const auds = get(SK.AUDITORIUMS, []);
  const sel = document.getElementById('evtAuditorium');
  if (!sel) return; // guard: element may not exist yet
  sel.innerHTML = '<option value="">Select Auditorium</option>' +
    auds.map(a => `<option value="${a.id}">${escH(a.name)} — ${escH(a.college)}</option>`).join('');
}

// ===== CREATE EVENT (FIXED) =====
function adminSubmitEvent() {
  const audId = document.getElementById('evtAuditorium').value;
  const title = document.getElementById('evtTitle').value.trim();
  const cat   = document.getElementById('evtCategory').value;
  const date  = document.getElementById('evtDate').value;
  const time  = document.getElementById('evtTime').value;
  const dur   = parseInt(document.getElementById('evtDuration').value) || 2;
  const price = parseInt(document.getElementById('evtPrice').value) || 0;
  const desc  = document.getElementById('evtDesc').value.trim();
  const color = document.getElementById('evtColor').value;

  // Validate required fields with specific messages
  if (!title) { toast('Please enter an event title','error'); return; }
  if (!audId) { toast('Please select an auditorium','error'); return; }
  if (!date)  { toast('Please select an event date','error'); return; }
  if (!time)  { toast('Please select an event time','error'); return; }

  // FIX: Warn if date is in the past (don't hard-block, but warn)
  const today = new Date(); today.setHours(0,0,0,0);
  const evDate = new Date(date);
  if (evDate < today) {
    toast('⚠️ Warning: Selected date is in the past. Event will not appear in Explore.','info', 5000);
  }

  // Validate duration
  if (isNaN(dur) || dur < 1 || dur > 24) { toast('Duration must be between 1 and 24 hours','error'); return; }

  // Validate price
  if (isNaN(price) || price < 0) { toast('Price cannot be negative','error'); return; }

  const auds = get(SK.AUDITORIUMS, []);
  const aud  = auds.find(a => a.id === audId);

  if (!aud) { toast('Selected auditorium not found. Please refresh.','error'); return; }

  const evtId = 'evt_' + Date.now();
  const evts  = get(SK.EVENTS, []);

  evts.push({
    id: evtId,
    title,
    category: cat,
    auditoriumId: audId,
    college: aud.college,
    date,
    time,
    duration: dur,
    price,
    color,
    description: desc,
    createdBy: state.currentUser,
    createdAt: new Date().toISOString()
  });
  set(SK.EVENTS, evts);

  // Initialise per-event seat grid
  const bkgs = get(SK.BOOKINGS, {student:{}, teacher:{}, seats:{}});
  if (!bkgs.student) bkgs.student = {};
  if (!bkgs.teacher) bkgs.teacher = {};
  if (!bkgs.seats)   bkgs.seats   = {};
  bkgs.seats[evtId] = Array(aud.capacity).fill(false);
  set(SK.BOOKINGS, bkgs);

  toast('🎉 Event published successfully!','success');

  // Clear the form
  document.getElementById('evtTitle').value    = '';
  document.getElementById('evtDate').value     = '';
  document.getElementById('evtTime').value     = '';
  document.getElementById('evtDesc').value     = '';
  document.getElementById('evtDuration').value = '2';
  document.getElementById('evtPrice').value    = '0';
  document.getElementById('evtAuditorium').value = '';
  document.getElementById('evtCategory').value = 'tech';
  document.getElementById('evtColor').value    = '#6c63ff';

  // FIX: Refresh the events list AND switch to it so admin can see the new event
  renderEventsAdmin();
  switchAdminTab('events');
}

// ===== RENDER EVENTS ADMIN (FIXED: use event ID for delete, not array index) =====
function renderEventsAdmin() {
  const evts = get(SK.EVENTS, []);
  const auds = get(SK.AUDITORIUMS, []);
  const bkgs = get(SK.BOOKINGS, {seats:{}});

  if (!evts.length) {
    document.getElementById('eventsAdminList').innerHTML =
      '<p style="color:var(--text-muted);font-size:0.85rem">No events yet. Create one using the form.</p>';
    return;
  }

  document.getElementById('eventsAdminList').innerHTML = evts.map(ev => {
    const aud = auds.find(a => a.id === ev.auditoriumId);
    const bookedCount = (bkgs.seats[ev.id] || []).filter(Boolean).length;
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
      <div class="admin-list-actions">
        <button class="admin-del-btn" onclick="adminRemoveEvent('${ev.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

// FIX: adminRemoveEvent now takes event ID (string) instead of array index (number)
// This prevents index-mismatch bugs when events are reordered or filtered
function adminRemoveEvent(evtId) {
  if (!confirm('Delete this event? All bookings for this event will also be removed.')) return;
  
  let evts = get(SK.EVENTS, []);
  const ev = evts.find(e => e.id === evtId);
  if (!ev) { toast('Event not found','error'); return; }

  evts = evts.filter(e => e.id !== evtId);
  set(SK.EVENTS, evts);

  // Clean up bookings for this event
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  delete bkgs.seats[evtId];

  // Remove student bookings tied to this event
  for (const email in bkgs.student) {
    if (bkgs.student[email]?.eventId === evtId) delete bkgs.student[email];
  }
  // Remove teacher bookings tied to this event
  for (const email in bkgs.teacher) {
    bkgs.teacher[email] = (bkgs.teacher[email] || []).filter(b => b.eventId !== evtId);
    if (!bkgs.teacher[email].length) delete bkgs.teacher[email];
  }
  set(SK.BOOKINGS, bkgs);

  toast('Event deleted','success');
  renderEventsAdmin();
}

function renderBookingsAdmin(filter='') {
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  const auds = get(SK.AUDITORIUMS, []);
  let html = '';

  for (const [email, b] of Object.entries(bkgs.student||{})) {
    if (!b) continue;
    if (filter && !email.includes(filter) && !String(b.seat).includes(filter) && !b.eventTitle.toLowerCase().includes(filter)) continue;
    const aud = auds.find(a => a.id===b.auditoriumId);
    html += `<div class="admin-list-item">
      <div class="admin-list-item-title">🎓 ${escH(email)}</div>
      <div class="admin-list-item-meta">🎭 ${escH(b.eventTitle)} · 🎪 ${escH(aud?.name||'Unknown')} · 💺 Seat #${b.seat} · ${b.price>0?`₹${b.price}`:'Free'}</div>
      <div class="admin-list-item-meta">🎟 ${b.id} · ${formatDateTime(b.bookedAt)}</div>
      <div class="admin-list-actions"><button class="admin-del-btn" onclick="adminCancelStudent('${email}')">Cancel Booking</button></div>
    </div>`;
  }

  for (const [email, list] of Object.entries(bkgs.teacher||{})) {
    if (!list?.length) continue;
    list.forEach(b => {
      if (filter && !email.includes(filter) && !String(b.seat).includes(filter) && !b.eventTitle.toLowerCase().includes(filter)) return;
      const aud = auds.find(a => a.id===b.auditoriumId);
      const isAdm = MASTER_ADMINS.includes(email);
      html += `<div class="admin-list-item">
        <div class="admin-list-item-title">${isAdm?'👑':'👨‍🏫'} ${escH(email)}</div>
        <div class="admin-list-item-meta">🎭 ${escH(b.eventTitle)} · 🎪 ${escH(aud?.name||'Unknown')} · 💺 Seat #${b.seat} · ${b.price>0?`₹${b.price}`:'Free'}</div>
        <div class="admin-list-item-meta">🎟 ${b.id} · ${formatDateTime(b.bookedAt)}</div>
        <div class="admin-list-actions"><button class="admin-del-btn" onclick="adminCancelTeacher('${email}','${b.id}')">Cancel Booking</button></div>
      </div>`;
    });
  }

  document.getElementById('allBookingsAdmin').innerHTML = html || '<p style="color:var(--text-muted);font-size:0.85rem;padding:16px">No bookings found.</p>';
}

function adminSearchBookings() {
  renderBookingsAdmin(document.getElementById('adminSearch').value.toLowerCase().trim());
}

function adminCancelStudent(email) {
  if (!confirm(`Cancel booking for ${email}?`)) return;
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  const b = bkgs.student[email];
  if (b && bkgs.seats[b.eventId]) bkgs.seats[b.eventId][b.seat-1] = false;
  delete bkgs.student[email];
  set(SK.BOOKINGS, bkgs);
  toast('Booking cancelled','success');
  renderBookingsAdmin();
}

function adminCancelTeacher(email, bookingId) {
  if (!confirm(`Cancel booking for ${email}?`)) return;
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  const list = bkgs.teacher[email] || [];
  const idx = list.findIndex(b => b.id===bookingId);
  if (idx !== -1) {
    const b = list[idx];
    if (bkgs.seats[b.eventId]) bkgs.seats[b.eventId][b.seat-1] = false;
    list.splice(idx, 1);
    if (!list.length) delete bkgs.teacher[email];
  }
  set(SK.BOOKINGS, bkgs);
  toast('Booking cancelled','success');
  renderBookingsAdmin();
}

function clearAllBookings() {
  if (!confirm('⚠️ Clear ALL bookings? Users keep their accounts but lose all reservations.')) return;
  const bkgs = get(SK.BOOKINGS, {student:{},teacher:{},seats:{}});
  bkgs.student = {};
  bkgs.teacher = {};
  const evts = get(SK.EVENTS, []);
  const auds = get(SK.AUDITORIUMS, []);
  bkgs.seats = {};
  evts.forEach(ev => {
    const aud = auds.find(a => a.id === ev.auditoriumId);
    if (aud) bkgs.seats[ev.id] = Array(aud.capacity).fill(false);
  });
  set(SK.BOOKINGS, bkgs);
  toast('All bookings cleared','success');
  renderBookingsAdmin();
}

function resetSystem() {
  if (!confirm('⚠️ RESET ENTIRE SYSTEM? This deletes ALL data. Type "RESET" to confirm.')) return;
  const input = prompt('Type RESET to confirm:');
  if (input !== 'RESET') { toast('Reset cancelled','info'); return; }
  localStorage.clear();
  location.reload();
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
  const end = h + hours;
  return `${String(end).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initData();

  // Bind static buttons
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('signupBtn').addEventListener('click', handleSignup);

  // Auto-login from session
  const session = get(SK.SESSION);
  if (session?.email) {
    const users = get(SK.USERS, {});
    if (users[session.email]) {
      loginUser(session.email);
      return;
    }
  }
  document.getElementById('authPage').classList.add('active');
});