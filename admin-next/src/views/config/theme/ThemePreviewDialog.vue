<script setup lang="ts">
// Theme preview (spec platform §2.6): 16:9 stage, cyclic prev/next, thumbnail strip; ←/→ keys also work.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NIcon, NModal } from 'naive-ui'
import { ChevronBackOutline, ChevronForwardOutline, ImageOutline } from '@vicons/ionicons5'

const props = defineProps<{ show: boolean; name: string; images: string[] }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const index = ref(0)
const failed = ref<Record<number, boolean>>({})
const total = computed(() => props.images.length)
const current = computed(() => props.images[index.value] ?? '')

function go(i: number) {
  if (!total.value) return
  index.value = (i + total.value) % total.value
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') go(index.value - 1)
  else if (e.key === 'ArrowRight') go(index.value + 1)
}

watch(
  () => props.show,
  (open) => {
    index.value = 0
    failed.value = {}
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="`${name} 主题预览`"
    :style="{ width: 'min(960px, 94vw)' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="pv-count mono">{{ total ? index + 1 : 0 }} / {{ total }}</div>

    <div class="pv-stage">
      <img
        v-if="current && !failed[index]"
        :key="index"
        :src="current"
        :alt="`${name} 预览图 ${index + 1}`"
        referrerpolicy="no-referrer"
        @error="failed = { ...failed, [index]: true }"
      />
      <div v-else class="pv-broken">
        <n-icon :size="34"><image-outline /></n-icon>
        <span>图片加载失败</span>
      </div>
      <template v-if="total > 1">
        <n-button circle secondary class="pv-nav prev" aria-label="上一张" @click="go(index - 1)">
          <template #icon><n-icon><chevron-back-outline /></n-icon></template>
        </n-button>
        <n-button circle secondary class="pv-nav next" aria-label="下一张" @click="go(index + 1)">
          <template #icon><n-icon><chevron-forward-outline /></n-icon></template>
        </n-button>
      </template>
    </div>

    <div v-if="total > 1" class="pv-thumbs">
      <button
        v-for="(src, i) in images"
        :key="i"
        type="button"
        class="pv-thumb"
        :class="{ active: i === index }"
        :aria-label="`缩略图 ${i + 1}`"
        @click="go(i)"
      >
        <img :src="src" :alt="`缩略图 ${i + 1}`" referrerpolicy="no-referrer" loading="lazy" />
      </button>
    </div>
  </n-modal>
</template>

<style scoped>
.pv-count {
  margin: -6px 0 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
.pv-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--hover-color);
}
.pv-stage img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.pv-broken {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}
.pv-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  backdrop-filter: blur(4px);
  background: color-mix(in srgb, var(--card-color) 70%, transparent);
}
.pv-nav.prev {
  left: 12px;
}
.pv-nav.next {
  right: 12px;
}
.pv-thumbs {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.pv-thumb {
  flex: none;
  width: 64px;
  height: 64px;
  padding: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--hover-color);
  cursor: pointer;
  opacity: 0.75;
  transition:
    border-color 0.2s,
    opacity 0.2s;
}
.pv-thumb:hover {
  opacity: 1;
}
.pv-thumb.active {
  border-color: var(--primary-color);
  opacity: 1;
}
.pv-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
