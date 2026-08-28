import { localTime } from "../../../utils/index.ts";
import { Constants, Events } from "../../constants.ts";
import type { CacheUpdateData, TrashItem } from "./TrashTypes.ts";

/**
 * 图像回收站处理器
 * 封装图像回收站的所有差异逻辑
 */
export class ImageTrashHandler {
  readonly type: string = Constants.TrashType.IMAGE;
  readonly containerId: string = Constants.Ids.IMAGE_TRASH_LIST;
  readonly label: string = "图像";
  readonly eventName: string = Events.IMAGES_CHANGED;

  // ========== API 操作 ==========

  async loadItems(): Promise<TrashItem[]> {
    return window.electronAPI.getImageTrash();
  }

  async restoreItem(itemId: string): Promise<void> {
    return window.electronAPI.restoreImageFromTrash(itemId);
  }

  async restoreAllItems(): Promise<void> {
    return window.electronAPI.restoreAllImages();
  }

  async deleteItem(itemId: string): Promise<void> {
    await window.electronAPI.permanentDeleteImage(itemId);
  }

  async clearAllItems(): Promise<void> {
    return window.electronAPI.emptyImageTrash();
  }

  // ========== 数据转换 ==========

  getThumbnailPath(item: { thumbnailPath?: string; relativePath?: string }): string | null {
    return item.thumbnailPath || item.relativePath || null;
  }

  // ========== 缓存更新 ==========

  getCacheUpdateData(): CacheUpdateData {
    return {
      isDeleted: 0,
      deletedAt: null,
      updatedAt: localTime(),
    };
  }

  // ========== 面板管理 ==========

  getMainPanelManager(app: { imagePanelManager: unknown }): unknown {
    return app.imagePanelManager;
  }
}
