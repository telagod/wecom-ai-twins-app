import { icons } from '../components/icons.js';
import { t } from '../i18n.js';

const Shell = () => window.__TAURI__?.shell;
const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', api: 'anthropic-messages', placeholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', api: 'openai-chat', placeholder: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', api: 'openai-chat', baseUrl: 'https://api.deepseek.com', placeholder: 'sk-...' },
  { id: 'openrouter', name: 'OpenRouter', api: 'openai-chat', baseUrl: 'https://openrouter.ai/api/v1', placeholder: 'sk-or-...' },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', api: 'openai-chat', placeholder: 'API Key' },
];

const desktopSteps = [t('setup.step.detect'), t('setup.step.install'), t('setup.step.provider'), t('setup.step.gateway'), t('setup.step.done')];
const mobileSteps = [t('setup.step.connect'), t('setup.step.done')];
const steps = isMobile ? mobileSteps : desktopSteps;
const lastStep = steps.length - 1;

let step = 0;
let env = { bun: null, openclaw: null, providerOk: false, gwRunning: false, connected: false };
let child = null;
export function getChild() { return child; }

export function render() {
  const title = isMobile ? t('setup.title.mobile') : t('setup.title.desktop');
  const sub = isMobile ? t('setup.sub.mobile') : t('setup.sub.desktop');
  return `<div class="page-header"><h1>${title}</h1><p>${sub}</p></div>
    <div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step ${i < step ? 'done' : i === step ? 'active' : ''}" title="${s}"></div>`).join('')}</div>
    <div class="wizard-content glass-card" id="wiz-content"></div>
    <div class="wizard-actions">
      <button class="btn btn-secondary" id="wiz-prev" style="visibility:${step > 0 && step < lastStep ? 'visible' : 'hidden'}">${t('setup.prev')}</button>
      <button class="btn btn-primary" id="wiz-next">${step === lastStep ? t('setup.enter') : t('setup.next')}</button>
    </div>`;
}

export function mount(el) {
  renderStep(el);
  el.querySelector('#wiz-prev').onclick = () => { if (step > 0) { step--; refresh(el); } };
  el.querySelector('#wiz-next').onclick = () => handleNext(el);
}

function refresh(el) { el.querySelector('.fade-in').innerHTML = render(); mount(el); }

// ── Navigation ──

function handleNext(el) {
  if (isMobile) return handleNextMobile(el);
  return handleNextDesktop(el);
}

function handleNextMobile(el) {
  if (step === 0) {
    if (!env.connected) { window.__app.toast(t('setup.mobile.fail'), 'error'); return; }
    step = 1;
  } else { window.__app.navigate('dashboard'); return; }
  refresh(el);
}

function handleNextDesktop(el) {
  if (step === 0) {
    if (!env.bun) { window.__app.toast('Install Bun first', 'error'); return; }
    step = env.openclaw ? 2 : 1;
  } else if (step === 1) {
    if (!env.openclaw) { window.__app.toast('Install OpenClaw first', 'error'); return; }
    step = 2;
  } else if (step === 2) {
    if (!env.providerOk) { window.__app.toast('Configure provider first', 'error'); return; }
    step = 3;
  } else if (step === 3) {
    if (!env.gwRunning) { window.__app.toast('Start Gateway first', 'error'); return; }
    step = 4;
  } else { window.__app.navigate('dashboard'); return; }
  refresh(el);
}

function renderStep(el) {
  const c = el.querySelector('#wiz-content');
  if (isMobile) {
    [renderMobileConnect, renderDone][step](c);
  } else {
    [renderDetect, renderInstall, renderProvider, renderGateway, renderDone][step](c);
  }
}

// ══════════════════════════════════
// Mobile flow
// ══════════════════════════════════

function renderMobileConnect(c) {
  const s = window.__app.ws.state.settings;
  c.innerHTML = `<h3 style="margin-bottom:16px">连接 Gateway</h3>
    <p style="color:var(--fg2);margin-bottom:16px">输入远程 Gateway 地址和 Token，或扫描二维码连接。</p>
    <div style="display:grid;gap:14px;max-width:480px">
      <div><label class="input-label">Gateway 地址</label><input class="input" id="m-url" value="${s.url || 'ws://192.168.1.100:18789'}" placeholder="ws://IP:端口"></div>
      <div><label class="input-label">Auth Token</label><input class="input" id="m-token" type="password" value="${s.token || ''}" placeholder="Gateway 认证 Token"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="m-test">测试连接</button>
        <button class="btn btn-secondary btn-sm" id="m-scan">📷 扫码连接</button>
        <button class="btn btn-secondary btn-sm" id="m-probe">局域网探测</button>
      </div>
      <div id="m-scanner" style="display:none;position:relative;border-radius:8px;overflow:hidden">
        <video id="m-video" style="width:100%;border-radius:8px" playsinline></video>
        <canvas id="m-canvas" style="display:none"></canvas>
        <button class="btn btn-sm" id="m-scan-close" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff">✕</button>
      </div>
      <div id="m-result" style="font-size:13px"></div>
    </div>`;
  c.querySelector('#m-test').onclick = () => testMobileConnect(c);
  c.querySelector('#m-probe').onclick = () => probeLAN(c);
  c.querySelector('#m-scan').onclick = () => startQRScan(c);
  c.querySelector('#m-scan-close').onclick = () => stopQRScan(c);
}

async function testMobileConnect(c) {
  const url = c.querySelector('#m-url').value.trim();
  const token = c.querySelector('#m-token').value.trim();
  const result = c.querySelector('#m-result');
  if (!url) { result.innerHTML = '<span style="color:var(--danger)">Enter Gateway URL</span>'; return; }
  result.innerHTML = '<span style="color:var(--warn)">Connecting...</span>';
  try {
    const ws = new WebSocket(url);
    await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; setTimeout(fail, 5000); });
    ws.close();
    window.__app.ws.saveSettings({ url, token });
    env.connected = true;
    result.innerHTML = '<span style="color:var(--success)">✅ Connected</span>';
    window.__app.toast('Gateway reachable', 'success');
  } catch {
    result.innerHTML = '<span style="color:var(--danger)">Connection failed</span>';
  }
}

let qrStream = null, qrTimer = null;

async function startQRScan(c) {
  const scanner = c.querySelector('#m-scanner');
  const video = c.querySelector('#m-video');
  const canvas = c.querySelector('#m-canvas');
  const result = c.querySelector('#m-result');
  scanner.style.display = '';
  result.innerHTML = '<span style="color:var(--warn)">Point at QR code...</span>';

  // Load jsQR from CDN if not loaded
  if (!window.jsQR) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    await new Promise((ok, fail) => { s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
  }

  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = qrStream;
    await video.play();
    const ctx = canvas.getContext('2d');

    qrTimer = setInterval(() => {
      if (video.readyState < 2) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height);
      if (code?.data) {
        stopQRScan(c);
        parseQR(c, code.data);
      }
    }, 300);
  } catch (e) {
    stopQRScan(c);
    result.innerHTML = `<span style="color:var(--danger)">Camera access failed: ${e.message}</span>`;
  }
}

function stopQRScan(c) {
  if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  const scanner = c.querySelector('#m-scanner');
  if (scanner) scanner.style.display = 'none';
}

function parseQR(c, data) {
  const result = c.querySelector('#m-result');
  try {
    // Format: openclaw://connect?url=ws://...&token=...
    // Or plain JSON: {"url":"ws://...","token":"..."}
    let url, token;
    if (data.startsWith('openclaw://')) {
      const params = new URL(data.replace('openclaw://', 'https://')).searchParams;
      url = params.get('url'); token = params.get('token');
    } else if (data.startsWith('{')) {
      const obj = JSON.parse(data);
      url = obj.url; token = obj.token;
    } else if (data.startsWith('ws')) {
      url = data;
    }
    if (url) {
      c.querySelector('#m-url').value = url;
      if (token) c.querySelector('#m-token').value = token;
      result.innerHTML = `<span style="color:var(--success)">✅ 已识别: ${url}</span>`;
      window.__app.toast('QR code scanned', 'success');
    } else {
      result.innerHTML = '<span style="color:var(--danger)">Unrecognized QR content</span>';
    }
  } catch { result.innerHTML = '<span style="color:var(--danger)">Invalid QR format</span>'; }
}

function probeLAN(c) {
  const result = c.querySelector('#m-result');
  result.innerHTML = '<span style="color:var(--warn)">Scanning...</span>';
  const ports = [18789, 19001];
  const subnet = '192.168.1';
  let found = false, checked = 0, total = 10 * ports.length;

  // Probe common IPs on local subnet
  for (let i = 1; i <= 10; i++) {
    for (const port of ports) {
      try {
        const ws = new WebSocket(`ws://${subnet}.${i}:${port}`);
        const t = setTimeout(() => { ws.close(); if (++checked >= total && !found) result.innerHTML = '<span style="color:var(--fg2)">No Gateway found</span>'; }, 2000);
        ws.onopen = () => {
          clearTimeout(t); ws.close();
          if (!found) {
            found = true;
            const url = `ws://${subnet}.${i}:${port}`;
            c.querySelector('#m-url').value = url;
            result.innerHTML = `<span style="color:var(--success)">发现 Gateway: ${url}</span>`;
          }
        };
        ws.onerror = () => { clearTimeout(t); if (++checked >= total && !found) result.innerHTML = '<span style="color:var(--fg2)">No Gateway found</span>'; };
      } catch { checked++; }
    }
  }
}

