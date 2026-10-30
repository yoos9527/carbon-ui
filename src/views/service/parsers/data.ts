/**
 * 解析器库：接口管理里「前置处理器 / 后置处理器」引用的 Groovy 解析模板。
 *
 * 全局共享（不挂合作方），一个解析器可以被多个接口引用；代码改这里，
 * 所有引用它的接口一起生效，所以被引用时禁止删除（见 deleteParsers）。
 *
 * 接后端时只替换本文件里的 helper 实现，页面不动。
 */
import { mockPartners } from "../partners/data";

/** pre = 前置解析器（原始报文 → 入参），post = 后置解析器（网关响应 → 出参） */
export type ParserKind = "pre" | "post";

export const parserKindOptions: { label: string; value: ParserKind }[] = [
  { label: "前置解析器", value: "pre" },
  { label: "后置解析器", value: "post" }
];

export function getParserKindLabel(kind: ParserKind): string {
  return kind === "pre" ? "前置解析器" : "后置解析器";
}

/** 历史快照：每次代码有变化就压一份旧版本，最多保留 10 份 */
export interface ParserVersion {
  version: number;
  code: string;
  time: string;
}

export interface ParserItem {
  id: number;
  /** 业务标识，全局唯一（字母 / 数字 / 下划线） */
  code: string;
  name: string;
  /** 创建后不可改：改类型会让已引用它的接口语义错位 */
  kind: ParserKind;
  desc?: string;
  /** Groovy 代码，入口固定为 def parse(ctx) */
  scriptCode: string;
  /** 执行超时（毫秒） */
  scriptTimeout: number;
  /** 当前版本号，与 versions 配合 */
  scriptVersion: number;
  versions: ParserVersion[];
  enabled: boolean;
  createTime: string;
  updateTime: string;
}

export const groovyPreTemplate = `/**
 * 前置解析器：把合作方要的报文映射成接口入参
 *
 * ctx.payload   原始请求报文（Map 或 String）
 * ctx.params    当前入参（mutable Map）
 * ctx.lib       json(obj) / md5(str) / timestamp()
 *
 * 返回 Map，键名与「请求入参」表里的参数名一致
 */
def parse(ctx) {
    def raw = ctx.payload as Map
    return [
        keyword : raw.keyword ?: raw.entName,
        page    : raw.page ?: 1,
        pageSize: raw.pageSize ?: 20
    ]
}
`;

export const groovyPostTemplate = `/**
 * 后置解析器：把网关返回的原始报文映射成响应出参
 *
 * ctx.response  网关返回的原始报文
 * ctx.fields    当前出参定义（字段名 / 路径 / 类型）
 * ctx.lib       json(obj) / md5(str) / timestamp()
 *
 * 返回 Map，键名与「响应出参」表里的字段名一致
 */
def parse(ctx) {
    def data = ctx.response?.data ?: [:]
    return [
        name  : data.ent_name,
        regNo : data.reg_no,
        status: data.reg_status
    ]
}
`;

/* ------------------------------ mock ------------------------------ */

let seq = 5000;

export function nextParserId(): number {
  seq += 1;
  return seq;
}

function version(code: string, version: number, time: string): ParserVersion {
  return { version, code, time };
}

export function createEmptyParser(kind: ParserKind = "pre"): ParserItem {
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  return {
    id: nextParserId(),
    code: "",
    name: "",
    kind,
    desc: "",
    scriptCode: kind === "pre" ? groovyPreTemplate : groovyPostTemplate,
    scriptTimeout: 3000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: now,
    updateTime: now
  };
}

const zkPreCode = `/**
 * 中科数据-前置：上游只有 entName / pageNo 两个参数
 */
def parse(ctx) {
    def raw = ctx.payload as Map
    return [
        keyword : raw.entName,
        page    : raw.pageNo ?: 1,
        pageSize: raw.pageSize ?: 20
    ]
}
`;

const zkPostCode = `/**
 * 中科数据-后置：data.ent_name 这类下划线字段，统一转成出参里的驼峰名
 */
def parse(ctx) {
    def data = ctx.response?.data ?: [:]
    return [
        name  : data.ent_name,
        regNo : data.reg_no,
        status: data.reg_status
    ]
}
`;

const qxtPreCode = `/**
 * 企信通-前置：报文外层包了一层 request 节点
 */
def parse(ctx) {
    def raw = ctx.payload?.request ?: [:]
    return [
        entId   : raw.entId,
        entName : raw.entName,
        page    : raw.page ?: 1
    ]
}
`;

const qxtPostCode = `/**
 * 企信通-后置：业务数据在 result 节点下
 */
def parse(ctx) {
    def result = ctx.response?.result ?: [:]
    return [
        name  : result.entName,
        score : result.score,
        level : result.level
    ]
}
`;

const nfdaPreCode = `/**
 * 南方电子档案-前置：Form 报文，原样透传，只补默认值
 */
def parse(ctx) {
    def params = ctx.params ?: [:]
    params.putIfAbsent("recognizeMode", "accurate")
    return params
}
`;

