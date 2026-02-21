import { icons } from './components/icons.js';
import * as ws from './components/ws-client.js';

const routes = { setup: './views/setup.js', dashboard: './views/dashboard.js', chat: './views/chat.js', settings: './views/settings.js' };
const navItems = [
  { id: 'dashboard', icon: 'home', label: '仪表盘' },
  { id: 'chat', icon: 'chat', label: '对话' },
  { id: 'settings', icon: 'settings', label: '设置' },
];

const $nav = document.getElementById('nav');
const $content = document.getElementById('content');
const $dot = document.getElementById('gw-dot');
const $gwLabel = document.getElementById('gw-label');

// Render sidebar nav
$nav.innerHTML = navItems.map(n =>
  `<div class="nav-item" data-route="${n.id}">${icons[n.icon]}<span>${n.label}</span></div>`
).join('');

$nav.addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (item) navigate(item.dataset.route);
});

let currentView = null;

async function navigate(route) {
  if (!routes[route]) route = 'dashboard';
  location.hash = route;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  try {
    const mod = await import(routes[route]);
    $content.innerHTML = '';
    if (currentView?.destroy) currentView.destroy();
    currentView = mod;
    $content.innerHTML = `<div class="fade-in">${mod.render()}</div>`;
    if (mod.mount) mod.mount($content);
  } catch (e) {
    $content.innerHTML = `<div class="fade-in"><p style="color:var(--danger)">加载失败: ${e.message}</p></div>`;
  }
}

// Gateway status
export function setGwStatus(cls, label) {
  $dot.className = 'status-dot ' + cls;
  $gwLabel.textContent = label;
}

// Message handler
export function handleGwMessage(msg) {
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    ws.sendConnect(msg.payload?.nonce);
    return;
  }
  if (msg.type === 'res' && msg.payload?.type === 'hello-ok') {
    ws.state.connected = true;
    setGwStatus('on', '已连接');
    ws.fetchSessions();
    return;
  }
  if (msg.type === 'res' && msg.ok && Array.isArray(msg.payload?.sessions)) {
    ws.state.sessions = msg.payload.sessions;
  }
  // Forward to current view
  if (currentView?.onMessage) currentView.onMessage(msg);
}

// Auto-connect if settings exist
export function tryConnect() {
  if (ws.state.settings.url && ws.state.settings.token) {
    ws.connect(handleGwMessage, setGwStatus);
  }
}

// Init
const hash = location.hash.slice(1) || (ws.state.settings.token ? 'dashboard' : 'setup');
navigate(hash);
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
tryConnect();

// Export for views
window.__app = { ws, setGwStatus, handleGwMessage, tryConnect, navigate };
