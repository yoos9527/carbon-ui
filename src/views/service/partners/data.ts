/** 键值对（公共请求头、接口独立参数等） */
export interface KV {
  key: string;
  value: string;
}

/** 服务商能力类型 */
export type ProviderType =
  | "business"
  | "justice"
  | "credit"
  | "telecom"
  | "tax"
  | "map"
  | "ocr"
  | "sms"
  | "other";

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

/** 单个接口（能力）配置，只存与合作方公共配置不同的部分 */
export interface PartnerInterfaceItem {
  id: number;
  /** 能力名称，如「企业工商基本信息」 */
  name: string;
  /** 接口路径，如 /api/ent/base */
  path: string;
  method: "GET" | "POST";
  payloadFormat: "json" | "xml" | "form";
  /** 引用 AuthConfig.id */
  authId?: number;
  /** 覆盖 / 追加鉴权配置里的请求头 */
  extraHeaders: KV[];
  /** 接口独有请求参数 */
  extraParams: KV[];
  /** 覆盖合作方默认超时 */
  timeout?: number;
  price: number;
  dailyLimit?: number;
  enabled: boolean;
  lastCallTime?: string;
}

/** 合作方接入档案 */
export interface PartnerItem {
  id: number;
  name: string;
  code: string;
  types: ProviderType[];
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

  /** 环境与网络（合作方公共） */
  baseUrlProd: string;
  baseUrlTest?: string;
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

export const providerTypeOptions: { label: string; value: ProviderType }[] = [
  { label: "工商数据", value: "business" },
  { label: "司法涉诉", value: "justice" },
  { label: "征信数据", value: "credit" },
  { label: "运营商", value: "telecom" },
  { label: "税务", value: "tax" },
  { label: "地图", value: "map" },
  { label: "OCR 识别", value: "ocr" },
  { label: "短信", value: "sms" },
  { label: "其他", value: "other" }
];

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

export function getPartnerTypeLabel(type: ProviderType): string {
  return providerTypeOptions.find(item => item.value === type)?.label ?? type;
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
    name: "",
    path: "",
    method: "GET",
    payloadFormat: "json",
    extraHeaders: [],
    extraParams: [],
    price: 0,
    enabled: true
  };
}

