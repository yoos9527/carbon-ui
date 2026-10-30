---
id: parser-library
type: module-design
status: draft
title: 解析器库：接口进出的 Groovy 解析模板
parent: carbon-ui-architecture
tags:
  - business
depends-on:
  - interface-config
---

# 职责

管「接口发出去之前怎么把报文拼出来、回来之后怎么把响应读出来」的那段代码：一个解析器 = 一段 Groovy（入口固定 `def parse(ctx)`）+ 类型（前置 / 后置）+ 标识 + 超时 + 启停 + 版本历史。

**全局共享，不挂合作方**：一个解析器可以被任意合作方的任意接口引用，所以它是「报文差异怎么抹平」的唯一事实来源。接口那边只存 `preParserId` / `postParserId`（见 [[interface-config]]），不复制代码——改这里，所有引用它的接口一起生效。

拥有 `src/views/service/parsers/`（`data.ts` / `index.vue` / `components/ParserDrawer.vue`）与菜单路由 `/service/parsers`。

# 为什么单独做一个模块

接口配置里原来的「前置处理器 / 后置处理器」只有三个死值（不处理 / Groovy / 模板解析器），模板直接内联在接口上：同一个合作方的 10 个接口要抄 10 份一模一样的映射代码，改一次漏三处。拆出来后：代码只有一份、可以按标识引用、可以看历史版本、删之前能查到谁在用。

# 数据契约

`src/views/service/parsers/data.ts`（纯函数 + 内存 mock，页面不直接碰数组）：

- `ParserKind = "pre" | "post"`（前置 / 后置），`parserKindOptions` / `getParserKindLabel(kind)` 是唯一文案来源。
- `ParserItem`：`{ id, code, name, kind, desc?, scriptCode, scriptTimeout, scriptVersion, versions: ParserVersion[], enabled, createTime, updateTime }`。
  - `code` 是业务标识（`[A-Za-z0-9_]`、全局唯一、大小写不敏感查重），`id` 只是内部主键，不在表单上编辑。
  - `scriptVersion` 是**当前版本号**，`versions` 是历史快照（最多 10 份）——两者成对，别只改一个。
- `groovyPreTemplate` / `groovyPostTemplate`：新建时的初始代码，`createEmptyParser(kind)` 直接取用。约定 `ctx.payload`（原始请求报文）与 `ctx.params`（当前入参）给前置用，`ctx.response`（网关原始响应）与 `ctx.fields`（出参定义）给后置用。
- `mockParsers`：10 条种子数据（id 5001–5010，每个合作方一前一后），`BD_GEO_POST` 故意置为停用，`ZK_ENT_PRE` 带一条历史版本，用来演示「引用计数 / 停用提示 / 版本回滚」三个交互。
- 查询：`getParserById(id?)`、`getParsersByKind(kind)`（列表用，含停用）、`listUsableParsers(kind)`（**接口表单下拉用，只给启用中的**——停用的引用出来也跑不了）。
- 引用：`findParserRefs(parserId)` / `countParserRefs(parserId)` 扫 `mockPartners` 里所有接口的 `preParserId` / `postParserId`，返回「合作方 / 接口」明细。
- 写操作：`toggleParser(id)`、`saveParserForm(form)`、`deleteParsers(ids): { deleted, blocked }`。

## 保存与版本

`saveParserForm` 在**代码有变化**时把旧代码压进 `versions`（`{ version: 旧 scriptVersion, code: 旧代码, time: 旧 updateTime }`）、`scriptVersion += 1`、`slice(0, 10)`，然后才写入新代码。所以：

- `versions` 存的是**历史**，当前代码永远在 `scriptCode` 上，不要在 `versions` 里再放一份当前代码。
- 回滚只是把某个历史版本**载入编辑器**（`rollback(item)`），点保存才落库——否则用户点两下就把线上代码改了。

## 删除必须让路

