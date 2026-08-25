/**
 * Preload Script - 预加载脚本
 * 在渲染进程中暴露安全的 Electron API
 * 通过 contextBridge 隔离主进程和渲染进程
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IPrompt, IImage, IOrphanFile, IScanOrphanFilesResult, IExportOrphanFilesResult } from '../types/entities.js';

// ==================== 类型定义 ====================

/** 标签组 */
interface ITagGroup {
  id: number;
  name: string;
  sortOrder: number;
  tags?: string[];
}

/** 备份进度 */
interface IBackupProgress {
  stage: string;
  percent: number;
  status: string;
  detail?: string;
}

/** 日志级别 */
type LogLevel = 'debug' | 'error' | 'warn' | 'info';

/** 备份进度回调类型 */
type BackupProgressCallback = (progress: IBackupProgress) => void;

/** 备份统计信息 */
interface IBackupStats {
  database: boolean;
  prompts: { count: number };
  images: { count: number; size: number };
}

/** 备份清单 */
interface IBackupManifest {
  /** manifest 格式版本 */
  version: string;
  /** 应用名称 */
  appName: string;
  /** 导出时间（本地时间格式：YYYY/M/D H:mm:ss） */
  exportedAt: string;
  /** 数据格式版本，用于兼容性检查 */
  dataVersion: number;
  /** 备份内容统计信息 */
  contents: IBackupStats;
}

// ==================== 内部状态管理 ====================

/**
 * 使用 WeakMap 存储备份进度回调的包装函数
 * 优势：
 * 1. 当原始回调被垃圾回收时，WeakMap 中的条目自动移除
 * 2. 避免内存泄漏
 * 3. 不需要修改原始回调对象
 */
const backupProgressCallbacks = new WeakMap<BackupProgressCallback, (_event: IpcRendererEvent, progress: IBackupProgress) => void>();

// ==================== API 定义 ====================

interface IElectronAPI {
  // 应用信息
  getAppVersion: () => Promise<string>;

  // Prompt 管理
  getPrompts: (sortBy: string, sortOrder: string) => Promise<IPrompt[]>;
  getPromptsPaginated: (options: import('../main/database-types.js').GetPromptsPaginatedOptions) => Promise<{ items: IPrompt[]; totalCount: number }>;
  countPromptTags: (options: import('../main/database-types.js').CountPromptTagsOptions) => Promise<Record<string, number>>;
  countPromptSpecialTags: (options: import('../main/database-types.js').CountPromptTagsOptions) => Promise<import('../main/database-types.js').PromptSpecialTagCounts>;
  getPromptById: (id: string) => Promise<IPrompt | null>;
  addPrompt: (prompt: Omit<IPrompt, 'id'>) => Promise<IPrompt>;
  updatePrompt: (id: string, updates: Partial<IPrompt>) => Promise<void>;
  softDeletePrompt: (id: string) => Promise<void>;
  softDeletePrompts: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
  batchFavoritePrompts: (ids: string[]) => Promise<{ success: boolean; updated: number }>;
  searchPrompts: (query: string) => Promise<IPrompt[]>;

  // 剪贴板
  copyToClipboard: (text: string) => Promise<void>;

  // 全屏控制
  setFullscreen: (flag: boolean) => Promise<void>;

  // 设置
  getDataPath: () => Promise<string>;
  openDataDirectory: () => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  selectAndInstallFont: () => Promise<{ success: boolean; fontName?: string; filePath?: string; error?: string }>;
  getInstalledFonts: () => Promise<{ fontName: string; fileName: string; filePath: string }[]>;

  // 图像文件操作
  saveImageFile: (sourcePath: string, fileName: string) => Promise<{ id: string; fileName: string; isDuplicate: boolean; duplicateType?: 'restored_from_trash' | 'existing'; relativePath?: string; thumbnailPath?: string; width?: number; height?: number; size?: number }>;
  replaceImage: (oldImageId: string) => Promise<{ success: boolean; canceled?: boolean; reason?: string; image?: IImage; relatedPromptIds?: string[] }>;
  getImagePath: (relativePath: string) => Promise<string>;
  getImagesPaths: (relativePaths: string[]) => Promise<string[]>;
  openImageLocation: (relativePath: string) => Promise<void>;
  openImageFiles: () => Promise<string[]>;
  clearAllData: () => Promise<string>;
  getImages: (sortBy: string, sortOrder: string) => Promise<IImage[]>;
  getImagesPaginated: (options: import('../main/database-types.js').GetImagesPaginatedOptions) => Promise<{ items: IImage[]; totalCount: number }>;
  getImageIdsByFilter: (options: Omit<import('../main/database-types.js').GetImagesPaginatedOptions, 'limit' | 'offset'>) => Promise<string[]>;
  countImageTags: (options: import('../main/database-types.js').CountImageTagsOptions) => Promise<Record<string, number>>;
  countImageSpecialTags: (options: import('../main/database-types.js').CountImageTagsOptions) => Promise<import('../main/database-types.js').ImageSpecialTagCounts>;
  getImagesByIds: (ids: string[]) => Promise<IImage[]>;
  getAllImagesForStats: () => Promise<IImage[]>;
  getImageById: (imageId: string) => Promise<IImage | null>;

