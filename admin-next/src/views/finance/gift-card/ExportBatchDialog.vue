<script setup lang="ts">
// Export codes: one batch as TXT via GET /gift-card/export-codes (backend, one code per line), or
// the current list filters as CSV (built on the client from /gift-card/codes pages).
import { computed, ref, watch } from 'vue'
import { NAlert, NButton, NForm, NFormItem, NInput, NModal, NRadio, NRadioGroup } from 'naive-ui'
import { fetchAllCodes, giftCardTypeLabel, type CodeQuery } from '@/api/giftCard'
import { saveFile } from '@/utils/clipboard'
import { message } from '@/utils/discrete'
import { formatTime } from '@/utils/format'
import { codeStatusView, csvCell, downloadBatch, fileStamp } from './helpers'

const props = defineProps<{
  show: boolean
  /** Current list filters. */
  filters: Omit<CodeQuery, 'page' | 'per_page'>
  /** Human readable summary of `filters` ('' = no filter). */
  filterText: string
}>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const CSV_LIMIT = 20000

const mode = ref<'batch' | 'csv'>('batch')
const batchId = ref('')
const submitting = ref(false)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    batchId.value = props.filters.batch_id ?? ''
    mode.value = 'batch'
  },
)

const canSubmit = computed(() => (mode.value === 'batch' ? !!batchId.value.trim() : true))

async function exportCsv(): Promise<boolean> {
  const { rows, total } = await fetchAllCodes(props.filters, CSV_LIMIT)
  if (!rows.length) {
    message.warning('没有可导出的兑换码')
    return false
  }
  const head = ['兑换码', '模板ID', '模板名称', '模板类型', '批次号', '状态', '已用次数', '最大使用次数', '过期时间', '使用者ID', '使用者邮箱', '使用时间', '创建时间']
  const lines = [head.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.code,
        r.template_id,
        r.template?.name ?? '',
        r.template ? giftCardTypeLabel(r.template.type) : '',
        r.batch_id ?? '',
        // Same wording as the list: codes past expires_at keep status 0 in the database.
        codeStatusView(r).fullLabel,
        r.usage_count ?? 0,
        r.max_usage ?? 1,
        r.expires_at ? formatTime(r.expires_at) : '长期有效',
        r.user_id ?? '',
        r.user?.email ?? '',
        r.used_at ? formatTime(r.used_at) : '',
        formatTime(r.created_at),
      ]
        .map(csvCell)
        .join(','),
    )
  }
  saveFile('﻿' + lines.join('\r\n'), `gift_codes_${fileStamp()}.csv`, 'text/csv;charset=utf-8')
  if (total > rows.length) message.warning(`共 ${total} 个兑换码，仅导出了前 ${rows.length} 个`)
  else message.success(`导出成功，共 ${rows.length} 个兑换码`)
  return true
}

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const ok = mode.value === 'batch' ? await downloadBatch(batchId.value.trim()) : await exportCsv()
    if (ok) emit('update:show', false)
  } catch {
    /* toast handled by http client */
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="导出兑换码"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <n-radio-group v-model:value="mode" class="modes" name="export-mode">
      <div class="mode" :class="{ active: mode === 'batch' }" @click="mode = 'batch'">
        <n-radio value="batch" />
        <span class="mode-text">
          <span class="mode-title">按批次导出（TXT）</span>
          <span class="mode-desc">导出一个批次的全部兑换码，每行一个，适合直接分发。</span>
        </span>
      </div>
      <div class="mode" :class="{ active: mode === 'csv' }" @click="mode = 'csv'">
        <n-radio value="csv" />
        <span class="mode-text">
          <span class="mode-title">导出当前筛选结果（CSV）</span>
          <span class="mode-desc">
            {{ filterText ? `筛选条件：${filterText}` : '当前未设置筛选，将导出全部兑换码' }}；包含状态、使用情况等明细，最多 {{ CSV_LIMIT }} 个。
          </span>
        </span>
      </div>
    </n-radio-group>

    <!-- Enter submits through the form's implicit submission (single text field); no extra key handler. -->
    <n-form v-if="mode === 'batch'" label-placement="top" :show-feedback="false" class="batch-form" @submit.prevent="submit">
      <n-form-item label="批次号" required>
        <n-input v-model:value="batchId" placeholder="例如 batch_6720f1c2a9b3e" clearable class="mono-input" />
      </n-form-item>
      <p class="muted hint">批次号可在兑换码列表的“批次号”列中查看，点击批次号可只看该批次。</p>
    </n-form>
    <n-alert v-else-if="!filterText" type="info" :show-icon="false" class="csv-tip">
      兑换码较多时导出需要逐页拉取，可能需要几秒钟。
    </n-alert>

    <template #footer>
      <div class="footer">
        <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">导出</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.mode {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}
.mode:hover {
  background: var(--hover-color);
}
.mode.active {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 7%, transparent);
}
.mode :deep(.n-radio) {
  margin-top: 2px;
}
.mode-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mode-title {
  font-size: 13px;
  font-weight: 500;
}
.mode-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.batch-form {
  margin-top: 14px;
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
}
.csv-tip {
  margin-top: 12px;
  font-size: 12px;
}
.mono-input :deep(input) {
  font-family: var(--font-mono);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
