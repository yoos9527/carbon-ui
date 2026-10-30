<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  createForm,
  fieldTypeOptions,
  formSteps,
  getAuthOptions,
  getInterfaceRowById,
  getPartnerById,
  defaultValueError,
  isCodeTaken,
  paramLocationOptions,
  processorOptions,
  saveInterfaceForm,
  toForm,
  validateAll,
  validateStep,
  type InterfaceForm,
  type InterfaceRow
} from "./data";
import {
  getAuthTypeLabel,
  nextId,
  type AuthConfig,
  type InterfaceParam,
  type InterfaceResponseField
} from "../partners/data";
import BackIcon from "~icons/ri/arrow-left-line";
import AddIcon from "~icons/ri/add-line";
import DeleteIcon from "~icons/ri/delete-bin-line";
import CheckIcon from "~icons/ri/check-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServiceInterfaceEdit" });

const route = useRoute();
const router = useRouter();

const row = ref<InterfaceRow | null>(null);
const form = ref<InterfaceForm>(createForm(0));
const authOptions = ref<AuthConfig[]>([]);
const step = ref(1);
const error = ref<{
  step: number;
  field?: string;
  rowIndex?: number;
  column?: string;
  message: string;
} | null>(null);

const missing = computed(() => !partner.value);
const isNew = computed(() => String(route.params.id) === "new");
const partner = computed(() =>
  form.value.partnerId ? getPartnerById(form.value.partnerId) : undefined
);
const partnerName = computed(() => partner.value?.name ?? "—");
const partnerCode = computed(() => partner.value?.code ?? "");

/** 标识重名实时提示，不必等点保存 */
const codeTaken = computed(
  () =>
    form.value.code.trim() !== "" && isCodeTaken(form.value.code, form.value.id)
);

const currentAuth = computed(() =>
  authOptions.value.find(item => item.id === form.value.authId)
);

const stepHints = computed(() => [
  form.value.name.trim() ? "已填写" : "待填写",
  `${form.value.params.length} 个入参`,
  `${form.value.responses.length} 个出参`
]);

function load() {
  const raw = String(route.params.id);
  if (raw === "new") {
    // 新建：合作方由列表页「新增接口」弹窗选定，通过 query 带过来
    const partnerId = Number(route.query.partnerId);
    row.value = null;
    authOptions.value = getAuthOptions(partnerId);
    form.value = createForm(partnerId);
  } else {
    const found = getInterfaceRowById(Number(raw));
    row.value = found;
    authOptions.value = found ? getAuthOptions(found.partnerId) : [];
    form.value = found ? toForm(found) : createForm(0);
  }
  step.value = 1;
  error.value = null;
}

load();
watch(() => route.params.id, load);

function goBack() {
  router.push("/service/interfaces");
}

function isFieldError(field: string) {
  return error.value?.step === 1 && error.value.field === field;
}

function isCellError(index: number, column: string) {
  return error.value?.rowIndex === index && error.value?.column === column;
}

function goto(target: number) {
  if (target === step.value) return;
  if (target < step.value) {
    error.value = null;
    step.value = target;
    return;
  }
  // 往前跳：把中间经过的步骤依次校验，不过就停在出错的那一步
  for (let index = step.value; index < target; index += 1) {
    const result = validateStep(index, form.value);
    if (result) {
      error.value = result;
      step.value = index;
      ElMessage.error(result.message);
      return;
    }
  }
  error.value = null;
  step.value = target;
}

function next() {
  const result = validateStep(step.value, form.value);
  if (result) {
    error.value = result;
    ElMessage.error(result.message);
    return;
  }
  error.value = null;
  step.value = Math.min(formSteps.length, step.value + 1);
}

function prev() {
  error.value = null;
  step.value = Math.max(1, step.value - 1);
}

function submit() {
  if (missing.value) return;
  const result = validateAll(form.value);
  if (result) {
    step.value = result.step;
    error.value = result;
    ElMessage.error(result.message);
    return;
  }
  if (!saveInterfaceForm(form.value)) {
    ElMessage.error("保存失败：合作方不存在");
    return;
  }
  ElMessage.success(isNew.value ? "已创建" : "已保存");
  goBack();
}

function addParam() {
  form.value.params.push({
    id: nextId(),
    name: "",
    location: "query",
    type: "string",
    required: false,
    desc: "",
    defaultValue: ""
  } satisfies InterfaceParam);
}

function removeParam(index: number) {
  form.value.params.splice(index, 1);
  error.value = null;
}

