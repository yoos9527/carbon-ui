<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  billingTypeOptions,
  cacheUnitOptions,
  createEmptyEnv,
  getCacheUnitLabel,
  getAuthTypeLabel,
  getPartnerById,
  getStatusOption,
  settleTypeOptions,
  type AuthConfig,
  type PartnerEnv,
  type PartnerItem
} from "./data";
import AuthDialog from "./components/AuthDialog.vue";
import BackIcon from "~icons/ri/arrow-left-line";
import AddIcon from "~icons/ri/add-line";
import EditIcon from "~icons/ri/edit-line";
import DeleteIcon from "~icons/ri/delete-bin-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServicePartnerDetail" });

type EnvForm = Pick<
  PartnerItem,
  | "envs"
  | "charset"
  | "connectTimeout"
  | "readTimeout"
  | "useProxy"
  | "proxyType"
  | "proxyUrl"
>;

/** 高级配置一步同时编辑计费、流控、缓存，所以合成一个类型 */
type AdvancedForm = Pick<
  PartnerItem,
  | "billingType"
  | "unitPrice"
  | "settleType"
  | "contractNo"
  | "balance"
  | "quotaTotal"
  | "quotaUsed"
  | "warnThreshold"
  | "qps"
  | "dailyLimit"
  | "concurrency"
  | "retryTimes"
  | "retryInterval"
  | "breakerThreshold"
  | "breakerRecoverMin"
  | "alarmReceiver"
  | "cacheEnabled"
  | "cacheTtl"
  | "cacheUnit"
>;

const route = useRoute();
const router = useRouter();

const activeTab = ref("env");
const detail = ref<PartnerItem | null>(null);
/** 当前处于编辑态的步骤，空串为全部只读（认证与鉴权走弹窗，不进这里） */
const editingTab = ref<"" | "env" | "advanced">("");
const envForm = ref<EnvForm | null>(null);
const advancedForm = ref<AdvancedForm | null>(null);

const authDialogVisible = ref(false);
const editingAuth = ref<AuthConfig | null>(null);

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

/** 鉴权列表「内容」列的摘要：header 列出请求头名，script 列版本 */
function authContentBrief(auth: AuthConfig) {
  if (auth.authType === "header") {
    const keys = (auth.headers ?? []).map(item => item.key).filter(Boolean);
    return keys.length
      ? keys.slice(0, 3).join(" · ") +
          (keys.length > 3 ? ` 等 ${keys.length} 项` : "")
      : "未配置请求头";
  }
  return `Groovy v${auth.scriptVersion ?? 1} · 超时 ${auth.scriptTimeout ?? 3000}ms`;
}

/* ------------------------------ 三块公共配置的编辑态 ------------------------------ */

function startEditEnv() {
  const partner = detail.value;
  if (!partner) return;
  envForm.value = {
    envs: partner.envs.map(item => ({ ...item })),
    charset: partner.charset,
    connectTimeout: partner.connectTimeout,
    readTimeout: partner.readTimeout,
    useProxy: partner.useProxy,
    proxyType: partner.proxyType,
    proxyUrl: partner.proxyUrl
  };
  editingTab.value = "env";
}

/** 环境是可增删的列表：dev / sit / uat / prod 都可能存在，不写死两个 */
function addEnvRow() {
  envForm.value?.envs.push(createEmptyEnv());
}

function removeEnvRow(index: number) {
  envForm.value?.envs.splice(index, 1);
}

function saveEnv() {
  const partner = detail.value;
  const form = envForm.value;
  if (!partner || !form) return;
  const rows = form.envs;
  if (!rows.length) {
    ElMessage.warning("至少保留一个接入环境");
    return;
  }
  if (rows.some(item => !item.name.trim())) {
    ElMessage.warning("环境名称不能为空");
    return;
  }
  if (rows.some(item => !item.code.trim())) {
    ElMessage.warning("环境标识不能为空");
    return;
  }
  if (rows.some(item => !item.baseUrl.trim())) {
    ElMessage.warning("接入地址不能为空");
    return;
  }
  const codes = rows.map(item => item.code.trim().toLowerCase());
  if (new Set(codes).size !== codes.length) {
    ElMessage.warning("环境标识不可重复");
    return;
  }
  const cleaned: PartnerEnv[] = rows.map(item => ({
    ...item,
    name: item.name.trim(),
    code: item.code.trim(),
    baseUrl: item.baseUrl.trim(),
    remark: item.remark?.trim() || undefined
  }));
  Object.assign(partner, form, { envs: cleaned });
  editingTab.value = "";
  ElMessage.success("环境与网络已保存");
}

