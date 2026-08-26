/**
 * 渲染进程统一日志封装
 *
 * 签名与主进程 logger 一致：(component, message, data?)
 * 委托给主进程 electron-log（经 preload 转发）统一写入项目根目录 pm.log；
 * electronAPI 不可用（如纯单元测试环境）时回退 console，避免测试输出丢失。
 * 规范参见 .trae/skills/py-pm-log/SKILL.md
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, component: string, message: string, data?: unknown): void {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;

  const methodName = level === 'debug' ? 'logDebug'
    : level === 'info' ? 'logInfo'
    : level === 'warn' ? 'logWarn'
    : 'logError';
  const method = api?.[methodName];

  if (typeof method === 'function') {
    method(component, message, data);
    return;
  }

  // 回退：electronAPI 缺失或缺少对应日志方法的环境（vitest 等）
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${component}] ${message}`, data !== undefined ? data : '');
}

export const logger = {
  debug: (component: string, message: string, data?: unknown) => emit('debug', component, message, data),
  info: (component: string, message: string, data?: unknown) => emit('info', component, message, data),
  warn: (component: string, message: string, data?: unknown) => emit('warn', component, message, data),
  error: (component: string, message: string, data?: unknown) => emit('error', component, message, data)
};
