<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  cacheUnitOptions,
  checkModeOptions,
  createForm,
  defaultValueError,
  fieldTypeOptions,
  formSteps,
  getAuthOptions,
  getInterfaceRowById,
  getPartnerById,
  isCodeTaken,
  paramLocationOptions,
  saveInterfaceForm,
  toForm,
  type InterfaceForm,
  type InterfaceRow,
  validateAll
} from "./data";
import { getParserById, listUsableParsers } from "../parsers/data";
import CodeEditor from "@/components/CodeEditor/index.vue";
import {
  getAuthTypeLabel,
  getCacheUnitLabel,
  nextId,
  resolveInterfaceUrl,
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

/** 模板框占位示例：直接写在模板里会被 prettier 当表达式解析失败 */
const templatePlaceholder = [
  "{",
  '  "id": "${body.id}",',
  '  "name": "${body.ent_name}"',
  "}"
].join("\n");

/** 响应映射模板的占位示例（左边是出参字段名，右边是网关返回里的取值路径） */
const responseTemplatePlaceholder = [
  "{",
  '  "name": "${resp.data.ent_name}",',
  '  "regNo": "${resp.data.reg_no}"',
  "}"
].join("\n");

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

/** 合作方配的几个接入环境，接口的完整地址按选中的环境拼接 */
const envs = computed(() => partner.value?.envs ?? []);
const previewEnvId = ref<number | undefined>(undefined);
watch(
  envs,
  list => {
    previewEnvId.value = list[0]?.id;
  },
  { immediate: true }
);
const previewEnv = computed(() =>
  envs.value.find(item => item.id === previewEnvId.value)
);
/** 环境地址 + 接口路径 = 实际调用地址；环境没配地址时为空，让用户一眼看出没联动 */
const previewUrl = computed(() =>
  resolveInterfaceUrl(previewEnv.value?.baseUrl, form.value.path)
);

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
  `${form.value.responses.length} 个出参`,
  [
    form.value.price > 0 ? `￥${form.value.price} / 次` : "免费",
    form.value.qps ? `QPS ${form.value.qps}` : "流控沿用",
    form.value.cacheEnabled
      ? `缓存 ${form.value.cacheTtl} ${getCacheUnitLabel(form.value.cacheUnit)}`
      : "不缓存"
  ].join(" · ")
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

/** 高级配置里「留空沿用合作方」的取值来源：合作方的调用策略与网络参数 */
const fallback = computed(() => {
  const item = partner.value;
  if (!item) {
    return {
      price: "0 表示免费",
      dailyLimit: "沿用合作方",
      timeout: "沿用合作方",
      qps: "沿用合作方",
      concurrency: "沿用合作方",
      retryTimes: "沿用合作方",
      retryInterval: "沿用合作方",
      breakerThreshold: "沿用合作方",
      breakerRecoverMin: "沿用合作方",
      cacheTtl: "1",
      cacheText: ""
    };
  }
  return {
    price: "0 表示免费",
    dailyLimit: `${item.dailyLimit} 次 / 天`,
    timeout: `${item.readTimeout} 毫秒`,
    qps: `${item.qps} 次 / 秒`,
    concurrency: `${item.concurrency}`,
    retryTimes: `${item.retryTimes} 次`,
    retryInterval: `${item.retryInterval} 毫秒`,
    breakerThreshold: `${item.breakerThreshold} 次`,
    breakerRecoverMin: `${item.breakerRecoverMin} 分钟`,
    cacheTtl: item.cacheEnabled ? `${item.cacheTtl}` : "1",
    cacheText: item.cacheEnabled
      ? `合作方默认：开启 · ${item.cacheTtl} ${getCacheUnitLabel(item.cacheUnit)}`
      : "合作方默认：不缓存"
  };
});

/** 字段名全局唯一，不必再比步骤号（高级配置里的字段各在自己的分组） */
function isFieldError(field: string) {
  return error.value?.field === field;
}

/** 第二步模板框（前置解析模板）的校验错误文案 */
const templateError = computed(() =>
  error.value?.step === 2 && error.value.field === "preTemplate"
    ? error.value.message
    : ""
);

/** 第三步模板框（响应映射模板）的校验错误文案 */
const responseTemplateError = computed(() =>
  error.value?.step === 3 && error.value.field === "postTemplate"
    ? error.value.message
    : ""
);

/** 处理器下拉的取值：template = 写内联模板，parser:<id> = 引用解析器库里的模板 */
const PRE_PREFIX = "parser:";

const prePicker = computed({
  get: () =>
    form.value.preProcessor === "parser"
      ? PRE_PREFIX + (form.value.preParserId ?? "")
      : "template",
  set: (value: string) => {
    if (value === "template") {
      form.value.preProcessor = "template";
      form.value.preParserId = undefined;
      return;
    }
    form.value.preProcessor = "parser";
    form.value.preParserId = Number(value.slice(PRE_PREFIX.length));
  }
});

const postPicker = computed({
  get: () =>
    form.value.postProcessor === "parser"
      ? PRE_PREFIX + (form.value.postParserId ?? "")
      : "template",
  set: (value: string) => {
    if (value === "template") {
      form.value.postProcessor = "template";
      form.value.postParserId = undefined;
      return;
    }
    form.value.postProcessor = "parser";
    form.value.postParserId = Number(value.slice(PRE_PREFIX.length));
  }
});

/** 引用了解析器：默认只显示「名称 + 标识 + 版本」，代码要点开才看（改动要去「解析器」菜单） */
const preParser = computed(() => getParserById(form.value.preParserId));
const postParser = computed(() => getParserById(form.value.postParserId));
const showPreCode = ref(false);
const showPostCode = ref(false);

function isCellError(index: number, column: string) {
  return error.value?.rowIndex === index && error.value?.column === column;
}

function goto(target: number) {
  if (target === step.value) return;
  // 校验只在保存时跑：这里只切步，顺手清掉上一次的报错高亮
  error.value = null;
  step.value = target;
}

function next() {
  if (step.value >= formSteps.length) return;
  error.value = null;
  step.value += 1;
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
    checkMode: undefined,
    checkValue: "",
    desc: ""
  } satisfies InterfaceResponseField);
}

