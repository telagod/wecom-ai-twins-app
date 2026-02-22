import { icons } from '../components/icons.js';

let messages = [], streamEl = null, streamText = '', activeSession = null;

export function render() {
  const { ws } = window.__app;
  activeSession = sessionStorage.getItem('chat-session') || ws.state.sessions[0]?.sessionKey || null;
  return `<div class="chat-layout">
    <div class="chat-sessions glass-sm">
      <div style="padding-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:500;font-size:13px;color:var(--fg2)">会话</span>
        <button class="btn-icon" id="refresh-sessions">${icons.loader}</button>
      </div>
      <div id="session-list">${renderSessionList(ws.state.sessions)}</div>
    </div>
    <div class="chat-main">
      <div style="padding:10px 20px;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0" id="chat-title">${activeSession || '选择会话'}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" title="中止回复" aria-label="中止回复" id="btn-abort">${icons.stop}</button>
          <button class="btn-icon" title="重置会话" aria-label="重置会话" id="btn-reset">${icons.x}</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-msgs"></div>
      <div class="chat-input-area">
        <div class="quick-cmds">
          <button class="quick-cmd" data-cmd="/new">新会话</button>
          <button class="quick-cmd" data-cmd="/status">状态</button>
          <button class="quick-cmd" data-cmd="/compact">压缩</button>
        </div>
        <form class="chat-form" id="chat-form">
          <textarea class="input" id="chat-input" placeholder="输入消息..." rows="1" aria-label="消息输入"></textarea>
          <button type="submit" class="btn btn-primary" aria-label="发送">${icons.send}</button>
        </form>
      </div>
    </div>
  </div>`;
}

function renderSessionList(sessions) {
  if (!sessions.length) return '<div style="color:var(--fg3);font-size:12px">暂无</div>';
  return sessions.map(s => {
    const label = s.displayName || s.origin?.label || s.sessionKey || '未知';
    const active = s.sessionKey === activeSession;
    return `<div class="session-item ${active ? 'active' : ''}" data-key="${s.sessionKey || ''}">
      <div class="name">${label}</div>
      <div class="time">${s.agentId || ''}</div>
    </div>`;
  }).join('');
}

export async function mount(el) {
  const { ws } = window.__app;
  const $form = el.querySelector('#chat-form');
  const $input = el.querySelector('#chat-input');
  const $msgs = el.querySelector('#chat-msgs');

  // Load history
  if (activeSession) {
    try {
      const res = await ws.chat.history(activeSession, 30);
      const entries = res?.entries || res?.messages || [];
      messages = entries.map(e => ({ role: e.role === 'user' ? 'user' : 'ai', text: e.content || e.text || '' })).filter(m => m.text);
      $msgs.innerHTML = messages.map(renderMsg).join('');
      $msgs.scrollTop = $msgs.scrollHeight;
    } catch { messages = []; }
  }

  // Send
  $form.onsubmit = e => {
    e.preventDefault();
    const text = $input.value.trim();
    if (!text) return;
    messages.push({ role: 'user', text });
    $msgs.innerHTML += renderMsg({ role: 'user', text });
    $input.value = ''; $input.style.height = 'auto';
    ws.chat.send(text, activeSession).catch(() => {});
    $msgs.scrollTop = $msgs.scrollHeight;
  };

  $input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $form.requestSubmit(); } });
  $input.addEventListener('input', () => { $input.style.height = 'auto'; $input.style.height = Math.min($input.scrollHeight, 120) + 'px'; });

  // Quick commands
  el.querySelectorAll('.quick-cmd').forEach(btn => { btn.onclick = () => { $input.value = btn.dataset.cmd; $form.requestSubmit(); }; });

  // Abort
  el.querySelector('#btn-abort')?.addEventListener('click', () => { if (activeSession) ws.chat.abort(activeSession).catch(() => {}); finishStream(); });

  // Reset
  el.querySelector('#btn-reset')?.addEventListener('click', async () => {
    if (!activeSession) return;
    await ws.manage.sessionReset(activeSession).catch(() => {});
    messages = []; $msgs.innerHTML = '<div class="msg msg-system">会话已重置</div>';
  });

  // Session switch
  el.querySelector('#session-list')?.addEventListener('click', async e => {
    const item = e.target.closest('.session-item');
    if (!item) return;
    activeSession = item.dataset.key;
    sessionStorage.setItem('chat-session', activeSession);
    el.querySelectorAll('.session-item').forEach(s => s.classList.toggle('active', s.dataset.key === activeSession));
    el.querySelector('#chat-title').textContent = activeSession;
    try {
      const res = await ws.chat.history(activeSession, 30);
      const entries = res?.entries || res?.messages || [];
      messages = entries.map(e => ({ role: e.role === 'user' ? 'user' : 'ai', text: e.content || e.text || '' })).filter(m => m.text);
      $msgs.innerHTML = messages.map(renderMsg).join('');
      $msgs.scrollTop = $msgs.scrollHeight;
    } catch { messages = []; $msgs.innerHTML = ''; }
  });

  // Refresh sessions
  el.querySelector('#refresh-sessions')?.addEventListener('click', async () => {
    await ws.loadDashboardData();
    el.querySelector('#session-list').innerHTML = renderSessionList(ws.state.sessions);
  });
}

function renderMsg(m) { return `<div class="msg msg-${m.role}">${md(m.text)}</div>`; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function md(s) {
  return escHtml(s)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

export function onAgentEvent(payload) {
  const $msgs = document.getElementById('chat-msgs');
  if (!$msgs) return;
  const text = payload?.text || payload?.delta || payload?.content || '';
  if (!text && !payload?.summary) return;
  if (payload?.summary || payload?.status === 'completed') { finishStream(); return; }
  if (!streamEl) { streamEl = document.createElement('div'); streamEl.className = 'msg msg-ai typing'; streamText = ''; $msgs.appendChild(streamEl); }
  streamText += text;
  streamEl.textContent = streamText;
  $msgs.scrollTop = $msgs.scrollHeight;
}

function finishStream() {
  if (streamEl) { streamEl.classList.remove('typing'); messages.push({ role: 'ai', text: streamText }); streamEl = null; streamText = ''; }
}

export function destroy() { streamEl = null; streamText = ''; messages = []; }
