# 数据服务商接入管理台：后端 REST API 设计

> 状态：设计稿  
> 对应前端：`src/views/service/**`、登录与动态菜单  
> 目标：覆盖当前已完成页面所需的后端能力，不包含尚未设计页面的真实调用、调用日志、监控告警、账单结算等 API。

## 1. 设计决策

- 基础路径：`/api/v1`。
- 使用标准 REST 资源：合作方、环境、网络、策略、计费、鉴权、接口、解析器分别维护。
- 路径使用数值 `id`；业务编码 `code` 用于展示、导入匹配和唯一性校验。
- 合作方的环境、网络、策略、计费是其 owned sub-resource；接口与解析器可独立查询和管理。
- 列表由服务端筛选、排序和分页；概览统计由独立只读接口返回，避免只统计当前页。
- CSV 导入采用“校验/预览 → 提交”两阶段，提交时服务端必须重新校验。
- 批量删除复用单资源 `DELETE`，前端并发请求并汇总结果，不增加 RPC 风格批量接口。
- 解析器“回滚”只是读取历史代码并载入编辑器，最终仍通过更新解析器生效，不提供 rollback 动作接口。
- 所有时间使用 ISO 8601，例如 `2026-08-14T10:30:00+08:00`；合作起止日期使用 `YYYY-MM-DD`。
- ID 在 JSON 中使用 number，后端不得返回超过 JavaScript 安全整数范围的值。

## 2. 通用约定

### 2.1 认证

除登录、刷新 Token 外，所有接口要求：

```http
Authorization: Bearer <accessToken>
```

权限必须由服务端校验。前端路由和按钮权限只负责展示，不能作为安全边界。

### 2.2 成功与失败响应

```ts
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface FieldError {
  field?: string;
  line?: number;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: FieldError[] | Record<string, unknown>;
  };
  traceId: string;
}
```

成功示例：

```json
{
  "success": true,
  "data": {
    "id": 1001,
    "name": "中科数据科技有限公司"
  }
}
```

失败示例：

```json
{
  "success": false,
  "error": {
    "code": "PARSER_IN_USE",
    "message": "解析器仍被接口引用，不能删除",
    "details": {
      "referenceCount": 2,
      "interfaces": [
        { "id": 2001, "code": "ENT_BASE_V1", "name": "企业工商基本信息" }
      ]
    }
  },
  "traceId": "01J4M7N8D4E2S6W8Q3D7P3R6K0"
}
```

### 2.3 分页

```ts
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

公共查询参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `page` | number | 否 | `1` | 从 1 开始 |
| `pageSize` | number | 否 | `10` | 1～100；下拉数据源最多取 100，必要时前端继续分页 |
| `sortBy` | string | 否 | 各资源默认值 | 只允许文档列出的字段 |
| `sortOrder` | `asc \| desc` | 否 | `desc` | 排序方向 |

### 2.4 状态码

| 场景 | HTTP 状态 |
|---|---:|
| 查询、更新成功 | 200 |
| 创建成功 | 201 |
| 删除、退出登录成功 | 204，无响应体 |
| 参数或文件校验失败 | 400 |
| 未登录、Token 无效或过期 | 401 |
| 无权限 | 403 |
| 资源不存在 | 404 |
| 唯一键、引用关系、版本冲突 | 409 |
| 文件过大 | 413 |
| 服务内部错误 | 500 |

### 2.5 并发控制

合作方、接口、解析器、鉴权及合作方单例配置均返回 `revision`。`PUT/PATCH` 请求必须携带读取时的 `revision`，服务端更新成功后将其加一；不一致时返回 409 `REVISION_CONFLICT`。

删除请求必须携带：

```http
If-Match: "<revision>"
```

版本过期时同样返回 409 `REVISION_CONFLICT`，前端重新读取后再让用户确认。

## 3. 领域数据结构

以下结构是请求和响应的共享定义。标注“服务端只读”的字段不得出现在创建或更新输入中。

### 3.1 合作方

```ts
type PartnerStatus = 0 | 1 | 2; // 0 停用，1 启用，2 测试中

interface PartnerBase {
  id: number;                  // 服务端只读
  name: string;
  code: string;                // 全局唯一，创建后不可改
  scope: string[];             // 全国、省级、市级等
  website?: string;
  contact: string;
  phone: string;
  email?: string;
  supportPhone?: string;
  status: PartnerStatus;
  cooperateStart?: string;
  cooperateEnd?: string;
  createTime: string;          // 服务端只读
  remark?: string;
}

