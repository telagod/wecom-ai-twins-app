import { icons } from '../components/icons.js';

const Shell = () => window.__TAURI__?.shell;

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', api: 'anthropic-messages', placeholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', api: 'openai-chat', placeholder: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', api: 'openai-chat', baseUrl: 'https://api.deepseek.com', placeholder: 'sk-...' },
  { id: 'openrouter', name: 'OpenRouter', api: 'openai-chat', baseUrl: 'https://openrouter.ai/api/v1', placeholder: 'sk-or-...' },
  { id: 'custom', name: '自定义 (OpenAI 兼容)', api: 'openai-chat', placeholder: 'API Key' },
];

const steps = ['环境检测', '安装 OpenClaw', '配置 Provider', '启动 Gateway', '完成'];
let step = 0;
let env = { bun: null, openclaw: null, providerOk: false, gwRunning: false };
let child = null;
export function getChild() { return child; }

export function render() {
  return `<div class="page-header"><h1>快速部署 OpenClaw</h1><p>一键安装，本地运行</p></div>
    <div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step ${i < step ? 'done' : i === step ? 'active' : ''}" title="${s}"></div>`).join('')}</div>
    <div class="wizard-content glass-card" id="wiz-content"></div>
    <div class="wizard-actions">
      <button class="btn btn-secondary" id="wiz-prev" style="visibility:${step > 0 && step < 4 ? 'visible' : 'hidden'}">上一步</button>
      <button class="btn btn-primary" id="wiz-next">${step === 4 ? '进入仪表盘' : '下一步'}</button>
    </div>`;
}

export function mount(el) {
  renderStep(el);
  el.querySelector('#wiz-prev').onclick = () => { if (step > 0) { step--; refresh(el); } };
  el.querySelector('#wiz-next').onclick = () => handleNext(el);
}

function refresh(el) {
  el.querySelector('.fade-in').innerHTML = render();
  mount(el);
}

function handleNext(el) {
  if (step === 0) {
    if (!env.bun) { window.__app.toast('请先安装 Bun', 'error'); return; }
    step = env.openclaw ? 2 : 1;
  } else if (step === 1) {
    if (!env.openclaw) { window.__app.toast('请先完成安装', 'error'); return; }
    step = 2;
  } else if (step === 2) {
    if (!env.providerOk) { window.__app.toast('请先保存 Provider 配置', 'error'); return; }
    step = 3;
  } else if (step === 3) {
    if (!env.gwRunning) { window.__app.toast('请先启动 Gateway', 'error'); return; }
    step = 4;
  } else if (step === 4) {
    window.__app.navigate('dashboard'); return;
  }
  refresh(el);
}

function renderStep(el) {
  const c = el.querySelector('#wiz-content');
  [renderDetect, renderInstall, renderProvider, renderGateway, renderDone][step](c);
}

// ── Step 0: Environment Detection ──

function renderDetect(c) {
  c.innerHTML = `<h3 style="margin-bottom:16px">环境检测</h3>
    <div id="checks">${checkItem('Bun 运行时', 'chk-bun')}${checkItem('OpenClaw', 'chk-oc')}</div>`;
  runDetect(c);
}

function checkItem(label, id) {
  return `<div class="check-item"><div class="check-icon loading">${icons.loader}</div>
    <div><div class="check-label">${label}</div><div class="check-detail" id="${id}">检测中...</div></div></div>`;
}

function setCheck(el, ok, detail) {
  const icon = el.querySelector('.check-icon');
  icon.className = 'check-icon ' + (ok ? 'ok' : 'fail');
  icon.innerHTML = ok ? icons.check : icons.x;
  el.querySelector('.check-detail').innerHTML = detail;
}

async function runCmd(program, args) {
  try { return await Shell().Command.create(program, args).execute(); }
  catch { return null; }
}

async function runDetect(c) {
  const items = c.querySelectorAll('.check-item');
  const bunOut = await runCmd('bun', ['--version']);
  if (bunOut?.code === 0) { env.bun = bunOut.stdout.trim(); setCheck(items[0], true, `v${env.bun}`); }
  else { env.bun = null; setCheck(items[0], false, '未找到 — <a href="https://bun.sh" target="_blank" style="color:var(--accent)">安装 Bun</a>'); }

  const ocOut = await runCmd('openclaw', ['--version']);
  if (ocOut?.code === 0) { env.openclaw = ocOut.stdout.trim(); setCheck(items[1], true, env.openclaw); }
  else {
    const ocBun = env.bun ? await runCmd('bun', ['openclaw', '--version']) : null;
    if (ocBun?.code === 0) { env.openclaw = ocBun.stdout.trim(); setCheck(items[1], true, env.openclaw + ' (via bun)'); }
    else { env.openclaw = null; setCheck(items[1], false, '未安装 — 下一步将自动安装'); }
  }
}

// ── Step 1: Install OpenClaw ──

function renderInstall(c) {
  c.innerHTML = `<h3 style="margin-bottom:16px">安装 OpenClaw</h3>
    <div class="terminal-box" id="install-log" style="height:200px;overflow-y:auto;background:var(--bg1);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;white-space:pre-wrap"></div>
    <button class="btn btn-primary btn-sm" id="btn-install" style="margin-top:12px">开始安装</button>`;
  c.querySelector('#btn-install').onclick = () => doInstall(c);
}

async function doInstall(c) {
  const log = c.querySelector('#install-log'), btn = c.querySelector('#btn-install');
  btn.disabled = true; btn.textContent = '安装中...';
  log.textContent = '$ bun install -g openclaw\n';
  try {
    const cmd = Shell().Command.create('bun', ['install', '-g', 'openclaw']);
    cmd.stdout.on('data', l => { log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; });
    cmd.stderr.on('data', l => { log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; });
    await cmd.spawn();
    const status = await new Promise(r => cmd.on('close', r));
    if (status.code === 0) { env.openclaw = 'installed'; log.textContent += '\n✅ 安装完成\n'; btn.textContent = '已安装'; window.__app.toast('OpenClaw 安装成功', 'success'); }
    else { btn.disabled = false; btn.textContent = '重试安装'; log.textContent += '\n❌ 安装失败 (exit ' + status.code + ')\n'; }
  } catch (e) { btn.disabled = false; btn.textContent = '重试安装'; log.textContent += '\n❌ ' + e.message + '\n'; }
}

// ── Step 2: Configure Provider ──

function renderProvider(c) {
  const opts = PROVIDERS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  c.innerHTML = `<h3 style="margin-bottom:16px">配置 LLM Provider</h3>
    <p style="color:var(--fg2);margin-bottom:16px">选择 AI 模型提供商并填入 API Key。</p>
    <div style="display:grid;gap:14px;max-width:480px">
      <div><label class="input-label">Provider</label><select class="input" id="prov-select">${opts}</select></div>
      <div id="prov-baseurl-wrap" style="display:none"><label class="input-label">Base URL</label><input class="input" id="prov-baseurl"></div>
      <div><label class="input-label">API Key</label><input class="input" id="prov-key" type="password" placeholder="${PROVIDERS[0].placeholder}"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="btn-prov-save">保存配置</button>
        <button class="btn btn-secondary btn-sm" id="btn-prov-skip">跳过（已配置）</button>
      </div>
      <div id="prov-result" style="font-size:13px"></div>
    </div>`;

  const sel = c.querySelector('#prov-select');
  const urlWrap = c.querySelector('#prov-baseurl-wrap');
  const urlInput = c.querySelector('#prov-baseurl');
  const keyInput = c.querySelector('#prov-key');

  function onProvChange() {
    const p = PROVIDERS.find(x => x.id === sel.value);
    keyInput.placeholder = p.placeholder;
    if (p.id === 'custom') { urlWrap.style.display = ''; urlInput.value = ''; }
    else if (p.baseUrl) { urlWrap.style.display = ''; urlInput.value = p.baseUrl; }
    else { urlWrap.style.display = 'none'; }
  }
  sel.onchange = onProvChange;
  onProvChange();

  c.querySelector('#btn-prov-save').onclick = () => saveProvider(c);
  c.querySelector('#btn-prov-skip').onclick = () => { env.providerOk = true; window.__app.toast('跳过 — 使用已有配置', 'info'); };
}

async function saveProvider(c) {
  const sel = c.querySelector('#prov-select');
  const key = c.querySelector('#prov-key').value.trim();
  const baseUrl = c.querySelector('#prov-baseurl')?.value.trim();
  const result = c.querySelector('#prov-result');
  const p = PROVIDERS.find(x => x.id === sel.value);

  if (!key) { result.innerHTML = '<span style="color:var(--danger)">请输入 API Key</span>'; return; }

  const provId = p.id === 'custom' ? 'custom' : p.id;
  result.innerHTML = '<span style="color:var(--warn)">保存中...</span>';

  const cmds = [
    ['models.providers.' + provId + '.apiKey', key],
    ['models.providers.' + provId + '.api', p.api],
  ];
  if (baseUrl) cmds.push(['models.providers.' + provId + '.baseUrl', baseUrl]);

  for (const [path, val] of cmds) {
    const r = await runCmd('openclaw', ['config', 'set', path, val]);
    if (r?.code !== 0) {
      result.innerHTML = `<span style="color:var(--danger)">配置失败: ${r?.stderr || 'unknown error'}</span>`;
      return;
    }
  }

  env.providerOk = true;
  result.innerHTML = '<span style="color:var(--success)">✅ 已保存</span>';
  window.__app.toast(`${p.name} 配置成功`, 'success');
}

// ── Step 3: Start Gateway ──

function renderGateway(c) {
  c.innerHTML = `<h3 style="margin-bottom:16px">启动 Gateway</h3>
    <p style="color:var(--fg2);margin-bottom:12px">在本地启动 OpenClaw Gateway，应用将自动连接。</p>
    <div class="terminal-box" id="gw-log" style="height:180px;overflow-y:auto;background:var(--bg1);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;white-space:pre-wrap"></div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="btn-gw-start">启动 Gateway</button>
      <button class="btn btn-secondary btn-sm" id="btn-gw-skip">已有 Gateway，跳过</button>
    </div>`;
  c.querySelector('#btn-gw-start').onclick = () => startGateway(c);
  c.querySelector('#btn-gw-skip').onclick = () => { env.gwRunning = true; window.__app.toast('跳过 — 请确保 Gateway 已在运行', 'info'); };
}

async function startGateway(c) {
  const log = c.querySelector('#gw-log'), btn = c.querySelector('#btn-gw-start');
  btn.disabled = true; btn.textContent = '启动中...';
  log.textContent = '$ openclaw gateway\n';
  try {
    const program = env.bun ? 'bun' : 'openclaw';
    const args = env.bun ? ['openclaw', 'gateway'] : ['gateway'];
    const cmd = Shell().Command.create(program, args);
    cmd.stdout.on('data', line => {
      log.textContent += line + '\n'; log.scrollTop = log.scrollHeight;
      if (line.includes('Gateway') && (line.includes('listening') || line.includes('ready') || line.includes('started'))) onGatewayReady(c);
    });
    cmd.stderr.on('data', line => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    cmd.on('close', s => { if (!env.gwRunning) { btn.disabled = false; btn.textContent = '重试启动'; log.textContent += '\n⚠️ Gateway 已退出 (exit ' + s.code + ')\n'; } });
    child = await cmd.spawn();
    setTimeout(() => probeGateway(c), 3000);
  } catch (e) { btn.disabled = false; btn.textContent = '重试启动'; log.textContent += '\n❌ ' + e.message + '\n'; }
}

function probeGateway(c, retries = 5) {
  if (env.gwRunning) return;
  let found = false;
  for (const port of [18789, 19001]) {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const t = setTimeout(() => ws.close(), 2000);
      ws.onopen = () => { clearTimeout(t); ws.close(); if (!found) { found = true; onGatewayReady(c, port); } };
      ws.onerror = () => clearTimeout(t);
    } catch {}
  }
  if (!found && retries > 0) setTimeout(() => probeGateway(c, retries - 1), 2000);
}

function onGatewayReady(c, port) {
  if (env.gwRunning) return;
  env.gwRunning = true;
  window.__app.ws.saveSettings({ url: `ws://127.0.0.1:${port || 18789}` });
  const btn = c.querySelector('#btn-gw-start');
  if (btn) { btn.textContent = '✅ 已启动'; btn.disabled = true; }
  window.__app.toast('Gateway 已启动', 'success');
}

// ── Step 4: Done ──

function renderDone(c) {
  c.innerHTML = `<div style="text-align:center;padding:40px 0">
    <div style="font-size:48px;margin-bottom:16px">🦞</div>
    <h3 style="margin-bottom:8px">部署完成</h3>
    <p style="color:var(--fg2)">OpenClaw Gateway 已在本地运行</p>
    <p style="color:var(--fg2);margin-top:8px">点击「进入仪表盘」开始使用</p>
  </div>`;
  window.__app.tryConnect();
}

export function destroy() {
  step = 0;
  env = { bun: null, openclaw: null, providerOk: false, gwRunning: false };
}
