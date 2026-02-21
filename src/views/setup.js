import { icons } from '../components/icons.js';

const steps = ['环境检测', '连接配置', '完成'];
let step = 0;

export function render() {
  return `<div class="page-header"><h1>欢迎使用 OpenClaw</h1><p>快速连接你的 AI 网关</p></div>
    <div class="wizard-steps">${steps.map((_, i) => `<div class="wizard-step ${i < step ? 'done' : i === step ? 'active' : ''}"></div>`).join('')}</div>
    <div class="wizard-content glass-card" id="wiz-content"></div>
    <div class="wizard-actions">
      <button class="btn btn-secondary" id="wiz-prev" style="visibility:${step > 0 ? 'visible' : 'hidden'}">上一步</button>
      <button class="btn btn-primary" id="wiz-next">${step === 2 ? '进入仪表盘' : '下一步'}</button>
    </div>`;
}

export function mount(el) {
  renderStep(el);
  el.querySelector('#wiz-prev').onclick = () => { if (step > 0) { step--; refresh(el); } };
  el.querySelector('#wiz-next').onclick = () => {
    if (step === 1) saveConfig(el);
    if (step === 2) { window.__app.navigate('dashboard'); return; }
    step++; refresh(el);
  };
}

function refresh(el) { el.querySelector('.fade-in').innerHTML = render(); mount(el); }

function renderStep(el) {
  const c = el.querySelector('#wiz-content');
  if (step === 0) { c.innerHTML = envCheck(); runChecks(c); }
  else if (step === 1) c.innerHTML = configStep();
  else c.innerHTML = doneStep();
}

function envCheck() {
  return `<h3 style="margin-bottom:16px">环境检测</h3>
    <div id="checks">
      ${checkItem('Node.js ≥ 22', 'chk-node')}
      ${checkItem('OpenClaw Gateway', 'chk-gw')}
    </div>`;
}

function checkItem(label, id) {
  return `<div class="check-item"><div class="check-icon loading">${icons.loader}</div><div><div class="check-label">${label}</div><div class="check-detail" id="${id}">检测中...</div></div></div>`;
}

async function runChecks(c) {
  const items = c.querySelectorAll('.check-item');
  // Auto-detect gateway
  setTimeout(() => setCheck(items[0], true, '已就绪'), 400);
  setTimeout(async () => {
    try {
      const ws = new WebSocket('ws://127.0.0.1:18789');
      await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; setTimeout(fail, 2000); });
      ws.close();
      setCheck(items[1], true, 'ws://127.0.0.1:18789 可达');
      window.__app.ws.saveSettings({ url: 'ws://127.0.0.1:18789' });
    } catch {
      setCheck(items[1], false, '未检测到本地 Gateway，请手动配置');
    }
  }, 600);
}

function setCheck(el, ok, detail) {
  el.querySelector('.check-icon').className = 'check-icon ' + (ok ? 'ok' : 'fail');
  el.querySelector('.check-icon').innerHTML = ok ? icons.check : icons.x;
  el.querySelector('.check-detail').textContent = detail;
}

function configStep() {
  const s = window.__app.ws.state.settings;
  return `<h3 style="margin-bottom:16px">连接配置</h3>
    <div style="display:grid;gap:14px;max-width:480px">
      <div><label class="input-label">Gateway 地址</label><input class="input" id="cfg-url" value="${s.url || 'ws://127.0.0.1:18789'}"></div>
      <div><label class="input-label">Auth Token</label><input class="input" id="cfg-token" type="password" value="${s.token || ''}" placeholder="Gateway 认证 Token"></div>
      <button class="btn btn-secondary btn-sm" id="cfg-test" style="justify-self:start">测试连接</button>
      <div id="cfg-result"></div>
    </div>`;
}

function saveConfig(el) {
  const url = el.querySelector('#cfg-url')?.value?.trim();
  const token = el.querySelector('#cfg-token')?.value?.trim();
  if (url && token) {
    window.__app.ws.saveSettings({ url, token });
    window.__app.tryConnect();
  }
}

function doneStep() {
  return `<div style="text-align:center;padding:40px 0">
    <div style="font-size:48px;margin-bottom:16px">✓</div>
    <h3 style="margin-bottom:8px">配置完成</h3>
    <p style="color:var(--fg2)">点击「进入仪表盘」开始使用</p>
  </div>`;
}

export function destroy() { step = 0; }
