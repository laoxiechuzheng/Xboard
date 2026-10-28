<script setup lang="ts">
// Queue status + job details cards (spec core §7.5), refreshed every 30s.
// Fixes vs official: minute-based periods, wait read from the "connection:queue" key,
// queueWithMax* shown as queue names, no meaningless progress bars.
import { computed, ref } from 'vue'
import { NCard, NButton, NIcon, NTag, NSpin, NTooltip } from 'naive-ui'
import {
  TimerOutline,
  HardwareChipOutline,
  RefreshOutline,
  CheckmarkCircle,
  AlertCircle,
  EyeOutline,
  ChevronForwardOutline,
} from '@vicons/ionicons5'
import { getQueueStats, getSystemStatus, formatMinutes, longestWait } from '@/api/system'
import { formatNumber } from '@/utils/format'
import FailedJobsModal from '@/views/config/system-status/FailedJobsModal.vue'
import { sinceText, useAsyncState, usePolling } from '../composables'

const stats = useAsyncState(() => getQueueStats({ silent: true }))
const sys = useAsyncState(() => getSystemStatus({ silent: true }))
const refresh = usePolling(() => Promise.all([stats.run(), sys.run()]), 30_000)
const loading = computed(() => stats.loading.value || sys.loading.value)
const lastSuccess = computed(() => Math.max(stats.lastSuccess.value, sys.lastSuccess.value))
/** Error of a refresh while older data is still shown. */
const staleError = computed(() => (stats.data.value ? stats.error.value || sys.error.value : ''))
const hasError = computed(() => !!stats.error.value || !!sys.error.value)
defineExpose({ refresh, loading, lastSuccess, hasError })

const failedOpen = ref(false)

const s = computed(() => stats.data.value)
const wait = computed(() => (s.value ? longestWait(s.value.wait) : { seconds: 0, queue: null }))
const failedPeriod = computed(() => formatMinutes(s.value?.periods.failedJobs ?? 0))
const recentPeriod = computed(() => formatMinutes(s.value?.periods.recentJobs ?? 0))
</script>

