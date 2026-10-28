// Template form model <-> backend payload conversion (spec commerce §6.2.5, risks §6.7 4–8).
import {
  asObject,
  type GiftCardConditions,
  type GiftCardLimits,
  type GiftCardRewards,
  type GiftCardSpecialConfig,
  type GiftCardTemplate,
  type GiftCardType,
  type GiftRandomReward,
  type TemplatePayload,
} from '@/api/giftCard'
import { bytesToGB, centsToYuan, gbToBytes, yuanToCents } from '@/utils/format'

export const DEFAULT_THEME_COLOR = '#1890ff'
/** Decimals of the GB inputs (≈1 MB). */
export const GB_DIGITS = 3

export interface RandomRow {
  key: number
  weight: number | null
  /** 元 */
  balance: number | null
  /** GB */
  transfer_enable: number | null
  expire_days: number | null
  device_limit: number | null
  /** Stored bytes when loaded from a template; written back unchanged if the GB field is untouched. */
  src_transfer_enable: number | null
}

export interface TemplateForm {
  name: string
  description: string
  type: GiftCardType
  status: boolean
  sort: number | null
  // rewards (UI units: 元 / GB)
  balance: number | null
  transfer_enable: number | null
  expire_days: number | null
  device_limit: number | null
  reset_package: boolean
  plan_id: number | null
  plan_validity_days: number | null
  random_rewards: RandomRow[]
  invite_reward_rate: number | null
  // conditions
  new_user_only: boolean
  new_user_max_days: number | null
  paid_user_only: boolean
  require_invite: boolean
  allowed_plans: number[]
  disallowed_plans: number[]
  // limits
  max_use_per_user: number | null
  cooldown_hours: number | null
  // special config (ms for the date pickers)
  start_time: number | null
  end_time: number | null
  festival_bonus: number | null
  // display
  icon: string
  background_image: string
  theme_color: string
}

/** Reward keys that each card type keeps; the rest are dropped on save (backend grants every key). */
export const TYPE_REWARD_KEYS: Record<GiftCardType, string[]> = {
  1: ['balance', 'transfer_enable', 'expire_days', 'device_limit', 'reset_package', 'invite_reward_rate'],
  2: ['plan_id', 'plan_validity_days'],
  3: ['random_rewards', 'invite_reward_rate'],
}
const KNOWN_REWARD_KEYS = [
  'balance',
  'transfer_enable',
  'expire_days',
  'device_limit',
  'reset_package',
  'plan_id',
  'plan_validity_days',
  'random_rewards',
  'invite_reward_rate',
]
const KNOWN_CONDITION_KEYS = ['new_user_only', 'new_user_max_days', 'paid_user_only', 'require_invite', 'allowed_plans', 'disallowed_plans']
// limits.invite_reward_rate (legacy, ignored by the backend) is kept as an extra key until it is migrated.
const KNOWN_LIMIT_KEYS = ['max_use_per_user', 'cooldown_hours']
const KNOWN_SPECIAL_KEYS = ['start_time', 'end_time', 'festival_bonus']

export const REWARD_KEY_LABELS: Record<string, string> = {
  balance: '奖励余额',
  transfer_enable: '奖励流量',
  expire_days: '延长有效期',
  device_limit: '增加设备数',
  reset_package: '重置当月流量',
  plan_id: '指定套餐',
  plan_validity_days: '套餐有效期',
  random_rewards: '随机奖励池',
  invite_reward_rate: '邀请人奖励比例',
}

let rowSeq = 0
export function newRandomRow(partial: Partial<RandomRow> = {}): RandomRow {
  return {
    key: ++rowSeq,
    weight: 10,
    balance: null,
    transfer_enable: null,
    expire_days: null,
    device_limit: null,
    src_transfer_enable: null,
    ...partial,
  }
}

export function emptyForm(): TemplateForm {
  return {
    name: '',
    description: '',
    type: 1,
    status: true,
    sort: 0,
    balance: null,
    transfer_enable: null,
    expire_days: null,
    device_limit: null,
    reset_package: false,
    plan_id: null,
    plan_validity_days: null,
    random_rewards: [],
    invite_reward_rate: null,
    new_user_only: false,
    new_user_max_days: null,
    paid_user_only: false,
    require_invite: false,
    allowed_plans: [],
    disallowed_plans: [],
    max_use_per_user: null,
    cooldown_hours: null,
    start_time: null,
    end_time: null,
    festival_bonus: null,
    icon: '',
    background_image: '',
    theme_color: DEFAULT_THEME_COLOR,
  }
}

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const positive = (v: unknown): number | null => {
  const n = numOrNull(v)
  return n !== null && n > 0 ? n : null
}
const idList = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : []
/** PHP isset(): the key exists and is not null (0, false and [] count as set). */
const isSet = (obj: Record<string, unknown>, key: string): boolean => obj[key] !== undefined && obj[key] !== null

