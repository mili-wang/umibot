# Gateway WebSocket 后端返回设计说明

本文档描述：与 `src/gateway.ts` 连接的 **WebSocket 服务端** 应如何设计返回结果，以便客户端能正确建连、鉴权、收事件与心跳。

**从连接到对话的完整 WS 流程与传参说明**（客户端 + 服务端）见：[ws-connection-and-messages.md](./ws-connection-and-messages.md)。

---

## 0. 自建 WSS 后，umibot 侧要改哪些接口才能收到消息

**结论：只改「网关地址」即可，其它接口不用动。**

| 是否要改 | 接口/位置 | 说明 |
|----------|------------|------|
| **必须改** | `src/api.ts` 里 **`getGatewayUrl()`** 的返回值 | 让它返回你的 WSS 地址（你已改为自定义 URL）。收消息全靠这条连接，改对即可。 |
| **不用改** | `getAccessToken()`、`apiRequest()`、`API_BASE`、发消息接口等 | 收消息只走 WS；鉴权/发消息仍用现有逻辑。客户端会用 UMI 的 token 在 Identify 里发给你的 WSS，你后端可校验或忽略。 |
| **可选** | `getGatewayUrl()` 内部是否请求 UMI `/gateway` | 若已固定用自建 WSS，可不再调 `apiRequest(..., "GET", "/gateway")`，直接 `return 'wss://你的地址';`，避免无意义的官方 API 请求。 |

**后端要做的事**：按下面第 1～4 节的协议，对每条「用户发给机器人的消息」向该连接推送一条 **op=0、t=C2C_MESSAGE_CREATE**（或对应事件）、**d** 符合 `src/types.ts`、**s** 递增 的报文。无需在 umibot 里改其它接口。

---

## 1. 统一报文格式

每条下行消息建议使用与 UMI 官方一致的负载结构：

```ts
interface WSPayload {
  op: number;   // 操作码，见下表
  d?: unknown;  // 与 op 对应的数据
  s?: number;  // 服务端序列号（Dispatch 必带，用于 Resume/心跳）
  t?: string;  // 事件类型（仅 op=0 时存在）
}
```

---

## 2. 后端必须实现的 op 及返回时机

### 2.1 连接建立后：先发 Hello (op=10)

客户端连上 WS 后，**后端必须先发一条 Hello**，否则客户端不会发 Identify/Resume。

```json
{
  "op": 10,
  "d": {
    "heartbeat_interval": 30000
  }
}
```

- `heartbeat_interval`：毫秒，客户端将按此间隔发送 op=1 心跳。
- 本条**不需要** `s`、`t`。

---

### 2.2 鉴权结果：Dispatch READY (op=0) 或 Invalid Session (op=9)

客户端收到 Hello 后会发 **Identify (op=2)** 或 **Resume (op=6)**。

**成功时**：发一条 **Dispatch + READY**（op=0, t=READY），并带 `s`：

```json
{
  "op": 0,
  "s": 1,
  "t": "READY",
  "d": {
    "session_id": "your-session-id-string"
  }
}
```

- `session_id`：会话 ID，客户端会存下来，断线重连时用 op=6 Resume 带上。
- `s`：本条消息的序列号，客户端会保存为 `lastSeq`，用于心跳和 Resume。

**Resume 成功时**：发一条 **Dispatch + RESUMED**（op=0, t=RESUMED），同样带 `s`：

```json
{
  "op": 0,
  "s": 2,
  "t": "RESUMED",
  "d": null
}
```

**鉴权失败时**：发 **Invalid Session (op=9)**：

```json
{
  "op": 9,
  "d": false
}
```

- `d === false`：客户端会清空 session、重试下一档 intents 或刷新 token。
- `d === true`：表示可恢复，客户端会重连并尝试 Resume。

---

### 2.3 心跳回应：Heartbeat ACK (op=11)

客户端按 `heartbeat_interval` 发送 **Heartbeat (op=1)**，body 为 `{ "op": 1, "d": lastSeq }`。

后端只需回一条 **ACK**，不需要带 `d`：

```json
{
  "op": 11
}
```

---

### 2.4 事件推送：Dispatch (op=0) + 事件类型 t

所有业务事件都用 **op=0**，用 **t** 区分类型，**d** 为事件内容；**每条都要带递增的 s**。

| t | 含义 | d 结构参考 |
|---|------|------------|
| `READY` | 鉴权成功 | `{ session_id: string }` |
| `RESUMED` | 恢复成功 | `null` |
| `C2C_MESSAGE_CREATE` | 单聊消息 | `C2CMessageEvent`（见下） |
| `AT_MESSAGE_CREATE` | 频道 @ 消息 | `GuildMessageEvent` |
| `DIRECT_MESSAGE_CREATE` | 频道私信 | `GuildMessageEvent` |
| `GROUP_AT_MESSAGE_CREATE` | 群 @ 消息 | `GroupMessageEvent` |

**C2C_MESSAGE_CREATE 示例**（与 gateway 解析一致）：

