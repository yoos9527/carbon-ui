# 上游基线与同步

## 基线

| 项       | 值                                            |
| -------- | --------------------------------------------- |
| 仓库     | https://github.com/pure-admin/pure-admin-thin |
| 版本     | v6.2.0                                        |
| commit   | `f0ff132` (`release: update 6.2.0`)           |
| 分支     | 主分支（非国际化版本）                        |
| 引入方式 | 整目录复制，已剥离上游 `.git`                 |

完整版仓库（`vue-pure-admin`）只作为**组件/页面源码取用库**，不作为本项目的合并来源——它比精简版多 80+ 运行时依赖和 20+ 演示目录。

## 同步上游的正确姿势

本仓库已做品牌化改动（`package.json` name/version、`index.html` title、`public/platform-config.json`），直接 merge 上游会冲突。推荐做法：

```bash
# 1. 加一次性远端
git remote add upstream https://github.com/pure-admin/pure-admin-thin.git

# 2. 只取指定版本，看差异
git fetch --depth 1 upstream main
git diff --stat HEAD $(git rev-parse FETCH_HEAD) -- src/ build/ types/

# 3. 优先挑 src/components/、src/utils/、src/layout/ 的改动手工摘
#    业务目录（src/views、src/api、src/router/modules、mock/）不要整块覆盖
```

## 已做的定制改动（与上游 f0ff132 的差异）

品牌化：

- `package.json`：`name` → `carbon-ui`，`version` → `0.1.0`，`author`/`keywords` 替换，移除了指向上游的 `homepage`/`repository`/`bugs`。
- `index.html`：`<title>` → `Carbon UI`。
- `public/platform-config.json`：`Version` → `0.1.0`，`Title` → `Carbon UI`。
- `src/layout/components/lay-footer/index.vue`：页脚链接从 `github.com/pure-admin` 改为占位 `github.com`。
- `src/utils/localforage/index.ts:11`：IndexedDB 库名 `pure-admin` → `carbon-ui`。
- `README.md` 整体重写，上游 README 保留为 `README.en-US.md`。

修复（上游在 pnpm 12 / 当前依赖版本下的问题）：

- **`pnpm-workspace.yaml` 新增**：上游把 pnpm 配置写在 `package.json` 的 `pnpm` 字段和 `.npmrc` 里，pnpm 12 已不再读取，导致 `esbuild` 等依赖的 postinstall 被跳过、`vite` 无法启动。已迁移为 `allowBuilds` / `shamefullyHoist` / `shellEmulator` / `strictPeerDependencies` 等新写法。
- **`build/cdn.ts`**：移除 `vue-demi`、`pinia` 两个 CDN module。`pinia@3` 不再依赖 `vue-demi`，`vite-plugin-cdn-import` 在加载配置时会读取每个 module 的 `package.json`，缺包直接抛 `vue-demi package.json file does not exist`，导致 `pnpm build` 直接失败（上游 v7 也是这么处理的）。
- **`build/plugins.ts`**：`vitePluginFakeServer({ enableProd: true })` → `false`。上游默认把 mock 打进生产包，属于安全问题。
- **`package.json` scripts**：`dev`/`build` 去掉 `NODE_OPTIONS=--max-old-space-size=...` 前缀（在 Windows cmd 下未生效并导致 `'NODE_OPTIONS' 不是内部或外部命令`）。
- **新增依赖**：`tippy.js@^6.3.7`（`src/main.ts` 直接 `import "tippy.js/dist/tippy.css"`，但它只是 `vue-tippy` 的传递依赖，非扁平结构下解析不到）。
