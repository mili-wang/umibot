import {
  type ChannelPlugin,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/core";

import type { ResolvedQQBotAccount } from "./types.js";
import { DEFAULT_ACCOUNT_ID, listQQBotAccountIds, resolveQQBotAccount, applyQQBotAccountConfig, resolveDefaultQQBotAccountId, resolveRequireMention, resolveToolPolicy, resolveGroupConfig } from "./config.js";
import { sendText, sendMedia, resolveUserFacingMediaError } from "./outbound.js";
import { startGateway } from "./gateway.js";
import { umibotOnboardingAdapter } from "./onboarding.js";
import { getQQBotRuntime } from "./runtime.js";
import { saveCredentialBackup, loadCredentialBackup } from "./credential-backup.js";
import { initApiConfig } from "./api.js";
import { getApprovalHandler } from "./approval-handler.js";

/** 检查 payload 是否为审批消息（与 getExecApprovalReplyMetadata 等效，内联避免版本兼容问题） */
function isApprovalPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  // channelData.execApproval 存在 → exec/plugin approval pending/resolved
  const cd = p.channelData;
  if (cd && typeof cd === "object" && !Array.isArray(cd)) {
    const execApproval = (cd as Record<string, unknown>).execApproval;
    if (execApproval && typeof execApproval === "object" && !Array.isArray(execApproval)) {
      return true;
    }
  }
  // text 匹配兜底：框架渲染的审批纯文本通知
  const text = typeof p.text === "string" ? p.text : "";
  return /(?:Plugin|Exec) approval (?:required|allowed|denied|expired)/i.test(text);
}

function setAccountEnabledInConfigSection(ctx: {
  cfg: OpenClawConfig;
  sectionKey: string;
  accountId: string;
  enabled: boolean;
  allowTopLevel?: boolean;
}): OpenClawConfig {
  const { cfg, sectionKey, accountId, enabled, allowTopLevel } = ctx;
  const nextCfg = { ...cfg } as OpenClawConfig;
  const channels = { ...(nextCfg.channels ?? {}) } as Record<string, unknown>;
  const section = { ...((channels[sectionKey] as Record<string, unknown> | undefined) ?? {}) };
  const accounts = { ...((section.accounts as Record<string, Record<string, unknown>> | undefined) ?? {}) };
  const entry = { ...(accounts[accountId] ?? {}) };
  entry.enabled = enabled;
  accounts[accountId] = entry;
  section.accounts = accounts;
  if (allowTopLevel && accountId === DEFAULT_ACCOUNT_ID) {
    section.enabled = enabled;
  }
  channels[sectionKey] = section;
  nextCfg.channels = channels as OpenClawConfig["channels"];
  return nextCfg;
}

function deleteAccountFromConfigSection(ctx: {
  cfg: OpenClawConfig;
  sectionKey: string;
  accountId: string;
  clearBaseFields?: string[];
}): OpenClawConfig {
  const { cfg, sectionKey, accountId, clearBaseFields } = ctx;
  const nextCfg = { ...cfg } as OpenClawConfig;
  const channels = { ...(nextCfg.channels ?? {}) } as Record<string, unknown>;
  const section = { ...((channels[sectionKey] as Record<string, unknown> | undefined) ?? {}) };
  const accounts = { ...((section.accounts as Record<string, Record<string, unknown>> | undefined) ?? {}) };
  if (accounts[accountId]) {
    delete accounts[accountId];
    section.accounts = accounts;
  }
  if (accountId === DEFAULT_ACCOUNT_ID && clearBaseFields?.length) {
    for (const field of clearBaseFields) {
      delete section[field];
    }
  }
  channels[sectionKey] = section;
  nextCfg.channels = channels as OpenClawConfig["channels"];
  return nextCfg;
}

