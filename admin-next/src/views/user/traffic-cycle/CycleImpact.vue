<script setup lang="ts">
// 周期影响 (edit user drawer): what changing plan / quota / expiry / usage does to the user's traffic cycle
// (DESIGN §3.6). Options follow smart defaults until the admin picks one; the preview comes from
// GET user/trafficCycle/preview (debounced). The drawer calls the exposed params() on save (null = send nothing:
// the panel has no traffic cycle backend, detected by a 404) and blocker() to stop a save the backend would reject.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { NButton, NDatePicker, NIcon, NInput, NRadio, NRadioGroup, NSpin } from 'naive-ui'
import { AlertCircleOutline, CheckmarkCircleOutline, CloseCircleOutline, CloudOfflineOutline } from '@vicons/ionicons5'
import type { PlanBrief } from '@/api/common'
import { planPrices, PLAN_PERIODS } from '@/api/plan'
import {
  fetchUserTrafficCycle,
  isLedgerMissing,
  noticeCode,
  previewTrafficCycle,
  type CycleMode,
  type CycleNotice,
  type CyclePreview,
  type CyclePreviewQuery,
  type CycleQuotaScope,
  type CycleTimeline,
  type CycleUpdateParams,
  type CycleUserChanges,
  type TrafficCycle,
} from '@/api/trafficCycle'
import type { UserRow } from '@/api/user'
import { ApiError } from '@/api/http'
import { GB, formatBytes, formatTime, nowSeconds } from '@/utils/format'
import CycleCurrentCard from './CycleCurrentCard.vue'
import CycleUpcoming from './CycleUpcoming.vue'
import { EFFECT_LABELS, WARNING_LABELS, durationText, scheduleWhyText } from './meta'

const props = defineProps<{ userId: number; row: UserRow; changes: CycleUserChanges; plans: PlanBrief[] }>()

const mode = ref<CycleMode>('keep')
const scope = ref<CycleQuotaScope>('standing')
const modeTouched = ref(false)
const scopeTouched = ref(false)
/** ms for the picker; null = automatic end (planEnd on the backend). */
const customEndsMs = ref<number | null>(null)
const note = ref('')
const noteTouched = ref(false)

/** null until known; false = no traffic cycle backend (404). */
const supported = ref<boolean | null>(null)
const before = shallowRef<CycleTimeline | null>(null)
const preview = shallowRef<CyclePreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

const has = (k: keyof CycleUserChanges) => Object.prototype.hasOwnProperty.call(props.changes, k)
const quotaChanged = computed(() => has('transfer_enable'))
const planChanged = computed(() => has('plan_id'))
const expiryChanged = computed(() => has('expired_at'))
const newQuota = computed(() => (has('transfer_enable') ? Number(props.changes.transfer_enable) : Number(props.row.transfer_enable) || 0))
const newUsed = computed(
  () => (has('u') ? Number(props.changes.u) : Number(props.row.u) || 0) + (has('d') ? Number(props.changes.d) : Number(props.row.d) || 0),
)
const oldUsed = computed(() => (Number(props.row.u) || 0) + (Number(props.row.d) || 0))
const usageCleared = computed(() => (has('u') || has('d')) && newUsed.value === 0)
const newExpiry = computed(() => (has('expired_at') ? (props.changes.expired_at ?? null) : props.row.expired_at))
const newPlanId = computed(() => (has('plan_id') ? props.changes.plan_id : props.row.plan_id) ?? null)
/** After saving the user still has a plan that has not expired, so a cycle runs. */
const newActive = computed(() => newPlanId.value !== null && (newExpiry.value === null || newExpiry.value > nowSeconds()))
/** The timeline loaded and there is no running cycle: saving opens one from now whatever the mode. */
const noCurrent = computed(() => !!before.value && !before.value.current)

const targetPlan = computed(() =>
  newPlanId.value === null ? null : (props.plans.find((p) => p.id === Number(newPlanId.value)) ?? null),
)
const planStd = computed(() => {
  const gb = Number(targetPlan.value?.transfer_enable)
  return Number.isFinite(gb) && gb > 0 ? Math.round(gb * GB) : null
})
const PERIODIC = PLAN_PERIODS.filter((p) => p.key !== 'onetime' && p.key !== 'reset_traffic').map((p) => p.key)
const periodic = computed(() => {
  if (!targetPlan.value) return false
  const prices = planPrices({ prices: targetPlan.value.prices })
  return PERIODIC.some((k) => (prices[k] ?? 0) > 0)
})

