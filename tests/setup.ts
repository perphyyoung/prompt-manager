/**
 * Vitest 测试设置文件
 * 全局测试配置和模拟
 */

import { vi, MockedFunction } from 'vitest';
import { IElectronAPI } from '../src/preload/index';

type MockedElectronAPI = {
  [K in keyof IElectronAPI]: IElectronAPI[K] extends (...args: infer A) => infer R
    ? MockedFunction<(...args: A) => R>
    : IElectronAPI[K];
};

// 扩展 IElectronAPI 接口以包含测试用的额外方法
interface IExtendedElectronAPI extends MockedElectronAPI {
  syncPromptTagsToImage: MockedFunction<() => void>;
  syncImageTagsToPrompt: MockedFunction<() => void>;
}

// 设置全局 window 对象
Object.defineProperty(global, 'window', {
  value: {
    electronAPI: {
      logDebug: vi.fn(),
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
      syncPromptTagsToImage: vi.fn(),
      syncImageTagsToPrompt: vi.fn()
    } as unknown as IExtendedElectronAPI,
    setTimeout: (fn: TimerHandler, delay?: number): number => global.setTimeout(fn, delay),
    clearTimeout: (id: number | undefined): void => global.clearTimeout(id),
    requestAnimationFrame: (callback: FrameRequestCallback): number => global.setTimeout(callback, 16),
    cancelAnimationFrame: (handle: number): void => global.clearTimeout(handle)
  },
  writable: true,
  configurable: true
});

// 模拟 console 方法以避免测试输出噪音
global.console = {
  ...console,
  debug: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
