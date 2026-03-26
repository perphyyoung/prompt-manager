/**
 * 标签自动完成服务
 * 提供标签输入的自动完成、键盘导航等功能
 */
export class TagAutocomplete {
  /**
   * @param {Object} options - 配置选项
   * @param {string} options.inputId - 输入框元素ID
   * @param {string} options.dropdownId - 下拉框元素ID
   * @param {Function} options.getTags - 获取标签列表的异步函数
   * @param {Function} options.onSelect - 选中标签后的回调函数 (tagName) => void
   * @param {Function} options.onBatchAdd - 批量添加标签的回调函数 (tagNames) => void
   * @param {string} options.containerSelector - 点击外部关闭的选择器
   */
  constructor(options) {
    this.inputId = options.inputId;
    this.dropdownId = options.dropdownId;
    this.getTags = options.getTags;
    this.onSelect = options.onSelect;
    this.onBatchAdd = options.onBatchAdd;
    this.containerSelector = options.containerSelector;

    this.input = null;
    this.dropdown = null;
    this.inputHandler = null;
    this.keydownHandler = null;
    this.blurHandler = null;
    this.clickOutsideHandler = null;
  }

  /**
   * 初始化自动完成组件
   */
  init() {
    this.input = document.getElementById(this.inputId);
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
  destroy() {
    if (this.inputHandler) {
      this.input.removeEventListener('input', this.inputHandler);
      this.inputHandler = null;
    }
    if (this.keydownHandler) {
      this.input.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.blurHandler) {
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
  bindEvents() {
    // 输入事件处理（自动完成）
    this.inputHandler = () => this.handleInput();
    this.input.addEventListener('input', this.inputHandler);

    // 键盘事件处理
    this.keydownHandler = (e) => this.handleKeydown(e);
    this.input.addEventListener('keydown', this.keydownHandler);

    // 失去焦点时隐藏下拉框
    this.blurHandler = () => {
      setTimeout(() => this.hideDropdown(), 200);
    };
    this.input.addEventListener('blur', this.blurHandler);

    // 点击外部关闭
    if (this.containerSelector) {
      this.clickOutsideHandler = (e) => {
        if (!e.target.closest(this.containerSelector)) {
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
  async handleInput() {
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
   * @param {Array<string>} tags - 匹配的标签列表
   * @private
   */
  showDropdown(tags) {
    this.dropdown.innerHTML = tags.map((tag, index) =>
      `<div class="autocomplete-item" data-index="${index}" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</div>`
    ).join('');
    this.dropdown.classList.add('active');

    // 绑定点击事件
    this.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const tagName = item.dataset.tag;
        this.selectTag(tagName);
      });
    });
  }

  /**
   * 隐藏下拉框
   * @private
   */
  hideDropdown() {
    if (this.dropdown) {
      this.dropdown.classList.remove('active');
      this.dropdown.innerHTML = '';
    }
  }

  /**
   * 选中标签
   * @param {string} tagName - 标签名称
   * @private
   */
  async selectTag(tagName) {
    let success = true;
    if (this.onSelect) {
      success = await this.onSelect(tagName);
    }
    if (success !== false) {
      this.input.value = '';
    }
    this.hideDropdown();
  }

  /**
   * 处理键盘事件
   * @param {KeyboardEvent} e - 键盘事件
   * @private
   */
  handleKeydown(e) {
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
        if (selectedItem) {
          e.preventDefault();
          this.input.value = selectedItem.dataset.tag;
          this.hideDropdown();
        }
        break;

      case 'Escape':
        this.hideDropdown();
        break;
    }
  }

  /**
   * 向下导航
   * @private
   */
  navigateDown(items, selectedItem) {
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
  navigateUp(items, selectedItem) {
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
  async handleEnter(selectedItem) {
    // 重新获取当前选中的项
    const currentSelected = this.dropdown.querySelector('.autocomplete-item.selected');

    if (currentSelected) {
      // 使用选中的标签
      await this.selectTag(currentSelected.dataset.tag);
    } else {
      // 使用输入框内容，支持批量添加
      await this.handleBatchAdd();
    }
  }

  /**
   * 处理批量添加
   * @private
   */
  async handleBatchAdd() {
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
   * @param {string} text - 需要转义的文本
   * @returns {string} 转义后的文本
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
