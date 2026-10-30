---
id: interface-config
type: module-design
status: draft
title: 接口管理：合作方接口的实际调用配置
parent: carbon-ui-architecture
tags:
  - business
depends-on:
  - partners-integration
---

# 职责

管「一个具体接口怎么被调」：标识、路径、方法、报文格式、绑哪个鉴权、入参/出参契约、超时、单价、日上限、是否启用。

这页**不拥有数据**：接口挂在合作方的 `PartnerItem.interfaces[]` 上（见 [[partners-integration]]），本模块只做「跨合作方拍平 + 配置回写」。所以它和合作方详情页的「接口清单」是同一份数据的两个视角，任何写操作都会同时反映到对方。

拥有 `src/views/service/interfaces/`（`data.ts` / `index.vue` / `edit.vue`）与两处路由：`src/router/modules/service.ts` 的 `/service/interfaces`（菜单）、`src/router/modules/remaining.ts` 的 `/service/interfaces/edit/:id`（不在菜单）。

# 与 partners-integration 的边界

| 归 partners-integration                                                  | 归本模块                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 合作方档案本身、环境地址（`envs`）、限流/重试/熔断、计费方式与额度、合同 | 单个接口的 `code` / `path` / `method` / `payloadFormat` / `preProcessor` / `postProcessor` / `authId` / `timeout` / `price` / `dailyLimit` / `enabled` / `params` / `responses` |
| 鉴权配置的**定义**（`authConfigs`，Groovy 脚本编辑器）                   | 鉴权配置的**绑定**（只能选该合作方已定义的，不能在这里新建）                                                                                                                    |
| 在详情页里增删接口                                                       | 调调用配置、改入参/出参、新建接口（新建时先选合作方）、删除接口                                                                                                                 |

这是**软边界**：两处写的是同一个 `PartnerInterfaceItem` 对象，字段集合完全一致，只是入口不同。接后端时两边应是同一批接口端点。

# 数据契约

`src/views/service/interfaces/data.ts` 全部是纯函数 helper，页面不直接碰 `mockPartners`：

- `InterfaceRow extends PartnerInterfaceItem` + `partnerId` / `partnerName` / `partnerCode` / `partnerStatus` / `auth?`（已解析好的鉴权配置，避免模板里 `find`）。
- `getInterfaceRows()`：拍平所有合作方的接口，排序 **启用优先 → `lastCallTime` 倒序**（没有调用记录的排在后面）。`getInterfaceRowById(id)` 供编辑页按路由参数取行；`deleteInterface(id)` 遍历所有合作方的 `interfaces` 摘掉该条，删除入口在列表操作列（带确认弹窗，因为已对接的调用会 404）。
- `getPartnerOptions()` / `getAuthOptions(partnerId)` / `getPartnerById(id)`：下拉与提示用的只读视图。
- `formSteps`：四步定义（基本信息 / 请求入参 / 响应出参 / 高级配置），页面标题与步骤条都从这里取，不要在模板里另写一份。
- `toForm(row)` / `createForm(partnerId)`：行 → `InterfaceForm`（`params` / `responses` 逐项深拷贝，避免编辑时污染原数据）；两个处理器缺省落 `TEMPLATE_PROCESSOR_VALUE`（= 模板解析器），`preTemplate` / `postTemplate` 初始为空串、`preParserId` / `postParserId` 为 `undefined`；`createForm` 的新 `id` 由 `nextId()` 预先分配，新建保存时靠这个 id 判断是该插入还是更新。
- `isCodeTaken(code, selfId?)`：标识查重，大小写不敏感，编辑时用 `selfId` 排除自身。
- `validateStep(step, form)` / `validateAll(form)`：返回 `FormError | null`，`FormError` 带 **第几步（1–6）+ 字段名（标量字段）或行下标+列（入参 / 出参表）**，供页面停在出错步并高亮那一格。规则见下节。
- `saveInterfaceForm(form)`：trim 后写回 `mockPartners` 对应接口对象；合作方不存在返回 `false`，`partner.interfaces` 里没有 `form.id` 则插入一条新接口再写回。全空的行会被丢弃，`undefined` 的 `timeout` / `dailyLimit` 原样写回（表示继承合作方默认值）。
- `toggleInterface(partnerId, id)`：列表里的启用/停用。
- `getCallHealth(row)` / `formatPrice()` / `formatLimit()`：**纯展示派生值，不落数据**。`formatPrice(0)` 输出「免费」而不是 `¥0`；`formatLimit(undefined)` 输出「不限」。

