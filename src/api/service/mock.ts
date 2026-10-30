/**
 * 开发态 mock 后端：只在 `DEV && VITE_API_MOCK=true` 时动态加载。
 *
 * 直接复用页面现有的 `data.ts` / `csv.ts` 数据与规则，避免再接一套假数据；
 * 生产构建里该模块不会被引入。
 */
import { ApiRequestError } from "@/utils/http/error";
import {
  createEmptyAuth,
  createEmptyInterface,
  createEmptyPartner,
  getDefaultEnv,
  mockPartners,
  nextId,
  resolveInterfaceUrl,
  type AuthConfig as MockAuthConfig,
  type PartnerInterfaceItem,
  type PartnerItem
} from "@/views/service/partners/data";
import {
  findParserRefs,
  mockParsers,
  type ParserItem as MockParserItem
} from "@/views/service/parsers/data";
import { getInterfaceRows } from "@/views/service/interfaces/data";
import {
  planImport as planPartnerImport,
  toCsv as partnersToCsv,
  toCsvTemplate as partnerCsvTemplate
} from "@/views/service/partners/csv";
import {
  planImport as planInterfaceImport,
  toCsv as interfacesToCsv,
  toCsvTemplate as interfaceCsvTemplate
} from "@/views/service/interfaces/csv";
import type { ApiRequestOptions } from "./client";
import type {
  AuthConfig,
  AuthConfigInput,
  AuthConfigUpdateInput,
  BillingConfig,
  BillingConfigInput,
  DownloadedFile,
  ImportCommitRequest,
  ImportCommitResult,
  ImportValidationResult,
  InterfaceDetail,
  InterfaceInput,
  InterfaceListItem,
  InterfaceStats,
  InterfaceUpdateInput,
  NetworkConfig,
  NetworkConfigInput,
  PageResult,
  PartnerCreateInput,
  PartnerDetail,
  PartnerEnvInput,
  PartnerListQuery,
  PartnerUpdateInput,
  ParserInput,
  ParserItem,
  ParserListQuery,
  ParserStats,
  ParserUpdateInput,
  ParserVersion,
  PolicyConfig,
  PolicyConfigInput,
  ScriptValidationResult
} from "./types";

const partnerRev = new Map<number, number>();
const interfaceRev = new Map<number, number>();
const parserRev = new Map<number, number>();
const authRev = new Map<number, number>();
const configRev = new Map<string, number>();

const now = () =>
  new Date().toLocaleString("zh-CN", {
    hour12: false
  });

function revision(map: Map<number, number>, id: number): number {
  const current = map.get(id);
  if (current === undefined) {
    map.set(id, 1);
    return 1;
  }
  return current;
}

function bump(map: Map<number, number>, id: number): number {
  const next = revision(map, id) + 1;
  map.set(id, next);
  return next;
}

function configRevision(partnerId: number, key: string): number {
  const mapKey = `${partnerId}:${key}`;
  const current = configRev.get(mapKey);
  if (current === undefined) {
    configRev.set(mapKey, 1);
    return 1;
  }
  return current;
}

function bumpConfig(partnerId: number, key: string): number {
  const next = configRevision(partnerId, key) + 1;
  configRev.set(`${partnerId}:${key}`, next);
  return next;
}

function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown
): never {
  throw new ApiRequestError(code, message, {
    status,
    details: details as Record<string, unknown> | undefined
  });
}

function requireRevision(actual: number, expected: number): void {
  if (actual !== expected) {
    fail(409, "REVISION_CONFLICT", "数据已被其他人修改，请刷新后重试");
  }
}