/** GB value shown in the form for stored bytes (rounded to the input precision). */
const formGB = (bytes: unknown): number => bytesToGB(bytes as number, GB_DIGITS)

/**
 * Bytes to save for a GB field: the stored value when the field still shows it (so editing other
 * fields does not rewrite e.g. 500 MB = 0.488 GB as 523986010 bytes), otherwise the converted input.
 */
function bytesForSave(gb: number, stored: unknown): number {
  const orig = Number(stored)
  if (Number.isFinite(orig) && orig > 0 && formGB(orig) === gb) return Math.round(orig)
  return gbToBytes(gb)
}

export function formFromTemplate(t: GiftCardTemplate): TemplateForm {
  const r = asObject<GiftCardRewards>(t.rewards)
  const c = asObject<GiftCardConditions>(t.conditions)
  const l = asObject<GiftCardLimits>(t.limits)
  const s = asObject<GiftCardSpecialConfig>(t.special_config)
  const random = Array.isArray(r.random_rewards) ? r.random_rewards : []
  const type = ([1, 2, 3].includes(Number(t.type)) ? Number(t.type) : 1) as GiftCardType
  return {
    name: t.name ?? '',
    description: t.description ?? '',
    type,
    status: !!t.status,
    sort: numOrNull(t.sort) ?? 0,
    balance: positive(r.balance) !== null ? centsToYuan(r.balance) : null,
    transfer_enable: positive(r.transfer_enable) !== null ? formGB(r.transfer_enable) : null,
    expire_days: positive(r.expire_days),
    device_limit: positive(r.device_limit),
    reset_package: !!r.reset_package,
    plan_id: numOrNull(r.plan_id),
    plan_validity_days: positive(r.plan_validity_days),
    random_rewards: random.map((it: GiftRandomReward) =>
      newRandomRow({
        weight: numOrNull(it.weight),
        balance: positive(it.balance) !== null ? centsToYuan(it.balance) : null,
        transfer_enable: positive(it.transfer_enable) !== null ? formGB(it.transfer_enable) : null,
        expire_days: positive(it.expire_days),
        device_limit: positive(it.device_limit),
        src_transfer_enable: positive(it.transfer_enable),
      }),
    ),
    // A legacy rate in limits (official UI, never effective) is only migrated on request; see legacyInviteRate().
    invite_reward_rate: positive(r.invite_reward_rate),
    new_user_only: !!c.new_user_only,
    new_user_max_days: positive(c.new_user_max_days),
    paid_user_only: !!c.paid_user_only,
    require_invite: !!c.require_invite,
    allowed_plans: idList(c.allowed_plans),
    disallowed_plans: idList(c.disallowed_plans),
    max_use_per_user: positive(l.max_use_per_user),
    cooldown_hours: positive(l.cooldown_hours),
    start_time: positive(s.start_time) !== null ? Number(s.start_time) * 1000 : null,
    end_time: positive(s.end_time) !== null ? Number(s.end_time) * 1000 : null,
    festival_bonus: positive(s.festival_bonus),
    icon: t.icon ?? '',
    background_image: t.background_image ?? '',
    theme_color: t.theme_color && /^#[0-9A-Fa-f]{6}$/.test(t.theme_color) ? t.theme_color : DEFAULT_THEME_COLOR,
  }
}

/** Keys of `obj` that this form does not manage (kept untouched on save). */
function extraKeys(obj: Record<string, unknown>, known: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (!known.includes(k)) out[k] = v
  return out
}

/**
 * Rate the official UI saved under `limits`, where the backend never reads it (so it never took
 * effect). Null when absent or when `rewards` already has its own rate.
 */
export function legacyInviteRate(original: GiftCardTemplate | null): number | null {
  if (!original) return null
  const l = asObject<GiftCardLimits>(original.limits)
  const r = asObject<GiftCardRewards>(original.rewards)
  return positive(r.invite_reward_rate) === null ? positive(l.invite_reward_rate) : null
}

const show = (v: unknown) => (typeof v === 'boolean' ? (v ? '开启' : '关闭') : Array.isArray(v) ? '[]' : JSON.stringify(v))

/**
 * Stored values the backend treats as "set" (isset) although the official UI meant "empty"
 * (cleared inputs saved as 0 / false / []). This form omits empty fields, so saving removes them
 * and the redemption rules change. Only issues the current form state does not override are listed.
 */
