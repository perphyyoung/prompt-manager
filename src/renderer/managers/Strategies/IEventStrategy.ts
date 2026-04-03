// 定义本地类型以避免循环依赖
export interface ItemBase {
  id: string;
  isDeleted?: boolean;
  isSafe?: number;
  [key: string]: unknown;
}

export type ItemType = ItemBase;

// 导入 SelectionManager 类型
import type { SelectionManager } from '../SelectionManager.ts';

export interface EventContext {
  selectionManager: SelectionManager;
  toolbarController?: {
    enterBatchModeIfNeeded: () => void;
    exitBatchModeIfEmpty: () => void;
    updateUI: () => void;
  };
  renderView: () => void | Promise<void>;
  items: ItemType[];
}

export interface IEventStrategy {
  /**
   * 绑定容器内所有项目的事件
   * @param container - 容器元素
   * @param items - 项目列表
   * @param context - 事件上下文
   */
  bindEvents(container: HTMLElement, items: ItemType[], context: EventContext): void;

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
