import type {
  IPrompt,
  IImage,
  IScanOrphanFilesResult,
  IExportOrphanFilesResult,
} from "../types/entities.js";
import type { PromptImage } from "./domain/database-types.js";
/**
 * IPC 契约 — 通道名与签名/Payload 类型的单一事实源
 *
 * 主进程 routers 通过 handleTyped(key, handler) 注册(通道名、入参、返回值受契约约束);
 * preload 通过 bridge(key) 桥接(同一约束);渲染进程经 window.electronAPI 使用。
 * 新增通道: 在 IPC 加一行 + 在 IpcApi 加一条签名, 两端即获得编译期检查。
 */

// ==================== 通道名 ====================

/** invoke 通道: 契约键(camelCase) → 通道字面量 */
export const IPC = {
  scanOrphanFiles: "scan-orphan-files",
  exportOrphanFiles: "export-orphan-files",
  exportFullBackup: "export-full-backup",
  importFullBackup: "import-full-backup",
  saveImageFile: "save-image-file",
  replaceImage: "replace-image",
  openImageFiles: "dialog:open-image-files",
  getImages: "get-images",
  ensureImageThumbnails: "ensure-image-thumbnails",
  rebuildThumbnails: "rebuild-thumbnails",
  getImagesPaginated: "get-images-paginated",
  getImageIdsByFilter: "get-image-ids-by-filter",
  countImageTags: "count-image-tags",
  countImageSpecialTags: "count-image-special-tags",
  getImagesByIds: "get-images-by-ids",
  getImageById: "get-image-by-id",
  getPromptImages: "get-prompt-images",
  updateImage: "update-image",
  batchFavoriteImages: "batch-favorite-images",
  getImagePath: "get-image-path",
  getImagesPaths: "get-images-paths",
  openImageLocation: "open-image-location",
  selectImageFiles: "select-image-files",
  getPrompts: "get-prompts",
  getPromptsPaginated: "get-prompts-paginated",
  getPromptIdsByFilter: "get-prompt-ids-by-filter",
  countPromptTags: "count-prompt-tags",
  countPromptSpecialTags: "count-prompt-special-tags",
  addPrompt: "add-prompt",
  updatePrompt: "update-prompt",
  batchFavoritePrompts: "batch-favorite-prompts",
  isTitleExists: "is-title-exists",
  getPromptsByIds: "get-prompts-by-ids",
  getPromptById: "get-prompt-by-id",
  exportPrompts: "export-prompts",
  importPrompts: "import-prompts",
  relaunchApp: "relaunch-app",
  copyToClipboard: "copy-to-clipboard",
  setFullscreen: "set-fullscreen",
  getDataPath: "get-data-path",
  openDataDirectory: "open-data-directory",
  selectDirectory: "select-directory",
  clearAllData: "clear-all-data",
  getStatistics: "get-statistics",
  optimizeDatabase: "optimize-database",
  getAppVersion: "get-app-version",
  rendererLog: "renderer-log",
  selectAndInstallFont: "select-and-install-font",
  getInstalledFonts: "get-installed-fonts",
  getPromptTags: "get-prompt-tags",
  addPromptTag: "add-prompt-tag",
  addPromptTags: "add-prompt-tags",
  addPromptTagsBatch: "add-prompt-tags-batch",
  deletePromptTag: "delete-prompt-tag",
  deletePromptTags: "delete-prompt-tags",
  getPromptsByTag: "get-prompts-by-tag",
  removeTagFromPrompt: "remove-tag-from-prompt",
  getPromptTagGroups: "get-prompt-tag-groups",
  createPromptTagGroup: "create-prompt-tag-group",
  updatePromptTagGroupAttrs: "update-prompt-tag-group-attrs",
  deletePromptTagGroup: "delete-prompt-tag-group",
  assignPromptTagToBelongGroup: "assign-prompt-tag-to-belong-group",
  renamePromptTag: "rename-prompt-tag",
  getImageTags: "get-image-tags",
  addImageTag: "add-image-tag",
  addImageTags: "add-image-tags",
  addImageTagsBatch: "add-image-tags-batch",
  renameImageTag: "rename-image-tag",
  deleteImageTag: "delete-image-tag",
  deleteImageTags: "delete-image-tags",
  getImagesByTag: "get-images-by-tag",
  removeTagFromImage: "remove-tag-from-image",
  getImageTagGroups: "get-image-tag-groups",
  createImageTagGroup: "create-image-tag-group",
  updateImageTagGroupAttrs: "update-image-tag-group-attrs",
  deleteImageTagGroup: "delete-image-tag-group",
  getAllTags: "get-all-tags",
  assignImageTagToBelongGroup: "assign-image-tag-to-belong-group",
  softDeletePrompt: "soft-delete-prompt",
  softDeletePrompts: "soft-delete-prompts",
  getPromptTrash: "get-prompt-trash",
  restorePromptFromTrash: "restore-prompt-from-trash",
  permanentDeletePrompt: "permanent-delete-prompt",
  restoreAllPrompts: "restore-all-prompts",
  emptyPromptTrash: "empty-prompt-trash",
  getImageTrash: "get-image-trash",
  restoreImageFromTrash: "restore-image-from-trash",
  permanentDeleteImage: "permanent-delete-image",
  restoreAllImages: "restore-all-images",
  emptyImageTrash: "empty-image-trash",
  softDeleteImage: "soft-delete-image",
  softDeleteImages: "soft-delete-images",
} as const;

