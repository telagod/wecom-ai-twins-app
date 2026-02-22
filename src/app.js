import { t } from './i18n.js';
import { icons } from './components/icons.js';
import * as ws from './components/ws-client.js';

const routes = { setup: './views/setup.js', dashboard: './views/dashboard.js', chat: './views/chat.js', agents: './views/agents.js', settings: './views/settings.js' };
const navItems = [
  { id: 'dashboard', icon: 'home', label: t('dash.title') },
  { id: 'chat', icon: 'chat', label: t('chat.sessions') },
  { id: 'agents', icon: 'agents', label: 'Agents' },
  { id: 'settings', icon: 'settings', label: t('settings.title') },
];

const $nav = document.getElementById('nav');
const $content = document.getElementById('content');
const $dot = document.getElementById('gw-dot');
const $gwLabel = document.getElementById('gw-label');
const $sidebar = document.getElementById('sidebar');
const $backdrop = document.getElementById('sidebar-backdrop');

$nav.innerHTML = navItems.map(n =>
  `<div class="nav-item" data-route="${n.id}">${icons[n.icon]}<span>${n.label}</span></div>`
).join('');
$nav.addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (item) { navigate(item.dataset.route); closeSidebar(); }
});

// Mobile menu toggle
function closeSidebar() { $sidebar.classList.remove('open'); $backdrop.classList.remove('show'); }
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  const open = $sidebar.classList.toggle('open');
  $backdrop.classList.toggle('show', open);
});
$backdrop.addEventListener('click', closeSidebar);

// Touch tap to expand sidebar on large screens (tablets)
$sidebar.addEventListener('click', e => {
  if (window.innerWidth > 768 && !e.target.closest('.nav-item') && !$sidebar.classList.contains('open')) {
    $sidebar.classList.toggle('open');
  }
});

let currentView = null;

async function navigate(route) {
  if (!routes[route]) route = 'dashboard';
  location.hash = route;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  try {
    const mod = await import(routes[route]);
    if (currentView?.destroy) currentView.destroy();
    currentView = mod;
    $content.innerHTML = `<div class="fade-in">${mod.render()}</div>`;
    if (mod.mount) mod.mount($content);
  } catch (e) {
    $content.innerHTML = `<div class="fade-in"><p style="color:var(--danger)">Load failed: ${e.message}</p></div>`;
  }
}

function setGwStatus(cls, label) { $dot.className = 'status-dot ' + cls; $gwLabel.textContent = label; }

// Toast notifications
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Auto-connect logic
function tryConnect() {
  const s = ws.state.settings;
  if (s.url && s.token) {
    ws.connect(setGwStatus);
  } else {
    // Try default localhost
    s.url = s.url || 'ws://127.0.0.1:18789';
    ws.saveSettings(s);
    if (s.token) ws.connect(setGwStatus);
  }
}

// Events
ws.on('status', connected => {
  setGwStatus(connected ? 'on' : 'off', connected ? t('common.connected') : t('common.notConnected'));
  if (connected) {
    toast(t('common.connected'), 'success');
    ws.loadDashboardData();
    // Auto-refresh every 30s
    clearInterval(window.__refreshTimer);
    window.__refreshTimer = setInterval(() => { if (ws.isConnected()) ws.loadDashboardData(); }, 30000);
  } else {
    clearInterval(window.__refreshTimer);
    // Auto-reconnect after 5s
    setTimeout(() => { if (!ws.isConnected() && ws.state.settings.token) tryConnect(); }, 5000);
  }
});
ws.on('agent', payload => { if (currentView?.onAgentEvent) currentView.onAgentEvent(payload); });
ws.on('chat', payload => { if (currentView?.onChatEvent) currentView.onChatEvent(payload); });

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '1') { e.preventDefault(); navigate('dashboard'); }
    if (e.key === '2') { e.preventDefault(); navigate('chat'); }
    if (e.key === '3') { e.preventDefault(); navigate('agents'); }
    if (e.key === '4') { e.preventDefault(); navigate('settings'); }
  }
});

// Init — skip setup if token exists
const hash = location.hash.slice(1);
const startRoute = hash && routes[hash] ? hash : (ws.state.settings.token ? 'dashboard' : 'setup');
navigate(startRoute);
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
tryConnect();

window.__app = { ws, setGwStatus, tryConnect, navigate, toast };

// Kill gateway child process on app exit
window.addEventListener('beforeunload', async () => {
  try {
    const setup = await import('./views/setup.js');
    const child = setup.getChild();
    if (child) await child.kill();
  } catch {}
});

// Auto-update check
async function checkUpdate(silent = true) {
  try {
    const updater = window.__TAURI__?.updater;
    if (!updater) return;
    const update = await updater.check();
    if (update?.available) {
      toast(`v${update.version} available`, 'info');
      window.__app._pendingUpdate = update;
    } else if (!silent) {
      toast(t('settings.upToDate') || 'Up to date', 'success');
    }
  } catch (e) { if (!silent) toast('Update check failed: ' + e.message, 'error'); }
}
window.__app.checkUpdate = checkUpdate;
setTimeout(() => checkUpdate(), 5000);

// Notifications
async function notify(title, body) {
  try {
    const n = window.__TAURI__?.notification;
    if (n) { await n.sendNotification({ title, body }); return; }
    if (Notification.permission === 'granted') new Notification(title, { body });
    else if (Notification.permission !== 'denied') { const p = await Notification.requestPermission(); if (p === 'granted') new Notification(title, { body }); }
  } catch {}
}
window.__app.notify = notify;

// Listen for events from Gateway
ws.on('status', connected => {
  if (!connected) notify('OpenClaw', '⚠️ Gateway disconnected');
});
ws.on('chat.message', payload => {
  if (document.hidden && payload?.text) notify('OpenClaw', payload.text.slice(0, 100));
});
