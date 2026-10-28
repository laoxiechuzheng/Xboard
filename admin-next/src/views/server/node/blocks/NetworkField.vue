<script setup lang="ts">
// Transport select + network_settings JSON editor (with per-transport templates).
import { computed, ref } from 'vue'
import { NButton, NFormItem, NIcon, NModal, NSelect, NSpace, NText } from 'naive-ui'
import { CreateOutline } from '@vicons/ionicons5'
import CodeEditor from '@/components/CodeEditor.vue'
import { NETWORK_TEMPLATES, type NetworkState } from '../protocol'

const props = defineProps<{
  settings: NetworkState
  options: { label: string; value: string }[]
}>()

const show = ref(false)
const text = ref('')

const templates = computed(() => NETWORK_TEMPLATES[props.settings.network] ?? [])
const configuredKeys = computed(() => Object.keys(props.settings.network_settings ?? {}).length)

const error = computed(() => {
  const t = text.value.trim()
  if (!t) return ''
  try {
    const v = JSON.parse(t)
    return v && typeof v === 'object' && !Array.isArray(v) ? '' : '配置必须是一个JSON对象'
  } catch {
    return '无效的JSON格式'
  }
})

function open() {
  const v = props.settings.network_settings
  text.value = v && Object.keys(v).length ? JSON.stringify(v, null, 2) : ''
  show.value = true
}

function useTemplate(value: Record<string, unknown>) {
  text.value = JSON.stringify(value, null, 2)
}

function confirmEdit() {
  if (error.value) return
  const t = text.value.trim()
  props.settings.network_settings = t ? (JSON.parse(t) as Record<string, unknown>) : null
  show.value = false
}
</script>

<template>
  <n-form-item>
    <template #label>
      <span class="label-row">
        <span>传输协议</span>
        <n-button text type="primary" size="tiny" @click="open">
          <template #icon><n-icon><create-outline /></n-icon></template>
          编辑协议
        </n-button>
      </span>
    </template>
    <n-select v-model:value="settings.network" :options="options" placeholder="选择传输协议" />
    <template #feedback>
      <span class="muted">{{ configuredKeys ? `已自定义协议配置（${configuredKeys} 项）` : '未配置协议参数，使用默认值' }}</span>
    </template>
  </n-form-item>

  <n-modal
    v-model:show="show"
    preset="card"
    title="编辑协议配置"
    :mask-closable="false"
    :style="{ width: 'min(640px, calc(100vw - 24px))' }"
    :segmented="{ content: true, footer: 'soft' }"
  >
    <n-space v-if="templates.length" size="small" class="tpl-row">
      <n-button v-for="t in templates" :key="t.label" size="small" secondary @click="useTemplate(t.value)">
        使用{{ t.label }}模板
      </n-button>
    </n-space>
    <code-editor
      v-model:value="text"
      language="json"
      :rows="14"
      :placeholder="templates.length ? '请输入JSON配置或选择上方模板' : '请输入JSON配置'"
    />
    <n-text v-if="error === '配置必须是一个JSON对象'" type="error" class="err">{{ error }}</n-text>
    <div class="muted tip">留空表示不设置（network_settings = null）。</div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">取消</n-button>
        <n-button type="primary" :disabled="!!error" @click="confirmEdit">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.label-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tpl-row {
  margin-bottom: 10px;
}
.err {
  font-size: 12px;
}
.tip {
  font-size: 12px;
  margin-top: 4px;
}
</style>