interface PartnerListItem extends PartnerBase {
  interfaceCount: number;
  enabledInterfaceCount: number;
  revision: number;
}

interface PartnerDetail extends PartnerListItem {}

interface PartnerEnv {
  id: number;                  // 新建行可不传，由服务端生成
  name: string;
  code: string;                // 合作方内唯一，如 dev、sit、prod
  baseUrl: string;
  remark?: string;
}

interface NetworkConfig {
  charset: string;
  connectTimeout: number;      // ms
  readTimeout: number;         // ms
  useProxy: boolean;
  proxyType?: "http" | "socks5";
  proxyUrl?: string;
  revision: number;
}

interface PolicyConfig {
  qps: number;
  dailyLimit: number;
  concurrency: number;
  retryTimes: number;
  retryInterval: number;
  breakerThreshold: number;
  breakerRecoverMin: number;
  cacheEnabled: boolean;
  cacheTtl: number;
  cacheUnit: "minute" | "hour" | "day";
  alarmReceiver?: string;
  revision: number;
}

interface BillingConfig {
  billingType: "per_call" | "package" | "yearly" | "free";
  unitPrice: number;
  settleType: "monthly" | "prepaid";
  contractNo?: string;
  balance: number;
  quotaTotal: number;
  quotaUsed: number;
  warnThreshold: number;
  revision: number;
}

type PartnerBaseInput = Omit<
  PartnerBase,
  "id" | "createTime"
>;

interface PartnerCreateInput extends PartnerBaseInput {
  envs: Array<Omit<PartnerEnv, "id"> & { id?: number }>;
}

type PartnerUpdateInput = Omit<PartnerBaseInput, "code"> & {
  revision: number;
};
```

说明：

- 新建时至少传一个环境，首个环境是默认环境；其他公共配置由服务端建立默认值。
- `quotaUsed`、`balance` 当前页面允许手工维护，因此暂时可写；接入真实计费后应改为只读并另设内部记账接口。

### 3.2 鉴权

```ts
interface KV {
  key: string;
  value: string;
}

interface AuthConfig {
  id: number;                  // 服务端只读
  name: string;                // 同一合作方内唯一，供 CSV 导入匹配
  authType: "header" | "script";
  headers?: KV[];              // header 类型必填，至少一条
  scriptLang?: "groovy";       // script 类型固定 groovy
  scriptCode?: string;
  scriptTimeout?: number;      // 100～30000ms
  scriptVersion?: number;      // 服务端维护或随更新递增
  enabled: boolean;
  revision: number;            // 服务端只读
}

type AuthConfigInput = Omit<AuthConfig, "id" | "revision">;

interface AuthConfigUpdateInput extends AuthConfigInput {
  revision: number;
}
```

`header` 与 `script` 字段互斥：保存 header 时清空脚本字段；保存 script 时 `headers=[]`。密钥必须加密存储并记录审计日志。管理接口可向有权限的管理员返回可编辑值，普通用户不得调用。

### 3.3 接口

```ts
type ParamLocation = "query" | "body" | "path" | "header";
type FieldType =
  | "string" | "int" | "long" | "number"
  | "boolean" | "object" | "array" | "date";

interface InterfaceParam {
  id?: number;                 // 行标识；服务端可重新生成
  name: string;
  location: ParamLocation;
  type: FieldType;
  required: boolean;
  desc?: string;
  defaultValue?: string;       // 保存时按 type 校验
}

interface InterfaceResponseField {
  id?: number;
  name: string;
  path: string;                // 如 data.list[].name
  type: FieldType;
  checkMode?: "value" | "notEmpty";
  checkValue?: string;
  desc?: string;
}

type ProcessorType = "template" | "parser";

interface InterfaceBase {
  id: number;                  // 服务端只读
  partnerId: number;           // 创建后不可改
  code: string;                // 全局唯一，创建后不可改
  name: string;
  path: string;
  method: "GET" | "POST";
  payloadFormat: "json" | "xml" | "form";
  authId?: number;             // 必须属于 partnerId 对应合作方
  params: InterfaceParam[];
  responses: InterfaceResponseField[];
  preProcessor?: ProcessorType; // 缺省表示不处理
  preTemplate?: string;         // template 时必填
  preParserId?: number;         // parser 时必填，且 kind=pre
  postProcessor?: ProcessorType;
  postTemplate?: string;
  postParserId?: number;        // parser 时必填，且 kind=post
  timeout?: number;             // 空值表示沿用合作方
  qps?: number;
  concurrency?: number;
  retryTimes?: number;
  retryInterval?: number;
  breakerThreshold?: number;
  breakerRecoverMin?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  cacheUnit?: "minute" | "hour" | "day";
  price: number;
  dailyLimit?: number;
  enabled: boolean;
  createTime?: string;          // 服务端只读
  lastCallTime?: string;        // 服务端只读，运行时写入
}

