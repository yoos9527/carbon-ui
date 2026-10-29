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
  () =>
    form.value.authType === "hmac" || form.value.authType === "appKeySecret"
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
    :model-value="props.modelValue"
    :title="props.editing ? '编辑鉴权' : '新增鉴权'"
    width="820px"
    top="6vh"
    destroy-on-close
    @update:model-value="close"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="鉴权名称" prop="name">
            <el-input
              v-model="form.name"
              placeholder="如：主账号 / 备用账号 / 复杂签名脚本"
              maxlength="40"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="鉴权方式" prop="authType">
            <el-select v-model="form.authType" class="w-full">
              <el-option
                v-for="item in authTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row v-if="needAppKey" :gutter="16">
        <el-col :span="12">
          <el-form-item label="AppKey" prop="appKey">
            <el-input v-model="form.appKey" placeholder="合作方分配的 AppKey" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
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
        </el-col>
      </el-row>

      <el-row v-if="isHmac" :gutter="16">
        <el-col :span="8">
          <el-form-item label="签名算法">
            <el-select v-model="form.signAlgorithm" class="w-full">
              <el-option
                v-for="item in signAlgorithmOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="时间戳单位">
            <el-radio-group v-model="form.timestampUnit">
              <el-radio-button label="s">秒</el-radio-button>
              <el-radio-button label="ms">毫秒</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="签名规则">
            <el-input v-model="form.signRule" placeholder="appKey+ts+nonce" />
          </el-form-item>
        </el-col>
      </el-row>

      <template v-if="isOAuth2">
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="Token 地址" prop="tokenUrl">
              <el-input
                v-model="form.tokenUrl"
                placeholder="https://api.example.com/oauth/token"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="授权模式">
              <el-select v-model="form.grantType" class="w-full">
                <el-option label="client_credentials" value="client_credentials" />
                <el-option label="password" value="password" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Token 有效期">
          <el-input-number
            v-model="form.tokenExpire"
            :min="60"
            :step="60"
            controls-position="right"
          />
          <span class="ml-2 text-xs text-gray-400">秒，到期前 60 秒自动刷新</span>
        </el-form-item>
      </template>

      <el-form-item v-if="isIpWhitelist" label="IP 白名单" prop="ipWhitelist">
        <el-input
          v-model="form.ipWhitelist"
          type="textarea"
          :rows="4"
          placeholder="每行一个 IP 或网段，如 203.0.113.10"
        />
      </el-form-item>

      <el-form-item v-if="isMtls" label="客户端证书" prop="certName">
        <el-input v-model="form.certName" placeholder="如 beidou-client.p12" />
      </el-form-item>

      <template v-if="isScript">
        <el-form-item label="脚本语言">
          <el-tag type="warning" effect="plain">Groovy</el-tag>
          <span class="ml-2 text-xs text-gray-400">
            服务端 GroovyShell 沙箱执行，语言固定不可切换
          </span>
        </el-form-item>
        <el-form-item label="脚本内容" prop="scriptCode">
          <CodeEditor v-model="scriptCode" height="360px" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="执行超时">
              <el-input-number
                v-model="form.scriptTimeout"
                :min="100"
                :max="30000"
                :step="100"
                controls-position="right"
              />
              <span class="ml-2 text-xs text-gray-400">ms</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="脚本版本">
              <el-input-number
                v-model="form.scriptVersion"
                :min="1"
                controls-position="right"
              />
              <span class="ml-2 text-xs text-gray-400">
                保存后自增，保留最近 5 个版本
              </span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="操作">
          <el-button @click="checkScript">测试运行</el-button>
          <el-button @click="resetTemplate">恢复模板</el-button>
        </el-form-item>
        <el-form-item label="可用 API">
          <el-collapse class="w-full">
            <el-collapse-item title="ctx 上下文与 ctx.lib 工具函数" name="ctx">
              <el-table :data="ctxFields" border size="small">
                <el-table-column prop="name" label="字段" width="150" />
                <el-table-column prop="desc" label="说明" min-width="260" />
              </el-table>
              <div class="mt-2 text-xs leading-6 text-gray-500">
                Groovy 可直接调用 JDK 类，例如
                <code>javax.crypto.Mac</code>、<code>java.security.MessageDigest</code>；
                支持 GString 插值 <code>"${appKey}${ts}"</code>。 脚本运行在服务端
                Groovy 沙箱：ImportCustomizer 白名单 java.security / javax.crypto /
                java.util / java.time / org.apache.commons.codec，SecureASTCustomizer
                禁止文件、网络与进程操作；appSecret 由服务端注入，前端仅显示掩码。
                返回
                <code>[headers: [...], query: [...], body: ...]</code>
                会合并进实际请求；抛异常或返回 <code>[error: "…"]</code> 判定鉴权失败。
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-form-item>
      </template>

      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
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

code {
  padding: 1px 4px;
  font-family: Consolas, Monaco, "Courier New", monospace;
  background: var(--el-fill-color-light);
  border-radius: 3px;
}
</style>
