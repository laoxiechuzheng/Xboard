<script setup lang="ts">
// 归属地: localised country + region/city, ISP and ASN (ip.sb WHOIS link); pending/private/failed states.
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { LockClosedOutline, WarningOutline } from '@vicons/ionicons5'
import type { LoginLogLocation } from '@/api/user'
import { asnUrl, countryCode, countryName, placeText } from './meta'

const props = defineProps<{ geoStatus: string; location: LoginLogLocation | null }>()

const code = computed(() => countryCode(props.location))
const country = computed(() => countryName(props.location))
const place = computed(() => placeText(props.location))
const isp = computed(() => props.location?.isp?.trim() || '')
const asn = computed(() => (props.location?.asn ? Number(props.location.asn) : null))
const asnLink = computed(() => asnUrl(asn.value))
const full = computed(() => [country.value, place.value].filter(Boolean).join(' · '))
const resolved = computed(() => props.geoStatus === 'resolved' && !!(full.value || isp.value))
</script>

<template>
  <div v-if="resolved" class="loc">
    <div class="loc-main" :title="full || undefined">
      <span v-if="code" class="cc">{{ code }}</span>
      <span class="country">{{ country || '未知' }}</span>
      <span v-if="place" class="place">{{ place }}</span>
    </div>
    <div v-if="isp || asnLink" class="loc-sub">
      <span v-if="isp" class="isp" :title="isp">{{ isp }}</span>
      <a v-if="asnLink" :href="asnLink" target="_blank" rel="noopener noreferrer" class="asn" title="在 ip.sb 查看 ASN" @click.stop>
        AS{{ asn }}
      </a>
    </div>
  </div>
  <span v-else-if="geoStatus === 'pending'" class="state pending">
    <span class="pulse" />
    归属地解析中…
  </span>
  <span v-else-if="geoStatus === 'private'" class="state">
    <n-icon :size="13"><lock-closed-outline /></n-icon>
    内网 / 保留地址
  </span>
  <span v-else-if="geoStatus === 'failed'" class="state warn">
    <n-icon :size="13"><warning-outline /></n-icon>
    解析失败
  </span>
  <span v-else class="state">未知</span>
</template>

<style scoped>
.loc {
  min-width: 0;
  line-height: 1.45;
}
.loc-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.cc {
  flex: none;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}
.country {
  flex: none;
  font-weight: 500;
  color: var(--text-strong);
}
.place {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-color);
}
.place::before {
  content: '·';
  margin-right: 6px;
  color: var(--text-muted);
}
.loc-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.isp {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asn {
  flex: none;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
  border-bottom: 1px dashed color-mix(in srgb, var(--text-muted) 60%, transparent);
}
.asn:hover {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.state.warn {
  color: var(--warning-color);
}
.pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--info-color);
  animation: ll-pulse 1.4s ease-in-out infinite;
}
@keyframes ll-pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--info-color) 45%, transparent);
  }
  50% {
    opacity: 0.55;
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--info-color) 0%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
  }
}
</style>
