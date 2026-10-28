<script setup lang="ts">
// Reusable "edit user" drawer (user list + ticket page).
// Contract: props { show, userId, user? }, emits update:show, saved.
// Always reloads the row by id on open (ticket rows lack `invite_user`), submits only changed
// fields, and always includes `invite_user_email` so the backend never clears it (spec R-1).
import { computed, reactive, ref, watch } from 'vue'
import {
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NFormItemGi,
  NGrid,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NDatePicker,
  NButton,
  NSpin,
  NAlert,
  NDivider,
  NTag,
  type FormInst,
  type FormRules,
  type FormItemRule,
} from 'naive-ui'
import { fetchPlanOptions, type PlanBrief } from '@/api/common'
import {
  fetchUserRow,
  findUserByEmail,
  normalizeEmail,
  updateUser,
  type UserRow,
  type UserUpdatePayload,
} from '@/api/user'
import { GB, formatTime } from '@/utils/format'
import { appState } from '@/stores/app'
import { authState } from '@/stores/auth'
import { confirm, message } from '@/utils/discrete'
import { COMMISSION_TYPE_OPTIONS, truthy } from './helpers'

const props = withDefaults(defineProps<{ show: boolean; userId: number | null; user?: UserRow | null }>(), {
  user: null,
})
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

