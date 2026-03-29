/**
 * 对话框配置
 */
export const DialogConfig = {
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
    message: (data) => `确定要清空${data.type === 'prompt' ? '提示词' : '图像'}回收站吗？此操作不可恢复。`
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
      if (data.promptToImage.imported > 0) {
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
      if (data.imageToPrompt.imported > 0) {
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

      if (data.promptToImage.imported === 0 && data.imageToPrompt.imported === 0) {
        msg = '双方标签已同步，无需导入新标签';
      }

      return msg;
    }
  }
};

// ==================== 静态变量 ====================
let _confirmCallback = null;
let _previousFocus = null;
let _activeModals = new Set();
let _buttonsBound = false;

// ==================== 对话框服务 ====================
export class DialogService {
  static _bindButtonEvents() {
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
   * @param {string} oldPath - 当前数据目录路径
   * @param {string} newPath - 新数据目录路径
   * @returns {Promise<'copy'|'use'|'cancel'>} 用户选择的操作
   */
  static async showMigrateDialog(oldPath, newPath) {
    return new Promise((resolve) => {
      const modal = document.getElementById('migrateModal');
      const oldPathEl = document.getElementById('migrateOldPath');
      const newPathEl = document.getElementById('migrateNewPath');
      const closeBtn = document.getElementById('closeMigrateModal');
      const cancelBtn = document.getElementById('migrateCancelBtn');
      const optionBtns = modal?.querySelectorAll('.migrate-option-btn');

      if (!modal) {
        // 回退到原生对话框
        const useCopy = confirm(`\u66f4\u6539\u6570\u636e\u76ee\u5f55\n\n\u5f53\u524d\uff1a${oldPath}\n\u65b0\uff1a${newPath}\n\n\u70b9\u51fb\u300c\u786e\u5b9a\u300d\u590d\u5236\u5f53\u524d\u6570\u636e\u5230\u65b0\u76ee\u5f55\uff0c\u70b9\u51fb\u300c\u53d6\u6d88\u300d\u4f7f\u7528\u65b0\u76ee\u5f55\u73b0\u6709\u6570\u636e`);
        resolve(useCopy ? 'copy' : 'use');
        return;
      }

      // 设置路径
      if (oldPathEl) oldPathEl.textContent = oldPath;
      if (newPathEl) newPathEl.textContent = newPath;

      // 显示对话框
      modal.style.display = 'flex';
      _activeModals.add('migrateModal');

      // 处理选项按钮点击
      const handleOptionClick = (e) => {
        const btn = e.currentTarget;
        const action = btn.dataset.action;
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
        modal.style.display = 'none';
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

  static async showConfirmDialogByConfig(config, data = null) {
    DialogService._bindButtonEvents();

    if (_confirmCallback) {
      console.warn('Confirm dialog already open, rejecting new call');
      return false;
    }

    const title = typeof config.title === 'function' ? config.title(data) : config.title;
    const msg = typeof config.message === 'function' ? config.message(data) : config.message;
    const dialogType = config.type || 'warning';

    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const modalTitle = document.getElementById('confirmModalTitle');
      const modalMessage = document.getElementById('confirmModalMessage');

      if (!modal) {
        resolve(window.confirm(msg));
        return;
      }

      if (modalTitle) {
        const iconMap = {
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
        cancelBtn.style.display = 'none';
        okBtn.style.margin = '0 auto';
      } else {
        cancelBtn.style.display = '';
        okBtn.style.margin = '';
      }

      _previousFocus = document.activeElement;

      modal.style.display = 'flex';
      _activeModals.add('confirmModal');

      setTimeout(() => {
        document.getElementById('confirmOkBtn')?.focus();
      }, 0);

      _confirmCallback = (result) => {
        _confirmCallback = null;
        resolve(result);
      };
      DialogService._bindConfirmKeyboardEvents();
    });
  }

  static _bindConfirmKeyboardEvents() {
    const handleKeyDown = (e) => {
      if (!_activeModals.has('confirmModal')) {
        document.removeEventListener('keydown', handleKeyDown);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        DialogService._closeConfirm(true);
        document.removeEventListener('keydown', handleKeyDown);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        DialogService._closeConfirm(false);
        document.removeEventListener('keydown', handleKeyDown);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
  }

  static _closeConfirm(result = false) {
    const modal = document.getElementById('confirmModal');
    if (modal) {
      modal.style.display = 'none';
    }

    const cancelBtn = document.getElementById('confirmCancelBtn');
    const okBtn = document.getElementById('confirmOkBtn');
    if (cancelBtn) cancelBtn.style.display = '';
    if (okBtn) okBtn.style.margin = '';

    if (_confirmCallback) {
      _confirmCallback(result);
      _confirmCallback = null;
    }

    _activeModals.delete('confirmModal');

    if (_previousFocus) {
      _previousFocus.focus();
      _previousFocus = null;
    }
  }
}

export default DialogService;
