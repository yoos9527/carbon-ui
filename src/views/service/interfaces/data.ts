/**
 * 接口管理：把各合作方下挂的接口拍平成一张「实际调用配置」清单。
 *
 * 接口本身归属合作方（`PartnerItem.interfaces`），接口管理页只负责「怎么调它」——
 * 标识、路径、方法、报文格式、绑定哪个鉴权、入参/出参契约、超时、单价、日限、是否启用。
 * 所有写操作都落回 `mockPartners` 里对应的接口对象，与合作方详情页共享同一份数据。
 * 接后端时只替换本文件的 helper，页面不动。
 */
import {
  createEmptyInterface,
  fieldTypeOptions,
  getStatusOption,
  methodOptions,
  mockPartners,
  nextId,
  paramLocationOptions,
  payloadFormatOptions,
  processorOptions,
  type AuthConfig,
  type AuthType,
  type FieldType,
  type InterfaceParam,
  type InterfaceResponseField,
  type KV,
  type ParamLocation,
  type PartnerInterfaceItem,
  type PartnerStatus,
  type ProcessorType
} from "../partners/data";

/** 列表行：接口字段 + 所属合作方的冗余信息（避免模板里到处 find） */
export interface InterfaceRow extends PartnerInterfaceItem {
  partnerId: number;
  partnerName: string;
  partnerCode: string;
  partnerStatus: PartnerStatus;
  /** 绑定到的鉴权配置，未绑定为 undefined */
  auth?: AuthConfig;
}

/** 合作方下拉选项 */
export interface PartnerOption {
  value: number;
  label: string;
  code: string;
  status: PartnerStatus;
}

export function getPartnerOptions(): PartnerOption[] {
  return mockPartners.map(item => ({
    value: item.id,
    label: item.name,
    code: item.code,
    status: item.status
  }));
}

/** 拍平所有接口，按「启用优先 → 最近调用时间倒序」排 */
export function getInterfaceRows(): InterfaceRow[] {
  const rows: InterfaceRow[] = [];
  mockPartners.forEach(partner => {
    (partner.interfaces ?? []).forEach(item => {
      rows.push({
        ...item,
        partnerId: partner.id,
        partnerName: partner.name,
        partnerCode: partner.code,
        partnerStatus: partner.status,
        auth: (partner.authConfigs ?? []).find(auth => auth.id === item.authId)
      });
    });
  });
  return rows.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return (b.lastCallTime ?? "").localeCompare(a.lastCallTime ?? "");
  });
}

export function getInterfaceRowById(id: number): InterfaceRow | null {
  return getInterfaceRows().find(item => item.id === id) ?? null;
}

export function getPartnerById(id: number) {
  return mockPartners.find(item => item.id === id);
}

/** 某合作方下可绑定的鉴权配置 */
export function getAuthOptions(partnerId: number): AuthConfig[] {
  return getPartnerById(partnerId)?.authConfigs ?? [];
}

/** 最近一次调用是否成功（列表里用状态点表示） */
export function getCallHealth(row: InterfaceRow): {
  label: string;
  tone: "ok" | "warn" | "off";
} {
  if (!row.enabled) return { label: "已停用", tone: "off" };
  if (!row.lastCallTime) return { label: "从未调用", tone: "warn" };
  return { label: "正常", tone: "ok" };
}

/** 单价展示：0 元按「免费」呈现，避免出现 "¥0.0000" 这种噪音 */
export function formatPrice(price: number): string {
  if (!price) return "免费";
  const fixed = Number(price.toFixed(4)).toString();
  return `¥${fixed}`;
}

export function formatLimit(limit?: number): string {
  return limit ? `${limit.toLocaleString("zh-CN")} 次/日` : "不限";
}

/** 调用结果状态点（仅前端视图状态，不落数据） */
export const callStatusOptions = [
  { label: "正常", value: "ok" },
  { label: "从未调用", value: "warn" },
  { label: "已停用", value: "off" }
] as const;

/* ------------------------------ 分步表单 ------------------------------ */

/** 三步分别是：请求信息（含调用参数）/ 入参 / 出参 */
export const formSteps = [
  { title: "请求信息", desc: "标识、方法、路径与调用参数" },
  { title: "请求入参", desc: "字段定义与位置" },
  { title: "响应出参", desc: "返回字段与层级路径" }
] as const;

/** 编辑页表单值：合作方只读，其余可改 */
export interface InterfaceForm {
  partnerId: number;
  id: number;
  /** 业务编码，全局唯一 */
  code: string;
  name: string;
  path: string;
  method: PartnerInterfaceItem["method"];
  payloadFormat: PartnerInterfaceItem["payloadFormat"];
  preProcessor: ProcessorType;
  postProcessor: ProcessorType;
  authId: number | undefined;
  /** 留空表示沿用合作方的连接超时 */
  timeout: number | undefined;
  price: number;
  dailyLimit: number | undefined;
  enabled: boolean;
  params: InterfaceParam[];
  responses: InterfaceResponseField[];
}

