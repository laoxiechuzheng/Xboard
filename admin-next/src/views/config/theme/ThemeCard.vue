<script setup lang="ts">
// One theme in the grid (spec platform §2.3): config.json `background_url` as card background,
// preview / settings / activate actions and delete for user-uploaded themes.
import { computed } from 'vue'
import { NButton, NIcon, NTag, NTooltip } from 'naive-ui'
import { CheckmarkCircle, EyeOutline, OptionsOutline, TrashOutline } from '@vicons/ionicons5'
import { themeImages, type ThemeInfo } from '@/api/theme'
import { cssUrl, themeFields } from '@/views/config/theme/fields'

const props = defineProps<{
  themeKey: string
  info: ThemeInfo
  active: boolean
  /** Activation or deletion running for this card. */
  processing?: 'activate' | 'delete' | null
}>()
const emit = defineEmits<{ activate: []; delete: []; configure: []; preview: [] }>()

const images = computed(() => themeImages(props.info))
const configCount = computed(() => themeFields(props.info).length)
const busy = computed(() => !!props.processing)
const bg = computed(() => {
  const u = typeof props.info.background_url === 'string' ? props.info.background_url.trim() : ''
  return u ? { backgroundImage: cssUrl(u) } : undefined
})
const title = computed(() => props.info.name || props.themeKey)
</script>

<template>
  <article class="theme-card" :class="{ 'has-bg': !!bg, 'is-active': active }" :style="bg">
    <div class="tc-layer">
      <header class="tc-head">
        <div class="tc-title-row">
          <h3 class="tc-title" :title="title">{{ title }}</h3>
          <n-tag v-if="active" size="small" round type="success" :bordered="false">
            <template #icon><n-icon><checkmark-circle /></n-icon></template>
            使用中
          </n-tag>
          <n-tag v-if="info.is_system" size="small" round :bordered="false">系统主题</n-tag>
        </div>
        <n-tooltip v-if="info.can_delete">
          <template #trigger>
            <n-button
              size="small"
              quaternary
              circle
              type="error"
              aria-label="删除主题"
              :loading="processing === 'delete'"
              :disabled="busy"
              @click="emit('delete')"
            >
              <template #icon><n-icon><trash-outline /></n-icon></template>
            </n-button>
          </template>
          删除主题
        </n-tooltip>
      </header>

      <p class="tc-desc">{{ info.description || '暂无描述' }}</p>
      <div class="tc-meta">
        <span v-if="info.version" class="mono">版本：{{ info.version }}</span>
        <span v-if="themeKey !== info.name" class="mono">目录：{{ themeKey }}</span>
        <span>{{ configCount ? `${configCount} 个配置项` : '无配置项' }}</span>
        <span v-if="images.length">{{ images.length }} 张预览图</span>
      </div>

      <footer class="tc-actions">
        <n-tooltip v-if="images.length">
          <template #trigger>
            <n-button size="small" aria-label="预览" @click="emit('preview')">
              <template #icon><n-icon><eye-outline /></n-icon></template>
            </n-button>
          </template>
          预览
        </n-tooltip>
        <n-button size="small" @click="emit('configure')">
          <template #icon><n-icon><options-outline /></n-icon></template>
          主题设置
        </n-button>
        <n-button
          size="small"
          :type="active ? 'default' : 'primary'"
          :secondary="active"
          :disabled="active || busy"
          :loading="processing === 'activate'"
          @click="emit('activate')"
        >
          {{ active ? '当前主题' : '激活主题' }}
        </n-button>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.theme-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background-color: var(--card-color);
  background-size: cover;
  background-position: center;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}
.theme-card:hover {
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.08);
}
.theme-card.is-active {
  border-color: color-mix(in srgb, var(--success-color) 55%, var(--border-color));
}
.tc-layer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 196px;
  padding: 18px 18px 16px;
}
/* Background image: the card colour fades in from the bottom so text stays readable in both themes. */
.has-bg .tc-layer {
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--card-color) 96%, transparent) 0%,
    color-mix(in srgb, var(--card-color) 88%, transparent) 55%,
    color-mix(in srgb, var(--card-color) 62%, transparent) 100%
  );
  backdrop-filter: blur(1px);
  transition: background 0.2s;
}
.has-bg:hover .tc-layer {
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--card-color) 98%, transparent) 0%,
    color-mix(in srgb, var(--card-color) 92%, transparent) 55%,
    color-mix(in srgb, var(--card-color) 74%, transparent) 100%
  );
}
.tc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.tc-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.tc-title {
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 650;
  color: var(--text-strong);
}
.tc-desc {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-color);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--text-muted);
}
.tc-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
</style>
