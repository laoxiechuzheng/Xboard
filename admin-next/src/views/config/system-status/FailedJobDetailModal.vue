<script setup lang="ts">
// Failed Horizon job detail (spec core §7.5); failed_at is formatted here too (official shows the raw value).
import { computed } from 'vue'
import { NModal, NButton, NDescriptions, NDescriptionsItem } from 'naive-ui'
import type { FailedJob } from '@/api/system'
import CopyText from '@/components/CopyText.vue'
import { appState } from '@/stores/app'
import CodeBlock from './CodeBlock.vue'
import { formatFailedAt, prettyJson } from './helpers'

const props = defineProps<{ show: boolean; job: FailedJob | null }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const payload = computed(() => prettyJson(props.job?.payload))
const context = computed(() => {
  const c = props.job?.context
  if (c === null || c === undefined || c === '' || c === 'null' || c === '[]' || c === '{}') return ''
  return prettyJson(c)
})
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="任务详细信息"
    :style="{ width: 'min(880px, calc(100vw - 32px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template v-if="job">
      <n-descriptions :column="appState.isMobile ? 1 : 2" label-placement="top" size="small" class="desc">
        <n-descriptions-item label="作业ID">
          <copy-text :text="String(job.id ?? '')" mono />
        </n-descriptions-item>
        <n-descriptions-item label="时间">
          <span class="mono-num">{{ formatFailedAt(job.failed_at) }}</span>
          <span class="muted raw">（{{ job.failed_at }}）</span>
        </n-descriptions-item>
        <n-descriptions-item label="队列">
          <span class="mono">{{ job.queue || '—' }}</span>
        </n-descriptions-item>
        <n-descriptions-item label="连接类型">
          <span class="mono">{{ job.connection || '—' }}</span>
        </n-descriptions-item>
        <n-descriptions-item label="任务名称" :span="appState.isMobile ? 1 : 2">
          <span class="mono name">{{ job.name || '—' }}</span>
        </n-descriptions-item>
      </n-descriptions>

      <code-block title="异常信息" :code="job.exception || ''" tone="error" max-height="260px" class="block" />
      <code-block title="任务数据" :code="payload" max-height="260px" class="block" />
      <code-block v-if="context" title="异常上下文" :code="context" max-height="200px" class="block" />
    </template>
    <template #footer>
      <div class="footer">
        <n-button @click="emit('update:show', false)">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.desc {
  margin-bottom: 4px;
}
.mono-num {
  font-variant-numeric: tabular-nums;
}
.raw {
  font-size: 12px;
  font-family: var(--font-mono);
}
.name {
  word-break: break-all;
}
.block {
  margin-top: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
}
</style>
