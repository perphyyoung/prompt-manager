/**
 * 选择状态管理器
 * 集中管理多选状态，包括 selectedIds 和 lastSelectedIndex
 */

export interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedIndex: number | undefined;
}

export class SelectionManager {
  private state: SelectionState;
  private onChange: () => void;

  constructor(onChange: () => void) {
    this.state = {
      selectedIds: new Set(),
      lastSelectedIndex: undefined
    };
    this.onChange = onChange;
  }

  /**
   * 获取 selectedIds
   */
  get selectedIds(): Set<string> {
    return this.state.selectedIds;
  }

  /**
   * 获取 lastSelectedIndex
   */
  get lastSelectedIndex(): number | undefined {
    return this.state.lastSelectedIndex;
  }

  /**
   * 获取选择数量
   */
  get count(): number {
    return this.state.selectedIds.size;
  }

  /**
   * 是否已选择
   */
  isSelected(id: string): boolean {
    return this.state.selectedIds.has(id);
  }

  /**
   * 切换选择（Ctrl+点击）
   */
  toggleSelection(id: string, index: number): void {
    if (this.state.selectedIds.has(id)) {
      this.state.selectedIds.delete(id);
      // 如果取消的是 lastSelectedIndex 对应的项，清空它
      if (this.state.lastSelectedIndex === index) {
        this.state.lastSelectedIndex = undefined;
      }
    } else {
      this.state.selectedIds.add(id);
      this.state.lastSelectedIndex = index;
    }
    this.onChange();
  }

  /**
   * 范围选择（Shift+点击）
   */
  rangeSelect<T extends { id: string | number }>(items: T[], currentIndex: number): void {
    if (this.state.lastSelectedIndex === undefined) {
      // 如果没有上次选择，将当前项设为 lastSelectedIndex
      this.state.lastSelectedIndex = currentIndex;
      const item = items[currentIndex];
      if (item) {
        this.state.selectedIds.add(String(item.id));
      }
    } else {
      // 范围选择
      const start = Math.min(this.state.lastSelectedIndex, currentIndex);
      const end = Math.max(this.state.lastSelectedIndex, currentIndex);

      for (let i = start; i <= end; i++) {
        const item = items[i];
        if (item) {
          this.state.selectedIds.add(String(item.id));
        }
      }
    }
    this.onChange();
  }

  /**
   * 单选（普通点击）
   */
  singleSelect(id: string, index: number): void {
    this.state.selectedIds.clear();
    this.state.selectedIds.add(id);
    this.state.lastSelectedIndex = index;
    this.onChange();
  }

  /**
   * 添加选择（不更新 lastSelectedIndex）
   */
  addSelection(id: string): void {
    this.state.selectedIds.add(id);
    this.onChange();
  }

  /**
   * 添加选择并更新 lastSelectedIndex（用于复选框选择）
   */
  addSelectionWithIndex(id: string, index: number): void {
    this.state.selectedIds.add(id);
    this.state.lastSelectedIndex = index;
    this.onChange();
  }

  /**
   * 移除选择
   */
  removeSelection(id: string): void {
    this.state.selectedIds.delete(id);
    this.onChange();
  }

  /**
   * 清空所有选择
   */
  clear(): void {
    this.state.selectedIds.clear();
    this.state.lastSelectedIndex = undefined;
    this.onChange();
  }

  /**
   * 重置 lastSelectedIndex
   * 在筛选、排序等操作后调用，因为索引对应关系已改变
   */
  resetLastSelectedIndex(): void {
    this.state.lastSelectedIndex = undefined;
  }
}
