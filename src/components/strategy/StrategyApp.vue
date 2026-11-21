<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ApiError,
  createStrategy,
  deleteStrategy,
  favoriteStrategy,
  getFavoriteStrategies,
  getStrategies,
  getStrategiesByUploader,
  getStrategyDetail,
  likeStrategy,
  unfavoriteStrategy,
  unlikeStrategy,
} from "@/components/strategy/api";
import type {
  AccountUser,
  ReactionResult,
  SraStrategy,
  StrategyDetail,
  StrategyMeta,
} from "@/components/strategy/api";
import {
  confirmEmailByLink,
  getCurrentUser,
  handleOAuthCallback,
  isAuthenticated,
  loginWithAccount,
  loginWithGitHub,
  logout,
  registerWithAccount,
  resendConfirmation,
} from "@/components/strategy/auth";
import { draftToStrategy, strategyToDraft } from "@/components/strategy/draft";
import type { StrategyDraft } from "@/components/strategy/draft";
import { fetchOfficialLineup, OfficialApiError, toSraStrategy } from "@/components/strategy/official";
import {
  categoryOptions,
  countCategories,
  groupByShareCode,
  matchesQuery,
  sortStrategies,
} from "@/components/strategy/catalog";
import type { CatalogView, SortKey } from "@/components/strategy/catalog";
import { categoriesOf } from "@/components/strategy/categories";
import { consumePendingReaction, savePendingReaction } from "@/components/strategy/session";
import StrategyForm from "@/components/strategy/StrategyForm.vue";
import StrategySearchBar from "@/components/strategy/StrategySearchBar.vue";
import CategoryChips from "@/components/strategy/CategoryChips.vue";
import StrategyCard from "@/components/strategy/StrategyCard.vue";
import StrategyDetailDialog from "@/components/strategy/StrategyDetailDialog.vue";
import StrategyIcon from "@/components/strategy/StrategyIcon.vue";
import { confirmDialog, setLoading, showToast } from "@/components/strategy/ui";

/** “我的攻略”每页条数 */
const MY_PAGE_SIZE = 10;
/** 全部/收藏视图每次展示的组数，避免一次渲染过多卡片 */
const GROUP_PAGE_SIZE = 12;

const user = ref<AccountUser | null>(getCurrentUser());
const authenticated = ref(isAuthenticated());

const strategies = ref<StrategyMeta[]>([]);
const allLoaded = ref(false);
const allError = ref("");
const myStrategies = ref<StrategyMeta[]>([]);
const mineLoaded = ref(false);
const mineError = ref("");
const myPage = ref(1);
const myTotal = ref(0);
const favoriteStrategies = ref<StrategyMeta[]>([]);
const favoritesLoaded = ref(false);
const favoritesError = ref("");
const refreshing = ref(false);
const reactionPending = ref<Set<string>>(new Set());

const view = ref<CatalogView>("all");
const q = ref("");
const category = ref("all");
const sort = ref<SortKey>("comprehensive");
const visibleGroupCount = ref(GROUP_PAGE_SIZE);
const expandedGroups = ref<Set<string>>(new Set());

const detail = ref<StrategyDetail | null>(null);
const detailOpen = ref(false);
const detailLoading = ref(false);

const uploadFileName = ref("");
const isDragover = ref(false);
const shareLink = ref("");
const converting = ref(false);
const draft = ref<StrategyDraft | null>(null);

const authDialog = ref<HTMLDialogElement | null>(null);
const uploadDialog = ref<HTMLDialogElement | null>(null);
const convertDialog = ref<HTMLDialogElement | null>(null);
const editDialog = ref<HTMLDialogElement | null>(null);
const uploadInput = ref<HTMLInputElement | null>(null);
const userMenu = ref<HTMLDetailsElement | null>(null);

const authMode = ref<"login" | "register">("login");
const authEmail = ref("");
const authPassword = ref("");
const authPassword2 = ref("");
const authError = ref("");
const authSubmitting = ref(false);
const authNeedsConfirm = ref(false);

