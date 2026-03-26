import { DialogService, DialogConfig } from '../services/index.js';
import { localTime } from '../../utils/index.js';
import { UnifiedCardRenderer, PromptTrashConfig, ImageTrashConfig } from './SharedComponents/index.js';
import { Constants } from '../../constants.js';

/**
 * 回收站管理器
 * 管理已删除的提示词和图像，支持恢复和永久删除
 */
export class TrashManager {
  /**
   * 回收站类型配置
   */
  static TRASH_CONFIG = {
    [Constants.TrashType.PROMPT]: {
      api: 'getPromptTrash',
      emptyApi: 'emptyPromptTrash',
      restoreApi: 'restorePromptFromTrash',
      deleteApi: 'permanentDeletePrompt',
      containerId: 'promptTrashList',
      label: '提示词'
    },
    [Constants.TrashType.IMAGE]: {
      api: 'getImageTrash',
      emptyApi: 'emptyImageTrash',
      restoreApi: 'restoreImageFromTrash',
      deleteApi: 'permanentDeleteImage',
      containerId: 'imageTrashList',
      label: '图像'
    }
  };

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Object} options.app - 主应用引用
   * @param {Object} options.eventBus - 事件总线
   */
  constructor(options) {
    this.app = options.app;
    this.eventBus = options.eventBus;
    this.trashItems = [];
    this.currentType = Constants.TrashType.PROMPT; // Constants.TrashType.PROMPT | Constants.TrashType.IMAGE
  }

  /**
   * 初始化回收站
   */
  async init() {
    await this.loadTrash();
    this.bindEvents();
  }

  /**
   * 获取当前类型的配置
   * @returns {Object} 配置对象
   */
  getCurrentConfig() {
    return TrashManager.TRASH_CONFIG[this.currentType];
  }

  /**
   * 加载回收站列表
   */
  async loadTrash() {
    try {
      const config = this.getCurrentConfig();
      const items = await window.electronAPI[config.api]();

      // 为每个项目添加 type 字段
      this.trashItems = items.map(item => ({
        ...item,
        type: this.currentType
      }));

      await this.renderTrashList();
      this.eventBus.emit('trashLoaded', { items: this.trashItems });
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to load trash:', error);
      this.app.showToast('加载回收站失败', 'error');
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 清空回收站按钮
    const clearBtn = document.getElementById('emptyPromptTrashBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.confirmClearTrash());
    }
  }

  /**
   * 渲染回收站列表
   */
  async renderTrashList() {
    // 只渲染当前类型的数据
    await this.renderTrashListForType(this.currentType);
  }

  /**
   * 渲染指定类型的回收站列表
   * @param {string} type - 类型 (Constants.TrashType.PROMPT | Constants.TrashType.IMAGE)
   */
  async renderTrashListForType(type) {
    const containerId = type === Constants.TrashType.PROMPT ? 'promptTrashList' : 'imageTrashList';
    const container = document.getElementById(containerId);

    if (!container) return;

    // 过滤出该类型的项目
    const items = this.trashItems.filter(item => item.type === type);

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <p>回收站为空</p>
        </div>
      `;
      return;
    }

    const html = items.map(item => this.renderTrashItem(item)).join('');
    container.innerHTML = html;
    this.bindTrashItemEventsForContainer(container);
    this.loadCardBackgroundsForContainer(container);
  }

  /**
   * 渲染回收站项
   * @param {Object} item - 回收站项
   * @returns {string} HTML 字符串
   */
  renderTrashItem(item) {
    // 根据 type 选择配置（图像回收站使用 Constants.TrashType.IMAGE）
    const config = item.type === Constants.TrashType.IMAGE ? ImageTrashConfig : PromptTrashConfig;
    return UnifiedCardRenderer.render(config, item, {
      icons: Constants.ICONS,
      sortBy: null,
      app: this.app
    });
  }

  /**
   * 绑定回收站项事件（针对指定容器）
   * @param {HTMLElement} container - 容器元素
   */
  bindTrashItemEventsForContainer(container) {
    const items = container.querySelectorAll('.trash-card');
    
    items.forEach(item => {
      // 恢复按钮
      const restoreBtn = item.querySelector('[data-action="restore"]');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const itemId = item.dataset.id;
          const itemType = item.dataset.type;
          await this.restoreItem(itemId, itemType);
        });
      }

      // 删除按钮
      const deleteBtn = item.querySelector('[data-action="permanentDelete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const itemId = item.dataset.id;
          const itemType = item.dataset.type;
          await this.permanentlyDeleteItem(itemId, itemType);
        });
      }
    });
  }

  /**
   * 异步加载卡片背景图（针对指定容器）
   * @param {HTMLElement} container - 容器元素
   */
  async loadCardBackgroundsForContainer(container) {
    const cards = container.querySelectorAll('.trash-card');

    for (const card of cards) {
      const itemId = card.dataset.id;
      const itemType = card.dataset.type;

      const item = this.trashItems.find(i => String(i.id) === String(itemId));
      if (!item) continue;

      // 获取图像路径（与主界面保持一致：优先使用 thumbnailPath，否则使用 relativePath）
      let imagePath = null;
      if (itemType === Constants.TrashType.IMAGE) {
        // 图像类型：使用自身的 thumbnailPath 或 relativePath
        imagePath = item.thumbnailPath || item.relativePath;
      } else if (itemType === Constants.TrashType.PROMPT) {
        // 提示词类型：使用关联的第一张图像
        if (item.images && item.images.length > 0) {
          imagePath = item.images[0].thumbnailPath || item.images[0].relativePath;
        }
      }

      if (!imagePath) continue;

      try {
        const fullPath = await window.electronAPI.getImagePath(imagePath);
        const bgElement = card.querySelector('.trash-card-bg, .card__bg');
        if (bgElement) {
          bgElement.style.backgroundImage = `url('file://${fullPath.replace(/\\/g, '/')}')`;
        }
      } catch (error) {
        window.electronAPI.logError('TrashManager.js', 'Failed to load trash card background:', error);
      }
    }
  }

  /**
   * 刷新主界面面板
   * @param {string} itemType - 项目类型 (Constants.TrashType.PROMPT/Constants.TrashType.IMAGE)
   * @private
   */
  refreshMainPanel(itemType) {
    const isPrompt = itemType === Constants.TrashType.PROMPT;
    const panelManager = isPrompt ? this.app.promptPanelManager : this.app.imagePanelManager;
    const eventName = isPrompt ? 'promptsChanged' : 'imagesChanged';

    if (panelManager) {
      panelManager.renderView();
      panelManager.renderTagFilters();
      this.app.eventBus?.emit(eventName);
    }
  }

  /**
   * 恢复单个项目
   * @param {string} itemId - 项目 ID
   * @param {string} itemType - 项目类型 ('trash-prompt'/'trash-image')
   */
  async restoreItem(itemId, itemType) {
    try {
      const config = TrashManager.TRASH_CONFIG[itemType];
      await window.electronAPI[config.restoreApi](itemId);

      // 恢复后更新缓存状态（避免重新查询数据库）
      this.updateCacheAfterRestore(itemId, itemType);

      this.app.showToast('已恢复', 'success');

      // 重新加载回收站
      await this.loadTrash();

      // 刷新主界面（使用已更新的缓存数据，无需重新加载）
      this.refreshMainPanel(itemType);

      // 刷新统计界面
      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics();
      }

      // 通知事件
      this.eventBus.emit('itemRestored', {
        id: itemId,
        type: itemType
      });
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to restore item:', error);
      this.app.showToast('恢复失败', 'error');
    }
  }

  /**
   * 恢复后更新缓存中的项目状态
   * 使用 cacheManager.updateCachedItem 统一更新缓存
   * @param {string} itemId - 项目 ID
   * @param {string} itemType - 项目类型 (Constants.TrashType.PROMPT/Constants.TrashType.IMAGE)
   */
  updateCacheAfterRestore(itemId, itemType) {
    const now = localTime();
    const cacheManager = this.app?.cacheManager;
    if (!cacheManager) return;

    cacheManager.updateCachedItem(itemId, itemType, {
      isDeleted: 0,
      deletedAt: null,
      updatedAt: now
    });
  }

  /**
   * 批量恢复所有项目
   * 使用缓存更新，避免全量重新加载
   * @param {string} itemType - 项目类型 (Constants.TrashType.PROMPT/Constants.TrashType.IMAGE)
   */
  async restoreAll(itemType) {
    try {
      // 1. 获取当前回收站中该类型的项目
      const itemsToRestore = this.trashItems.filter(item => item.type === itemType);

      if (itemsToRestore.length === 0) {
        this.app.showToast('回收站已为空', 'info');
        return;
      }

      // 2. 批量恢复数据库
      if (itemType === Constants.TrashType.PROMPT) {
        await window.electronAPI.restoreAllPrompts();
      } else if (itemType === Constants.TrashType.IMAGE) {
        await window.electronAPI.restoreAllImages();
      }

      // 3. 批量更新缓存
      const cacheManager = this.app?.cacheManager;
      const now = localTime();

      if (cacheManager) {
        for (const item of itemsToRestore) {
          cacheManager.updateCachedItem(item.id, itemType, {
            isDeleted: 0,
            deletedAt: null,
            updatedAt: now
          });
        }
      }

      this.app.showToast(`已恢复 ${itemsToRestore.length} 个项目`, 'success');

      // 4. 重新加载回收站
      await this.loadTrash();

      // 5. 刷新主界面（使用已更新的缓存数据，无需重新加载）
      this.refreshMainPanel(itemType);

      // 刷新统计界面
      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to restore all items:', error);
      this.app.showToast('恢复失败', 'error');
    }
  }

  /**
   * 从缓存中移除项目
   * @param {string} itemId - 项目 ID
   * @param {string} itemType - 项目类型 (Constants.TrashType.PROMPT/Constants.TrashType.IMAGE)
   * @private
   */
  removeFromCache(itemId, itemType) {
    const cacheManager = this.app?.cacheManager;
    if (cacheManager) {
      cacheManager.removeCachedItem(itemId, itemType);
    }
  }

  /**
   * 永久删除项目
   * @param {string} itemId - 项目 ID
   * @param {string} itemType - 项目类型 (Constants.TrashType.PROMPT/Constants.TrashType.IMAGE)
   */
  async permanentlyDeleteItem(itemId, itemType) {
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.PERMANENT_DELETE,
      { type: itemType }
    );

    if (!confirmed) return;

    try {
      const config = TrashManager.TRASH_CONFIG[itemType];
      await window.electronAPI[config.deleteApi](itemId);

      this.app.showToast('已永久删除', 'success');

      // 重新加载回收站
      await this.loadTrash();

      // 从缓存中移除
      this.removeFromCache(itemId, itemType);

      // 刷新主界面数据（使用缓存更新，无需重新加载）
      this.refreshMainPanel(itemType);

      // 刷新统计界面
      if (this.app.currentPanel === 'statistics') {
        await this.app.renderStatistics();
      }
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to permanently delete item:', error);
      this.app.showToast('删除失败', 'error');
    }
  }

  /**
   * 清空回收站
   */
  async clearTrash() {
    try {
      const config = TrashManager.TRASH_CONFIG[this.currentType];
      await window.electronAPI[config.emptyApi]();
      this.app.showToast('回收站已清空', 'success');

      await this.loadTrash();

      if (this.currentType === Constants.TrashType.PROMPT) {
        this.app.eventBus?.emit('promptsChanged');
      } else if (this.currentType === Constants.TrashType.IMAGE) {
        this.app.eventBus?.emit('imagesChanged');
      }
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to clear trash:', error);
      this.app.showToast('清空失败', 'error');
    }
  }

  /**
   * 添加到回收站（内部使用）
   * @param {Object} item - 项目信息
   */
  async addItem(item) {
    this.trashItems.unshift({
      ...item,
      deletedAt: localTime()
    });
    await this.renderTrashList();
  }

  /**
   * 获取回收站项目数量
   * @returns {number} 项目数量
   */
  getCount() {
    return this.trashItems.length;
  }

  /**
   * 获取回收站项目
   * @returns {Array} 项目列表
   */
  getItems() {
    return this.trashItems;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.trashItems = [];
    this.filter = 'all';
  }

  /**
   * 打开回收站
   * @param {string} type - 类型 (Constants.TrashType.PROMPT | Constants.TrashType.IMAGE)
   */
  async open(type = Constants.TrashType.PROMPT) {
    this.currentType = type;
    await this.loadTrash();
    this.app.modalManager?.openTrashModal(type);
  }

  /**
   * 关闭回收站
   */
  close() {
    this.app.modalManager?.closeTrashModal(this.currentType);
  }

  /**
   * 清空回收站
   */
  async empty() {
    const confirmed = await DialogService.showConfirmDialogByConfig(
      DialogConfig.EMPTY_TRASH,
      { type: this.currentType }
    );
    if (!confirmed) return;

    try {
      const config = TrashManager.TRASH_CONFIG[this.currentType];
      await window.electronAPI[config.emptyApi]();
      this.app.showToast('回收站已清空', 'success');
      await this.loadTrash();
    } catch (error) {
      window.electronAPI.logError('TrashManager.js', 'Failed to empty trash:', error);
      this.app.showToast('清空回收站失败', 'error');
    }
  }
}

export default TrashManager;