function startEditAdvanced() {
  const partner = detail.value;
  if (!partner) return;
  advancedForm.value = {
    billingType: partner.billingType,
    unitPrice: partner.unitPrice,
    settleType: partner.settleType,
    contractNo: partner.contractNo,
    balance: partner.balance,
    quotaTotal: partner.quotaTotal,
    quotaUsed: partner.quotaUsed,
    warnThreshold: partner.warnThreshold,
    qps: partner.qps,
    dailyLimit: partner.dailyLimit,
    concurrency: partner.concurrency,
    retryTimes: partner.retryTimes,
    retryInterval: partner.retryInterval,
    breakerThreshold: partner.breakerThreshold,
    breakerRecoverMin: partner.breakerRecoverMin,
    alarmReceiver: partner.alarmReceiver,
    cacheEnabled: partner.cacheEnabled,
    cacheTtl: partner.cacheTtl,
    cacheUnit: partner.cacheUnit
  };
  editingTab.value = "advanced";
}

function saveAdvanced() {
  const partner = detail.value;
  const form = advancedForm.value;
  if (!partner || !form) return;
  if (form.quotaUsed > form.quotaTotal) {
    ElMessage.warning("已用额度不能大于套餐总量");
    return;
  }
  if (form.cacheEnabled && !form.cacheTtl) {
    ElMessage.warning("开启缓存时需填写缓存时长");
    return;
  }
  Object.assign(partner, form);
  editingTab.value = "";
  ElMessage.success("高级配置已保存");
}

