import { Constants } from '../../constants.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';

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
    exitBatchMode: () => void;
    sortBy: string;
    sortOrder: string;
    cardSize: number;
    setCardSize: (size: number) => void;
  } | null;
  imagePanelManager: {
    renderView: () => void;
    exitBatchMode: () => void;
    sortBy: string;
    sortOrder: string;
    cardSize: number;
    setCardSize: (size: number) => void;
  } | null;
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

  // 初始化状态
  private isInitialized = false;

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
    if (this.isInitialized) {
      return;
    }
    this.bindSearchEvents();
    this.bindSortEvents();
    this.isInitialized = true;
  }

  /**
   * 绑定搜索事件
   * @private
   */
  private bindSearchEvents(): void {
    // 提示词搜索
    const promptSearchInput = document.getElementById(Constants.Ids.PROMPT_SEARCH_INPUT) as HTMLInputElement | null;
    const clearPromptSearchBtn = document.getElementById(Constants.Ids.CLEAR_PROMPT_SEARCH_BTN);

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
    const imageSearchInput = document.getElementById(Constants.Ids.IMAGE_SEARCH_INPUT) as HTMLInputElement | null;
    const clearImageSearchBtn = document.getElementById(Constants.Ids.CLEAR_IMAGE_SEARCH_BTN);

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

    this.app.promptPanelManager?.exitBatchMode();

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

    this.app.promptPanelManager?.exitBatchMode();

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

    this.app.imagePanelManager?.exitBatchMode();

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

    this.app.imagePanelManager?.exitBatchMode();

    if (this.app.imagePanelManager) {
      this.app.imagePanelManager.renderView();
    }
  }

  /**
   * 绑定视图切换事件
   * @private
   */
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
    const promptSortSelect = document.getElementById(Constants.Ids.PROMPT_SORT_SELECT) as HTMLSelectElement | null;
    const promptSortReverseBtn = document.getElementById(Constants.Ids.PROMPT_SORT_REVERSE_BTN);
    const promptCardSizeSlider = document.getElementById(Constants.Ids.PROMPT_CARD_SIZE_SLIDER) as HTMLInputElement | null;

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
      // 注意：不需要 change 事件监听器，因为 setCardSize 内部已经处理了 localStorage 写入
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
    localStorageManager.set(Constants.LocalStorageKey.PROMPT_SORT_BY, sortBy);
    localStorageManager.set(Constants.LocalStorageKey.PROMPT_SORT_ORDER, sortOrder);
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
    localStorageManager.set(Constants.LocalStorageKey.PROMPT_SORT_ORDER, newOrder);

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
    const imageSortSelect = document.getElementById(Constants.Ids.IMAGE_SORT_SELECT) as HTMLSelectElement | null;
    const imageSortReverseBtn = document.getElementById(Constants.Ids.IMAGE_SORT_REVERSE_BTN);
    const imageCardSizeSlider = document.getElementById(Constants.Ids.IMAGE_CARD_SIZE_SLIDER) as HTMLInputElement | null;

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
      // 注意：不需要 change 事件监听器，因为 setCardSize 内部已经处理了 localStorage 写入
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
    localStorageManager.set(Constants.LocalStorageKey.IMAGE_SORT_BY, sortBy);
    localStorageManager.set(Constants.LocalStorageKey.IMAGE_SORT_ORDER, sortOrder);
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
    localStorageManager.set(Constants.LocalStorageKey.IMAGE_SORT_ORDER, newOrder);

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
    const input = document.getElementById(Constants.Ids.PROMPT_SEARCH_INPUT) as HTMLInputElement | null;
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
    const input = document.getElementById(Constants.Ids.IMAGE_SEARCH_INPUT) as HTMLInputElement | null;
    if (input) {
      input.value = query;
    }
  }

  /**
   * 清除所有搜索
   */
  clearAllSearches(): void {
    this.clearPromptSearch(
      document.getElementById(Constants.Ids.PROMPT_SEARCH_INPUT) as HTMLInputElement | null,
      document.getElementById(Constants.Ids.CLEAR_PROMPT_SEARCH_BTN)
    );
    this.clearImageSearch(
      document.getElementById(Constants.Ids.IMAGE_SEARCH_INPUT) as HTMLInputElement | null,
      document.getElementById(Constants.Ids.CLEAR_IMAGE_SEARCH_BTN)
    );
  }
}
