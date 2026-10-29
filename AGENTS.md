# AGENTS.md

面向 AI / 新加入的开发者的工程约定。项目背景、上游基线与同步方式见 [`README.md`](./README.md) 和 [`docs/UPSTREAM.md`](./docs/UPSTREAM.md)，这里只写「动手时必须遵守的东西」。

## 1. 这是什么

`carbon-ui`：基于 `pure-admin-thin` v6.2.0（`f0ff132`）的中后台前端骨架，正在做成「数据服务商接入管理台」。

- **没有后端**。菜单来自 `src/router/modules/*.ts` 的静态路由（`mock/asyncRoutes.ts` 返回空数组），页面数据放各页面目录的 `data.ts`（内存 mock）。
- 技术栈：Vue 3.5 + Vite 7 + TS 5.9 + Element Plus 2.11 + Tailwind 4 + Pinia 3。
- 本地账号：`admin` / `admin123`（`mock/login.ts`）。
- 开发端口：**9527**（`.env.development` 的 `VITE_PORT`，`build/utils.ts` 里有同名兜底值）。

## 2. 命令

```bash
pnpm dev                                      # http://localhost:9527
pnpm exec vue-tsc --noEmit --skipLibCheck     # 类型检查（日常只跑这个）
pnpm build                                    # 产物 dist/
pnpm lint                                     # eslint + prettier + stylelint
```

- **`tsc --noEmit` 不检查 `.vue` 文件**：项目 `typecheck` 脚本是 `tsc && vue-tsc`，单独跑 `pnpm exec tsc --noEmit` 会假绿。改过 `.vue` 一律跑 `vue-tsc`。
- **小改动不要跑 `pnpm build`**（20s+）。只有动路由结构、构建配置、依赖时才需要，且跑之前先问。
- 依赖一律 `pnpm` 装（`preinstall` 锁了 `only-allow pnpm`）。

## 3. 工具链铁律（pnpm 12）

- 依赖 / 安装类设置**只从 `pnpm-workspace.yaml` 读**，且 key 用 camelCase（`allowBuilds`、`shamefullyHoist`、`shellEmulator`、`strictPeerDependencies`）。
- `package.json` 的 `pnpm` 字段、`.npmrc` 里的同名项在 pnpm 12 下**被忽略**，写了只会误导人，不要加。
- 新依赖带原生构建脚本时，要在 `pnpm-workspace.yaml` 的 `allowBuilds` 里放行，否则二进制缺失。

## 4. 路由：三个必须知道的坑

菜单路由放 `src/router/modules/<模块>.ts`，`export default {...} satisfies RouteConfigsTable`；`meta.title` **必填**，否则 TS2741。

1. **二级菜单要展开父级**：子路由 `meta` 加 `showParent: true`。`alwaysShow` 在本版**全局无效**（`lay-sidebar/components/SidebarItem.vue:96` 判的是子路由的 `meta.showParent`，单子节点默认被拍平）。
2. **详情页 / 不进菜单的页面放 `src/router/modules/remaining.ts`**，不要塞进业务模块的 `children`：`src/router/index.ts` 的 `buildHierarchyTree` + `formatTwoStageRoutes` 会按 path 前缀把 `/a/b/detail/:id` 挂成三级再拍平，结果把 `/a/b` 这个带 component 的节点吃掉，列表页直接空白（无报错）。
3. `meta.showLink: false` **只用于隐藏菜单入口**，不能删——`remainingRouter` 会被 `constantMenus` 直接 concat，删了就会出现在侧栏。

其他：`defineOptions({ name })` 必须与路由 `name` 一致，否则 keepAlive 失效；面包屑要求父子 `title` 不同（`SidebarBreadCrumb.vue` 会剔除同名父级）。

## 5. 页面约定

```
src/views/service/partners/
├── index.vue          # 列表页（PureTableBar + pure-table）
├── data.ts            # 类型 + mock 数据 + 查询 helper
├── detail.vue         # 详情页（左侧目录 + 字段网格）
└── components/        # 该页面专用的弹窗 / 子组件
```

- 页面数据一律先放 `data.ts`：`export interface XxxItem` + `mockXxx` 数组 + `getXxxById()`。接后端时只替换 helper 的实现，页面不动。
- 新增页面 = 建目录 + 建路由 + `meta.icon` 用 `ri/*`（`@iconify/json` 已装，离线可解析）。
- 通用组件放 `src/components/Re*`；页面私有组件留在页面目录。

## 6. 视觉系统（详情页已定稿，新页面沿用）

CSS 变量定义在页面根容器（如 `.pd`）：`--ink:#16233a`、`--ink-2:#46536e`、`--muted:#8792a8`、`--line:#e6eaf2`、`--line-soft:#eef1f7`、`--accent: var(--el-color-primary)`。

- 字段区：`<dl class="grid">`，label（12px 灰）在上、值（13px）在下，`gap: 18px 32px`，**不要边框**。
- 数字 `font-variant-numeric: tabular-nums`；URL / 编码 / AppKey 等用 `ui-monospace, "Cascadia Mono", Consolas`。
- 状态用 `.dot`（圆点 + 文字，启用绿 `#0f9d58` / 停用灰 / 警告琥珀 `#c77700`），**不要 el-tag 方框**。
- 编辑态 = 同一网格换控件 + 底部 sticky `.editbar`（取消 / 保存）。
- **禁止**用 `el-descriptions border` 铺满页面的「Excel 表格式」布局，也不要给每列都写死 `width`（名称列会吃掉全部剩余宽度）。
- 弹窗内的 `el-dialog` 节点拿不到 scoped 的 `data-v`，`:deep(.xxx)` 会空转，必须用 `:global(.xxx)`。

## 7. 提交

```bash
git -c user.name=carbon -c user.email=carbon@local commit --no-verify -m "feat(service): ..."
```

- 仓库未配置 `user.name` / `user.email`，沿用作者 `carbon <carbon@local>`。
- husky + lint-staged 的 `pre-commit` 会卡很久，统一 `--no-verify`，提交前自己跑 `eslint` / `prettier`（只格式化改动文件）。
- **不要** `prettier --write "src/**/*"` 全量格式化：`core.autocrlf=true` + prettier 默认 `endOfLine: lf` 会让上百个文件变成纯行尾符改动。

## 8. 不要改的地方

- `build/cdn.ts` 里移除 `vue-demi` / `pinia` 是有意的（pinia 3 不再依赖 vue-demi，`importToCDN` 构造时会 `require.resolve` 而抛错）。
- `build/plugins.ts` 的 `vitePluginFakeServer({ enableProd: false })`：mock 绝不能进生产包。
- `pnpm-workspace.yaml` 的 `shamefullyHoist: true`：上游有隐式提升依赖（如 `vue-tippy` → `tippy.js`），改成 isolated 会解析失败。