  // 提示词回收站
  getPromptTrash: () => Promise<Array<IPrompt & { deletedAt: string; type: string }>>;
  restorePromptFromTrash: (id: string) => Promise<void>;
  restoreAllPrompts: () => Promise<void>;
  permanentDeletePrompt: (id: string) => Promise<void>;
  emptyPromptTrash: () => Promise<void>;

  // 应用控制
  relaunchApp: (oldDataDir?: string) => Promise<void>;

  // 提示词标签组管理
  getPromptTagGroups: () => Promise<ITagGroup[]>;
  createPromptTagGroup: (name: string, sortOrder: number) => Promise<ITagGroup>;
  updatePromptTagGroupAttrs: (id: number, updates: Partial<ITagGroup>) => Promise<void>;
  deletePromptTagGroup: (id: number) => Promise<void>;
  assignPromptTagToBelongGroup: (tagName: string, groupId: number | null) => Promise<void>;

  // 提示词标签管理
  getPromptTags: () => Promise<string[]>;
  addPromptTag: (tag: string) => Promise<void>;
  addPromptTags: (promptId: string, tagNames: string[]) => Promise<void>;
  addPromptTagsBatch: (promptIds: string[], tagNames: string[]) => Promise<{ success: boolean; added: number }>;
  deletePromptTag: (tag: string) => Promise<void>;
  deletePromptTags: (tags: string[]) => Promise<{ success: boolean; deleted: number; tags: string[] }>;
  renamePromptTag: (oldTag: string, newTag: string) => Promise<void>;
  getPromptsByTag: (tagName: string) => Promise<string[]>;
  removeTagFromPrompt: (promptId: string, tagName: string) => Promise<boolean>;

  // 图像标签组管理
  getImageTagGroups: () => Promise<ITagGroup[]>;
  createImageTagGroup: (name: string, sortOrder: number) => Promise<ITagGroup>;
  updateImageTagGroupAttrs: (id: number, updates: Partial<ITagGroup>) => Promise<void>;
  deleteImageTagGroup: (id: number) => Promise<void>;
  assignImageTagToBelongGroup: (tagName: string, groupId: number | null) => Promise<void>;

  // 图像标签管理
  getImageTags: () => Promise<string[]>;
  addImageTag: (tag: string) => Promise<void>;
  addImageTags: (imageId: string, tagNames: string[]) => Promise<void>;
  addImageTagsBatch: (imageIds: string[], tagNames: string[]) => Promise<{ success: boolean; added: number }>;
  updateImage: (id: string, updates: Partial<IImage>) => Promise<void>;
  renameImageTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteImageTag: (tag: string) => Promise<void>;
  deleteImageTags: (tags: string[]) => Promise<{ success: boolean; deleted: number }>;
  getImagesByTag: (tagName: string) => Promise<string[]>;
  removeTagFromImage: (imageId: string, tagName: string) => Promise<boolean>;

  // 图像回收站
  getImageTrash: () => Promise<Array<IImage & { deletedAt: string; type: string }>>;
  softDeleteImage: (id: string) => Promise<void>;
  softDeleteImages: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
  batchFavoriteImages: (ids: string[]) => Promise<{ success: boolean; updated: number }>;
  restoreImageFromTrash: (id: string) => Promise<void>;
  restoreAllImages: () => Promise<void>;
  permanentDeleteImage: (id: string) => Promise<boolean>;
  emptyImageTrash: () => Promise<void>;

  // 导出孤儿文件
  scanOrphanFiles: () => Promise<IScanOrphanFilesResult>;
  exportOrphanFiles: (exportDir: string) => Promise<IExportOrphanFilesResult>;

  // 共享标签
  getAllTags: () => Promise<string[]>;

