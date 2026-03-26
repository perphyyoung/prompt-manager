/**
 * 数据清空 API 接口定义
 * 定义清空数据操作的契约，用于依赖注入
 */
export class DataClearApi {
  /**
   * 清空所有数据并重命名当前数据目录
   * @returns {Promise<string>} 旧数据目录路径
   */
  async clearAllData() {
    throw new Error('未实现：clearAllData');
  }
}
