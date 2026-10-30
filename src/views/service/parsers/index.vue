<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  countParserRefs,
  deleteParsers,
  getParserKindLabel,
  mockParsers,
  parserKindOptions,
  toggleParser,
  type ParserItem,
  type ParserKind
} from "./data";
import ParserDrawer from "./components/ParserDrawer.vue";
import { PureTableBar } from "@/components/RePureTableBar";
import SearchIcon from "~icons/ri/search-line";
import RefreshIcon from "~icons/ri/refresh-line";
import AddIcon from "~icons/ri/add-line";
import DeleteIcon from "~icons/ri/delete-bin-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServiceParsers" });

const loading = ref(false);
const dataList = ref<ParserItem[]>([]);
const totalRows = ref<ParserItem[]>([]);

const queryForm = reactive({
  keyword: "",
  kind: undefined as ParserKind | undefined,
  enabled: undefined as boolean | undefined
});

const pagination = reactive({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true
});

const columns: TableColumnList = [
  { type: "selection", width: 55, align: "left", fixed: "left" },
  {
    label: "解析器名称",
    prop: "name",
    minWidth: 200,
    slot: "name",
    showOverflowTooltip: true
  },
  { label: "类型", prop: "kind", minWidth: 130, slot: "kind" },
  { label: "版本", prop: "scriptVersion", minWidth: 90, slot: "version" },
  { label: "状态", prop: "enabled", minWidth: 100, slot: "status" },
  { label: "更新时间", prop: "updateTime", minWidth: 165 },
  { label: "操作", fixed: "right", width: 210, slot: "operation" }
];

/** 概览：总数 / 前置 / 后置，直接来自数据而不是写死 */
const stats = computed(() => {
  const all = totalRows.value;
  const pre = all.filter(item => item.kind === "pre").length;
  return { total: all.length, pre, post: all.length - pre };
});

/**
 * TODO: 接后端时把 loadData 换成真实接口，例如
 *   import { getParserList } from "@/api/service";
 *   const { data } = await getParserList({ ...queryForm, ...pagination });
 * 数据源统一在 ./data.ts，接口配置页也读它。
 */
function loadData() {
  loading.value = true;
  totalRows.value = mockParsers.slice();
  const keyword = queryForm.keyword.trim().toLowerCase();
  const filtered = totalRows.value.filter(item => {
    const matchKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword) ||
      (item.desc ?? "").toLowerCase().includes(keyword);
    const matchKind =
      queryForm.kind === undefined || item.kind === queryForm.kind;
    const matchEnabled =
      queryForm.enabled === undefined || item.enabled === queryForm.enabled;
    return matchKeyword && matchKind && matchEnabled;
  });
  pagination.total = filtered.length;
  const start = (pagination.currentPage - 1) * pagination.pageSize;
  dataList.value = filtered.slice(start, start + pagination.pageSize);
  loading.value = false;
}

function onSearch() {
  pagination.currentPage = 1;
  loadData();
}

function onReset() {
  queryForm.keyword = "";
  queryForm.kind = undefined;
  queryForm.enabled = undefined;
  onSearch();
}

function handleSizeChange(val: number) {
  pagination.pageSize = val;
  loadData();
}

function handleCurrentChange(val: number) {
  pagination.currentPage = val;
  loadData();
}

/* ------------------------------ 新增 / 编辑 ------------------------------ */

const drawerVisible = ref(false);
const editing = ref<ParserItem | null>(null);

function openCreate() {
  editing.value = null;
  drawerVisible.value = true;
}

function openEdit(row: ParserItem) {
  editing.value = row;
  drawerVisible.value = true;
}

function handleRowClick(row: ParserItem, column: { type?: string }) {
  if (column?.type === "selection") return;
  openEdit(row);
}

/* ------------------------------ 状态 / 删除 ------------------------------ */

function handleToggle(row: ParserItem) {
  const action = row.enabled ? "停用" : "启用";
  const refs = countParserRefs(row.id);
  const run = () => {
    if (!toggleParser(row.id)) {
      ElMessage.error("解析器不存在，可能已被删除");
      return;
    }
    loadData();
    ElMessage.success(`${action}成功`);
  };
  if (row.enabled && refs) {
    ElMessageBox.confirm(
      `「${row.name}」正被 ${refs} 个接口引用，停用后这些接口调用会直接失败，确认停用？`,
      "停用解析器",
      { type: "warning" }
    )
      .then(run)
      .catch(() => {});
    return;
  }
  run();
}

/** 被接口引用的解析器不允许删除，这里把引用明细摆出来 */
function blockedMessage(
  blocked: {
    name: string;
    refs: { partnerName: string; interfaceName: string }[];
  }[]
) {
  return blocked
    .map(item => {
      const names = item.refs
        .slice(0, 3)
        .map(ref => `「${ref.partnerName} / ${ref.interfaceName}」`)
        .join("、");
      const suffix = item.refs.length > 3 ? ` 等 ${item.refs.length} 个` : "";
      return `${item.name} 正被 ${names}${suffix}引用`;
    })
    .join("；");
}

function removeByIds(ids: number[], title: string) {
  const { deleted, blocked } = deleteParsers(ids);
  if (deleted) {
    selectedRows.value = selectedRows.value.filter(
      item => !ids.includes(item.id)
    );
    loadData();
    ElMessage.success(`已删除 ${deleted} 个解析器`);
  }
  if (blocked.length) {
    ElMessage.warning({
      message: `${blockedMessage(blocked)}，请先在接口里换掉引用`,
      duration: 6000
    });
  }
  if (!deleted && !blocked.length) {
    ElMessage.error(`${title}不存在，可能已被删除`);
  }
}

