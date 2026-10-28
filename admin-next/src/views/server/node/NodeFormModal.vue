<script setup lang="ts">
// Create / edit node modal (common fields + per-protocol sub form + advanced dialog).
import { computed, h, reactive, ref, watch, type InputHTMLAttributes } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItemGi,
  NGrid,
  NIcon,
  NInput,
  NInputGroup,
  NInputNumber,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
  NTooltip,
  type FormInst,
  type FormItemRule,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import { AddOutline, ArrowForwardOutline, OptionsOutline, ServerOutline } from '@vicons/ionicons5'
import { fetchMachines, saveNode, type MachineBrief, type NodeType, type ServerNode } from '@/api/node'
import { fetchServerGroups, fetchServerRoutes, type ServerGroupBrief, type ServerRouteBrief } from '@/api/common'
import { appState } from '@/stores/app'
import { confirm, message } from '@/utils/discrete'
import { blankForm, buildSavePayload, formFromNode, type FormOriginal, type NodeFormState } from './form'
import {
  MACHINE_STATUS_META,
  NODE_TYPES,
  STANDALONE,
  machineStatus,
  typeColor,
  typeLabel,
  typeOptions,
  CERT_TYPES,
  MULTIPLEX_TYPES,
} from './meta'
import {
  multiplexOf,
  protocolDefaults,
  type AnytlsState,
  type HysteriaState,
  type MieruState,
  type MultiplexState,
  type ProtocolState,
  type ShadowsocksState,
  type TlsSwitchState,
  type TrojanState,
  type TuicState,
  type VlessState,
  type VmessState,
} from './protocol'
import RateRanges from './RateRanges.vue'
import AdvancedDialog, { type AdvancedResult, type AdvancedTab } from './AdvancedDialog.vue'
import GroupCreateDialog from './GroupCreateDialog.vue'
import LabelTip from './LabelTip.vue'
import ShadowsocksForm from './protocols/ShadowsocksForm.vue'
import VmessForm from './protocols/VmessForm.vue'
import VlessForm from './protocols/VlessForm.vue'
import TrojanForm from './protocols/TrojanForm.vue'
import HysteriaForm from './protocols/HysteriaForm.vue'
import TuicForm from './protocols/TuicForm.vue'
import TlsSwitchForm from './protocols/TlsSwitchForm.vue'
import AnytlsForm from './protocols/AnytlsForm.vue'
import MieruForm from './protocols/MieruForm.vue'

const props = defineProps<{
  show: boolean
  /** Node being edited; null = create. */
  node: ServerNode | null
  /** All nodes (parent candidates). */
  nodes: ServerNode[]
  /** Prefill for "新增节点到此服务器". */
  presetMachineId?: number | null
}>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: []; groupCreated: [] }>()

const formRef = ref<FormInst | null>(null)
const form = reactive<NodeFormState>(blankForm())
const saving = ref(false)
const loadingLookups = ref(false)
const groups = ref<ServerGroupBrief[]>([])
const routes = ref<ServerRouteBrief[]>([])
const machines = ref<MachineBrief[]>([])
const showGroupDialog = ref(false)
const showAdvanced = ref(false)
const advancedTab = ref<AdvancedTab | null>(null)

/** Per-type protocol cache so switching types back and forth keeps edits (official behaviour). */
const cache = new Map<NodeType, ProtocolState>()
let original: FormOriginal | null = null

const isEdit = computed(() => !!props.node)
const title = computed(() => (isEdit.value ? '编辑节点' : '新建节点'))

// ---- lifecycle ----

