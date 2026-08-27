import { DataClearApi } from "./DataClearApi.ts";
import { DataClearIpcService } from "./DataClearIpcService.ts";

/**
 * Electron IPC 实现的数据清空 API
 * 继承 DataClearApi 接口，使用 DataClearIpcService 进行 IPC 通信
 */
export class ElectronDataClearApi extends DataClearApi {
  /**
   * 清空所有数据并重命名当前数据目录
   * @returns 旧数据目录路径
   */
  async clearAllData(): Promise<string> {
    return DataClearIpcService.clearAllData();
  }
}
