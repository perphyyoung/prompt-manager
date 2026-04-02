/**
 * 导航管理器
 * 负责处理面板切换和导航逻辑
 */

// 面板配置接口
interface IPanelConfig {
  id?: string;
  buttonId?: string;
  name?: string;
  onShow?: () => void | Promise<void>;
  [key: string]: unknown;
}

// 批量工具栏配置
interface IBatchToolbarConfig {
  prompt?: IPanelConfig;
  image?: IPanelConfig;
}

// App 类型定义
interface IApp {
  promptPanelManager: {
    viewModeType: string;
    ensureRendered: () => Promise<void>;
  } | null;
  imagePanelManager: {
    viewModeType: string;
    ensureRendered: () => Promise<void>;
  } | null;
  updatePromptViewButtons: (viewMode: string) => void;
  updateImageViewButtons: (viewMode: string) => void;
}

// NavigationManager 构造选项
interface INavigationManagerOptions {
  app: IApp;
  storageKey?: string;
  defaultPanel?: string;
  batchToolbarConfig?: IBatchToolbarConfig;
}

export class NavigationManager {
  private app: IApp;
  private storageKey: string;
  private defaultPanel: string;
  private batchToolbarConfig: IBatchToolbarConfig;

  private currentPanel: string;
  private panels: Map<string, IPanelConfig>;
  private onPanelChange: ((panelName: string, panelConfig: IPanelConfig) => void) | null;

  constructor(options: INavigationManagerOptions = { app: {} as IApp }) {
    this.app = options.app;
    this.storageKey = options.storageKey || 'currentPanel';
    this.defaultPanel = options.defaultPanel || 'prompt';
    this.batchToolbarConfig = options.batchToolbarConfig || {};

    this.currentPanel = this.defaultPanel;
    this.panels = new Map<string, IPanelConfig>();
    this.onPanelChange = null;
  }

  /**
   * 初始化
   */
  init(): void {
    this.registerPanels();
    this.bindEvents();
    // 注意：数据刷新由 PanelManager 处理，不需要在这里订阅
    // PromptPanelManager 和 ImagePanelManager 已经订阅了相应的事件
  }

  /**
   * 注册面板
   * @private
   */
  private registerPanels(): void {
    const promptConfig = this.batchToolbarConfig.prompt || {};
    const imageConfig = this.batchToolbarConfig.image || {};

    this.panels.set('prompt', {
      ...promptConfig,
      id: promptConfig.id || 'promptPanel',
      buttonId: promptConfig.buttonId || 'promptManagerBtn',
      name: 'prompt',
      onShow: async () => {
        if (this.app.promptPanelManager) {
          this.app.updatePromptViewButtons(this.app.promptPanelManager.viewModeType);
          await this.app.promptPanelManager.ensureRendered();
        }
      }
    });

    this.panels.set('image', {
      ...imageConfig,
      id: imageConfig.id || 'imagePanel',
      buttonId: imageConfig.buttonId || 'imageManagerBtn',
      name: 'image',
      onShow: async () => {
        if (this.app.imagePanelManager) {
          this.app.updateImageViewButtons(this.app.imagePanelManager.viewModeType);
          await this.app.imagePanelManager.ensureRendered();
        }
      }
    });
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    // 导航按钮事件
    document.getElementById('promptManagerBtn')?.addEventListener('click', () => this.switchTo('prompt'));
    document.getElementById('imageManagerBtn')?.addEventListener('click', () => this.switchTo('image'));
  }

  /**
   * 切换到指定面板
   * @param panelName - 面板名称 (prompt/image)
   */
  switchTo(panelName: string): void {
    if (!this.panels.has(panelName)) {
      console.warn(`Unknown panel: ${panelName}`);
      return;
    }

    // 隐藏所有面板
    this.panels.forEach((panel) => {
      const element = document.getElementById(panel.id || '');
      const button = document.getElementById(panel.buttonId || '');

      if (element) {
        element.style.display = 'none';
      }
      if (button) {
        button.classList.remove('active');
      }
    });

    // 显示目标面板
    const targetPanel = this.panels.get(panelName);
    if (!targetPanel) return;

    const targetElement = document.getElementById(targetPanel.id || '');
    const targetButton = document.getElementById(targetPanel.buttonId || '');

    if (targetElement) {
      targetElement.style.display = 'flex';
    }
    if (targetButton) {
      targetButton.classList.add('active');
    }

    // 执行面板显示回调
    if (targetPanel.onShow) {
      targetPanel.onShow();
    }

    // 更新当前面板
    this.currentPanel = panelName;

    // 保存状态
    this.savePanelState();

    // 触发回调
    if (this.onPanelChange) {
      this.onPanelChange(panelName, targetPanel);
    }
  }

  /**
   * 切换到提示词管理器
   */
  switchToPromptManager(): void {
    this.switchTo('prompt');
  }

  /**
   * 切换到图像管理器
   */
  switchToImageManager(): void {
    this.switchTo('image');
  }

  /**
   * 获取当前面板
   * @returns 当前面板名称
   */
  getCurrentPanel(): string {
    return this.currentPanel;
  }

  /**
   * 检查是否是指定面板
   * @param panelName - 面板名称
   * @returns 是否是指定面板
   */
  isPanel(panelName: string): boolean {
    return this.currentPanel === panelName;
  }

  /**
   * 恢复面板状态
   */
  restorePanelState(): void {
    const savedPanel = localStorage.getItem(this.storageKey) || this.defaultPanel;
    this.switchTo(savedPanel);
  }

  /**
   * 重置为默认面板
   */
  reset(): void {
    this.switchTo(this.defaultPanel);
  }

  /**
   * 注册自定义面板
   * @param name - 面板名称
   * @param config - 面板配置
   */
  registerPanel(name: string, config: IPanelConfig): void {
    this.panels.set(name, {
      ...config,
      name
    });
  }

  /**
   * 注销面板
   * @param name - 面板名称
   */
  unregisterPanel(name: string): void {
    this.panels.delete(name);
  }

  /**
   * 设置面板切换回调
   * @param callback - 回调函数
   */
  setOnPanelChange(callback: (panelName: string, panelConfig: IPanelConfig) => void): void {
    this.onPanelChange = callback;
  }

  /**
   * 保存面板状态
   * @private
   */
  private savePanelState(): void {
    localStorage.setItem(this.storageKey, this.currentPanel);
  }

  /**
   * 销毁
   */
  destroy(): void {
    // 清理资源（如果有订阅的话）
  }
}
