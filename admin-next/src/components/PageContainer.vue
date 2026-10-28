<script setup lang="ts">
// Standard page frame: title row with optional description and action slot.
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="page-heading">
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="description" class="page-desc">{{ description }}</p>
      </div>
      <div v-if="$slots.extra" class="page-extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="page-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.page-heading {
  min-width: 0;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: 0.01em;
}
.page-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.page-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.page-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
</style>
