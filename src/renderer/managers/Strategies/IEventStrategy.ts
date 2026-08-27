// 定义本地类型以避免循环依赖
export interface IEventStrategyItem {
  id: string;
  isDeleted?: boolean;
  isSafe?: number;
  [key: string]: unknown;
}

import type { BatchToolbarMiddle, ToolbarContext } from "../../../middle/index.ts";

export interface EventContext {
  batchToolbarMiddle: BatchToolbarMiddle;
  toolbarContext: ToolbarContext;
  renderView: () => void | Promise<void>;
  updateSelectionUI: () => void;
  items: IEventStrategyItem[];
}

export interface IEventStrategy {
  /**
   * 绑定容器内所有项目的事件
   * @param container - 容器元素
   * @param items - 项目列表
   * @param context - 事件上下文
   */
  bindEvents(container: HTMLElement, items: IEventStrategyItem[], context: EventContext): void;

  /**
   * 清理容器内所有项目的事件监听器
   * 通过 cloneNode 移除所有旧的事件监听器，防止内存泄漏
   * @param container - 容器元素
   */
  unbindEvents(container: HTMLElement): void;

  /**
   * 获取复选框选择器
   */
  getCheckboxSelector(): string;

  /**
   * 获取卡片/行选择器
   */
  getItemSelector(): string;

  /**
   * 获取需要排除的点击区域选择器
   */
  getExcludeSelectors(): string[];
}