function addResponse() {
  form.value.responses.push({
    id: nextId(),
    name: "",
    path: "",
    type: "string",
    required: false,
    desc: "",
    example: ""
  } satisfies InterfaceResponseField);
}

function removeResponse(index: number) {
  form.value.responses.splice(index, 1);
  error.value = null;
}
</script>

<template>
  <div class="ix">
    <div v-if="missing" class="ix-missing">
      <p>接口不存在，可能已被删除。</p>
      <el-button size="small" @click="goBack">返回列表</el-button>
    </div>

    <template v-else>
      <header class="ix-head">
        <div class="ix-head__top">
          <button class="ix-back" title="返回列表" @click="goBack">
            <BackIcon />
          </button>
          <div class="ix-head__id">
            <h1 class="ix-head__name">{{ form.name || "未命名接口" }}</h1>
            <span class="ix-head__code">{{ form.code || "—" }}</span>
            <span class="ix-head__partner">
              {{ partnerName }}
              <em v-if="partnerCode">{{ partnerCode }}</em>
            </span>
            <span class="dot" :class="form.enabled ? 'dot--ok' : 'dot--off'">
              {{ form.enabled ? "启用" : "停用" }}
            </span>
          </div>
          <div class="ix-head__ops">
            <el-button size="small" @click="goBack">取消</el-button>
            <el-button size="small" type="primary" @click="submit">
              {{ isNew ? "创建" : "保存" }}
            </el-button>
          </div>
        </div>
      </header>

      <div class="ix-body">
        <nav class="ix-steps">
          <button
            v-for="(item, index) in formSteps"
            :key="item.title"
            type="button"
            class="ix-step"
            :class="{
              'is-active': step === index + 1,
              'is-done': step > index + 1
            }"
            @click="goto(index + 1)"
          >
            <span class="ix-step__no">
              <CheckIcon v-if="step > index + 1" />
              <template v-else>{{ index + 1 }}</template>
            </span>
            <span class="ix-step__text">
              <span class="ix-step__title">{{ item.title }}</span>
              <span class="ix-step__desc">{{ stepHints[index] }}</span>
            </span>
          </button>
        </nav>

        <section class="ix-panel">
          <!-- ------------------------------ 第一步 ------------------------------ -->
          <div v-show="step === 1">
            <div class="sec">
              <div class="sec__head">
                <h2 class="sec__title">基本信息</h2>
                <span class="sec__hint">对接方看到的接口身份信息</span>
              </div>
              <form class="grid grid--4" @submit.prevent>
                <div class="f f--4">
                  <span class="f__label">所属合作方</span>
                  <span class="f__static">
                    {{ partnerName }}
                    <em v-if="partnerCode">{{ partnerCode }}</em>
                  </span>
                </div>
                <label
                  class="f f--2"
                  :class="{ 'is-error': isFieldError('name') }"
                >
                  <span class="f__label">接口名称</span>
                  <el-input
                    v-model="form.name"
                    placeholder="如：企业工商基本信息"
                    maxlength="40"
                  />
                </label>
                <label
                  class="f f--2"
                  :class="{ 'is-error': isFieldError('code') }"
                >
                  <span class="f__label">接口标识</span>
                  <el-input
                    v-model="form.code"
                    class="mono-field"
                    placeholder="如：ENT_BASE_V1"
                    maxlength="40"
                  />
                  <span v-if="codeTaken" class="f__err">该标识已被占用</span>
                  <span v-else class="f__tip"
                    >字母、数字、下划线，全局唯一</span
                  >
                </label>
                <label class="f">
                  <span class="f__label">请求方法</span>
                  <el-select v-model="form.method" style="width: 100%">
                    <el-option label="GET" value="GET" />
                    <el-option label="POST" value="POST" />
                  </el-select>
                </label>
                <label class="f">
                  <span class="f__label">报文格式</span>
                  <el-select v-model="form.payloadFormat" style="width: 100%">
                    <el-option label="JSON" value="json" />
                    <el-option label="XML" value="xml" />
                    <el-option label="Form" value="form" />
                  </el-select>
                </label>
                <label
                  class="f f--2"
                  :class="{ 'is-error': isFieldError('path') }"
                >
                  <span class="f__label">请求路径</span>
                  <el-input
                    v-model="form.path"
                    class="mono-field"
                    placeholder="/api/ent/base"
                  />
                  <span class="f__tip">相对合作方环境地址，以 / 开头</span>
                </label>
                <label class="f">
                  <span class="f__label">前置处理器</span>
                  <el-select v-model="form.preProcessor" style="width: 100%">
                    <el-option
                      v-for="item in processorOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </label>
                <label class="f">
                  <span class="f__label">后置处理器</span>
                  <el-select v-model="form.postProcessor" style="width: 100%">
                    <el-option
                      v-for="item in processorOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </label>
                <label class="f f--4">
                  <span class="f__label">鉴权绑定</span>
                  <el-select
                    v-model="form.authId"
                    clearable
                    placeholder="沿用合作方默认鉴权"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in authOptions"
                      :key="item.id"
                      :label="`${item.name}（${getAuthTypeLabel(item.authType)}）`"
                      :value="item.id"
                    />
                  </el-select>
                  <span v-if="currentAuth" class="f__tip">
                    <template v-if="currentAuth.authType === 'header'">
                      公共请求头：
                      <template v-if="currentAuth.headers.length">
                        <code
                          v-for="header in currentAuth.headers"
                          :key="header.key"
                          class="kv"
                          >{{ header.key }}: {{ header.value }}</code
                        >
                      </template>
                      <template v-else>未配置具体请求头</template>
                    </template>
                    <template v-else>
                      脚本签名（{{ currentAuth.scriptLang }}，
                      {{ currentAuth.scriptTimeout ?? 1000 }}ms）
                    </template>
                  </span>
                </label>
              </form>
            </div>

            <div class="sec">
              <div class="sec__head">
                <h2 class="sec__title">调用参数</h2>
                <span class="sec__hint">留空的项沿用合作方默认值</span>
              </div>
              <form class="grid grid--4" @submit.prevent>
                <label class="f" :class="{ 'is-error': isFieldError('price') }">
                  <span class="f__label">单价</span>
                  <el-input-number
                    v-model="form.price"
                    :min="0"
                    :precision="4"
                    :step="0.1"
                    :controls="false"
                    style="width: 100%"
                  />
                  <span class="f__tip">元 / 次，0 表示免费</span>
                </label>
                <label class="f">
                  <span class="f__label">日上限</span>
                  <el-input-number
                    v-model="form.dailyLimit"
                    :min="0"
                    :step="1000"
                    :controls="false"
                    placeholder="不限"
                    style="width: 100%"
                  />
                </label>
                <label class="f">
                  <span class="f__label">超时</span>
                  <el-input-number
                    v-model="form.timeout"
                    :min="0"
                    :step="500"
                    :controls="false"
                    placeholder="沿用合作方"
                    style="width: 100%"
                  />
                  <span class="f__tip">毫秒</span>
                </label>
                <div class="f">
                  <span class="f__label">启用状态</span>
                  <el-switch
                    v-model="form.enabled"
                    inline-prompt
                    active-text="启用"
                    inactive-text="停用"
                  />
                </div>
              </form>
            </div>
          </div>

          <!-- ------------------------------ 第二步 ------------------------------ -->
          <div v-show="step === 2">
            <div class="sec">
              <div class="sec__head">
                <h2 class="sec__title">请求入参</h2>
                <span class="sec__hint">
                  参数名在同一接口内唯一；位置决定它进 header / query / path /
                  body
                </span>
              </div>
              <el-table
                :data="form.params"
                border
                size="small"
                class="editable"
                empty-text="还没有入参，点下方「添加行」"
              >
                <el-table-column label="参数名" min-width="170">
                  <template #default="{ row: item, $index }">
                    <el-input
                      v-model="item.name"
                      class="cell-input"
                      :class="{ 'is-error': isCellError($index, 'name') }"
                      placeholder="keyword"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="位置" width="118">
                  <template #default="{ row: item }">
                    <el-select v-model="item.location" size="small">
                      <el-option
                        v-for="opt in paramLocationOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="112">
                  <template #default="{ row: item }">
                    <el-select v-model="item.type" size="small">
                      <el-option
                        v-for="opt in fieldTypeOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="必填" width="66" align="center">
                  <template #default="{ row: item }">
                    <el-switch v-model="item.required" size="small" />
                  </template>
                </el-table-column>
                <el-table-column label="默认值" min-width="160">
                  <template #default="{ row: item, $index }">
                    <el-input
                      v-model="item.defaultValue"
                      class="cell-input mono-input"
                      :class="{
                        'is-error':
                          isCellError($index, 'defaultValue') ||
                          !!defaultValueError(item.defaultValue, item.type)
                      }"
                      :placeholder="'可选，按类型校验'"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="说明" min-width="180">
                  <template #default="{ row: item }">
                    <el-input
                      v-model="item.desc"
                      class="cell-input"
                      placeholder="用途说明"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="" width="52" align="center">
                  <template #default="{ $index }">
                    <el-button
                      link
                      type="danger"
                      title="删除该行"
                      @click="removeParam($index)"
                    >
                      <template #icon><DeleteIcon /></template>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <button type="button" class="add-row" @click="addParam">
                <AddIcon /> 添加行
              </button>
            </div>
          </div>

          <!-- ------------------------------ 第三步 ------------------------------ -->
          <div v-show="step === 3">
            <div class="sec">
              <div class="sec__head">
                <h2 class="sec__title">响应出参</h2>
                <span class="sec__hint">
                  层级用路径表达，如 <code class="kv">data.list[].name</code>
                </span>
              </div>
              <el-table
                :data="form.responses"
                border
                size="small"
                class="editable"
                empty-text="还没有出参，点下方「添加行」"
              >
                <el-table-column label="字段名" min-width="140">
                  <template #default="{ row: item }">
                    <el-input
                      v-model="item.name"
                      class="cell-input mono-input"
                      placeholder="entName"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="112">
                  <template #default="{ row: item }">
                    <el-select v-model="item.type" size="small">
                      <el-option
                        v-for="opt in fieldTypeOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="路径" min-width="210">
                  <template #default="{ row: item, $index }">
                    <el-input
                      v-model="item.path"
                      class="cell-input mono-input"
                      :class="{ 'is-error': isCellError($index, 'path') }"
                      placeholder="data.list[].name"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="必返" width="66" align="center">
                  <template #default="{ row: item }">
                    <el-switch v-model="item.required" size="small" />
                  </template>
                </el-table-column>
                <el-table-column label="说明" min-width="170">
                  <template #default="{ row: item }">
                    <el-input
                      v-model="item.desc"
                      class="cell-input"
                      placeholder="含义"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="示例值" min-width="150">
                  <template #default="{ row: item }">
                    <el-input
                      v-model="item.example"
                      class="cell-input mono-input"
                      placeholder="可选"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="" width="52" align="center">
                  <template #default="{ $index }">
                    <el-button
                      link
                      type="danger"
                      title="删除该行"
                      @click="removeResponse($index)"
                    >
                      <template #icon><DeleteIcon /></template>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <button type="button" class="add-row" @click="addResponse">
                <AddIcon /> 添加行
              </button>
            </div>
          </div>

          <div class="ix-actions">
            <el-button v-if="step > 1" size="small" @click="prev">
              上一步
            </el-button>
            <span class="ix-actions__hint">
              <template v-if="error">{{ error.message }}</template>
              <template v-else
                >第 {{ step }} / {{ formSteps.length }} 步</template
              >
            </span>
            <el-button
              v-if="step < formSteps.length"
              size="small"
              type="primary"
              @click="next"
            >
              下一步
            </el-button>
            <el-button v-else size="small" type="primary" @click="submit">
              {{ isNew ? "创建" : "保存" }}
            </el-button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.ix {
  --ink: #16233a;
  --ink-2: #46536e;
  --muted: #8792a8;
  --line: #e6eaf2;
  --line-soft: #eef1f7;
  --surface: #fff;
  --accent: var(--el-color-primary);
  --on: #0f9d58;
  --warn: #c77700;
  /* 掺色基准，暗色下要换成深色，color-mix 才不会冒白 */
  --mix: #fff;
  --mix-ink: #0b1a33;
  --wash: #fafbfd;
  --hover: #f4f6fa;

  color: var(--ink);
}

