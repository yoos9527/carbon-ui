/**
 * 接口清单的导入 / 导出。
 *
 * 只做 CSV（UTF-8 BOM，Excel 直接双打开不乱码）：一个接口一行，
 * 入参 / 出参这两列塞 JSON 串，避免把一个接口拆成 N 行。
 * 导入按（合作方编码 + 接口标识）匹配：命中就更新，没命中就新增。
 *
 * 纯函数，不碰页面；接后端时这层整体换成后端导入接口即可。
 */
import {
  createEmptyInterface,
  mockPartners,
  nextId,
  type FieldType,
  type InterfaceParam,
  type InterfaceResponseField,
  type ParamLocation,
  type PartnerInterfaceItem,
  type ProcessorType
} from "../partners/data";
import type { InterfaceRow } from "./data";

export const CSV_HEADERS = [
  "合作方编码",
  "合作方名称",
  "接口名称",
  "接口标识",
  "请求方法",
  "报文格式",
  "请求路径",
  "鉴权名称",
  "单价",
  "日上限",
  "超时(ms)",
  "启用",
  "前置处理器",
  "后置处理器",
  "入参(JSON)",
  "出参(JSON)",
  "创建时间"
] as const;

export interface ImportIssue {
  /** 文件里的行号（含表头，从 1 开始），0 表示整表问题 */
  line: number;
  message: string;
}

export interface ImportPlanItem {
  partnerId: number;
  /** 命中的既有接口 id，没有就是新增 */
  targetId?: number;
  patch: Partial<PartnerInterfaceItem>;
}

export interface ImportPlan {
  plan: ImportPlanItem[];
  created: number;
  updated: number;
  issues: ImportIssue[];
}

/* ------------------------------ 导出 ------------------------------ */

const escapeCell = (value: unknown): string => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows: InterfaceRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.partnerCode,
        row.partnerName,
        row.name,
        row.code,
        row.method,
        row.payloadFormat,
        row.path,
        row.auth?.name ?? "",
        row.price,
        row.dailyLimit ?? "",
        row.timeout ?? "",
        row.enabled ? "是" : "否",
        row.preProcessor ?? "none",
        row.postProcessor ?? "none",
        JSON.stringify(row.params ?? []),
        JSON.stringify(row.responses ?? []),
        row.createTime ?? ""
      ]
        .map(escapeCell)
        .join(",")
    );
  }
  // BOM 让 Excel 按 UTF-8 打开，否则中文乱码
  return "\uFEFF" + lines.join("\r\n");
}

/** 导入模板：表头 + 一行示例 */
export function toCsvTemplate(): string {
  const sample = [
    "ZK",
    "中科数据科技有限公司",
    "企业工商基本信息",
    "ENT_BASE_V1",
    "GET",
    "json",
    "/api/ent/base",
    "公共请求头",
    "0.5",
    "10000",
    "3000",
    "是",
    "none",
    "none",
    JSON.stringify([
      {
        id: 1,
        name: "keyword",
        location: "query",
        type: "string",
        required: true,
        desc: "企业名称或统一社会信用代码",
        defaultValue: ""
      }
    ]),
    JSON.stringify([
      {
        id: 2,
        name: "entName",
        path: "data.entName",
        type: "string",
        required: true,
        desc: "企业名称"
      }
    ]),
    ""
  ];
  return (
    "\uFEFF" + CSV_HEADERS.join(",") + "\r\n" + sample.map(escapeCell).join(",")
  );
}

/* ------------------------------ 解析 ------------------------------ */

