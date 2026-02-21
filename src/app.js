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

$nav.innerHTML = navItems.map(n =>
  `<div class="nav-item" data-route="${n.id}">${icons[n.icon]}<span>${n.label}</span></div>`
).join('');
$nav.addEventListener('click', e => { const item = e.target.closest('.nav-item'); if (item) navigate(item.dataset.route); });

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

function setGwStatus(cls, label) { $dot.className = 'status-dot ' + cls; $gwLabel.textContent = label; }

function tryConnect() {
  if (ws.state.settings.url && ws.state.settings.token) {
    ws.connect(setGwStatus);
  }
}

// Gateway events
ws.on('status', connected => {
  setGwStatus(connected ? 'on' : 'off', connected ? '已连接' : '已断开');
  if (connected) ws.loadDashboardData();
});
ws.on('agent', payload => { if (currentView?.onAgentEvent) currentView.onAgentEvent(payload); });
ws.on('chat', payload => { if (currentView?.onChatEvent) currentView.onChatEvent(payload); });
ws.on('tick', () => {}); // heartbeat

const hash = location.hash.slice(1) || (ws.state.settings.token ? 'dashboard' : 'setup');
navigate(hash);
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
tryConnect();

window.__app = { ws, setGwStatus, tryConnect, navigate };