function cancelEdit() {
  editingTab.value = "";
}

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
  partner.authConfigs = partner.authConfigs.filter(item => item.id !== auth.id);
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
            <template #label
              ><span class="step"><i>1</i>环境与网络</span></template
            >
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

              <template v-if="editingTab !== 'env'">
                <div v-if="detail.envs.length" class="alist alist--env">
                  <div class="alist__head">
                    <span>环境名称</span>
                    <span>接入地址</span>
                    <span>标识</span>
                    <span />
                  </div>
                  <div
                    v-for="row in detail.envs"
                    :key="row.id"
                    class="alist__row"
                  >
                    <div class="alist__name">
                      <span class="alist__title">{{ row.name }}</span>
                      <span v-if="row.remark" class="alist__remark">{{
                        row.remark
                      }}</span>
                    </div>
                    <div class="alist__content">
                      <span class="alist__val mono">{{
                        row.baseUrl || "—"
                      }}</span>
                    </div>
                    <span class="chip chip--code">{{ row.code }}</span>
                    <span />
                  </div>
                </div>
                <p v-if="!detail.envs.length" class="empty-inline">
                  尚未配置接入地址
                </p>
                <p class="f__note env-linked">
                  接口的完整调用地址 = 第一条环境的地址 + 接口路径（
                  {{ detail.interfaces?.length ?? 0 }} 个接口会跟着变）
                </p>

                <dl class="grid grid--2">
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
                    <dt class="f__k">连接超时（ms）</dt>
                    <dd class="f__v num">{{ detail.connectTimeout }}</dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">读取超时（ms）</dt>
                    <dd class="f__v num">{{ detail.readTimeout }}</dd>
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
              </template>

              <div v-else-if="envForm">
                <div class="alist alist--env alist--env-edit">
                  <div class="alist__head">
                    <span>环境名称</span>
                    <span>接入地址</span>
                    <span>标识</span>
                    <span />
                  </div>
                  <div
                    v-for="(row, index) in envForm.envs"
                    :key="row.id"
                    class="alist__row"
                  >
                    <el-input v-model="row.name" placeholder="生产环境" />
                    <el-input
                      v-model="row.baseUrl"
                      class="mono-field"
                      placeholder="https://api.example.com"
                    />
                    <el-input v-model="row.code" placeholder="prod" />
                    <div class="alist__ops">
                      <button
                        type="button"
                        class="txt txt--danger"
                        @click="removeEnvRow(index)"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
                <p v-if="!envForm.envs.length" class="empty-inline">
                  还没有接入环境，先新增一个
                </p>
                <el-button
                  text
                  :icon="AddIcon"
                  class="envs-add"
                  @click="addEnvRow"
                >
                  新增环境
                </el-button>

                <form class="grid grid--2 grid--edit">
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
                    <label class="f__k">连接超时（ms）</label>
                    <el-input-number
                      v-model="envForm.connectTimeout"
                      :min="100"
                      :step="500"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">读取超时（ms）</label>
                    <el-input-number
                      v-model="envForm.readTimeout"
                      :min="100"
                      :step="500"
                      controls-position="right"
                    />
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
              </div>

              <div v-if="editingTab === 'env'" class="editbar">
                <span class="editbar__tip">修改后需保存才会生效</span>
                <el-button @click="cancelEdit">取消</el-button>
                <el-button type="primary" @click="saveEnv">保存</el-button>
              </div>
            </section>
          </el-tab-pane>

          <!-- ---------------------- 认证与鉴权 ---------------------- -->
          <el-tab-pane name="auth">
            <template #label
              ><span class="step"><i>2</i>认证与鉴权</span></template
            >
            <section class="sec">
              <div class="sec__head">
                <div>
                  <h2 class="sec__title">认证与鉴权</h2>
                  <p class="sec__hint">
                    一个合作方可配置多种鉴权方式，由接口按需引用：公共请求头随每次请求发送，Groovy
                    脚本用于无法用配置表达的签名
                  </p>
                </div>
                <el-button
                  type="primary"
                  :icon="AddIcon"
                  @click="openCreateAuth"
                >
                  新增鉴权
                </el-button>
              </div>

              <div v-if="detail.authConfigs.length" class="alist">
                <div class="alist__head">
                  <span>鉴权名称</span>
                  <span>内容</span>
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
                  <div class="alist__content">
                    <span class="alist__val">{{ authContentBrief(row) }}</span>
                  </div>
                  <span class="dot" :class="row.enabled ? 'is-on' : 'is-off'">{{
                    row.enabled ? "启用" : "停用"
                  }}</span>
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
                <el-button
                  type="primary"
                  :icon="AddIcon"
                  @click="openCreateAuth"
                >
                  新增鉴权
                </el-button>
              </div>
            </section>
          </el-tab-pane>

          <!-- ---------------------- 高级配置（计费 / 流控 / 缓存） ---------------------- -->
          <el-tab-pane name="advanced">
            <template #label
              ><span class="step"><i>3</i>高级配置</span></template
            >
            <section class="sec">
              <div class="sec__head">
                <div>
                  <h2 class="sec__title">高级配置</h2>
                  <p class="sec__hint">
                    计费、流控与缓存，作用于该合作方下的全部接口
                  </p>
                </div>
                <el-button
                  v-if="editingTab !== 'advanced'"
                  text
                  :icon="EditIcon"
                  class="sec__edit"
                  @click="startEditAdvanced"
                >
                  编辑
                </el-button>
              </div>

              <!-- 计费 -->
              <div class="sec__sub">
                <h3 class="sec__sub-title">计费</h3>
                <div v-if="editingTab !== 'advanced'" class="meter-wrap">
                  <div class="meter">
                    <div class="meter__head">
                      <span>套餐额度使用</span>
                      <b
                        class="num"
                        :class="{
                          'is-warn':
                            quotaUsedPercent >= 100 - detail.warnThreshold
                        }"
                        >{{ quotaUsedPercent }}%</b
                      >
                    </div>
                    <div class="meter__track">
                      <i
                        :style="{ width: `${quotaUsedPercent}%` }"
                        :class="{
                          'is-warn':
                            quotaUsedPercent >= 100 - detail.warnThreshold
                        }"
                      />
                    </div>
                    <p class="meter__note">
                      已用 {{ detail.quotaUsed.toLocaleString() }} / 共
                      {{ detail.quotaTotal.toLocaleString() }}， 低于
                      {{ detail.warnThreshold }}% 时告警
                    </p>
                  </div>
                </div>

                <dl v-if="editingTab !== 'advanced'" class="grid grid--4">
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
                    <dt class="f__k">默认单价（元/次）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.unitPrice }}</span>
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
                    <dt class="f__k">合同编号</dt>
                    <dd class="f__v">
                      <span class="mono">{{ detail.contractNo || "—" }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">账户余额（元）</dt>
                    <dd class="f__v">
                      <span class="num">{{
                        detail.balance.toLocaleString()
                      }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">套餐总量</dt>
                    <dd class="f__v">
                      <span class="num">{{
                        detail.quotaTotal.toLocaleString()
                      }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">已用额度</dt>
                    <dd class="f__v">
                      <span class="num">{{
                        detail.quotaUsed.toLocaleString()
                      }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">预警阈值（%）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.warnThreshold }}</span>
                    </dd>
                  </div>
                </dl>

                <form v-else-if="advancedForm" class="grid grid--4 grid--edit">
                  <div class="f">
                    <label class="f__k">计费方式</label>
                    <el-select v-model="advancedForm.billingType">
                      <el-option
                        v-for="item in billingTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </div>
                  <div class="f">
                    <label class="f__k">默认单价（元/次）</label>
                    <el-input-number
                      v-model="advancedForm.unitPrice"
                      :min="0"
                      :precision="2"
                      :step="0.1"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">结算周期</label>
                    <el-select v-model="advancedForm.settleType">
                      <el-option
                        v-for="item in settleTypeOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </div>
                  <div class="f">
                    <label class="f__k">合同编号</label>
                    <el-input
                      v-model="advancedForm.contractNo"
                      placeholder="如 HT-2026-0118"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">账户余额（元）</label>
                    <el-input-number
                      v-model="advancedForm.balance"
                      :min="0"
                      :precision="2"
                      :step="100"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">套餐总量</label>
                    <el-input-number
                      v-model="advancedForm.quotaTotal"
                      :min="0"
                      :step="1000"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">已用额度</label>
                    <el-input-number
                      v-model="advancedForm.quotaUsed"
                      :min="0"
                      :step="100"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">预警阈值（%）</label>
                    <el-input-number
                      v-model="advancedForm.warnThreshold"
                      :min="0"
                      :max="100"
                      controls-position="right"
                    />
                  </div>
                </form>
              </div>

              <!-- 流控 -->
              <div class="sec__sub">
                <h3 class="sec__sub-title">流控</h3>
                <dl v-if="editingTab !== 'advanced'" class="grid grid--4">
                  <div class="f">
                    <dt class="f__k">限流（QPS）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.qps }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">日调用上限（次）</dt>
                    <dd class="f__v">
                      <span class="num">{{
                        detail.dailyLimit.toLocaleString()
                      }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">并发数</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.concurrency }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">失败重试（次）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.retryTimes }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">重试间隔（ms）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.retryInterval }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">熔断阈值（次）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.breakerThreshold }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">熔断恢复（分钟）</dt>
                    <dd class="f__v">
                      <span class="num">{{ detail.breakerRecoverMin }}</span>
                    </dd>
                  </div>
                  <div class="f">
                    <dt class="f__k">告警接收人</dt>
                    <dd class="f__v">
                      {{ detail.alarmReceiver || "—" }}
                    </dd>
                  </div>
                </dl>

                <form v-else-if="advancedForm" class="grid grid--4 grid--edit">
                  <div class="f">
                    <label class="f__k">限流（QPS）</label>
                    <el-input-number
                      v-model="advancedForm.qps"
                      :min="1"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">日调用上限（次）</label>
                    <el-input-number
                      v-model="advancedForm.dailyLimit"
                      :min="0"
                      :step="1000"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">并发数</label>
                    <el-input-number
                      v-model="advancedForm.concurrency"
                      :min="1"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">失败重试（次）</label>
                    <el-input-number
                      v-model="advancedForm.retryTimes"
                      :min="0"
                      :max="5"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">重试间隔（ms）</label>
                    <el-input-number
                      v-model="advancedForm.retryInterval"
                      :min="0"
                      :step="100"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">熔断阈值（次）</label>
                    <el-input-number
                      v-model="advancedForm.breakerThreshold"
                      :min="1"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">熔断恢复（分钟）</label>
                    <el-input-number
                      v-model="advancedForm.breakerRecoverMin"
                      :min="1"
                      controls-position="right"
                    />
                  </div>
                  <div class="f">
                    <label class="f__k">告警接收人</label>
                    <el-input
                      v-model="advancedForm.alarmReceiver"
                      placeholder="邮箱或用户名"
                    />
                  </div>
                </form>
              </div>

              <!-- 缓存 -->
              <div class="sec__sub">
                <h3 class="sec__sub-title">缓存</h3>
                <dl v-if="editingTab !== 'advanced'" class="grid grid--4">
                  <div class="f f--wide">
                    <dt class="f__k">结果缓存</dt>
                    <dd class="f__v">
                      <template v-if="detail.cacheEnabled">
                        {{ detail.cacheTtl }}
                        {{ getCacheUnitLabel(detail.cacheUnit) }}
                      </template>
                      <span v-else class="f__note">不缓存</span>
                    </dd>
                  </div>
                </dl>

                <form v-else-if="advancedForm" class="grid grid--4 grid--edit">
                  <div class="f f--wide">
                    <label class="f__k">结果缓存</label>
                    <div class="cache">
                      <el-switch
                        v-model="advancedForm.cacheEnabled"
                        active-text="开启"
                        inactive-text="关闭"
                        inline-prompt
                      />
                      <el-input-number
                        v-model="advancedForm.cacheTtl"
                        :min="1"
                        :disabled="!advancedForm.cacheEnabled"
                        :controls="false"
                        placeholder="时长"
                      />
                      <el-select
                        v-model="advancedForm.cacheUnit"
                        :disabled="!advancedForm.cacheEnabled"
                      >
                        <el-option
                          v-for="item in cacheUnitOptions"
                          :key="item.value"
                          :label="item.label"
                          :value="item.value"
                        />
                      </el-select>
                    </div>
                    <span class="f__note">
                      接口「高级配置」里缓存留空时，按这里的设置生效
                    </span>
                  </div>
                </form>
              </div>

              <div v-if="editingTab === 'advanced'" class="editbar">
                <span class="editbar__tip">修改后需保存才会生效</span>
                <el-button @click="cancelEdit">取消</el-button>
                <el-button type="primary" @click="saveAdvanced">保存</el-button>
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

  /* 弱底色：悬停、进度条槽、底栏、提示块 */
  --wash: #fafbfd;
  --hover: #f4f6fa;
  --track: #e9edf5;
  /* color-mix 的底色：亮色往白里掺，暗色往面板色里掺 */
  --mix: #fff;
  --mix-ink: #0b1a33;

  padding: 16px;
  color: var(--ink);
  font-size: 13px;
  font-variant-numeric: tabular-nums;

  :deep(.el-tabs__header) {
    margin-right: 0;
  }
}

/* 暗色：只换变量，下面的规则全部走 var() */
html.dark .pd {
  --ink: #e6ebf5;
  --ink-2: #a7b2c7;
  --muted: #7a879e;
  --line: #262d3b;
  --line-soft: #1e242f;
  --surface: #151a23;
  --canvas: #020409;
  --wash: #1a2029;
  --hover: #1d232e;
  --track: #232a36;
  --mix: #151a23;
  --mix-ink: #e8eefc;
  /* 绿/琥珀/#6b4dff 在 #151a23 上对比度不足，提亮 */
  --on: #3fbf7f;
  --warn: #e0a33a;
  --code: #9d8bff;
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
  background: var(--surface);
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
    border-color: color-mix(in srgb, var(--accent) 40%, var(--mix));
    background: color-mix(in srgb, var(--accent) 6%, var(--mix));
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 55%, var(--mix));
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
/* 与接口配置页（edit.vue 的 .ix-body）同一套骨架：左侧步骤卡片 + 右侧内容卡片 */
.pd-body {
  margin-top: 12px;
}

.pd-tabs {
  /* el-tabs 在 left 布局下用 float 分栏，改成 grid 才能两栏对齐 */
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 12px;
  align-items: start;

  :deep(.el-tabs__header.is-left) {
    float: none;
    width: auto;
    margin: 0;
    padding: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
  }

  :deep(.el-tabs__nav-wrap.is-left) {
    margin-right: 0;
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  // EP 的 left 布局把 item 设成 justify-content: flex-end，标签会被推到右边
  :deep(.el-tabs__item.is-left) {
    justify-content: flex-start;
    width: 100%;
    text-align: left;
  }

  :deep(.el-tabs__item) {
    position: relative;
    height: 40px;
    line-height: 40px;
    padding: 0 12px !important;
    text-align: left;
    font-size: 13px;
    color: var(--ink-2);
    transition:
      background 0.15s,
      color 0.15s;

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
      background: var(--hover);
    }

    &.is-active {
      color: var(--accent);
      font-weight: 600;
      background: color-mix(in srgb, var(--accent) 7%, var(--mix));

      &::before {
        height: 22px;
      }
    }
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }

  :deep(.el-tabs__content) {
    float: none;
    padding: 4px 0 0;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
  }
}

/* 左侧步骤条：序号圆点 + 标题，选中态由 el-tabs__item.is-active 带出 */
.step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--line);
  border-radius: 50%;
  font-size: 11px;
  font-style: normal;
  color: var(--muted);
  background: var(--surface);
}

