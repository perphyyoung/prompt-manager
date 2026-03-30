import { vi } from 'vitest';

export const createMockPanelManager = (options = {}) => ({
  selectedIds: new Set(options.selectedIds || []),
  app: {
    showToast: vi.fn()
  },
  renderView: vi.fn(),
  toolbarController: {
    updateUI: vi.fn(),
    exitBatchMode: vi.fn()
  },
  loadData: vi.fn().mockResolvedValue(),
  batchInvert: vi.fn(),
  batchCancel: vi.fn(),
  ...options
});

export const createMockEventBus = () => ({
  emit: vi.fn()
});