export function toForm(row: InterfaceRow): InterfaceForm {
  return {
    partnerId: row.partnerId,
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    path: row.path,
    method: row.method,
    payloadFormat: row.payloadFormat,
    preProcessor: row.preProcessor ?? "none",
    postProcessor: row.postProcessor ?? "none",
    authId: row.authId,
    timeout: row.timeout,
    price: row.price,
    dailyLimit: row.dailyLimit,
    enabled: row.enabled,
    params: (row.params ?? []).map(item => ({ ...item })),
    responses: (row.responses ?? []).map(item => ({ ...item }))
  };
}

export function createForm(partnerId: number): InterfaceForm {
  return {
    partnerId,
    id: nextId(),
    code: "",
    name: "",
    path: "",
    method: "GET",
    payloadFormat: "json",
    preProcessor: "none",
    postProcessor: "none",
    authId: undefined,
    timeout: undefined,
    price: 0,
    dailyLimit: undefined,
    enabled: true,
    params: [],
    responses: []
  };
}

/**
 * 校验结果。带到「第几步 / 哪一格」，方便把用户停在出错的步骤并高亮，
 * 而不是弹一个「请检查表单」了事。
 */
export interface FormError {
  /** 1 / 2 / 3 */
  step: number;
  /** 第一步出错的字段名 */
  field?: keyof InterfaceForm;
  /** 第二、三步出错的行下标 */
  rowIndex?: number;
  /** 第二、三步出错的列 */
  column?: string;
  message: string;
}

const CODE_RE = /^[A-Za-z0-9_]+$/;
/** 出参路径：`a` / `a.b` / `data.list[].name` */
const PATH_RE = /^[A-Za-z_$][\w$]*(\[\])?(\.[A-Za-z_$][\w$]*(\[\])?)*$/;

const INT_RE = /^[+-]?\d+$/;
const NUM_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

/**
 * 入参默认值按行的 `type` 校验：留空放行（不发送），填了就必须是该类型的字面值。
 * 返回错误描述，通过返回 null。`object` / `array` 要求是能 `JSON.parse` 的 JSON。
 */
export function defaultValueError(
  raw: string | undefined,
  type: FieldType
): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  switch (type) {
    case "int":
    case "long":
      return INT_RE.test(value) ? null : `「${value}」不是整数`;
    case "number":
      return NUM_RE.test(value) ? null : `「${value}」不是数字`;
    case "boolean":
      return /^(true|false)$/i.test(value)
        ? null
        : `「${value}」应为 true 或 false`;
    case "date":
      return DATE_RE.test(value) ? null : `「${value}」应形如 2026-01-31`;
    case "object":
    case "array": {
      const expect = type === "array" ? "JSON 数组" : "JSON 对象";
      try {
        const parsed = JSON.parse(value);
        const ok =
          type === "array"
            ? Array.isArray(parsed)
            : typeof parsed === "object" &&
              parsed !== null &&
              !Array.isArray(parsed);
        return ok ? null : `「${value}」不是 ${expect}`;
      } catch {
        return `「${value}」不是合法的 ${expect}`;
      }
    }
    default:
      return null;
  }
}

/** 编码是否被别的接口占用（`selfId` 用于编辑时排除自身） */
export function isCodeTaken(code: string, selfId?: number): boolean {
  const target = code.trim().toLowerCase();
  return getInterfaceRows().some(
    row => row.id !== selfId && (row.code ?? "").trim().toLowerCase() === target
  );
}

/** 一行是否完全空着（保存时直接丢弃） */
function isEmptyParam(row: InterfaceParam): boolean {
  return !(
    row.name.trim() ||
    row.desc?.trim() ||
    row.defaultValue?.trim() ||
    row.location !== "query" ||
    row.type !== "string" ||
    row.required
  );
}

function isEmptyResponse(row: InterfaceResponseField): boolean {
  return !(
    row.name.trim() ||
    row.path.trim() ||
    row.desc?.trim() ||
    row.example?.trim() ||
    row.type !== "string" ||
    row.required
  );
}

