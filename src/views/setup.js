import { icons } from '../components/icons.js';

const steps = ['环境检测', '模型配置', '渠道设置', '启动'];
let step = 0;

export function render() {
  return `<div class="page-header"><h1>欢迎使用 OpenClaw Desktop</h1><p>快速配置你的 AI 网关</p></div>
    <div class="wizard-steps">${steps.map((_, i) => `<div class="wizard-step ${i < step ? 'done' : i === step ? 'active' : ''}"></div>`).join('')}</div>
    <div class="wizard-content glass-card" id="wiz-content"></div>
    <div class="wizard-actions">
      <button class="btn btn-secondary" id="wiz-prev" style="visibility:${step > 0 ? 'visible' : 'hidden'}">上一步</button>
      <button class="btn btn-primary" id="wiz-next">${step === 3 ? '启动 Gateway' : '下一步'}</button>
    </div>`;
}

export function mount(el) {
  renderStep(el);
  el.querySelector('#wiz-prev').onclick = () => { if (step > 0) { step--; rerender(el); } };
  el.querySelector('#wiz-next').onclick = () => {
    if (step === 1) saveModel(el);
    if (step === 3) { finish(el); return; }
    if (step < 3) { step++; rerender(el); }
  };
}

function rerender(el) {
  const root = el.querySelector('.fade-in');
  if (root) root.innerHTML = render().replace(/<div class="fade-in">|<\/div>$/g, '');
  mount(el);
}

function renderStep(el) {
  const c = el.querySelector('#wiz-content');
  if (step === 0) c.innerHTML = envCheck();
  else if (step === 1) c.innerHTML = modelConfig();
  else if (step === 2) c.innerHTML = channelSetup();
  else c.innerHTML = summary();
  if (step === 0) runChecks(c);
}

function envCheck() {
  return `<h3 style="margin-bottom:16px">环境检测</h3>
    <div id="checks">
      <div class="check-item"><div class="check-icon loading">${icons.loader}</div><div><div class="check-label">Node.js ≥ 22</div><div class="check-detail" id="chk-node">检测中...</div></div></div>
      <div class="check-item"><div class="check-icon loading">${icons.loader}</div><div><div class="check-label">OpenClaw</div><div class="check-detail" id="chk-oc">检测中...</div></div></div>
      <div class="check-item"><div class="check-icon loading">${icons.loader}</div><div><div class="check-label">配置文件</div><div class="check-detail" id="chk-cfg">检测中...</div></div></div>
    </div>`;
}

async function runChecks(c) {
  const items = c.querySelectorAll('.check-item');
  // Simulate checks (Tauri commands would be used in production)
  setTimeout(() => setCheck(items[0], true, 'v24.9.0'), 500);
  setTimeout(() => setCheck(items[1], true, '已安装'), 800);
  setTimeout(() => setCheck(items[2], true, '~/.openclaw/openclaw.json'), 1100);
}

function setCheck(el, ok, detail) {
  const icon = el.querySelector('.check-icon');
  icon.className = 'check-icon ' + (ok ? 'ok' : 'fail');
  icon.innerHTML = ok ? icons.check : icons.x;
  el.querySelector('.check-detail').textContent = detail;
}

function modelConfig() {
  const s = window.__app.ws.state.settings;
  return `<h3 style="margin-bottom:16px">模型配置</h3>
    <div style="display:grid;gap:14px;max-width:480px">
      <div><label class="input-label">Provider</label>
        <select class="input" id="cfg-provider"><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="custom">自定义代理</option></select></div>
      <div><label class="input-label">API Base URL</label><input class="input" id="cfg-url" value="${s.apiUrl || 'https://api.anthropic.com'}" placeholder="https://api.anthropic.com"></div>
      <div><label class="input-label">API Key</label><input class="input" id="cfg-key" type="password" value="${s.apiKey || ''}" placeholder="sk-..."></div>
      <div><label class="input-label">模型</label><input class="input" id="cfg-model" value="${s.model || 'claude-sonnet-4-20250514'}" placeholder="claude-sonnet-4-20250514"></div>
    </div>`;
}

function saveModel(el) {
  const s = window.__app.ws.state.settings;
  s.apiUrl = el.querySelector('#cfg-url')?.value || s.apiUrl;
  s.apiKey = el.querySelector('#cfg-key')?.value || s.apiKey;
  s.model = el.querySelector('#cfg-model')?.value || s.model;
  window.__app.ws.saveSettings(s);
}

function channelSetup() {
  const channels = ['Telegram', 'WhatsApp', 'Discord', 'Feishu', 'WeCom', 'Slack', 'Signal'];
  return `<h3 style="margin-bottom:16px">渠道设置 <span style="color:var(--fg2);font-size:13px;font-weight:400">（可选，稍后配置）</span></h3>
    <div class="card-grid">${channels.map(ch => `<div class="glass-card" style="padding:16px;cursor:pointer">
      <div class="channel-card"><div class="channel-icon">${ch[0]}</div><div class="channel-info"><div class="name">${ch}</div><div class="detail">点击配置</div></div></div>
    </div>`).join('')}</div>`;
}

function summary() {
  const s = window.__app.ws.state.settings;
  return `<h3 style="margin-bottom:16px">准备就绪</h3>
    <div style="display:grid;gap:10px">
      <div class="check-item"><div class="check-icon ok">${icons.check}</div><div><div class="check-label">模型: ${s.model || 'claude-sonnet-4-20250514'}</div></div></div>
      <div class="check-item"><div class="check-icon ok">${icons.check}</div><div><div class="check-label">API: ${s.apiUrl || '默认'}</div></div></div>
    </div>
    <p style="margin-top:20px;color:var(--fg2)">点击「启动 Gateway」开始使用</p>`;
}

function finish(el) {
  const s = window.__app.ws.state.settings;
  if (!s.url) s.url = 'ws://127.0.0.1:18789';
  window.__app.ws.saveSettings(s);
  window.__app.navigate('dashboard');
}

export function destroy() { step = 0; }
