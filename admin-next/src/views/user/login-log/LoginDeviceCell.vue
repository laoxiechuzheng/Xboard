<script setup lang="ts">
// 设备: icon by device type, OS on the first line, browser (+ model) on the second.
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import type { LoginLogDevice } from '@/api/user'
import { deviceMeta, deviceText } from './meta'

const props = defineProps<{ device: LoginLogDevice | null }>()

const meta = computed(() => deviceMeta(props.device))
const os = computed(() => props.device?.os?.trim() || '')
const sub = computed(() =>
  [props.device?.browser, props.device?.model].filter((v): v is string => !!v && !!v.trim()).join(' · '),
)
const full = computed(() => [meta.value.label, deviceText(props.device), props.device?.model].filter(Boolean).join(' · '))
</script>

<template>
  <div class="device" :title="full">
    <span class="badge" :class="device?.type ?? 'unknown'">
      <n-icon :size="16"><component :is="meta.icon" /></n-icon>
    </span>
    <div class="text">
      <div class="main">{{ os || meta.label }}</div>
      <div class="sub">{{ sub || (os ? meta.label : '未能识别 UA') }}</div>
    </div>
  </div>
</template>

<style scoped>
.device {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.badge {
  --tone: var(--text-muted);
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 11%, transparent);
}
.badge.desktop {
  --tone: var(--primary-color);
}
.badge.mobile {
  --tone: var(--success-color);
}
.badge.tablet {
  --tone: var(--info-color);
}
.badge.bot {
  --tone: var(--warning-color);
}
.text {
  min-width: 0;
  line-height: 1.4;
}
.main {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-strong);
}
.sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
