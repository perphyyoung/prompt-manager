/**
 * 标签自动完成服务
 * 提供标签输入的自动完成、键盘导航等功能
 */

import type { ElementId } from "../constants.ts";
import { TagService } from "./TagService.ts";

// Symbol 标记，用于防止重复绑定
const AUTOCOMPLETE_INSTANCE = Symbol("autocompleteInstance");

declare global {
  interface HTMLElement {
    [AUTOCOMPLETE_INSTANCE]?: TagAutocomplete;
  }
}

// 配置选项接口
interface TagAutocompleteOptions {
  inputId: string;
  dropdownId: ElementId;
  /** 提交单个标签（下拉选择或回车提交输入值） */
  onSelect?: (tagName: string) => Promise<boolean> | boolean;
  containerSelector?: string;
  type: "image" | "prompt";
  excludeTags?: string[];
}

export class TagAutocomplete {
  private inputId: string;
  private dropdownId: ElementId;
  private onSelect?: (tagName: string) => Promise<boolean> | boolean;
  private containerSelector?: string;
  private type: "image" | "prompt";
  private excludeTags?: string[];
  private tagService: TagService;

  private input: HTMLInputElement | null = null;
  private dropdown: HTMLElement | null = null;
  private inputHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private blurHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private blurHideTimer: ReturnType<typeof setTimeout> | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * @param options - 配置选项
   */
  constructor(options: TagAutocompleteOptions) {
    this.inputId = options.inputId;
    this.dropdownId = options.dropdownId;
    this.onSelect = options.onSelect;
    this.containerSelector = options.containerSelector;
    this.type = options.type;
    this.excludeTags = options.excludeTags;
    this.tagService = TagService.getInstance();
  }

  /**
   * 初始化自动完成组件
   */
  init(): void {
    this.input = document.getElementById(this.inputId) as HTMLInputElement;
    this.dropdown = document.getElementById(this.dropdownId);

    if (!this.input || !this.dropdown) {
      window.electronAPI.logError(
        "TagAutocomplete",
        `init 失败: 未找到元素 - inputId=${this.inputId}, dropdownId=${this.dropdownId}`,
      );
      return;
    }

    // 检查是否已有实例绑定到该输入框
    const existingInstance = this.input[AUTOCOMPLETE_INSTANCE];
    if (existingInstance && existingInstance !== this) {
      existingInstance.destroy();
    }

    this.destroy(); // 清理旧的事件监听
    this.bindEvents();

    // 标记当前实例到输入框
    this.input[AUTOCOMPLETE_INSTANCE] = this;
  }

