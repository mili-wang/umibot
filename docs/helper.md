# npm 发布教程

本文说明如何将 **@mili-wang/umibot** 发布到 npm，供用户通过 `openclaw plugins install @mili-wang/umibot@latest` 安装。

---

## 一、前置条件

1. **Node.js**：建议 18+，已安装 `npm`。
2. **npm 账号**：在 [npmjs.com](https://www.npmjs.com/) 注册。
3. **本机已登录 npm**：
   ```bash
   npm login
   # 按提示输入 Username、Password、Email、OTP（若开启双因素）
   npm whoami   # 确认当前登录用户
   ```
4. **包名与权限**：确保你有 `@mili-wang` 组织下发布权限（若为组织包）；包名为 scoped：`@mili-wang/umibot`，`package.json` 中已配置 `"publishConfig": { "access": "public" }`，无需额外传参。

---

## 二、切换镜像（可选）

国内网络可先切到镜像加速安装；**发布必须用官方源**，发布前请切回官方。

```bash
# 查看当前 registry
npm config get registry

# 使用淘宝 / npmmirror 镜像（安装依赖时加速）
npm config set registry https://registry.npmmirror.com

# 切回 npm 官方源（发布前必须使用官方源）
npm config set registry https://registry.npmjs.org
```

仅对当前项目生效（写入项目 `.npmrc`）：

```bash
# 项目内使用镜像
echo "registry=https://registry.npmmirror.com" >> .npmrc

# 项目内使用官方源
echo "registry=https://registry.npmjs.org" >> .npmrc
```

---

## 三、发布前检查

在项目根目录执行：

```bash
# 1. 安装依赖
npm install

# 2. 修正 package.json（避免发布时出现 "bin script name was cleaned" 等警告）
npm pkg fix

# 3. 本地构建（prepublishOnly 会自动执行，但建议先本地验证）
npm run build

# 4. 查看将要发布的文件（根据 package.json 的 "files" 字段）
npm pack --dry-run
```

确认 `npm pack --dry-run` 列表中包含 `dist/`、`bin/`、`package.json`、各 `*.plugin.json` 等，且无敏感或无关文件。

---

## 四、版本号与发布

### 1. 更新版本号

遵循 [语义化版本](https://semver.org/lang/zh-CN/)（SemVer）：

```bash
# 补丁版本：修复 bug，向后兼容（如 1.5.8 → 1.5.9）
npm version patch

# 次版本：新功能，向后兼容（如 1.5.8 → 1.6.0）
npm version minor

# 主版本：不兼容变更（如 1.5.8 → 2.0.0）
npm version major
```

以上命令会修改 `package.json` 的 `version` 并生成一次 git commit + tag（若在 git 仓库中）。若不想自动打 tag，可使用：

```bash
npm version patch --no-git-tag-version
```

### 2. 发布到 npm

```bash
npm publish
```

- 作用：根据 `package.json` 的 `main`、`files`、`publishConfig` 等，将当前包发布到 npm  registry。
- `prepublishOnly` 会在发布前自动执行 `npm run build`，确保发布的是最新构建结果。
- 若为首次发布 scoped 包且未在 `package.json` 中写 `publishConfig.access`，需使用：`npm publish --access public`；本包已配置，直接 `npm publish` 即可。

### 3. 发布后验证

```bash
npm view @mili-wang/umibot
# 或安装测试
openclaw plugins install @mili-wang/umibot@latest
```

---

## 五、常见问题

| 问题 | 处理 |
|------|------|
| `npm warn "bin[umibot]" script name was cleaned` | 在项目根目录执行 `npm pkg fix`，会自动修正 `package.json` 中 bin 等字段，然后再执行 `npm publish`。 |
| `404 Not Found - PUT ... @mili-wang%2fumibot` | 见下方 **「404 持续：scope 权限」** 小节。 |
| `403 Forbidden` / 无权限 | 确认已 `npm login`，且对 `@mili-wang` 有发布权限。 |
| 版本已存在 | 每次发布版本号必须递增，用 `npm version patch/minor/major` 升版后再 `npm publish`。 |
| 未发布到最新构建 | 发布前本地执行一次 `npm run build`，或依赖 `prepublishOnly` 自动构建。 |
| 想撤销某版本 | 72 小时内可 `npm unpublish @mili-wang/umibot@x.x.x --force`（慎用，可能影响依赖该版本的用户）。 |
| 发布失败 / 找不到包 | 发布必须使用官方源：`npm config set registry https://registry.npmjs.org` 后再 `npm publish`。 |

### 404 持续：scope 权限（@mili-wang 的两种用法）

npm 的 **scope**（`@mili-wang`）只能是下面之一，否则会 404：

- **你的 npm 用户名**：若你登录后 `npm whoami` 显示的就是 `mili-wang`，则可以直接发布；若仍 404，请到 [npmjs.com](https://www.npmjs.com) 确认**邮箱已验证**，再试一次 `npm logout` → `npm login` → `npm publish --access public`。
- **组织名**：若 `mili-wang` 是**组织**，必须先创建组织并拥有发布权限，才能发布 `@mili-wang/umibot`。  
  - 打开 [Create Organization](https://www.npmjs.com/org/create)，创建组织 `mili-wang`，把当前账号加入并赋予发布权限，然后再执行 `npm publish --access public`。

**若你当前 npm 用户名不是 mili-wang，且暂时不想建组织**，可以先用**个人 scope** 发布，包名改为 `@你的用户名/umibot`：

1. 在项目根目录执行（把 `你的用户名` 换成 `npm whoami` 的输出）：
   ```bash
   npm pkg set name="@你的用户名/umibot"
   ```
2. 然后执行 `npm publish --access public`。
3. 用户安装时使用：`openclaw plugins install @你的用户名/umibot@latest`。

以后若创建了组织 `mili-wang`，再把 `package.json` 的 `name` 改回 `@mili-wang/umibot` 并发布新版本即可。

---

## 六、推荐发布流程（小结）

```bash
cd /path/to/umibot
npm install
npm pkg fix          # 可选，避免 bin 等字段被修正的警告
npm run build
npm version patch    # 或 minor / major
npm publish          # 若 404 可试 npm publish --access public
git push && git push --tags   # 若使用 git 且希望同步 tag
```

如需本地开发/调试安装方式，见 [dev-start-and-debug.md](./dev-start-and-debug.md)。
