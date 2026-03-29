/**
 * 日志模块 - 基于 electron-log
 * 日志统一存储在 rootDir 下的 pm.log
 */

import log from 'electron-log';
import path from 'path';

// 日志文件路径（由 initLogger 设置）
let logFilePath: string;

// 配置日志级别
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// 配置日志文件大小限制（超过后自动轮转）
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB

// 自定义日志格式
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{processType}] [{component}] {text}';
log.transports.console.format = '[{h}:{i}:{s}] [{level}] [{component}] {text}';

/**
 * 初始化日志系统
 * @param rootDir - 应用根目录
 */
export function initLogger(rootDir: string): void {
  logFilePath = path.join(rootDir, 'pm.log');
  log.transports.file.resolvePathFn = () => logFilePath;
  
  // 注册全局异常处理器
  registerExceptionHandlers();
}

/**
 * 获取日志文件路径
 * @returns 日志文件路径
 * @throws 如果日志系统未初始化
 */
export function getLogPath(): string {
  if (!logFilePath) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return logFilePath;
}

/**
 * 序列化数据
 * @param data - 要序列化的数据
 * @returns 序列化后的字符串
 */
function serializeData(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (data instanceof Error) {
    return JSON.stringify({ message: data.message, name: data.name, stack: data.stack }, null, 2);
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch (err) {
    return `[Unable to serialize: ${(err as Error).message}]`;
  }
}

/**
 * 输出信息日志
 * @param component - 组件名
 * @param message - 日志消息
 * @param data - 附加数据
 */
export function logInfo(component: string, message: string, data?: unknown): void {
  const dataStr = data ? `\nData: ${serializeData(data)}` : '';
  log.info(`[${component}] ${message}${dataStr}`);
}

/**
 * 输出调试日志
 * @param component - 组件名
 * @param message - 日志消息
 * @param data - 附加数据
 */
export function logDebug(component: string, message: string, data?: unknown): void {
  const dataStr = data ? `\nData: ${serializeData(data)}` : '';
  log.debug(`[${component}] ${message}${dataStr}`);
}

/**
 * 输出警告日志
 * @param component - 组件名
 * @param message - 日志消息
 * @param data - 附加数据
 */
export function logWarn(component: string, message: string, data?: unknown): void {
  const dataStr = data ? `\nData: ${serializeData(data)}` : '';
  log.warn(`[${component}] ${message}${dataStr}`);
}

/**
 * 输出错误日志
 * @param component - 组件名
 * @param message - 日志消息
 * @param error - 错误对象
 */
export function logError(component: string, message: string, error?: unknown): void {
  let errorStr = '';

  if (error instanceof Error) {
    errorStr = `\nError: ${error.name}: ${error.message}\nStack: ${error.stack}`;
  } else if (error && typeof error === 'object') {
    errorStr = `\nError: ${serializeData(error)}`;
  } else if (error !== undefined) {
    errorStr = `\nError: ${String(error)}`;
  }

  log.error(`[${component}] ${message}${errorStr}`);
}

// 异常处理器标志，防止重复注册
let exceptionHandlersRegistered = false;

/**
 * 注册全局异常处理器
 */
function registerExceptionHandlers(): void {
  if (exceptionHandlersRegistered) return;
  
  process.on('uncaughtException', (error) => {
    logError('Main', 'Uncaught Exception', error);
  });
  
  process.on('unhandledRejection', (reason) => {
    logError('Main', 'Unhandled Rejection', reason);
  });
  
  exceptionHandlersRegistered = true;
}

export default {
  logInfo,
  logDebug,
  logWarn,
  logError,
  getLogPath,
  initLogger
};
