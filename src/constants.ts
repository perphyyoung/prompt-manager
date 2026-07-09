/**
 * 常量定义类
 * 集中管理应用中的所有常量
 */
export class Constants {
  // 应用名称
  static APP_NAME = "Prompt Manager";

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
    </svg>`,
  };

  // 特殊标签
  static FAVORITE_TAG = "收藏";
  static UNREFERENCED_TAG = "未引";
  static MULTI_REF_TAG = "多引";
  static NO_IMAGE_TAG = "无图";
  static MULTI_IMAGE_TAG = "多图";
  static SAFE_TAG = "安全";

  // 视图模式值
  static ViewMode = Object.freeze({
    SAFE: "safe",
    NSFW: "nsfw",
  });

  // 字体大小设置
  static FontSize = Object.freeze({
    MIN: 0.8,
    MAX: 1.3,
    STEP: 0.1,
    DEFAULT: 1,
  });

  // 字体设置
  static FontFamily = Object.freeze({
    DEFAULT: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    FALLBACK: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });
  static UNSAFE_TAG = "敏感";
  static NO_TAG_TAG = "无标";
  static SINGLE_LANG_TAG = "单语";

  // 所有特殊标签集合
  static ALL_SPECIAL_TAGS = [
    Constants.FAVORITE_TAG,
    Constants.UNREFERENCED_TAG,
    Constants.MULTI_REF_TAG,
    Constants.SAFE_TAG,
    Constants.UNSAFE_TAG,
    Constants.MULTI_IMAGE_TAG,
    Constants.NO_IMAGE_TAG,
    Constants.NO_TAG_TAG,
    Constants.SINGLE_LANG_TAG,
  ];

  // 提示词特殊标签列表（用于标签管理界面）
  static PROMPT_SPECIAL_TAGS = [
    Constants.FAVORITE_TAG,
    Constants.MULTI_IMAGE_TAG,
    Constants.NO_IMAGE_TAG,
    Constants.NO_TAG_TAG,
    Constants.SINGLE_LANG_TAG,
  ];

  // 图像特殊标签列表（用于标签管理界面）
  static IMAGE_SPECIAL_TAGS = [
    Constants.FAVORITE_TAG,
    Constants.UNREFERENCED_TAG,
    Constants.MULTI_REF_TAG,
    Constants.NO_TAG_TAG,
  ];

  // 提示消息
  static MSG_SECONDARY_JUMP_DISABLED = "禁止二级跳转";

  // 标签输入框 placeholder
  static PLACEHOLDER_TAG_INPUT = "回车添加标签，用逗号或空格分隔可以批量";
  static PLACEHOLDER_TAG_RENAME = "请输入新标签名:";

  // 保存状态提示
  static STATUS_SAVED = "已保存";
  static STATUS_SAVE_FAILED = "保存失败";

  // 图像右键菜单
  static CONTEXT_MENU_SET_AS_FIRST = "设为首张";
  static CONTEXT_MENU_OPEN_LOCATION = "打开本地保存位置";

  // 图标定义
  static ICONS = Object.freeze({
    favorite: {
      outline:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
      filled:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    },
    delete:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    restore:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
    nav: {
      first:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>',
      prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>',
      next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
      last: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>',
    },
  });

  // LocalStorage 键名枚举
  static LocalStorageKey = Object.freeze({
    // 主题
    THEME: "theme",

    // 卡片外观
    CARD_TEXT_COLOR: "cardTextColor",

    // 字体
    FONT_FAMILY: "fontFamily",
    FONT_SIZE_SCALE: "fontSizeScale",

    // 视图
    VIEW_MODE: "viewMode",
    CURRENT_PANEL: "currentPanel",
    SIDEBAR_COLLAPSED: "sidebarCollapsed",

    // 提示词视图模式
    PROMPT_VIEW_MODE: "promptViewMode",

    // 图像视图模式
    IMAGE_VIEW_MODE: "imageViewMode",

    // 提示词排序
    PROMPT_SORT_BY: "promptSortBy",
    PROMPT_SORT_ORDER: "promptSortOrder",

    // 图像排序
    IMAGE_SORT_BY: "imageSortBy",
    IMAGE_SORT_ORDER: "imageSortOrder",

    // 标签筛选排序
    PROMPT_TAG_FILTER_SORT_BY: "promptTagFilterSortBy",
    PROMPT_TAG_FILTER_SORT_ORDER: "promptTagFilterSortOrder",
    IMAGE_TAG_FILTER_SORT_BY: "imageTagFilterSortBy",
    IMAGE_TAG_FILTER_SORT_ORDER: "imageTagFilterSortOrder",

    // 标签管理排序
    PROMPT_TAG_SORT_BY: "promptTagSortBy",
    PROMPT_TAG_SORT_ORDER: "promptTagSortOrder",
    IMAGE_TAG_SORT_BY: "imageTagSortBy",
    IMAGE_TAG_SORT_ORDER: "imageTagSortOrder",

    // 图像选择器
    IMAGE_SELECTOR_SORT_BY: "imageSelectorSortBy",
    IMAGE_SELECTOR_SORT_ORDER: "imageSelectorSortOrder",

    // 卡片大小
    PROMPT_CARD_SIZE: "promptCardSize",
    IMAGE_CARD_SIZE: "imageCardSize",

    // 标签筛选收起状态
    PROMPT_TAG_FILTER_COLLAPSED: "promptTagFilterCollapsed",
    IMAGE_TAG_FILTER_COLLAPSED: "imageTagFilterCollapsed",

    // 卡片信息是否可见
    CARDS_INFO_VISIBLE: "cardsInfoVisible",
  });

  // 字体选项
  static FONT_OPTIONS = Object.freeze([
    { value: "system-ui", label: "系统默认" },
    {
      value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      label: "现代无衬线",
    },
    { value: '"Microsoft YaHei", "PingFang SC", sans-serif', label: "中文优化" },
    { value: 'Georgia, "Times New Roman", serif', label: "衬线字体" },
    { value: '"Courier New", Consolas, monospace', label: "等宽字体" },
  ]);

  // 回收站类型常量
  static TrashType = Object.freeze({
    PROMPT: "trash-prompt",
    IMAGE: "trash-image",
  });

  // DOM 元素 ID 常量
  static Ids = Object.freeze({
    // 主面板
    PROMPT_PANEL: "promptPanel",
    IMAGE_PANEL: "imagePanel",

    // 侧边栏
    SIDEBAR: "sidebar",
    TOGGLE_SIDEBAR_BTN: "toggleSidebarBtn",

    // 设置按钮
    SETTINGS_BTN: "settingsBtn",

    // 提示词搜索和工具栏
    PROMPT_SEARCH_INPUT: "promptSearchInput",
    CLEAR_PROMPT_SEARCH_BTN: "clearPromptSearchBtn",
    PROMPT_TRASH_BTN: "promptTrashBtn",
    PROMPT_SORT_SELECT: "promptSortSelect",
    PROMPT_SORT_REVERSE_BTN: "promptSortReverseBtn",
    PROMPT_CARD_SIZE_SLIDER: "promptCardSizeSlider",

    // 提示词标签筛选区
    PROMPT_TAG_FILTER_CONTENT: "promptTagFilterContent",
    PROMPT_TAG_FILTER_DIVIDER: "promptTagFilterDivider",

    // 提示词视图容器
    PROMPT_GRID: "promptGrid",
    PROMPT_LIST: "promptList",
    PROMPT_EMPTY_STATE: "promptEmptyState",

    // 提示词详情
    PROMPT_DETAIL_MODAL: "promptDetailModal",
    PROMPT_DETAIL_BATCH_TOOLBAR: "promptDetailBatchToolbar",

    // 图像详情
    IMAGE_DETAIL_MODAL: "imageDetailModal",
    IMAGE_DETAIL_BATCH_TOOLBAR: "imageDetailBatchToolbar",

    // 标签管理器
    PROMPT_TAG_MANAGER_MODAL: "promptTagManagerModal",
    IMAGE_TAG_MANAGER_MODAL: "imageTagManagerModal",

    // 回收站
    PROMPT_TRASH_MODAL: "promptTrashModal",
    IMAGE_TRASH_MODAL: "imageTrashModal",

    // 设置和统计
    SETTINGS_MODAL: "settingsModal",
    STATISTICS_MODAL: "statisticsModal",

    // 全屏查看器
    IMAGE_FULLSCREEN_VIEWER: "imageFullscreenViewer",

    // 主面板批量模式工具栏
    PROMPT_MAIN_BATCH_TOOLBAR: "promptMainBatchToolbar",
    IMAGE_MAIN_BATCH_TOOLBAR: "imageMainBatchToolbar",

    // 主面板批量操作按钮
    PROMPT_BATCH_SELECT_ALL_BTN: "promptBatchSelectAllBtn",
    PROMPT_BATCH_INVERT_BTN: "promptBatchInvertBtn",
    PROMPT_BATCH_ADD_TAG_BTN: "promptBatchAddTagBtn",
    PROMPT_BATCH_FAVORITE_BTN: "promptBatchFavoriteBtn",
    PROMPT_BATCH_DELETE_BTN: "promptBatchDeleteBtn",
    PROMPT_BATCH_CANCEL_BTN: "promptBatchCancelBtn",
    IMAGE_BATCH_SELECT_ALL_BTN: "imageBatchSelectAllBtn",
    IMAGE_BATCH_INVERT_BTN: "imageBatchInvertBtn",
    IMAGE_BATCH_ADD_TAG_BTN: "imageBatchAddTagBtn",
    IMAGE_BATCH_FAVORITE_BTN: "imageBatchFavoriteBtn",
    IMAGE_BATCH_DELETE_BTN: "imageBatchDeleteBtn",
    IMAGE_BATCH_CANCEL_BTN: "imageBatchCancelBtn",

    // 标签管理器批量工具栏
    PROMPT_TAG_BATCH_TOOLBAR: "promptTagBatchToolbar",
    IMAGE_TAG_BATCH_TOOLBAR: "imageTagBatchToolbar",

    // 下拉菜单和对话框（用于 ESC 处理）
    DROPDOWN: "dropdown",
    CONFIRM_MODAL: "confirmModal",
    INPUT_MODAL: "inputModal",

    // 选择对话框
    SELECT_MODAL: "selectModal",
    SELECT_MODAL_FIELD: "selectModalField",
    SELECT_MODAL_TITLE: "selectModalTitle",
    SELECT_OK_BTN: "selectOkBtn",
    SELECT_CANCEL_BTN: "selectCancelBtn",
    CLOSE_SELECT_MODAL: "closeSelectModal",

    // 标签自动完成下拉框
    PROMPT_DETAIL_TAG_AUTOCOMPLETE: "promptDetailTagAutocomplete",
    IMAGE_DETAIL_TAG_AUTOCOMPLETE: "imageDetailTagAutocomplete",
    INPUT_MODAL_TAG_AUTOCOMPLETE: "inputModalTagAutocomplete",

    // 提示词详情标签相关
    PROMPT_DETAIL_TAGS_CONTAINER: "promptDetailTagsContainer",
    PROMPT_DETAIL_TAGS_INPUT: "promptDetailTagsInput",

    // 图像详情标签相关
    IMAGE_DETAIL_TAGS_CONTAINER: "imageDetailTagsContainer",
    IMAGE_DETAIL_TAG_INPUT: "imageDetailTagInput",

    // 工具栏按钮
    REFRESH_DATA_BTN: "refreshDataBtn",
    RELAUNCH_BTN: "relaunchBtn",
    STATISTICS_BTN: "statisticsBtn",

    // 面板工具栏按钮
    PROMPT_ADD_BTN: "promptAddBtn",
    IMAGE_ADD_BTN: "imageAddBtn",

    // 卡片信息开关按钮
    CARD_INFO_TOGGLE_BTN: "cardInfoToggleBtn",

    // 标签组卡片容器（用于区分图像和提示词标签组）
    PROMPT_TAG_GROUP_CARDS: "promptTagGroupCards",
    IMAGE_TAG_GROUP_CARDS: "imageTagGroupCards",

    // 主界面左上角的提示词和图像的图标按钮
    IMAGE_MANAGER_BTN: "imageManagerBtn",
    PROMPT_MANAGER_BTN: "promptManagerBtn",

    // 网格视图切换按钮
    IMAGE_GRID_VIEW_BTN: "imageGridViewBtn",
    PROMPT_GRID_VIEW_BTN: "promptGridViewBtn",

    // 列表视图切换按钮
    IMAGE_LIST_VIEW_BTN: "imageListViewBtn",
    PROMPT_LIST_VIEW_BTN: "promptListViewBtn",

    // 紧凑视图切换按钮
    IMAGE_COMPACT_VIEW_BTN: "imageCompactViewBtn",
    PROMPT_COMPACT_VIEW_BTN: "promptCompactViewBtn",

    // 标签管理器按钮
    IMAGE_TAG_MANAGER_BTN: "imageTagManagerBtn",
    PROMPT_TAG_MANAGER_BTN: "promptTagManagerBtn",
    CLOSE_IMAGE_TAG_MANAGER_MODAL: "closeImageTagManagerModal",
    CLOSE_PROMPT_TAG_MANAGER_MODAL: "closePromptTagManagerModal",
    ADD_IMAGE_TAG_IN_MANAGER_BTN: "addImageTagInManagerBtn",
    ADD_PROMPT_TAG_IN_MANAGER_BTN: "addPromptTagInManagerBtn",
    ADD_IMAGE_TAG_GROUP_BTN: "addImageTagGroupBtn",
    ADD_PROMPT_TAG_GROUP_BTN: "addPromptTagGroupBtn",
    BATCH_MANAGE_IMAGE_TAGS_BTN: "batchManageImageTagsBtn",
    BATCH_MANAGE_PROMPT_TAGS_BTN: "batchManagePromptTagsBtn",

    // 标签管理器搜索和排序
    IMAGE_TAG_MANAGER_SEARCH_INPUT: "imageTagManagerSearchInput",
    PROMPT_TAG_MANAGER_SEARCH_INPUT: "promptTagManagerSearchInput",
    CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN: "clearImageTagManagerSearchBtn",
    CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN: "clearPromptTagManagerSearchBtn",
    IMAGE_TAG_MANAGER_SORT_SELECT: "imageTagManagerSortSelect",
    PROMPT_TAG_MANAGER_SORT_SELECT: "promptTagManagerSortSelect",
    IMAGE_TAG_MANAGER_ORDER_BTN: "imageTagManagerOrderBtn",
    PROMPT_TAG_MANAGER_ORDER_BTN: "promptTagManagerOrderBtn",

    // 标签筛选区排序
    IMAGE_TAG_FILTER_SORT_SELECT: "imageTagFilterSortSelect",
    PROMPT_TAG_FILTER_SORT_SELECT: "promptTagFilterSortSelect",
    IMAGE_TAG_FILTER_ORDER_BTN: "imageTagFilterOrderBtn",
    PROMPT_TAG_FILTER_ORDER_BTN: "promptTagFilterOrderBtn",
    IMAGE_TAG_FILTER_INVERT_BTN: "imageTagFilterInvertBtn",
    PROMPT_TAG_FILTER_INVERT_BTN: "promptTagFilterInvertBtn",
    PROMPT_SCROLL_NAV: "promptScrollNav",
    IMAGE_SCROLL_NAV: "imageScrollNav",

    // 输入对话框
    INPUT_MODAL_TITLE: "inputModalTitle",
    INPUT_MODAL_LABEL: "inputModalLabel",
    INPUT_MODAL_FIELD: "inputModalField",
    INPUT_MODAL_GROUP_SECTION: "inputModalGroupSection",
    INPUT_MODAL_GROUP_SELECT: "inputModalGroupSelect",
    INPUT_OK_BTN: "inputOkBtn",
    INPUT_CANCEL_BTN: "inputCancelBtn",
    CLOSE_INPUT_MODAL: "closeInputModal",

    // 标签组编辑模态框
    IMAGE_TAG_GROUP_EDIT_MODAL: "imageTagGroupEditModal",
    PROMPT_TAG_GROUP_EDIT_MODAL: "promptTagGroupEditModal",
    IMAGE_TAG_GROUP_EDIT_NAME: "imageTagGroupEditName",
    PROMPT_TAG_GROUP_EDIT_NAME: "promptTagGroupEditName",
    SAVE_IMAGE_TAG_GROUP_BTN: "saveImageTagGroupBtn",
    SAVE_PROMPT_TAG_GROUP_BTN: "savePromptTagGroupBtn",

    // 确认对话框
    CONFIRM_MODAL_TITLE: "confirmModalTitle",
    CONFIRM_MODAL_MESSAGE: "confirmModalMessage",
    CONFIRM_OK_BTN: "confirmOkBtn",
    CONFIRM_CANCEL_BTN: "confirmCancelBtn",
    CLOSE_CONFIRM_MODAL: "closeConfirmModal",

    // 选择对话框
    SELECT_MODAL_LABEL: "selectModalLabel",

    // Toast 容器
    TOAST_CONTAINER: "toastContainer",
    TOAST_MESSAGE: "toastMessage",

    // 提示词预览 Tooltip
    PROMPT_PREVIEW_TOOLTIP: "promptPreviewTooltip",
    PROMPT_PREVIEW_CONTENT: "promptPreviewContent",
    PROMPT_PREVIEW_IMAGE: "promptPreviewImage",

    // 进度对话框
    PROGRESS_DIALOG: "progressDialog",
    PROGRESS_DIALOG_TITLE: "progressDialogTitle",
    CLOSE_PROGRESS_DIALOG: "closeProgressDialog",
    PROGRESS_BAR: "progressBar",
    PROGRESS_FILL: "progressFill",
    PROGRESS_PERCENT: "progressPercent",
    PROGRESS_STATUS: "progressStatus",
    PROGRESS_DETAIL: "progressDetail",
    PROGRESS_TIME: "progressTime",
    PROGRESS_ACTIONS: "progressActions",
    CANCEL_PROGRESS_BTN: "cancelProgressBtn",
    CLOSE_PROGRESS_BTN: "closeProgressBtn",

    // 标签管理器空状态
    IMAGE_TAG_MANAGER_EMPTY: "imageTagManagerEmpty",
    PROMPT_TAG_MANAGER_EMPTY: "promptTagManagerEmpty",

    // 标签管理器工具栏
    PROMPT_TAG_MANAGER_TOOLBAR: "promptTagManagerToolbar",
    IMAGE_TAG_MANAGER_TOOLBAR: "imageTagManagerToolbar",

    // 同步标签按钮
    SYNC_PROMPT_TAGS_BTN: "syncPromptTagsBtn",
    SYNC_IMAGE_TAGS_BTN: "syncImageTagsBtn",

    // 统计模态框关闭按钮
    CLOSE_STATISTICS_MODAL: "closeStatisticsModal",

    // 统计元素 ID
    STAT_PROMPTS_TOTAL: "statPromptsTotal",
    STAT_PROMPTS_DELETED: "statPromptsDeleted",
    STAT_PROMPTS_FAVORITE: "statPromptsFavorite",
    STAT_PROMPTS_WITH_IMAGES: "statPromptsWithImages",
    STAT_PROMPT_TAG_GROUPS: "statPromptTagGroups",
    STAT_PROMPT_TAGS_TOTAL: "statPromptTagsTotal",
    STAT_IMAGES_TOTAL: "statImagesTotal",
    STAT_IMAGES_DELETED: "statImagesDeleted",
    STAT_IMAGES_FAVORITE: "statImagesFavorite",
    STAT_IMAGES_REFERENCED: "statImagesReferenced",
    STAT_IMAGE_TAG_GROUPS: "statImageTagGroups",
    STAT_IMAGE_TAGS_TOTAL: "statImageTagsTotal",

    // 标签组编辑模态框关闭按钮
    CLOSE_IMAGE_TAG_GROUP_EDIT_MODAL: "closeImageTagGroupEditModal",
    CLOSE_PROMPT_TAG_GROUP_EDIT_MODAL: "closePromptTagGroupEditModal",

    // 标签组编辑模态框取消按钮
    CANCEL_IMAGE_TAG_GROUP_EDIT_BTN: "cancelImageTagGroupEditBtn",
    CANCEL_PROMPT_TAG_GROUP_EDIT_BTN: "cancelPromptTagGroupEditBtn",

    // 标签组编辑模态框输入字段
    IMAGE_TAG_GROUP_EDIT_TYPE: "imageTagGroupEditType",
    PROMPT_TAG_GROUP_EDIT_TYPE: "promptTagGroupEditType",
    IMAGE_TAG_GROUP_EDIT_ID: "imageTagGroupEditId",
    PROMPT_TAG_GROUP_EDIT_ID: "promptTagGroupEditId",
    IMAGE_TAG_GROUP_EDIT_SORT_ORDER: "imageTagGroupEditSortOrder",
    PROMPT_TAG_GROUP_EDIT_SORT_ORDER: "promptTagGroupEditSortOrder",

    // 标签筛选区 section ID
    PROMPT_TAG_FILTER_SECTION: "promptTagFilterSection",
    IMAGE_TAG_FILTER_SECTION: "imageTagFilterSection",

    // 标签筛选区 toggle 按钮 ID
    PROMPT_TAG_FILTER_TOGGLE_BTN: "promptTagFilterToggleBtn",
    IMAGE_TAG_FILTER_TOGGLE_BTN: "imageTagFilterToggleBtn",

    // 标签筛选区特殊标签容器
    PROMPT_TAG_FILTER_SPECIAL_TAGS: "promptTagFilterSpecialTags",
    IMAGE_TAG_FILTER_SPECIAL_TAGS: "imageTagFilterSpecialTags",

    // 标签筛选区标签列表
    PROMPT_TAG_FILTER_LIST: "promptTagFilterList",
    IMAGE_TAG_FILTER_LIST: "imageTagFilterList",

    // 标签筛选区动作按钮
    PROMPT_TAG_FILTER_ACTION_BTN: "promptTagFilterActionBtn",
    IMAGE_TAG_FILTER_ACTION_BTN: "imageTagFilterActionBtn",

    // 标签筛选区头部标签容器（收起时显示）
    PROMPT_TAG_FILTER_HEADER_TAGS: "promptTagFilterHeaderTags",
    IMAGE_TAG_FILTER_HEADER_TAGS: "imageTagFilterHeaderTags",

    // 全屏图像查看器
    IMAGE_FULLSCREEN_VIEWER_CLOSE: "imageFullscreenViewerClose",
    IMAGE_FULLSCREEN_VIEWER_FIRST_NAV_BTN: "imageFullscreenViewerFirstNavBtn",
    IMAGE_FULLSCREEN_VIEWER_PREV_NAV_BTN: "imageFullscreenViewerPrevNavBtn",
    IMAGE_FULLSCREEN_VIEWER_NEXT_NAV_BTN: "imageFullscreenViewerNextNavBtn",
    IMAGE_FULLSCREEN_VIEWER_LAST_NAV_BTN: "imageFullscreenViewerLastNavBtn",
    IMAGE_FULLSCREEN_VIEWER_INFO: "imageFullscreenViewerInfo",
    IMAGE_FULLSCREEN_VIEWER_FILE_NAME: "imageFullscreenViewerFileName",
    IMAGE_FULLSCREEN_VIEWER_COUNTER: "imageFullscreenViewerCounter",
    IMAGE_FULLSCREEN_VIEWER_HINT: "imageFullscreenViewerHint",
    IMAGE_FULLSCREEN_VIEWER_WRAPPER: "imageFullscreenViewerWrapper",
    IMAGE_FULLSCREEN_VIEWER_IMG: "imageFullscreenViewerImg",
    IMAGE_FULLSCREEN_VIEWER_CLICK_LEFT: "imageFullscreenViewerClickLeft",
    IMAGE_FULLSCREEN_VIEWER_CLICK_RIGHT: "imageFullscreenViewerClickRight",

    // 新建提示词页面
    NEW_PROMPT_PAGE: "newPromptPage",
    CLOSE_NEW_PROMPT_PAGE: "closeNewPromptPage",
    NEW_PROMPT_ID: "newPromptId",
    NEW_PROMPT_CONTENT: "newPromptContent",
    NEW_PROMPT_IMAGE_PREVIEW_LIST: "newPromptImagePreviewList",
    NEW_PROMPT_IMAGE_UPLOAD_AREA: "newPromptImageUploadArea",
    NEW_PROMPT_IMAGE_INPUT: "newPromptImageInput",
    NEW_PROMPT_CANCEL_BTN: "newPromptCancelBtn",
    NEW_PROMPT_DONE_BTN: "newPromptDoneBtn",

    // 图像详情 Modal
    EDIT_PROMPT_FROM_IMAGE_BTN: "editPromptFromImageBtn",
    EDIT_PROMPT_BTN_TEXT: "editPromptBtnText",
    IMAGE_DETAIL_PROMPT_TITLE: "imageDetailPromptTitle",
    IMAGE_DETAIL_PROMPT_CONTENT: "imageDetailPromptContent",
    IMAGE_DETAIL_PROMPT_TRANSLATE: "imageDetailPromptTranslate",
    IMAGE_DETAIL_PROMPT_NOTE: "imageDetailPromptNote",
    IMAGE_DETAIL_TAGS: "imageDetailTags",
    IMAGE_DETAIL_IMG: "imageDetailImg",
    IMAGE_DETAIL_FIRST_NAV_BTN: "imageDetailFirstNavBtn",
    IMAGE_DETAIL_PREV_NAV_BTN: "imageDetailPrevNavBtn",
    IMAGE_DETAIL_NEXT_NAV_BTN: "imageDetailNextNavBtn",
    IMAGE_DETAIL_LAST_NAV_BTN: "imageDetailLastNavBtn",
    IMAGE_DETAIL_COUNTER: "imageDetailCounter",
    IMAGE_DETAIL_FAVORITE_BTN: "imageDetailFavoriteBtn",
    IMAGE_DETAIL_SAFE_TOGGLE: "imageDetailSafeToggle",
    IMAGE_DETAIL_CLOSE_BTN: "imageDetailCloseBtn",
    IMAGE_DETAIL_FILE_NAME: "imageDetailFileName",
    IMAGE_DETAIL_FILE_NAME_STATUS: "imageDetailFileNameStatus",
    IMAGE_DETAIL_BATCH_TAG_TOOLBAR: "imageDetailBatchTagToolbar",
    IMAGE_DETAIL_BATCH_TAG_COUNT: "imageDetailBatchTagCount",
    IMAGE_DETAIL_BATCH_TAG_DELETE_BTN: "imageDetailBatchTagDeleteBtn",
    IMAGE_DETAIL_BATCH_TAG_CANCEL_BTN: "imageDetailBatchTagCancelBtn",
    IMAGE_DETAIL_BATCH_TAG_BTN: "imageDetailBatchTagBtn",
    IMAGE_DETAIL_TAG_INPUT_AREA: "imageDetailTagInputArea",
    IMAGE_DETAIL_NOTE: "imageDetailNote",
    IMAGE_DETAIL_NOTE_STATUS: "imageDetailNoteStatus",
    IMAGE_DETAIL_UPDATED_AT: "imageDetailUpdatedAt",
    IMAGE_DETAIL_CREATED_AT: "imageDetailCreatedAt",
    IMAGE_DETAIL_DIMENSIONS: "imageDetailDimensions",
    IMAGE_DETAIL_FILE_SIZE: "imageDetailFileSize",

    // 图像面板相关
    IMAGE_SEARCH_INPUT: "imageSearchInput",
    CLEAR_IMAGE_SEARCH_BTN: "clearImageSearchBtn",
    IMAGE_TRASH_BTN: "imageTrashBtn",
    IMAGE_SORT_SELECT: "imageSortSelect",
    IMAGE_SORT_REVERSE_BTN: "imageSortReverseBtn",
    IMAGE_CARD_SIZE_SLIDER: "imageCardSizeSlider",
    IMAGE_TAG_FILTER_CONTENT: "imageTagFilterContent",
    IMAGE_GRID: "imageGrid",
    IMAGE_LIST: "imageList",
    IMAGE_PROMPT_TOOLTIP: "imagePromptTooltip",
    IMAGE_PROMPT_TOOLTIP_CONTENT: "imagePromptTooltipContent",
    IMAGE_EMPTY_STATE: "imageEmptyState",

    // 提示词详情模态框相关
    PROMPT_DETAIL_ID: "promptDetailId",
    PROMPT_DETAIL_CLOSE_BTN: "promptDetailCloseBtn",
    PROMPT_DETAIL_TITLE: "promptDetailTitle",
    PROMPT_DETAIL_TITLE_STATUS: "promptDetailTitleStatus",
    PROMPT_DETAIL_CONTENT: "promptDetailContent",
    PROMPT_DETAIL_CONTENT_STATUS: "promptDetailContentStatus",
    PROMPT_DETAIL_CONTENT_COPY_BTN: "promptDetailContentCopyBtn",
    PROMPT_DETAIL_TRANSLATE: "promptDetailTranslate",
    PROMPT_DETAIL_TRANSLATE_STATUS: "promptDetailTranslateStatus",
    PROMPT_DETAIL_TRANSLATE_COPY_BTN: "promptDetailTranslateCopyBtn",
    PROMPT_DETAIL_BATCH_TAG_TOOLBAR: "promptDetailBatchTagToolbar",
    PROMPT_DETAIL_BATCH_TAG_COUNT: "promptDetailBatchTagCount",
    PROMPT_DETAIL_BATCH_TAG_DELETE_BTN: "promptDetailBatchTagDeleteBtn",
    PROMPT_DETAIL_BATCH_TAG_CANCEL_BTN: "promptDetailBatchTagCancelBtn",
    PROMPT_DETAIL_BATCH_TAG_BTN: "promptDetailBatchTagBtn",
    PROMPT_DETAIL_TAG_INPUT_AREA: "promptDetailTagInputArea",
    PROMPT_DETAIL_NOTE: "promptDetailNote",
    PROMPT_DETAIL_NOTE_STATUS: "promptDetailNoteStatus",
    PROMPT_DETAIL_FIRST_NAV_BTN: "promptDetailFirstNavBtn",
    PROMPT_DETAIL_PREV_NAV_BTN: "promptDetailPrevNavBtn",
    PROMPT_DETAIL_NEXT_NAV_BTN: "promptDetailNextNavBtn",
    PROMPT_DETAIL_LAST_NAV_BTN: "promptDetailLastNavBtn",

    // 图像详情相关
    IMAGE_PREVIEW_LIST: "imagePreviewList",
    IMAGE_UPLOAD_AREA: "imageUploadArea",
    IMAGE_INPUT: "imageInput",
    IMAGE_DETAIL_INFO_LIST: "imageDetailInfoList",

    // 提示词详情按钮
    PROMPT_DETAIL_SELECT_FROM_IMAGE_MANAGER_BTN: "promptDetailSelectFromImageManagerBtn",
    PROMPT_DETAIL_FAVORITE_BTN: "promptDetailFavoriteBtn",
    PROMPT_DETAIL_SAFE_TOGGLE: "promptDetailSafeToggle",

    CLOSE_SETTINGS_MODAL: "closeSettingsModal",
    SETTINGS_VERSION: "settingsVersion",
    SETTINGS_THEME_TOGGLE: "settingsThemeToggle",
    SETTINGS_SUN_ICON: "settingsSunIcon",
    SETTINGS_MOON_ICON: "settingsMoonIcon",
    SETTINGS_THEME_TEXT: "settingsThemeText",
    CARD_TEXT_COLOR_PICKER: "cardTextColorPicker",
    FONT_SIZE_DECREASE: "fontSizeDecrease",
    FONT_SIZE_VALUE: "fontSizeValue",
    FONT_SIZE_INCREASE: "fontSizeIncrease",
    CUSTOM_FONT_SELECT: "customFontSelect",
    SELECT_FONT_FILE_BTN: "selectFontFileBtn",
    CURRENT_DATA_PATH: "currentDataPath",
    EXPORT_ORPHAN_FILES_BTN: "exportOrphanFilesBtn",
    EXPORT_FULL_BACKUP_BTN: "exportFullBackupBtn",
    IMPORT_FULL_BACKUP_BTN: "importFullBackupBtn",
    VIEW_MODE_TOGGLE: "viewModeToggle",
    VIEW_MODE_SELECT: "viewModeSelect",
    CLEAR_ALL_DATA_BTN: "clearAllDataBtn",

    // 动态创建的上下文菜单
    DYNAMIC_CONTEXT_MENU: "dynamicContextMenu",

    // 标签面板和回收站面板（用于快捷键）
    TAGS_PANEL: "tagsPanel",
    TRASH_PANEL: "trashPanel",

    // 图像上传 Modal
    IMAGE_UPLOAD_MODAL: "imageUploadModal",
    CLOSE_IMAGE_UPLOAD_MODAL: "closeImageUploadModal",
    IMAGE_UPLOAD_FORM: "imageUploadForm",
    NEW_PROMPT_FORM: "newPromptForm",
    MODAL_IMAGE_UPLOAD_AREA: "modalImageUploadArea",
    MODAL_UPLOAD_PLACEHOLDER: "modalUploadPlaceholder",
    MODAL_IMAGE_PREVIEW_LIST: "modalImagePreviewList",
    UPLOAD_IMAGE_PROMPT: "uploadImagePrompt",
    CANCEL_IMAGE_UPLOAD_BTN: "cancelImageUploadBtn",
    CONFIRM_IMAGE_UPLOAD_BTN: "confirmImageUploadBtn",

    // 图像选择器 Modal
    IMAGE_SELECTOR_MODAL: "imageSelectorModal",
    CLOSE_IMAGE_SELECTOR_MODAL: "closeImageSelectorModal",
    IMAGE_SELECTOR_SEARCH_INPUT: "imageSelectorSearchInput",
    CLEAR_IMAGE_SELECTOR_SEARCH_BTN: "clearImageSelectorSearchBtn",
    IMAGE_SELECTOR_TAG_FILTER: "imageSelectorTagFilter",
    IMAGE_SELECTOR_SORT_SELECT: "imageSelectorSortSelect",
    IMAGE_SELECTOR_SORT_REVERSE_BTN: "imageSelectorSortReverseBtn",
    IMAGE_SELECTOR_GRID: "imageSelectorGrid",
    IMAGE_SELECTOR_EMPTY: "imageSelectorEmpty",
    CANCEL_IMAGE_SELECTOR_BTN: "cancelImageSelectorBtn",
    CONFIRM_IMAGE_SELECTOR_BTN: "confirmImageSelectorBtn",

    CLOSE_PROMPT_TRASH_MODAL: "closePromptTrashModal",
    RESTORE_ALL_PROMPT_TRASH_BTN: "restoreAllPromptTrashBtn",
    EMPTY_PROMPT_TRASH_BTN: "emptyPromptTrashBtn",
    PROMPT_TRASH_LIST: "promptTrashList",
    PROMPT_TRASH_EMPTY: "promptTrashEmpty",

    CLOSE_IMAGE_TRASH_MODAL: "closeImageTrashModal",
    RESTORE_ALL_IMAGE_TRASH_BTN: "restoreAllImageTrashBtn",
    EMPTY_IMAGE_TRASH_BTN: "emptyImageTrashBtn",
    IMAGE_TRASH_LIST: "imageTrashList",
    IMAGE_TRASH_EMPTY: "imageTrashEmpty",
  } as const);
}

// 类型导出
export type ElementId = (typeof Constants.Ids)[keyof typeof Constants.Ids];

/**
 * 事件名称常量
 * 集中管理所有 EventBus 事件名称，避免魔法字符串
 */
export class Events {
  // ========== 数据变更事件 ==========

  /** 提示词数据发生变化（增删改） */
  static readonly PROMPTS_CHANGED = "promptsChanged";

  /** 图像数据发生变化（增删改） */
  static readonly IMAGES_CHANGED = "imagesChanged";

  /** 所有事件名称集合（用于调试和验证） */
  static readonly ALL_EVENTS = [Events.PROMPTS_CHANGED, Events.IMAGES_CHANGED] as const;
}

/** 事件名称类型 */
export type EventName = (typeof Events.ALL_EVENTS)[number];
