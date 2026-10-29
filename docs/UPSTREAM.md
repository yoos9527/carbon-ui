# 上游基线与同步

## 基线

| 项 | 值 |
| --- | --- |
| 仓库 | https://github.com/pure-admin/pure-admin-thin |
| 版本 | v6.2.0 |
| commit | `f0ff132` (`release: update 6.2.0`) |
| 分支 | 主分支（非国际化版本） |
| 引入方式 | 整目录复制，已剥离上游 `.git` |

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

## 已知需要复查的定制点

- `package.json`：name / version / author / keywords 已改，`homepage`、`repository`、`bugs` 已移除（加回自己的远端后补上）。
- `index.html`：`<title>` 改为 `Carbon UI`。
- `public/platform-config.json`：`Version` → `0.1.0`，`Title` → `Carbon UI`。
- `README.md` 已整体重写，上游 README 内容见 `README.en-US.md`（保留未改）。
