export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
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
  return result;
}

export function unixFromLocal(value) {
  return value ? Math.floor(new Date(value).valueOf() / 1000) : null;
}

export function localFromUnix(value) {
  return value ? new Date(Number(value) * 1000).toISOString().slice(0, 16) : '';
}
