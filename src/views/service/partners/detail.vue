<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getPartnerById } from "./data";
import BackIcon from "~icons/ri/arrow-left-line";
import EditIcon from "~icons/ri/edit-line";

/** 组件 name 必须与路由 name 一致，否则标签页缓存（keepAlive）失效 */
defineOptions({ name: "ServicePartnerDetail" });

const route = useRoute();
const router = useRouter();

const detail = computed(() => getPartnerById(route.params.id as string));

const statusText = computed(() =>
  detail.value?.status === 1 ? "启用" : "停用"
);

function goBack() {
  router.push("/service/partners");
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
        <el-button link type="primary" :icon="EditIcon" @click="goBack">
          返回列表编辑
        </el-button>
      </div>
    </el-card>

    <el-card v-if="detail" shadow="never" class="mt-4">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">
          {{ detail.name }}
        </el-descriptions-item>
        <el-descriptions-item label="编码">
          {{ detail.code }}
        </el-descriptions-item>
        <el-descriptions-item label="联系人">
          {{ detail.contact }}
        </el-descriptions-item>
        <el-descriptions-item label="联系电话">
          {{ detail.phone }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="detail.status === 1 ? 'success' : 'info'">
            {{ statusText }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ detail.createTime }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-else shadow="never" class="mt-4">
      <el-empty description="未找到该合作方，可能已被删除" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.main {
  padding: 16px;
}
</style>
