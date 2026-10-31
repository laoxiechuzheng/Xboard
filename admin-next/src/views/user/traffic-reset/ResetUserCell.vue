<script setup lang="ts">
// 用户: email (click = open the user's traffic cycle drawer) with the user id below.
defineProps<{ email: string | null; userId: number }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <div class="user">
    <button
      v-if="email"
      type="button"
      class="email"
      :title="`${email} · 查看流量周期`"
      @click.stop="emit('open')"
    >
      {{ email }}
    </button>
    <span v-else class="gone">用户已删除</span>
    <div class="uid">ID {{ userId }}</div>
  </div>
</template>

<style scoped>
.user {
  min-width: 0;
  line-height: 1.4;
}
.email {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 500;
  color: var(--text-strong);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.email:hover {
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.gone {
  color: var(--text-muted);
}
.uid {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