function assertIfMatch(
  headers: Record<string, string> | undefined,
  actual: number
): void {
  const raw = headers?.["If-Match"] ?? headers?.["if-match"];
  if (!raw) fail(400, "IF_MATCH_REQUIRED", "删除请求必须携带 If-Match");
  requireRevision(actual, Number(String(raw).replace(/"/g, "")));
}

function requirePartner(partnerId: number): PartnerItem {
  const partner = mockPartners.find(item => item.id === partnerId);
  if (!partner) fail(404, "PARTNER_NOT_FOUND", "合作方不存在");
  return partner as PartnerItem;
}

function requireInterface(interfaceId: number): {
  partner: PartnerItem;
  item: PartnerInterfaceItem;
} {
  for (const partner of mockPartners) {
    const item = (partner.interfaces ?? []).find(
      entry => entry.id === interfaceId
    );
    if (item) return { partner, item };
  }
  fail(404, "INTERFACE_NOT_FOUND", "接口不存在");
  throw new Error("unreachable");
}

function requireAuth(partnerId: number, authId: number): MockAuthConfig {
  const partner = requirePartner(partnerId);
  const auth = partner.authConfigs.find(item => item.id === authId);
  if (!auth) fail(404, "AUTH_NOT_FOUND", "鉴权配置不存在");
  return auth as MockAuthConfig;
}

function requireParser(parserId: number): MockParserItem {
  const parser = mockParsers.find(item => item.id === parserId);
  if (!parser) fail(404, "PARSER_NOT_FOUND", "解析器不存在");
  return parser as MockParserItem;
}

function paged<T>(items: T[], page = 1, pageSize = 10): PageResult<T> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 10));
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total: items.length,
    page: safePage,
    pageSize: safeSize
  };
}

function toPartnerDetail(partner: PartnerItem): PartnerDetail {
  return {
    id: partner.id,
    name: partner.name,
    code: partner.code,
    scope: partner.scope,
    website: partner.website,
    contact: partner.contact,
    phone: partner.phone,
    email: partner.email,
    supportPhone: partner.supportPhone,
    status: partner.status,
    cooperateStart: partner.cooperateStart,
    cooperateEnd: partner.cooperateEnd,
    createTime: partner.createTime,
    remark: partner.remark,
    interfaceCount: partner.interfaces?.length ?? 0,
    enabledInterfaceCount:
      partner.interfaces?.filter(item => item.enabled).length ?? 0,
    revision: revision(partnerRev, partner.id)
  };
}

function toInterfaceDetail(
  partner: PartnerItem,
  item: PartnerInterfaceItem
): InterfaceDetail {
  const auth = partner.authConfigs.find(entry => entry.id === item.authId);
  return {
    ...item,
    partnerId: partner.id,
    createTime: item.createTime,
    lastCallTime: item.lastCallTime,
    partnerName: partner.name,
    partnerCode: partner.code,
    partnerStatus: partner.status,
    authName: auth?.name,
    authType: auth?.authType,
    fullUrl: resolveInterfaceUrl(getDefaultEnv(partner)?.baseUrl, item.path),
    revision: revision(interfaceRev, item.id)
  };
}

function toParserItem(parser: MockParserItem): ParserItem {
  return {
    id: parser.id,
    code: parser.code,
    name: parser.name,
    kind: parser.kind,
    desc: parser.desc,
    scriptCode: parser.scriptCode,
    scriptTimeout: parser.scriptTimeout,
    scriptVersion: parser.scriptVersion,
    enabled: parser.enabled,
    createTime: parser.createTime,
    updateTime: parser.updateTime,
    referenceCount: findParserRefs(parser.id).length,
    revision: revision(parserRev, parser.id)
  };
}

function networkOf(partner: PartnerItem): NetworkConfig {
  return {
    charset: partner.charset,
    connectTimeout: partner.connectTimeout,
    readTimeout: partner.readTimeout,
    useProxy: partner.useProxy,
    proxyType: partner.proxyType,
    proxyUrl: partner.proxyUrl,
    revision: configRevision(partner.id, "network")
  };
}

function policyOf(partner: PartnerItem): PolicyConfig {
  return {
    qps: partner.qps,
    dailyLimit: partner.dailyLimit,
    concurrency: partner.concurrency,
    retryTimes: partner.retryTimes,
    retryInterval: partner.retryInterval,
    breakerThreshold: partner.breakerThreshold,
    breakerRecoverMin: partner.breakerRecoverMin,
    cacheEnabled: partner.cacheEnabled,
    cacheTtl: partner.cacheTtl,
    cacheUnit: partner.cacheUnit,
    alarmReceiver: partner.alarmReceiver,
    revision: configRevision(partner.id, "policy")
  };
}

