/**
 * 进度对话框组件
 * 用于显示长时间操作的进度
 */

import { Constants } from "../../constants";

export interface ProgressDialogOptions {
  title?: string;
  status?: string;
  onCancel?: () => void;
  onComplete?: () => void;
}

export class ProgressDialog {
  private dialog: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private fillEl: HTMLElement | null = null;
  private percentEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private detailEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private closeProgressBtn: HTMLButtonElement | null = null;
  private actionsEl: HTMLElement | null = null;

  private onCancelCallback: (() => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private startTime: number | null = null;
  private isVisible = false;
  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.init();
  }

  /**
   * 初始化
   * @private
   */
  private init(): void {
    this.dialog = document.getElementById(Constants.Ids.PROGRESS_DIALOG);
    this.titleEl = document.getElementById(Constants.Ids.PROGRESS_DIALOG_TITLE);
    this.fillEl = document.getElementById(Constants.Ids.PROGRESS_FILL);
    this.percentEl = document.getElementById(Constants.Ids.PROGRESS_PERCENT);
    this.statusEl = document.getElementById(Constants.Ids.PROGRESS_STATUS);
    this.detailEl = document.getElementById(Constants.Ids.PROGRESS_DETAIL);
    this.timeEl = document.getElementById(Constants.Ids.PROGRESS_TIME);
    this.cancelBtn = document.getElementById(
      Constants.Ids.CANCEL_PROGRESS_BTN,
    ) as HTMLButtonElement | null;
    this.closeBtn = document.getElementById(
      Constants.Ids.CLOSE_PROGRESS_DIALOG,
    ) as HTMLButtonElement | null;
    this.closeProgressBtn = document.getElementById(
      Constants.Ids.CLOSE_PROGRESS_BTN,
    ) as HTMLButtonElement | null;
    this.actionsEl = document.getElementById(Constants.Ids.PROGRESS_ACTIONS);

    this.bindEvents();
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    this.cancelBtn?.addEventListener("click", () => {
      this.handleCancel();
    });

    this.closeBtn?.addEventListener("click", () => {
      this.hide();
      // 触发完成回调
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
        this.onCompleteCallback = null;
      }
    });

