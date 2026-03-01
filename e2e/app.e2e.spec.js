import { expect, test } from '@playwright/test';

async function installMockGateway(page) {
  await page.addInitScript(() => {
    localStorage.setItem('openclaw-lang', 'en');
    localStorage.setItem('openclaw-desktop', JSON.stringify({
      url: 'ws://127.0.0.1:18789',
      token: 'test-token',
      deviceToken: 'device-token-1',
      deviceId: 'device-1',
    }));

    const state = {
      sessions: [
        {
          sessionKey: 's-1',
          displayName: 'Primary Session',
          agentId: 'agent-alpha',
          model: 'gpt-4o-mini',
          lastActiveAt: new Date().toISOString(),
        },
      ],
      agents: [
        {
          id: 'agent-alpha',
          name: 'Alpha',
          model: 'gpt-4o-mini',
          workspace: '/tmp/alpha',
          default: true,
          emoji: 'A',
        },
      ],
      channels: [{ id: 'web', label: 'Web', status: 'connected' }],
      models: [{ id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' }],
      config: { app: { locale: 'en' } },
      jobs: [{ id: 'job-1', name: 'nightly-sync' }],
      files: {
        'agent-alpha': {
          '/README.md': '# Alpha',
        },
      },
    };

    const entries = {
      's-1': [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'world' },
      ],
    };

    function response(id, payload, ok = true, error = null) {
      return { type: 'res', id, ok, payload, error };
    }

    function sessionList() {
      return state.sessions.slice();
    }

    function agentList() {
      return state.agents.slice();
    }

    function filesForAgent(agentId) {
      const map = state.files[agentId] || {};
      return Object.keys(map).map(path => ({ path }));
    }

    function onMethod(method, params, socket) {
      switch (method) {
        case 'health':
          return { status: 'ok' };
        case 'status':
          return { version: '0.6.7-test', uptime: 321, tokenUsage: { total: 12345 } };
        case 'system-presence':
          return { status: 'online' };
        case 'sessions.list':
          return { sessions: sessionList() };
        case 'sessions.preview':
          return { preview: 'Latest assistant answer' };
        case 'sessions.usage':
          return { totalTokens: 240 };
        case 'sessions.reset':
          entries[params.sessionKey] = [];
          return { ok: true };
        case 'sessions.compact':
          return { compacted: true };
        case 'sessions.delete':
          state.sessions = state.sessions.filter(s => s.sessionKey !== params.sessionKey);
          delete entries[params.sessionKey];
          return { deleted: true };
        case 'agents.list':
          return { agents: agentList() };
        case 'agent.identity.get': {
          const a = state.agents.find(x => x.id === params.agentId);
          return { identity: a || { id: params.agentId } };
        }
        case 'agents.create': {
          const payload = { ...params };
          if (!payload.id && payload.agentId) payload.id = payload.agentId;
          if (!payload.id) payload.id = `agent-${Date.now()}`;
          state.agents.push({ ...payload });
          if (!state.files[payload.id]) state.files[payload.id] = {};
          return { agent: payload };
        }
        case 'agents.update': {
          const id = params.id || params.agentId;
          const idx = state.agents.findIndex(a => a.id === id);
          if (idx >= 0) state.agents[idx] = { ...state.agents[idx], ...params, id };
          return { updated: idx >= 0 };
        }
        case 'agents.delete': {
          const id = params.agentId;
          state.agents = state.agents.filter(a => a.id !== id);
          delete state.files[id];
          state.sessions = state.sessions.filter(s => s.agentId !== id);
          return { deleted: true };
        }
        case 'agents.files.list':
          return { files: filesForAgent(params.agentId) };
        case 'agents.files.get': {
          const content = state.files[params.agentId]?.[params.path] || '';
          return { content };
        }
        case 'agents.files.set':
          if (!state.files[params.agentId]) state.files[params.agentId] = {};
          state.files[params.agentId][params.path] = params.content;
          return { saved: true };
        case 'models.list':
          return { models: state.models.slice() };
        case 'channels.status':
          return { channels: state.channels.slice() };
        case 'logs.tail':
          setTimeout(() => {
            socket._emit({
              type: 'event',
              event: 'logs.tail',
              payload: { lines: ['INFO Gateway boot completed'] },
            });
            socket._emit({ type: 'event', event: 'log', payload: 'WARN mock warning line' });
          }, 10);
          return { lines: ['INFO Gateway ready'] };
        case 'chat.history':
          return { entries: (entries[params.sessionKey] || []).slice() };
        case 'chat.send':
          setTimeout(() => {
            socket._emit({ type: 'event', event: 'agent', payload: { delta: 'mock reply' } });
            socket._emit({ type: 'event', event: 'agent', payload: { summary: 'done', status: 'completed' } });
          }, 5);
          return { status: 'accepted' };
        case 'chat.abort':
          return { aborted: true };
        case 'config.get':
          return { config: state.config };
        case 'config.patch':
          state.config = { ...state.config, ...(params.patch || {}) };
          return { config: state.config };
        case 'cron.list':
          return { jobs: state.jobs.slice() };
        default:
          return {};
      }
    }

    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this._closed = false;
        setTimeout(() => {
          if (this._closed) return;
          this.readyState = 1;
          if (this.onopen) this.onopen({ type: 'open' });
          this._emit({ type: 'event', event: 'connect.challenge', payload: { nonce: 'nonce-1' } });
        }, 0);
      }

      _emit(msg) {
        if (this._closed || !this.onmessage) return;
        this.onmessage({ data: JSON.stringify(msg) });
      }

      send(raw) {
        const msg = JSON.parse(raw);
        if (msg.method === 'connect') {
          this._emit(response(msg.id, { type: 'hello-ok' }, true));
          return;
        }
        const payload = onMethod(msg.method, msg.params || {}, this);
        this._emit(response(msg.id, payload, true));
      }

      close() {
        this._closed = true;
        this.readyState = 3;
        if (this.onclose) this.onclose({ code: 1000, reason: 'closed' });
      }
    }

    MockWebSocket.OPEN = 1;
    window.WebSocket = MockWebSocket;
  });
}

