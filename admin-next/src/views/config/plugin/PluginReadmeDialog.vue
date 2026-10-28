<script setup lang="ts">
// Plugin README dialog (spec platform §3.6); Markdown is rendered without raw HTML.
import { NModal } from 'naive-ui'
import PluginReadme from '@/views/plugin/components/PluginReadme.vue'

defineProps<{ show: boolean; name: string; readme: string }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="插件文档"
    :style="{ width: 'min(760px, 94vw)' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <p class="rd-name">{{ name }}</p>
    <plugin-readme :source="readme" max-height="62vh" />
  </n-modal>
</template>

<style scoped>
.rd-name {
  margin: -4px 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
