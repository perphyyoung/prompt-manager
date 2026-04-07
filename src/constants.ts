/**
 * 常量定义类
 * 集中管理应用中的所有常量
 */
export class Constants {
  // 导航按钮 SVG
  static NAV_SVGS = {
    first: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="11 18 5 12 11 6"></polyline>
      <polyline points="18 18 12 12 18 6"></polyline>
    </svg>`,
    prev: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>`,
    next: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>`,
    last: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="13 18 19 12 13 6"></polyline>
      <polyline points="6 18 12 12 6 6"></polyline>
    </svg>`
  };

  // 特殊标签
  static FAVORITE_TAG = '收藏';
  static UNREFERENCED_TAG = '未引';
  static MULTI_REF_TAG = '多引';
  static NO_IMAGE_TAG = '无图';
  static MULTI_IMAGE_TAG = '多图';
  static SAFE_TAG = '安全';

  // 视图模式值
  static ViewMode = Object.freeze({
    SAFE: 'safe',
    NSFW: 'nsfw'
  });

  // 字体大小设置
  static FontSize = Object.freeze({
    MIN: 0.8,
    MAX: 1.3,
    STEP: 0.1,
    DEFAULT: 1
  });

  // 字体设置
  static FontFamily = Object.freeze({
    DEFAULT: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    FALLBACK: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  });
  static UNSAFE_TAG = '敏感';
  static NO_TAG_TAG = '无标';

  // 所有特殊标签集合
  static ALL_SPECIAL_TAGS = [
    Constants.FAVORITE_TAG,
    Constants.UNREFERENCED_TAG,
    Constants.MULTI_REF_TAG,
    Constants.SAFE_TAG,
    Constants.UNSAFE_TAG,
    Constants.MULTI_IMAGE_TAG,
    Constants.NO_IMAGE_TAG,
    Constants.NO_TAG_TAG
  ];

  // 提示词特殊标签列表（用于标签管理界面）
  static PROMPT_SPECIAL_TAGS = [
    Constants.FAVORITE_TAG,
    Constants.MULTI_IMAGE_TAG,
    Constants.NO_IMAGE_TAG,
    Constants.NO_TAG_TAG
  ];

  // 图像特殊标签列表（用于标签管理界面）
  static IMAGE_SPECIAL_TAGS = [
    Constants.FAVORITE_TAG,
    Constants.UNREFERENCED_TAG,
    Constants.MULTI_REF_TAG,
    Constants.NO_TAG_TAG
  ];

  // 提示消息
  static MSG_SECONDARY_JUMP_DISABLED = '禁止二级跳转';

  // 保存状态提示
  static STATUS_SAVED = '已保存';
  static STATUS_SAVE_FAILED = '保存失败';

  // 图标定义
  static ICONS = Object.freeze({
    favorite: {
      outline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
      filled: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
    },
    delete: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    restore: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
    nav: {
      first: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>',
      prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>',
      next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
      last: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>'
    }
  });

