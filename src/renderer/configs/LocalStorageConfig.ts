/**
 * LocalStorage 配置定义
 * 集中注册所有 LocalStorage 配置项
 */

import { localStorageManager } from "../../utils/LocalStorageManager";
import { Constants } from "../../constants";

/**
 * 主题配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.THEME,
  defaultValue: "dark",
  parser: (value) => (value === "light" ? "light" : "dark"),
  validator: (value) => value === "light" || value === "dark",
});

/**
 * 卡片文字颜色配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.CARD_TEXT_COLOR,
  defaultValue: "#ffffff",
});

/**
 * 字体配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.FONT_FAMILY,
  defaultValue: Constants.FontFamily.DEFAULT,
});

/**
 * 字体大小配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.FONT_SIZE_SCALE,
  defaultValue: Constants.FontSize.DEFAULT,
  parser: (value) => parseFloat(value),
  serializer: (value) => String(value),
  validator: (value) => value >= Constants.FontSize.MIN && value <= Constants.FontSize.MAX,
});

/**
 * 视图模式配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.VIEW_MODE,
  defaultValue: Constants.ViewMode.SAFE,
  validator: (value) => value === Constants.ViewMode.SAFE || value === Constants.ViewMode.NSFW,
});

/**
 * 当前面板配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.CURRENT_PANEL,
  defaultValue: "prompt",
});

/**
 * 侧边栏折叠状态配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.SIDEBAR_COLLAPSED,
  defaultValue: false,
  parser: (value) => value === "true",
  serializer: (value) => String(value),
});

/**
 * 提示词排序配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_SORT_BY,
  defaultValue: "updatedAt",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

/**
 * 图像排序配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_SORT_BY,
  defaultValue: "updatedAt",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

/**
 * 卡片大小配置（范围/默认值单点来源 Constants.CardSize）
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_CARD_SIZE,
  defaultValue: Constants.CardSize.DEFAULT,
  parser: (value) => parseInt(value, 10),
  serializer: (value) => String(value),
  validator: (value) => value >= Constants.CardSize.MIN && value <= Constants.CardSize.MAX,
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_CARD_SIZE,
  defaultValue: Constants.CardSize.DEFAULT,
  parser: (value) => parseInt(value, 10),
  serializer: (value) => String(value),
  validator: (value) => value >= Constants.CardSize.MIN && value <= Constants.CardSize.MAX,
});

/**
 * 卡片信息可见性配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.CARDS_INFO_VISIBLE,
  defaultValue: true,
  parser: (value) => value !== "false",
  serializer: (value) => String(value),
});

/**
 * 标签筛选排序配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_BY,
  defaultValue: "count",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_BY,
  defaultValue: "count",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

/**
 * 标签管理排序配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_TAG_SORT_BY,
  defaultValue: "count",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_TAG_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_TAG_SORT_BY,
  defaultValue: "count",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_TAG_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

/**
 * 图像选择器排序配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_BY,
  defaultValue: "updatedAt",
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_SELECTOR_SORT_ORDER,
  defaultValue: "desc",
  validator: (value) => value === "asc" || value === "desc",
});

/**
 * 标签筛选收起状态配置
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_TAG_FILTER_COLLAPSED,
  defaultValue: false,
  parser: (value) => value === "true",
  serializer: (value) => String(value),
});

localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_TAG_FILTER_COLLAPSED,
  defaultValue: false,
  parser: (value) => value === "true",
  serializer: (value) => String(value),
});

/**
 * 提示词面板视图模式
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.PROMPT_VIEW_MODE,
  defaultValue: "grid",
});

/**
 * 图像面板视图模式
 */
localStorageManager.registerConfig({
  key: Constants.LocalStorageKey.IMAGE_VIEW_MODE,
  defaultValue: "grid",
});

// 导出已配置的 localStorageManager 实例
export { localStorageManager };
