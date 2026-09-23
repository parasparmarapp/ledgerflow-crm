// Session helpers shared by the route guard and the layout shell. Screens never touch tokens.
export const SESSION_TOKEN_KEYS = ['auth_token', 'token', 'accessToken'] as const;
export const SESSION_CHANGED_EVENT = 'buildai:session-changed';

function store(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function hasSession(): boolean {
  const s = store();
  if (!s) return false;
  return SESSION_TOKEN_KEYS.some((key) => {
    try {
      return Boolean(s.getItem(key));
    } catch {
      return false;
    }
  });
}

export function notifySessionChanged(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  } catch {
    /* non-browser environment */
  }
}

export function clearSession(): void {
  const s = store();
  if (s) {
    for (const key of [...SESSION_TOKEN_KEYS, 'user']) {
      try {
        s.removeItem(key);
      } catch {
        /* storage unavailable */
      }
    }
  }
  notifySessionChanged();
}
