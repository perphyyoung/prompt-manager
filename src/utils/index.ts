/**
 * 工具类统一导出
 * 集中管理所有通用工具类
 */

// ========== 缓存相关 ==========
export { CacheManager, cacheManager } from './CacheManager.ts';
export { LRUCache } from './LRUCache.ts';

// ========== 事件总线 ==========
export { default as EventBus } from './EventBus.ts';

// ========== HTML 工具 ==========
export { HtmlUtils } from './HtmlUtils.ts';

// ========== 列表导航 ==========
export { ListNavigator } from './ListNavigator.ts';

// ========== 文本验证工具 ==========
export {
  validateNotEmpty,
  validateNotDuplicate,
  validateLength,
  validateNoInvalidChars,
  combineValidators,
  validateFileName,
  validateTitle
} from './TextUtils.ts';

// ========== 时间工具 ==========
export {
  localTime,
  getFormattedLocalTimeToSecond,
  getFormattedLocalDate,
  getFormattedYearMonth
} from './TimeUtils.ts';
export { default as TimeUtils } from './TimeUtils.ts';

// ========== ID 生成器 ==========
export { generatePromptId, generateImageId } from './idGenerator.ts';

// ========== 防重复提交工具 ==========
export {
  withDuplicatePrevention,
  wrapWithDuplicatePrevention,
  createDuplicatePreventionExecutor,
  DuplicatePreventionMixin,
  type IDuplicatePrevention
} from './DuplicatePrevention.ts';

// ========== LocalStorage 管理器 ==========
export {
  LocalStorageManager,
  localStorageManager,
  type ConfigItem
} from './LocalStorageManager.ts';

// ========== 搜索工具 ==========
export { searchMatches } from './SearchUtils.ts';
