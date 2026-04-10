import { vi, MockedFunction } from 'vitest';

interface IPanelManagerOptions {
  selectedIds?: string[];
  [key: string]: unknown;
}

interface IPanelManager {
  selectedIds: Set<string>;
  app: {
    showToast: MockedFunction<(message: string) => void>;
  };
  renderView: MockedFunction<() => void>;
  toolbarController: {
    updateUI: MockedFunction<() => void>;
    exitBatchMode: MockedFunction<() => void>;
  };
  loadData: MockedFunction<() => Promise<void>>;
  batchInvert: MockedFunction<() => void>;
  batchCancel: MockedFunction<() => void>;
  [key: string]: unknown;
}

interface IEventBus {
  emit: MockedFunction<(event: string, ...args: unknown[]) => void>;
}

export const createMockPanelManager = (options: IPanelManagerOptions = {}): IPanelManager => ({
  selectedIds: new Set(options.selectedIds ?? []),
  app: {
    showToast: vi.fn()
  },
  renderView: vi.fn(),
  toolbarController: {
    updateUI: vi.fn(),
    exitBatchMode: vi.fn()
  },
  loadData: vi.fn().mockResolvedValue(undefined),
  batchInvert: vi.fn(),
  batchCancel: vi.fn(),
  ...(options as Omit<IPanelManagerOptions, 'selectedIds'>)
});

export const createMockEventBus = (): IEventBus => ({
  emit: vi.fn()
});
