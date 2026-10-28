<script setup lang="ts">
// Add / edit plan (POST /plan/save). Spec: commerce.md §2.6 and §2.9.
import { computed, reactive, ref, watch } from 'vue'
import {
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NDynamicTags,
  NButton,
  NIcon,
  NTooltip,
  NCheckbox,
  NDivider,
  type FormInst,
  type FormRules,
  type FormItemRule,
} from 'naive-ui'
import { AddOutline, TrashOutline, DocumentTextOutline, WarningOutline } from '@vicons/ionicons5'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { fetchServerGroups, type ServerGroupBrief } from '@/api/common'
import {
  savePlan,
  planPrices,
  PLAN_PERIODS,
  RESET_METHODS,
  PLAN_CONTENT_TEMPLATE,
  type Plan,
  type PlanPeriod,
  type PlanSavePayload,
} from '@/api/plan'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import CreateGroupModal from './CreateGroupModal.vue'

const props = defineProps<{ show: boolean; plan: Plan | null }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [created: boolean] }>()

/** Select value standing for reset_traffic_method = null (follow system setting). */
const FOLLOW_SYSTEM = -1

const PERIODIC = PLAN_PERIODS.filter((p) => p.key !== 'onetime' && p.key !== 'reset_traffic')
const EXTRA_PERIODS = [
  { meta: PLAN_PERIODS.find((p) => p.key === 'onetime')!, hint: '一次性流量包，无时间限制' },
  { meta: PLAN_PERIODS.find((p) => p.key === 'reset_traffic')!, hint: '重置流量包，可多次购买使用' },
]

const emptyPrices = (): Record<PlanPeriod, number | null> =>
  Object.fromEntries(PLAN_PERIODS.map((p) => [p.key, null])) as Record<PlanPeriod, number | null>

const formRef = ref<FormInst | null>(null)
const form = reactive({
  name: '',
  tags: [] as string[],
  group_id: null as number | null,
  transfer_enable: null as number | null,
  speed_limit: null as number | null,
  device_limit: null as number | null,
  capacity_limit: null as number | null,
  reset_method: FOLLOW_SYSTEM as number,
  prices: emptyPrices(),
  content: '',
  force_update: false,
})
const basePrice = ref<number | null>(null)
const submitting = ref(false)
const groups = ref<ServerGroupBrief[]>([])
const groupsLoading = ref(false)
const createGroupOpen = ref(false)

const isEdit = computed(() => !!props.plan)
const drawerWidth = computed(() => (appState.isMobile ? '100%' : 780))
const groupOptions = computed(() => groups.value.map((g) => ({ label: g.name, value: g.id })))
const resetOptions = RESET_METHODS.map((m) => ({ label: m.label, value: m.value ?? FOLLOW_SYSTEM }))

const rules: FormRules = {
  name: [
    {
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => {
        const s = (v ?? '').trim()
        if (!s) return new Error('请输入套餐名称')
        if (s.length > 255) return new Error('套餐名称不能超过 255 个字符')
        return true
      },
    },
  ],
  transfer_enable: [
    {
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: number | null) => {
        if (v === null || v === undefined) return new Error('请输入流量')
        if (!Number.isInteger(v) || v < 1) return new Error('流量必须是大于 0 的整数')
        return true
      },
    },
  ],
}

function init() {
  const p = props.plan
  const prices = p ? planPrices(p) : {}
  form.name = p?.name ?? ''
  form.tags = Array.isArray(p?.tags) ? [...p!.tags!] : []
  form.group_id = p?.group_id ?? null
  form.transfer_enable = p?.transfer_enable ?? null
  form.speed_limit = p?.speed_limit ?? null
  form.device_limit = p?.device_limit ?? null
  form.capacity_limit = p?.capacity_limit ?? null
  form.reset_method = p?.reset_traffic_method ?? FOLLOW_SYSTEM
  const next = emptyPrices()
  for (const meta of PLAN_PERIODS) next[meta.key] = prices[meta.key] ?? null
  form.prices = next
  form.content = p?.content ?? ''
  form.force_update = false
  basePrice.value = null
  formRef.value?.restoreValidation()
}