async function loadLookups() {
  loadingLookups.value = true
  const [g, r, m] = await Promise.allSettled([fetchServerGroups(), fetchServerRoutes(), fetchMachines(true)])
  if (g.status === 'fulfilled') groups.value = g.value
  if (r.status === 'fulfilled') routes.value = r.value
  if (m.status === 'fulfilled') machines.value = m.value
  loadingLookups.value = false
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    cache.clear()
    original = null
    Object.assign(form, blankForm())
    if (props.node) {
      const loaded = formFromNode(props.node)
      original = loaded.original
      Object.assign(form, loaded.form)
      if (form.type && form.protocol_settings) cache.set(form.type, form.protocol_settings)
    } else if (props.presetMachineId) {
      form.machine_id = props.presetMachineId
      form.enabled = true
    }
    void loadLookups()
    setTimeout(() => formRef.value?.restoreValidation(), 0)
  },
  { immediate: true },
)

function close() {
  emit('update:show', false)
}

// ---- type ----

function setType(t: NodeType) {
  if (form.type === t) return
  if (form.type && form.protocol_settings) cache.set(form.type, form.protocol_settings)
  form.type = t
  form.protocol_settings = cache.get(t) ?? protocolDefaults(t)
  cache.set(t, form.protocol_settings)
  if (form.parent_id && !parentCandidates.value.some((n) => n.id === form.parent_id)) form.parent_id = 0
  // code is unique per type: re-check against the new type.
  if (form.code.trim()) formRef.value?.validate(undefined, (rule) => rule.key === 'code').catch(() => undefined)
}

const renderTypeLabel = (o: SelectOption) =>
  h('span', { class: 'nf-type-opt' }, [
    h('i', { class: 'nf-dot', style: { background: typeColor(String(o.value), appState.isDark) } }),
    o.label as string,
  ])

// ---- options ----

const groupOptions = computed(() => {
  const opts = groups.value.map((g) => ({ label: g.name, value: String(g.id) }))
  for (const id of form.group_ids) {
    if (!opts.some((o) => o.value === id)) opts.push({ label: `已删除的权限组 #${id}`, value: id })
  }
  return opts
})

const routeOptions = computed(() => {
  const opts = routes.value.map((r) => ({ label: r.remarks || `路由 #${r.id}`, value: String(r.id) }))
  for (const id of form.route_ids) {
    if (!opts.some((o) => o.value === id)) opts.push({ label: `已删除的路由 #${id}`, value: id })
  }
  return opts
})

const parentCandidates = computed(() =>
  props.nodes.filter(
    (n) => (!n.parent_id || Number(n.parent_id) === 0) && n.type === form.type && n.id !== props.node?.id,
  ),
)
/**
 * Current parent that is not a valid candidate (dangling id of a deleted node, or legacy data).
 * `blocking`: the backend would reject it (422), so submit is stopped with a field error.
 */
const parentIssue = computed<{ blocking: boolean; text: string } | null>(() => {
  const cur = form.parent_id
  if (!cur || !form.type || parentCandidates.value.some((n) => n.id === cur)) return null
  const p = props.nodes.find((n) => n.id === cur)
  if (!p) return { blocking: true, text: `父节点 #${cur} 已被删除，请重新选择或改为“无”` }
  if (p.id === props.node?.id) return { blocking: true, text: '节点不能选择自己作为父节点，请重新选择或改为“无”' }
  if (p.type !== form.type) return { blocking: false, text: '当前父节点与本节点协议类型不同，建议重新选择或改为“无”' }
  return { blocking: false, text: '当前父节点自身也有父节点，建议重新选择或改为“无”' }
})
const parentOptions = computed<SelectOption[]>(() => {
  const opts: SelectOption[] = [{ label: '无', value: 0 }]
  for (const n of parentCandidates.value) opts.push({ label: `${n.name}`, value: n.id, id: n.id, code: n.code })
  const cur = form.parent_id
  if (parentIssue.value) {
    const p = props.nodes.find((n) => n.id === cur)
    opts.push({
      label: p ? `${p.name}（不可作为父节点）` : `已删除的节点 #${cur}`,
      value: cur,
      id: cur,
      code: p?.code,
      invalid: true,
    })
  }
  return opts
})
const renderParentLabel = (o: SelectOption) =>
  o.value === 0
    ? (o.label as string)
    : h('span', { class: ['nf-opt-row', o.invalid ? 'nf-opt-invalid' : ''] }, [
        h('span', null, o.label as string),
        h('span', { class: 'nf-opt-sub' }, `#${o.code || o.id}`),
      ])

