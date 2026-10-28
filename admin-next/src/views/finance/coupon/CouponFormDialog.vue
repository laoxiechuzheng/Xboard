<script setup lang="ts">
// Add / edit / batch-generate coupons (spec commerce §5.6).
import { computed, reactive, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NIcon,
  NInput,
  NInputGroup,
  NInputNumber,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NText,
  NTooltip,
  type FormInst,
  type FormItemInst,
  type FormItemRule,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import { DiceOutline } from '@vicons/ionicons5'
import {
  COUPON_PERIODS,
  COUPON_TYPES,
  findCouponsByCode,
  generateCoupons,
  randomCouponCode,
  toggleCouponShow,
  type Coupon,
  type CouponSaveBody,
  type CouponType,
} from '@/api/coupon'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'

const props = defineProps<{
  show: boolean
  coupon?: Coupon | null
}>()
const emit = defineEmits<{
  'update:show': [boolean]
  success: []
  /** Batch generation finished; `csv` is the raw backend CSV. */
  generated: [payload: { csv: string; count: number; name: string }]
}>()

const DAY = 86400
const MAX_BATCH = 500

const formRef = ref<FormInst | null>(null)
const rangeItemRef = ref<FormItemInst | null>(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  mode: 'single' as 'single' | 'batch',
  generate_count: 10 as number | null,
  code: '',
  type: 1 as CouponType,
  /** Yuan for type 1, integer percent for type 2. */
  value: null as number | null,
  range: null as [number, number] | null,
  limit_use: null as number | null,
  limit_use_with_user: null as number | null,
  limit_period: [] as string[],
  limit_plan_ids: [] as number[],
  /** Single create only: the backend creates single coupons disabled. */
  enable: true,
})

const isEdit = computed(() => !!props.coupon?.id)
const isBatch = computed(() => !isEdit.value && form.mode === 'batch')

const plans = ref<PlanBrief[]>([])
const plansLoading = ref(false)
let plansLoaded = false

async function loadPlans() {
  if (plansLoaded) return
  plansLoading.value = true
  try {
    plans.value = await fetchPlanOptions()
    plansLoaded = true
  } catch {
    /* toasted */
  } finally {
    plansLoading.value = false
  }
}

const planOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = plans.value.map((p) => ({ label: p.name, value: Number(p.id) }))
  // Keep ids of deleted plans visible so editing doesn't silently drop them.
  for (const id of form.limit_plan_ids) {
    if (!opts.some((o) => o.value === id)) opts.push({ label: `已删除的套餐 #${id}`, value: id })
  }
  return opts
})

const typeOptions = COUPON_TYPES.map((t) => ({ label: t.label, value: t.value }))
const periodOptions = COUPON_PERIODS.map((p) => ({ label: p.label, value: p.value }))

function quickRange(days: number): [number, number] {
  const now = Date.now()
  return [now, now + days * DAY * 1000]
}
const shortcuts: Record<string, () => [number, number]> = {
  '1周': () => quickRange(7),
  '2周': () => quickRange(14),
  '1个月': () => quickRange(30),
  '3个月': () => quickRange(90),
  '6个月': () => quickRange(180),
  '1年': () => quickRange(365),
}

// Narrow screens: the dual-calendar range panel (~580px) overflows, so use two single pickers plus buttons.
function setRangeAt(i: 0 | 1, v: number | null) {
  if (v === null) return
  const next: [number, number] = form.range ? [form.range[0], form.range[1]] : [v, v]
  next[i] = v
  form.range = next
}

function applyShortcut(fn: () => [number, number]) {
  form.range = fn()
  // A shortcut always yields a valid window; drop any stale error.
  rangeItemRef.value?.restoreValidation()
}

const rangeDays = computed(() => {
  if (!form.range) return null
  const d = (form.range[1] - form.range[0]) / (DAY * 1000)
  return d > 0 ? Number(d.toFixed(1)) : null
})
const endsInPast = computed(() => !!form.range && form.range[1] < Date.now())

