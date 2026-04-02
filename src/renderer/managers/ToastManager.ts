/**
 * Toast提示管理器
 * 负责管理提示消息的显示和隐藏
 */

interface ToastOptions {
  duration?: number;
  containerId?: string;
  messageId?: string;
}

interface QueuedMessage {
  message: string;
  type: string;
  duration: number | null;
}

export class ToastManager {
  private duration: number;
  private containerId: string;
  private messageId: string;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: QueuedMessage[] = [];
  private isShowing = false;

  constructor(options: ToastOptions = {}) {
    this.duration = options.duration ?? 3000;
    this.containerId = options.containerId ?? 'toast';
    this.messageId = options.messageId ?? 'toastMessage';
  }

  /**
   * 初始化
   */
  init(): void {
    this.ensureElements();
  }

  /**
   * 确保必要的DOM元素存在
   */
  private ensureElements(): void {
    let container = document.getElementById(this.containerId);

    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'toast';

      const message = document.createElement('span');
      message.id = this.messageId;
      message.className = 'toast-message';

      container.appendChild(message);
      document.body.appendChild(container);
    }
  }

  /**
   * 显示提示消息
   */
  show(message: string, type = 'info', duration: number | null = null): void {
    const toast = document.getElementById(this.containerId);
    const toastMessage = document.getElementById(this.messageId);

    if (!toast || !toastMessage) {
      return;
    }

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    toast.className = `toast toast-${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');

    this.isShowing = true;

    const hideDuration = duration ?? this.duration;
    if (hideDuration > 0) {
      this.hideTimer = setTimeout(() => {
        this.hide();
      }, hideDuration);
    }
  }

  /**
   * 隐藏提示消息
   */
  hide(): void {
    const toast = document.getElementById(this.containerId);
    if (toast) {
      toast.classList.remove('show');
    }
    this.isShowing = false;

    // 处理队列中的下一条消息
    if (this.messageQueue.length > 0) {
      const next = this.messageQueue.shift()!;
      setTimeout(() => {
        this.show(next.message, next.type, next.duration);
      }, 300);
    }
  }

  /**
   * 显示成功消息
   */
  success(message: string, duration?: number): void {
    this.show(message, 'success', duration ?? null);
  }

  /**
   * 显示错误消息
   */
  error(message: string, duration?: number): void {
    this.show(message, 'error', duration ?? null);
  }

  /**
   * 显示信息消息
   */
  info(message: string, duration?: number): void {
    this.show(message, 'info', duration ?? null);
  }

  /**
   * 显示警告消息
   */
  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration ?? null);
  }

  /**
   * 将消息添加到队列
   */
  queue(message: string, type = 'info', duration: number | null = null): void {
    if (this.isShowing) {
      this.messageQueue.push({ message, type, duration });
    } else {
      this.show(message, type, duration);
    }
  }

  /**
   * 清除所有队列中的消息
   */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * 立即隐藏并清除队列
   */
  clear(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.clearQueue();
    this.hide();
  }
}