type InterfaceInput = Omit<
  InterfaceBase,
  "id" | "createTime" | "lastCallTime"
>;

type InterfaceUpdateInput = Omit<
  InterfaceInput,
  "partnerId" | "code"
> & { revision: number };

interface InterfaceListItem extends InterfaceBase {
  partnerName: string;
  partnerCode: string;
  partnerStatus: PartnerStatus;
  authName?: string;
  authType?: "header" | "script";
  fullUrl: string;              // 默认环境 baseUrl + path
  revision: number;
}

interface InterfaceDetail extends InterfaceListItem {}
```

服务端校验重点：

- 同一接口内，`params` 的 `name + location` 唯一；出参 `path` 唯一且格式合法。
- `checkMode=value` 时 `checkValue` 必填，并按字段类型校验。
- 开启缓存时 `cacheTtl > 0`。
- 处理器、模板和解析器 ID 必须匹配；禁止前置位置引用后置解析器，反之亦然。
- 被引用解析器可以停用，但服务端必须返回明确告警；保存接口时是否允许引用已停用解析器，建议默认不允许。

### 3.4 解析器

```ts
interface ParserItem {
  id: number;                  // 服务端只读
  code: string;                // 全局唯一，创建后不可改
  name: string;
  kind: "pre" | "post";       // 创建后不可改
  desc?: string;
  scriptCode: string;          // 必须包含 def parse(ctx)
  scriptTimeout: number;
  scriptVersion: number;       // 代码变化时服务端递增
  enabled: boolean;
  createTime: string;          // 服务端只读
  updateTime: string;          // 服务端只读
  referenceCount: number;      // 服务端只读
  revision: number;            // 服务端只读
}

type ParserInput = Omit<
  ParserItem,
  | "id" | "scriptVersion" | "createTime" | "updateTime"
  | "referenceCount" | "revision"
>;

type ParserUpdateInput = Omit<ParserInput, "code" | "kind"> & {
  revision: number;
};

interface ParserVersion {
  version: number;
  code: string;
  time: string;
}
```

每次 `scriptCode` 变化，服务端保存旧代码快照并递增 `scriptVersion`；最多保留 10 份，与当前前端行为一致。仅修改名称、描述或启停状态不生成代码版本。

## 4. 登录、刷新与菜单

### 4.1 登录

`POST /auth/login`

请求：

```json
{
  "username": "admin",
  "password": "admin123"
}
```

响应 `200`：

```ts
interface LoginData {
  avatar: string;
  username: string;
  nickname: string;
  roles: string[];
  permissions: string[];
  accessToken: string;
  refreshToken: string;
  expires: string; // accessToken 过期时间，ISO 8601
}
```

失败返回 401 `INVALID_CREDENTIALS`，不得透露用户名或密码哪一项错误。

### 4.2 刷新 Token

`POST /auth/refresh`

请求：

```json
{ "refreshToken": "<refreshToken>" }
```

响应：同 `LoginData` 中的 Token 字段及用户权限字段。建议同时轮换 `refreshToken`，作废旧值。

### 4.3 退出登录

`POST /auth/logout`

请求体为空；响应 204。服务端撤销当前 `refreshToken`，短期 `accessToken` 可继续使用至过期或加入撤销列表。

### 4.4 动态菜单

`GET /routes/async`

响应：

```ts
interface AsyncRoute {
  path: string;
  name?: string;
  component?: string;
  redirect?: string;
  meta?: {
    title?: string;
    icon?: string;
    rank?: number;
    roles?: string[];
    auths?: string[];
    showLink?: boolean;
    keepAlive?: boolean;
  };
  children?: AsyncRoute[];
}

