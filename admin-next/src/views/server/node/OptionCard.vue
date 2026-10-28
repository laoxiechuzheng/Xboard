<script setup lang="ts">
// Bordered option group used inside the node form (uTLS, ECH, Multiplex, Reality...).
withDefaults(defineProps<{ title: string; description?: string; open?: boolean }>(), {
  description: undefined,
  open: true,
})
</script>

<template>
  <section class="option-card">
    <header class="option-head">
      <div class="option-text">
        <div class="option-title">{{ title }}</div>
        <div v-if="description" class="option-desc">{{ description }}</div>
      </div>
      <div v-if="$slots.action" class="option-action"><slot name="action" /></div>
    </header>
    <div v-if="open && $slots.default" class="option-body"><slot /></div>
  </section>
</template>

<style scoped>
.option-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.option-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.option-text {
  min-width: 0;
}
.option-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-strong);
}
.option-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
.option-action {
  flex: none;
}
.option-body {
  margin-top: 12px;
}
</style>
