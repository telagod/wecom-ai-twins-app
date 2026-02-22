import { icons } from '../components/icons.js';

const Shell = () => window.__TAURI__?.shell;

const steps = ['环境检测', '安装 OpenClaw', '启动 Gateway', '完成'];
let step = 0;
let env = { bun: null, openclaw: null, gwRunning: false };
let child = null; // gateway child process

export function render() {
  return `<div class="page-header"><h1>快速部署 OpenClaw</h1><p>一键安装，本地运行</p></div>
    <div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step ${i < step ? 'done' : i === step ? 'active' : ''}" title="${s}"></div>`).join('')}</div>
    <div class="wizard-content glass-card" id="wiz-content"></div>
    <div class="wizard-actions">
      <button class="btn btn-secondary" id="wiz-prev" style="visibility:${step > 0 && step < 3 ? 'visible' : 'hidden'}">上一步</button>
      <button class="btn btn-primary" id="wiz-next">${step === 3 ? '进入仪表盘' : '下一步'}</button>
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
    step = env.openclaw ? 2 : 1; // skip install if already have openclaw
  } else if (step === 1) {
    if (!env.openclaw) { window.__app.toast('请先完成安装', 'error'); return; }
    step = 2;
  } else if (step === 2) {
    if (!env.gwRunning) { window.__app.toast('请先启动 Gateway', 'error'); return; }
    step = 3;
  } else if (step === 3) {
    window.__app.navigate('dashboard');
    return;
  }
  refresh(el);
}

// ── Step 0: Environment Detection ──

function renderStep(el) {
  const c = el.querySelector('#wiz-content');
  if (step === 0) renderDetect(c);
  else if (step === 1) renderInstall(c);
  else if (step === 2) renderGateway(c);
  else renderDone(c);
}

function renderDetect(c) {
  c.innerHTML = `<h3 style="margin-bottom:16px">环境检测</h3>
    <div id="checks">
      ${checkItem('Bun 运行时', 'chk-bun')}
      ${checkItem('OpenClaw', 'chk-oc')}
    </div>`;
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
  try {
    const cmd = Shell().Command.create(program, args);
    return await cmd.execute();
  } catch { return null; }
}

async function runDetect(c) {
  const items = c.querySelectorAll('.check-item');

  // Check bun
  const bunOut = await runCmd('bun', ['--version']);
  if (bunOut?.code === 0) {
    env.bun = bunOut.stdout.trim();
    setCheck(items[0], true, `v${env.bun}`);
  } else {
    env.bun = null;
    setCheck(items[0], false, '未找到 — <a href="https://bun.sh" target="_blank" style="color:var(--accent)">安装 Bun</a>');
  }

  // Check openclaw
  const ocOut = await runCmd('openclaw', ['--version']);
  if (ocOut?.code === 0) {
    env.openclaw = ocOut.stdout.trim();
    setCheck(items[1], true, env.openclaw);
  } else {
    // Try via bun
    const ocBun = env.bun ? await runCmd('bun', ['openclaw', '--version']) : null;
    if (ocBun?.code === 0) {
      env.openclaw = ocBun.stdout.trim();
      setCheck(items[1], true, env.openclaw + ' (via bun)');
    } else {
      env.openclaw = null;
      setCheck(items[1], false, '未安装 — 下一步将自动安装');
    }
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
  const log = c.querySelector('#install-log');
  const btn = c.querySelector('#btn-install');
  btn.disabled = true;
  btn.textContent = '安装中...';
  log.textContent = '$ bun install -g openclaw\n';

  try {
    const cmd = Shell().Command.create('bun', ['install', '-g', 'openclaw']);
    cmd.stdout.on('data', line => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    cmd.stderr.on('data', line => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    const proc = await cmd.spawn();
    const status = await new Promise(resolve => cmd.on('close', resolve));

    if (status.code === 0) {
      env.openclaw = 'installed';
      log.textContent += '\n✅ 安装完成\n';
      btn.textContent = '已安装';
      window.__app.toast('OpenClaw 安装成功', 'success');
    } else {
      btn.disabled = false;
      btn.textContent = '重试安装';
      log.textContent += '\n❌ 安装失败 (exit ' + status.code + ')\n';
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '重试安装';
    log.textContent += '\n❌ ' + e.message + '\n';
  }
}

// ── Step 2: Start Gateway ──

function renderGateway(c) {
  c.innerHTML = `<h3 style="margin-bottom:16px">启动 Gateway</h3>
    <p style="color:var(--fg2);margin-bottom:12px">在本地启动 OpenClaw Gateway，应用将自动连接。</p>
    <div class="terminal-box" id="gw-log" style="height:180px;overflow-y:auto;background:var(--bg1);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;white-space:pre-wrap"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary btn-sm" id="btn-gw-start">启动 Gateway</button>
      <button class="btn btn-secondary btn-sm" id="btn-gw-skip">已有 Gateway，跳过</button>
    </div>`;
  c.querySelector('#btn-gw-start').onclick = () => startGateway(c);
  c.querySelector('#btn-gw-skip').onclick = () => skipGateway(c);
}

async function startGateway(c) {
  const log = c.querySelector('#gw-log');
  const btn = c.querySelector('#btn-gw-start');
  btn.disabled = true;
  btn.textContent = '启动中...';
  log.textContent = '$ openclaw gateway\n';

  try {
    const program = env.bun ? 'bun' : 'openclaw';
    const args = env.bun ? ['openclaw', 'gateway'] : ['gateway'];
    const cmd = Shell().Command.create(program, args);

    cmd.stdout.on('data', line => {
      log.textContent += line + '\n';
      log.scrollTop = log.scrollHeight;
      if (line.includes('Gateway') && (line.includes('listening') || line.includes('ready') || line.includes('started'))) {
        onGatewayReady(c);
      }
    });
    cmd.stderr.on('data', line => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
    cmd.on('close', status => {
      if (!env.gwRunning) {
        btn.disabled = false;
        btn.textContent = '重试启动';
        log.textContent += '\n⚠️ Gateway 已退出 (exit ' + status.code + ')\n';
      }
    });

    child = await cmd.spawn();

    // Also probe WebSocket after a delay
    setTimeout(() => probeGateway(c), 3000);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '重试启动';
    log.textContent += '\n❌ ' + e.message + '\n';
  }
}

function probeGateway(c, retries = 5) {
  if (env.gwRunning) return;
  const ports = [18789, 19001];
  let found = false;
  ports.forEach(port => {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const timer = setTimeout(() => ws.close(), 2000);
      ws.onopen = () => {
        clearTimeout(timer);
        ws.close();
        if (!found) { found = true; onGatewayReady(c, port); }
      };
      ws.onerror = () => clearTimeout(timer);
    } catch {}
  });
  if (!found && retries > 0) setTimeout(() => probeGateway(c, retries - 1), 2000);
}

function onGatewayReady(c, port) {
  if (env.gwRunning) return;
  env.gwRunning = true;
  const url = `ws://127.0.0.1:${port || 18789}`;
  window.__app.ws.saveSettings({ url });
  const btn = c.querySelector('#btn-gw-start');
  if (btn) { btn.textContent = '✅ 已启动'; btn.disabled = true; }
  window.__app.toast('Gateway 已启动', 'success');
}

function skipGateway(c) {
  env.gwRunning = true;
  window.__app.toast('跳过 — 请确保 Gateway 已在运行', 'info');
}

// ── Step 3: Done ──

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
  env = { bun: null, openclaw: null, gwRunning: false };
  // Don't kill gateway child — keep it running
}
