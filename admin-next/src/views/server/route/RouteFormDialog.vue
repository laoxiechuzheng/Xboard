<script setup lang="ts">
// Create / edit a route rule (spec nodes §7.2).
import { computed, h, reactive, ref, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NAlert,
  NIcon,
  type FormInst,
  type FormItemInst,
  type FormRules,
  type FormItemRule,
  type SelectOption,
} from 'naive-ui'
import { saveRoute, type RouteAction, type RouteSaveBody, type ServerRoute } from '@/api/serverRoute'
import { message } from '@/utils/discrete'
import { ROUTE_ACTIONS, routeActionMeta } from './route-actions'

const props = defineProps<{
  show: boolean
  route?: ServerRoute | null
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInst | null>(null)
const valueItemRef = ref<FormItemInst | null>(null)
const submitting = ref(false)
/** A submit has been attempted since the dialog opened. */
const attempted = ref(false)
/** The action_value item shows validation feedback (cleared when the action changes). */
const valueArmed = ref(false)
const form = reactive({
  remarks: '',
  matchText: '',
  action: 'block' as RouteAction,
  action_value: '',
})

const isEdit = computed(() => !!props.route?.id)
const actionMeta = computed(() => routeActionMeta(form.action))

/** One rule per line; blank lines are dropped (array_filter on the backend would otherwise keep odd keys). */
function parseMatch(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
}
const matchCount = computed(() => parseMatch(form.matchText).length)

const actionOptions = computed<SelectOption[]>(() =>
  ROUTE_ACTIONS.map((a) => ({ label: a.label, value: a.value })),
)

function renderActionLabel(option: SelectOption) {
  const meta = routeActionMeta(String(option.value))
  return h('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, [
    h(NIcon, { size: 15 }, { default: () => h(meta.icon) }),
    String(option.label),
  ])
}

// Field checks shared by the rules and the top alert.
const remarksError = (v: string) => (v?.trim() ? '' : '请输入有效的备注')
const matchError = (v: string) => (parseMatch(v ?? '').length ? '' : '请至少填写一条匹配规则')
const valueError = (v: string) =>
  !actionMeta.value.needsValue || v?.trim() ? '' : (actionMeta.value.valuePlaceholder ?? '请输入动作值')
const asResult = (err: string) => (err ? new Error(err) : true)

const rules: FormRules = {
  remarks: [{ required: true, trigger: ['input', 'blur'], validator: (_r: FormItemRule, v: string) => asResult(remarksError(v)) }],
  matchText: [{ required: true, trigger: ['input', 'blur'], validator: (_r: FormItemRule, v: string) => asResult(matchError(v)) }],
  action: [{ required: true, trigger: 'change', message: '请选择动作' }],
  action_value: [{ trigger: ['input', 'blur'], validator: (_r: FormItemRule, v: string) => asResult(valueError(v)) }],
}

// After a submit attempt every field is validated, and the input/blur triggers keep each item's
// feedback in step with its value, so the alert mirrors exactly the errors shown below it.
const hasError = computed(
  () =>
    attempted.value &&
    (!!remarksError(form.remarks) || !!matchError(form.matchText) || (valueArmed.value && !!valueError(form.action_value))),
)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const r = props.route
    form.remarks = r?.remarks ?? ''
    form.matchText = (r?.match ?? []).join('\n')
    form.action = r?.action ?? 'block'
    form.action_value = r?.action_value ?? ''
    attempted.value = false
    valueArmed.value = false
    formRef.value?.restoreValidation()
  },
  { immediate: true },
)

// Switching the action only resets the action value item; other fields keep their feedback.
watch(
  () => form.action,
  () => {
    valueItemRef.value?.restoreValidation()
    valueArmed.value = false
  },
)

function close() {
  emit('update:show', false)
}

async function submit() {
  if (submitting.value || !props.show) return
  attempted.value = true
  valueArmed.value = true
  submitting.value = true
  try {
    await formRef.value?.validate()
  } catch {
    submitting.value = false
    return
  }
  const body: RouteSaveBody = {
    remarks: form.remarks.trim(),
    match: parseMatch(form.matchText),
    action: form.action,
    action_value: actionMeta.value.needsValue ? form.action_value.trim() : null,
  }
  if (isEdit.value) body.id = props.route!.id
  try {
    await saveRoute(body)
    message.success(isEdit.value ? '更新成功' : '创建成功')
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
    :title="isEdit ? '编辑路由' : '创建路由'"
    :style="{ width: 'min(560px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <n-alert v-if="hasError" type="error" :show-icon="true" class="form-alert">表单校验失败，请检查输入</n-alert>
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" require-mark-placement="right-hanging">
      <n-form-item label="备注" path="remarks">
        <n-input v-model:value="form.remarks" placeholder="请输入备注" maxlength="255" clearable />
      </n-form-item>
      <n-form-item label="匹配规则" path="matchText">
        <div class="field-stack">
          <n-input
            v-model:value="form.matchText"
            type="textarea"
            class="mono-input"
            :autosize="{ minRows: 5, maxRows: 14 }"
            :placeholder="'example.com\n*.example.com'"
          />
          <div class="field-hint">
            <span>每行一条规则，原样下发给节点由内核解析；空行会被自动忽略。</span>
            <span class="match-count">已填写 {{ matchCount }} 条</span>
          </div>
        </div>
      </n-form-item>
      <n-form-item label="动作" path="action">
        <n-select
          v-model:value="form.action"
          :options="actionOptions"
          :render-label="renderActionLabel"
          placeholder="请选择动作"
        />
      </n-form-item>
      <n-form-item
        v-if="actionMeta.needsValue"
        ref="valueItemRef"
        :label="actionMeta.valueLabel"
        path="action_value"
        required
      >
        <n-input
          v-model:value="form.action_value"
          :placeholder="actionMeta.valuePlaceholder"
          class="mono-input"
          clearable
          @update:value="valueArmed = true"
          @blur="valueArmed = true"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="close">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">提交</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.form-alert {
  margin-bottom: 14px;
}
.match-count {
  flex: none;
  font-variant-numeric: tabular-nums;
}
.mono-input :deep(textarea),
.mono-input :deep(input) {
  font-family: var(--font-mono);
  font-size: 13px;
}
.field-stack {
  width: 100%;
}
.field-hint {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