  // LocalStorage 键名枚举
  static LocalStorageKey = Object.freeze({
    // 主题
    THEME: 'theme',

    // 卡片外观
    CARD_TEXT_COLOR: 'cardTextColor',

    // 字体
    FONT_FAMILY: 'fontFamily',
    FONT_SIZE_SCALE: 'fontSizeScale',

    // 视图
    VIEW_MODE: 'viewMode',
    CURRENT_PANEL: 'currentPanel',
    SIDEBAR_COLLAPSED: 'sidebarCollapsed',

    // 提示词排序
    PROMPT_SORT_BY: 'promptSortBy',
    PROMPT_SORT_ORDER: 'promptSortOrder',

    // 图像排序
    IMAGE_SORT_BY: 'imageSortBy',
    IMAGE_SORT_ORDER: 'imageSortOrder',

    // 标签筛选排序
    PROMPT_TAG_FILTER_SORT_BY: 'promptTagFilterSortBy',
    PROMPT_TAG_FILTER_SORT_ORDER: 'promptTagFilterSortOrder',
    IMAGE_TAG_FILTER_SORT_BY: 'imageTagFilterSortBy',
    IMAGE_TAG_FILTER_SORT_ORDER: 'imageTagFilterSortOrder',

    // 标签管理排序
    PROMPT_TAG_SORT_BY: 'promptTagSortBy',
    PROMPT_TAG_SORT_ORDER: 'promptTagSortOrder',
    IMAGE_TAG_SORT_BY: 'imageTagSortBy',
    IMAGE_TAG_SORT_ORDER: 'imageTagSortOrder',

    // 图像选择器
    IMAGE_SELECTOR_SORT_BY: 'imageSelectorSortBy',
    IMAGE_SELECTOR_SORT_ORDER: 'imageSelectorSortOrder',

    // 卡片大小
    PROMPT_CARD_SIZE: 'promptCardSize',
    IMAGE_CARD_SIZE: 'imageCardSize',

    // 标签筛选收起状态
    PROMPT_TAG_FILTER_COLLAPSED: 'promptTagFilterCollapsed',
    IMAGE_TAG_FILTER_COLLAPSED: 'imageTagFilterCollapsed',

    // 标签筛选区 section ID
    PROMPT_TAG_FILTER_SECTION: 'promptTagFilterSection',
    IMAGE_TAG_FILTER_SECTION: 'imageTagFilterSection',

    // 标签筛选区 toggle 按钮 ID
    PROMPT_TAG_FILTER_TOGGLE_BTN: 'promptTagFilterToggleBtn',
    IMAGE_TAG_FILTER_TOGGLE_BTN: 'imageTagFilterToggleBtn',

    // 标签管理器按钮 ID
    PROMPT_TAG_MANAGER_BTN: 'promptTagManagerBtn',
    IMAGE_TAG_MANAGER_BTN: 'imageTagManagerBtn'
  });

  // 字体选项
  static FONT_OPTIONS = Object.freeze([
    { value: 'system-ui', label: '系统默认' },
    { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: '现代无衬线' },
    { value: '"Microsoft YaHei", "PingFang SC", sans-serif', label: '中文优化' },
    { value: 'Georgia, "Times New Roman", serif', label: '衬线字体' },
    { value: '"Courier New", Consolas, monospace', label: '等宽字体' }
  ]);

  // 回收站类型常量
  static TrashType = Object.freeze({
    PROMPT: 'trash-prompt',
    IMAGE: 'trash-image'
  });

  // DOM 元素 ID 常量
  static Ids = Object.freeze({
    // 主面板
    PROMPT_PANEL: 'promptPanel',
    IMAGE_PANEL: 'imagePanel',

    // 提示词详情
    PROMPT_DETAIL_MODAL: 'promptDetailModal',
    PROMPT_DETAIL_BATCH_TOOLBAR: 'promptDetailBatchToolbar',

    // 图像详情
    IMAGE_DETAIL_MODAL: 'imageDetailModal',
    IMAGE_DETAIL_BATCH_TOOLBAR: 'imageDetailBatchToolbar',

    // 标签管理器
    PROMPT_TAG_MANAGER_MODAL: 'promptTagManagerModal',
    IMAGE_TAG_MANAGER_MODAL: 'imageTagManagerModal',

    // 回收站
    PROMPT_TRASH_MODAL: 'promptTrashModal',
    IMAGE_TRASH_MODAL: 'imageTrashModal',

    // 设置和统计
    SETTINGS_MODAL: 'settingsModal',
    STATISTICS_MODAL: 'statisticsModal',

    // 全屏查看器
    IMAGE_FULLSCREEN_VIEWER: 'imageFullscreenViewer',

    // 主面板批量模式工具栏
    MAIN_BATCH_TOOLBAR: 'mainBatchToolbar',

    // 标签管理器批量工具栏
    PROMPT_TAG_BATCH_TOOLBAR: 'promptTagBatchToolbar',
    IMAGE_TAG_BATCH_TOOLBAR: 'imageTagBatchToolbar',

    // 下拉菜单和对话框（用于 ESC 处理）
    DROPDOWN: 'dropdown',
    DIALOG: 'confirmModal',

    // 标签自动完成下拉框
    PROMPT_DETAIL_TAG_AUTOCOMPLETE: 'promptDetailTagAutocomplete',
    IMAGE_DETAIL_TAG_AUTOCOMPLETE: 'imageDetailTagAutocomplete',

    // 工具栏按钮
    REFRESH_DATA_BTN: 'refreshDataBtn',
    RELAUNCH_BTN: 'relaunchBtn'
  } as const);
}

// 类型导出
export type ElementId = typeof Constants.Ids[keyof typeof Constants.Ids];
