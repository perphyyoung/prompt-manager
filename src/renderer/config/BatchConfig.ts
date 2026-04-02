import { TagService } from '../managers/TagService.ts';
import { CacheManager } from '../../utils/CacheManager.ts';
import { LRUCache } from '../../utils/LRUCache.ts';

// 批量添加标签选项接口
interface BatchAddTagsOptions {
  getItemById: (id: string) => Promise<{ tags?: string[] } | null>;
  updateItem: (id: string, data: { tags: string[] }) => Promise<void>;
  type: 'prompt' | 'image';
  itemName: string;
}

// 标签验证结果接口
interface TagValidationResult {
  valid: boolean;
  error?: string;
  newTags: string[];
  hasViolation?: boolean;
  violationGroup?: string;
}

// 按钮配置接口
interface ButtonConfig {
  id: string;
  text: string;
  className: string;
  action: string;
}

// 删除操作配置接口
interface DeleteOperationConfig {
  api: string;
  cacheDelete: (cacheManager: CacheManager) => LRUCache<unknown>;
  event: string;
  confirm: boolean;
  clearSelection: boolean;
  reloadData: boolean;
  successMsg: (count: number) => string;
  errorMsg: string;
}

// 添加标签操作配置接口
interface AddTagOperationConfig {
  api: string;
  event: string;
  needInput: boolean;
  inputTitle: string;
  inputPlaceholder: string;
  processItems: (ids: string[], tagInput: string) => Promise<void>;
  successMsg: (count: number) => string;
  errorMsg: string;
}

// 收藏操作配置接口
interface FavoriteOperationConfig {
  api: string;
  event: string;
  processItems: (ids: string[], input: null, api: string) => Promise<void>;
  successMsg: (count: number) => string;
  errorMsg: string;
}

// 操作配置接口
interface OperationsConfig {
  delete: DeleteOperationConfig;
  addTag: AddTagOperationConfig;
  favorite: FavoriteOperationConfig;
}

// 面板配置接口
interface PanelConfig {
  toolbarId: string;
  actionsId: string;
  countId: string;
  selectAllCheckboxId: string;
  label: string;
  itemType: string;
  buttons: ButtonConfig[];
  operations: OperationsConfig;
  [key: string]: unknown;
}

// 批量配置接口
interface BatchConfigType {
  prompt: PanelConfig;
  image: PanelConfig;
}

/**
 * 通用批量添加标签处理函数
 * @param ids - 项目 ID 数组
 * @param tagInput - 标签输入字符串（逗号分隔）
 * @param options - 配置选项
 */
async function processBatchAddTags(
  ids: string[],
  tagInput: string,
  options: BatchAddTagsOptions
): Promise<void> {
  const { getItemById, updateItem, type, itemName } = options;
  const tagService = TagService.getInstance(type);

  // 解析并去重标签
  const tagNames = tagInput.split(',').map(t => t.trim()).filter(t => t);
  const uniqueTags = [...new Set(tagNames)];

  if (uniqueTags.length === 0) return;

  for (const id of ids) {
    const item = await getItemById(id);
    if (!item) continue;

    const currentItemTags = item.tags || [];
    const currentTagsCopy = [...currentItemTags];

    // 逐个添加标签，使用 TagService 验证
    for (const tagName of uniqueTags) {
      if (currentTagsCopy.includes(tagName)) continue;

      const result = await tagService.validateTagAddition(currentTagsCopy, tagName) as TagValidationResult;

      if (!result.valid) {
        if (result.error === '该标签已存在') continue;
        throw new Error(result.error);
      }

      // 更新标签列表
      const finalTags = result.newTags.filter((t: string) => t && t.trim());
      await updateItem(id, { tags: finalTags });
      currentTagsCopy.length = 0;
      currentTagsCopy.push(...finalTags);
    }
  }
}

/**
 * 批量操作配置
 * 统一定义提示词面板和图像面板的批量操作配置
 */
