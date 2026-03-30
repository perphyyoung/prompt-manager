import { vi } from 'vitest';

export const createMockElectronAPI = () => ({
  softDeletePrompt: vi.fn(),
  softDeleteImage: vi.fn(),
  updatePrompt: vi.fn(),
  updateImage: vi.fn(),
  addPromptTags: vi.fn(),
  addImageTags: vi.fn(),
  getPromptById: vi.fn(),
  getImageById: vi.fn(),
  logError: vi.fn()
});

export const resetMockElectronAPI = () => {
  Object.values(window.electronAPI).forEach(fn => {
    if (typeof fn.mockClear === 'function') {
      fn.mockClear();
    }
  });
};
