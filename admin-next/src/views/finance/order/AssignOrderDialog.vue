<script setup lang="ts">
// Contract (shared by the order page and the user page "分配订单" action):
//   props:  show: boolean, email?: string  (prefills the user email)
//   emits:  update:show(boolean), success()  (after POST /order/assign succeeds)
import { computed, reactive, ref, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NInputNumber,
  NButton,
  NAlert,
  NSpace,
  type FormInst,
  type FormRules,
  type FormItemRule,
} from 'naive-ui'
import { fetchPlans, planPrices, PLAN_PERIODS, PERIOD_BY_LEGACY, type Plan, type LegacyPeriod } from '@/api/plan'
import { assignOrder } from '@/api/order'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean; email?: string }>()
const emit = defineEmits<{ 'update:show': [boolean]; success: [] }>()

const formRef = ref<FormInst | null>(null)
const plans = ref<Plan[]>([])
const plansLoading = ref(false)
const submitting = ref(false)
/** Once the admin edits the amount we stop auto-filling it from the plan price. */
const amountTouched = ref(false)

const form = reactive({
  email: '',
  plan_id: null as number | null,
  period: null as LegacyPeriod | null,
  /** yuan; converted to cents on submit */
  amount: 0 as number | null,
})

const selectedPlan = computed(() => plans.value.find((p) => p.id === form.plan_id) ?? null)
const selectedPrices = computed(() => (selectedPlan.value ? planPrices(selectedPlan.value) : {}))
const selectedPrice = computed<number | null>(() => {
  if (!form.period) return null
  const meta = PERIOD_BY_LEGACY[form.period]
  return meta ? (selectedPrices.value[meta.key] ?? null) : null
})

const planOptions = computed(() =>
  plans.value.map((p) => ({
    label: `${p.name}${p.show ? '' : '（未显示）'}`,
    value: p.id,
  })),
)

const periodOptions = computed(() =>
  PLAN_PERIODS.map((p) => {
    const price = selectedPrices.value[p.key]
    return {
      label: price !== undefined ? `${p.orderLabel}（套餐价 ¥${price.toFixed(2)}）` : p.orderLabel,
      value: p.legacy,
    }
  }),
)

const rules: FormRules = {
  email: [{ required: true, message: '请输入用户邮箱', trigger: ['input', 'blur'] }],
  plan_id: [{ required: true, type: 'number', message: '请选择订阅计划', trigger: ['change', 'blur'] }],
  period: [{ required: true, message: '请选择订单周期', trigger: ['change', 'blur'] }],
  amount: [
    {
      required: true,
      type: 'number',
      message: '请输入支付金额',
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: number | null) => {
        if (v === null || v === undefined || !Number.isFinite(v)) return new Error('请输入支付金额')
        if (v < 0) return new Error('支付金额不能为负数')
        return true
      },
    },
  ],
}

function reset() {
  form.email = props.email ?? ''
  form.plan_id = null
  form.period = null
  form.amount = 0
  amountTouched.value = false
  formRef.value?.restoreValidation()
}

async function loadPlans() {
  plansLoading.value = true
  try {
    plans.value = await fetchPlans()
  } catch {
    plans.value = []
  } finally {
    plansLoading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    reset()
    void loadPlans()
  },
  { immediate: true },
)

// Until the admin types an amount, keep it in step with the chosen plan + period: use the plan's
// price, or clear it when that period has no price so a previous period's price is never carried over.
watch(
  () => [form.plan_id, form.period, selectedPrice.value] as const,
  ([planId, period, price]) => {
    if (amountTouched.value) return
    if (price !== null) form.amount = price
    else if (planId && period) form.amount = null
  },
)

function onAmountInput(v: number | null) {
  form.amount = v
  amountTouched.value = true
}

function close() {
  emit('update:show', false)
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    await assignOrder({
      email: form.email.trim(),
      plan_id: form.plan_id as number,
      period: form.period as LegacyPeriod,
      total_amount: Math.round(Number(form.amount) * 100),
    })
    message.success('添加成功，已创建待支付订单')
    emit('success')
    close()
  } catch {
    /* error toasted by the http client */
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="订单分配"
    :bordered="false"
    :mask-closable="!submitting"
    :close-on-esc="!submitting"
    style="width: min(520px, calc(100vw - 32px))"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-alert type="info" :show-icon="false" class="assign-tip">
      为用户创建一笔<b>待支付</b>订单，金额由你指定，不校验套餐价格、不扣余额、不使用优惠券。需在订单列表点击「标记为已支付」后才会开通。
    </n-alert>
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" require-mark-placement="right-hanging">
      <n-form-item label="用户邮箱" path="email">
        <n-input
          v-model:value="form.email"
          placeholder="请输入用户邮箱"
          clearable
          :input-props="{ autocomplete: 'off', spellcheck: false }"
        />
      </n-form-item>
      <n-form-item label="订阅计划" path="plan_id">
        <n-select
          v-model:value="form.plan_id"
          :options="planOptions"
          :loading="plansLoading"
          filterable
          placeholder="请选择订阅计划"
        />
      </n-form-item>
      <n-form-item label="订单周期" path="period">
        <n-select v-model:value="form.period" :options="periodOptions" placeholder="请选择购买时长" />
      </n-form-item>
      <n-form-item label="支付金额" path="amount">
        <div class="amount-field">
          <n-input-number
            :value="form.amount"
            :min="0"
            :precision="2"
            :step="1"
            :show-button="false"
            placeholder="请输入需要支付的金额"
            class="amount-input"
            @update:value="onAmountInput"
          >
            <template #prefix>¥</template>
            <template #suffix>元</template>
          </n-input-number>
          <div v-if="selectedPrice !== null" class="field-hint">
            该周期套餐价 ¥{{ selectedPrice.toFixed(2) }}
            <n-button
              v-if="form.amount !== selectedPrice"
              text
              type="primary"
              size="tiny"
              @click="form.amount = selectedPrice"
              >使用套餐价</n-button
            >
          </div>
          <div v-else-if="form.plan_id && form.period" class="field-hint">该套餐未设置此周期价格，请手动填写支付金额，订单将按填写的金额创建</div>
        </div>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button :disabled="submitting" @click="close">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">确认</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.assign-tip {
  margin-bottom: 16px;
  font-size: 13px;
}
.amount-field {
  width: 100%;
}
.amount-input {
  width: 100%;
  font-variant-numeric: tabular-nums;
}
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
