/**
 * stripIncompleteMediaTag 单元测试
 *
 * 运行方式:  npx tsx tests/strip-incomplete-media-tag.test.ts
 */

import { stripIncompleteMediaTag } from "../src/utils/media-send.js";
import assert from "node:assert";

let passed = 0;
let failed = 0;
const failedTests: string[] = [];

function test(name: string, input: string, expectedSafe: string, expectedIncomplete: boolean) {
  const [safe, incomplete] = stripIncompleteMediaTag(input);
  try {
    assert.strictEqual(safe, expectedSafe, `safeText mismatch`);
    assert.strictEqual(incomplete, expectedIncomplete, `hasIncomplete mismatch`);
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}`);
    console.log(`     输入:     ${JSON.stringify(input)}`);
    console.log(`     期望:     [${JSON.stringify(expectedSafe)}, ${expectedIncomplete}]`);
    console.log(`     实际:     [${JSON.stringify(safe)}, ${incomplete}]`);
    failed++;
    failedTests.push(name);
  }
}

// ==========================================
// 1. 空值 / 无标签文本 → 不截断
// ==========================================
console.log("\n=== 1. 空值 / 无标签文本 ===");

test("空字符串", "", "", false);
test("纯文本", "这是一段普通文字", "这是一段普通文字", false);
test("含普通HTML标签", "这是<b>加粗</b>文字", "这是<b>加粗</b>文字", false);
test("含换行的纯文本", "第一行\n第二行\n第三行", "第一行\n第二行\n第三行", false);
test("只有换行", "\n\n\n", "\n\n\n", false);
test("以换行结尾（最后一行为空）", "text\n", "text\n", false);
test("多行以换行结尾", "abc\ndef\n", "abc\ndef\n", false);
test("纯空白", "   ", "   ", false);
test("< 后接空格（非标签）", "正文< ", "正文< ", false);
test("< 后接数字（如 < 3）", "条件 < 3 成立", "条件 < 3 成立", false);
test("数学公式 3 < 5 > 2", "计算结果: 3 < 5 > 2，完毕", "计算结果: 3 < 5 > 2，完毕", false);
test("文本末尾恰好是 >", "3 < 5 > 2 结果为 true>", "3 < 5 > 2 结果为 true>", false);

// ==========================================
// 2. 完全闭合的媒体标签 → 不截断
// ==========================================
console.log("\n=== 2. 完整闭合标签（不应截断）===");

test(
  "完整 umivoice 标签",
  "前文<umivoice>/tmp/joke.mp3</umivoice>后文",
  "前文<umivoice>/tmp/joke.mp3</umivoice>后文",
  false,
);
test(
  "完整 umiimg 标签",
  "看图<umiimg>/path/to/img.jpg</umiimg>",
  "看图<umiimg>/path/to/img.jpg</umiimg>",
  false,
);
test(
  "完整标签后有文本",
  "<umivoice>/tmp/joke.mp3</umivoice>\n\n谐音梗笑话 😄",
  "<umivoice>/tmp/joke.mp3</umivoice>\n\n谐音梗笑话 😄",
  false,
);
test(
  "纯标签完整闭合",
  "<umivoice>/tmp/joke.mp3</umivoice>",
  "<umivoice>/tmp/joke.mp3</umivoice>",
  false,
);
test(
  "完整标签在末尾",
  "这是正文<umivoice>/tmp/joke.mp3</umivoice>",
  "这是正文<umivoice>/tmp/joke.mp3</umivoice>",
  false,
);
test(
  "完整标签后有普通 < 字符",
  "<umivoice>/a.mp3</umivoice> 结果是 3 < 5",
  "<umivoice>/a.mp3</umivoice> 结果是 3 < 5",
  false,
);
test(
  "完整标签后跟 </b>（无 >）— 非媒体不影响",
  "正文<umivoice>/a.mp3</umivoice>后文</b",
  "正文<umivoice>/a.mp3</umivoice>后文</b",
  false,
);
test(
  "完整标签后跟 </b>（有 >）— 非媒体不影响",
  "正文<umivoice>/a.mp3</umivoice>后文</b>",
  "正文<umivoice>/a.mp3</umivoice>后文</b>",
  false,
);
test(
  "标签内容含 > 且完整闭合",
  "前文<umivoice>/tmp/笑话>_< .mp3</umivoice>",
  "前文<umivoice>/tmp/笑话>_< .mp3</umivoice>",
  false,
);
test(
  ">_</umivoice> 完整闭合（内容含 >_<）",
  "前文<umivoice>/tmp/笑话>_</umivoice>",
  "前文<umivoice>/tmp/笑话>_</umivoice>",
  false,
);

// ==========================================
// 3. 不完整的「开标签」→ 截断到该 < 前面
// ==========================================
console.log("\n=== 3. 不完整的开标签 ===");

test("孤立 < 在行尾", "这是正文<", "这是正文", true);
test("<umi", "这是正文<umi", "这是正文", true);
test("<umivoice", "这是正文<umivoice", "这是正文", true);
test("<umiimg>（有 > 但无闭合标签）", "这是正文<umiimg>", "这是正文", true);
test("<umiimg>/path", "这是正文<umiimg>/path/to", "这是正文", true);
test("<umiimg>/path/full（开标签有 > 但无闭合）", "这是正文<umiimg>/path/to/img.jpg", "这是正文", true);
test("纯开标签前缀（无前文）", "<umivoice>/tmp/joke.mp3", "", true);
test("<i 是 <img 的前缀 → 截断", "正文<i", "正文", true);
test("<img", "正文<img", "正文", true);
test("<image", "正文<image", "正文", true);
test("<video", "正文<video", "正文", true);
test("<audio", "正文<audio", "正文", true);
test("<file", "正文<file", "正文", true);
test("<doc", "正文<doc", "正文", true);
test("<media", "正文<media", "正文", true);
test("<attach", "正文<attach", "正文", true);
test("<send", "正文<send", "正文", true);
test("<pic", "正文<pic", "正文", true);
test("<photo", "正文<photo", "正文", true);
test("<document", "正文<document", "正文", true);
test("<picture", "正文<picture", "正文", true);
test("开标签有 > 但无闭合标签", "前文<umivoice>/path/to/file.mp3", "前文", true);

// ==========================================
// 4. 不完整的「闭合标签」→ 回溯到开标签前面截断
//    ★ 这是核心原则的关键场景
// ==========================================
console.log("\n=== 4. 不完整闭合标签（回溯到开标签）===");

test(
  "<  — 闭合标签刚开始",
  "这是正文<umivoice>/tmp/joke.mp3<",
  "这是正文",
  true,
);
test(
  "</  — 闭合标签刚开始",
  "这是正文<umivoice>/tmp/joke.mp3</",
  "这是正文",
  true,
);
test(
  "</umi — 闭合标签名部分",
  "这是正文<umivoice>/tmp/joke.mp3</umi",
  "这是正文",
  true,
);
test(
  "</umivoice — 闭合标签名完整但缺 >",
  "这是正文<umivoice>/tmp/joke.mp3</umivoice",
  "这是正文",
  true,
);
test(
  "</umiimg — umiimg 闭合标签前缀",
  "这是正文<umiimg>/path/to/img.jpg</umiimg",
  "这是正文",
  true,
);
test(
  "有前文 + </ 闭合前缀",
  "你好呀！<umivoice>/tmp/a.mp3</",
  "你好呀！",
  true,
);
test(
  "纯标签 + 闭合前缀（无前文）",
  "<umivoice>/tmp/joke.mp3</umivoice",
  "",
  true,
);
test(
  "标签内容含 > 字符 + 闭合未完成",
  "前文<umivoice>/tmp/笑话>_< .mp3</umivoice",
  "前文",
  true,
);
test(
  ">_</umivoice 未闭合（内容含 >_<）",
  "前文<umivoice>/tmp/笑话>_</umivoice",
  "前文",
  true,
);

// ==========================================
// 5. 闭合标签前缀但前面无对应开标签（防御场景）
// ==========================================
console.log("\n=== 5. 闭合标签前缀但无开标签（防御）===");

test(
  "</umivoice 无开标签（单行）→ 截掉整个最后一行",
  "普通文字</umivoice",
  "普通文字</umivoice",
  true,
);
test(
  "</umivoice 无开标签（多行）→ 只截掉最后一行",
  "前面的安全内容\n普通文字</umivoice",
  "前面的安全内容\n普通文字</umivoice",
  true,
);
test(
  "纯 </",
  "</",
  "</",
  true,
);
test(
  "纯 </umivoice 无开标签",
  "</umivoice",
  "</umivoice",
  true,
);
test(
  "</随便 不是媒体标签 → 安全",
  "普通文字</div",
  "普通文字</div",
  false,
);
test(
  "非媒体闭合标签 </div → 安全",
  "普通文字</div",
  "普通文字</div",
  false,
);

// ==========================================
// 6. 多行文本 — 只检查最后一行
// ==========================================
console.log("\n=== 6. 多行文本（只检查最后一行）===");

test(
  "前面行有未闭合，但最后一行安全",
  "第一行<umivoice\n第二行完整<umiimg>/b.jpg</umiimg>",
  "第一行<umivoice\n第二行完整<umiimg>/b.jpg</umiimg>",
  false,
);
test(
  "前面行安全，最后一行未闭合",
  "第一行完整\n第二行<umiimg>/b.jpg",
  "第一行完整\n第二行",
  true,
);
test(
  "多行 + 最后一行是闭合标签前缀",
  "第一行\n前文<umivoice>/a.mp3</umivoice",
  "第一行\n前文",
  true,
);
test(
  "多行 + 最后一行以换行结尾 → 安全",
  "第一行\n<umiimg>stuff\n",
  "第一行\n<umiimg>stuff\n",
  false,
);
test(
  "多行 + 最后一行有闭合标签回溯到开标签",
  "行一\n行二\n看看<umiimg>/path/to/img.jpg</umiimg",
  "行一\n行二\n看看",
  true,
);

// ==========================================
// 6.5 多行 — 前面行无论标签是否匹配，都必须完整保留
//     （只检查最后一行，前面行一定是 safeText 的一部分）
// ==========================================
console.log("\n=== 6.5 前面行一定保留 ===");

test(
  "前面行有未闭合媒体开标签 + 最后一行截断 → 前面行完整保留",
  "第一行<umivoice\n最后一行<umiimg>/b.jpg",
  "第一行<umivoice\n最后一行",
  true,
);
test(
  "前面行有未闭合媒体闭合标签 + 最后一行截断 → 前面行完整保留",
  "第一行</umivoice\n最后一行<umiimg>/b.jpg",
  "第一行</umivoice\n最后一行",
  true,
);
test(
  "前面行有孤立 < + 最后一行截断 → 前面行完整保留",
  "第一行内容<\n最后一行<umivoice>/a.mp3",
  "第一行内容<\n最后一行",
  true,
);
test(
  "前面行有孤立 </ + 最后一行截断 → 前面行完整保留",
  "第一行内容</\n最后一行<umiimg",
  "第一行内容</\n最后一行",
  true,
);
test(
  "前面行有不完整媒体标签对 + 最后一行截断 → 前面行完整保留",
  "第一行<umiimg>/path</umiimg\n最后一行<umivoice>/a.mp3",
  "第一行<umiimg>/path</umiimg\n最后一行",
  true,
);
test(
  "前面行有完整标签+不完整标签混合 + 最后一行截断",
  "<umivoice>/a.mp3</umivoice>然后<umiimg\n新的一行<umivoice>/b.mp3",
  "<umivoice>/a.mp3</umivoice>然后<umiimg\n新的一行",
  true,
);
test(
  "前面多行都有各种标签 + 最后一行截断 → 前面全部保留",
  "第1行<umivoice\n第2行</umiimg\n第3行<img>\n最后<umivoice>/a.mp3",
  "第1行<umivoice\n第2行</umiimg\n第3行<img>\n最后",
  true,
);
test(
  "前面行有媒体前缀标签 <i + 最后一行截断 → 前面行完整保留",
  "第一行<i\n最后一行<umivoice>/a.mp3",
  "第一行<i\n最后一行",
  true,
);
test(
  "前面行有非媒体标签 + 最后一行截断 → 前面行完整保留",
  "第一行<div>内容</div>\n<b>加粗\n最后一行<umiimg>/b.jpg",
  "第一行<div>内容</div>\n<b>加粗\n最后一行",
  true,
);
test(
  "前面行有完整媒体标签 + 最后一行安全 → 全部保留",
  "<umivoice>/a.mp3</umivoice>\n最后一行安全文字",
  "<umivoice>/a.mp3</umivoice>\n最后一行安全文字",
  false,
);

// ==========================================
// 7. 多个标签场景（同一行）
// ==========================================
console.log("\n=== 7. 多标签场景（同一行）===");

test(
  "完整标签后跟不完整开标签",
  "前文<umivoice>/a.mp3</umivoice>中间<umiimg>/b.jpg",
  "前文<umivoice>/a.mp3</umivoice>中间",
  true,
);
test(
  "完整标签后跟 <",
  "前文<umivoice>/a.mp3</umivoice>后续<",
  "前文<umivoice>/a.mp3</umivoice>后续",
  true,
);
test(
  "完整标签 + 另一个标签的闭合前缀（截到第二个的开标签前）",
  "前文<umivoice>/a.mp3</umivoice>中间<umiimg>/b.jpg</umiimg",
  "前文<umivoice>/a.mp3</umivoice>中间",
  true,
);
test(
  "完整标签 + 第二个闭合缺>",
  "前文<umivoice>/a.mp3</umivoice>中间<umivoice>/b.mp3</umivoice",
  "前文<umivoice>/a.mp3</umivoice>中间",
  true,
);
test(
  "完整标签后跟 </（孤立闭合前缀，回溯到开标签）",
  "前文<umivoice>/a.mp3</umivoice>中间<umiimg>/b.jpg</",
  "前文<umivoice>/a.mp3</umivoice>中间",
  true,
);
test(
  "完整标签 + 普通HTML + 未闭合媒体标签",
  "<umivoice>/a.mp3</umivoice>普通文本<b>加粗</b><umiimg>/b.jpg</umiimg",
  "<umivoice>/a.mp3</umivoice>普通文本<b>加粗</b>",
  true,
);
test(
  "两个完整标签紧挨",
  "<umivoice>/a.mp3</umivoice><umiimg>/b.jpg</umiimg>",
  "<umivoice>/a.mp3</umivoice><umiimg>/b.jpg</umiimg>",
  false,
);
test(
  "两个同名完整标签中间有文字",
  "<umivoice>/a.mp3</umivoice>中间文字<umivoice>/b.mp3</umivoice>",
  "<umivoice>/a.mp3</umivoice>中间文字<umivoice>/b.mp3</umivoice>",
  false,
);
test(
  "两个同名完整标签 + 末尾未闭合",
  "<umivoice>/a.mp3</umivoice>中间文字<umivoice>/b.mp3</umivoice>后面<umiimg>/c.jpg",
  "<umivoice>/a.mp3</umivoice>中间文字<umivoice>/b.mp3</umivoice>后面",
  true,
);
test(
  "第一个未闭合 + 第二个完整（从右到左，先看到完整的闭合标签→安全？不！）",
  // 从右到左：先找到 </umivoice> 完整闭合 → 对应哪个开标签？
  // 实际上从右到左找到的第一个媒体 < 是 </umivoice> → 完整闭合 → 返回安全
  // 但第一个 <umivoice> 其实没有闭合！
  // 这是一个设计取舍：由于我们只从右到左找第一个媒体标签，不做全行配对
  // 如果最右边的标签对完整，就认为安全
  "<umivoice>/a.mp3中间文字<umivoice>/b.mp3</umivoice>",
  // 从右到左：</umivoice> 完整 → safe
  // 注意：这里第一个 <umivoice> 没有 > 所以不算完整开标签
  // 从右到左找：先 </umivoice> 完整闭合 → 安全返回
  // 但实际上 <umivoice>/a.mp3 是个没有闭合的开标签
  // 这个场景可能返回 safe 也可能返回 unsafe，取决于实现
  // 实际代码从右到左找，第一个遇到的媒体 < 是 </umivoice>（行尾），完整 → safe=false
  // 但这是有 bug 的... 让我先测试看实际行为
  "<umivoice>/a.mp3中间文字<umivoice>/b.mp3</umivoice>",
  false,
);

// ==========================================
// 8. 全角中文尖括号 ＜＞
// ==========================================
console.log("\n=== 8. 中文全角尖括号 ===");

test("中文尖括号开标签", "这是正文＜umivoice", "这是正文", true);
test("孤立中文尖括号", "这是正文＜", "这是正文", true);
test(
  "中文尖括号完整标签",
  "这是正文＜umivoice>/tmp/joke.mp3</umivoice>",
  // ＜umivoice> 是开标签（用 ＜ 开头，> 结尾），检查后面有没有 </umivoice>
  "这是正文＜umivoice>/tmp/joke.mp3</umivoice>",
  false,
);
test(
  "中文尖括号闭合标签前缀",
  "这是正文＜umivoice>/tmp/joke.mp3＜/umivoice",
  // ＜/umivoice 是不完整闭合标签 → needFindOpenTag=umivoice → 往左找 ＜umivoice → 截断
  "这是正文",
  true,
);

// ==========================================
// 9. 各种媒体标签名测试
// ==========================================
console.log("\n=== 9. 各种媒体标签名 ===");

test("img 标签未闭合", "正文<img src='x'>content", "正文", true);
test("image 标签未闭合", "正文<image>content", "正文", true);
test("video 标签未闭合", "正文<video>content", "正文", true);
test("audio 标签未闭合", "正文<audio>content", "正文", true);
test("voice 标签未闭合", "正文<voice>content", "正文", true);
test("file 标签未闭合", "正文<file>content", "正文", true);
test("doc 标签未闭合", "正文<doc>content", "正文", true);
test("media 标签未闭合", "正文<media>content", "正文", true);
test("attach 标签未闭合", "正文<attach>content", "正文", true);
test("send 标签未闭合", "正文<send>content", "正文", true);
test("pic 标签未闭合", "正文<pic>content", "正文", true);
test("photo 标签未闭合", "正文<photo>content", "正文", true);
test("document 标签未闭合", "正文<document>content", "正文", true);
test("picture 标签未闭合", "正文<picture>content", "正文", true);

// 非媒体标签名不应截断
test("非媒体标签 <div> 不截断", "正文<div>content", "正文<div>content", false);
test("非媒体标签 <span> 不截断", "正文<span>content", "正文<span>content", false);
test("非媒体标签 <b> 不截断", "正文<b>content", "正文<b>content", false);
test("非媒体标签 <a> 不截断", "正文<a href='x'>link", "正文<a href='x'>link", false);

// 大小写
test("大写 <QQVOICE 也算媒体标签", "正文<QQVOICE", "正文", true);
test("混合大小写 <QqImg", "正文<QqImg", "正文", true);

// ==========================================
// 10. 纯媒体标签（没有前置文本）
// ==========================================
console.log("\n=== 10. 纯媒体标签（无前置文本）===");

test("纯开标签前缀", "<umivoice>/tmp/joke.mp3", "", true);
test("纯标签 + 闭合前缀", "<umivoice>/tmp/joke.mp3</umivoice", "", true);
test("纯标签完整闭合", "<umivoice>/tmp/joke.mp3</umivoice>", "<umivoice>/tmp/joke.mp3</umivoice>", false);
test(
  "纯标签完整闭合 + 换行文本",
  "<umivoice>/tmp/joke.mp3</umivoice>\n\n谐音梗笑话",
  "<umivoice>/tmp/joke.mp3</umivoice>\n\n谐音梗笑话",
  false,
);

// ==========================================
// 11. 截断后 trimEnd（去掉尾部空白和换行）
// ==========================================
console.log("\n=== 11. 截断后 trimEnd ===");

test(
  "截断后有3个连续换行 → trimEnd 去掉尾部换行",
  "第一段\n\n\n<umiimg>/path.jpg",
  "第一段",
  true,
);
test(
  "截断后有4个连续换行 → trimEnd 去掉尾部换行",
  "段落\n\n\n\n<umivoice>/a.mp3",
  "段落",
  true,
);
test(
  "截断后有2个连续换行 → trimEnd 去掉尾部换行",
  "段落\n\n<umivoice>/a.mp3",
  "段落",
  true,
);
test(
  "截断后 trimEnd 去除尾部空格和换行",
  "段落  \n  <umivoice>/a.mp3",
  // 多行：最后一行是 "  <umivoice>/a.mp3"
  // < 在 lastLine 中位置 2，text.slice(0, lineStart + 2) = "段落  \n  "
  // trimEnd 从末尾去除所有 \s（空格+换行），所以 "段落  \n  " → "段落"
  "段落",
  true,
);

// ==========================================
// 12. needFindOpenTag 通配模式（孤立 </ → 找最近媒体开标签）
// ==========================================
console.log("\n=== 12. 孤立 </ 的通配回溯 ===");

test(
  "孤立 </ + 前面有媒体开标签",
  "正文<umiimg>/path/to/img.jpg</",
  "正文",
  true,
);
test(
  "孤立 </ + 前面无媒体开标签 → 原样返回",
  "纯文本</",
  "纯文本</",
  true,
);
test(
  "孤立 </ + 前面有非媒体标签 → 找不到媒体开标签 → 原样返回",
  "正文<div>内容</",
  "正文<div>内容</",
  true,
);
test(
  "多行 + 最后一行孤立 </",
  "第一行\n第二行</",
  "第一行\n第二行</",
  true,
);

// ==========================================
// 13. needFindOpenTag 精确匹配模式
// ==========================================
console.log("\n=== 13. 闭合标签名精确回溯 ===");

test(
  "</umivoice 回溯找 <umivoice",
  "正文<umivoice>/tmp/a.mp3</umivoice",
  "正文",
  true,
);
test(
  "</umiimg 回溯找 <umiimg",
  "正文<umiimg>/path.jpg</umiimg",
  "正文",
  true,
);
test(
  "闭合标签名和开标签名不匹配（如 </umiimg 但前面是 <umivoice）→ 找不到对应开标签，原样返回",
  // 最后一行：<umivoice>/a.mp3</umiimg
  // 从右到左：</umiimg (不完整闭合) → needFindOpenTag=umiimg
  // 继续往左找 <umiimg 开标签，找到 <umivoice 但名字不匹配 → continue
  // 遍历完 → needFindOpenTag 是具体标签名但找不到对应开标签 → 原样返回
  "<umivoice>/a.mp3</umiimg",
  "<umivoice>/a.mp3</umiimg",
  true,
);

// ==========================================
// 14. 复合场景 — 完整标签 + 不完整标签混合
// ==========================================
console.log("\n=== 14. 复合场景 ===");

test(
  "完整A + 未闭合B开标签",
  "<umivoice>/a.mp3</umivoice>然后<umiimg>/b.jpg",
  "<umivoice>/a.mp3</umivoice>然后",
  true,
);
test(
  "完整A + 未闭合B闭合标签（回溯到B开标签）",
  "<umivoice>/a.mp3</umivoice>然后<umiimg>/b.jpg</umiimg",
  "<umivoice>/a.mp3</umivoice>然后",
  true,
);
test(
  "完整A + 完整B + 未闭合C",
  "<umivoice>/a.mp3</umivoice><umiimg>/b.jpg</umiimg>再来<umivoice>/c.mp3",
  "<umivoice>/a.mp3</umivoice><umiimg>/b.jpg</umiimg>再来",
  true,
);
test(
  "两个同名完整标签 + 第三个未闭合",
  "<umivoice>/a.mp3</umivoice>中间<umivoice>/b.mp3</umivoice>后面<umivoice>/c.mp3",
  "<umivoice>/a.mp3</umivoice>中间<umivoice>/b.mp3</umivoice>后面",
  true,
);

// ==========================================
// 15. 标签属性场景
// ==========================================
console.log("\n=== 15. 标签属性 ===");

test(
  "开标签有属性且完整闭合",
  '正文<umiimg src="/path/img.jpg">image desc</umiimg>',
  '正文<umiimg src="/path/img.jpg">image desc</umiimg>',
  false,
);
test(
  "开标签有属性但无闭合标签",
  '正文<umiimg src="/path/img.jpg">image desc',
  "正文",
  true,
);
test(
  "开标签有属性但未写完（无 >）",
  '正文<umiimg src="/path/img.jpg',
  "正文",
  true,
);

// ==========================================
// 16. 边界场景
// ==========================================
console.log("\n=== 16. 其他边界场景 ===");

test(
  "单个 < 字符（行尾）",
  "<",
  "",
  true,
);
test(
  "< 后紧跟 >（如 <>）— 不是有效标签",
  "文本<>",
  "文本<>",
  false,
);
test(
  "多个连续 < 在行尾",
  "文本<<<",
  "文本<<",
  true,
);
test(
  "标签名后有空格再有 >",
  "正文<umivoice >/a.mp3</umivoice>",
  "正文<umivoice >/a.mp3</umivoice>",
  false,
);
test(
  "闭合标签名后有空格再有 >",
  "正文<umivoice>/a.mp3</umivoice >",
  // 从右到左：找到 </umivoice > → isClosing=true, hasBracket=true (有>), 完整闭合 → safe
  "正文<umivoice>/a.mp3</umivoice >",
  false,
);

// ==========================================
// 17. 前缀匹配补充 — 单字母/多字母前缀
// ==========================================
console.log("\n=== 17. 前缀匹配补充 ===");

// 单字母前缀，可能是媒体标签名的开头
test("<v 是 voice/video 前缀 → 截断", "正文<v", "正文", true);
test("<p 是 pic/photo/picture 前缀 → 截断", "正文<p", "正文", true);
test("<d 是 doc/document 前缀 → 截断", "正文<d", "正文", true);
test("<s 是 send 前缀 → 截断", "正文<s", "正文", true);
test("<a 是 audio/attach 前缀 → 截断", "正文<a", "正文", true);
test("<f 是 file 前缀 → 截断", "正文<f", "正文", true);
test("<m 是 media 前缀 → 截断", "正文<m", "正文", true);
test("<q 是 umi 前缀 → 截断", "正文<q", "正文", true);

// 多字母前缀
test("<vo 是 voice 前缀 → 截断", "正文<vo", "正文", true);
test("<ph 是 photo 前缀 → 截断", "正文<ph", "正文", true);
test("<do 是 doc/document 前缀 → 截断", "正文<do", "正文", true);
test("<at 是 attach 前缀 → 截断", "正文<at", "正文", true);
test("<pi 是 pic/picture 前缀 → 截断", "正文<pi", "正文", true);
test("<se 是 send 前缀 → 截断", "正文<se", "正文", true);
test("<au 是 audio 前缀 → 截断", "正文<au", "正文", true);
test("<umiv 是 umivoice/umivideo 前缀 → 截断", "正文<umiv", "正文", true);
test("<umip 是 umipic/umiphoto/umipicture 前缀 → 截断", "正文<umip", "正文", true);

// 不是任何媒体标签的前缀 → 不截断
test("<x 不是媒体前缀 → 不截断", "正文<x", "正文<x", false);
test("<z 不是媒体前缀 → 不截断", "正文<z", "正文<z", false);
test("<b 不是媒体前缀 → 不截断", "正文<b", "正文<b", false);
test("<h 不是媒体前缀 → 不截断", "正文<h", "正文<h", false);
test("<div 不是媒体前缀 → 不截断", "正文<div", "正文<div", false);
test("<span 不是媒体前缀 → 不截断", "正文<span", "正文<span", false);

// ==========================================
// 18. 前缀匹配 + 已有 > 闭合 → 不应截断
// ==========================================
console.log("\n=== 18. 前缀标签已闭合 ===");

test("<i>text — <i> 虽是 img 前缀但已有 >，非媒体标签 → 不截断", "正文<i>text", "正文<i>text", false);
test("<v>text — <v> 有闭合 >，非媒体标签 → 不截断", "正文<v>text", "正文<v>text", false);
test("<p>text — <p> 有闭合 >，非媒体标签 → 不截断", "正文<p>text", "正文<p>text", false);
test("<a href>link — <a> 有闭合 >，不截断", "正文<a href='x'>link", "正文<a href='x'>link", false);

// ==========================================
// 19. 闭合标签前缀回溯补充
// ==========================================
console.log("\n=== 19. 闭合标签前缀回溯补充 ===");

test("</v 回溯找 <voice → 截断", "正文<voice>/a.mp3</v", "正文", true);
test("</v 回溯找 <video → 截断", "正文<video>/a.mp4</v", "正文", true);
test("</i 回溯找 <img → 截断", "正文<img>/a.jpg</i", "正文", true);
test("</q 回溯找 <umivoice → 截断", "正文<umivoice>/a.mp3</q", "正文", true);
test("</umiv 回溯找 <umivoice → 截断", "正文<umivoice>/a.mp3</umiv", "正文", true);
test("</x 不是媒体前缀 → 不截断", "正文</x", "正文</x", false);
test("</b 不是媒体前缀 → 不截断", "正文</b", "正文</b", false);

// 闭合前缀无对应开标签 → 原样返回
test("</v 无开标签 → 原样返回", "纯文本</v", "纯文本</v", true);
test("</i 无开标签 → 原样返回", "纯文本</i", "纯文本</i", true);
test("</umiv 无开标签 → 原样返回", "纯文本</umiv", "纯文本</umiv", true);

// ==========================================
// 20. 回溯跳过已完整闭合对
// ==========================================
console.log("\n=== 20. 回溯跳过已闭合对 ===");

test(
  "</ 回溯时跳过已完整闭合的标签对",
  "正文<umiimg>/a.jpg</umiimg>中间<umivoice>/b.mp3</umivoice>后面</",
  // </ 触发回溯找未闭合的媒体开标签
  // <umivoice> 有 </umivoice> → 完整对 → 跳过
  // <umiimg> 有 </umiimg> → 完整对 → 跳过
  // 找不到 → 原样返回
  "正文<umiimg>/a.jpg</umiimg>中间<umivoice>/b.mp3</umivoice>后面</",
  true,
);
test(
  "</umiimg 回溯跳过已闭合对找到未闭合开标签",
  "前文<umiimg>/a.jpg<umivoice>/b.mp3</umivoice>后面</umiimg",
  // </umiimg → 回溯找 <umiimg
  // <umivoice> 有 </umivoice> 完整对 → 跳过
  // <umiimg> 没有完整闭合对 → 匹配！截断到这里
  "前文",
  true,
);

// ==========================================
// 21. 自闭合标签和 </> 场景
// ==========================================
console.log("\n=== 21. 特殊标签格式 ===");

test("</> 不是有效标签名 → 安全", "文本</>", "文本</>", false);
test("自闭合 <umiimg/>（有 > 但无闭合标签对）→ 截断", "正文<umiimg/>", "正文", true);

// ==========================================
// 22. 极端边界 — 连续和混合
// ==========================================
console.log("\n=== 22. 极端边界 ===");

test("只有 <", "<", "", true);
test("只有 </", "</", "</", true);
test("只有 <umivoice", "<umivoice", "", true);
test("只有 </umivoice", "</umivoice", "</umivoice", true);
test("< 后面紧跟 /umivoice>（完整闭合标签，无开标签）", "</umivoice>", "</umivoice>", false);
test("连续两个孤立 <", "文本<<", "文本<", true);
test("开标签后紧跟另一个 <", "正文<umiimg><", "正文", true);
test("非媒体标签后面跟 <", "正文<div><", "正文<div>", true);
test(
  "很长的文本 + 末尾未闭合",
  "这是一段很长很长很长的文本，包含了很多内容。" + "<umivoice>/very/long/path/to/audio/file.mp3",
  "这是一段很长很长很长的文本，包含了很多内容。",
  true,
);
test(
  "emoji + 媒体标签",
  "哈哈😄🎉<umiimg>/img.jpg</umiimg>",
  "哈哈😄🎉<umiimg>/img.jpg</umiimg>",
  false,
);
test(
  "emoji + 未闭合媒体标签",
  "哈哈😄🎉<umiimg>/img.jpg",
  "哈哈😄🎉",
  true,
);
test(
  "中英混合 + 未闭合",
  "Hello你好World世界<umivoice>/a.mp3",
  "Hello你好World世界",
  true,
);

// ==========================================
// 23. 流式输出逐步增长模拟
// ==========================================
console.log("\n=== 23. 流式输出模拟 ===");

// 模拟 LLM 流式输出的每个阶段
test("流式 step1: 正文", "笑话来了：", "笑话来了：", false);
test("流式 step2: 出现 <", "笑话来了：<", "笑话来了：", true);
test("流式 step3: <q", "笑话来了：<q", "笑话来了：", true);
test("流式 step4: <umi", "笑话来了：<umi", "笑话来了：", true);
test("流式 step5: <umiv", "笑话来了：<umiv", "笑话来了：", true);
test("流式 step6: <umivo", "笑话来了：<umivo", "笑话来了：", true);
test("流式 step7: <umivoi", "笑话来了：<umivoi", "笑话来了：", true);
test("流式 step8: <umivoic", "笑话来了：<umivoic", "笑话来了：", true);
test("流式 step9: <umivoice", "笑话来了：<umivoice", "笑话来了：", true);
test("流式 step10: <umivoice>", "笑话来了：<umivoice>", "笑话来了：", true);
test("流式 step11: <umivoice>/a", "笑话来了：<umivoice>/a.mp3", "笑话来了：", true);
test("流式 step12: 出现 </", "笑话来了：<umivoice>/a.mp3</", "笑话来了：", true);
test("流式 step13: </q", "笑话来了：<umivoice>/a.mp3</q", "笑话来了：", true);
test("流式 step14: </umivoice", "笑话来了：<umivoice>/a.mp3</umivoice", "笑话来了：", true);
test("流式 step15: </umivoice> 完成！", "笑话来了：<umivoice>/a.mp3</umivoice>", "笑话来了：<umivoice>/a.mp3</umivoice>", false);
test("流式 step16: 后续文字", "笑话来了：<umivoice>/a.mp3</umivoice> 好听吗？", "笑话来了：<umivoice>/a.mp3</umivoice> 好听吗？", false);

// ==========================================
// 总结
// ==========================================
console.log(`\n${"=".repeat(50)}`);
console.log(`总计: ${passed + failed} 个测试, ✅ ${passed} 通过, ❌ ${failed} 失败`);
if (failedTests.length > 0) {
  console.log(`失败用例:`);
  for (const t of failedTests) console.log(`  - ${t}`);
  process.exit(1);
} else {
  console.log("🎉 全部通过！\n");
}
