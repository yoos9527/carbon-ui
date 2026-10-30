/** 键值对（公共请求头、接口独立参数等） */
export interface KV {
  key: string;
  value: string;
}

/** 鉴权方式：header = 公共请求头（原环境与网络里的公共请求头迁入）；script = 自定义 Groovy 脚本 */
export type AuthType = "header" | "script";

/** 合作方状态：0 停用 1 启用 2 测试中 */
export type PartnerStatus = 0 | 1 | 2;

/** 一条鉴权配置，同一个合作方下可以配置多条 */
export interface AuthConfig {
  id: number;
  /** 鉴权名称，如「公共请求头」「复杂签名脚本」 */
  name: string;
  authType: AuthType;
  /** header 类型：随每次请求发送的请求头列表 */
  headers?: KV[];
  /** script 类型专用，语言固定 Groovy */
  scriptLang?: "groovy";
  scriptCode?: string;
  scriptTimeout?: number;
  scriptVersion?: number;
  enabled: boolean;
}

/** 入参位置：header / query / path / body 四者互斥 */
export type ParamLocation = "query" | "body" | "path" | "header";

/** 字段类型（入参、出参共用一套） */
export type FieldType =
  | "string"
  | "int"
  | "long"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "date";

/** 请求入参字段 */
export interface InterfaceParam {
  id: number;
  /** 参数名，同一接口内唯一 */
  name: string;
  location: ParamLocation;
  type: FieldType;
  required: boolean;
  desc?: string;
  /** 默认值：留空则不发送；填了必须符合 type，保存前会按类型校验 */
  defaultValue?: string;
}

/** 响应出参字段。层级用 JSON 路径表达（`data.list[].name`），不搞树形行 */
export interface InterfaceResponseField {
  id: number;
  /** 字段名，与 path 末段同名 */
  name: string;
  /** JSON 路径，如 data.entName / data.list[].name */
  path: string;
  type: FieldType;
  /** 查得字段的校验方式：取值 = 必须等于 checkValue；非空 = 必须有值 */
  checkMode?: "value" | "notEmpty";
  /** checkMode === "value" 时的期望值，如 200 */
  checkValue?: string;
  desc?: string;
}

/** 查得字段校验方式下拉 */
export const checkModeOptions: {
  label: string;
  value: NonNullable<InterfaceResponseField["checkMode"]>;
}[] = [
  { label: "取值", value: "value" },
  { label: "非空", value: "notEmpty" }
];

/** 单个接口（能力）配置，只存与合作方公共配置不同的部分 */
export interface PartnerInterfaceItem {
  id: number;
  /** 业务编码，字母/数字/下划线，全局唯一，如 ENT_BASE_V1 */
  code: string;
  /** 能力名称，如「企业工商基本信息」 */
  name: string;
  /** 接口路径，如 /api/ent/base */
  path: string;
  method: "GET" | "POST";
  payloadFormat: "json" | "xml" | "form";
  /** 引用 AuthConfig.id */
  authId?: number;
  /** 请求入参（含 header / query / path / body 四种位置） */
  params: InterfaceParam[];
  /** 响应出参字段 */
  responses: InterfaceResponseField[];
  /** 前置处理器：模板解析器写内联模板，解析器则引用解析器库 */
  preProcessor?: ProcessorType;
  /** 内联解析模板（preProcessor === "template" 时必填） */
  preTemplate?: string;
  /** 引用的前置解析器 id（preProcessor === "parser" 时必填） */
  preParserId?: number;
  /** 后置处理器：语义同前置，只是作用在响应上 */
  postProcessor?: ProcessorType;
  /** 内联响应映射模板（postProcessor === "template" 时必填） */
  postTemplate?: string;
  /** 引用的后置解析器 id（postProcessor === "parser" 时必填） */
  postParserId?: number;
  /** 覆盖合作方默认超时 */
  timeout?: number;
  /** 流控：每秒请求上限，留空沿用合作方 */
  qps?: number;
  /** 流控：并发上限，留空沿用合作方 */
  concurrency?: number;
  /** 流控：失败重试次数，留空沿用合作方 */
  retryTimes?: number;
  /** 流控：重试间隔（毫秒），留空沿用合作方 */
  retryInterval?: number;
  /** 流控：熔断失败阈值，留空沿用合作方 */
  breakerThreshold?: number;
  /** 流控：熔断恢复时长（分钟），留空沿用合作方 */
  breakerRecoverMin?: number;
  /** 缓存：是否缓存响应 */
  cacheEnabled?: boolean;
  /** 缓存：缓存时长（配合 cacheUnit），留空沿用合作方 */
  cacheTtl?: number;
  /** 缓存：缓存时长的单位，缺省按秒 */
  cacheUnit?: CacheUnit;
  price: number;
  dailyLimit?: number;
  enabled: boolean;
  /** 建档时间；最后调用时间 `lastCallTime` 仍保留，用于排序与健康度 */
  createTime?: string;
  lastCallTime?: string;
}

