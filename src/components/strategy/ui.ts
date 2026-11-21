/** 无框架的轻量 UI 辅助：消息提示、加载遮罩、确认弹窗、文本处理 */

export type ToastType = "success" | "error" | "info" | "warning";

export function escapeHtml(value: unknown): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (ch) => map[ch] as string);
}

/** 秒级时间戳格式化为本地时间 */
export function formatTime(timestamp?: number): string {
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : "未更新";
}

let toastRoot: HTMLElement | null = null;

function ensureToastRoot(): HTMLElement {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "strategy-toast-root";
    document.body.append(toastRoot);
  }
  return toastRoot;
}

export function showToast(message: string, type: ToastType = "info"): void {
  const toast = document.createElement("div");
  toast.className = `strategy-toast strategy-toast--${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  ensureToastRoot().append(toast);

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 200);
  }, 3000);
}

let loadingOverlay: HTMLElement | null = null;

/** 全屏加载遮罩（等价于原先的 v-loading / ElLoading） */
export function setLoading(active: boolean, text = "加载中..."): void {
  if (active) {
    if (!loadingOverlay) {
      loadingOverlay = document.createElement("div");
      loadingOverlay.className = "strategy-loading";
      loadingOverlay.setAttribute("role", "status");
      loadingOverlay.setAttribute("aria-live", "polite");
      loadingOverlay.innerHTML =
        '<span class="strategy-loading__spinner" aria-hidden="true"></span><p class="strategy-loading__text"></p>';
      document.body.append(loadingOverlay);
    }
    const textEl = loadingOverlay.querySelector(".strategy-loading__text");
    if (textEl) textEl.textContent = text;
    loadingOverlay.hidden = false;
  } else if (loadingOverlay) {
    loadingOverlay.hidden = true;
  }
}

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

/** 原生 dialog 实现的确认弹窗（等价于原先的 ElMessageBox.confirm） */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const { title = "提示", confirmText = "确定", cancelText = "取消" } = options;

  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "strategy-dialog strategy-dialog--confirm";
    dialog.innerHTML = `
      <h2 class="strategy-dialog__title">${escapeHtml(title)}</h2>
      <p class="strategy-dialog__message">${escapeHtml(message)}</p>
      <div class="strategy-dialog__footer">
        <button type="button" class="btn" data-confirm="cancel">${escapeHtml(cancelText)}</button>
        <button type="button" class="btn btn--primary" data-confirm="ok">${escapeHtml(confirmText)}</button>
      </div>`;
    // 挂到攻略应用内以继承页面 token（确认弹窗也会在攻略页触发）
    (document.querySelector(".strategy-app") ?? document.body).append(dialog);

    const finish = (value: boolean) => {
      if (!dialog.isConnected) return;
      dialog.close();
      dialog.remove();
      resolve(value);
    };

    dialog.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-confirm]");
      if (target) finish(target.dataset.confirm === "ok");
    });
    dialog.addEventListener("cancel", () => finish(false));

    dialog.showModal();
  });
}