function applyAccountNameToChannelSection(ctx: {
  cfg: OpenClawConfig;
  channelKey: string;
  accountId: string;
  name: string;
}): OpenClawConfig {
  const { cfg, channelKey, accountId, name } = ctx;
  const nextCfg = { ...cfg } as OpenClawConfig;
  const channels = { ...(nextCfg.channels ?? {}) } as Record<string, unknown>;
  const section = { ...((channels[channelKey] as Record<string, unknown> | undefined) ?? {}) };
  const accounts = { ...((section.accounts as Record<string, Record<string, unknown>> | undefined) ?? {}) };
  const entry = { ...(accounts[accountId] ?? {}) };
  entry.name = name;
  accounts[accountId] = entry;
  section.accounts = accounts;
  if (accountId === DEFAULT_ACCOUNT_ID) {
    section.name = name;
  }
  channels[channelKey] = section;
  nextCfg.channels = channels as OpenClawConfig["channels"];
  return nextCfg;
}

/** UMI Bot 单条消息文本长度上限 */
export const TEXT_CHUNK_LIMIT = 5000;

/**
 * Markdown 感知的文本分块函数
 * 委托给 SDK 内置的 channel.text.chunkMarkdownText
 * 支持代码块自动关闭/重开、括号感知等
 */
export function chunkText(text: string, limit: number): string[] {
  const runtime = getQQBotRuntime();
  return runtime.channel.text.chunkMarkdownText(text, limit);
}

function buildChannelMediaError(result: Parameters<typeof resolveUserFacingMediaError>[0]): Error {
  const err = new Error(resolveUserFacingMediaError(result));
  if (result.errorCode) {
    (err as Error & { code?: string }).code = result.errorCode;
  }
  if (result.qqBizCode !== undefined) {
    (err as Error & { qqBizCode?: number }).qqBizCode = result.qqBizCode;
  }
  return err;
}