// data: AsyncRoute[]
```

当前业务菜单由前端静态路由提供，因此该接口可以先返回 `[]`，不能返回 mock 中的业务菜单副本。

## 5. 合作方 API

### 5.1 列表与详情

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/partners` | 下表查询参数 | 200 `Page<PartnerListItem>` |
| POST | `/partners` | `PartnerCreateInput` | 201 `PartnerDetail` |
| GET | `/partners/{partnerId}` | 无 | 200 `PartnerDetail` |
| PUT | `/partners/{partnerId}` | `PartnerUpdateInput` | 200 `PartnerDetail` |
| PATCH | `/partners/{partnerId}/status` | 下方状态体 | 200 `PartnerDetail` |
| DELETE | `/partners/{partnerId}` | `If-Match` 请求头 | 204 |

列表查询参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 合作方名称模糊查询，不区分大小写 |
| `status` | `0 \| 1 \| 2` | 状态精确匹配 |
| `page/pageSize` | number | 公共分页 |
| `sortBy` | `createTime \| name` | 默认 `createTime` |

状态请求：

```json
{ "status": 1, "revision": 3 }
```

删除约束：合作方仍有接口时返回 409 `PARTNER_HAS_INTERFACES`，`details` 带 `interfaceCount`；默认不级联删除。

### 5.2 环境集合

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/partners/{partnerId}/environments` | 无 | 200 `{ items: PartnerEnv[], revision }` |
| PUT | `/partners/{partnerId}/environments` | 下方完整集合 | 200 同 GET |

PUT 是整组替换，新增、删除、重排在一次事务中完成：

```json
{
  "revision": 3,
  "items": [
    {
      "id": 11,
      "name": "生产环境",
      "code": "prod",
      "baseUrl": "https://api.example.com",
      "remark": "仅内网可访问"
    }
  ]
}
```

至少保留一项；`code` 在同一合作方内唯一；`baseUrl` 必须是合法 HTTP(S) URL。

### 5.3 网络配置

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/partners/{partnerId}/network` | 无 | 200 `NetworkConfig` |
| PUT | `/partners/{partnerId}/network` | `Omit<NetworkConfig, "revision"> & { revision }` | 200 `NetworkConfig` |

`useProxy=true` 时 `proxyType`、`proxyUrl` 必填；否则清空代理字段。

### 5.4 调用策略

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/partners/{partnerId}/policy` | 无 | 200 `PolicyConfig` |
| PUT | `/partners/{partnerId}/policy` | `Omit<PolicyConfig, "revision"> & { revision }` | 200 `PolicyConfig` |

### 5.5 计费与额度

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/partners/{partnerId}/billing` | 无 | 200 `BillingConfig` |
| PUT | `/partners/{partnerId}/billing` | `Omit<BillingConfig, "revision"> & { revision }` | 200 `BillingConfig` |

必须满足 `0 <= quotaUsed <= quotaTotal`、`unitPrice >= 0`、`balance >= 0`。

## 6. 鉴权配置 API

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/partners/{partnerId}/auth-configs` | 无 | 200 `{ items: AuthConfig[] }` |
| POST | `/partners/{partnerId}/auth-configs` | `AuthConfigInput` | 201 `AuthConfig` |
| PUT | `/partners/{partnerId}/auth-configs/{authId}` | `AuthConfigUpdateInput` | 200 `AuthConfig` |
| DELETE | `/partners/{partnerId}/auth-configs/{authId}` | `If-Match` 请求头 | 204 |
| POST | `/partners/{partnerId}/auth-configs/script-validations` | 下方脚本 | 200 `ScriptValidationResult` |

脚本校验请求：

```json
{
  "scriptCode": "def sign(ctx) { return [headers: []] }",
  "scriptTimeout": 3000
}
```

响应：

```ts
interface ScriptValidationResult {
  valid: boolean;
  checks: Array<{
    code: "ENTRY_POINT" | "SANDBOX" | "EXECUTION";
    passed: boolean;
    message: string;
  }>;
  output?: {
    headers?: KV[];
    query?: KV[];
    body?: unknown;
  };
  durationMs: number;
}
```

该接口使用固定样例上下文做无副作用 dry-run，不访问合作方真实地址，不读写文件、网络或进程。保存鉴权时服务端仍需再次校验，不能信任此预检结果。

删除鉴权时，如果接口仍引用它，返回 409 `AUTH_IN_USE`，`details` 带引用接口列表。

## 7. 接口管理 API

### 7.1 列表、统计与 CRUD

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/interfaces` | 下表查询参数 | 200 `Page<InterfaceListItem>` |
| GET | `/interfaces/stats` | 无 | 200 `InterfaceStats` |
| POST | `/interfaces` | `InterfaceInput`，含 `partnerId` | 201 `InterfaceDetail` |
| GET | `/interfaces/{interfaceId}` | 无 | 200 `InterfaceDetail` |
| PUT | `/interfaces/{interfaceId}` | `InterfaceUpdateInput` | 200 `InterfaceDetail` |
| PATCH | `/interfaces/{interfaceId}/status` | `{ enabled, revision }` | 200 `InterfaceDetail` |
| DELETE | `/interfaces/{interfaceId}` | `If-Match` 请求头 | 204 |