// Restart when usage is wiped together with a plan / expiry / quota change; quota only for this cycle when a
// periodic plan gets a non-standard quota (DESIGN §3.6 smart defaults).
const defaultMode = computed<CycleMode>(() =>
  usageCleared.value && (planChanged.value || expiryChanged.value || quotaChanged.value) ? 'restart' : 'keep',
)
const defaultScope = computed<CycleQuotaScope>(() =>
  quotaChanged.value && periodic.value && planStd.value !== null && newQuota.value !== planStd.value ? 'cycle' : 'standing',
)
watchEffect(() => {
  if (!modeTouched.value) mode.value = defaultMode.value
  if (!scopeTouched.value) scope.value = defaultScope.value
})
function pickMode(v: CycleMode) {
  mode.value = v
  modeTouched.value = true
}
function pickScope(v: CycleQuotaScope) {
  scope.value = v
  scopeTouched.value = true
}

const showMode = computed(() => newActive.value && !noCurrent.value)
const effectiveMode = computed<CycleMode>(() => (showMode.value ? mode.value : 'keep'))

/** The note is prefilled with the current cycle's note; it is only sent when changed ('' clears it). */
const currentNote = computed(() => before.value?.current?.note ?? '')
watch(currentNote, (v) => {
  if (!noteTouched.value) note.value = v
})
function onNoteInput(v: string) {
  note.value = v
  noteTouched.value = true
}

function params(): CycleUpdateParams | null {
  if (supported.value === false) return null
  const p: CycleUpdateParams = { cycle_mode: effectiveMode.value }
  if (quotaChanged.value && newActive.value) p.cycle_quota_scope = scope.value
  if (effectiveMode.value === 'restart' && customEndsMs.value !== null) p.cycle_ends_at = Math.floor(customEndsMs.value / 1000)
  const n = note.value.trim()
  if (newActive.value && n !== currentNote.value.trim()) p.cycle_note = n
  return p
}

// ------------------------------------------------------------------ current state + live preview

onMounted(async () => {
  try {
    before.value = await fetchUserTrafficCycle(props.userId, { history_size: 1, events_size: 1 }, { silent: true })
    if (supported.value === null) supported.value = true
  } catch (e) {
    if (isLedgerMissing(e)) supported.value = false
  }
})

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
const query = computed<CyclePreviewQuery | null>(() => {
  const p = params()
  return p ? { id: props.userId, ...props.changes, ...p } : null
})
/** Query the shown preview was computed for; a save is only blocked by a preview of the current values. */
let previewKey = ''

async function runPreview() {
  const q = query.value
  if (!q) return
  const my = ++seq
  previewLoading.value = true
  try {
    const res = await previewTrafficCycle(q)
    if (my !== seq) return
    preview.value = res
    previewKey = JSON.stringify(q)
    previewError.value = ''
    supported.value = true
  } catch (e) {
    if (my !== seq) return
    if (isLedgerMissing(e)) {
      supported.value = false
      return
    }
    previewError.value = e instanceof ApiError && e.message ? e.message : '预览失败，请稍后重试'
  } finally {
    if (my === seq) previewLoading.value = false
  }
}

watch(
  () => JSON.stringify(query.value),
  () => {
    clearTimeout(timer)
    timer = setTimeout(runPreview, 400)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))

// ------------------------------------------------------------------ texts

interface Notice {
  type: string
  [key: string]: unknown
}
const toNotice = (n: CycleNotice): Notice => (typeof n === 'string' ? { type: n } : { ...n, type: noticeCode(n) })
const numOr = (v: unknown, fallback: number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return fallback ?? null
  const n = Number(v)
  return Number.isFinite(n) ? n : (fallback ?? null)
}
const t = (ts: number | null | undefined, empty = '长期有效') => (ts ? formatTime(ts) : empty)
const B = (bytes: number | null | undefined) => formatBytes(bytes ?? 0)

