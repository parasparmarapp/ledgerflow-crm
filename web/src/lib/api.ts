// Typed fetch API client for Web
const RAW_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.LEGERCRM_VITE_API_URL)
  ? import.meta.env.LEGERCRM_VITE_API_URL
  : '/api/v1';
const BASE = RAW_BASE.replace(/\/+$/, '');

export const AuthStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {}
  },
};

export function resolveApiPath(path: string): string {
  if (!path) return BASE;
  const cleanBase = BASE.replace(/\/+$/, '');
  let cleanPath = path.trim();

  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath.replace(/(\/api\/v\d+)(?:\1)+/gi, '$1');
  }
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  cleanPath = cleanPath.replace(/^(\/api\/v\d+)(?:\1)+/i, '$1');
  cleanPath = cleanPath.replace(/^\/api\/v\d+(\/api\/v\d+.*)$/i, '$1');

  const baseVersionMatch = cleanBase.match(/\/api\/(v\d+)$/i);
  const pathVersionMatch = cleanPath.match(/^\/api\/(v\d+)(\/|$)/i);

  if (baseVersionMatch && pathVersionMatch) {
    if (baseVersionMatch[1].toLowerCase() === pathVersionMatch[1].toLowerCase()) {
      const strippedPath = cleanPath.replace(/^\/api\/v\d+/, '');
      return `${cleanBase}${strippedPath || '/'}`;
    } else {
      const baseWithoutVersion = cleanBase.replace(/\/api\/v\d+$/i, '');
      return `${baseWithoutVersion}${cleanPath}`;
    }
  }
  if (!baseVersionMatch && pathVersionMatch) {
    return `${cleanBase}${cleanPath}`;
  }
  if (!baseVersionMatch && !pathVersionMatch && cleanBase !== '') {
    if (/^https?:\/\/[^\/]+$/i.test(cleanBase)) {
      return `${cleanBase}/api/v1${cleanPath}`;
    }
  }
  return `${cleanBase}${cleanPath}`;
}

// The API client owns the session: it stores the token from a successful login response and
// clears it when the server rejects the session. Screens never store or read tokens.
const SESSION_CHANGED_EVENT = 'buildai:session-changed';
const isLoginRequest = (path: string, method?: string) =>
  (method || 'GET').toUpperCase() === 'POST' && /(?:^|\/)(?:login|signin|sign-in|sessions?|token)(?:\/|\?|$)/i.test(path);

function notifySessionChanged(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  } catch {}
}

function extractToken(payload: any): string | null {
  for (const c of [payload, payload?.data, payload?.result]) {
    const t = c?.token ?? c?.accessToken ?? c?.access_token ?? c?.jwt;
    if (typeof t === 'string' && t) return t;
  }
  return null;
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = AuthStorage.getItem('auth_token');
  const targetUrl = resolveApiPath(path);
  const res = await fetch(targetUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const login = isLoginRequest(path, options.method);
  if (!res.ok) {
    if (res.status === 401 && !login && token) {
      AuthStorage.removeItem('auth_token');
      notifySessionChanged();
    }
    const errorText = await res.text().catch(() => res.statusText);
    let message = errorText || `HTTP error ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed?.error && typeof parsed.error === 'string') {
        message = parsed.error;
      } else if (parsed?.message && typeof parsed.message === 'string') {
        message = parsed.message;
      }
    } catch {}
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }
  // A 204 (and any empty 2xx) carries no body; res.json() would throw on the empty string.
  const body = res.status === 204 ? '' : await res.text();
  const data = (body ? JSON.parse(body) : undefined) as T;
  if (login) {
    const issued = extractToken(data);
    if (issued) {
      AuthStorage.setItem('auth_token', issued);
      notifySessionChanged();
    }
  }
  return data;
}

export const api = {
  get: <T>(path: string, options?: { params?: Record<string, any>; responseType?: string }) => {
    let finalPath = path;
    if (options?.params) {
      const q = new URLSearchParams();
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
      });
      const qs = q.toString();
      if (qs) finalPath += (finalPath.includes('?') ? '&' : '?') + qs;
    }
    return req<T>(finalPath, { method: 'GET' });
  },
  post: <T>(path: string, body?: unknown) => req<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => req<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => req<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => req<T>(path, { method: 'DELETE' }),
  delete: <T>(path: string) => req<T>(path, { method: 'DELETE' }),
};
