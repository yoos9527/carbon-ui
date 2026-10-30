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
├── index.vue          # 列表页（搜索区 + PureTableBar + pure-table）
├── data.ts            # 类型 + mock 数据 + 查询/写操作 helper
├── csv.ts             # 导入导出：列定义 / toCsv / toCsvTemplate / planImport / applyImport
├── detail.vue         # 详情页（左侧步骤条：环境与网络 / 认证与鉴权 / 高级配置 + 字段网格）
├── SPEC.md            # 本模块规格（结构、契约、视觉细则）
└── components/        # 该页面专用的弹窗 / 子组件

src/views/service/interfaces/
├── index.vue          # 列表页（跨合作方扁平化为接口行）
├── edit.vue           # 分步表单：基本信息/入参/出参/高级配置（计费·流控·缓存）（路由在 remaining.ts）
├── data.ts            # 跨合作方聚合 + 分步校验 validateStep
├── csv.ts
└── SPEC.md

src/views/service/parsers/
├── index.vue          # 列表页（类型 / 关联接口数 / 版本）
├── data.ts            # 解析器库 + 版本快照 + 引用计数
├── SPEC.md
└── components/        # ParserDrawer（CodeEditor + 历史版本回滚）
```

- 页面数据一律先放 `data.ts`：`export interface XxxItem` + `mockXxx` 数组 + `getXxxById()`。接后端时只替换 helper 的实现，页面不动。
- 新增页面 = 建目录 + 建路由 + `meta.icon` 用 `ri/*`（`@iconify/json` 已装，离线可解析）。
- 通用组件放 `src/components/Re*`；页面私有组件留在页面目录。
- 新建列表页 / 详情页直接照这两个目录抄骨架，不要重新发明；视觉一律按第 6 节。

## 6. UI 设计规范（统一，新页面照抄）

权威细则在三份 SPEC 里，这里只是施工速查：`src/views/service/partners/SPEC.md`（详情页 / 字段区 / 弹窗 / 导入导出 / 按钮层级）、`src/views/service/interfaces/SPEC.md`（列表页骨架 / 四步表单）、`src/views/service/parsers/SPEC.md`（抽屉 + 代码编辑器 + 版本列表）。**改一处视觉必须同步其余 SPEC**，三个列表页的按钮与工具栏是同一套规范。

### 6.1 设计令牌（唯一允许出现色值的地方）

令牌定义在页面根容器（如 `.pd`、`.ix`、`.ix-list`），默认是亮色一套，同一组变量在 `html.dark` 里整体覆盖：

| 令牌                         | 亮色                              | 暗色                              | 用途                                                                    |
| ---------------------------- | --------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `--ink`                      | `#16233a`                         | `#e6ebf5`                         | 主文字、标题                                                            |
| `--ink-2`                    | `#46536e`                         | `#a7b2c7`                         | 次级文字、表格正文                                                      |
| `--muted`                    | `#8792a8`                         | `#7a879e`                         | label、说明、占位                                                       |
| `--line`                     | `#e6eaf2`                         | `#262d3b`                         | 常规分隔线、卡片边框                                                    |
| `--line-soft`                | `#eef1f7`                         | `#1e242f`                         | 行内浅分隔                                                              |
| `--surface`                  | `#fff`                            | `#151a23`                         | 卡片 / 面板底                                                           |
| `--canvas`                   | `#f4f6fa`                         | `#020409`                         | 页面底色                                                                |
| `--wash`                     | `#fafbfd`                         | `#1a2029`                         | 弱底：提示块、底栏、悬停行外框                                          |
| `--hover`                    | `#f4f6fa`                         | `#1d232e`                         | 悬停态背景                                                              |
| `--track`                    | `#e9edf5`                         | `#232a36`                         | 进度条槽、骨架                                                          |
| `--mix` / `--mix-ink`        | `#fff` / `#0b1a33`                | `#151a23` / `#e8eefc`             | 专供 `color-mix()` 掺色                                                 |
| `--on` / `--warn` / `--code` | `#0f9d58` / `#c77700` / `#6b4dff` | `#3fbf7f` / `#e0a33a` / `#9d8bff` | 启用绿 / 警告琥珀 / 标识紫（暗色需提亮，原色在 `#151a23` 上对比度不够） |
| `--accent`                   | `var(--el-color-primary)`         | 同左                              | 跟随主题色，不写死蓝                                                    |

- **页面里禁止出现裸 `#hex`**，新配色先加令牌再引用；`rgba(...)` 只允许用在遮罩 / 阴影。
- 暗色不做「另一套类名」：同一个 `.xxx` 在 `html.dark .xxx` 下只覆盖变量，选择器与布局零改动。scoped 组件里写 `html.dark .pd` 就够（`data-v` 只加在最后一个复合选择器上）。
- 掺色一律 `color-mix(in srgb, var(--accent) 12%, var(--mix))`，不要写死 `#fff`，否则暗色下会发白发亮。

### 6.2 列表页骨架（`partners/index.vue`、`interfaces/index.vue` 即模板）

```
<el-card class="search-form">     查询区：关键字 + 1~2 个下拉 + 「查询」「重置」
<PureTableBar>                     #buttons 在前（放主操作），#title 在后（放「共 N 个 · 启用 X」概览）
  <pure-table>                     selection 列 fixed left → 业务列 → 操作列 fixed right
```

- 列宽一律 `minWidth`，**不写死 `width`**（名称列负责吃掉剩余宽度）；只有 selection（55）和操作列（`fixed="right"`，240~250）用 `width`。
- 列表里的标识 / 路径 / 编码用等宽 12px + `.copy` 复制按钮（平时 `opacity: 0`，行悬停显形，`@click.stop` 防触发行跳转）。
- 整行可点进详情/配置时，`handleRowClick` 必须跳过 `column?.type === "selection"`，否则勾选会误跳转。
- 工具条标题带概览数字，从数据现算，不写死。
- 状态表达分两种，按语义选，别混：**离散枚举**（启用/停用/测试中）用 `el-tag`，`tagType` 由 `data.ts` 的状态字典给，暗色由 EP dark css-vars 自动接管；**连续/健康态**（正常、从未调用、异常）和详情页字段区用 `.dot` 圆点（`var(--on)` / 灰 / `var(--warn)`）。

### 6.3 按钮层级（两页共用，返工过四轮，别再发明）

| 角色   | 写法                          | 例子                                                 |
| ------ | ----------------------------- | ---------------------------------------------------- |
| 主操作 | `type="primary" plain`        | 新增、查询                                           |
| 危险   | `type="danger" plain`         | 批量删除、删除、停用                                 |
| 次要   | 裸 `plain`                    | 导入、导出、重置、模板下载                           |
| 行内   | `size="small" plain` + 语义色 | 编辑/配置(primary)、启用(success)、停用/删除(danger) |

- **禁止实底按钮**：EP 2.11 的 `plain` 本来就不改背景色，实底 `type="primary"` 会和旁边描边按钮混成两种风格。
- 文案带宾语是错的：工具栏一律「新增」，不写「新增合作方 / 新增接口」。
- 批量删除**不置灰**（浅粉禁用态和旁边的白底描边按钮对不齐），未勾选时点击 `ElMessage.warning("请先勾选…")`。

### 6.4 详情页 / 字段区

- 详情页左侧导航用**步骤条**（`.step` 序号圆点 + 标题，见 `partners/detail.vue`），不是裸 tab 文字；**多块配置能合并就合并成一页**（合作方把「调用策略 + 计费与额度」合成第 3 步「高级配置」，内部用 `.sec__sub` + `grid--4` 分小节）。

- 字段区：`<dl class="grid">`，label（12px `var(--muted)`）在上、值（13px）在下，`gap: 18px 32px`，**不要边框**；列表型数据（如多环境）用 `.alist` 三列表格，不要塞进 `<dl>`。
- 数字 `font-variant-numeric: tabular-nums`；URL / 编码 / AppKey / 脚本用 `ui-monospace, "Cascadia Mono", Consolas`。
- 详情页字段区的状态用 `.dot`（圆点 + 文字，`var(--on)` 启用 / 灰停用 / `var(--warn)` 警告）；列表页见 6.2 的选型规则。
- 编辑态 = 同一网格换控件 + 底部 sticky `.editbar`（取消 / 保存）；多步表单用左 `.ix-steps` + 右 `.ix-panel` + 底部 `.ix-actions`。
- **禁止** `el-descriptions border` 铺满页面的「Excel 表格式」布局。

### 6.5 弹窗与表单细节

- `el-dialog` / `el-drawer` 的节点挂在 body，拿不到 scoped 的 `data-v`，`:deep()` 会空转 → 一律 `:global(.xxx)`。
- 校验只在「下一步 / 保存」时跑，出错只给控件描红（`.f.is-error` / `.cell-input.is-error`），不整页报红。
- 文案：标题 + 一句说明，不写「请在此处…」这类废话；确认框写清后果（「停用后该合作方下的接口将拒绝新的调用请求」）。
- 任何代码输入一律用 `@/components/CodeEditor`（CodeMirror + Groovy 高亮），**固定暗色，不跟站点主题**；不要再拿 `el-input type="textarea"` 自绘浅底代码框。出错只改 `.cm-editor` 的边框色。

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
