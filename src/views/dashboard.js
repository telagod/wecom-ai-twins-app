import { icons } from '../components/icons.js';

export function render() {
  const { ws } = window.__app;
  const connected = ws.isConnected();
  const s = ws.state;
  return `<div class="page-header"><h1>仪表盘</h1><p>OpenClaw Gateway 概览</p></div>
    <div class="card-grid">
      <div class="glass-card">
        <div class="card-title">Gateway</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="status-dot ${connected ? 'on' : 'off'}" style="width:12px;height:12px"></div>
          <div class="card-value" style="font-size:20px">${connected ? '运行中' : '未连接'}</div>
        </div>
        <div class="card-sub">${ws.state.settings.url || 'ws://127.0.0.1:18789'}</div>
        <div style="margin-top:14px">
          <button class="btn ${connected ? 'btn-secondary' : 'btn-primary'} btn-sm" id="gw-toggle">
            ${connected ? icons.stop + ' 断开' : icons.play + ' 连接'}
          </button>
        </div>
      </div>
      <div class="glass-card">
        <div class="card-title">Agents</div>
        <div class="card-value">${s.agents.length}</div>
        <div class="card-sub" id="agent-names">${s.agents.map(a => a.name || a.id).join(', ') || '—'}</div>
      </div>
      <div class="glass-card">
        <div class="card-title">渠道</div>
        <div id="ch-list">${renderChannels(s.channels)}</div>
      </div>
      <div class="glass-card">
        <div class="card-title">模型</div>
        <div id="model-list">${s.models.length ? s.models.map(m => `<div style="font-size:13px;margin-bottom:4px">${m.name || m.id}</div>`).join('') : '<span style="color:var(--fg2)">—</span>'}</div>
      </div>
    </div>
    <div style="margin-top:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="card-title" style="margin:0">会话 (${s.sessions.length})</div>
        <button class="btn btn-secondary btn-sm" id="refresh-btn">${icons.loader} 刷新</button>
      </div>
      <div id="sessions-list">${renderSessions(s.sessions)}</div>
    </div>`;
}

function renderChannels(channels) {
  if (!channels.length) return '<span style="color:var(--fg2)">无渠道</span>';
  return channels.map(ch => {
    const ok = ch.connected || ch.status === 'connected' || ch.status === 'ok';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span class="badge ${ok ? 'badge-success' : 'badge-danger'}">${ok ? '在线' : '离线'}</span>
      <span style="font-size:13px">${ch.label || ch.id || ch.channel}</span>
    </div>`;
  }).join('');
}

function renderSessions(sessions) {
  if (!sessions.length) return '<div class="glass-card" style="padding:14px;color:var(--fg2);font-size:13px">暂无会话</div>';
  return sessions.slice(0, 10).map(s => {
    const label = s.displayName || s.origin?.label || s.sessionKey || '未知';
    const agent = s.agentId || '';
    return `<div class="glass-card" style="padding:12px 16px;margin-bottom:6px;cursor:pointer" data-key="${s.sessionKey || ''}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:14px;font-weight:500">${label}</div>${agent ? `<div style="font-size:11px;color:var(--fg3)">agent: ${agent}</div>` : ''}</div>
        <span class="badge badge-success">活跃</span>
      </div></div>`;
  }).join('');
}

export function mount(el) {
  el.querySelector('#gw-toggle')?.addEventListener('click', () => {
    const { ws } = window.__app;
    if (ws.isConnected()) { ws.disconnect(); } else { window.__app.tryConnect(); }
    setTimeout(() => { el.querySelector('.fade-in').innerHTML = render(); mount(el); }, 500);
  });
  el.querySelector('#refresh-btn')?.addEventListener('click', async () => {
    await window.__app.ws.loadDashboardData();
    el.querySelector('.fade-in').innerHTML = render();
    mount(el);
  });
  el.querySelector('#sessions-list')?.addEventListener('click', e => {
    const card = e.target.closest('[data-key]');
    if (card?.dataset.key) { sessionStorage.setItem('chat-session', card.dataset.key); location.hash = 'chat'; }
  });
}
