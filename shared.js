// ══════════════════════════════════════════
//  TommyLC CRM — Shared Utilities
// ══════════════════════════════════════════

// ── DB helpers (localStorage) ──
function getDB(key) {
  try { return JSON.parse(localStorage.getItem('lc_' + key) || '[]'); }
  catch { return []; }
}

function setDB(key, data) {
  localStorage.setItem('lc_' + key, JSON.stringify(data));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ══════════════════════════════════════════
//  AUTH & ROLES
// ══════════════════════════════════════════

const ROLE_PERMISSIONS = {
  'CEO':        ['dashboard', 'students', 'schedule', 'payments', 'teachers', 'settings'],
  'Manager':    ['dashboard', 'students', 'schedule', 'payments', 'teachers', 'settings'],
  'Head Admin': ['dashboard', 'students', 'schedule', 'teachers'],
  'Admin':      ['dashboard', 'students', 'schedule'],
};

const ROLE_META = {
  'CEO':        { color: '#FF0000', badge: 'badge-red',   label: 'CEO'        },
  'Manager':    { color: '#CC0000', badge: 'badge-red',   label: 'Manager'    },
  'Head Admin': { color: '#1d4ed8', badge: 'badge-blue',  label: 'Head Admin' },
  'Admin':      { color: '#1E6B45', badge: 'badge-green', label: 'Admin'      },
};

function getSession() {
  try { return JSON.parse(localStorage.getItem('lc_session') || 'null'); }
  catch { return null; }
}

function getRole() {
  const s = getSession();
  return s ? s.role : null;
}

function can(feature) {
  const role = getRole();
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] || []).includes(feature);
}

function requireAuth(requiredFeature) {
  const session = getSession();
  if (!session) { window.location.replace('login.html'); return; }
  if (requiredFeature && !can(requiredFeature)) {
    sessionStorage.setItem('lc_access_denied', requiredFeature);
    window.location.replace('index.html');
  }
}

function logout() {
  localStorage.removeItem('lc_session');
  window.location.replace('login.html');
}

// ── Render sidebar dynamically based on role ──
function renderSidebar(activePage) {
  const session = getSession();
  if (!session) return;

  const NAV_ITEMS = [
    { feature: 'dashboard', href: 'index.html',    icon: '⊞', label: 'Dashboard' },
    { feature: 'students',  href: 'students.html', icon: '👤', label: 'Students'  },
    { feature: 'schedule',  href: 'schedule.html', icon: '📅', label: 'Schedule'  },
    { feature: 'payments',  href: 'payments.html', icon: '💳', label: 'Payments'  },
    { feature: 'teachers',  href: 'teachers.html', icon: '🎓', label: 'Teachers'  },
    { feature: 'settings',  href: 'users.html',    icon: '👥', label: 'Users'     },
  ];

  const meta = ROLE_META[session.role] || ROLE_META['Admin'];

  const navHTML = NAV_ITEMS.map(item => {
    if (!can(item.feature)) return '';
    const isActive = item.feature === activePage;
    return `<a href="${item.href}" class="nav-link${isActive ? ' active' : ''}"><span class="icon">${item.icon}</span> ${item.label}</a>`;
  }).join('');

  const sidebarHTML = `
    <div class="sidebar-brand">
      <div class="brand-name">TommyLC</div>
      <div class="brand-sub">Admin Portal</div>
    </div>
    <div class="nav-section">
      <div class="nav-label">Main</div>
      ${navHTML}
    </div>
    <div class="sidebar-footer">
      <div class="user-pill" style="margin-bottom:10px">
        <div class="user-avatar">${session.avatar || initials(session.name)}</div>
        <div class="user-info">
          <div class="user-name">${session.name}</div>
          <div class="user-role"><span style="font-size:10px;color:rgba(255,255,255,0.45);letter-spacing:1px;text-transform:uppercase">${session.role}</span></div>
        </div>
      </div>
      <button onclick="logout()" style="
        width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
        color:rgba(255,255,255,0.55);border-radius:8px;padding:8px;font-size:12px;
        cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;
      " onmouseover="this.style.background='rgba(255,255,255,0.14)';this.style.color='white'"
         onmouseout="this.style.background='rgba(255,255,255,0.07)';this.style.color='rgba(255,255,255,0.55)'">
        Sign Out
      </button>
    </div>
  `;

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.innerHTML = sidebarHTML;
}

// ── Activity log ──
function logActivity(text, color) {
  const session = getSession();
  const activity = getDB('activity');
  activity.unshift({
    text,
    color: color || '',
    actor: session ? session.name : 'System',
    role: session ? session.role : '',
    time: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
  });
  setDB('activity', activity.slice(0, 50));
}

// ── Toast notifications ──
function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'success');
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function checkAccessDeniedMessage() {
  const denied = sessionStorage.getItem('lc_access_denied');
  if (denied) {
    sessionStorage.removeItem('lc_access_denied');
    const labels = { payments:'Payments', teachers:'Teachers', settings:'Settings' };
    showToast(`Your role does not have access to ${labels[denied] || denied}.`, 'error');
  }
}

// ── Modal helpers ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ── Avatar ──
const AVATAR_COLORS = ['#FF0000','#CC0000','#990000','#C94060','#3b82f6','#1E6B45','#0891b2','#A05C00'];
function avatarColor(name) {
  let h = 0;
  for (let c of (name||'?')) h = (h << 5) - h + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

// ── Utilities ──
function filterTable(inputId, tableBodyId) {
  const val = document.getElementById(inputId).value.toLowerCase();
  document.querySelectorAll(`#${tableBodyId} tr`).forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(val) ? '' : 'none';
  });
}
function formatCurrency(n) { return '$' + Number(n || 0).toFixed(2); }
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