interface EditForm {
  email: string
  invite_user_email: string
  country_code: string | null
  phone: string
  password: string
  balance: number | null
  commission_balance: number | null
  /** GB */
  u: number | null
  /** GB */
  d: number | null
  /** GB */
  transfer_enable: number | null
  /** ms for the date picker; null = 长期有效 */
  expired_at: number | null
  plan_id: number | null
  banned: boolean
  commission_type: number
  commission_rate: number | null
  discount: number | null
  speed_limit: number | null
  device_limit: number | null
  is_admin: boolean
  is_staff: boolean
  remarks: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const formRef = ref<FormInst | null>(null)
const row = ref<UserRow | null>(null)
const loading = ref(false)
const saving = ref(false)
const plans = ref<PlanBrief[]>([])
const form = reactive<EditForm>(blankForm())
let initial: EditForm = blankForm()

function blankForm(): EditForm {
  return {
    email: '',
    invite_user_email: '',
    country_code: null,
    phone: '',
    password: '',
    balance: 0,
    commission_balance: 0,
    u: 0,
    d: 0,
    transfer_enable: 0,
    expired_at: null,
    plan_id: null,
    banned: false,
    commission_type: 0,
    commission_rate: null,
    discount: null,
    speed_limit: null,
    device_limit: null,
    is_admin: false,
    is_staff: false,
    remarks: '',
  }
}

const gb3 = (bytes: number | null | undefined) => (bytes ? Number((Number(bytes) / GB).toFixed(3)) : 0)
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

function formFromRow(r: UserRow): EditForm {
  return {
    email: r.email ?? '',
    invite_user_email: r.invite_user?.email ?? '',
    country_code: r.phone_country_code || r.phone_default_country_code || (r.phone_auth_enabled ? 'CN' : null),
    phone: r.phone_national_number || r.phone || '',
    password: '',
    balance: Number(r.balance) || 0,
    commission_balance: Number(r.commission_balance) || 0,
    u: gb3(r.u),
    d: gb3(r.d),
    transfer_enable: gb3(r.transfer_enable),
    expired_at: r.expired_at === null || r.expired_at === undefined ? null : Number(r.expired_at) * 1000,
    plan_id: numOrNull(r.plan_id),
    banned: truthy(r.banned),
    commission_type: Number(r.commission_type) || 0,
    commission_rate: numOrNull(r.commission_rate),
    discount: numOrNull(r.discount),
    speed_limit: numOrNull(r.speed_limit),
    device_limit: numOrNull(r.device_limit),
    is_admin: truthy(r.is_admin),
    is_staff: truthy(r.is_staff),
    remarks: r.remarks ?? '',
  }
}

function applyRow(r: UserRow) {
  row.value = r
  const f = formFromRow(r)
  initial = { ...f }
  Object.assign(form, f)
}

let openSeq = 0

async function open() {
  const my = ++openSeq
  formRef.value?.restoreValidation()
  if (props.user) applyRow(props.user)
  else {
    row.value = null
    Object.assign(form, blankForm())
  }
  const id = props.userId ?? props.user?.id
  if (!id) return
  loading.value = true
  try {
    const [fresh, planList] = await Promise.all([
      fetchUserRow(id),
      fetchPlanOptions().catch(() => [] as PlanBrief[]),
    ])
    if (my !== openSeq) return
    plans.value = planList
    if (!fresh) {
      message.error('用户不存在或已被删除')
      close()
      return
    }
    applyRow(fresh)
  } catch {
    if (my === openSeq && !row.value) close()
  } finally {
    if (my === openSeq) loading.value = false
  }
}

watch(
  () => [props.show, props.userId ?? props.user?.id] as const,
  ([v]) => {
    if (v) void open()
  },
  { immediate: true },
)

function close() {
  emit('update:show', false)
}

const planOptions = computed(() => plans.value.map((p) => ({ label: p.name, value: p.id })))
const phoneEnabled = computed(() => !!row.value?.phone_auth_enabled)
const countryOptions = computed(() =>
  (row.value?.phone_auth_countries ?? []).map((c) => ({ label: `${c.name} +${c.dial_code}`, value: c.code })),
)
const isSelf = computed(
  () => !!row.value && !!authState.user?.email && row.value.email.toLowerCase() === authState.user.email.toLowerCase(),
)
const orphanInviter = computed(() => !!row.value && row.value.invite_user_id !== null && !row.value.invite_user)

const changed = <K extends keyof EditForm>(k: K) => form[k] !== initial[k]
// Case/whitespace-only edits are not real changes (backend stores lowercase).
const emailChanged = computed(() => normalizeEmail(form.email) !== normalizeEmail(initial.email))
const inviterChanged = computed(
  () => normalizeEmail(form.invite_user_email) !== normalizeEmail(initial.invite_user_email),
)

// n-select only takes string/number values.
const BANNED_OPTIONS = [
  { label: '正常', value: 0 },
  { label: '封禁', value: 1 },
]
const bannedValue = computed({
  get: () => (form.banned ? 1 : 0),
  set: (v: number) => (form.banned = v === 1),
})
const planChanged = computed(() => changed('plan_id'))
const expirePast = computed(() => form.expired_at !== null && form.expired_at < Date.now())

// A cleared number box is null: block submit instead of silently writing 0 (official: NaN fails validation).
const requiredNumber = (label: string): FormItemRule => ({
  trigger: ['blur', 'input'],
  validator: (_r: FormItemRule, v: number | null | undefined) =>
    (typeof v === 'number' && !Number.isNaN(v)) || new Error(`请输入${label}（如需清零请填 0）`),
})

const rules: FormRules = {
  balance: requiredNumber('余额'),
  commission_balance: requiredNumber('佣金余额'),
  transfer_enable: requiredNumber('流量'),
  u: requiredNumber('已用上行'),
  d: requiredNumber('已用下行'),
  email: {
    trigger: ['blur', 'input'],
    validator: (_r: FormItemRule, v: string) => {
      if (v === initial.email) return true
      if (!v.trim()) return new Error('邮箱不能为空')
      return EMAIL_RE.test(v.trim()) || new Error('邮箱格式不正确')
    },
  },
  invite_user_email: {
    trigger: ['blur'],
    validator: (_r: FormItemRule, v: string) => !v.trim() || EMAIL_RE.test(v.trim()) || new Error('邀请人邮箱格式不正确'),
  },
  password: {
    trigger: ['blur', 'input'],
    validator: (_r: FormItemRule, v: string) => !v || v.length >= 8 || new Error('密码长度最小8位'),
  },
}

// Date shortcuts (end of day like the official quick buttons).
function endOfDayAfterMonths(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  d.setHours(23, 59, 59, 0)
  return d.getTime()
}
const dateShortcuts = {
  一个月: () => endOfDayAfterMonths(1),
  三个月: () => endOfDayAfterMonths(3),
  设为当天结束: () => endOfDayAfterMonths(0),
}

function buildPayload(): UserUpdatePayload {
  const id = row.value!.id
  // invite_user_email is always sent: the backend clears invite_user_id when it is missing.
  // Emails are lowercased like the backend's `byEmail` / email mutator.
  const p: UserUpdatePayload = { id, invite_user_email: normalizeEmail(form.invite_user_email) || null }
  if (emailChanged.value) p.email = normalizeEmail(form.email)
  if (form.password) p.password = form.password
  // Required numbers are validated non-null; null is never turned into 0 here.
  if (changed('balance') && form.balance !== null) p.balance = Math.round(form.balance * 100) / 100
  if (changed('commission_balance') && form.commission_balance !== null)
    p.commission_balance = Math.round(form.commission_balance * 100) / 100
  if (changed('u') && form.u !== null) p.u = Math.round(form.u * GB)
  if (changed('d') && form.d !== null) p.d = Math.round(form.d * GB)
  if (changed('transfer_enable') && form.transfer_enable !== null)
    p.transfer_enable = Math.round(form.transfer_enable * GB)
  if (changed('expired_at')) p.expired_at = form.expired_at === null ? null : Math.floor(form.expired_at / 1000)
  if (changed('plan_id')) p.plan_id = form.plan_id
  if (changed('banned')) p.banned = form.banned
  if (changed('commission_type')) p.commission_type = form.commission_type
  if (changed('commission_rate')) p.commission_rate = form.commission_rate
  if (changed('discount')) p.discount = form.discount
  if (changed('speed_limit')) p.speed_limit = form.speed_limit
  if (changed('device_limit')) p.device_limit = form.device_limit
  if (changed('is_admin')) p.is_admin = form.is_admin
  if (changed('is_staff')) p.is_staff = form.is_staff
  if (changed('remarks')) p.remarks = form.remarks.trim() ? form.remarks : null
  if (phoneEnabled.value) {
    if (changed('country_code')) p.country_code = form.country_code
    if (changed('phone')) p.phone = form.phone.trim() || null
  }
  return p
}

async function submit() {
  if (!row.value) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const payload = buildPayload()
  const keys = Object.keys(payload).filter((k) => k !== 'id' && k !== 'invite_user_email')
  if (!keys.length && !inviterChanged.value) {
    message.info('没有需要保存的修改')
    return
  }

  saving.value = true
  try {
    // Verify the new inviter exists, otherwise the backend silently clears the relation.
    if (inviterChanged.value && payload.invite_user_email) {
      const inviter = await findUserByEmail(payload.invite_user_email)
      if (!inviter) {
        message.error('邀请人邮箱不存在，请检查后再保存')
        return
      }
      if (inviter.id === row.value.id) {
        message.error('不能把用户自己设为邀请人')
        return
      }
    }
    if (isSelf.value && ((payload.is_admin === false) || payload.banned === true)) {
      const ok = await confirm({
        title: '正在修改你自己的账号',
        content:
          payload.banned === true
            ? '你正在封禁当前登录的管理员账号，保存后会立即被踢下线且无法再登录后台。确定继续吗？'
            : '你正在取消当前登录账号的管理员权限，保存后将无法再访问后台。确定继续吗？',
        positiveText: '仍然保存',
        type: 'error',
      })
      if (!ok) return
    }
    await updateUser(payload)
    message.success('修改成功')
    emit('saved')
    close()
  } catch {
    /* toast handled by http client */
  } finally {
    saving.value = false
  }
}

const drawerWidth = computed(() => (appState.isMobile ? '100%' : 640))
const titleSuffix = computed(() => (row.value ? `#${row.value.id}` : ''))
</script>

<template>
  <n-drawer :show="show" :width="drawerWidth" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content closable :native-scrollbar="false" body-content-class="edit-body">
      <template #header>
        <div class="drawer-head">
          <span>用户管理</span>
          <n-tag v-if="row" size="small" round :bordered="false" class="mono">{{ titleSuffix }}</n-tag>
          <span v-if="row" class="head-email">{{ row.email }}</span>
        </div>
      </template>