test.beforeEach(async ({ page }) => {
  await installMockGateway(page);
  await page.goto('/');
});

test('setup shows node-first runtime guidance', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('openclaw-desktop'));
  await page.goto('/#setup');

  await expect(page.getByText('Node.js Runtime')).toBeVisible();
  await expect(page.getByText(/officially recommends Node\.js/i)).toBeVisible();
  await expect(page.getByText('Bun (optional)')).toBeVisible();
});

test('dashboard shows gateway status and session metrics', async ({ page }) => {
  await expect(page.locator('#gw-dot.on')).toBeVisible();
  await page.locator('.nav-item[data-route="dashboard"]').click();

  await expect(page.getByText('Cron')).toBeVisible();
  await expect(page.locator('#sessions-list .glass-card').first()).toContainText('Primary Session');
  await expect(page.locator('#sessions-list .glass-card').first()).toContainText('Latest assistant answer');
});

test('logs view receives tail and event logs', async ({ page }) => {
  await page.locator('.nav-item[data-route="logs"]').click();
  await expect(page.locator('#log-box')).toContainText('INFO Gateway ready');
  await expect(page.locator('#log-box')).toContainText('WARN mock warning line');
});

test('chat supports compact and delete session operations', async ({ page }) => {
  await page.locator('.nav-item[data-route="chat"]').click();

  await page.fill('#chat-input', '/compact');
  await page.keyboard.press('Enter');
  await expect(page.locator('#chat-msgs')).toContainText(/compacted|压缩/i);

  page.once('dialog', dialog => dialog.accept());
  await page.click('#btn-delete');
  await expect(page.locator('#chat-msgs')).toContainText(/deleted|删除/i);
});

test('agents supports create update delete lifecycle', async ({ page }) => {
  await page.locator('.nav-item[data-route="agents"]').click();

  await page.locator('#agents-grid [data-id="agent-alpha"]').click();
  await page.fill('#agent-name', 'Alpha Updated');
  await page.click('#agent-update');

  page.once('dialog', dialog => dialog.accept('{"id":"agent-new","name":"New Agent","model":"gpt-4o-mini","workspace":"/tmp/new"}'));
  await page.click('#agents-create');
  await expect(page.locator('#agents-grid')).toContainText('New Agent');

  await page.locator('#agents-grid [data-id="agent-new"]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.click('#agent-delete');
  await expect(page.locator('#agents-grid')).not.toContainText('agent-new');
});