const valueHint = computed(() => {
  if (form.type === 1) return '直接抵扣订单金额，最多抵扣至 0'
  const v = form.value
  if (!v || v < 1 || v > 100) return '按订单金额比例减免'
  return v === 100 ? '减免 100%，即免费' : `减免 ${v}%，相当于 ${Number(((100 - v) / 10).toFixed(1))} 折`
})

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const c = props.coupon
    form.name = c?.name ?? ''
    form.mode = 'single'
    form.generate_count = 10
    form.code = c?.code ?? ''
    form.type = (Number(c?.type) === 2 ? 2 : 1) as CouponType
    form.value = c ? (form.type === 1 ? Number(c.value) / 100 : Number(c.value)) : null
    form.range = c ? [Number(c.started_at) * 1000, Number(c.ended_at) * 1000] : quickRange(7)
    form.limit_use = c?.limit_use ?? null
    form.limit_use_with_user = c?.limit_use_with_user ?? null
    form.limit_period = Array.isArray(c?.limit_period) ? c!.limit_period.slice() : []
    // Legacy rows may store ids as strings; compare as numbers.
    form.limit_plan_ids = Array.isArray(c?.limit_plan_ids) ? c!.limit_plan_ids.map(Number).filter((n) => !Number.isNaN(n)) : []
    form.enable = true
    formRef.value?.restoreValidation()
    void loadPlans()
  },
  { immediate: true },
)

function onTypeChange(t: CouponType) {
  form.type = t
  // Keep the number the admin typed; percentages must be whole numbers within 1-100.
  if (t === 2 && form.value !== null) form.value = Math.min(100, Math.max(1, Math.round(form.value)))
  formRef.value?.restoreValidation()
}

function fillRandomCode() {
  form.code = randomCouponCode()
}

const rules = computed<FormRules>(() => ({
  name: [{ required: true, trigger: ['input', 'blur'], validator: (_r, v: string) => (v?.trim() ? true : new Error('请输入优惠券名称')) }],
  generate_count: [
    {
      required: isBatch.value,
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: number | null) => {
        if (!isBatch.value) return true
        if (v === null || !Number.isInteger(v) || v < 1) return new Error('请输入生成数量')
        if (v > MAX_BATCH) return new Error(`生成数量最大为${MAX_BATCH}个`)
        return true
      },
    },
  ],
  code: [
    {
      required: isEdit.value,
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => {
        const s = (v ?? '').trim()
        if (isEdit.value && !s) return new Error('券码不能为空')
        if (s.length > 255) return new Error('券码过长')
        if (s && /\s/.test(s)) return new Error('券码不能包含空格')
        return true
      },
    },
  ],
  value: [
    {
      required: true,
      trigger: ['input', 'blur', 'change'],
      validator: (_r: FormItemRule, v: number | null) => {
        if (v === null || Number.isNaN(v)) return new Error('请输入优惠值')
        if (form.type === 2) {
          if (!Number.isInteger(v) || v < 1 || v > 100) return new Error('比例须为 1-100 的整数')
        } else if (v <= 0) return new Error('金额必须大于 0')
        return true
      },
    },
  ],
  range: [
    {
      required: true,
      trigger: ['change', 'blur'],
      validator: (_r: FormItemRule, v: [number, number] | null) => {
        if (!v) return new Error('请选择优惠券有效期')
        if (v[1] <= v[0]) return new Error('结束时间必须晚于开始时间')
        return true
      },
    },
  ],
}))

function close() {
  emit('update:show', false)
}

function buildBase() {
  const value = form.type === 1 ? Math.round((form.value ?? 0) * 100) : Math.round(form.value ?? 0)
  return {
    name: form.name.trim(),
    type: form.type,
    value,
    started_at: Math.floor(form.range![0] / 1000),
    ended_at: Math.floor(form.range![1] / 1000),
    limit_use: form.limit_use ?? null,
    limit_use_with_user: form.limit_use_with_user ?? null,
    // null (not []) = unrestricted; also keeps the batch CSV column as "不限制".
    limit_plan_ids: form.limit_plan_ids.length ? form.limit_plan_ids.slice() : null,
    limit_period: form.limit_period.length ? form.limit_period.slice() : null,
  }
}

/** The backend has no unique check; checkout looks coupons up by code, so duplicates are ambiguous. */
async function ensureCodeFree(code: string, selfId?: number) {
  const dup = (await findCouponsByCode(code)).find((c) => c.id !== selfId)
  if (dup) {
    message.error(`券码「${code}」已被优惠券「${dup.name}」(ID ${dup.id}) 使用，请更换`)
    return false
  }
  return true
}

async function submitBatch() {
  const count = form.generate_count!
  const ok = await confirm({
    title: '确认批量生成',
    content: `将生成 ${count} 张「${form.name.trim()}」优惠券，券码随机且生成后立即启用。完成后会自动下载包含全部券码的 CSV 文件。确定继续吗？`,
    positiveText: '生成',
  })
  if (!ok) return
  const body: CouponSaveBody = { ...buildBase(), generate_count: count }
  const res = await generateCoupons(body)
  if (typeof res !== 'string' || !res.trim()) {
    message.error('批量生成失败：服务器未返回券码')
    return
  }
  emit('generated', { csv: res, count, name: body.name })
  emit('success')
  close()
}

