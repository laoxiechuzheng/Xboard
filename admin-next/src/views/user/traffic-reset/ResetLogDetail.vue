<script setup lang="ts">
// Expanded reset log row: every field in full plus the raw metadata (text only, never v-html).
import { computed } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import { copyText } from '@/utils/clipboard'
import { formatBytes, formatTime } from '@/utils/format'
import { NOISE_META, carriedText, durationText, reasonMeta, sourceLabel } from '../traffic-cycle/meta'
import type { ResetLogView } from './normalize'

const props = withDefaults(defineProps<{ log: ResetLogView; compact?: boolean }>(), { compact: false })

const reasonText = computed(() => {
  const l = props.log
  const m = reasonMeta(l.reason)
  if (l.noise) return `${NOISE_META.desc}。原因：${m.label}`
  return l.inferred ? `${m.desc}（旧记录没有原因，按触发来源推断）` : m.desc
})
const clearedText = computed(() => {
  const l = props.log
  const parts = [formatBytes(l.cleared)]
  if (l.clearedUpload !== null || l.clearedDownload !== null) {
    parts.push(`上行 ${formatBytes(l.clearedUpload)} · 下行 ${formatBytes(l.clearedDownload)}`)
  }
  if (l.carried > 0) parts.push(carriedText(l.carried))
  return parts.join('，')
})
const pair = (a: string, b: string) => (a === b ? a : `${a} → ${b}`)
const quotaText = computed(() => {
  const { quotaBefore: a, quotaAfter: b } = props.log
  if (a === null && b === null) return '—'
  return pair(a === null ? '未记录' : formatBytes(a), b === null ? '未记录' : formatBytes(b))
})
const expiryText = computed(() => {
  const { expiredBefore: a, expiredAfter: b, shift } = props.log
  if (a === null && b === null) return '—'
  const base = pair(a === null ? '未记录' : formatTime(a), b === null ? '未记录' : formatTime(b))
  return shift ? `${base}（提前 ${durationText(shift)}）` : base
})
const links = computed(() => {
  const l = props.log
  return [l.cycleId && `周期 #${l.cycleId}`, l.orderId && `订单 #${l.orderId}`, l.adminId && `管理员 #${l.adminId}`]
    .filter(Boolean)
    .join(' · ')
})
const metaJson = computed(() => (props.log.metadata ? JSON.stringify(props.log.metadata, null, 2) : ''))
</script>

<template>
  <div class="detail" :class="{ compact }">
    <dl class="facts">
      <div class="fact wide">
        <dt>原因说明</dt>
        <dd>{{ reasonText }}</dd>
      </div>
      <div class="fact">
        <dt>清零</dt>
        <dd class="num">{{ clearedText }}</dd>
      </div>
      <div class="fact">
        <dt>触发来源</dt>
        <dd>{{ sourceLabel(log.source, log.sourceName) }} <span class="code">{{ log.source }}</span></dd>
      </div>
      <div class="fact">
        <dt>额度</dt>
        <dd class="num">{{ quotaText }}</dd>
      </div>
      <div class="fact">
        <dt>到期时间</dt>
        <dd class="num">{{ expiryText }}</dd>
      </div>
      <div class="fact">
        <dt>重置时间</dt>
        <dd class="num">{{ formatTime(log.at) }}</dd>
      </div>
      <div v-if="log.createdAt && log.createdAt !== log.at" class="fact">
        <dt>写入时间</dt>
        <dd class="num">{{ formatTime(log.createdAt) }}</dd>
      </div>
      <div class="fact">
        <dt>关联</dt>
        <dd class="num">{{ links || '—' }}</dd>
      </div>
      <div v-if="log.typeName" class="fact">
        <dt>旧字段“重置类型”</dt>
        <dd>{{ log.typeName }}</dd>
      </div>
      <div class="fact">
        <dt>记录</dt>
        <dd class="num">#{{ log.id }} · 用户 ID {{ log.userId }}</dd>
      </div>
      <div v-if="log.note" class="fact wide">
        <dt>备注</dt>
        <dd class="pre">{{ log.note }}</dd>
      </div>
    </dl>
    <div class="raw">
      <div class="raw-head">
        <span class="label">原始 metadata</span>
        <n-button v-if="metaJson" text size="tiny" class="copy" @click.stop="copyText(metaJson)">
          <template #icon><n-icon><copy-outline /></n-icon></template>
          复制
        </n-button>
      </div>
      <pre v-if="metaJson" class="json">{{ metaJson }}</pre>
      <div v-else class="json empty">无（旧记录没有 metadata）</div>
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
  min-width: 0;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px 20px;
  margin: 0;
}
.compact .facts {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}
.fact {
  min-width: 0;
}
.fact.wide {
  grid-column: 1 / -1;
}
dt,
.label {
  font-size: 12px;
  color: var(--text-muted);
}
dd {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-strong);
  word-break: break-word;
}
.num {
  font-variant-numeric: tabular-nums;
}
.pre {
  white-space: pre-wrap;
}
.code {
  margin-left: 4px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-muted);
}
.raw {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--divider-color);
  background: var(--code-bg);
}
.raw-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.copy {
  font-size: 12px;
}
.json {
  margin: 0;
  max-height: 260px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-all;
}
.json.empty {
  font-family: inherit;
  color: var(--text-muted);
}
</style>
