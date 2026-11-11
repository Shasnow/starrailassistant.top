<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ApiError,
  createStrategy,
  getStrategies,
  getStrategiesByUploader,
  getStrategyDetail,
} from "@/components/strategy/api";
import type {
  AccountUser,
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
import StrategyForm from "@/components/strategy/StrategyForm.vue";
import { confirmDialog, formatTime, setLoading, showToast } from "@/components/strategy/ui";

/** “我的攻略”每页条数 */
const MY_PAGE_SIZE = 10;

const ICON_INFO =
  "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z";
const ICON_DOWNLOAD =
  "M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z";

const user = ref<AccountUser | null>(getCurrentUser());
const authenticated = ref(isAuthenticated());

const strategies = ref<StrategyMeta[]>([]);
const allLoaded = ref(false);
const myStrategies = ref<StrategyMeta[]>([]);
const mineLoaded = ref(false);

const view = ref<"all" | "mine">("all");
const myPage = ref(1);
const myTotal = ref(0);

const detail = ref<StrategyDetail | null>(null);
const uploadFileName = ref("");
const isDragover = ref(false);
const shareLink = ref("");
const converting = ref(false);
const draft = ref<StrategyDraft | null>(null);

const detailDialog = ref<HTMLDialogElement | null>(null);
const uploadDialog = ref<HTMLDialogElement | null>(null);
const convertDialog = ref<HTMLDialogElement | null>(null);
const editDialog = ref<HTMLDialogElement | null>(null);
const uploadInput = ref<HTMLInputElement | null>(null);
const userMenu = ref<HTMLDetailsElement | null>(null);
const authDialog = ref<HTMLDialogElement | null>(null);

/** 登录/注册弹窗状态 */
const authMode = ref<"login" | "register">("login");
const authEmail = ref("");
const authPassword = ref("");
const authPassword2 = ref("");
const authError = ref("");
const authSubmitting = ref(false);
/** 注册成功后提示去邮箱完成验证 */
const authNeedsConfirm = ref(false);

/** 当前视图对应的列表，两个视图共用同一套卡片渲染 */
const list = computed(() => (view.value === "all" ? strategies.value : myStrategies.value));
const listLoaded = computed(() => (view.value === "all" ? allLoaded.value : mineLoaded.value));
const totalPages = computed(() => Math.max(1, Math.ceil(myTotal.value / MY_PAGE_SIZE)));
/** 详情弹窗复用的只读表单数据 */
const detailDraft = computed(() => (detail.value ? strategyToDraft(detail.value) : null));

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

async function loadAll(): Promise<void> {
  try {
    const data = await getStrategies();
    strategies.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to fetch strategies:", err);
    strategies.value = [];
    showToast(errorMessage(err, "加载攻略列表失败"), "error");
  } finally {
    allLoaded.value = true;
  }
}

async function loadMine(page = 1): Promise<void> {
  const uploader = user.value?.email ?? "";
  if (!uploader) return;

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
    showToast(errorMessage(err, "加载我的攻略失败"), "error");
  } finally {
    mineLoaded.value = true;
    setLoading(false);
  }
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

async function download(id: StrategyMeta["id"] | null): Promise<void> {
  if (id == null) return;
  showToast("正在下载攻略...", "info");
  try {
    const data = await getStrategyDetail(id);
    downloadJsonFile(data, `SRAstrategy_${data.title ?? String(id)}.json`);
    showToast("攻略下载成功！", "success");
  } catch (err) {
    console.error("Failed to download strategy:", err);
    showToast(errorMessage(err, "攻略下载失败！"), "error");
  }
}

async function openDetail(id: StrategyMeta["id"]): Promise<void> {
  setLoading(true, "正在加载攻略详情...");
  try {
    detail.value = await getStrategyDetail(id);
    detailDialog.value?.showModal();
  } catch (err) {
    console.error("Failed to fetch strategy detail:", err);
    showToast(errorMessage(err, "加载攻略详情失败"), "error");
  } finally {
    setLoading(false);
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
    // 上传者由服务端按登录账号写入，这里无需传值
    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
    delete parsed.uploader;
    await createStrategy(parsed);
    showToast("上传成功", "success");
    closeUploadDialog();
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
  uploadDialog.value?.showModal();
}

function openConvertDialog(): void {
  shareLink.value = "";
  convertDialog.value?.showModal();
}

function closeConvertDialog(): void {
  if (converting.value) return;
  convertDialog.value?.close();
  shareLink.value = "";
}

/** 一键把官方攻略链接转换为 SRA 攻略，然后弹出编辑表单 */
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

/** 打开转换结果的编辑表单，作者字段只读 */
function openEditDialog(strategy: SraStrategy): void {
  draft.value = strategyToDraft(strategy);
  editDialog.value?.showModal();
}

function closeEditDialog(): void {
  editDialog.value?.close();
  draft.value = null;
}

/** 校验编辑结果，返回可下载/上传的 SRA 攻略数据 */
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

/** 下载编辑后的 SRA 攻略 JSON */
function confirmDownload(): void {
  const strategy = buildStrategy();
  if (!strategy) return;
  downloadJsonFile(strategy, `SRAstrategy_${strategy.title}.json`);
  showToast("攻略文件已下载", "success");
  closeEditDialog();
}

/** 上传编辑后的 SRA 攻略 */
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
    showToast("上传成功", "success");
    closeEditDialog();
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
  authDialog.value?.showModal();
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
      refreshAuth();
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

/** 重新发送邮箱确认邮件 */
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
  userMenu.value?.removeAttribute("open");
  showToast("已退出登录", "success");
}

function openMine(): void {
  view.value = "mine";
  void loadMine(1);
}

/** 取出并清理邮件确认链接上的参数 */
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

  setLoading(true, "正在完成登录...");
  const callback = await handleOAuthCallback();
  setLoading(false);
  if (callback) {
    refreshAuth();
    if (callback.ok) showToast("登录成功", "success");
    else if (callback.message) showToast(callback.message, "error");
  }
  await loadAll();
});
</script>