function billingOf(partner: PartnerItem): BillingConfig {
  return {
    billingType: partner.billingType,
    unitPrice: partner.unitPrice,
    settleType: partner.settleType,
    contractNo: partner.contractNo,
    balance: partner.balance,
    quotaTotal: partner.quotaTotal,
    quotaUsed: partner.quotaUsed,
    warnThreshold: partner.warnThreshold,
    revision: configRevision(partner.id, "billing")
  };
}

function toAuth(partnerId: number, auth: MockAuthConfig): AuthConfig {
  return {
    ...auth,
    revision: revision(authRev, auth.id)
  };
}

function filterPartners(query: PartnerListQuery): PartnerItem[] {
  const keyword = (query.name ?? "").trim().toLowerCase();
  let list = mockPartners.filter(partner => {
    if (keyword && !partner.name.toLowerCase().includes(keyword)) return false;
    return query.status === undefined || partner.status === query.status;
  });
  const sortBy = query.sortBy ?? "createTime";
  list = list.sort((a, b) =>
    sortBy === "name"
      ? a.name.localeCompare(b.name, "zh-CN")
      : b.createTime.localeCompare(a.createTime)
  );
  if (query.sortOrder === "asc") list = list.reverse();
  return list;
}

function pageOfPartners(query: PartnerListQuery) {
  const list = filterPartners(query);
  return paged(list.map(toPartnerDetail), query.page, query.pageSize);
}

function filterInterfaceRows(query: import("./types").InterfaceListQuery) {
  const keyword = (query.keyword ?? "").trim().toLowerCase();
  let rows = getInterfaceRows().filter(row => {
    if (query.partnerId !== undefined && row.partnerId !== query.partnerId) {
      return false;
    }
    if (query.enabled !== undefined && row.enabled !== query.enabled) {
      return false;
    }
    if (!keyword) return true;
    return [row.name, row.path, row.partnerName].some(value =>
      value.toLowerCase().includes(keyword)
    );
  });
  const sortBy = query.sortBy ?? "createTime";
  rows = rows.sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "zh-CN");
    return (b[sortBy] ?? "").localeCompare(a[sortBy] ?? "");
  });
  if (query.sortOrder === "asc") rows = rows.reverse();
  return rows;
}

function pageOfInterfaces(query: import("./types").InterfaceListQuery) {
  const mapped = filterInterfaceRows(query).map(row => {
    const partner = requirePartner(row.partnerId);
    const item = (partner.interfaces ?? []).find(
      entry => entry.id === row.id
    ) as PartnerInterfaceItem;
    return toInterfaceDetail(partner, item);
  });
  return paged<InterfaceListItem>(mapped, query.page, query.pageSize);
}

function pageOfParsers(query: ParserListQuery) {
  const keyword = (query.keyword ?? "").trim().toLowerCase();
  let list = mockParsers.filter(parser => {
    if (query.kind !== undefined && parser.kind !== query.kind) return false;
    if (query.enabled !== undefined && parser.enabled !== query.enabled) {
      return false;
    }
    if (!keyword) return true;
    return [parser.name, parser.code, parser.desc ?? ""].some(value =>
      value.toLowerCase().includes(keyword)
    );
  });
  const sortBy = query.sortBy ?? "updateTime";
  list = list.sort((a, b) =>
    sortBy === "name"
      ? a.name.localeCompare(b.name, "zh-CN")
      : b.updateTime.localeCompare(a.updateTime)
  );
  if (query.sortOrder === "asc") list = list.reverse();
  return paged(list.map(toParserItem), query.page, query.pageSize);
}