表单值里的 `partnerId` 与 `id` 是从行带过来的只读标识，编辑页据此定位写回目标——不要改成按名称或标识查找。

## 与「接入环境」的联动（必须保持）

接口只存**相对路径** `path`，绝对地址在渲染时拼：`完整地址 = 合作方 envs[0].baseUrl + path`。

- 拼接规则只有一个实现：`resolveInterfaceUrl(baseUrl, path)`（`src/views/service/partners/data.ts`，去环境地址尾部斜杠、给路径补前导斜杠，环境地址为空时返回空串）。**页面里不要自己拼字符串。**
- 默认环境固定取第一条（`envs[0]`）：`getDefaultEnv(partner)`。
- 接口**不绑定环境**：一个接口在所有环境都存在，切环境是换 baseUrl。不要给 `PartnerInterfaceItem` 加 `envId`——那样每个接口要配 N 份。
- 列表页「请求地址」列副行 `.ep__url` 显示完整地址，复制按钮复制的也是完整地址（无环境地址时退回 `path`）。
- 配置页第一步的环境下拉只是**预览**，不落库（`previewEnvId` 是本地 ref）。

## 校验规则（基础档）

只卡住会让数据变成垃圾的项，类型/默认值/说明一律不强制：

| 步骤       | 规则                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 基本信息 | 名称非空；接口标识非空、仅 `[A-Za-z0-9_]`、全局唯一；请求路径非空且以 `/` 开头；单价 ≥ 0；处理器选了「解析器」时必须选中具体条目（`preParserId` / `postParserId` 非空） |
| 2 请求入参 | 前置处理器为 `模板解析器` 时解析模板非空（选「解析器」不校验模板，代码在解析器库里）；非空行的参数名非空，且同表内不重名（忽略大小写）                                  |
| 3 响应出参 | 后置处理器为 `模板解析器` 时响应映射模板非空；非空行的路径非空、格式合法（`data.list[].name`）、同表内不重复                                                            |

`isEmptyParam` / `isEmptyResponse` 判定「这一行是不是空行」：名称、说明、默认值都为空且仍是默认值（`location=query`、`type=string`、`required=false`）才算空行，保存时丢弃、校验时跳过。

# 列表页

`src/views/service/interfaces/index.vue`，`defineOptions({ name: "ServiceInterfaces" })` 必须与路由 name 一致（keepAlive）。

- 查询：关键字（接口名 / 路径 / 合作方名，不区分大小写）、合作方下拉（`filterable`）、启用状态。
- 列（顺序即展示顺序）：`selection`（多选，`fixed: left`）、接口名称、**接口标识 `code`（独占一列，等宽）**、请求地址（方法徽标 + 等宽路径）、所属合作方（名称 + 等宽小字编码）、单价、日上限、状态、**创建时间 `createTime`**、操作。全列用 `minWidth`，不写死 `width`（操作列固定 240）。**报文格式与鉴权绑定不在列表显示**（用户要求精简，需要时在配置页看）；`lastCallTime` 仍保留在模型里（排序 + 健康度）但列表不展示——列表展示的是建档时间 `createTime`。
- 接口名称、接口标识、请求地址后缀一个 `.copy` 复制按钮（`copyTextToClipboard`，平时 `opacity: 0`，行悬停显形），`@click.stop` 防止触发整行跳转。
- 工具条标题带概览：「共 N 个 · 启用 X · 停用 Y」，数字从 `getInterfaceRows()` 现算，不写死。
- 状态用 `.dot` 圆点（正常绿 / 从未调用琥珀 / 停用灰），**不用 `el-tag`**——与详情页视觉一致。
- 整行点击 = `router.push(\`/service/interfaces/edit/${row.id}\`)`；操作列「配置」同效，「启用/停用」走二次确认（停用需 `ElMessageBox.confirm`）。
- `handleRowClick(row, column)` 遇到 `column.type === "selection"` 直接 return，否则勾选会误跳转。
- 工具条按钮顺序：`新增` / `批量删除（N）` / `导入` / `导出`，样式遵循 `src/views/service/partners/SPEC.md` 的「按钮层级」（全部 `plain` 描边，只有描边色区分语义，改一处必须同时改另一处）。批量删除不置灰，未勾选时点击提示「请先勾选要删除的接口」；确认文案列出前 3 个名字 + 总数，走 `deleteInterfaces(ids)` 返回实际条数。
- 分页是前端内存切片：`getInterfaceRows()` 全量 → 过滤 → `slice`，`pagination.total` 取过滤后长度。

