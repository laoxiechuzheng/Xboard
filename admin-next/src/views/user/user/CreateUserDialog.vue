<script setup lang="ts">
// Create user dialog (spec §3): single account, or batch (random prefix / prefix_N), optional CSV download.
// Fixes the official "neither prefix nor count" silent no-op by requiring one of them per mode.
import { computed, reactive, ref, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NDatePicker,
  NButton,
  NRadioGroup,
  NRadioButton,
  NAlert,
  type FormInst,
  type FormRules,
  type FormItemRule,
} from 'naive-ui'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import { generateUsers, generateUsersCsv, type GeneratedUser, type UserGeneratePayload } from '@/api/user'
import { saveFile } from '@/utils/clipboard'
import { message } from '@/utils/discrete'
import GenerateResultDialog from './GenerateResultDialog.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean]; success: [] }>()

type Mode = 'single' | 'batch'

const PREFIX_RE = /^[A-Za-z0-9._+-]+$/
const DOMAIN_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/

const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const plans = ref<PlanBrief[]>([])
const plansLoading = ref(false)
const form = reactive({
  mode: 'single' as Mode,
  email_prefix: '',
  email_suffix: '',
  password: '',
  /** ms for the picker; null = 长期有效 */
  expired_at: null as number | null,
  plan_id: null as number | null,
  generate_count: null as number | null,
  download_csv: false,
})

const resultShow = ref(false)
const results = ref<GeneratedUser[]>([])

function reset() {
  Object.assign(form, {
    mode: form.mode,
    email_prefix: '',
    email_suffix: form.email_suffix,
    password: '',
    expired_at: null,
    plan_id: null,
    generate_count: null,
    download_csv: false,
  })
  formRef.value?.restoreValidation()
}

watch(
  () => props.show,
  async (v) => {
    if (!v) return
    formRef.value?.restoreValidation()
    plansLoading.value = true
    try {
      plans.value = await fetchPlanOptions()
    } catch {
      plans.value = []
    } finally {
      plansLoading.value = false
    }
  },
)

const planOptions = computed(() => plans.value.map((p) => ({ label: p.name, value: p.id })))

const rules: FormRules = {
  // Validates prefix + domain together (both inputs live in one form item).
  email: {
    trigger: ['blur', 'input'],
    validator: () => {
      const prefix = form.email_prefix.trim()
      const suffix = form.email_suffix.trim().replace(/^@/, '')
      if (form.mode === 'single' && !prefix) return new Error('请输入邮箱账号')
      if (prefix && !PREFIX_RE.test(prefix)) return new Error('账号只能包含字母、数字和 . _ + -')
      if (!suffix) return new Error('请输入邮箱域名')
      return DOMAIN_RE.test(suffix) || new Error('域名格式不正确，例如 example.com')
    },
  },
  generate_count: {
    trigger: ['blur', 'change'],
    validator: (_r: FormItemRule, v: number | null) => {
      if (form.mode !== 'batch') return true
      if (!v || v < 1) return new Error('请输入生成数量')
      return v <= 500 || new Error('生成数量最大为500个')
    },
  },
}

const previewEmail = computed(() => {
  const suffix = form.email_suffix.trim().replace(/^@/, '') || 'example.com'
  const prefix = form.email_prefix.trim()
  if (form.mode === 'single') return `${prefix || 'user'}@${suffix}`
  const n = form.generate_count || 1
  if (prefix) return n > 1 ? `${prefix}_1@${suffix} … ${prefix}_${n}@${suffix}` : `${prefix}_1@${suffix}`
  return `6 位随机字符@${suffix}（共 ${n} 个）`
})

