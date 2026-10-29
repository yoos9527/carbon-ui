<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import CodeEditor from "@/components/CodeEditor/index.vue";
import {
  authTypeOptions,
  createEmptyAuth,
  groovyScriptTemplate,
  signAlgorithmOptions,
  type AuthConfig
} from "../data";

defineOptions({ name: "AuthDialog" });

const ctxFields = [
  { name: "ctx.url", desc: "完整请求地址" },
  { name: "ctx.method", desc: "请求方式 GET / POST" },
  { name: "ctx.headers", desc: "已合并的公共请求头（mutable Map）" },
  { name: "ctx.query", desc: "查询参数（mutable Map）" },
  { name: "ctx.body", desc: "请求体" },
  { name: "ctx.config", desc: "当前鉴权配置：appKey / appSecret / 自定义键" },
  {
    name: "ctx.lib",
    desc: "md5() sha256() hmacSha256() base64() uuid() timestamp() json()"
  }
];

const props = defineProps<{
  /** 弹窗显隐（v-model） */
  modelValue: boolean;
  /** 传入则编辑，null 为新增 */
  editing: AuthConfig | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [visible: boolean];
  submit: [auth: AuthConfig];
}>();

const formRef = ref<FormInstance>();
const form = ref<AuthConfig>(createEmptyAuth());

const isScript = computed(() => form.value.authType === "script");
const isOAuth2 = computed(() => form.value.authType === "oauth2");
const isIpWhitelist = computed(() => form.value.authType === "ipWhitelist");
const isMtls = computed(() => form.value.authType === "mtls");
const isHmac = computed(
  () => form.value.authType === "hmac" || form.value.authType === "appKeySecret"
);
const needSecret = computed(() =>
  ["appKeySecret", "oauth2", "bearer", "hmac", "script"].includes(
    form.value.authType
  )
);
const needAppKey = computed(() => !isIpWhitelist.value && !isMtls.value);

/** CodeEditor 只接受 string，这里收口 undefined */
const scriptCode = computed({
  get: () => form.value.scriptCode ?? "",
  set: (value: string) => {
    form.value.scriptCode = value;
  }
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: "请输入鉴权名称", trigger: "blur" }],
  authType: [{ required: true, message: "请选择鉴权方式", trigger: "change" }],
  appKey: needAppKey.value
    ? [{ required: true, message: "请填写 AppKey", trigger: "blur" }]
    : [],
  tokenUrl: isOAuth2.value
    ? [{ required: true, message: "请填写 Token 地址", trigger: "blur" }]
    : [],
  ipWhitelist: isIpWhitelist.value
    ? [{ required: true, message: "请填写 IP 白名单", trigger: "blur" }]
    : [],
  certName: isMtls.value
    ? [{ required: true, message: "请填写证书文件名", trigger: "blur" }]
    : [],
  scriptCode: isScript.value
    ? [{ required: true, message: "请填写 Groovy 脚本", trigger: "blur" }]
    : []
}));

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return;
    form.value = props.editing
      ? (JSON.parse(JSON.stringify(props.editing)) as AuthConfig)
      : createEmptyAuth();
    if (form.value.authType === "script") {
      form.value.scriptLang = "groovy";
      form.value.scriptTimeout = form.value.scriptTimeout || 3000;
      form.value.scriptVersion = form.value.scriptVersion || 1;
      form.value.scriptCode = form.value.scriptCode || groovyScriptTemplate;
    }
    formRef.value?.clearValidate();
  },
  { immediate: true }
);

/** 切换到脚本方式时补齐脚本相关字段 */
watch(
  () => form.value.authType,
  type => {
    if (type !== "script") return;
    form.value.scriptLang = "groovy";
    form.value.scriptTimeout = form.value.scriptTimeout || 3000;
    form.value.scriptVersion = form.value.scriptVersion || 1;
    form.value.scriptCode = form.value.scriptCode || groovyScriptTemplate;
  }
);

function close() {
  emit("update:modelValue", false);
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  emit("submit", JSON.parse(JSON.stringify(form.value)) as AuthConfig);
}