## 导入 / 导出（`csv.ts`）

一个接口一行 CSV（UTF-8 带 BOM，Excel 双击不乱码），入参/出参各占一列放 JSON 数组——不把一个接口拆成 N 行。

- `CSV_HEADERS` / `toCsv(rows)` / `toCsvTemplate()`：导出**当前筛选结果**（不分页），模板带一行示例。
- `planImport(text)`：只解析 + 校验、不落库，返回 `{ plan, created, updated, issues }`；`issues` 带文件行号，页面先在对话框里给出「将新增 X / 更新 Y / 失败 Z 行 + 原因」再放行。表头必须匹配（第一列「合作方编码」、第四列「接口标识」），防止传错文件。
- 匹配规则：**（合作方编码 + 接口标识）命中则更新，没命中则新增**；同一文件内同键重复判为冲突行。
- `applyImport(plan)`：命中的 `Object.assign`，没命中的 push 到 `partner.interfaces`（`{...createEmptyInterface(), ...patch}`）。
- 解析器是手写的最小 CSV（支持 `"` 包裹、`""` 转义、单元格内换行），**别引 papaparse**——只为一张表加依赖不值。

# 配置页（分步表单）

`src/views/service/interfaces/edit.vue`，`defineOptions({ name: "ServiceInterfaceEdit" })`。**整页**，不是抽屉：四步的信息量（两张可编辑表 + 一整组高级配置）放不进 620px 侧滑。

## 形状

- 左侧步骤导航（`.ix-steps`，`position: sticky`）+ 右侧面板（`.ix-panel`）。`goto(target)` 四步都点得动，**切步不校验**：只清掉上一次的报错高亮（`error.value = null`）再切，`next()` 同理只 `+1`。**校验只在保存时跑**（`submit()` → `validateAll()`），不通过就跳到 `result.step` 并高亮那一格。不要退回「切步时校验」——填表途中被拦体验很差；也不要退回「只能回看」——用户点左栏没反应会当成 bug。
- 面板底部 sticky `.ix-actions`：上一步 / 当前错误提示 / 下一步（最后一步是「保存」）。
- 顶部 `.ix-head`：返回、接口名称、`code`、所属合作方、启用圆点、取消 / 保存。**保存始终可用**（不等走到最后一步），走 `validateAll` 并自动跳到出错步。
- 中途关闭什么都不留下：`form` 是 `toForm(row)` 的深拷贝，只有 `saveInterfaceForm` 才落库。**不要加草稿/自动保存**。

## 四步内容

1. **基本信息**：接口名称、接口标识 `code`（等宽；重名实时红字，不等点保存）、请求方法、报文格式、请求路径（等宽；这一格沿用「环境下拉 + 路径输入框」同行的 `.f__row` 结构，下拉只是预览用，下方小字给出拼好的完整地址，见下）、前置处理器 / 后置处理器（同一套候选，**与报文格式无关**：`模板解析器`（默认，写内联模板）+「解析器库」分组里的条目，见 [[parser-library]]；下拉值经 `prePicker` / `postPicker` 两个 computed 映射成 `template` / `parser:<id>`，选中解析器时同步写 `preParserId` / `postParserId`）、鉴权绑定（可清空 = 不额外加签，选中后下方一行小字说明落点：公共请求头 N 项 / Groovy 脚本与超时）。布局是 4 列网格：方法、报文各 1/4，路径占半行，前置 / 后置处理器各 1/4，**鉴权绑定 `f--2` 刚好填满这一行剩下的半行**（不要改回 `f--4` 独占一行，那样会空出两格）。

   **所属合作方不在表单里出现**——合作方由列表页「新增接口」时选定、经 query 的 `partnerId` 带入，只在页面顶部标题区显示名称 + 编码。用户明确要求删掉这个只读字段，不要加回来。

