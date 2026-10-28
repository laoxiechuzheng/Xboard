<script setup lang="ts">
// Plugin configuration dialog (spec platform §3.5); the form itself is shared with the runtime "设置" tab.
import { ref, watch } from 'vue'
import { NModal } from 'naive-ui'
import PluginConfigForm from '@/views/plugin/components/PluginConfigForm.vue'

const props = defineProps<{ show: boolean; code: string; name: string }>()
const emit = defineEmits<{ 'update:show': [boolean]; saved: [] }>()

// Mount the form on open and keep it until the leave animation ends (no collapse while closing);
// every opening therefore loads a fresh copy of the stored config.
const alive = ref(false)
// Mirrors the form's save state: closing mid-save would unmount the form and lose the input on failure.
const saving = ref(false)
watch(
  () => props.show,
  (v) => {
    if (v) alive.value = true
  },
  { immediate: true },
)

function close() {
  if (!saving.value) emit('update:show', false)
}

function onAfterLeave() {
  alive.value = false
  saving.value = false
}

function onSaved() {
  emit('saved')
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="`${name} 配置`"
    :style="{ width: 'min(640px, 94vw)' }"
    :mask-closable="!saving"
    :closable="!saving"
    :close-on-esc="!saving"
    :segmented="{ content: true }"
    @update:show="(v: boolean) => (v ? emit('update:show', true) : close())"
    @after-leave="onAfterLeave"
  >
    <p class="cfg-desc">修改插件配置</p>
    <plugin-config-form
      v-if="alive && code"
      :code="code"
      max-height="60vh"
      @update:saving="(v: boolean) => (saving = v)"
      @saved="onSaved"
      @cancel="close"
    />
  </n-modal>
</template>

<style scoped>
.cfg-desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
