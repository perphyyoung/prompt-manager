/**
 * 数据清空 IPC 服务类
 * 封装清空数据的 IPC 调用，提供统一的错误处理和日志记录
 */
export class DataClearIpcService {
  /**
   * 清空所有数据并重命名当前数据目录
   * @returns 旧数据目录路径
   */
  static async clearAllData(): Promise<string> {
    try {
      const result = await window.electronAPI.clearAllData();
      console.log('[DataClearIpcService] 清空数据成功');
      return result;
    } catch (error) {
      console.error('[DataClearIpcService] 清空数据失败:', error);
      throw error;
    }
  }
}
