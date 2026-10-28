// Bulk operation scope (spec §6): selected rows > current filters > all users.
import type { BulkScopePayload, UserFilter } from '@/api/user'

export type BulkScope = 'selected' | 'filtered' | 'all'

/** What the page remembers about each checked row (rows can be checked across pages). */
export interface SelectedUserBrief {
  id: number
  email: string
  is_admin: boolean
}

export function autoScope(selectedCount: number, filterCount: number): BulkScope {
  if (selectedCount > 0) return 'selected'
  if (filterCount > 0) return 'filtered'
  return 'all'
}

export function scopeSuffix(scope: BulkScope, selectedCount: number): string {
  if (scope === 'selected') return `（${selectedCount}）`
  if (scope === 'filtered') return '（筛选）'
  return '（全部）'
}

/** Never returns a filtered scope with an empty filter (that would hit every user, R-4). */
export function scopePayload(scope: BulkScope, ids: number[], filter: UserFilter[]): BulkScopePayload | null {
  if (scope === 'selected') return ids.length ? { scope: 'selected', user_ids: ids } : null
  if (scope === 'filtered') return filter.length ? { scope: 'filtered', filter } : null
  return { scope: 'all' }
}
