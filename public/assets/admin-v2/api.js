const config = window.xboardAdmin || {};
const TOKEN_KEY = 'xboard.admin-v2.token';

export const session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY) || ''; },
  set token(value) {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  },
};

function endpoint(path) {
  return '/api/v2/' + encodeURIComponent(config.securePath || '') + '/' + path;
}

export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (session.token) headers.Authorization = session.token;
  const request = { ...options, headers };
  if (request.body && !(request.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    request.body = JSON.stringify(request.body);
  }
  const response = await fetch(endpoint(path), request);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload.code !== undefined && payload.code !== 0)) {
    const error = new Error(payload.message || '请求失败（' + response.status + '）');
    error.status = response.status;
    error.details = payload.errors || null;
    throw error;
  }
  return payload.data ?? payload;
}

export async function login(credentials) {
  const response = await fetch('/api/v2/passport/auth/login', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const payload = await response.json().catch(() => ({}));
  const data = payload.data ?? payload;
  if (!response.ok || !data.auth_data) throw new Error(payload.message || '登录失败');
  if (!data.is_admin) throw new Error('此账户没有管理员权限。');
  session.token = data.auth_data;
  return data;
}

export function paged(data) {
  return {
    rows: Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []),
    total: Number(data?.total || 0),
  };
}
