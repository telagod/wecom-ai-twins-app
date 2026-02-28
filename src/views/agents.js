import { icons } from '../components/icons.js';
import { t } from '../i18n.js';

let agentsList = [], selectedAgent = null;

export function render() {
  agentsList = window.__app.ws.state.agents;
  return `<div class="page-header"><h1>${t('agents.title')}</h1><p>${t('agents.sub')}</p></div>
    <div class="agents-layout">
      <div class="agents-list">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div class="card-title" style="margin:0">${t('agents.list')} (${agentsList.length})</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-secondary btn-sm" id="agents-refresh">${icons.loader} ${t('agents.refresh')}</button>
            <button class="btn btn-primary btn-sm" id="agents-create">${icons.check} ${t('agents.create')}</button>
          </div>
        </div>
        <div class="card-grid" id="agents-grid">${renderAgentCards()}</div>
      </div>
      <div class="agents-detail" id="agent-detail">${renderDetail()}</div>
    </div>`;
}

function renderAgentCards() {
  if (!agentsList.length) return `<div class="glass-card" style="color:var(--fg2);font-size:13px">${t("agents.none")}</div>`;
  return agentsList.map(a => `<div class="glass-card" style="cursor:pointer" data-id="${a.id}">
    <div style="display:flex;justify-content:space-between;align-items:start">
      <div>
        <div style="font-size:15px;font-weight:500">${a.name || a.id}</div>
        <div style="font-size:12px;color:var(--fg2);margin-top:4px">ID: ${a.id}</div>
      </div>
      <span class="badge ${a.default ? 'badge-success' : 'badge-warn'}">${a.default ? t('agents.default') : t('agents.copy')}</span>
    </div>
    ${a.model ? `<div style="font-size:12px;color:var(--fg3);margin-top:8px">${t("agents.model")}: ${a.model}</div>` : ''}
    ${a.workspace ? `<div style="font-size:11px;color:var(--fg3);margin-top:2px;word-break:break-all">${a.workspace}</div>` : ''}
  </div>`).join('');
}

function renderDetail() {
  if (!selectedAgent) return `<div class="glass-card" style="color:var(--fg2);font-size:13px">${t("agents.detail")}</div>`;
  const a = selectedAgent;
  const name = escAttr(a.name || '');
  const model = escAttr(a.model || '');
  const workspace = escAttr(a.workspace || '');
  return `<div class="glass-card">
    <div style="font-size:16px;font-weight:600;margin-bottom:16px">${a.name || a.id}</div>
    <div style="display:grid;gap:12px">
      <div><span class="input-label">ID</span><div style="font-size:13px">${a.id}</div></div>
      <div><label class="input-label">${t('agents.name')}</label><input class="input" id="agent-name" value="${name}" placeholder="${t('agents.name')}"></div>
      <div><label class="input-label">${t('agents.model')}</label><input class="input" id="agent-model" value="${model}" placeholder="${t('agents.inheritModel')}"></div>
      <div><label class="input-label">Workspace</label><input class="input" id="agent-workspace" value="${workspace}" placeholder="/path/to/workspace"></div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="agent-update">${t('agents.update')}</button>
      <button class="btn btn-secondary btn-sm" id="agent-delete">${t('agents.delete')}</button>
    </div>
    <div style="margin-top:16px"><span class="input-label">${t("agents.files")}</span>
      <div id="agent-files" style="margin-top:8px"><span style="color:var(--fg3);font-size:12px">${t('common.loading')}</span></div>
    </div>
    <div id="file-editor" style="margin-top:16px;display:none">
      <span class="input-label" id="file-name"></span>
      <textarea class="json-editor" id="file-content" style="min-height:200px;margin-top:6px"></textarea>
      <button class="btn btn-primary btn-sm" id="file-save" style="margin-top:8px">保存</button>
    </div>
  </div>`;
}

export async function mount(el) {
  const { ws } = window.__app;

  el.querySelector('#agents-refresh')?.addEventListener('click', async () => {
    await refreshAgents(el, ws);
  });
  el.querySelector('#agents-create')?.addEventListener('click', () => onCreateAgent(el, ws));

  bindCards(el);
}

