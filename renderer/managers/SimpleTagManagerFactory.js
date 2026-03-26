import { SimpleTagManager } from './SimpleTagManager.js';

/**
 * SimpleTagManager 工厂
 * 简化详情界面 SimpleTagManager 的创建
 * 标签组信息从 CacheManager 自动获取
 */
export class SimpleTagManagerFactory {
  /**
   * 为图像创建 SimpleTagManager
   * @param {Object} image - 图像对象
   * @param {Object} imagePanelManager - 图像面板管理器
   * @param {Function} showToast - 显示提示的函数
   * @returns {SimpleTagManager}
   */
  static createForImage(image, imagePanelManager, showToast) {
    return new SimpleTagManager({
      type: 'image',
      onSave: async (tags, options = {}) => {
        try {
          await window.electronAPI.updateImage(image.id, { tags });
          image.tags = tags;

          if (options.action === 'add') {
            showToast('标签添加成功', 'success');
            if (options.hasViolation && options.violationGroup) {
              showToast(`警告：违反单选组限制 (${options.violationGroup})`, 'warning');
            }
          } else if (options.action === 'remove') {
            showToast('标签删除成功', 'success');
          }

          if (imagePanelManager) {
            await imagePanelManager.refreshAfterUpdate();
          }
        } catch (error) {
          window.electronAPI.logError('SimpleTagManagerFactory', 'Failed to save image tags:', error);
          throw error;
        }
      },
      onRender: () => {}
    });
  }

  /**
   * 为提示词创建 SimpleTagManager
   * @param {Object} prompt - 提示词对象
   * @param {Object} promptPanelManager - 提示词面板管理器
   * @param {Function} showToast - 显示提示的函数
   * @returns {SimpleTagManager}
   */
  static createForPrompt(prompt, promptPanelManager, showToast) {
    return new SimpleTagManager({
      type: 'prompt',
      onSave: async (tags, options = {}) => {
        try {
          await window.electronAPI.updatePrompt(prompt.id, { tags });
          prompt.tags = tags;

          if (options.action === 'add') {
            showToast('标签添加成功', 'success');
            if (options.hasViolation && options.violationGroup) {
              showToast(`警告：违反单选组限制 (${options.violationGroup})`, 'warning');
            }
          } else if (options.action === 'remove') {
            showToast('标签删除成功', 'success');
          }

          if (promptPanelManager) {
            await promptPanelManager.refreshAfterUpdate();
          }
        } catch (error) {
          window.electronAPI.logError('SimpleTagManagerFactory', 'Failed to save prompt tags:', error);
          throw error;
        }
      },
      onRender: () => {}
    });
  }
}
