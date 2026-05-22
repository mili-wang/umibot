/**
 * silk-wasm 懒加载：避免插件 import 时初始化 Emscripten / WASM 线性内存。
 *
 * 实验 A（完全禁用）: UMIBOT_DISABLE_SILK_WASM=1
 * 启动时探测（默认关闭）: UMIBOT_PROBE_SILK_AT_STARTUP=1
 */

type SilkWasmModule = typeof import("silk-wasm");

let cached: SilkWasmModule | null = null;
let loadFailed = false;
let availabilityCache: boolean | null = null;

export function isSilkWasmDisabled(): boolean {
  const v = process.env.UMIBOT_DISABLE_SILK_WASM;
  return v === "1" || v === "true";
}

export function shouldProbeSilkWasmAtStartup(): boolean {
  return process.env.UMIBOT_PROBE_SILK_AT_STARTUP === "1";
}

/** 按 magic 判断 SILK v3，不加载 WASM */
export function hasSilkMagicHeader(data: Uint8Array): boolean {
  if (data.length >= 9) {
    let head = "";
    for (let i = 0; i < 9; i++) head += String.fromCharCode(data[i]!);
    if (head === "#!SILK_V3") return true;
  }
  return data.length > 0 && data[0] === 0x02;
}

export async function loadSilkWasm(): Promise<SilkWasmModule | null> {
  if (isSilkWasmDisabled()) return null;
  if (loadFailed) return null;
  if (cached) return cached;
  try {
    cached = await import("silk-wasm");
    return cached;
  } catch (err) {
    loadFailed = true;
    console.warn(
      `[silk-wasm] load failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

export async function silkIsSilk(data: Uint8Array): Promise<boolean> {
  const mod = await loadSilkWasm();
  if (!mod) return hasSilkMagicHeader(data);
  return mod.isSilk(data);
}

export async function silkDecode(
  data: Uint8Array,
  sampleRate: number,
): Promise<{ data: Uint8Array; duration: number }> {
  const mod = await loadSilkWasm();
  if (!mod) {
    throw new Error("silk-wasm unavailable (disabled or failed to load)");
  }
  return mod.decode(data, sampleRate);
}

export async function silkEncode(
  pcm: Uint8Array,
  sampleRate: number,
): Promise<{ data: Uint8Array; duration: number }> {
  const mod = await loadSilkWasm();
  if (!mod) {
    throw new Error("silk-wasm unavailable (disabled or failed to load)");
  }
  return mod.encode(pcm, sampleRate);
}

/**
 * 检测 silk-wasm 是否可用。
 * @param probe 为 false 时不加载模块（用于启动诊断，实验 A 默认跳过）
 */
export async function checkSilkWasmAvailable(probe = true): Promise<boolean> {
  if (isSilkWasmDisabled()) {
    availabilityCache = false;
    return false;
  }
  if (!probe) {
    return availabilityCache ?? false;
  }
  if (availabilityCache !== null) return availabilityCache;

  try {
    const mod = await loadSilkWasm();
    if (!mod) {
      availabilityCache = false;
      return false;
    }
    mod.isSilk(new Uint8Array(0));
    availabilityCache = true;
    console.log("[platform] silk-wasm: available (probed)");
  } catch (err) {
    availabilityCache = false;
    console.warn(
      `[platform] silk-wasm: NOT available (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  return availabilityCache;
}