  // 标签同步
  syncTagsBidirectional: () => Promise<{
    promptToImage: {
      imported: number;
      skipped: number;
      tags: string[];
      tagGroups: Array<{ groupName: string; tags: string[] }>;
      ungroupedTags: string[];
    };
    imageToPrompt: {
      imported: number;
      skipped: number;
      tags: string[];
      tagGroups: Array<{ groupName: string; tags: string[] }>;
      ungroupedTags: string[];
    };
  }>;

  // 统计
  getStatistics: () => Promise<{
    prompts: { total: number; favorite: number; trash: number };
    images: { total: number; favorite: number; trash: number };
    tags: { prompt: number; image: number };
  }>;

  // 调试日志
  logDebug: (component: string, message: string, data?: unknown) => void;
  logError: (component: string, message: string, data?: unknown) => void;
  logWarn: (component: string, message: string, data?: unknown) => void;
  logInfo: (component: string, message: string, data?: unknown) => void;

  // 完整备份
  exportFullBackup: () => Promise<{ success: boolean; filePath: string; stats: IBackupStats } | { cancelled: true }>;
  importFullBackup: () => Promise<{ success: boolean; manifest: IBackupManifest; oldDataDir: string } | { cancelled: true }>;
  onBackupProgress: (callback: BackupProgressCallback) => void;
  offBackupProgress: (callback: BackupProgressCallback) => void;
}

// ==================== 日志辅助函数 ====================

/**
 * 发送日志到主进程
 * 错误被静默处理，避免日志系统本身导致的问题
 */
function sendLog(level: LogLevel, component: string, message: string, data?: unknown): void {
  ipcRenderer.invoke('renderer-log', level, component, message, data).catch(() => {
    // 日志发送失败时静默处理，避免递归错误
  });
}

// ==================== 暴露 API ====================

