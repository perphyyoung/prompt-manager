import { Constants } from '../../constants';
import { contextStack } from '../managers/ContextStackManager';
import type { IDialogTemplate, IDialogContext, IClosableElement } from '../../types/entities.ts';
import { TagAutocomplete } from './TagAutocomplete.ts';

// ==================== 对话框配置 ====================
export const DialogConfig: Record<string, IDialogTemplate> = {
  DELETE_PROMPT: {
    title: '确认删除',
    message: (data: IDialogContext) => `确定要删除提示词"${data.name}"吗？`,
    type: 'warning'
  },
  DELETE_IMAGE: {
    title: '确认删除',
    message: (data: IDialogContext) => `确定要删除图像"${data.name}"吗？`,
    type: 'warning'
  },
  DELETE_TAG: {
    title: '确认删除',
    message: (data: IDialogContext) => `确定要删除标签"${data.name}"吗？`,
    type: 'warning'
  },
  DELETE_TAG_GROUP: {
    title: '确认删除',
    message: '确定要删除这个标签组吗？组内的标签将变为未分组状态。',
    type: 'warning'
  },
  CLEAR_ALL_DATA: {
    title: '确认清空',
    message: '确定要清空所有数据吗？此操作不可恢复！',
    type: 'warning'
  },
  RELAUNCH_APP: {
    title: '确认重启',
    message: '确定要立即重启应用吗？',
    type: 'warning'
  },
  REMOVE_NEW_IMAGE: {
    title: '确认移除',
    message: '确定要从此列表中移除该图像吗？（不会删除实际文件）',
    type: 'warning'
  },
  SYNC_TAGS_BIDIRECTIONAL: {
    title: '同步完成',
    message: (data: IDialogContext) => {
      let msg = '';

      // 提示词 → 图像
      if (data.promptToImage && data.promptToImage.imported > 0) {
        msg += `提示词 → 图像：导入 ${data.promptToImage.imported} 个`;
        if (data.promptToImage.skipped > 0) {
          msg += `（跳过 ${data.promptToImage.skipped} 个）`;
        }
        msg += '\n';
        // 显示分组标签
        if (data.promptToImage.tagGroups && data.promptToImage.tagGroups.length > 0) {
          for (const group of data.promptToImage.tagGroups) {
            msg += `  [${group.groupName}] ${group.tags.join(', ')}\n`;
          }
        }
        // 显示未分组标签
        if (data.promptToImage.ungroupedTags && data.promptToImage.ungroupedTags.length > 0) {
          msg += `  [未分组] ${data.promptToImage.ungroupedTags.join(', ')}\n`;
        }
        msg += '\n';
      }

      // 图像 → 提示词
      if (data.imageToPrompt && data.imageToPrompt.imported > 0) {
        msg += `图像 → 提示词：导入 ${data.imageToPrompt.imported} 个`;
        if (data.imageToPrompt.skipped > 0) {
          msg += `（跳过 ${data.imageToPrompt.skipped} 个）`;
        }
        msg += '\n';
        // 显示分组标签
        if (data.imageToPrompt.tagGroups && data.imageToPrompt.tagGroups.length > 0) {
          for (const group of data.imageToPrompt.tagGroups) {
            msg += `  [${group.groupName}] ${group.tags.join(', ')}\n`;
          }
        }
        // 显示未分组标签
        if (data.imageToPrompt.ungroupedTags && data.imageToPrompt.ungroupedTags.length > 0) {
          msg += `  [未分组] ${data.imageToPrompt.ungroupedTags.join(', ')}\n`;
        }
      }

      if ((!data.promptToImage || data.promptToImage.imported === 0) &&
          (!data.imageToPrompt || data.imageToPrompt.imported === 0)) {
        msg = '双方标签已同步，无需导入新标签';
      }

      return msg;
    },
    type: 'info'
  },
  BATCH_DELETE_TAGS: {
    title: '确认批量删除',
    message: (data: IDialogContext) => `确定要删除选中的 ${data.count} 个标签吗？此操作不可恢复！`,
    type: 'warning'
  },
  BATCH_DELETE_PROMPTS: {
    title: '确认删除',
    message: (data: IDialogContext) => `确定要删除选中的 ${data.count} 个提示词吗？`,
    type: 'warning'
  },
  BATCH_DELETE_IMAGES: {
    title: '确认删除',
    message: (data: IDialogContext) => `确定要删除选中的 ${data.count} 个图像吗？`,
    type: 'warning'
  },
  PERMANENT_DELETE: {
    title: '确认永久删除',
    message: (data: IDialogContext) => `确定要永久删除此${data.type === 'trash-image' ? '图像' : '提示词'}吗？此操作不可恢复！`,
    type: 'warning'
  },
  EMPTY_TRASH: {
    title: '确认清空回收站',
    message: (data: IDialogContext) => `确定要清空${data.type === 'trash-image' ? '图像' : '提示词'}回收站吗？此操作不可恢复！`,
    type: 'warning'
  },
  DELETE_IMAGE_TO_TRASH: {
    title: '确认删除',
    message: (data: IDialogContext) => `确定要删除图像"${data.name}"吗？`,
    type: 'warning'
  },
  TAG_GROUP_DUPLICATE_NAME: {
    title: '组名已存在',
    message: '该标签组名称已存在，请使用其他名称。',
    type: 'info'
  },
  UNLINK_FROM_PROMPT: {
    title: '确认解除关联',
    message: (data: IDialogContext) => `确定要解除与提示词"${data.promptTitle}"的关联吗？`,
    type: 'warning'
  }
};