/** 一个接入环境。同一合作方常有 dev / sit / uat / prod 多套地址，故用列表而非固定字段 */
export interface PartnerEnv {
  id: number;
  /** 环境名称，如「生产环境」 */
  name: string;
  /** 环境标识，如 prod / sit / dev，日志与告警里区分流量用 */
  code: string;
  /** 该环境的接入地址（baseUrl） */
  baseUrl: string;
  /** 备注，如「仅内网可访问」 */
  remark?: string;
}

/** 合作方接入档案 */
export interface PartnerItem {
  id: number;
  name: string;
  code: string;
  scope: string[];
  website?: string;
  contact: string;
  phone: string;
  email?: string;
  supportPhone?: string;
  status: PartnerStatus;
  cooperateStart?: string;
  cooperateEnd?: string;
  createTime: string;
  remark?: string;

  /** 环境与网络（合作方公共）。envs 至少一条，第一条视为默认环境 */
  envs: PartnerEnv[];
  charset: string;
  connectTimeout: number;
  readTimeout: number;
  useProxy: boolean;
  proxyType?: "http" | "socks5";
  proxyUrl?: string;

  /** 认证与鉴权，可配置多种 */
  authConfigs: AuthConfig[];

  /** 调用策略 */
  qps: number;
  dailyLimit: number;
  concurrency: number;
  retryTimes: number;
  retryInterval: number;
  breakerThreshold: number;
  breakerRecoverMin: number;
  cacheTtl: number;
  /** 是否缓存响应（接口没单独配置时用它） */
  cacheEnabled: boolean;
  /** 缓存时长单位，与 cacheTtl 配对 */
  cacheUnit: CacheUnit;
  alarmReceiver?: string;

  /** 计费与额度 */
  billingType: "per_call" | "package" | "yearly" | "free";
  unitPrice: number;
  quotaTotal: number;
  quotaUsed: number;
  warnThreshold: number;
  settleType: "monthly" | "prepaid";
  balance: number;
  contractNo?: string;

  /** 接口能力清单 */
  interfaces: PartnerInterfaceItem[];
}

/* ------------------------------ 字典 ------------------------------ */

export const scopeOptions = ["全国", "省级", "市级"];

export const partnerStatusOptions: {
  label: string;
  value: PartnerStatus;
  tagType: "success" | "info" | "warning";
}[] = [
  { label: "启用", value: 1, tagType: "success" },
  { label: "停用", value: 0, tagType: "info" },
  { label: "测试中", value: 2, tagType: "warning" }
];

export const authTypeOptions: { label: string; value: AuthType }[] = [
  { label: "公共请求头", value: "header" },
  { label: "Groovy 脚本", value: "script" }
];

export const methodOptions = [
  { label: "GET", value: "GET" },
  { label: "POST", value: "POST" }
];

export const payloadFormatOptions = [
  { label: "JSON", value: "json" },
  { label: "XML", value: "xml" },
  { label: "Form", value: "form" }
];

/**
 * 处理器只有两种来源：`template` = 在接口里直接写内联 JSON 模板（写死的「模板解析器」），
 * `parser` = 引用「服务管理 › 解析器」里的 Groovy 解析器（见 preParserId / postParserId）。
 * 不再有「不处理」——清空下拉就等于不处理。
 */
export type ProcessorType = "template" | "parser";

/** 接口处理器下拉的固定首项：写死的模板解析器（选中后写内联模板） */
export const TEMPLATE_PROCESSOR_VALUE = "template";

/** 缓存时长的计量单位（接口「缓存设置」的单位下拉） */
export type CacheUnit = "minute" | "hour" | "day";

