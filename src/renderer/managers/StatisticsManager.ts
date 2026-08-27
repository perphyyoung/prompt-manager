/**
 * 统计管理器
 * 负责统计数据的计算和渲染
 */

import { contextStack, IContextStackEntry } from "./ContextStackManager.ts";
import { Constants } from "../../constants.ts";
import type { IApp } from "../app.types.ts";
import type { IClosableElement } from "../../types/entities.ts";

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
    document.getElementById(Constants.Ids.STATISTICS_BTN)?.addEventListener("click", () => {
      this.openStatisticsModal();
    });

    // 关闭按钮
    document
      .getElementById(Constants.Ids.CLOSE_STATISTICS_MODAL)
      ?.addEventListener("click", () => this.closeStatisticsModal());

    // 点击背景关闭
    const statisticsModal = document.getElementById(Constants.Ids.STATISTICS_MODAL);
    if (statisticsModal) {
      statisticsModal.addEventListener("click", (e) => {
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
    const modal = document.getElementById(Constants.Ids.STATISTICS_MODAL);
    if (modal) {
      // 压栈：进入统计视图上下文
      const stackEntry: IContextStackEntry = {
        id: Constants.Ids.STATISTICS_MODAL,
        state: { isBatchToolbarVisible: false },
        close: () => {
          this.closeStatisticsModal();
        },
      };
      contextStack.push(stackEntry);
      modal.classList.add("active");
      // 添加 close 方法供 ShortcutManager 调用
      (modal as IClosableElement).close = () => this.closeStatisticsModal();
    }
  }

  /**
   * 关闭统计模态框
   */
  closeStatisticsModal(): void {
    const modal = document.getElementById(Constants.Ids.STATISTICS_MODAL);
    if (modal) {
      modal.classList.remove("active");
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
      window.electronAPI.logError("StatisticsManager", "Failed to render statistics:", error);
    }
  }

  /**
   * 计算统计数据
   * 计数走主进程 SQL 聚合（getStatistics），标签组为轻量小表直接查询，
   * 避免把全量提示词/图像经 IPC 拉进渲染进程做 JS 计数
   */
  async calculateStatistics(): Promise<IStatistics> {
    const isSafeMode = this.app.viewMode === "safe";
    const [stats, promptTagGroups, imageTagGroups] = await Promise.all([
      window.electronAPI.getStatistics(isSafeMode),
      window.electronAPI.getPromptTagGroups(),
      window.electronAPI.getImageTagGroups(),
    ]);

    const totalPromptTags = promptTagGroups.reduce(
      (sum, group) => sum + (group.tags ? group.tags.length : 0),
      0,
    );
    const totalImageTags = imageTagGroups.reduce(
      (sum, group) => sum + (group.tags ? group.tags.length : 0),
      0,
    );

    return {
      totalPrompts: stats.totalPrompts,
      deletedPrompts: stats.deletedPrompts,
      favoritePrompts: stats.favoritePrompts,
      promptsWithImages: stats.promptsWithImages,
      promptTagGroups: promptTagGroups.length,
      totalPromptTags,
      totalImages: stats.totalImages,
      deletedImages: stats.deletedImages,
      favoriteImages: stats.favoriteImages,
      referencedImages: stats.referencedImages,
      imageTagGroups: imageTagGroups.length,
      totalImageTags,
    };
  }

  /**
   * 更新 DOM 显示
   */
  private updateDOM(data: IStatistics): void {
    this.updateStatElement(Constants.Ids.STAT_PROMPTS_TOTAL, data.totalPrompts);
    this.updateStatElement(Constants.Ids.STAT_PROMPTS_DELETED, data.deletedPrompts);
    this.updateStatElement(Constants.Ids.STAT_PROMPTS_FAVORITE, data.favoritePrompts);
    this.updateStatElement(Constants.Ids.STAT_PROMPTS_WITH_IMAGES, data.promptsWithImages);
    this.updateStatElement(Constants.Ids.STAT_PROMPT_TAG_GROUPS, data.promptTagGroups);
    this.updateStatElement(Constants.Ids.STAT_PROMPT_TAGS_TOTAL, data.totalPromptTags);

    this.updateStatElement(Constants.Ids.STAT_IMAGES_TOTAL, data.totalImages);
    this.updateStatElement(Constants.Ids.STAT_IMAGES_DELETED, data.deletedImages);
    this.updateStatElement(Constants.Ids.STAT_IMAGES_FAVORITE, data.favoriteImages);
    this.updateStatElement(Constants.Ids.STAT_IMAGES_REFERENCED, data.referencedImages);
    this.updateStatElement(Constants.Ids.STAT_IMAGE_TAG_GROUPS, data.imageTagGroups);
    this.updateStatElement(Constants.Ids.STAT_IMAGE_TAGS_TOTAL, data.totalImageTags);
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