// ==================== 静态变量 ====================
let _initialized = false;
let _confirmCallback: ((result: boolean) => void) | null = null;
let _inputResolve: ((result: { value: string; groupId?: number | null } | null) => void) | null = null;
let _selectResolve: ((result: string | null) => void) | null = null;

// ==================== 对话框服务 ====================
export class DialogService {
  /**
   * 检查确认对话框是否正在显示
   */
  static isConfirmDialogShowing(): boolean {
    return _confirmCallback !== null;
  }

  /**
   * 显示 Toast 提示（简化版，不依赖 ToastManager）
   * @param message - 提示消息
   * @param type - 提示类型
   */
  private static _showToast(message: string, type = 'info'): void {
    const toast = document.getElementById(Constants.Ids.TOAST_CONTAINER);
    const toastMessage = document.getElementById(Constants.Ids.TOAST_MESSAGE);

    if (!toast || !toastMessage) {
      return;
    }

    toast.className = `toast toast-${type}`;
    toastMessage.textContent = message;
    toast.classList.add('show');

    // 3秒后自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  /**
   * 初始化 - 页面加载时调用一次
   */
  static init(): void {
    if (_initialized) return;
    _initialized = true;

    // 使用事件委托处理所有对话框按钮点击
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // 输入对话框 - 确定按钮
      if (target.closest(`#${Constants.Ids.INPUT_OK_BTN}`)) {
        e.stopPropagation();
        const inputEl = document.getElementById(Constants.Ids.INPUT_MODAL_FIELD) as HTMLInputElement | HTMLTextAreaElement | null;
        const groupSelect = document.getElementById(Constants.Ids.INPUT_MODAL_GROUP_SELECT) as HTMLSelectElement | null;
        const groupSection = document.getElementById(Constants.Ids.INPUT_MODAL_GROUP_SECTION);

        const value = inputEl?.value.trim() || '';
        const hasGroupSelect = groupSection && groupSection.style.display !== 'none' && groupSelect;

        _inputResolve?.({
          value,
          groupId: hasGroupSelect ? (groupSelect.value ? parseInt(groupSelect.value, 10) : null) : undefined
        });
        DialogService._closeInputDialog();
        return;
      }

      // 输入对话框 - 取消/关闭按钮
      if (target.closest(`#${Constants.Ids.INPUT_CANCEL_BTN}, #${Constants.Ids.CLOSE_INPUT_MODAL}`)) {
        e.stopPropagation();
        _inputResolve?.(null);
        DialogService._closeInputDialog();
        return;
      }

      // 确认对话框 - 确定按钮
      if (target.closest(`#${Constants.Ids.CONFIRM_OK_BTN}`)) {
        e.stopPropagation();
        _confirmCallback?.(true);
        DialogService._closeConfirmDialog();
        return;
      }

      // 确认对话框 - 取消/关闭按钮
      if (target.closest(`#${Constants.Ids.CONFIRM_CANCEL_BTN}, #${Constants.Ids.CLOSE_CONFIRM_MODAL}`)) {
        e.stopPropagation();
        _confirmCallback?.(false);
        DialogService._closeConfirmDialog();
        return;
      }

      // 选择对话框 - 确定按钮
      if (target.closest(`#${Constants.Ids.SELECT_OK_BTN}`)) {
        e.stopPropagation();
        const selectEl = document.getElementById(Constants.Ids.SELECT_MODAL_FIELD) as HTMLSelectElement | null;
        _selectResolve?.(selectEl?.value || null);
        DialogService._closeSelectDialog();
        return;
      }

      // 选择对话框 - 取消/关闭按钮
      if (target.closest(`#${Constants.Ids.SELECT_CANCEL_BTN}, #${Constants.Ids.CLOSE_SELECT_MODAL}`)) {
        e.stopPropagation();
        _selectResolve?.(null);
        DialogService._closeSelectDialog();
        return;
      }
    });