    this.closeProgressBtn?.addEventListener("click", () => {
      this.hide();
      // 触发完成回调
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
        this.onCompleteCallback = null;
      }
    });

    // 点击背景关闭（可选）
    this.dialog?.addEventListener("click", (e: Event) => {
      if (e.target === this.dialog && !this.isInProgress()) {
        this.hide();
        // 触发完成回调
        if (this.onCompleteCallback) {
          this.onCompleteCallback();
          this.onCompleteCallback = null;
        }
      }
    });
  }

  /**
   * 显示进度对话框
   * @param options - 配置选项
   */
  show(options: ProgressDialogOptions = {}): void {
    if (!this.dialog) return;

    this.isVisible = true;
    this.startTime = Date.now();
    this.onCancelCallback = options.onCancel || null;
    this.onCompleteCallback = options.onComplete || null;

    // 设置标题
    if (options.title && this.titleEl) {
      this.titleEl.textContent = options.title;
    }

    // 设置初始状态
    if (options.status && this.statusEl) {
      this.statusEl.textContent = options.status;
    }

    // 重置进度
    this.updateProgress(0);
    if (this.detailEl) {
      this.detailEl.textContent = "";
    }
    if (this.timeEl) {
      this.timeEl.textContent = "";
    }

    // 显示取消按钮，隐藏关闭按钮
    if (this.cancelBtn) {
      this.cancelBtn.style.display = "block";
      this.cancelBtn.disabled = false;
      this.cancelBtn.textContent = "取消";
    }
    if (this.closeBtn) {
      this.closeBtn.style.display = "none";
    }
    if (this.closeProgressBtn) {
      this.closeProgressBtn.style.display = "none";
    }

    // 显示对话框
    this.dialog.style.display = "flex";
    this.dialog.classList.add("active");

    // 开始更新时间
    this.startTimeUpdate();
  }

  /**
   * 隐藏进度对话框
   */
  hide(): void {
    if (!this.dialog) return;

    this.isVisible = false;
    this.dialog.style.display = "none";
    this.dialog.classList.remove("active");
    this.stopTimeUpdate();
  }

  /**
   * 更新进度
   * @param percent - 进度百分比 (0-100)
   * @param status - 状态文字
   * @param detail - 详细信息
   */
  updateProgress(percent: number, status?: string, detail?: string): void {
    if (!this.isVisible) return;

    // 更新进度条
    if (this.fillEl) {
      this.fillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    // 更新百分比
    if (this.percentEl) {
      this.percentEl.textContent = `${Math.round(percent)}%`;
    }

    // 更新状态
    if (status && this.statusEl) {
      this.statusEl.textContent = status;
    }

    // 更新详情
    if (detail && this.detailEl) {
      this.detailEl.textContent = detail;
    }
  }

  /**
   * 更新详细信息
   * @param detail - 详细信息
   */
  updateDetail(detail: string): void {
    if (this.detailEl) {
      this.detailEl.textContent = detail;
    }
  }

  /**
   * 完成操作
   * @param message - 完成消息
   */
  complete(message = "完成"): void {
    this.updateProgress(100);

    // 更新状态消息，支持换行
    if (this.statusEl) {
      this.statusEl.innerHTML = message.replace(/\n/g, "<br>");
    }

    // 隐藏取消按钮，显示关闭按钮
    if (this.cancelBtn) {
      this.cancelBtn.style.display = "none";
    }
    if (this.closeBtn) {
      this.closeBtn.style.display = "block";
    }
    if (this.closeProgressBtn) {
      this.closeProgressBtn.style.display = "block";
    }

    this.stopTimeUpdate();
    this.updateTimeDisplay();
  }

  /**
   * 显示错误
   * @param message - 错误消息
   */
  error(message: string): void {
    this.updateProgress(0, "出错", message);

    if (this.fillEl) {
      this.fillEl.style.background = "var(--danger-color)";
    }

    // 隐藏取消按钮，显示关闭按钮
    if (this.cancelBtn) {
      this.cancelBtn.style.display = "none";
    }
    if (this.closeBtn) {
      this.closeBtn.style.display = "block";
    }
    if (this.closeProgressBtn) {
      this.closeProgressBtn.style.display = "block";
    }

    this.stopTimeUpdate();
  }

  /**
   * 处理取消
   * @private
   */
  private handleCancel(): void {
    if (this.onCancelCallback) {
      this.onCancelCallback();
    }

    // 禁用取消按钮，显示取消中状态
    if (this.cancelBtn) {
      this.cancelBtn.disabled = true;
      this.cancelBtn.textContent = "正在取消...";
    }

    this.updateProgress(0, "正在取消...");
  }

  /**
   * 开始时间更新
   * @private
   */
  private startTimeUpdate(): void {
    this.stopTimeUpdate();
    this.timeUpdateInterval = setInterval(() => {
      this.updateTimeDisplay();
    }, 1000);
  }

  /**
   * 停止时间更新
   * @private
   */
  private stopTimeUpdate(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  /**
   * 更新时间显示
   * @private
   */
  private updateTimeDisplay(): void {
    if (!this.startTime || !this.timeEl) return;

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    this.timeEl.textContent = `已用时: ${minutes}分${seconds}秒`;
  }

  /**
   * 检查是否正在进行
   * @returns 是否正在进行
   */
  isInProgress(): boolean {
    return this.isVisible && this.cancelBtn !== null && this.cancelBtn.style.display !== "none";
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.hide();
    this.updateProgress(0, "准备中...");
    if (this.detailEl) {
      this.detailEl.textContent = "";
    }
    if (this.timeEl) {
      this.timeEl.textContent = "";
    }

    if (this.fillEl) {
      this.fillEl.style.background = "";
    }
  }
}

// 导出单例
export const progressDialog = new ProgressDialog();
