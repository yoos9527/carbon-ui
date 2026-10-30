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

- `PartnerItem` 分六组字段：①身份（`name` / `code` / `scope` / 联系人 `contact|phone|email|supportPhone` / `status: 0|1|2` / `cooperateStart|End` / `createTime` / `remark`）②环境与网络（`envs: PartnerEnv[]` / `charset` / `connectTimeout` / `readTimeout` / `useProxy` / `proxyType` / `proxyUrl`）③调用策略（`qps` / `dailyLimit` / `concurrency` / `retryTimes` / `retryInterval` / `breakerThreshold` / `breakerRecoverMin` / `cacheEnabled` / `cacheTtl` / `cacheUnit` / `alarmReceiver`）——**接口「高级配置」里留空的项全部沿用这一组**，两边字段必须同名成对存在（`cacheUnit: "minute"|"hour"|"day"`，缺省分钟）④计费与额度（`billingType: "per_call"|"package"|"yearly"|"free"` / `unitPrice` / `quotaTotal` / `quotaUsed` / `warnThreshold` / `settleType: "monthly"|"prepaid"` / `balance` / `contractNo`）⑤`authConfigs: AuthConfig[]` ⑥`interfaces: PartnerInterfaceItem[]`。
- **缓存三件套**（`cacheEnabled` / `cacheTtl` / `cacheUnit`）必须**详情页可见可改**（调用策略 tab 末行「结果缓存」），不能只躺在数据层——接口页「高级配置」里的「留空沿用合作方」全靠这里配出来。
- **接入环境是列表不是固定两槽**（`PartnerEnv { id, name, code, baseUrl, remark? }`，`envs` 至少一条，第一条视为默认环境）：一个合作方常有 dev / sit / uat / prod 多套地址，所以不再有 `baseUrlProd` / `baseUrlTest` 字段，也不要加回固定字段。`saveEnv()` 校验：至少一条、`name`/`code`/`baseUrl` 非空、`code` 去重（忽略大小写）。新增 `createEmptyEnv()` 返回全空行，`createEmptyPartner()` 预置一条「生产环境 / prod」。
- **环境地址是接口绝对地址的前缀**：`完整调用地址 = envs[0].baseUrl + 接口 path`，由 `resolveInterfaceUrl()` 统一拼接（`getDefaultEnv()` 取第一条环境）。详情页环境列表下方有一行 `.env-linked` 说明「N 个接口会跟着变」；改这里的地址等于改接口的调用地址，所以不要在别处再拼一份。接口本身不存环境 id（一个接口在所有环境都有）。
- `AuthConfig`：`authType: "header" | "script"`。`header` 用 `headers: KV[]`；`script` 用 `scriptLang: "groovy"` + `scriptCode` + `scriptTimeout` + `scriptVersion`，模板见 `groovyScriptTemplate`（`def sign(ctx)`，`ctx` 提供 url/method/headers/query/body/config 与 `lib` 的 md5/sha256/hmacSha256/base64/uuid/timestamp/json，返回 `[headers, query, body]`；抛异常或返回 `[error: "..."]` 即鉴权失败）。
- `PartnerInterfaceItem`：`code`（业务标识，字母/数字/下划线，全局唯一）/ `name` / `path` / `method: GET|POST` / `payloadFormat: json|xml|form` / `preProcessor?: ProcessorType` / `preTemplate?: string` / `preParserId?: number` / `postProcessor?: ProcessorType` / `postTemplate?: string` / `postParserId?: number`（`ProcessorType = "template" | "parser"`：`template` = 接口上写内联模板（`preTemplate` / `postTemplate`），`parser` = 引用 [[parser-library]] 里的解析器（`preParserId` / `postParserId`）；两组字段互斥，切换处理器时另一组的字段写 `undefined`）/ `authId?`（覆盖合作方默认鉴权）/ `params: InterfaceParam[]` / `responses: InterfaceResponseField[]` / `timeout?` / `price` / `dailyLimit?` / `enabled` / `createTime?`（建档时间，新建时 `saveInterfaceForm` 写入）/ `lastCallTime?`（最近一次调用，只用于列表排序与健康度，不展示）。
- **接口的入参/出参是字段定义列表，不是 KV 字典型**：`InterfaceParam { id, name, location: query|body|path|header, type: FieldType, required, desc?, defaultValue? }`、`InterfaceResponseField { id, name, path, type, checkMode?: "value" | "notEmpty", checkValue?, desc? }`（层级用路径表达，如 `data.list[].name`；`checkMode` 是「查得字段」的校验方式：`取值` 必须等于 `checkValue`（如 `200`）、`非空` 只要有值；可多行同时生效，字典见 `checkModeOptions`）。**原来的 `required` / `example` 已删除**（用户明确不要「必返」「示例值」两列），不要再加回来。旧字段 `extraHeaders` / `extraParams` 已删除——header 位置由 `InterfaceParam.location` 覆盖，不要再加回两个 KV 数组。`FieldType` 固定为 `string|int|long|number|boolean|object|array|date`。
- 字典与 label helper（`scopeOptions` / `partnerStatusOptions` / `authTypeOptions` / `methodOptions` / `payloadFormatOptions` / `paramLocationOptions` / `fieldTypeOptions` / `billingTypeOptions` / `settleTypeOptions`、`getAuthTypeLabel` / `getStatusOption`）也在这里，页面不许自己造字符串。
- **处理器的候选只有两档，与报文格式无关**：`TEMPLATE_PROCESSOR_VALUE`（= `"template"`，下拉固定首项，选中后写内联模板）+ 解析器库里的条目。**「不处理」与「内置 Groovy 脚本」两个旧选项已删**（清空下拉就等于不处理），`processorOptions` / `processorOptionsFor` / `normalizeProcessor` 三个 helper 一并废弃——不要再加回来：候选随报文格式变会让同一份配置在改格式后静默失真。
- 接口侧只存引用，不存代码：`preTemplate` / `postTemplate` 在对应处理器不是 `template` 时写 `undefined`，`preParserId` / `postParserId` 在不是 `parser` 时写 `undefined`（`saveInterfaceForm` 负责这个清理），避免「切走了但旧字段还在」导致后端读到两套配置。
- **能力类型（`ProviderType` / `types`）已删除**：它既不能在新增/编辑表单里维护，也和接口清单重复，所以列表列与详情页标签一并去掉。要恢复「服务商能力分类」得重新定义字段，不要直接加回旧的那个。
- `mockPartners` 目前 5 条，刻意覆盖了停用 + 代理、测试中 + 只有测试环境这两种不完整状态，用来喂详情页的空态。