html.dark .ix {
  --ink: #e6ebf5;
  --ink-2: #a7b2c7;
  --muted: #7a879e;
  --line: #262d3b;
  --line-soft: #1e242f;
  --surface: #151a23;
  --mix: #151a23;
  --mix-ink: #e8eefc;
  --wash: #1a2029;
  --hover: #1d232e;
  --on: #3fbf7f;
  --warn: #e0a33a;
}

.ix-missing {
  padding: 60px 0;
  text-align: center;
  color: var(--muted);
}

/* ------------------------------- 头部 ------------------------------- */
.ix-head {
  padding: 18px 22px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;

  &__top {
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }

  &__id {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    align-items: center;
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 0.2px;
  }

  &__code {
    padding-left: 2px;
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: 12px;
    color: var(--muted);
  }

  &__partner {
    font-size: 12px;
    color: var(--ink-2);

    em {
      margin-left: 5px;
      font-style: normal;
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      color: var(--muted);
    }
  }

  &__ops {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
}

.ix-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  transition: all 0.15s;

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--mix));
    border-color: color-mix(in srgb, var(--accent) 40%, var(--mix));
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 55%, var(--mix));
    outline-offset: 1px;
  }
}

/* ------------------------------- 主体 ------------------------------- */
.ix-body {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  margin-top: 12px;
}

