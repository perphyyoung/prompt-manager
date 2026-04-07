/**
 * 工具栏管理器
 * 负责处理工具栏按钮事件和操作
 */
import { Constants } from '../../constants.ts';
import { DialogService, DialogConfig } from '../services/index.ts';

/**
 * App 类型定义
 */
interface IApp {
  promptPanelManager: {
    loadData: () => Promise<unknown[]>;
    renderView: () => Promise<void>;
    clearTagFilter: () => void;
    toggleTagFilterState: () => Promise<void>;
  } | null;
  imagePanelManager: {
    loadData: () => Promise<unknown[]>;
    renderView: () => Promise<void>;
    clearTagFilter: () => void;
    toggleTagFilterState: () => Promise<void>;
  } | null;
  openPromptTagManagerModal?: () => void;
  openImageTagManagerModal?: () => void;
  openStatisticsModal?: () => void;
  showToast?: (message: string, type: string) => void;
  relaunchApp?: () => Promise<void>;
}

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
    this.bindCardInfoToggleEvent();
  }

  /**
   * 绑定卡片信息开关事件
   * @private
   */
  private bindCardInfoToggleEvent(): void {
    const cardInfoToggleBtn = document.getElementById(Constants.Ids.CARD_INFO_TOGGLE_BTN);
    if (!cardInfoToggleBtn) return;

    // 从 localStorage 加载状态
    const isInfoVisible = localStorage.getItem(Constants.LocalStorageKey.CARDS_INFO_VISIBLE) !== 'false';
    if (!isInfoVisible) {
      document.body.classList.add('cards-info-hidden');
      cardInfoToggleBtn.classList.remove('active');
    }

    cardInfoToggleBtn.addEventListener('click', () => {
      const isHidden = document.body.classList.toggle('cards-info-hidden');
      cardInfoToggleBtn.classList.toggle('active');
      localStorage.setItem(Constants.LocalStorageKey.CARDS_INFO_VISIBLE, String(!isHidden));

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
    document.getElementById(Constants.Ids.REFRESH_DATA_BTN)?.addEventListener('click', () => this.refreshData());
    document.getElementById(Constants.Ids.RELAUNCH_BTN)?.addEventListener('click', () => this.relaunchApp());
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
