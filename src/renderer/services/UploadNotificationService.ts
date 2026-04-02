/**
 * 上传通知服务
 * 负责处理上传相关的用户通知和事件触发
 */

// 上传结果接口
interface UploadResult {
  isDuplicate?: boolean;
  duplicateMessage?: string;
  [key: string]: unknown;
}

// 通知选项接口
interface NotifyOptions {
  showToast?: boolean;
  refresh?: boolean;
}

// 应用接口（简化）
interface IApp {
  showToast?: (message: string, type?: string, duration?: number) => void;
  eventBus?: {
    emit: (event: string, data?: unknown) => void;
  };
}

export class UploadNotificationService {
  private app: IApp;

  /**
   * @param app - 应用实例
   */
  constructor(app: IApp) {
    this.app = app;
  }

  /**
   * 通知上传成功
   * @param result - 上传结果
   * @param options - 选项
   * @returns 上传结果
   */
  notifySuccess(result: UploadResult, options: NotifyOptions = {}): UploadResult {
    const { showToast = true, refresh = false } = options;

    if (showToast) {
      if (result.isDuplicate && result.duplicateMessage) {
        this.app.showToast?.(result.duplicateMessage, 'info');
      } else {
        this.app.showToast?.('图像上传成功', 'success');
      }
    }

    if (refresh) {
      this.app.eventBus?.emit('imagesChanged');
    }

    return result;
  }

  /**
   * 通知批量上传进度
   * @param current - 当前进度
   * @param total - 总数
   * @param message - 自定义消息
   */
  notifyProgress(current: number, total: number, message = '正在保存图像'): void {
    this.app.showToast?.(`${message}... (${current}/${total})`, 'info', 0);
  }

  /**
   * 通知批量上传完成
   * @param count - 成功数量
   */
  notifyBatchComplete(count: number): void {
    this.app.showToast?.(`成功保存 ${count} 张图像`, 'success');
  }

  /**
   * 通知上传失败
   * @param message - 错误信息
   */
  notifyError(message: string): void {
    this.app.showToast?.(message, 'error');
  }

  /**
   * 通知操作取消
   * @param message - 取消消息
   */
  notifyCancel(message = '已取消'): void {
    this.app.showToast?.(message, 'info');
  }
}
