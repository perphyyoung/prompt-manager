// Dialog 服务
export { DialogService, DialogConfig } from './DialogService.ts';
export type { IDialogTemplate, IDialogContext } from '../../types/entities.ts';

// 上传相关服务
export { ImageUploadService } from './ImageUploadService.ts';
export { UploadNotificationService } from './UploadNotificationService.ts';
export {
  UploadStrategy,
  DirectSaveStrategy,
  DelaySaveStrategy
} from './UploadStrategies.ts';

// 标签自动完成服务
export { TagAutocomplete } from './TagAutocomplete.ts';

// 数据清空 API
export { DataClearApi } from './DataClearApi.ts';
export { DataClearIpcService } from './DataClearIpcService.ts';
export { ElectronDataClearApi } from './ElectronDataClearApi.ts';
export { MockDataClearApi } from './MockDataClearApi.ts';
