<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  billingTypeOptions,
  getAuthTypeLabel,
  getPartnerById,
  getPartnerTypeLabel,
  getStatusOption,
  settleTypeOptions,
  type AuthConfig,
  type PartnerItem
} from "./data";
import AuthDialog from "./components/AuthDialog.vue";
import BackIcon from "~icons/ri/arrow-left-line";
import AddIcon from "~icons/ri/add-line";
import EditIcon from "~icons/ri/edit-line";
import DeleteIcon from "~icons/ri/delete-bin-line";
import KeyIcon from "~icons/ri/key-2-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServicePartnerDetail" });

type EnvForm = Pick<
  PartnerItem,
  | "baseUrlProd"
  | "baseUrlTest"
  | "charset"
  | "connectTimeout"
  | "readTimeout"
  | "commonHeaders"
  | "useProxy"
  | "proxyType"
  | "proxyUrl"
>;

type StrategyForm = Pick<
  PartnerItem,
  | "qps"
  | "dailyLimit"
  | "concurrency"
  | "retryTimes"
  | "retryInterval"
  | "breakerThreshold"
  | "breakerRecoverMin"
  | "cacheTtl"
  | "alarmReceiver"
>;

type BillingForm = Pick<
  PartnerItem,
  | "billingType"
  | "unitPrice"
  | "quotaTotal"
  | "quotaUsed"
  | "warnThreshold"
  | "settleType"
  | "balance"
  | "contractNo"
>;

const route = useRoute();
const router = useRouter();

const activeTab = ref("env");
const detail = ref<PartnerItem | null>(null);
/** 当前处于编辑态的 Tab，空串为全部只读 */
const editingTab = ref<"" | "env" | "strategy" | "billing">("");
const envForm = ref<EnvForm | null>(null);
const strategyForm = ref<StrategyForm | null>(null);
const billingForm = ref<BillingForm | null>(null);

const authDialogVisible = ref(false);
const editingAuth = ref<AuthConfig | null>(null);
const revealedSecrets = ref<string[]>([]);

const charsetOptions = ["UTF-8", "GBK", "GB18030"];

function load() {
  const found = getPartnerById(route.params.id as string);
  detail.value = found
    ? (JSON.parse(JSON.stringify(found)) as PartnerItem)
    : null;
  editingTab.value = "";
}

watch(() => route.params.id, load, { immediate: true });

const statusOption = computed(() =>
  detail.value ? getStatusOption(detail.value.status) : undefined
);

const typeLabels = computed(() =>
  (detail.value?.types ?? []).map(item => getPartnerTypeLabel(item))
);

const enabledInterfaceCount = computed(
  () => (detail.value?.interfaces ?? []).filter(item => item.enabled).length
);

const lastCallTime = computed(() => {
  const times = (detail.value?.interfaces ?? [])
    .map(item => item.lastCallTime)
    .filter(Boolean) as string[];
  return times.length ? times.sort()[times.length - 1] : "-";
});

const remainQuota = computed(() => {
  const partner = detail.value;
  if (!partner) return 0;
  return Math.max(0, partner.quotaTotal - partner.quotaUsed);
});

const quotaUsedPercent = computed(() => {
  const partner = detail.value;
  if (!partner || !partner.quotaTotal) return 0;
  return Math.min(
    100,
    Math.round((partner.quotaUsed / partner.quotaTotal) * 100)
  );
});

function goBack() {
  router.push("/service/partners");
}

