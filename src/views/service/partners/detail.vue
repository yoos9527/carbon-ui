<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getAuthTypeLabel,
  getPartnerById,
  getPartnerTypeLabel,
  getStatusOption,
  type AuthConfig,
  type PartnerInterfaceItem,
  type PartnerItem
} from "./data";
import AuthDialog from "./components/AuthDialog.vue";
import InterfaceDialog from "./components/InterfaceDialog.vue";
import BackIcon from "~icons/ri/arrow-left-line";
import AddIcon from "~icons/ri/add-line";
import EditIcon from "~icons/ri/edit-line";
import DeleteIcon from "~icons/ri/delete-bin-line";
import KeyIcon from "~icons/ri/key-2-line";
import { ElMessage, ElMessageBox } from "element-plus";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServicePartnerDetail" });

const route = useRoute();
const router = useRouter();

const activeTab = ref("basic");
const detail = ref<PartnerItem | null>(null);
const authDialogVisible = ref(false);
const editingAuth = ref<AuthConfig | null>(null);
const interfaceDialogVisible = ref(false);
const editingInterface = ref<PartnerInterfaceItem | null>(null);
/** 已点击展示明文的密钥，key 为 `auth-{id}` */
const revealedSecrets = ref<string[]>([]);

function load() {
  const found = getPartnerById(route.params.id as string);
  detail.value = found
    ? (JSON.parse(JSON.stringify(found)) as PartnerItem)
    : null;
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
  return Math.min(100, Math.round((partner.quotaUsed / partner.quotaTotal) * 100));
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

function authName(authId?: number) {
  if (!authId) return "-";
  return (
    detail.value?.authConfigs.find(item => item.id === authId)?.name ?? "-"
  );
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
  partner.authConfigs = partner.authConfigs.filter(
    item => item.id !== auth.id
  );
  ElMessage.success("已删除");
}

function openCreateInterface() {
  editingInterface.value = null;
  interfaceDialogVisible.value = true;
}

function openEditInterface(row: PartnerInterfaceItem) {
  editingInterface.value = JSON.parse(JSON.stringify(row));
  interfaceDialogVisible.value = true;
}

function saveInterface(row: PartnerInterfaceItem) {
  const partner = detail.value;
  if (!partner) return;
  const index = partner.interfaces.findIndex(item => item.id === row.id);
  if (index >= 0) {
    partner.interfaces[index] = row;
    ElMessage.success("接口配置已更新");
  } else {
    partner.interfaces.push(row);
    ElMessage.success("接口配置已新增");
  }
  interfaceDialogVisible.value = false;
}

async function removeInterface(row: PartnerInterfaceItem) {
  const partner = detail.value;
  if (!partner) return;
  await ElMessageBox.confirm(`确认删除接口「${row.name}」？`, "提示", {
    type: "warning"
  });
  partner.interfaces = partner.interfaces.filter(item => item.id !== row.id);
  ElMessage.success("已删除");
}
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <el-button link :icon="BackIcon" @click="goBack">返回</el-button>
          <span class="ml-2 text-base font-medium">合作方详情</span>
          <span v-if="detail" class="ml-2 text-sm text-gray-400">
            {{ detail.code }}
          </span>
        </div>
      </div>
    </el-card>

    <template v-if="detail">
      <el-card shadow="never" class="mt-4">
        <div class="overview">
          <div class="overview__title">
            <span class="text-lg font-medium">{{ detail.name }}</span>
            <el-tag
              v-if="statusOption"
              :type="statusOption.tagType"
              class="ml-2"
            >
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
          <!-- 1 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <el-descriptions :column="2" border label-width="140px">
              <el-descriptions-item label="合作方名称">
                {{ detail.name }}
              </el-descriptions-item>
              <el-descriptions-item label="合作方编码">
                {{ detail.code }}
              </el-descriptions-item>
              <el-descriptions-item label="服务商类型">
                <el-tag
                  v-for="label in typeLabels"
                  :key="label"
                  size="small"
                  class="mr-2"
                >
                  {{ label }}
                </el-tag>
                <span v-if="!typeLabels.length">-</span>
              </el-descriptions-item>
              <el-descriptions-item label="服务范围">
                {{ detail.scope.join(" / ") || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="官网">
                <el-link
                  v-if="detail.website"
                  type="primary"
                  :href="detail.website"
                  target="_blank"
                >
                  {{ detail.website }}
                </el-link>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag v-if="statusOption" :type="statusOption.tagType">
                  {{ statusOption.label }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="商务联系人">
                {{ detail.contact || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="联系电话">
                {{ detail.phone || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="邮箱">
                {{ detail.email || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="技术支持电话">
                {{ detail.supportPhone || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="合作起止">
                {{ detail.cooperateStart || "-" }} ~
                {{ detail.cooperateEnd || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ detail.createTime || "-" }}
              </el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">
                {{ detail.remark || "-" }}
              </el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <!-- 2 环境与网络 -->
          <el-tab-pane label="环境与网络" name="env">
            <el-descriptions :column="2" border label-width="140px">
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
          </el-tab-pane>

          <!-- 3 认证与鉴权 -->
          <el-tab-pane label="认证与鉴权" name="auth">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-gray-500">
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

          <!-- 4 调用策略 -->
          <el-tab-pane label="调用策略" name="strategy">
            <el-descriptions :column="3" border label-width="140px">
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
          </el-tab-pane>

          <!-- 5 计费与额度 -->
          <el-tab-pane label="计费与额度" name="billing">
            <el-descriptions :column="2" border label-width="140px">
              <el-descriptions-item label="计费方式">
                {{
                  {
                    per_call: "按次计费",
                    package: "套餐包",
                    yearly: "包年",
                    free: "免费"
                  }[detail.billingType]
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
                {{ detail.settleType === "monthly" ? "月结" : "预付充值" }}
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

          <!-- 6 接口能力清单 -->
          <el-tab-pane label="接口能力清单" name="interfaces">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-gray-500">
                只配置与公共配置不同的部分，请求方式、报文格式、独立参数均按接口单独设置
              </span>
              <el-button
                type="primary"
                :icon="AddIcon"
                @click="openCreateInterface"
              >
                新增接口
              </el-button>
            </div>
            <el-table
              :data="detail.interfaces"
              border
              size="small"
              empty-text="尚未配置接口"
            >
              <el-table-column prop="name" label="能力名称" min-width="160" />
              <el-table-column prop="path" label="接口路径" min-width="200">
                <template #default="{ row }">
                  <span class="font-mono text-xs">{{ row.path }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="method" label="方式" width="80" />
              <el-table-column label="报文格式" width="100">
                <template #default="{ row }">
                  {{ row.payloadFormat.toUpperCase() }}
                </template>
              </el-table-column>
              <el-table-column label="引用鉴权" min-width="150">
                <template #default="{ row }">
                  {{ authName(row.authId) }}
                </template>
              </el-table-column>
              <el-table-column label="单价" width="100" align="right">
                <template #default="{ row }">
                  {{ row.price ? `${row.price} 元` : "免费" }}
                </template>
              </el-table-column>
              <el-table-column label="日上限" width="110" align="right">
                <template #default="{ row }">
                  {{ row.dailyLimit?.toLocaleString() ?? "-" }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'">
                    {{ row.enabled ? "启用" : "停用" }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="最近调用" min-width="170">
                <template #default="{ row }">
                  {{ row.lastCallTime || "-" }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="140" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openEditInterface(row)">
                    编辑
                  </el-button>
                  <el-button link type="danger" @click="removeInterface(row)">
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
      <InterfaceDialog
        v-model="interfaceDialogVisible"
        :editing="editingInterface"
        :auth-options="detail.authConfigs"
        @submit="saveInterface"
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

.section-title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.font-mono {
  font-family: Consolas, Monaco, "Courier New", monospace;
}
</style>
