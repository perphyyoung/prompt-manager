/**
 * 快捷键管理器
 * 提供全局快捷键支持，包括编辑导航、保存等操作
 */

import { contextStack } from '../managers/ContextStackManager.ts';
import { Constants } from '../../constants.ts';
import type { IClosableElement } from '../../types/entities.ts';

interface ShortcutInfo {
  action: string;
  description: string;
}

interface ShortcutManagerOptions {
  app: {
    promptNavigator?: { navigateTo: (direction: string) => void };
    imageNavigator?: { navigateTo: (direction: string) => void };
    savePromptWithoutClosing?: () => Promise<void>;
    saveImageWithoutClosing?: () => Promise<void>;
    saveAndClosePromptDetail?: () => Promise<void>;
    saveAndCloseImageDetail?: () => Promise<void>;
    refreshData?: () => Promise<void>;
    promptPanelManager?: { viewModeType: string; renderView: () => void | Promise<void>; selectAllVisibleItems?: () => void } | null;
    imagePanelManager?: { selectAllVisibleItems?: () => void } | null;
    trashManager?: { loadTrash: () => Promise<void> } | null;
    currentPanel?: string;
  };
}

export class ShortcutManager {
  private app: ShortcutManagerOptions['app'];
  private shortcuts: Map<string, ShortcutInfo> = new Map();
  private enabled = true;
  private isBound = false;

  constructor(options: ShortcutManagerOptions) {
    this.app = options.app;
    this.initDefaultShortcuts();
  }

  /**
   * 初始化默认快捷键
   */
  initDefaultShortcuts(): void {
    // 编辑导航
    this.register('Ctrl+ArrowLeft', 'editorPrev', '上一个项目');
    this.register('Ctrl+ArrowRight', 'editorNext', '下一个项目');
    this.register('Ctrl+ArrowUp', 'editorFirst', '第一个项目');
    this.register('Ctrl+ArrowDown', 'editorLast', '最后一个项目');

    // 保存操作
    this.register('Ctrl+S', 'save', '保存');
    this.register('Ctrl+Shift+S', 'saveAndClose', '保存并关闭');

    // 搜索
    this.register('Ctrl+F', 'focusSearch', '聚焦搜索框');

    // 视图切换
    this.register('Ctrl+1', 'viewGrid', '网格视图');
    this.register('Ctrl+2', 'viewList', '列表视图');
    this.register('Ctrl+3', 'viewCompact', '紧凑视图');

    // 标签管理
    this.register('Ctrl+T', 'toggleTags', '切换标签面板');

    // 回收站
    this.register('Ctrl+Shift+Delete', 'openTrash', '打开回收站');

    // 刷新
    this.register('F5', 'refresh', '刷新数据');

    // 面板切换
    this.register('Ctrl+I', 'switchToImagePanel', '切换到图像主界面');
    this.register('Ctrl+P', 'switchToPromptPanel', '切换到提示词主界面');
  }

  /**
   * 注册快捷键
   */
  register(keyCombo: string, action: string, description = ''): void {
    this.shortcuts.set(keyCombo.toLowerCase(), { action, description });
  }

  /**
   * 注销快捷键
   */
  unregister(keyCombo: string): void {
    this.shortcuts.delete(keyCombo.toLowerCase());
  }

  /**
   * 启用快捷键
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用快捷键
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * 绑定全局键盘事件
   */
  bind(): void {
    if (this.isBound) {
      return;
    }

    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;

      // Escape 键处理 - 基于上下文堆栈
      if (e.key === 'Escape') {
        this.handleEscape(e);
        return;
      }

      // Ctrl+A 处理 - 基于上下文堆栈
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        this.handleSelectAll(e);
        return;
      }

      const keyCombo = this.getKeyCombo(e);
      const shortcut = this.shortcuts.get(keyCombo.toLowerCase());

      if (!shortcut) return;

