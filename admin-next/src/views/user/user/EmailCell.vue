<script setup lang="ts">
// Email cell: online dot + clickable identity (opens detail) + hover copy button + online tooltip.
import { computed } from 'vue'
import { NTooltip, NButton, NIcon } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import type { UserRow } from '@/api/user'
import { copyText } from '@/utils/clipboard'
import { identityOf, isOnline, onlineLines, showsEmailSubline } from './helpers'

const props = defineProps<{ row: UserRow }>()
const emit = defineEmits<{ open: [UserRow] }>()

const online = computed(() => isOnline(props.row))
const identity = computed(() => identityOf(props.row))
const lines = computed(() => onlineLines(props.row))
</script>

<template>
  <div class="email-cell">
    <n-tooltip placement="top-start" :delay="200">
      <template #trigger>
        <span class="dot" :class="{ on: online }" :aria-label="online ? '在线' : '离线'" />
      </template>
      <div v-for="l in lines" :key="l">{{ l }}</div>
    </n-tooltip>
    <div class="email-main">
      <n-tooltip placement="top-start" :delay="400">
        <template #trigger>
          <button type="button" class="email-link" @click.stop="emit('open', row)">{{ identity }}</button>
        </template>
        <div v-for="l in lines" :key="l">{{ l }}</div>
      </n-tooltip>
      <div v-if="showsEmailSubline(row)" class="email-sub">{{ row.email }}</div>
    </div>
    <n-button
      text
      size="tiny"
      class="copy-btn"
      title="复制邮箱"
      aria-label="复制邮箱"
      @click.stop="copyText(identity, '复制成功')"
    >
      <template #icon>
        <n-icon><copy-outline /></n-icon>
      </template>
    </n-button>
  </div>
</template>

<style scoped>
.email-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  opacity: 0.45;
}
.dot.on {
  background: var(--success-color);
  opacity: 1;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success-color) 22%, transparent);
}
.email-main {
  min-width: 0;
  flex: 0 1 auto;
}
.email-link {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-strong);
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.email-link:hover {
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.email-sub {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.copy-btn {
  flex: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.email-cell:hover .copy-btn,
.copy-btn:focus-visible {
  opacity: 0.7;
}
.copy-btn:hover {
  opacity: 1 !important;
}
@media (hover: none) {
  .copy-btn {
    opacity: 0.6;
  }
}
</style>
