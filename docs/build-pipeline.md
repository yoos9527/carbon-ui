---
id: build-pipeline
type: module-design
status: draft
title: 工程管道与运行期配置
parent: carbon-ui-architecture
tags: [build, tooling]
---

# 职责

让源码变成一个能跑的产物，并在**不重新打包**的前提下改掉外观初值。拥有 `build/`、`vite.config.ts`、`.env*`、`pnpm-workspace.yaml`、`public/platform-config.json`、`mock/`、`tsconfig*.json`。规格文件按工具约束放在 `docs/` 下（`build/` 目录不建 spec 文件），但它描述的模块就是 `build/`。

# 命令

```bash
pnpm dev                                      # http://localhost:9527
pnpm exec vue-tsc --noEmit --skipLibCheck     # 日常类型检查
pnpm build                                    # rimraf dist && vite build
pnpm lint                                     # eslint + prettier + stylelint
```

`typecheck` 脚本是 `tsc --noEmit && vue-tsc --noEmit --skipLibCheck`——**单独跑 `tsc` 不检查 `.vue`，会假绿**。改过 `.vue` 一律跑 `vue-tsc`。`pnpm build` 20s+，只在动路由结构、构建配置、依赖时跑。

# 环境变量

三个文件，后加载的覆盖先加载的：`.env`（`VITE_PORT = 8848`，其余默认）→ `.env.development`（`VITE_PORT = 9527`、`VITE_ROUTER_HISTORY = "hash"`、`VITE_PUBLIC_PATH = /`）。`.env` 里还有 `VITE_HIDE_HOME = false`。

`build/utils.ts` 的 `wrapperEnv()` 给默认值并有两个副作用：`VITE_PORT` 强制转 `Number`，其余字符串写回 `process.env`，`"true"/"false"` 转布尔。默认值里 `VITE_PORT` 兜底也是 **9527**（与 `.env` 的 8848 不一致，但 dev 实际用 9527）——`README` 写「默认 http://localhost:8848」是过期信息。

`VITE_CDN` 与 `VITE_COMPRESSION` 决定 `getPluginsList(VITE_CDN, VITE_COMPRESSION)` 装哪些插件。

# 插件链

`build/plugins.ts` 依次装：Tailwind 4（`@tailwindcss/vite`）、Vue、JSX、`vite-plugin-router-warn`、`viteBuildInfo`（打包信息 + `getPackageSize` 统计 dist 体积）、`codeInspectorPlugin`、`vitePluginFakeServer`、CDN、压缩、SVG loader、`unplugin-icons`（`~icons/*` 离线解析，`@iconify/json` 已随依赖安装）、`removeConsole`、`visualizer`。

两条**不能动**的：`vitePluginFakeServer({ enableProd: false })` 保证 mock 不进生产包；`build/cdn.ts` 移除 `vue-demi` / `pinia` 是有意的（pinia 3 不再依赖 vue-demi，`importToCDN` 构造时会 `require.resolve` 它们的 `package.json` 而抛 `vue-demi package.json file does not exist`）。

# pnpm 12 铁律

依赖与安装类设置**只从 `pnpm-workspace.yaml` 读**，key 用 camelCase；`package.json` 的 `pnpm` 字段和 `.npmrc` 里的同名项在 pnpm 12 下被忽略，写了只误导人。当前配置及其原因：

- `allowBuilds`（6 项：`@parcel/watcher` / `core-js` / `es5-ext` / `esbuild` / `typeit` / `vue-demi`）：pnpm 12 默认禁掉全部构建脚本，不放行 esbuild 就二进制缺失。
- `ignoredBuiltDependencies: ["@tailwindcss/oxide"]`：Tailwind 4 的 oxide 走预编译二进制，不需要跑脚本。
- `shamefullyHoist: true`：上游有隐式提升依赖（如 `vue-tippy` → `tippy.js`），改成 isolated 会解析失败。
- `shellEmulator: true`：让 `VAR=x cmd` 形式的 npm script 在 Windows 下也能执行。
- `strictPeerDependencies: false` + `allowedDeprecatedVersions` 一长串：上游依赖树的既有现实。
- `packages: ["."]`，`preinstall` 锁 `only-allow pnpm`，一律用 pnpm。

# 运行期配置

`public/platform-config.json` 是**产物里的普通静态文件**：`src/main.ts` 的 `getPlatformConfig(app)` 在挂载前先读它，把 `Title`、`Layout`、`Theme`、`EpThemeColor`、`ShowLogo`、`FixedHeader`、`MultiTagsCache`、`KeepAlive`、`CachingAsyncRoutes`、`MenuSearchHistory`、`ResponsiveStorageNameSpace`（`"responsive-"`）灌进 settings store。改它不需要重新打包，替换 dist 下的这份文件即可。缺文件或字段时 store 里有兜底值。

# mock

`mock/` 由 `vite-plugin-fake-server` 消费，**仅 dev 生效**（见上）。现有三个：`mock/login.ts`（`admin`/`admin123` → roles `["admin"]`、permissions `["*:*:*"]`，其余用户名拿 `common` 角色）、`mock/refreshToken.ts`、`mock/asyncRoutes.ts`（返回 `{success:true, data:[]}`，业务菜单因此全走前端静态路由）。

# 边界

- 不拥有业务数据：`mock/` 只应答登录与空路由，页面数据在各自 `data.ts`（[[partners-integration]]）。
- 不拥有路由结构（[[skeleton-runtime]]），但 `VITE_HIDE_HOME`、`VITE_ROUTER_HISTORY` 这类开关落在这里。
- 上游基线与全部刻意偏离项另记在 `docs/UPSTREAM.md`（**作为输入文档，未升级为图谱节点，未经需求方确认**）。
