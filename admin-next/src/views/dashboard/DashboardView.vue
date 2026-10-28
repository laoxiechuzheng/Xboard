<script setup lang="ts">
// Dashboard (spec core §7): stat cards, revenue overview, traffic ranks, queue status.
// Each block fetches and auto-refreshes on its own; the header button refreshes all of them.
import { computed, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import PageContainer from '@/components/PageContainer.vue'
import StatCards from './components/StatCards.vue'
import RevenueOverview from './components/RevenueOverview.vue'
import TrafficRankCard from './components/TrafficRankCard.vue'
import QueueOverview from './components/QueueOverview.vue'
import { clockTime } from './composables'

interface Refreshable {
  refresh: () => Promise<unknown>
  loading: boolean
  /** Date.now() of the block's last successful load (manual or polled); 0 before the first one. */
  lastSuccess: number
  hasError: boolean
}

const statsRef = ref<Refreshable | null>(null)
const revenueRef = ref<Refreshable | null>(null)
const nodeRankRef = ref<Refreshable | null>(null)
const userRankRef = ref<Refreshable | null>(null)
const queueRef = ref<Refreshable | null>(null)

const blocks = computed(() => [statsRef.value, revenueRef.value, nodeRankRef.value, userRankRef.value, queueRef.value])
const refreshing = ref(false)
// Follows every block's own polling, not only the header button.
const updatedAt = computed(() => {
  const last = Math.max(0, ...blocks.value.map((b) => b?.lastSuccess ?? 0))
  return last ? clockTime(new Date(last)) : ''
})
const anyError = computed(() => blocks.value.some((b) => b?.hasError))

async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all(blocks.value.map((b) => b?.refresh()))
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <page-container title="仪表盘" description="站点收入、用户、流量与队列运行概览">
    <template #extra>
      <span class="updated" title="各区块独立自动刷新：统计卡片每 5 分钟，其余每 30 秒；这里显示最近一次成功获取数据的时间">
        {{ updatedAt ? `更新于 ${updatedAt}` : '加载中' }}
        <span v-if="anyError" class="warn">· 部分区块刷新失败</span>
      </span>
      <n-button size="small" :loading="refreshing" @click="refreshAll">
        <template #icon>
          <n-icon><refresh-outline /></n-icon>
        </template>
        刷新
      </n-button>
    </template>

    <stat-cards ref="statsRef" />
    <revenue-overview ref="revenueRef" />
    <div class="rank-grid">
      <traffic-rank-card ref="nodeRankRef" type="node" />
      <traffic-rank-card ref="userRankRef" type="user" />
    </div>
    <queue-overview ref="queueRef" />
  </page-container>
</template>

<style scoped>
.updated {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.warn {
  color: var(--warning-color);
}
.rank-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 900px) {
  .rank-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
