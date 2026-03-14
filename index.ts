import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { umibotPlugin } from "./src/channel.js";
import { setUmiBotRuntime } from "./src/runtime.js";

const plugin = {
  id: "umibot",
  name: "Umi Bot",
  description: "Umi Bot channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setUmiBotRuntime(api.runtime);
    api.registerChannel({ plugin: umibotPlugin });
  },
};

export default plugin;

export { umibotPlugin } from "./src/channel.js";
export { setUmiBotRuntime, getUmiBotRuntime } from "./src/runtime.js";
export { umibotOnboardingAdapter } from "./src/onboarding.js";
export * from "./src/types.js";
export * from "./src/api.js";
export * from "./src/config.js";
export * from "./src/gateway.js";
export * from "./src/outbound.js";