const nfdaPostCode = `/**
 * 南方电子档案-后置：识别结果里挑出档案号与文本
 */
def parse(ctx) {
    def data = ctx.response?.data ?: [:]
    return [
        archiveNo: data.archive_no,
        text     : data.text,
        pages    : data.page_count
    ]
}
`;

const bdPreCode = `/**
 * 北斗位置-前置：地址解析只接受 address 字符串
 */
def parse(ctx) {
    def raw = ctx.payload as Map
    return [
        address: String.valueOf(raw.address ?: "").trim()
    ]
}
`;

const bdPostCode = `/**
 * 北斗位置-后置：经纬度保持在字符串精度，不做四舍五入
 */
def parse(ctx) {
    def data = ctx.response ?: [:]
    return [
        lng    : String.format("%.6f", data.lng as BigDecimal),
        lat    : String.format("%.6f", data.lat as BigDecimal),
        address: data.formatted_address
    ]
}
`;

const xnPreCode = `/**
 * 西南政务-前置：税务接口要求带上信用代码与页码
 */
def parse(ctx) {
    def raw = ctx.payload as Map
    return [
        entCode: raw.entCode,
        page   : raw.page ?: 1
    ]
}
`;

const xnPostCode = `/**
 * 西南政务-后置：纳税信用等级在 data.grade 里
 */
def parse(ctx) {
    def data = ctx.response?.data ?: [:]
    return [
        taxpayer: data.taxpayer,
        grade   : data.grade,
        year    : data.assessment_year
    ]
}
`;

export const mockParsers: ParserItem[] = [
  {
    id: 5001,
    code: "ZK_ENT_PRE",
    name: "中科数据-前置",
    kind: "pre",
    desc: "上游只给 entName / pageNo，映射成统一入参",
    scriptCode: zkPreCode,
    scriptTimeout: 3000,
    scriptVersion: 2,
    versions: [
      version(
        zkPreCode.replace("raw.pageNo ?: 1", "raw.page ?: 1"),
        1,
        "2026-09-18 10:12:00"
      )
    ],
    enabled: true,
    createTime: "2026-09-12 09:30:00",
    updateTime: "2026-10-21 16:40:00"
  },
  {
    id: 5002,
    code: "ZK_ENT_POST",
    name: "中科数据-后置",
    kind: "post",
    desc: "下划线字段统一转成出参驼峰名",
    scriptCode: zkPostCode,
    scriptTimeout: 3000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-09-12 09:34:00",
    updateTime: "2026-09-12 09:34:00"
  },
  {
    id: 5003,
    code: "QXT_PRE",
    name: "企信通-前置",
    kind: "pre",
    desc: "报文外层包了一层 request 节点",
    scriptCode: qxtPreCode,
    scriptTimeout: 2000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-09-20 14:02:00",
    updateTime: "2026-09-20 14:02:00"
  },
  {
    id: 5004,
    code: "QXT_POST",
    name: "企信通-后置",
    kind: "post",
    desc: "业务数据在 result 节点下",
    scriptCode: qxtPostCode,
    scriptTimeout: 2000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-09-20 14:05:00",
    updateTime: "2026-09-20 14:05:00"
  },
  {
    id: 5005,
    code: "NFDA_PRE",
    name: "南方电子档案-前置",
    kind: "pre",
    desc: "Form 报文原样透传，只补默认值",
    scriptCode: nfdaPreCode,
    scriptTimeout: 5000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-09-25 11:20:00",
    updateTime: "2026-09-25 11:20:00"
  },
  {
    id: 5006,
    code: "NFDA_POST",
    name: "南方电子档案-后置",
    kind: "post",
    desc: "识别结果里挑出档案号与文本",
    scriptCode: nfdaPostCode,
    scriptTimeout: 5000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-09-25 11:22:00",
    updateTime: "2026-09-25 11:22:00"
  },
  {
    id: 5007,
    code: "BD_GEO_PRE",
    name: "北斗位置-前置",
    kind: "pre",
    desc: "地址解析只接受 address 字符串",
    scriptCode: bdPreCode,
    scriptTimeout: 1500,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-10-08 15:44:00",
    updateTime: "2026-10-08 15:44:00"
  },
  {
    id: 5008,
    code: "BD_GEO_POST",
    name: "北斗位置-后置",
    kind: "post",
    desc: "经纬度保留 6 位小数",
    scriptCode: bdPostCode,
    scriptTimeout: 1500,
    scriptVersion: 1,
    versions: [],
    enabled: false,
    createTime: "2026-10-08 15:46:00",
    updateTime: "2026-10-17 09:08:00"
  },
  {
    id: 5009,
    code: "XN_TAX_PRE",
    name: "西南政务-前置",
    kind: "pre",
    desc: "税务接口要求带信用代码与页码",
    scriptCode: xnPreCode,
    scriptTimeout: 3000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-10-19 09:12:00",
    updateTime: "2026-10-19 09:12:00"
  },
  {
    id: 5010,
    code: "XN_TAX_POST",
    name: "西南政务-后置",
    kind: "post",
    desc: "纳税信用等级在 data.grade 里",
    scriptCode: xnPostCode,
    scriptTimeout: 3000,
    scriptVersion: 1,
    versions: [],
    enabled: true,
    createTime: "2026-10-19 09:15:00",
    updateTime: "2026-10-19 09:15:00"
  }
];

