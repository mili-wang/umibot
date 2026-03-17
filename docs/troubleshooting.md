# 运行与连接问题排查

本文收集 umibot 运行、连接 UMI 网关时的常见报错与处理方式。

---

## Too many quick disconnects（连接后很快被断开）

**日志示例：**

```
[umibot:default] Too many quick disconnects. This may indicate a permission issue.
[umibot:default] Please check: 1) AppID/Secret correct 2) Bot permissions on UMI Open Platform
```

**含义：**  
与 UMI 网关的 WebSocket 在**建立后 5 秒内**就被断开，且**连续出现 3 次**。插件会认为可能是配置或权限问题，并拉长重连间隔，同时提示你自检。

**触发条件（代码逻辑）：**  
- 单次连接持续时间 &lt; 5 秒即断开 → 计为一次「快速断开」  
- 连续快速断开 ≥ 3 次 → 打出上述错误并延长下次重连时间  

**建议按下面顺序排查：**

1. **AppID / AppSecret 是否正确**  
   - 在 [Umi 开放平台](https://q.umi.com/) 或 UMI 开放平台确认机器人应用的 **AppID**、**AppSecret**（或 client_secret）。  
   - 在 OpenClaw 配置里（如 `openclaw channels add --channel umibot --token "AppID:AppSecret"` 或 `~/.openclaw/openclaw.json` 的 `channels.umibot`）确认填的是**当前应用**的 ID 和密钥，且无多余空格、换行。  
   - 若刚重置过密钥，请用新密钥更新配置并重启 gateway。

2. **机器人在 UMI 开放平台的权限与状态**  
   - 确认应用已**通过审核/已上线**（若需要），且**已开通**与「接收消息、发消息」相关的权限/能力。  
   - 若使用 UMI 机器人 / 频道机器人，确认在对应开放平台里已创建并配置好该机器人，且未因违规被限流或封禁。

3. **网络与访问**  
   - 确认本机或服务器能访问 UMI 网关（`wss://...`），无公司防火墙或代理拦截 WebSocket。  
   - 若在境外或特殊网络，可尝试换网络或确认是否需要代理。

4. **查看更早的日志**  
   - 在出现 “Too many quick disconnects” 之前，通常会有 WebSocket **关闭码**（如 4006、4008、4014 等）或 **error** 日志。  
   - 根据关闭码排查：例如 4008 多为限流、4014 多为鉴权失败等（具体可查 UMI 官方文档）。

**处理后的建议：**  
修正配置或权限后，**重启 gateway**（如 `openclaw gateway` 或你使用的启动方式），再观察是否仍出现快速断开。若问题依旧，请把包含「Quick disconnect detected」及前几条 WebSocket 关闭/错误」的完整日志贴出，便于进一步排查。
