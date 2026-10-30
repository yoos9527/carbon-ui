<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import {
  createEmptyPartner,
  deletePartners,
  getStatusOption,
  togglePartnerStatus,
  mockPartners,
  type PartnerItem
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
import EditIcon from "~icons/ri/edit-line";
import DeleteIcon from "~icons/ri/delete-bin-line";
import UploadIcon from "~icons/ri/upload-2-line";
import DownloadIcon from "~icons/ri/download-2-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServicePartners" });

type PartnerForm = Pick<
  PartnerItem,
  "name" | "code" | "contact" | "phone" | "status"
>;

const router = useRouter();
const loading = ref(false);
const dataList = ref<PartnerItem[]>([]);
const totalRows = ref<PartnerItem[]>([]);

const queryForm = reactive({
  name: "",
  status: undefined as number | undefined
});

const pagination = reactive({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true
});

const columns: TableColumnList = [
  { type: "selection", width: 55, align: "left" },
  {
    label: "名称",
    prop: "name",
    minWidth: 200,
    slot: "name",
    showOverflowTooltip: true
  },
  { label: "编码", prop: "code", minWidth: 120 },
  { label: "联系人", prop: "contact", minWidth: 110 },
  { label: "联系电话", prop: "phone", minWidth: 140 },
  {
    label: "接口数",
    prop: "interfaces",
    minWidth: 100,
    slot: "interfaceCount"
  },
  { label: "状态", prop: "status", minWidth: 100, slot: "status" },
  { label: "创建时间", prop: "createTime", minWidth: 170 },
  { label: "操作", fixed: "right", width: 250, slot: "operation" }
];

/**
 * TODO: 接后端时把本文件里的 loadData 换成真实接口，例如
 *   import { getPartnerList } from "@/api/service";
 *   const { data } = await getPartnerList({ ...queryForm, ...pagination });
 * 数据源现统一放在 ./data.ts，列表页与详情页共用。
 */
function loadData() {
  loading.value = true;
  const keyword = queryForm.name.trim();
  const filtered = mockPartners.filter(item => {
    const matchName = !keyword || item.name.includes(keyword);
    const matchStatus =
      queryForm.status === undefined || item.status === queryForm.status;
    return matchName && matchStatus;
  });
  totalRows.value = filtered;
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
  queryForm.name = "";
  queryForm.status = undefined;
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

/** 进入合作方详情子页面 */
function goDetail(row: PartnerItem) {
  router.push(`/service/partners/detail/${row.id}`);
}

/** 整行可点：避开勾选列与操作列，避免误触 */
function handleRowClick(row: PartnerItem, column: { type?: string }) {
  if (column?.type === "selection") return;
  goDetail(row);
}

const dialogVisible = ref(false);
const dialogTitle = ref("新增合作方");
const submitting = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref<number | null>(null);

const form = reactive<PartnerForm>({
  name: "",
  code: "",
  contact: "",
  phone: "",
  status: 1
});

const rules = {
  name: [{ required: true, message: "请输入合作方名称", trigger: "blur" }],
  code: [{ required: true, message: "请输入编码", trigger: "blur" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }]
};

function resetForm() {
  form.name = "";
  form.code = "";
  form.contact = "";
  form.phone = "";
  form.status = 1;
  formRef.value?.clearValidate();
}

function handleAdd() {
  editingId.value = null;
  dialogTitle.value = "新增合作方";
  resetForm();
  dialogVisible.value = true;
}

function handleEdit(row: PartnerItem) {
  editingId.value = row.id;
  dialogTitle.value = "编辑合作方";
  form.name = row.name;
  form.code = row.code;
  form.contact = row.contact;
  form.phone = row.phone;
  form.status = row.status;
  formRef.value?.clearValidate();
  dialogVisible.value = true;
}

/** 启用 / 停用：停用会连带拒绝该合作方下所有接口的调用，所以先确认 */
function handleToggle(row: PartnerItem) {
  const action = row.status === 1 ? "停用" : "启用";
  const run = () => {
    // TODO: 换成真实状态接口
    if (!togglePartnerStatus(row.id)) {
      ElMessage.error("合作方不存在，可能已被删除");
      return;
    }
    loadData();
    ElMessage.success(`已${action}`);
  };
  if (action === "停用") {
    ElMessageBox.confirm(
      `停用后「${row.name}」下的接口将拒绝新的调用请求，确认停用？`,
      "停用合作方",
      { type: "warning" }
    )
      .then(run)
      .catch(() => {});
    return;
  }
  run();
}

function handleDelete(row: PartnerItem) {
  ElMessageBox.confirm(`确认删除合作方「${row.name}」？`, "删除确认", {
    type: "warning"
  })
    .then(() => {
      // TODO: 换成真实删除接口
      mockPartners.splice(
        mockPartners.findIndex(item => item.id === row.id),
        1
      );
      if (dataList.value.length === 1 && pagination.currentPage > 1) {
        pagination.currentPage -= 1;
      }
      loadData();
      ElMessage.success("删除成功");
    })
    .catch(() => {});
}

async function submitForm() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  // TODO: 换成真实新增/编辑接口
  if (editingId.value === null) {
    mockPartners.unshift({
      ...createEmptyPartner(),
      ...form,
      id: Math.max(0, ...mockPartners.map(item => item.id)) + 1,
      createTime: new Date().toLocaleString("zh-CN", { hour12: false })
    });
    ElMessage.success("新增成功");
  } else {
    const target = mockPartners.find(item => item.id === editingId.value);
    if (target) Object.assign(target, form);
    ElMessage.success("修改成功");
  }
  submitting.value = false;
  dialogVisible.value = false;
  loadData();
}