const minDays = computed(() => before.value?.min_cycle_days ?? 15)
const changedLabels = computed(() => {
  const out: string[] = []
  if (planChanged.value) out.push('套餐')
  if (quotaChanged.value) out.push('流量')
  if (expiryChanged.value) out.push('到期时间')
  if (has('u') || has('d')) out.push('已用流量')
  return out.join('、')
})
const standing = computed(() => {
  if (planStd.value !== null) return `${B(planStd.value)}（套餐标准）`
  const prev = before.value?.current?.next_quota ?? before.value?.current?.quota ?? props.row.transfer_enable
  return `${B(prev)}（修改前的常备额度）`
})
const modeHint = computed(() =>
  mode.value === 'restart'
    ? '旧周期结束并记为“被替换”，新周期从保存时开始，已用流量清零（上面改了已用流量时按填写的值）。'
    : '周期开始时间不变，已用流量不清零（除非上面改了），只调整本周期的额度和结束时间。',
)
const scopeHint = computed(() => {
  if (scope.value === 'cycle') {
    return `本周期 ${B(newQuota.value)}，下个周期恢复 ${standing.value}。续费不会覆盖本周期额度。`
  }
  const std = planStd.value !== null && newQuota.value === planStd.value ? '（套餐标准）' : '（长期定制额度）'
  return `以后每个周期都是 ${B(newQuota.value)}${std}。`
})
const inactiveText = computed(() =>
  newPlanId.value === null
    ? '保存后用户没有套餐：当前周期结束，不再排期和重置。'
    : '保存后订阅已过期：当前周期结束，不再排期和重置。',
)

const autoEndsMs = computed(() => {
  const ends = preview.value?.current?.ends_at
  return mode.value === 'restart' && ends ? ends * 1000 : null
})
const endsPickerValue = computed(() => customEndsMs.value ?? autoEndsMs.value)
function onEndsPick(v: number | null) {
  customEndsMs.value = v
}
function isEndsDateDisabled(ms: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (ms < start.getTime()) return true
  const exp = newExpiry.value
  return exp ? ms > exp * 1000 : false
}

// Read top-down: what happens to the cycle first, then the subscription facts behind it.
const EFFECT_ORDER = ['cycle_restart', 'quota_cycle_only', 'quota_standing', 'ends_changed', 'expiry_changed', 'plan_changed', 'usage_cleared']
const effectRank = (n: Notice) => (EFFECT_ORDER.includes(n.type) ? EFFECT_ORDER.indexOf(n.type) : EFFECT_ORDER.length)
const effectList = computed(() =>
  (preview.value?.effects ?? []).map(toNotice).sort((a, b) => effectRank(a) - effectRank(b)),
)
const warningList = computed(() => (preview.value?.warnings ?? []).map(toNotice))

/** The cycle as it will be after the save (a restart already reports its cleared usage). */
const after = computed<TrafficCycle | null>(() => preview.value?.current ?? null)
const beforeCycle = computed(() => before.value?.current ?? null)
const planLabel = (id: unknown) =>
  id === null || id === undefined || id === ''
    ? '无套餐'
    : (props.plans.find((p) => p.id === Number(id))?.name ?? `套餐 #${id}`)

function effectText(n: Notice): string {
  const a = after.value
  const b = beforeCycle.value
  switch (n.type) {
    case 'cycle_restart':
      return b ? `本周期从现在重新开始，原周期（${t(b.started_at)} 开始）结束并记为“被替换”` : '从现在开启新周期'
    case 'quota_cycle_only':
      return `新额度 ${B(numOr(n.after, a?.quota))} 只用于本周期，下个周期恢复 ${B(numOr(n.next_quota, a?.next_quota))}`
    case 'quota_standing':
      return `新额度 ${B(numOr(n.after, a?.quota))} 长期生效，以后每个周期都是这个额度`
    case 'ends_changed': {
      const why = n.why === 'restart' ? '' : scheduleWhyText(n.why)
      const from = t(numOr(n.before, b?.ends_at), '不排期')
      const to = t(numOr(n.after, a?.ends_at), '不排期')
      return `本周期结束时间 ${from} → ${to}${why ? `（${why}）` : ''}`
    }
    case 'expiry_changed':
      return `订阅到期 ${t(numOr(n.before, props.row.expired_at))} → ${t(numOr(n.after, newExpiry.value))}`
    case 'usage_cleared': {
      const cleared = numOr(n.cleared, Math.max(0, oldUsed.value - newUsed.value))
      return n.reason === 'admin_restart'
        ? `已用流量 ${B(cleared)} 清零，写一条“重设周期”重置记录`
        : `已用流量减少 ${B(cleared)}，写一条“修改已用”重置记录`
    }
    case 'plan_changed':
      return `套餐 ${planLabel(n.from ?? props.row.plan_id)} → ${planLabel(n.to ?? newPlanId.value)}`
    default:
      return EFFECT_LABELS[n.type] ?? n.type
  }
}

