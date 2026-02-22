import { icons } from '../components/icons.js';

export function render() {
  const { ws } = window.__app;
  const connected = ws.isConnected();
  const s = ws.state;
  const d = s._dashboard || {};

  return `<div class="page-header"><h1>仪表盘</h1><p>OpenClaw Gateway 概览</p></div>
    <div class="card-grid">
      <div class="glass-card">
        <div class="card-title">Gateway</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="status-dot ${connected ? 'on' : 'off'}" style="width:12px;height:12px"></div>
          <div class="card-value" style="font-size:20px">${connected ? '运行中' : '未连接'}</div>
        </div>
        <div class="card-sub">${s.settings.url || '—'}</div>
        ${d.version ? `<div class="card-sub">v${d.version}${d.uptime ? ' · 运行 ' + fmtUptime(d.uptime) : ''}</div>` : ''}
        <div style="margin-top:14px">
          <button class="btn ${connected ? 'btn-secondary' : 'btn-primary'} btn-sm" id="gw-toggle">
            ${connected ? icons.stop + ' 断开' : icons.play + ' 连接'}
          </button>
        </div>
      </div>
      <div class="glass-card">
        <div class="card-title">会话统计</div>
        <div class="card-value">${s.sessions.length}</div>
        <div class="card-sub">活跃会话</div>
        ${d.tokenTotal ? `<div class="card-sub" style="margin-top:6px">累计 ${fmtNum(d.tokenTotal)} tokens</div>` : ''}
      </div>
      <div class="glass-card">
        <div class="card-title">Agents (${s.agents.length})</div>
        <div id="agent-list">${renderAgents(s.agents)}</div>
      </div>
      <div class="glass-card">
        <div class="card-title">模型</div>
        <div id="model-list">${renderModels(s.models)}</div>
      </div>
      <div class="glass-card">
        <div class="card-title">渠道</div>
        <div id="ch-list">${renderChannels(s.channels)}</div>
      </div>
    </div>
    <div style="margin-top:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="card-title" style="margin:0">最近会话</div>
        <button class="btn btn-secondary btn-sm" id="refresh-btn">${icons.loader} 刷新</button>
      </div>
      <div id="sessions-list">${renderSessions(s.sessions)}</div>
    </div>`;
}

function renderAgents(agents) {
  if (!agents.length) return '<span style="color:var(--fg2);font-size:13px">—</span>';
  return agents.map(a => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <span style="font-size:16px">${a.emoji || '🤖'}</span>
    <div><div style="font-size:13px;font-weight:500">${a.name || a.id}</div>
    ${a.model ? `<div style="font-size:11px;color:var(--fg3)">${a.model}</div>` : ''}</div>
  </div>`).join('');
}

function renderModels(models) {
  if (!models.length) return '<span style="color:var(--fg2);font-size:13px">—</span>';
  return models.slice(0, 5).map(m => `<div style="font-size:13px;margin-bottom:4px;display:flex;justify-content:space-between">
    <span>${m.name || m.id}</span>
    ${m.provider ? `<span style="color:var(--fg3);font-size:11px">${m.provider}</span>` : ''}
  </div>`).join('') + (models.length > 5 ? `<div style="font-size:11px;color:var(--fg3)">+${models.length - 5} 更多</div>` : '');
}

function renderChannels(channels) {
  if (!channels.length) return '<span style="color:var(--fg2);font-size:13px">无渠道</span>';
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
    const model = s.model || '';
    const age = s.lastActiveAt ? fmtAge(s.lastActiveAt) : '';
    return `<div class="glass-card" style="padding:12px 16px;margin-bottom:6px;cursor:pointer;transform:none" data-key="${s.sessionKey || ''}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${label}</div>
          <div style="font-size:11px;color:var(--fg3)">${[agent, model].filter(Boolean).join(' · ')}</div></div>
        <div style="text-align:right">
          <span class="badge badge-success">活跃</span>
          ${age ? `<div style="font-size:10px;color:var(--fg3);margin-top:2px">${age}</div>` : ''}
        </div>
      </div></div>`;
  }).join('');
}

function fmtUptime(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function fmtNum(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n); }

function fmtAge(ts) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

export function mount(el) {
  // Load extended dashboard data
  loadExtended();

  el.querySelector('#gw-toggle')?.addEventListener('click', () => {
    const { ws } = window.__app;
    if (ws.isConnected()) ws.disconnect(); else window.__app.tryConnect();
    setTimeout(() => { el.querySelector('.fade-in').innerHTML = render(); mount(el); }, 500);
  });
  el.querySelector('#refresh-btn')?.addEventListener('click', async () => {
    await window.__app.ws.loadDashboardData();
    await loadExtended();
    el.querySelector('.fade-in').innerHTML = render();
    mount(el);
  });
  el.querySelector('#sessions-list')?.addEventListener('click', e => {
    const card = e.target.closest('[data-key]');
    if (card?.dataset.key) { sessionStorage.setItem('chat-session', card.dataset.key); location.hash = 'chat'; }
  });
}

async function loadExtended() {
  const { ws } = window.__app;
  if (!ws.isConnected()) return;
  try {
    const status = await ws.observe.status();
    ws.state._dashboard = {
      version: status?.version,
      uptime: status?.uptime,
      tokenTotal: status?.tokenUsage?.total,
    };
  } catch {}
}
