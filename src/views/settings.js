export function render() {
  const s = window.__app.ws.state.settings;
  return `<div class="page-header"><h1>设置</h1><p>Gateway 连接与模型配置</p></div>
    <div class="tabs">
      <button class="tab active" data-tab="general">通用</button>
      <button class="tab" data-tab="models">模型</button>
      <button class="tab" data-tab="gateway">Gateway</button>
      <button class="tab" data-tab="advanced">高级</button>
    </div>
    <div id="tab-content">
      ${renderGeneral(s)}
    </div>`;
}

function renderGeneral(s) {
  return `<div class="settings-section fade-in">
    <div><label class="input-label">语言</label><select class="input"><option>中文</option><option>English</option></select></div>
    <div><label class="input-label">主题</label><select class="input"><option>深色</option></select></div>
  </div>`;
}

function renderModels(s) {
  return `<div class="settings-section fade-in">
    <div><label class="input-label">Provider</label>
      <select class="input" id="s-provider"><option value="anthropic" ${s.provider==='anthropic'?'selected':''}>Anthropic</option><option value="openai" ${s.provider==='openai'?'selected':''}>OpenAI</option><option value="custom">自定义</option></select></div>
    <div><label class="input-label">API Base URL</label><input class="input" id="s-apiurl" value="${s.apiUrl || ''}"></div>
    <div><label class="input-label">API Key</label><input class="input" id="s-apikey" type="password" value="${s.apiKey || ''}"></div>
    <div><label class="input-label">模型 ID</label><input class="input" id="s-model" value="${s.model || ''}"></div>
    <button class="btn btn-primary" id="s-save-model">保存</button>
  </div>`;
}

function renderGateway(s) {
  return `<div class="settings-section fade-in">
    <div><label class="input-label">Gateway URL</label><input class="input" id="s-gwurl" value="${s.url || 'ws://127.0.0.1:18789'}"></div>
    <div><label class="input-label">Auth Token</label><input class="input" id="s-gwtoken" type="password" value="${s.token || ''}"></div>
    <button class="btn btn-primary" id="s-save-gw">保存并重连</button>
  </div>`;
}

function renderAdvanced(s) {
  return `<div class="fade-in">
    <p style="color:var(--fg2);font-size:13px;margin-bottom:12px">openclaw.json 原始编辑（需要 Tauri 命令支持）</p>
    <textarea class="json-editor" id="s-json" placeholder="{ ... }">${JSON.stringify(s, null, 2)}</textarea>
    <div style="margin-top:12px"><button class="btn btn-primary" id="s-save-json">保存</button></div>
  </div>`;
}

export function mount(el) {
  const tabs = el.querySelectorAll('.tab');
  const $tc = el.querySelector('#tab-content');
  const s = window.__app.ws.state.settings;

  tabs.forEach(tab => tab.onclick = () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const t = tab.dataset.tab;
    if (t === 'general') $tc.innerHTML = renderGeneral(s);
    else if (t === 'models') { $tc.innerHTML = renderModels(s); bindModels(el); }
    else if (t === 'gateway') { $tc.innerHTML = renderGateway(s); bindGateway(el); }
    else if (t === 'advanced') { $tc.innerHTML = renderAdvanced(s); bindAdvanced(el); }
  });
}

function bindModels(el) {
  el.querySelector('#s-save-model')?.addEventListener('click', () => {
    window.__app.ws.saveSettings({
      provider: el.querySelector('#s-provider')?.value,
      apiUrl: el.querySelector('#s-apiurl')?.value,
      apiKey: el.querySelector('#s-apikey')?.value,
      model: el.querySelector('#s-model')?.value,
    });
    alert('已保存');
  });
}

function bindGateway(el) {
  el.querySelector('#s-save-gw')?.addEventListener('click', () => {
    window.__app.ws.saveSettings({
      url: el.querySelector('#s-gwurl')?.value,
      token: el.querySelector('#s-gwtoken')?.value,
    });
    window.__app.ws.disconnect();
    setTimeout(() => window.__app.tryConnect(), 300);
  });
}

function bindAdvanced(el) {
  el.querySelector('#s-save-json')?.addEventListener('click', () => {
    try {
      const obj = JSON.parse(el.querySelector('#s-json')?.value);
      window.__app.ws.saveSettings(obj);
      alert('已保存');
    } catch { alert('JSON 格式错误'); }
  });
}
