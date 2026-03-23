/**
 * 批量操作配置
 * 统一定义提示词面板和图像面板的批量操作配置
 */
export const BatchConfig = {
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
        cacheDelete: (cacheManager) => cacheManager.getPromptCache(),
        event: 'promptsDeleted',
        confirm: true,
        clearSelection: true,
        reloadData: true,
        successMsg: (count) => `${count} 个提示词已删除`,
        errorMsg: '批量删除失败'
      },
      addTag: {
        api: 'updatePrompt',
        event: 'promptTagsChanged',
        needInput: true,
        inputTitle: '添加标签',
        inputPlaceholder: '输入要添加的标签（多个标签用逗号分隔）',
        processItems: async (ids, tagInput, api) => {
          const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
          for (const id of ids) {
            const prompt = await window.electronAPI.getPromptById(id);
            if (!prompt) continue;
            let currentTags = prompt.tags ? [...prompt.tags] : [];
            for (const tagName of tags) {
              if (!currentTags.includes(tagName)) {
                currentTags.push(tagName);
              }
            }
            await window.electronAPI.updatePrompt(id, { tags: currentTags });
          }
        },
        successMsg: (count) => `${count} 个提示词已添加标签`,
        errorMsg: '批量添加标签失败'
      },
      favorite: {
        api: 'updatePrompt',
        event: 'promptFavoriteChanged',
        processItems: async (ids, input, api) => {
          for (const id of ids) {
            const prompt = await window.electronAPI.getPromptById(id);
            if (!prompt) continue;
            // 切换收藏状态
            const newFavoriteStatus = prompt.isFavorite ? 0 : 1;
            await window.electronAPI.updatePrompt(id, { isFavorite: newFavoriteStatus });
          }
        },
        successMsg: (count) => `${count} 个提示词已切换收藏状态`,
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
        cacheDelete: (cacheManager) => cacheManager.getImageCache(),
        event: 'imagesDeleted',
        confirm: true,
        clearSelection: true,
        reloadData: true,
        successMsg: (count) => `${count} 个图像已删除`,
        errorMsg: '批量删除失败'
      },
      addTag: {
        api: 'addImageTags',
        event: 'imageTagsChanged',
        needInput: true,
        inputTitle: '添加标签',
        inputPlaceholder: '输入要添加的标签（多个标签用逗号分隔）',
        processItems: async (ids, tagInput, api) => {
          const tags = tagInput.split(',').map(t => t.trim()).filter(t => t);
          for (const id of ids) {
            await window.electronAPI[api](id, tags);
          }
        },
        successMsg: (count) => `${count} 个图像已添加标签`,
        errorMsg: '批量添加标签失败'
      },
      favorite: {
        api: 'updateImage',
        event: 'imageFavoriteChanged',
        processItems: async (ids, input, api) => {
          for (const id of ids) {
            const image = await window.electronAPI.getImageById(id);
            if (!image) continue;
            // 切换收藏状态
            const newFavoriteStatus = image.isFavorite ? 0 : 1;
            await window.electronAPI.updateImage(id, { isFavorite: newFavoriteStatus });
          }
        },
        successMsg: (count) => `${count} 个图像已切换收藏状态`,
        errorMsg: '批量收藏失败'
      }
    }
  }
};

export default BatchConfig;
