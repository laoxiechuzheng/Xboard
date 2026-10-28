<script setup lang="ts">
// Drag-and-drop / click-to-pick zone for a single .zip package (plugin and theme upload dialogs).
// Validation and the request itself belong to the parent; the input is reset so the same file can be re-picked.
import { ref } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'

const props = defineProps<{
  uploading?: boolean
  text: string
  linkText: string
  hint: string
  uploadingText?: string
}>()
const emit = defineEmits<{ select: [File] }>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
let depth = 0

function pick() {
  if (!props.uploading) input.value?.click()
}

function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (file) emit('select', file)
}

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  depth++
  dragging.value = true
}
function onDragLeave() {
  depth = Math.max(0, depth - 1)
  if (!depth) dragging.value = false
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  depth = 0
  dragging.value = false
  if (props.uploading) return
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('select', file)
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ dragging, busy: uploading }"
    role="button"
    tabindex="0"
    :aria-busy="uploading"
    @click="pick"
    @keydown.enter.prevent="pick"
    @keydown.space.prevent="pick"
    @dragenter="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <input ref="input" type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden @change="onChange" />
    <template v-if="uploading">
      <n-spin size="medium" />
      <div class="dz-text">{{ uploadingText || '正在上传...' }}</div>
    </template>
    <template v-else>
      <div class="dz-icon">
        <n-icon :size="26"><cloud-upload-outline /></n-icon>
      </div>
      <div class="dz-text">
        {{ text }}<span class="dz-link">{{ linkText }}</span>
      </div>
      <div class="dz-hint">{{ hint }}</div>
    </template>
  </div>
</template>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 210px;
  padding: 24px 16px;
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  outline: none;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}
.dropzone:hover,
.dropzone:focus-visible,
.dropzone.dragging {
  border-color: color-mix(in srgb, var(--primary-color) 60%, transparent);
  background: color-mix(in srgb, var(--primary-color) 6%, transparent);
}
.dropzone.busy {
  cursor: progress;
}
.dz-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}
.dz-text {
  font-size: 14px;
  color: var(--text-strong);
}
.dz-link {
  margin-left: 4px;
  color: var(--primary-color);
  font-weight: 500;
}
.dz-hint {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