function warningText(n: Notice): string {
  const a = after.value
  switch (n.type) {
    case 'ends_after_expiry':
      return `本周期结束时间 ${t(numOr(n.ends_at, a?.ends_at))} 晚于订阅到期 ${t(numOr(n.expired_at, newExpiry.value))}`
    case 'ends_before_now':
      return `本周期结束时间 ${t(numOr(n.ends_at, a?.ends_at))} 早于现在`
    case 'short_cycle': {
      const secs = numOr(n.seconds, a?.ends_at ? a.ends_at - a.started_at : null)
      // An end before now is already reported by ends_before_now (the backend still sends a negative length).
      if (secs !== null && secs <= 0) return ''
      const min = numOr(n.min_seconds, null)
      const minText = min ? durationText(min) : `${minDays.value} 天`
      return secs ? `本周期只有 ${durationText(secs)}，短于最短周期 ${minText}` : `本周期短于最短周期 ${minText}`
    }
    case 'quota_below_used':
      return `额度 ${B(numOr(n.quota, a?.quota))} 小于已用流量 ${B(numOr(n.used, newUsed.value))}，保存后用户会立即无法使用`
    case 'no_plan':
      return '没有套餐：不排期，也不会重置'
    default:
      return WARNING_LABELS[n.type] ?? n.type
  }
}

const effects = computed(() => effectList.value.map(effectText).filter(Boolean))
const warnings = computed(() => warningList.value.filter((w) => w.type !== 'invalid').map(warningText).filter(Boolean))
// The backend's 422 texts name the request field ("cycle_ends_at 必须晚于当前时间").
const blockerText = (msg: string) =>
  msg.replace(/cycle_ends_at\s*/g, '本周期结束时间').replace(/\s*cycle_mode=restart\s*/g, '选择“从现在重新开始”')
/** Validation errors the save would be rejected with (422). */
const blockers = computed(() => [
  ...new Set(
    warningList.value
      .filter((w) => w.type === 'invalid')
      .map((w) => blockerText(typeof w.message === 'string' && w.message ? w.message : '参数不合法')),
  ),
])
/** What blocks saving right now (the drawer checks it before submitting); '' = nothing or not known yet. */
function blocker(): string {
  if (supported.value === false || previewKey !== JSON.stringify(query.value)) return ''
  return blockers.value[0] ?? ''
}
defineExpose({ params, blocker })
const previewNow = computed(() => nowSeconds())
/** Changed to 长期有效: the promised reset still happens, after that nothing is scheduled (DESIGN §3.3). */
const longTermTail = computed(
  () => !!after.value?.ends_at && !after.value.is_final && newExpiry.value === null && !preview.value?.upcoming.length,
)
</script>

