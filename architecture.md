---
id: carbon-ui-architecture
type: architecture-design
status: draft
title: Carbon UI 架构：模块边界、不变量与关键决策
parent: carbon-ui-goal
tags: [architecture]
---

# 形态

纯前端 SPA，从 `pure-admin-thin` v6.2.0（`f0ff132`）整目录继承，正在其上加业务。**没有后端**：菜单来自前端静态路由，页面数据来自各页面目录的 `data.ts` 内存 mock。

运行时只有一个入口 `src/main.ts`：先拉 `public/platform-config.json`，再依次装配 store、router、Element Plus、表格组件，最后 `mount`。

# 模块边界

四个模块，一张不画成 DAG 的关系表（原因见下一节）：

| 模块 | 拥有 | 规格 |
| --- | --- | --- |
| 骨架运行时 | `src/router`、`src/layout`、`src/store`、`src/utils/{auth,http}`、`src/api`、`src/views/login` | [[skeleton-runtime]] |
| 合作方接入档案 | `src/views/service/partners` | [[partners-integration]] |
| 接口管理 | `src/views/service/interfaces` | [[interface-config]] |
| 通用 UI 层 | `src/components`、`src/directives`、`src/plugins` | [[shared-ui]] |
| 工程管道 | `build/`、`vite.config.ts`、`.env*`、`pnpm-workspace.yaml`、`public/platform-config.json` | [[build-pipeline]] |

唯一干净的单向依赖是 **合作方档案 → 通用 UI 层**（用 `PureTableBar`、`~icons/*`）。业务域不 import 骨架内部实现，只用 `useRouter` / `useRoute` 做跳转与取参。

骨架运行时之所以是**一个**模块而不是「路由 / 外壳 / 会话」三块：这三块互相 import 成环，按依赖方向切会切出三个都必须声明「我也依赖另外两个」的规格。具体环：`src/router/index.ts` 用 `useMultiTagsStoreHook` 与 `routerArrays`（外壳）→ `src/store/modules/user.ts` 调 `resetRouter`（路由）与 `handleTags`（外壳）→ `src/layout/hooks/useNav.ts` 反过来用 `remainingPaths`、`useUserStoreHook`。**它们是一块，规格就写一块**；拆开只会造出假的 DAG。

通用 UI 层与骨架之间也不是单向的：`ReAuth` / `RePerms` 读 `hasAuth` / `hasPerms`（骨架），`RePureTableBar` 读 epTheme store（骨架），而 `layout` 又用 `ReIcon`、`ReSegmented`（UI 层）。同样按「谁拥有什么」划界。

# 跨模块不变量

1. **三级及以上路由一律拍平成二级**（`src/router/utils.ts` 的 `formatTwoStageRoutes`），keep-alive 只缓存到二级。所以详情页与任何不进菜单的页面必须写进 `src/router/modules/remaining.ts`；塞进业务模块的 `children` 会被按 path 前缀挂成三级再拍平，把带 `component` 的二级节点吃掉，**列表页静默空白且不报错**。
2. `remainingRouter` 会被直接 `concat` 进 `constantMenus`，所以 `meta.showLink: false` 是隐藏菜单入口的唯一手段——不能靠不写路由。
3. 组件 `defineOptions({ name })` 必须等于路由 `name`，否则 keepAlive 失效（`cachePageList` 按 name 记）。
4. 二级菜单要靠**子路由**的 `meta.showParent` 显式展开；本版 `alwaysShow` 全局无效（`lay-sidebar/components/SidebarItem.vue` 判的是子路由的 `showParent`）。
5. 面包屑会剔除与子级同 `title` 的父级（`lay-sidebar/components/SidebarBreadCrumb.vue`），父子 `title` 必须不同。
6. **视觉系统**（详情页定稿，新页面沿用）：CSS 变量定义在页面根容器上，`--ink #16233a` / `--ink-2 #46536e` / `--muted #8792a8` / `--line #e6eaf2` / `--line-soft #eef1f7` / `--accent: var(--el-color-primary)`。字段用 `<dl class="grid">`：label 12px 灰色在上、值 13px 在下，`gap: 18px 32px`，**不要边框**。数字 `font-variant-numeric: tabular-nums`；URL / 编码 / AppKey 用 `ui-monospace, "Cascadia Mono", Consolas`；状态用圆点 `.dot` 而非 `el-tag` 方框。**禁止** `el-descriptions border` 铺满页面的表格式布局，也不要给每列写死 `width`。
7. 弹窗里的 `el-dialog` 节点拿不到 scoped `data-v`，`:deep()` 会空转，样式覆盖必须用 `:global()`。

# 关键决策

- **冻结在 v6.2.0 基线，不跟完整版 `vue-pure-admin` 的 vite 8 / TS 6 / vue-router 5 / pinia 4**：那边是 Rolldown 新管线，生态与社区资料还没跟上。上游同步靠「取指定版本 → 看 diff → 只手工摘 `src/components` / `src/utils` / `src/layout` 的改动」，不 merge——仓库已做品牌化改动，直接 merge 必冲突。基线与每一项刻意偏离（CDN 模块、mock、pnpm 配置、端口）都记在 `docs/UPSTREAM.md`；该文件被当作**输入文档**，未升级为图谱节点（需求方未确认）。
- **鉴权方式只留两种**：公共请求头与 Groovy 脚本（`AuthType = "header" | "script"`）。原本的 apikey / basic / oauth2 等枚举被删除，公共请求头也从「环境与网络」区块迁进了「认证与鉴权」。理由未经确认；从提交史看是刻意收敛。
- **业务菜单留在前端静态路由**：`mock/asyncRoutes.ts` 返回空数组，动态路由机制（`addAsyncRoutes` + `import.meta.glob("/src/views/**/*.{vue,tsx}")`）已就绪但空转。
- **页面数据先落 `data.ts` 内存 mock**，接后端只换 helper，页面不动。
- **pnpm 12 的依赖配置只从 `pnpm-workspace.yaml` 读**，`package.json` 的 `pnpm` 字段与 `.npmrc` 同名项在 pnpm 12 下被忽略（细节见 [[build-pipeline]]）。