/**
 * 暴露安全的 API 给渲染进程
 * 所有主进程通信都通过 IPC 通道进行
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== 应用信息 ====================
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // ==================== Prompt 管理 ====================
  getPrompts: (sortBy: string, sortOrder: string) => ipcRenderer.invoke('get-prompts', sortBy, sortOrder),
  getPromptsPaginated: (options: import('../main/database-types.js').GetPromptsPaginatedOptions) => ipcRenderer.invoke('get-prompts-paginated', options),
  countPromptTags: (options: import('../main/database-types.js').CountPromptTagsOptions) => ipcRenderer.invoke('count-prompt-tags', options),
  countPromptSpecialTags: (options: import('../main/database-types.js').CountPromptTagsOptions) => ipcRenderer.invoke('count-prompt-special-tags', options),
  getPromptById: (id: string) => ipcRenderer.invoke('get-prompt-by-id', id),
  addPrompt: (prompt: Omit<IPrompt, 'id'>) => ipcRenderer.invoke('add-prompt', prompt),
  updatePrompt: (id: string, updates: Partial<IPrompt>) => ipcRenderer.invoke('update-prompt', id, updates),
  softDeletePrompt: (id: string) => ipcRenderer.invoke('soft-delete-prompt', id),
  softDeletePrompts: (ids: string[]) => ipcRenderer.invoke('soft-delete-prompts', ids),
  batchFavoritePrompts: (ids: string[]) => ipcRenderer.invoke('batch-favorite-prompts', ids),
  searchPrompts: (query: string) => ipcRenderer.invoke('search-prompts', query),

  // ==================== 剪贴板 ====================
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),

  // ==================== 全屏控制 ====================
  setFullscreen: (flag: boolean) => ipcRenderer.invoke('set-fullscreen', flag),

  // ==================== 设置 ====================
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  openDataDirectory: () => ipcRenderer.invoke('open-data-directory'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectAndInstallFont: () => ipcRenderer.invoke('select-and-install-font'),
  getInstalledFonts: () => ipcRenderer.invoke('get-installed-fonts'),

  // ==================== 图像文件操作 ====================
  saveImageFile: (sourcePath: string, fileName: string) => ipcRenderer.invoke('save-image-file', sourcePath, fileName),
  replaceImage: (oldImageId: string) => ipcRenderer.invoke('replace-image', oldImageId),
  getImagePath: (relativePath: string) => ipcRenderer.invoke('get-image-path', relativePath),
  getImagesPaths: (relativePaths: string[]) => ipcRenderer.invoke('get-images-paths', relativePaths),
  openImageLocation: (relativePath: string) => ipcRenderer.invoke('open-image-location', relativePath),
  openImageFiles: () => ipcRenderer.invoke('dialog:open-image-files'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  getImages: (sortBy: string, sortOrder: string) => ipcRenderer.invoke('get-images', sortBy, sortOrder),
  getImagesPaginated: (options: import('../main/database-types.js').GetImagesPaginatedOptions) => ipcRenderer.invoke('get-images-paginated', options),
  getImageIdsByFilter: (options: Omit<import('../main/database-types.js').GetImagesPaginatedOptions, 'limit' | 'offset'>) => ipcRenderer.invoke('get-image-ids-by-filter', options),
  countImageTags: (options: import('../main/database-types.js').CountImageTagsOptions) => ipcRenderer.invoke('count-image-tags', options),
  countImageSpecialTags: (options: import('../main/database-types.js').CountImageTagsOptions) => ipcRenderer.invoke('count-image-special-tags', options),
  getImagesByIds: (ids: string[]) => ipcRenderer.invoke('get-images-by-ids', ids),
  getAllImagesForStats: () => ipcRenderer.invoke('get-all-images-for-stats'),
  getImageById: (imageId: string) => ipcRenderer.invoke('get-image-by-id', imageId),

  // ==================== 提示词回收站 ====================
  getPromptTrash: () => ipcRenderer.invoke('get-prompt-trash'),
  restorePromptFromTrash: (id: string) => ipcRenderer.invoke('restore-prompt-from-trash', id),
  restoreAllPrompts: () => ipcRenderer.invoke('restore-all-prompts'),
  permanentDeletePrompt: (id: string) => ipcRenderer.invoke('permanent-delete-prompt', id),
  emptyPromptTrash: () => ipcRenderer.invoke('empty-prompt-trash'),

  // ==================== 应用控制 ====================
  relaunchApp: (oldDataDir?: string) => ipcRenderer.invoke('relaunch-app', oldDataDir),

  // ==================== 提示词标签组管理 ====================
  getPromptTagGroups: () => ipcRenderer.invoke('get-prompt-tag-groups'),
  createPromptTagGroup: (name: string, sortOrder: number) => ipcRenderer.invoke('create-prompt-tag-group', name, sortOrder),
  updatePromptTagGroupAttrs: (id: number, updates: Partial<ITagGroup>) => ipcRenderer.invoke('update-prompt-tag-group-attrs', id, updates),
  deletePromptTagGroup: (id: number) => ipcRenderer.invoke('delete-prompt-tag-group', id),
  assignPromptTagToBelongGroup: (tagName: string, groupId: number | null) => ipcRenderer.invoke('assign-prompt-tag-to-belong-group', tagName, groupId),

  // 提示词标签管理
  getPromptTags: () => ipcRenderer.invoke('get-prompt-tags'),
  addPromptTag: (tag: string) => ipcRenderer.invoke('add-prompt-tag', tag),
  addPromptTags: (promptId: string, tagNames: string[]) => ipcRenderer.invoke('add-prompt-tags', promptId, tagNames),
  addPromptTagsBatch: (promptIds: string[], tagNames: string[]) => ipcRenderer.invoke('add-prompt-tags-batch', promptIds, tagNames),
  deletePromptTag: (tag: string) => ipcRenderer.invoke('delete-prompt-tag', tag),
  deletePromptTags: (tags: string[]) => ipcRenderer.invoke('delete-prompt-tags', tags),
  renamePromptTag: (oldTag: string, newTag: string) => ipcRenderer.invoke('rename-prompt-tag', oldTag, newTag),
  getPromptsByTag: (tagName: string) => ipcRenderer.invoke('get-prompts-by-tag', tagName),
  removeTagFromPrompt: (promptId: string, tagName: string) => ipcRenderer.invoke('remove-tag-from-prompt', promptId, tagName),

  // 图像标签组管理
  getImageTagGroups: () => ipcRenderer.invoke('get-image-tag-groups'),
  createImageTagGroup: (name: string, sortOrder: number) => ipcRenderer.invoke('create-image-tag-group', name, sortOrder),
  updateImageTagGroupAttrs: (id: number, updates: Partial<ITagGroup>) => ipcRenderer.invoke('update-image-tag-group-attrs', id, updates),
  deleteImageTagGroup: (id: number) => ipcRenderer.invoke('delete-image-tag-group', id),
  assignImageTagToBelongGroup: (tagName: string, groupId: number | null) => ipcRenderer.invoke('assign-image-tag-to-belong-group', tagName, groupId),

  // ==================== 图像标签管理 ====================
  getImageTags: () => ipcRenderer.invoke('get-image-tags'),
  addImageTag: (tag: string) => ipcRenderer.invoke('add-image-tag', tag),
  addImageTags: (imageId: string, tagNames: string[]) => ipcRenderer.invoke('add-image-tags', imageId, tagNames),
  addImageTagsBatch: (imageIds: string[], tagNames: string[]) => ipcRenderer.invoke('add-image-tags-batch', imageIds, tagNames),
  updateImage: (id: string, updates: Partial<IImage>) => ipcRenderer.invoke('update-image', id, updates),
  renameImageTag: (oldTag: string, newTag: string) => ipcRenderer.invoke('rename-image-tag', oldTag, newTag),
  deleteImageTag: (tag: string) => ipcRenderer.invoke('delete-image-tag', tag),
  deleteImageTags: (tags: string[]) => ipcRenderer.invoke('delete-image-tags', tags),
  getImagesByTag: (tagName: string) => ipcRenderer.invoke('get-images-by-tag', tagName),
  removeTagFromImage: (imageId: string, tagName: string) => ipcRenderer.invoke('remove-tag-from-image', imageId, tagName),

  // ==================== 图像回收站 ====================
  getImageTrash: () => ipcRenderer.invoke('get-image-trash'),
  softDeleteImage: (id: string) => ipcRenderer.invoke('soft-delete-image', id),
  softDeleteImages: (ids: string[]) => ipcRenderer.invoke('soft-delete-images', ids),
  batchFavoriteImages: (ids: string[]) => ipcRenderer.invoke('batch-favorite-images', ids),
  restoreImageFromTrash: (id: string) => ipcRenderer.invoke('restore-image-from-trash', id),
  restoreAllImages: () => ipcRenderer.invoke('restore-all-images'),
  permanentDeleteImage: (id: string) => ipcRenderer.invoke('permanent-delete-image', id),
  emptyImageTrash: () => ipcRenderer.invoke('empty-image-trash'),

  // ==================== 导出孤儿文件 ====================
  scanOrphanFiles: () => ipcRenderer.invoke('scan-orphan-files'),
  exportOrphanFiles: (exportDir: string) => ipcRenderer.invoke('export-orphan-files', exportDir),

  // ==================== 共享标签 ====================
  getAllTags: () => ipcRenderer.invoke('get-all-tags'),

  // ==================== 标签同步 ====================
  syncTagsBidirectional: () => ipcRenderer.invoke('sync-tags-bidirectional'),

  // ==================== 统计 ====================
  getStatistics: () => ipcRenderer.invoke('get-statistics'),

  // ==================== 调试日志 ====================
  logDebug: (component: string, message: string, data?: unknown) => {
    sendLog('debug', component, message, data);
  },
  logError: (component: string, message: string, data?: unknown) => {
    if (data !== undefined) {
      console.error(`[${component}] ${message}`, data);
    } else {
      console.error(`[${component}] ${message}`);
    }
    sendLog('error', component, message, data);
  },
  logWarn: (component: string, message: string, data?: unknown) => {
    sendLog('warn', component, message, data);
  },
  logInfo: (component: string, message: string, data?: unknown) => {
    sendLog('info', component, message, data);
  },

  // ==================== 完整备份 ====================
  exportFullBackup: () => ipcRenderer.invoke('export-full-backup'),
  importFullBackup: () => ipcRenderer.invoke('import-full-backup'),
  onBackupProgress: (callback: BackupProgressCallback) => {
    const wrappedCallback = (_event: IpcRendererEvent, progress: IBackupProgress) => callback(progress);
    // 使用 WeakMap 存储包装后的回调，避免内存泄漏
    backupProgressCallbacks.set(callback, wrappedCallback);
    ipcRenderer.on('backup-progress', wrappedCallback);
  },
  offBackupProgress: (callback: BackupProgressCallback) => {
    const wrappedCallback = backupProgressCallbacks.get(callback);
    if (wrappedCallback) {
      ipcRenderer.removeListener('backup-progress', wrappedCallback);
      backupProgressCallbacks.delete(callback);
    }
  },

} as IElectronAPI);

// 导出类型供渲染进程使用
export type { IElectronAPI, IPrompt, IImage, ITagGroup, IBackupProgress, IOrphanFile, IScanOrphanFilesResult, LogLevel, BackupProgressCallback, IBackupStats, IBackupManifest };

// 全局声明
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
