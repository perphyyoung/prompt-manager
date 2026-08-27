import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorHandler } from "../src/renderer/renderer_utils/ErrorHandler";

describe("ErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractErrorMessage", () => {
    it("从 Error 实例提取 message", () => {
      const error = new Error("test error message");
      expect(ErrorHandler.extractErrorMessage(error)).toBe("test error message");
    });

    it("从字符串提取内容", () => {
      expect(ErrorHandler.extractErrorMessage("string error")).toBe("string error");
    });

    it("从未知对象返回默认消息", () => {
      expect(ErrorHandler.extractErrorMessage({ code: 500 })).toBe("未知错误");
    });
  });

  describe("handleError", () => {
    it("默认配置显示 toast 并记录日志", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const logErrorMock = window.electronAPI.logError as ReturnType<typeof vi.fn>;

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error);

      expect(logErrorMock).toHaveBeenCalledWith("TestModule", "Failed to test op:", error);
      expect(showToastMock).not.toHaveBeenCalled();
    });

    it("使用提供的 app 的 showToast", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const customApp = { showToast: showToastMock };

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {
        app: customApp,
      });

      expect(showToastMock).toHaveBeenCalledWith("test op失败: test error", "error");
    });

    it("当 app 未提供时使用 window.app", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      (window as unknown as { app: { showToast: typeof showToastMock } }).app = {
        showToast: showToastMock,
      };

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {});

      expect(showToastMock).toHaveBeenCalledWith("test op失败: test error", "error");

      delete (window as unknown as Record<string, unknown>).app;
    });

    it("app 的 showToast 优先于 window.app", () => {
      const error = new Error("test error");
      const appShowToastMock = vi.fn();
      const windowAppShowToastMock = vi.fn();
      const customApp = { showToast: appShowToastMock };
      (window as unknown as { app: { showToast: typeof windowAppShowToastMock } }).app = {
        showToast: windowAppShowToastMock,
      };

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {
        app: customApp,
      });

      expect(appShowToastMock).toHaveBeenCalled();
      expect(windowAppShowToastMock).not.toHaveBeenCalled();

      delete (window as unknown as Record<string, unknown>).app;
    });

    it("customToastType 正确传递给 showToast", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const customApp = { showToast: showToastMock };

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {
        app: customApp,
        toastType: "warning",
      });

      expect(showToastMock).toHaveBeenCalledWith("test op失败: test error", "warning");
    });

    it("userMessage 覆盖默认消息格式", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const customApp = { showToast: showToastMock };

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {
        app: customApp,
        userMessage: "自定义错误消息",
      });

      expect(showToastMock).toHaveBeenCalledWith("自定义错误消息: test error", "error");
    });

    it("logError=false 时跳过日志记录", () => {
      const error = new Error("test error");
      const logErrorMock = window.electronAPI.logError as ReturnType<typeof vi.fn>;

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {
        logError: false,
      });

      expect(logErrorMock).not.toHaveBeenCalled();
    });

    it("showToast=false 时跳过 toast 显示", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const customApp = { showToast: showToastMock };

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {
        app: customApp,
        showToast: false,
      });

      expect(showToastMock).not.toHaveBeenCalled();
    });

    it("window.electronAPI 不存在时使用 console.error 回退", () => {
      const originalElectronAPI = (window as unknown as { electronAPI?: unknown }).electronAPI;
      delete (window as unknown as { electronAPI?: unknown }).electronAPI;

      const error = new Error("test error");

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {});

      expect(console.error).toHaveBeenCalledWith("[TestModule] Failed to test op:", error);

      (window as unknown as { electronAPI?: unknown }).electronAPI = originalElectronAPI;
    });

    it("window.electronAPI 存在但 logError 不存在时不调用", () => {
      const originalElectronAPI = (window as unknown as { electronAPI?: { logError?: unknown } })
        .electronAPI;
      (window as unknown as { electronAPI?: { logError?: unknown } }).electronAPI = {};

      const error = new Error("test error");

      ErrorHandler.handleError({ module: "TestModule", operation: "test op" }, error, {});

      expect(console.error).toHaveBeenCalledWith("[TestModule] Failed to test op:", error);

      (window as unknown as { electronAPI?: unknown }).electronAPI = originalElectronAPI;
    });
  });

  describe("handleAsyncError", () => {
    it("操作成功时返回结果", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await ErrorHandler.handleAsyncError(
        { module: "TestModule", operation: "test op" },
        operation,
      );

      expect(result).toBe("success");
    });

    it("操作失败时调用 handleError 并返回 defaultValue", async () => {
      const error = new Error("async error");
      const operation = vi.fn().mockRejectedValue(error);
      const logErrorMock = window.electronAPI.logError as ReturnType<typeof vi.fn>;

      const result = await ErrorHandler.handleAsyncError(
        { module: "TestModule", operation: "test op" },
        operation,
        { defaultValue: "fallback" },
      );

      expect(result).toBe("fallback");
      expect(logErrorMock).toHaveBeenCalledWith("TestModule", "Failed to test op:", error);
    });

    it("handleAsyncError 不支持 app 参数（由 handleError 传递）", async () => {
      const error = new Error("async error");
      const operation = vi.fn().mockRejectedValue(error);
      const showToastMock = vi.fn();
      const customApp = { showToast: showToastMock };
      const logErrorMock = window.electronAPI.logError as ReturnType<typeof vi.fn>;

      const result = await ErrorHandler.handleAsyncError(
        { module: "TestModule", operation: "test op" },
        operation,
        { app: customApp, defaultValue: "fallback" } as Parameters<
          typeof ErrorHandler.handleAsyncError
        >[2],
      );

      expect(result).toBe("fallback");
      expect(logErrorMock).toHaveBeenCalled();
    });
  });

  describe("handleWithToast", () => {
    it("显示带前缀的 toast 消息", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const originalApp = (window as unknown as { app?: { showToast: typeof showToastMock } }).app;
      (window as unknown as { app?: { showToast: typeof showToastMock } }).app = {
        showToast: showToastMock,
      };

      ErrorHandler.handleWithToast(error, "操作失败", "error", {
        module: "TestModule",
        operation: "test op",
      });

      expect(showToastMock).toHaveBeenCalledWith("操作失败: test error", "error");

      (window as unknown as { app?: unknown }).app = originalApp;
    });

    it("不传 logDetails 时不记录日志", () => {
      const error = new Error("test error");
      const showToastMock = vi.fn();
      const logErrorMock = window.electronAPI.logError as ReturnType<typeof vi.fn>;
      const originalApp = (window as unknown as { app?: { showToast: typeof showToastMock } }).app;
      (window as unknown as { app?: { showToast: typeof showToastMock } }).app = {
        showToast: showToastMock,
      };

      ErrorHandler.handleWithToast(error, "操作失败", "error");

      expect(logErrorMock).not.toHaveBeenCalled();
      expect(showToastMock).toHaveBeenCalledWith("操作失败: test error", "error");

      (window as unknown as { app?: unknown }).app = originalApp;
    });
  });
});