export const cacheUnitOptions: { label: string; value: CacheUnit }[] = [
  { label: "分钟", value: "minute" },
  { label: "小时", value: "hour" },
  { label: "天", value: "day" }
];

export function getCacheUnitLabel(unit: CacheUnit): string {
  return cacheUnitOptions.find(item => item.value === unit)?.label ?? "分钟";
}

export const paramLocationOptions: { label: string; value: ParamLocation }[] = [
  { label: "query", value: "query" },
  { label: "body", value: "body" },
  { label: "path", value: "path" },
  { label: "header", value: "header" }
];

export const fieldTypeOptions: { label: string; value: FieldType }[] = [
  { label: "string", value: "string" },
  { label: "int", value: "int" },
  { label: "long", value: "long" },
  { label: "number", value: "number" },
  { label: "boolean", value: "boolean" },
  { label: "object", value: "object" },
  { label: "array", value: "array" },
  { label: "date", value: "date" }
];

export const billingTypeOptions = [
  { label: "按次计费", value: "per_call" },
  { label: "套餐包", value: "package" },
  { label: "包年", value: "yearly" },
  { label: "免费", value: "free" }
];

export const settleTypeOptions = [
  { label: "月结", value: "monthly" },
  { label: "预付充值", value: "prepaid" }
];

export function getAuthTypeLabel(type: AuthType): string {
  return authTypeOptions.find(item => item.value === type)?.label ?? type;
}

export function getStatusOption(status: PartnerStatus) {
  return partnerStatusOptions.find(item => item.value === status);
}

/* --------------------------- 脚本默认内容 --------------------------- */

/** 新建「脚本代码」鉴权时的初始模板 */
export const groovyScriptTemplate = `/**
 * 鉴权脚本：服务端 Groovy 沙箱内执行
 *
 * ctx.url        完整请求地址
 * ctx.method     GET / POST
 * ctx.headers    当前请求头（mutable Map，可直接改写）
 * ctx.query      查询参数（mutable Map）
 * ctx.body       请求体
 * ctx.config     预留的自定义键值（可选）
 * ctx.lib        md5(str) sha256(str) hmacSha256(str, key) base64(str) uuid() timestamp() json(obj)
 *
 * 返回 [headers: [...], query: [...], body: ...]，会合并进实际请求
 * 抛异常或返回 [error: "..."] 表示鉴权失败
 */
def sign(ctx) {
    // 合作方分配的凭证，直接写在这里（随配置加密存储）
    def appKey = "your-app-key"
    def appSecret = "your-app-secret"

    def ts = ctx.lib.timestamp()
    def nonce = ctx.lib.uuid()
    def signature = ctx.lib.hmacSha256(appKey + ts + nonce, appSecret)

    return [
        headers: [
            "X-App-Key"  : appKey,
            "X-Timestamp": ts.toString(),
            "X-Nonce"    : nonce,
            "X-Sign"     : signature
        ]
    ]
}
`;

/* ------------------------------ mock ------------------------------ */

let seq = 1000;
export function nextId(): number {
  seq += 1;
  return seq;
}

export function createEmptyAuth(): AuthConfig {
  return {
    id: nextId(),
    name: "",
    authType: "header",
    headers: [],
    enabled: true
  };
}

export function createEmptyInterface(): PartnerInterfaceItem {
  return {
    id: nextId(),
    code: "",
    name: "",
    path: "",
    method: "GET",
    payloadFormat: "json",
    params: [],
    responses: [],
    preProcessor: TEMPLATE_PROCESSOR_VALUE,
    postProcessor: TEMPLATE_PROCESSOR_VALUE,
    price: 0,
    cacheEnabled: false,
    cacheUnit: "minute",
    enabled: true
  };
}

export function createEmptyEnv(): PartnerEnv {
  return { id: nextId(), name: "", code: "", baseUrl: "" };
}

/** 默认环境（`envs[0]`）：接口的完整调用地址由它的 baseUrl 拼出来 */
export function getDefaultEnv(
  partner?: PartnerItem | null
): PartnerEnv | undefined {
  return partner?.envs?.[0];
}

