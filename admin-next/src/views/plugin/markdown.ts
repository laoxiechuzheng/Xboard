// Safe Markdown for plugin READMEs (uploaded packages are untrusted). Equivalent to the official
// markdown-it `html:false`: raw HTML is shown as text, script-capable URLs are dropped. Spec platform §3.6.
import { Marked } from 'marked'

const SAFE_LINK = /^(https?:|mailto:|#|\/|\.{0,2}\/|[^:]*$)/i
const SAFE_IMAGE = /^(https?:|data:image\/(png|jpe?g|gif|webp);|\/|\.{0,2}\/|[^:]*$)/i

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const md = new Marked({
  gfm: true,
  breaks: false,
  async: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens)
      const url = (href || '').trim()
      if (!SAFE_LINK.test(url)) return inner
      const t = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(url)}"${t} target="_blank" rel="noopener noreferrer">${inner}</a>`
    },
    image({ href, title, text }) {
      const url = (href || '').trim()
      if (!SAFE_IMAGE.test(url)) return escapeHtml(text || '')
      const t = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text || '')}"${t} loading="lazy" referrerpolicy="no-referrer">`
    },
  },
})

export function renderSafeMarkdown(src: string | null | undefined): string {
  if (!src) return ''
  try {
    return md.parse(src) as string
  } catch {
    return `<pre>${escapeHtml(src)}</pre>`
  }
}