// ══════════════════════════════════
// Desktop flow
// ══════════════════════════════════

async function runCmd(program, args) {
  try { return await Shell().Command.create(program, args).execute(); } catch { return null; }
}

// ── Step 0: Detect ──

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

async function runDetect(c) {
  const items = c.querySelectorAll('.check-item');
  let bunOut = await runCmd('bun', ['--version']);
  if (!bunOut || bunOut.code !== 0) bunOut = await runCmd('sh', ['-c', '$HOME/.bun/bin/bun --version']);
  if (bunOut?.code === 0) { env.bun = bunOut.stdout.trim(); setCheck(items[0], true, `v${env.bun}`); }
  else { env.bun = null; setCheck(items[0], false, '未找到 — 点击下方「安装 Bun」或 <a href="https://bun.sh" target="_blank" style="color:var(--accent)">手动安装</a>'); addBunInstallBtn(c); }

  const ocOut = await runCmd('openclaw', ['--version']);
  if (ocOut?.code === 0) { env.openclaw = ocOut.stdout.trim(); setCheck(items[1], true, env.openclaw); }
  else {
    const ocBun = env.bun ? await runCmd('sh', ['-c', 'bun openclaw --version 2>/dev/null || $HOME/.bun/bin/bun openclaw --version']) : null;
    if (ocBun?.code === 0) { env.openclaw = ocBun.stdout.trim(); setCheck(items[1], true, env.openclaw + ' (via bun)'); }
    else { env.openclaw = null; setCheck(items[1], false, '未安装 — 下一步将自动安装'); }
  }
}

