/**
 * UmiBot CLI Onboarding Adapter
 * 
 * 提供 openclaw onboard 命令的交互式配置支持
 */
import type { 
  ChannelOnboardingAdapter,
  ChannelOnboardingStatus,
  ChannelOnboardingStatusContext,
  ChannelOnboardingConfigureContext,
  ChannelOnboardingResult,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, listUmiBotAccountIds, resolveUmiBotAccount } from "./config.js";

// 内部类型（用于类型安全）
interface UmiBotChannelConfig {
  enabled?: boolean;
  appId?: string;
  clientSecret?: string;
  clientSecretFile?: string;
  name?: string;
  imageServerBaseUrl?: string;
  markdownSupport?: boolean;
  allowFrom?: string[];
  accounts?: Record<string, {
    enabled?: boolean;
    appId?: string;
    clientSecret?: string;
    clientSecretFile?: string;
    name?: string;
    imageServerBaseUrl?: string;
    markdownSupport?: boolean;
    allowFrom?: string[];
  }>;
}

// Prompter 类型定义
interface Prompter {
  note: (message: string, title?: string) => Promise<void>;
  confirm: (opts: { message: string; initialValue?: boolean }) => Promise<boolean>;
  text: (opts: { message: string; placeholder?: string; initialValue?: string; validate?: (value: string) => string | undefined }) => Promise<string>;
  select: <T>(opts: { message: string; options: Array<{ value: T; label: string }>; initialValue?: T }) => Promise<T>;
}

/**
 * 解析默认账户 ID
 */
