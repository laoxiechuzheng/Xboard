<script setup lang="ts">
// Right-side drawer showing one server's health, token, install command and bound nodes.
import { computed, ref, watch } from 'vue'
import { NDrawer, NDrawerContent, NIcon } from 'naive-ui'
import { ServerOutline } from '@vicons/ionicons5'
import type { Machine } from '@/api/machine'
import { appState } from '@/stores/app'
import MachineDetailPanel from './MachineDetailPanel.vue'
import { STATUS_META, machineStatus } from './machine-utils'

const props = defineProps<{
  show: boolean
  machine: Machine | null
  now: number
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'edit', m: Machine): void
  (e: 'changed'): void
}>()

const width = computed(() => (appState.isMobile ? '100%' : 'min(1000px, 100vw)'))

// The parent clears `machine` together with `show`; keep the last one so the leave transition
// still slides out the full panel instead of an empty drawer.
const shown = ref<Machine | null>(null)
watch(
  () => props.machine,
  (m) => {
    if (m) shown.value = m
  },
  { immediate: true },
)

const statusDot = computed(() => (shown.value ? STATUS_META[machineStatus(shown.value, props.now)].dot : ''))
</script>

<template>
  <n-drawer
    :show="show && !!shown"
    :width="width"
    placement="right"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <n-drawer-content v-if="shown" closable :native-scrollbar="false">
      <template #header>
        <div class="drawer-title">
          <span class="title-icon">
            <n-icon :size="18"><server-outline /></n-icon>
            <span class="title-dot" :style="{ background: statusDot }" />
          </span>
          <span class="title-text">{{ shown.name }}</span>
        </div>
      </template>
      <machine-detail-panel
        :key="shown.id"
        :machine="shown"
        :now="now"
        @edit="shown && emit('edit', shown)"
        @changed="emit('changed')"
      />
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.title-icon {
  position: relative;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
}
.title-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--card-color);
}
.title-text {
  font-size: 16px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
