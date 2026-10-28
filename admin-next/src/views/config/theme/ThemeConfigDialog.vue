<script setup lang="ts">
// Theme settings dialog (spec platform §2.5): POST theme/getThemeConfig on open, DynamicForm built
// from config.json `configs`, POST theme/saveThemeConfig with the declared keys only.
import { computed, ref, watch } from 'vue'
import { NAlert, NButton, NEmpty, NModal, NScrollbar, NSpin } from 'naive-ui'
import DynamicForm from '@/components/DynamicForm.vue'
import { getThemeConfig, saveThemeConfig, type ThemeInfo } from '@/api/theme'
import { message } from '@/utils/discrete'
import { collectThemeValues, themeConfigToFields, themeErrorText, themeFields, themeValuesFrom } from '@/views/config/theme/fields'

const props = defineProps<{ show: boolean; themeKey: string; info: ThemeInfo | null }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

const configs = computed(() => themeFields(props.info))
const fields = computed(() => themeConfigToFields(configs.value))
const values = ref<Record<string, unknown>>({})
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const title = computed(() => `配置${props.info?.name || props.themeKey}主题`)

let seq = 0
async function load() {
  const mine = ++seq
  values.value = themeValuesFrom(configs.value, {})
  loadError.value = ''
  if (!configs.value.length) return
  loading.value = true
  try {
    const stored = await getThemeConfig(props.themeKey, { silent: true })
    if (mine !== seq) return
    values.value = themeValuesFrom(configs.value, stored)
  } catch (e) {
    if (mine !== seq) return
    loadError.value = themeErrorText(e, '加载主题配置失败')
  } finally {
    if (mine === seq) loading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) void load()
    else seq++
  },
  { immediate: true },
)

function close() {
  if (!saving.value) emit('update:show', false)
}

async function submit() {
  if (saving.value || loading.value || loadError.value || !configs.value.length) return
  saving.value = true
  try {
    await saveThemeConfig(props.themeKey, collectThemeValues(configs.value, values.value), { silent: true })
    message.success('保存成功')
    emit('saved')
    emit('update:show', false)
  } catch (e) {
    message.error(themeErrorText(e, '保存失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="title"
    :style="{ width: 'min(560px, 94vw)' }"
    :mask-closable="!saving"
    :closable="!saving"
    :segmented="{ content: true, footer: 'soft' }"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : close())"
  >
    <p class="dlg-desc">修改主题的样式、布局和其他显示选项。</p>

    <n-empty v-if="!configs.length" description="该主题没有可配置项" class="dlg-empty" />
    <div v-else-if="loading" class="dlg-loading"><n-spin size="medium" /></div>
    <n-alert v-else-if="loadError" type="error" title="加载主题配置失败">
      <div class="dlg-error">{{ loadError }}</div>
      <n-button size="small" secondary @click="load">重试</n-button>
    </n-alert>
    <n-scrollbar v-else style="max-height: 62vh" trigger="none">
      <div class="dlg-form">
        <dynamic-form v-model:value="values" :fields="fields" :disabled="saving" />
      </div>
    </n-scrollbar>

    <template #footer>
      <div class="dlg-footer">
        <n-button :disabled="saving" @click="close">{{ configs.length ? '取消' : '关闭' }}</n-button>
        <n-button
          v-if="configs.length"
          type="primary"
          :loading="saving"
          :disabled="loading || !!loadError"
          @click="submit"
        >
          保存
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.dlg-desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.dlg-empty {
  padding: 24px 0;
}
.dlg-loading {
  display: grid;
  place-items: center;
  height: 160px;
}
.dlg-error {
  margin-bottom: 8px;
  word-break: break-word;
}
.dlg-form {
  padding-right: 12px;
}
/* DynamicForm drops the feedback row for fields without a description; keep the rhythm even. */
.dlg-form :deep(.n-form-item:not(:has(.n-form-item-feedback-wrapper)):not(:last-child)) {
  margin-bottom: 20px;
}
.dlg-form :deep(.n-form-item:has(.n-form-item-feedback-wrapper):not(:last-child)) {
  margin-bottom: 8px;
}
.dlg-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