<template>
  <div class="queue-grid">
    <!-- Card A: queue status -->
    <n-card>
      <template #header>
        <div class="card-title">
          <n-icon :size="18" class="title-icon"><timer-outline /></n-icon>
          队列状态
        </div>
        <div class="card-sub">当前队列运行状态</div>
      </template>
      <template #header-extra>
        <n-tooltip>
          <template #trigger>
            <n-button quaternary circle size="small" :disabled="loading" aria-label="刷新" @click="refresh">
              <template #icon>
                <n-icon :class="{ spinning: loading }"><refresh-outline /></n-icon>
              </template>
            </n-button>
          </template>
          刷新
        </n-tooltip>
      </template>

      <div v-if="!s && stats.error.value" class="state error">
        <span>队列状态加载失败：{{ stats.error.value }}</span>
        <a class="retry" @click="refresh">点击重试</a>
      </div>
      <n-spin v-else-if="!s" class="state" />
      <div v-else class="body">
        <div class="status-block">
          <div class="status-row">
            <span class="status-label">
              <n-icon :size="18" :class="s.status ? 'ok' : 'bad'">
                <checkmark-circle v-if="s.status" />
                <alert-circle v-else />
              </n-icon>
              运行状态
            </span>
            <n-tag :type="s.status ? 'success' : 'error'" size="small" round :bordered="false">
              {{ s.status ? '正常' : '异常' }}
            </n-tag>
          </div>
          <div class="status-meta">
            当前等待时间：<b class="num">{{ wait.seconds }}</b> 秒
            <span v-if="wait.queue" class="muted">（最长等待队列 {{ wait.queue }}）</span>
          </div>
          <div v-if="sys.data.value" class="status-meta">
            计划任务：
            <span :class="sys.data.value.schedule ? 'ok' : 'bad'">{{ sys.data.value.schedule ? '运行中' : '未运行' }}</span>
            <span class="muted">
              （最近一次
              {{ sys.data.value.schedule_last_runtime ? sinceText(sys.data.value.schedule_last_runtime) : '从未运行' }}）
            </span>
          </div>
        </div>
        <div class="cells">
          <div class="cell">
            <div class="cell-label">近期任务数</div>
            <div class="cell-value">{{ formatNumber(s.recentJobs) }}</div>
            <div class="cell-meta">统计时间范围：最近 {{ recentPeriod }}</div>
          </div>
          <div class="cell">
            <div class="cell-label">每分钟处理量</div>
            <div class="cell-value">{{ formatNumber(s.jobsPerMinute) }}</div>
            <div class="cell-meta">吞吐量最高队列：{{ s.queueWithMaxThroughput || '—' }}</div>
          </div>
        </div>
        <div v-if="staleError" class="stale">
          <n-tag size="small" type="warning" :bordered="false">刷新失败：{{ staleError }}</n-tag>
        </div>
      </div>
    </n-card>

    <!-- Card B: job details -->
    <n-card>
      <template #header>
        <div class="card-title">
          <n-icon :size="18" class="title-icon"><hardware-chip-outline /></n-icon>
          作业详情
        </div>
        <div class="card-sub">队列处理详细信息</div>
      </template>
      <template #header-extra>
        <router-link to="/config/system-status" class="more">
          系统状态
          <n-icon :size="14"><chevron-forward-outline /></n-icon>
        </router-link>
      </template>

      <div v-if="!s && stats.error.value" class="state error">
        <span>作业详情加载失败：{{ stats.error.value }}</span>
        <a class="retry" @click="refresh">点击重试</a>
      </div>
      <n-spin v-else-if="!s" class="state" />
      <div v-else class="body">
        <div class="cells">
          <div class="cell">
            <div class="cell-label">{{ failedPeriod }}内报错数量</div>
            <button type="button" class="failed-link" title="查看报错详情" @click="failedOpen = true">
              <span class="cell-value danger">{{ formatNumber(s.failedJobs) }}</span>
              <n-icon :size="16"><eye-outline /></n-icon>
            </button>
            <div class="cell-meta">保留 {{ failedPeriod }}</div>
          </div>
          <div class="cell">
            <div class="cell-label">最长运行队列</div>
            <div class="cell-value queue-name" :title="s.queueWithMaxRuntime || ''">{{ s.queueWithMaxRuntime || '—' }}</div>
            <div class="cell-meta">近期运行耗时最长的队列</div>
          </div>
        </div>
        <div class="cell wide">
          <div class="cell-row">
            <span class="cell-label">活跃进程</span>
            <span class="cell-value small">{{ formatNumber(s.processes) }}</span>
          </div>
          <div class="cell-meta">
            <template v-if="s.pausedMasters > 0">
              <n-tag type="warning" size="small" :bordered="false">{{ s.pausedMasters }} 个主进程已暂停</n-tag>
            </template>
            <template v-else>所有 Horizon 主进程运行中，无暂停</template>
          </div>
        </div>
        <div v-if="staleError" class="stale">
          <n-tag size="small" type="warning" :bordered="false">刷新失败：{{ staleError }}</n-tag>
        </div>
      </div>
    </n-card>

    <failed-jobs-modal v-model:show="failedOpen" />
  </div>
</template>

<style scoped>
.queue-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 900px) {
  .queue-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.title-icon {
  color: var(--primary-color);
}
.card-sub {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}
.more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: var(--primary-color);
  text-decoration: none;
}
.state {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
}
.state.error {
  color: var(--error-color);
}
.retry {
  color: var(--primary-color);
  cursor: pointer;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status-block,
.cell {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--hover-color);
  min-width: 0;
}
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.status-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.status-meta {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-color);
}
.ok {
  color: var(--success-color);
}
.bad {
  color: var(--error-color);
}
.num {
  font-variant-numeric: tabular-nums;
}
.cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.cell-label {
  font-size: 13px;
  color: var(--text-muted);
}
.cell-value {
  margin-top: 4px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.cell-value.small {
  margin-top: 0;
  font-size: 18px;
}
.cell-value.danger {
  color: var(--error-color);
}
.cell-value.queue-name {
  font-size: 18px;
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.cell-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.failed-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--error-color);
  cursor: pointer;
  font: inherit;
}
.failed-link .cell-value {
  margin-top: 0;
}
.failed-link:hover .cell-value {
  text-decoration: underline;
}
.stale :deep(.n-tag) {
  max-width: 100%;
}
.stale :deep(.n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 420px) {
  .cells {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
