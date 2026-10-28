<script setup lang="ts">
// Create / edit a gift card template (spec commerce §6.2.5). Rewards are trimmed by type on save.
import { computed, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NColorPicker,
  NDatePicker,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NTag,
  NTooltip,
} from 'naive-ui'
import { AddOutline, GiftOutline, InformationCircleOutline, TrashOutline } from '@vicons/ionicons5'
import type { PlanBrief } from '@/api/common'
import { ApiError } from '@/api/http'
import { GIFT_CARD_TYPES, createTemplate, giftCardTypeLabel, updateTemplate, type GiftCardTemplate } from '@/api/giftCard'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import {
  DEFAULT_THEME_COLOR,
  GB_DIGITS,
  REWARD_KEY_LABELS,
  buildPayload,
  droppedRewardKeys,
  emptyForm,
  formFromTemplate,
  legacyInviteRate,
  legacyValueIssues,
  newRandomRow,
  validateForm,
  type TemplateForm,
} from './template-form'
import { formatRate, rewardItems } from './helpers'

const props = defineProps<{
  show: boolean
  /** Template to edit; null creates a new one. */
  template: GiftCardTemplate | null
  plans: PlanBrief[]
  plansLoading?: boolean
  /** The plan list was fetched successfully (unknown ids can then be flagged as missing). */
  plansLoaded?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'success', t: GiftCardTemplate | null): void
}>()

const form = ref<TemplateForm>(emptyForm())
const submitted = ref(false)
const submitting = ref(false)
const serverErrors = ref<Record<string, string>>({})
let snapshot = ''

const isEdit = computed(() => !!props.template)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    form.value = props.template ? formFromTemplate(props.template) : emptyForm()
    submitted.value = false
    serverErrors.value = {}
    snapshot = JSON.stringify(form.value)
  },
  { immediate: true },
)

const errors = computed(() => validateForm(form.value))
function err(key: string): string | undefined {
  return serverErrors.value[key] || (submitted.value ? errors.value[key] : undefined)
}
function status(key: string) {
  return err(key) ? ('error' as const) : undefined
}

// ---------- options ----------
const planMap = computed(() => new Map(props.plans.map((p) => [p.id, p.name])))
function planOptions(selected: number[] | number | null) {
  const opts = props.plans.map((p) => ({ label: p.name, value: p.id }))
  const ids = Array.isArray(selected) ? selected : selected === null ? [] : [selected]
  // Only flag an id as missing once the plan list really loaded (not while loading / after a failure).
  const missing = props.plansLoaded && !props.plansLoading ? '（套餐不存在）' : ''
  for (const id of ids) if (!planMap.value.has(id)) opts.push({ label: `ID: ${id}${missing}`, value: id })
  return opts
}

const dropped = computed(() => droppedRewardKeys(props.template, form.value.type))
const droppedLabels = computed(() => dropped.value.map((k: string) => REWARD_KEY_LABELS[k] ?? k).join('、'))
/** Legacy rate stored in limits (never effective); migrated only when the admin asks for it. */
const legacyRate = computed(() => legacyInviteRate(props.template))
function migrateLegacyRate() {
  if (legacyRate.value !== null) form.value.invite_reward_rate = legacyRate.value
}
/** Stored 0 / false / [] values the backend treats as set; saving removes them. */
const legacyIssues = computed(() => legacyValueIssues(props.template, form.value))
/**
 * The backend multiplies every numeric reward (invite_reward_rate included) by the festival bonus
 * and truncates with intval(), so 0.2 × 1.5 becomes 0 during the event. Returns the effective rate
 * when it differs from the configured one.
 */
const festivalInviteRate = computed<number | null>(() => {
  const rate = form.value.invite_reward_rate
  const bonus = form.value.festival_bonus
  if (!rate || !bonus || bonus <= 1 || form.value.type === 2) return null
  const effective = Math.trunc(rate * bonus)
  return effective !== rate ? effective : null
})