<template>
  <div class="strategy-toolbar">
    <button
      v-if="!authenticated"
      type="button"
      class="btn btn--primary"
      @click="openAuthDialog('login')"
    >
      登录 / 注册
    </button>
    <details v-else ref="userMenu" class="user-menu">
      <summary>
        <span class="user-menu__name">{{ user?.email }}</span>
      </summary>
      <div class="user-menu__list">
        <button type="button" class="user-menu__item" @click="onLogout">退出登录</button>
      </div>
    </details>
    <button type="button" class="btn" @click="requestUpload">上传攻略</button>
    <button type="button" class="btn" @click="openConvertDialog">一键转换</button>
    <button v-if="authenticated" type="button" class="btn" @click="openMine">我的攻略</button>
  </div>

  <section v-show="view === 'mine'">
    <div class="my-strategies-header">
      <h2>我的攻略</h2>
      <button type="button" class="btn" @click="view = 'all'">返回全部攻略</button>
    </div>
  </section>

  <section>
    <div class="strategy-list">
      <article v-for="item in list" :key="item.id" class="strategy-card">
        <div class="strategy-card__content">
          <h3 class="strategy-card__title">{{ item.title }}</h3>
          <p class="strategy-card__desc">{{ item.description }}</p>
          <div class="strategy-card__tags">
            <span class="tag tag--primary">上传者：{{ item.uploader }}</span>
            <span class="tag tag--info">上次更新：{{ formatTime(item.updateTime) }}</span>
            <span v-if="item.isPublic" class="tag tag--success">公开</span>
            <span v-else class="tag tag--danger">仅自己可见</span>
          </div>
        </div>
        <div class="strategy-card__actions">
          <button
            type="button"
            class="icon-btn"
            title="详细信息"
            aria-label="详细信息"
            @click="openDetail(item.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <path :d="ICON_INFO"></path>
            </svg>
          </button>
          <button
            type="button"
            class="icon-btn"
            data-action="download"
            title="下载攻略"
            aria-label="下载攻略"
            @click="download(item.id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <path :d="ICON_DOWNLOAD"></path>
            </svg>
          </button>
        </div>
      </article>
    </div>
    <p v-if="list.length === 0 && listLoaded" class="strategy-empty">
      {{ view === "all" ? "暂无攻略，快来上传第一份吧！" : "你还没有上传过攻略。" }}
    </p>
  </section>

  <div v-if="view === 'mine' && myTotal > MY_PAGE_SIZE" class="strategy-pagination">
    <span class="strategy-pagination__info">
      第 {{ myPage }} / {{ totalPages }} 页 · 共 {{ myTotal }} 条
    </span>
    <button type="button" class="btn" :disabled="myPage <= 1" @click="loadMine(myPage - 1)">
      上一页
    </button>
    <button type="button" class="btn" :disabled="myPage >= totalPages" @click="loadMine(myPage + 1)">
      下一页
    </button>
  </div>

  <dialog ref="authDialog" class="strategy-dialog strategy-dialog--auth">
    <h2 class="strategy-dialog__title">{{ authMode === "login" ? "登录" : "注册账号" }}</h2>
    <div class="auth-tabs">
      <button
        type="button"
        class="auth-tab"
        :class="{ 'is-active': authMode === 'login' }"
        @click="switchAuthMode('login')"
      >
        登录
      </button>
      <button
        type="button"
        class="auth-tab"
        :class="{ 'is-active': authMode === 'register' }"
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
      <p v-if="authError" class="auth-error">{{ authError }}</p>

      <div class="strategy-dialog__footer">
        <button type="button" class="btn auth-spacer" :disabled="authSubmitting" @click="onGithubLogin">
          GitHub 登录
        </button>
        <button type="button" class="btn" :disabled="authSubmitting" @click="closeAuthDialog">
          取消
        </button>
        <button type="submit" class="btn btn--primary" :disabled="authSubmitting">
          {{ authSubmitting ? "处理中..." : authMode === "login" ? "登录" : "注册" }}
        </button>
      </div>
    </form>
  </dialog>

  <dialog ref="detailDialog" class="strategy-dialog">
    <h2 class="strategy-dialog__title">攻略详情</h2>
    <StrategyForm v-if="detailDraft" :model-value="detailDraft" readonly />
    <div class="strategy-dialog__footer">
      <button type="button" class="btn" @click="detailDialog?.close()">关闭</button>
      <button type="button" class="btn btn--primary" @click="download(detail?.id ?? null)">
        下载攻略
      </button>
    </div>
  </dialog>

  <dialog ref="uploadDialog" class="strategy-dialog">
    <h2 class="strategy-dialog__title">上传攻略</h2>
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

  <dialog ref="convertDialog" class="strategy-dialog">
    <h2 class="strategy-dialog__title">一键转换官方攻略</h2>
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

  <dialog ref="editDialog" class="strategy-dialog">
    <h2 class="strategy-dialog__title">预览并编辑攻略</h2>
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
</template>