function handleDelete(row: ParserItem) {
  ElMessageBox.confirm(
    `删除后「${row.name}」（${row.code}）将无法再被接口引用，历史版本一并清空，且不可恢复。`,
    "删除解析器",
    {
      type: "warning",
      confirmButtonText: "删除",
      confirmButtonClass: "el-button--danger"
    }
  )
    .then(() => removeByIds([row.id], "解析器"))
    .catch(() => {});
}

/* ------------------------------ 批量选择 ------------------------------ */

const selectedRows = ref<ParserItem[]>([]);

function handleSelectionChange(rows: ParserItem[]) {
  selectedRows.value = rows;
}

function handleBatchDelete() {
  const rows = selectedRows.value;
  if (!rows.length) {
    ElMessage.warning("请先勾选要删除的解析器");
    return;
  }
  const preview = rows
    .slice(0, 3)
    .map(item => `「${item.name}」`)
    .join("、");
  const suffix = rows.length > 3 ? ` 等 ${rows.length} 个` : "";
  ElMessageBox.confirm(
    `将删除 ${preview}${suffix}。被接口引用的会跳过并提示，删除不可恢复。`,
    `批量删除 ${rows.length} 个解析器`,
    {
      type: "warning",
      confirmButtonText: "全部删除",
      confirmButtonClass: "el-button--danger"
    }
  )
    .then(() =>
      removeByIds(
        rows.map(item => item.id),
        "解析器"
      )
    )
    .catch(() => {});
}

loadData();
</script>

<template>
  <div class="main">
    <el-form
      :inline="true"
      :model="queryForm"
      label-width="68px"
      class="search-form"
    >
      <el-form-item label="关键字">
        <el-input
          v-model="queryForm.keyword"
          placeholder="名称 / 标识 / 说明"
          clearable
          style="width: 220px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="类型">
        <el-select
          v-model="queryForm.kind"
          placeholder="全部类型"
          clearable
          style="width: 160px"
        >
          <el-option
            v-for="item in parserKindOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="queryForm.enabled"
          placeholder="全部"
          clearable
          style="width: 120px"
        >
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" plain @click="onSearch">
          <template #icon><SearchIcon /></template>
          查询
        </el-button>
        <el-button plain @click="onReset">
          <template #icon><RefreshIcon /></template>
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-button type="primary" plain @click="openCreate">
          <template #icon><AddIcon /></template>
          新增
        </el-button>
        <el-button type="danger" plain @click="handleBatchDelete">
          <template #icon><DeleteIcon /></template>
          批量删除{{ selectedRows.length ? `（${selectedRows.length}）` : "" }}
        </el-button>
      </template>
      <template #title>
        <div class="bar-title">
          <span>解析器库</span>
          <span class="bar-title__stat">
            共 {{ stats.total }} 个 · 前置
            <b class="is-pre">{{ stats.pre }}</b> · 后置
            <b class="is-post">{{ stats.post }}</b>
          </span>
        </div>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          row-key="id"
          border
          stripe
          adaptive
          :adaptiveConfig="{ offsetBottom: 108 }"
          align-whole="left"
          :size="size"
          :data="dataList"
          :columns="dynamicColumns"
          :pagination="pagination"
          :loading="loading"
          :row-style="{ cursor: 'pointer' }"
          @row-click="handleRowClick"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #name="{ row }">
            <span class="cell-name">{{ row.name }}</span>
            <span class="cell-code">{{ row.code }}</span>
            <span v-if="row.desc" class="cell-desc">{{ row.desc }}</span>
          </template>
          <template #kind="{ row }">
            <el-tag
              size="small"
              :type="row.kind === 'pre' ? 'primary' : 'success'"
              effect="plain"
            >
              {{ getParserKindLabel(row.kind) }}
            </el-tag>
          </template>
          <template #version="{ row }">
            <span class="num">v{{ row.scriptVersion }}</span>
            <span v-if="row.versions.length" class="cell-desc">
              留 {{ row.versions.length }} 版
            </span>
          </template>
          <template #status="{ row }">
            <span class="dot" :class="row.enabled ? 'dot--ok' : 'dot--off'">
              {{ row.enabled ? "启用" : "停用" }}
            </span>
          </template>
          <template #operation="{ row }">
            <el-button
              size="small"
              plain
              type="primary"
              @click.stop="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              plain
              :type="row.enabled ? 'danger' : 'success'"
              @click.stop="handleToggle(row)"
            >
              {{ row.enabled ? "停用" : "启用" }}
            </el-button>
            <el-button
              size="small"
              plain
              type="danger"
              @click.stop="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>

    <ParserDrawer v-model="drawerVisible" :parser="editing" @saved="loadData" />
  </div>
</template>

<style lang="scss" scoped>
.cell-name {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.cell-code {
  display: block;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.cell-desc {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.dot {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.dot::before {
  width: 6px;
  height: 6px;
  content: "";
  background: currentcolor;
  border-radius: 50%;
}

.dot--ok {
  color: #0f9d58;
}

.dot--off {
  color: var(--el-text-color-placeholder);
}

.bar-title {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.bar-title__stat {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.bar-title__stat b {
  font-variant-numeric: tabular-nums;
}

.is-pre {
  color: var(--el-color-primary);
}

.is-post {
  color: var(--el-color-success);
}
</style>
