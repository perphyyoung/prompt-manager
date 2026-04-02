import { Constants } from '../../constants.ts';

/**
 * SearchSortManager 构造选项
 */
interface ISearchSortManagerOptions {
  app: ISearchSortManagerDeps;
}

/**
 * SearchSortManager 依赖的应用接口
 * 仅包含 SearchSortManager 需要的应用能力子集
 */
interface ISearchSortManagerDeps {
  promptPanelManager: {
    renderView: () => void;
    sortBy: string;
    sortOrder: string;
    cardSize: number;
    setCardSize: (size: number) => void;
    setViewMode: (mode: string) => void;
  } | null;
  imagePanelManager: {
    renderView: () => void;
    sortBy: string;
    sortOrder: string;
    cardSize: number;
    setCardSize: (size: number) => void;
    setViewMode: (mode: string) => void;
  } | null;
  updatePromptViewButtons?: (viewMode: string) => void;
  updateImageViewButtons?: (viewMode: string) => void;
}

/**
 * 搜索排序管理器
 * 负责处理搜索和排序功能
 */
export class SearchSortManager {
  private app: ISearchSortManagerDeps;

  // 搜索状态
  private searchQuery: string;
  private imageSearchQuery: string;

  // 防抖定时器
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null;
  private readonly searchDebounceDelay: number;

  constructor(options: ISearchSortManagerOptions = { app: {} as ISearchSortManagerDeps }) {
    this.app = options.app;

    // 搜索状态
    this.searchQuery = '';
    this.imageSearchQuery = '';

    // 防抖定时器
    this.searchDebounceTimer = null;
    this.searchDebounceDelay = 300;
  }

  /**
   * 初始化
   */
  init(): void {
    this.bindSearchEvents();
    this.bindSortEvents();
    this.bindViewToggleEvents();
  }

  /**
   * 绑定搜索事件
   * @private
   */
  private bindSearchEvents(): void {
    // 提示词搜索
    const promptSearchInput = document.getElementById('promptSearchInput') as HTMLInputElement | null;
    const clearPromptSearchBtn = document.getElementById('clearPromptSearchBtn');

    if (promptSearchInput) {
      promptSearchInput.addEventListener('input', (e) => {
        this.handlePromptSearch((e.target as HTMLInputElement).value, clearPromptSearchBtn);
      });
    }

    if (clearPromptSearchBtn) {
      clearPromptSearchBtn.addEventListener('click', () => {
        this.clearPromptSearch(promptSearchInput, clearPromptSearchBtn);
      });
    }

    // 图像搜索
    const imageSearchInput = document.getElementById('imageSearchInput') as HTMLInputElement | null;
    const clearImageSearchBtn = document.getElementById('clearImageSearchBtn');

    if (imageSearchInput) {
      imageSearchInput.addEventListener('input', (e) => {
        this.handleImageSearch((e.target as HTMLInputElement).value, clearImageSearchBtn);
      });
    }

    if (clearImageSearchBtn) {
      clearImageSearchBtn.addEventListener('click', () => {
        this.clearImageSearch(imageSearchInput, clearImageSearchBtn);
      });
    }
  }

