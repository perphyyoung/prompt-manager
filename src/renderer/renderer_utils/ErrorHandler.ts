/**
 * 错误处理工具类
 * 统一处理错误消息提取、日志记录和用户提示
 */

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  userMessage?: string;
  toastType?: 'error' | 'warning' | 'info' | 'success';
  app?: { showToast?: (message: string, type: string) => void } | null;
}

export interface ErrorContext {
  module: string;
  operation: string;
}

export class ErrorHandler {
  static handleError(
    context: ErrorContext,
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): void {
    const {
      showToast = true,
      logError = true,
      userMessage,
      toastType = 'error',
      app
    } = options;

    const errorMessage = ErrorHandler.extractErrorMessage(error);
    const fullMessage = userMessage ? `${userMessage}: ${errorMessage}` : `${context.operation}失败: ${errorMessage}`;

    if (logError && window.electronAPI?.logError) {
      window.electronAPI.logError(context.module, `Failed to ${context.operation}:`, error);
    } else if (logError) {
      console.error(`[${context.module}] Failed to ${context.operation}:`, error);
    }

    if (showToast) {
      const targetApp = app ?? window.app;
      targetApp?.showToast?.(fullMessage, toastType);
    }
  }

  static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }

  static async handleAsyncError<T>(
    context: ErrorContext,
    operation: () => Promise<T>,
    options: {
      showToast?: boolean;
      logError?: boolean;
      userMessage?: string;
      toastType?: 'error' | 'warning' | 'info' | 'success';
      defaultValue?: T;
    } = {}
  ): Promise<T | undefined> {
    const {
      showToast = true,
      logError = true,
      userMessage,
      toastType = 'error',
      defaultValue
    } = options;

    try {
      return await operation();
    } catch (error) {
      ErrorHandler.handleError(context, error, {
        showToast,
        logError,
        userMessage,
        toastType
      });
      return defaultValue;
    }
  }

  static handleWithToast(
    error: unknown,
    message: string,
    toastType: 'error' | 'warning' | 'info' | 'success' = 'error',
    logDetails?: { module: string; operation: string }
  ): void {
    const errorMessage = ErrorHandler.extractErrorMessage(error);

    if (logDetails) {
      window.electronAPI?.logError?.(logDetails.module, `Failed to ${logDetails.operation}:`, error);
    }

    window.app?.showToast?.(`${message}: ${errorMessage}`, toastType);
  }
}
