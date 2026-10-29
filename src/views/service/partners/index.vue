<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import { mockPartners, type PartnerItem } from "./data";
import { PureTableBar } from "@/components/RePureTableBar";
import SearchIcon from "~icons/ri/search-line";
import RefreshIcon from "~icons/ri/refresh-line";
import AddIcon from "~icons/ri/add-line";
import EditIcon from "~icons/ri/edit-line";
import DeleteIcon from "~icons/ri/delete-bin-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServicePartners" });

type PartnerForm = Omit<PartnerItem, "id" | "createTime">;

const router = useRouter();
const loading = ref(false);
const dataList = ref<PartnerItem[]>([]);

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
  { label: "状态", prop: "status", minWidth: 100, slot: "status" },
  { label: "创建时间", prop: "createTime", minWidth: 170 },
  { label: "操作", fixed: "right", width: 150, slot: "operation" }
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
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">
          <template #icon><SearchIcon /></template>
          查询
        </el-button>
        <el-button @click="onReset">
          <template #icon><RefreshIcon /></template>
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar :columns="columns" @refresh="onSearch">
      <template #title><span /></template>
      <template #buttons>
        <el-button type="primary" @click="handleAdd">
          <template #icon><AddIcon /></template>
          新增
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
          <template #status="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? "启用" : "停用" }}
            </el-tag>
          </template>
          <template #operation="{ row }">
            <el-button
              link
              type="primary"
              :icon="EditIcon"
              @click.stop="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              link
              type="danger"
              :icon="DeleteIcon"
              @click.stop="handleDelete(row)"
            >
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
</style>
