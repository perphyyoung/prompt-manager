/**
 * 工具栏管理器
 * 负责处理工具栏按钮事件和操作
 */
import { DialogService, DialogConfig } from '../services/index.ts';

/**
 * App 类型定义
 */
interface IApp {
  promptPanelManager: {
    loadData: () => Promise<unknown[]>;
    renderView: () => Promise<void>;
    clearTagFilter: () => void;
  } | null;
  imagePanelManager: {
    loadData: () => Promise<unknown[]>;
    renderView: () => Promise<void>;
    clearTagFilter: () => void;
  } | null;
  newPromptManager: {
    open: () => Promise<void>;
  } | null;
  imageUploadManager: {
    open: () => void;
  } | null;
  openPromptTagManagerModal?: () => void;
  openImageTagManagerModal?: () => void;
  openStatisticsModal?: () => void;
  showToast?: (message: string, type: string) => void;
  relaunchApp?: () => Promise<void>;
  togglePromptTagFilter?: () => Promise<void>;
  toggleImageTagFilter?: () => Promise<void>;
}

/**
 * 卡片信息本地存储键
 */
const CARDS_INFO_VISIBLE_KEY = 'cardsInfoVisible';

/**
 * ToolbarManager 构造选项
 */
interface IToolbarManagerOptions {
  app: IApp;
}

export class ToolbarManager {
  private app: IApp;
  private isInitialized = false;

  constructor(options: IToolbarManagerOptions = { app: {} as IApp }) {
    this.app = options.app;
  }

  /**
   * 初始化
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }
    this.bindEvents();
    this.isInitialized = true;
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    this.bindRefreshEvents();
    this.bindPromptToolbarEvents();
    this.bindImageToolbarEvents();
    this.bindTagFilterEvents();
    this.bindTagManagerEvents();
    this.bindModalEvents();
    this.bindCardInfoToggleEvent();
  }

  /**
   * 绑定卡片信息开关事件
   * @private
   */
  private bindCardInfoToggleEvent(): void {
    const cardInfoToggleBtn = document.getElementById('cardInfoToggleBtn');
    if (!cardInfoToggleBtn) return;

    // 从 localStorage 加载状态
    const isInfoVisible = localStorage.getItem(CARDS_INFO_VISIBLE_KEY) !== 'false';
    if (!isInfoVisible) {
      document.body.classList.add('cards-info-hidden');
      cardInfoToggleBtn.classList.remove('active');
    }

    cardInfoToggleBtn.addEventListener('click', () => {
      const isHidden = document.body.classList.toggle('cards-info-hidden');
      cardInfoToggleBtn.classList.toggle('active');
      localStorage.setItem(CARDS_INFO_VISIBLE_KEY, String(!isHidden));

      // 更新提示
      const action = isHidden ? '已隐藏' : '已显示';
      this.app.showToast?.(`${action}卡片信息`, 'info');
    });
  }

  /**
   * 绑定刷新事件
   * @private
   */
  private bindRefreshEvents(): void {
    document.getElementById('reloadBtn')?.addEventListener('click', () => this.refreshData());
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.relaunchApp());
  }

  /**
   * 绑定提示词工具栏事件
   * @private
   */
  private bindPromptToolbarEvents(): void {
    document.getElementById('promptAddBtn')?.addEventListener('click', () => this.app.newPromptManager?.open());
  }

  /**
   * 绑定图像工具栏事件
   * @private
   */
  private bindImageToolbarEvents(): void {
    document.getElementById('imageAddBtn')?.addEventListener('click', () => this.app.imageUploadManager?.open());
  }

  /**
   * 绑定标签筛选事件
   * @private
   */
  private bindTagFilterEvents(): void {
    document.getElementById('clearPromptTagFilter')?.addEventListener('click', () => this.app.promptPanelManager?.clearTagFilter());
    document.getElementById('clearImageTagFilter')?.addEventListener('click', () => this.app.imagePanelManager?.clearTagFilter());
    document.getElementById('promptTagFilterToggleBtn')?.addEventListener('click', () => this.app.togglePromptTagFilter?.());
    document.getElementById('imageTagFilterToggleBtn')?.addEventListener('click', () => this.app.toggleImageTagFilter?.());
  }

  /**
   * 绑定标签管理器事件
   * @private
   */
  private bindTagManagerEvents(): void {
    document.getElementById('promptTagManagerBtn')?.addEventListener('click', () => this.app.openPromptTagManagerModal?.());
    document.getElementById('imageTagManagerBtn')?.addEventListener('click', () => this.app.openImageTagManagerModal?.());
  }

  /**
   * 绑定模态框事件
   * @private
   */
  private bindModalEvents(): void {
    // 统计按钮
    document.getElementById('statisticsBtn')?.addEventListener('click', () => {
      this.app.openStatisticsModal?.();
    });
  }

  /**
   * 刷新数据
   */
  async refreshData(): Promise<void> {
    try {
      if (this.app.promptPanelManager) {
        await this.app.promptPanelManager.loadData();
        await this.app.promptPanelManager.renderView();
      }
      if (this.app.imagePanelManager) {
        await this.app.imagePanelManager.loadData();
        await this.app.imagePanelManager.renderView();
      }

      this.app.showToast?.('数据已刷新', 'success');
    } catch (error) {
      window.electronAPI.logError('ToolbarManager', 'Failed to refresh data', { error: error instanceof Error ? error.message : String(error) });
      this.app.showToast?.('刷新失败', 'error');
    }
  }

  /**
   * 重启应用
   */
  async relaunchApp(): Promise<void> {
    const confirmed = await DialogService.showConfirmDialogByConfig?.(DialogConfig.RELAUNCH_APP);
    if (!confirmed) return;

    try {
      this.app.showToast?.('正在重启应用...', 'info');
      await window.electronAPI.relaunchApp();
    } catch (error) {
      window.electronAPI.logError('ToolbarManager.ts', 'Failed to relaunch app:', error);
      this.app.showToast?.('重启失败', 'error');
    }
  }
}
