import { localTime } from '../../../utils/index.ts';
import { Constants } from '../../../constants.ts';
import type { CacheUpdateData, TrashItem } from './TrashHandler.ts';

/**
 * 提示词回收站处理器
 * 封装提示词回收站的所有差异逻辑
 */
export class PromptTrashHandler {
  readonly type: string = Constants.TrashType.PROMPT;
  readonly containerId: string = 'promptTrashList';
  readonly label: string = '提示词';
  readonly eventName: string = 'promptsChanged';

  // ========== API 操作 ==========

  async loadItems(): Promise<TrashItem[]> {
    return window.electronAPI.getPromptTrash();
  }

  async restoreItem(itemId: string): Promise<void> {
    return window.electronAPI.restorePromptFromTrash(itemId);
  }

  async restoreAllItems(): Promise<void> {
    return window.electronAPI.restoreAllPrompts();
  }

  async deleteItem(itemId: string): Promise<void> {
    return window.electronAPI.permanentDeletePrompt(itemId);
  }

  async clearAllItems(): Promise<void> {
    return window.electronAPI.emptyPromptTrash();
  }

  // ========== 数据转换 ==========

  getThumbnailPath(item: { images?: Array<{ thumbnailPath?: string }> }): string | null {
    return item.images?.[0]?.thumbnailPath || null;
  }

  // ========== 缓存更新 ==========

  getCacheUpdateData(): CacheUpdateData {
    return {
      isDeleted: 0,
      deletedAt: null,
      updatedAt: localTime()
    };
  }

  // ========== 面板管理 ==========

  getMainPanelManager(app: { promptPanelManager: unknown }): unknown {
    return app.promptPanelManager;
  }
}
