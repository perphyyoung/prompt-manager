/**
 * 标签同步 API 接口定义
 * 用于依赖注入，支持不同的实现（Electron 实现、Mock 实现等）
 */

/**
 * 同步结果接口
 */
export interface SyncResult {
  /** 成功导入的标签数量 */
  imported: number;
  /** 跳过的标签数量（已存在） */
  skipped: number;
}

/**
 * 标签同步 API 接口
 * 用于依赖注入，支持不同的实现（Electron 实现、Mock 实现等）
 */
export abstract class TagSyncApi {
  /**
   * 同步提示词标签到图像标签
   * @returns {Promise<SyncResult>} 同步结果
   */
  abstract syncPromptTagsToImage(): Promise<SyncResult>;

  /**
   * 同步图像标签到提示词标签
   * @returns {Promise<SyncResult>} 同步结果
   */
  abstract syncImageTagsToPrompt(): Promise<SyncResult>;
}