列表查询参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `keyword` | string | 匹配接口名称、请求路径、合作方名称，不区分大小写 |
| `partnerId` | number | 合作方 ID；合作方详情中的接口列表也复用此参数 |
| `enabled` | boolean | 启停状态 |
| `page/pageSize` | number | 公共分页 |
| `sortBy` | `createTime \| lastCallTime \| name` | 默认 `createTime` |

统计响应：

```ts
interface InterfaceStats {
  total: number;
  enabled: number;
  disabled: number;
}
```

统计接口表示全量概览，不跟随列表筛选；导出必须跟随列表筛选。

## 8. 解析器 API

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| GET | `/parsers` | 下表查询参数 | 200 `Page<ParserItem>` |
| GET | `/parsers/stats` | 无 | 200 `ParserStats` |
| POST | `/parsers` | `ParserInput` | 201 `ParserItem` |
| GET | `/parsers/{parserId}` | 无 | 200 `ParserItem` |
| PUT | `/parsers/{parserId}` | `ParserUpdateInput` | 200 `ParserItem` |
| PATCH | `/parsers/{parserId}/status` | `{ enabled, revision }` | 200 `ParserItem` |
| DELETE | `/parsers/{parserId}` | `If-Match` 请求头 | 204 |
| GET | `/parsers/{parserId}/versions` | 无 | 200 `{ items: ParserVersion[] }` |

列表查询参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `keyword` | string | 匹配名称、标识、描述，不区分大小写 |
| `kind` | `pre \| post` | 前置或后置 |
| `enabled` | boolean | 启停状态 |
| `page/pageSize` | number | 公共分页；接口表单的解析器下拉也复用此接口 |
| `sortBy` | `updateTime \| name` | 默认 `updateTime` |

统计响应：

```ts
interface ParserStats {
  total: number;
  pre: number;
  post: number;
}
```

删除被引用解析器返回 409 `PARSER_IN_USE`，并在 `details` 中返回 `referenceCount` 和引用接口列表。版本列表按 `version` 倒序，最多 10 条。

## 9. CSV 模板、导出与导入

### 9.1 文件接口

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `/partners/import-template` | 无 | CSV 文件 |
| GET | `/partners/export` | 与合作方列表相同的筛选参数 | CSV 文件，仅含筛选结果 |
| POST | `/partners/import/validate` | `multipart/form-data`，字段 `file` | 200 导入预检 |
| POST | `/partners/import` | 合作方规范化行，见 9.2 | 200 导入结果 |
| GET | `/interfaces/import-template` | 无 | CSV 文件 |
| GET | `/interfaces/export` | 与接口列表相同的筛选参数 | CSV 文件，仅含筛选结果 |
| POST | `/interfaces/import/validate` | `multipart/form-data`，字段 `file` | 200 导入预检 |
| POST | `/interfaces/import` | 接口规范化行，见 9.3 | 200 导入结果 |

文件响应不使用 JSON envelope：

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="partners-20260814.csv"
```

CSV 使用 UTF-8 BOM、CRLF 和标准双引号转义。导出忽略 `page/pageSize`，返回全部筛选结果。导入限制建议为 2 MiB、1000 数据行；超限分别返回 413 或 400。文件级结构错误返回 400；文件结构正确但存在行错误时，预检返回 200 和逐行 `issues`。

合作方 CSV 列保持现状：

```text
合作方名称,编码,联系人,联系电话,状态,合作开始,合作结束,备注,接入环境(JSON)
```

接口 CSV 列保持现状：

```text
合作方编码,合作方名称,接口名称,接口标识,请求方法,报文格式,请求路径,鉴权名称,单价,日上限,超时(ms),启用,前置处理器,后置处理器,入参(JSON),出参(JSON),创建时间
```

合作方名称、创建时间只用于展示，不作为导入写入依据。

### 9.2 导入预检通用结构

```ts
interface ImportIssue {
  line: number; // 含表头，从 1 开始；0 表示整表问题
  field?: string;
  message: string;
}

