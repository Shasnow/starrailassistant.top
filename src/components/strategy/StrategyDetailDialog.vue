<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { StrategyDetail } from "@/components/strategy/api";
import { categoriesOf, categoryLabel } from "@/components/strategy/categories";
import { formatRelativeTime } from "@/components/strategy/catalog";
import StrategyIcon from "@/components/strategy/StrategyIcon.vue";

const props = defineProps<{
  open: boolean;
  detail: StrategyDetail | null;
  loading: boolean;
  pendingReactions?: Set<string>;
}>();

const emit = defineEmits<{
  close: [];
  like: [detail: StrategyDetail];
  favorite: [detail: StrategyDetail];
  download: [detail: StrategyDetail];
  copy: [code: string];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);

const tags = computed(() => (props.detail ? categoriesOf(props.detail).slice(0, 3) : []));
const likePending = computed(
  () => (props.detail ? props.pendingReactions?.has(`like:${props.detail.id}`) ?? false : false)
);
const favoritePending = computed(
  () => (props.detail ? props.pendingReactions?.has(`favorite:${props.detail.id}`) ?? false : false)
);

watch(
  () => props.open,
  (open) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }
);

function onBackdropClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) emit("close");
}

function roles(field: Record<string, number> | undefined): [string, number][] {
  return Object.entries(field ?? {});
}

/** 兼容旧数据：1-3 为星级，>3 且 <9 视为 2 星，>=9 视为 3 星 */
function starCount(value: number): number {
  if (value >= 9) return 3;
  if (value > 3) return 2;
  return Math.max(1, Math.min(3, value));
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="detail"
    aria-labelledby="strategy-detail-title"
    @close="emit('close')"
    @click="onBackdropClick"
  >
    <template v-if="loading || !detail">
      <div class="detail__head">
        <div><h2 id="strategy-detail-title">正在加载攻略详情…</h2></div>
        <button type="button" class="icon-btn detail__close" aria-label="关闭详情" @click="emit('close')">
          <StrategyIcon name="close" />
        </button>
      </div>
      <div class="detail__body">
        <div class="sk-line sk-line--lg"></div>
        <div class="sk-line sk-line--md"></div>
        <div class="sk-line sk-line--sm"></div>
      </div>
    </template>

    <template v-else>
      <div class="detail__head">
        <div>
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
          <h2 id="strategy-detail-title">{{ detail.title }}</h2>
        </div>
        <button type="button" class="icon-btn detail__close" aria-label="关闭详情" @click="emit('close')">
          <StrategyIcon name="close" />
        </button>
      </div>

      <div class="detail__body">
        <section class="detail__section">
          <h3>攻略简介</h3>
          <p>{{ detail.description }}</p>
        </section>

        <div class="detail__stats">
          <div class="detail__stat"><b>{{ detail.likes ?? 0 }}</b><span>点赞</span></div>
          <div class="detail__stat"><b>{{ detail.favorites ?? 0 }}</b><span>收藏</span></div>
          <div class="detail__stat"><b>{{ detail.min_coins }}</b><span>最低金币</span></div>
          <div class="detail__stat"><b>Lv.{{ detail.mid_level }}</b><span>中期等级</span></div>
        </div>

        <section class="detail__section">
          <h3>游戏内分享码</h3>
          <div class="share-code">
            <code>{{ detail.share_code || "未填写分享码" }}</code>
            <button type="button" class="btn btn--sm" @click="emit('copy', detail.share_code)">
              <StrategyIcon name="copy" />复制
            </button>
          </div>
        </section>

        <section class="detail__section">
          <h3>前台阵容 · 最低 {{ detail.min_level }} 级</h3>
          <div class="role-grid">
            <span v-for="[name, stars] in roles(detail.on_field)" :key="`on-${name}`" class="role">
              {{ name }}<span class="role__stars" :aria-label="`${starCount(stars)} 星`">{{ "★".repeat(starCount(stars)) }}</span>
            </span>
          </div>
        </section>

        <section class="detail__section">
          <h3>后台支援</h3>
          <div class="role-grid">
            <span v-for="[name, stars] in roles(detail.off_field)" :key="`off-${name}`" class="role">
              {{ name }}<span class="role__stars" :aria-label="`${starCount(stars)} 星`">{{ "★".repeat(starCount(stars)) }}</span>
            </span>
          </div>
        </section>

        <section class="detail__section">
          <h3>上传信息</h3>
          <p>
            {{ detail.author || detail.uploader }} · {{ detail.uploader }}
            <template v-if="detail.updateTime"> · 更新于 {{ formatRelativeTime(detail.updateTime) }}</template>
          </p>
        </section>
      </div>

      <div class="detail__foot">
        <span class="btn btn--ghost">{{ detail.isPublic ? "公开攻略" : "仅自己可见" }}</span>
        <button type="button" class="btn" :aria-pressed="Boolean(detail.liked)" :disabled="likePending" @click="emit('like', detail)">
          <StrategyIcon name="heart" />{{ detail.liked ? "已赞" : "点赞" }} {{ detail.likes ?? 0 }}
        </button>
        <button
          type="button"
          class="btn"
          :aria-pressed="Boolean(detail.favorited)"
          :disabled="favoritePending"
          @click="emit('favorite', detail)"
        >
          <StrategyIcon name="bookmark" />{{ detail.favorited ? "已收藏" : "收藏" }} {{ detail.favorites ?? 0 }}
        </button>
        <button type="button" class="btn btn--primary" @click="emit('download', detail)">
          <StrategyIcon name="download" />下载 JSON
        </button>
      </div>
    </template>
  </dialog>
</template>
