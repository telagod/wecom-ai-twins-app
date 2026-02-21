import { icons } from '../components/icons.js';

let messages = [], streamEl = null, streamText = '';

export function render() {
  return `<div class="chat-layout">
    <div class="chat-sessions glass-sm">
      <div style="padding-bottom:12px;font-weight:500;font-size:13px;color:var(--fg2)">会话列表</div>
      <div id="session-list">${renderSessionList()}</div>
    </div>
    <div class="chat-main">
      <div class="chat-messages" id="chat-msgs">${messages.map(renderMsg).join('')}</div>
      <div class="chat-input-area">
        <div class="quick-cmds">
          <button class="quick-cmd" data-cmd="/new">新会话</button>
          <button class="quick-cmd" data-cmd="/status">状态</button>
          <button class="quick-cmd" data-cmd="/compact">压缩</button>
        </div>
        <form class="chat-form" id="chat-form">
          <textarea class="input" id="chat-input" placeholder="输入消息..." rows="1"></textarea>
          <button type="submit" class="btn btn-primary">${icons.send}</button>
        </form>
      </div>
    </div>
  </div>`;
}

function renderSessionList() {
  const sessions = window.__app.ws.state.sessions;
  if (!sessions.length) return '<div style="color:var(--fg3);font-size:12px">暂无</div>';
  return sessions.map(s => {
    const label = s.displayName || s.origin?.label || s.sessionKey || '未知';
    return `<div class="session-item active"><div class="name">${label}</div></div>`;
  }).join('');
}

function renderMsg(m) {
  return `<div class="msg msg-${m.role}">${escHtml(m.text)}</div>`;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function mount(el) {
  const $form = el.querySelector('#chat-form');
  const $input = el.querySelector('#chat-input');
  const $msgs = el.querySelector('#chat-msgs');

  $form.onsubmit = e => {
    e.preventDefault();
    const text = $input.value.trim();
    if (!text) return;
    messages.push({ role: 'user', text });
    $msgs.innerHTML += renderMsg({ role: 'user', text });
    $input.value = '';
    $input.style.height = 'auto';
    window.__app.ws.sendMessage(text);
    $msgs.scrollTop = $msgs.scrollHeight;
  };

  $input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $form.requestSubmit(); }
  });
  $input.addEventListener('input', () => {
    $input.style.height = 'auto';
    $input.style.height = Math.min($input.scrollHeight, 120) + 'px';
  });

  el.querySelectorAll('.quick-cmd').forEach(btn => {
    btn.onclick = () => { $input.value = btn.dataset.cmd; $form.requestSubmit(); };
  });
}

export function onMessage(msg) {
  const $msgs = document.getElementById('chat-msgs');
  if (!$msgs) return;

  if (msg.type === 'event' && msg.event === 'agent') {
    const text = msg.payload?.text || msg.payload?.delta || msg.payload?.content || '';
    if (!text && !msg.payload?.summary) return;
    if (msg.payload?.summary) { finishStream(); return; }
    if (!streamEl) {
      streamEl = document.createElement('div');
      streamEl.className = 'msg msg-ai typing';
      streamText = '';
      $msgs.appendChild(streamEl);
    }
    streamText += text;
    streamEl.textContent = streamText;
    $msgs.scrollTop = $msgs.scrollHeight;
    return;
  }

  if (msg.type === 'res' && msg.payload?.status === 'completed') {
    finishStream();
    return;
  }

  if (msg.type === 'res' && msg.error) {
    const errEl = document.createElement('div');
    errEl.className = 'msg msg-system';
    errEl.textContent = '⚠ ' + (msg.error.message || JSON.stringify(msg.error));
    $msgs.appendChild(errEl);
  }
}

function finishStream() {
  if (streamEl) {
    streamEl.classList.remove('typing');
    messages.push({ role: 'ai', text: streamText });
    streamEl = null; streamText = '';
  }
}

export function destroy() { streamEl = null; streamText = ''; }