.pd-tabs :deep(.el-tabs__item.is-active) .step i {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
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

/** 高级配置里的三个小节（计费 / 流控 / 缓存） */
.sec__sub {
  padding: 16px 0 4px;
  border-top: 1px dashed var(--line-soft);
}

.sec__sub-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-2);
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

  &--4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
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
}

/* 编辑态：所有控件占满列宽，数字左对齐，避免各列宽度不一致 */
.grid--edit .f {
  :deep(.el-input-number),
  :deep(.el-select),
  :deep(.el-input) {
    width: 100%;
  }

  :deep(.el-input-number .el-input__inner) {
    text-align: left;
  }
}

/** 跨满整行（三列网格里放一组开关 + 时长 + 单位） */
.f--wide {
  grid-column: 1 / -1;
}

.cache {
  display: flex;
  gap: 8px;
  align-items: center;
}

.grid--edit .f .cache {
  :deep(.el-input-number) {
    width: 140px;
  }

  :deep(.el-select) {
    width: 110px;
  }
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

.empty-inline {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--muted);
}

/* ------------------------------- 额度进度 ------------------------------- */
.meter-wrap {
  margin-top: 18px;
  padding: 14px 16px;
  background: var(--wash);
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
    background: var(--track);
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
    grid-template-columns: minmax(200px, 1.2fr) minmax(220px, 1.6fr) 84px 104px;
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
      background: var(--wash);
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

  &__content {
    min-width: 0;
  }

  &__ops {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

/* 环境列表：名称 / 接入地址 / 标识，比鉴权表少一个状态列 */
.alist--env {
  .alist__head,
  .alist__row {
    grid-template-columns: minmax(180px, 1.1fr) minmax(260px, 1.9fr) 96px 40px;
  }
}

.alist__remark {
  font-size: 12px;
  color: var(--muted);
}

/* 环境编辑态：每行三个输入框，行高交给控件撑开 */
.alist--env-edit {
  .alist__row {
    padding: 8px 0;
  }

  :deep(.el-input) {
    width: 100%;
  }
}

/* 地址列用等宽字体，便于核对域名 */
.mono-field :deep(.el-input__inner) {
  font-family:
    ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
  font-size: 12px;
}

.envs-add {
  margin-top: 6px;
  font-size: 12px;
}

/* 环境地址与接口路径的联动说明 */
.env-linked {
  margin-top: 10px;
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
  background: color-mix(in srgb, var(--accent) 8%, var(--mix));
  color: color-mix(in srgb, var(--accent) 82%, var(--mix-ink));
  font-size: 11px;
  white-space: nowrap;

  &--code {
    background: color-mix(in srgb, var(--code) 9%, var(--mix));
    color: var(--code);
  }
}

.mono {
  font-family:
    ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
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
    outline: 2px solid color-mix(in srgb, var(--accent) 55%, var(--mix));
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
  background: var(--wash);
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
  .grid--3,
  .grid--4 {
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
  .grid--3,
  .grid--4 {
    grid-template-columns: minmax(0, 1fr);
  }

  .pd-tabs {
    grid-template-columns: 160px minmax(0, 1fr);
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
