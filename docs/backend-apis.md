# Umi Bot 项目后端接口说明

本文档描述 **umibot** 插件在运行过程中调用的所有后端/外部接口。该插件是可与 **OpenClaw** 对话的 QQ 机器人渠道插件，支持私聊、群聊、频道消息，以及语音、图片、视频、文件等富媒体。

---

## 一、项目概览

| 项目 | 说明 |
|------|------|
| **名称** | @mili-wang/umibot |
| **类型** | OpenClaw / ClawdBot / MoltBot 渠道插件 |
| **能力** | 与 QQ 机器人 API 通信；可选 STT/TTS（OpenAI 兼容）；本地图床服务；主动消息与定时任务 |
| **入口** | `index.ts` → 注册 `qqbotPlugin` 渠道 |

**主要源码目录**：`src/`  
- **api.ts**：QQ 官方 HTTP API 封装（鉴权、消息、文件上传）  
- **gateway.ts**：WebSocket 连接、事件处理、STT 调用  
- **outbound.ts**：消息回复与富媒体发送（复用 api.ts）  
- **proactive.ts**：主动消息（复用 api.ts）  
- **utils/audio-convert.ts**：TTS 请求  
- **image-server.ts**：本地图床与 `downloadFile`（fetch 任意 URL）

---

## 二、QQ 官方后端接口（必选）

所有 QQ 机器人相关请求均基于以下两个根地址：

| 常量 | 根地址 | 说明 |
|------|--------|------|
| `TOKEN_URL` | `https://bots.qq.com/app/getAppAccessToken` | 鉴权，获取 access_token |
| `API_BASE` | `https://api.sgroup.qq.com` | 业务 API 根地址 |

请求头：`Authorization: QQBot <access_token>`，`Content-Type: application/json`（除上传文件外）。  
**定义位置**：`src/api.ts`（约第 9–10 行）

---

### 2.1 鉴权

| 方法 | 完整 URL | 说明 | 请求体 | 响应要点 |
|------|----------|------|--------|----------|
| **POST** | `https://bots.qq.com/app/getAppAccessToken` | 获取机器人 access_token | `{ appId, clientSecret }` | `access_token`, `expires_in` |

- 用于：`getAccessToken(appId, clientSecret)`，带缓存与 singleflight，多账号按 `appId` 隔离。  
- 可选：`startBackgroundTokenRefresh` 后台定时刷新；`clearTokenCache` 清除缓存。

---

### 2.2 网关

| 方法 | 路径 | 说明 | 响应要点 |
|------|------|------|----------|
| **GET** | `/gateway` | 获取 WebSocket 网关地址 | `{ url: string }` |

- 完整 URL：`https://api.sgroup.qq.com/gateway`  
- 用于：`getGatewayUrl(accessToken)`，在 `gateway.ts` 中建立 QQ 长连接。

---

### 2.3 消息发送（HTTP）

以下路径均以 `API_BASE` 为前缀：`https://api.sgroup.qq.com`。

| 方法 | 路径 | 说明 | 主要请求体/用途 |
|------|------|------|-----------------|
| **POST** | `/v2/users/{openid}/messages` | 私聊消息（文本 / Markdown / 富媒体 / 输入提示） | 见下表 |
| **POST** | `/v2/groups/{groupOpenid}/messages` | 群消息 | 同上 |
| **POST** | `/channels/{channelId}/messages` | 频道消息 | `content`, 可选 `msg_id` |

**私聊/群消息体常见形态**（由 `api.ts` 内 `buildMessageBody`、`buildProactiveMessageBody` 及媒体发送函数决定）：

- 文本：`content`, `msg_type: 0`, `msg_seq`, 可选 `msg_id`  
- Markdown：`markdown: { content }`, `msg_type: 2`, `msg_seq`, 可选 `msg_id`  
- 输入提示（正在输入）：`msg_type: 6`, `input_notify: { input_type: 1, input_second }`, `msg_seq`, 可选 `msg_id`  
- 富媒体：`msg_type: 7`, `media: { file_info }`, `msg_seq`, 可选 `content`、`msg_id`  

**封装函数（均在 `src/api.ts`）**：

- `sendC2CMessage`、`sendGroupMessage`、`sendChannelMessage`：被动回复  
- `sendC2CInputNotify`：私聊“正在输入”  
- `sendProactiveC2CMessage`、`sendProactiveGroupMessage`：主动消息（无 `msg_id`）  
- `sendC2CMediaMessage`、`sendGroupMediaMessage`：发送已上传的 `file_info`  
- 高层封装：`sendC2CImageMessage`、`sendGroupImageMessage`、`sendC2CVoiceMessage`、`sendGroupVoiceMessage`、`sendC2CVideoMessage`、`sendGroupVideoMessage`、`sendC2CFileMessage`、`sendGroupFileMessage`（内部先上传再发消息）

---

### 2.4 文件上传（富媒体）

| 方法 | 路径 | 说明 | 主要请求体 |
|------|------|------|------------|
| **POST** | `/v2/users/{openid}/files` | 私聊文件/图片/语音/视频上传 | `file_type`, `url` 或 `file_data`, 可选 `srv_send_msg`, `file_name`（文件类型时） |
| **POST** | `/v2/groups/{groupOpenid}/files` | 群文件/图片/语音/视频上传 | 同上 |

- `file_type`：1 图片、2 视频、3 语音、4 文件  
- 上传使用 `apiRequestWithRetry`（带重试），文件上传超时 120s。  
- 封装：`uploadC2CMedia`、`uploadGroupMedia`；发送时再调 `sendC2CMediaMessage` / `sendGroupMediaMessage`。

