import type { AccountUser, TokenResponse } from "@/components/strategy/api";
import {
  confirmEmail,
  exchangeGithubCode,
  getAccountInfo,
  loginAccount,
  registerAccount,
  resendConfirmationEmail,
} from "@/components/strategy/api";
import { GITHUB_CLIENT_ID, REDIRECT_PATH } from "@/components/strategy/config";
import {
  clearSession,
  consumeOAuthState,
  getToken,
  getUser,
  saveOAuthState,
  saveSession,
} from "@/components/strategy/session";

const OAUTH_ERROR_TEXT: Record<string, string> = {
  access_denied: "您取消了 GitHub 授权",
  redirect_uri_mismatch: "回调地址未在 GitHub 应用中登记",
  application_suspended: "GitHub 应用已被暂停",
};

export interface OAuthCallbackResult {
  ok: boolean;
  message?: string;
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function getCurrentUser(): AccountUser | null {
  return getUser();
}

/** 保存令牌，并用服务端返回的账号信息校正本地用户 */
async function storeTokens(tokens: TokenResponse, fallbackEmail: string): Promise<AccountUser> {
  let user: AccountUser = { email: fallbackEmail };
  saveSession(tokens.accessToken, tokens.refreshToken, user);
  try {
    const info = await getAccountInfo();
    if (info?.email) {
      user = { email: info.email };
      saveSession(tokens.accessToken, tokens.refreshToken, user);
    }
  } catch (err) {
    // 取不到账号信息时保留兜底邮箱，不影响后续上传
    console.error("Failed to fetch account info:", err);
  }
  return user;
}

/** 邮箱 + 密码登录本站账号 */
export async function loginWithAccount(email: string, password: string): Promise<AccountUser> {
  const tokens = await loginAccount(email.trim(), password);
  return storeTokens(tokens, email.trim());
}

/** 注册本站账号；注册后需点击邮件中的确认链接才能登录 */
export function registerWithAccount(email: string, password: string): Promise<void> {
  return registerAccount(email.trim(), password);
}

export function resendConfirmation(email: string): Promise<void> {
  return resendConfirmationEmail(email.trim());
}

/** 处理邮件中的确认链接（/strategy/?confirmUserId=..&confirmCode=..） */
export function confirmEmailByLink(userId: string, code: string): Promise<void> {
  return confirmEmail(userId, code);
}

export function logout(): void {
  clearSession();
}

/** 生成 URL-safe 的随机 state（CSRF 防护） */
function createOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** 回调地址 = 攻略站页面路径（需在 GitHub OAuth 应用中登记） */
function buildRedirectUri(): string {
  return new URL(REDIRECT_PATH, window.location.origin).toString();
}

function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: buildRedirectUri(),
    scope: "read:user user:email",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** 移除地址栏中的 code/state 等敏感参数 */
function cleanCallbackUrl(): void {
  const url = new URL(window.location.href);
  if (url.search) {
    url.search = "";
    window.history.replaceState(window.history.state, "", url.toString());
  }
}

/** 跳转到 GitHub 授权页面；未配置 Client ID 时返回错误文案 */
export function loginWithGitHub(): string | null {
  if (!GITHUB_CLIENT_ID) {
    return "未配置 GitHub Client ID，无法登录";
  }
  const state = createOAuthState();
  saveOAuthState(state);
  window.location.assign(buildAuthorizeUrl(state));
  return null;
}

/**
 * 处理 GitHub 授权回调：校验 state -> 后端换取本站令牌 -> 保存会话。
 * 当前地址不带 code/state/error 时返回 null（表示不是回调）。
 */
export async function handleOAuthCallback(): Promise<OAuthCallbackResult | null> {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const state = query.get("state");
  const error = query.get("error");

  if (!code && !error) return null;

  cleanCallbackUrl();

  if (error) {
    const description = query.get("error_description");
    return {
      ok: false,
      message: description || OAUTH_ERROR_TEXT[error] || "GitHub 授权失败",
    };
  }
  if (!code || !state) {
    return { ok: false, message: "授权回调参数缺失" };
  }
  if (!consumeOAuthState(state)) {
    return { ok: false, message: "state 校验失败，会话可能已过期，请重新登录" };
  }

  try {
    const tokens = await exchangeGithubCode(code);
    if (!tokens?.accessToken) {
      return { ok: false, message: "登录服务未返回访问令牌" };
    }
    await storeTokens(tokens, "");
    return { ok: true };
  } catch (err) {
    console.error("GitHub OAuth token exchange failed:", err);
    return { ok: false, message: "GitHub 登录失败，请稍后重试或使用邮箱登录" };
  }
}