function maskSecret(value?: string) {
  if (!value) return "-";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function secretKey(auth: AuthConfig) {
  return `auth-${auth.id}`;
}

function isSecretRevealed(auth: AuthConfig) {
  return revealedSecrets.value.includes(secretKey(auth));
}

function toggleSecret(auth: AuthConfig) {
  const key = secretKey(auth);
  revealedSecrets.value = isSecretRevealed(auth)
    ? revealedSecrets.value.filter(item => item !== key)
    : [...revealedSecrets.value, key];
}

/* ------------------------------ 三块公共配置的编辑态 ------------------------------ */

function startEditEnv() {
  const partner = detail.value;
  if (!partner) return;
  envForm.value = {
    baseUrlProd: partner.baseUrlProd,
    baseUrlTest: partner.baseUrlTest,
    charset: partner.charset,
    connectTimeout: partner.connectTimeout,
    readTimeout: partner.readTimeout,
    commonHeaders: JSON.parse(JSON.stringify(partner.commonHeaders)),
    useProxy: partner.useProxy,
    proxyType: partner.proxyType,
    proxyUrl: partner.proxyUrl
  };
  editingTab.value = "env";
}

function saveEnv() {
  const partner = detail.value;
  const form = envForm.value;
  if (!partner || !form) return;
  if (!form.baseUrlProd.trim()) {
    ElMessage.warning("生产环境地址不能为空");
    return;
  }
  form.commonHeaders = form.commonHeaders.filter(item => item.key.trim());
  Object.assign(partner, form);
  editingTab.value = "";
  ElMessage.success("环境与网络已保存");
}

function startEditStrategy() {
  const partner = detail.value;
  if (!partner) return;
  strategyForm.value = {
    qps: partner.qps,
    dailyLimit: partner.dailyLimit,
    concurrency: partner.concurrency,
    retryTimes: partner.retryTimes,
    retryInterval: partner.retryInterval,
    breakerThreshold: partner.breakerThreshold,
    breakerRecoverMin: partner.breakerRecoverMin,
    cacheTtl: partner.cacheTtl,
    alarmReceiver: partner.alarmReceiver
  };
  editingTab.value = "strategy";
}

function saveStrategy() {
  const partner = detail.value;
  const form = strategyForm.value;
  if (!partner || !form) return;
  Object.assign(partner, form);
  editingTab.value = "";
  ElMessage.success("调用策略已保存");
}

function startEditBilling() {
  const partner = detail.value;
  if (!partner) return;
  billingForm.value = {
    billingType: partner.billingType,
    unitPrice: partner.unitPrice,
    quotaTotal: partner.quotaTotal,
    quotaUsed: partner.quotaUsed,
    warnThreshold: partner.warnThreshold,
    settleType: partner.settleType,
    balance: partner.balance,
    contractNo: partner.contractNo
  };
  editingTab.value = "billing";
}

function saveBilling() {
  const partner = detail.value;
  const form = billingForm.value;
  if (!partner || !form) return;
  if (form.quotaUsed > form.quotaTotal) {
    ElMessage.warning("已用额度不能大于套餐总量");
    return;
  }
  Object.assign(partner, form);
  editingTab.value = "";
  ElMessage.success("计费与额度已保存");
}

function cancelEdit() {
  editingTab.value = "";
}

function addHeaderRow() {
  envForm.value?.commonHeaders.push({ key: "", value: "" });
}

function removeHeaderRow(index: number) {
  envForm.value?.commonHeaders.splice(index, 1);
}

/* ------------------------------ 鉴权配置 ------------------------------ */

function openCreateAuth() {
  editingAuth.value = null;
  authDialogVisible.value = true;
}

function openEditAuth(auth: AuthConfig) {
  editingAuth.value = JSON.parse(JSON.stringify(auth));
  authDialogVisible.value = true;
}

function saveAuth(auth: AuthConfig) {
  const partner = detail.value;
  if (!partner) return;
  const index = partner.authConfigs.findIndex(item => item.id === auth.id);
  if (index >= 0) {
    partner.authConfigs[index] = auth;
    ElMessage.success("鉴权配置已更新");
  } else {
    partner.authConfigs.push(auth);
    ElMessage.success("鉴权配置已新增");
  }
  authDialogVisible.value = false;
}

async function removeAuth(auth: AuthConfig) {
  const partner = detail.value;
  if (!partner) return;
  const used = partner.interfaces.filter(item => item.authId === auth.id);
  if (used.length) {
    ElMessage.warning(
      `该鉴权已被 ${used.length} 个接口引用，请先调整接口的引用鉴权`
    );
    return;
  }
  await ElMessageBox.confirm(`确认删除鉴权「${auth.name}」？`, "提示", {
    type: "warning"
  });
  partner.authConfigs = partner.authConfigs.filter(
    item => item.id !== auth.id
  );
  ElMessage.success("已删除");
}
</script>

<template>
  <div class="pd">
    <template v-if="detail">
      <!-- ============================ 档案头 ============================ -->
      <header class="pd-head">
        <div class="pd-head__top">
          <button class="pd-back" title="返回列表" @click="goBack">
            <BackIcon />
            <span>合作方</span>
          </button>
          <div class="pd-head__id">
            <h1 class="pd-head__name">{{ detail.name }}</h1>
            <span class="dot" :class="detail.status === 1 ? 'is-on' : 'is-off'">
              {{ statusOption?.label ?? "未知" }}
            </span>
            <span
              v-for="label in typeLabels"
              :key="label"
              class="chip"
              >{{ label }}</span
            >
            <span class="pd-head__code">{{ detail.code }}</span>
          </div>
        </div>

        <dl class="pd-stats">
          <div class="pd-stats__item">
            <dt>接口总数</dt>
            <dd>{{ detail.interfaces.length }}</dd>
          </div>
          <div class="pd-stats__item">
            <dt>启用中</dt>
            <dd>{{ enabledInterfaceCount }}</dd>
          </div>
          <div class="pd-stats__item">
            <dt>剩余额度</dt>
            <dd>{{ remainQuota.toLocaleString() }}</dd>
          </div>
          <div class="pd-stats__item">
            <dt>最近调用</dt>
            <dd class="is-time">{{ lastCallTime }}</dd>
          </div>
        </dl>
      </header>

      <!-- ============================ 主体 ============================ -->
      <div class="pd-body">
        <el-tabs v-model="activeTab" tab-position="left" class="pd-tabs">
          <!-- ---------------------- 环境与网络 ---------------------- -->
          <el-tab-pane name="env">
            <template #label><span class="navtab">环境与网络</span></template>
            <section class="sec">
              <div class="sec__head">
                <div>
                  <h2 class="sec__title">环境与网络</h2>
                  <p class="sec__hint">
                    合作方公共的地址、超时与网络参数，接口可单独覆盖
                  </p>
                </div>
                <el-button
                  v-if="editingTab !== 'env'"
                  text
                  :icon="EditIcon"
                  class="sec__edit"
                  @click="startEditEnv"
                >
                  编辑
                </el-button>
              </div>

              <dl v-if="editingTab !== 'env'" class="grid grid--2">
                <div class="f">
                  <dt class="f__k">生产环境地址</dt>
                  <dd class="f__v mono">{{ detail.baseUrlProd || "—" }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">测试环境地址</dt>
                  <dd class="f__v mono">{{ detail.baseUrlTest || "—" }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">字符编码</dt>
                  <dd class="f__v">{{ detail.charset }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">网络出口</dt>
                  <dd class="f__v">
                    <span
                      class="dot"
                      :class="detail.useProxy ? 'is-warn' : 'is-off'"
                      >{{ detail.useProxy ? "经由代理" : "直连" }}</span
                    >
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">连接超时</dt>
                  <dd class="f__v num">{{ detail.connectTimeout }} ms</dd>
                </div>
                <div class="f">
                  <dt class="f__k">读取超时</dt>
                  <dd class="f__v num">{{ detail.readTimeout }} ms</dd>
                </div>
                <div class="f">
                  <dt class="f__k">代理类型</dt>
                  <dd class="f__v">
                    {{ detail.useProxy ? detail.proxyType || "—" : "—" }}
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">代理地址</dt>
                  <dd class="f__v mono">
                    {{ detail.useProxy ? detail.proxyUrl || "—" : "—" }}
                  </dd>
                </div>
              </dl>

              <form v-else-if="envForm" class="grid grid--2 grid--edit">
                <div class="f">
                  <label class="f__k is-req">生产环境地址</label>
                  <el-input
                    v-model="envForm.baseUrlProd"
                    placeholder="https://api.example.com"
                  />
                </div>
                <div class="f">
                  <label class="f__k">测试环境地址</label>
                  <el-input
                    v-model="envForm.baseUrlTest"
                    placeholder="https://api-test.example.com"
                  />
                </div>
                <div class="f">
                  <label class="f__k">字符编码</label>
                  <el-select v-model="envForm.charset">
                    <el-option
                      v-for="item in charsetOptions"
                      :key="item"
                      :label="item"
                      :value="item"
                    />
                  </el-select>
                </div>
                <div class="f">
                  <label class="f__k">走代理</label>
                  <el-switch v-model="envForm.useProxy" />
                </div>
                <div class="f">
                  <label class="f__k">连接超时</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="envForm.connectTimeout"
                      :min="100"
                      :step="500"
                      controls-position="right"
                    />
                    <span class="unit">ms</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">读取超时</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="envForm.readTimeout"
                      :min="100"
                      :step="500"
                      controls-position="right"
                    />
                    <span class="unit">ms</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">代理类型</label>
                  <el-select
                    v-model="envForm.proxyType"
                    :disabled="!envForm.useProxy"
                    placeholder="请选择"
                  >
                    <el-option label="HTTP" value="http" />
                    <el-option label="SOCKS5" value="socks5" />
                  </el-select>
                </div>
                <div class="f">
                  <label class="f__k">代理地址</label>
                  <el-input
                    v-model="envForm.proxyUrl"
                    :disabled="!envForm.useProxy"
                    placeholder="http://10.0.0.8:7890"
                  />
                </div>
              </form>

              <div class="sub">
                <div class="sub__head">
                  <h3 class="sub__title">公共请求头</h3>
                  <span class="sub__hint">随每次请求发送，可被接口级配置覆盖</span>
                </div>

                <div v-if="editingTab !== 'env'" class="kvlist">
                  <div
                    v-for="item in detail.commonHeaders"
                    :key="item.key"
                    class="kvlist__row"
                  >
                    <span class="kvlist__k mono">{{ item.key }}</span>
                    <span class="kvlist__v mono">{{ item.value }}</span>
                  </div>
                  <p v-if="!detail.commonHeaders.length" class="empty-inline">
                    未配置公共请求头，多数数据服务商无需额外请求头
                  </p>
                </div>

                <div v-else-if="envForm" class="kvlist is-edit">
                  <div
                    v-for="(item, index) in envForm.commonHeaders"
                    :key="`header-${index}`"
                    class="kvlist__row"
                  >
                    <el-input
                      v-model="item.key"
                      class="kvlist__input is-k"
                      placeholder="Header 名称"
                    />
                    <el-input
                      v-model="item.value"
                      class="kvlist__input"
                      placeholder="Header 值"
                    />
                    <button
                      type="button"
                      class="txt txt--danger"
                      @click="removeHeaderRow(index)"
                    >
                      移除
                    </button>
                  </div>
                  <el-button text type="primary" :icon="AddIcon" @click="addHeaderRow">
                    添加请求头
                  </el-button>
                </div>
              </div>

              <div v-if="editingTab === 'env'" class="editbar">
                <span class="editbar__tip">修改后需保存才会生效</span>
                <el-button @click="cancelEdit">取消</el-button>
                <el-button type="primary" @click="saveEnv">保存</el-button>
              </div>
            </section>
          </el-tab-pane>

          <!-- ---------------------- 调用策略 ---------------------- -->
          <el-tab-pane name="strategy">
            <template #label><span class="navtab">调用策略</span></template>
            <section class="sec">
              <div class="sec__head">
                <div>
                  <h2 class="sec__title">调用策略</h2>
                  <p class="sec__hint">
                    限流、重试、熔断与缓存，作用于该合作方下的全部接口
                  </p>
                </div>
                <el-button
                  v-if="editingTab !== 'strategy'"
                  text
                  :icon="EditIcon"
                  class="sec__edit"
                  @click="startEditStrategy"
                >
                  编辑
                </el-button>
              </div>

              <dl v-if="editingTab !== 'strategy'" class="grid grid--3">
                <div class="f">
                  <dt class="f__k">限流</dt>
                  <dd class="f__v num">{{ detail.qps }} <i>QPS</i></dd>
                </div>
                <div class="f">
                  <dt class="f__k">日调用上限</dt>
                  <dd class="f__v num">
                    {{ detail.dailyLimit.toLocaleString() }} <i>次</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">并发数</dt>
                  <dd class="f__v num">{{ detail.concurrency }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">失败重试</dt>
                  <dd class="f__v num">
                    {{ detail.retryTimes }} <i>次</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">重试间隔</dt>
                  <dd class="f__v num">{{ detail.retryInterval }} <i>ms</i></dd>
                </div>
                <div class="f">
                  <dt class="f__k">结果缓存</dt>
                  <dd class="f__v num">
                    {{ detail.cacheTtl ? detail.cacheTtl : "—" }}
                    <i v-if="detail.cacheTtl">秒</i>
                  </dd>
                  <span v-if="!detail.cacheTtl" class="f__note">不缓存</span>
                </div>
                <div class="f">
                  <dt class="f__k">熔断阈值</dt>
                  <dd class="f__v num">
                    {{ detail.breakerThreshold }} <i>次</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">熔断恢复</dt>
                  <dd class="f__v num">
                    {{ detail.breakerRecoverMin }} <i>分钟</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">告警接收人</dt>
                  <dd class="f__v">{{ detail.alarmReceiver || "—" }}</dd>
                </div>
              </dl>

              <form v-else-if="strategyForm" class="grid grid--3 grid--edit">
                <div class="f">
                  <label class="f__k">限流</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.qps"
                      :min="1"
                      controls-position="right"
                    />
                    <span class="unit">QPS</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">日调用上限</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.dailyLimit"
                      :min="0"
                      :step="1000"
                      controls-position="right"
                    />
                    <span class="unit">次</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">并发数</label>
                  <el-input-number
                    v-model="strategyForm.concurrency"
                    :min="1"
                    controls-position="right"
                  />
                </div>
                <div class="f">
                  <label class="f__k">失败重试</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.retryTimes"
                      :min="0"
                      :max="5"
                      controls-position="right"
                    />
                    <span class="unit">次</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">重试间隔</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.retryInterval"
                      :min="0"
                      :step="100"
                      controls-position="right"
                    />
                    <span class="unit">ms</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">结果缓存</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.cacheTtl"
                      :min="0"
                      :step="60"
                      controls-position="right"
                    />
                    <span class="unit">秒</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">熔断阈值</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.breakerThreshold"
                      :min="1"
                      controls-position="right"
                    />
                    <span class="unit">次</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">熔断恢复</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="strategyForm.breakerRecoverMin"
                      :min="1"
                      controls-position="right"
                    />
                    <span class="unit">分钟</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">告警接收人</label>
                  <el-input
                    v-model="strategyForm.alarmReceiver"
                    placeholder="邮箱或用户名"
                  />
                </div>
              </form>

              <div v-if="editingTab === 'strategy'" class="editbar">
                <span class="editbar__tip">修改后需保存才会生效</span>
                <el-button @click="cancelEdit">取消</el-button>
                <el-button type="primary" @click="saveStrategy">保存</el-button>
              </div>
            </section>
          </el-tab-pane>

          <!-- ---------------------- 计费与额度 ---------------------- -->
          <el-tab-pane name="billing">
            <template #label><span class="navtab">计费与额度</span></template>
            <section class="sec">
              <div class="sec__head">
                <div>
                  <h2 class="sec__title">计费与额度</h2>
                  <p class="sec__hint">计费方式、套餐额度与结算信息</p>
                </div>
                <el-button
                  v-if="editingTab !== 'billing'"
                  text
                  :icon="EditIcon"
                  class="sec__edit"
                  @click="startEditBilling"
                >
                  编辑
                </el-button>
              </div>

              <div v-if="editingTab !== 'billing'" class="meter-wrap">
                <div class="meter">
                  <div class="meter__head">
                    <span>套餐额度使用</span>
                    <b
                      class="num"
                      :class="{
                        'is-warn': quotaUsedPercent >= 100 - detail.warnThreshold
                      }"
                      >{{ quotaUsedPercent }}%</b
                    >
                  </div>
                  <div class="meter__track">
                    <i
                      :style="{ width: `${quotaUsedPercent}%` }"
                      :class="{
                        'is-warn': quotaUsedPercent >= 100 - detail.warnThreshold
                      }"
                    />
                  </div>
                  <p class="meter__note">
                    已用 {{ detail.quotaUsed.toLocaleString() }} / 共
                    {{ detail.quotaTotal.toLocaleString() }}，
                    低于 {{ detail.warnThreshold }}% 时告警
                  </p>
                </div>
              </div>

              <dl v-if="editingTab !== 'billing'" class="grid grid--3">
                <div class="f">
                  <dt class="f__k">计费方式</dt>
                  <dd class="f__v">
                    {{
                      billingTypeOptions.find(
                        item => item.value === detail.billingType
                      )?.label
                    }}
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">默认单价</dt>
                  <dd class="f__v num">
                    {{ detail.unitPrice }} <i>元/次</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">结算周期</dt>
                  <dd class="f__v">
                    {{
                      settleTypeOptions.find(
                        item => item.value === detail.settleType
                      )?.label
                    }}
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">套餐总量</dt>
                  <dd class="f__v num">{{ detail.quotaTotal.toLocaleString() }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">已用额度</dt>
                  <dd class="f__v num">{{ detail.quotaUsed.toLocaleString() }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">剩余额度</dt>
                  <dd class="f__v num">{{ remainQuota.toLocaleString() }}</dd>
                </div>
                <div class="f">
                  <dt class="f__k">账户余额</dt>
                  <dd class="f__v num">
                    {{ detail.balance.toLocaleString() }} <i>元</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">预警阈值</dt>
                  <dd class="f__v num">
                    {{ detail.warnThreshold }} <i>%</i>
                  </dd>
                </div>
                <div class="f">
                  <dt class="f__k">合同编号</dt>
                  <dd class="f__v mono">{{ detail.contractNo || "—" }}</dd>
                </div>
              </dl>

              <form v-else-if="billingForm" class="grid grid--3 grid--edit">
                <div class="f">
                  <label class="f__k">计费方式</label>
                  <el-select v-model="billingForm.billingType">
                    <el-option
                      v-for="item in billingTypeOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
                <div class="f">
                  <label class="f__k">默认单价</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="billingForm.unitPrice"
                      :min="0"
                      :precision="2"
                      :step="0.1"
                      controls-position="right"
                    />
                    <span class="unit">元/次</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">结算周期</label>
                  <el-select v-model="billingForm.settleType">
                    <el-option
                      v-for="item in settleTypeOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
                <div class="f">
                  <label class="f__k">套餐总量</label>
                  <el-input-number
                    v-model="billingForm.quotaTotal"
                    :min="0"
                    :step="1000"
                    controls-position="right"
                  />
                </div>
                <div class="f">
                  <label class="f__k">已用额度</label>
                  <el-input-number
                    v-model="billingForm.quotaUsed"
                    :min="0"
                    :step="100"
                    controls-position="right"
                  />
                </div>
                <div class="f">
                  <label class="f__k">预警阈值</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="billingForm.warnThreshold"
                      :min="0"
                      :max="100"
                      controls-position="right"
                    />
                    <span class="unit">%</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">账户余额</label>
                  <div class="f__ctl">
                    <el-input-number
                      v-model="billingForm.balance"
                      :min="0"
                      :precision="2"
                      :step="100"
                      controls-position="right"
                    />
                    <span class="unit">元</span>
                  </div>
                </div>
                <div class="f">
                  <label class="f__k">合同编号</label>
                  <el-input
                    v-model="billingForm.contractNo"
                    placeholder="如 HT-2026-0118"
                  />
                </div>
              </form>

              <div v-if="editingTab === 'billing'" class="editbar">
                <span class="editbar__tip">修改后需保存才会生效</span>
                <el-button @click="cancelEdit">取消</el-button>
                <el-button type="primary" @click="saveBilling">保存</el-button>
              </div>
            </section>
          </el-tab-pane>

          <!-- ---------------------- 认证与鉴权 ---------------------- -->
          <el-tab-pane name="auth">
            <template #label><span class="navtab">认证与鉴权</span></template>
            <section class="sec">
              <div class="sec__head">
                <div>
                  <h2 class="sec__title">认证与鉴权</h2>
                  <p class="sec__hint">
                    一个合作方可配置多种鉴权方式，由接口按需引用；脚本方式适用于无法用配置表达的签名
                  </p>
                </div>
                <el-button type="primary" :icon="AddIcon" @click="openCreateAuth">
                  新增鉴权
                </el-button>
              </div>

              <div v-if="detail.authConfigs.length" class="alist">
                <div class="alist__head">
                  <span>鉴权名称</span>
                  <span>AppKey</span>
                  <span>AppSecret</span>
                  <span>状态</span>
                  <span />
                </div>
                <div
                  v-for="row in detail.authConfigs"
                  :key="row.id"
                  class="alist__row"
                >
                  <div class="alist__name">
                    <span class="alist__title">{{ row.name }}</span>
                    <span
                      class="chip"
                      :class="{ 'chip--code': row.authType === 'script' }"
                    >
                      {{ getAuthTypeLabel(row.authType) }}
                    </span>
                  </div>
                  <span class="mono alist__val">{{ row.appKey || "—" }}</span>
                  <span class="alist__val mono">
                    <template v-if="row.appSecret">
                      {{
                        isSecretRevealed(row)
                          ? row.appSecret
                          : maskSecret(row.appSecret)
                      }}
                      <button
                        type="button"
                        class="txt txt--sm"
                        @click="toggleSecret(row)"
                      >
                        {{ isSecretRevealed(row) ? "隐藏" : "显示" }}
                      </button>
                    </template>
                    <template v-else>—</template>
                  </span>
                  <span
                    class="dot"
                    :class="row.enabled ? 'is-on' : 'is-off'"
                    >{{ row.enabled ? "启用" : "停用" }}</span
                  >
                  <div class="alist__ops">
                    <button
                      type="button"
                      class="txt"
                      @click="openEditAuth(row)"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      class="txt txt--danger"
                      @click="removeAuth(row)"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="empty-state">
                <p class="empty-state__title">尚未配置鉴权</p>
                <p class="empty-state__hint">
                  配置后，接口才能在调用时完成签名与凭证注入
                </p>
                <el-button type="primary" :icon="AddIcon" @click="openCreateAuth">
                  新增鉴权
                </el-button>
              </div>
            </section>
          </el-tab-pane>
        </el-tabs>
      </div>

      <AuthDialog
        v-model="authDialogVisible"
        :editing="editingAuth"
        @submit="saveAuth"
      />
    </template>

    <div v-else class="pd-missing">
      <p class="empty-state__title">未找到该合作方</p>
      <p class="empty-state__hint">可能已被删除，请返回列表确认</p>
      <el-button @click="goBack">返回列表</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pd {
  --ink: #16233a;
  --ink-2: #46536e;
  --muted: #8792a8;
  --line: #e6eaf2;
  --line-soft: #eef1f7;
  --canvas: #f4f6fa;
  --surface: #fff;
  --accent: var(--el-color-primary);
  --on: #0f9d58;
  --warn: #c77700;
  --code: #6b4dff;

  padding: 16px;
  color: var(--ink);
  font-size: 13px;
  font-variant-numeric: tabular-nums;

  :deep(.el-tabs__header) {
    margin-right: 0;
  }
}

/* ------------------------------- 档案头 ------------------------------- */
.pd-head {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px 22px 16px;

  &__top {
    display: flex;
    align-items: flex-start;
    gap: 18px;
  }

  &__id {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 10px;
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.2px;
    line-height: 1.3;
  }

  &__code {
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: 12px;
    color: var(--muted);
    padding-left: 2px;
  }
}

.pd-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--ink-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 40%, #fff);
    background: color-mix(in srgb, var(--accent) 6%, #fff);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 55%, #fff);
    outline-offset: 1px;
  }
}

.pd-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);

  &__item {
    padding-left: 16px;
    border-left: 1px solid var(--line-soft);

    &:first-child {
      padding-left: 0;
      border-left: 0;
    }

    dt {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }

    dd {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--ink);

      &.is-time {
        font-size: 13px;
        font-weight: 500;
        color: var(--ink-2);
      }
    }
  }
}

/* ------------------------------- 主体 ------------------------------- */
.pd-body {
  margin-top: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.pd-tabs {
  :deep(.el-tabs__header) {
    width: 168px;
    margin: 0;
    padding: 10px 0;
    border-right: 1px solid var(--line-soft);
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    position: relative;
    height: 38px;
    line-height: 38px;
    padding: 0 18px 0 20px !important;
    text-align: left;
    font-size: 13px;
    color: var(--ink-2);
    transition: background 0.15s, color 0.15s;

    /* 自绘选中指示条，避免内置 active-bar 在竖向布局下错位 */
    &::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      width: 3px;
      height: 0;
      border-radius: 0 2px 2px 0;
      background: var(--accent);
      transform: translateY(-50%);
      transition: height 0.18s ease;
    }

    &:hover {
      color: var(--ink);
      background: #f4f6fa;
    }

    &.is-active {
      color: var(--accent);
      font-weight: 600;
      background: color-mix(in srgb, var(--accent) 7%, #fff);

      &::before {
        height: 22px;
      }
    }
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }

  :deep(.el-tabs__content) {
    padding: 4px 0 0;
  }
}

.navtab {
  display: block;
}

/* ------------------------------- 分区 ------------------------------- */
.sec {
  padding: 18px 24px 22px;
}

.sec__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line-soft);
}