/** 前端只做入口方法静态检查，真正的执行在服务端 Groovy 沙箱 */
function checkScript() {
  const code = form.value.scriptCode ?? "";
  if (!/def\s+sign\s*\(/.test(code)) {
    ElMessage.warning("脚本需定义 def sign(ctx) 入口方法");
    return;
  }
  if (/\b(System\.exit|Runtime|ProcessBuilder|new\s+File)\b/.test(code)) {
    ElMessage.warning("脚本包含被沙箱禁止的调用，请移除后再测试");
    return;
  }
  ElMessage.success("入口方法与禁用调用校验通过，运行时校验由服务端完成");
}

function resetTemplate() {
  form.value.scriptCode = groovyScriptTemplate;
}
</script>

<template>
  <el-dialog
    class="auth-dlg"
    :model-value="props.modelValue"
    width="900px"
    top="6vh"
    destroy-on-close
    @update:model-value="close"
  >
    <template #header>
      <div class="dlg-head">
        <div class="dlg-head__text">
          <h2>{{ props.editing ? "编辑鉴权" : "新增鉴权" }}</h2>
          <p>一个合作方可以配置多种鉴权方式，调用时按接口绑定关系选用</p>
        </div>
        <div class="dlg-head__state">
          <span>启用</span>
          <el-switch v-model="form.enabled" />
        </div>
      </div>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="auth-form"
    >
      <section class="blk">
        <div class="blk__t"><span>基本</span></div>
        <div class="fg fg--2">
          <el-form-item label="鉴权名称" prop="name">
            <el-input
              v-model="form.name"
              placeholder="如：主账号 / 备用账号 / 复杂签名脚本"
              maxlength="40"
            />
          </el-form-item>
          <el-form-item label="鉴权方式" prop="authType">
            <el-select v-model="form.authType">
              <el-option
                v-for="item in authTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </div>
      </section>

      <section v-if="needAppKey" class="blk">
        <div class="blk__t"><span>凭证</span></div>
        <div class="fg fg--2">
          <el-form-item label="AppKey" prop="appKey">
            <el-input v-model="form.appKey" placeholder="合作方分配的 AppKey" />
          </el-form-item>
          <el-form-item label="AppSecret">
            <el-input
              v-model="form.appSecret"
              type="password"
              show-password
              :placeholder="
                isScript
                  ? '服务端注入脚本 ctx.config.appSecret'
                  : '合作方分配的 AppSecret'
              "
            />
          </el-form-item>
        </div>
      </section>

      <section v-if="isHmac" class="blk">
        <div class="blk__t"><span>签名规则</span></div>
        <div class="fg fg--3">
          <el-form-item label="签名算法">
            <el-select v-model="form.signAlgorithm">
              <el-option
                v-for="item in signAlgorithmOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="时间戳单位">
            <el-radio-group v-model="form.timestampUnit" class="seg">
              <el-radio-button label="s">秒</el-radio-button>
              <el-radio-button label="ms">毫秒</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="签名规则">
            <el-input v-model="form.signRule" placeholder="appKey+ts+nonce" />
          </el-form-item>
        </div>
      </section>

      <section v-if="isOAuth2" class="blk">
        <div class="blk__t"><span>OAuth2</span></div>
        <div class="fg fg--3">
          <el-form-item label="Token 地址" prop="tokenUrl" class="span-2">
            <el-input
              v-model="form.tokenUrl"
              placeholder="https://api.example.com/oauth/token"
            />
          </el-form-item>
          <el-form-item label="授权模式">
            <el-select v-model="form.grantType">
              <el-option
                label="client_credentials"
                value="client_credentials"
              />
              <el-option label="password" value="password" />
            </el-select>
          </el-form-item>
          <el-form-item label="Token 有效期（秒）">
            <el-input-number
              v-model="form.tokenExpire"
              :min="60"
              :step="60"
              controls-position="right"
            />
          </el-form-item>
          <div class="fg__note span-2">
            到期前 60 秒自动刷新，刷新失败时按调用策略重试
          </div>
        </div>
      </section>

      <section v-if="isIpWhitelist" class="blk">
        <div class="blk__t"><span>IP 白名单</span></div>
        <el-form-item prop="ipWhitelist" class="no-label">
          <el-input
            v-model="form.ipWhitelist"
            type="textarea"
            :rows="4"
            placeholder="每行一个 IP 或网段，如 203.0.113.10"
          />
        </el-form-item>
      </section>

      <section v-if="isMtls" class="blk">
        <div class="blk__t"><span>双向证书</span></div>
        <el-form-item label="客户端证书" prop="certName">
          <el-input
            v-model="form.certName"
            placeholder="如 beidou-client.p12"
          />
        </el-form-item>
      </section>

      <section v-if="isScript" class="blk blk--script">
        <div class="blk__t">
          <span>签名脚本</span>
          <em class="chip chip--code">Groovy</em>
          <div class="blk__ops">
            <el-button link type="primary" @click="resetTemplate">
              恢复模板
            </el-button>
            <el-button link type="primary" @click="checkScript">
              测试运行
            </el-button>
          </div>
        </div>
        <el-form-item prop="scriptCode" class="no-label">
          <CodeEditor v-model="scriptCode" height="340px" />
        </el-form-item>
        <div class="fg fg--2">
          <el-form-item label="执行超时（ms）">
            <el-input-number
              v-model="form.scriptTimeout"
              :min="100"
              :max="30000"
              :step="100"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="脚本版本">
            <el-input-number
              v-model="form.scriptVersion"
              :min="1"
              controls-position="right"
            />
          </el-form-item>
        </div>

        <el-collapse class="api">
          <el-collapse-item name="ctx">
            <template #title>
              <span class="api__title">可用 API 与沙箱限制</span>
            </template>
            <div class="api__grid">
              <div
                v-for="field in ctxFields"
                :key="field.name"
                class="api__row"
              >
                <code>{{ field.name }}</code>
                <span>{{ field.desc }}</span>
              </div>
            </div>
            <div class="api__note">
              Groovy 可直接调用 JDK 类，例如
              <code>javax.crypto.Mac</code
              >、<code>java.security.MessageDigest</code>；支持 GString 插值
              <code>"${appKey}${ts}"</code>。 脚本运行在服务端 GroovyShell
              沙箱：ImportCustomizer 白名单 java.security / javax.crypto /
              java.util / java.time /
              org.apache.commons.codec，SecureASTCustomizer
              禁止文件、网络与进程操作；appSecret
              由服务端注入，前端仅显示掩码。返回
              <code>[headers: [...], query: [...], body: ...]</code>
              会合并进实际请求；抛异常或返回
              <code>[error: "…"]</code> 判定鉴权失败。
            </div>
          </el-collapse-item>
        </el-collapse>
      </section>
    </el-form>

    <template #footer>
      <div class="dlg-foot">
        <span class="hint">保存后立即生效，仅影响后续发起的调用</span>
        <div class="dlg-foot__ops">
          <el-button @click="close">取消</el-button>
          <el-button type="primary" @click="handleSubmit">保存</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
/* 弹窗外壳：el-dialog 内部节点不带 scope id（且未 teleport），只能用 :global 命中本组件专属的 .auth-dlg */
:global(.auth-dlg) {
  --ink: #16233a;
  --ink-2: #46536e;
  --muted: #8792a8;
  --line: #e6eaf2;
  --line-soft: #eef1f7;

  overflow: hidden;
  border-radius: 12px;
}

:global(.auth-dlg .el-dialog__header) {
  padding: 20px 24px 16px;
  margin-right: 0;
  border-bottom: 1px solid #eef1f7;
}

:global(.auth-dlg .el-dialog__body) {
  max-height: 66vh;
  padding: 4px 24px 8px;
  overflow-y: auto;
}

:global(.auth-dlg .el-dialog__headerbtn) {
  top: 18px;
  right: 16px;
}

:global(.auth-dlg .el-dialog__footer) {
  padding: 14px 24px;
  background: #fafbfd;
  border-top: 1px solid #eef1f7;
}

/* ------------------------------- 标题区 ------------------------------- */
.dlg-head {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  padding-right: 24px;

  &__text {
    h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: 0.01em;
    }

    p {
      margin: 6px 0 0;
      font-size: 12px;
      line-height: 1.6;
      color: var(--muted);
    }
  }

  &__state {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
    margin-top: 2px;
    font-size: 12px;
    color: var(--ink-2);
  }
}

