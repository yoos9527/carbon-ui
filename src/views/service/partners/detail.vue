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
  <div class="main">
    <el-card shadow="never">
      <div class="flex items-center">
        <el-button link :icon="BackIcon" @click="goBack">返回</el-button>
        <span class="ml-2 text-base font-medium">合作方详情</span>
        <span v-if="detail" class="ml-2 text-sm text-gray-400">
          {{ detail.code }}
        </span>
      </div>
    </el-card>

    <template v-if="detail">
      <el-card shadow="never" class="mt-4">
        <div class="overview">
          <div class="overview__title">
            <span class="text-lg font-medium">{{ detail.name }}</span>
            <el-tag v-if="statusOption" :type="statusOption.tagType" class="ml-2">
              {{ statusOption.label }}
            </el-tag>
            <el-tag
              v-for="label in typeLabels"
              :key="label"
              type="info"
              effect="plain"
              class="ml-2"
            >
              {{ label }}
            </el-tag>
          </div>
          <el-descriptions :column="4" class="mt-3" size="small">
            <el-descriptions-item label="接口数量">
              {{ detail.interfaces.length }}
            </el-descriptions-item>
            <el-descriptions-item label="启用中接口">
              {{ enabledInterfaceCount }}
            </el-descriptions-item>
            <el-descriptions-item label="剩余额度">
              {{ remainQuota.toLocaleString() }}
            </el-descriptions-item>
            <el-descriptions-item label="最近调用">
              {{ lastCallTime }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-card>

      <el-card shadow="never" class="mt-4">
        <el-tabs v-model="activeTab">
          <!-- 环境与网络 -->
          <el-tab-pane label="环境与网络" name="env">
            <div class="tab-bar">
              <span class="tab-tip">
                合作方公共的地址、超时与网络参数，接口可单独覆盖
              </span>
              <div>
                <template v-if="editingTab === 'env'">
                  <el-button @click="cancelEdit">取消</el-button>
                  <el-button type="primary" @click="saveEnv">保存</el-button>
                </template>
                <el-button
                  v-else
                  type="primary"
                  :icon="EditIcon"
                  @click="startEditEnv"
                >
                  编辑
                </el-button>
              </div>
            </div>

            <el-descriptions
              v-if="editingTab !== 'env'"
              :column="2"
              border
              label-width="140px"
            >
              <el-descriptions-item label="生产环境地址">
                {{ detail.baseUrlProd || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="测试环境地址">
                {{ detail.baseUrlTest || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="字符编码">
                {{ detail.charset }}
              </el-descriptions-item>
              <el-descriptions-item label="连接超时">
                {{ detail.connectTimeout }} ms
              </el-descriptions-item>
              <el-descriptions-item label="读取超时">
                {{ detail.readTimeout }} ms
              </el-descriptions-item>
              <el-descriptions-item label="是否走代理">
                <el-tag :type="detail.useProxy ? 'warning' : 'info'">
                  {{ detail.useProxy ? "是" : "否" }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="代理类型">
                {{ detail.useProxy ? detail.proxyType || "-" : "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="代理地址">
                {{ detail.useProxy ? detail.proxyUrl || "-" : "-" }}
              </el-descriptions-item>
            </el-descriptions>

            <el-form
              v-else-if="envForm"
              :model="envForm"
              label-width="140px"
              class="edit-form"
            >
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="生产环境地址" required>
                    <el-input
                      v-model="envForm.baseUrlProd"
                      placeholder="https://api.example.com"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="测试环境地址">
                    <el-input
                      v-model="envForm.baseUrlTest"
                      placeholder="https://api-test.example.com"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="字符编码">
                    <el-select v-model="envForm.charset" class="w-full">
                      <el-option
                        v-for="item in charsetOptions"
                        :key="item"
                        :label="item"
                        :value="item"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="连接超时">
                    <el-input-number
                      v-model="envForm.connectTimeout"
                      :min="100"
                      :step="500"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">ms</span>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="读取超时">
                    <el-input-number
                      v-model="envForm.readTimeout"
                      :min="100"
                      :step="500"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">ms</span>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="是否走代理">
                    <el-switch v-model="envForm.useProxy" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="代理类型">
                    <el-select
                      v-model="envForm.proxyType"
                      class="w-full"
                      :disabled="!envForm.useProxy"
                      placeholder="请选择"
                    >
                      <el-option label="HTTP" value="http" />
                      <el-option label="SOCKS5" value="socks5" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="代理地址">
                    <el-input
                      v-model="envForm.proxyUrl"
                      :disabled="!envForm.useProxy"
                      placeholder="http://10.0.0.8:7890"
                    />
                  </el-form-item>
                </el-col>
              </el-row>

              <div class="section-title">公共请求头</div>
              <div
                v-for="(item, index) in envForm.commonHeaders"
                :key="`header-${index}`"
                class="kv-row"
              >
                <el-input v-model="item.key" placeholder="参数名" class="kv-key" />
                <el-input
                  v-model="item.value"
                  placeholder="参数值"
                  class="kv-value"
                />
                <el-button
                  link
                  type="danger"
                  :icon="DeleteIcon"
                  @click="removeHeaderRow(index)"
                />
              </div>
              <el-button link type="primary" :icon="AddIcon" @click="addHeaderRow">
                添加请求头
              </el-button>
            </el-form>

            <template v-if="editingTab !== 'env'">
              <div class="section-title">公共请求头</div>
              <el-table
                :data="detail.commonHeaders"
                border
                size="small"
                empty-text="未配置公共请求头"
              >
                <el-table-column prop="key" label="参数名" min-width="200" />
                <el-table-column prop="value" label="参数值" min-width="260" />
              </el-table>
            </template>
          </el-tab-pane>

          <!-- 调用策略 -->
          <el-tab-pane label="调用策略" name="strategy">
            <div class="tab-bar">
              <span class="tab-tip">限流、重试、熔断与缓存策略</span>
              <div>
                <template v-if="editingTab === 'strategy'">
                  <el-button @click="cancelEdit">取消</el-button>
                  <el-button type="primary" @click="saveStrategy">保存</el-button>
                </template>
                <el-button
                  v-else
                  type="primary"
                  :icon="EditIcon"
                  @click="startEditStrategy"
                >
                  编辑
                </el-button>
              </div>
            </div>

            <el-descriptions
              v-if="editingTab !== 'strategy'"
              :column="3"
              border
              label-width="140px"
            >
              <el-descriptions-item label="限流 QPS">
                {{ detail.qps }}
              </el-descriptions-item>
              <el-descriptions-item label="日调用上限">
                {{ detail.dailyLimit.toLocaleString() }}
              </el-descriptions-item>
              <el-descriptions-item label="并发数">
                {{ detail.concurrency }}
              </el-descriptions-item>
              <el-descriptions-item label="失败重试次数">
                {{ detail.retryTimes }}
              </el-descriptions-item>
              <el-descriptions-item label="重试间隔">
                {{ detail.retryInterval }} ms
              </el-descriptions-item>
              <el-descriptions-item label="结果缓存 TTL">
                {{ detail.cacheTtl ? `${detail.cacheTtl} s` : "不缓存" }}
              </el-descriptions-item>
              <el-descriptions-item label="熔断阈值">
                {{ detail.breakerThreshold }} 次
              </el-descriptions-item>
              <el-descriptions-item label="熔断恢复时间">
                {{ detail.breakerRecoverMin }} 分钟
              </el-descriptions-item>
              <el-descriptions-item label="告警接收人">
                {{ detail.alarmReceiver || "-" }}
              </el-descriptions-item>
            </el-descriptions>

            <el-form
              v-else-if="strategyForm"
              :model="strategyForm"
              label-width="140px"
              class="edit-form"
            >
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="限流 QPS">
                    <el-input-number
                      v-model="strategyForm.qps"
                      :min="1"
                      controls-position="right"
                      class="num"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="日调用上限">
                    <el-input-number
                      v-model="strategyForm.dailyLimit"
                      :min="0"
                      :step="1000"
                      controls-position="right"
                      class="num"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="并发数">
                    <el-input-number
                      v-model="strategyForm.concurrency"
                      :min="1"
                      controls-position="right"
                      class="num"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="失败重试次数">
                    <el-input-number
                      v-model="strategyForm.retryTimes"
                      :min="0"
                      :max="5"
                      controls-position="right"
                      class="num"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="重试间隔">
                    <el-input-number
                      v-model="strategyForm.retryInterval"
                      :min="0"
                      :step="100"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">ms</span>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="结果缓存 TTL">
                    <el-input-number
                      v-model="strategyForm.cacheTtl"
                      :min="0"
                      :step="60"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">秒</span>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="熔断阈值">
                    <el-input-number
                      v-model="strategyForm.breakerThreshold"
                      :min="1"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">次</span>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="熔断恢复时间">
                    <el-input-number
                      v-model="strategyForm.breakerRecoverMin"
                      :min="1"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">分钟</span>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="告警接收人">
                    <el-input
                      v-model="strategyForm.alarmReceiver"
                      placeholder="邮箱或用户名"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </el-tab-pane>

          <!-- 计费与额度 -->
          <el-tab-pane label="计费与额度" name="billing">
            <div class="tab-bar">
              <span class="tab-tip">计费方式、套餐额度与结算信息</span>
              <div>
                <template v-if="editingTab === 'billing'">
                  <el-button @click="cancelEdit">取消</el-button>
                  <el-button type="primary" @click="saveBilling">保存</el-button>
                </template>
                <el-button
                  v-else
                  type="primary"
                  :icon="EditIcon"
                  @click="startEditBilling"
                >
                  编辑
                </el-button>
              </div>
            </div>

            <el-descriptions
              v-if="editingTab !== 'billing'"
              :column="2"
              border
              label-width="140px"
            >
              <el-descriptions-item label="计费方式">
                {{
                  billingTypeOptions.find(
                    item => item.value === detail.billingType
                  )?.label
                }}
              </el-descriptions-item>
              <el-descriptions-item label="默认单价">
                {{ detail.unitPrice }} 元/次
              </el-descriptions-item>
              <el-descriptions-item label="套餐总量">
                {{ detail.quotaTotal.toLocaleString() }}
              </el-descriptions-item>
              <el-descriptions-item label="已用额度">
                {{ detail.quotaUsed.toLocaleString() }}
              </el-descriptions-item>
              <el-descriptions-item label="剩余额度">
                {{ remainQuota.toLocaleString() }}
              </el-descriptions-item>
              <el-descriptions-item label="预警阈值">
                剩余低于 {{ detail.warnThreshold }}% 时告警
              </el-descriptions-item>
              <el-descriptions-item label="结算周期">
                {{
                  settleTypeOptions.find(item => item.value === detail.settleType)
                    ?.label
                }}
              </el-descriptions-item>
              <el-descriptions-item label="账户余额">
                {{ detail.balance.toLocaleString() }} 元
              </el-descriptions-item>
              <el-descriptions-item label="合同编号">
                {{ detail.contractNo || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="额度使用率">
                {{ quotaUsedPercent }}%
              </el-descriptions-item>
            </el-descriptions>

            <el-form
              v-else-if="billingForm"
              :model="billingForm"
              label-width="140px"
              class="edit-form"
            >
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="计费方式">
                    <el-select v-model="billingForm.billingType" class="w-full">
                      <el-option
                        v-for="item in billingTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="默认单价">
                    <el-input-number
                      v-model="billingForm.unitPrice"
                      :min="0"
                      :precision="2"
                      :step="0.1"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">元/次</span>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="套餐总量">
                    <el-input-number
                      v-model="billingForm.quotaTotal"
                      :min="0"
                      :step="1000"
                      controls-position="right"
                      class="num"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="已用额度">
                    <el-input-number
                      v-model="billingForm.quotaUsed"
                      :min="0"
                      :step="100"
                      controls-position="right"
                      class="num"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="预警阈值">
                    <el-input-number
                      v-model="billingForm.warnThreshold"
                      :min="0"
                      :max="100"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">%</span>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="16">
                <el-col :span="8">
                  <el-form-item label="结算周期">
                    <el-select v-model="billingForm.settleType" class="w-full">
                      <el-option
                        v-for="item in settleTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="账户余额">
                    <el-input-number
                      v-model="billingForm.balance"
                      :min="0"
                      :precision="2"
                      :step="100"
                      controls-position="right"
                      class="num"
                    />
                    <span class="unit">元</span>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="合同编号">
                    <el-input
                      v-model="billingForm.contractNo"
                      placeholder="如 HT-2026-0118"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>

            <el-progress
              v-if="detail.quotaTotal"
              class="mt-4"
              :percentage="quotaUsedPercent"
              :status="
                quotaUsedPercent >= 100 - detail.warnThreshold
                  ? 'warning'
                  : 'success'
              "
            />
          </el-tab-pane>

          <!-- 认证与鉴权 -->
          <el-tab-pane label="认证与鉴权" name="auth">
            <div class="tab-bar">
              <span class="tab-tip">
                同一个合作方可配置多种鉴权方式，由接口按需引用
              </span>
              <el-button type="primary" :icon="AddIcon" @click="openCreateAuth">
                新增鉴权
              </el-button>
            </div>
            <el-table
              :data="detail.authConfigs"
              border
              size="small"
              empty-text="尚未配置鉴权"
            >
              <el-table-column prop="name" label="鉴权名称" min-width="160">
                <template #default="{ row }">
                  <span class="flex items-center">
                    <el-icon class="mr-1"><KeyIcon /></el-icon>
                    {{ row.name }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="鉴权方式" min-width="150">
                <template #default="{ row }">
                  <el-tag
                    :type="row.authType === 'script' ? 'warning' : 'primary'"
                    effect="plain"
                  >
                    {{ getAuthTypeLabel(row.authType) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="AppKey" min-width="180">
                <template #default="{ row }">
                  {{ row.appKey || "-" }}
                </template>
              </el-table-column>
              <el-table-column label="AppSecret" min-width="200">
                <template #default="{ row }">
                  <template v-if="row.appSecret">
                    <span class="font-mono">
                      {{
                        isSecretRevealed(row)
                          ? row.appSecret
                          : maskSecret(row.appSecret)
                      }}
                    </span>
                    <el-button
                      link
                      type="primary"
                      class="ml-2"
                      @click="toggleSecret(row)"
                    >
                      {{ isSecretRevealed(row) ? "隐藏" : "显示" }}
                    </el-button>
                  </template>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'">
                    {{ row.enabled ? "启用" : "停用" }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="140" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openEditAuth(row)">
                    编辑
                  </el-button>
                  <el-button link type="danger" @click="removeAuth(row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <AuthDialog
        v-model="authDialogVisible"
        :editing="editingAuth"
        @submit="saveAuth"
      />
    </template>

    <el-card v-else shadow="never" class="mt-4">
      <el-empty description="未找到该合作方，可能已被删除" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.main {
  padding: 16px;
}

.overview {
  &__title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
}

.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.tab-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.section-title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.edit-form {
  max-width: 1180px;
}

.num {
  width: 140px;
}

.unit {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.kv-key {
  width: 240px;
}

.kv-value {
  max-width: 420px;
}

.font-mono {
  font-family: Consolas, Monaco, "Courier New", monospace;
}
</style>
