import { HtmlUtils } from "../../utils/index.ts";

/**
 * ImagePreviewManager 构造选项
 */
interface IImagePreviewManagerOptions {
  containerId: string;
  onRemove?: (index: number) => void | Promise<void>;
  onReorder?: (fromIndex: number, toIndex: number) => void | Promise<void>;
  onClick?: (index: number) => void | Promise<void>;
}

/**
 * 图像信息
 */
interface IImageInfo {
  id?: string;
  fileName: string;
  relativePath?: string;
  [key: string]: unknown;
}

/**
 * 图像预览管理器
 * 负责管理图像预览列表的渲染和交互
 */
export class ImagePreviewManager {
  private containerId: string;
  private container: HTMLElement | null;
  private onRemove: ((index: number) => void | Promise<void>) | null;
  private onReorder: ((fromIndex: number, toIndex: number) => void | Promise<void>) | null;
  private onClick: ((index: number) => void | Promise<void>) | null;

  // 拖拽状态
  private draggedIndex: number | null;
  private dragOverIndex: number | null;

  constructor(options: IImagePreviewManagerOptions) {
    this.containerId = options.containerId;
    this.container = null;
    this.onRemove = options.onRemove || null;
    this.onReorder = options.onReorder || null;
    this.onClick = options.onClick || null;

    // 拖拽状态
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  /**
   * 获取容器元素
   * @returns 容器元素或 null
   */
  getContainer(): HTMLElement | null {
    if (!this.container) {
      this.container = document.getElementById(this.containerId);
    }
    return this.container;
  }

  /**
   * 渲染预览列表（用于新上传的文件）
   * @param filePaths - 文件路径数组
   */
  render(filePaths: string[]): void {
    const container = this.getContainer();
    if (!container) return;

    if (!filePaths || filePaths.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = filePaths
      .map(
        (path, index) => `
      <div class="image-preview-item" data-index="${index}" draggable="true">
        <img src="file://${HtmlUtils.escapeHtml(path)}" alt="预览" loading="lazy">
        <button class="remove-image" data-index="${index}" title="删除">×</button>
        ${this.onReorder ? '<div class="drag-handle" title="拖动排序">⋮⋮</div>' : ""}
      </div>
    `,
      )
      .join("");

    this.bindItemEvents();
  }

  /**
   * 渲染已保存的图像列表（用于编辑时显示已关联的图像）
   * @param images - 图像对象数组
   */
  async renderSavedImages(images: IImageInfo[]): Promise<void> {
    const container = this.getContainer();
    if (!container) return;

    if (!images || images.length === 0) {
      container.innerHTML = "";
      return;
    }

    // 获取所有图像的完整路径
    const imageItems = await Promise.all(
      images.map(async (image, index) => {
        const imagePath = image.relativePath;
        const fullPath = imagePath ? await window.electronAPI.getImagePath(imagePath) : "";
        return {
          ...image,
          fullPath,
          index,
        };
      }),
    );

    container.innerHTML = imageItems
      .map(
        (item) => `
      <div class="image-preview-item" data-index="${item.index}" data-saved="true" draggable="true">
        <img src="file://${HtmlUtils.escapeHtml(item.fullPath)}" alt="${HtmlUtils.escapeHtml(item.fileName)}" loading="lazy">
        <button class="remove-image" data-index="${item.index}" title="删除">×</button>
        ${this.onReorder ? '<div class="drag-handle" title="拖动排序">⋮⋮</div>' : ""}
      </div>
    `,
      )
      .join("");

    this.bindItemEvents();
  }

  /**
   * 清空预览列表
   */
  clear(): void {
    const container = this.getContainer();
    if (container) {
      container.innerHTML = "";
    }
  }

  /**
   * 绑定事件（事件委托）
   * 只需调用一次，后续渲染的内容会自动继承这些事件
   */
  bindEvents(): void {
    const container = this.getContainer();
    if (!container) return;

    // 使用事件委托处理所有交互
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // 处理删除按钮点击
      if (target.classList.contains("remove-image")) {
        e.stopPropagation();
        const index = parseInt(target.dataset.index || "-1", 10);
        if (index >= 0 && this.onRemove) {
          this.onRemove(index);
        }
        return;
      }

      // 处理图像点击
      const previewItem = target.closest(".image-preview-item");
      if (previewItem && this.onClick) {
        const index = parseInt((previewItem as HTMLElement).dataset.index || "-1", 10);
        if (index >= 0) {
          this.onClick(index);
        }
      }
    });

    // 绑定拖拽事件
    if (this.onReorder) {
      this.bindDragEvents(container);
    }
  }

