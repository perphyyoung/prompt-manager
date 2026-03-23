/**
 * 工具类统一导出
 * 集中管理所有通用工具类
 */

// ========== 缓存相关 ==========
export { CacheManager, cacheManager } from './CacheManager.js';
export { LRUCache } from './LRUCache.js';

// ========== 事件总线 ==========
export { default as EventBus } from './EventBus.js';

// ========== HTML 工具 ==========
export { HtmlUtils } from './HtmlUtils.js';

// ========== 列表导航 ==========
export { ListNavigator } from './ListNavigator.js';

// ========== 文本验证工具 ==========
export {
  validateNotEmpty,
  validateNotDuplicate,
  validateLength,
  validateNoInvalidChars,
  combineValidators,
  validateFileName,
  validateTitle
} from './TextUtils.js';

// ========== 时间工具 ==========
export {
  localTime,
  getFormattedLocalTimeToSecond,
  getFormattedLocalDate,
  getFormattedYearMonth
} from './TimeUtils.js';
export { default as TimeUtils } from './TimeUtils.js';

// ========== ID 生成器 ==========
export { generatePromptId, generateImageId } from './idGenerator.js';

// ========== ID 比较工具 ==========
export { isSameId } from './isSameId.js';
