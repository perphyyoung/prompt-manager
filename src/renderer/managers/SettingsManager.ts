import { Constants, ElementId } from '../../constants.ts';
import { DialogService, DialogConfig } from '../services/index.ts';
import { ElectronDataClearApi } from '../services/ElectronDataClearApi.ts';
import { DuplicatePreventionMixin } from '../../utils/index.ts';
import { contextStack, IContextStackEntry } from './ContextStackManager.ts';
import { ErrorHandler } from '../renderer_utils/index.ts';
import type { IClosableElement } from '../../types/entities.ts';
import { localStorageManager } from '../configs/LocalStorageConfig.ts';

/**
 * 数据清空 API 接口
 */
interface IDataClearApi {
  clearAllData: () => Promise<string>;
}

/**
 * App 类型定义
 */
interface IApp {
  viewMode: string;
  promptPanelManager: {
    renderView: () => Promise<void>;
    renderTagFilters: () => Promise<void>;
  } | null;
  imagePanelManager: {
    renderView: () => Promise<void>;
    renderTagFilters: () => Promise<void>;
  } | null;
  showToast?: (message: string, type: string) => void;
  relaunchApp?: (renamedPath?: string) => void;
  importExportManager?: {
    exportOrphanFiles: () => Promise<boolean>;
    exportFullBackup: () => Promise<boolean>;
    importFullBackup: () => Promise<boolean>;
  } | null;
  renderStatistics?: () => Promise<void>;
}

/**
 * SettingsManager 构造选项
 */
interface ISettingsManagerOptions {
  app: IApp;
  dataClearApi?: IDataClearApi;
}

/**
 * 设置管理器
 * 负责处理应用设置相关操作和设置模态框的显示/隐藏
 */
export class SettingsManager extends DuplicatePreventionMixin(Object) {
  private app: IApp;
  private dataClearApi: IDataClearApi;

  // 设置状态
  private currentTheme: string;
  private isModalActive = false;
  private isInitialized = false;

  constructor(options: ISettingsManagerOptions) {
    super();
    this.app = options.app;
    this.dataClearApi = options.dataClearApi || new ElectronDataClearApi();

    // 设置状态
    this.currentTheme = 'light';

    // 绑定设置模态框事件
    this.bindSettingsEvents();
  }

  /**
   * 绑定设置模态框事件
   */
  private bindSettingsEvents(): void {
    // 关闭按钮
    document.getElementById(Constants.Ids.CLOSE_SETTINGS_MODAL)?.addEventListener('click', () => this.closeModal());

    // 设置按钮（打开模态框）
    document.getElementById(Constants.Ids.SETTINGS_BTN)?.addEventListener('click', () => this.openModal());
  }

  /**
   * 打开设置模态框
   */
  async openModal(): Promise<void> {
    // 获取应用版本号
    try {
      const version = await window.electronAPI.getAppVersion();
      const el = document.getElementById(Constants.Ids.SETTINGS_VERSION);
      if (el) el.textContent = 'v' + version;
    } catch (error) {
      // 版本获取失败
      console.error(error);
    }

    // 获取当前数据路径
    try {
      const dataPath = await window.electronAPI.getDataPath();
      const el = document.getElementById(Constants.Ids.CURRENT_DATA_PATH);
      if (el) el.textContent = dataPath;
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager', operation: 'get data path' },
        error,
        { showToast: false }
      );
      const el = document.getElementById(Constants.Ids.CURRENT_DATA_PATH);
      if (el) el.textContent = '获取失败';
    }