  /**
   * 绑定单个项目的事件（用于动态添加的项目）
   * @private
   */
  private bindItemEvents(): void {
    // 事件委托已经在 bindEvents 中设置，这里不需要额外绑定
    // 这个方法保留用于兼容性
  }

  /**
   * 绑定拖拽事件
   * @param container - 容器元素
   * @private
   */
  private bindDragEvents(container: HTMLElement): void {
    container.addEventListener("dragstart", (e) => {
      const item = (e.target as HTMLElement).closest(".image-preview-item");
      if (!item) return;

      this.draggedIndex = parseInt((item as HTMLElement).dataset.index || "-1", 10);
      item.classList.add("dragging");

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
      }
    });

    container.addEventListener("dragend", (e) => {
      const item = (e.target as HTMLElement).closest(".image-preview-item");
      if (item) {
        item.classList.remove("dragging");
      }

      // 清除所有拖拽样式
      container.querySelectorAll(".drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });

      this.draggedIndex = null;
      this.dragOverIndex = null;
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();

      if (this.draggedIndex === null) return;

      const targetItem = (e.target as HTMLElement).closest(".image-preview-item");
      if (!targetItem) return;

      const targetIndex = parseInt((targetItem as HTMLElement).dataset.index || "-1", 10);
      if (targetIndex === this.draggedIndex) return;

      // 添加拖拽悬停样式
      container.querySelectorAll(".drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
      targetItem.classList.add("drag-over");

      this.dragOverIndex = targetIndex;
    });

    container.addEventListener("dragleave", (e) => {
      const targetItem = (e.target as HTMLElement).closest(".image-preview-item");
      if (targetItem) {
        targetItem.classList.remove("drag-over");
      }
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();

      if (this.draggedIndex === null || this.dragOverIndex === null) return;
      if (this.draggedIndex === this.dragOverIndex) return;

      // 执行重排序
      if (this.onReorder) {
        this.onReorder(this.draggedIndex, this.dragOverIndex);
      }

      // 清除样式
      container.querySelectorAll(".drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });

      this.draggedIndex = null;
      this.dragOverIndex = null;
    });
  }

  /**
   * 更新指定索引的图像
   * @param index - 索引
   * @param filePath - 新的文件路径
   */
  updateImage(index: number, filePath: string): void {
    const container = this.getContainer();
    if (!container) return;

    const item = container.querySelector(`.image-preview-item[data-index="${index}"]`);
    if (item) {
      const img = item.querySelector("img");
      if (img) {
        img.src = `file://${HtmlUtils.escapeHtml(filePath)}`;
      }
    }
  }

  /**
   * 移除指定索引的图像
   * @param index - 索引
   */
  removeImage(index: number): void {
    const container = this.getContainer();
    if (!container) return;

    const item = container.querySelector(`.image-preview-item[data-index="${index}"]`);
    if (item) {
      item.remove();
      // 重新索引剩余的项
      this.reindexItems();
    }
  }

  /**
   * 重新索引所有项目
   * @private
   */
  private reindexItems(): void {
    const container = this.getContainer();
    if (!container) return;

    const items = container.querySelectorAll(".image-preview-item");
    items.forEach((item, index) => {
      (item as HTMLElement).dataset.index = String(index);
      const removeBtn = item.querySelector(".remove-image");
      if (removeBtn) {
        (removeBtn as HTMLElement).dataset.index = String(index);
      }
    });
  }

  /**
   * 获取当前图像数量
   * @returns 图像数量
   */
  getImageCount(): number {
    const container = this.getContainer();
    if (!container) return 0;
    return container.querySelectorAll(".image-preview-item").length;
  }

  /**
   * 设置删除回调
   * @param callback - 回调函数
   */
  setOnRemove(callback: (index: number) => void | Promise<void>): void {
    this.onRemove = callback;
  }

  /**
   * 设置重排序回调
   * @param callback - 回调函数
   */
  setOnReorder(callback: (fromIndex: number, toIndex: number) => void | Promise<void>): void {
    this.onReorder = callback;
  }

  /**
   * 设置点击回调
   * @param callback - 回调函数
   */
  setOnClick(callback: (index: number) => void | Promise<void>): void {
    this.onClick = callback;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.clear();
    this.container = null;
    this.onRemove = null;
    this.onReorder = null;
    this.onClick = null;
  }
}
