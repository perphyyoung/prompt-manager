/**
 * 快捷键管理器
 * 提供全局快捷键支持，包括编辑导航、保存等操作
 */

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
    promptPanelManager?: { viewModeType: string; renderView: () => void | Promise<void> };
    trashManager?: { loadTrash: () => Promise<void> };
  };
}

export class ShortcutManager {
  private app: ShortcutManagerOptions['app'];
  private shortcuts: Map<string, ShortcutInfo> = new Map();
  private enabled = true;

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
    this.register('Escape', 'clearSearch', '清除搜索');

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

    // 卡片信息显示
    this.register('Ctrl+I', 'toggleCardInfo', '切换卡片信息显示');
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
    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;

      const keyCombo = this.getKeyCombo(e);
      const shortcut = this.shortcuts.get(keyCombo.toLowerCase());

      if (shortcut) {
        e.preventDefault();
        this.handleAction(shortcut.action);
      }
    });
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
        case 'clearSearch':
          this.clearSearch();
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

        // 卡片信息显示
        case 'toggleCardInfo':
          this.toggleCardInfo();
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
    // 检查是否有模态框打开
    const promptDetailModal = document.querySelector('#promptDetailModal.active');
    const imageEditModal = document.querySelector('#imageEditModal.active');

    if (promptDetailModal) {
      // 提示词编辑
      if (this.app.promptNavigator) {
        this.app.promptNavigator.navigateTo(direction);
      }
    } else if (imageEditModal) {
      // 图像编辑
      if (this.app.imageNavigator) {
        this.app.imageNavigator.navigateTo(direction);
      }
    }
  }

  /**
   * 保存当前内容
   */
  async saveCurrent(): Promise<void> {
    const promptDetailModal = document.querySelector('#promptDetailModal.active');
    const imageEditModal = document.querySelector('#imageEditModal.active');

    if (promptDetailModal && this.app.savePromptWithoutClosing) {
      await this.app.savePromptWithoutClosing();
    } else if (imageEditModal && this.app.saveImageWithoutClosing) {
      await this.app.saveImageWithoutClosing();
    }
  }

  /**
   * 保存并关闭
   */
  async saveAndClose(): Promise<void> {
    const promptDetailModal = document.querySelector('#promptDetailModal.active');
    const imageEditModal = document.querySelector('#imageEditModal.active');

    if (promptDetailModal && this.app.saveAndClosePromptDetail) {
      await this.app.saveAndClosePromptDetail();
    } else if (imageEditModal && this.app.saveAndCloseImageDetail) {
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
   * 清除搜索
   */
  clearSearch(): void {
    const activePanel = document.querySelector('.panel.active');
    if (activePanel) {
      const searchInput = activePanel.querySelector('input[type="search"]') as HTMLInputElement | null;
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
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
    const tagsPanel = document.getElementById('tagsPanel');
    if (tagsPanel) {
      const isVisible = tagsPanel.style.display !== 'none';
      tagsPanel.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * 打开回收站
   */
  openTrash(): void {
    const trashPanel = document.getElementById('trashPanel');
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
   * 切换卡片信息显示
   */
  toggleCardInfo(): void {
    const cardInfoToggleBtn = document.getElementById('cardInfoToggleBtn');
    if (cardInfoToggleBtn) {
      cardInfoToggleBtn.click();
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

export default ShortcutManager;
