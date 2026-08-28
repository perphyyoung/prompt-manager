/**
 * batch-toolbar 库 批量工具栏库
 * 配置和类型定义库
 *
 * 使用示例：
 * ```typescript
 * import { getPresetConfig } from './lib/batch-toolbar';
 *
 * const config = getPresetConfig('promptMain');
 * ```
 */

// 类型定义
export type {
  ToolbarContext,
  DataType,
  ToolbarButtonConfig,
  BatchToolbarConfig,
  ButtonClickEvent,
  ToolbarState,
  BatchToolbarOptions,
  CreateToolbarOptions,
} from "./types.ts";

// 预设配置
export {
  PROMPT_MAIN_BATCH_TOOLBAR,
  IMAGE_MAIN_BATCH_TOOLBAR,
  PRESET_CONFIGS,
  getPresetConfig,
  getAllPresetConfigs,
} from "./presets.ts";

// 工具函数
export {
  sortButtons,
  mergeButtonConfigs,
  filterVisibleButtons,
  generateToolbarId,
  isValidContext,
} from "./utils.ts";
