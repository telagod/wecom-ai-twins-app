const STORAGE_KEY = "wecom-twins-settings";
let ws = null;
let reqId = 0;
let currentStream = null;

// DOM
const $messages = document.getElementById("messages");
const $input = document.getElementById("chat-input");
const $form = document.getElementById("chat-form");
const $status = document.getElementById("conn-status");
const $btnConnect = document.getElementById("btn-connect");
const $btnSettings = document.getElementById("btn-settings");
const $overlay = document.getElementById("settings-overlay");
const $urlInput = document.getElementById("gateway-url");
const $tokenInput = document.getElementById("gateway-token");
const $agentList = document.getElementById("agent-list");
const $currentAgent = document.getElementById("current-agent");

// Settings
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function init() {
  const s = loadSettings();
  $urlInput.value = s.url || "ws://127.0.0.1:18789";
  $tokenInput.value = s.token || "";
  if (s.token) connect();
}

// Connection
function connect() {
  if (ws) ws.close();
  const url = $urlInput.value.trim();
  const token = $tokenInput.value.trim();
  if (!url) return;
  saveSettings({ url, token });

  setStatus("connecting", "连接中...");
  ws = new WebSocket(url);

  ws.onopen = () => {
    // Wait for challenge, then send connect
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleMessage(msg);
  };

  ws.onclose = () => {
    setStatus("disconnected", "已断开");
    ws = null;
  };

  ws.onerror = () => {
    setStatus("disconnected", "连接失败");
  };
}

function handleMessage(msg) {
  if (msg.type === "event" && msg.event === "connect.challenge") {
    sendConnect(msg.payload?.nonce);
    return;
  }

  if (msg.type === "res" && msg.payload?.type === "hello-ok") {
    setStatus("connected", "已连接");
    addSystemMsg("已连接到 Gateway");
    fetchSessions();
    return;
  }

  if (msg.type === "res" && msg.error) {
    addSystemMsg("❌ " + (msg.error.message || JSON.stringify(msg.error)));
    return;
  }

  // Agent streaming events
  if (msg.type === "event" && msg.event === "agent") {
    handleAgentEvent(msg.payload);
    return;
  }

  // Agent response (final)
  if (msg.type === "res" && msg.payload?.status === "completed") {
    if (currentStream) {
      currentStream.el.classList.remove("typing");
      currentStream = null;
    }
    return;
  }

  if (msg.type === "res" && msg.payload?.status === "accepted") {
    // Run accepted, streaming will follow
    return;
  }

  // Sessions list response
  if (msg.type === "res" && msg.ok && Array.isArray(msg.payload?.sessions)) {
    renderAgents(msg.payload.sessions);
    return;
  }
}

function sendConnect(nonce) {
  const token = $tokenInput.value.trim();
  send({
    type: "req", id: String(++reqId), method: "connect",
    params: {
      minProtocol: 3, maxProtocol: 3,
      client: { id: "wecom-twins-app", version: "0.1.0", platform: navigator.platform, mode: "operator" },
      role: "operator",
      scopes: ["operator.read", "operator.write"],
      caps: [], commands: [], permissions: {},
      auth: { token },
      device: { id: "wecom-twins-" + Date.now(), nonce }
    }
  });
}

function send(obj) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function sendMessage(text) {
  if (!text.trim() || !ws) return;
  addMsg("user", text);
  send({
    type: "req", id: String(++reqId), method: "agent",
    params: { message: text, idempotencyKey: "k-" + Date.now() + "-" + reqId }
  });
}

function fetchSessions() {
  send({ type: "req", id: String(++reqId), method: "sessions.list", params: {} });
}

// Agent streaming
function handleAgentEvent(payload) {
  if (!payload) return;
  const text = payload.text || payload.delta || payload.content || "";
  if (!text && !payload.summary) return;

  if (payload.summary) {
    // Final summary
    if (currentStream) {
      currentStream.el.classList.remove("typing");
      currentStream = null;
    }
    return;
  }

  if (!currentStream) {
    const el = addMsg("ai", "");
    el.classList.add("typing");
    currentStream = { el, text: "" };
  }
  currentStream.text += text;
  currentStream.el.textContent = currentStream.text;
  $messages.scrollTop = $messages.scrollHeight;
}

// UI helpers
function setStatus(cls, text) {
  $status.className = "status " + cls;
  $status.textContent = text;
  $btnConnect.textContent = cls === "connected" ? "断开" : "连接";
}

function addMsg(type, text) {
  const el = document.createElement("div");
  el.className = "msg " + type;
  el.textContent = text;
  $messages.appendChild(el);
  $messages.scrollTop = $messages.scrollHeight;
  return el;
}

function addSystemMsg(text) { addMsg("system", text); }

function renderAgents(sessions) {
  $agentList.innerHTML = "";
  if (!sessions.length) {
    $agentList.innerHTML = '<div style="padding:12px;color:var(--fg2);font-size:12px">暂无会话</div>';
    return;
  }
  sessions.forEach(s => {
    const el = document.createElement("div");
    el.className = "agent-item";
    const label = s.displayName || s.origin?.label || s.sessionKey || "未知";
    el.innerHTML = `<span>${label}</span><span class="dot online"></span>`;
    el.onclick = () => {
      document.querySelectorAll(".agent-item").forEach(e => e.classList.remove("active"));
      el.classList.add("active");
      $currentAgent.textContent = label;
    };
    $agentList.appendChild(el);
  });
}

// Events
$form.onsubmit = (e) => { e.preventDefault(); sendMessage($input.value); $input.value = ""; };

$input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $form.requestSubmit(); }
});

$input.addEventListener("input", () => {
  $input.style.height = "auto";
  $input.style.height = Math.min($input.scrollHeight, 120) + "px";
});

$btnConnect.onclick = () => {
  if (ws) { ws.close(); ws = null; } else connect();
};

$btnSettings.onclick = () => $overlay.classList.add("show");
document.getElementById("btn-cancel-settings").onclick = () => $overlay.classList.remove("show");
document.getElementById("btn-save-settings").onclick = () => {
  saveSettings({ url: $urlInput.value.trim(), token: $tokenInput.value.trim() });
  $overlay.classList.remove("show");
  if (ws) { ws.close(); setTimeout(connect, 300); }
};

document.querySelectorAll(".cmd").forEach(btn => {
  btn.onclick = () => sendMessage(btn.dataset.cmd);
});

init();