  /**
   * 处理提示词搜索
   * @param value - 搜索值
   * @param clearBtn - 清除按钮
   * @private
   */
  private handlePromptSearch(value: string, clearBtn: HTMLElement | null): void {
    this.searchQuery = value;

    if (clearBtn) {
      clearBtn.style.display = value ? 'flex' : 'none';
    }

    // 防抖处理
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      if (this.app.promptPanelManager) {
        this.app.promptPanelManager.renderView();
      }
    }, this.searchDebounceDelay);
  }

  /**
   * 清除提示词搜索
   * @param input - 输入框
   * @param clearBtn - 清除按钮
   * @private
   */
  private clearPromptSearch(input: HTMLInputElement | null, clearBtn: HTMLElement | null): void {
    if (input) {
      input.value = '';
      input.focus();
    }
    this.searchQuery = '';

    if (clearBtn) {
      clearBtn.style.display = 'none';
    }

    if (this.app.promptPanelManager) {
      this.app.promptPanelManager.renderView();
    }
  }

  /**
   * 处理图像搜索
   * @param value - 搜索值
   * @param clearBtn - 清除按钮
   * @private
   */
  private handleImageSearch(value: string, clearBtn: HTMLElement | null): void {
    this.imageSearchQuery = value;

    if (clearBtn) {
      clearBtn.style.display = value ? 'flex' : 'none';
    }

    // 防抖处理
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      if (this.app.imagePanelManager) {
        this.app.imagePanelManager.renderView();
      }
    }, this.searchDebounceDelay);
  }

  /**
   * 清除图像搜索
   * @param input - 输入框
   * @param clearBtn - 清除按钮
   * @private
   */
  private clearImageSearch(input: HTMLInputElement | null, clearBtn: HTMLElement | null): void {
    if (input) {
      input.value = '';
      input.focus();
    }
    this.imageSearchQuery = '';

    if (clearBtn) {
      clearBtn.style.display = 'none';
    }

    if (this.app.imagePanelManager) {
      this.app.imagePanelManager.renderView();
    }
  }

  /**
   * 绑定视图切换事件
   * @private
   */
  private bindViewToggleEvents(): void {
    // 提示词视图
    document.getElementById('promptGridViewBtn')?.addEventListener('click', () => {
      this.app.promptPanelManager?.setViewMode('grid');
      this.app.updatePromptViewButtons?.('grid');
    });
    document.getElementById('promptListViewBtn')?.addEventListener('click', () => {
      this.app.promptPanelManager?.setViewMode('list');
      this.app.updatePromptViewButtons?.('list');
    });
    document.getElementById('promptCompactViewBtn')?.addEventListener('click', () => {
      this.app.promptPanelManager?.setViewMode('list-compact');
      this.app.updatePromptViewButtons?.('list-compact');
    });

    // 图像视图
    document.getElementById('imageGridViewBtn')?.addEventListener('click', () => {
      this.app.imagePanelManager?.setViewMode('grid');
      this.app.updateImageViewButtons?.('grid');
    });
    document.getElementById('imageListViewBtn')?.addEventListener('click', () => {
      this.app.imagePanelManager?.setViewMode('list');
      this.app.updateImageViewButtons?.('list');
    });
    document.getElementById('imageCompactViewBtn')?.addEventListener('click', () => {
      this.app.imagePanelManager?.setViewMode('list-compact');
      this.app.updateImageViewButtons?.('list-compact');
    });
  }

  /**
   * 绑定排序事件
   * @private
   */
  private bindSortEvents(): void {
    this.bindPromptSortEvents();
    this.bindImageSortEvents();
  }

  /**
   * 绑定提示词排序事件
   * @private
   */
  private bindPromptSortEvents(): void {
    const promptSortSelect = document.getElementById('promptSortSelect') as HTMLSelectElement | null;
    const promptSortReverseBtn = document.getElementById('promptSortReverseBtn');
    const promptCardSizeSlider = document.getElementById('promptCardSizeSlider') as HTMLInputElement | null;

    if (!this.app.promptPanelManager) return;

    // 排序选择
    if (promptSortSelect) {
      promptSortSelect.value = `${this.app.promptPanelManager.sortBy}-${this.app.promptPanelManager.sortOrder}`;
      promptSortSelect.addEventListener('change', (e) => {
        const [sortBy, sortOrder] = (e.target as HTMLSelectElement).value.split('-');
        this.setPromptSort(sortBy, sortOrder);
      });
    }

    // 排序反转
    if (promptSortReverseBtn) {
      promptSortReverseBtn.addEventListener('click', () => {
        this.togglePromptSortOrder(promptSortSelect);
      });
    }

    // 卡片大小
    if (promptCardSizeSlider) {
      promptCardSizeSlider.value = String(this.app.promptPanelManager.cardSize);
      this.app.promptPanelManager.setCardSize(this.app.promptPanelManager.cardSize);
      promptCardSizeSlider.addEventListener('input', (e) => {
        this.app.promptPanelManager?.setCardSize(parseInt((e.target as HTMLInputElement).value, 10));
      });
      promptCardSizeSlider.addEventListener('change', (e) => {
        localStorage.setItem(Constants.LocalStorageKey.PROMPT_CARD_SIZE, (e.target as HTMLInputElement).value);
      });
    }
  }

  /**
   * 设置提示词排序
   * @param sortBy - 排序字段
   * @param sortOrder - 排序顺序 (asc/desc)
   */
  setPromptSort(sortBy: string, sortOrder: string): void {
    if (!this.app.promptPanelManager) return;

    this.app.promptPanelManager.sortBy = sortBy;
    this.app.promptPanelManager.sortOrder = sortOrder;
    localStorage.setItem(Constants.LocalStorageKey.PROMPT_SORT_BY, sortBy);
    localStorage.setItem(Constants.LocalStorageKey.PROMPT_SORT_ORDER, sortOrder);
    this.app.promptPanelManager.renderView();
  }

  /**
   * 切换提示词排序顺序
   * @param sortSelect - 排序选择框
   */
  togglePromptSortOrder(sortSelect: HTMLSelectElement | null): void {
    if (!this.app.promptPanelManager) return;

    const newOrder = this.app.promptPanelManager.sortOrder === 'asc' ? 'desc' : 'asc';
    this.app.promptPanelManager.sortOrder = newOrder;
    localStorage.setItem(Constants.LocalStorageKey.PROMPT_SORT_ORDER, newOrder);

    if (sortSelect) {
      sortSelect.value = `${this.app.promptPanelManager.sortBy}-${newOrder}`;
    }

    this.app.promptPanelManager.renderView();
  }

  /**
   * 绑定图像排序事件
   * @private
   */
  private bindImageSortEvents(): void {
    const imageSortSelect = document.getElementById('imageSortSelect') as HTMLSelectElement | null;
    const imageSortReverseBtn = document.getElementById('imageSortReverseBtn');
    const imageCardSizeSlider = document.getElementById('imageCardSizeSlider') as HTMLInputElement | null;

    if (!this.app.imagePanelManager) return;

    // 排序选择
    if (imageSortSelect) {
      imageSortSelect.value = `${this.app.imagePanelManager.sortBy}-${this.app.imagePanelManager.sortOrder}`;
      imageSortSelect.addEventListener('change', (e) => {
        const [sortBy, sortOrder] = (e.target as HTMLSelectElement).value.split('-');
        this.setImageSort(sortBy, sortOrder);
      });
    }

    // 排序反转
    if (imageSortReverseBtn) {
      imageSortReverseBtn.addEventListener('click', () => {
        this.toggleImageSortOrder(imageSortSelect);
      });
    }

    // 卡片大小
    if (imageCardSizeSlider) {
      imageCardSizeSlider.value = String(this.app.imagePanelManager.cardSize);
      this.app.imagePanelManager.setCardSize(this.app.imagePanelManager.cardSize);
      imageCardSizeSlider.addEventListener('input', (e) => {
        this.app.imagePanelManager?.setCardSize(parseInt((e.target as HTMLInputElement).value, 10));
      });
      imageCardSizeSlider.addEventListener('change', (e) => {
        localStorage.setItem(Constants.LocalStorageKey.IMAGE_CARD_SIZE, (e.target as HTMLInputElement).value);
      });
    }
  }

  /**
   * 设置图像排序
   * @param sortBy - 排序字段
   * @param sortOrder - 排序顺序 (asc/desc)
   */
  setImageSort(sortBy: string, sortOrder: string): void {
    if (!this.app.imagePanelManager) return;

    this.app.imagePanelManager.sortBy = sortBy;
    this.app.imagePanelManager.sortOrder = sortOrder;
    localStorage.setItem(Constants.LocalStorageKey.IMAGE_SORT_BY, sortBy);
    localStorage.setItem(Constants.LocalStorageKey.IMAGE_SORT_ORDER, sortOrder);
    this.app.imagePanelManager.renderView();
  }

  /**
   * 切换图像排序顺序
   * @param sortSelect - 排序选择框
   */
  toggleImageSortOrder(sortSelect: HTMLSelectElement | null): void {
    if (!this.app.imagePanelManager) return;

    const newOrder = this.app.imagePanelManager.sortOrder === 'asc' ? 'desc' : 'asc';
    this.app.imagePanelManager.sortOrder = newOrder;
    localStorage.setItem(Constants.LocalStorageKey.IMAGE_SORT_ORDER, newOrder);

    if (sortSelect) {
      sortSelect.value = `${this.app.imagePanelManager.sortBy}-${newOrder}`;
    }

    this.app.imagePanelManager.renderView();
  }

  /**
   * 获取提示词搜索查询
   * @returns 搜索查询字符串
   */
  getPromptSearchQuery(): string {
    return this.searchQuery;
  }

  /**
   * 获取图像搜索查询
   * @returns 搜索查询字符串
   */
  getImageSearchQuery(): string {
    return this.imageSearchQuery;
  }

  /**
   * 设置提示词搜索查询
   * @param query - 搜索查询
   */
  setPromptSearchQuery(query: string): void {
    this.searchQuery = query;
    const input = document.getElementById('promptSearchInput') as HTMLInputElement | null;
    if (input) {
      input.value = query;
    }
  }

  /**
   * 设置图像搜索查询
   * @param query - 搜索查询
   */
  setImageSearchQuery(query: string): void {
    this.imageSearchQuery = query;
    const input = document.getElementById('imageSearchInput') as HTMLInputElement | null;
    if (input) {
      input.value = query;
    }
  }

  /**
   * 清除所有搜索
   */
  clearAllSearches(): void {
    this.clearPromptSearch(
      document.getElementById('promptSearchInput') as HTMLInputElement | null,
      document.getElementById('clearPromptSearchBtn')
    );
    this.clearImageSearch(
      document.getElementById('imageSearchInput') as HTMLInputElement | null,
      document.getElementById('clearImageSearchBtn')
    );
  }
}
