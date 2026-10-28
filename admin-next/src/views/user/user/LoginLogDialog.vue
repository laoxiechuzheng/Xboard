<script setup lang="ts">
// Per-user "登录记录" dialog (user list row action).
// Contract: props { show, userId, email? }, emits update:show. Loads only while open.
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NModal, NDataTable, NButton, NIcon, NEmpty, NSpin, NPagination, type PaginationProps } from 'naive-ui'
import { ArrowForwardOutline, CloudOfflineOutline } from '@vicons/ionicons5'
import { ApiError } from '@/api/http'
import { fetchLoginLogs, type LoginLog } from '@/api/user'
import { appState } from '@/stores/app'
import { formatNumber } from '@/utils/format'
import LoginLogCard from '../login-log/LoginLogCard.vue'
import { buildLoginLogColumns, loginLogRowClass, loginLogScrollX } from '../login-log/columns'

const props = withDefaults(defineProps<{ show: boolean; userId: number | null; email?: string }>(), { email: '' })
const emit = defineEmits<{ 'update:show': [boolean] }>()

const router = useRouter()
const rows = shallowRef<LoginLog[]>([])
const loading = ref(false)
const error = shallowRef<unknown>(null)
let seq = 0

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  prefix: ({ itemCount }) => `共 ${formatNumber(itemCount ?? 0)} 条`,
  onUpdatePage: (p: number) => {
    pagination.page = p
    void load()
  },
  onUpdatePageSize: (s: number) => {
    pagination.pageSize = s
    pagination.page = 1
    void load()
  },
})

async function load() {
  if (!props.userId) return
  const my = ++seq
  loading.value = true
  try {
    const res = await fetchLoginLogs(
      { current: pagination.page ?? 1, pageSize: pagination.pageSize ?? 10, user_id: props.userId },
      { silent: true },
    )
    if (my !== seq) return
    rows.value = res.data ?? []
    pagination.itemCount = Number(res.total ?? 0)
    error.value = null
  } catch (e) {
    if (my !== seq) return
    rows.value = []
    pagination.itemCount = 0
    error.value = e
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(
  () => [props.show, props.userId] as const,
  ([show]) => {
    if (!show) return
    pagination.page = 1
    rows.value = []
    error.value = null
    void load()
  },
  { immediate: true },
)

const columns = buildLoginLogColumns()
const scrollX = loginLogScrollX(false)

const failCount = computed(() => rows.value.filter((r) => !r.success).length)
const errorText = computed(() => {
  const e = error.value
  if (!e) return ''
  if (e instanceof ApiError && e.status === 404) return '当前面板还没有登录记录接口，升级面板后即可查看。'
  return e instanceof Error && e.message ? e.message : '登录记录加载失败'
})

const pageCount = computed(() => Math.max(1, Math.ceil((pagination.itemCount ?? 0) / (pagination.pageSize ?? 10))))
function goPage(p: number) {
  pagination.page = p
  void load()
}

function openFullPage() {
  if (!props.userId) return
  emit('update:show', false)
  void router.push({ path: '/user/login-log', query: { user_id: String(props.userId) } })
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :bordered="false"
    :style="{ width: 'min(1120px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template #header>
      <div class="title">
        <span class="main">登录记录</span>
        <span v-if="email" class="sub">{{ email }}</span>
      </div>
    </template>
    <template #header-extra>
      <n-button text type="primary" icon-placement="right" class="full-link" :disabled="!userId" @click="openFullPage">
        {{ appState.isMobile ? '完整页面' : '在登录记录页查看' }}
        <template #icon><n-icon><arrow-forward-outline /></n-icon></template>
      </n-button>
    </template>

    <p class="desc">
      最近的登录、注册与链接登录，展开可查看完整 User-Agent。
      <span v-if="failCount" class="fail-note">本页有 {{ failCount }} 次密码错误的尝试。</span>
    </p>

    <div v-if="errorText && !loading" class="state">
      <n-icon :size="22"><cloud-offline-outline /></n-icon>
      <span>{{ errorText }}</span>
      <n-button size="tiny" secondary @click="load">重试</n-button>
    </div>

    <n-data-table
      v-else-if="!appState.isMobile"
      remote
      size="small"
      class="log-table"
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: LoginLog) => r.id"
      :row-class-name="loginLogRowClass"
      :scroll-x="scrollX"
      :max-height="460"
    >
      <template #empty>
        <n-empty description="该用户暂无登录记录" />
      </template>
    </n-data-table>

    <template v-else>
      <n-spin :show="loading">
        <div class="cards">
          <login-log-card v-for="row in rows" :key="row.id" :log="row" />
          <n-empty v-if="!loading && !rows.length" description="该用户暂无登录记录" class="cards-empty" />
        </div>
      </n-spin>
      <div v-if="(pagination.itemCount ?? 0) > (pagination.pageSize ?? 10)" class="mobile-pager">
        <span class="muted">共 {{ formatNumber(pagination.itemCount ?? 0) }} 条</span>
        <n-pagination :page="pagination.page" :page-count="pageCount" simple @update:page="goPage" />
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.main {
  flex: none;
  white-space: nowrap;
}
.sub {
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.full-link {
  margin-left: 12px;
  font-size: 13px;
  white-space: nowrap;
}
.desc {
  margin: -6px 0 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.fail-note {
  margin-left: 4px;
  color: var(--error-color);
}
.state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 14px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-color);
  background: color-mix(in srgb, var(--warning-color) 9%, transparent);
}
.state .n-icon {
  color: var(--warning-color);
}
.log-table :deep(.ll-fail > td) {
  --n-merged-td-color: color-mix(in srgb, var(--error-color) 6%, transparent);
}
.log-table :deep(.ll-fail > td:first-child) {
  box-shadow: inset 3px 0 0 var(--error-color);
}
.log-table :deep(.ll-origin) {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-color);
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100px;
}
.cards-empty {
  padding: 28px 0;
}
.mobile-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}
@media (max-width: 767px) {
  .full-link {
    font-size: 12px;
  }
}
</style>