    // 绑定键盘事件
    const handleKeydown = (e: KeyboardEvent): void => {
      // 输入对话框 - Enter 确定
      if (e.key === 'Enter') {
        const inputModal = document.getElementById(Constants.Ids.INPUT_MODAL);
        if (inputModal && (inputModal as HTMLElement).style.display === 'flex') {
          e.preventDefault();
          const inputEl = document.getElementById(Constants.Ids.INPUT_MODAL_FIELD) as HTMLInputElement | null;
          if (inputEl && document.activeElement === inputEl) {
            const groupSelect = document.getElementById(Constants.Ids.INPUT_MODAL_GROUP_SELECT) as HTMLSelectElement | null;
            const groupSection = document.getElementById(Constants.Ids.INPUT_MODAL_GROUP_SECTION);

            const value = inputEl.value.trim();
            const hasGroupSelect = groupSection && groupSection.style.display !== 'none' && groupSelect;

            _inputResolve?.({
              value,
              groupId: hasGroupSelect ? (groupSelect.value ? parseInt(groupSelect.value, 10) : null) : undefined
            });
            DialogService._closeInputDialog();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  // ==================== 输入对话框 ====================
  /** 模态框标签自动完成实例 */
  private static inputModalAutocomplete: TagAutocomplete | null = null;

  static async showInputDialog(options: {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    multiline?: boolean;
    showGroupSelect?: boolean;
    groups?: Array<{ id: number; name: string }>;
    defaultGroupId?: number | null;
    autocomplete?: 'prompt' | 'image';
  }): Promise<{ value: string; groupId?: number | null } | null> {
    const modal = document.getElementById(Constants.Ids.INPUT_MODAL) as IClosableElement;
    const titleEl = document.getElementById(Constants.Ids.INPUT_MODAL_TITLE);
    const labelEl = document.getElementById(Constants.Ids.INPUT_MODAL_LABEL);
    const inputEl = document.getElementById(Constants.Ids.INPUT_MODAL_FIELD) as HTMLInputElement | HTMLTextAreaElement | null;
    const groupSection = document.getElementById(Constants.Ids.INPUT_MODAL_GROUP_SECTION);
    const groupSelect = document.getElementById(Constants.Ids.INPUT_MODAL_GROUP_SELECT) as HTMLSelectElement | null;

    // 回退到原生对话框
    if (!modal || !inputEl) {
      const result = prompt(options.title, options.defaultValue || '');
      return result ? { value: result } : null;
    }

    return new Promise((resolve) => {
      _inputResolve = resolve;

      // 设置内容
      if (titleEl) titleEl.textContent = options.title;
      if (labelEl) labelEl.textContent = options.placeholder || '';
      inputEl.value = options.defaultValue || '';

      // 设置多行
      if (options.multiline) {
        (inputEl as HTMLTextAreaElement).rows = 4;
      } else {
        (inputEl as HTMLTextAreaElement).rows = 1;
      }

      // 设置分组选择
      if (options.showGroupSelect && groupSection && groupSelect) {
        groupSection.style.display = 'block';
        groupSelect.innerHTML = '<option value="">未分组</option>';
        if (options.groups) {
          options.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = String(group.id);
            option.textContent = group.name;
            groupSelect.appendChild(option);
          });
        }
        groupSelect.value = options.defaultGroupId ? String(options.defaultGroupId) : '';
      } else if (groupSection) {
        groupSection.style.display = 'none';
      }

      // 初始化标签自动完成
      if (options.autocomplete) {
        // 销毁旧实例
        DialogService.inputModalAutocomplete?.destroy();

        // onBatchAdd 回调：填入输入框并提交对话框
        const onBatchAdd = (tagNames: string[]) => {
          const field = document.getElementById(Constants.Ids.INPUT_MODAL_FIELD) as HTMLInputElement;
          if (field) {
            field.value = tagNames.join(', ');
          }
          const okBtn = document.getElementById(Constants.Ids.INPUT_OK_BTN);
          okBtn?.click();
          return true;
        };

        DialogService.inputModalAutocomplete = new TagAutocomplete({
          inputId: Constants.Ids.INPUT_MODAL_FIELD,
          dropdownId: Constants.Ids.INPUT_MODAL_TAG_AUTOCOMPLETE,
          containerSelector: '.modal-body',
          type: options.autocomplete,
          onBatchAdd
        });
        DialogService.inputModalAutocomplete.init();
      }

      // 在 DOM 元素上设置 close 方法
      modal.close = () => {
        _inputResolve?.(null);
        DialogService._closeInputDialog();
      };

      // 压栈 - 复用 DOM 元素的 close
      contextStack.push({
        id: Constants.Ids.INPUT_MODAL,
        title: options.title,
        state: { isBatchToolbarVisible: false },
        close: () => modal.close?.()
      });

      // 显示对话框
      modal.style.display = 'flex';
      inputEl.focus();
      setTimeout(() => {
        inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
      }, 0);
    });
  }

  private static _closeInputDialog(): void {
    const modal = document.getElementById(Constants.Ids.INPUT_MODAL);
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }
    // 销毁自动完成实例
    DialogService.inputModalAutocomplete?.destroy();
    DialogService.inputModalAutocomplete = null;
    contextStack.pop(Constants.Ids.INPUT_MODAL);
    _inputResolve = null;
  }

  // ==================== 确认对话框 ====================
  static async showConfirmDialogByConfig(
    config: IDialogTemplate,
    data: IDialogContext | null = null
  ): Promise<boolean> {
    const title = typeof config.title === 'function' ? config.title(data || {}) : config.title;
    const msg = typeof config.message === 'function' ? config.message(data || {}) : config.message;
    const dialogType = config.type || 'warning';

    const modal = document.getElementById(Constants.Ids.CONFIRM_MODAL) as IClosableElement;
    const modalTitle = document.getElementById(Constants.Ids.CONFIRM_MODAL_TITLE);
    const modalMessage = document.getElementById(Constants.Ids.CONFIRM_MODAL_MESSAGE);

    // 回退到原生对话框
    if (!modal) {
      return window.confirm(msg);
    }

    return new Promise((resolve) => {
      _confirmCallback = resolve;

      // 设置内容
      if (modalTitle) {
        const iconMap: Record<string, string> = { info: '✓', warning: '⚠️' };
        const icon = iconMap[dialogType] || iconMap.warning;
        modalTitle.innerHTML = `<span class="title-icon">${icon}</span>${title}`;
      }
      if (modalMessage) modalMessage.innerHTML = msg.replace(/\n/g, '<br>');
      modal.dataset.dialogType = dialogType;

      // 设置按钮显示
      const cancelBtn = document.getElementById(Constants.Ids.CONFIRM_CANCEL_BTN);
      const okBtn = document.getElementById(Constants.Ids.CONFIRM_OK_BTN);
      if (dialogType === 'info') {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (okBtn) okBtn.style.margin = '0 auto';
      } else {
        if (cancelBtn) cancelBtn.style.display = '';
        if (okBtn) okBtn.style.margin = '';
      }

      // 在 DOM 元素上设置 close 方法
      modal.close = () => {
        _confirmCallback?.(false);
        DialogService._closeConfirmDialog();
      };

      // 压栈 - 复用 DOM 元素的 close
      contextStack.push({
        id: Constants.Ids.CONFIRM_MODAL,
        state: { isBatchToolbarVisible: false },
        close: () => modal.close?.()
      });

      // 显示对话框
      modal.style.display = 'flex';
    });
  }

  private static _closeConfirmDialog(): void {
    const modal = document.getElementById(Constants.Ids.CONFIRM_MODAL);
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }

    // 重置按钮样式
    const cancelBtn = document.getElementById(Constants.Ids.CONFIRM_CANCEL_BTN);
    const okBtn = document.getElementById(Constants.Ids.CONFIRM_OK_BTN);
    if (cancelBtn) (cancelBtn as HTMLElement).style.display = '';
    if (okBtn) (okBtn as HTMLElement).style.margin = '';

    contextStack.pop(Constants.Ids.CONFIRM_MODAL);
    _confirmCallback = null;
  }