export function createEmptyPartner(): PartnerItem {
  return {
    id: nextId(),
    name: "",
    code: "",
    types: [],
    scope: ["全国"],
    contact: "",
    phone: "",
    status: 2,
    createTime: "",
    baseUrlProd: "",
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
    types: ["business", "justice"],
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
    baseUrlProd: "https://api.zkdata.com",
    baseUrlTest: "https://api-test.zkdata.com",
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
    cacheTtl: 300,
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
        name: "企业工商基本信息",
        path: "/api/ent/base",
        method: "GET",
        payloadFormat: "json",
        authId: 11,
        extraHeaders: [],
        extraParams: [],
        price: 0.5,
        dailyLimit: 10000,
        enabled: true,
        lastCallTime: "2026-10-29 14:22:10"
      },
      {
        id: 102,
        name: "股东信息",
        path: "/api/ent/partner",
        method: "GET",
        payloadFormat: "json",
        authId: 11,
        extraHeaders: [],
        extraParams: [],
        price: 0.8,
        dailyLimit: 5000,
        enabled: true,
        lastCallTime: "2026-10-29 11:03:42"
      },
      {
        id: 103,
        name: "司法涉诉",
        path: "/api/ent/lawsuit",
        method: "POST",
        payloadFormat: "json",
        authId: 12,
        extraHeaders: [{ key: "X-Trace", value: "on" }],
        extraParams: [{ key: "needDetail", value: "1" }],
        price: 1.2,
        dailyLimit: 2000,
        enabled: false,
        lastCallTime: "2026-10-20 09:15:00"
      }
    ]
  },
  {
    ...basePartner,
    id: 2,
    name: "企信通信息服务有限公司",
    code: "PT-0002",
    types: ["business", "credit"],
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
    baseUrlProd: "https://open.qixintong.com",
    baseUrlTest: "https://open-test.qixintong.com",
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
    cacheTtl: 600,
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
        name: "企业工商基本信息",
        path: "/open/ent/base",
        method: "GET",
        payloadFormat: "json",
        authId: 21,
        extraHeaders: [],
        extraParams: [],
        price: 0.35,
        dailyLimit: 20000,
        enabled: true,
        lastCallTime: "2026-10-29 13:40:05"
      },
      {
        id: 202,
        name: "企业信用评分",
        path: "/open/ent/creditScore",
        method: "GET",
        payloadFormat: "json",
        authId: 21,
        extraHeaders: [],
        extraParams: [],
        price: 1.5,
        dailyLimit: 5000,
        enabled: true,
        lastCallTime: "2026-10-28 16:12:31"
      }
    ]
  },
  {
    ...basePartner,
    id: 3,
    name: "南方电子档案服务商",
    code: "PT-0003",
    types: ["ocr", "other"],
    scope: ["省级", "市级"],
    contact: "王强",
    phone: "13700003456",
    email: "wangqiang@nfda.com",
    status: 0,
    cooperateStart: "2025-06-01",
    cooperateEnd: "2026-05-31",
    createTime: "2026-02-02 10:05:00",
    remark: "合同到期未续签，已停用",
    baseUrlProd: "https://api.nfda.com.cn",
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
        name: "档案 OCR 识别",
        path: "/ocr/v2/recognize",
        method: "POST",
        payloadFormat: "form",
        authId: 31,
        extraHeaders: [],
        extraParams: [],
        price: 0,
        enabled: false,
        lastCallTime: "2026-04-18 08:00:00"
      }
    ]
  },
  {
    ...basePartner,
    id: 4,
    name: "北斗位置服务有限公司",
    code: "PT-0004",
    types: ["map", "telecom"],
    scope: ["全国"],
    website: "https://www.beidou-lbs.com",
    contact: "赵敏",
    phone: "13600004567",
    email: "zhaomin@beidou-lbs.com",
    status: 1,
    cooperateStart: "2026-03-01",
    cooperateEnd: "2028-02-29",
    createTime: "2026-03-05 14:30:00",
    baseUrlProd: "https://restapi.beidou-lbs.com",
    baseUrlTest: "https://restapi-test.beidou-lbs.com",
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
    cacheTtl: 60,
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
        name: "地址解析",
        path: "/geo/geocode",
        method: "GET",
        payloadFormat: "json",
        authId: 41,
        extraHeaders: [],
        extraParams: [],
        price: 0.02,
        dailyLimit: 200000,
        enabled: true,
        lastCallTime: "2026-10-29 15:01:22"
      },
      {
        id: 402,
        name: "逆地址解析",
        path: "/geo/regeo",
        method: "GET",
        payloadFormat: "json",
        authId: 41,
        extraHeaders: [],
        extraParams: [],
        price: 0.02,
        dailyLimit: 200000,
        enabled: true,
        lastCallTime: "2026-10-29 15:01:20"
      }
    ]
  },
  {
    ...basePartner,
    id: 5,
    name: "西南政务数据运营方",
    code: "PT-0005",
    types: ["tax", "justice"],
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
    baseUrlProd: "https://api.swgov-data.cn",
    baseUrlTest: "https://api-test.swgov-data.cn",
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
    billingType: "free",
    unitPrice: 0,
    quotaTotal: 0,
    quotaUsed: 0,
    settleType: "monthly",
    balance: 0,
    interfaces: [
      {
        id: 501,
        name: "企业纳税信息",
        path: "/gov/tax/ent",
        method: "GET",
        payloadFormat: "json",
        authId: 51,
        extraHeaders: [],
        extraParams: [],
        price: 0,
        dailyLimit: 5000,
        enabled: true,
        lastCallTime: "2026-10-29 09:12:00"
      }
    ]
  }
];

export function getPartnerById(id: string | number): PartnerItem | null {
  return mockPartners.find(item => item.id === Number(id)) ?? null;
}