const needsLogin = computed(() => (view.value === "favorites" || view.value === "mine") && !authenticated.value);
const sourceItems = computed(() => {
  if (view.value === "favorites") return favoriteStrategies.value.filter((item) => item.favorited);
  if (view.value === "mine") return myStrategies.value;
  return strategies.value;
});
const searchedItems = computed(() => sourceItems.value.filter((item) => matchesQuery(item, q.value)));
const categoryCounts = computed(() => countCategories(searchedItems.value));
const chips = computed(() =>
  categoryOptions().map((option) => ({ ...option, count: categoryCounts.value[option.id] ?? 0 }))
);
const filteredItems = computed(() => {
  const byCategory =
    category.value === "all"
      ? searchedItems.value
      : searchedItems.value.filter((item) => categoriesOf(item).includes(category.value));
  return sortStrategies(byCategory, sort.value);
});
const groups = computed(() => groupByShareCode(filteredItems.value));
const shownGroups = computed(() => groups.value.slice(0, visibleGroupCount.value));
const hasMoreGroups = computed(() => groups.value.length > shownGroups.value.length);
const listLoaded = computed(() => {
  if (view.value === "all") return allLoaded.value;
  if (view.value === "favorites") return favoritesLoaded.value;
  return mineLoaded.value;
});
const listError = computed(() => {
  if (view.value === "favorites") return favoritesError.value;
  if (view.value === "mine") return mineError.value;
  return allError.value;
});
const showSkeleton = computed(() => !needsLogin.value && !listLoaded.value && !listError.value);
const totalPages = computed(() => Math.max(1, Math.ceil(myTotal.value / MY_PAGE_SIZE)));
const resultText = computed(() => {
  if (needsLogin.value) return "登录后查看";
  if (listError.value) return "加载失败";
  if (!listLoaded.value) return "正在加载攻略…";
  const label = categoryOptions().find((option) => option.id === category.value)?.label ?? "";
  const suffix = category.value === "all" ? "" : ` · ${label}`;
  return `共 ${groups.value.length} 组 / ${filteredItems.value.length} 份攻略${suffix}`;
});
const heroStats = computed(() => {
  const now = Date.now() / 1000;
  const week = strategies.value.filter((item) => item.updateTime && now - item.updateTime < 7 * 86400).length;
  const today = strategies.value.filter((item) => item.updateTime && now - item.updateTime < 86400).length;
  const categories = new Set<string>();
  for (const item of strategies.value) {
    for (const id of categoriesOf(item)) if (id !== "other") categories.add(id);
  }
  return { total: strategies.value.length, categories: categories.size, today, week };
});

watch([q, category, sort, view], () => {
  visibleGroupCount.value = GROUP_PAGE_SIZE;
});
watch(view, (next) => {
  if (next === "mine" && authenticated.value) void loadMine(1);
  if (next === "favorites" && authenticated.value) void loadFavorites();
});

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof OfficialApiError) return err.message;
  if (err instanceof DOMException && err.name === "AbortError") return "请求超时，请稍后重试";
  if (err instanceof TypeError) return "网络请求失败，请检查网络后重试";
  return fallback;
}

function refreshAuth(): void {
  user.value = getCurrentUser();
  authenticated.value = isAuthenticated();
}

function findAnyById(id: StrategyMeta["id"]): StrategyMeta | StrategyDetail | undefined {
  const match = (item: StrategyMeta | StrategyDetail) => String(item.id) === String(id);
  return (
    strategies.value.find(match) ??
    myStrategies.value.find(match) ??
    favoriteStrategies.value.find(match) ??
    (detail.value && match(detail.value) ? detail.value : undefined)
  );
}

function reactionTargets(id: StrategyMeta["id"]): (StrategyMeta | StrategyDetail)[] {
  const match = (item: StrategyMeta | StrategyDetail) => String(item.id) === String(id);
  const targets: (StrategyMeta | StrategyDetail)[] = [];
  const all = strategies.value.find(match);
  const mine = myStrategies.value.find(match);
  const favorite = favoriteStrategies.value.find(match);
  if (all) targets.push(all);
  if (mine && mine !== all) targets.push(mine);
  if (favorite && favorite !== all && favorite !== mine) targets.push(favorite);
  if (detail.value && match(detail.value)) targets.push(detail.value);
  return targets;
}

function reactionKey(id: StrategyMeta["id"], kind: "like" | "favorite"): string {
  return `${kind}:${id}`;
}

function setReactionPending(id: StrategyMeta["id"], kind: "like" | "favorite", active: boolean): void {
  const next = new Set(reactionPending.value);
  if (active) next.add(reactionKey(id, kind));
  else next.delete(reactionKey(id, kind));
  reactionPending.value = next;
}

function applyReaction(id: StrategyMeta["id"], kind: "like" | "favorite", desired: boolean, delta: number): void {
  for (const target of reactionTargets(id)) {
    if (kind === "like") {
      target.liked = desired;
      target.likes = Math.max(0, (target.likes ?? 0) + delta);
    } else {
      target.favorited = desired;
      target.favorites = Math.max(0, (target.favorites ?? 0) + delta);
    }
  }
}

function applyReactionResult(id: StrategyMeta["id"], kind: "like" | "favorite", result: ReactionResult, desired: boolean): void {
  for (const target of reactionTargets(id)) {
    if (kind === "like") {
      target.liked = result.liked ?? desired;
      if (typeof result.likes === "number") target.likes = result.likes;
    } else {
      target.favorited = result.favorited ?? desired;
      if (typeof result.favorites === "number") target.favorites = result.favorites;
    }
  }
}