const totalWeight = computed(() =>
  form.value.random_rewards.reduce((sum, r) => sum + (r.weight && r.weight > 0 ? r.weight : 0), 0),
)
function chance(weight: number | null): string {
  if (!weight || weight <= 0 || !totalWeight.value) return '0%'
  return `${Number(((weight / totalWeight.value) * 100).toFixed(1))}%`
}
function addRandom() {
  form.value.random_rewards.push(newRandomRow())
}
function removeRandom(i: number) {
  form.value.random_rewards.splice(i, 1)
}

// ---------- preview ----------
const preview = computed(() => {
  const payload = buildPayload(form.value, props.template)
  const items = rewardItems(payload.rewards, (id) => planMap.value.get(id) ?? `#${id}`)
  return {
    name: form.value.name.trim() || '礼品卡名称',
    type: giftCardTypeLabel(form.value.type),
    items: items.slice(0, 3),
    color: /^#[0-9A-Fa-f]{6}$/.test(form.value.theme_color) ? form.value.theme_color : DEFAULT_THEME_COLOR,
    bg: /^https?:\/\//.test(form.value.background_image.trim()) ? form.value.background_image.trim() : '',
    icon: /^https?:\/\//.test(form.value.icon.trim()) ? form.value.icon.trim() : '',
  }
})
const iconFailed = ref(false)
watch(() => preview.value.icon, () => (iconFailed.value = false))

// ---------- close / submit ----------
async function requestClose() {
  if (submitting.value) return
  if (JSON.stringify(form.value) !== snapshot) {
    const ok = await confirm({ title: '放弃修改', content: '表单有未保存的修改，关闭后将丢失。确定要关闭吗？', positiveText: '关闭' })
    if (!ok) return
  }
  emit('update:show', false)
}

