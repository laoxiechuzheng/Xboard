<script setup lang="ts">
// Add / edit a payment method (spec commerce §4.6–4.7).
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NAlert,
  NAvatar,
  NButton,
  NDivider,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSkeleton,
  NSwitch,
  NText,
  type FormInst,
  type FormItemRule,
  type FormRules,
} from 'naive-ui'
import { ImageOutline, RefreshOutline } from '@vicons/ionicons5'
import {
  fetchPaymentForm,
  fetchPaymentMethods,
  fetchPayments,
  notifyPath,
  savePayment,
  togglePayment,
  type Payment,
  type PaymentSaveBody,
} from '@/api/payment'
import { ApiError } from '@/api/http'
import { centsToYuan, yuanToCents } from '@/utils/format'
import { message } from '@/utils/discrete'
import PaymentConfigFields from './PaymentConfigFields.vue'
import { initialConfig, invalidJsonField, toConfigFields, type ConfigField } from './payment-form'

const props = defineProps<{
  show: boolean
  payment?: Payment | null
  /** Site URL (app_url) is not configured: /payment/save will be rejected. */
  siteUrlMissing?: boolean
  /** Configured app_url, used to preview the default notify URL. */
  siteUrl?: string | null
}>()
const emit = defineEmits<{
  'update:show': [boolean]
  success: []
}>()

const router = useRouter()
const formRef = ref<FormInst | null>(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  icon: '',
  notify_domain: '',
  handling_fee_percent: null as number | null,
  /** Yuan in the form; cents on the wire. */
  handling_fee_fixed: null as number | null,
  payment: null as string | null,
})
const enableAfterCreate = ref(false)

/** Method keys of enabled payment plugins; null = not loaded yet or failed (don't flag anything). */
const methods = ref<string[] | null>(null)
const methodsLoading = ref(false)

const fields = ref<ConfigField[]>([])
const config = ref<Record<string, unknown>>({})
const configState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const configError = ref('')
let formSeq = 0

const isEdit = computed(() => !!props.payment?.id)

const methodOptions = computed(() => {
  const known = methods.value
  const list = known ? known.slice() : []
  // Keep the stored method selectable even if its plugin is currently disabled.
  const stored = props.payment?.payment
  if (stored && !list.includes(stored)) list.unshift(stored)
  // Flag only against a successfully loaded list, same as PaymentView.
  return list.map((m) => ({ label: known && !known.includes(m) ? `${m}（插件未启用）` : m, value: m }))
})

/** Plugin form has no fields: config would be {} and the backend's `'config' => 'required'` rejects it. */
const noConfigFields = computed(() => configState.value === 'ready' && !fields.value.length)

/** Backend concatenates notify_domain + path, so a trailing slash would produce `//api/...`. */
function normalizeDomain(v: string) {
  return v.trim().replace(/\/+$/, '')
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

/**
 * Expected notify URL after saving (edit mode only; uuid is assigned on create).
 * Backend: url(path) is rooted at app_url; a notify_domain replaces everything before the path.
 */
const notifyPreview = computed(() => {
  const row = props.payment
  if (!row?.id || !form.payment) return null
  const suffix = notifyPath(row.payment, row.uuid)
  // Root the backend's url() resolves to: exact when the row has no custom domain, else app_url.
  const root =
    !row.notify_domain && row.notify_url.endsWith(suffix)
      ? row.notify_url.slice(0, -suffix.length)
      : normalizeDomain(props.siteUrl ?? '')
  const defaultUrl = `${root || '<站点地址>'}${notifyPath(form.payment, row.uuid)}`
  const domain = normalizeDomain(form.notify_domain)
  if (!domain) return defaultUrl
  return `${domain}${(root && pathOf(defaultUrl)) || notifyPath(form.payment, row.uuid)}`
})
const notifyChanged = computed(() => !!notifyPreview.value && notifyPreview.value !== props.payment?.notify_url)

const iconPreviewable = computed(() => /^(https?:)?\/\/\S+|^data:image\//.test(form.icon.trim()))

const rules: FormRules = {
  name: [
    {
      required: true,
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => {
        const s = (v ?? '').trim()
        if (!s) return new Error('请输入支付名称')
        if (s.length < 2) return new Error('名称至少需要2个字符')
        if (s.length > 30) return new Error('名称不能超过30个字符')
        return true
      },
    },
  ],
  notify_domain: [
    {
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) =>
        !v?.trim() || /^https?:\/\/[^\s/]+\S*$/.test(v.trim()) ? true : new Error('请输入有效的URL，例如 https://example.com'),
    },
  ],
  payment: [{ required: true, trigger: ['change', 'blur'], message: '请选择支付接口' }],
}

async function loadMethods() {
  methodsLoading.value = true
  try {
    methods.value = await fetchPaymentMethods()
  } catch {
    methods.value = null
  } finally {
    methodsLoading.value = false
  }
}

async function loadConfigForm() {
  const seq = ++formSeq
  const method = form.payment
  if (!method) {
    fields.value = []
    config.value = {}
    configState.value = 'idle'
    return
  }
  configState.value = 'loading'
  configError.value = ''
  // Stored values only apply to the stored method; switching plugins starts from that plugin's defaults.
  const row = props.payment
  const useStored = !!row?.id && row.payment === method
  try {
    // Not using `safe`: the backend's empty-password preservation cannot see blanks
    // (ConvertEmptyStringsToNull turns '' into null), so a masked edit would wipe secrets.
    const schema = await fetchPaymentForm({ payment: method, ...(useStored ? { id: row!.id } : {}) }, { silent: true })
    if (seq !== formSeq) return
    fields.value = toConfigFields(schema)
    config.value = initialConfig(schema)
    configState.value = 'ready'
  } catch (e) {
    if (seq !== formSeq) return
    fields.value = []
    config.value = {}
    configState.value = 'error'
    configError.value = e instanceof ApiError ? e.message : '加载失败'
  }
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const row = props.payment
    form.name = row?.name ?? ''
    form.icon = row?.icon ?? ''
    form.notify_domain = row?.notify_domain ?? ''
    form.handling_fee_percent =
      row?.handling_fee_percent === null || row?.handling_fee_percent === undefined || row.handling_fee_percent === ''
        ? null
        : Number(row.handling_fee_percent)
    form.handling_fee_fixed = centsToYuan(row?.handling_fee_fixed)
    form.payment = row?.payment ?? null
    enableAfterCreate.value = false
    fields.value = []
    config.value = {}
    configState.value = 'idle'
    formRef.value?.restoreValidation()
    void loadMethods()
    void loadConfigForm()
  },
  { immediate: true },
)

