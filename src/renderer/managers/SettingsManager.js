import { Constants } from '../../constants.js';
import { DialogService, DialogConfig } from '../services/index.js';
import { ElectronDataClearApi } from '../services/ElectronDataClearApi.js';

/**
 * 设置管理器
 * 负责处理应用设置相关操作
 */
export class SettingsManager {
  /**
   * @param {Object} options - 配置选项
   * @param {Object} options.app - 应用实例
   * @param {DataClearApi} options.dataClearApi - 数据清空 API（可选，默认为 ElectronDataClearApi）
   */
  constructor(options = {}) {
    this.app = options.app;
    this.dataClearApi = options.dataClearApi || new ElectronDataClearApi();

    // 设置状态
    this.currentTheme = 'light';
  }

  /**
   * 初始化
   */
  async init() {
    await this.loadSettings();
    this.bindEvents();
  }

  /**
   * 加载设置
   * @private
   */
  async loadSettings() {
    // 加载主题设置
    const savedTheme = localStorage.getItem(Constants.LocalStorageKey.THEME);
    if (savedTheme) {
      this.setTheme(savedTheme, false);
    }

    // 先加载自定义字体列表（注入 @font-face）
    await this.loadCustomFonts();

    // 加载字体设置
    const savedFont = localStorage.getItem(Constants.LocalStorageKey.FONT_FAMILY);
    if (savedFont) {
      this.setFontFamily(savedFont, false);
    }

    // 加载字体大小设置
    const savedFontSize = localStorage.getItem(Constants.LocalStorageKey.FONT_SIZE_SCALE);
    if (savedFontSize) {
      this.setFontSizeScale(parseFloat(savedFontSize), false);
    }

    // 加载视图模式到 app
    const savedViewMode = localStorage.getItem(Constants.LocalStorageKey.VIEW_MODE);
    if (savedViewMode && this.app) {
      this.app.viewMode = savedViewMode;
    }
  }

