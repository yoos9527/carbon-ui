<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { copyTextToClipboard } from "@pureadmin/utils";
import {
  deleteInterface,
  deleteInterfaces,
  formatLimit,
  formatPrice,
  getCallHealth,
  getInterfaceRows,
  getPartnerOptions,
  toggleInterface,
  type InterfaceRow
} from "./data";
import {
  applyImport,
  planImport,
  toCsv,
  toCsvTemplate,
  type ImportPlan
} from "./csv";
import { PureTableBar } from "@/components/RePureTableBar";
import SearchIcon from "~icons/ri/search-line";
import RefreshIcon from "~icons/ri/refresh-line";
import AddIcon from "~icons/ri/add-line";
import CopyIcon from "~icons/ri/file-copy-line";
import UploadIcon from "~icons/ri/upload-2-line";
import DownloadIcon from "~icons/ri/download-2-line";
import DeleteIcon from "~icons/ri/delete-bin-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServiceInterfaces" });

const router = useRouter();

const loading = ref(false);
const dataList = ref<InterfaceRow[]>([]);
const totalRows = ref<InterfaceRow[]>([]);

const partnerOptions = getPartnerOptions();

const queryForm = reactive({
  keyword: "",
  partnerId: undefined as number | undefined,
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
    label: "接口名称",
    prop: "name",
    minWidth: 170,
    slot: "name",
    showOverflowTooltip: true
  },
  {
    label: "接口标识",
    prop: "code",
    minWidth: 170,
    slot: "code",
    showOverflowTooltip: true
  },
  {
    label: "请求地址",
    prop: "path",
    minWidth: 250,
    slot: "endpoint",
    showOverflowTooltip: true
  },
  {
    label: "所属合作方",
    prop: "partnerName",
    minWidth: 170,
    slot: "partner",
    showOverflowTooltip: true
  },
  { label: "单价", prop: "price", minWidth: 90, slot: "price" },
  { label: "日上限", prop: "dailyLimit", minWidth: 130, slot: "limit" },
  { label: "状态", prop: "enabled", minWidth: 110, slot: "status" },
  { label: "创建时间", prop: "createTime", minWidth: 165 },
  { label: "操作", fixed: "right", width: 240, slot: "operation" }
];

/** 概览：总数 / 启用 / 停用，直接来自数据而不是写死 */
const stats = computed(() => {
  const all = totalRows.value;
  const enabled = all.filter(item => item.enabled).length;
  return {
    total: all.length,
    enabled,
    disabled: all.length - enabled
  };
});

/**
 * TODO: 接后端时把本文件里的 loadData 换成真实接口，例如
 *   import { getInterfaceList } from "@/api/service";
 *   const { data } = await getInterfaceList({ ...queryForm, ...pagination });
 * 数据源现统一在 ./data.ts，与合作方详情页共享。
 */