.ix-steps {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
}

.ix-step {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 11px 12px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 7px;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: var(--hover);
  }

  &.is-active {
    background: color-mix(in srgb, var(--accent) 7%, var(--mix));

    .ix-step__title {
      color: var(--accent);
      font-weight: 600;
    }

    .ix-step__no {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
    }
  }

  &.is-done .ix-step__no {
    color: var(--on);
    background: transparent;
    border-color: color-mix(in srgb, var(--on) 40%, var(--mix));
  }
}

.ix-step__no {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 50%;

  svg {
    width: 12px;
    height: 12px;
  }
}

.ix-step__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.ix-step__title {
  font-size: 13px;
  color: var(--ink);
}

.ix-step__desc {
  font-size: 11px;
  color: var(--muted);
}

.ix-panel {
  padding: 4px 22px 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
}

/* ------------------------------- 分区 ------------------------------- */
.sec {
  padding: 20px 0;

  & + & {
    border-top: 1px solid var(--line-soft);
  }

  &__head {
    display: flex;
    gap: 12px;
    align-items: baseline;
    margin-bottom: 16px;
  }

  &__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }

  &__hint {
    font-size: 12px;
    color: var(--muted);
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 32px;
  margin: 0;

  &--4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.f {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;

  &--wide {
    grid-column: span 2;
  }

  /** 四列网格里的跨度：2 = 半行，4 = 独占一行 */
  &--2 {
    grid-column: span 2;
  }

  &--4 {
    grid-column: span 4;
  }

  &__label {
    font-size: 12px;
    color: var(--muted);
  }

  &__tip {
    font-size: 11px;
    line-height: 1.5;
    color: var(--muted);
  }

  &__err {
    font-size: 11px;
    color: var(--el-color-danger);
  }

  &__static {
    padding: 5px 0;
    font-size: 13px;
    color: var(--ink);

    em {
      margin-left: 5px;
      font-style: normal;
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      font-size: 12px;
      color: var(--muted);
    }
  }

  /* 出错时只给控件描红，不整块跳红，避免满屏红框 */
  &.is-error {
    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      box-shadow: 0 0 0 1px var(--el-color-danger) inset;
    }
  }
}

