/**
 * 数据库类型定义
 * 包含所有表结构和接口定义
 */

// ==================== 数据库行类型 (snake_case) ====================

/**
 * prompts 表原始行数据
 */
export interface PromptRow {
  id: string;
  title: string;
  content: string;
  content_translate: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  deleted_at: string | null;
  is_favorite: number;
  is_safe: number;
  note: string;
  tags?: string;
}

/**
 * images 表原始行数据
 */
export interface ImageRow {
  id: string;
  file_name: string;
  stored_name: string;
  relative_path: string;
  thumbnail_path: string | null;
  md5: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  gen_params: string;
  is_deleted: number;
  deleted_at: string | null;
  is_favorite: number;
  is_safe: number;
  created_at: string;
  updated_at: string;
  note: string;
  image_tags?: string;
}

/**
 * prompt_tag_groups 表原始行数据
 */
export interface PromptTagGroupRow {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * prompt_tags 表原始行数据
 */
export interface PromptTagRow {
  id: number;
  name: string;
  group_id: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * image_tag_groups 表原始行数据
 */
export interface ImageTagGroupRow {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * image_tags 表原始行数据
 */
export interface ImageTagRow {
  id: number;
  name: string;
  group_id: number | null;
  created_at: string;
  updated_at: string;
}

// ==================== 应用层类型 (camelCase) ====================

/**
 * 提示词对象
 */
export interface Prompt {
  id: string;
  title: string;
  content: string;
  contentTranslate: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  isFavorite: boolean;
  isSafe: number;
  note: string;
  tags: string[];
  images?: ImageRef[];
}

/**
 * 图像对象
 */
export interface Image {
  id: string;
  fileName: string;
  storedName: string;
  relativePath: string;
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  fileSize: number;
  isFavorite: boolean;
  isSafe: number;
  isDeleted: boolean;
  deletedAt?: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  promptRefs: PromptRef[];
}

/**
 * 图像引用（用于提示词关联的图像）
 */
export interface ImageRef {
  id: string;
  fileName: string;
  relativePath: string;
  thumbnailPath: string | null;
}

/**
 * 提示词引用（用于图像关联的提示词）
 */
export interface PromptRef {
  promptId: string;
  promptTitle: string;
  promptContent: string;
}

/**
 * 提示词关联的图像（简化版，用于 getPromptImages 返回）
 */
export interface PromptImage {
  id: string;
  fileName: string;
  storedName: string;
  relativePath: string;
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  isSafe: number;
  note: string;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  tags: string[];
  promptRefs: Array<{ promptId: string }>;
}

/**
 * 提示词标签组
 */
export interface PromptTagGroup {
  id: number;
  name: string;
  sortOrder: number;
  tags: string[];
}

/**
 * 图像标签组
 */
export interface ImageTagGroup {
  id: number;
  name: string;
  sortOrder: number;
  tags: string[];
}

/**
 * 标签配置
 */
export interface TagConfig {
  tagTable: string;
  relationTable: string;
  itemIdColumn: string;
  tagIdColumn: string;
  getTags: () => Promise<string[]>;
  groupTable: string;
}

/**
 * 标签配置映射
 */
export interface TagConfigMap {
  prompt: TagConfig;
  image: TagConfig;
}

// ==================== 参数类型 ====================

/**
 * 创建提示词参数
 */
export interface CreatePromptParams {
  id: string;
  title: string;
  content: string;
  contentTranslate?: string;
  tags?: string[];
  images?: ImageRef[];
  note?: string;
  isSafe?: number;
}

/**
 * 更新提示词参数
 */
export interface UpdatePromptParams {
  title?: string;
  content?: string;
  contentTranslate?: string;
  tags?: string[];
  images?: ImageRef[];
  note?: string;
  isSafe?: boolean;
  isFavorite?: boolean;
}

/**
 * 创建图像参数
 */
export interface CreateImageParams {
  id: string;
  fileName: string;
  storedName: string;
  relativePath: string;
  thumbnailPath?: string | null;
  md5: string;
  width?: number | null;
  height?: number | null;
  fileSize?: number;
}

/**
 * 更新图像参数
 */
export interface UpdateImageParams {
  isFavorite?: boolean;
  isSafe?: boolean;
  note?: string;
  fileName?: string;
  tags?: string[];
  prompts?: Array<{ id: string } | string>;
}

/**
 * 批量更新缩略图参数
 */
export interface UpdateThumbnailParams {
  id: string;
  thumbnailPath: string;
}

/**
 * 创建标签组参数
 */
export interface CreateTagGroupParams {
  name: string;
  sortOrder?: number;
}

/**
 * 更新标签组参数
 */
export interface UpdateTagGroupParams {
  name?: string;
  sortOrder?: number;
}

/**
 * 图像文件路径信息（用于删除物理文件）
 */
export interface ImageFilePaths {
  relative_path: string | null;
  thumbnail_path: string | null;
}

// ==================== 选项类型 ====================

/**
 * 映射行到提示词的选项
 */
export interface MapPromptOptions {
  includeImages?: boolean;
  includeDeletedAt?: boolean;
}

/**
 * 映射行到图像的选项
 */
export interface MapImageOptions {
  includeDeletedAt?: boolean;
}

/**
 * 获取图像选项
 */
export interface GetImagesOptions {
  forCleanup?: boolean;
}

/**
 * 图像清理信息（用于孤儿文件清理）
 */
export interface ImageCleanupInfo {
  id: string;
  relative_path: string;
  thumbnail_path: string | null;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== 结果类型 ====================

/**
 * SQL 执行结果
 */
export interface RunResult {
  id: number;
  changes: number;
}

/**
 * 标签同步结果
 */
export interface TagSyncResult {
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
}

/**
 * 统计数据结果
 */
export interface Statistics {
  prompts: {
    total: number;
    active: number;
    deleted: number;
    tags: number;
  };
  images: {
    total: number;
    referenced: number;
    unreferenced: number;
    deleted: number;
    tags: number;
  };
  relations: {
    total: number;
    promptsWithImages: number;
  };
}

/**
 * 未引用图像
 */
export interface UnreferencedImage {
  id: string;
  fileName: string;
  storedName: string;
  relativePath: string;
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  isSafe: number;
  note: string;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
