<script setup lang="ts">
// Expanded row / card details: raw User-Agent (text only, never v-html) and the remaining fields.
import { computed } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { CopyOutline, OpenOutline } from '@vicons/ionicons5'
import type { LoginLog } from '@/api/user'
import { copyText } from '@/utils/clipboard'
import { formatTime } from '@/utils/format'
import { asnUrl, deviceMeta, ipLookupUrl, ipWhoisUrl, loginTypeMeta } from './meta'

const props = withDefaults(defineProps<{ log: LoginLog; compact?: boolean }>(), { compact: false })

const loc = computed(() => props.log.location)
const rawPlace = computed(() =>
  [loc.value?.country, loc.value?.region, loc.value?.city].filter((v) => !!v && String(v).trim()).join(', '),
)
const network = computed(() => {
  const parts: string[] = []
  if (loc.value?.isp) parts.push(loc.value.isp)
  if (loc.value?.asn) parts.push(`AS${loc.value.asn}`)
  return parts.join(' · ')
})
const device = computed(() => {
  const m = deviceMeta(props.log.device)
  const model = props.log.device?.model?.trim()
  return model ? `${m.label} · ${model}` : m.label
})
// Private / reserved addresses have nothing to look up.
const geoUrl = computed(() => (props.log.geo_status === 'private' ? null : ipLookupUrl(props.log.ip)))
const whoisUrl = computed(() => (props.log.geo_status === 'private' ? null : ipWhoisUrl(props.log.ip)))
const asnLink = computed(() => asnUrl(loc.value?.asn))
const typeHint = computed(() => {
  const m = loginTypeMeta(props.log.type)
  return m.hint ? `${m.label}（${m.hint}）` : m.label
})
</script>

<template>
  <div class="detail" :class="{ compact }">
    <div class="ua-block">
      <div class="ua-head">
        <span class="label">User-Agent</span>
        <n-button v-if="log.user_agent" text size="tiny" class="copy" @click.stop="copyText(log.user_agent)">
          <template #icon><n-icon><copy-outline /></n-icon></template>
          复制
        </n-button>
      </div>
      <div class="ua" :class="{ empty: !log.user_agent }">{{ log.user_agent || '未记录 User-Agent' }}</div>
    </div>
    <dl class="facts">
      <div class="fact">
        <dt>精确时间</dt>
        <dd class="num">{{ formatTime(log.created_at) }}</dd>
      </div>
      <div class="fact">
        <dt>方式</dt>
        <dd>{{ typeHint }}</dd>
      </div>
      <div class="fact">
        <dt>来源站点</dt>
        <dd class="mono">{{ log.origin || '—' }}</dd>
      </div>
      <div class="fact">
        <dt>设备类型</dt>
        <dd>{{ device }}</dd>
      </div>
      <div class="fact">
        <dt>归属地（原文）</dt>
        <dd>{{ rawPlace || '—' }}</dd>
      </div>
      <div class="fact">
        <dt>运营商 / ASN</dt>
        <dd>
          <template v-if="network">
            {{ network }}
            <a v-if="asnLink" :href="asnLink" target="_blank" rel="noopener noreferrer" class="ext" title="ASN 详情" @click.stop>
              <n-icon :size="12"><open-outline /></n-icon>
            </a>
          </template>
          <template v-else>—</template>
        </dd>
      </div>
      <div class="fact">
        <dt>IP 查询</dt>
        <dd class="links">
          <template v-if="geoUrl">
            <a :href="geoUrl" target="_blank" rel="noopener noreferrer" @click.stop>ip.sb 归属地</a>
            <a v-if="whoisUrl" :href="whoisUrl" target="_blank" rel="noopener noreferrer" @click.stop>WHOIS</a>
          </template>
          <template v-else>{{ log.geo_status === 'private' ? '内网 / 保留地址，无需查询' : '—' }}</template>
        </dd>
      </div>
      <div class="fact">
        <dt>记录</dt>
        <dd class="num">#{{ log.id }} · 用户 ID {{ log.user_id }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
  min-width: 0;
}
.ua-block {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--divider-color);
  background: var(--code-bg);
}
.ua-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.label,
dt {
  font-size: 12px;
  color: var(--text-muted);
}
.copy {
  font-size: 12px;
}
.ua {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-color);
  word-break: break-all;
  white-space: pre-wrap;
  user-select: text;
}
.ua.empty {
  color: var(--text-muted);
  font-family: inherit;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px 20px;
  margin: 0;
}
.compact .facts {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}
.compact .ua-block {
  padding: 8px 10px;
}
.fact {
  min-width: 0;
}
dd {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-strong);
  word-break: break-all;
}
.num {
  font-variant-numeric: tabular-nums;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.links {
  display: flex;
  gap: 12px;
}
.links a,
.ext {
  color: var(--primary-color);
  text-decoration: none;
}
.links a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.ext {
  display: inline-flex;
  vertical-align: -1px;
  margin-left: 2px;
}
</style>
