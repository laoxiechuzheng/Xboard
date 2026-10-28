<script setup lang="ts">
// "添加分组" from the plan form: POST /server/group/save { name }.
import { computed, ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NSpace, type FormInst, type FormRules, type FormItemRule } from 'naive-ui'
import { createServerGroup } from '@/api/plan'
import { message } from '@/utils/discrete'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean]; created: [string] }>()

const NAME_RE = /^[a-zA-Z0-9一-龥_-]+$/
const formRef = ref<FormInst | null>(null)
const form = ref({ name: '' })
const submitting = ref(false)

function nameError(v: string): string | null {
  const s = v.trim()
  if (s.length < 2) return '组名至少需要2个字符'
  if (s.length > 50) return '组名不能超过50个字符'
  if (!NAME_RE.test(s)) return '组名只能包含字母、数字、中文、下划线和连字符'
  return null
}

const valid = computed(() => nameError(form.value.name) === null)

const rules: FormRules = {
  name: [
    {
      trigger: ['input', 'blur'],
      validator: (_r: FormItemRule, v: string) => {
        const err = nameError(v ?? '')
        return err ? new Error(err) : true
      },
    },
  ],
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    form.value = { name: '' }
    formRef.value?.restoreValidation()
  },
)

async function submit() {
  // Enter triggers the form's implicit submit; guard against double POSTs.
  if (submitting.value || !valid.value) return
  submitting.value = true
  try {
    const name = form.value.name.trim()
    await createServerGroup(name)
    message.success('创建成功')
    emit('created', name)
    emit('update:show', false)
  } catch {
    /* toasted */
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="创建权限组"
    :bordered="false"
    style="width: min(440px, calc(100vw - 32px))"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <p class="muted desc">创建新的权限组，可以为不同的用户分配不同的权限。</p>
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" @submit.prevent="submit">
      <n-form-item label="组名称" path="name">
        <n-input v-model:value="form.name" placeholder="请输入权限组名称" maxlength="50" show-count />
      </n-form-item>
      <div class="muted hint">权限组名称用于标识不同的用户组，建议使用有意义的名称。</div>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :disabled="!valid" :loading="submitting" @click="submit">创建权限组</n-button>
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
  margin-top: -8px;
}
</style>