export const qqbotPlugin: ChannelPlugin<ResolvedQQBotAccount> = {
  id: "umibot",
  meta: {
    id: "umibot",
    label: "UMI Bot",
    selectionLabel: "UMI Bot",
    docsPath: "/docs/channels/umibot",
    blurb: "Connect to UMI via official UMI Bot API",
    order: 50,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    /**
     * blockStreaming: true 表示该 Channel 支持块流式
     * 框架会收集流式响应，然后通过 deliver 回调发送
     */
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.umibot"] },

  // ============ 群消息策略适配器 ============
  groups: {
    /** 是否需要 @机器人才响应 */
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      if (!groupId) return undefined;
      return resolveRequireMention(cfg, groupId, accountId ?? undefined);
    },

    /** 群聊工具范围 */
    resolveToolPolicy: ({ cfg, accountId, groupId }) => {
      if (!groupId) return undefined;
      const policy = resolveToolPolicy(cfg, groupId, accountId ?? undefined);
      // 将简单字符串策略映射为 GroupToolPolicyConfig 对象
      if (policy === "full") return undefined; // full = 默认不限制
      if (policy === "none") return { allow: [], deny: ["*"] };
      // restricted: 默认空 allow（框架会使用内置 restricted 列表）
      return { allow: [] };
    },

    /** QQ Bot 平台特有的群聊行为提示 */
    resolveGroupIntroHint: ({ cfg, accountId, groupId }) => {
      if (!groupId) return undefined;
      const groupCfg = resolveGroupConfig(cfg, groupId, accountId ?? undefined);
      const hints: string[] = [];
      if (groupCfg.name) {
        hints.push(`当前群: ${groupCfg.name}`);
      }
      // bot 互聊防护、@状态行为指引在 gateway.ts 动态注入
      return hints.join(" ") || undefined;
    },
  },

  // ============ @mention 检测与清理 ============
  mentions: {
    /** 清理 @mention 文本（SDK ChannelMentionAdapter 接口） */
    stripMentions: ({ text, ctx }) => {
      const mentions = (ctx as any)?.mentions as Array<{ member_openid?: string; id?: string; user_openid?: string; is_you?: boolean; nickname?: string; username?: string }> | undefined;
      return stripMentionText(text, mentions);
    },
  },
  // CLI onboarding wizard
  // @ts-ignore onboarding removed from ChannelPlugin type in 2026.3.23 but still supported at runtime
  onboarding: qqbotOnboardingAdapter,

  config: {
    listAccountIds: (cfg) => listQQBotAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveQQBotAccount(cfg, accountId),
    defaultAccountId: (cfg) => resolveDefaultQQBotAccountId(cfg),
    // 新增：设置账户启用状态
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "umibot",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    // 新增：删除账户
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "umibot",
        accountId,
        clearBaseFields: ["appId", "clientSecret", "clientSecretFile", "name"],
      }),
    isConfigured: (account) => {
      if (account?.appId && account?.clientSecret) return true;
      // 配置为空但有凭证备份时仍返回 true，让 startAccount 有机会恢复凭证
      const backup = loadCredentialBackup(account?.accountId);
      return backup !== null;
    },
    describeAccount: (account) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.appId && account?.clientSecret),
      tokenSource: account?.secretSource,
    }),
    // 关键：解析 allowFrom 配置，用于命令授权
    resolveAllowFrom: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId?: string | null }) => {
      const account = resolveQQBotAccount(cfg, accountId ?? undefined);
      const allowFrom = account.config?.allowFrom ?? [];
      console.log(`[umibot] resolveAllowFrom: accountId=${accountId}, allowFrom=${JSON.stringify(allowFrom)}`);
      return allowFrom.map((entry: string | number) => String(entry)) as (string | number)[];
    },
    // 格式化 allowFrom 条目（移除 umibot: 前缀，统一大写）
    formatAllowFrom: ({ allowFrom }: { allowFrom: Array<string | number> }) =>
      allowFrom
        .map((entry: string | number) => String(entry).trim())
        .filter(Boolean)
        .map((entry: string) => entry.replace(/^umibot:/i, ""))
        .map((entry: string) => entry.toUpperCase()), // UMI openid 是大写的
  },
  setup: {
    // 新增：规范化账户 ID
    resolveAccountId: ({ accountId }) => accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
    // 新增：应用账户名称
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "umibot",
        accountId,
        name: name ?? "",
      }),
    validateInput: ({ input }) => {
      if (!input.token && !input.tokenFile && !input.useEnv) {
        return "UMIBot requires --token (format: appId:clientSecret) or --use-env";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      let appId = "";
      let clientSecret = "";

      if (input.token) {
        const parts = input.token.split(":");
        if (parts.length === 2) {
          appId = parts[0];
          clientSecret = parts[1];
        }
      }

      return applyQQBotAccountConfig(cfg, accountId, {
        appId,
        clientSecret,
        clientSecretFile: input.tokenFile,
        name: input.name,
        imageServerBaseUrl: (input as Record<string, unknown>).imageServerBaseUrl as string | undefined,
      }) as OpenClawConfig;
    },
  },
  // Messaging 配置：用于解析目标地址
  messaging: {
    /**
     * 规范化目标地址
     * 支持以下格式：
     * - umibot:openid -> 私聊（展示用不含 c2c）
     * - umibot:group:groupid -> 群聊
     * - umibot:channel:channelid -> 频道
     * - c2c:openid -> 私聊，规范化为 umibot:openid
     * - group:groupid -> 群聊
     * - channel:channelid -> 频道
     * - 纯 openid（32位十六进制）-> 私聊
     */
    normalizeTarget: (target: string): string | undefined => {
      // 去掉 umibot: 前缀（如果有）
      const id = target.replace(/^umibot:/i, "");

      // 检查是否是已知格式（私聊规范化为 umibot:openid，不含 c2c）
      if (id.startsWith("c2c:")) {
        return `umibot:${id.slice(4)}`;
      }
      if (id.startsWith("group:") || id.startsWith("channel:")) {
        return `umibot:${id}`;
      }

      // 检查是否是纯 openid（32位十六进制，不带连字符）
      // UMI Bot OpenID 格式类似: 207A5B8339D01F6582911C014668B77B
      const openIdHexPattern = /^[0-9a-fA-F]{32}$/;
      if (openIdHexPattern.test(id)) {
        return `umibot:${id}`;
      }

      // 检查是否是 UUID 格式的 openid（带连字符）
      const openIdUuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (openIdUuidPattern.test(id)) {
        return `umibot:${id}`;
      }
      
      // 不认识的格式，返回 undefined 让核心使用原始值
      return undefined;
    },
    /**
     * 目标解析器配置
     * 用于判断一个目标 ID 是否看起来像 UMI Bot 的格式
     */
    targetResolver: {
      /**
       * 判断目标 ID 是否可能是 UMI Bot 格式
       * 支持以下格式：
       * - umibot:openid（私聊，展示不含 c2c）
       * - umibot:group:xxx
       * - umibot:channel:xxx
       * - c2c:xxx / group:xxx / channel:xxx
       * - 纯 openid（32 位十六进制或 UUID）
       */
      looksLikeId: (id: string): boolean => {
        // 带 umibot: 前缀：umibot:openid 或 umibot:group:xxx / umibot:channel:xxx
        if (/^umibot:/i.test(id)) {
          const rest = id.replace(/^umibot:/i, "");
          if (/^(c2c|group|channel):/i.test(rest)) return true;
          if (/^[0-9a-fA-F]{32}$/.test(rest)) return true;
          const openIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
          if (openIdPattern.test(rest)) return true;
        }
        // 不带 umibot: 前缀
        if (/^(c2c|group|channel):/i.test(id)) return true;
        if (/^[0-9a-fA-F]{32}$/.test(id)) return true;
        const openIdPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        return openIdPattern.test(id);
      },
      hint: "UMI Bot 目标格式: umibot:openid (私聊) 或 umibot:group:groupid (群聊)",
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getQQBotRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 5000,
    // 3.31+ outbound 路径：dispatch-from-config → shouldSuppressLocalExecApprovalPrompt → outbound.shouldSuppressLocalPayloadPrompt
    shouldSuppressLocalPayloadPrompt: ({ accountId, payload }: any) =>
      getApprovalHandler(accountId ?? "") != null &&
      isApprovalPayload(payload),
    sendText: async ({ to, text, accountId, replyToId, cfg, roomId }) => {
      console.log(`[umibot:channel] sendText called — accountId=${accountId}, to=${to}, replyToId=${replyToId}, text.length=${text?.length ?? 0}`);
      console.log(`[umibot:channel] sendText text preview: ${text?.slice(0, 100)}${(text?.length ?? 0) > 100 ? "..." : ""}`);
      const account = resolveQQBotAccount(cfg, accountId ?? undefined);
      initApiConfig({ markdownSupport: account.markdownSupport });
      console.log(`[umibot:channel] sendText resolved account: id=${account.accountId}, appId=${account.appId}, enabled=${account.enabled}`);
      const result = await sendText({ to, text, accountId, replyToId, roomId, account });
      console.log(`[umibot:channel] sendText result: messageId=${result.messageId}, error=${result.error ?? "none"}`);
      if (result.error) throw new Error(result.error);
      return {
        channel: "umibot" as const,
        messageId: result.messageId ?? "",
      };
    },
    sendMedia: async (ctx) => {
      const { to, text, mediaUrl, accountId, replyToId, cfg } = ctx;
      const roomId = (ctx as { roomId?: string }).roomId;
      console.log(`[umibot:channel] sendMedia called — accountId=${accountId}, to=${to}, replyToId=${replyToId}, mediaUrl=${mediaUrl?.slice(0, 80)}, text.length=${text?.length ?? 0}`);
      const account = resolveQQBotAccount(cfg, accountId ?? undefined);
      initApiConfig({ markdownSupport: account.markdownSupport });
      console.log(`[umibot:channel] sendMedia resolved account: id=${account.accountId}, appId=${account.appId}, enabled=${account.enabled}`);
      const result = await sendMedia({ to, text: text ?? "", mediaUrl: mediaUrl ?? "", accountId, replyToId, roomId, account });
      console.log(`[umibot:channel] sendMedia result: messageId=${result.messageId}, error=${result.error ?? "none"}`);
      // 此 sendMedia 是框架 Channel Plugin 的标准出站接口，
      // 由框架 deliver.js (deliverOutboundPayloads) 或 message-actions 调用。
      // 当 throw Error 后，框架 pi-tool-definition-adapter 会将错误转化为
      // tool 的 { status: "error" } 返回给 AI 模型，模型会自行生成错误回复给用户。
      // 因此此处不应主动发送兜底文本，否则会与模型的回复重复。
      if (result.error) {
        throw buildChannelMediaError(result);
      }
      return {
        channel: "umibot" as const,
        messageId: result.messageId ?? "",
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      let { account } = ctx;
      const { abortSignal, log, cfg } = ctx;

      // 凭证恢复：如果 appId/secret 为空（热更新打断可能导致配置丢失），尝试从暂存文件恢复
      if (!account.appId || !account.clientSecret) {
        const backup = loadCredentialBackup(account.accountId);
        if (backup) {
          log?.info(`[umibot:${account.accountId}] 配置中凭证为空，从暂存文件恢复 (appId=${backup.appId}, savedAt=${backup.savedAt})`);
          try {
            const runtime = getQQBotRuntime();
            const restoredCfg = applyQQBotAccountConfig(cfg, account.accountId, {
              appId: backup.appId,
              clientSecret: backup.clientSecret,
            });
            const configApi = runtime.config as { writeConfigFile: (cfg: unknown) => Promise<void> };
            await configApi.writeConfigFile(restoredCfg);
            // 重新解析 account 以获取恢复后的值
            account = resolveQQBotAccount(restoredCfg, account.accountId);
            log?.info(`[umibot:${account.accountId}] 凭证已恢复`);
          } catch (e) {
            log?.error(`[umibot:${account.accountId}] 凭证恢复失败: ${e}`);
          }
        }
      }

      log?.info(`[umibot:${account.accountId}] Starting gateway — appId=${account.appId}, enabled=${account.enabled}, name=${account.name ?? "unnamed"}`);
      console.log(`[umibot:channel] startAccount: accountId=${account.accountId}, appId=${account.appId}, secretSource=${account.secretSource}`);

      await startGateway({
        account,
        abortSignal,
        cfg,
        log,
        onReady: () => {
          log?.info(`[umibot:${account.accountId}] Gateway ready`);
          // 启动成功，保存凭证快照供后续恢复使用
          saveCredentialBackup(account.accountId, account.appId, account.clientSecret);
          ctx.setStatus({
            ...ctx.getStatus(),
            running: true,
            connected: true,
            lastConnectedAt: Date.now(),
          });
        },
        onError: (error) => {
          log?.error(`[umibot:${account.accountId}] Gateway error: ${error.message}`);
          ctx.setStatus({
            ...ctx.getStatus(),
            lastError: error.message,
          });
        },
      });
    },
    // 新增：登出账户（清除配置中的凭证）
    logoutAccount: async ({ accountId, cfg }) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      const nextQQBot = cfg.channels?.umibot ? { ...cfg.channels.umibot } : undefined;
      let cleared = false;
      let changed = false;

      if (nextQQBot) {
        const umibot = nextQQBot as Record<string, unknown>;
        if (accountId === DEFAULT_ACCOUNT_ID && umibot.clientSecret) {
          delete umibot.clientSecret;
          cleared = true;
          changed = true;
        }
        const accounts = umibot.accounts as Record<string, Record<string, unknown>> | undefined;
        if (accounts && accountId in accounts) {
          const entry = accounts[accountId] as Record<string, unknown> | undefined;
          if (entry && "clientSecret" in entry) {
            delete entry.clientSecret;
            cleared = true;
            changed = true;
          }
          if (entry && Object.keys(entry).length === 0) {
            delete accounts[accountId];
            changed = true;
          }
        }
      }

      if (changed && nextQQBot) {
        nextCfg.channels = { ...nextCfg.channels, umibot: nextQQBot };
        const runtime = getQQBotRuntime();
        const configApi = runtime.config as { writeConfigFile: (cfg: OpenClawConfig) => Promise<void> };
        await configApi.writeConfigFile(nextCfg);
      }

      const resolved = resolveQQBotAccount(changed ? nextCfg : cfg, accountId);
      const loggedOut = resolved.secretSource === "none";
      const envToken = Boolean(process.env.QQBOT_CLIENT_SECRET);

      return { ok: true, cleared, envToken, loggedOut };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    // 新增：构建通道摘要
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastConnectedAt: snapshot.lastConnectedAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.appId && account?.clientSecret),
      tokenSource: account?.secretSource,
      running: Boolean(runtime?.running ?? false),
      connected: Boolean(runtime?.connected ?? false),
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
  // UMIBot approval-handler 通过独立 WS 连接自行处理 exec + plugin 审批消息投递（带 Inline Keyboard），
  // 完全屏蔽框架 Forwarder 的纯文本通知。
  //
  // ── 3.28 扁平结构 ──
  execApprovals: {
    // 3.28 框架通过此方法判断 channel 是否支持审批
    getInitiatingSurfaceState: ({ accountId }: { cfg: any; accountId?: string | null }) => {
      return getApprovalHandler(accountId ?? "") != null
        ? { kind: "enabled" as const }
        : { kind: "disabled" as const };
    },
    shouldSuppressForwardingFallback: (...args: any[]) => {
      console.log("[UMIBot] shouldSuppressForwardingFallback called", JSON.stringify(args?.[0]?.target ?? null));
      return true;
    },
    shouldSuppressLocalPrompt: ({ accountId, payload }: any) =>
      getApprovalHandler(accountId ?? "") != null &&
      isApprovalPayload(payload),
    buildPendingPayload: () => null,
    buildResolvedPayload: () => null,
  },
  // ── 3.31+ 嵌套结构 ──
  // auth 和 approvals 是 ChannelPlugin 顶层平级字段
  //
  // UMIBot 审批模型：
  //   - QQBotApprovalHandler 通过独立 WS 自行投递带 Inline Keyboard 的审批消息
  //   - 用户点击按钮 → INTERACTION_CREATE → resolveApproval → gateway RPC
  //   - /approve 文本命令作为 URGENT_COMMAND 直接入队交给框架处理
  auth: {
    authorizeActorAction: () => ({ authorized: true }),
    getActionAvailabilityState: ({ accountId }: {
      cfg: any; accountId?: string | null; action: "approve";
    }) => {
      return getApprovalHandler(accountId ?? "") != null
        ? { kind: "enabled" as const }
        : { kind: "disabled" as const };
    },
  },
  approvals: {
    delivery: {
      hasConfiguredDmRoute: () => true,
      shouldSuppressForwardingFallback: () => true,
    },
    render: {
      exec: {
        buildPendingPayload: () => null,
        buildResolvedPayload: () => null,
      },
      plugin: {
        buildPendingPayload: () => null,
        buildResolvedPayload: () => null,
      },
    },
  },
};

/** 与 `index.ts` / 文档一致的导出别名（实际实现为 `qqbotPlugin`） */
export const umibotPlugin = qqbotPlugin;

// ============ 独立的 mention 工具函数（供 gateway.ts 等直接调用） ============

/** 清理 @mention：替换 <@openid> 为 @用户名，去除 @机器人自身 */
export function stripMentionText(text: string, mentions?: Array<{ member_openid?: string; id?: string; user_openid?: string; is_you?: boolean; nickname?: string; username?: string }>): string {
  if (!text || !mentions?.length) return text;
  let cleaned = text;
  for (const m of mentions) {
    const openid = m.member_openid ?? m.id ?? m.user_openid;
    if (!openid) continue;
    if (m.is_you) {
      cleaned = cleaned.replace(new RegExp(`<@!?${openid}>`, "g"), "").trim();
    } else {
      const displayName = m.nickname ?? m.username;
      if (displayName) {
        cleaned = cleaned.replace(new RegExp(`<@!?${openid}>`, "g"), `@${displayName}`);
      }
    }
  }
  return cleaned;
}

/** 检测消息是否 @了机器人（mentions > eventType > mentionPatterns） */
export function detectWasMentioned({ eventType, mentions, content, mentionPatterns }: {
  eventType?: string;
  mentions?: Array<{ is_you?: boolean }>;
  content?: string;
  mentionPatterns?: string[];
}): boolean {
  if (mentions?.some((m) => m.is_you)) return true;
  if (eventType === "GROUP_AT_MESSAGE_CREATE") return true;
  if (mentionPatterns?.length && content) {
    for (const pattern of mentionPatterns) {
      try {
        if (new RegExp(pattern, "i").test(content)) return true;
      } catch {
        // 无效正则，跳过
      }
    }
  }
  return false;
}