    const modal = document.getElementById(Constants.Ids.SETTINGS_MODAL);
    if (modal) {
      const stackEntry: IContextStackEntry = {
        id: Constants.Ids.SETTINGS_MODAL,
        state: { isBatchToolbarVisible: false },
        close: () => { this.closeModal(); }
      };
      contextStack.push(stackEntry);
      modal.classList.add('active');
      // 添加 close 方法供 ShortcutManager 调用
      (modal as IClosableElement).close = () => this.closeModal();
      this.isModalActive = true;
    }
  }

  /**
   * 关闭设置模态框
   */
  closeModal(): void {
    const modal = document.getElementById(Constants.Ids.SETTINGS_MODAL);
    if (modal) {
      modal.classList.remove('active');
    }
    contextStack.pop(Constants.Ids.SETTINGS_MODAL as ElementId);
    this.isModalActive = false;
  }

  /**
   * 检查模态框是否处于活动状态
   */
  isModalOpen(): boolean {
    return this.isModalActive;
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await this.loadSettings();
    this.bindEvents();
    this.isInitialized = true;
  }

  /**
   * 加载设置
   * @private
   */
  private async loadSettings(): Promise<void> {
    // 加载主题设置
    const savedTheme = localStorageManager.get<string>(Constants.LocalStorageKey.THEME);
    this.setTheme(savedTheme, false);

    // 加载卡片文字颜色设置
    const savedCardTextColor = localStorageManager.get<string>(Constants.LocalStorageKey.CARD_TEXT_COLOR);
    this.applyCardTextColor(savedCardTextColor);
    const picker = document.getElementById(Constants.Ids.CARD_TEXT_COLOR_PICKER) as HTMLInputElement | null;
    if (picker) picker.value = savedCardTextColor;

    // 先加载自定义字体列表（注入 @font-face）
    await this.loadCustomFonts();

    // 加载字体设置
    const savedFont = localStorageManager.get<string>(Constants.LocalStorageKey.FONT_FAMILY);
    this.setFontFamily(savedFont, false);

    // 加载字体大小设置
    const savedFontSize = localStorageManager.get<number>(Constants.LocalStorageKey.FONT_SIZE_SCALE);
    this.setFontSizeScale(savedFontSize, false);

    // 加载视图模式到 app
    const savedViewMode = localStorageManager.get<string>(Constants.LocalStorageKey.VIEW_MODE);
    this.app.viewMode = savedViewMode;
  }

  /**
   * 绑定事件
   * @private
   */
  private bindEvents(): void {
    // 数据路径更改
    document.getElementById(Constants.Ids.CHANGE_DATA_PATH_BTN)?.addEventListener('click', () => this.changeDataPath());

    // 清空数据
    document.getElementById(Constants.Ids.CLEAR_ALL_DATA_BTN)?.addEventListener('click', () => this.clearAllData());

    // 视图模式
    const viewModeToggle = document.getElementById(Constants.Ids.VIEW_MODE_TOGGLE) as HTMLInputElement | null;
    if (viewModeToggle) {
      // 初始化状态：safe = 选中(绿色), nsfw = 未选中(灰色)
      viewModeToggle.checked = this.app?.viewMode === Constants.ViewMode.SAFE;
      viewModeToggle.addEventListener('change', () => {
        const newMode = viewModeToggle.checked ? Constants.ViewMode.SAFE : Constants.ViewMode.NSFW;
        this.handleViewModeChange(newMode);
      });
    }

    // 主题切换
    document.getElementById(Constants.Ids.SETTINGS_THEME_TOGGLE)?.addEventListener('click', () => this.toggleTheme());

    // 卡片文字颜色选择器
    const cardTextColorPicker = document.getElementById(Constants.Ids.CARD_TEXT_COLOR_PICKER) as HTMLInputElement | null;
    if (cardTextColorPicker) {
      cardTextColorPicker.addEventListener('change', (e) => {
        const color = (e.target as HTMLInputElement).value;
        localStorageManager.set(Constants.LocalStorageKey.CARD_TEXT_COLOR, color);
        this.applyCardTextColor(color);
      });
    }

    // 自定义字体文件选择
    document.getElementById(Constants.Ids.SELECT_FONT_FILE_BTN)?.addEventListener('click', () => this.selectCustomFont());

    // 导出孤儿文件
    document.getElementById(Constants.Ids.EXPORT_ORPHAN_FILES_BTN)?.addEventListener('click', () => this.exportOrphanFiles());

    // 完整备份导出
    document.getElementById(Constants.Ids.EXPORT_FULL_BACKUP_BTN)?.addEventListener('click', () => this.exportFullBackup());

    // 完整备份导入
    document.getElementById(Constants.Ids.IMPORT_FULL_BACKUP_BTN)?.addEventListener('click', () => this.importFullBackup());

    // 绑定自定义字体下拉框事件
    const customFontSelect = document.getElementById(Constants.Ids.CUSTOM_FONT_SELECT) as HTMLSelectElement | null;
    if (customFontSelect) {
      customFontSelect.addEventListener('change', () => {
        if (customFontSelect.value) {
          this.setFontFamily(customFontSelect.value, true);
        }
      });
    }

    // 绑定字体大小按钮事件
    const fontSizeDecrease = document.getElementById(Constants.Ids.FONT_SIZE_DECREASE);
    const fontSizeIncrease = document.getElementById(Constants.Ids.FONT_SIZE_INCREASE);
    const fontSizeValue = document.getElementById(Constants.Ids.FONT_SIZE_VALUE);

    if (fontSizeDecrease && fontSizeIncrease && fontSizeValue) {
      // 初始化显示值
      const savedScale = this.getFontSizeScale();
      fontSizeValue.textContent = `${Math.round(savedScale * 100)}%`;

      fontSizeDecrease.addEventListener('click', () => {
        this.adjustFontSize(-Constants.FontSize.STEP, fontSizeValue);
      });

      fontSizeIncrease.addEventListener('click', () => {
        this.adjustFontSize(Constants.FontSize.STEP, fontSizeValue);
      });
    }
  }

  /**
   * 选择并安装自定义字体文件
   * @private
   */
  private async selectCustomFont(): Promise<void> {
    try {
      const result = await window.electronAPI.selectAndInstallFont();
      if (!result) return;

      const { fontName, filePath } = result;
      if (!fontName || !filePath) {
        this.app.showToast?.('字体信息不完整', 'error');
        return;
      }

      // 创建 @font-face 规则并注入到页面
      this.injectFontFace(fontName, filePath);

      // 自动切换到新字体
      this.setFontFamily(fontName, true);

      // 刷新已导入字体列表
      await this.loadCustomFonts();

      this.app.showToast?.(`字体 "${fontName}" 已导入并应用`, 'success');
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager.ts', operation: 'select custom font' },
        error,
        { userMessage: '导入字体失败' }
      );
    }
  }

  /**
   * 注入 @font-face CSS 规则
   * @param fontName - 字体名称
   * @param filePath - 字体文件路径
   * @private
   */
  private injectFontFace(fontName: string, filePath: string): void {
    // 检查是否已存在该字体的样式
    const styleId = `font-face-${fontName}`;
    if (document.getElementById(styleId)) return;

    // 根据文件扩展名判断字体格式
    const ext = filePath.split('.').pop()?.toLowerCase();
    let format = 'truetype';
    switch (ext) {
      case 'otf':
        format = 'opentype';
        break;
      case 'woff':
        format = 'woff';
        break;
      case 'woff2':
        format = 'woff2';
        break;
      case 'ttc':
        format = 'collection';
        break;
      default:
        format = 'truetype';
    }

    // 创建 style 元素
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @font-face {
        font-family: '${fontName}';
        src: url('file://${filePath.replace(/\\/g, '/')}') format('${format}');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 加载已导入的自定义字体列表
   * @private
   */
  private async loadCustomFonts(): Promise<void> {
    try {
      const fonts = await window.electronAPI.getInstalledFonts();
      const customFontSelect = document.getElementById(Constants.Ids.CUSTOM_FONT_SELECT) as HTMLSelectElement | null;

      if (!customFontSelect) return;

      // 注入所有字体
      fonts.forEach((font: { fontName: string; filePath: string }) => {
        this.injectFontFace(font.fontName, font.filePath);
      });

      // 获取当前保存的字体
      const savedFont = localStorageManager.get<string>(Constants.LocalStorageKey.FONT_FAMILY);

      // 生成下拉框选项
      const options = fonts.map((font: { fontName: string }) => {
        const isSelected = font.fontName === savedFont ? 'selected' : '';
        return `<option value="${font.fontName}" ${isSelected}>${font.fontName}</option>`;
      }).join('');

      // 更新下拉框
      customFontSelect.innerHTML = options || '<option value="">无已导入字体</option>';

      // 如果有保存的字体且存在于列表中，设置为选中
      if (savedFont) {
        const fontExists = fonts.some((f: { fontName: string }) => f.fontName === savedFont);
        if (fontExists) {
          customFontSelect.value = savedFont;
        }
      }
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager.ts', operation: 'load custom fonts' },
        error,
        { showToast: false }
      );
    }
  }

  /**
   * 更改数据存储目录
   */
  async changeDataPath(): Promise<void> {
    try {
      const newPath = await window.electronAPI.selectDataPath();
      if (newPath) {
        const currentDataPathEl = document.getElementById(Constants.Ids.CURRENT_DATA_PATH);
        if (currentDataPathEl) {
          currentDataPathEl.textContent = newPath;
        }
        this.app.showToast?.('数据目录已更改，重启应用后生效', 'success');
      }
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager.ts', operation: 'change data path' },
        error,
        { userMessage: '更改失败' }
      );
    }
  }

  /**
   * 清空所有数据
   */
  async clearAllData(): Promise<void> {
    const result = await this.executeWithPrevention('clearAllData', async () => {
      const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.CLEAR_ALL_DATA);

      if (!confirmed) return { success: false };

      const renamedPath = await this.dataClearApi.clearAllData();

      this.app.showToast?.('数据已清空，正在重启...', 'success');

      setTimeout(() => {
        this.app.relaunchApp?.(renamedPath);
      }, 1000);
      return { success: true };
    }, { errorMessage: '正在清空数据中...' });

    if (result === undefined) {
      // 操作正在进行中
      return;
    }

    if (!result?.success) {
      // 用户取消或操作失败
      return;
    }
  }

  /**
   * 处理视图模式变更
   * @param mode - 视图模式
   * @private
   */
  private async handleViewModeChange(mode: string): Promise<void> {
    localStorageManager.set(Constants.LocalStorageKey.VIEW_MODE, mode);

    // 更新 app 的 viewMode
    this.app.viewMode = mode;

    this.app.showToast?.(mode === 'safe' ? '已切换到安全模式' : '已切换到 NSFW 模式', 'info');

    // 更新面板管理器
    if (this.app.promptPanelManager) {
      await this.app.promptPanelManager.renderView();
      await this.app.promptPanelManager.renderTagFilters();
    }
    if (this.app.imagePanelManager) {
      await this.app.imagePanelManager.renderView();
      await this.app.imagePanelManager.renderTagFilters();
    }

    // 更新统计
    if (this.app.renderStatistics) {
      await this.app.renderStatistics();
    }
  }

  /**
   * 切换主题
   * @param theme - 主题名称 (light/dark), 不传则切换当前主题
   * @param showToast - 是否显示提示
   */
  toggleTheme(theme: string | null = null, showToast: boolean = true): void {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = theme || (currentTheme === 'light' ? 'dark' : 'light');

    this.setTheme(newTheme, showToast);
  }

  /**
   * 设置主题
   * @param theme - 主题名称 (light/dark)
   * @param showToast - 是否显示提示
   */
  setTheme(theme: string, showToast: boolean = true): void {
    const html = document.documentElement;

    html.setAttribute('data-theme', theme);
    localStorageManager.set(Constants.LocalStorageKey.THEME, theme);
    this.currentTheme = theme;

    // 更新主题切换按钮文本
    const themeToggle = document.getElementById(Constants.Ids.SETTINGS_THEME_TOGGLE);
    if (themeToggle) {
      themeToggle.innerHTML = theme === 'dark'
        ? '<span>☀️</span> 明亮'
        : '<span>🌙</span> 暗黑';
    }

    if (showToast) {
      this.app.showToast?.(theme === 'dark' ? '已切换到黑暗模式' : '已切换到明亮模式', 'success');
    }
  }

  /**
   * 应用卡片文字颜色
   * @param color - 颜色值
   */
  applyCardTextColor(color: string): void {
    document.documentElement.style.setProperty('--card-text-color', color);
  }

  /**
   * 设置字体
   * @param fontFamily - 字体值
   * @param showToast - 是否显示提示
   */
  setFontFamily(fontFamily: string, showToast: boolean = true): void {
    const root = document.documentElement;
    // 添加回退字体栈，确保自定义字体加载失败时有备用字体
    const fontStack = `${fontFamily}, ${Constants.FontFamily.FALLBACK}`;
    root.style.setProperty('--font-family', fontStack);
    localStorageManager.set(Constants.LocalStorageKey.FONT_FAMILY, fontFamily);

    if (showToast) {
      this.app.showToast?.(`字体已切换为：${fontFamily}`, 'success');
    }
  }

  /**
   * 获取当前字体
   * @returns 当前字体
   */
  getFontFamily(): string {
    return localStorageManager.get<string>(Constants.LocalStorageKey.FONT_FAMILY);
  }

  /**
   * 设置字体大小缩放比例
   * @param scale - 缩放比例 (0.8 - 1.3)
   * @param showToast - 是否显示提示
   */
  setFontSizeScale(scale: number, showToast: boolean = true): void {
    const clampedScale = Math.max(Constants.FontSize.MIN, Math.min(Constants.FontSize.MAX, scale));
    const root = document.documentElement;
    root.style.setProperty('--font-size-scale', String(clampedScale));

    if (showToast) {
      this.app.showToast?.(`字体大小已调整为 ${Math.round(clampedScale * 100)}%`, 'success');
    }
  }

  /**
   * 获取当前字体大小缩放比例
   * @returns 缩放比例
   */
  getFontSizeScale(): number {
    return localStorageManager.get<number>(Constants.LocalStorageKey.FONT_SIZE_SCALE);
  }

  /**
   * 调整字体大小
   * @param delta - 调整量 (正数增大，负数减小)
   * @param displayElement - 显示当前值的元素
   * @private
   */
  private adjustFontSize(delta: number, displayElement: HTMLElement): void {
    const currentScale = this.getFontSizeScale();
    const newScale = Math.max(
      Constants.FontSize.MIN,
      Math.min(
        Constants.FontSize.MAX,
        Math.round((currentScale + delta) * 10) / 10
      )
    );
    if (newScale !== currentScale) {
      this.setFontSizeScale(newScale);
      displayElement.textContent = `${Math.round(newScale * 100)}%`;
      localStorageManager.set(Constants.LocalStorageKey.FONT_SIZE_SCALE, newScale);
    }
  }

  /**
   * 设置视图模式
   * @param mode - 视图模式
   */
  async setViewMode(mode: string): Promise<void> {
    await this.handleViewModeChange(mode);

    // 更新选择框
    const viewModeSelect = document.getElementById(Constants.Ids.VIEW_MODE_SELECT) as HTMLSelectElement | null;
    if (viewModeSelect) {
      viewModeSelect.value = mode;
    }
  }

  /**
   * 导出孤儿文件
   * @private
   */
  private async exportOrphanFiles(): Promise<void> {
    try {
      await this.app.importExportManager?.exportOrphanFiles();
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager.ts', operation: 'export orphan files' },
        error,
        { showToast: false }
      );
    }
  }

  /**
   * 导出完整备份
   * @private
   */
  private async exportFullBackup(): Promise<void> {
    try {
      await this.app.importExportManager?.exportFullBackup();
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager.ts', operation: 'export full backup' },
        error,
        { showToast: false }
      );
    }
  }

  /**
   * 导入完整备份
   * @private
   */
  private async importFullBackup(): Promise<void> {
    try {
      // 显示确认对话框
      const confirmed = await DialogService.showConfirmDialogByConfig({
        title: '确认导入备份',
        message: '导入备份将替换当前所有数据。建议在导入前导出当前数据的备份。是否继续？',
        type: 'warning'
      });

      if (!confirmed) {
        return;
      }

      await this.app.importExportManager?.importFullBackup();
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'SettingsManager.ts', operation: 'import full backup' },
        error,
        { showToast: false }
      );
    }
  }
}
