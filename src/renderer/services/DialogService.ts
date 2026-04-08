import { contextStack, IContextStackEntry } from '../managers/ContextStackManager.ts';
import { Constants } from '../../constants.ts';

/**
 * 对话框配置数据接口
 */
export interface DialogConfigData {
  name?: string;
  type?: string;
  count?: number;
  promptTitle?: string;
  oldDataDir?: string;
  tagName?: string;
  currentGroupName?: string;
  newGroupName?: string;
  promptToImage?: {
    imported: number;
    skipped: number;
    tagGroups?: Array<{ groupName: string; tags: string[] }>;
    ungroupedTags?: string[];
  };
  imageToPrompt?: {
    imported: number;
    skipped: number;
    tagGroups?: Array<{ groupName: string; tags: string[] }>;
    ungroupedTags?: string[];
  };
  [key: string]: unknown;
}

/**
 * 消息函数类型
 */
type MessageFunction = (data: DialogConfigData) => string;

/**
 * 对话框配置项接口
 */
export interface DialogConfigItem {
  type?: string;
  title: string | MessageFunction;
  message: string | MessageFunction;
  confirmText?: string;
}

/**
 * 对话框配置
 */
export const DialogConfig: Record<string, DialogConfigItem> = {
  // ==================== 删除类 ====================
  /** 删除提示词 */
  DELETE_PROMPT: {
    title: '确认删除',
    message: (data) => `确定要删除提示词 "${data.name}" 吗？\n已删除的提示词会进入回收站，可以从回收站恢复。`
  },
  /** 删除图像到回收站 */
  DELETE_IMAGE_TO_TRASH: {
    title: '确认删除',
    message: '确定要删除这张图像吗？已删除的图像会进入回收站，可以从回收站恢复。'
  },
  /** 删除标签 */
  DELETE_TAG: {
    title: '确认删除标签',
    message: (data) => `确定要删除标签 "${data.name}" 吗？`
  },
  /** 删除标签组 */
  DELETE_TAG_GROUP: {
    title: '确认删除',
    message: '删除标签组不会删除标签，标签将变为未分组状态。确定要删除吗？'
  },
  /** 永久删除 */
  PERMANENT_DELETE: {
    title: '确认永久删除',
    message: (data) => `确定要永久删除此${data.type === 'prompt' ? '提示词' : '图像'}吗？此操作不可恢复。`
  },
  /** 批量删除 */
  BATCH_DELETE: {
    title: '确认批量删除',
    message: (data) => `确定要删除选中的 ${data.count} 个项目吗？\n删除后可在回收站恢复。`
  },
  /** 批量删除标签 */
  BATCH_DELETE_TAGS: {
    title: '确认批量删除标签',
    message: (data) => `确定要删除选中的 ${data.count} 个标签吗？\n此操作不可恢复，标签将从所有关联项目中移除。`
  },

  // ==================== 移动/恢复类 ====================
  /** 恢复 */
  RESTORE_FROM_TRASH: {
    title: '确认恢复',
    message: (data) => `确定要恢复此${data.type === 'prompt' ? '提示词' : '图像'}吗？`
  },
  /** 从提示词移除图像关联 */
  REMOVE_IMAGE_FROM_PROMPT: {
    title: '确认移除',
    message: '确定要从当前提示词中移除此图像吗？\n图像本身不会被删除。'
  },
  /** 移除新建提示词中的图像 */
  REMOVE_NEW_IMAGE: {
    title: '确认移除',
    message: '确定要移除此图像吗？'
  },
  /** 解除关联 */
  UNLINK_FROM_PROMPT: {
    title: '解除关联',
    message: (data) => `确定要解除与提示词 "${data.promptTitle || '未命名'}" 的关联吗？`
  },

  // ==================== 清空/重置类 ====================
  /** 清空回收站 */
  EMPTY_TRASH: {
    title: '确认清空',
    message: (data) => `确定要清空${data.type === 'trash-prompt' ? '提示词' : '图像'}回收站吗？此操作不可恢复。`
  },
  /** 清空所有数据 */
  CLEAR_ALL_DATA: {
    title: '危险操作',
    message: '确定要清空所有数据吗？\n\n此操作将重命名当前数据目录并创建新的空数据目录，应用将重启。\n\n重启后会显示带日期后缀的旧数据目录路径，可手动备份或删除。'
  },
  /** 数据已重置 */
  DATA_RESET: {
    type: 'info',
    title: '数据已重置',
    message: (data) => `旧数据目录已重命名为:\n${data.oldDataDir}\n\n您可以手动备份或删除此目录。`
  },

  // ==================== 标签组类 ====================
  /** 标签组名称重复 */
  TAG_GROUP_DUPLICATE_NAME: {
    title: '名称重复',
    message: (data) => `标签组名称 "${data.name}" 已存在，请使用其他名称。`,
    confirmText: '确定'
  },

  // ==================== 其他 ====================
  /** 重启应用 */
  RELAUNCH_APP: {
    title: '确认重启',
    message: '确定要重启应用吗？\n\n未保存的修改可能会丢失。'
  },
  /** 标签已存在 */
  TAG_EXISTS: {
    title: '标签已存在',
    message: (data) => `标签 "${data.tagName}" 已存在，当前所属组：${data.currentGroupName}\n\n是否覆盖并移动到：${data.newGroupName}？`
  },

  /** 双向同步标签结果 */
  SYNC_TAGS_BIDIRECTIONAL: {
    type: 'info',
    title: '同步完成',
    message: (data) => {
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
    }
  }
};

