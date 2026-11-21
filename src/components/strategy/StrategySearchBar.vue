<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { CatalogView, SortKey } from "@/components/strategy/catalog";

const props = defineProps<{
  q: string;
  sort: SortKey;
  view: CatalogView;
  refreshing?: boolean;
}>();

const emit = defineEmits<{
  "update:q": [value: string];
  "update:sort": [value: SortKey];
  "update:view": [value: CatalogView];
  refresh: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (target as HTMLElement | null)?.isContentEditable === true;
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === "/" && !isTypingTarget(event.target)) {
    event.preventDefault();
    inputRef.value?.focus();
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <div class="search-row">
    <label class="search-field">
      <span class="sr-only">搜索攻略</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref="inputRef"
        type="search"
        :value="q"
        placeholder="搜索标题、作者、上传者或分享码…"
        autocomplete="off"
        aria-keyshortcuts="/"
        @input="emit('update:q', ($event.target as HTMLInputElement).value)"
        @keydown.esc="emit('update:q', '')"
      />
      <kbd aria-hidden="true">/</kbd>
    </label>

    <div class="view-tabs" role="group" aria-label="攻略视图">
      <button type="button" class="view-tab" :aria-pressed="view === 'all'" @click="emit('update:view', 'all')">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
        全部攻略
      </button>
      <button type="button" class="view-tab" :aria-pressed="view === 'favorites'" @click="emit('update:view', 'favorites')">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M6 4h12v17l-6-4-6 4V4Z" />
        </svg>
        我的收藏
      </button>
      <button type="button" class="view-tab" :aria-pressed="view === 'mine'" @click="emit('update:view', 'mine')">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        我的攻略
      </button>
    </div>

    <div class="select-wrap">
      <label class="sr-only" for="strategy-sort">排序方式</label>
      <select id="strategy-sort" class="sort-select" :value="sort" @change="emit('update:sort', ($event.target as HTMLSelectElement).value as SortKey)">
        <option value="comprehensive">综合推荐</option>
        <option value="latest">最新更新</option>
        <option value="likes">最多点赞</option>
        <option value="favorites">最多收藏</option>
      </select>
    </div>

    <button type="button" class="icon-btn" :disabled="refreshing" aria-label="刷新列表" title="刷新列表" @click="emit('refresh')">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" />
      </svg>
    </button>
  </div>
</template>
