const STORAGE = "openclaw-desktop";
let ws = null, reqId = 0, handlers = new Map();

export const state = { connected: false, sessions: [], agents: [], channels: [], models: [], settings: load() };

function load() { try { return JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch { return {}; } }
export function saveSettings(s) { Object.assign(state.settings, s); localStorage.setItem(STORAGE, JSON.stringify(state.settings)); }

// Event listeners
const listeners = new Map();
export function on(event, fn) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(fn); }
export function off(event, fn) { const l = listeners.get(event); if (l) listeners.set(event, l.filter(f => f !== fn)); }
function emit(event, data) { (listeners.get(event) || []).forEach(fn => fn(data)); }

// Connection
export function connect(onStatus) {
  if (ws) ws.close();
  const url = state.settings.url || "ws://127.0.0.1:18789";
  onStatus?.("pending", "连接中...");
  ws = new WebSocket(url);
  ws.onmessage = e => { try { handleMsg(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => { ws = null; state.connected = false; onStatus?.("off", "已断开"); emit("status", false); };
  ws.onerror = () => onStatus?.("off", "连接失败");
}

export function disconnect() { if (ws) ws.close(); ws = null; }
export function isConnected() { return ws?.readyState === 1 && state.connected; }

function send(obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); }

// Request with promise
function req(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = String(++reqId);
    handlers.set(id, { resolve, reject, ts: Date.now() });
    send({ type: "req", id, method, params });
    setTimeout(() => { if (handlers.has(id)) { handlers.delete(id); reject(new Error("timeout")); } }, 30000);
  });
}

function handleMsg(msg) {
  // Challenge → auto connect
  if (msg.type === "event" && msg.event === "connect.challenge") {
    sendHandshake(msg.payload?.nonce); return;
  }
  // Response
  if (msg.type === "res") {
    if (msg.payload?.type === "hello-ok") {
      state.connected = true;
      if (msg.auth?.deviceToken) { state.settings.deviceToken = msg.auth.deviceToken; saveSettings(state.settings); }
      emit("status", true);
    }
    const h = handlers.get(msg.id);
    if (h) { handlers.delete(msg.id); msg.ok ? h.resolve(msg.payload) : h.reject(msg.error); }
  }
  // Events → forward
  if (msg.type === "event") emit(msg.event, msg.payload);
}

function sendHandshake(nonce) {
  const token = state.settings.token || "";
  send({
    type: "req", id: String(++reqId), method: "connect",
    params: {
      minProtocol: 3, maxProtocol: 3,
      client: { id: "openclaw-desktop", version: "0.6.5", platform: navigator.platform, mode: "operator" },
      role: "operator", scopes: ["operator.read", "operator.write", "operator.admin"],
      caps: [], commands: [], permissions: {},
      auth: { token, deviceToken: state.settings.deviceToken },
      device: { id: state.settings.deviceId || ("desktop-" + Date.now()), nonce }
    }
  });
  if (!state.settings.deviceId) { state.settings.deviceId = "desktop-" + Date.now(); saveSettings(state.settings); }
}

// ═══════════════════════════════════════
// 可观测 API
// ═══════════════════════════════════════
export const observe = {
  health: () => req("health"),
  status: () => req("status"),
  presence: () => req("system-presence"),
  sessionsList: (params = {}) => req("sessions.list", params),
  sessionPreview: (sessionKey) => req("sessions.preview", { sessionKey }),
  sessionUsage: (sessionKey) => req("sessions.usage", { sessionKey }),
  agentsList: () => req("agents.list", {}),
  agentIdentity: (agentId) => req("agent.identity.get", { agentId }),
  modelsList: () => req("models.list", {}),
  channelsStatus: () => req("channels.status", {}),
  logsTail: (params = {}) => req("logs.tail", params),
  chatHistory: (sessionKey, params = {}) => req("chat.history", { sessionKey, ...params }),
  cronList: () => req("cron.list", {}),
};

// ═══════════════════════════════════════
// 对话 API
// ═══════════════════════════════════════
export const chat = {
  send: (message, sessionKey) => req("chat.send", { message, sessionKey, idempotencyKey: "k-" + Date.now() }),
  abort: (sessionKey) => req("chat.abort", { sessionKey }),
  history: (sessionKey, limit = 50) => req("chat.history", { sessionKey, limit }),
};

// ═══════════════════════════════════════
// 管理 API
// ═══════════════════════════════════════
export const manage = {
  sessionReset: (sessionKey) => req("sessions.reset", { sessionKey }),
  sessionCompact: (sessionKey) => req("sessions.compact", { sessionKey }),
  sessionDelete: (sessionKey) => req("sessions.delete", { sessionKey }),
  configGet: (key) => req("config.get", key ? { key } : {}),
  configPatch: (patch) => req("config.patch", { patch }),
  agentCreate: (params) => req("agents.create", params),
  agentUpdate: (params) => req("agents.update", params),
  agentDelete: (agentId) => req("agents.delete", { agentId }),
  agentFilesList: (agentId) => req("agents.files.list", { agentId }),
  agentFileGet: (agentId, path) => req("agents.files.get", { agentId, path }),
  agentFileSet: (agentId, path, content) => req("agents.files.set", { agentId, path, content }),
};

// ═══════════════════════════════════════
// 初始化数据加载
// ═══════════════════════════════════════
export async function loadDashboardData() {
  if (!isConnected()) return;
  try {
    const [sessions, agents, channels, models] = await Promise.allSettled([
      observe.sessionsList(), observe.agentsList(), observe.channelsStatus(), observe.modelsList()
    ]);
    if (sessions.status === "fulfilled") state.sessions = sessions.value?.sessions || [];
    if (agents.status === "fulfilled") state.agents = agents.value?.agents || [];
    if (channels.status === "fulfilled") state.channels = channels.value?.channels || [];
    if (models.status === "fulfilled") state.models = models.value?.models || [];
    emit("data", state);
  } catch {}
}
