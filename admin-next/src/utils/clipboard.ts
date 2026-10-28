import { message } from '@/utils/discrete'

function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(ta)
  }
}

export async function copyText(text: string, okMsg = '复制成功'): Promise<boolean> {
  let ok = false
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // Permission denied (embedded browsers / webviews): fall back below.
    }
  }
  if (!ok) {
    try {
      ok = legacyCopy(text)
    } catch {
      ok = false
    }
  }
  if (ok) message.success(okMsg)
  else message.error('复制失败，请手动复制')
  return ok
}

/** Save a Blob or text as a file in the browser. */
export function saveFile(data: Blob | string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
