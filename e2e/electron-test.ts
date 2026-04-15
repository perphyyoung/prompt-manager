import { _electron as electron, ElectronApplication, Page, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Constants } from '../src/constants.ts';
import type { IImage, IPrompt } from '../src/preload/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Electron 测试辅助类
 * 封装 Electron 应用的启动和常用操作
 */
export class ElectronTestHelper {
  electronApp: ElectronApplication | null = null;
  page: Page | null = null;

  /**
   * 启动 Electron 应用
   */
  async launch() {
    const electronPath = join(__dirname, '../node_modules/.bin/electron.cmd');
    const mainPath = join(__dirname, '../out/main/index.js');

    this.electronApp = await electron.launch({
      executablePath: electronPath,
      args: [mainPath],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    this.page = await this.electronApp.firstWindow();

    // 等待应用加载完成
    await this.page.waitForLoadState('domcontentloaded');

    return { electronApp: this.electronApp, page: this.page };
  }

  /**
   * 关闭应用
   */
  async close() {
    if (this.electronApp) {
      await this.electronApp.close();
      this.electronApp = null;
      this.page = null;
    }
  }

  /**
   * 获取主窗口
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Electron app not launched. Call launch() first.');
    }
    return this.page;
  }

  /**
   * 等待元素出现
   */
  async waitForSelector(selector: string, timeout = 5000) {
    const page = this.getPage();
    await page.waitForSelector(selector, { timeout });
  }

  /**
   * 点击元素
   */
  async click(selector: string) {
    const page = this.getPage();
    await page.click(selector);
  }

  /**
   * 获取元素文本
   */
  async getText(selector: string): Promise<string> {
    const page = this.getPage();
    return await page.textContent(selector) || '';
  }

  /**
   * 检查元素是否存在
   */
  async exists(selector: string): Promise<boolean> {
    const page = this.getPage();
    const element = await page.$(selector);
    return element !== null;
  }

  /**
   * 等待指定时间
   */
  async wait(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 截图
   */
  async screenshot(name: string) {
    const page = this.getPage();
    await page.screenshot({ path: join(__dirname, `screenshots/${name}.png`) });
  }

  /**
   * 记录测试开始日志
   * @param testName - 测试名称
   */
  async logTestStart(testName: string): Promise<void> {
    const page = this.getPage();
    await page.evaluate((name: string) => {
      window.electronAPI.logInfo('E2E-Test', `Starting test: ${name}`);
    }, testName);
  }

  // ========== 测试数据管理 ==========

  /**
   * 生成单个测试标签名
   */
  generateTagName(suffix: string): string {
    return `e2e_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 生成多个测试标签名
   */
  generateTagNames(count: number, prefix: string): string[] {
    return Array.from({ length: count }, (_, i) =>
      this.generateTagName(`${prefix}_${i}`)
    );
  }

  /**
   * 创建单个图像标签
   * @param suffix - 标签名后缀
   * @param groupId - 可选，标签组ID，指定后将标签分配到该组
   * @returns 创建的标签名
   */
  async createImageTag(suffix: string, groupId?: number): Promise<string> {
    const page = this.getPage();
    const tagName = this.generateTagName(suffix);
    await page.evaluate(async (params: { tag: string; groupId?: number }) => {
      await window.electronAPI.addImageTag(params.tag);
      if (params.groupId !== undefined) {
        await window.electronAPI.assignImageTagToBelongGroup(params.tag, params.groupId);
      }
    }, { tag: tagName, groupId });
    return tagName;
  }

  /**
   * 批量创建图像标签
   * @param count - 标签数量
   * @param prefix - 标签名前缀
   * @param groupId - 可选，标签组ID，指定后将所有标签分配到该组
   * @returns 创建的标签名数组
   */
  async createImageTags(count: number, prefix: string, groupId?: number): Promise<string[]> {
    const page = this.getPage();
    const tagNames = this.generateTagNames(count, prefix);
    await page.evaluate(async (params: { tags: string[]; groupId?: number }) => {
      await window.electronAPI.addImageTags('', params.tags);
      if (params.groupId !== undefined) {
        for (const tag of params.tags) {
          await window.electronAPI.assignImageTagToBelongGroup(tag, params.groupId);
        }
      }
    }, { tags: tagNames, groupId });
    return tagNames;
  }

  /**
   * 创建单个提示词标签
   * @param suffix - 标签名后缀
   * @param groupId - 可选，标签组ID，指定后将标签分配到该组
   * @returns 创建的标签名
   */
  async createPromptTag(suffix: string, groupId?: number): Promise<string> {
    const page = this.getPage();
    const tagName = this.generateTagName(suffix);
    await page.evaluate(async (params: { tag: string; groupId?: number }) => {
      await window.electronAPI.addPromptTag(params.tag);
      if (params.groupId !== undefined) {
        await window.electronAPI.assignPromptTagToBelongGroup(params.tag, params.groupId);
      }
    }, { tag: tagName, groupId });
    return tagName;
  }

  /**
   * 批量创建提示词标签
   * @param count - 标签数量
   * @param prefix - 标签名前缀
   * @param groupId - 可选，标签组ID，指定后将所有标签分配到该组
   * @returns 创建的标签名数组
   */
  async createPromptTags(count: number, prefix: string, groupId?: number): Promise<string[]> {
    const page = this.getPage();
    const tagNames = this.generateTagNames(count, prefix);
    await page.evaluate(async (params: { tags: string[]; groupId?: number }) => {
      await window.electronAPI.addPromptTags('', params.tags);
      if (params.groupId !== undefined) {
        for (const tag of params.tags) {
          await window.electronAPI.assignPromptTagToBelongGroup(tag, params.groupId);
        }
      }
    }, { tags: tagNames, groupId });
    return tagNames;
  }

  /**
   * 获取首位图像标签组ID
   * @returns 首位标签组的ID，如果没有组则返回undefined
   */
  async getFirstImageTagGroupId(): Promise<number | undefined> {
    const page = this.getPage();
    return await page.evaluate(async () => {
      const groups = await window.electronAPI.getImageTagGroups();
      const sortedGroups = groups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      return sortedGroups[0]?.id;
    });
  }

  /**
   * 获取首位提示词标签组ID
   * @returns 首位标签组的ID，如果没有组则返回undefined
   */
  async getFirstPromptTagGroupId(): Promise<number | undefined> {
    const page = this.getPage();
    return await page.evaluate(async () => {
      const groups = await window.electronAPI.getPromptTagGroups();
      const sortedGroups = groups.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      return sortedGroups[0]?.id;
    });
  }

  /**
   * 清理所有测试标签和标签组（图像和提示词）
   */
  private async _cleanupE2eTagsAndGroups(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async () => {
      // 清理图像标签
      const imageTags = await window.electronAPI.getImageTags();
      const testImageTags = imageTags.filter(tag => tag.startsWith('e2e_'));
      if (testImageTags.length > 0) {
        await window.electronAPI.deleteImageTags(testImageTags);
      }

      // 清理提示词标签
      const promptTags = await window.electronAPI.getPromptTags();
      const testPromptTags = promptTags.filter(tag => tag.startsWith('e2e_'));
      if (testPromptTags.length > 0) {
        await window.electronAPI.deletePromptTags(testPromptTags);
      }

      // 清理图像标签组
      const imageTagGroups = await window.electronAPI.getImageTagGroups();
      const testImageTagGroups = imageTagGroups.filter(group => group.name.startsWith('e2e_'));
      for (const group of testImageTagGroups) {
        await window.electronAPI.deleteImageTagGroup(group.id);
      }

      // 清理提示词标签组
      const promptTagGroups = await window.electronAPI.getPromptTagGroups();
      const testPromptTagGroups = promptTagGroups.filter(group => group.name.startsWith('e2e_'));
      for (const group of testPromptTagGroups) {
        await window.electronAPI.deletePromptTagGroup(group.id);
      }
    });
  }

  /**
   * 清除标签缓存
   * 清除 PyTagGroups 使用的缓存，确保获取最新数据
   */
  async clearTagCache(type: 'image' | 'prompt'): Promise<void> {
    const page = this.getPage();
    await page.evaluate((t) => {
      const app = (window as unknown as { app?: { cacheManager?: { getCache: (name: string) => { clear: () => void } | undefined } } }).app;
      if (app?.cacheManager) {
        const tagsCache = app.cacheManager.getCache(`${t}Tags`);
        const tagGroupsCache = app.cacheManager.getCache(`${t}TagGroups`);
        tagsCache?.clear();
        tagGroupsCache?.clear();
      }
    }, type);
  }

  /**
   * 点击刷新按钮刷新标签筛选区
   * 通过点击左下角刷新按钮触发标签筛选区刷新
   */
  async refreshTagFilters(): Promise<void> {
    const page = this.getPage();
    await page.click('#refreshDataBtn');
    await page.waitForSelector('#toastContainer:has-text("数据已刷新")', { timeout: 5000 });
  }

  /**
   * 验证标签是否存在
   */
  async tagExists(tagName: string, type: 'image' | 'prompt'): Promise<boolean> {
    const page = this.getPage();
    const tags = await page.evaluate(async (t) => {
      return t === 'image'
        ? await window.electronAPI.getImageTags()
        : await window.electronAPI.getPromptTags();
    }, type);
    return tags.includes(tagName);
  }

  // ========== 测试后清理和重置 ==========

  /**
   * 测试后清理和重置
   * 关闭所有模态框，清理测试标签和标签组，回到图像主界面
   * 应在 test.afterEach 中调用
   */
  async cleanupAndReset(): Promise<void> {
    await this._cleanupE2eTagsAndGroups();

    const page = this.getPage();

    // 关闭可能打开的详情模态框
    const imageDetailModal = page.locator('#imageDetailModal');
    if (await imageDetailModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#imageDetailModal', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    const promptDetailModal = page.locator('#promptDetailModal');
    if (await promptDetailModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#promptDetailModal', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    // 关闭可能打开的标签管理器
    const imageTagManagerModal = page.locator('#imageTagManagerModal');
    if (await imageTagManagerModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#imageTagManagerModal', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    const promptTagManagerModal = page.locator('#promptTagManagerModal');
    if (await promptTagManagerModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#promptTagManagerModal', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    // 关闭可能打开的统计和设置模态框
    const statisticsModal = page.locator('#statisticsModal');
    if (await statisticsModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#statisticsModal', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    const settingsModal = page.locator('#settingsModal');
    if (await settingsModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('#settingsModal', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    // 关闭可能打开的新建提示词页面
    const newPromptPage = page.locator('#newPromptPage');
    if (await newPromptPage.isVisible().catch(() => false)) {
      await page.click('#newPromptCancelBtn');
      await page.waitForSelector('#newPromptPage', { state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    // 关闭可能打开的批量工具栏（避免 pop mismatch 错误）
    const imageBatchToolbar = page.locator('#imageMainBatchToolbar');
    if (await imageBatchToolbar.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await imageBatchToolbar.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    const promptBatchToolbar = page.locator('#promptMainBatchToolbar');
    if (await promptBatchToolbar.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await promptBatchToolbar.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    // 回到图像主界面
    await page.click('#imageManagerBtn');
    await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
  }
}

/**
 * 创建测试辅助实例
 */
export function createElectronTest() {
  return new ElectronTestHelper();
}

// ========== 标签管理器测试辅助函数 ==========

/**
 * 进入图像面板并打开标签管理器
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Wait for imagePanel to be visible
 * 3. Click imageTagManagerBtn to open tag manager
 * 4. Wait for imageTagManagerModal to be visible
 */
export async function enterImageTagManager(page: any) {
  await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, { state: 'visible', timeout: 5000 });

  await page.click(`#${Constants.Ids.IMAGE_TAG_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, { state: 'visible', timeout: 5000 });
}

/**
 * 进入提示词面板并打开标签管理器
 * Steps to enter target interface:
 * 1. Click promptManagerBtn to switch to prompt panel
 * 2. Wait for promptPanel to be visible
 * 3. Click promptTagManagerBtn to open tag manager
 * 4. Wait for promptTagManagerModal to be visible
 */
export async function enterPromptTagManager(page: any) {
  await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, { state: 'visible', timeout: 5000 });

  await page.click(`#${Constants.Ids.PROMPT_TAG_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, { state: 'visible', timeout: 5000 });
}

/**
 * 关闭图像标签管理器
 */
export async function closeImageTagManager(page: any) {
  await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, { state: 'hidden', timeout: 5000 });
}

/**
 * 关闭提示词标签管理器
 */
export async function closePromptTagManager(page: any) {
  await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, { state: 'hidden', timeout: 5000 });
}

/**
 * 在图像标签管理器中创建标签
 */
export async function createImageTagInManager(page: any, tagName: string, groupId: string = ''): Promise<void> {
  await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });

  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

  if (groupId) {
    await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, groupId);
  }

  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // Wait for tag to be created via API
  await page.waitForFunction(async (name: string) => {
    const tags = await window.electronAPI.getImageTags();
    return tags.includes(name);
  }, tagName, { timeout: 5000 });
}

/**
 * 在提示词标签管理器中创建标签
 */
export async function createPromptTagInManager(page: any, tagName: string, groupId: string = ''): Promise<void> {
  await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });

  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

  if (groupId) {
    await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, groupId);
  }

  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // Wait for tag to be created via API
  await page.waitForFunction(async (name: string) => {
    const tags = await window.electronAPI.getAllTags();
    return tags.includes(name);
  }, tagName, { timeout: 5000 });
}

/**
 * 在图像标签管理器中创建标签组
 */
export async function createImageTagGroup(page: any, groupName: string): Promise<number> {
  await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });

  await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, groupName);
  await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

  // Wait for group to be created via API
  const groupIdHandle = await page.waitForFunction(async (name: string) => {
    const groups = await window.electronAPI.getImageTagGroups();
    const group = groups.find((g: { name: string; id: number }) => g.name === name);
    return group?.id;
  }, groupName, { timeout: 5000 });

  const groupId = await groupIdHandle.jsonValue();

  // Wait for modal to close
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, { state: 'hidden', timeout: 5000 });

  return groupId;
}

/**
 * 在提示词标签管理器中创建标签组
 */
export async function createPromptTagGroup(page: any, groupName: string): Promise<number> {
  await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });

  await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, groupName);
  await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

  // Wait for group to be created via API
  const groupIdHandle = await page.waitForFunction(async (name: string) => {
    const groups = await window.electronAPI.getPromptTagGroups();
    const group = groups.find((g: { name: string; id: number }) => g.name === name);
    return group?.id;
  }, groupName, { timeout: 5000 });

  const groupId = await groupIdHandle.jsonValue();

  // Wait for modal to close
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, { state: 'hidden', timeout: 5000 });

  return groupId;
}

// ========== 主界面视图导航辅助函数 ==========

/**
 * 进入图像网格视图
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Click imageGridViewBtn to ensure grid view
 * 3. Wait for image-card elements to be visible
 */
export async function enterImageGridView(page: any, screenshotPath?: string) {
  await page.click('#imageManagerBtn');
  await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
  await page.click('#imageGridViewBtn');

  const firstCard = page.locator('.image-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return firstCard;
}

/**
 * 进入提示词网格视图
 * Steps to enter target interface:
 * 1. Click promptManagerBtn to switch to prompt panel
 * 2. Click promptGridViewBtn to ensure grid view
 * 3. Wait for prompt-card elements to be visible
 */
export async function enterPromptGridView(page: any, screenshotPath?: string) {
  await page.click('#promptManagerBtn');
  await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
  await page.click('#promptGridViewBtn');

  const firstCard = page.locator('.prompt-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return firstCard;
}

/**
 * 进入图像列表视图
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Click imageListViewBtn to switch to list view
 * 3. Wait for list-item--image elements to be visible
 */
export async function enterImageListView(page: any, screenshotPath?: string) {
  // 点击图像管理器按钮
  await page.click('#imageManagerBtn');
  await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('#promptPanel', { state: 'hidden', timeout: 5000 }).catch(() => {});

  // 点击列表视图按钮
  await page.click('#imageListViewBtn');

  // 等待图像列表容器可见
  await page.waitForSelector('#imageList', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('#promptList', { state: 'hidden', timeout: 5000 }).catch(() => {});

  // 等待图像列表项可见
  const firstItem = page.locator('.list-item--image').first();
  await expect(firstItem).toBeVisible({ timeout: 5000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return firstItem;
}

/**
 * 进入提示词列表视图
 * Steps to enter target interface:
 * 1. Click promptManagerBtn to switch to prompt panel
 * 2. Click promptListViewBtn to switch to list view
 * 3. Wait for list-item--prompt elements to be visible
 */
export async function enterPromptListView(page: any, screenshotPath?: string) {
  // 点击提示词管理器按钮
  await page.click('#promptManagerBtn');
  await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('#imagePanel', { state: 'hidden', timeout: 5000 }).catch(() => {});

  // 点击列表视图按钮
  await page.click('#promptListViewBtn');

  // 等待提示词列表容器可见
  await page.waitForSelector('#promptList', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('#imageList', { state: 'hidden', timeout: 5000 }).catch(() => {});

  // 等待提示词列表项可见
  const firstItem = page.locator('.list-item--prompt').first();
  await expect(firstItem).toBeVisible({ timeout: 5000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return firstItem;
}

// ========== 详情界面辅助函数 ==========

/**
 * 打开图像详情界面
 * Steps:
 * 1. Click first image card
 * 2. Wait for imageDetailModal to show active class
 */
export async function openImageDetail(page: any, screenshotPath?: string) {
  const firstCard = page.locator('.image-card').first();
  await firstCard.click();

  const detailModal = page.locator('#imageDetailModal');
  await expect(detailModal).toHaveClass(/active/);

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return detailModal;
}

/**
 * 打开提示词详情界面
 * Steps:
 * 1. Click first prompt card
 * 2. Wait for promptDetailModal to show active class
 */
export async function openPromptDetail(page: any, screenshotPath?: string) {
  const firstCard = page.locator('.prompt-card').first();
  await firstCard.click();

  const detailModal = page.locator('#promptDetailModal');
  await expect(detailModal).toHaveClass(/active/);

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return detailModal;
}

/**
 * 进入图像详情视图（带返回值）
 * Steps:
 * 1. Switch to image panel
 * 2. Wait for image cards to load
 * 3. Get first image ID
 * 4. Click card to open detail
 * 5. Wait for detail modal to show
 */
export async function enterImageDetailView(page: any, screenshotPath?: string) {
  // 检查是否已经在图像面板，如果不在则切换
  const imagePanel = page.locator('#imagePanel');
  const isImagePanelVisible = await imagePanel.isVisible().catch(() => false);
  if (!isImagePanelVisible) {
    await page.click('#imageManagerBtn');
    await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
  }

  // 确保图像网格已加载
  await page.waitForSelector('.image-card', { state: 'visible', timeout: 5000 });

  const firstCard = page.locator('.image-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  // 等待卡片可交互
  await firstCard.waitFor({ state: 'visible', timeout: 5000 });

  const firstImageId = await firstCard.getAttribute('data-id');
  expect(firstImageId).toBeTruthy();

  // 滚动到卡片位置并点击
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click({ force: true });

  // 等待详情模态框显示
  const detailModal = page.locator('#imageDetailModal');
  await expect(detailModal).toBeVisible({ timeout: 5000 });

  // 等待模态框内容加载（等待图像元素可见）
  await page.waitForSelector('#imageDetailImg', { state: 'visible', timeout: 5000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return { firstImageId, firstCard };
}

/**
 * 进入提示词详情视图（带返回值）
 * Steps:
 * 1. Switch to prompt panel
 * 2. Wait for prompt cards to load
 * 3. Get first prompt ID
 * 4. Click card to open detail
 * 5. Wait for detail modal to show
 */
export async function enterPromptDetailView(page: any, screenshotPath?: string) {
  // 检查是否已经在提示词面板，如果不在则切换
  const promptPanel = page.locator('#promptPanel');
  const isPromptPanelVisible = await promptPanel.isVisible().catch(() => false);
  if (!isPromptPanelVisible) {
    await page.click('#promptManagerBtn');
    await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
  }

  // 确保提示词网格已加载
  await page.waitForSelector('.prompt-card', { state: 'visible', timeout: 5000 });

  const firstCard = page.locator('.prompt-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  // 等待卡片可交互
  await firstCard.waitFor({ state: 'visible', timeout: 5000 });

  const firstPromptId = await firstCard.getAttribute('data-id');
  expect(firstPromptId).toBeTruthy();

  // 滚动到卡片位置并点击
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click({ force: true });

  // 等待详情模态框显示
  const detailModal = page.locator('#promptDetailModal');
  await expect(detailModal).toBeVisible({ timeout: 5000 });

  // 等待模态框内容加载（等待标题输入框可见）
  await page.waitForSelector('#promptDetailTitle', { state: 'visible', timeout: 5000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return { firstPromptId, firstCard };
}

// ========== 数据库操作辅助函数 ==========

/**
 * 从数据库获取图像完整信息
 */
export async function getImageFromDatabase(page: any, imageId: string): Promise<IImage | null> {
  return await page.evaluate(async (id: string) => {
    try {
      const image = await window.electronAPI.getImageById(id);
      return image as IImage;
    } catch (error) {
      console.error('Failed to get image from database:', error);
      return null;
    }
  }, imageId);
}

/**
 * 从数据库获取提示词完整信息
 */
export async function getPromptFromDatabase(page: any, promptId: string): Promise<IPrompt | null> {
  return await page.evaluate(async (id: string) => {
    try {
      const prompt = await window.electronAPI.getPromptById(id);
      return prompt as IPrompt;
    } catch (error) {
      console.error('Failed to get prompt from database:', error);
      return null;
    }
  }, promptId);
}

/**
 * 获取第一个图像的ID
 */
export async function getFirstImageId(page: any): Promise<string> {
  await page.click('#imageManagerBtn');
  await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
  await page.click('#imageGridViewBtn');

  const firstCard = page.locator('.image-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  return await firstCard.getAttribute('data-id') || '';
}

/**
 * 获取第一个提示词的ID
 */
export async function getFirstPromptId(page: any): Promise<string> {
  await page.click('#promptManagerBtn');
  await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
  await page.click('#promptGridViewBtn');

  const firstCard = page.locator('.prompt-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  return await firstCard.getAttribute('data-id') || '';
}

// ========== 标签筛选区域辅助函数 ==========

/**
 * 确保标签筛选区域展开
 * @param page - Playwright page 对象
 * @param filterSectionId - 标签筛选区域元素ID
 * @param toggleBtnId - 切换按钮元素ID
 */
export async function ensureTagFilterExpanded(page: any, filterSectionId: string, toggleBtnId: string) {
  const tagFilterSection = page.locator(`#${filterSectionId}`);
  const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

  if (isCollapsed) {
    await page.click(`#${toggleBtnId}`);
    // Wait for collapsed class to be removed
    await page.waitForFunction((id: string) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('collapsed');
    }, filterSectionId, { timeout: 5000 });
  }
}

/**
 * 确保标签筛选区域收起
 * @param page - Playwright page 对象
 * @param filterSectionId - 标签筛选区域元素ID
 * @param toggleBtnId - 切换按钮元素ID
 */
export async function ensureTagFilterCollapsed(page: any, filterSectionId: string, toggleBtnId: string) {
  const tagFilterSection = page.locator(`#${filterSectionId}`);
  const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

  if (!isCollapsed) {
    await page.click(`#${toggleBtnId}`);
    // Wait for collapsed class to be added
    await page.waitForFunction((id: string) => {
      const el = document.getElementById(id);
      return el && el.classList.contains('collapsed');
    }, filterSectionId, { timeout: 5000 });
  }
}

// ========== 提示词详情测试辅助函数 ==========

/**
 * 获取当前显示的图像ID列表
 * @param page - Playwright page 对象
 * @returns 图像ID数组
 */
export async function getDisplayedImageIds(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const items = document.querySelectorAll('#imagePreviewList .image-preview-item');
    return Array.from(items).map(item => item.getAttribute('data-image-id') || '');
  });
}

/**
 * 右键点击图像并选择"设为首张"
 * @param page - Playwright page 对象
 * @param imageId - 图像ID
 */
export async function rightClickAndSetAsFirst(page: Page, imageId: string): Promise<void> {
  // 右键点击图像
  const imageItem = page.locator(`#imagePreviewList .image-preview-item[data-image-id="${imageId}"]`);
  await imageItem.click({ button: 'right' });

  // 等待右键菜单显示（使用包含特定菜单项的选择器来定位图像右键菜单）
  await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', { state: 'visible', timeout: 5000 });

  // 点击"设为首张"菜单项
  await page.click('.context-menu-item[data-item-id="setAsFirst"]');

  // 等待菜单消失（通过检查特定菜单项是否隐藏）
  await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', { state: 'hidden', timeout: 5000 });
}

/**
 * 获取所有提示词列表
 * @param page - Playwright page 对象
 * @returns 提示词数组
 */
export async function getAllPrompts(page: Page): Promise<IPrompt[]> {
  return await page.evaluate(async () => {
    return await window.electronAPI.getPrompts('updatedAt', 'desc');
  });
}

/**
 * 查找具有指定图像数量范围的提示词
 * @param page - Playwright page 对象
 * @param minCount - 最小图像数量（包含）
 * @param maxCount - 最大图像数量（包含），-1表示无上限
 * @returns 符合条件的提示词ID，找不到则返回null
 */
export async function findPromptWithImageCount(
  page: Page,
  minCount: number,
  maxCount: number = -1
): Promise<string | null> {
  const prompts = await getAllPrompts(page);

  for (const prompt of prompts) {
    const imageCount = prompt.images?.length || 0;
    const withinMin = imageCount >= minCount;
    const withinMax = maxCount === -1 || imageCount <= maxCount;

    if (withinMin && withinMax) {
      return prompt.id;
    }
  }

  return null;
}

/**
 * 打开指定提示词的详情界面
 * @param page - Playwright page 对象
 * @param promptId - 提示词ID
 */
export async function openPromptDetailById(page: Page, promptId: string): Promise<void> {
  // 确保在提示词面板
  await page.click('#promptManagerBtn');
  await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });

  // 点击指定提示词卡片
  const promptCard = page.locator(`.prompt-card[data-id="${promptId}"]`);
  await promptCard.click();

  // 等待详情模态框显示
  await page.waitForSelector('#promptDetailModal', { state: 'visible', timeout: 5000 });

  // 等待图像预览列表加载完成（显式等待，而非固定等待）
  await page.waitForFunction(
    () => {
      const imageList = document.querySelector('#imagePreviewList');
      return imageList !== null;
    },
    { timeout: 5000 }
  );
}