/* ------------------------------- 表单区 ------------------------------- */
.auth-form {
  font-size: 13px;
  color: var(--ink);
}

.blk {
  padding: 16px 0 4px;

  & + & {
    border-top: 1px solid var(--line-soft);
  }

  &__t {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.04em;

    > span {
      flex: none;
    }
  }

  &__ops {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
}

.chip {
  flex: none;
  padding: 1px 7px;
  font-size: 11px;
  font-style: normal;
  line-height: 18px;
  border-radius: 4px;

  &--code {
    color: var(--el-color-warning-dark-2);
    background: var(--el-color-warning-light-9);
    border: 1px solid var(--el-color-warning-light-7);
  }
}

.fg {
  display: grid;
  gap: 4px 20px;

  &--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .span-2 {
    grid-column: span 2;
  }

  &__note {
    align-self: center;
    padding-top: 2px;
    font-size: 12px;
    color: var(--muted);
  }
}

.auth-form :deep(.el-form-item) {
  margin-bottom: 14px;

  .el-form-item__label {
    padding: 0 0 5px;
    font-size: 12px;
    line-height: 18px;
    color: var(--muted);
  }

  .el-form-item__error {
    padding-top: 3px;
    font-size: 11px;
  }

  .el-input,
  .el-input-number,
  .el-select,
  .el-textarea {
    width: 100%;
  }

  .el-input-number .el-input__inner {
    text-align: left;
  }
}

.auth-form :deep(.el-form-item.no-label) .el-form-item__content {
  margin-left: 0 !important;
}

.auth-form :deep(.el-textarea__inner) {
  font-family: inherit;
  line-height: 1.7;
}

.seg :deep(.el-radio-button__inner) {
  font-size: 12px;
}

/* ------------------------------- 脚本区 ------------------------------- */
.blk--script {
  .chip--code {
    margin-right: auto;
  }
}

.api {
  margin-top: 2px;
  border-top: 1px dashed var(--line);

  &__title {
    font-size: 12px;
    color: var(--ink-2);
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: 8px 16px;
    padding-bottom: 12px;
  }

  &__row {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: span 2;
    font-size: 12px;
    color: var(--ink-2);

    code {
      padding: 0;
      color: var(--ink);
      background: transparent;
    }

    > span {
      color: var(--muted);
    }
  }

  &__note {
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    background: #fafbfd;
    border: 1px solid var(--line-soft);
    border-radius: 6px;
  }
}

code {
  padding: 1px 4px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11.5px;
  background: var(--el-fill-color-light);
  border-radius: 3px;
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

/* ------------------------------- 底部条 ------------------------------- */
.dlg-foot {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;

  &__ops {
    display: flex;
    gap: 8px;
  }
}
</style>
