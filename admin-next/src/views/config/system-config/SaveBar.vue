<script setup lang="ts">
// Floating "unsaved changes" bar, shown while a tab has dirty fields.
import { NButton, NPopconfirm } from 'naive-ui'
import { appState } from '@/stores/app'

withDefaults(defineProps<{ count: number; saving?: boolean; saveText?: string }>(), {
  saving: false,
  saveText: '保存修改',
})
const emit = defineEmits<{ save: []; discard: [] }>()
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
</script>

<template>
  <teleport to="body">
    <transition name="save-bar">
      <div v-if="count > 0" class="save-bar" :class="{ mobile: appState.isMobile }" role="status">
        <span class="bar-dot" />
        <span class="bar-text">
          <b class="bar-count">{{ count }}</b> 项修改尚未保存
          <kbd v-if="!appState.isMobile" class="bar-kbd">{{ isMac ? '⌘' : 'Ctrl' }} S</kbd>
        </span>
        <n-popconfirm positive-text="放弃修改" negative-text="取消" @positive-click="emit('discard')">
          <template #trigger>
            <n-button size="small" quaternary :disabled="saving">放弃</n-button>
          </template>
          确定放弃所有未保存的修改吗？
        </n-popconfirm>
        <n-button size="small" type="primary" :loading="saving" @click="emit('save')">{{ saveText }}</n-button>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.save-bar {
  position: fixed;
  right: 28px;
  bottom: 24px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.35);
  font-size: 13px;
  color: var(--text-color);
}
.save-bar.mobile {
  left: 12px;
  right: 12px;
  bottom: 12px;
}
.bar-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning-color);
}
.bar-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-count {
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}
.bar-kbd {
  margin-left: 6px;
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}
.save-bar-enter-active,
.save-bar-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.save-bar-enter-from,
.save-bar-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
