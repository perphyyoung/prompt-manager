/**
 * 回收站项目接口
 */
export interface TrashItem {
  id: string;
  type: string;
  deletedAt: string;
  images?: Array<{ thumbnailPath?: string }>;
  thumbnailPath?: string;
  relativePath?: string;
  [key: string]: unknown;
}

/**
 * 缓存更新数据接口
 */
export interface CacheUpdateData {
  isDeleted: number;
  deletedAt: null;
  updatedAt: string;
}