2. **请求入参**：当前置处理器为 `模板解析器` 时，表格上方先出「解析模板」区块（`CodeEditor` 组件、`height="200px"`、固定暗色，绑 `form.preTemplate`），`validateStep(2)` 强制非空（否则入参无从映射）；选「解析器」时同一位置**不再出现编辑框**，只给一行引用摘要（`.tmpl--ref .ref`：`引用的前置解析器` + 名称 + 等宽标识 + `v{版本}` + 右侧「查看代码」），代码默认收起、点开才渲染只读 `CodeEditor`（`showPreCode`）；代码本体只在解析器库改。**不要恢复成常驻代码窗口**——用户会误以为还在用模板解析器。下面是参数表（`el-table` 行内编辑）：参数名列、位置（`query|body|path|header`）、类型、必填 `el-switch`、**默认值**、说明、删除（默认值排在说明前面）。下方「添加行」。

3. **响应出参**：当后置处理器为 `模板解析器` 时，表格上方先出「响应映射模板」区块（形状与解析模板一致，绑 `form.postTemplate`，键名对应出参字段名、占位符写成 `${resp.路径}`），`validateStep(3)` 强制非空；选「解析器」时同样只给一行引用摘要 + 可展开的只读代码块（`showPostCode`）。下面是出参表（同形状）：字段名、类型、**路径**、**查得字段**、说明、删除。层级靠路径表达（`data.list[].name`），**不做树形行、不做粘贴 JSON 解析**。

出参的「查得字段」列（表头带 `?` 说明气泡）= **勾选框 + 校验方式下拉 + 条件出现的期望值输入框**：勾上后下拉选 `取值`（返回值必须等于期望值，如 `200`）或 `非空`（只要有值就行），选 `取值` 时才出现输入框；取消勾选整格清空（`toggleCheck`）。**允许多行勾选，全部满足才算成功**（不要改回单选）。`validateStep(3)` 只要求「选了 `取值` 就必须填期望值」（`column: "checkValue"`）。原来的「是否必返」「示例值」两列已删除，字段定义只留 `checkMode` / `checkValue` + `checkModeOptions`。

4. **高级配置**：三个小节（`.sec__sub` + `.sec__sub-title`，小节之间 `border-top: 1px dashed var(--line-soft)`）——**计费**（单价 元/次、日上限 次/天、超时 毫秒、启用状态）、**流控**（QPS 次/秒、并发、失败重试、重试间隔、熔断失败阈值、熔断恢复 分钟）、**缓存**（`* 缓存设置`：`el-switch active-text="开启"` + 数值 160px + 单位下拉 110px，三控件 `.cache` 一行并排，关着时数值与单位禁用）。**用户要求这三块合成一页**，不要再拆回三个步骤。

   **留空 = 沿用合作方配置**，占位符直接显示合作方当前值（`fallback` computed 从 `partner` 取，见下表）；缓存开关没有 null 态，关 = 不缓存，合作方默认值用下方 `.f__tip` 文案说明（`合作方默认：开启 · 10 分钟` / `合作方默认：不缓存`）。

   `validateStep(4)`：单价 / 日上限 / 流控六项非负，超时 > 0；填了重试次数必须有间隔；缓存开着必须填且 > 0（`:min="1"`）。

   兜底关系要**两边同时存在**，少一个「留空沿用」就是假的：

   | 接口字段                                                                                          | 合作方字段 `PartnerItem`                                                                                             |
   | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
   | `dailyLimit`                                                                                      | `dailyLimit`                                                                                                         |
   | `timeout`                                                                                         | `readTimeout`                                                                                                        |
   | `qps` / `concurrency` / `retryTimes` / `retryInterval` / `breakerThreshold` / `breakerRecoverMin` | 同名                                                                                                                 |
   | `cacheEnabled` / `cacheTtl` / `cacheUnit`                                                         | 同名（`CacheUnit = "minute" ｜ "hour" ｜ "day"`，`cacheUnitOptions` = 分钟 / 小时 / 天，`getCacheUnitLabel` 取文案） |
   | `price`                                                                                           | 无（接口自有，0 表示免费，不要写成「沿用合作方」）                                                                   |
   | `enabled`                                                                                         | 无（接口自有开关）                                                                                                   |