/** 推送事件通道(主进程 sender.send → 渲染进程 ipcRenderer.on) */
export const IPC_EVENTS = {
  rebuildThumbnailsProgress: "rebuild-thumbnails-progress",
  backupProgress: "backup-progress",
} as const;

// ==================== 通道签名 ====================

/** 每个 invoke 通道的方法签名: 入参为发送方→主进程的 payload, 返回值为反向 */
export interface IpcApi {
  scanOrphanFiles: () => Promise<IScanOrphanFilesResult>;
  exportOrphanFiles: (exportDir: string) => Promise<IExportOrphanFilesResult>;
  exportFullBackup: () => Promise< { success: boolean; filePath: string; stats: IBackupStats } | { cancelled: true } >;
  importFullBackup: () => Promise< { success: boolean; manifest: IBackupManifest; oldDataDir: string } | { cancelled: true } >;
  saveImageFile: ( sourcePath: string, fileName: string, ) => Promise<{ id: string; fileName: string; isDuplicate: boolean; duplicateType?: "restored_from_trash" | "existing"; relativePath?: string; thumbnailPath?: string; width?: number; height?: number; size?: number; }>;
  replaceImage: (oldImageId: string) => Promise<{ success: boolean; canceled?: boolean; reason?: string; image?: IImage; relatedPromptIds?: string[]; }>;
  openImageFiles: () => Promise<string[]>;
  getImages: (sortBy: string, sortOrder: string) => Promise<IImage[]>;
  ensureImageThumbnails: (ids: string[]) => Promise<{ fixed: Array<{ id: string; relativePath: string; fullPath: string }>; missing: string[]; }>;
  rebuildThumbnails: () => Promise<{ success: boolean; regenerated: number; failed: number; total: number; }>;
  getImagesPaginated: ( options: import("./domain/database-types.js").GetImagesPaginatedOptions, ) => Promise<{ items: IImage[]; totalCount: number }>;
  getImageIdsByFilter: ( options: Omit< import("./domain/database-types.js").GetImagesPaginatedOptions, "limit" | "offset" >, ) => Promise<string[]>;
  countImageTags: ( options: import("./domain/database-types.js").CountImageTagsOptions, ) => Promise<Record<string, number>>;
  countImageSpecialTags: ( options: import("./domain/database-types.js").CountImageTagsOptions, ) => Promise<import("./domain/database-types.js").ImageSpecialTagCounts>;
  getImagesByIds: (ids: string[]) => Promise<IImage[]>;
  getImageById: (imageId: string) => Promise<IImage | null>;
  updateImage: (id: string, updates: Partial<IImage>) => Promise<void>;
  batchFavoriteImages: (ids: string[]) => Promise<{ success: boolean; updated: number }>;
  getImagePath: (relativePath: string) => Promise<string>;
  getImagesPaths: (relativePaths: string[]) => Promise<string[]>;
  openImageLocation: (relativePath: string) => Promise<void>;
  getPrompts: (sortBy: string, sortOrder: string) => Promise<IPrompt[]>;
  getPromptsPaginated: ( options: import("./domain/database-types.js").GetPromptsPaginatedOptions, ) => Promise<{ items: IPrompt[]; totalCount: number }>;
  getPromptIdsByFilter: ( options: Omit< import("./domain/database-types.js").GetPromptsPaginatedOptions, "limit" | "offset" >, ) => Promise<string[]>;
  countPromptTags: ( options: import("./domain/database-types.js").CountPromptTagsOptions, ) => Promise<Record<string, number>>;
  countPromptSpecialTags: ( options: import("./domain/database-types.js").CountPromptTagsOptions, ) => Promise<import("./domain/database-types.js").PromptSpecialTagCounts>;
  addPrompt: (prompt: Omit<IPrompt, "id">) => Promise<IPrompt>;
  updatePrompt: (id: string, updates: Partial<IPrompt>) => Promise<void>;
  batchFavoritePrompts: (ids: string[]) => Promise<{ success: boolean; updated: number }>;
  getPromptsByIds: (ids: string[]) => Promise<IPrompt[]>;
  getPromptById: (id: string) => Promise<IPrompt | null>;
  relaunchApp: (oldDataDir?: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<boolean>;
  setFullscreen: (flag: boolean) => Promise<boolean>;
  getDataPath: () => Promise<string>;
  openDataDirectory: () => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  clearAllData: () => Promise<string>;
  getStatistics: (isSafeOnly: boolean) => Promise<import("./domain/database-types.js").Statistics>;
  getAppVersion: () => Promise<string>;
  selectAndInstallFont: () => Promise<{ fontName: string; fileName: string; filePath: string } | null>;
  getInstalledFonts: () => Promise<{ fontName: string; fileName: string; filePath: string }[]>;
  getPromptTags: () => Promise<string[]>;
  addPromptTag: (tag: string) => Promise<string[]>;
  addPromptTags: (promptId: string, tagNames: string[]) => Promise<boolean>;
  addPromptTagsBatch: ( promptIds: string[], tagNames: string[], ) => Promise<{ success: boolean; added: number }>;
  deletePromptTag: (tag: string) => Promise<string[]>;
  deletePromptTags: ( tags: string[], ) => Promise<{ success: boolean; deleted: number; tags: string[] }>;
  getPromptsByTag: (tagName: string) => Promise<string[]>;
  removeTagFromPrompt: (promptId: string, tagName: string) => Promise<boolean>;
  getPromptTagGroups: () => Promise<ITagGroup[]>;
  createPromptTagGroup: (name: string, sortOrder: number) => Promise<ITagGroup>;
  updatePromptTagGroupAttrs: (id: number, updates: Partial<ITagGroup>) => Promise<void>;
  deletePromptTagGroup: (id: number) => Promise<boolean>;
  assignPromptTagToBelongGroup: (tagName: string, groupId: number | null) => Promise<void>;
  renamePromptTag: (oldTag: string, newTag: string) => Promise<string[]>;
  getImageTags: () => Promise<string[]>;
  addImageTag: (tag: string) => Promise<string[]>;
  addImageTags: (imageId: string, tagNames: string[]) => Promise<boolean>;
  addImageTagsBatch: ( imageIds: string[], tagNames: string[], ) => Promise<{ success: boolean; added: number }>;
  renameImageTag: (oldTag: string, newTag: string) => Promise<string[]>;
  deleteImageTag: (tag: string) => Promise<boolean>;
  deleteImageTags: (tags: string[]) => Promise<{ success: boolean; deleted: number }>;
  getImagesByTag: (tagName: string) => Promise<string[]>;
  removeTagFromImage: (imageId: string, tagName: string) => Promise<boolean>;
  getImageTagGroups: () => Promise<ITagGroup[]>;
  createImageTagGroup: (name: string, sortOrder: number) => Promise<ITagGroup>;
  updateImageTagGroupAttrs: (id: number, updates: Partial<ITagGroup>) => Promise<void>;
  deleteImageTagGroup: (id: number) => Promise<boolean>;
  getAllTags: () => Promise<string[]>;
  assignImageTagToBelongGroup: (tagName: string, groupId: number | null) => Promise<void>;
  softDeletePrompt: (id: string) => Promise<boolean>;
  softDeletePrompts: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
  getPromptTrash: () => Promise<Array<IPrompt & { deletedAt: string; type: string }>>;
  restorePromptFromTrash: (id: string) => Promise<boolean>;
  permanentDeletePrompt: (id: string) => Promise<boolean>;
  restoreAllPrompts: () => Promise<boolean>;
  emptyPromptTrash: () => Promise<boolean>;
  getImageTrash: () => Promise<Array<IImage & { deletedAt: string; type: string }>>;
  restoreImageFromTrash: (id: string) => Promise<boolean>;
  permanentDeleteImage: (id: string) => Promise<boolean>;
  restoreAllImages: () => Promise<boolean>;
  emptyImageTrash: () => Promise<boolean>;
  softDeleteImage: (id: string) => Promise<boolean>;
  softDeleteImages: (ids: string[]) => Promise<{ success: boolean; deleted: number }>;
  rendererLog(level: "debug" | "error" | "warn" | "info", component: string, message: string, data?: unknown): Promise<boolean>;
  exportPrompts(prompts: IPrompt[]): Promise<boolean>;
  importPrompts(): Promise<IPrompt[] | null>;
  isTitleExists(title: string, excludeId: string | null): Promise<boolean>;
  getPromptImages(promptId: string): Promise<PromptImage[]>;
  optimizeDatabase(): Promise<boolean>;
  selectImageFiles(): Promise<string[] | null>;
}

// ==================== 契约依赖的共享类型 ====================

export type LogLevel = "debug" | "error" | "warn" | "info";

/** 标签组 */
export interface ITagGroup {
  id: number;
  name: string;
  sortOrder: number;
  tags?: string[];
}

/** 备份进度 */
export interface IBackupProgress {
  stage: string;
  percent: number;
  status: string;
  detail?: string;
}

/** 备份统计信息 */
export interface IBackupStats {
  database: boolean;
  prompts: { count: number };
  images: { count: number; size: number };
}

/** 备份清单 */
export interface IBackupManifest {
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

// ==================== 推送事件 payload ====================

export interface RebuildThumbnailsProgress {
  current: number;
  total: number;
  fileName: string;
}

// ==================== 编译期完备性断言 ====================

// IPC 的每个键都必须在 IpcApi 中有签名(漏签名 → 此处类型报错)
type AssertIpcComplete = [keyof typeof IPC] extends [keyof IpcApi] ? true : never;
const _assertIpcComplete: AssertIpcComplete = true;
export { _assertIpcComplete };

// 导入放在顶部会被上述模板打断, 由脚本追加: