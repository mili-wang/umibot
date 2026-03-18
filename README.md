<div align="center">



<img width="120" src="https://img.shields.io/badge/🤖-Umi_Bot-blue?style=for-the-badge" alt="Umi Bot" />

# Umi Bot Channel Plugin for OpenClaw

**Connect your AI assistant to Umi — private chat, group chat, and rich media, all in one plugin.**

[![npm version](https://img.shields.io/npm/v/@mili-wang/umibot?color=blue&label=npm)](https://www.npmjs.com/package/@mili-wang/umibot)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Umi Bot](https://img.shields.io/badge/Umi_Bot-API_v2-red)](https://bot.q.umi.com/wiki/)
[![Platform](https://img.shields.io/badge/platform-OpenClaw-orange)](https://github.com/mili-wang/openclaw)
[![Node.js](https://img.shields.io/badge/Node.js->=18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<br/>

**[简体中文](README.zh.md) | English**

Scan to join the Umi group chat

<img width="300" height="540" alt="Clipboard_Screenshot_1773047715" src="https://github.com/user-attachments/assets/4d2d2337-229a-42ad-97ab-8a6d0607f296" />


</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔒 **Multi-Scene** | C2C private chat, group @messages, channel messages, channel DMs |
| 🖼️ **Rich Media** | Send & receive images, voice, video, and files |
| 🎙️ **Voice (STT/TTS)** | Speech-to-text transcription & text-to-speech replies |
| ⏰ **Scheduled Push** | Proactive message delivery via scheduled tasks |
| 🔗 **URL Support** | Direct URL sending in private chat (no restrictions) |
| ⌨️ **Typing Indicator** | "Bot is typing..." status shown in real-time |
| 🔄 **Hot Reload** | Install via npm with seamless hot updates |
| 📝 **Markdown** | Full Markdown formatting support |
| 🛠️ **Commands** | Native OpenClaw command integration |

---

## 📸 Feature Showcase

> **Note:** This plugin serves as a **message channel** only — it relays messages between Umi and OpenClaw. Capabilities like image understanding, voice transcription, drawing, etc. depend on the **AI model** you configure and the **skills** installed in OpenClaw, not on this plugin itself.

<details>
<summary><b>🎙️ Voice Messages (STT)</b> — AI understands voice messages, auto-transcribes speech to text</summary>

> **You**: *(send a voice message)* "What's the weather like tomorrow in Shenzhen?"
>
> **UmiBot**: Tomorrow (March 7, Saturday) Shenzhen weather forecast 🌤️ ...

<img width="360" src="docs/images/fc7b2236896cfba3a37c94be5d59ce3e_720.jpg" alt="Voice STT Demo" />

</details>

<details>
<summary><b>📄 File Understanding</b> — Send any file, AI reads and understands it</summary>

> **You**: *(send a TXT file of "War and Peace")*
>
> **UmiBot**: Got it! You uploaded the Chinese version of "War and Peace" by Leo Tolstoy. This appears to be the opening of Chapter 1...

<img width="360" src="docs/images/07bff56ab68e03173d2af586eeb3bcee_720.jpg" alt="File Understanding Demo" />

</details>

<details>
<summary><b>🖼️ Image Understanding</b> — Vision-capable models can see and describe images</summary>

> **You**: *(send an image)*
>
> **UmiBot**: Haha, so cute! Is that a Umi penguin in a lobster costume? 🦞🐧 ...

<img width="360" src="docs/images/59d421891f813b0d3c0cbe12574b6a72_720.jpg" alt="Image Understanding Demo" />

</details>

<details>
<summary><b>🎨 Image Generation</b> — Ask the bot to draw, it sends the result back</summary>

> **You**: Draw me a cat
>
> **UmiBot**: Here you go! 🐱

<img width="360" src="docs/images/4645f2b3a20822b7f8d6664a708529eb_720.jpg" alt="Image Generation Demo" />

</details>

<details>
<summary><b>🔊 Voice Reply (TTS)</b> — Bot replies with voice messages</summary>

> **You**: Tell me a joke in voice
>
> **UmiBot**: *(sends a voice message)*

<img width="360" src="docs/images/21dce8bfc553ce23d1bd1b270e9c516c.jpg" alt="TTS Voice Demo" />

</details>

<details>
<summary><b>📎 File Sending</b> — Generate and send files of any format (up to 20MB)</summary>

> **You**: Extract chapter 1 of War and Peace and send it as a file
>
> **UmiBot**: *(sends a .txt file)*

<img width="360" src="docs/images/17cada70df90185d45a2d6dd36e92f2f_720.jpg" alt="File Sending Demo" />

</details>

<details>
<summary><b>🎬 Video Sending</b> — Send videos, large files auto-show upload progress</summary>

> **You**: Send me a demo video
>
> **UmiBot**: *(sends a video)*

<img width="360" src="docs/images/85d03b8a216f267ab7b2aee248a18a41_720.jpg" alt="Video Sending Demo" />

</details>

> For a deep dive into rich media capabilities, see the [Media Guide](docs/umibot-media-guide.md).

---

## ⭐ Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=mili-wang/umibot&type=date&legend=top-left)](https://www.star-history.com/#mili-wang/umibot&type=date&legend=top-left)

</div>

---

## 🚀 Getting Started

### Step 1 — Create a Umi Bot on the Umi Open Platform

1. Go to the [Umi Open Platform](https://q.umi.com/) and **scan the QR code with your phone Umi** to register / log in. If you haven't registered before, scanning will automatically complete the registration and bindyour Umi account.

<img width="3246" height="1886" alt="Clipboard_Screenshot_1772980354" src="https://github.com/user-attachments/assets/d8491859-57e8-47e4-9d39-b21138be54d0" />

2. After scanning, tap **Agree** on your phone — you'll land on the bot configuration page.
3. Click **Create Bot** to create a new Umi bot.

<img width="1982" height="1316" alt="Clipboard_Screenshot_1772980440" src="https://github.com/user-attachments/assets/3ccb494d-6e4d-462c-9218-b4dfd43a254f" />

4. Find **AppID** and **AppSecret** on the bot's page, click **Copy** for each, and save them somewhere safe (e.g., a notepad). **AppSecret is not stored in plaintext — if you leave the page without saving it, you'll have to regenerate a new one.**

<img width="1670" height="1036" alt="Clipboard_Screenshot_1772980413" src="https://github.com/user-attachments/assets/b898d171-5711-4d42-bc07-2de967b119ec" />


> For a step-by-step walkthrough with screenshots, see the [official guide](https://cloud.tencent.com/developer/article/2626045).

> ⚠️ The bot will automatically appear in your Umi message list and send a first message. However, it will reply "The bot has gone to Mars" until you complete the configuration steps below.

### Step 2 — Install the Plugin

```bash
# Via OpenClaw CLI (recommended)
openclaw plugins install @mili-wang/umibot@latest

# Or from source
git clone https://github.com/mili-wang/umibot.git && cd umibot
openclaw plugins install .
```

### Step 3 — Configure OpenClaw

**Option 1: CLI Wizard (Recommended)**

```bash
openclaw channels add --channel umibot --token "AppID:AppSecret"
```

**Option 2: Edit Config File**

Edit `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "umibot": {
      "enabled": true,
      "appId": "Your AppID",
      "clientSecret": "Your AppSecret"
    }
  }
}
```

### Step 4 — Start & Test

```bash
openclaw gateway
```

Open Umi, find your bot, and send a message!

<div align="center">
<img width="500" alt="Chat Demo" src="https://github.com/user-attachments/assets/b2776c8b-de72-4e37-b34d-e8287ce45de1" />
</div>

---

## 🤖 Multi-Account Setup (Multi-Bot)

Run multiple Umi bots under a single OpenClaw instance.

### Configuration

Edit `~/.openclaw/openclaw.json` and add an `accounts` field under `channels.umibot`:

```json
{
  "channels": {
    "umibot": {
      "enabled": true,
      "appId": "111111111",
      "clientSecret": "secret-of-bot-1",

      "accounts": {
        "bot2": {
          "enabled": true,
          "appId": "222222222",
          "clientSecret": "secret-of-bot-2"
        },
        "bot3": {
          "enabled": true,
          "appId": "333333333",
          "clientSecret": "secret-of-bot-3"
        }
      }
    }
  }
}
```

**Notes:**

- The top-level `appId` / `clientSecret` is the **default account** (accountId = `"default"`)
- Each key under `accounts` (e.g. `bot2`, `bot3`) is the `accountId` for that bot
- Each account can independently configure `enabled`, `name`, `allowFrom`, `systemPrompt`, etc.
- You may also skip the top-level default account and only configure bots inside `accounts`

Add a second bot via CLI (if the framework supports the `--account` parameter):

```bash
openclaw channels add --channel umibot --account bot2 --token "222222222:secret-of-bot-2"
```

### Sending Messages to a Specific Account's Users

When using `openclaw message send`, specify which bot to use with the `--account` parameter:

```bash
# Send with the default bot (no --account = uses "default")
openclaw message send --channel "umibot" \
  --target "umibot:c2c:OPENID" \
  --message "hello from default bot"

# Send with bot2
openclaw message send --channel "umibot" \
  --account bot2 \
  --target "umibot:c2c:OPENID" \
  --message "hello from bot2"
```

**Target Formats:**

| Format | Description |
|--------|-------------|
| `umibot:c2c:OPENID` | Private chat (C2C) |
| `umibot:group:GROUP_OPENID` | Group chat |
| `umibot:channel:CHANNEL_ID` | Guild channel |

> ⚠️ **Important**: Each bot has its own set of user OpenIDs. An OpenID received by Bot A **cannot** be used to send messages via Bot B — this will result in a 500 error. Always use the matching bot's `accountId` to send messages to its users.

### How It Works

- When `openclaw gateway` starts, all accounts with `enabled: true` launch their own WebSocket connections
- Each account maintains an independent Token cache (isolated by `appId`), preventing cross-contamination
- Incoming message logs are prefixed with `[umibot:accountId]` for easy debugging

---

## 🎙️ Voice Configuration (Optional)

### STT (Speech-to-Text) — Transcribe Incoming Voice Messages

STT supports two-level configuration with priority fallback:

| Priority | Config Path | Scope |
|----------|------------|-------|
| 1 (highest) | `channels.umibot.stt` | Plugin-specific |
| 2 (fallback) | `tools.media.audio.models[0]` | Framework-level |

```json
{
  "channels": {
    "umibot": {
      "stt": {
        "provider": "your-provider",
        "model": "your-stt-model"
      }
    }
  }
}
```

- `provider` — references a key in `models.providers` to inherit `baseUrl` and `apiKey`
- Set `enabled: false` to disable
- When configured, incoming voice messages are automatically converted (SILK→WAV) and transcribed

### TTS (Text-to-Speech) — Send Voice Messages

| Priority | Config Path | Scope |
|----------|------------|-------|
| 1 (highest) | `channels.umibot.tts` | Plugin-specific |
| 2 (fallback) | `messages.tts` | Framework-level |

```json
{
  "channels": {
    "umibot": {
      "tts": {
        "provider": "your-provider",
        "model": "your-tts-model",
        "voice": "your-voice"
      }
    }
  }
}
```

- `provider` — references a key in `models.providers` to inherit `baseUrl` and `apiKey`
- `voice` — voice variant
- Set `enabled: false` to disable (default: `true`)
- When configured, AI can use `<umivoice>` tags to generate and send voice messages

---

## 🔄 Upgrade

### Via OpenClaw / npm (Recommended)

> For installations via `openclaw plugins install`

```bash
openclaw plugins upgrade @mili-wang/umibot@latest
```

### Via npx

```bash
npx -y @mili-wang/umibot@latest upgrade
```

### Via upgrade-and-run.sh (One-Click)

```bash
bash ./upgrade-and-run.sh
```

When no `--appid` / `--secret` is provided, the script reads existing config from `~/.openclaw/openclaw.json` automatically.

```bash
# First-time or override credentials
bash ./upgrade-and-run.sh --appid YOUR_APPID --secret YOUR_SECRET
```

<details>
<summary>Full Options</summary>

| Option | Description |
|--------|-------------|
| `--appid <id>` | Umi Bot AppID |
| `--secret <secret>` | Umi Bot AppSecret |
| `--markdown <yes\|no>` | Enable Markdown format (default: no) |
| `-h, --help` | Show help |

Environment variables `UmiBOT_APPID`, `UmiBOT_SECRET`, `UmiBOT_TOKEN` (AppID:Secret) are also supported.

</details>

### Via pull-latest.sh (Git Source)

```bash
bash ./pull-latest.sh
```

<details>
<summary>Options</summary>

```bash
bash ./pull-latest.sh --branch main            # specify branch (default: main)
bash ./pull-latest.sh --force                   # skip prompts, force update
bash ./pull-latest.sh --repo <git-url>          # use a different repo
```

</details>

### From Source (Manual)

```bash
git clone https://github.com/mili-wang/umibot.git && cd umibot
bash ./scripts/upgrade.sh
openclaw plugins install .
openclaw channels add --channel umibot --token "AppID:AppSecret"
openclaw gateway restart
```

---

## 📚 Documentation

- [Rich Media Guide](docs/umibot-media-guide.md) — images, voice, video, files
- [Command Reference](docs/commands.md) — OpenClaw CLI commands
- [Changelog](docs/changelog/) — release notes ([latest: 1.5.4](docs/changelog/1.5.4.md))


