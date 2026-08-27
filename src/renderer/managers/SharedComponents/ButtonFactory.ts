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

export class ButtonFactory {
  /**
   * 创建收藏按钮
   * @param action - 动作名称
   * @returns 按钮配置
   */
  static createFavoriteButton(action = "toggleFavorite"): ButtonConfig {
    return {
      type: "favorite",
      action,
      title: "收藏/取消",
    };
  }

  /**
   * 创建复制按钮
   * @returns 按钮配置
   */
  static createCopyButton(): ButtonConfig {
    return {
      type: "copy",
      action: "copy",
      title: "复制",
    };
  }

  /**
   * 创建删除按钮
   * @returns 按钮配置
   */
  static createDeleteButton(): ButtonConfig {
    return {
      type: "delete",
      action: "delete",
      title: "删除",
    };
  }

  /**
   * 创建恢复按钮
   * @returns 按钮配置
   */
  static createRestoreButton(): ButtonConfig {
    return {
      type: "restore",
      action: "restore",
      title: "恢复",
      className: "btn-restore",
    };
  }

  /**
   * 创建彻底删除按钮
   * @returns 按钮配置
   */
  static createPermanentDeleteButton(): ButtonConfig {
    return {
      type: "delete",
      action: "permanentDelete",
      title: "彻底删除",
      className: "btn-danger",
    };
  }

  /**
   * 创建复选框按钮
   * @returns 按钮配置
   */
  static createCheckboxButton(): ButtonConfig {
    return {
      type: "checkbox",
      action: "toggleSelect",
      title: "选择",
      className: "checkbox-btn",
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
  favorite: (icons, isActive) => (isActive ? icons.favorite.filled : icons.favorite.outline),
  copy: (icons) => icons.copy,
  delete: (icons) => icons.delete,
  restore: (icons) => icons.restore || icons.undo || "",
};