      <n-spin :show="loading" :delay="150">
        <n-alert v-if="isSelf" type="warning" :show-icon="true" class="mb">这是当前登录的管理员账号，请谨慎修改权限与状态。</n-alert>
        <n-alert v-if="orphanInviter" type="warning" :show-icon="true" class="mb">
          该用户的邀请人（ID {{ row?.invite_user_id }}）已不存在，保存时邀请关系会被清空。
        </n-alert>

        <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" :disabled="loading || !row" size="medium">
          <div class="section-title">账号信息</div>
          <n-grid cols="1 s:2" responsive="screen" :x-gap="12">
            <n-form-item-gi label="邮箱" path="email">
              <n-input v-model:value="form.email" placeholder="请输入邮箱" :input-props="{ autocomplete: 'username' }" />
            </n-form-item-gi>
            <n-form-item-gi label="邀请人邮箱" path="invite_user_email">
              <n-input v-model:value="form.invite_user_email" placeholder="请输入邮箱，留空则清除邀请人" clearable />
            </n-form-item-gi>
            <template v-if="phoneEnabled">
              <n-form-item-gi label="国家/地区" path="country_code">
                <n-select
                  v-model:value="form.country_code"
                  :options="countryOptions"
                  :disabled="countryOptions.length <= 1"
                  filterable
                />
              </n-form-item-gi>
              <n-form-item-gi label="手机号" path="phone">
                <n-input v-model:value="form.phone" placeholder="请输入手机号" clearable />
              </n-form-item-gi>
            </template>
            <n-form-item-gi :span="2" label="密码" path="password">
              <n-input
                v-model:value="form.password"
                type="password"
                show-password-on="click"
                placeholder="如需修改密码请输入（至少 8 位），留空不修改"
                :input-props="{ autocomplete: 'new-password' }"
              />
            </n-form-item-gi>
          </n-grid>

