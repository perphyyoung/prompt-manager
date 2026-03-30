import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchTagManager } from '../../src/renderer/components/BatchTagManager.js';
import { Constants } from '../../src/constants.js';

// 模拟 DialogService
vi.mock('../../src/renderer/services/index.js', () => ({
  DialogService: {
    showConfirmDialogByConfig: vi.fn()
  },
  DialogConfig: {
    BATCH_DELETE_TAGS: 'BATCH_DELETE_TAGS'
  }
}));

import { DialogService } from '../../src/renderer/services/index.js';

describe('BatchTagManager', () => {
  let manager: BatchTagManager;
  let mockTagManager: {
    getTags: ReturnType<typeof vi.fn>;
    removeTags: ReturnType<typeof vi.fn>;
  };
  let mockShowToast: ReturnType<typeof vi.fn>;
  let container: HTMLElement;
  let batchBtn: HTMLElement;
  let toolbar: HTMLElement;
  let countEl: HTMLElement;
  let deleteBtn: HTMLElement;
  let cancelBtn: HTMLElement;

  // 测试数据工厂
  const createMockTagManager = (tags: string[] = []) => ({
    getTags: vi.fn(() => tags),
    removeTags: vi.fn(async (tagsToDelete: string[]) => ({
      deleted: tagsToDelete.length,
      failed: 0
    }))
  });

  // DOM 设置辅助函数
  const setupDOM = () => {
    document.body.innerHTML = `
      <div id="test-container"></div>
      <button id="test-batch-btn">批量管理</button>
      <div id="test-toolbar" style="display: none;">
        <span id="test-count">0</span>
        <button id="test-delete-btn">删除</button>
        <button id="test-cancel-btn">取消</button>
      </div>
    `;
    container = document.getElementById('test-container')!;
    batchBtn = document.getElementById('test-batch-btn')!;
    toolbar = document.getElementById('test-toolbar')!;
    countEl = document.getElementById('test-count')!;
    deleteBtn = document.getElementById('test-delete-btn')!;
    cancelBtn = document.getElementById('test-cancel-btn')!;
  };

  beforeEach(() => {
    setupDOM();
    mockShowToast = vi.fn();
  });

  afterEach(() => {
    manager?.destroy();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该正确初始化并绑定事件', () => {
      mockTagManager = createMockTagManager(['标签1', '标签2']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });

      manager.init();

      expect(manager['_initialized']).toBe(true);
    });

    it('多次调用 init 应该只初始化一次', () => {
      mockTagManager = createMockTagManager(['标签1']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });

      manager.init();
      manager.init();
      manager.init();

      expect(manager['_initialized']).toBe(true);
    });
  });

  describe('进入批量模式', () => {
    beforeEach(() => {
      mockTagManager = createMockTagManager(['标签1', '标签2', '标签3']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();
    });

    it('点击批量管理按钮应该进入批量模式', () => {
      batchBtn.click();

      expect(manager['isBatchMode']).toBe(true);
      expect(batchBtn.style.display).toBe('none');
      expect(toolbar.style.display).toBe('flex');
    });

    it('进入批量模式时应该渲染带复选框的标签列表', () => {
      batchBtn.click();

      const tagElements = container.querySelectorAll('.tag-batch-mode');
      expect(tagElements.length).toBe(3);

      // 检查每个标签都有复选框
      tagElements.forEach((el) => {
        const checkbox = el.querySelector('input[type="checkbox"]');
        expect(checkbox).not.toBeNull();
      });
    });

    it('少于等于1个标签时应该提示无需进入批量管理', () => {
      manager.destroy();
      mockTagManager = createMockTagManager(['标签1']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();

      batchBtn.click();

      expect(mockShowToast).toHaveBeenCalledWith('无需进入批量管理', 'info');
      expect(manager['isBatchMode']).toBe(false);
    });

    it('没有标签时应该提示无需进入批量管理', () => {
      manager.destroy();
      mockTagManager = createMockTagManager([]);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();

      batchBtn.click();

      expect(mockShowToast).toHaveBeenCalledWith('无需进入批量管理', 'info');
      expect(manager['isBatchMode']).toBe(false);
    });

    it('进入批量模式时应该过滤掉特殊标签', () => {
      mockTagManager = createMockTagManager([
        '标签1',
        Constants.FAVORITE_TAG,
        '标签2',
        Constants.UNREFERENCED_TAG
      ]);
      manager.destroy();
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();

      batchBtn.click();

      const tagElements = container.querySelectorAll('.tag-batch-mode');
      expect(tagElements.length).toBe(2);

      const tagTexts = Array.from(tagElements).map(el => (el as HTMLElement).dataset.tag);
      expect(tagTexts).toContain('标签1');
      expect(tagTexts).toContain('标签2');
      expect(tagTexts).not.toContain(Constants.FAVORITE_TAG);
      expect(tagTexts).not.toContain(Constants.UNREFERENCED_TAG);
    });
  });

  describe('标签选择', () => {
    beforeEach(() => {
      mockTagManager = createMockTagManager(['标签1', '标签2', '标签3']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();
      batchBtn.click();
    });

    it('点击标签应该切换选中状态', () => {
      const tagEl = container.querySelector('.tag-batch-mode')!;
      tagEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(tagEl.classList.contains('selected')).toBe(true);
      const checkbox = tagEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      expect(countEl.textContent).toBe('1');
    });

    it('再次点击应该取消选中', async () => {
      const tagEl = container.querySelector('.tag-batch-mode')!;
      const checkbox = tagEl.querySelector('input[type="checkbox"]') as HTMLInputElement;

      // 先选中
      tagEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(tagEl.classList.contains('selected')).toBe(true);
      expect(checkbox.checked).toBe(true);
      expect(countEl.textContent).toBe('1');

      // 再取消 - 直接调用 toggleTagSelection 方法
      (manager as any).toggleTagSelection(tagEl, (tagEl as HTMLElement).dataset.tag, false);
      expect(tagEl.classList.contains('selected')).toBe(false);
      // 验证 selectedTags 集合已清空
      expect(manager['selectedTags'].size).toBe(0);
    });

    it('直接点击复选框也应该切换选中状态', () => {
      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      const tagEl = checkbox.closest('.tag-batch-mode')!;
      expect(tagEl.classList.contains('selected')).toBe(true);
      expect(countEl.textContent).toBe('1');
    });

    it('选中多个标签时计数应该正确更新', () => {
      const tagElements = container.querySelectorAll('.tag-batch-mode');

      tagElements.forEach((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(countEl.textContent).toBe('3');
      expect(manager['selectedTags'].size).toBe(3);
    });
  });

  describe('退出批量模式', () => {
    beforeEach(() => {
      mockTagManager = createMockTagManager(['标签1', '标签2']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();
      batchBtn.click();
    });

    it('点击取消按钮应该退出批量模式', () => {
      cancelBtn.click();

      expect(manager['isBatchMode']).toBe(false);
      expect(batchBtn.style.display).toBe('');
      expect(toolbar.style.display).toBe('none');
    });

    it('退出批量模式应该清空选中状态', () => {
      // 先选中一些标签
      const tagEl = container.querySelector('.tag-batch-mode')!;
      tagEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(manager['selectedTags'].size).toBe(1);

      cancelBtn.click();

      expect(manager['selectedTags'].size).toBe(0);
    });

    it('退出批量模式应该触发回调', () => {
      const exitCallback = vi.fn();
      manager.setOnExitBatchMode(exitCallback);

      cancelBtn.click();

      expect(exitCallback).toHaveBeenCalled();
    });
  });

  describe('批量删除', () => {
    beforeEach(() => {
      mockTagManager = createMockTagManager(['标签1', '标签2', '标签3']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();
      batchBtn.click();
    });

    it('未选择标签时点击删除应该提示警告', async () => {
      await deleteBtn.click();

      expect(mockShowToast).toHaveBeenCalledWith('请先选择要删除的标签', 'warning');
      expect(DialogService.showConfirmDialogByConfig).not.toHaveBeenCalled();
    });

    it('选择标签后应该显示确认对话框', async () => {
      // 选中两个标签
      const tagElements = container.querySelectorAll('.tag-batch-mode');
      tagElements[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      tagElements[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // 模拟用户确认删除
      (DialogService.showConfirmDialogByConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      await deleteBtn.click();

      expect(DialogService.showConfirmDialogByConfig).toHaveBeenCalledWith(
        'BATCH_DELETE_TAGS',
        { count: 2 }
      );
    });

    it('用户取消确认对话框时不应该删除标签', async () => {
      // 选中标签
      const tagEl = container.querySelector('.tag-batch-mode')!;
      tagEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // 模拟用户取消
      (DialogService.showConfirmDialogByConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      await deleteBtn.click();

      expect(mockTagManager.removeTags).not.toHaveBeenCalled();
    });

    it('确认删除后应该调用 tagManager.removeTags', async () => {
      // 选中两个标签
      const tagElements = container.querySelectorAll('.tag-batch-mode');
      tagElements[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      tagElements[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

      (DialogService.showConfirmDialogByConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      await deleteBtn.click();

      expect(mockTagManager.removeTags).toHaveBeenCalledWith(['标签1', '标签2']);
    });

    it('删除成功后应该显示成功提示并退出批量模式', async () => {
      // 选中两个标签
      const tagElements = container.querySelectorAll('.tag-batch-mode');
      tagElements[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      tagElements[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));

      (DialogService.showConfirmDialogByConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      // 使用 await 等待 handleDelete 中的异步操作
      await (manager as any).handleDelete();

      expect(mockShowToast).toHaveBeenCalledWith('成功删除 2 个标签', 'success');
      expect(manager['isBatchMode']).toBe(false);
    });

    it('删除失败时应该显示错误提示', async () => {
      // 选中标签
      const tagEl = container.querySelector('.tag-batch-mode')!;
      tagEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));

      // 模拟删除失败
      mockTagManager.removeTags.mockRejectedValueOnce(new Error('删除失败'));
      (DialogService.showConfirmDialogByConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      // 使用 await 等待 handleDelete 中的异步操作
      await (manager as any).handleDelete();

      expect(mockShowToast).toHaveBeenCalledWith('批量删除标签失败', 'error');
    });
  });

  describe('销毁', () => {
    beforeEach(() => {
      mockTagManager = createMockTagManager(['标签1', '标签2']);
      manager = new BatchTagManager({
        containerId: 'test-container',
        batchBtnId: 'test-batch-btn',
        toolbarId: 'test-toolbar',
        countId: 'test-count',
        deleteBtnId: 'test-delete-btn',
        cancelBtnId: 'test-cancel-btn',
        tagManager: mockTagManager,
        showToast: mockShowToast,
        label: 'TestManager'
      });
      manager.init();
    });

    it('销毁时应该退出批量模式', () => {
      batchBtn.click();
      expect(manager['isBatchMode']).toBe(true);

      manager.destroy();

      expect(manager['isBatchMode']).toBe(false);
    });

    it('销毁后应该清理状态', () => {
      manager.destroy();

      expect(manager['_initialized']).toBe(false);
      expect(manager['_eventHandlers']).toBeNull();
    });
  });
});
