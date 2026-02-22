import { t } from '../i18n.js';

export function render() {
  const s = window.__app.ws.state.settings;
  return `<div class="page-header"><h1>${t('settings.title')}</h1><p>${t('settings.sub')}</p></div>
    <div class="tabs">
      <button class="tab active" data-tab="gateway">Gateway</button>
      <button class="tab" data-tab="models">${t("settings.models")}</button>
      <button class="tab" data-tab="config">${t("settings.config")}</button>
      <button class="tab" data-tab="advanced">${t("settings.advanced")}</button>
    </div>
    <div id="tab-content">${renderGateway(s)}</div>`;
}

function renderGateway(s) {
  return `<div class="settings-section fade-in">
    <div><label class="input-label">Gateway URL</label><input class="input" id="s-url" value="${s.url || 'ws://127.0.0.1:18789'}"></div>
    <div><label class="input-label">Auth Token</label><input class="input" id="s-token" type="password" value="${s.token || ''}"></div>
    <button class="btn btn-primary" id="s-save-gw">${t("settings.saveReconnect")}</button>
  </div>`;
}

function renderModels() {
  const models = window.__app.ws.state.models;
  return `<div class="fade-in">
    <div class="card-title" style="margin-bottom:12px">${t("settings.availModels")} (${models.length})</div>
    ${models.length ? models.map(m => `<div class="glass-card" style="padding:12px;margin-bottom:8px">
      <div style="font-size:14px;font-weight:500">${m.name || m.id}</div>
      <div style="font-size:12px;color:var(--fg2)">${m.provider || ''} · ${m.id}</div>
    </div>`).join('') : '<div style="color:var(--fg2);font-size:13px">${t("settings.connectFirst")}</div>'}
    <button class="btn btn-secondary btn-sm" id="s-refresh-models" style="margin-top:12px">${t("settings.refreshModels")}</button>
  </div>`;
}

function renderConfig() {
  return `<div class="fade-in">
    <p style="color:var(--fg2);font-size:13px;margin-bottom:12px">${t("settings.loadConfig")}</p>
    <button class="btn btn-secondary btn-sm" id="s-load-config">${t("settings.loadConfig")}</button>
    <textarea class="json-editor" id="s-config" style="margin-top:12px" placeholder="${t("settings.loadConfig")}"></textarea>
    <button class="btn btn-primary btn-sm" id="s-save-config" style="margin-top:8px">${t("settings.saveConfig")}</button>
  </div>`;
}

function renderAdvanced(s) {
  const ver = '0.6.4';
  const hasUpdate = window.__app._pendingUpdate;
  return `<div class="fade-in">
    <div class="glass-card" style="margin-bottom:16px">
      <div class="card-title">About</div>
      <div style="font-size:14px;font-weight:500">OpenClaw Desktop v${ver}</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="s-check-update">${t("settings.checkUpdate") || "Check"}</button>
        ${hasUpdate ? `<button class="btn btn-primary btn-sm" id="s-do-update">${t("settings.updateTo") || "Update to "} ${hasUpdate.version}</button>` : ''}
      </div>
      <div id="s-update-status" style="font-size:12px;margin-top:8px"></div>
    </div>
    <p style="color:var(--fg2);font-size:13px;margin-bottom:12px">${t("settings.localSettings")}</p>
    <textarea class="json-editor" id="s-local">${JSON.stringify(s, null, 2)}</textarea>
    <button class="btn btn-primary btn-sm" id="s-save-local" style="margin-top:8px">${t("settings.save")}</button>
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
    } catch (e) { el.querySelector('#s-config').value = '${t("settings.loadFail") || "Load failed: "} ' + e.message; }
  });
  el.querySelector('#s-save-config')?.addEventListener('click', async () => {
    try {
      const patch = JSON.parse(el.querySelector('#s-config').value);
      await window.__app.ws.manage.configPatch(patch);
      el.querySelector('#s-save-config').textContent = t('settings.saved') + ' ✓';
      setTimeout(() => el.querySelector('#s-save-config').textContent = '${t("settings.saveConfig")}', 1500);
    } catch (e) { window.__app.toast('${t("settings.saveFail")}: ' + e.message, 'error'); }
  });
}

function bindAdvanced(el) {
  el.querySelector('#s-check-update')?.addEventListener('click', async () => {
    const status = el.querySelector('#s-update-status');
    status.innerHTML = '<span style="color:var(--warn)">${t("common.loading")}</span>';
    await window.__app.checkUpdate(false);
    const u = window.__app._pendingUpdate;
    status.innerHTML = u ? `<span style="color:var(--success)">${t("settings.newVersion") || "New version "} ${u.version}</span>` : '<span style="color:var(--fg2)">${t("settings.upToDate") || "Up to date"}</span>';
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
