import { vi, MockedFunction } from "vitest";
import { IElectronAPI } from "../../src/preload/index";

type MockedElectronAPI = {
  [K in keyof IElectronAPI]: IElectronAPI[K] extends (...args: infer A) => infer R
    ? MockedFunction<(...args: A) => R>
    : IElectronAPI[K];
};

export const createMockElectronAPI = (): Partial<MockedElectronAPI> => ({
  softDeletePrompt: vi.fn(),
  softDeleteImage: vi.fn(),
  updatePrompt: vi.fn(),
  updateImage: vi.fn(),
  addPromptTags: vi.fn(),
  addImageTags: vi.fn(),
  getPromptById: vi.fn(),
  getImageById: vi.fn(),
  logError: vi.fn(),
});

export const resetMockElectronAPI = (): void => {
  Object.values(window.electronAPI).forEach((fn) => {
    if (typeof fn === "function" && "mockClear" in fn && typeof fn.mockClear === "function") {
      fn.mockClear();
    }
  });
};
