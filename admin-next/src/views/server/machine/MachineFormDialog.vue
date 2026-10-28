<script setup lang="ts">
// Create / edit a server (machine). Creation returns the token + install command (spec nodes §5.6).
import { computed, reactive, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NSwitch, NButton, type FormInst, type FormRules } from 'naive-ui'
import { createMachine, updateMachine, type Machine, type MachineCreated } from '@/api/machine'
import { message } from '@/utils/discrete'

const props = defineProps<{
  show: boolean
  machine?: Machine | null
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'created', payload: MachineCreated & { name: string }): void
  (e: 'updated'): void
}>()

const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
const form = reactive({ name: '', notes: '', is_active: true })
const isEdit = computed(() => !!props.machine?.id)

const rules: FormRules = {
  name: [
    {
      required: true,
      trigger: ['blur', 'input'],
      validator: (_r, v: string) => {
        if (!v?.trim()) return new Error('请输入服务器名称')
        if (v.trim().length > 255) return new Error('服务器名称不能超过255个字符')
        return true
      },
    },
  ],
}

const canSubmit = computed(() => !!form.name.trim() && form.name.trim().length <= 255)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    form.name = props.machine?.name ?? ''
    form.notes = props.machine?.notes ?? ''
    form.is_active = props.machine ? !!props.machine.is_active : true
    formRef.value?.restoreValidation()
  },
  { immediate: true },
)

function close() {
  emit('update:show', false)
}

// Enter in the name field submits the form implicitly; lock before the async validate so
// repeated Enter / clicks cannot create duplicate servers.
async function submit() {
  if (submitting.value || !props.show) return
  submitting.value = true
  try {
    await formRef.value?.validate()
  } catch {
    submitting.value = false
    return
  }
  const body = { name: form.name.trim(), notes: form.notes.trim() || null, is_active: form.is_active }
  try {
    if (isEdit.value) {
      await updateMachine({ id: props.machine!.id, ...body })
      message.success('服务器更新成功')
      emit('updated')
    } else {
      const res = await createMachine(body)
      message.success('服务器创建成功')
      emit('created', { ...res, name: body.name })
    }
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
    :title="isEdit ? '编辑服务器' : '新建服务器'"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    :mask-closable="!submitting"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <p class="dialog-desc">
      {{ isEdit ? '修改服务器名称、备注或启用状态。' : '当你希望一台服务器承载多个节点时，再创建服务器记录。' }}
    </p>
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" @submit.prevent="submit">
      <n-form-item label="服务器名称" path="name">
        <n-input v-model:value="form.name" placeholder="例如 HK-01" maxlength="255" clearable />
      </n-form-item>
      <n-form-item label="备注" path="notes">
        <n-input
          v-model:value="form.notes"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          placeholder="关于此服务器的可选备注"
        />
      </n-form-item>
      <div class="switch-row">
        <div class="switch-text">
          <div class="switch-title">启用服务器</div>
          <div class="switch-desc">禁用后 xboard-node 将不再使用此服务器。</div>
        </div>
        <n-switch v-model:value="form.is_active" />
      </div>
    </n-form>
    <template #footer>
      <div class="dialog-footer">
        <n-button :disabled="submitting" @click="close">取消</n-button>
        <n-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
          {{ isEdit ? '更新' : '提交' }}
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
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.switch-title {
  font-weight: 500;
}
.switch-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
