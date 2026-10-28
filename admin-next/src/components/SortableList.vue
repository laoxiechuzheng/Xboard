<script setup lang="ts" generic="T extends { id: number | string }">
// Drag-and-drop (desktop) + up/down buttons (touch/keyboard) reordering list.
// Emits the reordered array; the caller persists it (e.g. POST /plan/sort { ids }).
import { ref } from 'vue'
import { NButton, NIcon, NEmpty } from 'naive-ui'
import { ReorderTwoOutline, ArrowUpOutline, ArrowDownOutline } from '@vicons/ionicons5'

const props = defineProps<{
  items: T[]
  label: (item: T) => string
  sublabel?: (item: T) => string
}>()
const emit = defineEmits<{ 'update:items': [T[]] }>()

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function move(from: number, to: number) {
  if (to < 0 || to >= props.items.length || from === to) return
  const next = props.items.slice()
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  emit('update:items', next)
}

function onDragStart(i: number, e: DragEvent) {
  dragIndex.value = i
  e.dataTransfer?.setData('text/plain', String(i))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(i: number, e: DragEvent) {
  e.preventDefault()
  overIndex.value = i
}
function onDrop(i: number) {
  if (dragIndex.value !== null) move(dragIndex.value, i)
  dragIndex.value = null
  overIndex.value = null
}
function onDragEnd() {
  dragIndex.value = null
  overIndex.value = null
}
</script>

<template>
  <n-empty v-if="!items.length" description="暂无数据" />
  <ul v-else class="sortable">
    <li
      v-for="(item, i) in items"
      :key="item.id"
      class="sortable-item"
      :class="{ dragging: dragIndex === i, over: overIndex === i && dragIndex !== i }"
      draggable="true"
      @dragstart="onDragStart(i, $event)"
      @dragover="onDragOver(i, $event)"
      @drop="onDrop(i)"
      @dragend="onDragEnd"
    >
      <n-icon class="handle" :size="18"><reorder-two-outline /></n-icon>
      <span class="idx">{{ i + 1 }}</span>
      <span class="text">
        <span class="label">{{ label(item) }}</span>
        <span v-if="sublabel" class="sub">{{ sublabel(item) }}</span>
      </span>
      <span class="ops">
        <n-button quaternary circle size="tiny" :disabled="i === 0" title="上移" @click="move(i, i - 1)">
          <template #icon><n-icon><arrow-up-outline /></n-icon></template>
        </n-button>
        <n-button quaternary circle size="tiny" :disabled="i === items.length - 1" title="下移" @click="move(i, i + 1)">
          <template #icon><n-icon><arrow-down-outline /></n-icon></template>
        </n-button>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.sortable {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 60vh;
  overflow: auto;
}
.sortable-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-color);
  cursor: grab;
  user-select: none;
}
.sortable-item.dragging {
  opacity: 0.45;
}
.sortable-item.over {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-color) inset;
}
.handle {
  color: var(--text-muted);
  flex: none;
}
.idx {
  width: 24px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-size: 12px;
  flex: none;
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ops {
  display: flex;
  gap: 2px;
  flex: none;
}
</style>