          <n-divider />
          <div class="section-title">订阅与流量</div>
          <n-grid cols="1 s:2" responsive="screen" :x-gap="12">
            <n-form-item-gi label="订阅计划" path="plan_id">
              <n-select
                v-model:value="form.plan_id"
                :options="planOptions"
                placeholder="无"
                clearable
                filterable
              />
              <template #feedback>
                <span v-if="planChanged && form.plan_id !== null" class="hint">权限组将同步为该套餐的权限组；不会修改流量、限速和设备数。</span>
                <span v-else-if="planChanged" class="hint">取消套餐不会修改用户当前的权限组。</span>
              </template>
            </n-form-item-gi>
            <n-form-item-gi label="到期时间" path="expired_at">
              <div class="expire-field">
                <n-date-picker
                  v-model:value="form.expired_at"
                  type="datetime"
                  clearable
                  :shortcuts="dateShortcuts"
                  placeholder="留空为长期有效"
                  class="grow"
                  :actions="['clear', 'now', 'confirm']"
                />
                <n-button size="medium" secondary :disabled="form.expired_at === null" @click="form.expired_at = null">长期有效</n-button>
              </div>
              <template #feedback>
                <span v-if="form.expired_at === null" class="hint">当前为长期有效</span>
                <span v-else-if="expirePast" class="hint warn">所选时间早于当前时间，保存后用户将处于已过期状态。</span>
              </template>
            </n-form-item-gi>
            <n-form-item-gi label="流量" path="transfer_enable">
              <n-input-number v-model:value="form.transfer_enable" :min="0" :show-button="false" placeholder="请输入流量" class="full">
                <template #suffix>GB</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="限速" path="speed_limit">
              <n-input-number
                v-model:value="form.speed_limit"
                :min="0"
                :precision="0"
                :show-button="false"
                clearable
                placeholder="留空则不限速"
                class="full"
              >
                <template #suffix>Mbps</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="已用上行" path="u">
              <n-input-number v-model:value="form.u" :min="0" :show-button="false" placeholder="已用上行" class="full">
                <template #suffix>GB</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="已用下行" path="d">
              <n-input-number v-model:value="form.d" :min="0" :show-button="false" placeholder="已用下行" class="full">
                <template #suffix>GB</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="设备限制" path="device_limit">
              <n-input-number
                v-model:value="form.device_limit"
                :min="0"
                :precision="0"
                :show-button="false"
                clearable
                placeholder="留空则不限制"
                class="full"
              >
                <template #suffix>台</template>
              </n-input-number>
            </n-form-item-gi>
          </n-grid>