export function legacyValueIssues(original: GiftCardTemplate | null, f: TemplateForm): string[] {
  if (!original) return []
  const r = asObject<GiftCardRewards>(original.rewards)
  const c = asObject<GiftCardConditions>(original.conditions)
  const l = asObject<GiftCardLimits>(original.limits)
  const out: string[] = []

  if (f.type === 1 && Number(original.type) === 1 && !positive(f.transfer_enable) && !positive(f.expire_days) && !f.reset_package) {
    const trigger: Record<string, string> = { transfer_enable: '奖励流量', expire_days: '延长有效期', reset_package: '重置当月流量' }
    const keys = Object.keys(trigger).filter((k) => isSet(r, k))
    const effective = keys.some((k) => (k === 'reset_package' ? !!r[k] : Number(r[k]) > 0))
    if (keys.length && !effective) {
      out.push(
        `奖励中的${keys.map((k) => `“${trigger[k]}”= ${show(r[k])}`).join('、')}：目前仍会要求用户已订阅套餐才能兑换；保存后这些项被移除，没有套餐的用户也可以兑换。`,
      )
    }
  }
  if (f.new_user_only && f.new_user_max_days === null && c.new_user_only && isSet(c, 'new_user_max_days') && positive(c.new_user_max_days) === null) {
    out.push(`新用户注册天数限制 = ${show(c.new_user_max_days)}：目前几乎没有用户能兑换；保存后该值被移除，恢复默认 7 天。`)
  }
  if (!f.allowed_plans.length && isSet(c, 'allowed_plans') && idList(c.allowed_plans).length === 0) {
    out.push(`允许的套餐 = ${show(c.allowed_plans)}：目前所有已有套餐的用户都无法兑换；保存后该限制被移除，不再限制套餐。`)
  }
  if (f.max_use_per_user === null && isSet(l, 'max_use_per_user') && positive(l.max_use_per_user) === null) {
    out.push(`单用户最大使用次数 = ${show(l.max_use_per_user)}：目前任何用户都无法兑换；保存后该限制被移除，不限次数。`)
  }
  return out
}

/** Known reward keys present on the original template that the current type will drop. */
export function droppedRewardKeys(original: GiftCardTemplate | null, type: GiftCardType): string[] {
  if (!original) return []
  const r = asObject<GiftCardRewards>(original.rewards)
  const keep = TYPE_REWARD_KEYS[type]
  return KNOWN_REWARD_KEYS.filter((k) => {
    if (keep.includes(k) || !(k in r)) return false
    const v = r[k]
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== false && v !== 0 && v !== ''
  })
}

/**
 * Build the request body. Empty numeric inputs are omitted instead of being sent as 0
 * (e.g. max_use_per_user = 0 would block everyone), and falsy switches are omitted because the
 * backend checks `isset()` (reset_package=false would still require the user to own a plan).
 */