const machineOptions = computed<SelectOption[]>(() => {
  const list = machines.value.filter((m) => m.is_active !== false || m.id === form.machine_id)
  return [
    { label: '独立部署', value: STANDALONE },
    ...list.map((m) => ({ label: m.name, value: m.id, machine: m })),
  ]
})
const renderMachineLabel = (o: SelectOption) => {
  const m = o.machine as MachineBrief | undefined
  if (!m) return h('span', { class: 'nf-opt-row' }, [h('span', null, o.label as string)])
  const st = MACHINE_STATUS_META[machineStatus(m)]
  return h('span', { class: 'nf-opt-row' }, [
    h('i', { class: 'nf-dot', style: { background: st.color } }),
    h('span', null, m.name),
    h('span', { class: 'nf-opt-sub mono' }, `SID:${m.id}`),
    !m.is_active ? h('span', { class: 'nf-opt-sub' }, '未激活') : null,
  ])
}

const machineValue = computed({
  get: () => form.machine_id ?? STANDALONE,
  set: (v: string | number) => {
    if (v === STANDALONE || v === null) {
      form.machine_id = null
      form.enabled = null
    } else {
      form.machine_id = Number(v)
      if (form.enabled === null) form.enabled = true
    }
  },
})
const currentMachine = computed(() => machines.value.find((m) => m.id === form.machine_id) ?? null)

// ---- validation ----

const PORT_RANGE = /^(\d{1,5})(?:-(\d{1,5}))?$/
const validPort = (n: number) => Number.isInteger(n) && n >= 1 && n <= 65535

const rules: FormRules = {
  name: { required: true, message: '请输入有效的节点名称', trigger: ['input', 'blur'] },
  rate: {
    required: true,
    trigger: ['change', 'blur'],
    validator: (_: FormItemRule, v: number | null) => {
      if (v === null || v === undefined) return new Error('基础倍率不能为空')
      if (!Number.isFinite(v)) return new Error('基础倍率必须是数字')
      return v >= 0 ? true : new Error('基础倍率必须大于或等于0')
    },
  },
  host: { required: true, message: '节点地址不能为空', trigger: ['input', 'blur'] },
  port: {
    required: true,
    trigger: ['input', 'blur'],
    validator: (_: FormItemRule, v: string) => {
      const t = (v ?? '').trim()
      if (!t) return new Error('连接端口不能为空')
      const m = PORT_RANGE.exec(t)
      if (!m || !validPort(Number(m[1])) || (m[2] !== undefined && (!validPort(Number(m[2])) || Number(m[2]) < Number(m[1])))) {
        return new Error('端口须为 1-65535 的整数或区间（如 20000-30000）')
      }
      return true
    },
  },
  server_port: {
    key: 'server_port',
    required: true,
    trigger: ['input', 'blur'],
    validator: (_: FormItemRule, v: string) => {
      const t = (v ?? '').trim()
      if (!t) return new Error('服务端口不能为空')
      return /^\d+$/.test(t) && validPort(Number(t)) ? true : new Error('服务端口须为 1-65535 的整数')
    },
  },
  // DB has unique(type, code); a clash only comes back as a generic 500, so check the loaded list first.
  code: {
    key: 'code',
    trigger: ['input', 'blur'],
    validator: () => {
      const dup = codeDuplicate.value
      return dup ? new Error(`该协议类型下已存在相同的自定义节点ID（节点「${dup.name}」）`) : true
    },
  },
}

const codeDuplicate = computed(() => {
  const code = form.code.trim()
  if (!code || !form.type) return null
  return props.nodes.find((n) => n.type === form.type && (n.code ?? '') === code && n.id !== props.node?.id) ?? null
})

