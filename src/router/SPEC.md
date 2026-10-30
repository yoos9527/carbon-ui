---
id: skeleton-runtime
type: module-design
status: draft
title: 骨架运行时：路由装配、框架外壳与会话
parent: carbon-ui-architecture
tags: [framework]
---

# 职责

页面之外的一切：身份怎么来、菜单怎么装配、进来之后看到什么壳子。规格放在 `src/router/` 是为了让改路由的人先读到它，但它拥有的是整块骨架——`src/router`、`src/layout`、`src/store`（`app` / `settings` / `epTheme` / `multiTags` / `permission` / `user`）、`src/utils/auth.ts`、`src/utils/http`、`src/api`、`src/views/login`。它与外壳、会话三方互相 import 成环，所以是一块而非三块（见 [[carbon-ui-architecture]]）。

# 路由装配

静态菜单写 `src/router/modules/<模块>.ts`（`export default {...} satisfies RouteConfigsTable`，`meta.title` 必填，否则 TS2741），`src/router/index.ts` 用 `import.meta.glob(["./modules/**/*.ts", "!./modules/**/remaining.ts"])` 全量收进来，`remaining.ts` 单独 import。

两条产物走两条路，别混：

- **路由表** `constantRoutes`：`ascending`（按 `meta.rank` 升序，无 rank 的自动补 index+2，首页恒在首位）→ `buildHierarchyTree` → `formatFlatteningRoutes` → `formatTwoStageRoutes`。
- **菜单** `constantMenus`：`ascending(routes.flat(Infinity))` 后直接 `concat(...remainingRouter)`，保持原始层级。

`resetRouter()` 清空全部路由再按初始快照重挂，并清 `cachePageList` 与已加载路径集合。

# 全局守卫

`whiteList = ["/login"]`。已登录时：`meta.roles` 与 localStorage `user-info` 的 `roles` 无交集 → `/error/403`；`VITE_HIDE_HOME === "true"` 时手敲 `/welcome` → `/error/404`；`wholeMenus` 为空（首次进入或刷新）→ `initRouter()` 拉动态路由，并在动态路由就位后重推一次 `to.fullPath`。未登录且不在白名单 → `removeToken()` 后跳登录。`document.title` 用 `platform-config.json` 的 `Title` 与命中路由的 `meta.title` 拼接。

动态路由：`addAsyncRoutes` 把后端返回的 `component` 字符串映射进 `import.meta.glob("/src/views/**/*.{vue,tsx}")`，缺 `component` 时按 `path` 匹配；父级自动补 `redirect`（首个子路由）与 `name + "Parent"`（防与子级重名导致重定向 404）。当前后端返回空数组。

# 外壳与外观

布局三形态（vertical / horizontal / mix）在 `src/layout/index.vue` 组装：侧栏、顶栏、标签页、内容区、页脚、设置面板、全局搜索、通知。外观初值来自 `public/platform-config.json`（`Layout`、`Theme`、`EpThemeColor`、`ShowLogo`、`MenuSearchHistory`…），运行期改动落 localStorage，命名空间 `responsive-`。

标签页与 keep-alive 由 `usePermissionStoreHook().cachePageList` 驱动：进入带 `meta.keepAlive` 的页面时 `handleAliveRoute(to, "add")`，刷新标签时先 delete 再延时 add。`MultiTagsCache` 打开时标签页存进 localStorage 的 `responsive-tags`（开关记在 `responsive-configure`）。`CachingAsyncRoutes` 打开时动态路由缓存到 `async-routes`——两者都是权限变更后需要手工清的残留。

# 会话与请求

- `src/utils/auth.ts`：`authorized-token` cookie 存 `{accessToken, expires, refreshToken}`（按 `expires` 算 cookie 过期时间，到期自动销毁）；`user-info` localStorage 存 `avatar/username/nickname/roles/permissions`；`multiple-tabs` cookie 标记「浏览器还开着」，勾了免登录就存 `loginDay` 天。`formatToken` 固定加 `Bearer ` 前缀。
- `src/utils/http/index.ts` 的 `PureHttp`：请求白名单 `/login`、`/refresh-token` 不注入 token；`expires` 已过期时只允许一个刷新在飞（`isRefreshing`），其余请求压进 `requests` 队列，新 token 到了再回填重放。
- 响应拦截**只 `return response.data`**，没有统一业务码处理——`code` / `message` 由调用方自己判。这是当前已知缺口，接后端时要在这里补。
- 登出（`user` store 的 `logOut`）：清用户态、清 cookie 与 localStorage、`resetRouter()`、标签页重置为 `routerArrays`、跳 `/login`。

# 边界

- 不拥有业务页面（`src/views/service/**` 由 [[partners-integration]] 拥有）；骨架只负责把页面挂进布局。
- 不拥有通用组件（[[shared-ui]]）；`layout` 会消费 `ReIcon` / `ReSegmented` / `ReDialog`。
- 不做真实鉴权：登录与刷新 token 由 dev 期 mock（`mock/login.ts`、`mock/refreshToken.ts`）应答，见 [[build-pipeline]]。
- 角色与权限有两套口径，别混：路由级 `meta.auths` 走 `hasAuth()`（读当前路由 meta），按钮级 `permissions[]` 走 `hasPerms()`（读 user store）。
