/**
 * 统计管理器
 * 负责统计数据的计算和渲染
 */

import { contextStack, IContextStackEntry } from './ContextStackManager.ts';
import { Constants } from '../../constants.ts';
import type { IApp } from '../app.types.ts';
import type { IClosableElement } from '../../types/entities.ts';

export interface IStatistics {
  // 提示词统计
  totalPrompts: number;
  deletedPrompts: number;
  favoritePrompts: number;
  promptsWithImages: number;
  promptTagGroups: number;
  totalPromptTags: number;

  // 图像统计
  totalImages: number;
  deletedImages: number;
  favoriteImages: number;
  referencedImages: number;
  imageTagGroups: number;
  totalImageTags: number;
}

export class StatisticsManager {
  private app: IApp;

  constructor(app: IApp) {
    this.app = app;
    this.bindStatsEvents();
  }

  /**
   * 绑定模态框事件
   */
  private bindStatsEvents(): void {
    // 统计按钮
    document.getElementById(Constants.Ids.STATISTICS_BTN)?.addEventListener('click', () => {
      this.openStatisticsModal();
    });

    // 关闭按钮
    document.getElementById('closeStatisticsModal')?.addEventListener('click', () => this.closeStatisticsModal());

    // 点击背景关闭
    const statisticsModal = document.getElementById('statisticsModal');
    if (statisticsModal) {
      statisticsModal.addEventListener('click', (e) => {
        if (e.target === statisticsModal) {
          this.closeStatisticsModal();
        }
      });
    }
  }

  /**
   * 打开统计模态框
   */
  async openStatisticsModal(): Promise<void> {
    await this.renderStatistics();
    const modal = document.getElementById('statisticsModal');
    if (modal) {
      // 压栈：进入统计视图上下文
      const stackEntry: IContextStackEntry = {
        id: Constants.Ids.STATISTICS_MODAL,
        state: { isBatchToolbarVisible: false },
        close: () => { this.closeStatisticsModal(); }
      };
      contextStack.push(stackEntry);
      modal.classList.add('active');
      // 添加 close 方法供 ShortcutManager 调用
      (modal as IClosableElement).close = () => this.closeStatisticsModal();
    }
  }

  /**
   * 关闭统计模态框
   */
  closeStatisticsModal(): void {
    const modal = document.getElementById('statisticsModal');
    if (modal) {
      modal.classList.remove('active');
    }
    // 出栈：退出统计视图上下文
    contextStack.pop(Constants.Ids.STATISTICS_MODAL);
  }

  /**
   * 渲染统计数据
   */
  async renderStatistics(): Promise<void> {
    try {
      const data = await this.calculateStatistics();
      this.updateDOM(data);
    } catch (error) {
      window.electronAPI.logError('StatisticsManager', 'Failed to render statistics:', error);
    }
  }

  /**
   * 计算统计数据
   */
  async calculateStatistics(): Promise<IStatistics> {
    // 获取所有数据（包括已删除的）
    const prompts = await window.electronAPI.getPrompts('', '');
    const allImages = await window.electronAPI.getAllImagesForStats();
    const promptTagGroups = await window.electronAPI.getPromptTagGroups();
    const imageTagGroups = await window.electronAPI.getImageTagGroups();

    // 根据当前视图模式过滤数据（safe 模式只显示 isSafe=1 的项目）
    const isSafeMode = this.app.viewMode === 'safe';
    const filteredPrompts = isSafeMode ? prompts.filter(p => p.isSafe !== 0) : prompts;
    const filteredImages = isSafeMode ? allImages.filter(i => i.isSafe !== 0) : allImages;

    // 提示词统计（基于过滤后的数据）
    const totalPrompts = filteredPrompts.length;
    const deletedPrompts = filteredPrompts.filter(p => p.isDeleted).length;
    const favoritePrompts = filteredPrompts.filter(p => p.isFavorite && !p.isDeleted).length;
    const promptsWithImages = filteredPrompts.filter(p => p.images && p.images.length > 0 && !p.isDeleted).length;
    const totalPromptTags = promptTagGroups.reduce((sum, group) => sum + (group.tags ? group.tags.length : 0), 0);

    // 图像统计（基于过滤后的数据）
    const totalImages = filteredImages.length;
    const deletedImages = filteredImages.filter(i => i.isDeleted).length;
    const favoriteImages = filteredImages.filter(i => i.isFavorite && !i.isDeleted).length;
    const referencedImages = filteredImages.filter(i => i.promptRefs && i.promptRefs.length > 0 && !i.isDeleted).length;
    const totalImageTags = imageTagGroups.reduce((sum, group) => sum + (group.tags ? group.tags.length : 0), 0);

    return {
      totalPrompts,
      deletedPrompts,
      favoritePrompts,
      promptsWithImages,
      promptTagGroups: promptTagGroups.length,
      totalPromptTags,
      totalImages,
      deletedImages,
      favoriteImages,
      referencedImages,
      imageTagGroups: imageTagGroups.length,
      totalImageTags
    };
  }

  /**
   * 更新 DOM 显示
   */
  private updateDOM(data: IStatistics): void {
    this.updateStatElement('statPromptsTotal', data.totalPrompts);
    this.updateStatElement('statPromptsDeleted', data.deletedPrompts);
    this.updateStatElement('statPromptsFavorite', data.favoritePrompts);
    this.updateStatElement('statPromptsWithImages', data.promptsWithImages);
    this.updateStatElement('statPromptTagGroups', data.promptTagGroups);
    this.updateStatElement('statPromptTagsTotal', data.totalPromptTags);

    this.updateStatElement('statImagesTotal', data.totalImages);
    this.updateStatElement('statImagesDeleted', data.deletedImages);
    this.updateStatElement('statImagesFavorite', data.favoriteImages);
    this.updateStatElement('statImagesReferenced', data.referencedImages);
    this.updateStatElement('statImageTagGroups', data.imageTagGroups);
    this.updateStatElement('statImageTagsTotal', data.totalImageTags);
  }

  /**
   * 更新统计数字
   */
  private updateStatElement(id: string, value: string | number): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  }
}
