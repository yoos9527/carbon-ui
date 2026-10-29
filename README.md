# Carbon UI

基于 [pure-admin-thin](https://github.com/pure-admin/pure-admin-thin)（`vue-pure-admin` 官方精简版）搭建的定制化中后台骨架。

- 上游基线：`pure-admin-thin` v6.2.0，commit `f0ff132`
- 上游同步方式见 [`docs/UPSTREAM.md`](./docs/UPSTREAM.md)
- License：MIT（可商用，保留上游 LICENSE 声明）

## 技术栈

| 项           | 版本                                                   |
| ------------ | ------------------------------------------------------ |
| vue          | ^3.5.22                                                |
| vite         | ^7.1.12                                                |
| vue-router   | ^4.6.3                                                 |
| pinia        | ^3.0.3                                                 |
| element-plus | ^2.11.5                                                |
| tailwindcss  | ^4.1.16                                                |
| typescript   | ^5.9.3                                                 |
| node / pnpm  | `^20.19.0 \|\| >=22.13.0` / `>=9`（仓库自带 `.nvmrc`） |

> 刻意**不跟**完整版 vue-pure-admin 的 vite 8 / TS 6 / vue-router 5 / pinia 4，那边是 Rolldown 新管线，生态与社区资料都还没跟上。

## 启动

```bash
pnpm install
pnpm dev          # 默认 http://localhost:8848
pnpm typecheck    # tsc + vue-tsc
pnpm build        # 产物在 dist/
pnpm lint         # eslint + prettier + stylelint
```

`preinstall` 里锁了 `only-allow pnpm`，用 npm/yarn 装依赖会直接失败。

演示账号（来自 `mock/login.ts`，仅 dev 生效）：`admin` / `admin123`。

## 目录约定

```
src/
  api/            接口层，按业务域一个文件（user.ts、routes.ts 为必需）
  router/
    index.ts      静态路由 + 守卫入口
    utils.ts      initRouter() / handleAsyncRoutes()：动态路由核心
    modules/      静态业务路由（home、error、remaining 等）
  store/modules/  app epTheme multiTags permission settings user
  layout/         框架布局（lay-sidebar / lay-navbar / lay-tag / lay-setting …）
  components/     Re 前缀通用组件（RePureTableBar、ReDialog、ReAuth、ReIcon …）
  views/          页面，目录名与路由 component 对应
  directives/     auth、perms、copy、longpress、optimize、ripple
  utils/http/     PureHttp：axios 封装 + token 注入 + refreshToken 队列
  style/          全局样式，tailwind v4 入口
public/
  platform-config.json  运行期配置（标题、布局、主题色、水印…），改完不用重新打包
mock/             vite-plugin-fake-server，仅 dev 生效
build/            vite 插件、cdn、压缩、optimize 配置
```

## 新增一个页面的标准流程

1. 在 `src/views/<业务>/index.vue` 写页面，组件 `name` 用 PascalCase（keep-alive 依赖它）。
2. 在 `src/router/modules/` 加路由，或在后端菜单接口里下发（推荐后者，见下）。
3. `meta` 常用字段：`title`、`icon`、`rank`（排序）、`roles`（可见角色）、`showLink`、`keepAlive`、`fixedTag`、`hiddenTag`。
4. 按钮级权限用 `v-auth="['permission:key']"` 或 `v-perms`。

## 接后端的 4 个改动点

1. `src/api/routes.ts` — 动态菜单接口（默认 `GET /get-async-routes`）。
2. `src/api/user.ts` — 登录 / 刷新 token / 用户信息，响应结构 `{ code, message, data }`，`data` 需含 `roles[]`、`permissions[]`、`accessToken`、`refreshToken`、`expires`。
3. `src/store/modules/user.ts` — `loginByUsername`，登录后 store 落盘逻辑。
4. `src/utils/http/index.ts` — 请求拦截已注入 `Authorization`；**响应拦截只 `return response.data`，没有统一业务码处理**，业务错误上报要在这里补。

菜单树字段：`path`、`name`、`component`、`parentId`、`meta`。`component` 通过 `import.meta.glob("/src/views/**/*.{vue,tsx}")` 映射，写相对 `views` 的路径即可（不带扩展名）。

后端菜单接口返回示例：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "path": "/system",
      "meta": { "title": "系统管理", "icon": "ep:setting", "rank": 10 },
      "children": [
        {
          "path": "/system/user/index",
          "name": "SystemUser",
          "component": "system/user/index",
          "meta": {
            "title": "用户管理",
            "roles": ["admin"],
            "keepAlive": true,
            "auths": ["system:user:add", "system:user:delete"]
          }
        }
      ]
    }
  ]
}
```

- `roles`：路由级可见性（在 `src/router/utils.ts` 的 `filterNoPermissionTree` 里过滤）。
- `auths`：写入 `meta.auths` 后由 `v-auth` / `v-perms` 消费；另一种来源是登录接口返回的 `permissions[]`。
- `component` 缺省的节点会被当作目录（菜单分组）。

## 上线前必做

- [ ] 关掉/剥离 `mock/`（dev 专属，但部分演示页会直连 mock 路径）
- [ ] `.env.production` 确认 `VITE_ROUTER_HISTORY`（hash ↔ h5 需服务端 fallback）、`VITE_CDN`、`VITE_COMPRESSION`
- [ ] 注意 `build/plugins.ts` 里 `vitePluginFakeServer` 的 `enableProd` 已被改为 `false`（上游默认 `true`，会把 mock 打进生产包），若有人改回去需重新审。
- [ ] `public/platform-config.json` 改 `Title`、`EpThemeColor`、`Locale` 等
- [ ] 权限变更后清 localStorage 的 `async-routes`（当 `CachingAsyncRoutes: true` 时菜单会被缓存）