function syncServerPort() {
  const m = PORT_RANGE.exec(form.port.trim())
  if (!m) return
  form.server_port = m[1]
  formRef.value?.validate(undefined, (rule) => rule.key === 'server_port').catch(() => undefined)
}

const codeChanged = computed(() => isEdit.value && original !== null && form.code.trim() !== original.code)

// ---- tags (Enter or comma adds, Backspace removes last, de-duplicated) ----

const TAG_SEP = /[,，]/
function setTags(values: string[] | null) {
  const out: string[] = []
  for (const v of values ?? []) {
    for (const part of String(v).split(TAG_SEP)) {
      const t = part.trim()
      if (t && !out.includes(t)) out.push(t)
    }
  }
  form.tags = out
}
/**
 * Runs before the select's own input handler (mergeProps order): finished segments before a comma become
 * tags and only the rest stays as the pattern. Skipped while an IME is composing; handled at compositionend.
 */
function splitTagPattern(el: HTMLInputElement) {
  if (!TAG_SEP.test(el.value)) return
  const parts = el.value.split(TAG_SEP)
  const rest = parts.pop() ?? ''
  setTags([...form.tags, ...parts])
  el.value = rest
}
const tagInputProps: InputHTMLAttributes = {
  onInput: (e: Event) => {
    if (!(e as InputEvent).isComposing) splitTagPattern(e.target as HTMLInputElement)
  },
  onCompositionend: (e: CompositionEvent) => splitTagPattern(e.target as HTMLInputElement),
}
const rateLocked = computed(() => form.parent_id !== 0)

// ---- advanced ----

const multiplexState = computed<MultiplexState | null>(() => multiplexOf(form.type, form.protocol_settings))
const certActive = computed(
  () => !!form.type && CERT_TYPES.includes(form.type) && !!form.cert_config?.cert_mode && form.cert_config.cert_mode !== 'none',
)
const muxActive = computed(() => !!form.type && MULTIPLEX_TYPES.includes(form.type) && !!multiplexState.value?.enabled)
const routingActive = computed(() => form.custom_outbounds.length > 0 || form.custom_routes.length > 0)

function openAdvanced(tab: AdvancedTab | null = null) {
  advancedTab.value = tab
  showAdvanced.value = true
}

function applyAdvanced(r: AdvancedResult) {
  form.cert_config = r.certConfig
  form.custom_outbounds = r.customOutbounds
  form.custom_routes = r.customRoutes
  const mux = multiplexState.value
  if (mux && r.multiplex) Object.assign(mux, r.multiplex)
}

// ---- groups ----

async function onGroupCreated(name: string) {
  emit('groupCreated')
  await loadLookups()
  const match = groups.value.filter((g) => g.name === name).sort((a, b) => b.id - a.id)[0]
  if (match && !form.group_ids.includes(String(match.id))) form.group_ids.push(String(match.id))
}

// ---- submit ----

