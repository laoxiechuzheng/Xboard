<script setup lang="ts">
// Current cycle card: kind, quota and usage, start → end with a "now" marker, what the next cycle gets, the
// admin note and the cycle's own events. `preview` renders a cycle computed by user/trafficCycle/preview.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { NTooltip } from 'naive-ui'
import type { CycleEvent, TrafficCycle } from '@/api/trafficCycle'
import { formatBytes, formatRemaining, formatTime } from '@/utils/format'
import { shortTime } from '../login-log/meta'
import CyclePill from './CyclePill.vue'
import {
  cycleUsed,
  eventByText,
  eventDetail,
  eventTypeLabel,
  kindMeta,
  startReasonDesc,
  startReasonLabel,
} from './meta'

const props = withDefaults(
  defineProps<{
    cycle: TrafficCycle
    /** Server time (unix seconds) the cycle was computed at. */
    now: number
    /** Plan standard quota in bytes, to label "（套餐标准）". */
    planQuota?: number | null
    planName?: (id: unknown) => string
    highlight?: boolean
    preview?: boolean
  }>(),
  { planQuota: null, planName: undefined, highlight: false, preview: false },
)

const kind = computed(() => kindMeta(props.cycle.kind))
const quota = computed(() => Number(props.cycle.quota) || 0)
const used = computed(() => cycleUsed(props.cycle))
const remaining = computed(() => {
  const r = props.cycle.remaining
  return r !== null && r !== undefined ? Math.max(0, Number(r)) : Math.max(0, quota.value - used.value)
})
const pct = computed(() => (quota.value > 0 ? (used.value / quota.value) * 100 : used.value > 0 ? null : 0))
const pctText = computed(() => (pct.value === null ? '额度为 0' : `${pct.value.toFixed(1)}%`))
const over = computed(() => pct.value === null || pct.value >= 100)

const ends = computed(() => props.cycle.ends_at)
const span = computed(() => (ends.value ? ends.value - props.cycle.started_at : 0))
const elapsedPct = computed(() => {
  if (!ends.value || span.value <= 0) return null
  return Math.min(100, Math.max(0, ((props.now - props.cycle.started_at) / span.value) * 100))
})
const endCaption = computed(() => {
  if (!ends.value) return props.cycle.is_final ? '不排期，长期有效' : '不排期'
  const left = ends.value - props.now
  if (left <= 0) return props.cycle.is_final ? '已到期' : '已到重置时间，等待定时任务'
  return props.cycle.is_final ? `还剩 ${formatRemaining(left)}，到期后不再重置` : `${formatRemaining(left)}后重置`
})

const nextQuota = computed(() => {
  const n = props.cycle.next_quota
  return n === null || n === undefined ? quota.value : Number(n)
})
const nextLabel = computed(() => {
  const std = props.planQuota !== null && props.planQuota !== undefined && nextQuota.value === props.planQuota
  return `${formatBytes(nextQuota.value)}${std ? '（套餐标准）' : ''}`
})

const events = computed<CycleEvent[]>(() =>
  [...(props.cycle.events ?? [])].sort((a, b) => Number(b.at) - Number(a.at)),
)
</script>