  /**
   * 销毁组件，清理事件监听
   */
  destroy(): void {
    if (this.inputHandler && this.input) {
      this.input.removeEventListener("input", this.inputHandler);
      this.inputHandler = null;
    }
    if (this.keydownHandler && this.input) {
      this.input.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.blurHandler && this.input) {
      this.input.removeEventListener("blur", this.blurHandler);
      this.blurHandler = null;
    }
    if (this.focusHandler && this.input) {
      this.input.removeEventListener("focus", this.focusHandler);
      this.focusHandler = null;
    }
    if (this.blurHideTimer !== null) {
      clearTimeout(this.blurHideTimer);
      this.blurHideTimer = null;
    }
    if (this.clickOutsideHandler) {
      document.removeEventListener("click", this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }
  }

  /**
   * 绑定事件监听
   * @private
   */
  private bindEvents(): void {
    if (!this.input) return;

    // 输入事件处理（自动完成）
    this.inputHandler = () => this.handleInput();
    this.input.addEventListener("input", this.inputHandler);

    // 键盘事件处理
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    this.input.addEventListener("keydown", this.keydownHandler);

    // 失去焦点时隐藏下拉框
    // 延迟 200ms 是为了给"点击下拉建议项"留出mousedown→click的时间窗口；
    // 定时器到期时必须复核焦点：若输入框已重新聚焦（快速切回继续输入），
    // 过期的定时器会把正在使用的下拉框隐藏掉，抹掉键盘导航的选中状态
    this.blurHandler = () => {
      if (this.blurHideTimer !== null) {
        clearTimeout(this.blurHideTimer);
      }
      this.blurHideTimer = setTimeout(() => {
        this.blurHideTimer = null;
        if (document.activeElement !== this.input) {
          this.hideDropdown();
        }
      }, 200);
    };
    this.input.addEventListener("blur", this.blurHandler);

    // 重新聚焦/继续输入时撤销未到期的失焦隐藏
    this.focusHandler = () => {
      if (this.blurHideTimer !== null) {
        clearTimeout(this.blurHideTimer);
        this.blurHideTimer = null;
      }
    };
    this.input.addEventListener("focus", this.focusHandler);

    // 点击外部关闭
    if (this.containerSelector) {
      this.clickOutsideHandler = (e: MouseEvent) => {
        if (!(e.target as Element).closest(this.containerSelector!)) {
          this.hideDropdown();
        }
      };
      document.addEventListener("click", this.clickOutsideHandler);
    }
  }

  /**
   * 处理输入事件
   * @private
   */
  private async handleInput(): Promise<void> {
    if (!this.input) return;

    const value = this.input.value.trim();
    if (!value) {
      this.hideDropdown();
      return;
    }

    // 继续输入时撤销未到期的失焦隐藏，避免下拉框在交互中途被过期定时器关闭
    if (this.blurHideTimer !== null) {
      clearTimeout(this.blurHideTimer);
      this.blurHideTimer = null;
    }

    try {
      const suggestions = await this.tagService.searchTags(this.type, value, this.excludeTags);

      // 异步竞态守卫：等待期间输入框的值已变化时丢弃本次陈旧响应。
      // 否则迟到的旧结果会整体重渲染下拉框，抹掉键盘导航设置的选中高亮，
      // 导致随后的回车提交不到预期标签
      if (this.input.value.trim() !== value) return;

      if (suggestions.length === 0) {
        this.hideDropdown();
        return;
      }

      this.renderDropdown(suggestions);
    } catch (error) {
      window.electronAPI?.logError("TagAutocomplete", "Failed to get suggestions:", error);
    }
  }

  /**
   * 渲染下拉框
   * @private
   */
  private renderDropdown(suggestions: string[]): void {
    if (!this.dropdown || !this.input) return;

    const inputValue = this.input.value.trim().toLowerCase();

    // 高亮匹配部分
    const highlightMatch = (text: string, query: string): string => {
      if (!query) return text;
      const regex = new RegExp(`(${query})`, "gi");
      return text.replace(regex, "<strong>$1</strong>");
    };

    this.dropdown.innerHTML = suggestions
      .map(
        (tag) => `
        <div class="tag-autocomplete-item" data-tag="${tag}">
          ${highlightMatch(tag, inputValue)}
        </div>
      `,
      )
      .join("");

    // 使用 fixed 定位，脱离 overflow 裁剪，相对视口定位在输入框下方
    const inputRect = this.input.getBoundingClientRect();
    this.dropdown.style.position = "fixed";
    this.dropdown.style.top = `${inputRect.bottom}px`;
    this.dropdown.style.left = `${inputRect.left}px`;
    this.dropdown.style.width = `${inputRect.width}px`;
    const availableHeight = window.innerHeight - inputRect.bottom - 16;
    this.dropdown.style.maxHeight = `${Math.max(Math.min(availableHeight, 200), 60)}px`;
    this.dropdown.style.zIndex = "10000";

    this.dropdown.classList.add("active");

    // 绑定点击事件
    this.dropdown.querySelectorAll(".tag-autocomplete-item").forEach((item) => {
      item.addEventListener("click", () => {
        const tag = (item as HTMLElement).dataset.tag;
        if (tag) {
          this.selectTag(tag);
        }
      });
    });
  }

  /**
   * 处理键盘事件
   * @private
   */
  private handleKeydown(e: KeyboardEvent): void {
    // Escape键：如果下拉框激活，关闭它并阻止传播；否则允许传播到ShortcutManager
    if (e.key === "Escape") {
      const isDropdownActive = this.dropdown?.classList.contains("active");
      if (isDropdownActive) {
        // 下拉框激活时，关闭它并阻止事件传播
        e.stopImmediatePropagation();
        e.preventDefault();
        this.hideDropdown();
        return;
      }
      // 下拉框未激活时，允许Escape传播到ShortcutManager关闭详情界面
      return;
    }

    // 下拉框激活时处理导航
    if (this.dropdown?.classList.contains("active")) {
      const items = this.dropdown.querySelectorAll(".tag-autocomplete-item");
      const activeItem = this.dropdown.querySelector(".tag-autocomplete-item.active");
      let currentIndex = Array.from(items).indexOf(activeItem as Element);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          currentIndex = Math.min(currentIndex + 1, items.length - 1);
          this.setActiveItem(currentIndex);
          return;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          currentIndex = Math.max(currentIndex - 1, 0);
          this.setActiveItem(currentIndex);
          return;
      }
    }

    // 回车：有选中候选时填入输入框再提交，否则直接提交输入文本
    if (e.key === "Enter" && this.input?.value.trim()) {
      // 如果有活跃的候选项，将其填入输入框
      if (this.dropdown?.classList.contains("active")) {
        const activeItem = this.dropdown.querySelector(
          ".tag-autocomplete-item.active",
        ) as HTMLElement | null;
        if (activeItem) {
          const tag = activeItem.dataset.tag;
          if (tag) {
            this.input.value = tag;
          }
        }
      }

      if (this.onSelect) {
        e.preventDefault();
        e.stopPropagation();
        this.submitInputValue();
      }
    }
  }

  /**
   * 设置当前激活的项
   * @private
   */
  private setActiveItem(index: number): void {
    if (!this.dropdown) return;

    const items = this.dropdown.querySelectorAll(".tag-autocomplete-item");
    items.forEach((item, i) => {
      item.classList.toggle("active", i === index);
    });
  }

  /**
   * 选择标签
   * @private
   */
  private async selectTag(tag: string): Promise<void> {
    if (!this.input) return;

    if (this.onSelect) {
      const result = await this.onSelect(tag);
      if (result !== false) {
        this.input.value = "";
        this.hideDropdown();
      }
    }
  }

  /**
   * 提交输入框当前值（单个标签）
   * @private
   */
  private submitInputValue(): void {
    if (!this.input) return;
    const value = this.input.value.trim();
    if (!value) return;
    this.selectTag(value);
  }

  /**
   * 隐藏下拉框
   * @private
   */
  private hideDropdown(): void {
    if (this.dropdown) {
      this.dropdown.classList.remove("active");
    }
  }
}