      e.preventDefault();
      this.handleAction(shortcut.action);
    });

    this.isBound = true;
  }

  /**
   * 处理 Escape 键 - 基于上下文堆栈
   * 直接调用 DOM 元素的 close 方法
   */
  private handleEscape(e: KeyboardEvent): void {
    const id = contextStack.peekId();

    if (!id) {
      window.electronAPI.logWarn('ShortcutManager', 'No element in stack');
      return;
    }

    // 主面板不应该被 ESC 关闭，直接返回
    if (id === Constants.Ids.IMAGE_PANEL || id === Constants.Ids.PROMPT_PANEL) {
      return;
    }

    const element = document.getElementById(id) as IClosableElement;
    if (!element) {
      window.electronAPI.logError('ShortcutManager', `Element not found: ${id}`);
      return;
    }

    if (typeof element.close === 'function') {
      element.close();
      e.preventDefault();
    } else {
      window.electronAPI.logError('ShortcutManager', `No close method for: ${id}`);
    }
  }

  /**
   * 处理 Ctrl+A - 基于上下文堆栈
   * 调用 DOM 元素的 ctrla 方法，由界面自己决定是否处理
   */
  private handleSelectAll(e: KeyboardEvent): void {
    // 检查焦点是否在输入框
    const target = e.target as HTMLElement;
    if (this.isTextInputElement(target)) {
      return; // 让默认行为执行文本全选
    }

    const id = contextStack.peekId();

    if (!id) {
      return;
    }

    // 主面板或主面板的批量工具栏：全选卡片
    if (id === Constants.Ids.PROMPT_PANEL || id === Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR) {
      this.app.promptPanelManager?.selectAllVisibleItems?.();
      e.preventDefault();
      return;
    } else if (id === Constants.Ids.IMAGE_PANEL || id === Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR) {
      this.app.imagePanelManager?.selectAllVisibleItems?.();
      e.preventDefault();
      return;
    }

    // 其他界面：调用 ctrla 方法，由界面自己决定是否处理
    const element = document.getElementById(id);
    if (element && typeof (element as any).ctrla === 'function') {
      const handled = (element as any).ctrla();
      // 只有界面处理了（返回 true 或 undefined）才阻止默认行为
      if (handled !== false) {
        e.preventDefault();
      }
    }
  }

  /**
   * 检查元素是否是文本输入元素
   */
  private isTextInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName;
    if (tagName === 'TEXTAREA') return true;
    if (tagName === 'INPUT') {
      const inputType = (element as HTMLInputElement).type;
      return ['text', 'search', 'url', 'email', 'password', 'number'].includes(inputType);
    }
    return element.isContentEditable;
  }

  /**
   * 获取快捷键组合
   */
  getKeyCombo(e: KeyboardEvent): string {
    const parts: string[] = [];

    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey) parts.push('Ctrl'); // Mac 上 Command 键
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    parts.push(e.key);

    return parts.join('+');
  }

  /**
   * 处理快捷键动作
   */
  handleAction(action: string): void {
    try {
      switch (action) {
        // 编辑导航
        case 'editorPrev':
          this.navigateEditor('prev');
          break;
        case 'editorNext':
          this.navigateEditor('next');
          break;
        case 'editorFirst':
          this.navigateEditor('first');
          break;
        case 'editorLast':
          this.navigateEditor('last');
          break;

        // 保存操作
        case 'save':
          this.saveCurrent();
          break;
        case 'saveAndClose':
          this.saveAndClose();
          break;

        // 搜索
        case 'focusSearch':
          this.focusSearch();
          break;

        // 视图切换
        case 'viewGrid':
          this.setViewMode('grid');
          break;
        case 'viewList':
          this.setViewMode('list');
          break;
        case 'viewCompact':
          this.setViewMode('compact');
          break;

        // 标签管理
        case 'toggleTags':
          this.toggleTagsPanel();
          break;

        // 回收站
        case 'openTrash':
          this.openTrash();
          break;

        // 刷新
        case 'refresh':
          this.refreshData();
          break;

        // 面板切换
        case 'switchToImagePanel':
          this.switchToImagePanel();
          break;
        case 'switchToPromptPanel':
          this.switchToPromptPanel();
          break;

        default:
          console.warn(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Shortcut action failed: ${action}`, error);
    }
  }

  /**
   * 导航编辑器
   */
  navigateEditor(direction: string): void {
    const promptDetailModal = document.querySelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`);
    const imageDetailModal = document.querySelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`);

    if (promptDetailModal) {
      if (this.app.promptNavigator) {
        this.app.promptNavigator.navigateTo(direction);
      }
    } else if (imageDetailModal) {
      if (this.app.imageNavigator) {
        this.app.imageNavigator.navigateTo(direction);
      }
    }
  }

  /**
   * 保存当前内容
   */
  async saveCurrent(): Promise<void> {
    const promptDetailModal = document.querySelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`);
    const imageDetailModal = document.querySelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`);

    if (promptDetailModal && this.app.savePromptWithoutClosing) {
      await this.app.savePromptWithoutClosing();
    } else if (imageDetailModal && this.app.saveImageWithoutClosing) {
      await this.app.saveImageWithoutClosing();
    }
  }

  /**
   * 保存并关闭
   */
  async saveAndClose(): Promise<void> {
    const promptDetailModal = document.querySelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`);
    const imageDetailModal = document.querySelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`);

    if (promptDetailModal && this.app.saveAndClosePromptDetail) {
      await this.app.saveAndClosePromptDetail();
    } else if (imageDetailModal && this.app.saveAndCloseImageDetail) {
      await this.app.saveAndCloseImageDetail();
    }
  }

  /**
   * 聚焦搜索框
   */
  focusSearch(): void {
    const activePanel = document.querySelector('.panel.active');
    if (activePanel) {
      const searchInput = activePanel.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }

  /**
   * 设置视图模式
   */
  setViewMode(mode: string): void {
    if (this.app.promptPanelManager) {
      this.app.promptPanelManager.viewModeType = mode;
      this.app.promptPanelManager.renderView();
    }
  }

  /**
   * 切换标签面板
   */
  toggleTagsPanel(): void {
    const tagsPanel = document.getElementById(Constants.Ids.TAGS_PANEL);
    if (tagsPanel) {
      const isVisible = tagsPanel.style.display !== 'none';
      tagsPanel.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * 打开回收站
   */
  openTrash(): void {
    const trashPanel = document.getElementById(Constants.Ids.TRASH_PANEL);
    if (trashPanel) {
      trashPanel.classList.add('active');
      if (this.app.trashManager) {
        this.app.trashManager.loadTrash();
      }
    }
  }

  /**
   * 刷新数据
   */
  async refreshData(): Promise<void> {
    if (this.app.refreshData) {
      await this.app.refreshData();
    }
  }

  /**
   * 切换到图像主界面
   * 先关闭所有模态框，然后切换到图像面板
   */
  switchToImagePanel(): void {
    // 先关闭所有模态框直到主面板
    this.closeAllModalsUntilMainPanel();
    // 切换到图像面板
    const imageManagerBtn = document.getElementById(Constants.Ids.IMAGE_MANAGER_BTN);
    if (imageManagerBtn) {
      imageManagerBtn.click();
    }
  }

  /**
   * 切换到提示词主界面
   * 先关闭所有模态框，然后切换到提示词面板
   */
  switchToPromptPanel(): void {
    // 先关闭所有模态框直到主面板
    this.closeAllModalsUntilMainPanel();
    // 切换到提示词面板
    const promptManagerBtn = document.getElementById(Constants.Ids.PROMPT_MANAGER_BTN);
    if (promptManagerBtn) {
      promptManagerBtn.click();
    }
  }

  /**
   * 关闭所有模态框直到主面板（基于上下文堆栈）
   * 连续关闭多层模态框，直到到达主面板或堆栈为空
   */
  private closeAllModalsUntilMainPanel(): void {
    const MAX_ITERATIONS = 10; // 防止无限循环
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      const id = contextStack.peekId();

      // 没有更多元素或已到主面板，停止关闭
      if (!id) {
        break;
      }

      // 主面板不需要关闭，停止循环
      if (id === Constants.Ids.IMAGE_PANEL || id === Constants.Ids.PROMPT_PANEL) {
        break;
      }

      const element = document.getElementById(id) as IClosableElement;
      if (!element) {
        break;
      }

      if (typeof element.close === 'function') {
        element.close();
        iterations++;
        // 给 DOM 更新一点时间
        continue;
      }

      // 没有 close 方法，停止循环
      break;
    }
  }

  /**
   * 获取所有快捷键
   */
  getShortcuts(): Array<{ keyCombo: string; action: string; description: string }> {
    return Array.from(this.shortcuts.entries()).map(([key, value]) => ({
      keyCombo: key,
      ...value
    }));
  }

  /**
   * 显示快捷键帮助
   */
  showHelp(): string {
    const shortcuts = this.getShortcuts();
    const helpContent = shortcuts.map(s =>
      `<div class="shortcut-item">
        <kbd>${s.keyCombo}</kbd>
        <span>${s.description}</span>
      </div>`
    ).join('');

    console.log('快捷键列表:');
    shortcuts.forEach(s => {
      console.log(`${s.keyCombo}: ${s.description}`);
    });

    return helpContent;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.shortcuts.clear();
    this.enabled = false;
  }
}