/** 勾选默认走「取值」，取消则整格清空 */
function toggleCheck(row: InterfaceResponseField, checked: boolean) {
  if (checked) {
    row.checkMode = row.checkMode ?? "value";
  } else {
    row.checkMode = undefined;
    row.checkValue = undefined;
  }
  error.value = null;
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
                    class="mono-field input-with-select"
                    placeholder="/api/ent/base"
                  >
                    <template #prepend>
                      <el-select
                        v-model="previewEnvId"
                        class="env-select"
                        placeholder="环境"
                      >
                        <el-option
                          v-for="env in envs"
                          :key="env.id"
                          :label="env.name || env.code"
                          :value="env.id"
                        />
                      </el-select>
                    </template>
                  </el-input>
                  <span class="f__tip">
                    以 / 开头；完整地址
                    <b class="f__url" :title="previewUrl">{{
                      previewUrl || "未配置环境地址"
                    }}</b>
                  </span>
                </label>
                <label class="f">
                  <span class="f__label">前置处理器</span>
                  <el-select v-model="prePicker" style="width: 100%">
                    <el-option label="模板解析器" value="template" />
                    <el-option-group label="解析器库">
                      <el-option
                        v-for="item in listUsableParsers('pre')"
                        :key="item.id"
                        :label="item.name + '（' + item.code + '）'"
                        :value="'parser:' + item.id"
                      />
                    </el-option-group>
                  </el-select>
                </label>
                <label class="f">
                  <span class="f__label">后置处理器</span>
                  <el-select v-model="postPicker" style="width: 100%">
                    <el-option label="模板解析器" value="template" />
                    <el-option-group label="解析器库">
                      <el-option
                        v-for="item in listUsableParsers('post')"
                        :key="item.id"
                        :label="item.name + '（' + item.code + '）'"
                        :value="'parser:' + item.id"
                      />
                    </el-option-group>
                  </el-select>
                </label>
                <label class="f f--2">
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
          </div>

          <!-- ------------------------------ 第二步 ------------------------------ -->
          <div v-show="step === 2">
            <div v-if="form.preProcessor === 'template'" class="tmpl">
              <div class="sec__head">
                <h2 class="sec__title">解析模板</h2>
                <span class="sec__hint">
                  模板解析器靠它把原始报文映射成下面的入参；改报文格式或前置处理器后自动隐藏
                </span>
              </div>
              <CodeEditor
                v-model="form.preTemplate"
                height="200px"
                class="tmpl__editor"
                :class="{ 'is-error': !!templateError }"
                :placeholder="templatePlaceholder"
              />
              <span v-if="templateError" class="tmpl__err">{{
                templateError
              }}</span>
              <span v-else class="tmpl__tip"
                >占位符写成 ${字段}，键名对应下面入参表里的参数名</span
              >
            </div>
            <div
              v-else-if="form.preProcessor === 'parser'"
              class="tmpl tmpl--ref"
            >
              <div class="ref">
                <span class="ref__label">引用的前置解析器</span>
                <template v-if="preParser">
                  <span class="ref__name">{{ preParser.name }}</span>
                  <code class="ref__code">{{ preParser.code }}</code>
                  <span class="ref__ver">v{{ preParser.scriptVersion }}</span>
                  <el-button
                    text
                    size="small"
                    class="ref__toggle"
                    @click="showPreCode = !showPreCode"
                  >
                    {{ showPreCode ? "收起代码" : "查看代码" }}
                  </el-button>
                </template>
                <span v-else class="tmpl__err"
                  >引用的解析器已不存在，请重新选择</span
                >
              </div>
              <CodeEditor
                v-if="preParser && showPreCode"
                :model-value="preParser.scriptCode"
                readonly
                height="240px"
                class="tmpl__editor"
              />
            </div>
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
            <div v-if="form.postProcessor === 'template'" class="tmpl">
              <div class="sec__head">
                <h2 class="sec__title">响应映射模板</h2>
                <span class="sec__hint">
                  模板解析器靠它把网关返回映射成下面的出参；后置处理器切走或报文格式改成
                  Form 后自动隐藏
                </span>
              </div>
              <CodeEditor
                v-model="form.postTemplate"
                height="200px"
                class="tmpl__editor"
                :class="{ 'is-error': !!responseTemplateError }"
                :placeholder="responseTemplatePlaceholder"
              />
              <span v-if="responseTemplateError" class="tmpl__err">{{
                responseTemplateError
              }}</span>
              <span v-else class="tmpl__tip"
                >键名对应下面出参表里的字段名，占位符写成 ${resp.路径}</span
              >
            </div>
            <div
              v-else-if="form.postProcessor === 'parser'"
              class="tmpl tmpl--ref"
            >
              <div class="ref">
                <span class="ref__label">引用的后置解析器</span>
                <template v-if="postParser">
                  <span class="ref__name">{{ postParser.name }}</span>
                  <code class="ref__code">{{ postParser.code }}</code>
                  <span class="ref__ver">v{{ postParser.scriptVersion }}</span>
                  <el-button
                    text
                    size="small"
                    class="ref__toggle"
                    @click="showPostCode = !showPostCode"
                  >
                    {{ showPostCode ? "收起代码" : "查看代码" }}
                  </el-button>
                </template>
                <span v-else class="tmpl__err"
                  >引用的解析器已不存在，请重新选择</span
                >
              </div>
              <CodeEditor
                v-if="postParser && showPostCode"
                :model-value="postParser.scriptCode"
                readonly
                height="240px"
                class="tmpl__editor"
              />
            </div>
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
                <el-table-column width="252" align="left">
                  <template #header>
                    <span class="judge__head">
                      查得字段
                      <el-tooltip
                        placement="top"
                        content="勾选后校验该字段：取值=返回值必须等于期望值，非空=必须有值；勾了多行要同时满足。常用来判断「状态码 200 = 请求成功」。"
                      >
                        <span class="judge__help">?</span>
                      </el-tooltip>
                    </span>
                  </template>
                  <template #default="{ row: item, $index }">
                    <div class="judge">
                      <el-checkbox
                        :model-value="!!item.checkMode"
                        @change="(value: any) => toggleCheck(item, !!value)"
                      />
                      <template v-if="item.checkMode">
                        <el-select
                          v-model="item.checkMode"
                          size="small"
                          class="judge__mode"
                        >
                          <el-option
                            v-for="opt in checkModeOptions"
                            :key="opt.value"
                            :label="opt.label"
                            :value="opt.value"
                          />
                        </el-select>
                        <el-input
                          v-if="item.checkMode === 'value'"
                          v-model="item.checkValue"
                          class="cell-input mono-input judge__val"
                          :class="{
                            'is-error': isCellError($index, 'checkValue')
                          }"
                          placeholder="200"
                        />
                      </template>
                    </div>
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

          <!-- ------------------------------ 第四步 ------------------------------ -->
          <div v-show="step === 4">
            <div class="sec">
              <div class="sec__head">
                <h2 class="sec__title">高级配置</h2>
                <span class="sec__hint"
                  >留空即沿用「{{
                    partnerName
                  }}」的配置，占位符里就是它当前的值</span
                >
              </div>

              <div class="sec__sub">
                <h3 class="sec__sub-title">计费</h3>
                <form class="grid grid--4" @submit.prevent>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('price') }"
                  >
                    <span class="f__label">单价（元 / 次）</span>
                    <el-input-number
                      v-model="form.price"
                      :min="0"
                      :step="0.1"
                      :controls="false"
                      :placeholder="fallback.price"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('dailyLimit') }"
                  >
                    <span class="f__label">日上限（次 / 天）</span>
                    <el-input-number
                      v-model="form.dailyLimit"
                      :min="0"
                      :step="1000"
                      :controls="false"
                      :placeholder="fallback.dailyLimit"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('timeout') }"
                  >
                    <span class="f__label">超时（毫秒）</span>
                    <el-input-number
                      v-model="form.timeout"
                      :min="0"
                      :step="500"
                      :controls="false"
                      :placeholder="fallback.timeout"
                      style="width: 100%"
                    />
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

              <div class="sec__sub">
                <h3 class="sec__sub-title">流控</h3>
                <form class="grid grid--4" @submit.prevent>
                  <label class="f" :class="{ 'is-error': isFieldError('qps') }">
                    <span class="f__label">QPS 上限（次 / 秒）</span>
                    <el-input-number
                      v-model="form.qps"
                      :min="0"
                      :step="1"
                      :controls="false"
                      :placeholder="fallback.qps"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('concurrency') }"
                  >
                    <span class="f__label">并发上限</span>
                    <el-input-number
                      v-model="form.concurrency"
                      :min="0"
                      :step="10"
                      :controls="false"
                      :placeholder="fallback.concurrency"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('retryTimes') }"
                  >
                    <span class="f__label">失败重试（次）</span>
                    <el-input-number
                      v-model="form.retryTimes"
                      :min="0"
                      :step="1"
                      :controls="false"
                      :placeholder="fallback.retryTimes"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('retryInterval') }"
                  >
                    <span class="f__label">重试间隔（毫秒）</span>
                    <el-input-number
                      v-model="form.retryInterval"
                      :min="0"
                      :step="100"
                      :controls="false"
                      :placeholder="fallback.retryInterval"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('breakerThreshold') }"
                  >
                    <span class="f__label">熔断失败阈值（次）</span>
                    <el-input-number
                      v-model="form.breakerThreshold"
                      :min="0"
                      :step="5"
                      :controls="false"
                      :placeholder="fallback.breakerThreshold"
                      style="width: 100%"
                    />
                  </label>
                  <label
                    class="f"
                    :class="{ 'is-error': isFieldError('breakerRecoverMin') }"
                  >
                    <span class="f__label">熔断恢复（分钟）</span>
                    <el-input-number
                      v-model="form.breakerRecoverMin"
                      :min="0"
                      :step="1"
                      :controls="false"
                      :placeholder="fallback.breakerRecoverMin"
                      style="width: 100%"
                    />
                  </label>
                </form>
              </div>

              <div class="sec__sub">
                <h3 class="sec__sub-title">缓存</h3>
                <form class="grid grid--4" @submit.prevent>
                  <div
                    class="f f--4"
                    :class="{ 'is-error': isFieldError('cacheTtl') }"
                  >
                    <span class="f__label f__label--req">缓存设置</span>
                    <div class="cache">
                      <el-switch
                        v-model="form.cacheEnabled"
                        active-text="开启"
                      />
                      <el-input-number
                        v-model="form.cacheTtl"
                        :min="1"
                        :disabled="!form.cacheEnabled"
                        :controls="false"
                        :placeholder="fallback.cacheTtl"
                        style="width: 160px"
                      />
                      <el-select
                        v-model="form.cacheUnit"
                        :disabled="!form.cacheEnabled"
                        style="width: 110px"
                      >
                        <el-option
                          v-for="item in cacheUnitOptions"
                          :key="item.value"
                          :label="item.label"
                          :value="item.value"
                        />
                      </el-select>
                    </div>
                    <span class="f__tip">{{ fallback.cacheText }}</span>
                  </div>
                </form>
              </div>
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