.sec__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.sec__hint {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
  max-width: 68ch;
}

.sec__edit {
  flex: none;
  font-size: 13px;
}

/* ------------------------------- 字段网格 ------------------------------- */
.grid {
  display: grid;
  gap: 18px 32px;
  margin: 18px 0 0;

  &--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &--3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  &--edit {
    row-gap: 16px;
    align-items: start;
  }
}

.f {
  min-width: 0;
  &__k {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--muted);

    &.is-req::after {
      content: "*";
      margin-left: 3px;
      color: var(--el-color-danger);
    }
  }

  &__v {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
    word-break: break-all;

    i {
      font-style: normal;
      font-size: 12px;
      color: var(--muted);
      margin-left: 2px;
    }
  }

  &__note {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    color: var(--muted);
  }

  &__ctl {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.grid--edit .f :deep(.el-input-number) {
  width: 100%;
}

.unit {
  flex: none;
  font-size: 12px;
  color: var(--muted);
}

/* ------------------------------- 子区块 ------------------------------- */
.sub {
  margin-top: 24px;

  &__head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line-soft);
  }

  &__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  &__hint {
    font-size: 12px;
    color: var(--muted);
  }
}

.kvlist {
  margin-top: 4px;

  &__row {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line-soft);

    &:last-child {
      border-bottom: 0;
    }
  }

  &__k {
    font-size: 12px;
    color: var(--ink-2);
  }

  &__v {
    font-size: 13px;
    color: var(--ink);
    word-break: break-all;
  }

  &__input {
    max-width: 420px;

    &.is-k {
      max-width: 220px;
    }
  }

  &.is-edit &__row {
    padding: 6px 0;
  }
}

