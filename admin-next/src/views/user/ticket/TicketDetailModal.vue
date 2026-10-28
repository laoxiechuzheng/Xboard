<script setup lang="ts">
// Ticket detail container: centered dialog on desktop, bottom drawer on mobile (spec §2.4).
// Also hosts the user-module dialogs opened from the header (user edit drawer, traffic records).
import { ref } from 'vue'
import { NDrawer, NModal } from 'naive-ui'
import type { TicketUser } from '@/api/ticket'
import { appState } from '@/stores/app'
import UserEditDrawer from '@/views/user/user/UserEditDrawer.vue'
import TrafficRecordDialog from '@/views/user/user/TrafficRecordDialog.vue'
import TicketWorkspace from './TicketWorkspace.vue'

defineProps<{
  show: boolean
  ticketId: number | null
  /** Sidebar starts on the clicked ticket's status. */
  status: 0 | 1
}>()
const emit = defineEmits<{ 'update:show': [boolean]; changed: [] }>()

const close = () => emit('update:show', false)

const userEditShow = ref(false)
const trafficShow = ref(false)
const focusUser = ref<TicketUser | null>(null)

function openUserInfo(u: TicketUser) {
  focusUser.value = u
  userEditShow.value = true
}
function openTraffic(u: TicketUser) {
  focusUser.value = u
  trafficShow.value = true
}
</script>

<template>
  <n-drawer
    v-if="appState.isMobile"
    :show="show"
    placement="bottom"
    height="92vh"
    :content-style="{ overflow: 'hidden' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <ticket-workspace
      v-if="ticketId"
      :ticket-id="ticketId"
      :status="status"
      mobile
      @changed="emit('changed')"
      @close="close"
      @user-info="openUserInfo"
      @traffic="openTraffic"
    />
  </n-drawer>
  <n-modal v-else :show="show" :auto-focus="false" @update:show="(v: boolean) => emit('update:show', v)">
    <div class="ticket-dialog" role="dialog" aria-modal="true">
      <ticket-workspace
        v-if="ticketId"
        :ticket-id="ticketId"
        :status="status"
        :mobile="false"
        @changed="emit('changed')"
        @close="close"
        @user-info="openUserInfo"
        @traffic="openTraffic"
      />
    </div>
  </n-modal>

  <!-- Saved user changes (e.g. email) show up in the list now and in the detail on the next 5 s poll. -->
  <user-edit-drawer v-model:show="userEditShow" :user-id="focusUser?.id ?? null" @saved="emit('changed')" />
  <traffic-record-dialog v-model:show="trafficShow" :user-id="focusUser?.id ?? null" :email="focusUser?.email ?? ''" />
</template>

<style scoped>
.ticket-dialog {
  width: min(1152px, calc(100vw - 32px));
  height: 90vh;
  border-radius: 12px;
  overflow: hidden;
  background: var(--card-color);
  color: var(--text-color);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
}
</style>
