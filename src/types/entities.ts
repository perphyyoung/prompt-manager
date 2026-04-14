/**
 * 业务实体类型定义
 * 共享类型，不依赖任何具体实现
 */

/** Prompt 数据 */
export interface IPrompt {
  id: string;
  title: string;
  content: string;
  contentTranslate?: string;
  note?: string;
  isSafe?: number;
  isFavorite?: number;
  isDeleted?: boolean;
  images?: Array<{ id: string; thumbnailPath?: string }>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  [key: string]: unknown;
}

/** 图像数据 */
export interface IImage {
  id: string;
  fileName: string;
  relativePath: string;
  isSafe?: number;
  isFavorite?: number;
  isDeleted?: boolean;
  fileSize?: number;
  width?: number;
  height?: number;
  note?: string;
  promptRefs?: Array<{ promptId: string; title?: string; promptContent?: string }>;
  prompts?: Array<{ id: string }>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  [key: string]: unknown;
}

/** 孤儿文件 */
export interface IOrphanFile {
  fullPath: string;
  relativePath: string;
  size: number;
}

/** 扫描孤儿文件结果 */
export interface IScanOrphanFilesResult {
  orphanImages: IOrphanFile[];
  orphanThumbnails: IOrphanFile[];
  orphanImageCount: number;
  orphanThumbnailCount: number;
  orphanImageSize: string;
  orphanThumbnailSize: string;
  totalCount: number;
  totalSize: string;
}

/** 导出孤儿文件结果 */
export interface IExportOrphanFilesResult {
  successCount: number;
  failedCount: number;
  exportPath: string;
}

/** 标签创建选项 */
export interface ITagCreationOptions {
  /** 是否检查标签已存在（默认 true） */
  checkExists?: boolean;
  /** 默认标签组 ID */
  defaultGroupId?: number | null;
}

/** 标签创建结果 */
export interface ITagCreationResult {
  success: boolean;
  created: string[];
  skipped: string[];
  errors: Array<{ tag: string; error: string }>;
}

/** TagService 接口定义 */
export interface ITagService {
  cacheKey: string;
  cacheKeyGroups: string;
  _clearCache(key: string): void;
  getTags(): Promise<string[]>;
  getTagGroups(): Promise<{ id: number; name: string; sortOrder: number; tags: string[] }[]>;
  addTag(tag: string): Promise<unknown>;
  deleteTag(tag: string): Promise<unknown>;
  deleteTags(tags: string[]): Promise<{ success: boolean; deleted: number }>;
  renameTag(oldTag: string, newTag: string): Promise<unknown>;
  assignTagToGroup(tag: string, groupId: number | null): Promise<unknown>;
  createGroup(name: string, sortOrder: number): Promise<unknown>;
  updateGroup(groupId: number, attrs: Record<string, unknown>): Promise<unknown>;
  deleteGroup(groupId: number): Promise<unknown>;
  getSpecialTagChecks(): Map<string, (item: Record<string, unknown>) => boolean>;
  groupTagsByGroup(tags: string[], groups: { id: number; name: string; sortOrder: number; tags: string[] }[]): { groupedTags: Record<number, string[]>; ungroupedTags: string[] };
  createTags(tagInput: string, options?: ITagCreationOptions): Promise<ITagCreationResult>;
  parseTagInput(input: string): string[];
  getAutocompleteSuggestions(input: string, excludeTags?: string[]): Promise<string[]>;
}

/** 带组的标签接口 */
export interface ITagWithGroup {
  name: string;
  groupId: number | null;
  groupName: string;
  groupSortOrder?: number;
}

/** 标签组接口 */
export interface ITagGroup {
  id: number;
  name: string;
  sortOrder?: number;
}

/** 标签管理器类型 */
export type TagManagerType = 'prompt' | 'image';

// ==================== 对话框类型 ====================

/** 对话框类型 */
export type DialogType = 'info' | 'warning';

/** 对话框消息函数 */
export type DialogMessageFunction = (data: IDialogContext) => string;

/** 对话框模板 */
export interface IDialogTemplate {
  title: string | DialogMessageFunction;
  message: string | DialogMessageFunction;
  type?: DialogType;
}

/** 对话框上下文数据 */
export interface IDialogContext {
  name?: string;
  count?: number;
  oldName?: string;
  newName?: string;
  sourceName?: string;
  targetName?: string;
  tagName?: string;
  groupName?: string;
  type?: string;
  oldDataDir?: string;
  promptTitle?: string;
  promptToImage?: {
    imported: number;
    skipped: number;
    tags: string[];
    tagGroups: Array<{ groupName: string; tags: string[] }>;
    ungroupedTags: string[];
  };
  imageToPrompt?: {
    imported: number;
    skipped: number;
    tags: string[];
    tagGroups: Array<{ groupName: string; tags: string[] }>;
    ungroupedTags: string[];
  };
}

/** 可关闭元素接口 - 扩展 HTMLElement 添加 close 方法供 ShortcutManager 调用 */
export interface IClosableElement extends HTMLElement {
  close?: () => void;
}

/** 详情界面标签操作管理器 */
export interface IDetailTagManager {
  getTags: () => string[];
  setTags: (tags: string[]) => void;
  removeTag: (tagName: string) => Promise<boolean>;
  removeTags: (tagNames: string[]) => Promise<{ success: boolean; deleted: number }>;
  addTags: (tagNames: string[]) => Promise<{ success: boolean; added: number }>;
  onRender?: (tags?: string[]) => void;
}

/** 批量标签管理配置 */
export interface IBatchTagManagerConfig {
  toolbarId: string;
  containerId: string;
  inputAreaId: string;
  batchBtnId: string;
}
