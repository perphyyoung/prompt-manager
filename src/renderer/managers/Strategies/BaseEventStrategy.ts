import { IEventStrategy, EventContext, IEventStrategyItem } from "./IEventStrategy";

/**
 * 选择器配置接口
 */
export interface IEventStrategySelectors {
  /** 复选框选择器 */
  checkbox: string;
  /** 项目元素选择器 */
  item: string;
  /** 需要排除的点击区域选择器 */
  exclude: string[];
}

/**
 * 统一的事件策略基类
 * 使用事件委托方式处理所有视图（网格/列表/紧凑）的点击和复选框事件
 * 通过 data-id 属性在 items 数组中查找对应项，不受 DOM 顺序影响
 */
export abstract class BaseEventStrategy implements IEventStrategy {
  /**
   * 获取选择器配置 - 子类必须实现
   */
  protected abstract getSelectors(): IEventStrategySelectors;

  getCheckboxSelector(): string {
    return this.getSelectors().checkbox;
  }

  getItemSelector(): string {
    return this.getSelectors().item;
  }

  getExcludeSelectors(): string[] {
    return this.getSelectors().exclude;
  }

  /**
   * 绑定事件 - 使用事件委托
   * 在容器上统一监听 click 和 change 事件，通过 closest 找到目标项
   */
  bindEvents(container: HTMLElement, items: IEventStrategyItem[], context: EventContext): void {
    // 先清理旧的事件监听器，防止重复绑定
    this.unbindEvents(container);

    // 初始化 checkbox 状态
    this.initCheckboxState(container, context);

    // 绑定 click 事件委托
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as Element;
      const itemEl = target.closest("[data-id]");
      if (!itemEl) {
        return;
      }

      // 检查是否点击了排除区域
      const excludeSelectors = this.getExcludeSelectors();
      const isExcluded = excludeSelectors.some((selector) => target.closest(selector));
      if (isExcluded) {
        return;
      }

      const id = itemEl.getAttribute("data-id");
      if (!id) {
        return;
      }

      // 在 items 数组中查找对应项（不受 DOM 顺序影响）
      const index = items.findIndex((item) => String(item.id) === id);
      if (index === -1) {
        return;
      }

      this.handleItemClick(items[index], index, e, context);
    };

    // 绑定 change 事件委托（复选框）
    const changeHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;

      // 只处理匹配的复选框
      if (!target.matches(this.getCheckboxSelector())) return;

      const itemEl = target.closest("[data-id]");
      if (!itemEl) return;

      const id = itemEl.getAttribute("data-id");
      if (!id) return;

      const index = items.findIndex((item) => String(item.id) === id);
      if (index === -1) return;

      const isChecked = target.checked;

      if (isChecked) {
        context.batchToolbarMiddle.addSelectionWithIndex(context.toolbarContext, id, index);
      } else {
        context.batchToolbarMiddle.removeSelection(context.toolbarContext, id);
      }

      // 只更新选中状态的 UI，不重新加载数据
      itemEl.classList.toggle("is-selected", isChecked);
    };

    container.addEventListener("click", clickHandler);
    container.addEventListener("change", changeHandler);

    // 存储 handler 引用以便清理
    (
      container as HTMLElement & {
        __eventHandlers?: { click: (e: MouseEvent) => void; change: (e: Event) => void };
      }
    ).__eventHandlers = {
      click: clickHandler,
      change: changeHandler,
    };
  }

  /**
   * 初始化复选框状态
   */
  private initCheckboxState(container: HTMLElement, context: EventContext): void {
    container.querySelectorAll(this.getCheckboxSelector()).forEach((checkbox) => {
      const itemEl = checkbox.closest("[data-id]");
      if (!itemEl) return;

      const id = itemEl.getAttribute("data-id");
      if (!id) return;

      (checkbox as HTMLInputElement).checked = context.batchToolbarMiddle.isSelected(
        context.toolbarContext,
        id,
      );
    });
  }

  /**
   * 清理事件监听器
   */
  unbindEvents(container: HTMLElement): void {
    const handlers = (
      container as HTMLElement & {
        __eventHandlers?: { click: (e: MouseEvent) => void; change: (e: Event) => void };
      }
    ).__eventHandlers;
    if (handlers) {
      container.removeEventListener("click", handlers.click);
      container.removeEventListener("change", handlers.change);
      delete (container as HTMLElement & { __eventHandlers?: unknown }).__eventHandlers;
    }
  }

  /**
   * 处理项目点击 - 支持 Ctrl/Shift 多选
   */
  protected handleItemClick(
    item: IEventStrategyItem,
    index: number,
    event: MouseEvent,
    context: EventContext,
  ): void {
    const idStr = String(item.id);

    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击：切换选择
      event.preventDefault();
      context.batchToolbarMiddle.toggleSelection(context.toolbarContext, idStr, index);
      context.updateSelectionUI();
    } else if (event.shiftKey) {
      // Shift + 点击：范围选择
      event.preventDefault();
      context.batchToolbarMiddle.rangeSelect(context.toolbarContext, context.items, index);
      context.updateSelectionUI();
    } else {
      // 普通点击：打开详情
      this.handleOpenDetail(item);
    }
  }

  /**
   * 处理打开详情 - 子类必须实现
   */
  protected abstract handleOpenDetail(item: IEventStrategyItem): void;
}
