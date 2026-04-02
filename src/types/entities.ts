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
  size?: number;
  width?: number;
  height?: number;
  note?: string;
  promptRefs?: Array<{ promptId: string; title?: string }>;
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

/** TagService 接口定义 */
export interface ITagService {
  cacheKey: string;
  cacheKeyGroups: string;
  _clearCache(key: string): void;
  getTags(): Promise<string[]>;
  getTagGroups(): Promise<{ id: number; name: string; sortOrder: number; tags: string[] }[]>;
  addTag(tag: string): Promise<unknown>;
  deleteTag(tag: string): Promise<unknown>;
  renameTag(oldTag: string, newTag: string): Promise<unknown>;
  assignTagToGroup(tag: string, groupId: number | null): Promise<unknown>;
  createGroup(name: string, sortOrder: number): Promise<unknown>;
  updateGroup(groupId: number, attrs: Record<string, unknown>): Promise<unknown>;
  deleteGroup(groupId: number): Promise<unknown>;
  getSpecialTagChecks(): Map<string, (item: Record<string, unknown>) => boolean>;
  groupTagsByGroup(tags: string[], groups: { id: number; name: string; sortOrder: number; tags: string[] }[]): { groupedTags: Record<number, string[]>; ungroupedTags: string[] };
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

/** TagRegistry 接口定义 */
export interface ITagRegistry {
  /** 渲染标签管理器 */
  render(searchTerm?: string): Promise<void>;

  /** 刷新标签数据 */
  refresh(): Promise<void>;

  /** 添加标签 */
  addTag(tag: string): Promise<void>;

  /** 删除标签 */
  deleteTag(tag: string): Promise<void>;

  /** 更新标签 */
  updateTag(oldTag: string, newTag: string): Promise<void>;

  /** 获取所有标签 */
  getTags(): Promise<string[]>;

  /** 绑定事件 */
  bindEvents(container: HTMLElement): void;

  /** 在管理器中添加标签 */
  addTagInManager(): void;

  /** 切换批量管理模式 */
  toggleBatchMode(): void;

  /** 类型 */
  type: string;

  /** 排序字段 */
  sortBy: string;

  /** 排序顺序 */
  sortOrder: 'asc' | 'desc';

  /** 服务实例 */
  service: ITagService;
}
