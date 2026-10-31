<script setup lang="ts">
// Mobile card for one reset log row (same fields as the table; details fold out below).
import { computed, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { ChevronDownOutline } from '@vicons/ionicons5'
import { formatBytes } from '@/utils/format'
import { reasonMeta } from '../traffic-cycle/meta'
import { shortTime } from '../login-log/meta'
import type { ResetLogView } from './normalize'
import ResetReasonCell from './ResetReasonCell.vue'
import ResetChangeCell from './ResetChangeCell.vue'
import ResetLinksCell from './ResetLinksCell.vue'
import ResetLogDetail from './ResetLogDetail.vue'

const props = withDefaults(defineProps<{ log: ResetLogView; showUser?: boolean }>(), { showUser: true })
const emit = defineEmits<{ 'open-user': [ResetLogView]; 'open-cycle': [ResetLogView] }>()

const open = ref(false)
const tone = computed(() => (props.log.noise ? 'neutral' : reasonMeta(props.log.reason).tone))
const hasQuota = computed(() => props.log.quotaBefore !== null || props.log.quotaAfter !== null)
const hasExpiry = computed(() => props.log.expiredBefore !== null || props.log.expiredAfter !== null)
const hasLinks = computed(() => !!(props.log.cycleId || props.log.orderId || props.log.adminId || props.log.note))
</script>

<template>
  <article class="rcard" :class="[`tone-${tone}`, { noise: log.noise }]">
    <header class="rhead">
      <reset-reason-cell :log="log" compact class="rreason" />
      <div class="rtime">
        <div class="abs">{{ shortTime(log.at) }}</div>
        <div class="id">#{{ log.id }}</div>
      </div>
    </header>
    <button v-if="showUser" type="button" class="ruser" @click="emit('open-user', log)">
      <span class="email" :class="{ gone: !log.email }">{{ log.email || '用户已删除' }}</span>
      <span class="uid">ID {{ log.userId }}</span>
    </button>
    <div class="rgrid">
      <div class="cell">
        <span class="k">清零</span>
        <span class="cleared" :class="{ zero: !log.cleared }">{{ formatBytes(log.cleared) }}</span>
      </div>
      <div v-if="hasQuota" class="cell">
        <span class="k">额度</span>
        <reset-change-cell kind="quota" :before="log.quotaBefore" :after="log.quotaAfter" />
      </div>
      <div v-if="hasExpiry" class="cell">
        <span class="k">到期</span>
        <reset-change-cell kind="expiry" :before="log.expiredBefore" :after="log.expiredAfter" :shift="log.shift" />
      </div>
      <div v-if="hasLinks" class="cell">
        <span class="k">关联</span>
        <reset-links-cell :log="log" cycle-clickable @open-cycle="(l: ResetLogView) => emit('open-cycle', l)" />
      </div>
    </div>
    <n-button text size="small" icon-placement="right" class="rtoggle" :class="{ open }" @click="open = !open">
      {{ open ? '收起详情' : '详情与原始数据' }}
      <template #icon><n-icon><chevron-down-outline /></n-icon></template>
    </n-button>
    <div v-if="open" class="rdetail">
      <reset-log-detail :log="log" compact />
    </div>
  </article>
</template>

<style scoped>
.rcard {
  --tone: var(--text-muted);
  position: relative;
  padding: 12px 12px 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
  overflow: hidden;
}
.rcard::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: color-mix(in srgb, var(--tone) 70%, transparent);
}
.tone-primary {
  --tone: var(--primary-color);
}
.tone-success {
  --tone: var(--success-color);
}
.tone-info {
  --tone: var(--info-color);
}
.tone-warning {
  --tone: var(--warning-color);
}
.rcard.noise {
  opacity: 0.6;
  border-style: dashed;
}
.rhead {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.rreason {
  flex: 1;
}
.rtime {
  flex: none;
  text-align: right;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}
.abs {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-strong);
}
.id {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-muted);
}
.ruser {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ruser .email {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-strong);
}
.ruser:hover .email {
  color: var(--primary-color);
}
.ruser .email.gone {
  font-weight: 400;
  color: var(--text-muted);
}
.uid {
  flex: none;
  font-size: 12px;
  color: var(--text-muted);
}
.rgrid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--divider-color);
}
.cell {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.k {
  font-size: 12px;
  color: var(--text-muted);
}
.cleared {
  font-weight: 600;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.cleared.zero {
  font-weight: 400;
  color: var(--text-muted);
}
.rtoggle {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.rtoggle :deep(.n-icon) {
  transition: transform 0.2s;
}
.rtoggle.open :deep(.n-icon) {
  transform: rotate(180deg);
}
.rdetail {
  margin-top: 8px;
}
</style>
