/**
 * 日志模块
 * 统一输出到控制台和 debug.log
 */

import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { TimeUtils } from './utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 调试日志文件路径
const DEBUG_LOG_FILE = path.join(__dirname, 'debug.log');

// 日志文件写入队列
let logQueue = [];
let isWriting = false;

/**
 * 异步写入日志到文件
 */
async function writeLogToFile(message) {
  logQueue.push(message);
  if (isWriting) return;

  isWriting = true;
  while (logQueue.length > 0) {
    const msg = logQueue.shift();
    try {
      await fs.appendFile(DEBUG_LOG_FILE, msg + '\n');
    } catch (err) {
      console.error('Failed to write to debug.log:', err);
    }
  }
  isWriting = false;
}

/**
 * 获取详细的错误堆栈
 * @param {Error} error - 错误对象
 * @param {number} skipFrames - 跳过的帧数
 * @returns {Object} 包含 message 和 stack 的对象
 */
function getDetailedStackTrace(error, skipFrames = 2) {
  const stack = error?.stack || new Error().stack;
  if (!stack) return { message: '', stack: '' };

  const lines = stack.split('\n');
  const errorMessage = lines[0]?.replace(/^Error:\s*/, '') || '';
  const relevantLines = lines.slice(skipFrames);

  const formattedStack = relevantLines
    .filter(line => line.includes('file:///'))
    .slice(0, 10)
    .map((line, index) => {
      const match = line.match(/at\s+(?:(.+?)\s+\()?file:\/\/.+?\/(.+?):(\d+):(\d+)\)?/);
      if (match) {
        const [, funcName, filePath, lineNum, colNum] = match;
        const shortPath = filePath.replace(/^.*[\\\/]/, '');
        const arrow = index === 0 ? '👉 ' : '   ';
        return `${arrow}at ${funcName || '<anonymous>'} (${shortPath}:${lineNum}:${colNum})`;
      }
      return '   ' + line.trim();
    })
    .join('\n');

  return {
    message: errorMessage,
    stack: formattedStack ? '\n  Stack:\n' + formattedStack : ''
  };
}

/**
 * 序列化数据
 * @param {*} data - 要序列化的数据
 * @returns {string} 序列化后的字符串
 */
function serializeData(data) {
  if (data === null || data === undefined) return '';
  if (data instanceof Error) {
    return JSON.stringify({ message: data.message, name: data.name }, null, 2);
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch (err) {
    return `[Unable to serialize: ${err.message}]`;
  }
}

/**
 * 输出日志
 * @param {string} level - 日志级别
 * @param {string} component - 组件名
 * @param {string} message - 日志消息
 * @param {Object} data - 附加数据
 * @param {boolean} includeStack - 是否包含堆栈
 * @param {Error} error - 错误对象
 */
function log(level, component, message, data = null, includeStack = false, error = null) {
  const timestamp = TimeUtils.localTime();
  const dataStr = data ? '\n  Data: ' + serializeData(data) : '';

  let stackStr = '';
  if (includeStack || error) {
    const detailedStack = getDetailedStackTrace(error);
    stackStr = detailedStack.stack;
  }

  const logEntry = `[${timestamp}] [${level}] [${component}] ${message}${dataStr}${stackStr}`;

  // 输出到控制台
  const consoleMethod = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  consoleMethod(logEntry);

  // 写入到 debug.log
  writeLogToFile(logEntry);
}

export function logInfo(component, message, data) {
  log('INFO', component, message, data);
}

export function logDebug(component, message, data) {
  log('DEBUG', component, message, data);
}

export function logError(component, message, error) {
  const isErrorObject = error instanceof Error;
  const data = isErrorObject ? { message: error.message, name: error.name } : error;
  log('ERROR', component, message, data, true, isErrorObject ? error : null);
}

export function logWarn(component, message, data) {
  log('WARN', component, message, data, true);
}

export default {
  logInfo,
  logDebug,
  logError,
  logWarn
};