步骤条副标题见 `edit.vue` 的 `stepHints`（当前 / 入参个数 / 出参个数 / 计费·流控·缓存摘要），改步骤数时它和 `formSteps`、`validateStep` 的分支、`v-show="step === N"`、`templateError`/`responseTemplateError` 的步骤号要一起改——本轮把计费 / 流控 / 缓存并回第 4 步「高级配置」就是这几处联动。

## 视觉约束

根容器 `.ix` 复刻详情页的变量系统（`--ink/--ink-2/--muted/--line/--line-soft/--surface` + `--mix` / `--mix-ink` / `--wash` / `--hover`），并补一块 `html.dark .ix` 覆盖。`color-mix()` 一律掺 `--mix` 而不是 `#fff`，否则暗色下会发白。

出错只给控件描红（`.f.is-error :deep(.el-input__wrapper)` / `.cell-input.is-error`），不整块跳红，也不弹表单级红框；代码编辑器出错只改 `.cm-editor` 的边框色（`.tmpl__editor.is-error`）。

代码编辑器一律用 `@/components/CodeEditor`（CodeMirror + Groovy 流式高亮），**固定暗色、不跟站点亮/暗主题**：代码块在亮色页面里也是一块深色面板。不要再退回 `el-input type="textarea"` 自绘浅底代码框。

# 路由与图标

- 菜单：`src/router/modules/service.ts` 里 `/service` 的第二个子路由，`meta: { icon: "ri/route-line", title: "接口管理", showParent: true }`（`showParent` 见 [[skeleton-runtime]] 的二级菜单展开规则）。
- 配置页：`src/router/modules/remaining.ts`，父级 `/service/interfaces/edit`（`component: Layout`，title「接口管理」）+ 子级 `/service/interfaces/edit/:id`（name `ServiceInterfaceEdit`，title「调用配置」）。**必须放 remaining.ts**：塞进业务模块的 `children` 会被 `buildHierarchyTree` 按 path 前缀挂成三级，进而吃掉 `/service/interfaces` 这层，列表页空白且不报错。父子 title 也必须不同，否则面包屑会剔除父级。

`ri/route-line` 这类 `meta.icon` 字符串必须在 `src/components/ReIcon/src/offlineIcon.ts` 里 `addIcon` 注册过才会渲染，否则是空白（不报错）——见 [[shared-ui]]。

# 边界

- 页面标题是「接口管理」，不叫「接口清单」：清单是详情页里的只读视角，这里是配置入口。
- 不做调用日志 / 成功率 / 流量曲线：这些是观测能力，没有数据源，不要在列表里造字段。
- 导入只认 CSV（Excel 另存为 CSV 即可），**不做 xlsx 解析**（要引 SheetJS）；也**不做多 sheet 导出**。
- 新建入口在列表页：**先选合作方 → 进分步表单**，新建出来的接口仍然挂在 `PartnerItem.interfaces` 下（`saveInterfaceForm` 找不到 `form.id` 就当场 push）。不要做成「不选合作方也能建」的悬浮接口。
- 不在此页新建**鉴权配置**、也不改环境地址——越界会破坏「合作方档案是唯一事实来源」（鉴权只能选该合作方已定义的）。
- 解析模板 / 响应映射模板的**代码仓库**是 [[parser-library]]：本页只负责「引用哪个解析器」，不做解析器的增删改；接口里存的是 `preParserId` / `postParserId`，不复制代码。
- 入参/出参只是**字段定义**，不做取值映射与转换；入参的**默认值**是唯一带校验的一列——留空放行，填了必须符合该行的 `type`（`defaultValueError()`：int/long 整数、number 数字、boolean `true|false`、date `YYYY-MM-DD[ HH:mm[:ss]]`、object/array 要求能 `JSON.parse` 且形状匹配），出错停在第二步入参表并描红那一格；也不做「请求/响应示例报文」全文编辑。
