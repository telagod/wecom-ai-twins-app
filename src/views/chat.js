import { icons } from '../components/icons.js';
import { t } from '../i18n.js';

let messages = [], streamEl = null, streamText = '', activeSession = null;

export function render() {
  const { ws } = window.__app;
  activeSession = sessionStorage.getItem('chat-session') || ws.state.sessions[0]?.sessionKey || null;
  return `<div class="chat-layout">
    <div class="chat-sessions glass-sm">
      <div style="padding-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:500;font-size:13px;color:var(--fg2)">${t('chat.sessions')}</span>
        <button class="btn-icon" id="refresh-sessions">${icons.loader}</button>
      </div>
      <div id="session-list">${renderSessionList(ws.state.sessions)}</div>
    </div>
    <div class="chat-main">
      <div style="padding:10px 20px;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0" id="chat-title">${activeSession || t('chat.select')}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" title="${t("chat.abort")}" aria-label="${t("chat.abort")}" id="btn-abort">${icons.stop}</button>
          <button class="btn-icon" title="${t("chat.reset")}" aria-label="${t("chat.reset")}" id="btn-reset">${icons.x}</button>
          <button class="btn-icon" title="${t("chat.compact")}" aria-label="${t("chat.compact")}" id="btn-compact">${icons.loader}</button>
          <button class="btn-icon" title="${t("chat.delete")}" aria-label="${t("chat.delete")}" id="btn-delete">${icons.x}</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-msgs"></div>
      <div class="chat-input-area">
        <div class="quick-cmds">
          <button class="quick-cmd" data-cmd="/new">${t('chat.newSession')}</button>
          <button class="quick-cmd" data-cmd="/status">${t('chat.status')}</button>
          <button class="quick-cmd" data-cmd="/compact">${t('chat.compact')}</button>
        </div>
        <form class="chat-form" id="chat-form">
          <textarea class="input" id="chat-input" placeholder="${t('chat.input')}" rows="1" aria-label="${t("chat.input")}"></textarea>
          <button type="submit" class="btn btn-primary" aria-label="${t("chat.send")}">${icons.send}</button>
        </form>
      </div>
    </div>
  </div>`;
}

function renderSessionList(sessions) {
  if (!sessions.length) return `<div style="color:var(--fg3);font-size:12px">${t("chat.none")}</div>`;
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
      const res = await loadHistory(ws, activeSession, 30);
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
    if (text === '/new') {
      activeSession = null;
      sessionStorage.removeItem('chat-session');
      messages = [];
      $msgs.innerHTML = `<div class="msg msg-system">${t("chat.newSessionDone")}</div>`;
      el.querySelector('#chat-title').textContent = t('chat.select');
      $input.value = '';
      return;
    }
    if (text === '/compact' && activeSession) {
      $input.value = '';
      ws.manage.sessionCompact(activeSession).then(() => {
        $msgs.innerHTML += `<div class="msg msg-system">${t("chat.compacted")}</div>`;
        $msgs.scrollTop = $msgs.scrollHeight;
      }).catch(() => {});
      return;
    }
    if (text === '/status') {
      $input.value = '';
      ws.observe.status().then(status => {
        const summary = t('chat.statusLine', status?.version || '-', status?.uptime || 0);
        $msgs.innerHTML += renderMsg({ role: 'ai', text: summary });
        $msgs.scrollTop = $msgs.scrollHeight;
      }).catch(() => {});
      return;
    }
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
    messages = []; $msgs.innerHTML = `<div class="msg msg-system">${t("chat.resetDone")}</div>`;
  });

  // Compact
  el.querySelector('#btn-compact')?.addEventListener('click', async () => {
    if (!activeSession) return;
    await ws.manage.sessionCompact(activeSession).catch(() => {});
    $msgs.innerHTML += `<div class="msg msg-system">${t("chat.compacted")}</div>`;
    $msgs.scrollTop = $msgs.scrollHeight;
  });

  // Delete
  el.querySelector('#btn-delete')?.addEventListener('click', async () => {
    if (!activeSession) return;
    if (!confirm(t('chat.deleteConfirm', activeSession))) return;
    await ws.manage.sessionDelete(activeSession).catch(() => {});
    await ws.loadDashboardData();
    activeSession = ws.state.sessions[0]?.sessionKey || null;
    if (activeSession) sessionStorage.setItem('chat-session', activeSession);
    else sessionStorage.removeItem('chat-session');
    el.querySelector('#session-list').innerHTML = renderSessionList(ws.state.sessions);
    el.querySelector('#chat-title').textContent = activeSession || t('chat.select');
    messages = [];
    $msgs.innerHTML = `<div class="msg msg-system">${t("chat.deleted")}</div>`;
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
      const res = await loadHistory(ws, activeSession, 30);
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

async function loadHistory(ws, sessionKey, limit = 50) {
  try {
    return await ws.observe.chatHistory(sessionKey, { limit });
  } catch {
    return ws.chat.history(sessionKey, limit);
  }
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
