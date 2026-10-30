<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import CodeEditor from "@/components/CodeEditor/index.vue";
import {
  createEmptyParser,
  getParserKindLabel,
  isParserCodeTaken,
  parserKindOptions,
  saveParserForm,
  toParserForm,
  type ParserForm,
  type ParserItem,
  type ParserVersion
} from "../data";

const props = defineProps<{
  modelValue: boolean;
  /** 传 null 表示新建 */
  parser?: ParserItem | null;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "saved"): void;
}>();

// 直接写 v-model="modelValue" 会报「cannot be used on a prop」
const visible = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

const CODE_RE = /^[A-Za-z0-9_]+$/;

const form = reactive<ParserForm>({
  id: 0,
  code: "",
  name: "",
  kind: "pre",
  desc: "",
  scriptCode: "",
  scriptTimeout: 3000,
  enabled: true
});

const isNew = computed(() => !props.parser);
/** 类型创建后锁死：改类型会让已引用它的接口语义错位 */
const kindLocked = computed(() => !isNew.value);

const error = ref("");

function reset() {
  const source = props.parser
    ? toParserForm(props.parser)
    : toParserForm(createEmptyParser("pre"));
  Object.assign(form, source);
  error.value = "";
}

watch(
  () => [props.modelValue, props.parser] as const,
  () => {
    if (props.modelValue) reset();
  },
  { immediate: true }
);

/* ------------------------------ 历史版本 ------------------------------ */

const versions = computed<ParserVersion[]>(() => props.parser?.versions ?? []);

function rollback(item: ParserVersion) {
  form.scriptCode = item.code;
  ElMessage.success(`已载入第 ${item.version} 版，保存后生效`);
}

/* ------------------------------ 保存 ------------------------------ */

function handleSave() {
  const code = form.code.trim();
  const name = form.name.trim();
  if (!name) {
    error.value = "请填写解析器名称";
    return;
  }
  if (!code) {
    error.value = "请填写解析器标识";
    return;
  }
  if (!CODE_RE.test(code)) {
    error.value = "标识只能用字母、数字、下划线";
    return;
  }
  if (isParserCodeTaken(code, form.id)) {
    error.value = `标识「${code}」已被占用，换一个`;
    return;
  }
  if (!/def\s+parse\s*\(/.test(form.scriptCode)) {
    error.value = "代码里必须有入口方法 def parse(ctx)";
    return;
  }
  error.value = "";
  saveParserForm({ ...form, code, name });
  visible.value = false;
  emit("saved");
  ElMessage.success(isNew.value ? "已创建" : "已保存");
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="isNew ? '新增解析器' : '编辑解析器'"
    size="620px"
    class="parser-dlg"
  >
    <div class="pd-form">
      <form class="grid">
        <label class="f">
          <span class="f__label">名称</span>
          <el-input v-model="form.name" placeholder="中科数据-前置" />
        </label>
        <label class="f">
          <span class="f__label">标识</span>
          <el-input
            v-model="form.code"
            class="mono-field"
            placeholder="ZK_ENT_PRE"
          />
          <span class="f__tip">字母、数字、下划线，全局唯一</span>
        </label>
        <label class="f f--2">
          <span class="f__label">类型</span>
          <el-radio-group v-model="form.kind" :disabled="kindLocked">
            <el-radio-button
              v-for="item in parserKindOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
          <span class="f__tip">
            {{
              kindLocked
                ? `类型创建后不可改（当前是${getParserKindLabel(form.kind)}），改类型会让已引用它的接口语义错位`
                : "前置解析器把原始报文映射成入参，后置解析器把网关响应映射成出参"
            }}
          </span>
        </label>
        <label class="f f--2">
          <span class="f__label">说明</span>
          <el-input
            v-model="form.desc"
            type="textarea"
            :rows="2"
            placeholder="一句话说清这个解析器在解决什么报文差异"
          />
        </label>
        <label class="f">
          <span class="f__label">执行超时</span>
          <el-input-number
            v-model="form.scriptTimeout"
            :min="100"
            :step="100"
            controls-position="right"
            style="width: 100%"
          />
          <span class="f__tip">单位毫秒，超时会中断解析并记录失败</span>
        </label>
        <label class="f">
          <span class="f__label">状态</span>
          <div class="f__switch">
            <el-switch
              v-model="form.enabled"
              active-text="启用"
              inactive-text="停用"
            />
          </div>
        </label>
      </form>

      <div class="pd-code">
        <div class="pd-code__head">
          <h3 class="pd-code__title">Groovy 代码</h3>
          <span class="pd-code__hint">
            入口固定为 <code>def parse(ctx)</code>，
            {{
              form.kind === "pre"
                ? "ctx.payload 是原始报文，ctx.params 是当前入参"
                : "ctx.response 是网关原始响应，ctx.fields 是出参定义"
            }}
          </span>
        </div>
        <CodeEditor v-model="form.scriptCode" height="320px" />
        <span v-if="error" class="pd-code__err">{{ error }}</span>
      </div>

      <div v-if="!isNew" class="pd-versions">
        <div class="pd-code__head">
          <h3 class="pd-code__title">历史版本</h3>
          <span class="pd-code__hint">
            每次保存且代码有变化就自动留一份，最多保留 10
            版；回滚只是载入编辑器，点保存才生效
          </span>
        </div>
        <p v-if="!versions.length" class="pd-versions__empty">还没有历史版本</p>
        <ul v-else class="pd-versions__list">
          <li v-for="item in versions" :key="item.version">
            <span class="pd-versions__ver">v{{ item.version }}</span>
            <span class="pd-versions__time">{{ item.time }}</span>
            <el-button size="small" plain @click="rollback(item)">
              载入
            </el-button>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <el-button plain @click="visible = false">取消</el-button>
      <el-button type="primary" plain @click="handleSave">
        {{ isNew ? "创建" : "保存" }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style lang="scss" scoped>
/* drawer 挂在 body 上,拿不到 scoped 的 data-v,统一用 :global */
:global(.parser-dlg .pd-form) {
  padding-bottom: 8px;
}

:global(.parser-dlg .grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.parser-dlg .f) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

:global(.parser-dlg .f--2) {
  grid-column: span 2;
}

:global(.parser-dlg .f__label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:global(.parser-dlg .f__tip) {
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

:global(.parser-dlg .f__switch) {
  display: flex;
  align-items: center;
  height: 32px;
}

:global(.parser-dlg .mono-field .el-input__inner) {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
}

:global(.parser-dlg .pd-code) {
  padding: 18px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.parser-dlg .pd-code__head) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

:global(.parser-dlg .pd-code__title) {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:global(.parser-dlg .pd-code__hint) {
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

:global(.parser-dlg .pd-code__err) {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-danger);
}

:global(.parser-dlg .pd-versions) {
  padding-top: 18px;
}

:global(.parser-dlg .pd-versions__empty) {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

:global(.parser-dlg .pd-versions__list) {
  padding: 0;
  margin: 0;
  list-style: none;
}

:global(.parser-dlg .pd-versions__list li) {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.parser-dlg .pd-versions__ver) {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

:global(.parser-dlg .pd-versions__time) {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
