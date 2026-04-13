import { PyTagGroups, TagOperationResult } from '../../pyTagGroups/index.ts';
import { CacheManager } from '../../utils/CacheManager.ts';
import { LRUCache } from '../../utils/LRUCache.ts';

export interface IBatchOperationConfig {
  delete?: {
    api: string;
    batchApi?: string;
    cacheDelete?: (cacheManager: CacheManager) => LRUCache<unknown>;
    event?: string;
    confirm?: boolean;
    clearSelection?: boolean;
    reloadData?: boolean;
    successMsg: (count: number) => string;
    errorMsg: string;
  };
  addTag?: {
    api: string;
    event?: string;
    needInput?: boolean;
    inputTitle: string;
    inputPlaceholder: string;
    processItems?: (ids: string[], tagInput: string) => Promise<void>;
    successMsg: (count: number) => string;
    errorMsg: string;
  };
  favorite?: {
    api: string;
    event?: string;
    processItems?: (ids: string[], input: null, api: string) => Promise<void>;
    successMsg: (count: number) => string;
    errorMsg: string;
  };
}

export interface IMultiSelectConfig {
  label: string;
  itemType: 'image' | 'prompt';
  buttons: Array<{
    id: string;
    text: string;
    className: string;
    action: string;
  }>;
  operations: IBatchOperationConfig;
}

interface BatchAddTagsOptions {
  getItemById: (id: string) => Promise<{ tags?: string[] } | null>;
  updateItem: (id: string, data: { tags: string[] }) => Promise<void>;
  type: 'prompt' | 'image';
  itemName: string;
}

async function processBatchAddTags(
  ids: string[],
  tagInput: string,
  options: BatchAddTagsOptions
): Promise<void> {
  const { getItemById, updateItem, type } = options;
  const pyTagGroups = PyTagGroups.getInstance(type);

  const creationResult = await pyTagGroups.create(tagInput) as TagOperationResult;

  if (creationResult.errors.length > 0) {
    throw new Error(creationResult.errors.map((e: { error: string }) => e.error).join(', '));
  }

  const tagsToAdd = creationResult.created;
  if (tagsToAdd.length === 0) return;

  for (const id of ids) {
    const item = await getItemById(id);
    if (!item) continue;

    const currentItemTags = item.tags || [];
    const newTags = [...new Set([...currentItemTags, ...tagsToAdd])];

    await updateItem(id, { tags: newTags });
  }
}

export const MultiSelectConfig: Record<'prompt' | 'image', IMultiSelectConfig> = {
  prompt: {
    label: '提示词',
    itemType: 'prompt',
    buttons: [
      { id: 'promptBatchSelectAllBtn', text: '全选', className: 'batch-action-btn batch-action-selectall', action: 'SelectAll' },
      { id: 'promptBatchInvertBtn', text: '反选', className: 'batch-action-btn batch-action-invert', action: 'Invert' },
      { id: 'promptBatchAddTagBtn', text: '批量添加标签', className: 'batch-action-btn batch-action-addtag', action: 'AddTag' },
      { id: 'promptBatchFavoriteBtn', text: '批量收藏', className: 'batch-action-btn batch-action-favorite', action: 'Favorite' },
      { id: 'promptBatchDeleteBtn', text: '批量删除', className: 'batch-action-btn batch-action-delete', action: 'Delete' },
      { id: 'promptBatchCancelBtn', text: '取消选择', className: 'batch-action-btn batch-action-cancel', action: 'Cancel' }
    ],
    operations: {
      delete: {
        api: 'softDeletePrompt',
        batchApi: 'softDeletePrompts',
        cacheDelete: (cacheManager: CacheManager) => cacheManager.getPromptCache(),
        event: 'promptsDeleted',
        confirm: true,
        clearSelection: true,
        reloadData: true,
        successMsg: (count: number) => `${count} 个提示词已删除`,
        errorMsg: '批量删除失败'
      },
      addTag: {
        api: 'updatePrompt',
        event: 'promptTagsChanged',
        needInput: true,
        inputTitle: '添加标签',
        inputPlaceholder: '输入要添加的标签（多个标签用逗号分隔）',
        processItems: async (ids: string[], tagInput: string) => {
          await processBatchAddTags(ids, tagInput, {
            getItemById: (id: string) => window.electronAPI.getPromptById(id),
            updateItem: (id: string, data: { tags: string[] }) => window.electronAPI.updatePrompt(id, data),
            type: 'prompt',
            itemName: '提示词'
          });
        },
        successMsg: (count: number) => `${count} 个提示词已添加标签`,
        errorMsg: '批量添加标签失败'
      },
      favorite: {
        api: 'batchFavoritePrompts',
        event: 'promptsFavorited',
        processItems: async (ids: string[]) => {
          await window.electronAPI.batchFavoritePrompts(ids);
        },
        successMsg: (count: number) => `${count} 个提示词已收藏`,
        errorMsg: '批量收藏失败'
      }
    }
  },
  image: {
    label: '图像',
    itemType: 'image',
    buttons: [
      { id: 'imageBatchSelectAllBtn', text: '全选', className: 'batch-action-btn batch-action-selectall', action: 'SelectAll' },
      { id: 'imageBatchInvertBtn', text: '反选', className: 'batch-action-btn batch-action-invert', action: 'Invert' },
      { id: 'imageBatchAddTagBtn', text: '批量添加标签', className: 'batch-action-btn batch-action-addtag', action: 'AddTag' },
      { id: 'imageBatchFavoriteBtn', text: '批量收藏', className: 'batch-action-btn batch-action-favorite', action: 'Favorite' },
      { id: 'imageBatchDeleteBtn', text: '批量删除', className: 'batch-action-btn batch-action-delete', action: 'Delete' },
      { id: 'imageBatchCancelBtn', text: '取消选择', className: 'batch-action-btn batch-action-cancel', action: 'Cancel' }
    ],
    operations: {
      delete: {
        api: 'softDeleteImage',
        batchApi: 'softDeleteImages',
        cacheDelete: (cacheManager: CacheManager) => cacheManager.getImageCache(),
        event: 'imagesDeleted',
        confirm: true,
        clearSelection: true,
        reloadData: true,
        successMsg: (count: number) => `${count} 个图像已删除`,
        errorMsg: '批量删除失败'
      },
      addTag: {
        api: 'updateImage',
        event: 'imageTagsChanged',
        needInput: true,
        inputTitle: '添加标签',
        inputPlaceholder: '输入要添加的标签（多个标签用逗号分隔）',
        processItems: async (ids: string[], tagInput: string) => {
          await processBatchAddTags(ids, tagInput, {
            getItemById: (id: string) => window.electronAPI.getImageById(id),
            updateItem: (id: string, data: { tags: string[] }) => window.electronAPI.updateImage(id, data),
            type: 'image',
            itemName: '图像'
          });
        },
        successMsg: (count: number) => `${count} 个图像已添加标签`,
        errorMsg: '批量添加标签失败'
      },
      favorite: {
        api: 'batchFavoriteImages',
        event: 'imagesFavorited',
        processItems: async (ids: string[]) => {
          await window.electronAPI.batchFavoriteImages(ids);
        },
        successMsg: (count: number) => `${count} 个图像已收藏`,
        errorMsg: '批量收藏失败'
      }
    }
  }
};
