/**
 * 虚拟窗口渲染器：封装"哪些项可见 → 渲染哪些卡片"的通用机制
 *
 * 与 VirtualScroller（纯窗口计算）配合，负责：
 *   - 可见窗口的 DOM 渲染（无重叠走全量重建，有重叠走 head/tail 增量修补）
 *   - 列数变化时的几何失效与全量重建
 *   - 未加载数据区的钳制渲染（进度条快拖时窗口可越过已加载分页，
 *     对 undefined 渲染卡片会抛错；缺口由分页追赶补齐后经强制刷新补渲染）
 *
 * 卡片生成、事件绑定、背景图加载等面板差异通过宿主回调注入；
 * 图像主页与提示词主页共用本实现，避免逻辑双份维护。
 */
import { VirtualScroller, type VisibleRange } from "./VirtualScroller.ts";

/**
 * 虚拟窗口渲染器的宿主回调
 * （宿主通常为主列表管理器，提供数据、几何参数与渲染副作用）
 */
export interface IVirtualWindowHost<T> {
  /** 当前已加载的全量数据（顺序与全局索引一致） */
  getData(): T[];
  /** 每行列数 */
  getColumns(): number;
  /** 单行高度（px，含行间距） */
  getRowHeight(): number;
  /** 卡片边长（px，正方形网格） */
  getCardSize(): number;
  /** 渲染单个卡片 HTML（不含 absolute 定位壳） */
  renderCardHtml(item: T, index: number): string;
  /** 容器级事件委托绑定（每次窗口渲染后用全量数据重绑） */
  onBindContainerEvents(data: T[]): void;
  /** 窗口内新增卡片的按钮级事件绑定（逐元素） */
  onBindItemButtons(items: T[]): void;
  /** 加载卡片背景图/缩略图 */
  onLoadItemImages(items: T[]): Promise<void>;
  /** 绑定 hover 预览（含面板各自的卡片选择器） */
  onBindHoverPreview(): void;
  /** 窗口落位后的钩子（用于分页追赶） */
  onWindowSettled(): void;
}

export class VirtualWindowRenderer<T> {
  private readonly host: IVirtualWindowHost<T>;
  private scroller: VirtualScroller | null = null;
  private wrapper: HTMLElement | null = null;
  /** 上次实际渲染的窗口区间（已按已加载数据钳制），null 表示需全量重建 */
  private lastWindowRange: VisibleRange | null = null;
  private lastColumns = 0;

  constructor(host: IVirtualWindowHost<T>) {
    this.host = host;
  }

  /** 挂载到滚动容器与内容包裹层（重复调用会先销毁旧实例） */
  attach(container: HTMLElement, wrapper: HTMLElement): void {
    this.destroy();
    this.wrapper = wrapper;
    this.lastColumns = this.host.getColumns();
    this.scroller = new VirtualScroller(
      {
        container,
        wrapper,
        getRowHeight: () => this.host.getRowHeight(),
        getColumns: () => this.host.getColumns(),
      },
      (range) => this.render(range),
    );
    this.scroller.observeResize();
  }

  /** 销毁内部滚动器并清理状态（DOM 由调用方重建） */
  destroy(): void {
    this.scroller?.destroy();
    this.scroller = null;
    this.wrapper = null;
    this.lastWindowRange = null;
  }

  /** 更新总项数（数据库全量计数）并刷新占位与窗口 */
  setTotalCount(total: number): void {
    this.scroller?.setTotalCount(total);
  }

  /**
   * 重算可见窗口；rAF 合帧，区间变化时触发渲染
   * @param force - 强制重算（忽略区间比对）
   */
  refresh(force = false): void {
    this.scroller?.refresh(force);
  }

  /** 当前可见窗口的原始区间（未钳制），未初始化时返回 null */
  getVisibleRange(): VisibleRange | null {
    return this.scroller ? this.scroller.getVisibleRange() : null;
  }

  /** 使已渲染窗口失效，下次渲染强制全量重建 */
  invalidateWindow(): void {
    this.lastWindowRange = null;
  }

  /** 强制下一帧全量重建当前窗口（行高/列数等几何或卡片背景失效时使用） */
  requestFullRerender(): void {
    this.invalidateWindow();
    this.refresh(true);
  }

