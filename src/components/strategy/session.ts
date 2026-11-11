import type { AccountUser } from "@/components/strategy/api";

const TOKEN_KEY = "sra_access_token";
const REFRESH_KEY = "sra_refresh_token";
const USER_KEY = "sra_user";
const STATE_KEY = "github_oauth_state";

/** OAuth state 的有效期（10 分钟） */
const STATE_TTL = 10 * 60 * 1000;

interface OAuthStateRecord {
  state: string;
  createdAt: number;
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function getUser(): AccountUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AccountUser;
  } catch {
    return null;
  }
}

export function saveSession(
  accessToken: string,
  refreshToken: string | null,
  user: AccountUser | null
): void {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    sessionStorage.removeItem(REFRESH_KEY);
  }
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(USER_KEY);
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function saveOAuthState(state: string): void {
  const record: OAuthStateRecord = { state, createdAt: Date.now() };
  sessionStorage.setItem(STATE_KEY, JSON.stringify(record));
}

/** 校验并消费 OAuth state（一次性），用于防止 CSRF */
export function consumeOAuthState(expected: string): boolean {
  const raw = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw) as OAuthStateRecord;
    return saved.state === expected && Date.now() - saved.createdAt < STATE_TTL;
  } catch {
    return false;
  }
}