/** 最小可用 CSV 解析：支持双引号包裹、`""` 转义、单元格内换行 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r") {
      // 交给 \n 处理
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(line => line.some(item => item.trim() !== ""));
}

const FIELD_TYPES: FieldType[] = [
  "string",
  "int",
  "long",
  "number",
  "boolean",
  "object",
  "array",
  "date"
];
const LOCATIONS: ParamLocation[] = ["query", "body", "path", "header"];
const PROCESSORS: ProcessorType[] = ["none", "groovy"];

const pick = <T extends string>(value: string, allowed: T[], fallback: T): T =>
  allowed.includes(value.trim() as T) ? (value.trim() as T) : fallback;

const toParams = (raw: string, line: number, issues: ImportIssue[]) => {
  if (!raw.trim()) return [] as InterfaceParam[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("不是数组");
    return parsed.map(item => ({
      id: Number(item.id) || nextId(),
      name: String(item.name ?? "").trim(),
      location: pick(String(item.location ?? "query"), LOCATIONS, "query"),
      type: pick(String(item.type ?? "string"), FIELD_TYPES, "string"),
      required: Boolean(item.required),
      desc: item.desc ? String(item.desc) : undefined,
      defaultValue:
        item.defaultValue === undefined || item.defaultValue === null
          ? undefined
          : String(item.defaultValue)
    })) as InterfaceParam[];
  } catch (error) {
    issues.push({
      line,
      message: `入参 JSON 解析失败：${(error as Error).message}`
    });
    return [] as InterfaceParam[];
  }
};

const toResponses = (raw: string, line: number, issues: ImportIssue[]) => {
  if (!raw.trim()) return [] as InterfaceResponseField[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("不是数组");
    return parsed.map(item => ({
      id: Number(item.id) || nextId(),
      name: String(item.name ?? "").trim(),
      path: String(item.path ?? "").trim(),
      type: pick(String(item.type ?? "string"), FIELD_TYPES, "string"),
      required: Boolean(item.required),
      desc: item.desc ? String(item.desc) : undefined,
      example:
        item.example === undefined || item.example === null
          ? undefined
          : String(item.example)
    })) as InterfaceResponseField[];
  } catch (error) {
    issues.push({
      line,
      message: `出参 JSON 解析失败：${(error as Error).message}`
    });
    return [] as InterfaceResponseField[];
  }
};

const parseBool = (value: string) =>
  ["1", "是", "true", "yes", "y"].includes(value.trim().toLowerCase());

const parseNumber = (value: string): number | undefined => {
  const text = value.trim();
  if (!text) return undefined;
  const num = Number(text);
  return Number.isNaN(num) ? undefined : num;
};

/** 解析 + 校验，不落库。页面拿到结果先给用户确认再调 `applyImport` */
export function planImport(text: string): ImportPlan {
  const rows = parseCsv(text);
  const issues: ImportIssue[] = [];
  const plan: ImportPlanItem[] = [];
  let created = 0;
  let updated = 0;

  if (!rows.length) {
    return {
      plan,
      created,
      updated,
      issues: [{ line: 0, message: "文件是空的" }]
    };
  }

  // 表头按位置读取，但要求第一列就是「合作方编码」，防止传错文件
  const header = rows[0].map(item => item.trim());
  if (header[0] !== CSV_HEADERS[0] || header[3] !== CSV_HEADERS[3]) {
    return {
      plan,
      created,
      updated,
      issues: [
        {
          line: 1,
          message: `表头不匹配，请先用「下载模板」导出标准表头（${CSV_HEADERS.slice(0, 4).join(" / ")} …）`
        }
      ]
    };
  }

  const seen = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const line = index + 1;
    const [
      partnerCode,
      ,
      name,
      code,
      method,
      payloadFormat,
      path,
      authName,
      price,
      dailyLimit,
      timeout,
      enabled,
      preProcessor,
      postProcessor,
      params,
      responses
    ] = rows[index];

    const partner = mockPartners.find(
      item =>
        item.code.trim().toLowerCase() ===
        (partnerCode ?? "").trim().toLowerCase()
    );
    if (!partner) {
      issues.push({ line, message: `合作方编码「${partnerCode}」不存在` });
      continue;
    }
    if (!(name ?? "").trim()) {
      issues.push({ line, message: "接口名称为空" });
      continue;
    }
    const trimmedCode = (code ?? "").trim();
    if (!/^[A-Za-z0-9_]+$/.test(trimmedCode)) {
      issues.push({
        line,
        message: `接口标识「${trimmedCode}」只能包含字母、数字、下划线`
      });
      continue;
    }
    if (!(path ?? "").trim().startsWith("/")) {
      issues.push({ line, message: `请求路径「${path ?? ""}」需以 / 开头` });
      continue;
    }
    const key = `${partner.id}:${trimmedCode.toLowerCase()}`;
    if (seen.has(key)) {
      issues.push({
        line,
        message: `本次导入里「${trimmedCode}」在同一合作方下重复`
      });
      continue;
    }
    seen.add(key);

    const auth = authName?.trim()
      ? partner.authConfigs.find(item => item.name.trim() === authName.trim())
      : undefined;

    const existing = (partner.interfaces ?? []).find(
      item =>
        (item.code ?? "").trim().toLowerCase() === trimmedCode.toLowerCase()
    );

    plan.push({
      partnerId: partner.id,
      targetId: existing?.id,
      patch: {
        code: trimmedCode,
        name: (name ?? "").trim(),
        path: (path ?? "").trim(),
        method: pick((method ?? "").toUpperCase(), ["GET", "POST"], "GET"),
        payloadFormat: pick(
          payloadFormat ?? "",
          ["json", "xml", "form"],
          "json"
        ),
        authId: auth?.id,
        price: parseNumber(price) ?? 0,
        dailyLimit: parseNumber(dailyLimit),
        timeout: parseNumber(timeout),
        enabled: enabled === undefined ? true : parseBool(enabled),
        preProcessor: pick(preProcessor ?? "none", PROCESSORS, "none"),
        postProcessor: pick(postProcessor ?? "none", PROCESSORS, "none"),
        params: toParams(params ?? "", line, issues),
        responses: toResponses(responses ?? "", line, issues)
      }
    });
    if (existing) updated += 1;
    else created += 1;
  }

  return { plan, created, updated, issues };
}

/** 落库：命中的更新，没命中的挂到合作方下 */
export function applyImport(plan: ImportPlanItem[]): void {
  for (const item of plan) {
    const partner = mockPartners.find(entry => entry.id === item.partnerId);
    if (!partner) continue;
    if (!partner.interfaces) partner.interfaces = [];
    const target = item.targetId
      ? partner.interfaces.find(entry => entry.id === item.targetId)
      : undefined;
    if (target) {
      Object.assign(target, item.patch);
      continue;
    }
    partner.interfaces.push({
      ...createEmptyInterface(),
      ...item.patch
    });
  }
}
