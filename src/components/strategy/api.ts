import { API_BASE_URL, REQUEST_TIMEOUT } from "@/components/strategy/config";
import { clearSession, getRefreshToken, getToken, saveSession } from "@/components/strategy/session";

/** 本站账号（MyAPI Identity），上传者即该账号的邮箱 */
export interface AccountUser {
  email: string;
}

/** Identity 登录/刷新返回的令牌结构 */
export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface StrategyMeta {
  id: number | string;
  title: string;
  description: string;
  updateTime?: number;
  uploader: string;
  isPublic: boolean;
}

/** SRA 攻略数据，与 tasks/currency_wars/strategies/template.json 一致 */
export interface SraStrategy {
  title: string;
  description: string;
  author: string;
  uploader: string;
  share_code: string;
  min_coins: number;
  min_level: number;
  mid_level: number;
  on_field: Record<string, number>;
  off_field: Record<string, number>;
}

export interface StrategyDetail extends SraStrategy {
  id: number | string | null;
  [key: string]: unknown;
}

export interface PageResult<T> {
  records: T[];
  total: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** 是否携带访问令牌，默认携带 */
  auth?: boolean;
}

/** 从 Identity 的错误响应中提取可展示文案 */
function extractErrorMessage(text: string, status: number): string {
  try {
    const data = JSON.parse(text) as {
      message?: string;
      title?: string;
      detail?: string;
      error?: string;
      errors?: Record<string, string[]>;
    };
    const firstFieldError = data.errors ? Object.values(data.errors).flat()[0] : undefined;
    return firstFieldError || data.detail || data.message || data.error || data.title || `请求失败（${status}）`;
  } catch {
    const trimmed = text.trim();
    return trimmed && trimmed.length <= 200 && !trimmed.includes("<")
      ? trimmed
      : `请求失败（${status}）`;
  }
}

/** 用 refreshToken 换取新的访问令牌；失败返回 false */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const data = (await response.json()) as TokenResponse;
    saveSession(data.accessToken, data.refreshToken, null);
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 统一请求封装：注入 Bearer 令牌、10 秒超时、401 自动刷新一次、错误信息提取。
 * 返回值为响应体本身（非 Response 对象）。
 */
async function request<T>(path: string, options: RequestOptions = {}, allowRetry = true): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    // 访问令牌过期时先静默刷新再重试一次；登录类接口的 401 表示凭据错误，不刷新
    if (response.status === 401 && allowRetry && token && !path.startsWith("/auth/")) {
      if (await refreshAccessToken()) {
        return request<T>(path, options, false);
      }
      clearSession();
    }

    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(extractErrorMessage(text, response.status), response.status);
    }
    if (!text) return undefined as T;
    // 部分 Identity 接口（如 confirmEmail）返回纯文本而非 JSON
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  } finally {
    window.clearTimeout(timer);
  }
}

/** 邮箱 + 密码登录，返回本站令牌 */
export function loginAccount(email: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>(
    "/auth/login",
    { method: "POST", body: { email, password }, auth: false },
    false
  );
}

/** 注册本站账号，成功后需要点击邮件中的链接完成验证 */
export function registerAccount(email: string, password: string): Promise<void> {
  return request<void>("/auth/register", { method: "POST", body: { email, password }, auth: false }, false);
}

/** 重新发送邮箱确认邮件 */
export function resendConfirmationEmail(email: string): Promise<void> {
  return request<void>(
    "/auth/resendConfirmationEmail",
    { method: "POST", body: { email }, auth: false },
    false
  );
}

/** 用邮件中的 userId/code 完成邮箱确认 */
export function confirmEmail(userId: string, code: string): Promise<void> {
  const query = new URLSearchParams({ userId, code });
  return request<void>(`/auth/confirmEmail?${query.toString()}`, { auth: false }, false);
}

/** 获取当前登录账号信息 */
export function getAccountInfo(): Promise<{ email: string; isEmailConfirmed: boolean }> {
  return request<{ email: string; isEmailConfirmed: boolean }>("/auth/manage/info");
}

/**
 * GitHub 授权码换取本站令牌：后端会创建或关联本站账号，并签发访问令牌。
 * POST {API_BASE_URL}/auth/github/token  Body: { code }
 */
export function exchangeGithubCode(code: string): Promise<TokenResponse> {
  return request<TokenResponse>("/auth/github/token", { method: "POST", body: { code }, auth: false }, false);
}

export function getStrategies(): Promise<StrategyMeta[]> {
  return request<StrategyMeta[]>("/strategy", { auth: false });
}

export function getStrategiesByUploader(params: {
  uploader: string;
  page: number;
  pageSize: number;
}): Promise<PageResult<StrategyMeta>> {
  const query = new URLSearchParams({
    uploader: params.uploader,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  return request<PageResult<StrategyMeta>>(`/strategy/by-uploader?${query.toString()}`, { auth: false });
}

export function getStrategyDetail(id: StrategyMeta["id"]): Promise<StrategyDetail> {
  return request<StrategyDetail>(`/strategy/${encodeURIComponent(String(id))}`, { auth: false });
}

/** 上传攻略；上传者由服务端按登录账号写入，客户端传值会被忽略 */
export function createStrategy(data: Record<string, unknown>): Promise<unknown> {
  return request<unknown>("/strategy", { method: "POST", body: data });
}