- **d 里建议带 `uuid`**（发送者 openid），与 `author.user_openid` 一致即可。若只传 `author` 不传 `uuid`，客户端会退化为用 `author.user_openid` 或 `author.id` 作为发送者。
- **每条消息的 `s` 必须全局递增**（见下「第二次、第三次…消息」）。
- **每条消息的 `d.id`（消息 ID）必须唯一**。重复的 messageId 会导致频道服务崩溃。若后端重复推送相同 `id`，客户端会按「最近 5 万个 messageId」做去重：同一 id 只要在缓存内（未因容量淘汰）无论隔多久再次出现都会丢弃，只处理第一次。

第一条示例：

```json
{
  "op": 0,
  "s": 2,
  "t": "C2C_MESSAGE_CREATE",
  "d": {
    "uuid": "用户 openid（与 author.user_openid 一致）",
    "room_id": "可选",
    "author": {
      "id": "用户ID",
      "union_openid": "",
      "user_openid": "用户 openid"
    },
    "content": "消息正文",
    "id": "消息ID",
    "timestamp": "2026-03-16T11:13:09+08:00",
    "message_scene": { "source": "default" },
    "attachments": []
  }
}
```

**第二次、第三次…消息怎么发**

- 格式与上面**完全一致**，只改这几项：
  - **`s`**：必须比上一条大，例如第一条 `s: 2`，第二条 **`s: 3`**，第三条 **`s: 4`**，依次递增。
  - **`d.id`**：新消息用新的消息 ID（唯一）。
  - **`d.content`**：新内容。
  - **`d.timestamp`**：新时间。
- **`d.uuid` / `d.author`**：同一用户对话可保持不变；换用户则改对应用户信息。
- 若**第二条收不到**，请检查：1）是否每条都发了**递增的 s**；2）是否在同一连接上连续发两条（不要断连）；3）服务端是否有逻辑漏发第二条 WS 帧。

其他事件（AT_MESSAGE_CREATE、GROUP_AT_MESSAGE_CREATE 等）的 **d** 结构见 `src/types.ts` 中的 `GuildMessageEvent`、`GroupMessageEvent`。

---

### 2.5 要求重连：Reconnect (op=7)

若后端希望客户端主动断开并重新建连（例如节点迁移）：

```json
{
  "op": 7,
  "d": null
}
```

客户端会执行 `cleanup()` 并 `scheduleReconnect()`。

---

## 3. 客户端上行一览（供后端解析）

| op | 含义 | 客户端发送内容 |
|----|------|----------------|
| 2 | Identify | `d: { token: "UMIBot <accessToken>", intents: number, shard: [0,1] }` |
| 6 | Resume | `d: { token: "UMIBot <accessToken>", session_id: string, seq: number }` |
| 1 | Heartbeat | `d: lastSeq`（上一包收到的 s，若无则为 null） |

---

## 4. 推荐时序（后端视角）

1. 连接建立 → 立刻发 **Hello (op=10)**，带 `heartbeat_interval`。
2. 收到 **Identify (op=2)** → 校验 token，成功则发 **Dispatch READY (op=0)** 带 `session_id` 和 `s`；失败则发 **Invalid Session (op=9)**。
3. 收到 **Resume (op=6)** → 校验 session_id + seq，成功则发 **Dispatch RESUMED (op=0)** 带 `s`；失败则发 **Invalid Session (op=9)**。
4. 之后每条 **Heartbeat (op=1)** → 回 **Heartbeat ACK (op=11)**。
5. 有业务事件时发 **Dispatch (op=0)**，`t` 为事件名，`d` 为事件体，**s 递增**。

只要按上述格式和顺序返回，`gateway.ts` 即可完成连接、鉴权、心跳、收消息与断线重连。

---

## 5. 常见问题：改成自定义 WSS 后 openclaw 收不到消息

**原因**：umibot 的**收消息**完全来自当前连接的 WSS。改用自定义地址（如 `wss://xxx.umi6.com/ws/...`）后，客户端不再连 UMI 官方网关，只会收到你的 WSS 后端主动下发的帧。若后端没有把「用户发给机器人的消息」转成并推送 **op=0、t=C2C_MESSAGE_CREATE**（或 AT_MESSAGE_CREATE、GROUP_AT_MESSAGE_CREATE 等）且 **d** 结构符合 `src/types.ts` 的 C2CMessageEvent/GuildMessageEvent/GroupMessageEvent，gateway 就不会往 openclaw 投递，表现为「发消息后 openclaw 接收不到」。

**发送消息**仍走 `api.sgroup.qq.com` 的 HTTP 接口，与 WSS 地址无关，所以机器人主动发出去的消息对方能收到。

**解决思路**：

1. **自建 WSS 作为 UMI 网关代理**：后端连 UMI 官方 gateway，把收到的 UMI 事件原样（或按协议格式）转发给 umibot 客户端；或  
2. **自建 WSS 自产事件**：后端从其它渠道（如 HTTP 回调、其它 MQ）拿到「用户发给机器人的消息」后，按 `docs/gateway-ws-backend.md` 的格式组包，向该连接下发 `op=0, t=C2C_MESSAGE_CREATE, d={...}, s=递增`。

无论哪种方式，只要在「用户发消息」发生时，对应该连接能收到一条格式正确的 Dispatch（op=0 + 对应 t + 正确 d），openclaw 就能收到并处理。
