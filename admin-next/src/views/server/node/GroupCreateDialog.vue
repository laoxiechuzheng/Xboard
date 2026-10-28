<script setup lang="ts">
// Quick "添加权限组" from the node form (same rules as the permission group page).
import { reactive, ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NModal, NSpace, type FormInst, type FormRules } from 'naive-ui'
import { createServerGroup } from '@/api/node'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean]; created: [string] }>()

const formRef = ref<FormInst | null>(null)
const model = reactive({ name: '' })
const saving = ref(false)

const rules: FormRules = {
  name: [
    { required: true, message: '请输入权限组名称', trigger: ['input', 'blur'] },
    { min: 2, message: '组名至少需要2个字符', trigger: ['input', 'blur'] },
    { max: 50, message: '组名不能超过50个字符', trigger: ['input', 'blur'] },
    {
      pattern: /^[a-zA-Z0-9一-龥_-]+$/,
      message: '组名只能包含字母、数字、中文、下划线和连字符',
      trigger: ['input', 'blur'],
    },
  ],
}

watch(
  () => props.show,
  (v) => {
    if (v) model.name = ''
  },
)

async function submit() {
  // Guard against double submit (Enter = implicit form submit + button click while validating).
  if (saving.value) return
  saving.value = true
  try {
    await formRef.value?.validate()
  } catch {
    saving.value = false
    return
  }
  try {
    const name = model.name.trim()
    await createServerGroup(name)
    message.success('创建成功')
    emit('created', name)
    emit('update:show', false)
  } catch {
    /* toast by http client */
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="创建权限组"
    :style="{ width: 'min(440px, calc(100vw - 24px))' }"
    :segmented="{ footer: 'soft' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <p class="muted desc">创建新的权限组，可以为不同的用户分配不同的权限。</p>
    <n-form ref="formRef" :model="model" :rules="rules" label-placement="top" @submit.prevent="submit">
      <n-form-item label="组名称" path="name">
        <n-input v-model:value="model.name" placeholder="请输入权限组名称" maxlength="50" />
      </n-form-item>
      <div class="muted hint">权限组名称用于标识不同的用户组，建议使用有意义的名称。</div>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="saving" @click="submit">创建</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.desc {
  margin: 0 0 12px;
  font-size: 13px;
}
.hint {
  font-size: 12px;
  margin-top: -6px;
}
</style>