/** 完整调用地址 = 环境地址（去尾斜杠）+ 接口路径（补前导斜杠） */
export function resolveInterfaceUrl(
  baseUrl: string | undefined,
  path: string
): string {
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "");
  const suffix = (path ?? "").trim();
  if (!base) return "";
  if (!suffix) return base;
  return base + (suffix.startsWith("/") ? suffix : `/${suffix}`);
}

export function createEmptyPartner(): PartnerItem {
  return {
    id: nextId(),
    name: "",
    code: "",
    scope: ["全国"],
    contact: "",
    phone: "",
    status: 2,
    createTime: "",
    envs: [{ ...createEmptyEnv(), name: "生产环境", code: "prod" }],
    charset: "UTF-8",
    connectTimeout: 3000,
    readTimeout: 5000,
    useProxy: false,
    authConfigs: [],
    qps: 10,
    dailyLimit: 100000,
    concurrency: 5,
    retryTimes: 2,
    retryInterval: 500,
    breakerThreshold: 10,
    breakerRecoverMin: 5,
    cacheTtl: 0,
    cacheEnabled: false,
    cacheUnit: "minute",
    billingType: "per_call",
    unitPrice: 0,
    quotaTotal: 0,
    quotaUsed: 0,
    warnThreshold: 20,
    settleType: "prepaid",
    balance: 0,
    interfaces: []
  };
}

const basePartner = createEmptyPartner();

