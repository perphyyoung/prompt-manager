/**
 * 虚拟滚动器（lap 模式：wrapper 固定高度 + 子项 absolute 定位）
 *
 * 仅负责"哪些项可见"的窗口计算与内容包裹层总高维护，
 * DOM 渲染由使用者通过 onWindowChange 回调完成。
 *
 * 结构：
 *   container（滚动容器）
 *   └─ wrapper（height = 总行数 × 行高，position:relative）
 *      └─ 可见卡片（position:absolute，top/left 由索引计算）
 *
 * wrapper 高度恒定 → scrollHeight 稳定 → 无 scroll anchoring 冲突，
 * 内容整屏替换不影响滚动位置。
 */

export interface VirtualScrollerConfig {
  /** 滚动容器 */
  container: HTMLElement;
  /** 内容包裹层：固定总高撑起 scrollHeight，可见卡片绝对定位其上 */
  wrapper: HTMLElement;
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
  private readonly wrapper: HTMLElement;
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
    bufferRows: number = DEFAULT_BUFFER_ROWS,
  ) {
    this.container = config.container;
    this.wrapper = config.wrapper;
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
    if (this.resizeObserver || typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() => {
      // 列数变化会改变总行数，需强制重算占位
      this.refresh(true);
    });
    this.resizeObserver.observe(this.container);
  }

  /** 清理占位与监听 */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.wrapper.style.height = "";
    this.totalCount = 0;
    this.lastRange = { start: -1, end: -1 };
  }

  /** 计算当前窗口并维护 wrapper 总高 */
  private computeAndEmit(): void {
    const rowHeight = this.getRowHeight();
    const columns = Math.max(1, this.getColumns());
    const totalRows = Math.ceil(this.totalCount / columns);

    // wrapper 固定总高撑起 scrollHeight（不随窗口渲染变化）
    this.wrapper.style.height = `${totalRows * rowHeight}px`;

    if (this.totalCount === 0) return;
    if (rowHeight <= 0) return;

    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight || 1;

    const firstVisibleRow = Math.floor(scrollTop / rowHeight);
    const visibleRowCount = Math.ceil(viewportHeight / rowHeight);

    const startRow = Math.max(0, firstVisibleRow - this.bufferRows);
    const endRow = Math.min(totalRows, firstVisibleRow + visibleRowCount + this.bufferRows);

    const range: VisibleRange = {
      start: startRow * columns,
      end: Math.min(this.totalCount, endRow * columns),
    };

    if (range.start === this.lastRange.start && range.end === this.lastRange.end) {
      return;
    }
    this.lastRange = range;
    this.onWindowChange(range);
  }
}
