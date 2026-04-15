/**
 * 标签自动完成服务
 * 提供标签输入的自动完成、键盘导航等功能
 */

import { contextStack, IContextStackEntry } from '../managers/ContextStackManager.ts';
import { Constants } from '../../constants.ts';
import type { ElementId } from '../../constants.ts';
import type { IClosableElement } from '../../types/entities.ts';
import { TagService } from './TagService.ts';

// 配置选项接口
interface TagAutocompleteOptions {
  inputId: string;
  dropdownId: ElementId;
  onSelect?: (tagName: string) => Promise<boolean> | boolean;
  onBatchAdd?: (tagNames: string[]) => Promise<boolean> | boolean;
  containerSelector?: string;
  type: 'image' | 'prompt';
  excludeTags?: string[];
}

export class TagAutocomplete {
  private inputId: string;
  private dropdownId: ElementId;
  private onSelect?: (tagName: string) => Promise<boolean> | boolean;
  private onBatchAdd?: (tagNames: string[]) => Promise<boolean> | boolean;
  private containerSelector?: string;
  private type: 'image' | 'prompt';
  private excludeTags?: string[];
  private tagService: TagService;

  private input: HTMLInputElement | null = null;
  private dropdown: HTMLElement | null = null;
  private inputHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private blurHandler: (() => void) | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * @param options - 配置选项
   */
  constructor(options: TagAutocompleteOptions) {
    this.inputId = options.inputId;
    this.dropdownId = options.dropdownId;
    this.onSelect = options.onSelect;
    this.onBatchAdd = options.onBatchAdd;
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
      console.warn(`TagAutocomplete: 未找到输入框 (${this.inputId}) 或下拉框 (${this.dropdownId})`);
      return;
    }

    this.destroy(); // 清理旧的事件监听
    this.bindEvents();
  }

  /**
   * 销毁组件，清理事件监听
   */
  destroy(): void {
    if (this.inputHandler && this.input) {
      this.input.removeEventListener('input', this.inputHandler);
      this.inputHandler = null;
    }
    if (this.keydownHandler && this.input) {
      this.input.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.blurHandler && this.input) {
      this.input.removeEventListener('blur', this.blurHandler);
      this.blurHandler = null;
    }
    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
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
    this.input.addEventListener('input', this.inputHandler);

    // 键盘事件处理
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    this.input.addEventListener('keydown', this.keydownHandler);

    // 失去焦点时隐藏下拉框
    this.blurHandler = () => {
      setTimeout(() => this.hideDropdown(), 200);
    };
    this.input.addEventListener('blur', this.blurHandler);

    // 点击外部关闭
    if (this.containerSelector) {
      this.clickOutsideHandler = (e: MouseEvent) => {
        if (!(e.target as Element).closest(this.containerSelector!)) {
          this.hideDropdown();
        }
      };
      document.addEventListener('click', this.clickOutsideHandler);
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

    try {
      const suggestions = await this.tagService.searchTags(this.type, value, this.excludeTags);

      if (suggestions.length === 0) {
        this.hideDropdown();
        return;
      }

      this.renderDropdown(suggestions);
    } catch (error) {
      window.electronAPI?.logError('TagAutocomplete', 'Failed to get suggestions:', error);
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
      const regex = new RegExp(`(${query})`, 'gi');
      return text.replace(regex, '<strong>$1</strong>');
    };

    this.dropdown.innerHTML = suggestions
      .map((tag, index) => `
        <div class="tag-autocomplete-item ${index === 0 ? 'active' : ''}" data-tag="${tag}">
          ${highlightMatch(tag, inputValue)}
        </div>
      `)
      .join('');

    this.dropdown.classList.add('active');

    // 绑定点击事件
    this.dropdown.querySelectorAll('.tag-autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
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
    // 下拉框激活时处理导航和选择
    if (this.dropdown?.classList.contains('active')) {
      const items = this.dropdown.querySelectorAll('.tag-autocomplete-item');
      const activeItem = this.dropdown.querySelector('.tag-autocomplete-item.active');
      let currentIndex = Array.from(items).indexOf(activeItem as Element);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          currentIndex = Math.min(currentIndex + 1, items.length - 1);
          this.setActiveItem(currentIndex);
          return;
        case 'ArrowUp':
          e.preventDefault();
          currentIndex = Math.max(currentIndex - 1, 0);
          this.setActiveItem(currentIndex);
          return;
        case 'Enter':
          e.preventDefault();
          if (activeItem) {
            const tag = (activeItem as HTMLElement).dataset.tag;
            if (tag) {
              this.selectTag(tag);
              return;
            }
          }
          break;
        case 'Escape':
          e.stopPropagation();
          this.hideDropdown();
          return;
      }
    }

    // 下拉框未激活时，回车添加输入的内容
    if (e.key === 'Enter' && this.input?.value.trim()) {
      e.preventDefault();
      this.handleBatchAdd();
    }
  }

  /**
   * 设置当前激活的项
   * @private
   */
  private setActiveItem(index: number): void {
    if (!this.dropdown) return;

    const items = this.dropdown.querySelectorAll('.tag-autocomplete-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  /**
   * 选择标签
   * @private
   */
  private async selectTag(tag: string): Promise<void> {
    if (!this.input) return;

    const result = await this.onSelect?.(tag);

    if (result !== false) {
      this.input.value = '';
      this.hideDropdown();
    }
  }

  /**
   * 处理批量添加
   * @private
   */
  private async handleBatchAdd(): Promise<void> {
    if (!this.input) return;

    const value = this.input.value.trim();
    if (!value) return;

    // 使用 TagService 统一解析标签输入
    const tags = this.tagService.parseTagInput(value);

    if (tags.length === 0) return;

    const result = await this.onBatchAdd?.(tags);

    if (result !== false) {
      this.input.value = '';
      this.hideDropdown();
    }
  }

  /**
   * 隐藏下拉框
   * @private
   */
  private hideDropdown(): void {
    if (this.dropdown) {
      this.dropdown.classList.remove('active');
    }
  }
}