async function loadGroups() {
  groupsLoading.value = true
  try {
    groups.value = (await fetchServerGroups()).slice().sort((a, b) => a.id - b.id)
  } catch {
    groups.value = []
  } finally {
    groupsLoading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    init()
    void loadGroups()
  },
)

async function onGroupCreated(name: string) {
  await loadGroups()
  const created = groups.value.filter((g) => g.name === name).sort((a, b) => b.id - a.id)[0]
  if (created) form.group_id = created.id
}

// Tags: Enter adds one; comma-separated input is split, trimmed and de-duplicated.
function onTags(v: string[]) {
  const out: string[] = []
  for (const raw of v) {
    for (const t of raw.split(/[,，]/)) {
      const s = t.trim()
      if (s && !out.includes(s)) out.push(s)
    }
  }
  form.tags = out
}

// "基础价格": fill every period with months × discount (官方: 季 0.95 / 半年 0.9 / 年 0.85 / 两年 0.8 / 三年 0.75).
function onBasePrice(v: number | null) {
  basePrice.value = v
  if (v === null || !Number.isFinite(v)) return
  for (const meta of PLAN_PERIODS) {
    form.prices[meta.key] = Number((v * meta.months * meta.discount).toFixed(2))
  }
}

function clearPrices() {
  form.prices = emptyPrices()
  basePrice.value = null
}

const pricedCount = computed(() => PLAN_PERIODS.filter((p) => Number(form.prices[p.key]) > 0).length)

// What each placeholder becomes for users with the current form values (mirrors PlanResource::formatContent).
const placeholderHints = computed(() => [
  { token: '{{transfer}}', value: form.transfer_enable ?? '-' },
  { token: '{{speed}}', value: form.speed_limit ?? '不限制' },
  { token: '{{devices}}', value: form.device_limit ?? '不限制' },
  {
    token: '{{reset_method}}',
    value: RESET_METHODS.find((m) => (m.value ?? FOLLOW_SYSTEM) === form.reset_method)?.userText ?? '-',
  },
])

// Preview shows what users will see; the saved content keeps the raw placeholders.
function previewTransform(src: string) {
  return placeholderHints.value.reduce((s, p) => s.split(p.token).join(String(p.value)), src)
}

async function applyTemplate() {
  if (form.content.trim()) {
    const ok = await confirm({
      title: '使用默认模板',
      content: '当前套餐说明将被模板内容整体替换。模板中的流量、限速、设备数与重置方式使用占位符，用户端会按套餐当前设置自动替换。',
      positiveText: '替换',
    })
    if (!ok) return
  }
  form.content = PLAN_CONTENT_TEMPLATE
}

/** Keep only periods priced > 0 (rounded to cents); 0 / empty must not be sent (would sell for free). */
function cleanPrices(): Partial<Record<PlanPeriod, number>> {
  const out: Partial<Record<PlanPeriod, number>> = {}
  for (const meta of PLAN_PERIODS) {
    const n = Number(form.prices[meta.key])
    if (form.prices[meta.key] !== null && Number.isFinite(n) && n > 0) out[meta.key] = Math.round(n * 100) / 100
  }
  return out
}

