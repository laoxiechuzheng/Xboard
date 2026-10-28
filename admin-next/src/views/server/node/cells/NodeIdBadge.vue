<script setup lang="ts">
// Node id badge: `code ?? id` (→ parent), type-colored border, tooltip with ids, hover copy.
import { computed } from 'vue'
import { NButton, NIcon, NTooltip } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import type { ServerNode } from '@/api/node'
import { appState } from '@/stores/app'
import { copyText } from '@/utils/clipboard'
import { hasParent, nodeDisplayId, typeColor, typeLabel } from '../meta'

const props = defineProps<{ node: ServerNode }>()

const color = computed(() => typeColor(props.node.type, appState.isDark))
const isChild = computed(() => hasParent(props.node))
// Light-theme tooltips are dark: default text buttons would be dark-on-dark there.
const tipBtnColor = computed(() => (appState.isDark ? undefined : 'rgba(255, 255, 255, 0.85)'))
</script>

<template>
  <span class="id-cell">
    <n-tooltip placement="top-start">
      <template #trigger>
        <span class="id-badge mono" :style="{ borderColor: color, color }">{{ nodeDisplayId(node) }}</span>
      </template>
      <div class="id-tip">
        <div class="id-tip-type">{{ typeLabel(node.type) }}{{ isChild ? ' (子节点)' : '' }}</div>
        <div class="id-tip-row">
          <span>自定义ID</span>
          <span class="mono">{{ node.code || '—' }}</span>
          <n-button v-if="node.code" text size="tiny" :text-color="tipBtnColor" @click="copyText(node.code, '复制成功')">
            <template #icon><n-icon><copy-outline /></n-icon></template>
          </n-button>
        </div>
        <div class="id-tip-row">
          <span>原始ID</span>
          <span class="mono">{{ node.id }}</span>
          <n-button text size="tiny" :text-color="tipBtnColor" @click="copyText(String(node.id), '复制成功')">
            <template #icon><n-icon><copy-outline /></n-icon></template>
          </n-button>
        </div>
        <div v-if="isChild && node.parent" class="id-tip-row">
          <span>父节点</span>
          <span>{{ node.parent.name }}</span>
        </div>
      </div>
    </n-tooltip>
    <n-button text size="tiny" class="id-copy" title="复制节点ID" @click.stop="copyText(node.code || String(node.id), '复制成功')">
      <template #icon><n-icon><copy-outline /></n-icon></template>
    </n-button>
  </span>
</template>

<style scoped>
.id-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.id-badge {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
.id-copy {
  opacity: 0;
  transition: opacity 0.15s;
}
.id-cell:hover .id-copy {
  opacity: 0.7;
}
.id-tip {
  font-size: 12px;
  min-width: 160px;
}
.id-tip-type {
  font-weight: 600;
  margin-bottom: 4px;
}
.id-tip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 22px;
}
.id-tip-row > span:first-child {
  opacity: 0.7;
  min-width: 52px;
}
@media (hover: none) {
  .id-copy {
    opacity: 0.6;
  }
}
</style>
