/**
 * 业务实体类型定义
 * 共享类型，不依赖任何具体实现
 */

/**
 * Prompt 数据(线格式)
 * 与主进程领域模型 shared/domain/database-types.ts#Prompt 结构兼容,
 * 差异字段(contentTranslate/note 等可选性)为渲染侧宽松视图。
 */
export type IPrompt = {
  id: string;
  title: string;
  content: string;
  contentTranslate?: string;
  note?: string;
  isSafe?: number;
  isFavorite?: boolean;
  isDeleted: boolean;
  images?: ImageRefView[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

/**
 * 图像数据(线格式)
 * 与主进程领域模型 shared/domain/database-types.ts#Image 结构兼容
 */
export type IImage = {
  id: string;
  fileName: string;
  relativePath: string;
  thumbnailPath?: string | null;
  isSafe?: number;
  isFavorite?: boolean;
  isDeleted: boolean;
  fileSize?: number;
  width?: number | null;
  height?: number | null;
  note?: string;
  promptRefs?: PromptRefView[];
  prompts?: Array<{ id: string }>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

/** 提示词卡片上的图像引用(线格式, 见 domain#ImageRef) */
export interface ImageRefView {
  id: string;
  fileName?: string;
  relativePath?: string;
  thumbnailPath?: string | null;
}

/** 图像卡片上的提示词引用(线格式, 见 domain#PromptRef) */
export interface PromptRefView {
  promptId: string;
  promptTitle?: string;
  promptContent?: string;
  promptContentTranslate?: string;
  promptNote?: string;
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

/** 导出并删除孤儿文件结果 */
export interface IExportOrphanFilesResult {
  successCount: number;
  failedCount: number;
  exportCount: number;
  deletedCount: number;
  exportPath: string;
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

// ==================== 对话框类型 ====================

/** 对话框类型 */
export type DialogType = "info" | "warning";

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
  onRender?: (tags?: string[]) => void;
}