# 列表页

`src/views/service/partners/index.vue`（`defineOptions({name:"ServicePartners"})`，与路由 name 一致）。名称 + 状态两个检索项，`PureTableBar` + `pure-table` 分页每页 10 条，整行点击进详情。

- 名称列负责吃掉剩余宽度，列宽一律 `minWidth` 不用 `width`；操作列 `fixed="right"`（宽 250）。
- 行内操作三个：`编辑`（primary）/ `停用`·`启用`（`status === 1` 时显示危险色「停用」，否则 success 色「启用」，与接口管理页的启用/停用按钮同款）/ `删除`（danger）。停用走 `ElMessageBox` 确认（文案提示「该合作方下的接口将拒绝新的调用请求」），启用不确认；状态切换用 `togglePartnerStatus(id)`（启用 1 ↔ 停用 0，测试中 2 一律落到启用），接后端时只替换该 helper。
- **按钮层级（两个列表页共用，改一处必须同时改另一处）**：工具栏和搜索区**全部用 `plain` 描边按钮**，只有描边颜色区分语义：主操作 = `type="primary" plain`（「新增」、「查询」），危险操作 = `type="danger" plain`（「批量删除」、行内「删除」），其余次要操作 = 裸 `plain`（「导入」「导出」「重置」）。**不要写实底按钮**（`type="primary"` 不加 plain 就是实心蓝，会和描边按钮混在一起，用户已经否过两次），文案也不带宾语——工具栏一律「新增」，不写「新增合作方 / 新增接口」（页面标题已经说明上下文）。行内操作 = `size="small" plain`。批量删除**不置灰**：没勾选时也保持正常危险色，点击后 `ElMessage.warning("请先勾选…")`，置灰的浅粉按钮会和旁边的白底描边按钮对不齐。
- 工具栏顺序：`新增` / `批量删除（N）` / `导入` / `导出`。批量删除的括号里是勾选数，删除确认框列前 3 个名字 + 总数，删完按需回退页码（`dataList` 只剩 1 条且不在第一页时 `currentPage -= 1`）。