function addBunInstallBtn(c) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:12px';
  wrap.innerHTML = `<button class="btn btn-primary btn-sm" id="btn-bun-install">安装 Bun</button>
    <div class="terminal-box" id="bun-install-log" style="display:none;height:120px;overflow-y:auto;background:var(--bg1);border-radius:8px;padding:12px;font-family:monospace;font-size:12px;white-space:pre-wrap;margin-top:8px"></div>`;
  c.appendChild(wrap);
  wrap.querySelector('#btn-bun-install').onclick = () => installBun(c);
}

async function installBun(c) {
  const btn = c.querySelector('#btn-bun-install'), log = c.querySelector('#bun-install-log');
  btn.disabled = true; btn.textContent = '安装中...';
  log.style.display = ''; log.textContent = '📥 正在下载 Bun 安装脚本...\n';
  try {
    const cmd = Shell().Command.create('sh', ['-c',
      'echo "📥 下载安装脚本..." && ' +
      'curl -fL# https://bun.sh/install -o /tmp/bun-install.sh 2>&1 && ' +
      'echo "📦 正在安装 Bun..." && ' +
      'bash /tmp/bun-install.sh 2>&1 && ' +
      'echo "✅ 安装完成" && rm -f /tmp/bun-install.sh'
    ]);
    cmd.stdout.on('data', l => { log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; });
    cmd.stderr.on('data', l => { log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; });
    await cmd.spawn();
    const status = await new Promise(r => cmd.on('close', r));
    if (status.code === 0) {
      env.bun = 'installed'; btn.textContent = '已安装';
      window.__app.toast('Bun installed', 'success');
      const items = c.querySelectorAll('.check-item');
      const v = await runCmd('sh', ['-c', '$HOME/.bun/bin/bun --version']);
      if (v?.code === 0) { env.bun = v.stdout.trim(); setCheck(items[0], true, `v${env.bun}`); }
    } else { btn.disabled = false; btn.textContent = '重试'; log.textContent += '\n❌ 安装失败 (exit ' + status.code + ')\n'; }
  } catch (e) { btn.disabled = false; btn.textContent = '重试'; log.textContent += '\n❌ ' + e.message + '\n'; }
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
  log.textContent = '📦 正在安装 OpenClaw...\n';
  try {
    const cmd = Shell().Command.create('sh', ['-c',
      'export PATH="$HOME/.bun/bin:$PATH" && ' +
      'echo "📥 bun install -g openclaw" && ' +
      'bun install -g openclaw 2>&1 && ' +
      'echo "✅ 安装完成"'
    ]);
    cmd.stdout.on('data', l => { log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; });
    cmd.stderr.on('data', l => { log.textContent += l + '\n'; log.scrollTop = log.scrollHeight; });
    await cmd.spawn();
    const status = await new Promise(r => cmd.on('close', r));
    if (status.code === 0) { env.openclaw = 'installed'; btn.textContent = '已安装'; window.__app.toast('OpenClaw installed', 'success'); }
    else { btn.disabled = false; btn.textContent = '重试安装'; log.textContent += '\n❌ 安装失败 (exit ' + status.code + ')\n'; }
  } catch (e) { btn.disabled = false; btn.textContent = '重试安装'; log.textContent += '\n❌ ' + e.message + '\n'; }
}

