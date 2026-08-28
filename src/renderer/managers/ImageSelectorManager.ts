import { HtmlUtils } from "../../utils/index.ts";
import { Constants } from "../../constants.ts";
import { IImage } from "../../types/entities.ts";
import type { IApp } from "../app.types.ts";

/**
 * ImageSelectorManager 构造选项
 */
interface IImageSelectorManagerOptions {
  app: IApp;
}

/**
 * 打开选项
 */
interface IOpenOptions {
  onConfirm?: (image: IImage) => void | Promise<void>;
}

/**
 * 图像选择器管理器
 * 负责管理提示词编辑时的图像选择功能
 */
export class ImageSelectorManager {
  private app: IApp;

  // 选择状态
  private selectedImages: Array<{ id: string; path: string }>;
  private onConfirm: ((image: IImage) => void | Promise<void>) | null;

  // 排序状态（独立于主界面的排序设置）
  private sortBy: string;
  private sortOrder: string;

  // 默认加载数量
  private readonly pageSize = 100;

  // 搜索防抖计时器
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly searchDebounceMs = 300;

  // 事件绑定标记
  private eventsBound = false;

  constructor(options: IImageSelectorManagerOptions) {
    this.app = options.app;

    // 选择状态
    this.selectedImages = [];
    this.onConfirm = null;

    // 排序状态（独立于主界面的排序设置）
    this.sortBy =
      localStorage.getItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY) || "updatedAt";
    this.sortOrder =
      localStorage.getItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER) || "desc";
  }

  /**
   * 打开图像选择器
   * @param options - 选项
   */
  async open(options: IOpenOptions = {}): Promise<void> {
    const modal = document.getElementById(Constants.Ids.IMAGE_SELECTOR_MODAL);
    if (modal) {
      modal.classList.add("active");
    }

    // 初始化选择状态
    this.selectedImages = [];
    this.onConfirm = options.onConfirm || null;
    const confirmBtn = document.getElementById(
      Constants.Ids.CONFIRM_IMAGE_SELECTOR_BTN,
    ) as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    // 重置搜索和筛选状态
    const searchInput = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_SEARCH_INPUT,
    ) as HTMLInputElement | null;
    const tagFilter = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_TAG_FILTER,
    ) as HTMLSelectElement | null;
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    if (tagFilter) tagFilter.value = "";

    // 加载图像列表
    await this.renderGrid();
    await this.renderTagFilters();

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 关闭图像选择器
   */
  close(): void {
    const modal = document.getElementById(Constants.Ids.IMAGE_SELECTOR_MODAL);
    if (modal) {
      modal.classList.remove("active");
    }
    this.selectedImages = [];
    this.onConfirm = null;

    // 关闭时清除搜索防抖计时器，避免延迟查询
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  /**
   * 渲染图像选择器网格
   */
  async renderGrid(): Promise<void> {
    const grid = document.getElementById(Constants.Ids.IMAGE_SELECTOR_GRID);
    const emptyState = document.getElementById(Constants.Ids.IMAGE_SELECTOR_EMPTY);
    const infoEl = document.getElementById(Constants.Ids.IMAGE_SELECTOR_INFO);
    const searchInput = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_SEARCH_INPUT,
    ) as HTMLInputElement | null;
    const tagFilter = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_TAG_FILTER,
    ) as HTMLSelectElement | null;

    if (!grid || !emptyState) return;

    try {
      const searchTerm = searchInput?.value?.trim();
      const selectedTag = tagFilter?.value;

      const options: import("../../shared/domain/database-types.js").GetImagesPaginatedOptions = {
        sortBy: this.sortBy || "updatedAt",
        sortOrder: this.sortOrder === "asc" ? "asc" : "desc",
        searchQuery: searchTerm || undefined,
        tagNames: selectedTag ? [selectedTag] : undefined,
        isSafe: this.app.safeMode === "safe" ? true : undefined,
        limit: this.pageSize,
        offset: 0,
      };

      const page = await window.electronAPI.getImagesPaginated(options);
      const images = page.items;

      this.updateInfoText(infoEl, images.length, page.totalCount, searchTerm, selectedTag);

      if (images.length === 0) {
        grid.innerHTML = "";
        grid.style.display = "none";
        emptyState.style.display = "block";
        if (infoEl) infoEl.style.display = "none";
        return;
      }

      grid.style.display = "grid";
      emptyState.style.display = "none";
      if (infoEl) infoEl.style.display = "block";

      // 批量获取所有图像的完整路径（单次 IPC 调用）
      const relativePaths = images.map((img) => img.relativePath || "");
      const fullPaths = await window.electronAPI.getImagesPaths(relativePaths);
      const imageItems = images.map((image, index) => ({ ...image, fullPath: fullPaths[index] }));

      grid.innerHTML = imageItems
        .map(
          (image) => `
        <div class="image-selector-item" data-image-id="${image.id}" data-image-path="${HtmlUtils.escapeHtml(image.relativePath || "")}">
          <img src="file://${HtmlUtils.escapeHtml(image.fullPath)}" alt="${HtmlUtils.escapeHtml(image.fileName)}" loading="lazy">
        </div>
      `,
        )
        .join("");

      // 绑定点击事件
      grid.querySelectorAll(".image-selector-item").forEach((item) => {
        item.addEventListener("click", () => {
          // 单选模式
          grid
            .querySelectorAll(".image-selector-item")
            .forEach((i) => i.classList.remove("selected"));
          item.classList.add("selected");

          const imageId = (item as HTMLElement).dataset.imageId;
          const imagePath = (item as HTMLElement).dataset.imagePath;
          if (imageId && imagePath) {
            this.selectedImages = [{ id: imageId, path: imagePath }];
            const confirmBtn = document.getElementById(
              Constants.Ids.CONFIRM_IMAGE_SELECTOR_BTN,
            ) as HTMLButtonElement | null;
            if (confirmBtn) {
              confirmBtn.disabled = false;
            }
          }
        });
      });
    } catch (error) {
      window.electronAPI.logError(
        "ImageSelectorManager.ts",
        "Failed to render image selector:",
        error,
      );
      grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">加载失败</p>';
      if (infoEl) infoEl.style.display = "none";
    }
  }

  /**
   * 更新总数提示文本
   */
  private updateInfoText(
    infoEl: HTMLElement | null,
    displayedCount: number,
    totalCount: number,
    searchTerm?: string,
    selectedTag?: string,
  ): void {
    if (!infoEl) return;

    const hasFilter = !!searchTerm || !!selectedTag;
    if (hasFilter) {
      infoEl.textContent = `找到 ${totalCount} 张匹配图像，显示前 ${displayedCount} 张`;
    } else {
      infoEl.textContent = `共 ${totalCount} 张图像，显示最近更新的 ${displayedCount} 张`;
    }
  }

  /**
   * 渲染图像选择器标签筛选器
   */
  async renderTagFilters(): Promise<void> {
    const tagFilter = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_TAG_FILTER,
    ) as HTMLSelectElement | null;
    if (!tagFilter) return;

    try {
      const tags: string[] = await window.electronAPI.getImageTags();
      tagFilter.innerHTML =
        '<option value="">所有标签</option>' +
        tags
          .map(
            (tag) =>
              `<option value="${HtmlUtils.escapeHtml(tag)}">${HtmlUtils.escapeHtml(tag)}</option>`,
          )
          .join("");
    } catch (error) {
      window.electronAPI.logError(
        "ImageSelectorManager.ts",
        "Failed to render image selector tag filters:",
        error,
      );
    }
  }

  /**
   * 绑定图像选择器事件
   */
  bindEvents(): void {
    // 避免重复绑定事件
    if (this.eventsBound) return;
    this.eventsBound = true;

    // 关闭按钮
    document
      .getElementById(Constants.Ids.CLOSE_IMAGE_SELECTOR_MODAL)
      ?.addEventListener("click", () => this.close());
    document
      .getElementById(Constants.Ids.CANCEL_IMAGE_SELECTOR_BTN)
      ?.addEventListener("click", () => this.close());

    // 搜索输入
    const searchInput = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_SEARCH_INPUT,
    ) as HTMLInputElement | null;
    const clearImageSelectorSearchBtn = document.getElementById(
      Constants.Ids.CLEAR_IMAGE_SELECTOR_SEARCH_BTN,
    );
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        // 防抖处理搜索输入
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
          this.searchDebounceTimer = null;
          this.renderGrid();
        }, this.searchDebounceMs);

        // 显示/隐藏清空按钮（立即响应）
        if (clearImageSelectorSearchBtn) {
          clearImageSelectorSearchBtn.style.display = searchInput.value ? "flex" : "none";
        }
      });
    }
    // 清空选择图像搜索按钮
    if (clearImageSelectorSearchBtn) {
      clearImageSelectorSearchBtn.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
        }
        this.renderGrid();
        clearImageSelectorSearchBtn.style.display = "none";
        if (searchInput) {
          searchInput.focus();
        }
      });
    }

    // 标签筛选
    const tagFilter = document.getElementById(Constants.Ids.IMAGE_SELECTOR_TAG_FILTER);
    if (tagFilter) {
      tagFilter.addEventListener("change", () => {
        this.renderGrid();
      });
    }

    // 排序选择（使用独立的状态）
    const sortSelect = document.getElementById(
      Constants.Ids.IMAGE_SELECTOR_SORT_SELECT,
    ) as HTMLSelectElement | null;
    if (sortSelect) {
      sortSelect.value = `${this.sortBy}-${this.sortOrder}`;
      sortSelect.addEventListener("change", (e) => {
        const [sortBy, sortOrder] = (e.target as HTMLSelectElement).value.split("-");
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY, sortBy);
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER, sortOrder);
        this.renderGrid();
      });
    }

    // 排序逆序按钮（使用独立的状态）
    const sortReverseBtn = document.getElementById(Constants.Ids.IMAGE_SELECTOR_SORT_REVERSE_BTN);
    if (sortReverseBtn) {
      sortReverseBtn.addEventListener("click", () => {
        this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER, this.sortOrder);
        if (sortSelect) {
          sortSelect.value = `${this.sortBy}-${this.sortOrder}`;
        }
        this.renderGrid();
      });
    }

    // 确认选择
    document
      .getElementById(Constants.Ids.CONFIRM_IMAGE_SELECTOR_BTN)
      ?.addEventListener("click", () => {
        this.confirmSelection();
      });

    // 点击外部关闭
    const modal = document.getElementById(Constants.Ids.IMAGE_SELECTOR_MODAL);
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (this.app.isSameId((e.target as HTMLElement).id, Constants.Ids.IMAGE_SELECTOR_MODAL))
          this.close();
      });
    }
  }

  /**
   * 确认图像选择
   */
  async confirmSelection(): Promise<void> {
    if (!this.selectedImages || this.selectedImages.length === 0) return;

    const selectedImage = this.selectedImages[0];

    // 获取完整图像信息
    try {
      const image = await window.electronAPI.getImageById(selectedImage.id);
      if (image && this.onConfirm) {
        await this.onConfirm(image);
      }
    } catch (error) {
      window.electronAPI.logError("ImageSelectorManager.ts", "Failed to get image details:", error);
    }

    this.close();
  }
}