function loadData() {
  loading.value = true;
  totalRows.value = getInterfaceRows();
  const keyword = queryForm.keyword.trim().toLowerCase();
  const filtered = totalRows.value.filter(item => {
    const matchKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.path.toLowerCase().includes(keyword) ||
      item.partnerName.toLowerCase().includes(keyword);
    const matchPartner =
      queryForm.partnerId === undefined ||
      item.partnerId === queryForm.partnerId;
    const matchEnabled =
      queryForm.enabled === undefined || item.enabled === queryForm.enabled;
    return matchKeyword && matchPartner && matchEnabled;
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
  queryForm.partnerId = undefined;
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

function openConfig(row: InterfaceRow) {
  router.push(`/service/interfaces/edit/${row.id}`);
}

/* ------------------------------ 新增 ------------------------------ */

// 接口归属合作方，所以先选合作方再进分步表单
const createVisible = ref(false);
const createPartnerId = ref<number | undefined>();

function openCreate() {
  createPartnerId.value = queryForm.partnerId ?? undefined;
  createVisible.value = true;
}

function goCreate() {
  if (createPartnerId.value === undefined) return;
  createVisible.value = false;
  router.push({
    path: "/service/interfaces/edit/new",
    query: { partnerId: String(createPartnerId.value) }
  });
}

/* ------------------------------ 复制 ------------------------------ */

function copy(value: string | undefined, label: string) {
  const text = (value ?? "").trim();
  if (!text) {
    ElMessage.warning(`${label}为空`);
    return;
  }
  if (copyTextToClipboard(text)) {
    ElMessage.success(`已复制${label}`);
  } else {
    ElMessage.error("复制失败，请手动选中复制");
  }
}

/* ------------------------------ 批量选择 ------------------------------ */

const selectedRows = ref<InterfaceRow[]>([]);

function handleSelectionChange(rows: InterfaceRow[]) {
  selectedRows.value = rows;
}

function handleBatchDelete() {
  const rows = selectedRows.value;
  if (!rows.length) {
    ElMessage.warning("请先勾选要删除的接口");
    return;
  }
  const preview = rows
    .slice(0, 3)
    .map(item => `「${item.name}」`)
    .join("、");
  const suffix = rows.length > 3 ? ` 等 ${rows.length} 个` : "";
  ElMessageBox.confirm(
    `将删除 ${preview}${suffix}。删除后调用方请求会直接 404，且不可恢复。`,
    `批量删除 ${rows.length} 个接口`,
    {
      type: "warning",
      confirmButtonText: "全部删除",
      confirmButtonClass: "el-button--danger"
    }
  )
    .then(() => {
      const removed = deleteInterfaces(rows.map(item => item.id));
      selectedRows.value = [];
      loadData();
      ElMessage.success(
        removed ? `已删除 ${removed} 个接口` : "没有可删除的接口"
      );
    })
    .catch(() => {});
}

/* ------------------------------ 导入 / 导出 ------------------------------ */

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** 导出当前筛选结果（不分页），拿到的 CSV 可以直接改完再导回 */
function handleExport() {
  const rows = totalRows.value;
  if (!rows.length) {
    ElMessage.warning("当前筛选下没有可导出的接口");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(toCsv(rows), `接口清单-${stamp}.csv`);
  ElMessage.success(`已导出 ${rows.length} 条`);
}

function handleTemplate() {
  download(toCsvTemplate(), "接口清单-导入模板.csv");
}

const importVisible = ref(false);
const importFileName = ref("");
const importPlan = ref<ImportPlan | null>(null);
const importReading = ref(false);

function openImport() {
  importVisible.value = true;
  importFileName.value = "";
  importPlan.value = null;
}

async function handleImportFile(file: { raw?: File }) {
  const raw = file.raw;
  if (!raw) return;
  importReading.value = true;
  try {
    importFileName.value = raw.name;
    importPlan.value = planImport(await raw.text());
  } catch (error) {
    ElMessage.error(`读取文件失败：${(error as Error).message}`);
  } finally {
    importReading.value = false;
  }
}

function confirmImport() {
  const plan = importPlan.value;
  if (!plan || !plan.plan.length) return;
  applyImport(plan.plan);
  importVisible.value = false;
  loadData();
  ElMessage.success(
    `导入完成：新增 ${plan.created} 条，更新 ${plan.updated} 条`
  );
}

function handleRowClick(row: InterfaceRow, column: { type?: string }) {
  if (column?.type === "selection") return;
  openConfig(row);
}

function handleToggle(row: InterfaceRow) {
  const action = row.enabled ? "停用" : "启用";
  const run = () => {
    if (!toggleInterface(row.partnerId, row.id)) {
      ElMessage.error("接口不存在，可能已被删除");
      return;
    }
    loadData();
    ElMessage.success(`${action}成功`);
  };
  if (row.enabled) {
    ElMessageBox.confirm(
      `停用后「${row.name}」将拒绝新的调用请求，确认停用？`,
      "停用接口",
      { type: "warning" }
    )
      .then(run)
      .catch(() => {});
    return;
  }
  run();
}

loadData();

function handleDelete(row: InterfaceRow) {
  ElMessageBox.confirm(
    `删除后「${row.name}」（${row.code}）将从合作方「${row.partnerName}」下移除，已对接的调用会直接 404，且不可恢复。`,
    "删除接口",
    {
      type: "warning",
      confirmButtonText: "删除",
      confirmButtonClass: "el-button--danger"
    }
  )
    .then(() => {
      if (!deleteInterface(row.id)) {
        ElMessage.error("接口不存在，可能已被删除");
        return;
      }
      loadData();
      ElMessage.success("已删除");
    })
    .catch(() => {});
}

// 页面会被 keepAlive 缓存，从配置页返回时重新取一次，否则看到的是进入前的旧数据
onActivated(loadData);

// 复制按钮里的提示用 ElMessage，页面销毁时关掉残留
onBeforeUnmount(() => {
  ElMessage.closeAll();
});
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
          placeholder="接口名称 / 路径 / 合作方"
          clearable
          style="width: 220px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="合作方">
        <el-select
          v-model="queryForm.partnerId"
          placeholder="全部合作方"
          clearable
          filterable
          style="width: 200px"
        >
          <el-option
            v-for="item in partnerOptions"
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
        <el-button plain @click="openImport">
          <template #icon><UploadIcon /></template>
          导入
        </el-button>
        <el-button plain @click="handleExport">
          <template #icon><DownloadIcon /></template>
          导出
        </el-button>
      </template>
      <template #title>
        <div class="bar-title">
          <span>接口清单</span>
          <span class="bar-title__stat">
            共 {{ stats.total }} 个 · 启用
            <b class="is-on">{{ stats.enabled }}</b> · 停用
            <b class="is-off">{{ stats.disabled }}</b>
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
            <button
              type="button"
              class="copy"
              title="复制接口名称"
              @click.stop="copy(row.name, '接口名称')"
            >
              <CopyIcon />
            </button>
          </template>
          <template #code="{ row }">
            <span class="cell-code">{{ row.code }}</span>
            <button
              type="button"
              class="copy"
              title="复制接口标识"
              @click.stop="copy(row.code, '接口标识')"
            >
              <CopyIcon />
            </button>
          </template>
          <template #partner="{ row }">
            <span class="cell-partner">{{ row.partnerName }}</span>
            <span class="cell-code">{{ row.partnerCode }}</span>
          </template>
          <template #endpoint="{ row }">
            <span class="mth" :class="`mth--${row.method.toLowerCase()}`">
              {{ row.method }}
            </span>
            <span class="path">{{ row.path }}</span>
            <button
              type="button"
              class="copy"
              title="复制请求地址"
              @click.stop="copy(row.path, '请求地址')"
            >
              <CopyIcon />
            </button>
          </template>
          <template #price="{ row }">
            <span class="num">{{ formatPrice(row.price) }}</span>
          </template>
          <template #limit="{ row }">
            <span class="num">{{ formatLimit(row.dailyLimit) }}</span>
          </template>
          <template #status="{ row }">
            <span class="dot" :class="`dot--${getCallHealth(row).tone}`">
              {{ getCallHealth(row).label }}
            </span>
          </template>
          <template #operation="{ row }">
            <el-button
              size="small"
              plain
              type="primary"
              @click.stop="openConfig(row)"
            >
              配置
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

    <el-dialog v-model="createVisible" title="新增接口" width="420px">
      <p class="create-tip">
        接口归属具体合作方。先选合作方，再填标识、路径与入参出参。
      </p>
      <el-select
        v-model="createPartnerId"
        placeholder="选择合作方"
        filterable
        style="width: 100%"
      >
        <el-option
          v-for="item in partnerOptions"
          :key="item.value"
          :label="`${item.label}（${item.code}）`"
          :value="item.value"
        />
      </el-select>
      <template #footer>
        <el-button size="small" @click="createVisible = false">取消</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="createPartnerId === undefined"
          @click="goCreate"
        >
          下一步
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.main {
  padding: 16px;
}

.search-form {
  padding: 16px 16px 0;
  margin-bottom: 16px;
  background: var(--el-bg-color);
  border-radius: 6px;
}

/* el-dialog 挂 body，拿不到 scoped 的 data-v，必须 :global */
:global(.create-tip) {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

:global(.imp) {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

:global(.imp__step) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

:global(.imp__label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:global(.imp__hint) {
  flex: 1;
  min-width: 240px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

:global(.imp__file) {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

:global(.imp__result) {
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

:global(.imp__summary) {
  margin: 0;
  font-size: 13px;
}

:global(.imp__summary b) {
  font-variant-numeric: tabular-nums;
}

:global(.imp__summary .is-ok) {
  color: var(--el-color-success);
}

:global(.imp__summary .is-bad) {
  color: var(--el-color-danger);
}

:global(.imp__issues) {
  max-height: 180px;
  padding-left: 18px;
  margin: 8px 0 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-color-danger);
}

/* 复制按钮：平时淡出，行悬停才显形，避免表格看着很吵 */
.copy {
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  margin-left: 4px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  background: none;
  border: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.copy:hover {
  color: var(--el-color-primary);
}

.copy svg {
  width: 13px;
  height: 13px;
}

:deep(.el-table__row:hover) .copy {
  opacity: 1;
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
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.bar-title__stat .is-on {
  color: #0f9d58;
}

.bar-title__stat .is-off {
  color: var(--el-text-color-regular);
}

.cell-name {
  color: var(--el-text-color-primary);
}

.cell-partner {
  margin-right: 6px;
  color: var(--el-text-color-regular);
}

.cell-code {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.mth {
  display: inline-block;
  min-width: 42px;
  padding: 1px 6px;
  margin-right: 8px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  border-radius: 4px;
}

.mth--get {
  color: #1f7ae0;
  background: rgb(31 122 224 / 10%);
}

.mth--post {
  color: #0f9d58;
  background: rgb(15 157 88 / 10%);
}

.path {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.num {
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
}

/* 状态用圆点，不用 el-tag 方框 */
.dot {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.dot::before {
  width: 6px;
  height: 6px;
  content: "";
  border-radius: 50%;
}

.dot--ok::before {
  background: #0f9d58;
  box-shadow: 0 0 0 3px rgb(15 157 88 / 12%);
}

.dot--off::before {
  background: var(--el-text-color-placeholder);
}

.dot--warn::before {
  background: #c77700;
  box-shadow: 0 0 0 3px rgb(199 119 0 / 12%);
}
</style>
