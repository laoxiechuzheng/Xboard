<script setup lang="ts">
// Bulk ban confirmation (spec §6.4). Never sends sort (R-3); excludes admins by default (R-2/R-5);
// the "all" scope requires typing a confirmation phrase.
import { computed, ref, watch } from 'vue'
import { NModal, NSelect, NCheckbox, NInput, NButton, NAlert, NIcon, NSpin } from 'naive-ui'
import { BanOutline } from '@vicons/ionicons5'
import { banUsers, countUsers, type BulkScopePayload, type UserFilter } from '@/api/user'
import { message } from '@/utils/discrete'
import { formatNumber } from '@/utils/format'
import type { BulkScope, SelectedUserBrief } from './scope'

const props = defineProps<{
  show: boolean
  defaultScope: BulkScope
  selected: SelectedUserBrief[]
  filter: UserFilter[]
}>()
const emit = defineEmits<{ 'update:show': [boolean]; success: [] }>()

const CONFIRM_WORD = 'BAN ALL'
const NOT_ADMIN: UserFilter = { id: 'is_admin', value: 'eq:0' }

const scope = ref<BulkScope>('all')
const excludeAdmins = ref(true)
const confirmText = ref('')
const count = ref<number | null>(null)
const counting = ref(false)
const submitting = ref(false)
let countSeq = 0

watch(
  () => props.show,
  (v) => {
    if (!v) return
    scope.value = props.defaultScope
    excludeAdmins.value = true
    confirmText.value = ''
    void refreshCount()
  },
)
watch([scope, excludeAdmins], () => {
  if (props.show) void refreshCount()
})

const scopeOptions = computed(() => [
  { label: `仅选中（${props.selected.length}）`, value: 'selected', disabled: !props.selected.length },
  { label: '符合当前筛选的用户', value: 'filtered', disabled: !props.filter.length },
  { label: '全部用户', value: 'all' },
])

const selectedIds = computed(() =>
  props.selected.filter((u) => !(excludeAdmins.value && u.is_admin)).map((u) => u.id),
)
const skippedAdmins = computed(() => (excludeAdmins.value ? props.selected.filter((u) => u.is_admin).length : 0))

/** Effective request; admins are excluded through an extra `is_admin eq:0` filter. */
const payload = computed<BulkScopePayload | null>(() => {
  if (scope.value === 'selected') return selectedIds.value.length ? { scope: 'selected', user_ids: selectedIds.value } : null
  if (scope.value === 'filtered') {
    if (!props.filter.length) return null
    return { scope: 'filtered', filter: excludeAdmins.value ? [...props.filter, NOT_ADMIN] : props.filter }
  }
  return excludeAdmins.value ? { scope: 'filtered', filter: [NOT_ADMIN] } : { scope: 'all' }
})

async function refreshCount() {
  const p = payload.value
  if (!p) {
    count.value = 0
    return
  }
  if (p.scope === 'selected') {
    count.value = p.user_ids.length
    return
  }
  const my = ++countSeq
  counting.value = true
  try {
    const n = await countUsers(p.scope === 'filtered' ? p.filter : undefined)
    if (my === countSeq) count.value = n
  } catch {
    if (my === countSeq) count.value = null
  } finally {
    if (my === countSeq) counting.value = false
  }
}

const description = computed(() => {
  if (scope.value === 'selected') return `将对选中的 ${selectedIds.value.length} 个用户执行封禁。`
  if (scope.value === 'filtered') return '此操作将封禁所有符合当前筛选条件的用户。此操作无法撤销。'
  return '此操作将封禁系统中的所有用户。此操作无法撤销。'
})

const needWord = computed(() => scope.value === 'all')
const canSubmit = computed(
  () => !!payload.value && (count.value ?? 1) > 0 && (!needWord.value || confirmText.value.trim() === CONFIRM_WORD),
)

async function submit() {
  const p = payload.value
  if (!p || !canSubmit.value) return
  submitting.value = true
  try {
    await banUsers(p)
    message.success('批量封禁成功')
    emit('success')
    emit('update:show', false)
  } catch {
    /* toast handled by http client */
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="确认批量封禁"
    :bordered="false"
    :mask-closable="!submitting"
    :closable="!submitting"
    :style="{ width: 'min(520px, calc(100vw - 24px))' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="body">
      <div class="row">
        <span class="label">封禁范围</span>
        <n-select v-model:value="scope" :options="scopeOptions" :disabled="submitting" />
      </div>

      <n-alert type="error" :show-icon="true">
        {{ description }}
        <div class="count">
          预计影响：
          <n-spin v-if="counting" :size="12" />
          <strong v-else class="num">{{ count === null ? '未知' : formatNumber(count) }}</strong>
          个用户
          <span v-if="skippedAdmins" class="muted">（已排除 {{ skippedAdmins }} 个管理员）</span>
        </div>
      </n-alert>

      <n-checkbox v-model:checked="excludeAdmins" :disabled="submitting">排除管理员账号（推荐，避免封禁自己导致无法登录后台）</n-checkbox>

      <n-alert type="info" :show-icon="false" class="small">
        批量封禁直接更新数据库：不会立即踢下线已登录的会话，也不会立即推送到节点，节点侧需等待下次同步后生效。需要立即生效时，请在“编辑”中逐个封禁。
      </n-alert>

      <div v-if="needWord" class="row">
        <span class="label">请输入 <code>{{ CONFIRM_WORD }}</code> 以确认</span>
        <n-input v-model:value="confirmText" :placeholder="CONFIRM_WORD" :disabled="submitting" />
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
        <n-button type="error" :loading="submitting" :disabled="!canSubmit" @click="submit">
          <template #icon><n-icon><ban-outline /></n-icon></template>
          {{ submitting ? '封禁中...' : '确认封禁' }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 13px;
  font-weight: 500;
}
.label code {
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--code-bg);
}
.count {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.num {
  font-variant-numeric: tabular-nums;
}
.small {
  font-size: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