/* ------------------------------ 批量选择 ------------------------------ */

const selectedRows = ref<PartnerItem[]>([]);

function handleSelectionChange(rows: PartnerItem[]) {
  selectedRows.value = rows;
}

function handleBatchDelete() {
  const rows = selectedRows.value;
  if (!rows.length) {
    ElMessage.warning("请先勾选要删除的合作方");
    return;
  }
  const preview = rows
    .slice(0, 3)
    .map(item => `「${item.name}」`)
    .join("、");
  const suffix = rows.length > 3 ? ` 等 ${rows.length} 个` : "";
  ElMessageBox.confirm(
    `将删除 ${preview}${suffix}，其下接口会一并消失，且不可恢复。`,
    `批量删除 ${rows.length} 个合作方`,
    {
      type: "warning",
      confirmButtonText: "全部删除",
      confirmButtonClass: "el-button--danger"
    }
  )
    .then(() => {
      const removed = deletePartners(rows.map(item => item.id));
      selectedRows.value = [];
      if (dataList.value.length === 1 && pagination.currentPage > 1) {
        pagination.currentPage -= 1;
      }
      loadData();
      ElMessage.success(
        removed ? `已删除 ${removed} 个合作方` : "没有可删除的合作方"
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

function handleExport() {
  const rows = totalRows.value;
  if (!rows.length) {
    ElMessage.warning("当前筛选下没有可导出的合作方");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(toCsv(rows), `合作方清单-${stamp}.csv`);
  ElMessage.success(`已导出 ${rows.length} 条`);
}

function handleTemplate() {
  download(toCsvTemplate(), "合作方清单-导入模板.csv");
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

loadData();
</script>

<template>
  <div class="main">
    <el-form
      :inline="true"
      :model="queryForm"
      label-width="60px"
      class="search-form"
    >
      <el-form-item label="名称">
        <el-input
          v-model="queryForm.name"
          placeholder="请输入合作方名称"
          clearable
          style="width: 200px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="queryForm.status"
          placeholder="全部"
          clearable
          style="width: 120px"
        >
          <el-option label="启用" :value="1" />
          <el-option label="测试中" :value="2" />
          <el-option label="停用" :value="0" />
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
      <template #title><span /></template>
      <template #buttons>
        <el-button type="primary" plain @click="handleAdd">
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
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          row-key="id"
          border
          stripe
          adaptive
          :adaptiveConfig="{ offsetBottom: 108 }"
          align-whole="center"
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
            <el-link
              type="primary"
              :underline="false"
              @click.stop="goDetail(row)"
            >
              {{ row.name }}
            </el-link>
          </template>
          <template #interfaceCount="{ row }">
            {{ row.interfaces?.length ?? 0 }}
          </template>
          <template #status="{ row }">
            <el-tag :type="getStatusOption(row.status)?.tagType">
              {{ getStatusOption(row.status)?.label }}
            </el-tag>
          </template>
          <template #operation="{ row }">
            <el-button
              size="small"
              plain
              type="primary"
              @click.stop="handleEdit(row)"
            >
              <template #icon><EditIcon /></template>
              编辑
            </el-button>
            <el-button
              size="small"
              plain
              :type="row.status === 1 ? 'danger' : 'success'"
              @click.stop="handleToggle(row)"
            >
              {{ row.status === 1 ? "停用" : "启用" }}
            </el-button>
            <el-button
              size="small"
              plain
              type="danger"
              @click.stop="handleDelete(row)"
            >
              <template #icon><DeleteIcon /></template>
              删除
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="合作方名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入合作方名称" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="联系人" prop="contact">
          <el-input v-model="form.contact" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="导入合作方" width="620px">
      <div class="imp">
        <div class="imp__step">
          <span class="imp__label">1. 准备文件</span>
          <span class="imp__hint">
            按「编码」匹配：命中就更新档案主字段，没命中就新建。鉴权与接口不在本次导入范围。
          </span>
          <el-button link type="primary" @click="handleTemplate">
            下载模板
          </el-button>
        </div>
        <div class="imp__step">
          <span class="imp__label">2. 选择文件</span>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept=".csv,text/csv"
            :on-change="handleImportFile"
          >
            <el-button :loading="importReading">
              <template #icon><UploadIcon /></template>
              选择 CSV
            </el-button>
          </el-upload>
          <span v-if="importFileName" class="imp__file">
            {{ importFileName }}
          </span>
        </div>
        <div v-if="importPlan" class="imp__result">
          <p class="imp__summary">
            将新增 <b>{{ importPlan.created }}</b> 条、更新
            <b>{{ importPlan.updated }}</b> 条；
            <span :class="importPlan.issues.length ? 'is-bad' : 'is-ok'">
              失败 {{ importPlan.issues.length }} 行
            </span>
          </p>
          <ul v-if="importPlan.issues.length" class="imp__issues">
            <li
              v-for="item in importPlan.issues"
              :key="`${item.line}-${item.message}`"
            >
              第 {{ item.line }} 行：{{ item.message }}
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!importPlan || !importPlan.plan.length"
          @click="confirmImport"
        >
          确认导入
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
</style>