/* ------------------------------ 查询 ------------------------------ */

export function getParserById(id?: number): ParserItem | undefined {
  if (id === undefined) return undefined;
  return mockParsers.find(item => item.id === id);
}

/** 列表用：该类型的全部解析器 */
export function getParsersByKind(kind: ParserKind): ParserItem[] {
  return mockParsers.filter(item => item.kind === kind);
}

/** 接口表单的下拉用：只给启用中的，停用的引用出来也不能跑 */
export function listUsableParsers(kind: ParserKind): ParserItem[] {
  return getParsersByKind(kind).filter(item => item.enabled);
}

export function isParserCodeTaken(code: string, selfId?: number): boolean {
  const target = code.trim().toLowerCase();
  return mockParsers.some(
    item => item.id !== selfId && item.code.toLowerCase() === target
  );
}

/* ------------------------------ 引用 ------------------------------ */

export interface ParserRefHit {
  partnerId: number;
  partnerName: string;
  interfaceId: number;
  interfaceName: string;
}

/** 扫所有合作方的接口，找出引用了这个解析器的（前置 / 后置都算） */
export function findParserRefs(parserId: number): ParserRefHit[] {
  const hits: ParserRefHit[] = [];
  mockPartners.forEach(partner => {
    (partner.interfaces ?? []).forEach(item => {
      if (item.preParserId === parserId || item.postParserId === parserId) {
        hits.push({
          partnerId: partner.id,
          partnerName: partner.name,
          interfaceId: item.id,
          interfaceName: item.name
        });
      }
    });
  });
  return hits;
}

export function countParserRefs(parserId: number): number {
  return findParserRefs(parserId).length;
}

/* ------------------------------ 写操作 ------------------------------ */

export interface ParserForm {
  id: number;
  code: string;
  name: string;
  kind: ParserKind;
  desc: string;
  scriptCode: string;
  scriptTimeout: number;
  enabled: boolean;
}

export function toParserForm(item: ParserItem): ParserForm {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    kind: item.kind,
    desc: item.desc ?? "",
    scriptCode: item.scriptCode,
    scriptTimeout: item.scriptTimeout,
    enabled: item.enabled
  };
}

export function toggleParser(id: number): boolean {
  const target = mockParsers.find(item => item.id === id);
  if (!target) return false;
  target.enabled = !target.enabled;
  target.updateTime = new Date().toLocaleString("zh-CN", { hour12: false });
  return true;
}

/** 删之前先看引用：被接口引用的一个都不删，返回被拦下的明细 */
export function deleteParsers(ids: number[]): {
  deleted: number;
  blocked: { id: number; name: string; refs: ParserRefHit[] }[];
} {
  const blocked: { id: number; name: string; refs: ParserRefHit[] }[] = [];
  let deleted = 0;
  ids.forEach(id => {
    const index = mockParsers.findIndex(item => item.id === id);
    if (index < 0) return;
    const refs = findParserRefs(id);
    if (refs.length) {
      blocked.push({ id, name: mockParsers[index].name, refs });
      return;
    }
    mockParsers.splice(index, 1);
    deleted += 1;
  });
  return { deleted, blocked };
}

/**
 * 保存：新建直接 push；编辑时如果代码变了先压一份旧版本快照
 * （`scriptVersion` 是「当前版本号」，`versions` 里是历史），最多留 10 份。
 */
export function saveParserForm(form: ParserForm): boolean {
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  const code = form.code.trim();
  const name = form.name.trim();
  const scriptCode = form.scriptCode;
  let target = mockParsers.find(item => item.id === form.id);
  if (!target) {
    target = {
      ...createEmptyParser(form.kind),
      id: form.id,
      code,
      name,
      desc: form.desc.trim(),
      scriptCode,
      scriptTimeout: form.scriptTimeout,
      enabled: form.enabled,
      createTime: now,
      updateTime: now
    };
    mockParsers.unshift(target);
    return true;
  }
  if (target.scriptCode !== scriptCode) {
    target.versions.unshift({
      version: target.scriptVersion,
      code: target.scriptCode,
      time: target.updateTime
    });
    target.versions = target.versions.slice(0, 10);
    target.scriptVersion += 1;
  }
  target.code = code;
  target.name = name;
  target.desc = form.desc.trim();
  target.scriptCode = scriptCode;
  target.scriptTimeout = form.scriptTimeout;
  target.enabled = form.enabled;
  target.updateTime = now;
  return true;
}
