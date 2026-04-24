// ══════════════════════════════════════════
//  TommyLC CRM — Shared Utilities (PostgreSQL)
// ══════════════════════════════════════════

/* ── API base ── */
const API = '';  // same origin — Railway serves both

/* ── Generic fetch helpers ── */
async function apiGet(path) {
  const r = await fetch(API + path);
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiPost(path, data) {
  const r = await fetch(API + path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiPut(path, data) {
  const r = await fetch(API + path, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || r.statusText); }
  return r.json();
}
async function apiDelete(path) {
  const r = await fetch(API + path, { method:'DELETE' });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error || r.statusText); }
  return r.json();
}

/* ── ID generator ── */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── Format helpers ── */
function formatCurrency(n) { return '$' + Number(n || 0).toFixed(2); }
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

/* ── Avatar ── */
const AVATAR_COLORS = ['#FF0000','#1D4ED8','#1E6B45','#7C3AED','#A05C00','#0891B2','#BE185D','#D97706'];
function avatarColor(name) {
  let h = 0;
  for (let c of (name||'?')) h = (h<<5)-h+c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) {
  return (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
}

// ══════════════════════════════════════════
//  AUTH & ROLES
// ══════════════════════════════════════════

const ROLE_PERMISSIONS = {
  'CEO':        ['dashboard','students','groups','payments','teachers','classrooms','settings'],
  'Manager':    ['dashboard','students','groups','payments','teachers','classrooms','settings'],
  'Head Admin': ['dashboard','students','groups','teachers','classrooms'],
  'Admin':      ['dashboard','students','groups','classrooms'],
};

const ROLE_META = {
  'CEO':        { color:'#FF0000', badge:'badge-red',   label:'CEO'        },
  'Manager':    { color:'#CC0000', badge:'badge-red',   label:'Manager'    },
  'Head Admin': { color:'#1d4ed8', badge:'badge-blue',  label:'Head Admin' },
  'Admin':      { color:'#1E6B45', badge:'badge-green', label:'Admin'      },
};

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('lc_session') || localStorage.getItem('lc_session') || 'null'); }
  catch { return null; }
}
function setSession(data) {
  const s = JSON.stringify(data);
  sessionStorage.setItem('lc_session', s);
  localStorage.setItem('lc_session', s);
}
function getRole() { const s = getSession(); return s ? s.role : null; }
function can(feature) { const role = getRole(); return !!(role && (ROLE_PERMISSIONS[role]||[]).includes(feature)); }

function requireAuth(requiredFeature) {
  const session = getSession();
  if (!session) { window.location.replace('login.html'); return; }
  if (requiredFeature && !can(requiredFeature)) {
    sessionStorage.setItem('lc_access_denied', requiredFeature);
    window.location.replace('index.html');
  }
}
function logout() {
  sessionStorage.removeItem('lc_session');
  localStorage.removeItem('lc_session');
  window.location.replace('login.html');
}

// ── Activity log (fire-and-forget) ──
function logActivity(text, color) {
  const session = getSession();
  apiPost('/api/activity', {
    text, color: color||'',
    actor: session?.name || 'System',
    role:  session?.role  || ''
  }).catch(() => {});
}

// ── Toast ──
function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type||'success');
  toast.innerHTML = `<span>${type==='error'?'⚠️':'✓'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function checkAccessDeniedMessage() {
  const denied = sessionStorage.getItem('lc_access_denied');
  if (denied) {
    sessionStorage.removeItem('lc_access_denied');
    const labels = { payments:'Payments', teachers:'Teachers', settings:'Users', groups:'Groups', classrooms:'Classrooms' };
    showToast(`Your role does not have access to ${labels[denied]||denied}.`, 'error');
  }
}

// ── Modal helpers ──
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ── Sidebar ──
function renderSidebar(activePage) {
  const session = getSession();
  if (!session) return;

  const NAV_ITEMS = [
    { feature:'dashboard',  href:'index.html',      icon:'⊞', label:'Dashboard'  },
    { feature:'students',   href:'students.html',   icon:'👤', label:'Students'   },
    { feature:'groups',     href:'groups.html',     icon:'👥', label:'Groups'     },
    { feature:'payments',   href:'payments.html',   icon:'💳', label:'Payments'   },
    { feature:'teachers',   href:'teachers.html',   icon:'🎓', label:'Teachers'   },
    { feature:'classrooms', href:'classrooms.html', icon:'🏛', label:'Classrooms' },
    { feature:'settings',   href:'users.html',      icon:'🔧', label:'Users'      },
  ];

  const meta = ROLE_META[session.role] || ROLE_META['Admin'];
  const navHTML = NAV_ITEMS
    .filter(item => can(item.feature))
    .map(item => {
      const isActive = item.feature === activePage;
      return `<a href="${item.href}" class="nav-link${isActive?' active':''}"><span class="icon">${item.icon}</span> ${item.label}</a>`;
    }).join('');

  const sidebarHTML = `
    <a href="index.html" class="sidebar-brand" style="text-decoration:none;display:block;">
      <div class="brand-name">TommyLC</div>
      <div class="brand-sub">Admin Portal</div>
    </a>
    <div class="nav-section">
      <div class="nav-label">Main</div>
      ${navHTML}
    </div>
    <div class="sidebar-footer">
      <div class="user-pill" style="margin-bottom:10px">
        <div class="user-avatar" style="background:${meta.color}">${session.avatar||initials(session.name)}</div>
        <div class="user-info">
          <div class="user-name">${session.name}</div>
          <div class="user-role"><span class="badge ${meta.badge}" style="font-size:9px;padding:1px 7px">${session.role}</span></div>
        </div>
      </div>
      <button onclick="logout()" style="width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);border-radius:8px;padding:8px;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.14)';this.style.color='white'" onmouseout="this.style.background='rgba(255,255,255,0.07)';this.style.color='rgba(255,255,255,0.55)'">
        Sign Out
      </button>
    </div>`;

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.innerHTML = sidebarHTML;

  // Mobile hamburger
  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('menuToggle')) {
    const toggle = document.createElement('button');
    toggle.id = 'menuToggle';
    toggle.className = 'menu-toggle';
    toggle.innerHTML = '<span></span><span></span><span></span>';
    toggle.onclick = toggleSidebar;
    topbar.insertBefore(toggle, topbar.firstChild);
  }
  if (!document.getElementById('sidebarOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
}

function toggleSidebar() {
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  const open = s?.classList.contains('open');
  s?.classList.toggle('open', !open);
  o?.classList.toggle('show', !open);
}
function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}
document.addEventListener('click', e => {
  if (e.target.closest('.nav-link') && window.innerWidth <= 640) closeSidebar();
});