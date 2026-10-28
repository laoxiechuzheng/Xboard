// Notice tag helpers. v2_notice.tags is a varchar(255) holding the JSON encoded array (spec R-N6).

export const TAGS_MAX_JSON = 255

/**
 * Length of `json_encode($value)` as Laravel's array cast stores it: no flags, so every non-ASCII
 * UTF-16 unit becomes "\uXXXX" (6 chars) and "/" becomes "\/".
 */
export function phpJsonLength(value: unknown): number {
  const s = JSON.stringify(value)
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    n += c > 0x7f ? 6 : c === 0x2f ? 2 : 1
  }
  return n
}

/** Split pasted/typed text on commas (half/full width), semicolons and new lines; trim, drop empties. */
export function splitTags(text: string): string[] {
  return text
    .split(/[,，;；\r\n]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

/** Normalize stored tags (null / non-array / blanks / duplicates) for editing (spec R-N2, R-N4). */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const out: string[] = []
  for (const t of tags) {
    const s = String(t ?? '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}
