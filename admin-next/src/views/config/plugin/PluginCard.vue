<script setup lang="ts">
// One plugin in the management list (spec platform §3.3); button visibility follows the §3.4 state table.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NIcon, NTag, NTooltip } from 'naive-ui'
import {
  BookOutline,
  CubeOutline,
  OpenOutline,
  PowerOutline,
  RefreshOutline,
  SettingsOutline,
  ShieldCheckmark,
  TrashOutline,
  DownloadOutline,
} from '@vicons/ionicons5'
import type { PluginAction, PluginDetail } from '@/api/plugin'

const props = defineProps<{
  plugin: PluginDetail
  typeLabel?: string
  /** Action currently running for this plugin. */
  processing?: PluginAction | null
}>()
const emit = defineEmits<{ action: [PluginAction]; config: []; readme: [] }>()

const router = useRouter()
const p = computed(() => props.plugin)
const busy = computed(() => !!props.processing)
const hasConfig = computed(() => {
  const c = p.value.config
  return !!c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length > 0
})
const deletable = computed(() => p.value.can_be_deleted !== false)
const status = computed(() =>
  !p.value.is_installed
    ? { text: '未安装', type: 'default' as const, bordered: true }
    : p.value.is_enabled
      ? { text: '已启用', type: 'success' as const, bordered: false }
      : { text: '已禁用', type: 'warning' as const, bordered: false },
)
</script>

<template>
  <n-card size="small" hoverable class="plugin-card" :class="{ busy }">
    <div class="pc-head">
      <div class="pc-title">
        <span class="pc-name" :title="p.name">{{ p.name }}</span>
        <n-tag v-if="typeLabel" size="small" round type="primary" class="pc-tag">{{ typeLabel }}</n-tag>
        <n-tag size="small" round :type="status.type" :bordered="status.bordered" class="pc-tag">{{ status.text }}</n-tag>
        <n-tag v-if="p.is_installed && p.need_upgrade" size="small" round type="error" :bordered="false" class="pc-tag">
          有新版本
        </n-tag>
      </div>
      <div class="pc-head-right">
        <n-tooltip v-if="p.is_protected">
          <template #trigger>
            <span class="pc-shield" aria-label="受保护"><n-icon :size="14"><shield-checkmark /></n-icon></span>
          </template>
          受保护：系统核心插件，不可删除
        </n-tooltip>
        <n-tooltip v-if="p.is_installed && p.is_enabled">
          <template #trigger>
            <n-button size="small" quaternary circle aria-label="插件页面" @click="router.push(`/plugins/${p.code}`)">
              <template #icon><n-icon><open-outline /></n-icon></template>
            </n-button>
          </template>
          插件页面
        </n-tooltip>
        <n-tooltip v-if="p.readme">
          <template #trigger>
            <n-button size="small" quaternary circle aria-label="查看文档" @click="emit('readme')">
              <template #icon><n-icon><book-outline /></n-icon></template>
            </n-button>
          </template>
          查看文档
        </n-tooltip>
      </div>
    </div>

    <div class="pc-meta">
      <span class="pc-meta-item">
        <n-icon :size="13"><cube-outline /></n-icon><code class="mono">{{ p.code }}</code>
      </span>
      <span class="pc-meta-item mono">v{{ p.version }}</span>
      <span class="pc-meta-item">作者：{{ p.author || '-' }}</span>
    </div>

    <p class="pc-desc" :title="p.description">{{ p.description || '暂无描述' }}</p>

    <div class="pc-actions">
      <template v-if="p.is_installed">
        <n-button
          v-if="p.need_upgrade"
          size="small"
          type="error"
          :loading="processing === 'upgrade'"
          :disabled="busy"
          @click="emit('action', 'upgrade')"
        >
          <template #icon><n-icon><refresh-outline /></n-icon></template>
          升级
        </n-button>

        <n-tooltip v-if="hasConfig" :disabled="p.is_enabled">
          <template #trigger>
            <n-button size="small" :disabled="!p.is_enabled || busy" @click="emit('config')">
              <template #icon><n-icon><settings-outline /></n-icon></template>
              配置
            </n-button>
          </template>
          请先启用插件
        </n-tooltip>

        <n-button
          v-if="p.is_enabled"
          size="small"
          type="error"
          secondary
          :loading="processing === 'disable'"
          :disabled="busy"
          @click="emit('action', 'disable')"
        >
          <template #icon><n-icon><power-outline /></n-icon></template>
          禁用
        </n-button>
        <n-button
          v-else
          size="small"
          type="primary"
          :loading="processing === 'enable'"
          :disabled="busy"
          @click="emit('action', 'enable')"
        >
          <template #icon><n-icon><power-outline /></n-icon></template>
          启用
        </n-button>

        <n-tooltip :disabled="!p.is_enabled">
          <template #trigger>
            <n-button
              size="small"
              tertiary
              class="pc-danger"
              :loading="processing === 'uninstall'"
              :disabled="p.is_enabled || busy"
              @click="emit('action', 'uninstall')"
            >
              <template #icon><n-icon><trash-outline /></n-icon></template>
              卸载
            </n-button>
          </template>
          请先禁用插件再卸载
        </n-tooltip>
      </template>

      <template v-else>
        <n-button
          size="small"
          type="primary"
          :loading="processing === 'install'"
          :disabled="busy"
          @click="emit('action', 'install')"
        >
          <template #icon><n-icon><download-outline /></n-icon></template>
          安装
        </n-button>
        <n-tooltip v-if="deletable">
          <template #trigger>
            <n-button
              size="small"
              quaternary
              type="error"
              aria-label="删除插件"
              :loading="processing === 'delete'"
              :disabled="busy"
              @click="emit('action', 'delete')"
            >
              <template #icon><n-icon><trash-outline /></n-icon></template>
            </n-button>
          </template>
          删除插件文件
        </n-tooltip>
      </template>
    </div>
  </n-card>
</template>

<style scoped>
.plugin-card {
  height: 100%;
  transition: box-shadow 0.2s;
}
.plugin-card :deep(.n-card__content) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}
.pc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.pc-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.pc-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.pc-head-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}
.pc-shield {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-right: 2px;
  border-radius: 50%;
  color: var(--warning-color);
  background: color-mix(in srgb, var(--warning-color) 14%, transparent);
}
.pc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--text-muted);
}
.pc-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pc-desc {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pc-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
.pc-danger:not(.n-button--disabled):hover {
  color: var(--error-color);
}
</style>