async function setReaction(item: StrategyMeta | StrategyDetail, kind: "like" | "favorite", desired: boolean): Promise<void> {
  const current = kind === "like" ? Boolean(item.liked) : Boolean(item.favorited);
  if (current === desired) return;

  const key = reactionKey(item.id, kind);
  if (reactionPending.value.has(key)) return;

  setReactionPending(item.id, kind, true);
  applyReaction(item.id, kind, desired, desired ? 1 : -1);
  try {
    const result =
      kind === "like"
        ? desired
          ? await likeStrategy(item.id)
          : await unlikeStrategy(item.id)
        : desired
          ? await favoriteStrategy(item.id)
          : await unfavoriteStrategy(item.id);
    applyReactionResult(item.id, kind, result, desired);
  } catch (err) {
    applyReaction(item.id, kind, !desired, desired ? -1 : 1);
    if (err instanceof ApiError && err.status === 401) {
      refreshAuth();
      showToast("登录已过期，请重新登录", "error");
    } else {
      showToast(errorMessage(err, kind === "like" ? "点赞失败" : "收藏失败"), "error");
    }
  } finally {
    setReactionPending(item.id, kind, false);
  }
}

function toggleReaction(item: StrategyMeta | StrategyDetail, kind: "like" | "favorite"): void {
  if (!authenticated.value) {
    savePendingReaction({
      kind,
      id: item.id,
      desired: !(kind === "like" ? Boolean(item.liked) : Boolean(item.favorited)),
    });
    openAuthDialog("login");
    showToast("登录后可点赞和收藏", "info");
    return;
  }
  const desired = !(kind === "like" ? Boolean(item.liked) : Boolean(item.favorited));
  void setReaction(item, kind, desired);
}

async function replayPendingReaction(): Promise<void> {
  const pending = consumePendingReaction();
  if (!pending || !authenticated.value) return;
  const item = findAnyById(pending.id);
  if (item) await setReaction(item, pending.kind, pending.desired);
}

async function loadAll(): Promise<void> {
  allError.value = "";
  try {
    const data = await getStrategies();
    strategies.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch strategies:", err);
    strategies.value = [];
    allError.value = errorMessage(err, "加载攻略列表失败");
    showToast(allError.value, "error");
  } finally {
    allLoaded.value = true;
  }
}

async function loadMine(page = 1): Promise<void> {
  const uploader = user.value?.email ?? "";
  if (!uploader) return;

  mineError.value = "";
  setLoading(true, "正在加载我的攻略...");
  try {
    const data = await getStrategiesByUploader({ uploader, page, pageSize: MY_PAGE_SIZE });
    myStrategies.value = Array.isArray(data?.records) ? data.records : [];
    myPage.value = page;
    myTotal.value = Number(data?.total) || myStrategies.value.length;
  } catch (err) {
    console.error("Failed to fetch my strategies:", err);
    myStrategies.value = [];
    myPage.value = 1;
    myTotal.value = 0;
    mineError.value = errorMessage(err, "加载我的攻略失败");
    showToast(mineError.value, "error");
  } finally {
    mineLoaded.value = true;
    setLoading(false);
  }
}

async function loadFavorites(): Promise<void> {
  if (!authenticated.value) return;

  favoritesError.value = "";
  setLoading(true, "正在加载我的收藏...");
  try {
    // 收藏接口支持分页；收藏量通常不大，这里拉全量以便本地搜索与分类
    const pageSize = 100;
    const first = await getFavoriteStrategies({ page: 1, pageSize });
    const records = Array.isArray(first.records) ? [...first.records] : [];
    const total = Number(first.total) || records.length;
    while (records.length < total) {
      const next = await getFavoriteStrategies({
        page: Math.floor(records.length / pageSize) + 1,
        pageSize,
      });
      const nextRecords = Array.isArray(next.records) ? next.records : [];
      if (!nextRecords.length) break;
      records.push(...nextRecords);
    }
    favoriteStrategies.value = records;
  } catch (err) {
    console.error("Failed to fetch favorite strategies:", err);
    favoriteStrategies.value = [];
    favoritesError.value = errorMessage(err, "加载我的收藏失败");
    showToast(favoritesError.value, "error");
  } finally {
    favoritesLoaded.value = true;
    setLoading(false);
  }
}

async function refreshList(): Promise<void> {
  if (refreshing.value) return;
  refreshing.value = true;
  refreshAuth();
  try {
    if (view.value === "mine" && user.value?.email) await loadMine(myPage.value);
    else if (view.value === "favorites" && authenticated.value) await loadFavorites();
    else await loadAll();
  } finally {
    refreshing.value = false;
  }
}

async function afterLogin(): Promise<void> {
  refreshAuth();
  // 换账号后清空上一个账号的私有列表，避免短暂串号
  favoriteStrategies.value = [];
  favoritesLoaded.value = false;
  myStrategies.value = [];
  mineLoaded.value = false;
  await loadAll();
  if (view.value === "mine") await loadMine(1);
  if (view.value === "favorites") await loadFavorites();
  await replayPendingReaction();
}