function bindCards(el) {
  el.querySelector('#agents-grid')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    selectedAgent = agentsList.find(a => a.id === id) || { id };
    try {
      const identity = await window.__app.ws.observe.agentIdentity(id);
      selectedAgent = { ...selectedAgent, ...(identity?.identity || identity || {}) };
    } catch {}
    el.querySelector('#agent-detail').innerHTML = renderDetail();
    bindDetailActions(el, id);
    loadFiles(el, id);
  });
}

function bindDetailActions(el, id) {
  const { ws } = window.__app;
  el.querySelector('#agent-update')?.addEventListener('click', async () => {
    const name = el.querySelector('#agent-name')?.value.trim() || undefined;
    const model = el.querySelector('#agent-model')?.value.trim() || undefined;
    const workspace = el.querySelector('#agent-workspace')?.value.trim() || undefined;
    const payload = { id, agentId: id, name, model, workspace };
    try {
      await ws.manage.agentUpdate(payload);
      window.__app.toast(t('agents.updated'), 'success');
      await refreshAgents(el, ws);
    } catch (e) {
      window.__app.toast(`${t('agents.updateFail')}: ${e?.message || e}`, 'error');
    }
  });
  el.querySelector('#agent-delete')?.addEventListener('click', async () => {
    if (!confirm(t('agents.deleteConfirm', id))) return;
    try {
      await ws.manage.agentDelete(id);
      selectedAgent = null;
      window.__app.toast(t('agents.deleted'), 'success');
      await refreshAgents(el, ws);
      el.querySelector('#agent-detail').innerHTML = renderDetail();
    } catch (e) {
      window.__app.toast(`${t('agents.deleteFail')}: ${e?.message || e}`, 'error');
    }
  });
}

async function onCreateAgent(el, ws) {
  const raw = prompt(t('agents.createPrompt'), '{"id":"agent-new","name":"New Agent","model":"","workspace":""}');
  if (!raw) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    window.__app.toast(t('settings.jsonError'), 'error');
    return;
  }
  try {
    await ws.manage.agentCreate(payload);
    window.__app.toast(t('agents.created'), 'success');
    await refreshAgents(el, ws);
  } catch (e) {
    window.__app.toast(`${t('agents.createFail')}: ${e?.message || e}`, 'error');
  }
}

async function refreshAgents(el, ws) {
  try {
    const res = await ws.observe.agentsList();
    agentsList = ws.state.agents = res?.agents || [];
  } catch {}
  el.querySelector('#agents-grid').innerHTML = renderAgentCards();
}

async function loadFiles(el, agentId) {
  const { ws } = window.__app;
  const $files = el.querySelector('#agent-files');
  try {
    const res = await ws.manage.agentFilesList(agentId);
    const files = res?.files || res?.entries || [];
    if (!files.length) { $files.innerHTML = `<span style="color:var(--fg3);font-size:12px">${t("agents.noFiles")}</span>`; return; }
    $files.innerHTML = files.map(f => `<div class="quick-cmd" style="margin-bottom:4px;display:inline-block" data-path="${f.path || f.name}">${f.path || f.name}</div>`).join(' ');
    $files.onclick = async e => {
      const btn = e.target.closest('[data-path]');
      if (!btn) return;
      const path = btn.dataset.path;
      try {
        const res = await ws.manage.agentFileGet(agentId, path);
        const $editor = el.querySelector('#file-editor');
        $editor.style.display = 'block';
        el.querySelector('#file-name').textContent = path;
        el.querySelector('#file-content').value = res?.content || '';
        el.querySelector('#file-save').onclick = async () => {
          await ws.manage.agentFileSet(agentId, path, el.querySelector('#file-content').value);
          el.querySelector('#file-save').textContent = t('agents.saved');
          setTimeout(() => el.querySelector('#file-save').textContent = t('agents.save'), 1500);
        };
      } catch {}
    };
  } catch { $files.innerHTML = `<span style="color:var(--danger);font-size:12px">${t("agents.loadFail")}</span>`; }
}

function escAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
