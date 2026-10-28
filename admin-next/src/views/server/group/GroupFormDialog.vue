<script setup lang="ts">
// Create / edit a permission group. Reusable: other forms (node, plan) can open it to add a group inline.
import { computed, reactive, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton } from 'naive-ui'
import { saveGroup } from '@/api/serverGroup'
import { message } from '@/utils/discrete'

const props = defineProps<{
  show: boolean
  /** Pass an existing group to edit; omit / null to create. */
  group?: { id: number; name: string } | null
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** Fired after a successful save with the submitted body. */
  (e: 'success', payload: { id?: number; name: string }): void
}>()

const NAME_PATTERN = /^[a-zA-Z0-9一-龥_-]+$/
const HINT = '权限组名称用于标识不同的用户组，建议使用有意义的名称。'

const form = reactive({ name: '' })
const touched = ref(false)
const submitting = ref(false)
const isEdit = computed(() => !!props.group?.id)

const nameError = computed(() => {
  const v = form.name.trim()
  if (v.length < 2) return '组名至少需要2个字符'
  if (v.length > 50) return '组名不能超过50个字符'
  if (!NAME_PATTERN.test(v)) return '组名只能包含字母、数字、中文、下划线和连字符'
  return ''
})
const showError = computed(() => touched.value && !!nameError.value)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    form.name = props.group?.name ?? ''
    touched.value = false
  },
  { immediate: true },
)

function close() {
  emit('update:show', false)
}

// Enter submits via the form's implicit submission only (no keyup handler: it would double-fire and
// trigger on IME composition commits); the guard also covers repeated Enter / clicks.
async function submit() {
  if (submitting.value || !props.show) return
  touched.value = true
  if (nameError.value) return
  const name = form.name.trim()
  const body = isEdit.value ? { id: props.group!.id, name } : { name }
  submitting.value = true
  try {
    await saveGroup(body)
    message.success(isEdit.value ? '更新成功' : '创建成功')
    emit('success', body)
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
    :title="isEdit ? '编辑权限组' : '创建权限组'"
    :style="{ width: 'min(480px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <p class="dialog-desc">
      {{ isEdit ? '修改权限组信息，更新后会立即生效。' : '创建新的权限组，可以为不同的用户分配不同的权限。' }}
    </p>
    <n-form :show-feedback="false" label-placement="top" @submit.prevent="submit">
      <n-form-item label="组名称" required :validation-status="showError ? 'error' : undefined">
        <n-input
          v-model:value="form.name"
          placeholder="请输入权限组名称"
          maxlength="50"
          show-count
          clearable
          @update:value="touched = true"
          @blur="touched = true"
        />
      </n-form-item>
      <div class="field-hint" :class="{ 'is-error': showError }">{{ showError ? nameError : HINT }}</div>
    </n-form>
    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="close">取消</n-button>
        <n-button type="primary" :loading="submitting" :disabled="!!nameError" @click="submit">
          {{ isEdit ? '更新' : '创建' }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.dialog-desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}
.field-hint.is-error {
  color: var(--error-color);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
