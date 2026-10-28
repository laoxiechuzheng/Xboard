<script setup lang="ts">
// Plugin configuration form (spec platform §3.5): used by the plugin management dialog and the
// plugin runtime "设置" tab. Loads GET plugin/config, submits every schema key to POST plugin/config.
import { computed, ref, watch } from 'vue'
import { NAlert, NButton, NEmpty, NSkeleton, NScrollbar, NText } from 'naive-ui'
import DynamicForm from '@/components/DynamicForm.vue'
import { getPluginConfig, savePluginConfig, type PluginConfigSchema } from '@/api/plugin'
import { loadPlugins } from '@/stores/plugins'
import { message } from '@/utils/discrete'
import { collectValues, schemaToFields, schemaToValues, unknownKeys, validateValues } from '@/views/plugin/schema'

const props = withDefaults(
  defineProps<{
    code: string
    /** Cap the field area height (dialog); empty = natural height (page). */
    maxHeight?: string
    showCancel?: boolean
    /** Re-read the stored values after saving (stays on screen, e.g. the runtime settings tab). */
    reloadOnSaved?: boolean
  }>(),
  { maxHeight: '', showCancel: true, reloadOnSaved: false },
)
const emit = defineEmits<{ saved: []; cancel: []; 'update:saving': [saving: boolean] }>()

const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
// Lets a hosting dialog block closing while a save is in flight.
watch(saving, (v) => emit('update:saving', v))
const schema = ref<PluginConfigSchema>({})
const values = ref<Record<string, unknown>>({})

const fields = computed(() => schemaToFields(schema.value, { blankMeansDefault: true }))
const unknown = computed(() => unknownKeys(schema.value))
const isEmpty = computed(() => Object.keys(schema.value).length === 0)
const canSave = computed(() => !loading.value && !loadError.value && !isEmpty.value)

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  loadError.value = ''
  try {
    const s = await getPluginConfig(props.code, { silent: true })
    if (mine !== seq) return
    schema.value = s
    values.value = schemaToValues(s)
  } catch (e) {
    if (mine !== seq) return
    schema.value = {}
    values.value = {}
    loadError.value = (e as Error).message || '未知错误'
  } finally {
    if (mine === seq) loading.value = false
  }
}

async function submit() {
  if (!canSave.value || saving.value) return
  const errors = validateValues(schema.value, values.value)
  if (errors.length) {
    message.error(errors.join('；'))
    return
  }
  saving.value = true
  try {
    const res = await savePluginConfig(props.code, collectValues(schema.value, values.value))
    message.success(res?.message || '配置保存成功')
    void loadPlugins(true).catch(() => undefined)
    emit('saved')
    if (props.reloadOnSaved) void load()
  } catch {
    /* toasted by the http client */
  } finally {
    saving.value = false
  }
}

watch(() => props.code, load, { immediate: true })
</script>

<template>
  <div class="plugin-config">
    <div v-if="loading" class="pc-skeleton">
      <div v-for="i in 3" :key="i" class="pc-skeleton-item">
        <n-skeleton text width="28%" />
        <n-skeleton :height="i === 2 ? 72 : 34" :sharp="false" />
      </div>
    </div>

    <n-alert v-else-if="loadError" type="error" title="加载插件配置失败">
      <div class="pc-error">{{ loadError }}</div>
      <n-button size="small" secondary @click="load">重试</n-button>
    </n-alert>

    <n-empty v-else-if="isEmpty" description="该插件没有可配置项" class="pc-empty" />

    <template v-else>
      <n-scrollbar v-if="maxHeight" :style="{ maxHeight }" trigger="none">
        <div class="pc-scroll-inner">
          <n-alert v-if="unknown.length" type="info" :bordered="false" class="pc-note">
            以下配置项类型不受支持，将保持原值：<span class="mono">{{ unknown.join(', ') }}</span>
          </n-alert>
          <dynamic-form v-model:value="values" :fields="fields" :disabled="saving" />
        </div>
      </n-scrollbar>
      <template v-else>
        <n-alert v-if="unknown.length" type="info" :bordered="false" class="pc-note">
          以下配置项类型不受支持，将保持原值：<span class="mono">{{ unknown.join(', ') }}</span>
        </n-alert>
        <dynamic-form v-model:value="values" :fields="fields" :disabled="saving" />
      </template>
    </template>

    <div class="pc-footer">
      <n-text v-if="canSave" depth="3" class="pc-tip">保存后对插件的下一次请求生效</n-text>
      <span v-else />
      <div class="pc-actions">
        <n-button v-if="showCancel" :disabled="saving" @click="emit('cancel')">取消</n-button>
        <n-button type="primary" :loading="saving" :disabled="!canSave" @click="submit">
          {{ saving ? '保存中...' : '保存' }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pc-skeleton {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0 8px;
}
.pc-skeleton-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pc-error {
  margin-bottom: 8px;
  word-break: break-word;
}
.pc-empty {
  padding: 28px 0;
}
.pc-scroll-inner {
  padding-right: 12px;
}
/* DynamicForm drops the feedback row for fields without a description; keep the rhythm even. */
.plugin-config :deep(.n-form-item:not(:has(.n-form-item-feedback-wrapper)):not(:last-child)) {
  margin-bottom: 20px;
}
.plugin-config :deep(.n-form-item:has(.n-form-item-feedback-wrapper):not(:last-child)) {
  margin-bottom: 8px;
}
.pc-note {
  margin-bottom: 16px;
}
.pc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--divider-color);
}
.pc-tip {
  font-size: 12px;
}
.pc-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
