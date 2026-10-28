// Minimal HTML sanitizer for admin-side Markdown previews (spec R-X3): the admin page holds the
// admin token, so author-supplied HTML must not run scripts here. DOMParser documents are inert.
const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'noscript',
  'template',
  'svg',
  'math',
])
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'srcset', 'data'])

function unsafeUrl(value: string, allowDataImage: boolean): boolean {
  // Strip whitespace/control chars browsers ignore inside schemes ("java\nscript:").
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000- \u007f]+/g, '').toLowerCase()
  if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true
  if (v.startsWith('data:')) return !(allowDataImage && /^data:image\/(png|gif|jpe?g|webp|bmp);/.test(v))
  return false
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase()
    if (BLOCKED_TAGS.has(tag)) {
      el.remove()
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
        el.removeAttribute(attr.name)
      } else if (URL_ATTRS.has(name) && unsafeUrl(attr.value, tag === 'img' && name === 'src')) {
        el.removeAttribute(attr.name)
      } else if (name === 'style' && /expression\s*\(|javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name)
      }
    }
    if (tag === 'a') {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer nofollow')
    }
  }
  return doc.body.innerHTML
}
