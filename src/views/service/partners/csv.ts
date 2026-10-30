/**
 * 合作方档案的导入 / 导出（CSV，UTF-8 BOM，Excel 友好）。
 *
 * 只覆盖「档案主字段 + 接入环境」：鉴权配置和接口清单不在这一层导入
 * —— 接口走接口管理页的导入（按 合作方编码 + 接口标识 匹配），鉴权在详情页维护。
 * 导入按「编码」匹配：命中就更新，没命中就新增。
 */
import {
  createEmptyEnv,
  createEmptyPartner,
  mockPartners,
  type PartnerEnv,
  type PartnerItem,
  type PartnerStatus
} from "./data";

export const CSV_HEADERS = [
  "合作方名称",
  "编码",
  "联系人",
  "联系电话",
  "状态",
  "合作开始",
  "合作结束",
  "备注",
  "接入环境(JSON)"
] as const;

export interface ImportIssue {
  line: number;
  message: string;
}

export interface ImportPlanItem {
  targetId?: number;
  patch: Partial<PartnerItem>;
}

export interface ImportPlan {
  plan: ImportPlanItem[];
  created: number;
  updated: number;
  issues: ImportIssue[];
}

const STATUS_LABEL: Record<PartnerStatus, string> = {
  0: "停用",
  1: "启用",
  2: "测试中"
};

const escapeCell = (value: unknown): string => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows: PartnerItem[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.code,
        row.contact,
        row.phone,
        STATUS_LABEL[row.status] ?? "",
        row.cooperateStart ?? "",
        row.cooperateEnd ?? "",
        row.remark ?? "",
        JSON.stringify(row.envs ?? [])
      ]
        .map(escapeCell)
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function toCsvTemplate(): string {
  const sample = [
    "示例数据科技有限公司",
    "DEMO",
    "张三",
    "13800000000",
    "启用",
    "2025-01-01",
    "",
    "备注可不填",
    JSON.stringify([
      {
        id: 1,
        name: "生产环境",
        code: "prod",
        baseUrl: "https://api.example.com",
        remark: ""
      }
    ])
  ];
  return (
    "\uFEFF" + CSV_HEADERS.join(",") + "\r\n" + sample.map(escapeCell).join(",")
  );
}

/** 最小可用 CSV 解析：双引号包裹、`""` 转义、单元格内换行 */
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

function parseStatus(raw: string): PartnerStatus | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  if (text === "0" || text === "停用") return 0;
  if (text === "1" || text === "启用") return 1;
  if (text === "2" || text === "测试中") return 2;
  return undefined;
}

function parseEnvs(
  raw: string,
  line: number,
  issues: ImportIssue[]
): PartnerEnv[] | undefined {
  if (!raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("不是数组");
    return parsed.map(item => ({
      id: Number(item.id) || createEmptyEnv().id,
      name: String(item.name ?? "").trim(),
      code: String(item.code ?? "").trim(),
      baseUrl: String(item.baseUrl ?? "").trim(),
      remark: item.remark ? String(item.remark) : undefined
    }));
  } catch (error) {
    issues.push({
      line,
      message: `接入环境 JSON 解析失败：${(error as Error).message}`
    });
    return undefined;
  }
}

/** 解析 + 校验，不落库 */
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
  const header = rows[0].map(item => item.trim());
  if (header[0] !== CSV_HEADERS[0] || header[1] !== CSV_HEADERS[1]) {
    return {
      plan,
      created,
      updated,
      issues: [
        {
          line: 1,
          message:
            "表头不匹配，请先用「下载模板」导出标准表头（第一列合作方名称、第二列编码）"
        }
      ]
    };
  }

  const seen = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const line = index + 1;
    const [
      name,
      code,
      contact,
      phone,
      status,
      cooperateStart,
      cooperateEnd,
      remark,
      envs
    ] = rows[index];

    const trimmedName = (name ?? "").trim();
    const trimmedCode = (code ?? "").trim();
    if (!trimmedName) {
      issues.push({ line, message: "合作方名称为空" });
      continue;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      issues.push({
        line,
        message: `编码「${trimmedCode}」只能包含字母、数字、下划线、短横线`
      });
      continue;
    }
    const key = trimmedCode.toLowerCase();
    if (seen.has(key)) {
      issues.push({ line, message: `本次导入里编码「${trimmedCode}」重复` });
      continue;
    }
    seen.add(key);

    const parsedStatus = parseStatus(status ?? "");
    if (parsedStatus === undefined && (status ?? "").trim()) {
      issues.push({
        line,
        message: `状态「${status}」只能是 启用 / 停用 / 测试中`
      });
      continue;
    }

    const existing = mockPartners.find(
      item => item.code.trim().toLowerCase() === key
    );

    plan.push({
      targetId: existing?.id,
      patch: {
        name: trimmedName,
        code: trimmedCode,
        contact: (contact ?? "").trim(),
        phone: (phone ?? "").trim(),
        status: parsedStatus ?? 1,
        cooperateStart: (cooperateStart ?? "").trim(),
        cooperateEnd: (cooperateEnd ?? "").trim(),
        remark: (remark ?? "").trim(),
        envs: parseEnvs(envs ?? "", line, issues)
      }
    });
    if (existing) updated += 1;
    else created += 1;
  }

  return { plan, created, updated, issues };
}

export function applyImport(plan: ImportPlanItem[]): void {
  for (const item of plan) {
    if (item.targetId !== undefined) {
      const target = mockPartners.find(entry => entry.id === item.targetId);
      if (target) Object.assign(target, item.patch);
      continue;
    }
    const id = Math.max(0, ...mockPartners.map(entry => entry.id)) + 1;
    mockPartners.unshift({
      ...createEmptyPartner(),
      ...item.patch,
      id,
      createTime: new Date().toLocaleString("zh-CN", { hour12: false }),
      // 导入不覆盖鉴权与接口：新建的合作方从干净状态开始维护
      authConfigs: [],
      interfaces: []
    });
  }
}
