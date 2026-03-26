/**
 * 标签同步 IPC 服务
 * 封装标签同步相关的 IPC 调用
 */

import type { SyncResult } from './TagSyncApi.js';

/**
 * 扩展 Window 接口以包含 electronAPI
 */
declare global {
  interface Window {
    electronAPI: {
      syncPromptTagsToImage(): Promise<SyncResult>;
      syncImageTagsToPrompt(): Promise<SyncResult>;
    };
  }
}

/**
 * 标签同步 IPC 服务类
 * 封装标签同步相关的 IPC 调用
 */
export class TagSyncIpcService {
  /**
   * 同步提示词标签到图像标签
   * @returns {Promise<SyncResult>} 导入数量和跳过数量
   */
  static async syncPromptTagsToImage(): Promise<SyncResult> {
    try {
      const result = await window.electronAPI.syncPromptTagsToImage();
      return result;
    } catch (error) {
      console.error('Sync prompt tags to image error:', error);
      throw error;
    }
  }

  /**
   * 同步图像标签到提示词标签
   * @returns {Promise<SyncResult>} 导入数量和跳过数量
   */
  static async syncImageTagsToPrompt(): Promise<SyncResult> {
    try {
      const result = await window.electronAPI.syncImageTagsToPrompt();
      return result;
    } catch (error) {
      console.error('Sync image tags to prompt error:', error);
      throw error;
    }
  }
}
