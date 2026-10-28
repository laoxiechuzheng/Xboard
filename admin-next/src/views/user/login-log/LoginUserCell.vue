<script setup lang="ts">
// 用户: email (click = only this user's records) with the user id below.
defineProps<{ email: string | null; userId: number; active?: boolean }>()
const emit = defineEmits<{ filter: [] }>()
</script>

<template>
  <div class="user">
    <button
      v-if="email"
      type="button"
      class="email"
      :class="{ active }"
      :title="active ? `${email} · 当前已只看该用户` : `${email} · 点击只看该用户`"
      @click.stop="emit('filter')"
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
.email:hover,
.email.active {
  color: var(--primary-color);
}
.email:hover {
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
