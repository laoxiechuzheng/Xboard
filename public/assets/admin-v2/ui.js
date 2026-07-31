export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

const HTML_TAGS = new Set(['p','br','strong','b','em','i','u','s','ul','ol','li','a','img','h1','h2','h3','h4','h5','h6','blockquote','code','pre','hr','table','thead','tbody','tr','th','td','span']);
const DROP_CONTENT_TAGS = new Set(['script','style','iframe','object','embed','svg','math','template']);

function safeUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (/^(https?:|mailto:|tel:)/i.test(input)) return input;
  if (!input.startsWith('//') && (input.startsWith('/') || input.startsWith('./') || input.startsWith('../') || input.startsWith('#'))) return input;
  return '';
}

export function sanitizeHtml(value) {
  const source = String(value || '');
  if (typeof DOMParser === 'undefined') return esc(source);
  const documentNode = new DOMParser().parseFromString('<div>' + source + '</div>', 'text/html');
  const root = documentNode.body.firstElementChild;
  const clean = node => {
    [...node.children].forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (DROP_CONTENT_TAGS.has(tag)) { child.remove(); return; }
      if (!HTML_TAGS.has(tag)) { clean(child); child.replaceWith(...child.childNodes); return; }
      const hrefValue = child.getAttribute('href');
      const sourceValue = child.getAttribute('src');
      const altValue = child.getAttribute('alt');
      [...child.attributes].forEach(attribute => child.removeAttribute(attribute.name));
      if (tag === 'a') {
        const href = safeUrl(hrefValue);
        if (href) child.setAttribute('href', href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer nofollow');
      }
      if (tag === 'img') {
        const sourceUrl = safeUrl(sourceValue);
        if (!sourceUrl || /^(mailto:|tel:|#)/i.test(sourceUrl)) { child.remove(); return; }
        child.setAttribute('src', sourceUrl);
        child.setAttribute('alt', altValue || '');
        child.setAttribute('loading', 'lazy');
        child.setAttribute('referrerpolicy', 'no-referrer');
      }
      clean(child);
    });
  };
  clean(root);
  return root.innerHTML;
}

export function date(value) {
  if (!value) return '—';
  const number = Number(value);
  const parsed = new Date(number && number < 20000000000 ? number * 1000 : value);
  return Number.isNaN(parsed.valueOf()) ? esc(value) : parsed.toLocaleString('zh-CN', { hour12: false });
}

export function bytes(value) {
  let size = Number(value || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(size) + ' ' + units[unit];
}

export function getForm(form) {
  const result = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type=checkbox][name]').forEach(box => { result[box.name] = box.checked; });
  form.querySelectorAll('input[type=number][name]').forEach(input => {
    if (result[input.name] !== '') result[input.name] = Number(result[input.name]);
  });
  form.querySelectorAll('select[name]:not([multiple])').forEach(select => {
    const values = [...select.options].map(option => option.value).filter(Boolean);
    if (result[select.name] !== '' && values.length && values.every(value => Number.isFinite(Number(value)))) {
      result[select.name] = Number(result[select.name]);
    }
  });
  return result;
}

export function unixFromLocal(value) {
  return value ? Math.floor(new Date(value).valueOf() / 1000) : null;
}

export function localFromUnix(value) {
  return value ? new Date(Number(value) * 1000).toISOString().slice(0, 16) : '';
}
