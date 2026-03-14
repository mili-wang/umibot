import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setUmiBotRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getUmiBotRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("UmiBot runtime not initialized");
  }
  return runtime;
}
