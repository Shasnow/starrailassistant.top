import { API_BASE_URL, REQUEST_TIMEOUT } from "@/components/strategy/config";
import { clearSession, getToken } from "@/components/strategy/session";

export interface GithubUser {
  login: string;
  avatar_url: string;
  name?: string;
  [key: string]: unknown;
}

export interface GithubTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
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
}

/**
 * 统一请求封装：注入 Bearer 令牌、10 秒超时、错误信息提取。
 * 返回值为响应体本身（非 Response 对象）。
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401) clearSession();
    if (!response.ok) {
      let message = `请求失败（${response.status}）`;
      try {
        const data = (await response.json()) as { message?: string };
        if (data?.message) message = data.message;
      } catch {
        // 响应体不是 JSON，沿用默认文案
      }
      throw new ApiError(message, response.status);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export function getStrategies(): Promise<StrategyMeta[]> {
  return request<StrategyMeta[]>("/strategy");
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
  return request<PageResult<StrategyMeta>>(`/strategy/by-uploader?${query.toString()}`);
}

export function getStrategyDetail(id: StrategyMeta["id"]): Promise<StrategyDetail> {
  return request<StrategyDetail>(`/strategy/${encodeURIComponent(String(id))}`);
}

export function createStrategy(data: Record<string, unknown>): Promise<unknown> {
  return request<unknown>("/strategy", { method: "POST", body: data });
}

/**
 * 后端持有 Client Secret 完成 code -> access_token 的交换。
 * POST {API_BASE_URL}/auth/github/token  Body: { code }
 */
export function exchangeGithubToken(code: string): Promise<GithubTokenResponse> {
  return request<GithubTokenResponse>("/auth/github/token", {
    method: "POST",
    body: { code },
  });
}

/** 直接从 GitHub API 获取当前用户信息（api.github.com 支持 CORS） */
export async function fetchGithubUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`获取 GitHub 用户信息失败 (${res.status})`);
  }
  return (await res.json()) as GithubUser;
}