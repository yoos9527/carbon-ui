<script setup lang="ts">
import { ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createEmptyInterface,
  methodOptions,
  payloadFormatOptions,
  type AuthConfig,
  type KV,
  type PartnerInterfaceItem
} from "../data";
import AddIcon from "~icons/ri/add-line";
import DeleteIcon from "~icons/ri/delete-bin-line";

defineOptions({ name: "InterfaceDialog" });

const props = defineProps<{
  /** 弹窗显隐（v-model） */
  modelValue: boolean;
  /** 传入则编辑，null 为新增 */
  editing: PartnerInterfaceItem | null;
  /** 当前合作方已配置的鉴权，用于下拉引用 */
  authOptions: AuthConfig[];
}>();

const emit = defineEmits<{
  "update:modelValue": [visible: boolean];
  submit: [row: PartnerInterfaceItem];
}>();

const formRef = ref<FormInstance>();
const form = ref<PartnerInterfaceItem>(createEmptyInterface());

const rules: FormRules = {
  name: [{ required: true, message: "请输入能力名称", trigger: "blur" }],
  path: [{ required: true, message: "请输入接口路径", trigger: "blur" }],
  method: [{ required: true, message: "请选择请求方式", trigger: "change" }],
  payloadFormat: [
    { required: true, message: "请选择报文格式", trigger: "change" }
  ]
};

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return;
    form.value = props.editing
      ? (JSON.parse(JSON.stringify(props.editing)) as PartnerInterfaceItem)
      : createEmptyInterface();
    formRef.value?.clearValidate();
  },
  { immediate: true }
);

function close() {
  emit("update:modelValue", false);
}

function addKv(list: KV[]) {
  list.push({ key: "", value: "" });
}

function removeKv(list: KV[], index: number) {
  list.splice(index, 1);
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  const payload = JSON.parse(JSON.stringify(form.value)) as PartnerInterfaceItem;
  payload.extraHeaders = payload.extraHeaders.filter(item => item.key.trim());
  payload.extraParams = payload.extraParams.filter(item => item.key.trim());
  emit("submit", payload);
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="props.editing ? '编辑接口' : '新增接口'"
    width="760px"
    top="8vh"
    destroy-on-close
    @update:model-value="close"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="能力名称" prop="name">
            <el-input
              v-model="form.name"
              placeholder="如：企业工商基本信息"
              maxlength="40"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="引用鉴权">
            <el-select
              v-model="form.authId"
              class="w-full"
              clearable
              placeholder="不引用（仅用公共请求头）"
            >
              <el-option
                v-for="item in props.authOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="接口路径" prop="path">
        <el-input
          v-model="form.path"
          placeholder="相对合作方 Base URL，如 /api/ent/base"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="请求方式" prop="method">
            <el-select v-model="form.method" class="w-full">
              <el-option
                v-for="item in methodOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="报文格式" prop="payloadFormat">
            <el-select v-model="form.payloadFormat" class="w-full">
              <el-option
                v-for="item in payloadFormatOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="超时覆盖">
            <el-input-number
              v-model="form.timeout"
              :min="100"
              :step="100"
              controls-position="right"
              placeholder="跟随默认"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="单价">
            <el-input-number
              v-model="form.price"
              :min="0"
              :precision="2"
              :step="0.1"
              controls-position="right"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="日调用上限">
            <el-input-number
              v-model="form.dailyLimit"
              :min="0"
              :step="1000"
              controls-position="right"
            />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="启用">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="独立请求头">
        <div class="kv-block">
          <div
            v-for="(item, index) in form.extraHeaders"
            :key="`header-${index}`"
            class="kv-row"
          >
            <el-input v-model="item.key" placeholder="参数名" class="kv-key" />
            <el-input v-model="item.value" placeholder="参数值" class="kv-value" />
            <el-button
              link
              type="danger"
              :icon="DeleteIcon"
              @click="removeKv(form.extraHeaders, index)"
            />
          </div>
          <el-button link type="primary" :icon="AddIcon" @click="addKv(form.extraHeaders)">
            添加请求头
          </el-button>
        </div>
      </el-form-item>

      <el-form-item label="独立参数">
        <div class="kv-block">
          <div
            v-for="(item, index) in form.extraParams"
            :key="`param-${index}`"
            class="kv-row"
          >
            <el-input v-model="item.key" placeholder="参数名" class="kv-key" />
            <el-input v-model="item.value" placeholder="参数值" class="kv-value" />
            <el-button
              link
              type="danger"
              :icon="DeleteIcon"
              @click="removeKv(form.extraParams, index)"
            />
          </div>
          <el-button link type="primary" :icon="AddIcon" @click="addKv(form.extraParams)">
            添加参数
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.w-full {
  width: 100%;
}

:deep(.el-input-number) {
  width: 140px;
}

.kv-block {
  width: 100%;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.kv-key {
  width: 220px;
}

.kv-value {
  flex: 1;
}
</style>