.empty-inline {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--muted);
}

/* ------------------------------- 额度进度 ------------------------------- */
.meter-wrap {
  margin-top: 18px;
  padding: 14px 16px;
  background: #fafbfd;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
}

.meter {
  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: 12px;
    color: var(--ink-2);

    b {
      font-size: 15px;
      color: var(--ink);

      &.is-warn {
        color: var(--warn);
      }
    }
  }

  &__track {
    height: 4px;
    margin: 8px 0 0;
    border-radius: 2px;
    background: #e9edf5;
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      border-radius: 2px;
      background: var(--accent);
      transition: width 0.3s ease;

      &.is-warn {
        background: var(--warn);
      }
    }
  }

  &__note {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
}

/* ------------------------------- 鉴权列表 ------------------------------- */
.alist {
  margin-top: 6px;

  &__head,
  &__row {
    display: grid;
    grid-template-columns: minmax(200px, 1.3fr) minmax(120px, 1fr)
      minmax(180px, 1.2fr) 84px 104px;
    align-items: center;
    gap: 16px;
  }

  &__head {
    padding: 10px 0;
    font-size: 12px;
    color: var(--muted);
    border-bottom: 1px solid var(--line-soft);
  }

  &__row {
    padding: 12px 0;
    border-bottom: 1px solid var(--line-soft);
    transition: background 0.15s;

    &:hover {
      background: #fafbfd;
    }

    &:last-child {
      border-bottom: 0;
    }
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__val {
    font-size: 12px;
    color: var(--ink-2);
    word-break: break-all;
  }

  &__ops {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

/* ------------------------------- 原子件 ------------------------------- */
.dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  &.is-on {
    color: var(--on);
  }

  &.is-off {
    color: var(--muted);
  }

  &.is-warn {
    color: var(--warn);
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 8%, #fff);
  color: color-mix(in srgb, var(--accent) 82%, #0b1a33);
  font-size: 11px;
  white-space: nowrap;

  &--code {
    background: color-mix(in srgb, var(--code) 9%, #fff);
    color: var(--code);
  }
}

.mono {
  font-family: ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
  font-size: 12px;
}

.num {
  font-variant-numeric: tabular-nums;
}

.txt {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;

  &--sm {
    margin-left: 6px;
    font-size: 11px;
  }

  &--danger {
    color: var(--el-color-danger);
  }

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 55%, #fff);
    outline-offset: 2px;
    border-radius: 2px;
  }
}

/* ------------------------------- 编辑操作条 ------------------------------- */
.editbar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 22px -24px -22px;
  padding: 12px 24px;
  background: #fafbfd;
  border-top: 1px solid var(--line);

  &__tip {
    flex: 1;
    font-size: 12px;
    color: var(--muted);
  }
}

/* ------------------------------- 空态 ------------------------------- */
.empty-state,
.pd-missing {
  padding: 40px 0 44px;
  text-align: center;

  &__title {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }

  &__hint {
    margin: 0 0 16px;
    font-size: 12px;
    color: var(--muted);
  }
}

.pd-missing {
  margin-top: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
}

@media (width <= 1280px) {
  .grid--3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 960px) {
  .pd-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 14px;
  }

  .pd-stats__item:nth-child(3) {
    padding-left: 0;
    border-left: 0;
  }

  .grid--2,
  .grid--3 {
    grid-template-columns: minmax(0, 1fr);
  }

  .pd-tabs :deep(.el-tabs__header) {
    width: 132px;
  }

  .alist__head {
    display: none;
  }

  .alist__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .meter__track i,
  .pd-back,
  .alist__row {
    transition: none;
  }
}
</style>