export const mockPartners: PartnerItem[] = [
  {
    ...basePartner,
    id: 1,
    name: "中科数据科技有限公司",
    code: "PT-0001",
    scope: ["全国"],
    website: "https://www.qcc-like.com",
    contact: "张伟",
    phone: "13800001234",
    email: "zhangwei@zkdata.com",
    supportPhone: "400-800-1234",
    status: 1,
    cooperateStart: "2026-01-01",
    cooperateEnd: "2027-12-31",
    createTime: "2026-01-08 09:12:00",
    remark: "工商 + 司法涉诉主供应商，季度对账",
    envs: [
      {
        id: 101,
        name: "生产环境",
        code: "prod",
        baseUrl: "https://api.zkdata.com"
      },
      {
        id: 102,
        name: "测试环境",
        code: "test",
        baseUrl: "https://api-test.zkdata.com"
      },
      {
        id: 103,
        name: "集成环境",
        code: "sit",
        baseUrl: "https://api-sit.zkdata.com",
        remark: "联调用，仅内网可访问"
      }
    ],
    authConfigs: [
      {
        id: 11,
        name: "公共请求头",
        authType: "header",
        headers: [
          { key: "X-App-Key", value: "zk_9f3a2c71" },
          { key: "Accept", value: "application/json" }
        ],
        enabled: true
      },
      {
        id: 12,
        name: "备用签名脚本",
        authType: "script",
        scriptLang: "groovy",
        scriptTimeout: 3000,
        scriptVersion: 1,
        scriptCode: groovyScriptTemplate,
        enabled: false
      }
    ],
    qps: 20,
    dailyLimit: 200000,
    concurrency: 8,
    retryTimes: 2,
    retryInterval: 500,
    breakerThreshold: 10,
    breakerRecoverMin: 5,
    cacheTtl: 5,
    cacheEnabled: true,
    cacheUnit: "minute",
    alarmReceiver: "ops@carbon.io",
    billingType: "per_call",
    unitPrice: 0.5,
    quotaTotal: 100000,
    quotaUsed: 3240,
    warnThreshold: 20,
    settleType: "monthly",
    balance: 5000,
    contractNo: "HT-2026-0118",
    interfaces: [
      {
        id: 101,
        code: "ZK_ENT_BASE",
        preProcessor: "parser",
        preParserId: 5001,
        postProcessor: "parser",
        postParserId: 5002,
        name: "企业工商基本信息",
        path: "/api/ent/base",
        method: "GET",
        payloadFormat: "json",
        authId: 11,
        params: [
          {
            id: 10101,
            name: "keyword",
            location: "query",
            type: "string",
            required: true,
            desc: "企业名称或统一社会信用代码",
            defaultValue: "阿里巴巴（中国）有限公司"
          },
          {
            id: 10102,
            name: "X-Request-Id",
            location: "header",
            type: "string",
            required: false,
            desc: "调用方请求追踪号"
          }
        ],
        responses: [
          {
            id: 10103,
            name: "entName",
            path: "data.entName",
            type: "string",
            desc: "企业名称"
          },
          {
            id: 10104,
            name: "regNo",
            path: "data.regNo",
            type: "string",
            desc: "统一社会信用代码"
          },
          {
            id: 10105,
            name: "regCapital",
            path: "data.regCapital",
            type: "number",
            desc: "注册资本（万元）"
          },
          {
            id: 10106,
            name: "status",
            path: "data.status",
            type: "string",
            checkMode: "value",
            checkValue: "200",
            desc: "经营状态"
          }
        ],
        price: 0.5,
        dailyLimit: 10000,
        enabled: true,
        createTime: "2025-11-03 09:10:00",
        lastCallTime: "2026-10-29 14:22:10"
      },
      {
        id: 102,
        code: "ZK_ENT_PARTNER",
        preProcessor: "parser",
        preParserId: 5001,
        postProcessor: "parser",
        postParserId: 5002,
        name: "股东信息",
        path: "/api/ent/partner",
        method: "GET",
        payloadFormat: "json",
        authId: 11,
        params: [
          {
            id: 10201,
            name: "keyword",
            location: "query",
            type: "string",
            required: true,
            desc: "企业名称或统一社会信用代码"
          },
          {
            id: 10202,
            name: "pageSize",
            location: "query",
            type: "int",
            required: false,
            desc: "返回条数，默认 20",
            defaultValue: "20"
          }
        ],
        responses: [
          {
            id: 10203,
            name: "name",
            path: "data.list[].name",
            type: "string",
            desc: "股东名称"
          },
          {
            id: 10204,
            name: "ratio",
            path: "data.list[].ratio",
            type: "number",
            desc: "持股比例（%）"
          },
          {
            id: 10205,
            name: "total",
            path: "data.total",
            type: "int",
            desc: "总条数"
          }
        ],
        price: 0.8,
        dailyLimit: 5000,
        enabled: true,
        createTime: "2025-11-03 09:40:00",
        lastCallTime: "2026-10-29 11:03:42"
      },
      {
        id: 103,
        code: "ZK_ENT_LAWSUIT",
        preProcessor: "parser",
        preParserId: 5001,
        postProcessor: "parser",
        postParserId: 5002,
        name: "司法涉诉",
        path: "/api/ent/lawsuit",
        method: "POST",
        payloadFormat: "json",
        authId: 12,
        params: [
          {
            id: 10301,
            name: "regNo",
            location: "body",
            type: "string",
            required: true,
            desc: "统一社会信用代码"
          },
          {
            id: 10302,
            name: "needDetail",
            location: "body",
            type: "boolean",
            required: false,
            desc: "是否返回案件详情"
          },
          {
            id: 10303,
            name: "X-Trace",
            location: "header",
            type: "string",
            required: false,
            desc: "溯源开关"
          }
        ],
        responses: [
          {
            id: 10304,
            name: "caseNo",
            path: "data.list[].caseNo",
            type: "string",
            desc: "案号"
          },
          {
            id: 10305,
            name: "cause",
            path: "data.list[].cause",
            type: "string",
            desc: "案由"
          },
          {
            id: 10306,
            name: "count",
            path: "data.count",
            type: "int",
            desc: "命中数量"
          }
        ],
        price: 1.2,
        dailyLimit: 2000,
        enabled: false,
        createTime: "2025-11-12 15:20:00",
        lastCallTime: "2026-10-20 09:15:00"
      }
    ]
  },
  {
    ...basePartner,
    id: 2,
    name: "企信通信息服务有限公司",
    code: "PT-0002",
    scope: ["全国", "省级"],
    website: "https://www.qixintong.com",
    contact: "李娜",
    phone: "13900002345",
    email: "lina@qixintong.com",
    status: 1,
    cooperateStart: "2026-02-01",
    cooperateEnd: "2027-01-31",
    createTime: "2026-02-12 10:20:00",
    remark: "接口签名规则复杂，使用 Groovy 脚本完成鉴权",
    envs: [
      {
        id: 111,
        name: "生产环境",
        code: "prod",
        baseUrl: "https://open.qixintong.com"
      },
      {
        id: 112,
        name: "测试环境",
        code: "test",
        baseUrl: "https://open-test.qixintong.com"
      }
    ],
    authConfigs: [
      {
        id: 21,
        name: "复杂签名脚本",
        authType: "script",
        scriptLang: "groovy",
        scriptTimeout: 3000,
        scriptVersion: 3,
        scriptCode: groovyScriptTemplate,
        enabled: true
      }
    ],
    qps: 10,
    dailyLimit: 50000,
    concurrency: 5,
    retryTimes: 1,
    retryInterval: 800,
    cacheTtl: 10,
    cacheEnabled: true,
    cacheUnit: "minute",
    billingType: "package",
    unitPrice: 0.35,
    quotaTotal: 200000,
    quotaUsed: 48000,
    warnThreshold: 15,
    settleType: "prepaid",
    balance: 12000,
    contractNo: "HT-2026-0221",
    interfaces: [
      {
        id: 201,
        code: "QXT_ENT_BASE",
        preProcessor: "parser",
        preParserId: 5003,
        postProcessor: "parser",
        postParserId: 5004,
        name: "企业工商基本信息",
        path: "/open/ent/base",
        method: "GET",
        payloadFormat: "json",
        authId: 21,
        params: [
          {
            id: 20101,
            name: "keyword",
            location: "query",
            type: "string",
            required: true,
            desc: "企业名称 / 信用代码 / 注册号"
          },
          {
            id: 20102,
            name: "apiVersion",
            location: "query",
            type: "string",
            required: false,
            desc: "固定 v2"
          }
        ],
        responses: [
          {
            id: 20103,
            name: "entName",
            path: "data.entName",
            type: "string",
            desc: "企业名称"
          },
          {
            id: 20104,
            name: "creditCode",
            path: "data.creditCode",
            type: "string",
            desc: "统一社会信用代码"
          }
        ],
        price: 0.35,
        dailyLimit: 20000,
        enabled: true,
        createTime: "2025-12-01 10:05:00",
        lastCallTime: "2026-10-29 13:40:05"
      },
      {
        id: 202,
        code: "QXT_CREDIT_SCORE",
        preProcessor: "parser",
        preParserId: 5003,
        postProcessor: "parser",
        postParserId: 5004,
        name: "企业信用评分",
        path: "/open/ent/creditScore",
        method: "GET",
        payloadFormat: "json",
        authId: 21,
        params: [
          {
            id: 20201,
            name: "regNo",
            location: "query",
            type: "string",
            required: true,
            desc: "统一社会信用代码"
          }
        ],
        responses: [
          {
            id: 20202,
            name: "score",
            path: "data.score",
            type: "int",
            desc: "信用分 0-1000"
          },
          {
            id: 20203,
            name: "level",
            path: "data.level",
            type: "string",
            desc: "等级 A/B/C/D"
          },
          {
            id: 20204,
            name: "updatedAt",
            path: "data.updatedAt",
            type: "date",
            desc: "评分更新时间"
          }
        ],
        price: 1.5,
        dailyLimit: 5000,
        enabled: true,
        createTime: "2025-12-01 10:35:00",
        lastCallTime: "2026-10-28 16:12:31"
      }
    ]
  },
  {
    ...basePartner,
    id: 3,
    name: "南方电子档案服务商",
    code: "PT-0003",
    scope: ["省级", "市级"],
    contact: "王强",
    phone: "13700003456",
    email: "wangqiang@nfda.com",
    status: 0,
    cooperateStart: "2025-06-01",
    cooperateEnd: "2026-05-31",
    createTime: "2026-02-02 10:05:00",
    remark: "合同到期未续签，已停用",
    envs: [
      {
        id: 121,
        name: "生产环境",
        code: "prod",
        baseUrl: "https://api.nfda.com.cn"
      }
    ],
    useProxy: true,
    proxyType: "http",
    proxyUrl: "http://10.0.0.8:7890",
    authConfigs: [
      {
        id: 31,
        name: "公共请求头",
        authType: "header",
        headers: [
          { key: "X-Auth-Token", value: "nfda_access_2025" },
          { key: "X-Client", value: "carbon-ui" }
        ],
        enabled: true
      }
    ],
    qps: 5,
    dailyLimit: 10000,
    concurrency: 2,
    retryTimes: 0,
    billingType: "yearly",
    unitPrice: 0,
    quotaTotal: 0,
    quotaUsed: 0,
    settleType: "monthly",
    balance: 0,
    interfaces: [
      {
        id: 301,
        code: "NFDA_OCR_ARCHIVE",
        preProcessor: "parser",
        preParserId: 5005,
        postProcessor: "parser",
        postParserId: 5006,
        name: "档案 OCR 识别",
        path: "/ocr/v2/recognize",
        method: "POST",
        payloadFormat: "form",
        authId: 31,
        params: [
          {
            id: 30101,
            name: "file",
            location: "body",
            type: "object",
            required: true,
            desc: "扫描件，PDF / JPG，单文件 ≤ 10MB"
          },
          {
            id: 30102,
            name: "bizType",
            location: "body",
            type: "string",
            required: true,
            desc: "业务类型，固定 archive"
          }
        ],
        responses: [
          {
            id: 30103,
            name: "text",
            path: "data.text",
            type: "string",
            desc: "全文识别结果"
          },
          {
            id: 30104,
            name: "fields",
            path: "data.fields",
            type: "object",
            desc: "结构化字段"
          }
        ],
        price: 0,
        enabled: false,
        createTime: "2026-01-05 14:00:00",
        lastCallTime: "2026-04-18 08:00:00"
      }
    ]
  },
  {
    ...basePartner,
    id: 4,
    name: "北斗位置服务有限公司",
    code: "PT-0004",
    scope: ["全国"],
    website: "https://www.beidou-lbs.com",
    contact: "赵敏",
    phone: "13600004567",
    email: "zhaomin@beidou-lbs.com",
    status: 1,
    cooperateStart: "2026-03-01",
    cooperateEnd: "2028-02-29",
    createTime: "2026-03-05 14:30:00",
    envs: [
      {
        id: 131,
        name: "生产环境",
        code: "prod",
        baseUrl: "https://restapi.beidou-lbs.com"
      },
      {
        id: 132,
        name: "测试环境",
        code: "test",
        baseUrl: "https://restapi-test.beidou-lbs.com"
      }
    ],
    authConfigs: [
      {
        id: 41,
        name: "公共请求头",
        authType: "header",
        headers: [
          { key: "Authorization", value: "Bearer bd_token_prod" },
          { key: "Accept", value: "application/json" }
        ],
        enabled: true
      },
      {
        id: 42,
        name: "签名脚本",
        authType: "script",
        scriptLang: "groovy",
        scriptTimeout: 2000,
        scriptVersion: 2,
        scriptCode: groovyScriptTemplate,
        enabled: false
      }
    ],
    qps: 50,
    dailyLimit: 500000,
    concurrency: 20,
    retryTimes: 3,
    retryInterval: 300,
    breakerThreshold: 20,
    breakerRecoverMin: 3,
    cacheTtl: 1,
    cacheEnabled: true,
    cacheUnit: "hour",
    alarmReceiver: "lbs-alert@carbon.io",
    billingType: "per_call",
    unitPrice: 0.02,
    quotaTotal: 1000000,
    quotaUsed: 128400,
    warnThreshold: 25,
    settleType: "monthly",
    balance: 8600,
    contractNo: "HT-2026-0301",
    interfaces: [
      {
        id: 401,
        code: "BD_GEOCODE",
        preProcessor: "parser",
        preParserId: 5007,
        postProcessor: "parser",
        postParserId: 5008,
        name: "地址解析",
        path: "/geo/geocode",
        method: "GET",
        payloadFormat: "json",
        authId: 41,
        params: [
          {
            id: 40101,
            name: "address",
            location: "query",
            type: "string",
            required: true,
            desc: "结构化地址"
          },
          {
            id: 40102,
            name: "city",
            location: "query",
            type: "string",
            required: false,
            desc: "城市名，提升精度"
          }
        ],
        responses: [
          {
            id: 40103,
            name: "lng",
            path: "data.lng",
            type: "number",
            desc: "经度"
          },
          {
            id: 40104,
            name: "lat",
            path: "data.lat",
            type: "number",
            desc: "纬度"
          },
          {
            id: 40105,
            name: "precision",
            path: "data.precision",
            type: "string",
            desc: "匹配级别"
          }
        ],
        price: 0.02,
        dailyLimit: 200000,
        enabled: true,
        createTime: "2026-02-18 09:30:00",
        lastCallTime: "2026-10-29 15:01:22"
      },
      {
        id: 402,
        code: "BD_REGEO",
        preProcessor: "parser",
        preParserId: 5007,
        postProcessor: "parser",
        postParserId: 5008,
        name: "逆地址解析",
        path: "/geo/regeo",
        method: "GET",
        payloadFormat: "json",
        authId: 41,
        params: [
          {
            id: 40201,
            name: "lng",
            location: "query",
            type: "number",
            required: true,
            desc: "经度"
          },
          {
            id: 40202,
            name: "lat",
            location: "query",
            type: "number",
            required: true,
            desc: "纬度"
          }
        ],
        responses: [
          {
            id: 40203,
            name: "address",
            path: "data.address",
            type: "string",
            desc: "完整地址"
          },
          {
            id: 40204,
            name: "adcode",
            path: "data.adcode",
            type: "string",
            desc: "行政区划编码"
          }
        ],
        price: 0.02,
        dailyLimit: 200000,
        enabled: true,
        createTime: "2026-02-18 09:45:00",
        lastCallTime: "2026-10-29 15:01:20"
      }
    ]
  },
  {
    ...basePartner,
    id: 5,
    name: "西南政务数据运营方",
    code: "PT-0005",
    scope: ["省级", "市级"],
    contact: "陈刚",
    phone: "13500005678",
    email: "chengang@swgov-data.cn",
    supportPhone: "028-8888-6666",
    status: 2,
    cooperateStart: "2026-04-01",
    cooperateEnd: "2027-03-31",
    createTime: "2026-03-04 08:21:00",
    remark: "联调中，仅开放测试环境",
    envs: [
      {
        id: 141,
        name: "开发环境",
        code: "dev",
        baseUrl: "https://api-dev.swgov-data.cn"
      },
      {
        id: 142,
        name: "生产环境",
        code: "prod",
        baseUrl: "https://api.swgov-data.cn",
        remark: "未开通"
      },
      {
        id: 143,
        name: "测试环境",
        code: "test",
        baseUrl: "https://api-test.swgov-data.cn"
      }
    ],
    authConfigs: [
      {
        id: 51,
        name: "公共请求头",
        authType: "header",
        headers: [{ key: "X-Gov-Token", value: "swgov_key_2026" }],
        enabled: true
      }
    ],
    qps: 5,
    dailyLimit: 20000,
    concurrency: 3,
    retryTimes: 2,
    retryInterval: 1000,
    cacheTtl: 0,
    cacheEnabled: false,
    cacheUnit: "minute",
    billingType: "free",
    unitPrice: 0,
    quotaTotal: 0,
    quotaUsed: 0,
    settleType: "monthly",
    balance: 0,
    interfaces: [
      {
        id: 501,
        code: "XN_ENT_TAX",
        preProcessor: "parser",
        preParserId: 5009,
        postProcessor: "parser",
        postParserId: 5010,
        name: "企业纳税信息",
        path: "/gov/tax/ent",
        method: "GET",
        payloadFormat: "json",
        authId: 51,
        params: [
          {
            id: 50101,
            name: "regNo",
            location: "query",
            type: "string",
            required: true,
            desc: "统一社会信用代码"
          }
        ],
        responses: [
          {
            id: 50102,
            name: "taxLevel",
            path: "data.taxLevel",
            type: "string",
            desc: "纳税信用等级"
          },
          {
            id: 50103,
            name: "year",
            path: "data.year",
            type: "int",
            desc: "评定年度"
          }
        ],
        price: 0,
        dailyLimit: 5000,
        enabled: true,
        createTime: "2026-03-05 16:10:00",
        lastCallTime: "2026-10-29 09:12:00"
      }
    ]
  }
];

export function getPartnerById(id: string | number): PartnerItem | null {
  return mockPartners.find(item => item.id === Number(id)) ?? null;
}

/** 批量删除，返回实际删除条数 */
/** 切换合作方状态：启用(1) ↔ 停用(0)。「测试中」(2) 一律落到启用 */
export function togglePartnerStatus(id: number): boolean {
  const target = mockPartners.find(item => item.id === id);
  if (!target) return false;
  target.status = target.status === 1 ? 0 : 1;
  return true;
}

export function deletePartners(ids: number[]): number {
  const wanted = new Set(ids);
  let removed = 0;
  for (let index = mockPartners.length - 1; index >= 0; index -= 1) {
    if (wanted.has(mockPartners[index].id)) {
      mockPartners.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}
