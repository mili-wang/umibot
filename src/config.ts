import type { ResolvedQQBotAccount, QQBotAccountConfig } from "./types.js";
import type { OpenClawConfig } from "openclaw/plugin-sdk";

export const DEFAULT_ACCOUNT_ID = "default";

interface QQBotChannelConfig extends QQBotAccountConfig {
  accounts?: Record<string, QQBotAccountConfig>;
}

/**
 * 列出所有 QQBot 账户 ID
 */
export function listQQBotAccountIds(cfg: OpenClawConfig): string[] {
  const ids = new Set<string>();
  const umibot = cfg.channels?.umibot as QQBotChannelConfig | undefined;

  if (umibot?.appId) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  if (umibot?.accounts) {
    for (const accountId of Object.keys(umibot.accounts)) {
      if (umibot.accounts[accountId]?.appId) {
        ids.add(accountId);
      }
    }
  }

  return Array.from(ids);
}

/**
 * 获取默认账户 ID
 */
export function resolveDefaultQQBotAccountId(cfg: OpenClawConfig): string {
  const umibot = cfg.channels?.umibot as QQBotChannelConfig | undefined;
  // 如果有默认账户配置，返回 default
  if (umibot?.appId) {
    return DEFAULT_ACCOUNT_ID;
  }
  // 否则返回第一个配置的账户
  if (umibot?.accounts) {
    const ids = Object.keys(umibot.accounts);
    if (ids.length > 0) {
      return ids[0];
    }
  }
  return DEFAULT_ACCOUNT_ID;
}

/**
 * 解析 QQBot 账户配置
 */
export function resolveQQBotAccount(
  cfg: OpenClawConfig,
  accountId?: string | null
): ResolvedQQBotAccount {
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const umibot = cfg.channels?.umibot as QQBotChannelConfig | undefined;

  // 基础配置
  let accountConfig: QQBotAccountConfig = {};
  let appId = "";
  let clientSecret = "";
  let secretSource: "config" | "file" | "env" | "none" = "none";

  if (resolvedAccountId === DEFAULT_ACCOUNT_ID) {
    // 默认账户从顶层读取
    accountConfig = {
      enabled: umibot?.enabled,
      name: umibot?.name,
      appId: umibot?.appId,
      clientSecret: umibot?.clientSecret,
      clientSecretFile: umibot?.clientSecretFile,
      dmPolicy: umibot?.dmPolicy,
      allowFrom: umibot?.allowFrom,
      systemPrompt: umibot?.systemPrompt,
      imageServerBaseUrl: umibot?.imageServerBaseUrl,
      markdownSupport: umibot?.markdownSupport ?? true,
    };
    appId = umibot?.appId ?? "";
  } else {
    // 命名账户从 accounts 读取
    const account = umibot?.accounts?.[resolvedAccountId];
    accountConfig = account ?? {};
    appId = account?.appId ?? "";
  }

  // 解析 clientSecret
  if (accountConfig.clientSecret) {
    clientSecret = accountConfig.clientSecret;
    secretSource = "config";
  } else if (accountConfig.clientSecretFile) {
    // 从文件读取（运行时处理）
    secretSource = "file";
  } else if (process.env.QQBOT_CLIENT_SECRET && resolvedAccountId === DEFAULT_ACCOUNT_ID) {
    clientSecret = process.env.QQBOT_CLIENT_SECRET;
    secretSource = "env";
  }

  // AppId 也可以从环境变量读取
  if (!appId && process.env.QQBOT_APP_ID && resolvedAccountId === DEFAULT_ACCOUNT_ID) {
    appId = process.env.QQBOT_APP_ID;
  }

  return {
    accountId: resolvedAccountId,
    name: accountConfig.name,
    enabled: accountConfig.enabled !== false,
    appId,
    clientSecret,
    secretSource,
    systemPrompt: accountConfig.systemPrompt,
    imageServerBaseUrl: accountConfig.imageServerBaseUrl || process.env.QQBOT_IMAGE_SERVER_BASE_URL,
    markdownSupport: accountConfig.markdownSupport !== false,
    config: accountConfig,
  };
}

/**
 * 应用账户配置
 */
export function applyQQBotAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
  input: { appId?: string; clientSecret?: string; clientSecretFile?: string; name?: string; imageServerBaseUrl?: string }
): OpenClawConfig {
  const next = { ...cfg };

  if (accountId === DEFAULT_ACCOUNT_ID) {
    // 如果没有设置过 allowFrom，默认设置为 ["*"]
    const existingConfig = (next.channels?.umibot as QQBotChannelConfig) || {};
    const allowFrom = existingConfig.allowFrom ?? ["*"];
    
    next.channels = {
      ...next.channels,
      umibot: {
        ...(next.channels?.umibot as Record<string, unknown> || {}),
        enabled: true,
        allowFrom,
        ...(input.appId ? { appId: input.appId } : {}),
        ...(input.clientSecret
          ? { clientSecret: input.clientSecret }
          : input.clientSecretFile
            ? { clientSecretFile: input.clientSecretFile }
            : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.imageServerBaseUrl ? { imageServerBaseUrl: input.imageServerBaseUrl } : {}),
      },
    };
  } else {
    // 如果没有设置过 allowFrom，默认设置为 ["*"]
    const existingAccountConfig = (next.channels?.umibot as QQBotChannelConfig)?.accounts?.[accountId] || {};
    const allowFrom = existingAccountConfig.allowFrom ?? ["*"];
    
    next.channels = {
      ...next.channels,
      umibot: {
        ...(next.channels?.umibot as Record<string, unknown> || {}),
        enabled: true,
        accounts: {
          ...((next.channels?.umibot as QQBotChannelConfig)?.accounts || {}),
          [accountId]: {
            ...((next.channels?.umibot as QQBotChannelConfig)?.accounts?.[accountId] || {}),
            enabled: true,
            allowFrom,
            ...(input.appId ? { appId: input.appId } : {}),
            ...(input.clientSecret
              ? { clientSecret: input.clientSecret }
              : input.clientSecretFile
                ? { clientSecretFile: input.clientSecretFile }
                : {}),
            ...(input.name ? { name: input.name } : {}),
            ...(input.imageServerBaseUrl ? { imageServerBaseUrl: input.imageServerBaseUrl } : {}),
          },
        },
      },
    };
  }

  return next;
}
