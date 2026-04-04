import { IEventStrategy, EventContext, IEventStrategyItem } from './IEventStrategy';

export class CardEventStrategy implements IEventStrategy {
  getCheckboxSelector(): string {
    return '.card-checkbox';
  }

  getItemSelector(): string {
    return '.image-card, .prompt-card, .trash-card';
  }

  getExcludeSelectors(): string[] {
    return ['.action-btn', '.card-checkbox'];
  }

  bindEvents(container: HTMLElement, items: IEventStrategyItem[], context: EventContext): void {
    items.forEach((item, index) => {
      const card = container.querySelector(`[data-id="${item.id}"]`);
      if (!card) return;

      this.bindCheckboxEvent(card, item, index, context);
      this.bindCardClickEvent(card, item, index, context);
    });
  }

  /**
   * 绑定复选框事件
   */
  private bindCheckboxEvent(card: Element, item: IEventStrategyItem, index: number, context: EventContext): void {
    const checkbox = card.querySelector(this.getCheckboxSelector()) as HTMLInputElement | null;
    if (!checkbox) return;

    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const idStr = String(item.id);
        const isChecked = (e.target as HTMLInputElement).checked;

        if (isChecked) {
          context.selectionManager.addSelectionWithIndex(idStr, index);
          context.toolbarController?.enterBatchModeIfNeeded();
        } else {
          context.selectionManager.removeSelection(idStr);
          context.toolbarController?.exitBatchModeIfEmpty();
        }

        context.renderView();
        context.toolbarController?.updateUI();
      });
  }

  /**
   * 绑定卡片点击事件
   */
  private bindCardClickEvent(card: Element, item: IEventStrategyItem, index: number, context: EventContext): void {
    card.addEventListener('click', (e) => {
      const target = e.target as Element;
      const excludeSelectors = this.getExcludeSelectors();

      // 检查是否点击了排除区域
      const isExcluded = excludeSelectors.some(selector => target.closest(selector));
      if (isExcluded) return;

      const mouseEvent = e as MouseEvent;
      this.handleCardClick(item, index, mouseEvent, context);
    });
  }

  /**
   * 处理卡片点击 - 支持 Ctrl/Shift 多选
   */
  protected handleCardClick(item: IEventStrategyItem, index: number, event: MouseEvent, context: EventContext): void {
    const idStr = String(item.id);

    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击：切换选择
      context.selectionManager.toggleSelection(idStr, index);
    } else if (event.shiftKey) {
      // Shift + 点击：范围选择
      context.selectionManager.rangeSelect(context.items, index);
    } else {
      // 普通点击：打开详情
      this.handleOpenDetail(item);
    }
  }

  /**
   * 处理打开详情 - 子类必须覆盖
   */
  protected handleOpenDetail(item: IEventStrategyItem): void {
    // 子类必须实现
    throw new Error('handleOpenDetail must be implemented by subclass');
  }
}