function close() {
  emit('update:show', false)
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    message.error('表单校验失败，请检查并修正后重试')
    return
  }
  const plan = props.plan
  if (plan && form.force_update) {
    const ok = await confirm({
      title: '强制更新用户套餐',
      content: `保存后会把该套餐下全部 ${plan.users_count ?? 0} 名用户的权限组、流量（${form.transfer_enable} GB）、限速和设备数覆盖为当前设置。用户被单独调整或通过礼品卡追加的流量、设备数会丢失，且无法撤销。`,
      positiveText: '确认强制更新',
      type: 'error',
    })
    if (!ok) return
  }
  const payload: PlanSavePayload = {
    name: form.name.trim(),
    tags: form.tags,
    group_id: form.group_id,
    transfer_enable: form.transfer_enable as number,
    speed_limit: form.speed_limit,
    device_limit: form.device_limit,
    capacity_limit: form.capacity_limit,
    reset_traffic_method: form.reset_method === FOLLOW_SYSTEM ? null : form.reset_method,
    prices: cleanPrices(),
    content: form.content ?? '',
  }
  if (plan) {
    payload.id = plan.id
    payload.force_update = form.force_update
  }
  submitting.value = true
  try {
    await savePlan(payload)
    message.success(plan ? '套餐更新成功' : '套餐添加成功')
    emit('saved', !plan)
    close()
  } catch {
    /* 422 / 400 toasted by the http client */
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-drawer
    :show="show"
    :width="drawerWidth"
    placement="right"
    :mask-closable="!submitting"
    :close-on-esc="!submitting"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-drawer-content :title="isEdit ? '编辑套餐' : '添加套餐'" closable :native-scrollbar="false">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" require-mark-placement="right-hanging">
        <div class="form-grid">
          <n-form-item label="套餐名称" path="name" required class="span-2">
            <n-input v-model:value="form.name" placeholder="请输入套餐名称" maxlength="255" />
          </n-form-item>
          <n-form-item label="标签" class="span-2">
            <n-dynamic-tags :value="form.tags" @update:value="onTags">
              <template #trigger="{ activate, disabled }">
                <n-button size="small" dashed :disabled="disabled" @click="activate()">
                  <template #icon><n-icon><add-outline /></n-icon></template>
                  添加标签
                </n-button>
              </template>
            </n-dynamic-tags>
            <template #feedback><span class="muted">输入标签后按回车确认，可用逗号一次输入多个</span></template>
          </n-form-item>

          <n-form-item path="group_id">
            <template #label>
              <span class="label-row">
                服务器分组
                <n-button text type="primary" size="tiny" @click="createGroupOpen = true">
                  <template #icon><n-icon><add-outline /></n-icon></template>
                  添加分组
                </n-button>
              </span>
            </template>
            <n-select
              v-model:value="form.group_id"
              :options="groupOptions"
              :loading="groupsLoading"
              clearable
              filterable
              placeholder="请选择服务器分组"
            />
          </n-form-item>
          <n-form-item label="流量重置方式">
            <n-select v-model:value="form.reset_method" :options="resetOptions" placeholder="请选择重置方式" />
          </n-form-item>

          <n-form-item label="流量" path="transfer_enable" required>
            <n-input-number
              v-model:value="form.transfer_enable"
              :min="1"
              :precision="0"
              :show-button="false"
              placeholder="请输入流量"
              class="w-full"
            >
              <template #suffix>GB</template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="速度限制">
            <n-input-number
              v-model:value="form.speed_limit"
              :min="0"
              :precision="0"
              :show-button="false"
              clearable
              placeholder="留空不限速"
              class="w-full"
            >
              <template #suffix>Mbps</template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="设备限制">
            <n-input-number
              v-model:value="form.device_limit"
              :min="0"
              :precision="0"
              :show-button="false"
              clearable
              placeholder="留空不限制"
              class="w-full"
            >
              <template #suffix>台</template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="容量限制">
            <n-input-number
              v-model:value="form.capacity_limit"
              :min="0"
              :precision="0"
              :show-button="false"
              clearable
              placeholder="留空不限制"
              class="w-full"
            >
              <template #suffix>人</template>
            </n-input-number>
            <template #feedback>
              <span :class="form.capacity_limit === 0 ? 'warn-text' : 'muted'">
                {{ form.capacity_limit === 0 ? '容量为 0：新用户将无法购买此套餐' : '留空不限制；0 表示停售（新用户无法购买）' }}
              </span>
            </template>
          </n-form-item>
        </div>

        <section class="price-box">
          <div class="price-head">
            <div class="price-title">
              价格设置
              <span class="muted price-count">已设置 {{ pricedCount }} 个周期</span>
            </div>
            <div class="price-tools">
              <n-input-number
                :value="basePrice"
                :min="0"
                :precision="2"
                :show-button="false"
                clearable
                size="small"
                placeholder="基础月价"
                class="base-input"
                @update:value="onBasePrice"
              >
                <template #prefix>¥</template>
              </n-input-number>
              <n-tooltip>
                <template #trigger>
                  <n-button size="small" quaternary aria-label="清空所有价格" @click="clearPrices">
                    <template #icon><n-icon><trash-outline /></n-icon></template>
                    清空
                  </n-button>
                </template>
                清空所有价格
              </n-tooltip>
            </div>
          </div>
          <div class="price-grid">
            <n-form-item v-for="meta in PERIODIC" :key="meta.key" :label="meta.label" :show-feedback="false">
              <n-input-number
                v-model:value="form.prices[meta.key]"
                :min="0"
                :precision="2"
                :show-button="false"
                clearable
                placeholder="不提供"
                class="w-full num"
              >
                <template #prefix>¥</template>
              </n-input-number>
            </n-form-item>
          </div>
          <n-divider class="price-divider" />
          <div class="price-grid two">
            <n-form-item v-for="x in EXTRA_PERIODS" :key="x.meta.key" :label="x.meta.label">
              <n-input-number
                v-model:value="form.prices[x.meta.key]"
                :min="0"
                :precision="2"
                :show-button="false"
                clearable
                placeholder="不提供"
                class="w-full num"
              >
                <template #prefix>¥</template>
              </n-input-number>
              <template #feedback><span class="muted">{{ x.hint }}</span></template>
            </n-form-item>
          </div>
          <p class="muted price-hint">
            单位为元。留空或填 0 表示不提供该周期（不会以 0 元出售）。填写基础月价会按 季付 95 折、半年付 9 折、年付 85 折、两年付 8 折、三年付 75 折 自动计算各周期价格。
          </p>
        </section>

        <n-form-item class="content-item">
          <template #label>
            <span class="label-row">
              套餐说明
              <n-tooltip>
                <template #trigger>
                  <n-button text type="primary" size="tiny" @click="applyTemplate">
                    <template #icon><n-icon><document-text-outline /></n-icon></template>
                    使用模板
                  </n-button>
                </template>
                使用默认模板（流量、限速、设备数与重置方式用占位符，随套餐设置自动同步）
              </n-tooltip>
            </span>
          </template>
          <markdown-editor
            v-model:value="form.content"
            :rows="12"
            placeholder="支持 Markdown 格式，也可使用 HTML"
            :preview-transform="previewTransform"
          />
          <template #feedback>
            <div class="placeholder-hint muted">
              <span>占位符会在用户端按套餐当前设置自动替换（预览已按当前表单替换）：</span>
              <span v-for="p in placeholderHints" :key="p.token" class="placeholder-item">
                <code class="mono">{{ p.token }}</code>
                <span>→</span>
                <span class="num">{{ p.value }}</span>
              </span>
            </div>
          </template>
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="drawer-footer">
          <div class="footer-left">
            <template v-if="isEdit">
              <n-checkbox v-model:checked="form.force_update">强制更新用户套餐</n-checkbox>
              <span v-if="form.force_update" class="warn-text force-tip">
                <n-icon :size="14"><warning-outline /></n-icon>
                将覆盖 {{ plan?.users_count ?? 0 }} 名用户的权限组、流量、限速与设备数
              </span>
            </template>
          </div>
          <div class="footer-right">
            <n-button :disabled="submitting" @click="close">取消</n-button>
            <n-button type="primary" :loading="submitting" @click="submit">提交</n-button>
          </div>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>

  <create-group-modal v-model:show="createGroupOpen" @created="onGroupCreated" />
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
.span-2 {
  grid-column: span 2;
}
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-2 {
    grid-column: auto;
  }
}
.w-full {
  width: 100%;
}
.label-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.warn-text {
  color: var(--warning-color);
}
.price-box {
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  padding: 12px 14px 4px;
  margin-bottom: 20px;
}
.price-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.price-title {
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.price-count {
  font-weight: 400;
  font-size: 12px;
}
.price-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}
.base-input {
  width: 140px;
}
.price-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 12px;
}
.price-grid :deep(.n-form-item) {
  margin-bottom: 12px;
}
.price-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 640px) {
  .price-grid,
  .price-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.price-divider {
  margin: 0 0 12px !important;
}
.price-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.6;
}
.num :deep(input) {
  font-variant-numeric: tabular-nums;
}
.content-item :deep(.n-form-item-blank) {
  display: block;
}
.placeholder-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding-top: 4px;
  font-size: 12px;
  line-height: 1.6;
}
.placeholder-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.placeholder-item code {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--code-bg);
  font-size: 11.5px;
}
.placeholder-item .num {
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}
.drawer-footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.footer-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.force-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