function partnerCreateInput(patch: Partial<PartnerItem>): PartnerCreateInput {
  return {
    name: patch.name ?? "",
    code: patch.code ?? "",
    scope: patch.scope ?? ["全国"],
    website: patch.website,
    contact: patch.contact ?? "",
    phone: patch.phone ?? "",
    email: patch.email,
    supportPhone: patch.supportPhone,
    status: patch.status ?? 1,
    cooperateStart: patch.cooperateStart,
    cooperateEnd: patch.cooperateEnd,
    remark: patch.remark,
    envs: (patch.envs ?? []).map<PartnerEnvInput>(env => ({
      id: env.id,
      name: env.name,
      code: env.code,
      baseUrl: env.baseUrl,
      remark: env.remark
    }))
  };
}

function interfaceCreateInput(
  partnerId: number,
  patch: Partial<PartnerInterfaceItem>
): InterfaceInput {
  const base = createEmptyInterface();
  return {
    ...base,
    partnerId,
    code: patch.code ?? "",
    name: patch.name ?? "",
    path: patch.path ?? "",
    method: patch.method ?? "GET",
    payloadFormat: patch.payloadFormat ?? "json",
    authId: patch.authId,
    params: patch.params ?? [],
    responses: patch.responses ?? [],
    preProcessor: patch.preProcessor,
    preTemplate: patch.preTemplate,
    preParserId: patch.preParserId,
    postProcessor: patch.postProcessor,
    postTemplate: patch.postTemplate,
    postParserId: patch.postParserId,
    timeout: patch.timeout,
    qps: patch.qps,
    concurrency: patch.concurrency,
    retryTimes: patch.retryTimes,
    retryInterval: patch.retryInterval,
    breakerThreshold: patch.breakerThreshold,
    breakerRecoverMin: patch.breakerRecoverMin,
    cacheEnabled: patch.cacheEnabled,
    cacheTtl: patch.cacheTtl,
    cacheUnit: patch.cacheUnit,
    price: patch.price ?? 0,
    dailyLimit: patch.dailyLimit,
    enabled: patch.enabled ?? true
  };
}

function applyPartnerImport(data: PartnerCreateInput) {
  const existing = mockPartners.find(
    item => item.code.toLowerCase() === data.code.toLowerCase()
  );
  if (existing) {
    Object.assign(existing, data, {
      envs: data.envs.map(env => ({ ...env, id: env.id ?? nextId() }))
    });
    bump(partnerRev, existing.id);
    return { action: "update" as const, item: existing };
  }
  const base = createEmptyPartner();
  Object.assign(base, data, {
    id: base.id,
    createTime: now(),
    interfaces: [],
    authConfigs: [],
    envs: data.envs.map(env => ({ ...env, id: env.id ?? nextId() }))
  });
  mockPartners.push(base);
  partnerRev.set(base.id, 1);
  return { action: "create" as const, item: base };
}

function applyInterfaceImport(data: InterfaceInput) {
  const partner = requirePartner(data.partnerId);
  const existing = (partner.interfaces ?? []).find(
    item => item.code.toLowerCase() === data.code.toLowerCase()
  );
  if (existing) {
    Object.assign(existing, data);
    bump(interfaceRev, existing.id);
    return { action: "update" as const, item: existing };
  }
  const base = createEmptyInterface();
  Object.assign(base, data, {
    id: base.id,
    createTime: now()
  });
  partner.interfaces.push(base);
  interfaceRev.set(base.id, 1);
  return { action: "create" as const, item: base };
}

function downloadCsv(content: string, filename: string): DownloadedFile {
  return {
    blob: new Blob([content], { type: "text/csv;charset=utf-8" }),
    filename
  };
}

/** 供 `client.ts` 分发的 mock 请求入口 */
export async function mockApiRequest<T>(
  method: string,
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const params = (options.params ?? {}) as Record<string, unknown>;
  const body = options.data as Record<string, unknown> | undefined;
  const result = route(
    method.toLowerCase(),
    url,
    params,
    body,
    false,
    options.headers
  );
  return result as T;
}

export async function mockApiDownload(
  url: string,
  params: Record<string, unknown> = {}
): Promise<DownloadedFile> {
  return route("get", url, params, undefined, true) as DownloadedFile;
}

