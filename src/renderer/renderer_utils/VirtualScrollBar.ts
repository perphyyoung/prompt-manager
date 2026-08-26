/**
 * 自定义虚拟滚动条（参考 lap ScrollBar.vue）
 *
 * 与内容区解耦的独立滚动条：以"项索引"为模型，
 *   - total     当前查询命中的总项数
 *   - pageSize  一屏可容纳的项数（列数 × 可视行数）
 *   - startIndex首个可见项索引（modelValue）
 * 拖动 thumb / 点击 track / 点击翻页按钮 → onSeek(startIndex) 回调，
 * 由使用方映射为容器 scrollTop；容器自身滚动时调用 setStartIndex 反向同步 thumb。
 */

export interface VirtualScrollBarOptions {
  /** 挂载点（内部整体重绘） */
  mount: HTMLElement;
  /** 总项数 */
  getTotal: () => number;
  /** 一屏项数（列数 × 可视行数） */
  getPageSize: () => number;
  /** 用户拖动/翻页请求跳转到某起始索引 */
  onSeek: (startIndex: number) => void;
}

const MIN_THUMB_HEIGHT = 30;

export class VirtualScrollBar {
  private readonly mount: HTMLElement;
  private readonly getTotal: () => number;
  private readonly getPageSize: () => number;
  private readonly onSeek: (startIndex: number) => void;

  private track: HTMLElement | null = null;
  private thumb: HTMLElement | null = null;
  private startIndex = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartThumbTop = 0;

  constructor(options: VirtualScrollBarOptions) {
    this.mount = options.mount;
    this.getTotal = options.getTotal;
    this.getPageSize = options.getPageSize;
    this.onSeek = options.onSeek;
    this.render();
  }

  /** 容器滚动后反向同步 thumb 位置（不触发 onSeek） */
  setStartIndex(index: number): void {
    if (this.isDragging) return;
    const clamped = Math.max(0, Math.floor(index));
    if (clamped === this.startIndex) {
      this.updateThumb();
      return;
    }
    this.startIndex = clamped;
    this.updateThumb();
  }

  /** total/pageSize 变化后重新计算尺寸并渲染 */
  update(): void {
    this.updateThumb();
  }

  destroy(): void {
    // 拖拽中销毁时兜底：复位文本选中状态并卸载全局监听
    this.detachGlobalDragListeners();
    document.body.style.userSelect = '';
    this.mount.innerHTML = '';
    this.track = null;
    this.thumb = null;
  }

  // ==================== 内部实现 ====================

  private render(): void {
    this.mount.innerHTML = `
      <div class="vsb">
        <button type="button" class="vsb__page-btn vsb__page-btn--up" title="上一页">▲</button>
        <div class="vsb__track">
          <div class="vsb__thumb"></div>
        </div>
        <button type="button" class="vsb__page-btn vsb__page-btn--down" title="下一页">▼</button>
      </div>
    `;
    this.track = this.mount.querySelector('.vsb__track');
    this.thumb = this.mount.querySelector('.vsb__thumb');

    this.thumb?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isDragging = true;
      this.dragStartY = e.clientY;
      this.dragStartThumbTop = this.currentThumbTop();
      document.body.style.userSelect = 'none';
      // 仅拖拽期间挂载全局监听，避免实例全生命周期的常驻开销
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mouseup', this.handleMouseUp);
    });
    this.track?.addEventListener('click', (e) => {
      if (!this.track) return;
      const rect = this.track.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const halfThumb = this.thumbHeightPx() / 2;
      const targetTop = Math.max(0, Math.min(clickY - halfThumb, this.maxThumbTop()));
      this.seekFromThumbTop(targetTop);
    });
    this.mount.querySelector('.vsb__page-btn--up')?.addEventListener('click', () => {
      this.seek(Math.max(0, this.startIndex - Math.max(1, this.getPageSize())));
    });
    this.mount.querySelector('.vsb__page-btn--down')?.addEventListener('click', () => {
      const maxOffset = Math.max(0, this.getTotal() - Math.max(1, this.getPageSize()));
      this.seek(Math.min(maxOffset, this.startIndex + Math.max(1, this.getPageSize())));
    });

    this.updateThumb();
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const deltaY = e.clientY - this.dragStartY;
    this.seekFromThumbTop(this.dragStartThumbTop + deltaY);
  };

  private handleMouseUp = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.body.style.userSelect = '';
    this.detachGlobalDragListeners();
  };

  /** 卸载拖拽期间挂载的全局监听（幂等） */
  private detachGlobalDragListeners(): void {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  private seek(index: number): void {
    const clamped = Math.max(0, Math.min(Math.round(index), this.maxOffset()));
    if (clamped === this.startIndex) return;
    this.startIndex = clamped;
    this.updateThumb();
    this.onSeek(this.startIndex);
  }

  private seekFromThumbTop(top: number): void {
    const maxTop = this.maxThumbTop();
    if (maxTop <= 0) return;
    const clampedTop = Math.max(0, Math.min(top, maxTop));
    this.seek((clampedTop / maxTop) * this.maxOffset());
  }

  private thumbHeightPx(): number {
    const trackH = this.track?.clientHeight || 0;
    if (this.getTotal() <= 0) return MIN_THUMB_HEIGHT;
    const h = trackH * (Math.min(this.getPageSize(), this.getTotal()) / this.getTotal());
    return Math.min(Math.max(MIN_THUMB_HEIGHT, h), trackH);
  }

  private maxThumbTop(): number {
    return Math.max(0, (this.track?.clientHeight || 0) - this.thumbHeightPx());
  }

  private maxOffset(): number {
    return Math.max(0, this.getTotal() - Math.max(1, this.getPageSize()));
  }

  private currentThumbTop(): number {
    return parseFloat(this.thumb?.style.top || '0') || 0;
  }

  private updateThumb(): void {
    if (!this.thumb || !this.track) return;
    const total = this.getTotal();
    const pageSize = Math.max(1, this.getPageSize());
    const thumbH = this.thumbHeightPx();
    const maxTop = this.maxThumbTop();
    const maxOffset = Math.max(1, this.maxOffset());
    const top = total <= pageSize ? 0 : Math.min(Math.max(0, (this.startIndex / maxOffset) * maxTop), maxTop);
    const canScroll = total > pageSize;
    this.thumb.style.height = `${thumbH}px`;
    this.thumb.style.top = `${top}px`;
    this.thumb.style.display = canScroll ? '' : 'none';
  }
}
