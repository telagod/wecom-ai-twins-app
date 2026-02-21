const STORAGE = "openclaw-desktop";
let ws = null, reqId = 0, currentStream = null;

export const state = { connected: false, sessions: [], settings: load() };

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch { return {}; }
}
export function saveSettings(s) { Object.assign(state.settings, s); localStorage.setItem(STORAGE, JSON.stringify(state.settings)); }

export function connect(onMsg, onStatus) {
  if (ws) ws.close();
  const url = state.settings.url || "ws://127.0.0.1:18789";
  onStatus("pending", "连接中...");
  ws = new WebSocket(url);
  ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => { ws = null; state.connected = false; onStatus("off", "已断开"); };
  ws.onerror = () => onStatus("off", "连接失败");
}

export function disconnect() { if (ws) ws.close(); ws = null; }

export function send(obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); }

export function sendConnect(nonce) {
  send({
    type: "req", id: String(++reqId), method: "connect",
    params: {
      minProtocol: 3, maxProtocol: 3,
      client: { id: "openclaw-desktop", version: "0.1.0", platform: navigator.platform, mode: "operator" },
      role: "operator", scopes: ["operator.read", "operator.write"],
      caps: [], commands: [], permissions: {},
      auth: { token: state.settings.token || "" },
      device: { id: "desktop-" + (state.settings.deviceId || Date.now()), nonce }
    }
  });
}

export function sendMessage(text) {
  send({ type: "req", id: String(++reqId), method: "agent", params: { message: text, idempotencyKey: "k-" + Date.now() + "-" + reqId } });
}

export function fetchSessions() {
  send({ type: "req", id: String(++reqId), method: "sessions.list", params: {} });
}

export function isConnected() { return ws?.readyState === 1 && state.connected; }