/** 校验单个步骤，通过返回 null */
export function validateStep(
  step: number,
  form: InterfaceForm
): FormError | null {
  if (step === 1) {
    if (!form.name.trim()) {
      return { step: 1, field: "name", message: "请填写接口名称" };
    }
    const code = form.code.trim();
    if (!code) return { step: 1, field: "code", message: "请填写接口标识" };
    if (!CODE_RE.test(code)) {
      return {
        step: 1,
        field: "code",
        message: "接口标识只能包含字母、数字、下划线"
      };
    }
    if (isCodeTaken(code, form.id)) {
      return { step: 1, field: "code", message: `接口标识 ${code} 已被占用` };
    }
    if (!form.path.trim()) {
      return { step: 1, field: "path", message: "请填写请求路径" };
    }
    if (!form.path.trim().startsWith("/")) {
      return { step: 1, field: "path", message: "请求路径需以 / 开头" };
    }
    if (Number.isNaN(form.price) || form.price < 0) {
      return { step: 1, field: "price", message: "单价不能为负" };
    }
    return null;
  }

  if (step === 2) {
    const rows = form.params.filter(item => !isEmptyParam(item));
    const names = new Set<string>();
    for (let index = 0; index < form.params.length; index += 1) {
      const row = form.params[index];
      if (isEmptyParam(row)) continue;
      const name = row.name.trim();
      if (!name) {
        return {
          step: 2,
          rowIndex: index,
          column: "name",
          message: `第 ${rows.indexOf(row) + 1} 行入参缺少参数名`
        };
      }
      if (names.has(name.toLowerCase())) {
        return {
          step: 2,
          rowIndex: index,
          column: "name",
          message: `入参「${name}」重复`
        };
      }
      names.add(name.toLowerCase());
      const valueError = defaultValueError(row.defaultValue, row.type);
      if (valueError) {
        return {
          step: 2,
          rowIndex: index,
          column: "defaultValue",
          message: `入参「${name}」的默认值${valueError}`
        };
      }
    }
    return null;
  }

  const responses = form.responses.filter(item => !isEmptyResponse(item));
  const paths = new Set<string>();
  for (let index = 0; index < form.responses.length; index += 1) {
    const row = form.responses[index];
    if (isEmptyResponse(row)) continue;
    const path = row.path.trim();
    if (!path) {
      return {
        step: 3,
        rowIndex: index,
        column: "path",
        message: `第 ${responses.indexOf(row) + 1} 行出参缺少路径`
      };
    }
    if (!PATH_RE.test(path)) {
      return {
        step: 3,
        rowIndex: index,
        column: "path",
        message: `出参路径「${path}」格式不对，应形如 data.list[].name`
      };
    }
    if (paths.has(path)) {
      return {
        step: 3,
        rowIndex: index,
        column: "path",
        message: `出参路径「${path}」重复`
      };
    }
    paths.add(path);
  }
  return null;
}

/** 保存前整体校验：按步骤顺序返回第一条错误 */
export function validateAll(form: InterfaceForm): FormError | null {
  return (
    validateStep(1, form) ?? validateStep(2, form) ?? validateStep(3, form)
  );
}

/** 写回 `mockPartners` 对应接口，返回是否命中 */
export function saveInterfaceForm(form: InterfaceForm): boolean {
  const partner = getPartnerById(form.partnerId);
  if (!partner) return false;
  if (!partner.interfaces) partner.interfaces = [];
  // 新建时 `form.id` 已经由 createForm 分配，列表找不到就当场插入
  let target = partner.interfaces.find(item => item.id === form.id);
  if (!target) {
    // 新建：`form.id` 已由 createForm 分配，这里保留它，避免同一表单保存两次插两行
    target = {
      ...createEmptyInterface(),
      id: form.id,
      createTime: new Date().toLocaleString("zh-CN", { hour12: false })
    };
    partner.interfaces.push(target);
  }
  Object.assign(target, {
    code: form.code.trim(),
    name: form.name.trim(),
    path: form.path.trim(),
    method: form.method,
    payloadFormat: form.payloadFormat,
    preProcessor: form.preProcessor,
    postProcessor: form.postProcessor,
    authId: form.authId,
    timeout: form.timeout,
    price: form.price,
    dailyLimit: form.dailyLimit,
    enabled: form.enabled,
    params: form.params
      .filter(item => !isEmptyParam(item))
      .map(item => ({
        ...item,
        name: item.name.trim(),
        desc: item.desc?.trim(),
        defaultValue: item.defaultValue?.trim()
      })),
    responses: form.responses
      .filter(item => !isEmptyResponse(item))
      .map(item => ({
        ...item,
        name: item.name.trim(),
        path: item.path.trim(),
        desc: item.desc?.trim(),
        example: item.example?.trim()
      }))
  });
  return true;
}

/** 列表页直接切换启用状态 */
export function toggleInterface(partnerId: number, id: number): boolean {
  const target = getPartnerById(partnerId)?.interfaces?.find(
    item => item.id === id
  );
  if (!target) return false;
  target.enabled = !target.enabled;
  return true;
}

/** 删除接口（从所属合作方的 `interfaces` 里摘掉），返回是否命中 */
export function deleteInterface(id: number): boolean {
  for (const partner of mockPartners) {
    const list = partner.interfaces ?? [];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) continue;
    list.splice(index, 1);
    return true;
  }
  return false;
}

/** 合作方状态文案，供行内展示 */
export function getPartnerStatusLabel(status: PartnerStatus): string {
  return getStatusOption(status)?.label ?? "-";
}

export type {
  AuthType,
  FieldType,
  InterfaceParam,
  InterfaceResponseField,
  KV,
  ParamLocation,
  PartnerInterfaceItem,
  ProcessorType
};
export {
  fieldTypeOptions,
  methodOptions,
  paramLocationOptions,
  payloadFormatOptions,
  processorOptions
};

/** 批量删除，返回实际删除条数 */
export function deleteInterfaces(ids: number[]): number {
  const wanted = new Set(ids);
  let removed = 0;
  for (const partner of mockPartners) {
    const list = partner.interfaces ?? [];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (wanted.has(list[index].id)) {
        list.splice(index, 1);
        removed += 1;
      }
    }
  }
  return removed;
}
