import { icons } from '../components/icons.js';
import { t } from '../i18n.js';

let logLines = [], following = true;
let logHandler = null, logsTailHandler = null;

export function render() {
  return `<div class="page-header"><h1>${icons.terminal} Logs</h1><p>Gateway 实时日志</p></div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn btn-secondary btn-sm" id="log-clear">${icons.x} Clear</button>
      <button class="btn btn-secondary btn-sm" id="log-follow" style="opacity:${following ? 1 : 0.5}">⬇ Auto-scroll</button>
      <input class="input" id="log-filter" placeholder="Filter..." style="max-width:200px;font-size:12px">
    </div>
    <div class="terminal-box" id="log-box" style="height:calc(100vh - 220px);overflow-y:auto;background:var(--bg1);border-radius:8px;padding:12px;font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6"></div>`;
}

export function mount(el) {
  const box = el.querySelector('#log-box');
  const filter = el.querySelector('#log-filter');

  el.querySelector('#log-clear').onclick = () => { logLines = []; box.textContent = ''; };
  el.querySelector('#log-follow').onclick = (e) => {
    following = !following;
    e.currentTarget.style.opacity = following ? 1 : 0.5;
    if (following) box.scrollTop = box.scrollHeight;
  };
  filter.oninput = () => renderLogs(box, filter.value);

  // Render existing logs
  renderLogs(box, '');

  // Subscribe to gateway logs via WebSocket
  const ws = window.__app.ws;
  if (logHandler) ws.off('log', logHandler);
  if (logsTailHandler) ws.off('logs.tail', logsTailHandler);
  logHandler = line => appendLogLine(box, filter, line);
  logsTailHandler = payload => {
    const lines = Array.isArray(payload?.lines) ? payload.lines : Array.isArray(payload) ? payload : [];
    lines.forEach(line => appendLogLine(box, filter, line));
  };
  ws.on('log', logHandler);
  ws.on('logs.tail', logsTailHandler);

  if (ws.isConnected()) {
    ws.observe.logsTail({ limit: 200, follow: true }).then(payload => {
      const lines = Array.isArray(payload?.lines) ? payload.lines : Array.isArray(payload) ? payload : [];
      lines.forEach(line => appendLogLine(box, filter, line));
    }).catch(() => {});
  }
}

function renderLogs(box, filter) {
  const f = filter.toLowerCase();
  box.innerHTML = '';
  const filtered = f ? logLines.filter(l => l.toLowerCase().includes(f)) : logLines;
  filtered.forEach(line => {
    const div = document.createElement('div');
    div.textContent = line;
    if (line.includes('ERROR') || line.includes('error')) div.style.color = 'var(--danger)';
    else if (line.includes('WARN') || line.includes('warn')) div.style.color = 'var(--warn)';
    box.appendChild(div);
  });
  if (following) box.scrollTop = box.scrollHeight;
}

function appendLogLine(box, filter, raw) {
  const line = typeof raw === 'string' ? raw : JSON.stringify(raw);
  logLines.push(line);
  if (logLines.length > 2000) logLines.shift();
  const f = filter.value.toLowerCase();
  if (!f || line.toLowerCase().includes(f)) {
    const span = document.createElement('div');
    span.textContent = line;
    if (line.includes('ERROR') || line.includes('error')) span.style.color = 'var(--danger)';
    else if (line.includes('WARN') || line.includes('warn')) span.style.color = 'var(--warn)';
    box.appendChild(span);
    if (following) box.scrollTop = box.scrollHeight;
  }
}

export function destroy() {
  const ws = window.__app.ws;
  if (logHandler) { ws.off('log', logHandler); logHandler = null; }
  if (logsTailHandler) { ws.off('logs.tail', logsTailHandler); logsTailHandler = null; }
}
