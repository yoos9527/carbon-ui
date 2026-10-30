/**
 * 数据服务商接入管理台：后端 API 共享类型。
 *
 * 契约来源：docs/service-api-design.md
 * 所有接口成功时返回 `{ success: true, data }`，错误时返回
 * `{ success: false, error: { code, message, details }, traceId? }`。
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CollectionResult<T> {
  items: T[];
}

export interface RevisionedCollectionResult<T> extends CollectionResult<T> {
  revision: number;
}

export type PartnerStatus = 0 | 1 | 2;

export interface PartnerBase {
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
}

export interface PartnerListItem extends PartnerBase {
  interfaceCount: number;
  enabledInterfaceCount: number;
  revision: number;
}

/** 详情与列表项字段一致，保留独立命名方便未来扩展 */
export type PartnerDetail = PartnerListItem;

export interface PartnerEnv {
  /** 新建行可不传，由服务端生成 */
  id?: number;
  name: string;
  code: string;
  baseUrl: string;
  remark?: string;
}

export type PartnerEnvInput = Omit<PartnerEnv, "id"> & { id?: number };

export interface NetworkConfig {
  charset: string;
  connectTimeout: number;
  readTimeout: number;
  useProxy: boolean;
  proxyType?: "http" | "socks5";
  proxyUrl?: string;
  revision: number;
}

export type NetworkConfigInput = Omit<NetworkConfig, "revision"> & {
  revision: number;
};

export interface PolicyConfig {
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

export type PolicyConfigInput = Omit<PolicyConfig, "revision"> & {
  revision: number;
};

export interface BillingConfig {
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

export type BillingConfigInput = Omit<BillingConfig, "revision"> & {
  revision: number;
};

export type PartnerBaseInput = Omit<PartnerBase, "id" | "createTime">;

export interface PartnerCreateInput extends PartnerBaseInput {
  envs: PartnerEnvInput[];
}

export type PartnerUpdateInput = Omit<PartnerBaseInput, "code"> & {
  revision: number;
};

export interface PartnerListQuery {
  name?: string;
  status?: PartnerStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "createTime" | "name";
  sortOrder?: "asc" | "desc";
}

export interface PartnerStatusInput {
  status: PartnerStatus;
  revision: number;
}

export interface KV {
  key: string;
  value: string;
}

export type AuthType = "header" | "script";

export interface AuthConfig {
  id: number;
  name: string;
  authType: AuthType;
  headers?: KV[];
  scriptLang?: "groovy";
  scriptCode?: string;
  scriptTimeout?: number;
  scriptVersion?: number;
  enabled: boolean;
  revision: number;
}

export type AuthConfigInput = Omit<AuthConfig, "id" | "revision">;

export interface AuthConfigUpdateInput extends AuthConfigInput {
  revision: number;
}

export interface ScriptValidationResult {
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

export type ParamLocation = "query" | "body" | "path" | "header";

export type FieldType =
  | "string"
  | "int"
  | "long"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "date";

export interface InterfaceParam {
  id?: number;
  name: string;
  location: ParamLocation;
  type: FieldType;
  required: boolean;
  desc?: string;
  defaultValue?: string;
}

export interface InterfaceResponseField {
  id?: number;
  name: string;
  path: string;
  type: FieldType;
  checkMode?: "value" | "notEmpty";
  checkValue?: string;
  desc?: string;
}

export type ProcessorType = "template" | "parser";

export interface InterfaceBase {
  id: number;
  partnerId: number;
  code: string;
  name: string;
  path: string;
  method: "GET" | "POST";
  payloadFormat: "json" | "xml" | "form";
  authId?: number;
  params: InterfaceParam[];
  responses: InterfaceResponseField[];
  preProcessor?: ProcessorType;
  preTemplate?: string;
  preParserId?: number;
  postProcessor?: ProcessorType;
  postTemplate?: string;
  postParserId?: number;
  timeout?: number;
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
  createTime?: string;
  lastCallTime?: string;
}

export type InterfaceInput = Omit<
  InterfaceBase,
  "id" | "createTime" | "lastCallTime"
>;

export type InterfaceUpdateInput = Omit<
  InterfaceInput,
  "partnerId" | "code"
> & { revision: number };

export interface InterfaceListItem extends InterfaceBase {
  partnerName: string;
  partnerCode: string;
  partnerStatus: PartnerStatus;
  authName?: string;
  authType?: AuthType;
  fullUrl: string;
  revision: number;
}

export type InterfaceDetail = InterfaceListItem;

export interface InterfaceListQuery {
  keyword?: string;
  partnerId?: number;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "createTime" | "lastCallTime" | "name";
  sortOrder?: "asc" | "desc";
}

export interface InterfaceStatusInput {
  enabled: boolean;
  revision: number;
}

export interface InterfaceStats {
  total: number;
  enabled: number;
  disabled: number;
}

export type ParserKind = "pre" | "post";

export interface ParserItem {
  id: number;
  code: string;
  name: string;
  kind: ParserKind;
  desc?: string;
  scriptCode: string;
  scriptTimeout: number;
  scriptVersion: number;
  enabled: boolean;
  createTime: string;
  updateTime: string;
  referenceCount: number;
  revision: number;
}

export type ParserInput = Omit<
  ParserItem,
  | "id"
  | "scriptVersion"
  | "createTime"
  | "updateTime"
  | "referenceCount"
  | "revision"
>;

export type ParserUpdateInput = Omit<ParserInput, "code" | "kind"> & {
  revision: number;
};

export interface ParserVersion {
  version: number;
  code: string;
  time: string;
}

export interface ParserListQuery {
  keyword?: string;
  kind?: ParserKind;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "updateTime" | "name";
  sortOrder?: "asc" | "desc";
}

export interface ParserStatusInput {
  enabled: boolean;
  revision: number;
}

export interface ParserStats {
  total: number;
  pre: number;
  post: number;
}

export interface ImportIssue {
  /** 含表头，从 1 开始；0 表示整表问题 */
  line: number;
  field?: string;
  message: string;
}

export interface ImportValidationItem<T> {
  line: number;
  action: "create" | "update";
  targetId?: number;
  data: T;
  issues: ImportIssue[];
}

export interface ImportValidationResult<T> {
  items: Array<ImportValidationItem<T>>;
  summary: {
    total: number;
    valid: number;
    created: number;
    updated: number;
    invalid: number;
  };
  issues: ImportIssue[];
}

export interface ImportCommitRequest<T> {
  items: Array<{
    line: number;
    data: T;
  }>;
}

export interface ImportCommitResult {
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

export interface DownloadedFile {
  blob: Blob;
  /** 从 Content-Disposition 解析；没有时由调用方回退 */
  filename?: string;
}
