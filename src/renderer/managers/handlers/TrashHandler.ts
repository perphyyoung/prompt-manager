import type { PromptTrashHandler } from './PromptTrashHandler';
import type { ImageTrashHandler } from './ImageTrashHandler';

/**
 * 回收站处理器类型
 */
export type TrashHandler = PromptTrashHandler | ImageTrashHandler;

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
