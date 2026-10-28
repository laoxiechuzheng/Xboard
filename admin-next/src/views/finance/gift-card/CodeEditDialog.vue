<script setup lang="ts">
// Edit one redeem code via /gift-card/update-code (not exposed by the official UI).
import { computed, reactive, ref, watch } from 'vue'
import { NAlert, NButton, NDatePicker, NForm, NFormItem, NInputNumber, NModal, NSelect, NSwitch } from 'naive-ui'
import { GIFT_CODE_STATUS, updateCode, type GiftCardCode, type GiftCodeStatus } from '@/api/giftCard'
import { message } from '@/utils/discrete'
import { msToSeconds, secondsToMs } from '@/utils/format'

const props = defineProps<{ show: boolean; code: GiftCardCode | null }>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'success'): void
}>()

const STATUS_DESC: Record<number, string> = {
  0: '可正常兑换',
  1: '标记为已使用；未达到最大使用次数时仍可继续兑换',
  2: '不可兑换',
  3: '不可兑换，可在列表中重新启用',
}

const form = reactive({
  permanent: false,
  expires_at: null as number | null,
  max_usage: 1 as number | null,
  status: 0 as GiftCodeStatus,
})
const submitted = ref(false)
const submitting = ref(false)

watch(
  () => props.show,
  (open) => {
    if (!open || !props.code) return
    const c = props.code
    form.permanent = !c.expires_at
    form.expires_at = secondsToMs(c.expires_at) ?? Date.now() + 30 * 86400_000
    form.max_usage = c.max_usage
    form.status = ([0, 1, 2, 3].includes(c.status) ? c.status : 0) as GiftCodeStatus
    submitted.value = false
  },
)

const statusOptions = GIFT_CODE_STATUS.map((s) => ({ label: `${s.label} — ${STATUS_DESC[s.value]}`, value: s.value }))

const errors = computed(() => {
  const e: Record<string, string> = {}
  if (!form.permanent && !form.expires_at) e.expires_at = '请选择过期时间'
  if (!form.max_usage || form.max_usage < 1) e.max_usage = '最大使用次数必须大于0'
  else if (form.max_usage > 1000) e.max_usage = '最大使用次数不能超过 1000'
  return e
})
const err = (k: string) => (submitted.value ? errors.value[k] : undefined)

const warnings = computed(() => {
  const c = props.code
  const out: string[] = []
  if (!c) return out
  if (form.max_usage && form.max_usage <= c.usage_count) out.push(`该兑换码已使用 ${c.usage_count} 次，最大使用次数不大于已用次数时将无法再兑换。`)
  if (!form.permanent && form.expires_at && form.expires_at < Date.now()) out.push('过期时间早于当前时间，保存后兑换码将无法兑换。')
  if (form.status === 2 && (form.permanent || (form.expires_at && form.expires_at > Date.now()))) {
    out.push('状态仍为“已过期”时兑换码无法兑换；延长有效期后如需恢复使用，请把状态改为“未使用”。')
  }
  return out
})

async function submit() {
  submitted.value = true
  if (!props.code || Object.keys(errors.value).length || submitting.value) return
  submitting.value = true
  try {
    await updateCode({
      id: props.code.id,
      expires_at: form.permanent ? null : msToSeconds(form.expires_at),
      max_usage: form.max_usage!,
      status: form.status,
    })
    message.success('兑换码更新成功')
    emit('success')
    emit('update:show', false)
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
    title="编辑兑换码"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <p v-if="code" class="code-line">
      <span class="muted">兑换码</span>
      <span class="mono code">{{ code.code }}</span>
    </p>
    <n-form label-placement="top" @submit.prevent="submit">
      <n-form-item label="过期时间" :validation-status="err('expires_at') ? 'error' : undefined" :feedback="err('expires_at')">
        <div class="expiry-row">
          <n-date-picker
            v-model:value="form.expires_at"
            type="datetime"
            :disabled="form.permanent"
            :clearable="false"
            class="expiry-input"
          />
          <span class="inline-switch">
            <n-switch v-model:value="form.permanent" size="small" />
            <span class="switch-label" @click="form.permanent = !form.permanent">永久有效</span>
          </span>
        </div>
      </n-form-item>
      <n-form-item label="最大使用次数" :validation-status="err('max_usage') ? 'error' : undefined" :feedback="err('max_usage')">
        <n-input-number v-model:value="form.max_usage" :min="1" :max="1000" :precision="0" class="full">
          <template #suffix>次</template>
        </n-input-number>
      </n-form-item>
      <n-form-item label="状态">
        <n-select v-model:value="form.status" :options="statusOptions" />
      </n-form-item>
      <n-alert v-for="w in warnings" :key="w" type="warning" :show-icon="false" class="tip">{{ w }}</n-alert>
    </n-form>
    <template #footer>
      <div class="footer">
        <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">保存</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.code-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--code-bg);
}
.code {
  font-weight: 600;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
}
.expiry-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  flex-wrap: wrap;
}
.expiry-input {
  flex: 1;
  min-width: 200px;
}
.inline-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.switch-label {
  cursor: pointer;
  user-select: none;
}
.full {
  width: 100%;
}
.tip {
  margin-top: 8px;
  font-size: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
