<script setup lang="ts">
// "显示列" toggle for a data table (the official gift card tables offer the same menu).
import { computed } from 'vue'
import { NButton, NCheckbox, NIcon, NPopover } from 'naive-ui'
import { OptionsOutline } from '@vicons/ionicons5'
import type { ColumnOption } from './helpers'

const props = defineProps<{ options: ColumnOption[]; hidden: string[] }>()
const emit = defineEmits<{ (e: 'update:hidden', v: string[]): void }>()

const hiddenCount = computed(() => props.options.filter((o) => !o.fixed && props.hidden.includes(o.key)).length)

function toggle(key: string, visible: boolean) {
  const next = props.hidden.filter((k) => k !== key)
  if (!visible) next.push(key)
  emit('update:hidden', next)
}
</script>

<template>
  <n-popover trigger="click" placement="bottom-end" :show-arrow="false" style="padding: 6px 0">
    <template #trigger>
      <n-button>
        <template #icon><n-icon><options-outline /></n-icon></template>
        显示列<span v-if="hiddenCount" class="count">（隐藏 {{ hiddenCount }}）</span>
      </n-button>
    </template>
    <div class="menu">
      <div class="menu-title">切换显示列</div>
      <div v-for="o in options" :key="o.key" class="menu-item">
        <n-checkbox
          :checked="o.fixed || !hidden.includes(o.key)"
          :disabled="o.fixed"
          @update:checked="(v: boolean) => toggle(o.key, v)"
        >
          {{ o.label }}
        </n-checkbox>
      </div>
      <div v-if="hiddenCount" class="menu-foot">
        <n-button text size="small" type="primary" @click="emit('update:hidden', [])">全部显示</n-button>
      </div>
    </div>
  </n-popover>
</template>

<style scoped>
.count {
  font-variant-numeric: tabular-nums;
}
.menu {
  min-width: 160px;
}
.menu-title {
  padding: 4px 14px 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.menu-item {
  padding: 4px 14px;
}
.menu-foot {
  margin-top: 4px;
  padding: 6px 14px 2px;
  border-top: 1px solid var(--divider-color);
}
</style>
