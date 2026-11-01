// pnpm test (scripts/run-tests.mjs). Cleared / carried amounts of reset log rows (DESIGN §4.2, cycleFields()).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TrafficAmount } from '@/api/trafficReset'
import type { CycleResetEvent } from '@/api/trafficCycle'
import { carriedText } from '../traffic-cycle/meta'
import { normalizeCycleEvent, normalizeResetLog, type ResetLogInput } from './normalize'

const GB = 1024 ** 3
const amount = (upload: number, download: number): TrafficAmount => ({
  upload,
  download,
  total: upload + download,
  formatted: '',
})

/** A traffic-reset/logs row; `extra` overrides / adds fields. */
function row(extra: Partial<ResetLogInput> = {}): ResetLogInput {
  return {
    id: 1,
    user_id: 7,
    user_email: 'u@example.test',
    reset_type: 'manual',
    reset_type_name: '手动重置',
    reset_time: '2026-11-01T00:00:00Z',
    old_traffic: amount(0, 0),
    new_traffic: amount(0, 0),
    trigger_source: 'manual',
    trigger_source_name: '手动',
    metadata: null,
    ...extra,
  }
}

test('修改已用 40 GB -> 10 GB clears 30 GB even without a backend cleared field', () => {
  const v = normalizeResetLog(
    row({
      old_traffic: amount(10 * GB, 30 * GB),
      new_traffic: amount(2 * GB, 8 * GB),
      metadata: { reason: 'admin_usage_edit' },
    }),
  )
  assert.equal(v.reason, 'admin_usage_edit')
  assert.equal(v.cleared, 30 * GB)
  assert.equal(v.clearedUpload, 8 * GB)
  assert.equal(v.clearedDownload, 22 * GB)
  assert.equal(v.carried, 0)
})

test('history item: backend cleared wins over the old total', () => {
  const { new_traffic: _n, ...h } = row({
    old_traffic: amount(10 * GB, 30 * GB),
    metadata: { reason: 'admin_usage_edit' },
    cleared: 30 * GB,
  })
  const v = normalizeResetLog(h)
  assert.equal(v.cleared, 30 * GB)
  // The old upload / download are 40 GB in total: not a split of 30 GB.
  assert.equal(v.clearedUpload, null)
  assert.equal(v.clearedDownload, null)
})

test('history item: metadata.cleared, then old - new, then the old total', () => {
  const base = { old_traffic: amount(10 * GB, 30 * GB), metadata: { reason: 'admin_usage_edit', cleared: 30 * GB } }
  const { new_traffic: _a, ...withMeta } = row(base)
  assert.equal(normalizeResetLog(withMeta).cleared, 30 * GB)

  assert.equal(normalizeResetLog(row({ ...base, metadata: null, new_traffic: amount(0, 10 * GB) })).cleared, 30 * GB)

  // An older history endpoint sends no new_traffic at all: the whole old total is all there is.
  const { new_traffic: _b, ...legacy } = row({ old_traffic: amount(10 * GB, 30 * GB) })
  const v = normalizeResetLog(legacy)
  assert.equal(v.cleared, 40 * GB)
  assert.equal(v.clearedUpload, 10 * GB)
  assert.equal(v.clearedDownload, 30 * GB)
})

test('换时 with carried: cleared is the quota part, the excess moves into the new cycle', () => {
  const v = normalizeResetLog(
    row({
      trigger_source: 'auto',
      old_traffic: amount(5 * GB, 100 * GB),
      new_traffic: amount(0, 5 * GB),
      metadata: { reason: 'auto_advance', shift_seconds: 86400 * 3 },
      reason: 'auto_advance',
      cleared: 100 * GB,
      cleared_upload: 5 * GB,
      cleared_download: 95 * GB,
      carried: 5 * GB,
    }),
  )
  assert.equal(v.reason, 'auto_advance')
  assert.equal(v.cleared, 100 * GB)
  assert.equal(v.carried, 5 * GB)
  assert.equal(v.clearedUpload, 5 * GB)
  assert.equal(v.clearedDownload, 95 * GB)
  assert.equal(carriedText(v.carried), '超出额度的 5 GB 计入新周期')
})

test('换时 from a backend without carried: derived from new_total; other rows carry nothing', () => {
  const advance = normalizeResetLog(
    row({
      trigger_source: 'auto',
      old_traffic: amount(0, 105 * GB),
      new_traffic: amount(0, 5 * GB),
      metadata: { reason: 'auto_advance' },
    }),
  )
  assert.equal(advance.cleared, 100 * GB)
  assert.equal(advance.carried, 5 * GB)

  const rollover = normalizeResetLog(row({ trigger_source: 'cron', old_traffic: amount(GB, 49 * GB) }))
  assert.equal(rollover.reason, 'cycle_rollover')
  assert.equal(rollover.cleared, 50 * GB)
  assert.equal(rollover.carried, 0)
  assert.equal(rollover.clearedUpload, GB)
  assert.equal(carriedText(rollover.carried), '')
})

test('imported 换时 row: metadata.cleared with a 0 / 0 split shows no split', () => {
  const v = normalizeResetLog(
    row({ metadata: { reason: 'auto_advance', cleared: 80 * GB }, cleared_upload: 0, cleared_download: 0 }),
  )
  assert.equal(v.cleared, 80 * GB)
  assert.equal(v.clearedUpload, null)
  assert.equal(v.clearedDownload, null)
  assert.equal(v.carried, 0)
})

test('timeline events: carried when present, 0 for old payloads', () => {
  const e: CycleResetEvent = {
    id: 9,
    at: 1793491200,
    reason: 'auto_advance',
    trigger_source: 'auto',
    cleared: 100 * GB,
    cleared_upload: 0,
    cleared_download: 100 * GB,
    carried: 5 * GB,
  }
  const v = normalizeCycleEvent(e, 7)
  assert.equal(v.carried, 5 * GB)
  assert.equal(v.clearedDownload, 100 * GB)
  const { carried: _c, ...old } = e
  assert.equal(normalizeCycleEvent(old, 7).carried, 0)
})
