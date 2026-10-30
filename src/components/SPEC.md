---
id: shared-ui
type: module-design
status: draft
title: 通用 UI 层：组件、指令与插件
parent: carbon-ui-architecture
tags: [ui, framework]
---

# 职责

与业务无关、被多处复用的界面能力：`src/components/`（9 个 `Re*` 组件）、`src/directives/`（6 个指令）、`src/plugins/`（Element Plus 与 echarts 的按需装配）。这一层不知道「合作方」是什么，只接受 props 和 store。

# 组件

| 组件 | 用途 |
| --- | --- |
| `RePureTableBar` | 列表页工具条：左侧标题/按钮插槽、右侧列显隐与密度切换、全屏、刷新。`src/bar.tsx`，内部读 `useEpThemeStoreHook` 拿 Element 主题色 |
| `ReIcon` | 图标统一入口，选择 `iconify` 离线 / 在线 / `iconfont` 三种来源 |
| `ReAuth` | 基于 `hasAuth()` 的权限占位，无权限时不渲染插槽 |
| `RePerms` | 同上，基于 `hasPerms()`（按钮级 `permissions[]`） |
| `ReDialog` | 命令式弹窗：传配置数组即弹，支持多按钮回调 |
| `ReSegmented` | 分段选择器（设置面板与列表密度用它） |
| `ReCol` | `el-col` 的响应式包装 |
| `ReText` | 溢出省略 + tooltip 的文本 |
| `CodeEditor` | 轻量代码编辑器（Groovy 脚本用它，见 [[partners-integration]]） |

图标前缀 `ri/*` 来自 `@iconify/json`，已随依赖安装，**离线可解析**——不要为图标引 CDN。

注意两条不同的解析路径（踩过坑）：`import RiXxx from "~icons/ri/xxx-line"` 是构建期由 `unplugin-icons` 解析成组件，随处可用；而**路由 `meta.icon` 里写的字符串**（如 `ri/route-line`）走 `useRenderIcon` → `IconifyIconOffline`，只有在 `src/components/ReIcon/src/offlineIcon.ts` 里 `addIcon` 注册过才会渲染，否则菜单里是一块空白（不报错）。新增菜单图标必须同步注册，或改用带冒号的在线形式 `ri:route-line`（需联网）。

# 指令

`src/directives/index.ts` 全量导出：`auth` / `perms` / `copy` / `longpress` / `optimize` / `ripple`。`auth` 读路由 meta（`hasAuth`，来自 `@/router/utils`），`perms` 读 user store（`hasPerms`，来自 `@/utils/auth`）——两套口径别混，见 [[skeleton-runtime]]。两者在无权限时都是 `el.parentNode?.removeChild(el)`：元素根本不进 DOM，不要指望靠它做「禁用态」。

# 插件与全局注册

`src/plugins/elementPlus.ts` 按需装 Element Plus 组件与样式；`src/plugins/echarts.ts` 存在但**在 `src/main.ts` 中被注释掉**（未启用，项目当前没有图表页）。`src/main.ts` 另外全局注册 `IconifyIconOffline` / `IconifyIconOnline` / `FontIcon` / `Auth` / `Perms` 组件、`VueTippy`（需直接 import `tippy.js/dist/tippy.css`）、`MotionPlugin`（@vueuse/motion）。`PureDescriptions` 已被注释——**详情类页面不要用 `el-descriptions border` 铺表格**，见视觉不变量。

# 约定

- 新组件放 `src/components/Re<Name>/index.vue`，`defineOptions({ name })` 与目录同名，供 keep-alive 与调试识别。
- 页面私有组件不进这里：留在页面目录的 `components/`。
- 弹窗内样式覆盖一律 `:global(.x)`，`el-dialog` 的节点拿不到 scoped `data-v`。
- 这一层与 [[skeleton-runtime]] 互相依赖（`ReAuth`/`RePerms`/`RePureTableBar` 读骨架的 store 与 utils，`layout` 又用 `ReIcon`/`ReSegmented`/`ReDialog`），不要假设单向依赖。
