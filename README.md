# OpenClaw Desktop

<p align="center">
  <img src="src/assets/logo.svg" width="128" height="128" alt="OpenClaw">
</p>

<p align="center">
  <strong>OpenClaw Gateway 桌面管理器</strong><br>
  跨平台 · 轻量 · 中英双语
</p>

<p align="center">
  <a href="https://github.com/telagod/OpenClaw-app/releases/latest">
    <img src="https://img.shields.io/github/v/release/telagod/OpenClaw-app?style=flat-square" alt="Release">
  </a>
  <a href="https://github.com/telagod/OpenClaw-app/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/telagod/OpenClaw-app/build.yml?style=flat-square" alt="CI">
  </a>
</p>

---

## 功能 Features

- 🏗️ **一键部署** — 5 步向导自动安装 Bun + OpenClaw + 配置 Provider + 启动 Gateway
- 📊 **仪表盘** — Gateway 状态、会话统计、Agent/模型/渠道概览
- 💬 **对话** — 直接与 Agent 交互，支持多会话
- 🤖 **Agent 管理** — 查看/编辑 Agent 配置和 Workspace 文件
- ⚙️ **设置** — Gateway 连接、模型列表、配置编辑、自动更新
- 📱 **移动端** — Android APK，扫码连接 + 局域网探测
- 🌐 **多语言** — 中英双语，自动检测系统语言
- 🔔 **推送通知** — 新消息 + 连接状态变化
- 🔄 **自动更新** — 启动自动检查，一键更新

## 下载 Download

| 平台 | 下载 |
|------|------|
| macOS (Apple Silicon) | [.dmg (aarch64)](https://github.com/telagod/OpenClaw-app/releases/latest) |
| macOS (Intel) | [.dmg (x64)](https://github.com/telagod/OpenClaw-app/releases/latest) |
| Windows | [.exe / .msi](https://github.com/telagod/OpenClaw-app/releases/latest) |
| Linux | [.deb / .rpm / .AppImage](https://github.com/telagod/OpenClaw-app/releases/latest) |
| Android | [.apk](https://github.com/telagod/OpenClaw-app/releases/latest) |

## 截图 Screenshots

> TODO: 添加截图

## 开发 Development

```bash
# 安装依赖
npm install

# 开发模式
npx tauri dev

# 构建
npx tauri build
```

### 前置条件

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) >= 18
- 平台依赖: 参考 [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)

## 架构 Architecture

```
src/                  # 前端 (vanilla JS + ES modules)
├── app.js            # 主入口，路由，导航
├── i18n.js           # 国际化 (中/英)
├── components/
│   ├── ws-client.js  # WebSocket 客户端
│   └── icons.js      # SVG 图标
├── views/
│   ├── setup.js      # 部署向导 (桌面5步/移动2步)
│   ├── dashboard.js  # 仪表盘
│   ├── chat.js       # 对话
│   ├── agents.js     # Agent 管理
│   └── settings.js   # 设置
└── styles/
    └── main.css      # 深色玻璃拟态主题

src-tauri/            # Tauri 后端 (Rust)
├── src/lib.rs        # 插件注册
├── tauri.conf.json   # 应用配置
└── capabilities/     # 权限声明
```

- **无框架/无打包器** — 纯 vanilla JS ES modules，Tauri 直接加载
- **轻量** — 安装包仅 ~5MB，Bun 运行时按需下载
- **桌面**: Shell 插件执行本地命令 (Bun/OpenClaw)
- **移动**: 纯 WebSocket 客户端，连接远程 Gateway

## 许可 License

MIT