`deleteParsers(ids)` 对每个 id 先 `findParserRefs`：有引用就跳过并塞进 `blocked`，没引用才真的 `splice`。页面把 `blocked` 拼成「X 正被『合作方 A / 接口 B』等 N 个接口引用，请先在接口里换掉引用」提示（`duration: 6000`）。**不要改成级联删除或静默置空接口的 parserId**——那会让接口悄悄变成「不处理」，线上报文直接错。

# 列表页

`src/views/service/parsers/index.vue`，`defineOptions({ name: "ServiceParsers" })` 必须与路由 name 一致（keepAlive）。

- 查询：关键字（名称 / 标识 / 说明）、类型（前置 / 后置）、启用状态。
- 列：`selection`（fixed left）、解析器名称（名称 + 等宽标识 + 一行灰字说明，三行堆叠）、类型（`el-tag` plain，前置 primary / 后置 success）、版本（`v{n}` + 「留 N 版」）、状态（`.dot` 圆点，启用绿 / 停用灰）、更新时间、操作（编辑 / 停用启用 / 删除）。**不在列表展示关联接口数**（用户要求精简；引用明细只在停用确认与删除拦截时按需查 `findParserRefs`）。
- 工具条标题带概览「共 N 个 · 前置 X · 后置 Y」；按钮只有 `新增` + `批量删除（N）`，**没有导入导出**（解析器是代码，CSV 装不下换行与引号，强导只会炸）。
- 按钮层级、`.dot`、`.copy` 与 `src/views/service/partners/SPEC.md` 的「按钮层级」一致：全部 `plain` 描边，只有描边色区分语义，改一处必须同时改两处。
- 整行点击 = 打开编辑抽屉；`handleRowClick` 遇到 `column.type === "selection"` 直接 return。
- 停用时如果有关联接口，二次确认里要写清后果（「正被 N 个接口引用，停用后这些接口调用会直接失败」）；启用不确认。

# 编辑抽屉

`components/ParserDrawer.vue`（620px 右侧 `el-drawer`，与 `AuthDialog` 同一视觉），传 `parser` 为 `null` 时是新建：

- 字段：名称、标识（等宽 + 唯一性/字符集提示）、类型（`el-radio-button`，**创建后 `disabled`**——改类型会让已引用它的接口语义错位，提示文案要把这句说出来）、说明、执行超时（`el-input-number`，毫秒）、状态开关、Groovy 代码（`@/components/CodeEditor/index.vue`，`height="320px"`，固定暗色）、历史版本列表（仅编辑态，有「载入」按钮）。
- 保存前校验（只描红不弹框）：名称非空 → 标识非空 → 标识字符集 → 标识查重（`isParserCodeTaken(code, form.id)`）→ 代码里必须有 `def\s+parse\s*\(`。
- `v-model` 不能直接绑 prop，要 `const visible = computed({ get, set })` 转发 `update:modelValue`；抽屉挂在 body 上，拿不到 scoped `data-v`，样式一律 `:global(.parser-dlg .xxx)`（同 [[partners-integration]] 的弹窗坑）。

# 路由与图标

- 菜单：`src/router/modules/service.ts` 里 `/service` 的第三个子路由，`meta: { icon: "ri/code-box-line", title: "解析器", showParent: true }`。
- `ri/code-box-line` 必须在 `src/components/ReIcon/src/offlineIcon.ts` 里 `addIcon` 注册，否则菜单图标空白且不报错（见 [[shared-ui]]）。
- 编辑用抽屉、不占路由：解析器的字段少、没有分步，做成整页反而多点两下。

# 边界

- 不做「在线试跑 / 拿一段样例报文跑一遍看输出」：执行在服务端 Groovy 沙箱，前端给不出可信结果，做个假的只会误导。
- 不做调试断点、不做语法高亮以外的 IDE 能力（`CodeEditor` 只有 Groovy 语法高亮）。
- 不做导入导出、不做跨环境同步：代码类资源靠后端版本管理，前端只读它有过的历史。
- 一个解析器只有一个 `kind`：前置把原始报文映射成入参，后置把响应映射成出参，**不提供「两边通用」**——耦合会让接口读不懂自己在跑什么。
