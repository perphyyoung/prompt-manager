/**
 * Vitest 测试设置文件
 * 全局测试配置和模拟
 */

import { vi } from 'vitest';

// 模拟 window.electronAPI
global.window = {
  electronAPI: {
    logDebug: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    syncPromptTagsToImage: vi.fn(),
    syncImageTagsToPrompt: vi.fn()
  }
};

// 模拟 console 方法以避免测试输出噪音
global.console = {
  ...console,
  debug: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