async function submitSingle() {
  const custom = form.code.trim()
  if (custom && !(await ensureCodeFree(custom))) return
  // Generate the code here (same format as the backend) so the new row can be found and enabled.
  const code = custom || randomCouponCode()
  const body: CouponSaveBody = { ...buildBase(), code }
  await generateCoupons(body)
  if (form.enable) {
    try {
      const created = (await findCouponsByCode(code)).filter((c) => c.code === code).sort((a, b) => b.id - a.id)[0]
      if (!created) throw new Error('not found')
      // Single coupons are created with show = 0; flip it via the transaction-free /coupon/show.
      if (!created.show) await toggleCouponShow(created.id)
      message.success(`优惠券已创建并启用，券码 ${code}`)
    } catch {
      message.warning(`优惠券已创建（券码 ${code}），但自动启用失败，请在列表中手动开启`)
    }
  } else {
    message.success(`优惠券已创建（未启用），券码 ${code}`)
  }
  emit('success')
  close()
}

async function submitEdit() {
  const c = props.coupon!
  const code = form.code.trim()
  // Any change (case included) is checked; whether case matters is decided by the DB collation.
  if (code !== String(c.code) && !(await ensureCodeFree(code, c.id))) return
  const body: CouponSaveBody = { ...buildBase(), id: c.id, code }
  await generateCoupons(body)
  message.success('保存成功')
  emit('success')
  close()
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) await submitEdit()
    else if (isBatch.value) await submitBatch()
    else await submitSingle()
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
    :title="isEdit ? '编辑优惠券' : '添加优惠券'"
    :style="{ width: 'min(680px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <p class="dialog-desc muted">创建或编辑优惠券，支持金额、百分比优惠及多种限制。</p>
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      require-mark-placement="right-hanging"
    >
      <n-form-item label="优惠券名称" path="name">
        <n-input v-model:value="form.name" placeholder="请输入优惠券名称" maxlength="255" clearable />
      </n-form-item>

      <n-form-item v-if="!isEdit" label="生成方式" :show-feedback="false" class="mode-item">
        <n-radio-group v-model:value="form.mode">
          <n-radio-button value="single">单个优惠券</n-radio-button>
          <n-radio-button value="batch">批量生成</n-radio-button>
        </n-radio-group>
      </n-form-item>

      <n-form-item v-if="isBatch" label="批量生成数量" path="generate_count">
        <n-input-number
          v-model:value="form.generate_count"
          :min="1"
          :max="MAX_BATCH"
          :precision="0"
          placeholder="1-500"
          class="full"
        >
          <template #suffix>张</template>
        </n-input-number>
      </n-form-item>
      <n-alert v-if="isBatch" type="info" :show-icon="true" class="block-alert">
        批量生成的券码随机分配、生成后<strong>立即启用</strong>，完成后自动下载 CSV（含全部券码）。单次最多 {{ MAX_BATCH }} 张。
      </n-alert>

      <n-form-item v-if="!isBatch" path="code">
        <template #label>
          {{ isEdit ? '优惠码' : '自定义优惠码' }}
          <n-text depth="3" class="label-hint">{{ isEdit ? '用户下单时输入此码' : '留空则自动生成' }}</n-text>
        </template>
        <n-input-group>
          <n-input
            v-model:value="form.code"
            :placeholder="isEdit ? '请输入优惠码' : '自定义优惠码，留空则自动生成'"
            maxlength="255"
            clearable
            class="mono-input"
          />
          <n-tooltip>
            <template #trigger>
              <n-button aria-label="随机生成" @click="fillRandomCode">
                <template #icon><n-icon><dice-outline /></n-icon></template>
              </n-button>
            </template>
            随机生成 8 位券码
          </n-tooltip>
        </n-input-group>
      </n-form-item>

      <n-form-item path="value">
        <template #label>
          优惠券类型和值
          <n-text depth="3" class="label-hint">{{ valueHint }}</n-text>
        </template>
        <n-input-group>
          <n-select
            :value="form.type"
            :options="typeOptions"
            placeholder="优惠券类型"
            class="type-select"
            @update:value="onTypeChange"
          />
          <n-input-number
            v-model:value="form.value"
            :min="form.type === 2 ? 1 : 0"
            :max="form.type === 2 ? 100 : 10000000"
            :precision="form.type === 2 ? 0 : 2"
            :placeholder="form.type === 2 ? '1-100' : '请输入金额'"
            class="value-input"
          >
            <template #suffix>{{ form.type === 2 ? '%' : '元' }}</template>
          </n-input-number>
        </n-input-group>
      </n-form-item>

      <n-form-item ref="rangeItemRef" path="range">
        <template #label>
          优惠券有效期
          <n-text v-if="rangeDays" depth="3" class="label-hint num">共 {{ rangeDays }} 天</n-text>
        </template>
        <div v-if="appState.isMobile" class="range-mobile">
          <div class="range-row">
            <span class="range-label muted">开始</span>
            <n-date-picker
              :value="form.range?.[0] ?? null"
              type="datetime"
              :clearable="false"
              format="yyyy-MM-dd HH:mm:ss"
              placeholder="开始时间"
              class="grow"
              @update:value="setRangeAt(0, $event)"
            />
          </div>
          <div class="range-row">
            <span class="range-label muted">结束</span>
            <n-date-picker
              :value="form.range?.[1] ?? null"
              type="datetime"
              :clearable="false"
              format="yyyy-MM-dd HH:mm:ss"
              placeholder="结束时间"
              class="grow"
              @update:value="setRangeAt(1, $event)"
            />
          </div>
          <div class="quick-range">
            <span class="range-label muted">快捷</span>
            <n-button
              v-for="(fn, label) in shortcuts"
              :key="label"
              size="small"
              secondary
              @click="applyShortcut(fn)"
            >
              {{ label }}
            </n-button>
          </div>
        </div>
        <n-date-picker
          v-else
          v-model:value="form.range"
          type="datetimerange"
          :shortcuts="shortcuts"
          :clearable="false"
          format="yyyy-MM-dd HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          class="full"
        />
      </n-form-item>
      <n-alert v-if="endsInPast" type="warning" :show-icon="true" class="block-alert">
        结束时间早于当前时间，保存后该优惠券即处于过期状态。
      </n-alert>

      <n-grid cols="1 560:2" :x-gap="16" responsive="self">
        <n-form-item-gi path="limit_use">
          <template #label>
            {{ isEdit ? '剩余使用次数' : '最大使用次数' }}
          </template>
          <n-input-number
            v-model:value="form.limit_use"
            :min="0"
            :precision="0"
            placeholder="留空则不限制"
            clearable
            class="full"
          >
            <template #suffix>次</template>
          </n-input-number>
          <template #feedback>
            <n-text depth="3" class="hint">所有用户合计可用次数，每使用一次自动减 1</n-text>
          </template>
        </n-form-item-gi>
        <n-form-item-gi label="每个用户可使用次数" path="limit_use_with_user">
          <n-input-number
            v-model:value="form.limit_use_with_user"
            :min="1"
            :precision="0"
            placeholder="留空则不限制"
            clearable
            class="full"
          >
            <template #suffix>次</template>
          </n-input-number>
          <template #feedback>
            <n-text depth="3" class="hint">限制单个用户使用该优惠券的次数</n-text>
          </template>
        </n-form-item-gi>
      </n-grid>

      <n-form-item label="指定周期" path="limit_period">
        <n-select
          v-model:value="form.limit_period"
          :options="periodOptions"
          multiple
          filterable
          clearable
          placeholder="限制指定周期可以使用优惠，留空则不限制"
        >
          <template #empty><span class="muted">没有找到匹配的周期</span></template>
        </n-select>
      </n-form-item>
      <n-form-item label="指定订阅" path="limit_plan_ids">
        <n-select
          v-model:value="form.limit_plan_ids"
          :options="planOptions"
          :loading="plansLoading"
          multiple
          filterable
          clearable
          placeholder="限制指定订阅可以使用优惠，留空则不限制"
        >
          <template #empty><span class="muted">没有找到匹配的订阅</span></template>
        </n-select>
      </n-form-item>

      <n-form-item v-if="!isEdit && !isBatch" label="创建后立即启用" :show-feedback="true">
        <n-switch v-model:value="form.enable" />
        <template #feedback>
          <n-text depth="3" class="hint">关闭则创建后处于停用状态，用户无法使用，可稍后在列表中开启</n-text>
        </template>
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="close">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">
          {{ isEdit ? '保存' : isBatch ? '生成并下载' : '创建' }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
}
.mode-item {
  margin-bottom: 16px;
}
.block-alert {
  margin-bottom: 16px;
}
.full {
  width: 100%;
}
.hint {
  font-size: 12px;
}
.label-hint {
  margin-left: 6px;
  font-size: 12px;
  font-weight: normal;
}
.num {
  font-variant-numeric: tabular-nums;
}
.type-select {
  width: 140px;
  flex: none;
}
.value-input {
  flex: 1;
  min-width: 0;
}
.range-mobile {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.range-row .grow {
  flex: 1;
  min-width: 0;
}
.range-label {
  flex: none;
  width: 28px;
  font-size: 12px;
}
.quick-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mono-input :deep(input) {
  font-family: var(--font-mono);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