export async function mockApiUpload<T>(
  url: string,
  file: File | Blob
): Promise<T> {
  const text = await file.text();
  if (url === "/partners/import/validate") {
    return validatePartnerCsv(text) as T;
  }
  if (url === "/interfaces/import/validate") {
    return validateInterfaceCsv(text) as T;
  }
  fail(404, "NOT_FOUND", "未知的上传接口");
}

function validatePartnerCsv(
  text: string
): ImportValidationResult<PartnerCreateInput> {
  const plan = planPartnerImport(text);
  const items = plan.plan.map((entry, index) => ({
    line: index + 2,
    action: entry.targetId ? ("update" as const) : ("create" as const),
    targetId: entry.targetId,
    data: partnerCreateInput(entry.patch),
    issues: []
  }));
  const invalid = plan.issues.length;
  return {
    items,
    summary: {
      total: items.length + invalid,
      valid: items.length,
      created: plan.created,
      updated: plan.updated,
      invalid
    },
    issues: plan.issues
  };
}

function validateInterfaceCsv(
  text: string
): ImportValidationResult<InterfaceInput> {
  const plan = planInterfaceImport(text);
  const items = plan.plan.map((entry, index) => ({
    line: index + 2,
    action: entry.targetId ? ("update" as const) : ("create" as const),
    targetId: entry.targetId,
    data: interfaceCreateInput(entry.partnerId, entry.patch),
    issues: []
  }));
  const invalid = plan.issues.length;
  return {
    items,
    summary: {
      total: items.length + invalid,
      valid: items.length,
      created: plan.created,
      updated: plan.updated,
      invalid
    },
    issues: plan.issues
  };
}