---

## 三、第三方 / 可配置接口（可选）

这些接口的 **baseUrl**（及 apiKey、model 等）由 OpenClaw 配置提供，通常为 OpenAI 或 Azure OpenAI 兼容服务。

---

### 3.1 语音转文字（STT）

| 方法 | URL 形式 | 说明 | 请求方式 |
|------|----------|------|----------|
| **POST** | `{baseUrl}/audio/transcriptions` | 语音转文字（OpenAI Whisper 兼容） | `FormData`: `file`, `model`；Header: `Authorization: Bearer {apiKey}` |

- **配置**：优先 `channels.umibot.stt`，回退 `tools.media.audio.models[0]`，并可继承 `models.providers[provider]` 的 `baseUrl` / `apiKey`。  
- **调用位置**：`src/gateway.ts` 中 `transcribeAudio(audioPath, cfg)`。  
- 插件侧做 STT 是为了避免把 WAV 二进制当文本注入 OpenClaw 上下文。

---

### 3.2 文字转语音（TTS）

| 方法 | URL 形式 | 说明 | 请求体 |
|------|----------|------|--------|
| **POST** | `{baseUrl}/audio/speech` | 文字转语音（OpenAI TTS 兼容） | JSON: `model`, `input`, `voice`, `response_format`（如 `pcm`/`mp3`）, 可选 `sample_rate`, `speed`；支持 URL 上 `queryParams`（如 Azure api-version） |

- **认证**：Bearer 或 `api-key` Header（由 `authStyle` 配置）。  
- **配置**：优先 `channels.umibot.tts`，回退 `messages.tts` 及对应 provider。  
- **调用位置**：`src/utils/audio-convert.ts` 中 `textToSpeechPCM` → `fetch(url, { method: "POST", headers, body: JSON.stringify(body) })`。

---

## 四、其他 HTTP 请求（通用）

以下为通用 fetch，不绑定固定“后端”，但会访问外部或本地 URL：

| 场景 | 位置 | 说明 |
|------|------|------|
| 按 URL 下载文件 | `src/image-server.ts` 的 `downloadFile(url, destDir, originalFilename?)` | `fetch(url)` 下载任意 URL 到本地，用于图片/文件等。 |
| 按 URL 获取图片尺寸 | `src/utils/image-size.ts` 的 `getImageSizeFromUrl(url, timeoutMs?)` | `fetch(url, { headers: { Range: "bytes=0-65535" } })` 取前 64KB 解析宽高。 |

---

## 五、本地服务（非“后端接口”）

- **图床服务**：`src/image-server.ts` 内建 HTTP 服务，对外提供 `baseUrl/images/{id}.{ext}`，供 QQ 消息中图片 URL 使用；不对外调用第三方“后端”，仅被 QQ 平台拉取图片。  
- **WebSocket**：与 `https://api.sgroup.qq.com/gateway` 返回的 `url` 建立 QQ 事件长连接，属于 QQ 官方能力，不列入“HTTP 后端接口”表。

---

## 六、接口汇总表（仅 HTTP 后端）

| 分类 | 方法 | URL/路径 | 用途 |
|------|------|----------|------|
| QQ 鉴权 | POST | `https://bots.qq.com/app/getAppAccessToken` | 获取 access_token |
| QQ 网关 | GET | `https://api.sgroup.qq.com/gateway` | 获取 WS 网关地址 |
| QQ 私聊消息 | POST | `https://api.sgroup.qq.com/v2/users/{openid}/messages` | 发私聊文本/富媒体/输入提示 |
| QQ 群消息 | POST | `https://api.sgroup.qq.com/v2/groups/{groupOpenid}/messages` | 发群文本/富媒体 |
| QQ 频道消息 | POST | `https://api.sgroup.qq.com/channels/{channelId}/messages` | 发频道文本 |
| QQ 私聊文件上传 | POST | `https://api.sgroup.qq.com/v2/users/{openid}/files` | 上传私聊图片/语音/视频/文件 |
| QQ 群文件上传 | POST | `https://api.sgroup.qq.com/v2/groups/{groupOpenid}/files` | 上传群图片/语音/视频/文件 |
| STT（可配置） | POST | `{baseUrl}/audio/transcriptions` | 语音转文字 |
| TTS（可配置） | POST | `{baseUrl}/audio/speech` | 文字转语音 |
| 通用 | GET | 任意 URL（downloadFile / getImageSizeFromUrl） | 下载文件、探测图片尺寸 |

---

## 七、相关文件索引

| 文件 | 职责 |
|------|------|
| `src/api.ts` | QQ 鉴权、网关、消息、文件上传全部 HTTP 调用 |
| `src/gateway.ts` | WebSocket 连接、事件处理、STT 调用、调用 api 发消息 |
| `src/outbound.ts` | 回复/富媒体发送（调用 api） |
| `src/proactive.ts` | 主动消息（调用 api） |
| `src/utils/audio-convert.ts` | TTS 请求 |
| `src/image-server.ts` | 图床服务、downloadFile |
| `src/utils/image-size.ts` | 从 URL 获取图片尺寸 |
| `src/config.ts` | 从 OpenClaw 配置解析 umibot 账户与 imageServerBaseUrl 等 |

若需对接自建后端或替换 STT/TTS 服务，只需在 OpenClaw 配置中修改对应 `baseUrl` 与认证信息即可；QQ 官方接口由 `src/api.ts` 统一封装，无需改 base 地址。