  /**
   * 渲染可见窗口内的卡片（VirtualScroller 回调）
   * 与上次窗口有重叠且列数未变时走增量路径（head/tail 增删节点，复用已有卡片 DOM，
   * 背景图不重复加载）；窗口跳跃、首次渲染或几何变化时全量重建
   */
  render(range: VisibleRange): void {
    const wrapper = this.wrapper;
    if (!wrapper) return;

    // 几何失效：列数变化后既有节点的坐标全部过期，强制全量重建
    const columns = this.host.getColumns();
    if (columns !== this.lastColumns) {
      this.lastWindowRange = null;
      this.lastColumns = columns;
    }

    const prev = this.lastWindowRange;
    // 进度条快速拖动时窗口可越过已加载数据边界（totalCount 是数据库总数，
    // 数据仅含已加载分页）；未加载区钳制为空，避免对 undefined 渲染卡片报错，
    // 缺口由 onWindowSettled 的分页追赶加载后经 requestFullRerender 补渲染
    const dataLength = this.host.getData().length;
    const viewRange: VisibleRange = {
      start: Math.min(range.start, dataLength),
      end: Math.min(range.end, dataLength),
    };

    // 有重叠即可增量修补（head/tail 增删），无重叠说明窗口跳跃过大，走全量重建
    const canPatch = prev !== null && viewRange.start < prev.end && prev.start < viewRange.end;

    if (!prev || !canPatch) {
      this.rebuildWindow(wrapper, viewRange);
      return;
    }

    // ---- 增量路径：仅创建/移除进出视口的卡片 ----
    const added: T[] = [];
    const parseNodes = (item: T, index: number): Node[] => {
      added.push(item);
      const doc = new DOMParser().parseFromString(
        this.createPositionedCard(item, index),
        "text/html",
      );
      return Array.from(doc.body.childNodes);
    };

    if (viewRange.start > prev.start) {
      // 向下滚动：移除头部多余卡片
      for (let i = 0; i < viewRange.start - prev.start; i++) {
        wrapper.firstElementChild?.remove();
      }
    } else if (viewRange.start < prev.start) {
      // 向上滚动：头部插入新进入的卡片
      const frag = document.createDocumentFragment();
      for (let i = viewRange.start; i < prev.start; i++) {
        frag.append(...parseNodes(this.host.getData()[i], i));
      }
      wrapper.insertBefore(frag, wrapper.firstChild);
    }

    if (viewRange.end > prev.end) {
      // 尾部追加新进入的卡片
      const frag = document.createDocumentFragment();
      for (let i = prev.end; i < viewRange.end; i++) {
        frag.append(...parseNodes(this.host.getData()[i], i));
      }
      wrapper.append(frag);
    } else if (viewRange.end < prev.end) {
      for (let i = 0; i < prev.end - viewRange.end; i++) {
        wrapper.lastElementChild?.remove();
      }
    }

    this.host.onBindContainerEvents(this.host.getData());
    if (added.length > 0) {
      this.host.onBindItemButtons(added);
      void this.host.onLoadItemImages(added);
      this.host.onBindHoverPreview();
    }
    this.lastWindowRange = { start: viewRange.start, end: viewRange.end };
    this.host.onWindowSettled();
  }

  /** 全量重建窗口内容（range 应为已钳制的区间） */
  private rebuildWindow(wrapper: HTMLElement, range: VisibleRange): void {
    const html = Array.from({ length: Math.max(0, range.end - range.start) }, (_, i) =>
      this.createPositionedCard(this.host.getData()[range.start + i], range.start + i),
    ).join("");

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    wrapper.replaceChildren(...Array.from(doc.body.childNodes));

    // 容器级事件委托需绑定最新全量数组；按钮/背景图/hover 为逐元素绑定，仅窗口内重绑
    this.host.onBindContainerEvents(this.host.getData());
    const windowItems = this.host.getData().slice(range.start, range.end);
    if (windowItems.length > 0) {
      this.host.onBindItemButtons(windowItems);
      void this.host.onLoadItemImages(windowItems);
    }
    this.host.onBindHoverPreview();
    this.lastWindowRange = { start: range.start, end: range.end };
    this.host.onWindowSettled();
  }

  /**
   * 生成带 absolute 定位壳的卡片 HTML
   * top/left 由全局索引与当前列数计算，与 wrapper 高度公式一致
   */
  private createPositionedCard(item: T, index: number): string {
    const columns = Math.max(1, this.host.getColumns());
    const row = Math.floor(index / columns);
    const col = index % columns;
    const top = row * this.host.getRowHeight();
    const left = col * this.host.getRowHeight();
    const cardSize = this.host.getCardSize();
    return `<div class="virtual-item" style="top:${top}px;left:${left}px;width:${cardSize}px;height:${cardSize}px">${this.host.renderCardHtml(item, index)}</div>`;
  }
}