function commitImport<T>(
  payload: ImportCommitRequest<T>,
  apply: (data: T) => {
    action: "create" | "update";
    item: { id: number; code: string };
  }
): ImportCommitResult {
  const results: ImportCommitResult["results"] = [];
  let created = 0;
  let updated = 0;
  for (const entry of payload.items) {
    try {
      const applied = apply(entry.data);
      if (applied.action === "create") created += 1;
      else updated += 1;
      results.push({
        line: entry.line,
        id: applied.item.id,
        code: applied.item.code,
        action: applied.action,
        issues: []
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入该行失败";
      results.push({
        line: entry.line,
        issues: [{ line: entry.line, message }]
      });
    }
  }
  const failed = results.filter(item => item.issues.length > 0).length;
  return {
    summary: {
      total: payload.items.length,
      succeeded: payload.items.length - failed,
      created,
      updated,
      failed
    },
    results
  };
}

function route(
  method: string,
  url: string,
  params: Record<string, unknown>,
  body: Record<string, unknown> | undefined,
  download = false,
  headers?: Record<string, string>
): unknown {
  if (download) {
    if (url === "/partners/import-template") {
      return downloadCsv(partnerCsvTemplate(), "partners-template.csv");
    }
    if (url === "/partners/export") {
      return downloadCsv(
        partnersToCsv(filterPartners(params as PartnerListQuery)),
        "partners.csv"
      );
    }
    if (url === "/interfaces/import-template") {
      return downloadCsv(interfaceCsvTemplate(), "interfaces-template.csv");
    }
    if (url === "/interfaces/export") {
      return downloadCsv(
        interfacesToCsv(
          filterInterfaceRows(params as import("./types").InterfaceListQuery)
        ),
        "interfaces.csv"
      );
    }
    fail(404, "NOT_FOUND", "未知的下载接口");
  }

  if (url === "/partners" && method === "get") {
    return pageOfPartners(params as PartnerListQuery);
  }
  if (url === "/partners" && method === "post") {
    const data = body as unknown as PartnerCreateInput;
    if (!data.envs?.length) {
      fail(400, "PARTNER_ENV_REQUIRED", "至少配置一个环境");
    }
    if (
      mockPartners.some(
        item => item.code.toLowerCase() === data.code.toLowerCase()
      )
    ) {
      fail(409, "PARTNER_CODE_EXISTS", "合作方编码已存在");
    }
    const applied = applyPartnerImport(data);
    if (applied.action === "update") {
      fail(409, "PARTNER_CODE_EXISTS", "合作方编码已存在");
    }
    return toPartnerDetail(applied.item as PartnerItem);
  }
  if (url === "/partners/import" && method === "post") {
    return commitImport(
      body as unknown as ImportCommitRequest<PartnerCreateInput>,
      data => applyPartnerImport(data)
    );
  }
  if (url === "/interfaces" && method === "get") {
    return pageOfInterfaces(params as import("./types").InterfaceListQuery);
  }
  if (url === "/interfaces/stats" && method === "get") {
    const rows = getInterfaceRows();
    return {
      total: rows.length,
      enabled: rows.filter(item => item.enabled).length,
      disabled: rows.filter(item => !item.enabled).length
    } satisfies InterfaceStats;
  }
  if (url === "/interfaces" && method === "post") {
    const data = body as unknown as InterfaceInput;
    requirePartner(data.partnerId);
    if (
      mockPartners.some(partner =>
        (partner.interfaces ?? []).some(
          item => item.code.toLowerCase() === data.code.toLowerCase()
        )
      )
    ) {
      fail(409, "INTERFACE_CODE_EXISTS", "接口标识已存在");
    }
    const applied = applyInterfaceImport(data);
    if (applied.action === "update") {
      fail(409, "INTERFACE_CODE_EXISTS", "接口标识已存在");
    }
    const { partner, item } = requireInterface(applied.item.id);
    return toInterfaceDetail(partner, item);
  }
  if (url === "/interfaces/import" && method === "post") {
    return commitImport(
      body as unknown as ImportCommitRequest<InterfaceInput>,
      data => applyInterfaceImport(data)
    );
  }
  if (url === "/parsers" && method === "get") {
    return pageOfParsers(params as ParserListQuery);
  }
  if (url === "/parsers/stats" && method === "get") {
    return {
      total: mockParsers.length,
      pre: mockParsers.filter(item => item.kind === "pre").length,
      post: mockParsers.filter(item => item.kind === "post").length
    } satisfies ParserStats;
  }
  if (url === "/parsers" && method === "post") {
    const data = body as unknown as ParserInput;
    if (mockParsers.some(item => item.code === data.code)) {
      fail(409, "PARSER_CODE_EXISTS", "解析器标识已存在");
    }
    const parser: MockParserItem = {
      id: nextId(),
      code: data.code,
      name: data.name,
      kind: data.kind,
      desc: data.desc,
      scriptCode: data.scriptCode,
      scriptTimeout: data.scriptTimeout,
      scriptVersion: 1,
      versions: [],
      enabled: data.enabled,
      createTime: now(),
      updateTime: now()
    };
    mockParsers.push(parser);
    parserRev.set(parser.id, 1);
    return toParserItem(parser);
  }

  let match = /^\/partners\/(\d+)$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    if (method === "get") return toPartnerDetail(partner);
    if (method === "put") {
      const data = body as unknown as PartnerUpdateInput;
      requireRevision(revision(partnerRev, partnerId), data.revision);
      const { revision: _revision, ...patch } = data;
      Object.assign(partner, patch);
      bump(partnerRev, partnerId);
      return toPartnerDetail(partner);
    }
    if (method === "delete") {
      assertIfMatch(headers, revision(partnerRev, partnerId));
      if ((partner.interfaces ?? []).length > 0) {
        fail(409, "PARTNER_HAS_INTERFACES", "合作方下仍有接口，不能删除", {
          interfaceCount: partner.interfaces.length
        });
      }
      mockPartners.splice(mockPartners.indexOf(partner), 1);
      return undefined;
    }
  }

  match = /^\/partners\/(\d+)\/status$/.exec(url);
  if (match && method === "patch") {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    const data = body as { status: 0 | 1 | 2; revision: number };
    requireRevision(revision(partnerRev, partnerId), data.revision);
    partner.status = data.status;
    bump(partnerRev, partnerId);
    return toPartnerDetail(partner);
  }

  match = /^\/partners\/(\d+)\/environments$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    if (method === "get") {
      return {
        items: partner.envs,
        revision: revision(partnerRev, partnerId)
      };
    }
    if (method === "put") {
      const data = body as {
        revision: number;
        items: PartnerEnvInput[];
      };
      requireRevision(revision(partnerRev, partnerId), data.revision);
      partner.envs = data.items.map(item => ({
        ...item,
        id: item.id ?? nextId()
      }));
      bump(partnerRev, partnerId);
      return {
        items: partner.envs,
        revision: revision(partnerRev, partnerId)
      };
    }
  }

  match = /^\/partners\/(\d+)\/network$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    if (method === "get") return networkOf(partner);
    if (method === "put") {
      const data = body as unknown as NetworkConfigInput;
      requireRevision(configRevision(partnerId, "network"), data.revision);
      const { revision: _revision, ...patch } = data;
      Object.assign(partner, patch);
      bumpConfig(partnerId, "network");
      return networkOf(partner);
    }
  }

  match = /^\/partners\/(\d+)\/policy$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    if (method === "get") return policyOf(partner);
    if (method === "put") {
      const data = body as unknown as PolicyConfigInput;
      requireRevision(configRevision(partnerId, "policy"), data.revision);
      const { revision: _revision, ...patch } = data;
      Object.assign(partner, patch);
      bumpConfig(partnerId, "policy");
      return policyOf(partner);
    }
  }

  match = /^\/partners\/(\d+)\/billing$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    if (method === "get") return billingOf(partner);
    if (method === "put") {
      const data = body as unknown as BillingConfigInput;
      requireRevision(configRevision(partnerId, "billing"), data.revision);
      const { revision: _revision, ...patch } = data;
      Object.assign(partner, patch);
      bumpConfig(partnerId, "billing");
      return billingOf(partner);
    }
  }

  match = /^\/partners\/(\d+)\/auth-configs$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const partner = requirePartner(partnerId);
    if (method === "get") {
      return {
        items: partner.authConfigs.map(auth => toAuth(partnerId, auth))
      };
    }
    if (method === "post") {
      const data = body as unknown as AuthConfigInput;
      if (partner.authConfigs.some(auth => auth.name === data.name)) {
        fail(409, "AUTH_NAME_EXISTS", "同一合作方下鉴权名称不能重复");
      }
      const auth: MockAuthConfig = {
        ...createEmptyAuth(),
        ...data
      };
      partner.authConfigs.push(auth);
      authRev.set(auth.id, 1);
      return toAuth(partnerId, auth);
    }
  }

  match = /^\/partners\/(\d+)\/auth-configs\/(\d+)$/.exec(url);
  if (match) {
    const partnerId = Number(match[1]);
    const authId = Number(match[2]);
    const partner = requirePartner(partnerId);
    const auth = requireAuth(partnerId, authId);
    if (method === "put") {
      const data = body as unknown as AuthConfigUpdateInput;
      requireRevision(revision(authRev, authId), data.revision);
      const { revision: _revision, ...patch } = data;
      Object.assign(auth, patch);
      bump(authRev, authId);
      return toAuth(partnerId, auth);
    }
    if (method === "delete") {
      assertIfMatch(headers, revision(authRev, authId));
      const refs = (partner.interfaces ?? []).filter(
        item => item.authId === authId
      );
      if (refs.length) {
        fail(409, "AUTH_IN_USE", "鉴权配置仍被接口引用", {
          interfaces: refs.map(item => ({
            id: item.id,
            code: item.code,
            name: item.name
          }))
        });
      }
      partner.authConfigs.splice(partner.authConfigs.indexOf(auth), 1);
      return undefined;
    }
  }

  match = /^\/partners\/(\d+)\/auth-configs\/script-validations$/.exec(url);
  if (match && method === "post") {
    const data = body as { scriptCode: string; scriptTimeout: number };
    const hasEntry = /def\s+sign\s*\(/.test(data.scriptCode);
    const forbidden =
      /\bSystem\s*\.|\bRuntime\s*\.|java\.net|java\.io|new\s+File/.test(
        data.scriptCode
      );
    const checks = [
      {
        code: "ENTRY_POINT" as const,
        passed: hasEntry,
        message: hasEntry ? "入口 def sign(ctx) 存在" : "缺少入口 def sign(ctx)"
      },
      {
        code: "SANDBOX" as const,
        passed: !forbidden,
        message: forbidden
          ? "脚本包含沙箱禁止的 IO / 网络 / 系统调用"
          : "未发现沙箱禁止的调用"
      }
    ];
    return {
      valid: checks.every(item => item.passed),
      checks,
      durationMs: 1
    } satisfies ScriptValidationResult;
  }

  match = /^\/interfaces\/(\d+)$/.exec(url);
  if (match) {
    const interfaceId = Number(match[1]);
    const { partner, item } = requireInterface(interfaceId);
    if (method === "get") return toInterfaceDetail(partner, item);
    if (method === "put") {
      const data = body as unknown as InterfaceUpdateInput;
      requireRevision(revision(interfaceRev, interfaceId), data.revision);
      const { revision: _revision, ...patch } = data;
      Object.assign(item, patch);
      bump(interfaceRev, interfaceId);
      return toInterfaceDetail(partner, item);
    }
    if (method === "delete") {
      assertIfMatch(headers, revision(interfaceRev, interfaceId));
      partner.interfaces.splice(partner.interfaces.indexOf(item), 1);
      return undefined;
    }
  }

  match = /^\/interfaces\/(\d+)\/status$/.exec(url);
  if (match && method === "patch") {
    const interfaceId = Number(match[1]);
    const { partner, item } = requireInterface(interfaceId);
    const data = body as { enabled: boolean; revision: number };
    requireRevision(revision(interfaceRev, interfaceId), data.revision);
    item.enabled = data.enabled;
    bump(interfaceRev, interfaceId);
    return toInterfaceDetail(partner, item);
  }

  match = /^\/parsers\/(\d+)$/.exec(url);
  if (match) {
    const parserId = Number(match[1]);
    const parser = requireParser(parserId);
    if (method === "get") return toParserItem(parser);
    if (method === "put") {
      const data = body as unknown as ParserUpdateInput;
      requireRevision(revision(parserRev, parserId), data.revision);
      const {
        revision: _revision,
        scriptVersion: _scriptVersion,
        id: _id,
        createTime: _createTime,
        updateTime: _updateTime,
        referenceCount: _referenceCount,
        ...patch
      } = data as ParserUpdateInput & Record<string, unknown>;
      if (
        patch.scriptCode !== undefined &&
        patch.scriptCode !== parser.scriptCode
      ) {
        parser.versions.unshift({
          version: parser.scriptVersion,
          code: parser.scriptCode,
          time: now()
        });
        parser.versions = parser.versions.slice(0, 10);
        parser.scriptVersion += 1;
      }
      Object.assign(parser, patch, { updateTime: now() });
      bump(parserRev, parserId);
      return toParserItem(parser);
    }
    if (method === "delete") {
      assertIfMatch(headers, revision(parserRev, parserId));
      const refs = findParserRefs(parserId);
      if (refs.length) {
        fail(409, "PARSER_IN_USE", "解析器仍被接口引用，不能删除", {
          referenceCount: refs.length,
          interfaces: refs
        });
      }
      mockParsers.splice(mockParsers.indexOf(parser), 1);
      return undefined;
    }
  }

  match = /^\/parsers\/(\d+)\/status$/.exec(url);
  if (match && method === "patch") {
    const parserId = Number(match[1]);
    const parser = requireParser(parserId);
    const data = body as { enabled: boolean; revision: number };
    requireRevision(revision(parserRev, parserId), data.revision);
    parser.enabled = data.enabled;
    bump(parserRev, parserId);
    return toParserItem(parser);
  }

  match = /^\/parsers\/(\d+)\/versions$/.exec(url);
  if (match && method === "get") {
    const parser = requireParser(Number(match[1]));
    return {
      items: [...parser.versions].sort(
        (a, b) => b.version - a.version
      ) as ParserVersion[]
    };
  }

  fail(404, "NOT_FOUND", `mock 未实现的接口：${method.toUpperCase()} ${url}`);
}