interface ImportValidationItem<T> {
  line: number;
  action: "create" | "update";
  targetId?: number;
  data: T;      // 服务端规范化后的可编辑数据
  issues: ImportIssue[];
}

interface ImportValidationResult<T> {
  items: Array<ImportValidationItem<T>>;
  summary: {
    total: number;
    valid: number;
    created: number;
    updated: number;
    invalid: number;
  };
  issues: ImportIssue[]; // 整表错误及所有行错误的平铺汇总
}
```

- 合作方预检的 `T` 为 `PartnerCreateInput`，按 `code` 判断新增或更新。
- 接口预检的 `T` 为 `InterfaceInput`，按 `partnerId + code` 判断新增或更新。
- 预检负责把合作方编码、鉴权名称、解析器编码解析成 ID，并校验引用类型。
- 预检不写数据库，也不签发可信任的执行令牌；用户在页面上修改后，提交接口必须重新校验。

### 9.3 导入提交

请求：

```ts
interface ImportCommitRequest<T> {
  items: Array<{
    line: number;
    data: T;
  }>;
}
```

响应：

```ts
interface ImportCommitResult {
  summary: {
    total: number;
    succeeded: number;
    created: number;
    updated: number;
    failed: number;
  };
  results: Array<{
    line: number;
    id?: number;
    code?: string;
    action?: "create" | "update";
    issues: ImportIssue[];
  }>;
}
```

合作方提交使用 `PartnerCreateInput`；接口提交使用 `InterfaceInput`。服务端根据当前数据库状态重新判定 create/update，忽略客户端预检的 `action` 和 `targetId`。默认逐行提交、允许部分成功；每一行必须在独立事务中完成。若未来要求整批原子性，再增加显式 `atomic=true` 模式。

## 10. 统一业务错误码

| code | HTTP | 使用场景 |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | 字段格式、必填、默认值类型等校验失败 |
| `INVALID_CREDENTIALS` | 401 | 登录失败 |
| `TOKEN_EXPIRED` | 401 | access/refresh Token 过期 |
| `FORBIDDEN` | 403 | 无操作权限 |
| `NOT_FOUND` | 404 | ID 不存在或资源不属于指定父资源 |
| `CODE_ALREADY_EXISTS` | 409 | 合作方、接口、解析器编码重复 |
| `ENV_CODE_ALREADY_EXISTS` | 409 | 同一合作方下环境编码重复 |
| `AUTH_NAME_ALREADY_EXISTS` | 409 | 同一合作方下鉴权名称重复 |
| `PARTNER_HAS_INTERFACES` | 409 | 删除仍有接口的合作方 |
| `AUTH_IN_USE` | 409 | 删除被接口引用的鉴权 |
| `PARSER_IN_USE` | 409 | 删除被接口引用的解析器 |
| `PARSER_KIND_MISMATCH` | 400 | 前后置解析器类型不匹配 |
| `INVALID_SCRIPT` | 400 | Groovy 入口、沙箱或执行校验失败 |
| `REVISION_CONFLICT` | 409 | `revision` 或 `If-Match` 已过期 |
| `IMPORT_FILE_INVALID` | 400 | CSV 表头、编码、JSON 单元格等错误 |

## 11. 与前端现有代码的对应关系

- `src/api/user.ts`：`/login → /auth/login`，`/refresh-token → /auth/refresh`。
- `src/api/routes.ts`：`/get-async-routes → /routes/async`。
- `partners/index.vue`：合作方列表、创建、更新、状态、删除、CSV 文件接口。
- `partners/detail.vue`：详情、环境、网络、策略、计费、鉴权 CRUD；接口数量由详情返回，接口清单复用 `/interfaces?partnerId=...`。
- `interfaces/index.vue`：接口列表、状态、删除、统计和 CSV 文件接口。
- `interfaces/edit.vue`：创建、读取、更新；合作方、鉴权、解析器下拉分别复用对应列表接口。
- `parsers/index.vue` 与 `ParserDrawer.vue`：解析器 CRUD、统计和版本列表。
- 所有页面统一把现有内存 `data.ts` 写操作替换为 API；服务端返回的资源是保存后的唯一事实来源，不再直接 `splice/unshift mockPartners`。

## 12. 明确不在本次范围

- 真实数据调用网关、Groovy 在线自定义样例调试。
- 调用日志、链路追踪、监控大盘、告警通知。
- 真实计费扣费、充值、账单与结算。
- 用户、角色、权限的后台管理页面 API。
- 独立批量删除、解析器回滚等 RPC 动作接口。