/* ------------------------------- 解析模板 ------------------------------- */
.tmpl {
  padding: 20px 0;
  border-bottom: 1px solid var(--line-soft);

  /* 引用解析器时的一行摘要：名称 + 标识 + 版本 + 查看代码 */
  &--ref .ref {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;

    &__label {
      font-size: 12px;
      color: var(--muted);
    }

    &__name {
      font-size: 13px;
      color: var(--ink);
    }

    &__code {
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      font-size: 11px;
      color: var(--muted);
    }

    &__ver {
      padding: 0 6px;
      font-size: 11px;
      line-height: 18px;
      color: var(--ink-2);
      background: var(--wash);
      border-radius: 3px;
      font-variant-numeric: tabular-nums;
    }

    &__toggle {
      margin-left: auto;
    }
  }

  /* 代码编辑器固定暗色，不再跟 --wash 走；出错只改它的边框色 */
  &__editor {
    :deep(.cm-editor) {
      border-radius: 4px;
    }

    &.is-error :deep(.cm-editor) {
      border-color: var(--el-color-danger);
    }
  }

  &__tip {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    color: var(--muted);
  }

  &__err {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    color: var(--el-color-danger);
  }
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

  /** 高级配置里的三个小节（计费 / 流控 / 缓存） */
  &__sub {
    padding: 16px 0;
    border-top: 1px dashed var(--line-soft);
  }

  &__sub-title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-2);
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
  /* 请求路径：EP 复合输入框，环境下拉放在前置区（prepend） */
  &__url {
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-weight: 400;
    color: var(--ink-2);
  }

  &__label {
    font-size: 12px;
    color: var(--muted);

    /** 必填标记：与 el-form 的 required 星号视觉一致 */
    &--req::before {
      content: "*";
      margin-right: 4px;
      color: var(--el-color-danger);
    }
  }

  /** 一行里并排放开关 + 数值 + 单位下拉（缓存设置） */
  .cache {
    display: flex;
    gap: 12px;
    align-items: center;
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

  :deep(.el-input-number .el-input__inner) {
    text-align: left;
    font-variant-numeric: tabular-nums;
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

/* 请求路径的复合输入框：环境下拉在前置区，底色调成和输入框一致 */
.input-with-select :deep(.el-input-group__prepend) {
  width: 116px;
  padding: 0;
  overflow: hidden;
  background-color: var(--el-fill-color-blank);
}

/* EP 默认给 prepend 里的 select 写了 flex:1 + margin:0 -20px（用来抵消 padding），
   这里 padding 已归零，负 margin 会直接溢出压住输入框，必须抵消掉 */
.input-with-select :deep(.el-input-group__prepend .el-select) {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  margin: 0;
}

.input-with-select :deep(.el-input-group__prepend .el-select__wrapper) {
  height: 100%;
  min-height: 0;
  padding: 0 8px 0 10px;
  background: transparent;
  box-shadow: none;
}

/* EP 默认 flex-wrap: wrap，长标签会换行把输入框撑高；这里强制单行 + 省略号 */
.input-with-select :deep(.el-input-group__prepend .el-select__selected-item) {
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.input-with-select :deep(.el-input-group__prepend .el-select__placeholder) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
/* 查得字段列：勾选框 + 取值/非空 + 期望值（一行三控，不许换行） */
.editable .judge {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;

  :deep(.el-checkbox) {
    flex: 0 0 auto;
    height: auto;
    margin-right: 0;
  }

  :deep(.el-select) {
    flex: 0 0 88px;
    width: 88px;
  }

  :deep(.el-input) {
    flex: 0 0 88px;
    width: 88px;
  }

  &__head {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  &__help {
    display: inline-flex;
    width: 14px;
    height: 14px;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--muted);
    cursor: help;
    border: 1px solid var(--line);
    border-radius: 50%;
  }
}

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