// ── Step 2: Configure Provider ──

function renderProvider(c) {
  const opts = PROVIDERS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  c.innerHTML = `<h3 style="margin-bottom:16px">配置 LLM Provider</h3>
    <p style="color:var(--fg2);margin-bottom:16px">选择 AI 模型提供商并填入 API Key。</p>
    <div style="display:grid;gap:14px;max-width:480px">
      <div><label class="input-label">Provider</label><select class="input" id="prov-select" aria-label="选择 Provider">${opts}</select></div>
      <div><label class="input-label">Base URL <span style="color:var(--fg3)">(可选，自定义端点)</span></label><input class="input" id="prov-baseurl" placeholder="留空使用默认端点"></div>
      <div><label class="input-label">API Key</label><input class="input" id="prov-key" type="password" placeholder="${PROVIDERS[0].placeholder}"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="btn-prov-save">保存配置</button>
        <button class="btn btn-secondary btn-sm" id="btn-prov-skip">跳过（已配置）</button>
      </div>
      <div id="prov-result" style="font-size:13px"></div>
    </div>`;
  const sel = c.querySelector('#prov-select'), urlInput = c.querySelector('#prov-baseurl'), keyInput = c.querySelector('#prov-key');
  function onProvChange() {
    const p = PROVIDERS.find(x => x.id === sel.value);
    keyInput.placeholder = p.placeholder;
    urlInput.value = p.baseUrl || '';
    urlInput.placeholder = p.baseUrl ? p.baseUrl : '留空使用默认端点';
  }
  sel.onchange = onProvChange; onProvChange();
  c.querySelector('#btn-prov-save').onclick = () => saveProvider(c);
  c.querySelector('#btn-prov-skip').onclick = () => { env.providerOk = true; window.__app.toast('跳过 — 使用已有配置', 'info'); };
}

async function saveProvider(c) {
  const sel = c.querySelector('#prov-select'), key = c.querySelector('#prov-key').value.trim();
  const baseUrl = c.querySelector('#prov-baseurl')?.value.trim(), result = c.querySelector('#prov-result');
  const p = PROVIDERS.find(x => x.id === sel.value);
  if (!key) { result.innerHTML = '<span style="color:var(--danger)">请输入 API Key</span>'; return; }
  result.innerHTML = '<span style="color:var(--warn)">保存中...</span>';
  const provId = p.id === 'custom' ? 'custom' : p.id;
  const cmds = [['models.providers.' + provId + '.apiKey', key], ['models.providers.' + provId + '.api', p.api]];
  if (baseUrl) cmds.push(['models.providers.' + provId + '.baseUrl', baseUrl]);
  for (const [path, val] of cmds) {
    const r = await runCmd('sh', ['-c', `export PATH="$HOME/.bun/bin:$PATH" && openclaw config set '${path}' '${val}'`]);
    if (r?.code !== 0) { result.innerHTML = '<span style="color:var(--danger)">配置失败</span>'; return; }
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
    const cmd = Shell().Command.create('sh', ['-c', 'export PATH="$HOME/.bun/bin:$PATH" && openclaw gateway']);
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

// ── Done (shared) ──

function renderDone(c) {
  const msg = isMobile ? 'Gateway 已连接' : 'OpenClaw Gateway 已在本地运行';
  c.innerHTML = `<div style="text-align:center;padding:40px 0">
    <div style="font-size:48px;margin-bottom:16px">🦞</div>
    <h3 style="margin-bottom:8px">${isMobile ? '连接完成' : '部署完成'}</h3>
    <p style="color:var(--fg2)">${msg}</p>
    <p style="color:var(--fg2);margin-top:8px">点击「进入仪表盘」开始使用</p>
  </div>`;
  window.__app.tryConnect();
}

export function destroy() {
  step = 0;
  env = { bun: null, openclaw: null, providerOk: false, gwRunning: false, connected: false };
}
