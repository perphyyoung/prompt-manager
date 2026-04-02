import { SimpleTagManager } from './SimpleTagManager.ts';

interface Image {
  id: string | number;
  tags?: string[];
  [key: string]: unknown;
}

interface Prompt {
  id: string | number;
  tags?: string[];
  [key: string]: unknown;
}

interface IRefreshablePanelManager {
  refreshAfterUpdate: () => Promise<void>;
}

/**
 * SimpleTagManager 工厂
 * 简化详情界面 SimpleTagManager 的创建
 * 标签组信息从 CacheManager 自动获取
 */
export class SimpleTagManagerFactory {
  /**
   * 为图像创建 SimpleTagManager
   * @param image - 图像对象
   * @param imagePanelManager - 图像面板管理器
   * @param showToast - 显示提示的函数
   * @returns SimpleTagManager 实例
   */
  static createForImage(
    image: Image,
    imagePanelManager: IRefreshablePanelManager | null,
    showToast: (message: string, type: string) => void
  ): SimpleTagManager {
    return new SimpleTagManager({
      type: 'image',
      onSave: async (tags: string[], options: { action?: string } = {}) => {
        try {
          await window.electronAPI.updateImage(String(image.id), { tags });
          image.tags = tags;

          if (options.action === 'add') {
            showToast('标签添加成功', 'success');
          } else if (options.action === 'remove') {
            showToast('标签删除成功', 'success');
          }

          if (imagePanelManager) {
            await imagePanelManager.refreshAfterUpdate();
          }
        } catch (error) {
          window.electronAPI?.logError?.('SimpleTagManagerFactory', 'Failed to save image tags:', error);
          throw error;
        }
      },
      onRender: () => {}
    });
  }

  /**
   * 为提示词创建 SimpleTagManager
   * @param prompt - 提示词对象
   * @param promptPanelManager - 提示词面板管理器
   * @param showToast - 显示提示的函数
   * @returns SimpleTagManager 实例
   */
  static createForPrompt(
    prompt: Prompt,
    promptPanelManager: IRefreshablePanelManager | null,
    showToast: (message: string, type: string) => void
  ): SimpleTagManager {
    return new SimpleTagManager({
      type: 'prompt',
      onSave: async (tags: string[], options: { action?: string } = {}) => {
        try {
          await window.electronAPI.updatePrompt(String(prompt.id), { tags });
          prompt.tags = tags;

          if (options.action === 'add') {
            showToast('标签添加成功', 'success');
          } else if (options.action === 'remove') {
            showToast('标签删除成功', 'success');
          }

          if (promptPanelManager) {
            await promptPanelManager.refreshAfterUpdate();
          }
        } catch (error) {
          window.electronAPI?.logError?.('SimpleTagManagerFactory', 'Failed to save prompt tags:', error);
          throw error;
        }
      },
      onRender: () => {}
    });
  }
}

export default SimpleTagManagerFactory;
