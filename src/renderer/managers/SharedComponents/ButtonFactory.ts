/**
 * 按钮工厂类
 * 提供统一的按钮配置创建方法
 */

export interface ButtonConfig {
  type: string;
  action: string;
  title: string;
  className?: string;
}

export interface ListButtonOptions {
  id: string | number;
  isActive?: boolean;
  icon: string;
  title?: string;
}

export class ButtonFactory {
  /**
   * 创建收藏按钮
   * @param action - 动作名称
   * @returns 按钮配置
   */
  static createFavoriteButton(action = 'toggleFavorite'): ButtonConfig {
    return {
      type: 'favorite',
      action,
      title: '收藏/取消'
    };
  }

  /**
   * 创建复制按钮
   * @returns 按钮配置
   */
  static createCopyButton(): ButtonConfig {
    return {
      type: 'copy',
      action: 'copy',
      title: '复制'
    };
  }

  /**
   * 创建删除按钮
   * @returns 按钮配置
   */
  static createDeleteButton(): ButtonConfig {
    return {
      type: 'delete',
      action: 'delete',
      title: '删除'
    };
  }

  /**
   * 创建恢复按钮
   * @returns 按钮配置
   */
  static createRestoreButton(): ButtonConfig {
    return {
      type: 'restore',
      action: 'restore',
      title: '恢复',
      className: 'btn-restore'
    };
  }

  /**
   * 创建彻底删除按钮
   * @returns 按钮配置
   */
  static createPermanentDeleteButton(): ButtonConfig {
    return {
      type: 'delete',
      action: 'permanentDelete',
      title: '彻底删除',
      className: 'btn-danger'
    };
  }
}

export interface Icons {
  favorite: { filled: string; outline: string };
  copy: string;
  delete: string;
  restore?: string;
  undo?: string;
}

/**
 * 按钮图标查找表
 * 用于根据按钮类型获取对应的图标
 */
export const BUTTON_ICON_MAP: Record<string, (icons: Icons, isActive?: boolean) => string> = {
  favorite: (icons, isActive) => isActive ? icons.favorite.filled : icons.favorite.outline,
  copy: (icons) => icons.copy,
  delete: (icons) => icons.delete,
  restore: (icons) => icons.restore || icons.undo || ''
};

interface ListButtonConfig {
  title: string;
  activeTitle?: string;
  className: string;
}

/**
 * 列表按钮配置查找表
 * 用于列表视图按钮的标题和样式
 */
const LIST_BUTTON_CONFIG: Record<string, ListButtonConfig> = {
  favorite: {
    title: '收藏',
    activeTitle: '取消收藏',
    className: 'favorite-btn'
  },
  copy: {
    title: '复制内容',
    className: 'copy-btn'
  },
  delete: {
    title: '删除',
    className: 'delete-btn'
  }
};

/**
 * 生成列表按钮 HTML
 * @param type - 按钮类型
 * @param options - 配置选项
 * @returns 按钮 HTML
 */
export function createListButtonHtml(type: string, options: ListButtonOptions): string {
  const { id, isActive, icon } = options;
  const config = LIST_BUTTON_CONFIG[type];
  if (!config) return '';

  const activeClass = isActive ? 'active' : '';
  const title = isActive && config.activeTitle ? config.activeTitle : config.title;

  return `<button type="button" class="${config.className} ${activeClass}" title="${title}" data-id="${id}">${icon}</button>`;
}
