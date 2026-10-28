<script setup lang="ts">
// Titled group of setting rows inside a panel.
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="setting-section">
    <div class="section-head">
      <div class="section-title">{{ title }}</div>
      <div v-if="description" class="section-desc">{{ description }}</div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.setting-section {
  margin-top: 8px;
}
.section-head {
  padding: 18px 0 2px;
}
.section-title {
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--primary-color);
}
.section-desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>