function resolveDefaultUmiBotAccountId(cfg: OpenClawConfig): string {
  const ids = listUmiBotAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * UmiBot Onboarding Adapter
 */
export const umibotOnboardingAdapter: ChannelOnboardingAdapter = {
  channel: "umibot" as any,

  getStatus: async (ctx: ChannelOnboardingStatusContext): Promise<ChannelOnboardingStatus> => {
    const cfg = ctx.cfg as OpenClawConfig;
    const configured = listUmiBotAccountIds(cfg).some((accountId) => {
      const account = resolveUmiBotAccount(cfg, accountId);
      return Boolean(account.appId && account.clientSecret);
    });

    return {
      channel: "umibot" as any,
      configured,
statusLines: [`Umi Bot: ${configured ? "已配置" : "需要 AppID 和 ClientSecret"}`],
      selectionHint: configured ? "已配置" : "支持 Umi 群聊和私聊（流式消息）",
      quickstartScore: configured ? 1 : 20,
    };
  },

  configure: async (ctx: ChannelOnboardingConfigureContext): Promise<ChannelOnboardingResult> => {
    const cfg = ctx.cfg as OpenClawConfig;
    const prompter = ctx.prompter as Prompter;
    const accountOverrides = ctx.accountOverrides as Record<string, string> | undefined;
    const shouldPromptAccountIds = ctx.shouldPromptAccountIds;
    
    const umibotOverride = accountOverrides?.umibot?.trim();
    const defaultAccountId = resolveDefaultUmiBotAccountId(cfg);
    let accountId = umibotOverride ?? defaultAccountId;

    // 是否需要提示选择账户
    if (shouldPromptAccountIds && !umibotOverride) {
      const existingIds = listUmiBotAccountIds(cfg);
      if (existingIds.length > 1) {
        accountId = await prompter.select({
          message: "选择 UmiBot 账户",
          options: existingIds.map((id) => ({
            value: id,
            label: id === DEFAULT_ACCOUNT_ID ? "默认账户" : id,
          })),
          initialValue: accountId,
        });
      }
    }

    let next: OpenClawConfig = cfg;
    const resolvedAccount = resolveUmiBotAccount(next, accountId);
    const accountConfigured = Boolean(resolvedAccount.appId && resolvedAccount.clientSecret);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
    const envAppId = typeof process !== "undefined" ? process.env?.UmiBOT_APP_ID?.trim() : undefined;
    const envSecret = typeof process !== "undefined" ? process.env?.UmiBOT_CLIENT_SECRET?.trim() : undefined;
    const canUseEnv = allowEnv && Boolean(envAppId && envSecret);
    const hasConfigCredentials = Boolean(resolvedAccount.config.appId && resolvedAccount.config.clientSecret);

    let appId: string | null = null;
    let clientSecret: string | null = null;

    // 显示帮助
    if (!accountConfigured) {
      await prompter.note(
        [
          "1) 打开 Umi 开放平台: https://q.umi.com/",
          "2) 创建机器人应用，获取 AppID 和 ClientSecret",
          "3) 在「开发设置」中添加沙箱成员（测试阶段）",
          "4) 你也可以设置环境变量 UmiBOT_APP_ID 和 UmiBOT_CLIENT_SECRET",
          "",
          "文档: https://bot.q.umi.com/wiki/",
          "",
          "此版本支持流式消息发送！",
        ].join("\n"),
"Umi Bot 配置",
      );
    }

    // 检测环境变量
    if (canUseEnv && !hasConfigCredentials) {
      const keepEnv = await prompter.confirm({
        message: "检测到环境变量 UmiBOT_APP_ID 和 UmiBOT_CLIENT_SECRET，是否使用？",
        initialValue: true,
      });
      if (keepEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            umibot: {
              ...(next.channels?.umibot as Record<string, unknown> || {}),
              enabled: true,
              allowFrom: resolvedAccount.config?.allowFrom ?? ["*"],
            },
          },
        };
      } else {
        // 手动输入
        appId = String(
          await prompter.text({
            message: "请输入 Umi Bot AppID",
            placeholder: "例如: 102146862",
            initialValue: resolvedAccount.appId || undefined,
            validate: (value: string) => (value?.trim() ? undefined : "AppID 不能为空"),
          }),
        ).trim();
        clientSecret = String(
          await prompter.text({
            message: "请输入 Umi Bot ClientSecret",
            placeholder: "你的 ClientSecret",
            validate: (value: string) => (value?.trim() ? undefined : "ClientSecret 不能为空"),
          }),
        ).trim();
      }
    } else if (hasConfigCredentials) {
      // 已有配置
      const keep = await prompter.confirm({
        message: "Umi Bot 已配置，是否保留当前配置？",
        initialValue: true,
      });
      if (!keep) {
        appId = String(
          await prompter.text({
            message: "请输入 Umi Bot AppID",
            placeholder: "例如: 102146862",
            initialValue: resolvedAccount.appId || undefined,
            validate: (value: string) => (value?.trim() ? undefined : "AppID 不能为空"),
          }),
        ).trim();
        clientSecret = String(
          await prompter.text({
            message: "请输入 Umi Bot ClientSecret",
            placeholder: "你的 ClientSecret",
            validate: (value: string) => (value?.trim() ? undefined : "ClientSecret 不能为空"),
          }),
        ).trim();
      }
    } else {
      // 没有配置，需要输入
      appId = String(
        await prompter.text({
          message: "请输入 Umi Bot AppID",
          placeholder: "例如: 102146862",
          initialValue: resolvedAccount.appId || undefined,
          validate: (value: string) => (value?.trim() ? undefined : "AppID 不能为空"),
        }),
      ).trim();
      clientSecret = String(
        await prompter.text({
          message: "请输入 Umi Bot ClientSecret",
          placeholder: "你的 ClientSecret",
          validate: (value: string) => (value?.trim() ? undefined : "ClientSecret 不能为空"),
        }),
      ).trim();
    }

    // 默认允许所有人执行命令（用户无感知）
    const allowFrom: string[] = resolvedAccount.config?.allowFrom ?? ["*"];

    // 应用配置（markdownSupport 默认开启，如需关闭可用 set-markdown.sh）
    if (appId && clientSecret) {
      const existingUmiBot = (next.channels?.umibot as Record<string, unknown>) || {};
      // 保留已有的 markdownSupport 设置，新装默认 true
      const markdownSupport = existingUmiBot.markdownSupport ?? true;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            umibot: {
              ...existingUmiBot,
              enabled: true,
              appId,
              clientSecret,
              markdownSupport,
              allowFrom,
            },
          },
        };
      } else {
        const existingAccounts = ((next.channels?.umibot as UmiBotChannelConfig)?.accounts || {});
        const existingAccount = existingAccounts[accountId] || {};
        const acctMarkdown = existingAccount.markdownSupport ?? true;

        next = {
          ...next,
          channels: {
            ...next.channels,
            umibot: {
              ...existingUmiBot,
              enabled: true,
              accounts: {
                ...existingAccounts,
                [accountId]: {
                  ...existingAccount,
                  enabled: true,
                  appId,
                  clientSecret,
                  markdownSupport: acctMarkdown,
                  allowFrom,
                },
              },
            },
          },
        };
      }
    }

    return { success: true, cfg: next as any, accountId };
  },

  disable: (cfg: unknown) => {
    const config = cfg as OpenClawConfig;
    return {
      ...config,
      channels: {
        ...config.channels,
        umibot: { ...(config.channels?.umibot as Record<string, unknown> || {}), enabled: false },
      },
    } as any;
  },
};
