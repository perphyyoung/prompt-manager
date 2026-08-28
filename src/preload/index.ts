/**
 * Preload Script - 预加载脚本
 * 在渲染进程中暴露安全的 Electron API
 * 通过 contextBridge 隔离主进程和渲染进程
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import {
  IPC,
  IPC_EVENTS,
  IpcApi,
  LogLevel,
  IBackupProgress,
  RebuildThumbnailsProgress,
} from "../shared/ipc-contract.js";

// ==================== 类型定义 ====================

/** 备份进度回调类型 */
type BackupProgressCallback = (progress: IBackupProgress) => void;

// ==================== 通道桥接 ====================

/**
 * 按契约桥接一个 invoke 通道: 入参/返回值/通道名全部由 IpcApi 约束
 */
function bridge<K extends keyof IpcApi>(key: K): IpcApi[K] {
  const invoke = (...args: unknown[]) =>
    ipcRenderer.invoke(IPC[key], ...args) as ReturnType<IpcApi[K]>;
  return invoke as IpcApi[K];
}

// ==================== 内部状态管理 ====================

/**
 * 使用 WeakMap 存储备份进度回调的包装函数
 * 优势：
 * 1. 当原始回调被垃圾回收时，WeakMap 中的条目自动移除
 * 2. 避免内存泄漏
 * 3. 不需要修改原始回调对象
 */
const backupProgressCallbacks = new WeakMap<
  BackupProgressCallback,
  (_event: IpcRendererEvent, progress: IBackupProgress) => void
>();

type RebuildThumbnailsProgressCallback = (progress: RebuildThumbnailsProgress) => void;
const rebuildThumbnailsProgressCallbacks = new WeakMap<
  RebuildThumbnailsProgressCallback,
  (_event: IpcRendererEvent, progress: RebuildThumbnailsProgress) => void
>();

// ==================== API 定义 ====================

type NonBridged = "rendererLog";

interface LogMethods {
  logDebug: (component: string, message: string, data?: unknown) => void;
  logError: (component: string, message: string, data?: unknown) => void;
  logWarn: (component: string, message: string, data?: unknown) => void;
  logInfo: (component: string, message: string, data?: unknown) => void;
}

interface EventMethods {
  onRebuildThumbnailsProgress: (callback: (progress: RebuildThumbnailsProgress) => void) => void;
  offRebuildThumbnailsProgress: (callback: (progress: RebuildThumbnailsProgress) => void) => void;
  onBackupProgress: (callback: BackupProgressCallback) => void;
  offBackupProgress: (callback: BackupProgressCallback) => void;
}

// 桥接面 = IpcApi(除未桥接通道) + 日志便捷方法 + 推送事件订阅
export type IElectronAPI = Omit<IpcApi, NonBridged> & LogMethods & EventMethods;

// ==================== 日志辅助函数 ====================

/**
 * 发送日志到主进程
 * 错误被静默处理，避免日志系统本身导致的问题
 */
function sendLog(level: LogLevel, component: string, message: string, data?: unknown): void {
  ipcRenderer.invoke(IPC.rendererLog, level, component, message, data).catch(() => {
    // 日志发送失败时静默处理，避免递归错误
  });
}

// ==================== 暴露 API ====================