const sameIds = (a: unknown[], b: unknown[]) => {
  const x = [...new Set(a.map(String))].sort()
  const y = [...new Set(b.map(String))].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/** Edit-only: confirmation text for changes that affect running nodes (spec §9-24), or null. */
function riskyChangeNotice(): string | null {
  const n = props.node
  if (!n || !original) return null
  const changed: string[] = []
  const notes: string[] = []
  if (form.code.trim() !== original.code) {
    changed.push('自定义节点ID')
    notes.push('节点端使用节点 ID 拉取配置，保存后需同步修改节点端配置，否则将无法拉取配置。')
  }
  const configChanged: string[] = []
  if (form.type !== original.type) configChanged.push('协议类型')
  if (Number(form.server_port.trim()) !== Number(n.server_port)) configChanged.push('服务端口')
  if (configChanged.length) {
    changed.push(...configChanged)
    notes.push(`${configChanged.join('、')}变更会向在线节点重新推送配置。`)
  }
  if (!sameIds(form.group_ids, n.group_ids ?? [])) {
    changed.push('权限组')
    notes.push('权限组变更会触发对在线节点的配置与用户列表全量推送，并改变哪些用户能订阅到该节点。')
  }
  if (!changed.length) return null
  return `本次修改了${changed.join('、')}：${notes.join('')}确定要保存吗？`
}

/** Re-entry guard across validate / confirm / save. */
let submitting = false

async function submit() {
  if (submitting) return
  submitting = true
  try {
    await doSubmit()
  } finally {
    submitting = false
  }
}

async function doSubmit() {
  if (!form.type || !form.protocol_settings) {
    message.warning('请先选择协议类型')
    return
  }
  try {
    await formRef.value?.validate()
  } catch {
    message.error('表单校验失败，请检查输入')
    return
  }
  if (parentIssue.value?.blocking) {
    message.error(parentIssue.value.text)
    return
  }
  const notice = riskyChangeNotice()
  if (notice && !(await confirm({ title: '确认保存修改', content: notice, positiveText: '确认保存', type: 'warning' }))) return
  saving.value = true
  try {
    await saveNode(buildSavePayload(form, original))
    message.success('提交成功')
    emit('saved')
    close()
  } catch {
    /* toast by http client */
  } finally {
    saving.value = false
  }
}

// Template casts for the per-type sub forms.
const ps = computed(() => form.protocol_settings)
const asSs = () => ps.value as ShadowsocksState
const asVmess = () => ps.value as VmessState
const asVless = () => ps.value as VlessState
const asTrojan = () => ps.value as TrojanState
const asHy = () => ps.value as HysteriaState
const asTuic = () => ps.value as TuicState
const asTlsSwitch = () => ps.value as TlsSwitchState
const asAnytls = () => ps.value as AnytlsState
const asMieru = () => ps.value as MieruState
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :style="{ width: 'min(780px, calc(100vw - 24px))' }"
    :segmented="{ content: true, footer: 'soft' }"
    :mask-closable="false"
    class="node-form-modal"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template #header>
      <div class="modal-title">
        <span>{{ title }}</span>
        <n-tag
          v-if="form.type"
          size="small"
          round
          :bordered="true"
          :color="{ borderColor: typeColor(form.type, appState.isDark), textColor: typeColor(form.type, appState.isDark), color: 'transparent' }"
        >
          {{ typeLabel(form.type) }}
        </n-tag>
      </div>
      <div class="modal-sub">管理所有节点，包括添加、删除、编辑等操作。</div>
    </template>
    <template #header-extra>
      <n-select
        :value="form.type"
        :options="typeOptions"
        :render-label="renderTypeLabel"
        placeholder="选择协议类型"
        size="small"
        class="type-select"
        @update:value="setType"
      />
    </template>

    <n-spin :show="loadingLookups && !groups.length" :delay="200">
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        require-mark-placement="right-hanging"
        class="node-form"
        @submit.prevent
      >
        <div class="section-title">基础信息</div>
        <n-grid cols="1 s:2" responsive="self" :x-gap="14">
          <n-form-item-gi :span="2" label="节点名称" path="name">
            <n-input v-model:value="form.name" placeholder="请输入节点名称" maxlength="255" />
          </n-form-item-gi>
          <n-form-item-gi label="基础倍率" path="rate">
            <n-input-number
              v-model:value="form.rate"
              :min="0"
              :step="0.1"
              :disabled="rateLocked"
              placeholder="1"
              style="width: 100%"
            >
              <template #suffix>x</template>
            </n-input-number>
          </n-form-item-gi>
          <n-form-item-gi label="流量限制 (GB)" path="transfer_enable_gb">
            <n-input-number
              v-model:value="form.transfer_enable_gb"
              :min="0"
              :step="1"
              clearable
              placeholder="0 表示不限制"
              style="width: 100%"
            >
              <template #suffix>GB</template>
            </n-input-number>
            <template #feedback><span class="muted">0 表示不限制；超出后节点不再下发给用户</span></template>
          </n-form-item-gi>
          <n-form-item-gi v-if="rateLocked" :span="2" :show-label="false" :show-feedback="false" class="locked-note">
            <n-alert type="info" :bordered="false" class="inline-alert">子节点倍率继承自父节点（实际计费以父节点上报为准）</n-alert>
          </n-form-item-gi>
          <n-form-item-gi :span="2" :show-feedback="false" class="switch-item">
            <div class="switch-row">
              <div>
                <div class="switch-title">启用动态倍率</div>
                <div class="muted switch-desc">根据时间段设置不同的倍率乘数</div>
              </div>
              <n-switch v-model:value="form.rate_time_enable" />
            </div>
          </n-form-item-gi>
        </n-grid>
        <rate-ranges v-if="form.rate_time_enable" v-model="form.rate_time_ranges" />
        <n-grid cols="1 s:2" responsive="self" :x-gap="14">
          <n-form-item-gi label="自定义节点ID (选填)" path="code">
            <n-input v-model:value="form.code" placeholder="请输入自定义节点ID" clearable />
            <template v-if="codeChanged && !codeDuplicate" #feedback>
              <span class="warn-text">修改后节点端需同步修改配置中的节点 ID，否则将无法拉取配置</span>
            </template>
          </n-form-item-gi>
          <n-form-item-gi label="节点标签">
            <n-select
              :value="form.tags"
              multiple
              filterable
              tag
              :show-arrow="false"
              :show="false"
              :input-props="tagInputProps"
              placeholder="输入后回车或逗号添加标签"
              @update:value="setTags"
            />
          </n-form-item-gi>
        </n-grid>

        <div class="section-title">连接与权限</div>
        <n-grid cols="1 s:2" responsive="self" :x-gap="14">
          <n-form-item-gi :span="2">
            <template #label>
              <span class="label-row">
                <span>权限组</span>
                <n-button text type="primary" size="tiny" @click="showGroupDialog = true">
                  <template #icon><n-icon><add-outline /></n-icon></template>
                  添加权限组
                </n-button>
              </span>
            </template>
            <n-select
              v-model:value="form.group_ids"
              :options="groupOptions"
              multiple
              filterable
              clearable
              placeholder="请选择权限组"
            >
              <template #empty><span class="muted">未找到结果</span></template>
            </n-select>
            <template #feedback><span class="muted">仅选中权限组的用户可订阅到该节点</span></template>
          </n-form-item-gi>
          <n-form-item-gi :span="2" label="节点地址" path="host">
            <n-input v-model:value="form.host" placeholder="请输入节点域名或者IP" class="mono-input" />
          </n-form-item-gi>
          <n-form-item-gi path="port">
            <template #label>
              <label-tip
                label="连接端口"
                tip="用户实际连接使用的端口号。如果使用了中转或隧道，这个端口可能与服务器实际监听的端口不同。支持端口区间（如 20000-30000）用于端口跳跃。"
              />
            </template>
            <n-input-group>
              <n-input v-model:value="form.port" placeholder="用户连接端口" class="mono-input" />
              <n-tooltip>
                <template #trigger>
                  <n-button secondary :disabled="!form.port" @click="syncServerPort">
                    <template #icon><n-icon><arrow-forward-outline /></n-icon></template>
                  </n-button>
                </template>
                同步到服务端口
              </n-tooltip>
            </n-input-group>
          </n-form-item-gi>
          <n-form-item-gi path="server_port">
            <template #label>
              <label-tip label="服务端口" tip="服务器上的实际监听端口。" />
            </template>
            <n-input v-model:value="form.server_port" placeholder="请输入服务端口" class="mono-input" />
          </n-form-item-gi>
        </n-grid>

        <div class="section-title">
          协议配置
          <span v-if="form.type" class="section-sub">{{ typeLabel(form.type) }}</span>
        </div>
        <div v-if="!form.type || !form.protocol_settings" class="type-picker">
          <div class="muted type-picker-tip">请先选择协议类型</div>
          <div class="type-grid">
            <button
              v-for="t in NODE_TYPES"
              :key="t"
              type="button"
              class="type-chip"
              :style="{ '--chip-color': typeColor(t, appState.isDark) }"
              @click="setType(t)"
            >
              <i class="nf-dot chip-dot" />
              {{ typeLabel(t) }}
            </button>
          </div>
        </div>
        <template v-else>
          <shadowsocks-form v-if="form.type === 'shadowsocks'" :settings="asSs()" />
          <vmess-form v-else-if="form.type === 'vmess'" :settings="asVmess()" />
          <vless-form v-else-if="form.type === 'vless'" :settings="asVless()" />
          <trojan-form v-else-if="form.type === 'trojan'" :settings="asTrojan()" />
          <hysteria-form v-else-if="form.type === 'hysteria'" :settings="asHy()" />
          <tuic-form v-else-if="form.type === 'tuic'" :settings="asTuic()" />
          <tls-switch-form
            v-else-if="form.type === 'socks' || form.type === 'naive' || form.type === 'http'"
            :settings="asTlsSwitch()"
            :type="form.type"
          />
          <anytls-form v-else-if="form.type === 'anytls'" :settings="asAnytls()" />
          <mieru-form v-else-if="form.type === 'mieru'" :settings="asMieru()" />
        </template>

        <div class="section-title">部署与路由</div>
        <n-grid cols="1 s:2" responsive="self" :x-gap="14">
          <n-form-item-gi
            label="父级节点"
            :validation-status="parentIssue ? (parentIssue.blocking ? 'error' : 'warning') : undefined"
          >
            <n-select
              v-model:value="form.parent_id"
              :options="parentOptions"
              :render-label="renderParentLabel"
              filterable
              :disabled="!form.type"
              placeholder="选择父节点"
            />
            <template #feedback>
              <span v-if="parentIssue" :class="parentIssue.blocking ? 'error-text' : 'warn-text'">{{ parentIssue.text }}</span>
              <span v-else class="muted">{{ form.type ? '仅可选择同类型且自身无父节点的节点' : '请先选择协议类型' }}</span>
            </template>
          </n-form-item-gi>
          <n-form-item-gi label="路由组">
            <n-select v-model:value="form.route_ids" :options="routeOptions" multiple filterable clearable placeholder="选择路由组">
              <template #empty><span class="muted">未找到结果</span></template>
            </n-select>
          </n-form-item-gi>
          <n-form-item-gi :span="2" label="绑定服务器">
            <n-select
              v-model:value="machineValue"
              :options="machineOptions"
              :render-label="renderMachineLabel"
              filterable
              placeholder="选择服务器（可选）"
            />
          </n-form-item-gi>
        </n-grid>
        <div v-if="form.machine_id" class="machine-card">
          <n-icon :size="20" class="machine-icon"><server-outline /></n-icon>
          <div class="machine-info">
            <div class="machine-name">
              <i
                class="nf-dot"
                :style="{ background: currentMachine ? MACHINE_STATUS_META[machineStatus(currentMachine)].color : 'var(--text-muted)' }"
              />
              {{ currentMachine?.name ?? `服务器 #${form.machine_id}` }}
              <span class="nf-opt-sub mono">SID:{{ form.machine_id }}</span>
            </div>
            <div class="muted machine-desc">选择是否由此服务器管理该节点</div>
          </div>
          <n-switch :value="form.enabled ?? true" @update:value="(v: boolean) => (form.enabled = v)" />
        </div>
      </n-form>
    </n-spin>

    <template #footer>
      <div class="modal-footer">
        <div class="footer-left">
          <template v-if="form.type">
            <n-button secondary @click="openAdvanced()">
              <template #icon><n-icon><options-outline /></n-icon></template>
              高级设置
            </n-button>
            <n-tag v-if="certActive" size="small" type="success" class="adv-badge" @click="openAdvanced('tls')">TLS</n-tag>
            <n-tag v-if="muxActive" size="small" type="info" class="adv-badge" @click="openAdvanced('multiplex')">MUX</n-tag>
            <n-tag v-if="routingActive" size="small" type="warning" class="adv-badge" @click="openAdvanced('outbounds')">RT</n-tag>
          </template>
        </div>
        <div class="footer-right">
          <n-button @click="close">取消</n-button>
          <n-button type="primary" :loading="saving" @click="submit">提交</n-button>
        </div>
      </div>
    </template>
  </n-modal>

  <advanced-dialog
    v-if="form.type"
    v-model:show="showAdvanced"
    :type="form.type"
    :initial-tab="advancedTab"
    :cert-config="form.cert_config"
    :multiplex="multiplexState"
    :custom-outbounds="form.custom_outbounds"
    :custom-routes="form.custom_routes"
    @save="applyAdvanced"
  />
  <group-create-dialog v-model:show="showGroupDialog" @created="onGroupCreated" />
</template>

<style scoped>
.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 650;
}
.modal-sub {
  margin-top: 2px;
  font-size: 12.5px;
  font-weight: normal;
  color: var(--text-muted);
}
.type-select {
  width: 170px;
}
.node-form {
  max-height: calc(100vh - 230px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 6px 4px 2px;
  margin-right: -6px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 12px;
  padding-left: 9px;
  border-left: 3px solid var(--primary-color);
  font-size: 13.5px;
  font-weight: 650;
  color: var(--text-strong);
  line-height: 1.2;
}
.section-title:not(:first-child) {
  margin-top: 10px;
}
.section-sub {
  font-weight: normal;
  font-size: 12.5px;
  color: var(--text-muted);
}
.label-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.switch-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.switch-item {
  margin-bottom: 14px;
}
.switch-title {
  font-size: 13.5px;
  font-weight: 600;
}
.switch-desc {
  font-size: 12px;
}
.locked-note {
  margin: -6px 0 12px;
}
.inline-alert {
  width: 100%;
  font-size: 12.5px;
}
.warn-text {
  color: var(--warning-color);
}
.error-text {
  color: var(--error-color);
}
.mono-input :deep(input) {
  font-family: var(--font-mono);
  font-size: 13px;
}
.type-picker {
  padding: 14px;
  margin-bottom: 18px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
}
.type-picker-tip {
  font-size: 12.5px;
  margin-bottom: 10px;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 8px;
}
.type-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-color);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}
.type-chip:hover {
  border-color: var(--chip-color);
  background: color-mix(in srgb, var(--chip-color) 10%, transparent);
}
.type-chip .chip-dot {
  background: var(--chip-color);
}
.machine-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin: -4px 0 6px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary-color) 5%, transparent);
}
.machine-icon {
  color: var(--primary-color);
  flex: none;
}
.machine-info {
  flex: 1;
  min-width: 0;
}
.machine-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13.5px;
}
.machine-desc {
  font-size: 12px;
}
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.footer-left,
.footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.footer-right {
  margin-left: auto;
}
.adv-badge {
  cursor: pointer;
  font-family: var(--font-mono);
  font-weight: 600;
}
:global(.nf-type-opt),
:global(.nf-opt-row) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
:global(.nf-dot) {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
:global(.nf-opt-sub) {
  font-size: 12px;
  color: var(--text-muted);
}
:global(.nf-opt-invalid) {
  color: var(--warning-color);
}
@media (max-width: 640px) {
  .type-select {
    width: 130px;
  }
  .node-form {
    max-height: calc(100vh - 200px);
  }
}
</style>