          <n-divider />
          <div class="section-title">财务与返利</div>
          <n-grid cols="1 s:2" responsive="screen" :x-gap="12">
            <n-form-item-gi label="余额" path="balance">
              <n-input-number v-model:value="form.balance" :precision="2" :show-button="false" placeholder="请输入余额" class="full">
                <template #prefix>¥</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="佣金余额" path="commission_balance">
              <n-input-number
                v-model:value="form.commission_balance"
                :precision="2"
                :show-button="false"
                placeholder="请输入佣金余额"
                class="full"
              >
                <template #prefix>¥</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="佣金类型" path="commission_type">
              <n-select v-model:value="form.commission_type" :options="COMMISSION_TYPE_OPTIONS" />
            </n-form-item-gi>
            <n-form-item-gi label="推荐返利比例" path="commission_rate">
              <n-input-number
                v-model:value="form.commission_rate"
                :min="0"
                :max="100"
                :precision="0"
                :show-button="false"
                clearable
                placeholder="为空则跟随站点设置返利比例"
                class="full"
              >
                <template #suffix>%</template>
              </n-input-number>
            </n-form-item-gi>
            <n-form-item-gi label="专享折扣比例" path="discount">
              <n-input-number
                v-model:value="form.discount"
                :min="0"
                :max="100"
                :precision="0"
                :show-button="false"
                clearable
                placeholder="为空则不享受专享折扣"
                class="full"
              >
                <template #suffix>%</template>
              </n-input-number>
            </n-form-item-gi>
          </n-grid>

          <n-divider />
          <div class="section-title">权限与状态</div>
          <n-grid cols="1 s:3" responsive="screen" :x-gap="12">
            <n-form-item-gi label="账户状态" path="banned">
              <n-select v-model:value="bannedValue" :options="BANNED_OPTIONS" />
            </n-form-item-gi>
            <n-form-item-gi label="是否管理员" path="is_admin">
              <n-switch v-model:value="form.is_admin" />
            </n-form-item-gi>
            <n-form-item-gi label="是否员工" path="is_staff">
              <n-switch v-model:value="form.is_staff" />
            </n-form-item-gi>
          </n-grid>
          <n-alert v-if="changed('banned') && form.banned" type="warning" :show-icon="true" class="mb">
            封禁后会立即清除该用户的所有登录会话，并同步到节点。
          </n-alert>

          <n-form-item label="备注" path="remarks">
            <n-input v-model:value="form.remarks" type="textarea" placeholder="请在这里记录" :autosize="{ minRows: 3, maxRows: 8 }" />
          </n-form-item>

          <div v-if="row" class="meta muted">
            注册于 {{ formatTime(row.created_at) }} · 更新于 {{ formatTime(row.updated_at) }}
          </div>
        </n-form>
      </n-spin>

      <template #footer>
        <div class="footer">
          <n-button @click="close">取消</n-button>
          <n-button type="primary" :loading="saving" :disabled="loading || !row" @click="submit">提交</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.drawer-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.head-email {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: var(--font-mono);
}
.mb {
  margin-bottom: 12px;
}
.section-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}
.expire-field {
  display: flex;
  gap: 8px;
  width: 100%;
}
.expire-field .grow {
  flex: 1;
  min-width: 0;
}
.full {
  width: 100%;
}
.hint {
  font-size: 12px;
  color: var(--text-muted);
}
.hint.warn {
  color: var(--warning-color);
}
.meta {
  font-size: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
:deep(.n-divider:not(.n-divider--vertical)) {
  margin: 8px 0 16px;
}
</style>