export function buildPayload(f: TemplateForm, original: GiftCardTemplate | null): TemplatePayload {
  const origRewards = original ? asObject<GiftCardRewards>(original.rewards) : {}
  const origConditions = original ? asObject<GiftCardConditions>(original.conditions) : {}
  const origLimits = original ? asObject<GiftCardLimits>(original.limits) : {}
  const origSpecial = original ? asObject<GiftCardSpecialConfig>(original.special_config) : {}

  const rewards: GiftCardRewards = { ...extraKeys(origRewards, KNOWN_REWARD_KEYS) }
  if (f.type === 1) {
    const balance = yuanToCents(positive(f.balance))
    if (balance) rewards.balance = balance
    if (positive(f.transfer_enable)) rewards.transfer_enable = bytesForSave(f.transfer_enable!, origRewards.transfer_enable)
    if (positive(f.expire_days)) rewards.expire_days = Math.round(f.expire_days!)
    if (positive(f.device_limit)) rewards.device_limit = Math.round(f.device_limit!)
    if (f.reset_package) rewards.reset_package = true
  } else if (f.type === 2) {
    if (f.plan_id !== null) rewards.plan_id = f.plan_id
    if (positive(f.plan_validity_days)) rewards.plan_validity_days = Math.round(f.plan_validity_days!)
  } else {
    rewards.random_rewards = f.random_rewards.map((row) => {
      const item: GiftRandomReward = { weight: Math.round(row.weight ?? 0) }
      const balance = yuanToCents(positive(row.balance))
      if (balance) item.balance = balance
      if (positive(row.transfer_enable)) item.transfer_enable = bytesForSave(row.transfer_enable!, row.src_transfer_enable)
      if (positive(row.expire_days)) item.expire_days = Math.round(row.expire_days!)
      if (positive(row.device_limit)) item.device_limit = Math.round(row.device_limit!)
      return item
    })
  }
  if (f.type !== 2 && positive(f.invite_reward_rate)) rewards.invite_reward_rate = f.invite_reward_rate!

  const conditions: GiftCardConditions = { ...extraKeys(origConditions, KNOWN_CONDITION_KEYS) }
  if (f.new_user_only) conditions.new_user_only = true
  if (positive(f.new_user_max_days)) conditions.new_user_max_days = Math.round(f.new_user_max_days!)
  if (f.paid_user_only) conditions.paid_user_only = true
  if (f.require_invite) conditions.require_invite = true
  // An empty allowed_plans array would block every user that owns a plan (backend uses isset()).
  if (f.allowed_plans.length) conditions.allowed_plans = [...f.allowed_plans]
  if (f.disallowed_plans.length) conditions.disallowed_plans = [...f.disallowed_plans]

  const limits: GiftCardLimits = { ...extraKeys(origLimits, KNOWN_LIMIT_KEYS) }
  if (positive(f.max_use_per_user)) limits.max_use_per_user = Math.round(f.max_use_per_user!)
  if (positive(f.cooldown_hours)) limits.cooldown_hours = f.cooldown_hours!
  // The rate now lives in rewards (migrated or set anew): drop the ignored legacy copy.
  if (rewards.invite_reward_rate !== undefined) delete limits.invite_reward_rate

  const special: GiftCardSpecialConfig = { ...extraKeys(origSpecial, KNOWN_SPECIAL_KEYS) }
  if (f.start_time) special.start_time = Math.floor(f.start_time / 1000)
  if (f.end_time) special.end_time = Math.floor(f.end_time / 1000)
  if (positive(f.festival_bonus)) special.festival_bonus = f.festival_bonus!

  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    type: f.type,
    status: f.status,
    sort: Math.max(0, Math.round(f.sort ?? 0)),
    rewards,
    conditions,
    limits,
    special_config: special,
    icon: f.icon.trim() || null,
    background_image: f.background_image.trim() || null,
    theme_color: f.theme_color || DEFAULT_THEME_COLOR,
  }
}

function isUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Field errors keyed by form path; empty object when valid. */
export function validateForm(f: TemplateForm): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.name.trim()) e.name = '请输入模板名称'
  else if (f.name.trim().length > 255) e.name = '模板名称不能超过 255 个字符'

  if (f.type === 1) {
    const any =
      positive(f.balance) || positive(f.transfer_enable) || positive(f.expire_days) || positive(f.device_limit) || f.reset_package
    if (!any) e.rewards = '请至少配置一项奖励'
  } else if (f.type === 2) {
    if (f.plan_id === null) e.plan_id = '请选择一个套餐'
  } else {
    if (!f.random_rewards.length) e.random_rewards = '请至少添加一个随机奖励项'
    f.random_rewards.forEach((row, i) => {
      if (!row.weight || row.weight < 1 || !Number.isInteger(row.weight)) e[`random_${i}`] = '权重须为不小于 1 的整数'
    })
  }

  if (f.invite_reward_rate !== null && (f.invite_reward_rate <= 0 || f.invite_reward_rate > 1)) {
    e.invite_reward_rate = '比例须在 0–1 之间，例如 0.2 代表 20%'
  }

  if (f.festival_bonus !== null) {
    if (f.festival_bonus <= 1) e.festival_bonus = '节日奖励乘数需大于 1 才会生效'
    else if (f.type === 2) e.festival_bonus = '套餐礼品卡不能设置节日乘数：后端会把乘数作用到套餐 ID 上，导致开通错误的套餐'
    else if (!f.start_time || !f.end_time) e.festival_bonus = '设置节日乘数时必须同时选择活动开始和结束时间'
  }
  if (f.start_time && f.end_time && f.end_time <= f.start_time) e.end_time = '结束时间必须晚于开始时间'

  if (f.icon.trim().length > 255) e.icon = '图标地址不能超过 255 个字符'
  const bg = f.background_image.trim()
  if (bg && !isUrl(bg)) e.background_image = '背景图片必须是有效的 URL（http/https）'
  else if (bg.length > 255) e.background_image = '背景图片地址不能超过 255 个字符'
  if (f.theme_color && !/^#[0-9A-Fa-f]{6}$/.test(f.theme_color)) e.theme_color = '主题色格式应为 #RRGGBB'
  return e
}
