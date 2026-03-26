import { TagSyncApi, type SyncResult } from './TagSyncApi.js';
import { TagSyncIpcService } from './TagSyncIpcService.js';

/**
 * Electron 标签同步 API 实现
 * 使用 IPC 服务与主进程通信
 */
export class ElectronTagSyncApi extends TagSyncApi {
  /**
   * 同步提示词标签到图像标签
   * @returns {Promise<SyncResult>} 同步结果
   */
  async syncPromptTagsToImage(): Promise<SyncResult> {
    return await TagSyncIpcService.syncPromptTagsToImage();
  }

  /**
   * 同步图像标签到提示词标签
   * @returns {Promise<SyncResult>} 同步结果
   */
  async syncImageTagsToPrompt(): Promise<SyncResult> {
    return await TagSyncIpcService.syncImageTagsToPrompt();
  }
}
