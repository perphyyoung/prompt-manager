/**
 * 虚拟滚动器
 * 仅负责"哪些项可见"的窗口计算与占位高度（padding-top/bottom）维护，
 * DOM 渲染由使用者通过 onWindowChange 回调完成。
 *
 * 前提：容器为滚动容器，子项按等高行排布（网格 grid-auto-rows 或固定高列表项），
 * 未渲染区间的高度由容器 padding 撑起，保证滚动条比例与总项数一致。
 */

export interface VirtualScrollerConfig {
  /** 滚动容器（同时是内容容器） */
  container: HTMLElement;
  /** 返回单行高度（px，含行间距） */
  getRowHeight: () => number;
  /** 返回每行列数 */
  getColumns: () => number;
}

export interface VisibleRange {
  /** 窗口起始项索引（含） */
  start: number;
  /** 窗口结束项索引（不含） */
  end: number;
}

const DEFAULT_BUFFER_ROWS = 2;

export class VirtualScroller {
  private readonly container: HTMLElement;
  private readonly getRowHeight: () => number;
  private readonly getColumns: () => number;
  private readonly onWindowChange: (range: VisibleRange) => void;
  private readonly bufferRows: number;

  private totalCount = 0;
  private lastRange: VisibleRange = { start: -1, end: -1 };
  private resizeObserver: ResizeObserver | null = null;
  private frameRequested = false;

  constructor(
    config: VirtualScrollerConfig,
    onWindowChange: (range: VisibleRange) => void,
    bufferRows: number = DEFAULT_BUFFER_ROWS
  ) {
    this.container = config.container;
    this.getRowHeight = config.getRowHeight;
    this.getColumns = config.getColumns;
    this.onWindowChange = onWindowChange;
    this.bufferRows = Math.max(0, bufferRows);
  }

  /**
   * 更新总项数并刷新占位与窗口
   * 总数不变时不强制重建窗口
   */
  setTotalCount(total: number): void {
    const next = Math.max(0, Math.floor(total));
    if (next === this.totalCount) {
      this.refresh();
      return;
    }
    this.totalCount = next;
    this.lastRange = { start: -1, end: -1 };
    this.refresh();
  }

  /** 当前可见窗口（项索引区间，end 不含）；未初始化时返回 null */
  getVisibleRange(): VisibleRange | null {
    if (this.lastRange.start < 0) return null;
    return { ...this.lastRange };
  }

  /**
   * 根据当前滚动位置重算窗口；rAF 合帧，区间变化时触发 onWindowChange
   * @param force - 强制重建窗口（忽略区间比对）
   */
  refresh(force = false): void {
    if (force) {
      this.lastRange = { start: -1, end: -1 };
    }
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      this.computeAndEmit();
    });
  }

  /** 监听容器尺寸变化（列数随宽度变化时自动刷新窗口） */
  observeResize(): void {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      // 列数变化会改变总行数，需强制重算占位
      this.refresh(true);
    });
    this.resizeObserver.observe(this.container);
  }

  /** 清理占位与监听，容器恢复为普通容器 */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.container.style.paddingTop = '';
    this.container.style.paddingBottom = '';
    this.totalCount = 0;
    this.lastRange = { start: -1, end: -1 };
  }

  /** 计算当前窗口并更新占位高度 */
  private computeAndEmit(): void {
    if (this.totalCount === 0) {
      this.container.style.paddingTop = '0px';
      this.container.style.paddingBottom = '0px';
      return;
    }

    const rowHeight = this.getRowHeight();
    const columns = Math.max(1, this.getColumns());
    if (rowHeight <= 0) return;

    const totalRows = Math.ceil(this.totalCount / columns);
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight || 1;

    const firstVisibleRow = Math.floor(scrollTop / rowHeight);
    const visibleRowCount = Math.ceil(viewportHeight / rowHeight);

    const startRow = Math.max(0, firstVisibleRow - this.bufferRows);
    const endRow = Math.min(totalRows, firstVisibleRow + visibleRowCount + this.bufferRows);

    // 用 padding 撑起未渲染区间的高度
    this.container.style.paddingTop = `${startRow * rowHeight}px`;
    this.container.style.paddingBottom = `${(totalRows - endRow) * rowHeight}px`;

    const range: VisibleRange = {
      start: startRow * columns,
      end: Math.min(this.totalCount, endRow * columns)
    };

    if (range.start === this.lastRange.start && range.end === this.lastRange.end) {
      return;
    }
    this.lastRange = range;
    this.onWindowChange(range);
  }
}