export const BatchConfig: BatchConfigType = {
  prompt: {
    toolbarId: 'promptBatchToolbar',
    actionsId: 'promptBatchToolbarActions',
    countId: 'promptBatchSelectedCount',
    selectAllCheckboxId: 'promptBatchSelectAllCheckbox',
    label: '提示词',
    itemType: 'prompt',
    buttons: [
      { id: 'promptBatchInvertBtn', text: '反选', className: 'btn btn-sm btn-secondary', action: 'Invert' },
      { id: 'promptBatchAddTagBtn', text: '批量添加标签', className: 'btn btn-sm btn-primary', action: 'AddTag' },
      { id: 'promptBatchFavoriteBtn', text: '批量收藏', className: 'btn btn-sm btn-primary', action: 'Favorite' },
      { id: 'promptBatchDeleteBtn', text: '批量删除', className: 'btn btn-sm btn-danger', action: 'Delete' },
      { id: 'promptBatchCancelBtn', text: '取消选择', className: 'btn btn-sm btn-secondary', action: 'Cancel' }
    ],
    // 操作配置 - 定义每个批量操作的具体实现
    operations: {
      delete: {
        api: 'softDeletePrompt',
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
        api: 'updatePrompt',
        event: 'promptFavoriteChanged',
        processItems: async (ids: string[], _input: null, _api: string) => {
          for (const id of ids) {
            const prompt = await window.electronAPI.getPromptById(id);
            if (!prompt) continue;
            // 切换收藏状态
            const newFavoriteStatus = (prompt as { isFavorite?: number }).isFavorite ? 0 : 1;
            await window.electronAPI.updatePrompt(id, { isFavorite: newFavoriteStatus });
          }
        },
        successMsg: (count: number) => `${count} 个提示词已切换收藏状态`,
        errorMsg: '批量收藏失败'
      }
    }
  },
  image: {
    toolbarId: 'imageBatchToolbar',
    actionsId: 'imageBatchToolbarActions',
    countId: 'imageBatchSelectedCount',
    selectAllCheckboxId: 'imageBatchSelectAllCheckbox',
    label: '图像',
    itemType: 'image',
    buttons: [
      { id: 'imageBatchInvertBtn', text: '反选', className: 'btn btn-sm btn-secondary', action: 'Invert' },
      { id: 'imageBatchAddTagBtn', text: '批量添加标签', className: 'btn btn-sm btn-primary', action: 'AddTag' },
      { id: 'imageBatchFavoriteBtn', text: '批量收藏', className: 'btn btn-sm btn-primary', action: 'Favorite' },
      { id: 'imageBatchDeleteBtn', text: '批量删除', className: 'btn btn-sm btn-danger', action: 'Delete' },
      { id: 'imageBatchCancelBtn', text: '取消选择', className: 'btn btn-sm btn-secondary', action: 'Cancel' }
    ],
    // 操作配置
    operations: {
      delete: {
        api: 'softDeleteImage',
        cacheDelete: (cacheManager: CacheManager) => cacheManager.getImageCache(),
        event: 'imagesDeleted',
        confirm: true,
        clearSelection: true,
        reloadData: true,
        successMsg: (count: number) => `${count} 张图像已删除`,
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
        successMsg: (count: number) => `${count} 张图像已添加标签`,
        errorMsg: '批量添加标签失败'
      },
      favorite: {
        api: 'updateImage',
        event: 'imageFavoriteChanged',
        processItems: async (ids: string[], _input: null, _api: string) => {
          for (const id of ids) {
            const image = await window.electronAPI.getImageById(id);
            if (!image) continue;
            // 切换收藏状态
            const newFavoriteStatus = (image as { isFavorite?: number }).isFavorite ? 0 : 1;
            await window.electronAPI.updateImage(id, { isFavorite: newFavoriteStatus });
          }
        },
        successMsg: (count: number) => `${count} 张图像已切换收藏状态`,
        errorMsg: '批量收藏失败'
      }
    }
  }
};

export default BatchConfig;
