/**
 * 导航管理器
 * 负责处理面板切换和导航逻辑
 */

import { contextStack } from './ContextStackManager.ts';
import { Constants } from '../../constants.ts';
import { logInfo } from '@/main/logger.ts';

// 面板配置接口
interface IPanelConfig {
  id?: string;
  buttonId?: string;
  name?: string;
  onShow?: () => void | Promise<void>;
  [key: string]: unknown;
}

// App 类型定义
interface IApp {
  promptPanelManager: {
    viewModeType: string;
    ensureRendered: () => Promise<void>;
    exitBatchMode?: () => void;
  } | null;
  imagePanelManager: {
    viewModeType: string;
    ensureRendered: () => Promise<void>;
    exitBatchMode?: () => void;
  } | null;
  promptTagManager?: {
    hideBatchToolbar: () => void;
  } | null;
  imageTagManager?: {
    hideBatchToolbar: () => void;
  } | null;
  updatePromptViewButtons: (viewMode: string) => void;
  updateImageViewButtons: (viewMode: string) => void;
  eventBus?: {
    emit: (event: string, data?: unknown) => void;
  };
}

// NavigationManager 构造选项
interface INavigationManagerOptions {
  app: IApp;
  storageKey?: string;
  defaultPanel?: string;
}

export class NavigationManager {
  private app: IApp;
  private storageKey: string;
  private defaultPanel: string;

  private currentPanel: string;
  private panels: Map<string, IPanelConfig>;
  private onPanelChange: ((panelName: string, panelConfig: IPanelConfig) => void) | null;
  private isInitialized = false;

  constructor(options: INavigationManagerOptions = { app: {} as IApp }) {
    this.app = options.app;
    this.storageKey = options.storageKey || 'currentPanel';
    this.defaultPanel = options.defaultPanel || 'prompt';

    this.currentPanel = this.defaultPanel;
    this.panels = new Map<string, IPanelConfig>();
    this.onPanelChange = null;
  }

  /**
   * 初始化
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }
    this.registerPanels();
    this.bindEvents();
    this.isInitialized = true;
    // 注意：数据刷新由 PanelManager 处理，不需要在这里订阅
    // PromptPanelManager 和 ImagePanelManager 已经订阅了相应的事件
  }

  /**
   * 注册面板
   * @private
   */
  private registerPanels(): void {
    this.panels.set('prompt', {
      id: 'promptPanel',
      buttonId: 'promptManagerBtn',
      name: 'prompt',
      onShow: async () => {
        if (this.app.promptPanelManager) {
          this.app.updatePromptViewButtons(this.app.promptPanelManager.viewModeType);
          await this.app.promptPanelManager.ensureRendered();
        }
      }
    });

    this.panels.set('image', {
      id: 'imagePanel',
      buttonId: 'imageManagerBtn',
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

    // 侧边栏事件
    this.bindSidebarEvents();
  }

  /**
   * 绑定侧边栏事件
   * @private
   */
  private bindSidebarEvents(): void {
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    if (!toggleSidebarBtn || !sidebar) return;

    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      toggleSidebarBtn.title = isCollapsed ? '展开侧边栏' : '收起侧边栏';
      localStorage.setItem(Constants.LocalStorageKey.SIDEBAR_COLLAPSED, String(isCollapsed));
    });

    // 恢复侧边栏状态
    if (localStorage.getItem(Constants.LocalStorageKey.SIDEBAR_COLLAPSED) === 'true') {
      sidebar.classList.add('collapsed');
      toggleSidebarBtn.title = '展开侧边栏';
    }
  }

  /**
   * 切换到指定面板
   * @param panelName - 面板名称 (prompt/image)
   * @param force - 是否强制刷新，即使已经在目标面板也执行回调
   */
  switchTo(panelName: string, force = false): void {
    if (!this.panels.has(panelName)) {
      console.warn(`Unknown panel: ${panelName}`);
      return;
    }

    // 如果已经在目标面板且不强制刷新，直接返回
    if (!force && this.currentPanel === panelName) {
      return;
    }

    // 发布视图变化事件，通知所有组件清理多选工具栏
    window.electronAPI.logDebug('NavigationManager', `emit viewChanged, panel: ${panelName}, current: ${this.currentPanel}`);
    this.app.eventBus?.emit('viewChanged', { view: 'panel', panel: panelName });

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

    // 更新上下文堆栈
    contextStack.reset();
    if (panelName === 'prompt') {
      contextStack.push(Constants.Ids.PROMPT_PANEL);
    } else if (panelName === 'image') {
      contextStack.push(Constants.Ids.IMAGE_PANEL);
    }

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
    this.switchTo(savedPanel, true);
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