<template>
  <div class="cc" :class="{ highlight, preview }">
    <div class="cc-head">
      <cycle-pill :label="kind.label" :tone="kind.tone" :title="kind.hint" />
      <cycle-pill v-if="cycle.is_final" label="至到期" tone="info" title="本周期结束即订阅到期，不会再重置" />
      <span class="cc-title">
        <template v-if="preview">改后的本周期</template>
        <template v-else>第 {{ cycle.seq ?? '?' }} 个周期</template>
        <span class="dot">·</span>
        <span :title="startReasonDesc(cycle.start_reason)">{{ startReasonLabel(cycle.start_reason) }}</span>
      </span>
      <span class="grow" />
      <span v-if="cycle.id" class="cc-id">周期 #{{ cycle.id }}</span>
    </div>

    <div class="cc-quota">
      <div>
        <div class="big num">{{ formatBytes(quota) }}</div>
        <div class="sub">本周期额度<template v-if="cycle.plan_name"> · {{ cycle.plan_name }}</template></div>
      </div>
      <div class="usage num">
        已用 <b>{{ formatBytes(used) }}</b> · 剩余 <b>{{ formatBytes(remaining) }}</b>
        <div class="sub" :class="{ danger: over }">{{ pctText }}</div>
      </div>
    </div>
    <div class="bar"><div class="fill" :class="{ danger: over }" :style="{ width: `${Math.min(pct ?? 100, 100)}%` }" /></div>

    <div class="tl">
      <div v-if="elapsedPct !== null" class="tl-track">
        <div class="tl-elapsed" :style="{ width: `${elapsedPct}%` }" />
        <span class="tl-now" :style="{ left: `${elapsedPct}%` }" title="现在" />
      </div>
      <div class="tl-labels num">
        <n-tooltip :delay="250" placement="top-start">
          <template #trigger><span>{{ shortTime(cycle.started_at) }} 开始</span></template>
          {{ formatTime(cycle.started_at) }}
        </n-tooltip>
        <n-tooltip v-if="ends" :delay="250" placement="top-end">
          <template #trigger><span class="end">{{ shortTime(ends) }} {{ cycle.is_final ? '到期' : '重置' }}</span></template>
          {{ formatTime(ends) }}
        </n-tooltip>
      </div>
      <div class="tl-caption">{{ endCaption }}</div>
    </div>

    <div class="cc-next" :class="{ final: cycle.is_final }">
      <template v-if="cycle.is_final">
        本周期至到期，不再重置<template v-if="nextQuota !== quota">；续费后下个周期额度 {{ nextLabel }}</template>
      </template>
      <template v-else-if="nextQuota !== quota">下个周期起额度恢复为 <b>{{ nextLabel }}</b></template>
      <template v-else>下个周期额度不变：{{ nextLabel }}</template>
    </div>

    <div v-if="cycle.note" class="cc-note">
      <span class="k">备注（用户可见）</span>
      <span class="v">{{ cycle.note }}</span>
    </div>

    <div v-if="!preview && events.length" class="cc-events">
      <div class="k">本周期事件</div>
      <ul>
        <li v-for="(ev, i) in events" :key="`${ev.at}-${i}`">
          <span class="ev-time num" :title="formatTime(ev.at)">{{ shortTime(ev.at) }}</span>
          <span class="ev-type">{{ eventTypeLabel(ev.type) }}</span>
          <!-- the order link below already says 订单 -->
          <span v-if="ev.by && !(ev.by === 'order' && ev.order_id)" class="ev-by">{{ eventByText(ev.by, ev.admin_id) }}</span>
          <router-link
            v-if="ev.order_id"
            class="ev-link"
            :to="{ path: '/finance/order', query: { order_id: String(ev.order_id) } }"
          >
            订单 #{{ ev.order_id }}
          </router-link>
          <span class="ev-detail">{{ eventDetail(ev, planName) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.cc {
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
}
.cc.highlight {
  border-color: color-mix(in srgb, var(--primary-color) 60%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 14%, transparent);
}
.cc.preview {
  border-style: dashed;
}
.cc-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.cc-title {
  font-size: 13px;
  color: var(--text-color);
}
.dot {
  margin: 0 4px;
  color: var(--text-muted);
}
.grow {
  flex: 1;
}
.cc-id {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}
.cc-quota {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px 12px;
  margin-top: 12px;
}
.big {
  font-size: 24px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-strong);
}
.sub {
  font-size: 12px;
  color: var(--text-muted);
}
.sub.danger {
  color: var(--error-color);
}
.usage {
  text-align: right;
  font-size: 13px;
  color: var(--text-color);
}
.usage b {
  font-weight: 600;
  color: var(--text-strong);
}
.num {
  font-variant-numeric: tabular-nums;
}
.bar {
  margin-top: 8px;
  height: 6px;
  border-radius: 3px;
  background: var(--hover-color);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 3px;
  background: var(--primary-color);
  transition: width 0.3s;
}
.fill.danger {
  background: var(--error-color);
}
.tl {
  margin-top: 14px;
}
.tl-track {
  position: relative;
  height: 4px;
  margin: 0 5px 6px;
  border-radius: 2px;
  background: var(--divider-color);
}
.tl-elapsed {
  height: 100%;
  border-radius: 2px;
  background: color-mix(in srgb, var(--text-muted) 55%, transparent);
}
.tl-now {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--card-color);
  box-shadow:
    0 0 0 2px var(--primary-color),
    0 0 0 5px color-mix(in srgb, var(--primary-color) 18%, transparent);
}
.tl-labels {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-color);
  cursor: default;
}
.tl-labels .end {
  text-align: right;
}
.tl-caption {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
}
.cc-next {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 13px;
  color: var(--text-color);
  background: color-mix(in srgb, var(--success-color) 8%, transparent);
}
.cc-next b {
  color: var(--text-strong);
}
.cc-next.final {
  background: color-mix(in srgb, var(--info-color) 9%, transparent);
}
.cc-note {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 13px;
  background: color-mix(in srgb, var(--warning-color) 9%, transparent);
}
.k {
  font-size: 12px;
  color: var(--text-muted);
}
.cc-note .v {
  color: var(--text-strong);
  word-break: break-word;
}
.cc-events {
  margin-top: 12px;
}
.cc-events ul {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.cc-events li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  font-size: 12.5px;
  line-height: 1.5;
}
.ev-time {
  color: var(--text-muted);
}
.ev-type {
  font-weight: 600;
  color: var(--text-strong);
}
.ev-by {
  color: var(--text-muted);
}
.ev-link {
  color: var(--primary-color);
  text-decoration: none;
}
.ev-link:hover {
  text-decoration: underline;
}
.ev-detail {
  color: var(--text-color);
}
@media (max-width: 520px) {
  .cc {
    padding: 12px;
  }
  .usage {
    text-align: left;
  }
}
</style>
