import { icons } from '../components/icons.js';

let agentsList = [], selectedAgent = null;

export function render() {
  agentsList = window.__app.ws.state.agents;
  return `<div class="page-header"><h1>Agents</h1><p>管理 AI Agent 实例</p></div>
    <div style="display:flex;gap:20px">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div class="card-title" style="margin:0">Agent 列表 (${agentsList.length})</div>
          <button class="btn btn-secondary btn-sm" id="agents-refresh">${icons.loader} 刷新</button>
        </div>
        <div class="card-grid" id="agents-grid">${renderAgentCards()}</div>
      </div>
      <div style="width:360px" id="agent-detail">${renderDetail()}</div>
    </div>`;
}

function renderAgentCards() {
  if (!agentsList.length) return '<div class="glass-card" style="color:var(--fg2);font-size:13px">暂无 Agent</div>';
  return agentsList.map(a => `<div class="glass-card" style="cursor:pointer" data-id="${a.id}">
    <div style="display:flex;justify-content:space-between;align-items:start">
      <div>
        <div style="font-size:15px;font-weight:500">${a.name || a.id}</div>
        <div style="font-size:12px;color:var(--fg2);margin-top:4px">ID: ${a.id}</div>
      </div>
      <span class="badge ${a.default ? 'badge-success' : 'badge-warn'}">${a.default ? '默认' : '副本'}</span>
    </div>
    ${a.model ? `<div style="font-size:12px;color:var(--fg3);margin-top:8px">模型: ${a.model}</div>` : ''}
    ${a.workspace ? `<div style="font-size:11px;color:var(--fg3);margin-top:2px;word-break:break-all">${a.workspace}</div>` : ''}
  </div>`).join('');
}

function renderDetail() {
  if (!selectedAgent) return '<div class="glass-card" style="color:var(--fg2);font-size:13px">选择一个 Agent 查看详情</div>';
  const a = selectedAgent;
  return `<div class="glass-card">
    <div style="font-size:16px;font-weight:600;margin-bottom:16px">${a.name || a.id}</div>
    <div style="display:grid;gap:12px">
      <div><span class="input-label">ID</span><div style="font-size:13px">${a.id}</div></div>
      <div><span class="input-label">模型</span><div style="font-size:13px">${a.model || '继承默认'}</div></div>
      <div><span class="input-label">Workspace</span><div style="font-size:12px;word-break:break-all;color:var(--fg2)">${a.workspace || '—'}</div></div>
    </div>
    <div style="margin-top:16px"><span class="input-label">Workspace 文件</span>
      <div id="agent-files" style="margin-top:8px"><span style="color:var(--fg3);font-size:12px">加载中...</span></div>
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
    try { const res = await ws.observe.agentsList(); agentsList = ws.state.agents = res?.agents || []; } catch {}
    el.querySelector('#agents-grid').innerHTML = renderAgentCards();
    bindCards(el);
  });

  bindCards(el);
}

function bindCards(el) {
  el.querySelector('#agents-grid')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    selectedAgent = agentsList.find(a => a.id === id) || { id };
    el.querySelector('#agent-detail').innerHTML = renderDetail();
    loadFiles(el, id);
  });
}

async function loadFiles(el, agentId) {
  const { ws } = window.__app;
  const $files = el.querySelector('#agent-files');
  try {
    const res = await ws.manage.agentFilesList(agentId);
    const files = res?.files || res?.entries || [];
    if (!files.length) { $files.innerHTML = '<span style="color:var(--fg3);font-size:12px">无文件</span>'; return; }
    $files.innerHTML = files.map(f => `<div class="quick-cmd" style="margin-bottom:4px;display:inline-block" data-path="${f.path || f.name}">${f.path || f.name}</div>`).join(' ');
    $files.addEventListener('click', async e => {
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
          el.querySelector('#file-save').textContent = '已保存 ✓';
          setTimeout(() => el.querySelector('#file-save').textContent = '保存', 1500);
        };
      } catch {}
    });
  } catch { $files.innerHTML = '<span style="color:var(--danger);font-size:12px">加载失败</span>'; }
}
