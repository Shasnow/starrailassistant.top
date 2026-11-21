<script setup lang="ts">
import { computed } from "vue";
import type { StrategyMeta } from "@/components/strategy/api";
import { categoriesOf, categoryLabel } from "@/components/strategy/categories";
import type { CatalogView, StrategyGroup } from "@/components/strategy/catalog";
import { formatRelativeTime } from "@/components/strategy/catalog";
import StrategyIcon from "@/components/strategy/StrategyIcon.vue";

const props = defineProps<{
  group: StrategyGroup;
  view: CatalogView;
  expanded: boolean;
  pendingReactions?: Set<string>;
}>();

const emit = defineEmits<{
  detail: [item: StrategyMeta];
  download: [item: StrategyMeta];
  like: [item: StrategyMeta];
  favorite: [item: StrategyMeta];
  remove: [item: StrategyMeta];
  "toggle-group": [key: string];
}>();

const representative = computed(() => props.group.items[0]);
const tags = computed(() => categoriesOf(representative.value).slice(0, 3));
const isGrouped = computed(() => props.group.items.length > 1);
const isMine = computed(() => props.view === "mine");
const likePending = computed(() => props.pendingReactions?.has(`like:${representative.value.id}`) ?? false);
const favoritePending = computed(() => props.pendingReactions?.has(`favorite:${representative.value.id}`) ?? false);
</script>

<template>
  <article class="card" :class="{ 'card--grouped': isGrouped }">
    <div class="card__top">
      <div class="tags">
        <span
          v-for="(tag, index) in tags"
          :key="tag"
          class="tag"
          :class="tag === 'star3' ? 'tag--gold' : index === 0 ? 'tag--accent' : ''"
        >
          {{ categoryLabel(tag) }}
        </span>
      </div>
      <span v-if="isGrouped" class="group-badge">
        <StrategyIcon name="share" />同分享码 {{ group.items.length }}
      </span>
    </div>

    <h3 class="card__title">
      <button type="button" @click="emit('detail', representative)">{{ representative.title }}</button>
    </h3>
    <p class="card__desc">{{ representative.description }}</p>

    <div class="card__meta">
      <span><StrategyIcon name="user" /><b>{{ representative.author || representative.uploader }}</b></span>
      <span><StrategyIcon name="clock" />{{ formatRelativeTime(representative.updateTime) }}</span>
      <span v-if="isMine" class="tag tag--accent">我的上传</span>
      <span v-else-if="!representative.shareCode">无分享码</span>
    </div>

    <div class="card__footer">
      <button
        type="button"
        class="stat-btn"
        :aria-pressed="Boolean(representative.liked)"
        :disabled="likePending"
        :aria-label="`${representative.liked ? '取消点赞' : '点赞'}，当前 ${representative.likes ?? 0}`"
        @click="emit('like', representative)"
      >
        <StrategyIcon name="heart" /><span>{{ representative.likes ?? 0 }}</span>
      </button>
      <button
        type="button"
        class="stat-btn stat-btn--fav"
        :aria-pressed="Boolean(representative.favorited)"
        :disabled="favoritePending"
        :aria-label="`${representative.favorited ? '取消收藏' : '收藏'}，当前 ${representative.favorites ?? 0}`"
        @click="emit('favorite', representative)"
      >
        <StrategyIcon name="bookmark" /><span>{{ representative.favorites ?? 0 }}</span>
      </button>
      <div class="card__actions">
        <button type="button" class="card__action" aria-label="查看详情" title="查看详情" @click="emit('detail', representative)">
          <StrategyIcon name="info" />
        </button>
        <button type="button" class="card__action" aria-label="下载 JSON" title="下载 JSON" @click="emit('download', representative)">
          <StrategyIcon name="download" />
        </button>
        <button
          v-if="isMine"
          type="button"
          class="card__action card__action--danger"
          aria-label="删除攻略"
          title="删除攻略"
          @click="emit('remove', representative)"
        >
          <StrategyIcon name="trash" />
        </button>
      </div>
    </div>

    <template v-if="isGrouped">
      <button
        type="button"
        class="group-toggle"
        :aria-expanded="expanded"
        @click="emit('toggle-group', group.key)"
      >
        <span>同分享码 {{ group.items.length }} 份 · {{ expanded ? "收起" : "展开查看" }}</span>
        <StrategyIcon name="chevron" />
      </button>
      <div v-if="expanded" class="group-list">
        <div v-for="child in group.items.slice(1)" :key="child.id" class="group-item">
          <div class="group-item__meta">
            <b>{{ child.title }}</b>
            <span>{{ child.author || child.uploader }} · {{ formatRelativeTime(child.updateTime) }} · 赞 {{ child.likes ?? 0 }}</span>
          </div>
          <div class="group-item__actions">
            <button type="button" class="card__action" aria-label="查看详情" title="查看详情" @click="emit('detail', child)">
              <StrategyIcon name="info" />
            </button>
            <button type="button" class="card__action" aria-label="下载 JSON" title="下载 JSON" @click="emit('download', child)">
              <StrategyIcon name="download" />
            </button>
            <button
              v-if="isMine"
              type="button"
              class="card__action card__action--danger"
              aria-label="删除攻略"
              title="删除攻略"
              @click="emit('remove', child)"
            >
              <StrategyIcon name="trash" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </article>
</template>
