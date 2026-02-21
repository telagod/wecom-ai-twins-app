import { icons } from './components/icons.js';
import * as ws from './components/ws-client.js';

const routes = { setup: './views/setup.js', dashboard: './views/dashboard.js', chat: './views/chat.js', agents: './views/agents.js', settings: './views/settings.js' };
const navItems = [
  { id: 'dashboard', icon: 'home', label: '仪表盘' },
  { id: 'chat', icon: 'chat', label: '对话' },
  { id: 'agents', icon: 'agents', label: 'Agents' },
  { id: 'settings', icon: 'settings', label: '设置' },
];

const $nav = document.getElementById('nav');
const $content = document.getElementById('content');
const $dot = document.getElementById('gw-dot');
const $gwLabel = document.getElementById('gw-label');
const $sidebar = document.getElementById('sidebar');

$nav.innerHTML = navItems.map(n =>
  `<div class="nav-item" data-route="${n.id}">${icons[n.icon]}<span>${n.label}</span></div>`
).join('');
$nav.addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (item) { navigate(item.dataset.route); $sidebar.classList.remove('open'); }
});

// Mobile menu toggle
document.getElementById('menu-toggle')?.addEventListener('click', () => $sidebar.classList.toggle('open'));
document.addEventListener('click', e => {
  if (window.innerWidth <= 900 && $sidebar.classList.contains('open') && !$sidebar.contains(e.target) && e.target.id !== 'menu-toggle') $sidebar.classList.remove('open');
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
    const menuBtn = $content.querySelector('#menu-toggle');
    $content.innerHTML = `<div class="fade-in">${mod.render()}</div>`;
    if (menuBtn) $content.prepend(menuBtn);
    if (mod.mount) mod.mount($content);
  } catch (e) {
    $content.innerHTML = `<div class="fade-in"><p style="color:var(--danger)">加载失败: ${e.message}</p></div>`;
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
  setGwStatus(connected ? 'on' : 'off', connected ? '已连接' : '已断开');
  if (connected) {
    toast('Gateway 已连接', 'success');
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
