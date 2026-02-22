export function render() {
  const s = window.__app.ws.state.settings;
  return `<div class="page-header"><h1>设置</h1><p>Gateway 连接与配置管理</p></div>
    <div class="tabs">
      <button class="tab active" data-tab="gateway">Gateway</button>
      <button class="tab" data-tab="models">模型</button>
      <button class="tab" data-tab="config">配置</button>
      <button class="tab" data-tab="advanced">高级</button>
    </div>
    <div id="tab-content">${renderGateway(s)}</div>`;
}

function renderGateway(s) {
  return `<div class="settings-section fade-in">
    <div><label class="input-label">Gateway URL</label><input class="input" id="s-url" value="${s.url || 'ws://127.0.0.1:18789'}"></div>
    <div><label class="input-label">Auth Token</label><input class="input" id="s-token" type="password" value="${s.token || ''}"></div>
    <button class="btn btn-primary" id="s-save-gw">保存并重连</button>
  </div>`;
}

function renderModels() {
  const models = window.__app.ws.state.models;
  return `<div class="fade-in">
    <div class="card-title" style="margin-bottom:12px">可用模型 (${models.length})</div>
    ${models.length ? models.map(m => `<div class="glass-card" style="padding:12px;margin-bottom:8px">
      <div style="font-size:14px;font-weight:500">${m.name || m.id}</div>
      <div style="font-size:12px;color:var(--fg2)">${m.provider || ''} · ${m.id}</div>
    </div>`).join('') : '<div style="color:var(--fg2);font-size:13px">连接 Gateway 后显示</div>'}
    <button class="btn btn-secondary btn-sm" id="s-refresh-models" style="margin-top:12px">刷新模型列表</button>
  </div>`;
}

function renderConfig() {
  return `<div class="fade-in">
    <p style="color:var(--fg2);font-size:13px;margin-bottom:12px">从 Gateway 读取 openclaw.json 配置</p>
    <button class="btn btn-secondary btn-sm" id="s-load-config">加载配置</button>
    <textarea class="json-editor" id="s-config" style="margin-top:12px" placeholder="点击「加载配置」"></textarea>
    <button class="btn btn-primary btn-sm" id="s-save-config" style="margin-top:8px">保存到 Gateway</button>
  </div>`;
}

function renderAdvanced(s) {
  const ver = '0.5.5';
  const hasUpdate = window.__app._pendingUpdate;
  return `<div class="fade-in">
    <div class="glass-card" style="margin-bottom:16px">
      <div class="card-title">关于</div>
      <div style="font-size:14px;font-weight:500">OpenClaw Desktop v${ver}</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="s-check-update">检查更新</button>
        ${hasUpdate ? `<button class="btn btn-primary btn-sm" id="s-do-update">更新到 ${hasUpdate.version}</button>` : ''}
      </div>
      <div id="s-update-status" style="font-size:12px;margin-top:8px"></div>
    </div>
    <p style="color:var(--fg2);font-size:13px;margin-bottom:12px">本地客户端设置（localStorage）</p>
    <textarea class="json-editor" id="s-local">${JSON.stringify(s, null, 2)}</textarea>
    <button class="btn btn-primary btn-sm" id="s-save-local" style="margin-top:8px">保存</button>
  </div>`;
}

export function mount(el) {
  const { ws } = window.__app;
  const s = ws.state.settings;
  const tabs = el.querySelectorAll('.tab');
  const $tc = el.querySelector('#tab-content');

  tabs.forEach(tab => tab.onclick = () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const t = tab.dataset.tab;
    if (t === 'gateway') { $tc.innerHTML = renderGateway(s); bindGateway(el); }
    else if (t === 'models') { $tc.innerHTML = renderModels(); bindModels(el); }
    else if (t === 'config') { $tc.innerHTML = renderConfig(); bindConfig(el); }
    else if (t === 'advanced') { $tc.innerHTML = renderAdvanced(s); bindAdvanced(el); }
  });
  bindGateway(el);
}

function bindGateway(el) {
  el.querySelector('#s-save-gw')?.addEventListener('click', () => {
    window.__app.ws.saveSettings({ url: el.querySelector('#s-url')?.value, token: el.querySelector('#s-token')?.value });
    window.__app.ws.disconnect();
    setTimeout(() => window.__app.tryConnect(), 300);
  });
}

function bindModels(el) {
  el.querySelector('#s-refresh-models')?.addEventListener('click', async () => {
    try { const res = await window.__app.ws.observe.modelsList(); window.__app.ws.state.models = res?.models || []; } catch {}
    el.querySelector('#tab-content').innerHTML = renderModels();
    bindModels(el);
  });
}

function bindConfig(el) {
  el.querySelector('#s-load-config')?.addEventListener('click', async () => {
    try {
      const res = await window.__app.ws.manage.configGet();
      el.querySelector('#s-config').value = JSON.stringify(res?.config || res, null, 2);
    } catch (e) { el.querySelector('#s-config').value = '加载失败: ' + e.message; }
  });
  el.querySelector('#s-save-config')?.addEventListener('click', async () => {
    try {
      const patch = JSON.parse(el.querySelector('#s-config').value);
      await window.__app.ws.manage.configPatch(patch);
      el.querySelector('#s-save-config').textContent = '已保存 ✓';
      setTimeout(() => el.querySelector('#s-save-config').textContent = '保存到 Gateway', 1500);
    } catch (e) { window.__app.toast('保存失败: ' + e.message, 'error'); }
  });
}

function bindAdvanced(el) {
  el.querySelector('#s-check-update')?.addEventListener('click', async () => {
    const status = el.querySelector('#s-update-status');
    status.innerHTML = '<span style="color:var(--warn)">检查中...</span>';
    await window.__app.checkUpdate(false);
    const u = window.__app._pendingUpdate;
    status.innerHTML = u ? `<span style="color:var(--success)">发现新版本 ${u.version}</span>` : '<span style="color:var(--fg2)">已是最新</span>';
  });
  el.querySelector('#s-do-update')?.addEventListener('click', async () => {
    const u = window.__app._pendingUpdate;
    if (!u) return;
    const status = el.querySelector('#s-update-status');
    status.innerHTML = '<span style="color:var(--warn)">下载更新中...</span>';
    try { await u.downloadAndInstall(); status.innerHTML = '<span style="color:var(--success)">更新完成，重启生效</span>'; }
    catch (e) { status.innerHTML = `<span style="color:var(--danger)">更新失败: ${e.message}</span>`; }
  });
  el.querySelector('#s-save-local')?.addEventListener('click', () => {
    try { window.__app.ws.saveSettings(JSON.parse(el.querySelector('#s-local').value)); window.__app.toast('已保存', 'success'); }
    catch { window.__app.toast('JSON 格式错误', 'error'); }
  });
}
