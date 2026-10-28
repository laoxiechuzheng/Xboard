<script setup lang="ts">
// Audit record detail: metadata + pretty-printed request body with copy.
import { computed } from 'vue'
import { NModal, NButton, NDescriptions, NDescriptionsItem, NTag } from 'naive-ui'
import { stripAdminPrefix, type AuditLog } from '@/api/system'
import { formatTime } from '@/utils/format'
import { appState } from '@/stores/app'
import CopyText from '@/components/CopyText.vue'
import CodeBlock from '../system-status/CodeBlock.vue'
import { prettyJson } from '../system-status/helpers'
import { auditActionLabel } from './actions'

const props = defineProps<{ show: boolean; log: AuditLog | null }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const body = computed(() => prettyJson(props.log?.request_data ?? ''))
const path = computed(() => stripAdminPrefix(props.log?.uri ?? ''))
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="审计记录详情"
    :style="{ width: 'min(820px, calc(100vw - 32px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template v-if="log">
      <n-descriptions :column="appState.isMobile ? 1 : 2" label-placement="top" size="small">
        <n-descriptions-item label="记录 ID">
          <span class="mono">#{{ log.id }}</span>
        </n-descriptions-item>
        <n-descriptions-item label="时间">
          <span class="tnum">{{ formatTime(log.created_at) }}</span>
        </n-descriptions-item>
        <n-descriptions-item label="管理员">
          <template v-if="log.admin">{{ log.admin.email }}</template>
          <span v-else class="muted">#{{ log.admin_id }}（已删除）</span>
          <span class="muted mono small">（ID {{ log.admin_id }}）</span>
        </n-descriptions-item>
        <n-descriptions-item label="IP">
          <span class="mono">{{ log.ip || '—' }}</span>
        </n-descriptions-item>
        <n-descriptions-item label="操作">
          {{ auditActionLabel(log.action) || log.action }}
          <div class="mono small muted">{{ log.action }}</div>
        </n-descriptions-item>
        <n-descriptions-item label="请求" :span="appState.isMobile ? 1 : 2">
          <div class="request-line">
            <n-tag size="small" :bordered="false">{{ log.method }}</n-tag>
            <copy-text :text="path" mono />
          </div>
        </n-descriptions-item>
      </n-descriptions>
      <code-block title="请求数据" :code="body" max-height="360px" class="block" />
      <div class="hint">仅过滤了请求体顶层的 password / token / secret / key / api_key 字段，嵌套配置中的密钥可能以明文出现，请勿外传。</div>
    </template>
    <template #footer>
      <div class="footer">
        <n-button @click="emit('update:show', false)">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.tnum {
  font-variant-numeric: tabular-nums;
}
.small {
  font-size: 12px;
}
.request-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.block {
  margin-top: 12px;
}
.hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--warning-color);
}
.footer {
  display: flex;
  justify-content: flex-end;
}
</style>