function buildPayload(): UserGeneratePayload {
  const batch = form.mode === 'batch'
  return {
    email_prefix: form.email_prefix.trim() || null,
    email_suffix: form.email_suffix.trim().replace(/^@/, ''),
    password: form.password || null,
    expired_at: form.expired_at === null ? null : Math.floor(form.expired_at / 1000),
    plan_id: form.plan_id,
    generate_count: batch ? form.generate_count : null,
    download_csv: batch && form.download_csv,
  }
}

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const payload = buildPayload()
  submitting.value = true
  try {
    if (payload.download_csv) {
      const blob = await generateUsersCsv(payload)
      // Backend CSV has no BOM; prepend one so Excel shows Chinese headers correctly.
      saveFile(new Blob(['﻿', blob], { type: 'text/csv;charset=utf-8' }), `users_${stamp()}.csv`)
      message.success('生成成功，CSV 已开始下载')
    } else {
      const res = await generateUsers(payload)
      if (res && typeof res === 'object' && Array.isArray(res.data)) {
        results.value = res.data
        resultShow.value = true
        message.success(`生成成功，共 ${res.data.length} 个用户`)
      } else if (res) {
        message.success('生成成功')
      } else {
        message.warning('服务器未返回结果，请刷新列表确认')
      }
    }
    reset()
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
    title="创建用户"
    :bordered="false"
    :style="{ width: 'min(560px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
      <n-form-item label="创建方式" :show-feedback="false" class="mode-item">
        <n-radio-group v-model:value="form.mode" @update:value="formRef?.restoreValidation()">
          <n-radio-button value="single">单个创建</n-radio-button>
          <n-radio-button value="batch">批量生成</n-radio-button>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="邮箱" required path="email">
        <div class="email-block">
          <div class="email-row">
            <n-input
              v-model:value="form.email_prefix"
              :placeholder="form.mode === 'single' ? '帐号' : '前缀（留空随机）'"
              :input-props="{ autocomplete: 'off' }"
              class="part"
            />
            <span class="at">@</span>
            <n-input v-model:value="form.email_suffix" placeholder="域" class="part" :input-props="{ autocomplete: 'off' }" />
          </div>
          <div class="preview muted">将创建：<span class="mono">{{ previewEmail }}</span></div>
        </div>
      </n-form-item>

      <n-form-item v-if="form.mode === 'batch'" label="生成数量" path="generate_count">
        <n-input-number
          v-model:value="form.generate_count"
          :min="1"
          :max="500"
          :precision="0"
          placeholder="如果为批量生产请输入生成数量（最多 500）"
          class="full"
          clearable
        />
      </n-form-item>

      <n-form-item label="密码" path="password">
        <n-input
          v-model:value="form.password"
          type="password"
          show-password-on="click"
          placeholder="留空则密码与邮件相同"
          :input-props="{ autocomplete: 'new-password' }"
        />
      </n-form-item>

      <div class="two-col">
        <n-form-item label="到期时间" path="expired_at">
          <n-date-picker
            v-model:value="form.expired_at"
            type="datetime"
            clearable
            placeholder="留空为长期有效"
            class="full"
          />
        </n-form-item>
        <n-form-item label="订阅计划" path="plan_id">
          <n-select
            v-model:value="form.plan_id"
            :options="planOptions"
            :loading="plansLoading"
            placeholder="无"
            clearable
            filterable
          />
        </n-form-item>
      </div>

      <n-alert type="info" :show-icon="false" class="note">
        未选择套餐且系统开启了试用套餐时，用户会获得试用套餐，到期时间将被试用时长覆盖；选择了套餐但未填写到期时间则为长期有效。
      </n-alert>

      <div v-if="form.mode === 'batch'" class="switch-row">
        <div>
          <div class="switch-title">导出为 CSV 文件</div>
          <div class="muted small">开启后直接下载包含账号、明文密码与订阅地址的 CSV，请妥善保管</div>
        </div>
        <n-switch v-model:value="form.download_csv" />
      </div>
    </n-form>

    <template #footer>
      <div class="footer">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">生成</n-button>
      </div>
    </template>
  </n-modal>

  <generate-result-dialog v-model:show="resultShow" :users="results" />
</template>

<style scoped>
.mode-item {
  margin-bottom: 16px;
}
.email-block {
  width: 100%;
}
.email-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.part {
  flex: 1;
  min-width: 0;
}
.at {
  color: var(--text-muted);
}
.preview {
  margin-top: 6px;
  font-size: 12px;
  word-break: break-all;
}
.mono {
  font-family: var(--font-mono);
}
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}
@media (max-width: 560px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}
.full {
  width: 100%;
}
.note {
  margin-bottom: 16px;
  font-size: 12px;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.switch-title {
  font-size: 14px;
  font-weight: 500;
}
.small {
  font-size: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
