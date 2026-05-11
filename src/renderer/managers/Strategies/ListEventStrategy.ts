import {
  IEventStrategy,
  EventContext,
  IEventStrategyItem,
} from "./IEventStrategy";

export abstract class ListEventStrategy implements IEventStrategy {
  getCheckboxSelector(): string {
    return ".list-item__checkbox";
  }

  getItemSelector(): string {
    return ".list-item--image, .list-item--prompt";
  }

  getExcludeSelectors(): string[] {
    return [".list-item__checkbox", ".list-item__actions"];
  }

  bindEvents(
    container: HTMLElement,
    items: IEventStrategyItem[],
    context: EventContext,
  ): void {
    // 列表视图使用事件委托更高效
    this.bindCheckboxEvents(container, items, context);
    this.bindRowClickEvents(container, items, context);
  }

  unbindEvents(container: HTMLElement): void {
    const items = container.querySelectorAll(this.getItemSelector());
    items.forEach(item => {
      const newItem = item.cloneNode(true);
      item.parentNode?.replaceChild(newItem, item);
    });
  }

  /**
   * 绑定复选框事件
   */
  private bindCheckboxEvents(
    container: HTMLElement,
    items: IEventStrategyItem[],
    context: EventContext,
  ): void {
    container
      .querySelectorAll(this.getCheckboxSelector())
      .forEach((checkbox, index) => {
        const item = items[index];
        if (!item) return;

        // 设置初始状态
        (checkbox as HTMLInputElement).checked =
          context.batchToolbarMiddle.isSelected(
            context.toolbarContext,
            String(item.id),
          );

        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const idStr = String(item.id);
          const isChecked = (e.target as HTMLInputElement).checked;

          if (isChecked) {
            context.batchToolbarMiddle.addSelectionWithIndex(
              context.toolbarContext,
              idStr,
              index,
            );
          } else {
            context.batchToolbarMiddle.removeSelection(
              context.toolbarContext,
              idStr,
            );
          }

          context.renderView();
        });
      });
  }

  /**
   * 绑定行点击事件
   */
  private bindRowClickEvents(
    container: HTMLElement,
    items: IEventStrategyItem[],
    context: EventContext,
  ): void {
    container.querySelectorAll(this.getItemSelector()).forEach((row, index) => {
      const item = items[index];
      if (!item) return;

      row.addEventListener("click", (e) => {
        const target = e.target as Element;
        const excludeSelectors = this.getExcludeSelectors();

        const isExcluded = excludeSelectors.some((selector) =>
          target.closest(selector),
        );
        if (isExcluded) return;

        this.handleRowClick(item, index, e as MouseEvent, context);
      });
    });
  }

  /**
   * 处理行点击 - 支持 Ctrl/Shift 多选
   */
  protected handleRowClick(
    item: IEventStrategyItem,
    index: number,
    event: MouseEvent,
    context: EventContext,
  ): void {
    const idStr = String(item.id);

    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击：切换选择
      context.batchToolbarMiddle.toggleSelection(
        context.toolbarContext,
        idStr,
        index,
      );
    } else if (event.shiftKey) {
      // Shift + 点击：范围选择
      context.batchToolbarMiddle.rangeSelect(
        context.toolbarContext,
        context.items,
        index,
      );
    } else {
      // 普通点击：打开详情
      this.handleOpenDetail(item);
    }
  }

  /**
   * 处理打开详情 - 子类必须覆盖
   */
  protected abstract handleOpenDetail(item: IEventStrategyItem): void;
}
