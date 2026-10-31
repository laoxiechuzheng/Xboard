<script setup lang="ts">
// 关联与备注: cycle (opens the user's cycle drawer), order and admin links, then the admin note.
import { RouterLink } from 'vue-router'
import type { ResetLogView } from './normalize'

defineProps<{ log: ResetLogView; cycleClickable?: boolean }>()
const emit = defineEmits<{ 'open-cycle': [ResetLogView] }>()
</script>

<template>
  <div class="links-cell">
    <div v-if="log.cycleId || log.orderId || log.adminId" class="links">
      <button
        v-if="log.cycleId && cycleClickable"
        type="button"
        class="chip"
        title="查看该用户的流量周期"
        @click.stop="emit('open-cycle', log)"
      >
        周期 #{{ log.cycleId }}
      </button>
      <span v-else-if="log.cycleId" class="chip static">周期 #{{ log.cycleId }}</span>
      <router-link
        v-if="log.orderId"
        class="chip"
        :to="{ path: '/finance/order', query: { order_id: String(log.orderId) } }"
        title="在订单管理中查看"
        @click.stop
      >
        订单 #{{ log.orderId }}
      </router-link>
      <router-link
        v-if="log.adminId"
        class="chip"
        :to="{ path: '/user/manage', query: { id: String(log.adminId) } }"
        title="操作的管理员"
        @click.stop
      >
        管理员 #{{ log.adminId }}
      </router-link>
    </div>
    <div v-if="log.note" class="note" :title="log.note">{{ log.note }}</div>
    <span v-if="!log.cycleId && !log.orderId && !log.adminId && !log.note" class="muted">—</span>
  </div>
</template>

<style scoped>
.links-cell {
  min-width: 0;
  line-height: 1.4;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-decoration: none;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 9%, transparent);
  cursor: pointer;
}
.chip:hover {
  background: color-mix(in srgb, var(--primary-color) 16%, transparent);
}
.chip.static {
  color: var(--text-color);
  background: var(--hover-color);
  cursor: default;
}
.note {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-color);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
.note::before {
  content: '备注：';
  color: var(--text-muted);
}
.muted {
  color: var(--text-muted);
}
</style>
