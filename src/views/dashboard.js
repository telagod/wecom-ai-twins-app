import { icons } from '../components/icons.js';

export function render() {
  const connected = window.__app.ws.isConnected();
  return `<div class="page-header"><h1>仪表盘</h1><p>OpenClaw Gateway 概览</p></div>
    <div class="card-grid">
      <div class="glass-card">
        <div class="card-title">Gateway 状态</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="status-dot ${connected ? 'on' : 'off'}" style="width:12px;height:12px"></div>
          <div class="card-value" style="font-size:20px">${connected ? '运行中' : '未连接'}</div>
        </div>
        <div class="card-sub">${window.__app.ws.state.settings.url || 'ws://127.0.0.1:18789'}</div>
        <div style="margin-top:16px">
          <button class="btn ${connected ? 'btn-secondary' : 'btn-primary'} btn-sm" id="gw-toggle">
            ${connected ? icons.stop + ' 断开' : icons.play + ' 连接'}
          </button>
        </div>
      </div>
      <div class="glass-card">
        <div class="card-title">活跃会话</div>
        <div class="card-value">${window.__app.ws.state.sessions.length}</div>
        <div class="card-sub">当前 Agent 会话数</div>
      </div>
      <div class="glass-card">
        <div class="card-title">快捷操作</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          <button class="btn btn-secondary btn-sm" onclick="location.hash='chat'">${icons.chat} 打开对话</button>
          <button class="btn btn-secondary btn-sm" onclick="location.hash='settings'">${icons.settings} 配置</button>
        </div>
      </div>
    </div>
    <div style="margin-top:24px"><div class="card-title" style="margin-bottom:12px">最近会话</div>
      <div id="recent-sessions">${renderSessions()}</div>
    </div>`;
}

function renderSessions() {
  const sessions = window.__app.ws.state.sessions.slice(0, 5);
  if (!sessions.length) return '<div class="glass-card" style="padding:16px;color:var(--fg2);font-size:13px">暂无会话</div>';
  return sessions.map(s => {
    const label = s.displayName || s.origin?.label || s.sessionKey || '未知';
    return `<div class="glass-card" style="padding:14px;margin-bottom:8px;cursor:pointer" onclick="location.hash='chat'">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:500">${label}</span>
        <span class="badge badge-success">活跃</span>
      </div></div>`;
  }).join('');
}

export function mount(el) {
  el.querySelector('#gw-toggle')?.addEventListener('click', () => {
    if (window.__app.ws.isConnected()) {
      window.__app.ws.disconnect();
      window.__app.setGwStatus('off', '已断开');
    } else {
      window.__app.tryConnect();
    }
    setTimeout(() => { el.querySelector('.fade-in').innerHTML = render(); mount(el); }, 300);
  });
}
