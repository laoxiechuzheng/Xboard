<script setup lang="ts">
// Ctrl/⌘+K menu search (spec core §6.3.1).
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NInput, NIcon, NEmpty } from 'naive-ui'
import { SearchOutline, ReturnDownBackOutline } from '@vicons/ionicons5'

import type { PaletteItem } from '@/components/command-palette'

const props = defineProps<{ show: boolean; items: PaletteItem[] }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const router = useRouter()
const query = ref('')
const active = ref(0)
const inputRef = ref<InstanceType<typeof NInput> | null>(null)

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.items
  const terms = q.split(/\s+/)
  return props.items.filter((it) => {
    const hay = `${it.parent ?? ''} ${it.title} ${it.path}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
})

watch(
  () => props.show,
  async (v) => {
    if (!v) return
    query.value = ''
    active.value = 0
    await nextTick()
    inputRef.value?.focus()
  },
)
watch(query, () => (active.value = 0))

function go(it: PaletteItem | undefined) {
  if (!it) return
  emit('update:show', false)
  router.push(it.path)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    go(results.value[active.value])
  }
}
</script>

<template>
  <n-modal
    :show="show"
    :auto-focus="false"
    transform-origin="center"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="palette" role="dialog" aria-label="搜索菜单">
      <n-input
        ref="inputRef"
        v-model:value="query"
        placeholder="搜索菜单和功能..."
        size="large"
        clearable
        @keydown="onKey"
      >
        <template #prefix><n-icon><search-outline /></n-icon></template>
      </n-input>
      <div class="palette-group">菜单导航</div>
      <ul v-if="results.length" class="palette-list">
        <li
          v-for="(it, i) in results"
          :key="it.path"
          class="palette-item"
          :class="{ active: i === active }"
          @mouseenter="active = i"
          @click="go(it)"
        >
          <span class="palette-title">{{ it.title }}</span>
          <span v-if="it.parent" class="palette-parent">{{ it.parent }}</span>
          <n-icon v-if="i === active" class="palette-enter"><return-down-back-outline /></n-icon>
        </li>
      </ul>
      <n-empty v-else description="未找到结果" style="padding: 24px 0" />
    </div>
  </n-modal>
</template>

<style scoped>
.palette {
  width: min(560px, calc(100vw - 32px));
  margin-top: -18vh;
  padding: 12px;
  border-radius: 14px;
  background: var(--card-color);
  border: 1px solid var(--border-color);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.45);
}
.palette-group {
  margin: 12px 6px 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.palette-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 50vh;
  overflow: auto;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
}
.palette-item.active {
  background: var(--hover-color);
}
.palette-title {
  font-size: 14px;
}
.palette-parent {
  font-size: 12px;
  color: var(--text-muted);
}
.palette-enter {
  margin-left: auto;
  color: var(--text-muted);
}
</style>