function onPaymentChange(v: string | null) {
  form.payment = v
  void loadConfigForm()
}

function close() {
  emit('update:show', false)
}

function goSiteSettings() {
  close()
  void router.push('/config/system')
}

function goPlugins() {
  close()
  void router.push('/config/plugin')
}

/** Newly created payments start disabled; find the new row and toggle it on. */
async function enableCreated(body: PaymentSaveBody) {
  try {
    const rows = await fetchPayments()
    const created = rows
      .filter((r) => r.name === body.name && r.payment === body.payment && !r.enable)
      .sort((a, b) => b.id - a.id)[0]
    if (!created) throw new Error('not found')
    await togglePayment(created.id)
    return true
  } catch {
    return false
  }
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (configState.value === 'loading') {
    message.warning('支付配置表单仍在加载，请稍候')
    return
  }
  if (configState.value !== 'ready') {
    message.error('支付配置表单加载失败，无法保存')
    return
  }
  if (noConfigFields.value) {
    message.error('该插件未提供配置项，后端要求配置参数非空，无法保存')
    return
  }
  const badJson = invalidJsonField(fields.value, config.value)
  if (badJson) {
    message.error(`「${badJson}」不是有效的 JSON`)
    return
  }

  const body: PaymentSaveBody = {
    name: form.name.trim(),
    icon: form.icon.trim() || null,
    notify_domain: normalizeDomain(form.notify_domain) || null,
    handling_fee_fixed: yuanToCents(form.handling_fee_fixed),
    handling_fee_percent: form.handling_fee_percent,
    payment: form.payment!,
    config: { ...config.value },
  }
  if (isEdit.value) body.id = props.payment!.id

  submitting.value = true
  try {
    await savePayment(body)
    if (!isEdit.value && enableAfterCreate.value) {
      const ok = await enableCreated(body)
      if (ok) message.success('创建成功，已启用')
      else message.warning('创建成功，但自动启用失败，请在列表中手动开启')
    } else if (!isEdit.value) {
      message.success('创建成功（默认未启用，可在列表中开启）')
    } else {
      message.success('保存成功')
    }
    emit('success')
    close()
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
    :title="isEdit ? '编辑支付方式' : '添加支付方式'"
    :style="{ width: 'min(680px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <n-alert v-if="siteUrlMissing" type="error" class="block-alert" title="站点地址未配置">
      后端要求先设置站点地址（app_url）才能保存支付方式。
      <n-button text type="primary" @click="goSiteSettings">前往系统配置 → 站点</n-button>
    </n-alert>

    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="top"
      require-mark-placement="right-hanging"
    >
      <n-grid cols="1 560:2" :x-gap="16" responsive="self">
        <n-form-item-gi label="显示名称" path="name">
          <n-input v-model:value="form.name" placeholder="请输入支付名称（用于前端显示）" maxlength="30" clearable />
        </n-form-item-gi>
        <n-form-item-gi label="支付接口" path="payment">
          <n-select
            :value="form.payment"
            :options="methodOptions"
            :loading="methodsLoading"
            placeholder="请选择支付接口"
            filterable
            @update:value="onPaymentChange"
          >
            <template #empty>
              <span class="muted select-empty">
                {{
                  !methods
                    ? '支付接口列表加载失败，请关闭后重试'
                    : methods.length
                      ? '没有匹配的支付接口'
                      : '没有已启用的支付插件，请先在插件管理中启用'
                }}
              </span>
            </template>
          </n-select>
        </n-form-item-gi>
        <n-form-item-gi :span="2" label="图标URL" path="icon">
          <n-input v-model:value="form.icon" placeholder="https://example.com/icon.svg" clearable>
            <template #prefix>
              <n-avatar
                v-if="iconPreviewable"
                :src="form.icon.trim()"
                :size="18"
                color="transparent"
                object-fit="contain"
              >
                <template #fallback><n-icon class="muted"><image-outline /></n-icon></template>
              </n-avatar>
              <n-icon v-else class="muted"><image-outline /></n-icon>
            </template>
          </n-input>
          <template #feedback><n-text depth="3" class="hint">用于前端显示的图标地址，可留空</n-text></template>
        </n-form-item-gi>
        <n-form-item-gi :span="2" path="notify_domain">
          <template #label>
            通知域名
            <n-text depth="3" class="label-hint">网关通知将发送到该域名，留空使用站点地址</n-text>
          </template>
          <n-input v-model:value="form.notify_domain" placeholder="https://example.com" clearable />
        </n-form-item-gi>
        <n-form-item-gi label="百分比手续费" path="handling_fee_percent">
          <n-input-number
            v-model:value="form.handling_fee_percent"
            :min="0"
            :max="100"
            :precision="2"
            placeholder="0-100"
            clearable
            class="full"
          >
            <template #suffix>%</template>
          </n-input-number>
        </n-form-item-gi>
        <n-form-item-gi label="固定手续费" path="handling_fee_fixed">
          <n-input-number
            v-model:value="form.handling_fee_fixed"
            :min="0"
            :precision="2"
            placeholder="0"
            clearable
            class="full"
          >
            <template #suffix>元</template>
          </n-input-number>
        </n-form-item-gi>
      </n-grid>

      <n-alert v-if="notifyChanged" type="warning" class="block-alert" :show-icon="true">
        保存后回调地址将变更为
        <span class="mono url">{{ notifyPreview }}</span>
        请同步修改支付网关后台的回调设置，否则支付结果将无法通知到本站。
      </n-alert>

      <n-form-item v-if="!isEdit" label="创建后立即启用" :show-feedback="true">
        <n-switch v-model:value="enableAfterCreate" />
        <template #feedback>
          <n-text depth="3" class="hint">新建的支付方式默认停用；确认网关参数无误后再启用，用户才能在下单时看到它</n-text>
        </template>
      </n-form-item>

      <n-divider title-placement="left" class="section-divider">支付配置</n-divider>

      <div v-if="configState === 'idle'" class="config-empty muted">请先选择支付接口</div>
      <div v-else-if="configState === 'loading'" class="config-loading">
        <div v-for="i in 3" :key="i" class="sk-item">
          <n-skeleton text width="30%" />
          <n-skeleton height="34px" :sharp="false" />
        </div>
      </div>
      <n-alert v-else-if="configState === 'error'" type="error" title="无法加载支付配置表单">
        {{ configError }}。该支付接口对应的插件可能未启用或已卸载。
        <div class="alert-actions">
          <n-button size="small" @click="loadConfigForm">
            <template #icon><n-icon><refresh-outline /></n-icon></template>
            重试
          </n-button>
          <n-button size="small" quaternary type="primary" @click="goPlugins">前往插件管理</n-button>
        </div>
      </n-alert>
      <template v-else>
        <n-alert v-if="noConfigFields" type="warning" title="无法保存">
          该插件未提供任何配置项。后端要求配置参数（config）非空，提交空配置会被拒绝，因此无法保存该支付接口。请更换支付接口或联系插件作者补充配置项。
        </n-alert>
        <payment-config-fields v-else v-model:value="config" :fields="fields" />
      </template>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="close">取消</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          :disabled="configState === 'loading' || configState === 'error' || noConfigFields"
          @click="submit"
        >
          保存
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.block-alert {
  margin-bottom: 16px;
}
.hint {
  font-size: 12px;
}
.label-hint {
  margin-left: 6px;
  font-size: 12px;
  font-weight: normal;
}
.full {
  width: 100%;
}
.url {
  display: block;
  margin: 4px 0;
  word-break: break-all;
  font-size: 12px;
}
.section-divider {
  margin-top: 4px !important;
}
.section-divider :deep(.n-divider__title) {
  font-size: 13px;
  font-weight: 600;
}
.config-empty {
  padding: 16px 0 8px;
  text-align: center;
  font-size: 13px;
}
.config-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}
.sk-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.select-empty {
  font-size: 13px;
}
.alert-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