## 导入 / 导出（`csv.ts`）

一个合作方一行 CSV（UTF-8 带 BOM，Excel 双击不乱码），列：合作方名称 / 编码 / 联系人 / 联系电话 / 状态 / 合作开始 / 合作结束 / 备注 / 接入环境(JSON)。

- `toCsv(rows)` 导出**当前筛选结果**（不分页）；`toCsvTemplate()` 给带一行示例的模板。
- `planImport(text)` 只解析校验、不落库，返回 `{ plan, created, updated, issues }`，页面先给「将新增 X / 更新 Y / 失败 Z 行 + 行号原因」再放行；表头校验第一列合作方名称、第二列编码。
- 匹配规则：**按「编码」命中就更新档案主字段，没命中就新建**；新建时 `authConfigs: []`、`interfaces: []`（**鉴权与接口不在这一层导入**，接口走接口管理页导入，鉴权在详情页维护）。
- 状态列接受 `启用 / 停用 / 测试中` 或 `1 / 0 / 2`；编码只允许字母数字下划线短横线，同文件内重复判冲突。

- 新增 / 编辑共用一个 `el-dialog`（宽 520px），表单只含入驻信息 `name / code / contact / phone / status`；其余字段靠 `createEmptyPartner()` 兜底。
- 行点击要排除 selection 列（`el-table-column--selection` 判断），否则勾选会误跳。
- **写操作直接改 `mockPartners` 数组**（`unshift` / `Object.assign` / `splice`），刷新即丢——这是「先落 mock、后接后端」的临时形态。

# 详情页

`src/views/service/partners/detail.vue`，路由 `/service/partners/detail/:id`，`watch(() => route.params.id, load, { immediate: true })` 驱动加载。`load()` **深拷贝**命中的合作方到本地 `detail`，表单初值按 tab 各自从 `detail` 取。

左侧是**步骤条**（`el-tabs tab-position="left"` + 自定义 `#label`：`.step` 里一个序号圆点 + 标题，选中态由 `.el-tabs__item.is-active` 带出），三步，**顺序固定**。左右两栏各是一张卡片：`.pd-tabs` 用 `display: grid; grid-template-columns: 208px minmax(0,1fr); gap: 12px; align-items: start` 接管 EP 原本的 float 分栏（`:deep(.el-tabs__header.is-left)` 与 `:deep(.el-tabs__content)` 都要 `float: none`），与接口配置页 `.ix-body` 的 208px + 12px 完全一致，改一处必须两处一起改：

| 步骤 | 名称       | 编辑方式                                                                     | 落地动作                                                 |
| ---- | ---------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | 环境与网络 | 环境行为可增删的输入行（`addEnvRow` / `removeEnvRow`），其余参数就地编辑网格 | `saveEnv()`，至少一个环境且地址不能为空                  |
| 2    | 认证与鉴权 | 沿用鉴权表格，增删改都走 `AuthDialog` 弹窗（不进 `editingTab`）              | `saveAuth()` / `removeAuth()`                            |
| 3    | 高级配置   | 一整页就地编辑（计费 / 流控 / 缓存三小节，布局同接口配置页的「高级配置」）   | `saveAdvanced()`，`quotaUsed ≤ quotaTotal`、开缓存有时长 |

**高级配置的三小节**（`.sec__sub` + `.sec__sub-title` + `grid--4`，与 `src/views/service/interfaces/edit.vue` 的第四步同款）：

- **计费**：计费方式 / 默认单价（元·次）/ 结算周期 / 合同编号 / 账户余额（元）/ 套餐总量 / 已用额度 / 预警阈值（%），只读态还带一条额度进度条（`.meter-wrap`）。
- **流控**：限流（QPS）/ 日调用上限 / 并发数 / 失败重试 / 重试间隔（ms）/ 熔断阈值 / 熔断恢复（分钟）/ 告警接收人。
- **缓存**：结果缓存 = `el-switch` + 时长 + 单位下拉（`.cache` 一行并排，跨整行 `f--wide`），关着时后两者禁用。

**同一时刻只有一步处于编辑态**（`editingTab: "" | "env" | "advanced"`）；调用策略与计费与额度**已合并，不要再拆回两个 tab**（用户明确要求按接口管理的高级配置布局来）。

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