  // ==================== 选择对话框 ====================
  static async showSelectDialog(options: {
    title: string;
    options: Array<{ value: string; label: string }>;
    defaultValue?: string;
  }): Promise<string | null> {
    const modal = document.getElementById(Constants.Ids.SELECT_MODAL) as IClosableElement;
    const titleEl = document.getElementById(Constants.Ids.SELECT_MODAL_TITLE);
    const selectEl = document.getElementById(Constants.Ids.SELECT_MODAL_FIELD) as HTMLSelectElement | null;

    // 回退到原生对话框
    if (!modal || !selectEl) {
      const optionsList = options.options.map(o => o.label).join('\n');
      const result = prompt(`${options.title}\n\n${optionsList}\n\n请输入选项值：`, options.defaultValue || '');
      return result;
    }

    return new Promise((resolve) => {
      _selectResolve = resolve;

      // 设置内容
      if (titleEl) titleEl.textContent = options.title;

      // 填充选项
      selectEl.innerHTML = '';
      options.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === options.defaultValue) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });

      // 在 DOM 元素上设置 close 方法
      modal.close = () => {
        _selectResolve?.(null);
        DialogService._closeSelectDialog();
      };

      // 压栈 - 复用 DOM 元素的 close
      contextStack.push({
        id: Constants.Ids.SELECT_MODAL,
        state: { isBatchToolbarVisible: false },
        close: () => modal.close?.()
      });

      // 显示对话框
      modal.style.display = 'flex';
    });
  }

  private static _closeSelectDialog(): void {
    const modal = document.getElementById(Constants.Ids.SELECT_MODAL);
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }
    contextStack.pop(Constants.Ids.SELECT_MODAL);
    _selectResolve = null;
  }
}
