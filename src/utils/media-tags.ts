/**
 * 富媒体标签预处理与纠错
 *
 * 小模型常见的标签拼写错误及变体，在正则匹配前统一修正为标准格式。
 */

import { expandTilde } from "./platform.js";

// 标准标签名
const VALID_TAGS = ["umiimg", "umivoice", "umivideo", "umifile"] as const;

// 开头标签别名映射（key 全部小写）
const TAG_ALIASES: Record<string, typeof VALID_TAGS[number]> = {
  // ---- umiimg 变体 ----
  "umi_img": "umiimg",
  "umiimage": "umiimg",
  "umi_image": "umiimg",
  "umipic": "umiimg",
  "umi_pic": "umiimg",
  "umipicture": "umiimg",
  "umi_picture": "umiimg",
  "umiphoto": "umiimg",
  "umi_photo": "umiimg",
  "img": "umiimg",
  "image": "umiimg",
  "pic": "umiimg",
  "picture": "umiimg",
  "photo": "umiimg",
  // ---- umivoice 变体 ----
  "umi_voice": "umivoice",
  "umiaudio": "umivoice",
  "umi_audio": "umivoice",
  "voice": "umivoice",
  "audio": "umivoice",
  // ---- umivideo 变体 ----
  "umi_video": "umivideo",
  "video": "umivideo",
  // ---- umifile 变体 ----
  "umi_file": "umifile",
  "umidoc": "umifile",
  "umi_doc": "umifile",
  "file": "umifile",
  "doc": "umifile",
  "document": "umifile",
};

// 构建所有可识别的标签名列表（标准名 + 别名）
const ALL_TAG_NAMES = [...VALID_TAGS, ...Object.keys(TAG_ALIASES)];
// 按长度降序排列，优先匹配更长的名称（避免 "img" 抢先匹配 "umiimg" 的子串）
ALL_TAG_NAMES.sort((a, b) => b.length - a.length);

const TAG_NAME_PATTERN = ALL_TAG_NAMES.join("|");

/**
 * 构建一个宽容的正则，能匹配各种畸形标签写法：
 *
 * 常见错误模式：
 *  1. 标签名拼错：<umi_img>, <umiimage>, <image>, <img>, <pic> ...
 *  2. 标签内多余空格：<umiimg >, < umiimg>, <umiimg >
 *  3. 闭合标签不匹配：<umiimg>url</umivoice>, <umiimg>url</img>
 *  4. 闭合标签缺失斜杠：<umiimg>url<umiimg> (用开头标签代替闭合标签)
 *  5. 闭合标签缺失尖括号：<umiimg>url/umiimg>
 *  6. 中文尖括号：＜umiimg＞url＜/umiimg＞ 或 <umiimg>url</umiimg>
 *  7. 多余引号包裹路径：<umiimg>"path"</umiimg>
 *  8. Markdown 代码块包裹：`<umiimg>path</umiimg>`
 */
const FUZZY_MEDIA_TAG_REGEX = new RegExp(
  // 可选 Markdown 行内代码反引号
  "`?" +
  // 开头标签：允许中文/英文尖括号，标签名前后可有空格
  "[<＜<]\\s*(" + TAG_NAME_PATTERN + ")\\s*[>＞>]" +
  // 内容：非贪婪匹配，允许引号包裹
  "[\"']?\\s*" +
  "([^<＜<＞>\"'`]+?)" +
  "\\s*[\"']?" +
  // 闭合标签：允许各种不规范写法
  "[<＜<]\\s*/?\\s*(?:" + TAG_NAME_PATTERN + ")\\s*[>＞>]" +
  // 可选结尾反引号
  "`?",
  "gi"
);

/**
 * 将标签名映射为标准名称
 */
function resolveTagName(raw: string): typeof VALID_TAGS[number] {
  const lower = raw.toLowerCase();
  if ((VALID_TAGS as readonly string[]).includes(lower)) {
    return lower as typeof VALID_TAGS[number];
  }
  return TAG_ALIASES[lower] ?? "umiimg";
}

/**
 * 预清理：将富媒体标签内部的换行/回车/制表符压缩为单个空格。
 *
 * 部分模型会在标签内部插入 \n \r \t 等空白字符，例如：
 *   <umiimg>\n  /path/to/file.png\n</umiimg>
 *   <umiimg>/path/to/\nfile.png</umiimg>
 *
 * 此正则匹配从开标签到闭标签之间的内容（允许跨行），
 * 将内部所有 [\r\n\t] 替换为空格，然后压缩连续空格。
 */
const MULTILINE_TAG_CLEANUP = new RegExp(
  "([<＜<]\\s*(?:" + TAG_NAME_PATTERN + ")\\s*[>＞>])" +
  "([\\s\\S]*?)" +
  "([<＜<]\\s*/?\\s*(?:" + TAG_NAME_PATTERN + ")\\s*[>＞>])",
  "gi"
);

/**
 * 预处理 LLM 输出文本，将各种畸形/错误的富媒体标签修正为标准格式。
 *
 * 标准格式：<umiimg>/path/to/file</umiimg>
 *
 * @param text LLM 原始输出
 * @returns 修正后的文本（如果没有匹配到任何标签则原样返回）
 */
export function normalizeMediaTags(text: string): string {
  // 先将标签内部的换行/回车/制表符压缩为空格
  let cleaned = text.replace(MULTILINE_TAG_CLEANUP, (_m, open: string, body: string, close: string) => {
    const flat = body.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
    return open + flat + close;
  });

  return cleaned.replace(FUZZY_MEDIA_TAG_REGEX, (_match, rawTag: string, content: string) => {
    const tag = resolveTagName(rawTag);
    const trimmed = content.trim();
    if (!trimmed) return _match; // 空内容不处理
    // 展开波浪线路径：~/Desktop/file.png → /Users/xxx/Desktop/file.png
    const expanded = expandTilde(trimmed);
    return `<${tag}>${expanded}</${tag}>`;
  });
}