function setView(next: CatalogView): void {
  view.value = next;
}

function toggleGroup(key: string): void {
  const next = new Set(expandedGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedGroups.value = next;
}

function loadMore(): void {
  visibleGroupCount.value += GROUP_PAGE_SIZE;
}

function downloadJsonFile(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSraPayload(source: StrategyDetail): SraStrategy {
  return {
    title: source.title,
    description: source.description,
    author: source.author,
    uploader: source.uploader,
    share_code: source.share_code,
    min_coins: source.min_coins,
    min_level: source.min_level,
    mid_level: source.mid_level,
    on_field: source.on_field,
    off_field: source.off_field,
  };
}

async function download(item: StrategyMeta | StrategyDetail): Promise<void> {
  showToast("正在准备下载...", "info");
  try {
    const source = "on_field" in item ? item : await getStrategyDetail(item.id);
    const payload = buildSraPayload(source);
    downloadJsonFile(payload, `SRAstrategy_${payload.title}.json`);
    showToast("攻略下载成功！", "success");
  } catch (err) {
    console.error("Failed to download strategy:", err);
    showToast(errorMessage(err, "攻略下载失败！"), "error");
  }
}

async function removeStrategy(item: StrategyMeta): Promise<void> {
  const confirmed = await confirmDialog(`确定要删除攻略「${item.title}」吗？删除后不可恢复。`, {
    title: "删除攻略",
    confirmText: "删除",
  });
  if (!confirmed) return;

  setLoading(true, "正在删除...");
  try {
    await deleteStrategy(item.id);
    showToast("攻略已删除", "success");
    const targetPage = myStrategies.value.length === 1 && myPage.value > 1 ? myPage.value - 1 : myPage.value;
    await loadMine(targetPage);
    void loadAll();
  } catch (err) {
    console.error("Failed to delete strategy:", err);
    showToast(errorMessage(err, "删除攻略失败"), "error");
  } finally {
    setLoading(false);
  }
}

async function openDetail(item: StrategyMeta): Promise<void> {
  detailLoading.value = true;
  detailOpen.value = true;
  detail.value = null;
  try {
    detail.value = await getStrategyDetail(item.id);
  } catch (err) {
    console.error("Failed to fetch strategy detail:", err);
    detailOpen.value = false;
    showToast(errorMessage(err, "加载攻略详情失败"), "error");
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail(): void {
  detailOpen.value = false;
}

async function copyShareCode(code: string): Promise<void> {
  if (!code) {
    showToast("这份攻略没有分享码", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    showToast("分享码已复制", "success");
  } catch {
    showToast("复制失败，请手动选择分享码", "error");
  }
}

function closeUploadDialog(): void {
  uploadDialog.value?.close();
  uploadFileName.value = "";
  if (uploadInput.value) uploadInput.value.value = "";
}

async function handleUploadFile(file: File): Promise<void> {
  if (!authenticated.value) {
    showToast("请先登录后再上传", "error");
    closeUploadDialog();
    return;
  }
  const isJson = file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
  if (!isJson) {
    showToast("请上传 JSON 文件", "error");
    return;
  }

  uploadFileName.value = `已选择：${file.name}`;
  setLoading(true, "正在上传...");
  try {
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
    delete parsed.uploader;
    await createStrategy(parsed);
    showToast("上传成功", "success");
    closeUploadDialog();
    await loadAll();
    if (view.value === "mine") await loadMine(1);
  } catch (err) {
    console.error("Failed to upload strategy:", err);
    showToast(err instanceof SyntaxError ? "JSON 格式不正确" : errorMessage(err, "上传失败"), "error");
  } finally {
    setLoading(false);
  }
}

function onFileChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void handleUploadFile(file);
}

function onDrop(event: DragEvent): void {
  isDragover.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void handleUploadFile(file);
}

async function requestUpload(): Promise<void> {
  if (!authenticated.value) {
    const confirmed = await confirmDialog("上传攻略需要登录账号，是否前往登录？", {
      title: "需要登录",
      confirmText: "去登录",
    });
    if (!confirmed) return;
    openAuthDialog("login");
    return;
  }
  if (uploadDialog.value && !uploadDialog.value.open) uploadDialog.value.showModal();
}

function openConvertDialog(): void {
  shareLink.value = "";
  if (convertDialog.value && !convertDialog.value.open) convertDialog.value.showModal();
}

function closeConvertDialog(): void {
  if (converting.value) return;
  convertDialog.value?.close();
  shareLink.value = "";
}

async function convertOfficialStrategy(): Promise<void> {
  if (converting.value) return;
  converting.value = true;
  setLoading(true, "正在获取官方攻略...");
  try {
    const lineup = await fetchOfficialLineup(shareLink.value);
    const uploader = user.value?.email ?? "";
    const strategy = toSraStrategy(lineup, uploader);
    convertDialog.value?.close();
    shareLink.value = "";
    openEditDialog(strategy);
    showToast("转换成功，请确认攻略内容", "success");
  } catch (err) {
    console.error("Failed to convert official strategy:", err);
    showToast(errorMessage(err, "攻略转换失败"), "error");
  } finally {
    converting.value = false;
    setLoading(false);
  }
}

function openEditDialog(strategy: SraStrategy): void {
  draft.value = strategyToDraft(strategy);
  if (editDialog.value && !editDialog.value.open) editDialog.value.showModal();
}

function closeEditDialog(): void {
  editDialog.value?.close();
  draft.value = null;
}

function buildStrategy(): SraStrategy | null {
  if (!draft.value) return null;
  try {
    return draftToStrategy(draft.value);
  } catch (err) {
    console.error("Invalid strategy draft:", err);
    showToast(errorMessage(err, "攻略数据格式不正确"), "error");
    return null;
  }
}

function confirmDownload(): void {
  const strategy = buildStrategy();
  if (!strategy) return;
  downloadJsonFile(strategy, `SRAstrategy_${strategy.title}.json`);
  showToast("攻略文件已下载", "success");
  closeEditDialog();
}

async function confirmUpload(): Promise<void> {
  if (!authenticated.value) {
    const confirmed = await confirmDialog("上传攻略需要登录账号，是否前往登录？", {
      title: "需要登录",
      confirmText: "去登录",
    });
    if (!confirmed) return;
    openAuthDialog("login");
    return;
  }

  const strategy = buildStrategy();
  if (!strategy) return;

  setLoading(true, "正在上传...");
  try {
    await createStrategy(strategy as unknown as Record<string, unknown>);
    showToast("上传成功，审核通过后会出现在全部攻略中", "success");
    closeEditDialog();
    await loadAll();
    if (view.value === "mine") await loadMine(1);
  } catch (err) {
    console.error("Failed to upload edited strategy:", err);
    showToast(errorMessage(err, "上传失败"), "error");
  } finally {
    setLoading(false);
  }
}

function openAuthDialog(mode: "login" | "register" = "login"): void {
  authMode.value = mode;
  authError.value = "";
  authNeedsConfirm.value = false;
  if (authDialog.value && !authDialog.value.open) authDialog.value.showModal();
}

function closeAuthDialog(): void {
  if (authSubmitting.value) return;
  authDialog.value?.close();
  authEmail.value = "";
  authPassword.value = "";
  authPassword2.value = "";
  authError.value = "";
  authNeedsConfirm.value = false;
}

/** 用户取消登录时丢弃待重放的点赞/收藏动作；登录成功则保留由 afterLogin 处理 */
function onAuthDialogClose(): void {
  if (!authenticated.value) consumePendingReaction();
  authError.value = "";
  authNeedsConfirm.value = false;
}

function switchAuthMode(mode: "login" | "register"): void {
  authMode.value = mode;
  authError.value = "";
  authNeedsConfirm.value = false;
}

async function submitAuth(): Promise<void> {
  if (authSubmitting.value) return;
  const email = authEmail.value.trim();
  if (!email || !authPassword.value) {
    authError.value = "请填写邮箱和密码";
    return;
  }
  if (authMode.value === "register") {
    if (authPassword.value.length < 8) {
      authError.value = "密码至少需要 8 位，且包含字母和数字";
      return;
    }
    if (authPassword.value !== authPassword2.value) {
      authError.value = "两次输入的密码不一致";
      return;
    }
  }

  authSubmitting.value = true;
  authError.value = "";
  try {
    if (authMode.value === "login") {
      await loginWithAccount(email, authPassword.value);
      await afterLogin();
      authDialog.value?.close();
      authEmail.value = "";
      authPassword.value = "";
      showToast("登录成功", "success");
    } else {
      await registerWithAccount(email, authPassword.value);
      authNeedsConfirm.value = true;
      authPassword.value = "";
      authPassword2.value = "";
      showToast("注册成功，请查收确认邮件", "success");
    }
  } catch (err) {
    console.error("Auth failed:", err);
    if (err instanceof ApiError && err.status === 401) {
      authError.value = "邮箱或密码错误；若刚刚注册，请先点击邮件中的确认链接";
    } else {
      authError.value = errorMessage(err, "操作失败，请稍后重试");
    }
  } finally {
    authSubmitting.value = false;
  }
}

async function resendConfirmEmail(): Promise<void> {
  const email = authEmail.value.trim();
  if (!email) {
    authError.value = "请先填写邮箱";
    return;
  }
  try {
    await resendConfirmation(email);
    showToast("确认邮件已重新发送", "success");
  } catch (err) {
    console.error("Failed to resend confirmation email:", err);
    authError.value = errorMessage(err, "发送确认邮件失败");
  }
}

function onGithubLogin(): void {
  const message = loginWithGitHub();
  if (message) showToast(message, "error");
}

function onLogout(): void {
  logout();
  refreshAuth();
  view.value = "all";
  favoriteStrategies.value = [];
  favoritesLoaded.value = false;
  favoritesError.value = "";
  myStrategies.value = [];
  mineLoaded.value = false;
  mineError.value = "";
  userMenu.value?.removeAttribute("open");
  showToast("已退出登录", "success");
}

function openMine(): void {
  setView("mine");
}

function resetFilters(): void {
  q.value = "";
  category.value = "all";
  sort.value = "comprehensive";
}

function takeConfirmParams(): { userId: string; code: string } | null {
  const query = new URLSearchParams(window.location.search);
  const userId = query.get("confirmUserId");
  const code = query.get("confirmCode");
  if (!userId || !code) return null;

  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState(window.history.state, "", url.toString());
  return { userId, code };
}

onMounted(async () => {
  document.getElementById("strategy-boot")?.remove();
  const confirmParams = takeConfirmParams();
  if (confirmParams) {
    setLoading(true, "正在确认邮箱...");
    try {
      await confirmEmailByLink(confirmParams.userId, confirmParams.code);
      showToast("邮箱确认成功，请登录", "success");
      openAuthDialog("login");
    } catch (err) {
      console.error("Failed to confirm email:", err);
      showToast(errorMessage(err, "邮箱确认失败，请尝试重新发送确认邮件"), "error");
    } finally {
      setLoading(false);
    }
  }

  const query = new URLSearchParams(window.location.search);
  const hasOAuthParams = query.has("code") || query.has("error");
  if (hasOAuthParams) setLoading(true, "正在完成登录...");
  const callback = await handleOAuthCallback();
  if (hasOAuthParams) setLoading(false);

  if (callback?.ok) {
    await afterLogin();
    showToast("登录成功", "success");
  } else {
    if (callback?.message) showToast(callback.message, "error");
    await loadAll();
    await replayPendingReaction();
  }
});
</script>

<template>
  <div class="strategy-app">
    <div class="strategy-toolbar">
      <span class="strategy-toolbar__hint">社区攻略库</span>
      <div class="strategy-toolbar__spacer"></div>
      <button v-if="!authenticated" type="button" class="btn btn--primary" @click="openAuthDialog('login')">
        登录 / 注册
      </button>
      <details v-else ref="userMenu" class="user-menu">
        <summary>
          <span class="user-menu__avatar">{{ user?.email?.slice(0, 1).toUpperCase() }}</span>
          <span class="user-menu__name">{{ user?.email }}</span>
        </summary>
        <div class="user-menu__list">
          <button type="button" class="user-menu__item" @click="openMine">我的攻略</button>
          <button type="button" class="user-menu__item" @click="onLogout">退出登录</button>
        </div>
      </details>
    </div>

    <section class="hero" aria-labelledby="strategy-hero-title">
      <div>
        <span class="hero__eyebrow"><i aria-hidden="true"></i>SRA · 货币战争攻略库</span>
        <h2 id="strategy-hero-title" class="hero__title">找到适合你的阵容与节奏</h2>
        <p class="hero__lead">
          按流派、关键词与热度快速筛选社区攻略，查看阵容星级与分享码，一键下载为 SRA 可用的 JSON。
        </p>
        <div class="hero__actions">
          <button type="button" class="btn btn--primary" @click="requestUpload">
            <StrategyIcon name="upload" />上传攻略
          </button>
          <button type="button" class="btn" @click="openConvertDialog">
            <StrategyIcon name="share" />一键转换官方攻略
          </button>
        </div>
      </div>
      <aside class="hero__side" aria-label="攻略库统计">
        <div class="hero__stat-card">
          <b>本周新增</b>
          <strong>{{ heroStats.week }} <span>份攻略</span></strong>
          <div class="hero__stat-row">
            <div class="hero__stat"><b>{{ heroStats.total }}</b><span>总攻略</span></div>
            <div class="hero__stat"><b>{{ heroStats.categories }}</b><span>流派</span></div>
            <div class="hero__stat"><b>{{ heroStats.today }}</b><span>今日更新</span></div>
          </div>
        </div>
      </aside>
    </section>

    <section class="catalog" aria-labelledby="strategy-list-title">
      <h2 id="strategy-list-title" class="sr-only">攻略列表</h2>
      <div class="catalog__bar">
        <StrategySearchBar
          :q="q"
          :sort="sort"
          :view="view"
          :refreshing="refreshing"
          @update:q="q = $event"
          @update:sort="sort = $event"
          @update:view="setView"
          @refresh="refreshList"
        />
        <CategoryChips :options="chips" :model-value="category" @update:model-value="category = $event" />
        <div class="result-bar">
          <span aria-live="polite">{{ resultText }}</span>
          <span>同一分享码的攻略会自动合并</span>
        </div>
      </div>

      <div v-if="needsLogin" class="state">
        <div class="state__icon"><StrategyIcon name="bookmark" /></div>
        <h3>登录后查看{{ view === "favorites" ? "我的收藏" : "我的攻略" }}</h3>
        <p>登录后可以同步收藏、查看自己上传的攻略与审核状态。</p>
        <button type="button" class="btn btn--primary" @click="openAuthDialog('login')">登录 / 注册</button>
      </div>

      <div v-else-if="showSkeleton" class="skeleton-grid" aria-hidden="true">
        <div v-for="index in 6" :key="index" class="sk-card">
          <div class="sk-line sk-line--xs"></div>
          <div class="sk-line sk-line--lg"></div>
          <div class="sk-line sk-line--md"></div>
          <div class="sk-line sk-line--sm"></div>
          <div class="sk-line sk-line--md sk-line--footer"></div>
        </div>
      </div>

      <div v-else-if="listError" class="state">
        <div class="state__icon"><StrategyIcon name="alert" /></div>
        <h3>攻略列表加载失败</h3>
        <p>{{ listError }}</p>
        <button type="button" class="btn btn--primary" @click="refreshList">
          <StrategyIcon name="download" />重新加载
        </button>
      </div>

      <div v-else-if="filteredItems.length === 0" class="state">
        <div class="state__icon"><StrategyIcon name="empty" /></div>
        <template v-if="view === 'favorites'">
          <h3>还没有收藏攻略</h3>
          <p>在攻略卡片上点击收藏按钮，之后就能在这里快速找到。</p>
          <button type="button" class="btn" @click="setView('all')">去全部攻略看看</button>
        </template>
        <template v-else-if="view === 'mine'">
          <h3>你还没有上传过攻略</h3>
          <p>上传 JSON 攻略文件，审核通过后会出现在全部攻略中。</p>
          <button type="button" class="btn btn--primary" @click="requestUpload">
            <StrategyIcon name="upload" />上传攻略
          </button>
        </template>
        <template v-else>
          <h3>没有找到匹配的攻略</h3>
          <p>试试更换关键词、切换到其他流派，或清除当前筛选条件。</p>
          <button type="button" class="btn" @click="resetFilters">清除筛选</button>
        </template>
      </div>

      <template v-else>
        <div class="grid">
          <StrategyCard
            v-for="group in shownGroups"
            :key="group.key"
            :group="group"
            :view="view"
            :expanded="expandedGroups.has(group.key)"
            :pending-reactions="reactionPending"
            @detail="openDetail"
            @download="download"
            @like="toggleReaction($event, 'like')"
            @favorite="toggleReaction($event, 'favorite')"
            @remove="removeStrategy"
            @toggle-group="toggleGroup"
          />
        </div>
        <div v-if="hasMoreGroups" class="load-more">
          <button type="button" class="btn" @click="loadMore">
            加载更多（剩余 {{ groups.length - shownGroups.length }} 组）
          </button>
        </div>
      </template>

      <div v-if="view === 'mine' && myTotal > MY_PAGE_SIZE" class="strategy-pagination">
        <span class="strategy-pagination__info">
          第 {{ myPage }} / {{ totalPages }} 页 · 共 {{ myTotal }} 条
        </span>
        <button type="button" class="btn" :disabled="myPage <= 1" @click="loadMine(myPage - 1)">上一页</button>
        <button type="button" class="btn" :disabled="myPage >= totalPages" @click="loadMine(myPage + 1)">下一页</button>
      </div>
    </section>

    <StrategyDetailDialog
      :open="detailOpen"
      :detail="detail"
      :loading="detailLoading"
      :pending-reactions="reactionPending"
      @close="closeDetail"
      @like="toggleReaction($event, 'like')"
      @favorite="toggleReaction($event, 'favorite')"
      @download="download"
      @copy="copyShareCode"
    />

    <dialog
      ref="authDialog"
      class="strategy-dialog strategy-dialog--auth"
      aria-labelledby="auth-title"
      @close="onAuthDialogClose"
    >
      <h2 id="auth-title" class="strategy-dialog__title">{{ authMode === "login" ? "登录" : "注册账号" }}</h2>
      <div class="auth-tabs" role="group" aria-label="登录或注册">
        <button
          type="button"
          class="auth-tab"
          :class="{ 'is-active': authMode === 'login' }"
          :aria-pressed="authMode === 'login'"
          @click="switchAuthMode('login')"
        >
          登录
        </button>
        <button
          type="button"
          class="auth-tab"
          :class="{ 'is-active': authMode === 'register' }"
          :aria-pressed="authMode === 'register'"
          @click="switchAuthMode('register')"
        >
          注册
        </button>
      </div>

      <form class="strategy-form" @submit.prevent="submitAuth">
        <label class="form-row">
          <span class="form-label">邮箱</span>
          <input
            v-model="authEmail"
            class="strategy-input"
            type="email"
            autocomplete="email"
            placeholder="用于接收确认邮件"
            :aria-describedby="authError ? 'auth-error' : undefined"
            required
          />
        </label>
        <label class="form-row">
          <span class="form-label">密码</span>
          <input
            v-model="authPassword"
            class="strategy-input"
            type="password"
            :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
            placeholder="至少 8 位，含字母和数字"
            :aria-describedby="authError ? 'auth-error' : undefined"
            required
          />
        </label>
        <label v-if="authMode === 'register'" class="form-row">
          <span class="form-label">确认密码</span>
          <input
            v-model="authPassword2"
            class="strategy-input"
            type="password"
            autocomplete="new-password"
            :aria-describedby="authError ? 'auth-error' : undefined"
            required
          />
        </label>

        <p v-if="authNeedsConfirm" class="auth-hint">
          注册成功，请前往邮箱点击确认链接后再登录。
          <button type="button" class="auth-link" @click="resendConfirmEmail">重新发送确认邮件</button>
        </p>
        <p v-else-if="authMode === 'register'" class="auth-hint">
          注册后需点击邮件中的确认链接才能登录，确认链接会跳回本页面。
        </p>
        <p v-else class="auth-hint">
          未收到确认邮件？<button type="button" class="auth-link" @click="resendConfirmEmail">重新发送</button>
        </p>
        <p v-if="authError" id="auth-error" class="auth-error" role="alert">{{ authError }}</p>

        <div class="strategy-dialog__footer">
          <button type="button" class="btn auth-spacer" :disabled="authSubmitting" @click="onGithubLogin">
            GitHub 登录
          </button>
          <button type="button" class="btn" :disabled="authSubmitting" @click="closeAuthDialog">取消</button>
          <button type="submit" class="btn btn--primary" :disabled="authSubmitting">
            {{ authSubmitting ? "处理中..." : authMode === "login" ? "登录" : "注册" }}
          </button>
        </div>
      </form>
    </dialog>

    <dialog ref="uploadDialog" class="strategy-dialog" aria-labelledby="upload-title">
      <h2 id="upload-title" class="strategy-dialog__title">上传攻略</h2>
      <label
        class="upload-dropzone"
        :class="{ 'is-dragover': isDragover }"
        for="strategy-upload-input"
        @dragover.prevent="isDragover = true"
        @dragleave="isDragover = false"
        @drop.prevent="onDrop"
      >
        <span>拖拽 JSON 文件到此处，或<em>点击选择文件</em></span>
      </label>
      <input
        id="strategy-upload-input"
        ref="uploadInput"
        type="file"
        accept="application/json,.json"
        hidden
        @change="onFileChange"
      />
      <p class="upload-hint">{{ uploadFileName }}</p>
      <div class="strategy-dialog__footer">
        <button type="button" class="btn" @click="closeUploadDialog">取消</button>
      </div>
    </dialog>

    <dialog ref="convertDialog" class="strategy-dialog" aria-labelledby="convert-title">
      <h2 id="convert-title" class="strategy-dialog__title">一键转换官方攻略</h2>
      <p class="strategy-dialog__message">
        粘贴米游社货币战争攻略的分享链接，将自动转换为 SRA 攻略格式，随后可预览并修改字段。链接形如：<br />
        <code>https://act.miyoushe.com/sr/event/currency-wars/index.html?gt__lineup_id=...</code>
      </p>
      <input
        v-model="shareLink"
        class="strategy-input"
        type="url"
        autocomplete="off"
        placeholder="粘贴攻略分享链接"
        @keydown.enter.prevent="convertOfficialStrategy"
      />
      <div class="strategy-dialog__footer">
        <button type="button" class="btn" :disabled="converting" @click="closeConvertDialog">取消</button>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!shareLink.trim() || converting"
          @click="convertOfficialStrategy"
        >
          转换并预览
        </button>
      </div>
    </dialog>

    <dialog ref="editDialog" class="strategy-dialog" aria-labelledby="edit-title">
      <h2 id="edit-title" class="strategy-dialog__title">预览并编辑攻略</h2>
      <p class="strategy-dialog__message">
        确认以下字段后可下载 JSON 或直接上传到攻略站。角色列表每行一个，格式为「角色名 星级（1-3）」。
      </p>
      <StrategyForm v-if="draft" v-model="draft" />
      <div class="strategy-dialog__footer">
        <button type="button" class="btn" @click="closeEditDialog">取消</button>
        <button type="button" class="btn" @click="confirmDownload">下载</button>
        <button type="button" class="btn btn--primary" @click="confirmUpload">上传</button>
      </div>
    </dialog>
  </div>
</template>
