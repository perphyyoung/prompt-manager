/**
 * 标签自动完成服务
 * 提供标签输入的自动完成、键盘导航等功能
 */

import { contextStack, IContextStackEntry } from '../managers/ContextStackManager.ts';
import { Constants } from '../../constants.ts';
import type { ElementId } from '../../constants.ts';
import type { IClosableElement } from '../../types/entities.ts';

// 配置选项接口
interface TagAutocompleteOptions {
  inputId: string;
  dropdownId: ElementId;
  getTags: () => Promise<string[]>;
  onSelect?: (tagName: string) => Promise<boolean> | boolean;
  onBatchAdd?: (tagNames: string[]) => Promise<boolean> | boolean;
  containerSelector?: string;
}

export class TagAutocomplete {
  private inputId: string;
  private dropdownId: ElementId;
  private getTags: () => Promise<string[]>;
  private onSelect?: (tagName: string) => Promise<boolean> | boolean;
  private onBatchAdd?: (tagNames: string[]) => Promise<boolean> | boolean;
  private containerSelector?: string;

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
    this.getTags = options.getTags;
    this.onSelect = options.onSelect;
    this.onBatchAdd = options.onBatchAdd;
    this.containerSelector = options.containerSelector;
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
      const allTags = await this.getTags();

      // 过滤匹配的标签（前缀匹配）
      const matchedTags = allTags.filter(tag =>
        tag.toLowerCase().startsWith(value.toLowerCase()) &&
        tag.toLowerCase() !== value.toLowerCase()
      );

      if (matchedTags.length === 0) {
        this.hideDropdown();
        return;
      }

      this.showDropdown(matchedTags);
    } catch (error) {
      console.error('TagAutocomplete: 获取标签列表失败', error);
    }
  }

  /**
   * 显示下拉框
   * @param tags - 匹配的标签列表
   * @private
   */
  private showDropdown(tags: string[]): void {
    if (!this.dropdown) return;

    this.dropdown.innerHTML = tags.map((tag, index) =>
      `<div class="autocomplete-item" data-index="${index}" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</div>`
    ).join('');
    this.dropdown.classList.add('active');

    // 添加 close 方法供 ShortcutManager 调用
    (this.dropdown as IClosableElement).close = () => this.hideDropdown();

    // 压栈：进入下拉菜单上下文
    const stackEntry: IContextStackEntry = {
      id: this.dropdownId,
      state: { isBatchToolbarVisible: false },
      close: () => { this.hideDropdown(); }
    };
    contextStack.push(stackEntry);

    // 绑定点击事件
    this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const tagName = (item as HTMLElement).dataset.tag;
        if (tagName) {
          this.selectTag(tagName);
        }
      });
    });
  }

  /**
   * 隐藏下拉框
   * @private
   */
  private hideDropdown(): void {
    if (this.dropdown && this.dropdown.classList.contains('active')) {
      // 出栈：退出下拉菜单上下文（只有当下拉框真正显示时才出栈）
      // 使用 isInContext 检查避免重复 pop
      if (contextStack.isInContext(this.dropdownId)) {
        contextStack.pop(this.dropdownId);
      }

      this.dropdown.classList.remove('active');
      this.dropdown.innerHTML = '';
    }
  }

  /**
   * 选中标签
   * @param tagName - 标签名称
   * @private
   */
  private async selectTag(tagName: string): Promise<void> {
    let success = true;
    if (this.onSelect) {
      success = await this.onSelect(tagName);
    }
    if (success !== false && this.input) {
      this.input.value = '';
    }
    this.hideDropdown();
  }

  /**
   * 处理键盘事件
   * @param e - 键盘事件
   * @private
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.dropdown) return;

    const items = this.dropdown.querySelectorAll('.autocomplete-item');
    const selectedItem = this.dropdown.querySelector('.autocomplete-item.selected');

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.navigateDown(items, selectedItem);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.navigateUp(items, selectedItem);
        break;

      case 'Enter':
        e.preventDefault();
        this.handleEnter(selectedItem);
        break;

      case 'Tab':
        if (selectedItem && this.input) {
          e.preventDefault();
          this.input.value = (selectedItem as HTMLElement).dataset.tag || '';
          this.hideDropdown();
        }
        break;

      // Escape 由 ShortcutManager 统一处理
    }
  }

  /**
   * 向下导航
   * @private
   */
  private navigateDown(items: NodeListOf<Element>, selectedItem: Element | null): void {
    if (!selectedItem) {
      items[0]?.classList.add('selected');
    } else {
      selectedItem.classList.remove('selected');
      const nextItem = selectedItem.nextElementSibling;
      if (nextItem) {
        nextItem.classList.add('selected');
      } else {
        items[0]?.classList.add('selected');
      }
    }
  }

  /**
   * 向上导航
   * @private
   */
  private navigateUp(items: NodeListOf<Element>, selectedItem: Element | null): void {
    if (!selectedItem) {
      items[items.length - 1]?.classList.add('selected');
    } else {
      selectedItem.classList.remove('selected');
      const prevItem = selectedItem.previousElementSibling;
      if (prevItem) {
        prevItem.classList.add('selected');
      } else {
        items[items.length - 1]?.classList.add('selected');
      }
    }
  }

  /**
   * 处理回车键
   * @private
   */
  private async handleEnter(selectedItem: Element | null): Promise<void> {
    // 重新获取当前选中的项
    const currentSelected = this.dropdown?.querySelector('.autocomplete-item.selected');

    if (currentSelected) {
      // 使用选中的标签
      const tagName = (currentSelected as HTMLElement).dataset.tag;
      if (tagName) {
        await this.selectTag(tagName);
      }
    } else {
      // 使用输入框内容，支持批量添加
      await this.handleBatchAdd();
    }
  }

  /**
   * 处理批量添加
   * @private
   */
  private async handleBatchAdd(): Promise<void> {
    if (!this.input) return;

    let tagName = this.input.value.trim();
    tagName = tagName.replace(/^[，,]+|[，,]+$/g, '');

    if (tagName && this.onBatchAdd) {
      const tagNames = tagName.split(/[,，\s]+/).filter(t => t.trim());
      if (tagNames.length > 0) {
        const success = await this.onBatchAdd(tagNames);
        if (success !== false) {
          this.input.value = '';
        }
      }
    }
    this.hideDropdown();
  }

  /**
   * HTML转义辅助函数
   * @param text - 需要转义的文本
   * @returns 转义后的文本
   * @private
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