async function submit() {
  submitted.value = true
  serverErrors.value = {}
  if (Object.keys(errors.value).length) {
    message.error('请检查表单输入是否正确')
    return
  }
  const payload = buildPayload(form.value, props.template)
  submitting.value = true
  try {
    const saved = props.template
      ? await updateTemplate({ id: props.template.id, ...payload })
      : await createTemplate(payload)
    message.success(props.template ? '模板更新成功' : '模板创建成功')
    emit('success', saved ?? null)
    emit('update:show', false)
  } catch (e) {
    if (e instanceof ApiError && e.errors) {
      const map: Record<string, string> = {}
      for (const [k, v] of Object.entries(e.errors)) {
        const key = k.startsWith('rewards') ? 'rewards' : k
        map[key] = Array.isArray(v) ? String(v[0]) : String(v)
      }
      serverErrors.value = map
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-drawer
    :show="show"
    :width="appState.isMobile ? '100%' : 780"
    placement="right"
    :mask-closable="!submitting"
    :close-on-esc="!submitting"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : requestClose())"
  >
    <n-drawer-content :title="isEdit ? '编辑模板' : '添加模板'" closable :native-scrollbar="false">
      <n-form label-placement="top" @submit.prevent="submit">
        <n-alert v-if="legacyIssues.length" type="warning" title="存在旧版后台保存的空值，保存后兑换规则会改变" class="block-alert">
          旧版后台清空输入框时会存成 0、关闭或空列表，后端仍按“已设置”处理。本表单不保存空值，以下配置在保存后会被移除：
          <ul class="issue-list">
            <li v-for="it in legacyIssues" :key="it">{{ it }}</li>
          </ul>
          如需保留限制，请在对应字段填写有效值，或改为停用此模板。
        </n-alert>

        <!-- 1. 基础配置 -->
        <section class="section">
          <header class="section-head">
            <h3>基础配置</h3>
            <p>模板名称、类型与启用状态。</p>
          </header>
          <n-form-item label="模板名称" required :validation-status="status('name')" :feedback="err('name')">
            <n-input v-model:value="form.name" placeholder="请输入模板名称" maxlength="255" clearable />
          </n-form-item>
          <n-form-item label="类型" required :validation-status="status('type')" :feedback="err('type')">
            <div class="type-cards" role="radiogroup">
              <button
                v-for="t in GIFT_CARD_TYPES"
                :key="t.value"
                type="button"
                class="type-card"
                :class="{ active: form.type === t.value }"
                role="radio"
                :aria-checked="form.type === t.value"
                @click="form.type = t.value"
              >
                <span class="type-name">{{ t.label }}</span>
                <span class="type-desc">{{ t.desc }}</span>
              </button>
            </div>
          </n-form-item>
          <n-form-item label="描述" :validation-status="status('description')" :feedback="err('description')">
            <n-input
              v-model:value="form.description"
              type="textarea"
              placeholder="请输入礼品卡描述"
              :autosize="{ minRows: 2, maxRows: 5 }"
            />
          </n-form-item>
          <div class="grid-2">
            <n-form-item label="排序" :validation-status="status('sort')" :feedback="err('sort')">
              <n-input-number v-model:value="form.sort" :min="0" :precision="0" placeholder="0" class="full" />
            </n-form-item>
            <n-form-item label="状态" :show-feedback="false">
              <div class="switch-row">
                <div class="switch-text">
                  <div class="switch-title">{{ form.status ? '已启用' : '已禁用' }}</div>
                  <div class="switch-desc">禁用后，此模板将无法生成或兑换新的礼品卡。</div>
                </div>
                <n-switch v-model:value="form.status" />
              </div>
            </n-form-item>
          </div>
        </section>

        <!-- 2. 奖励内容 -->
        <section class="section">
          <header class="section-head">
            <h3>奖励内容</h3>
            <p>{{ GIFT_CARD_TYPES.find((t) => t.value === form.type)?.desc }}</p>
          </header>

          <n-alert v-if="dropped.length" type="warning" :show-icon="true" class="block-alert">
            该模板包含与当前类型无关的奖励：{{ droppedLabels }}。
            后端发放时不区分类型，残留项会被一并发放，保存后将自动移除。
          </n-alert>
          <n-alert v-if="err('rewards')" type="error" :show-icon="true" class="block-alert">{{ err('rewards') }}</n-alert>

          <template v-if="form.type === 1">
            <div class="grid-2">
              <n-form-item label="奖励余额 (元)">
                <n-input-number
                  v-model:value="form.balance"
                  :min="0"
                  :precision="2"
                  :show-button="false"
                  placeholder="请输入奖励的金额(元)"
                  clearable
                  class="full"
                >
                  <template #prefix>¥</template>
                </n-input-number>
              </n-form-item>
              <n-form-item label="奖励流量 (GB)">
                <n-input-number
                  v-model:value="form.transfer_enable"
                  :min="0"
                  :precision="GB_DIGITS"
                  :show-button="false"
                  placeholder="请输入奖励的流量(GB)"
                  clearable
                  class="full"
                >
                  <template #suffix>GB</template>
                </n-input-number>
              </n-form-item>
              <n-form-item label="延长有效期 (天)">
                <n-input-number
                  v-model:value="form.expire_days"
                  :min="1"
                  :precision="0"
                  :show-button="false"
                  placeholder="请输入延长的天数"
                  clearable
                  class="full"
                >
                  <template #suffix>天</template>
                </n-input-number>
              </n-form-item>
              <n-form-item label="增加设备数">
                <n-input-number
                  v-model:value="form.device_limit"
                  :min="1"
                  :precision="0"
                  :show-button="false"
                  placeholder="请输入增加的设备数量"
                  clearable
                  class="full"
                >
                  <template #suffix>个</template>
                </n-input-number>
              </n-form-item>
            </div>
            <div class="switch-row standalone">
              <div class="switch-text">
                <div class="switch-title">重置当月流量</div>
                <div class="switch-desc">开启后，兑换时会将用户当前套餐的已用流量清零。</div>
              </div>
              <n-switch v-model:value="form.reset_package" />
            </div>
            <p class="hint">
              <n-icon :size="14"><information-circle-outline /></n-icon>
              含流量、有效期或重置流量奖励时，只有已订阅套餐的用户可以兑换。延长有效期从“当前到期时间与现在中较晚者”起算；
              长期有效（无到期时间）的用户兑换后会变为有到期时间。
            </p>
          </template>

          <template v-else-if="form.type === 2">
            <div class="grid-2">
              <n-form-item label="指定套餐" required :validation-status="status('plan_id')" :feedback="err('plan_id')">
                <n-select
                  v-model:value="form.plan_id"
                  :options="planOptions(form.plan_id)"
                  :loading="plansLoading"
                  placeholder="请选择一个套餐"
                  filterable
                />
              </n-form-item>
              <n-form-item label="套餐有效期 (天)">
                <n-input-number
                  v-model:value="form.plan_validity_days"
                  :min="1"
                  :precision="0"
                  :show-button="false"
                  placeholder="留空则不调整到期时间"
                  clearable
                  class="full"
                >
                  <template #suffix>天</template>
                </n-input-number>
              </n-form-item>
            </div>
            <p class="hint">
              <n-icon :size="14"><information-circle-outline /></n-icon>
              仅当前没有有效订阅的用户（无套餐、已过期或已封禁）可以兑换；兑换后用户的套餐、权限组、流量、限速和设备数会替换为该套餐的配置。
              有效期留空时不会调整到期时间，已过期用户兑换后仍处于过期状态，建议填写。
            </p>
          </template>

          <template v-else>
            <div class="pool-head">
              <span class="pool-title">随机奖励池</span>
              <span class="muted pool-sum">总权重 {{ totalWeight }}</span>
              <span class="grow" />
              <n-button size="small" dashed @click="addRandom">
                <template #icon><n-icon><add-outline /></n-icon></template>
                添加随机奖励项
              </n-button>
            </div>
            <n-alert v-if="err('random_rewards')" type="error" class="block-alert">{{ err('random_rewards') }}</n-alert>
            <div v-if="!form.random_rewards.length" class="pool-empty muted">
              奖励池为空。兑换时会按权重随机抽取一项奖励发放。
            </div>
            <div v-for="(row, i) in form.random_rewards" :key="row.key" class="pool-item">
              <div class="pool-item-head">
                <span class="pool-index">#{{ i + 1 }}</span>
                <n-tag size="small" :bordered="false" type="info" class="chance">概率 {{ chance(row.weight) }}</n-tag>
                <span class="grow" />
                <n-tooltip>
                  <template #trigger>
                    <n-button size="small" quaternary circle type="error" aria-label="删除" @click="removeRandom(i)">
                      <template #icon><n-icon><trash-outline /></n-icon></template>
                    </n-button>
                  </template>
                  删除此项
                </n-tooltip>
              </div>
              <div class="pool-grid">
                <n-form-item
                  label="权重"
                  required
                  :validation-status="status(`random_${i}`)"
                  :feedback="err(`random_${i}`)"
                >
                  <n-input-number v-model:value="row.weight" :min="1" :precision="0" :show-button="false" placeholder="10" class="full" />
                </n-form-item>
                <n-form-item label="奖励余额 (元)">
                  <n-input-number v-model:value="row.balance" :min="0" :precision="2" :show-button="false" clearable class="full">
                    <template #prefix>¥</template>
                  </n-input-number>
                </n-form-item>
                <n-form-item label="奖励流量 (GB)">
                  <n-input-number v-model:value="row.transfer_enable" :min="0" :precision="GB_DIGITS" :show-button="false" clearable class="full">
                    <template #suffix>GB</template>
                  </n-input-number>
                </n-form-item>
                <n-form-item label="延长有效期 (天)">
                  <n-input-number v-model:value="row.expire_days" :min="1" :precision="0" :show-button="false" clearable class="full">
                    <template #suffix>天</template>
                  </n-input-number>
                </n-form-item>
                <n-form-item label="增加设备数">
                  <n-input-number v-model:value="row.device_limit" :min="1" :precision="0" :show-button="false" clearable class="full">
                    <template #suffix>个</template>
                  </n-input-number>
                </n-form-item>
              </div>
            </div>
            <p class="hint">
              <n-icon :size="14"><information-circle-outline /></n-icon>
              每次兑换按“权重 / 总权重”的概率抽取一项；全部奖励项留空的条目相当于“未中奖”。
            </p>
          </template>

          <template v-if="legacyRate !== null && form.type !== 2">
            <n-alert v-if="form.invite_reward_rate === null" type="info" :show-icon="true" class="block-alert invite-alert">
              旧版后台把邀请人奖励比例 <b class="num">{{ formatRate(legacyRate) }}</b> 保存在“使用限制”中，后端不会读取，因此目前并未生效（邀请人没有获得返利）。
              不迁移则保持现状；迁移后保存，邀请人将开始按该比例获得返利。
              <div class="alert-actions">
                <n-button size="small" type="primary" secondary @click="migrateLegacyRate">迁移并启用</n-button>
              </div>
            </n-alert>
            <n-alert v-else type="warning" :show-icon="true" class="block-alert invite-alert">
              保存后邀请人将按 <b class="num">{{ formatRate(form.invite_reward_rate) }}</b> 获得返利（此前未生效），旧版“使用限制”中的比例会被移除。
              <div class="alert-actions">
                <n-button size="small" secondary @click="form.invite_reward_rate = null">撤销，不启用返利</n-button>
              </div>
            </n-alert>
          </template>
          <n-form-item
            v-if="form.type !== 2"
            label="邀请人奖励比例"
            :validation-status="status('invite_reward_rate')"
            :feedback="err('invite_reward_rate')"
            class="invite-item"
          >
            <div class="inline-field">
              <n-input-number
                v-model:value="form.invite_reward_rate"
                :min="0"
                :max="1"
                :step="0.05"
                :precision="2"
                placeholder="例如: 0.2 (代表20%)"
                clearable
                class="rate-input"
              />
              <span v-if="form.invite_reward_rate" class="muted rate-eq">= {{ formatRate(form.invite_reward_rate) }}</span>
            </div>
            <template #feedback>
              <span v-if="err('invite_reward_rate')">{{ err('invite_reward_rate') }}</span>
              <span v-else-if="festivalInviteRate !== null" class="warn-text">
                节日活动期间，后端会把该比例也乘以节日乘数并取整：{{ form.invite_reward_rate }} × {{ form.festival_bonus }} →
                {{ festivalInviteRate }}{{ festivalInviteRate === 0 ? '，即活动期间邀请人不会获得奖励' : '' }}。
              </span>
              <span v-else class="muted">
                留空则不奖励。使用者有邀请人时，邀请人获得 余额奖励 × 比例 与 流量奖励 × 比例（按实际抽中的奖励计算）。
              </span>
            </template>
          </n-form-item>
        </section>

        <!-- 3. 使用条件 -->
        <section class="section">
          <header class="section-head">
            <h3>使用条件</h3>
            <p>不满足条件的用户无法兑换此模板的礼品卡。</p>
          </header>
          <div class="switch-grid">
            <div class="switch-row">
              <div class="switch-text">
                <div class="switch-title">仅限新用户</div>
                <div class="switch-desc">注册时间超过下方天数的用户不可兑换。</div>
              </div>
              <n-switch v-model:value="form.new_user_only" />
            </div>
            <div class="switch-row">
              <div class="switch-text">
                <div class="switch-title">仅限付费用户</div>
                <div class="switch-desc">没有已完成订单的用户不可兑换。</div>
              </div>
              <n-switch v-model:value="form.paid_user_only" />
            </div>
            <div class="switch-row">
              <div class="switch-text">
                <div class="switch-title">需要邀请关系</div>
                <div class="switch-desc">没有邀请人的用户不可兑换。</div>
              </div>
              <n-switch v-model:value="form.require_invite" />
            </div>
          </div>
          <n-form-item label="新用户注册天数限制" class="mt">
            <n-input-number
              v-model:value="form.new_user_max_days"
              :min="1"
              :precision="0"
              :show-button="false"
              :disabled="!form.new_user_only"
              placeholder="例如: 7 (仅限注册7天内的用户)"
              clearable
              class="full"
            >
              <template #suffix>天</template>
            </n-input-number>
            <template #feedback>
              <span class="muted">仅在开启“仅限新用户”时生效，留空默认 7 天。</span>
            </template>
          </n-form-item>
          <div class="grid-2">
            <n-form-item label="允许的套餐">
              <n-select
                v-model:value="form.allowed_plans"
                :options="planOptions(form.allowed_plans)"
                :loading="plansLoading"
                multiple
                filterable
                clearable
                max-tag-count="responsive"
                placeholder="选择允许兑换的套餐 (留空则不限制)"
              />
              <template #feedback>
                <span class="muted">当前套餐不在列表中的用户不可兑换；没有套餐的用户不受此限制。</span>
              </template>
            </n-form-item>
            <n-form-item>
              <template #label>
                <span class="label-with-tag">
                  禁止的套餐
                  <n-tooltip>
                    <template #trigger>
                      <n-tag size="tiny" type="warning" :bordered="false">暂未生效</n-tag>
                    </template>
                    后端目前不校验此条件，配置会被保存但不会限制兑换。
                  </n-tooltip>
                </span>
              </template>
              <n-select
                v-model:value="form.disallowed_plans"
                :options="planOptions(form.disallowed_plans)"
                :loading="plansLoading"
                multiple
                filterable
                clearable
                max-tag-count="responsive"
                placeholder="选择禁止兑换的套餐 (留空则不限制)"
              />
            </n-form-item>
          </div>
        </section>

        <!-- 4. 使用限制 -->
        <section class="section">
          <header class="section-head">
            <h3>使用限制</h3>
            <p>按用户统计同一模板的兑换次数与间隔。</p>
          </header>
          <div class="grid-2">
            <n-form-item label="单用户最大使用次数">
              <n-input-number
                v-model:value="form.max_use_per_user"
                :min="1"
                :precision="0"
                :show-button="false"
                placeholder="留空则不限制"
                clearable
                class="full"
              >
                <template #suffix>次</template>
              </n-input-number>
            </n-form-item>
            <n-form-item label="同类卡冷却时间 (小时)">
              <n-input-number
                v-model:value="form.cooldown_hours"
                :min="1"
                :precision="0"
                :show-button="false"
                placeholder="留空则不限制"
                clearable
                class="full"
              >
                <template #suffix>小时</template>
              </n-input-number>
            </n-form-item>
          </div>
        </section>

        <!-- 5. 特殊配置 -->
        <section class="section">
          <header class="section-head">
            <h3>特殊配置</h3>
            <p>活动期间内兑换时，所有数值奖励乘以节日奖励乘数。</p>
          </header>
          <div class="grid-2">
            <n-form-item label="活动开始时间" :validation-status="status('start_time')" :feedback="err('start_time')">
              <n-date-picker
                v-model:value="form.start_time"
                type="datetime"
                clearable
                default-time="00:00:00"
                placeholder="请选择开始时间"
                class="full"
              />
            </n-form-item>
            <n-form-item label="活动结束时间" :validation-status="status('end_time')" :feedback="err('end_time')">
              <n-date-picker
                v-model:value="form.end_time"
                type="datetime"
                clearable
                default-time="23:59:59"
                placeholder="请选择结束时间"
                class="full"
              />
            </n-form-item>
            <n-form-item label="节日奖励乘数" :validation-status="status('festival_bonus')">
              <n-input-number
                v-model:value="form.festival_bonus"
                :min="1"
                :step="0.1"
                :precision="2"
                placeholder="例如: 1.5 (代表1.5倍)"
                clearable
                class="full"
              >
                <template #suffix>x</template>
              </n-input-number>
              <template #feedback>
                <span v-if="err('festival_bonus')">{{ err('festival_bonus') }}</span>
                <span v-else class="muted">需大于 1 且同时设置开始和结束时间才会生效；活动期间所有数值奖励乘以该倍数后取整。</span>
              </template>
            </n-form-item>
          </div>
        </section>

        <!-- 6. 显示效果 -->
        <section class="section last">
          <header class="section-head">
            <h3>显示效果</h3>
            <p>用户端展示礼品卡时使用的图标、背景与主题色。</p>
          </header>
          <div class="display-wrap">
            <div class="display-fields">
              <n-form-item label="图标" :validation-status="status('icon')" :feedback="err('icon')">
                <n-input v-model:value="form.icon" placeholder="请输入图标的URL" maxlength="255" clearable />
              </n-form-item>
              <n-form-item label="背景图片" :validation-status="status('background_image')" :feedback="err('background_image')">
                <n-input v-model:value="form.background_image" placeholder="请输入背景图片的URL" maxlength="255" clearable />
              </n-form-item>
              <n-form-item label="主题颜色" :validation-status="status('theme_color')" :feedback="err('theme_color')">
                <n-color-picker
                  v-model:value="form.theme_color"
                  :modes="['hex']"
                  :show-alpha="false"
                  :swatches="['#1890ff', '#13c2c2', '#52c41a', '#faad14', '#f5222d', '#eb2f96', '#722ed1', '#2f54eb']"
                />
              </n-form-item>
            </div>
            <div class="preview-wrap">
              <div class="preview-label muted">预览</div>
              <div
                class="preview-card"
                :style="{
                  '--tc': preview.color,
                  backgroundImage: preview.bg ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url(${JSON.stringify(preview.bg)})` : undefined,
                }"
              >
                <div class="preview-top">
                  <span class="preview-icon">
                    <img v-if="preview.icon && !iconFailed" :src="preview.icon" alt="" @error="iconFailed = true" />
                    <n-icon v-else :size="20"><gift-outline /></n-icon>
                  </span>
                  <span class="preview-type">{{ preview.type }}</span>
                </div>
                <div class="preview-name">{{ preview.name }}</div>
                <div class="preview-items">
                  <span v-for="it in preview.items" :key="it">{{ it }}</span>
                  <span v-if="!preview.items.length">暂无奖励</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </n-form>

      <template #footer>
        <div class="footer">
          <n-button :disabled="submitting" @click="requestClose">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="submit">{{ isEdit ? '保存' : '创建' }}</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.section {
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--divider-color, var(--border-color));
}
.section.last {
  border-bottom: none;
  margin-bottom: 0;
}
.section-head {
  margin-bottom: 12px;
}
.section-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.section-head p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.full {
  width: 100%;
}
.mt {
  margin-top: 12px;
}
.type-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}
.type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}
.type-card:hover {
  background: var(--hover-color);
}
.type-card.active {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
}
.type-card:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}
.type-name {
  font-weight: 600;
  font-size: 13px;
}
.type-card.active .type-name {
  color: var(--primary-color);
}
.type-desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
}
.switch-row.standalone {
  margin-bottom: 8px;
}
.switch-text {
  min-width: 0;
}
.switch-title {
  font-size: 13px;
  font-weight: 500;
}
.switch-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}
.switch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 0 12px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-muted);
}
.hint .n-icon {
  flex: none;
  margin-top: 2px;
}
.block-alert {
  margin-bottom: 12px;
}
.pool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.pool-title {
  font-weight: 500;
}
.pool-sum {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.pool-empty {
  padding: 18px;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  text-align: center;
  font-size: 13px;
}
.pool-item {
  padding: 8px 12px 0;
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.pool-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pool-index {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-muted);
}
.chance {
  font-variant-numeric: tabular-nums;
}
.pool-grid {
  display: grid;
  grid-template-columns: 90px repeat(4, minmax(0, 1fr));
  gap: 0 10px;
}
.grow {
  flex: 1;
}
.invite-item {
  margin-top: 12px;
}
.invite-alert {
  margin-top: 12px;
}
.alert-actions {
  margin-top: 8px;
}
.issue-list {
  margin: 6px 0;
  padding-left: 18px;
  line-height: 1.6;
}
.num {
  font-variant-numeric: tabular-nums;
}
.warn-text {
  color: var(--warning-color);
}
.inline-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.rate-input {
  width: 220px;
  max-width: 100%;
}
.rate-eq {
  font-variant-numeric: tabular-nums;
}
.label-with-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.display-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
}
.preview-label {
  font-size: 12px;
  margin-bottom: 6px;
}
.preview-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 150px;
  padding: 16px;
  border-radius: 14px;
  color: #fff;
  background-color: var(--tc);
  background-image: linear-gradient(135deg, var(--tc), color-mix(in srgb, var(--tc) 55%, #000));
  background-size: cover;
  background-position: center;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--tc) 30%, transparent);
}
.preview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.preview-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.18);
  overflow: hidden;
}
.preview-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}
.preview-name {
  font-size: 17px;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.preview-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 12px;
  opacity: 0.92;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 767px) {
  .grid-2,
  .switch-grid,
  .display-wrap {
    grid-template-columns: minmax(0, 1fr);
  }
  .type-cards {
    grid-template-columns: minmax(0, 1fr);
  }
  .pool-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
