import { DataClearApi } from './DataClearApi.ts';

/**
 * 模拟的数据清空 API
 * 用于单元测试，不实际清空数据
 */
export class MockDataClearApi extends DataClearApi {
  /**
   * 清空所有数据（模拟实现）
   * @returns 模拟的旧数据目录路径
   */
  async clearAllData(): Promise<string> {
    console.log('[MockDataClearApi] 模拟清空数据');
    return 'mock-old-data-dir';
  }
}
