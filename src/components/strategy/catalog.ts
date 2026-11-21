/** 攻略列表的搜索、排序、分享码合并等纯函数 */

import type { StrategyMeta } from "@/components/strategy/api";
import { CATEGORY_RULES, OTHER_CATEGORY, categoriesOf } from "@/components/strategy/categories";

export type CatalogView = "all" | "favorites" | "mine";
export type SortKey = "comprehensive" | "latest" | "likes" | "favorites";

export interface StrategyGroup {
  key: string;
  items: StrategyMeta[];
}

/** 归一化分享码：忽略空白与首尾 ## */
export function normalizeShareCode(code?: string): string {
  return (code ?? "").trim().replace(/^#+|#+$/g, "");
}

export function groupByShareCode(items: StrategyMeta[]): StrategyGroup[] {
  const groups = new Map<string, StrategyGroup>();
  for (const item of items) {
    const code = normalizeShareCode(item.shareCode);
    const key = code ? `share:${code}` : `id:${item.id}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, items: [item] });
  }
  return [...groups.values()];
}

/** 搜索标题、描述、作者、上传者与分享码；空白分词为 AND */
export function matchesQuery(item: StrategyMeta, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [
    item.title,
    item.description,
    item.author ?? "",
    item.uploader,
    item.shareCode ?? "",
    normalizeShareCode(item.shareCode),
  ].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function sortStrategies(items: StrategyMeta[], sort: SortKey): StrategyMeta[] {
  const list = [...items];
  switch (sort) {
    case "latest":
      return list.sort((a, b) => (b.updateTime ?? 0) - (a.updateTime ?? 0));
    case "likes":
      return list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || (b.updateTime ?? 0) - (a.updateTime ?? 0));
    case "favorites":
      return list.sort((a, b) => (b.favorites ?? 0) - (a.favorites ?? 0) || (b.updateTime ?? 0) - (a.updateTime ?? 0));
    default: {
      const score = (item: StrategyMeta) => (item.likes ?? 0) * 2 + (item.favorites ?? 0) * 3;
      return list.sort((a, b) => score(b) - score(a) || (b.updateTime ?? 0) - (a.updateTime ?? 0));
    }
  }
}

/** 分类计数：基于当前视图 + 搜索范围（不含分类筛选） */
export function countCategories(items: StrategyMeta[]): Record<string, number> {
  const counts: Record<string, number> = { all: items.length, [OTHER_CATEGORY]: 0 };
  for (const rule of CATEGORY_RULES) counts[rule.id] = 0;
  for (const item of items) {
    for (const id of categoriesOf(item)) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export function categoryOptions() {
  return [
    { id: "all", label: "全部" },
    ...CATEGORY_RULES.map((rule) => ({ id: rule.id, label: rule.label })),
    { id: OTHER_CATEGORY, label: "其他" },
  ];
}

/** 相对时间：刚刚 / N 小时前 / N 天前 / MM-DD */
export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "未更新";
  const diff = Math.max(0, Date.now() - timestamp * 1000);
  const hour = 3600 * 1000;
  const day = 24 * hour;
  if (diff < hour) return "刚刚";
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")}`;
}
