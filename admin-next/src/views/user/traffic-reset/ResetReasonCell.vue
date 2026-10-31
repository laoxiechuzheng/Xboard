<script setup lang="ts">
// 原因: reason pill + the plain-language sentence. Noise rows get the neutral “冗余记录” pill instead; old rows
// whose reason was inferred from the trigger source carry a small “旧记录” mark.
import { computed } from 'vue'
import CyclePill from '../traffic-cycle/CyclePill.vue'
import { NOISE_META, reasonMeta, sourceLabel } from '../traffic-cycle/meta'
import type { ResetLogView } from './normalize'

const props = withDefaults(defineProps<{ log: ResetLogView; compact?: boolean }>(), { compact: false })

const meta = computed(() => reasonMeta(props.log.reason))
const line = computed(() => {
  if (props.log.noise) return `${meta.value.label} · 没有实际清零`
  return props.compact ? '' : meta.value.desc
})
const legacyTitle = computed(
  () => `旧记录没有保存原因，按触发来源“${sourceLabel(props.log.source, props.log.sourceName)}”推断`,
)
</script>

<template>
  <div class="reason">
    <div class="tags">
      <cycle-pill
        v-if="log.noise"
        :label="NOISE_META.label"
        :tone="NOISE_META.tone"
        :icon="NOISE_META.icon"
        :title="NOISE_META.desc"
      />
      <cycle-pill v-else :label="meta.label" :tone="meta.tone" :icon="meta.icon" :title="meta.desc" />
      <span v-if="log.inferred && !log.noise" class="legacy" :title="legacyTitle">旧记录</span>
    </div>
    <div v-if="line" class="line">{{ line }}</div>
  </div>
</template>

<style scoped>
.reason {
  min-width: 0;
  line-height: 1.4;
}
.tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.legacy {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  cursor: help;
  border-bottom: 1px dotted color-mix(in srgb, var(--text-muted) 60%, transparent);
}
.line {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-muted);
  white-space: normal;
  word-break: break-word;
}
</style>