.mono-field :deep(.el-input__inner),
.mono-input :deep(.el-input__inner) {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
}

.kv {
  padding: 1px 5px;
  margin-right: 6px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11px;
  color: var(--ink-2);
  background: var(--wash);
  border: 1px solid var(--line-soft);
  border-radius: 4px;
}

/* ------------------------------- 可编辑表 ------------------------------- */
.editable {
  :deep(.el-table__cell) {
    padding: 4px 6px;
  }

  :deep(.el-select) {
    width: 100%;
  }

  :deep(.cell) {
    padding: 0 2px;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px transparent inset;

    &:hover {
      box-shadow: 0 0 0 1px var(--line) inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px var(--accent) inset;
    }
  }

  .cell-input.is-error :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset;
  }
}

.add-row {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 7px 10px;
  margin-top: 10px;
  font: inherit;
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
  background: transparent;
  border: 1px dashed var(--line);
  border-radius: 6px;
  transition: all 0.15s;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--mix));
    background: color-mix(in srgb, var(--accent) 4%, var(--mix));
  }
}

/* ------------------------------- 底部操作 ------------------------------- */
.ix-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 13px 0;
  margin-top: 4px;
  background: var(--surface);
  border-top: 1px solid var(--line-soft);

  &__hint {
    flex: 1;
    font-size: 12px;
    color: var(--muted);
    text-align: right;
  }
}

.dot {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--ink-2);

  &::before {
    width: 6px;
    height: 6px;
    content: "";
    background: var(--muted);
    border-radius: 50%;
  }

  &--ok::before {
    background: var(--on);
  }

  &--off::before {
    background: var(--muted);
  }

  &--warn::before {
    background: var(--warn);
  }
}

@media (width <= 1280px) {
  .ix-body {
    grid-template-columns: 176px minmax(0, 1fr);
  }

  .grid--4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .f--4 {
    grid-column: span 2;
  }
}

@media (width <= 960px) {
  .ix-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .ix-steps {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }

  .ix-step {
    flex: 0 0 auto;
  }

  .grid,
  .grid--4 {
    grid-template-columns: minmax(0, 1fr);
  }

  .f--wide,
  .f--2,
  .f--4 {
    grid-column: span 1;
  }
}
</style>
