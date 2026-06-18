import type { PromptTrashHandler } from './PromptTrashHandler';
import type { ImageTrashHandler } from './ImageTrashHandler';
export { TrashItem, CacheUpdateData } from './TrashTypes';

/**
 * 回收站处理器类型
 */
export type TrashHandler = PromptTrashHandler | ImageTrashHandler;
