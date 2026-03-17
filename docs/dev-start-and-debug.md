# Umi Bot 项目启动与调试指南

本文说明如何**启动**本插件，以及如何进行**本地开发与调试**。  
本仓库是 **OpenClaw 的渠道插件**，没有独立可执行程序，也没有传统意义上的“前端页面”——对话界面在 **Umi 客户端**（手机/电脑 App）中，本插件只负责在 OpenClaw 与 QQ 机器人 API 之间转发消息。

---

## 一、项目如何启动

### 1. 前提：已安装 OpenClaw

本插件依赖 [OpenClaw](https://github.com/sliverp/openclaw)，需先安装 OpenClaw CLI：

```bash
# 安装 OpenClaw（具体命令以官方文档为准，例如）
npm install -g openclaw
# 或
npx openclaw --version
```

并已在 [Umi 开放平台](https://q.umi.com/) 创建机器人，拿到 **AppID** 和 **AppSecret**。

---

### 2. 安装 Umi Bot 插件

**方式 A：从 npm 安装（推荐生产环境）**

```bash
openclaw plugins install @mili-wang/umibot@latest
# 或 README 中的包名：@sliverp/umibot
```

**方式 B：从本仓库源码安装（用于开发/调试）**

```bash
cd /path/to/umibot
npm run build
openclaw plugins install .
```

这样会把当前目录的 `dist` 等作为插件安装到 OpenClaw 的扩展目录（如 `~/.openclaw/extensions/umibot`），后续改代码只需重新 `npm run build` 再重启 gateway。

---

### 3. 配置机器人通道

```bash
openclaw channels add --channel umibot --token "AppID:AppSecret"
```

或直接编辑 **OpenClaw 的配置文件**，在 `channels.umibot` 中配置 `appId`、`clientSecret`（见 README）。

**OpenClaw 配置文件在哪里？**

- 配置文件**由 OpenClaw 主程序决定**，umibot 插件只读取框架传入的 `cfg`，不直接读文件。
- **常见路径**（以 OpenClaw 官方约定为准）：
  - **用户目录**：`~/.openclaw/openclaw.json`（Windows 为 `%USERPROFILE%\.openclaw\openclaw.json`）
  - 若通过 `openclaw channels add --channel umibot --token "AppID:Secret"` 配置，通常会写入上述文件。
- 若你打开的 `openclaw.json` 里**没有** `channels.umibot`，说明：
  1. 可能看的是**项目根目录**下的 `openclaw.json`（仅示例或别用），OpenClaw 实际加载的往往是 **用户目录** 下的 `~/.openclaw/openclaw.json`；
  2. 或尚未添加 umibot 配置，需要在该文件中**新增** `channels.umibot`。

**如何确认当前生效的配置文件？**

- 在终端执行：`openclaw config get channels.umibot` 或 `openclaw config list`（具体命令以 OpenClaw 版本为准），可查看当前是否已有 `channels.umibot`。
- 或直接编辑 **用户目录** 下的文件（确保存在再改）：
  ```bash
  # Linux/macOS
  cat ~/.openclaw/openclaw.json
  # 若没有 channels.umibot，可添加（注意保留原有其他配置）：
  # "channels": { "umibot": { "enabled": true, "appId": "...", "clientSecret": "...", "markdownSupport": false } }
  ```

---

### 4. 启动网关（真正“启动”）

```bash
openclaw gateway
```

如需前台运行并看详细日志（推荐调试时使用）：

```bash
openclaw gateway --port 18789 --verbose
```

启动后，在 Umi 里找到你的机器人发消息即可测试。  
**总结**：本项目的“启动”= 先装 OpenClaw → 装 umibot 插件 → 配置 token → 运行 `openclaw gateway`。

---

## 二、本地开发：编译与热更新

- **编译 TypeScript**  
  - 一次性：`npm run build`  
  - 监听模式：`npm run dev`（改代码自动重新编译）

- **使用本地构建的插件**  
  安装一次后，每次改完代码只需：
  1. `npm run build`（或依赖 `npm run dev` 已编译）
  2. 重启网关：`openclaw gateway stop && openclaw gateway --port 18789 --verbose`

若安装时用的是 `openclaw plugins install .`，OpenClaw 会使用你本机 `umibot` 目录下的 `dist`，因此无需重新执行 `plugins install`。

---

## 三、“前端”说明与调试方式

本项目**没有自带前端项目**（无 React/Vue 等）：

- **用户看到的界面**：在 **Umi 客户端**（手机 Umi / 电脑 Umi）里和机器人对话。
- **本仓库**：只有 Node.js/TypeScript 的**渠道插件**（连接 QQ 机器人 API + OpenClaw）。

因此“前端调试”可以理解为两类：

1. **在 Umi 里联调**：启动 `openclaw gateway` 后，在 Umi 里发消息，观察机器人回复是否正常（无需单独调试“前端代码”）。
2. **调试插件本身**：下面说的都是**插件端（Node/TS）的调试**。

---

## 四、插件端调试（推荐）

### 4.1 用日志调试（最直接）

启动时加 `--verbose`，观察控制台输出：

```bash
openclaw gateway --port 18789 --verbose
```

插件内关键逻辑在 `src/gateway.ts`、`src/api.ts`、`src/outbound.ts` 等，已有 `console.log`/`console.error`，可根据日志排查问题。

---

### 4.2 使用 VS Code 调试（断点调试）

若希望用 VS Code 断点调试 **OpenClaw 进程（其中会加载 umibot）**，可以：

1. **先确认从源码安装插件**（见上文“从本仓库源码安装”）。
2. 在项目根目录创建 `.vscode/launch.json`，用 **“附加到进程”** 或 **“通过 NODE_OPTIONS 启动”** 两种方式之一。

**方式一：先启动再附加（推荐）**

- 终端执行：  
  `openclaw gateway --port 18789 --verbose`  
  或（若 openclaw 是 node 脚本）：  
  `node --inspect-brk $(which openclaw) gateway --port 18789 --verbose`
- 在 VS Code 里：运行与调试 → “Attach to Node Process”，选择对应的 node 进程。

**方式二：用 launch 配置直接跑（需知道 openclaw 入口）**

若 OpenClaw 安装后有一个可执行的 node 脚本路径，例如 `OPENCLAW_ENTRY`，可配置：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "OpenClaw Gateway (with umibot)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "openclaw",
      "runtimeArgs": ["gateway", "--port", "18789", "--verbose"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

若你的 OpenClaw 是用 `node xxx.js` 启动的，则把 `runtimeExecutable` 改为 `node`，`runtimeArgs` 改为 `["/path/to/openclaw-gateway.js", "--port", "18789", "--verbose"]`。  
**注意**：插件代码在 `src/*.ts`，编译后为 `dist/**/*.js`，断点可打在 `dist` 下对应行，或配合 `sourceMap: true` 打在 `src`（需在 tsconfig 开启 sourceMap）。

---

### 4.3 只跑脚本（不通过 OpenClaw）

仓库里有些脚本可单独跑，用于测试接口或逻辑，例如：

- `scripts/send-proactive.ts`：主动消息脚本（通常需在 OpenClaw 配置好的环境下用）。
- 若存在其它脚本，可用 `npx ts-node scripts/xxx.ts` 或 `node dist/scripts/xxx.js` 运行。

这类脚本不提供“前端界面”，只是辅助验证能力。

---

## 五、常用命令速查

| 目的           | 命令 |
|----------------|------|
| 编译           | `npm run build` |
| 监听编译       | `npm run dev` |
| 从源码安装插件 | `openclaw plugins install .` |
| 配置通道       | `openclaw channels add --channel umibot --token "AppID:AppSecret"` |
| 启动网关       | `openclaw gateway` |
| 前台+详细日志  | `openclaw gateway --port 18789 --verbose` |
| 停止网关       | `openclaw gateway stop` |
| 升级插件(npx)  | `npx @mili-wang/umibot upgrade` |

---

## 六、总结

- **启动**：安装 OpenClaw → 安装 umibot 插件（npm 或 `openclaw plugins install .`）→ 配置 `channels.umibot` → 运行 `openclaw gateway`。
- **前端**：没有独立前端；对话在 Umi 客户端完成，前端调试 = 在 Umi 里发消息做联调。
- **插件调试**：`--verbose` 看日志；需要断点时用 VS Code 附加到 `openclaw gateway` 进程或配置 launch.json 启动 gateway，在 `dist`（或带 sourceMap 的 `src`）里下断点即可。

如有 OpenClaw 或 Umi 开放平台的具体版本差异，以官方文档为准。
