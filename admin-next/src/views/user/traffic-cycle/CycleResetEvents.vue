<script setup lang="ts">
// 重置记录 inside the cycle drawer: log ID, time, reason, cleared amount and changes; each row folds out the full
// details with the raw metadata. Noise rows are faded and tagged.
import { ref } from 'vue'
import { NIcon } from 'naive-ui'
import { ChevronDownOutline } from '@vicons/ionicons5'
import { formatBytes } from '@/utils/format'
import { shortTime } from '../login-log/meta'
import type { ResetLogView } from '../traffic-reset/normalize'
import ResetReasonCell from '../traffic-reset/ResetReasonCell.vue'
import ResetChangeCell from '../traffic-reset/ResetChangeCell.vue'
import ResetLogDetail from '../traffic-reset/ResetLogDetail.vue'

defineProps<{ items: ResetLogView[] }>()

const open = ref<Set<number>>(new Set())
function toggle(id: number) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}
</script>

<template>
  <ul class="events">
    <li v-for="e in items" :key="e.id" class="ev" :class="{ noise: e.noise, open: open.has(e.id) }">
      <button type="button" class="ev-main" :aria-expanded="open.has(e.id)" @click="toggle(e.id)">
        <span class="ev-id">#{{ e.id }}</span>
        <span class="ev-time">{{ shortTime(e.at) }}</span>
        <reset-reason-cell :log="e" compact class="ev-reason" />
        <span class="ev-cleared" :class="{ zero: !e.cleared }">清零 {{ formatBytes(e.cleared) }}</span>
        <n-icon class="ev-chevron" :size="14"><chevron-down-outline /></n-icon>
      </button>
      <div v-if="e.quotaBefore !== null || e.expiredBefore !== null || e.note" class="ev-sub">
        <span v-if="e.quotaBefore !== null || e.quotaAfter !== null" class="ev-chg">
          <span class="k">额度</span>
          <reset-change-cell kind="quota" :before="e.quotaBefore" :after="e.quotaAfter" />
        </span>
        <span v-if="e.expiredBefore !== null || e.expiredAfter !== null" class="ev-chg">
          <span class="k">到期</span>
          <reset-change-cell kind="expiry" :before="e.expiredBefore" :after="e.expiredAfter" :shift="e.shift" />
        </span>
        <span v-if="e.note" class="ev-note">备注：{{ e.note }}</span>
      </div>
      <div v-if="open.has(e.id)" class="ev-detail">
        <reset-log-detail :log="e" compact />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.events {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ev {
  padding: 8px 10px;
  border: 1px solid var(--divider-color);
  border-radius: 10px;
}
.ev.noise {
  opacity: 0.6;
  border-style: dashed;
}
.ev.open {
  border-color: var(--border-color);
}
.ev-main {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 4px 10px;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.ev-id {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}
.ev-time {
  font-size: 12.5px;
  color: var(--text-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ev-cleared {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ev-cleared.zero {
  font-weight: 400;
  color: var(--text-muted);
}
.ev-chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
}
.ev.open .ev-chevron {
  transform: rotate(180deg);
}
.ev-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  margin-top: 6px;
  padding-left: 2px;
  font-size: 12.5px;
}
.ev-chg {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.k {
  font-size: 12px;
  color: var(--text-muted);
}
.ev-note {
  color: var(--text-color);
  word-break: break-word;
}
.ev-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--divider-color);
}
@media (max-width: 520px) {
  .ev-main {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
  }
  .ev-reason {
    grid-column: 1 / -1;
    order: 5;
  }
  .ev-cleared {
    grid-column: 3;
    justify-self: end;
  }
}
</style>
