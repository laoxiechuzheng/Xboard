<script setup lang="ts">
// Mobile card for one login log row (same fields as the table; details fold out below).
import { ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { ChevronDownOutline } from '@vicons/ionicons5'
import type { LoginLog } from '@/api/user'
import LoginTimeCell from './LoginTimeCell.vue'
import LoginTypeTag from './LoginTypeTag.vue'
import LoginResultTag from './LoginResultTag.vue'
import LoginIpCell from './LoginIpCell.vue'
import LoginLocationCell from './LoginLocationCell.vue'
import LoginDeviceCell from './LoginDeviceCell.vue'
import LoginLogDetail from './LoginLogDetail.vue'

withDefaults(defineProps<{ log: LoginLog; showUser?: boolean; filterableIp?: boolean }>(), {
  showUser: false,
  filterableIp: false,
})
const emit = defineEmits<{ 'filter-user': [LoginLog]; 'filter-ip': [string] }>()

const open = ref(false)
</script>

<template>
  <article class="lcard" :class="{ fail: !log.success }">
    <header class="lhead">
      <login-type-tag :type="log.type" />
      <login-result-tag :success="!!log.success" />
      <span class="grow" />
      <login-time-cell :ts="log.created_at" class="ltime" />
    </header>
    <button v-if="showUser" type="button" class="luser" @click="emit('filter-user', log)">
      <span class="email" :class="{ gone: !log.email }">{{ log.email || '用户已删除' }}</span>
      <span class="uid">ID {{ log.user_id }}</span>
    </button>
    <div class="lgrid">
      <div class="cell">
        <span class="k">IP</span>
        <login-ip-cell
          :ip="log.ip"
          :filterable="filterableIp"
          :lookup="log.geo_status !== 'private'"
          @filter="(ip: string) => emit('filter-ip', ip)"
        />
      </div>
      <div class="cell">
        <span class="k">归属地</span>
        <login-location-cell :geo-status="log.geo_status" :location="log.location" />
      </div>
      <div class="cell">
        <span class="k">设备</span>
        <login-device-cell :device="log.device" />
      </div>
      <div v-if="log.origin" class="cell">
        <span class="k">来源</span>
        <span class="origin">{{ log.origin }}</span>
      </div>
    </div>
    <n-button text size="small" icon-placement="right" class="ltoggle" :class="{ open }" @click="open = !open">
      {{ open ? '收起详情' : 'User-Agent 与更多详情' }}
      <template #icon><n-icon><chevron-down-outline /></n-icon></template>
    </n-button>
    <div v-if="open" class="ldetail">
      <login-log-detail :log="log" compact />
    </div>
  </article>
</template>

<style scoped>
.lcard {
  position: relative;
  padding: 12px 12px 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
  overflow: hidden;
}
.lcard::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: color-mix(in srgb, var(--success-color) 65%, transparent);
}
.lcard.fail {
  border-color: color-mix(in srgb, var(--error-color) 35%, var(--border-color));
  background: color-mix(in srgb, var(--error-color) 4%, var(--card-color));
}
.lcard.fail::before {
  background: var(--error-color);
}
.lhead {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grow {
  flex: 1;
}
.ltime {
  text-align: right;
}
.luser {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.luser .email {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-strong);
}
.luser:hover .email {
  color: var(--primary-color);
}
.luser .email.gone {
  font-weight: 400;
  color: var(--text-muted);
}
.luser .uid {
  flex: none;
  font-size: 12px;
  color: var(--text-muted);
}
.lgrid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--divider-color);
}
.cell {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.k {
  font-size: 12px;
  color: var(--text-muted);
}
.origin {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-color);
  word-break: break-all;
}
.ltoggle {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.ltoggle :deep(.n-icon) {
  transition: transform 0.2s;
}
.ltoggle.open :deep(.n-icon) {
  transform: rotate(180deg);
}
.ldetail {
  margin-top: 8px;
}
</style>
