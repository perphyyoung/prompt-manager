/**
 * 导航管理器
 * 负责处理面板切换和导航逻辑
 */

import { logger } from "../../utils/Logger.ts";
import { contextStack, IContextStackEntry } from "./ContextStackManager.ts";
import { Constants } from "../constants.ts";
import { localStorageManager } from "../configs/LocalStorageConfig.ts";
import type { NavigationManagerDeps } from "../app.types.ts";

// 面板配置接口
interface IPanelConfig {
  id?: string;
  buttonId?: string;
  name?: string;
  onShow?: () => void | Promise<void>;
  [key: string]: unknown;
}

// App 类型定义

// NavigationManager 构造选项
interface INavigationManagerOptions {
  app: NavigationManagerDeps;
  storageKey?: string;
  defaultPanel?: string;
}

export class NavigationManager {
  private app: NavigationManagerDeps;
  private storageKey: string;
  private defaultPanel: string;

  private currentPanel: string;
  private panels: Map<string, IPanelConfig>;
  private onPanelChange: ((panelName: string, panelConfig: IPanelConfig) => void) | null;
  private isInitialized = false;

  constructor(options: INavigationManagerOptions = { app: {} as NavigationManagerDeps }) {
    this.app = options.app;
    this.storageKey = options.storageKey || "currentPanel";
    this.defaultPanel = options.defaultPanel || "prompt";

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
    this.panels.set("prompt", {
      id: Constants.Ids.PROMPT_PANEL,
      buttonId: Constants.Ids.PROMPT_MANAGER_BTN,
      name: "prompt",
      onShow: async () => {
        if (this.app.promptPanelManager) {
          await this.app.promptPanelManager.ensureRendered();
        }
      },
    });

    this.panels.set("image", {
      id: Constants.Ids.IMAGE_PANEL,
      buttonId: Constants.Ids.IMAGE_MANAGER_BTN,
      name: "image",
      onShow: async () => {
        if (this.app.imagePanelManager) {
          await this.app.imagePanelManager.ensureRendered();
        }
      },
    });
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    // 导航按钮事件
    document
      .getElementById(Constants.Ids.PROMPT_MANAGER_BTN)
      ?.addEventListener("click", () => this.switchTo("prompt"));
    document
      .getElementById(Constants.Ids.IMAGE_MANAGER_BTN)
      ?.addEventListener("click", () => this.switchTo("image"));

    // 侧边栏事件
    this.bindSidebarEvents();
  }

  /**
   * 绑定侧边栏事件
   * @private
   */
  private bindSidebarEvents(): void {
    const toggleSidebarBtn = document.getElementById(Constants.Ids.TOGGLE_SIDEBAR_BTN);
    const sidebar = document.getElementById(Constants.Ids.SIDEBAR);
    if (!toggleSidebarBtn || !sidebar) return;

    toggleSidebarBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      const isCollapsed = sidebar.classList.contains("collapsed");
      toggleSidebarBtn.title = isCollapsed ? "展开侧边栏" : "收起侧边栏";
      localStorageManager.set(Constants.LocalStorageKey.SIDEBAR_COLLAPSED, isCollapsed);
    });

    // 恢复侧边栏状态
    const isCollapsed = localStorageManager.get<boolean>(
      Constants.LocalStorageKey.SIDEBAR_COLLAPSED,
    );
    if (isCollapsed) {
      sidebar.classList.add("collapsed");
      toggleSidebarBtn.title = "展开侧边栏";
    }
  }

  /**
   * 切换到指定面板
   * @param panelName - 面板名称 (prompt/image)
   * @param force - 是否强制刷新，即使已经在目标面板也执行回调
   */
  switchTo(panelName: string, force = false): void {
    if (!this.panels.has(panelName)) {
      logger.warn("NavigationManager", `Unknown panel: ${panelName}`);
      return;
    }

    // 如果已经在目标面板且不强制刷新，直接返回
    if (!force && this.currentPanel === panelName) {
      return;
    }

    // 退出当前面板的批量模式
    this.app.promptPanelManager?.exitBatchMode?.();
    this.app.imagePanelManager?.exitBatchMode?.();

    // 隐藏所有面板
    this.panels.forEach((panel) => {
      const element = document.getElementById(panel.id || "");
      const button = document.getElementById(panel.buttonId || "");

      if (element) {
        element.style.display = "none";
      }
      if (button) {
        button.classList.remove("active");
      }
    });

    // 显示目标面板
    const targetPanel = this.panels.get(panelName);
    if (!targetPanel) return;

    const targetElement = document.getElementById(targetPanel.id || "");
    const targetButton = document.getElementById(targetPanel.buttonId || "");

    if (targetElement) {
      targetElement.style.display = "flex";
    }
    if (targetButton) {
      targetButton.classList.add("active");
    }

    // 执行面板显示回调
    if (targetPanel.onShow) {
      targetPanel.onShow();
    }

    // 更新当前面板
    this.currentPanel = panelName;

    // 更新上下文堆栈
    contextStack.reset();
    const panelId = panelName === "prompt" ? Constants.Ids.PROMPT_PANEL : Constants.Ids.IMAGE_PANEL;
    const stackEntry: IContextStackEntry = {
      id: panelId,
      state: { isBatchToolbarVisible: false },
      close: () => {
        /* 面板级别不需要关闭 */
      },
    };
    contextStack.push(stackEntry);

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
    this.switchTo("prompt");
  }

  /**
   * 切换到图像管理器
   */
  switchToImageManager(): void {
    this.switchTo("image");
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
    const savedPanel = localStorageManager.get<string>(this.storageKey);
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
      name,
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
    localStorageManager.set(this.storageKey, this.currentPanel);
  }

  /**
   * 销毁
   */
  destroy(): void {
    // 清理资源（如果有订阅的话）
  }
}