<template>
  <section class="impact">
    <div class="head">
      <span class="title">周期影响</span>
      <span class="sub">修改了{{ changedLabels }}，选择本周期怎么处理</span>
      <span class="grow" />
      <n-spin v-if="previewLoading" :size="14" />
    </div>

    <div v-if="supported === false" class="unsupported">
      <n-icon :size="18"><cloud-offline-outline /></n-icon>
      <span>当前面板还没有流量周期功能（后端未升级），保存时不会发送周期参数，按原有逻辑处理。</span>
    </div>

    <template v-else>
      <div class="opt">
        <div class="opt-label">本周期</div>
        <div class="opt-body">
          <template v-if="showMode">
            <n-radio-group :value="mode" name="cycle-mode" @update:value="pickMode">
              <n-radio value="restart">从现在重新开始</n-radio>
              <n-radio value="keep">保留当前周期</n-radio>
            </n-radio-group>
            <div class="hint">{{ modeHint }}</div>
          </template>
          <div v-else-if="!newActive" class="static">{{ inactiveText }}</div>
          <div v-else class="static">当前没有进行中的周期，保存后从现在开启新周期（已用流量按上面的填写）。</div>
        </div>
      </div>

      <div v-if="quotaChanged && newActive" class="opt">
        <div class="opt-label">新额度</div>
        <div class="opt-body">
          <n-radio-group :value="scope" name="cycle-scope" @update:value="pickScope">
            <n-radio value="cycle">仅本周期</n-radio>
            <n-radio value="standing">长期</n-radio>
          </n-radio-group>
          <div class="hint">{{ scopeHint }}</div>
        </div>
      </div>

      <div v-if="effectiveMode === 'restart'" class="opt">
        <div class="opt-label">本周期结束</div>
        <div class="opt-body">
          <n-date-picker
            :value="endsPickerValue"
            type="datetime"
            :is-date-disabled="isEndsDateDisabled"
            placeholder="自动：按到期时间排期"
            class="ends-picker"
            @update:value="onEndsPick"
          />
          <div class="hint">
            <template v-if="customEndsMs === null">
              自动：按到期时间排期（每个周期至少 {{ minDays }} 天，剩余零头并入），可手动改。
            </template>
            <template v-else>
              已手动指定，到点后进入下一周期。
              <n-button text size="tiny" type="primary" @click="customEndsMs = null">恢复自动</n-button>
            </template>
          </div>
        </div>
      </div>

      <div v-if="newActive" class="opt">
        <div class="opt-label">周期备注</div>
        <div class="opt-body">
          <n-input
            :value="note"
            :maxlength="120"
            show-count
            clearable
            placeholder="例如：中型芒果剩余价值等值转换"
            @update:value="onNoteInput"
          />
          <div class="hint">
            写在本周期上，用户端和 AI 客服都能看到。<template v-if="currentNote">已填入当前备注，清空后保存即删除。</template>
          </div>
        </div>
      </div>

      <div class="preview">
        <div class="preview-title">保存后</div>
        <div v-if="previewError" class="preview-error">
          <span>{{ previewError }}</span>
          <n-button size="tiny" secondary @click="runPreview">重试</n-button>
        </div>
        <template v-else-if="preview">
          <ul v-if="blockers.length" class="notes blockers top">
            <li v-for="b in blockers" :key="b">
              <n-icon :size="15"><close-circle-outline /></n-icon>
              <span>无法保存：{{ b }}</span>
            </li>
          </ul>
          <div :class="{ invalid: blockers.length }">
            <cycle-current-card v-if="after" :cycle="after" :now="previewNow" :plan-quota="planStd" preview />
            <div v-else class="empty-line">保存后没有进行中的周期（无套餐或已过期）。</div>
            <div v-if="preview.upcoming.length" class="block">
              <div class="block-title">后续排期</div>
              <cycle-upcoming :items="preview.upcoming" :max="4" :base-quota="after?.quota ?? null" />
            </div>
            <div v-else-if="longTermTail" class="block tail-note">订阅长期有效：本周期到点照常重置，之后不再排期。</div>
          </div>
          <ul v-if="effects.length" class="notes effects">
            <li v-for="e in effects" :key="e">
              <n-icon :size="15"><checkmark-circle-outline /></n-icon>
              <span>{{ e }}</span>
            </li>
          </ul>
          <ul v-if="warnings.length" class="notes warnings">
            <li v-for="w in warnings" :key="w">
              <n-icon :size="15"><alert-circle-outline /></n-icon>
              <span>{{ w }}</span>
            </li>
          </ul>
        </template>
        <div v-else class="empty-line">正在计算…</div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.impact {
  margin: 4px 0 18px;
  padding: 14px 14px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 35%, var(--border-color));
  background: color-mix(in srgb, var(--primary-color) 4%, transparent);
}
.head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: 10px;
}
.title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-strong);
}
.sub {
  font-size: 12px;
  color: var(--text-muted);
}
.grow {
  flex: 1;
}
.unsupported {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-color);
}
.unsupported .n-icon {
  flex: none;
  color: var(--warning-color);
}
.opt {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 4px 10px;
  padding: 6px 0;
}
.opt-label {
  padding-top: 2px;
  font-size: 13px;
  color: var(--text-color);
}
.opt-body {
  min-width: 0;
}
.static {
  padding-top: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-color);
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}
.ends-picker {
  width: 100%;
  max-width: 280px;
}
.preview {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--divider-color);
}
.preview-title,
.block-title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.block {
  margin-top: 10px;
}
.preview-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 13px;
  color: var(--error-color);
  background: color-mix(in srgb, var(--error-color) 8%, transparent);
}
.empty-line {
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 13px;
  color: var(--text-muted);
  background: var(--hover-color);
}
.notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.notes li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-color);
}
.notes .n-icon {
  flex: none;
  margin-top: 2px;
}
.effects .n-icon {
  color: var(--success-color);
}
.warnings li {
  color: var(--warning-color);
}
.blockers li {
  color: var(--error-color);
}
.notes.top {
  margin: 0 0 8px;
}
/* The cycle a rejected save would produce: still shown, but clearly not what will happen. */
.invalid {
  opacity: 0.45;
}
.tail-note {
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 12.5px;
  color: var(--text-color);
  background: var(--hover-color);
}
@media (max-width: 520px) {
  .opt {
    grid-template-columns: 1fr;
  }
  .opt-label {
    font-weight: 500;
  }
}
</style>