  /**
   * 绑定事件
   * @private
   */
  bindEvents() {
    // 数据路径更改
    document.getElementById('changeDataPathBtn')?.addEventListener('click', () => this.changeDataPath());

    // 清空数据
    document.getElementById('clearAllDataBtn')?.addEventListener('click', () => this.clearAllData());

    // 视图模式
    const viewModeToggle = document.getElementById('viewModeToggle');
    if (viewModeToggle) {
      // 初始化状态：safe = 选中(绿色), nsfw = 未选中(灰色)
      viewModeToggle.checked = this.app?.viewMode === Constants.ViewMode.SAFE;
      viewModeToggle.addEventListener('change', () => {
        const newMode = viewModeToggle.checked ? Constants.ViewMode.SAFE : Constants.ViewMode.NSFW;
        this.handleViewModeChange(newMode);
      });
    }

    // 主题切换
    document.getElementById('settingsThemeToggle')?.addEventListener('click', () => this.toggleTheme());

    // 自定义字体文件选择
    document.getElementById('selectFontFileBtn')?.addEventListener('click', () => this.selectCustomFont());

    // 导出孤儿文件
    document.getElementById('exportOrphanFilesBtn')?.addEventListener('click', () => this.exportOrphanFiles());

    // 完整备份导出
    document.getElementById('exportFullBackupBtn')?.addEventListener('click', () => this.exportFullBackup());

    // 完整备份导入
    document.getElementById('importFullBackupBtn')?.addEventListener('click', () => this.importFullBackup());

    // 绑定自定义字体下拉框事件
    const customFontSelect = document.getElementById('customFontSelect');
    if (customFontSelect) {
      customFontSelect.addEventListener('change', () => {
        if (customFontSelect.value) {
          this.setFontFamily(customFontSelect.value, true);
        }
      });
    }

    // 绑定字体大小按钮事件
    const fontSizeDecrease = document.getElementById('fontSizeDecrease');
    const fontSizeIncrease = document.getElementById('fontSizeIncrease');
    const fontSizeValue = document.getElementById('fontSizeValue');

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
  async selectCustomFont() {
    try {
      const result = await window.electronAPI.selectAndInstallFont();
      if (!result) return;

      const { fontName, filePath } = result;

      // 创建 @font-face 规则并注入到页面
      this.injectFontFace(fontName, filePath);

      // 自动切换到新字体
      this.setFontFamily(fontName, true);

      // 刷新已导入字体列表
      await this.loadCustomFonts();

      this.app.showToast?.(`字体 "${fontName}" 已导入并应用`, 'success');
    } catch (error) {
      window.electronAPI.logError('SettingsManager.js', 'Failed to select custom font:', error);
      this.app.showToast?.('导入字体失败：' + error.message, 'error');
    }
  }

  /**
   * 注入 @font-face CSS 规则
   * @param {string} fontName - 字体名称
   * @param {string} filePath - 字体文件路径
   * @private
   */
  injectFontFace(fontName, filePath) {
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
  async loadCustomFonts() {
    try {
      const fonts = await window.electronAPI.getInstalledFonts();
      const customFontSelect = document.getElementById('customFontSelect');

      if (!customFontSelect) return;

      // 注入所有字体
      fonts.forEach(font => {
        this.injectFontFace(font.fontName, font.filePath);
      });

      // 获取当前保存的字体
      const savedFont = localStorage.getItem(Constants.LocalStorageKey.FONT_FAMILY);

      // 生成下拉框选项
      const options = fonts.map(font => {
        const isSelected = font.fontName === savedFont ? 'selected' : '';
        return `<option value="${font.fontName}" ${isSelected}>${font.fontName}</option>`;
      }).join('');

      // 更新下拉框
      customFontSelect.innerHTML = options || '<option value="">无已导入字体</option>';

      // 如果有保存的字体且存在于列表中，设置为选中
      if (savedFont) {
        const fontExists = fonts.some(f => f.fontName === savedFont);
        if (fontExists) {
          customFontSelect.value = savedFont;
        }
      }
    } catch (error) {
      window.electronAPI.logError('SettingsManager.js', 'Failed to load custom fonts:', error);
    }
  }

  /**
   * 更改数据存储目录
   */
  async changeDataPath() {
    try {
      const newPath = await window.electronAPI.selectDataPath();
      if (newPath) {
        const currentDataPathEl = document.getElementById('currentDataPath');
        if (currentDataPathEl) {
          currentDataPathEl.textContent = newPath;
        }
        this.app.showToast?.('数据目录已更改，重启应用后生效', 'success');
      }
    } catch (error) {
      window.electronAPI.logError('SettingsManager.js', 'Failed to change data path:', error);
      this.app.showToast?.('更改失败：' + error.message, 'error');
    }
  }

  /**
   * 清空所有数据
   */
  async clearAllData() {
    try {
      const confirmed = await DialogService.showConfirmDialogByConfig(DialogConfig.CLEAR_ALL_DATA);

      if (!confirmed) return;

      const renamedPath = await this.dataClearApi.clearAllData();

      this.app.showToast?.('数据已清空，正在重启...', 'success');

      setTimeout(() => {
        this.app.relaunchApp(renamedPath);
      }, 1000);
    } catch (error) {
      window.electronAPI.logError('SettingsManager.js', 'Failed to clear all data:', error);
      this.app.showToast?.('清空失败：' + error.message, 'error');
    }
  }

  /**
   * 处理视图模式变更
   * @param {'safe' | 'nsfw'} mode - 视图模式
   * @private
   */
  async handleViewModeChange(mode) {
    localStorage.setItem(Constants.LocalStorageKey.VIEW_MODE, mode);

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
   * @param {string} theme - 主题名称 (light/dark), 不传则切换当前主题
   * @param {boolean} showToast - 是否显示提示
   */
  toggleTheme(theme = null, showToast = true) {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = theme || (currentTheme === 'light' ? 'dark' : 'light');

    this.setTheme(newTheme, showToast);
  }

  /**
   * 设置主题
   * @param {string} theme - 主题名称 (light/dark)
   * @param {boolean} showToast - 是否显示提示
   */
  setTheme(theme, showToast = true) {
    const html = document.documentElement;

    html.setAttribute('data-theme', theme);
    localStorage.setItem(Constants.LocalStorageKey.THEME, theme);
    this.currentTheme = theme;

    // 更新主题切换按钮文本
    const themeToggle = document.getElementById('settingsThemeToggle');
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
   * 获取当前主题
   * @returns {string}
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * 获取视图模式
   * @returns {'safe' | 'nsfw'}
   */
  getViewMode() {
    return this.app?.viewMode || Constants.ViewMode.SAFE;
  }

  /**
   * 处理字体变更
   * @param {string} fontFamily - 字体值
   * @private
   */
  handleFontFamilyChange(fontFamily) {
    this.setFontFamily(fontFamily, true);
  }

  /**
   * 设置字体
   * @param {string} fontFamily - 字体值
   * @param {boolean} showToast - 是否显示提示
   */
  setFontFamily(fontFamily, showToast = true) {
    const root = document.documentElement;
    // 添加回退字体栈，确保自定义字体加载失败时有备用字体
    const fontStack = `${fontFamily}, ${Constants.FontFamily.FALLBACK}`;
    root.style.setProperty('--font-family', fontStack);
    localStorage.setItem(Constants.LocalStorageKey.FONT_FAMILY, fontFamily);

    if (showToast) {
      this.app.showToast?.(`字体已切换为：${fontFamily}`, 'success');
    }
  }

  /**
   * 获取当前字体
   * @returns {string}
   */
  getFontFamily() {
    return localStorage.getItem(Constants.LocalStorageKey.FONT_FAMILY)
      || Constants.FontFamily.DEFAULT;
  }

  /**
   * 设置字体大小缩放比例
   * @param {number} scale - 缩放比例 (0.8 - 1.3)
   * @param {boolean} showToast - 是否显示提示
   */
  setFontSizeScale(scale, showToast = true) {
    const clampedScale = Math.max(Constants.FontSize.MIN, Math.min(Constants.FontSize.MAX, scale));
    const root = document.documentElement;
    root.style.setProperty('--font-size-scale', clampedScale);

    if (showToast) {
      window.toastService?.success(`字体大小已调整为 ${Math.round(clampedScale * 100)}%`);
    }
  }

  /**
   * 获取当前字体大小缩放比例
   * @returns {number}
   */
  getFontSizeScale() {
    const saved = localStorage.getItem(Constants.LocalStorageKey.FONT_SIZE_SCALE);
    return saved ? parseFloat(saved) : Constants.FontSize.DEFAULT;
  }

  /**
   * 调整字体大小
   * @param {number} delta - 调整量 (正数增大，负数减小)
   * @param {HTMLElement} displayElement - 显示当前值的元素
   * @private
   */
  adjustFontSize(delta, displayElement) {
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
      localStorage.setItem(Constants.LocalStorageKey.FONT_SIZE_SCALE, newScale.toString());
    }
  }

  /**
   * 设置视图模式
   * @param {'safe' | 'nsfw'} mode - 视图模式
   */
  async setViewMode(mode) {
    await this.handleViewModeChange(mode);

    // 更新选择框
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
      viewModeSelect.value = mode;
    }
  }

  /**
   * 重置所有设置
   */
  async resetSettings() {
    // 重置主题
    this.setTheme('light');

    // 重置视图模式
    await this.setViewMode('all');

    this.app.showToast?.('设置已重置', 'success');
  }

  /**
   * 导出孤儿文件
   * @private
   */
  async exportOrphanFiles() {
    try {
      await this.app.importExportManager?.exportOrphanFiles();
    } catch (error) {
      window.electronAPI.logError('SettingsManager.js', 'Failed to export orphan files:', error);
    }
  }

  /**
   * 导出完整备份
   * @private
   */
  async exportFullBackup() {
    try {
      await this.app.importExportManager?.exportFullBackup();
    } catch (error) {
      window.electronAPI.logError('SettingsManager.js', 'Failed to export full backup:', error);
    }
  }

  /**
   * 导入完整备份
   * @private
   */
  async importFullBackup() {
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
      window.electronAPI.logError('SettingsManager.js', 'Failed to import full backup:', error);
    }
  }
}
