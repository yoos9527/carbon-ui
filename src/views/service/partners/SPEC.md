---
id: partners-integration
type: module-design
status: draft
title: 合作方接入档案：列表、详情与鉴权/接口配置
parent: carbon-ui-architecture
tags: [business]
---

# 职责

管「一家数据服务商怎么接进来」这份档案：谁能接、走什么网络、怎么被限流、怎么计费、用什么方式鉴权、提供哪些接口。拥有 `src/views/service/partners/`（`data.ts` / `index.vue` / `detail.vue` / `components/`）与它在 `src/router/modules/service.ts` 里的两个路由节点。业务域内唯一的模块。

# 数据契约

全部类型、字典、mock 与 helper 都在 `src/views/service/partners/data.ts`——页面只认这里的 `mockPartners` / `getPartnerById()`，接后端时只换 helper，页面不动。

- `PartnerItem` 分六组字段：①身份（`name` / `code` / `types: ProviderType[]` / `scope` / 联系人 `contact|phone|email|supportPhone` / `status: 0|1|2` / `cooperateStart|End` / `createTime` / `remark`）②环境与网络（`baseUrlProd` / `baseUrlTest` / `charset` / `connectTimeout` / `readTimeout` / `useProxy` / `proxyType` / `proxyUrl`）③调用策略（`qps` / `dailyLimit` / `concurrency` / `retryTimes` / `retryInterval` / `breakerThreshold` / `breakerRecoverMin` / `cacheTtl` / `alarmReceiver`）④计费与额度（`billingType: "per_call"|"package"|"yearly"|"free"` / `unitPrice` / `quotaTotal` / `quotaUsed` / `warnThreshold` / `settleType: "monthly"|"prepaid"` / `balance` / `contractNo`）⑤`authConfigs: AuthConfig[]` ⑥`interfaces: PartnerInterfaceItem[]`。
- `AuthConfig`：`authType: "header" | "script"`。`header` 用 `headers: KV[]`；`script` 用 `scriptLang: "groovy"` + `scriptCode` + `scriptTimeout` + `scriptVersion`，模板见 `groovyScriptTemplate`（`def sign(ctx)`，`ctx` 提供 url/method/headers/query/body/config 与 `lib` 的 md5/sha256/hmacSha256/base64/uuid/timestamp/json，返回 `[headers, query, body]`；抛异常或返回 `[error: "..."]` 即鉴权失败）。
- `PartnerInterfaceItem`：`name` / `path` / `method: GET|POST` / `payloadFormat: json|xml|form` / `authId?`（覆盖合作方默认鉴权）/ `extraHeaders` / `extraParams` / `timeout?` / `price` / `dailyLimit?` / `enabled` / `lastCallTime?`。
- 字典与 label helper（`providerTypeOptions` / `scopeOptions` / `partnerStatusOptions` / `authTypeOptions` / `methodOptions` / `payloadFormatOptions` / `billingTypeOptions` / `settleTypeOptions`、`getAuthTypeLabel` / `getStatusOption` / `getPartnerTypeLabel`）也在这里，页面不许自己造字符串。
- `mockPartners` 目前 5 条，刻意覆盖了停用 + 代理、测试中 + 只有测试环境这两种不完整状态，用来喂详情页的空态。

# 列表页

`src/views/service/partners/index.vue`（`defineOptions({name:"ServicePartners"})`，与路由 name 一致）。名称 + 状态两个检索项，`PureTableBar` + `pure-table` 分页每页 10 条，整行点击进详情。

- 名称列负责吃掉剩余宽度，列宽一律 `minWidth` 不用 `width`；操作列 `fixed="right"` 包 `el-popconfirm` 删除。
- 新增 / 编辑共用一个 `el-dialog`（宽 520px），表单只含入驻信息 `name / code / contact / phone / status`；其余字段靠 `createEmptyPartner()` 兜底。
- 行点击要排除 selection 列（`el-table-column--selection` 判断），否则勾选会误跳。
- **写操作直接改 `mockPartners` 数组**（`unshift` / `Object.assign` / `splice`），刷新即丢——这是「先落 mock、后接后端」的临时形态。

# 详情页

`src/views/service/partners/detail.vue`，路由 `/service/partners/detail/:id`，`watch(() => route.params.id, load, { immediate: true })` 驱动加载。`load()` **深拷贝**命中的合作方到本地 `detail`，表单初值按 tab 各自从 `detail` 取。

四个 tab，**同一时刻只有一个 tab 处于编辑态**（`editingTab: "" | "env" | "strategy" | "billing"`）：

| tab | 编辑方式 | 落地动作 |
| --- | --- | --- |
| 环境与网络 | 就地编辑网格 | `saveEnv()`，`baseUrlProd` 不能为空 |
| 调用策略 | 就地编辑网格 | `saveStrategy()` |
| 计费与额度 | 就地编辑网格 | `saveBilling()`，`quotaUsed` 不能大于 `quotaTotal` |
| 认证与鉴权 | 弹窗列表增删改 | `saveAuth()` / `removeAuth()` |

每个就地编辑的 tab 底部是同一条 sticky `.editbar`（取消 / 保存），保存即 `Object.assign(partner, form)` 后关编辑态。**`ElMessageBox.confirm` 只用于删除类动作**（删除鉴权、删除接口），保存不打二次确认。

**已知缺口**：详情页的保存只改本地 `detail` 副本，不回写 `mockPartners`——离开再进来改动就没了（列表页的编辑是会回写的）。接后端时这一处必须一起改。

# 鉴权配置

`components/PartnerAuthDialog.vue`。切换 `authType` 时表单在「请求头键值对」与「Groovy 脚本」之间整块换掉：

- `header`：`headers: KV[]`，可增删行。
- `script`：代码编辑器 + 运行期上下文说明 + 超时 + 版本号，另有「重置为模板」与「语法校验」（`ElNotification` 提示，纯前端检查）。
- 删除前有引用检查：若该鉴权被任何 `interfaces[].authId` 引用，直接 `ElMessage.warning("该鉴权已被 N 个接口引用，请先调整接口的引用鉴权")` 并中止，不弹确认框。
- 弹窗内容拿不到 scoped `data-v`，覆盖样式必须 `:global()`（见 [[carbon-ui-architecture]]）。

# 接口清单

`components/PartnerInterfaceDialog.vue`：`name` / `path` / `method` / `payloadFormat` / 引用鉴权（`authId`，可选「跟随合作方」）/ 额外请求头与参数 / 覆盖超时与日限 / 单价 / 启用开关。详情页顶部摘要（启用接口数、最近调用时间、剩余额度、额度水位条）从 `interfaces` 数组现算，不额外存字段。

# 边界

- 依赖 [[shared-ui]] 的 `PureTableBar`、`ReIcon` 与 `~icons/*`；不 import 骨架内部实现，只用 `useRouter` / `useRoute`。
- 不进菜单的详情页必须挂在 `src/router/modules/remaining.ts`，不能塞进 `service.ts` 的 `children`——理由见 [[carbon-ui-architecture]] 的不变量 1，那会让列表页静默空白。
- 不做真实请求转发、限流与结算：这些数字是档案里的配置项，执行在别处（未经确认，见 [[carbon-ui-goal]]）。