/**
 * 暴露安全的 API 给渲染进程
 * 所有主进程通信都通过 IPC 通道进行
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ==================== 应用信息 ====================
  getAppVersion: bridge("getAppVersion"),

  // ==================== Prompt 管理 ====================
  getPrompts: bridge("getPrompts"),
  getPromptsPaginated: bridge("getPromptsPaginated"),
  getPromptIdsByFilter: bridge("getPromptIdsByFilter"),
  countPromptTags: bridge("countPromptTags"),
  countPromptSpecialTags: bridge("countPromptSpecialTags"),
  getPromptById: bridge("getPromptById"),
  getPromptsByIds: bridge("getPromptsByIds"),
  addPrompt: bridge("addPrompt"),
  updatePrompt: bridge("updatePrompt"),
  softDeletePrompt: bridge("softDeletePrompt"),
  softDeletePrompts: bridge("softDeletePrompts"),
  batchFavoritePrompts: bridge("batchFavoritePrompts"),

  // ==================== 剪贴板/全屏 ====================
  copyToClipboard: bridge("copyToClipboard"),
  setFullscreen: bridge("setFullscreen"),

  // ==================== 设置 ====================
  getDataPath: bridge("getDataPath"),
  openDataDirectory: bridge("openDataDirectory"),
  selectDirectory: bridge("selectDirectory"),
  selectAndInstallFont: bridge("selectAndInstallFont"),
  getInstalledFonts: bridge("getInstalledFonts"),

  // ==================== 图像文件操作 ====================
  saveImageFile: bridge("saveImageFile"),
  replaceImage: bridge("replaceImage"),
  getImagePath: bridge("getImagePath"),
  getImagesPaths: bridge("getImagesPaths"),
  openImageLocation: bridge("openImageLocation"),
  openImageFiles: bridge("openImageFiles"),
  clearAllData: bridge("clearAllData"),
  ensureImageThumbnails: bridge("ensureImageThumbnails"),
  rebuildThumbnails: bridge("rebuildThumbnails"),

  // ==================== 图像管理 ====================
  getImages: bridge("getImages"),
  getImagesPaginated: bridge("getImagesPaginated"),
  getImageIdsByFilter: bridge("getImageIdsByFilter"),
  countImageTags: bridge("countImageTags"),
  countImageSpecialTags: bridge("countImageSpecialTags"),
  getImagesByIds: bridge("getImagesByIds"),
  getImageById: bridge("getImageById"),
  updateImage: bridge("updateImage"),

  // ==================== 提示词回收站 ====================
  getPromptTrash: bridge("getPromptTrash"),
  restorePromptFromTrash: bridge("restorePromptFromTrash"),
  restoreAllPrompts: bridge("restoreAllPrompts"),
  permanentDeletePrompt: bridge("permanentDeletePrompt"),
  emptyPromptTrash: bridge("emptyPromptTrash"),

  // ==================== 应用控制 ====================
  relaunchApp: bridge("relaunchApp"),

  // ==================== 提示词标签组 ====================
  getPromptTagGroups: bridge("getPromptTagGroups"),
  createPromptTagGroup: bridge("createPromptTagGroup"),
  updatePromptTagGroupAttrs: bridge("updatePromptTagGroupAttrs"),
  deletePromptTagGroup: bridge("deletePromptTagGroup"),
  assignPromptTagToBelongGroup: bridge("assignPromptTagToBelongGroup"),

  // ==================== 提示词标签 ====================
  getPromptTags: bridge("getPromptTags"),
  addPromptTag: bridge("addPromptTag"),
  addPromptTags: bridge("addPromptTags"),
  addPromptTagsBatch: bridge("addPromptTagsBatch"),
  deletePromptTag: bridge("deletePromptTag"),
  deletePromptTags: bridge("deletePromptTags"),
  renamePromptTag: bridge("renamePromptTag"),
  getPromptsByTag: bridge("getPromptsByTag"),
  removeTagFromPrompt: bridge("removeTagFromPrompt"),

  // ==================== 图像标签组 ====================
  getImageTagGroups: bridge("getImageTagGroups"),
  createImageTagGroup: bridge("createImageTagGroup"),
  updateImageTagGroupAttrs: bridge("updateImageTagGroupAttrs"),
  deleteImageTagGroup: bridge("deleteImageTagGroup"),
  assignImageTagToBelongGroup: bridge("assignImageTagToBelongGroup"),

  // ==================== 图像标签 ====================
  getImageTags: bridge("getImageTags"),
  addImageTag: bridge("addImageTag"),
  addImageTags: bridge("addImageTags"),
  addImageTagsBatch: bridge("addImageTagsBatch"),
  deleteImageTag: bridge("deleteImageTag"),
  deleteImageTags: bridge("deleteImageTags"),
  renameImageTag: bridge("renameImageTag"),
  getImagesByTag: bridge("getImagesByTag"),
  removeTagFromImage: bridge("removeTagFromImage"),

  // ==================== 图像回收站 ====================
  getImageTrash: bridge("getImageTrash"),
  softDeleteImage: bridge("softDeleteImage"),
  softDeleteImages: bridge("softDeleteImages"),
  batchFavoriteImages: bridge("batchFavoriteImages"),
  restoreImageFromTrash: bridge("restoreImageFromTrash"),
  restoreAllImages: bridge("restoreAllImages"),
  permanentDeleteImage: bridge("permanentDeleteImage"),
  emptyImageTrash: bridge("emptyImageTrash"),

  // ==================== 孤儿文件/共享标签/统计 ====================
  scanOrphanFiles: bridge("scanOrphanFiles"),
  exportOrphanFiles: bridge("exportOrphanFiles"),
  getAllTags: bridge("getAllTags"),
  getStatistics: bridge("getStatistics"),

  // ==================== 完整备份 ====================
  exportFullBackup: bridge("exportFullBackup"),
  importFullBackup: bridge("importFullBackup"),

  // ==================== 调试日志 ====================
  logDebug: (component, message, data?) => {
    sendLog("debug", component, message, data);
  },
  logError: (component, message, data?) => {
    if (data !== undefined) {
      console.error(`[${component}] ${message}`, data);
    } else {
      console.error(`[${component}] ${message}`);
    }
    sendLog("error", component, message, data);
  },
  logWarn: (component, message, data?) => {
    sendLog("warn", component, message, data);
  },
  logInfo: (component, message, data?) => {
    sendLog("info", component, message, data);
  },
  onRebuildThumbnailsProgress: (callback) => {
    const wrappedCallback = (_event: IpcRendererEvent, progress: RebuildThumbnailsProgress) =>
      callback(progress);
    rebuildThumbnailsProgressCallbacks.set(callback, wrappedCallback);
    ipcRenderer.on(IPC_EVENTS.rebuildThumbnailsProgress, wrappedCallback);
  },
  offRebuildThumbnailsProgress: (callback) => {
    const wrappedCallback = rebuildThumbnailsProgressCallbacks.get(callback);
    if (wrappedCallback) {
      ipcRenderer.removeListener(IPC_EVENTS.rebuildThumbnailsProgress, wrappedCallback);
      rebuildThumbnailsProgressCallbacks.delete(callback);
    }
  },
  onBackupProgress: (callback) => {
    const wrappedCallback = (_event: IpcRendererEvent, progress: IBackupProgress) =>
      callback(progress);
    backupProgressCallbacks.set(callback, wrappedCallback);
    ipcRenderer.on(IPC_EVENTS.backupProgress, wrappedCallback);
  },
  offBackupProgress: (callback) => {
    const wrappedCallback = backupProgressCallbacks.get(callback);
    if (wrappedCallback) {
      ipcRenderer.removeListener(IPC_EVENTS.backupProgress, wrappedCallback);
      backupProgressCallbacks.delete(callback);
    }
  },
} satisfies IElectronAPI);

// 导出类型供渲染进程使用
export type { BackupProgressCallback };
export type {
  IPrompt,
  IImage,
  IOrphanFile,
  IScanOrphanFilesResult,
  IExportOrphanFilesResult,
} from "../types/entities.js";
export type {
  ITagGroup,
  IBackupProgress,
  LogLevel,
  IBackupStats,
  IBackupManifest,
  IpcApi,
} from "../shared/ipc-contract.js";

// 全局声明
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