// ==================== 静态变量 ====================
let _confirmCallback: ((result: boolean) => void) | null = null;
let _previousFocus: Element | null = null;
const _activeModals = new Set<string>();
let _buttonsBound = false;

// ==================== 对话框服务 ====================
export class DialogService {
  /**
   * 类型守卫：检查是否为函数
   */
  private static isFunction(value: unknown): value is MessageFunction {
    return typeof value === 'function';
  }

  private static _bindButtonEvents(): void {
    if (_buttonsBound) return;
    document.getElementById('confirmOkBtn')?.addEventListener('click', () => {
      DialogService._closeConfirm(true);
    });
    document.getElementById('confirmCancelBtn')?.addEventListener('click', () => {
      DialogService._closeConfirm(false);
    });
    document.getElementById('closeConfirmModal')?.addEventListener('click', () => {
      DialogService._closeConfirm(false);
    });
    _buttonsBound = true;
  }

  /**
   * 显示数据目录迁移对话框
   * @param oldPath - 当前数据目录路径
   * @param newPath - 新数据目录路径
   * @returns 用户选择的操作
   */
  static async showMigrateDialog(oldPath: string, newPath: string): Promise<'copy' | 'use' | 'cancel'> {
    return new Promise((resolve) => {
      const modal = document.getElementById('migrateModal');
      const oldPathEl = document.getElementById('migrateOldPath');
      const newPathEl = document.getElementById('migrateNewPath');
      const closeBtn = document.getElementById('closeMigrateModal');
      const cancelBtn = document.getElementById('migrateCancelBtn');
      const optionBtns = modal?.querySelectorAll<HTMLElement>('.migrate-option-btn');

      if (!modal) {
        // 回退到原生对话框
        const useCopy = confirm(`更改数据目录\n\n当前：${oldPath}\n新：${newPath}\n\n点击「确定」复制当前数据到新目录，点击「取消」使用新目录现有数据`);
        resolve(useCopy ? 'copy' : 'use');
        return;
      }

      // 设置路径
      if (oldPathEl) oldPathEl.textContent = oldPath;
      if (newPathEl) newPathEl.textContent = newPath;

      // 显示对话框
      (modal as HTMLElement).style.display = 'flex';
      _activeModals.add('migrateModal');

      // 处理选项按钮点击
      const handleOptionClick = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        const action = btn.dataset.action as 'copy' | 'use' | 'cancel';
        if (!action) return;
        cleanup();
        resolve(action);
      };

      // 处理关闭/取消
      const handleCancel = () => {
        cleanup();
        resolve('cancel');
      };

      // 清理函数
      const cleanup = () => {
        (modal as HTMLElement).style.display = 'none';
        _activeModals.delete('migrateModal');
        optionBtns?.forEach(btn => btn.removeEventListener('click', handleOptionClick));
        closeBtn?.removeEventListener('click', handleCancel);
        cancelBtn?.removeEventListener('click', handleCancel);
      };

      // 绑定事件
      optionBtns?.forEach(btn => btn.addEventListener('click', handleOptionClick));
      closeBtn?.addEventListener('click', handleCancel);
      cancelBtn?.addEventListener('click', handleCancel);
    });
  }

  /**
   * 根据配置显示确认对话框
   * @param config - 对话框配置
   * @param data - 对话框数据
   * @returns 用户是否确认
   */
  static async showConfirmDialogByConfig(
    config: DialogConfigItem,
    data: DialogConfigData | null = null
  ): Promise<boolean> {
    DialogService._bindButtonEvents();

    if (_confirmCallback) {
      console.warn('Confirm dialog already open, rejecting new call');
      return false;
    }

    const title = this.isFunction(config.title) ? config.title(data || {}) : config.title;
    const msg = this.isFunction(config.message) ? config.message(data || {}) : config.message;
    const dialogType = config.type || 'warning';

    return new Promise((resolve) => {
      // 再次检查，防止在 Promise 创建过程中被其他调用修改状态
      if (_confirmCallback) {
        console.warn('Confirm dialog already open (race condition), rejecting new call');
        resolve(false);
        return;
      }

      const modal = document.getElementById('confirmModal');
      const modalTitle = document.getElementById('confirmModalTitle');
      const modalMessage = document.getElementById('confirmModalMessage');

      if (!modal) {
        resolve(window.confirm(msg));
        return;
      }

      if (modalTitle) {
        const iconMap: Record<string, string> = {
          info: '✓',
          warning: '⚠️'
        };
        const icon = iconMap[dialogType] || iconMap.warning;
        modalTitle.innerHTML = `<span class="title-icon">${icon}</span>${title}`;
      }
      if (modalMessage) modalMessage.innerHTML = msg.replace(/\n/g, '<br>');

      // 设置对话框类型样式
      modal.dataset.dialogType = dialogType;

      const cancelBtn = document.getElementById('confirmCancelBtn');
      const okBtn = document.getElementById('confirmOkBtn');

      // info 类型只显示确认按钮
      if (dialogType === 'info') {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (okBtn) okBtn.style.margin = '0 auto';
      } else {
        if (cancelBtn) cancelBtn.style.display = '';
        if (okBtn) okBtn.style.margin = '';
      }

      _previousFocus = document.activeElement;

      // 压栈：进入对话框上下文（在设置显示之前）
      const stackEntry: IContextStackEntry = {
        id: Constants.Ids.DIALOG,
        state: { isBatchToolbarVisible: false },
        close: () => { DialogService._closeConfirm(false); }
      };
      contextStack.push(stackEntry);

      (modal as HTMLElement).style.display = 'flex';
      // 添加 close 方法供 ShortcutManager 调用
      (modal as HTMLElement & { close: () => void }).close = () => DialogService._closeConfirm(false);
      _activeModals.add('confirmModal');

      setTimeout(() => {
        document.getElementById('confirmOkBtn')?.focus();
      }, 0);

      _confirmCallback = (result: boolean) => {
        _confirmCallback = null;
        resolve(result);
      };
      DialogService._bindConfirmKeyboardEvents();
    });
  }

  private static _confirmKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

  private static _bindConfirmKeyboardEvents(): void {
    // 先移除旧的监听器（如果存在）
    if (DialogService._confirmKeyDownHandler) {
      document.removeEventListener('keydown', DialogService._confirmKeyDownHandler);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!_activeModals.has('confirmModal')) {
        document.removeEventListener('keydown', handleKeyDown);
        DialogService._confirmKeyDownHandler = null;
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        DialogService._closeConfirm(true);
        document.removeEventListener('keydown', handleKeyDown);
        DialogService._confirmKeyDownHandler = null;
      }
      // Escape 由 ShortcutManager 统一处理
    };

    DialogService._confirmKeyDownHandler = handleKeyDown;
    document.addEventListener('keydown', handleKeyDown);
  }

  private static _closeConfirm(result = false): void {
    // 防止重复关闭导致栈不匹配
    if (!_confirmCallback) {
      return;
    }

    const modal = document.getElementById('confirmModal');
    if (modal) {
      (modal as HTMLElement).style.display = 'none';
    }

    const cancelBtn = document.getElementById('confirmCancelBtn');
    const okBtn = document.getElementById('confirmOkBtn');
    if (cancelBtn) (cancelBtn as HTMLElement).style.display = '';
    if (okBtn) (okBtn as HTMLElement).style.margin = '';

    // 调用回调并清空
    _confirmCallback(result);
    _confirmCallback = null;

    _activeModals.delete('confirmModal');

    // 出栈：退出对话框上下文
    contextStack.pop(Constants.Ids.DIALOG);

    if (_previousFocus instanceof HTMLElement) {
      _previousFocus.focus();
      _previousFocus = null;
    }
  }

  /**
   * 显示输入对话框
   * @param options - 对话框选项
   * @returns 用户输入的内容，取消则返回 null
   */
  static async showInputDialog(options: {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    multiline?: boolean;
    showGroupSelect?: boolean;
    groups?: Array<{ id: string | number; name: string }>;
    defaultGroupId?: string | number;
  }): Promise<{ value: string; groupId?: number | null } | null> {
    return new Promise((resolve) => {
      const modal = document.getElementById('inputModal');
      const titleEl = document.getElementById('inputModalTitle');
      const labelEl = document.getElementById('inputModalLabel');
      const inputEl = document.getElementById('inputModalField') as HTMLInputElement | HTMLTextAreaElement | null;
      const groupSection = document.getElementById('inputModalGroupSection');
      const groupSelect = document.getElementById('inputModalGroupSelect') as HTMLSelectElement | null;
      const confirmBtn = document.getElementById('inputOkBtn');
      const cancelBtn = document.getElementById('inputCancelBtn');
      const closeBtn = document.getElementById('closeInputModal');

      if (!modal || !inputEl) {
        const result = prompt(options.title, options.defaultValue || '');
        resolve(result ? { value: result } : null);
        return;
      }

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

      const cleanup = () => {
        (modal as HTMLElement).style.display = 'none';
        _activeModals.delete('inputModal');
        confirmBtn?.removeEventListener('click', handleConfirm);
        cancelBtn?.removeEventListener('click', handleCancel);
        closeBtn?.removeEventListener('click', handleCancel);
        inputEl.removeEventListener('keydown', handleKeyDown);
      };

      const handleConfirm = () => {
        const value = inputEl.value.trim();
        const hasGroupSelect = groupSection && groupSection.style.display !== 'none' && groupSelect;
        cleanup();
        contextStack.pop(Constants.Ids.DIALOG);
        resolve({
          value,
          groupId: hasGroupSelect ? (groupSelect.value ? parseInt(groupSelect.value, 10) : null) : undefined
        });
      };

      const handleCancel = () => {
        cleanup();
        contextStack.pop(Constants.Ids.DIALOG);
        resolve(null);
      };

      const handleKeyDown = (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        }
        // Escape 由 ShortcutManager 统一处理
      };

      confirmBtn?.addEventListener('click', handleConfirm);
      cancelBtn?.addEventListener('click', handleCancel);
      closeBtn?.addEventListener('click', handleCancel);
      inputEl.addEventListener('keydown', handleKeyDown);

      // 压栈：进入对话框上下文
      const inputStackEntry: IContextStackEntry = {
        id: Constants.Ids.DIALOG,
        state: { isBatchToolbarVisible: false },
        close: () => { cleanup(); resolve(null); }
      };
      contextStack.push(inputStackEntry);

      (modal as HTMLElement).style.display = 'flex';
      _activeModals.add('inputModal');
      inputEl.focus();

      // 将光标移到末尾
      setTimeout(() => {
        inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
      }, 0);
    });
  }

  /**
   * 显示选择对话框
   * @param options - 对话框选项
   * @returns 用户选择的值，取消则返回 null
   */
  static async showSelectDialog(options: {
    title: string;
    options: Array<{ value: string; label: string }>;
    defaultValue?: string;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.getElementById(Constants.Ids.SELECT_MODAL);
      const titleEl = document.getElementById(Constants.Ids.SELECT_MODAL_TITLE);
      const selectEl = document.getElementById(Constants.Ids.SELECT_MODAL_FIELD) as HTMLSelectElement | null;
      const confirmBtn = document.getElementById(Constants.Ids.SELECT_MODAL_OK_BTN);
      const cancelBtn = document.getElementById(Constants.Ids.SELECT_MODAL_CANCEL_BTN);
      const closeBtn = document.getElementById(Constants.Ids.CLOSE_SELECT_MODAL);

      if (!modal || !selectEl) {
        // 回退到原生对话框
        const optionsList = options.options.map(o => o.label).join('\n');
        const result = prompt(`${options.title}\n\n${optionsList}\n\n请输入选项值：`, options.defaultValue || '');
        resolve(result);
        return;
      }

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

      const cleanup = () => {
        (modal as HTMLElement).style.display = 'none';
        _activeModals.delete(Constants.Ids.SELECT_MODAL);
        confirmBtn?.removeEventListener('click', handleConfirm);
        cancelBtn?.removeEventListener('click', handleCancel);
        closeBtn?.removeEventListener('click', handleCancel);
      };

      const handleConfirm = () => {
        const value = selectEl.value;
        cleanup();
        contextStack.pop(Constants.Ids.DIALOG);
        resolve(value);
      };

      const handleCancel = () => {
        cleanup();
        contextStack.pop(Constants.Ids.DIALOG);
        resolve(null);
      };

      confirmBtn?.addEventListener('click', handleConfirm);
      cancelBtn?.addEventListener('click', handleCancel);
      closeBtn?.addEventListener('click', handleCancel);

      // 压栈：进入对话框上下文
      const selectStackEntry: IContextStackEntry = {
        id: Constants.Ids.DIALOG,
        state: { isBatchToolbarVisible: false },
        close: () => { cleanup(); resolve(null); }
      };
      contextStack.push(selectStackEntry);

      (modal as HTMLElement).style.display = 'flex';
      _activeModals.add(Constants.Ids.SELECT_MODAL);
    });
  }

  /**
   * 清除所有活动对话框
   */
  static clearAllDialogs(): void {
    _activeModals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        (modal as HTMLElement).style.display = 'none';
      }
    });
    _activeModals.clear();
    _confirmCallback = null;
  }
}

export default DialogService;
