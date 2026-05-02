import {
  _electron as electron,
  ElectronApplication,
  Page,
  expect,
  test as base,
} from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync, rmSync } from "fs";
import sharp from "sharp";
import { Constants } from "../src/constants.ts";
import type { IImage, IPrompt, IElectronAPI } from "../src/preload/index.ts";
import { tmpdir } from "os";
import { ApiTestFactory } from "./factories/api-factory.ts";

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Electron 测试辅助类
 * 封装 Electron 应用的启动和常用操作
 */
export class ElectronTestHelper {
  electronApp: ElectronApplication | null = null;
  page: Page | null = null;
  testDataDir?: string;
  private apiFactory: ApiTestFactory | null = null;

  constructor(testDataDir?: string) {
    this.testDataDir = testDataDir;
  }

  /**
   * 获取 API 测试数据工厂
   */
  getApiFactory(): ApiTestFactory {
    if (!this.page) {
      throw new Error("Electron app not launched, call launch() first");
    }
    if (!this.apiFactory) {
      this.apiFactory = new ApiTestFactory(this.page);
    }
    return this.apiFactory;
  }

  /**
   * 启动 Electron 应用
   */
  async launch() {
    const electronPath = join(__dirname, "../node_modules/.bin/electron.cmd");
    const mainPath = join(__dirname, "../out/main/index.js");

    const env: Record<string, string> = {
      ...process.env,
      NODE_ENV: "test",
    };
    if (this.testDataDir) {
      env.E2E_TEST_DATA_DIR = this.testDataDir;
    }

    this.electronApp = await electron.launch({
      executablePath: electronPath,
      args: [mainPath],
      env,
    });

    this.page = await this.electronApp.firstWindow();

    // 等待应用加载完成
    await this.page.waitForLoadState("domcontentloaded");

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
      throw new Error("Electron app not launched. Call launch() first.");
    }
    return this.page;
  }

  /**
   * 获取 Electron 应用实例
   */
  getElectronApp(): ElectronApplication {
    if (!this.electronApp) {
      throw new Error("Electron app not launched. Call launch() first.");
    }
    return this.electronApp;
  }

  /**
   * Mock 图像标签组 API 返回空数组（用于测试"无可选组"场景）
   */
  async mockImageTagGroupsEmpty(): Promise<void> {
    const electronApp = this.getElectronApp();
    await electronApp.evaluate(async ({ ipcMain }) => {
      // 移除现有的 handler（如果存在）
      try {
        ipcMain.removeHandler("get-image-tag-groups");
      } catch {
        // handler 可能不存在，忽略错误
      }
      // 注册新的处理器，返回空数组
      ipcMain.handle("get-image-tag-groups", async () => {
        return [];
      });
    });
  }

  /**
   * Mock 提示词标签组 API 返回空数组（用于测试"无可选组"场景）
   */
  async mockPromptTagGroupsEmpty(): Promise<void> {
    const electronApp = this.getElectronApp();
    await electronApp.evaluate(async ({ ipcMain }) => {
      // 移除现有的 handler（如果存在）
      try {
        ipcMain.removeHandler("get-prompt-tag-groups");
      } catch {
        // handler 可能不存在，忽略错误
      }
      // 注册新的处理器，返回空数组
      ipcMain.handle("get-prompt-tag-groups", async () => {
        return [];
      });
    });
  }

  /**
   * 等待元素出现
   */
  async waitForSelector(selector: string, timeout = 1000) {
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
    return (await page.textContent(selector)) || "";
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
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 截图
   */
  async screenshot(name: string) {
    const page = this.getPage();
    await page.screenshot({
      path: join(process.cwd(), `test-results/${name}.png`),
    });
  }

  /**
   * 记录测试开始日志
   * 自动从 Playwright 获取当前测试名
   */
  async logTestStart(): Promise<void> {
    const testName = base.info().title;
    const page = this.getPage();
    await page.evaluate((name: string) => {
      window.electronAPI.logInfo("E2E-Test", `Starting test: ${name}`);
    }, testName);
  }

  async logWarn(
    page: Page,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await page.evaluate(
      (params: {
        component: string;
        message: string;
        data?: Record<string, unknown>;
      }) => {
        window.electronAPI.logWarn(
          params.component,
          params.message,
          params.data,
        );
      },
      { component: "E2E-Test", message, data },
    );
  }

  async logError(
    page: Page,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await page.evaluate(
      (params: {
        component: string;
        message: string;
        data?: Record<string, unknown>;
      }) => {
        window.electronAPI.logError(
          params.component,
          params.message,
          params.data,
        );
      },
      { component: "E2E-Test", message, data },
    );
  }

  async logInfo(
    page: Page,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await page.evaluate(
      (params: {
        component: string;
        message: string;
        data?: Record<string, unknown>;
      }) => {
        window.electronAPI.logInfo(
          params.component,
          params.message,
          params.data,
        );
      },
      { component: "E2E-Test", message, data },
    );
  }

  async logDebug(
    page: Page,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await page.evaluate(
      (params: {
        component: string;
        message: string;
        data?: Record<string, unknown>;
      }) => {
        window.electronAPI.logDebug(
          params.component,
          params.message,
          params.data,
        );
      },
      { component: "E2E-Test", message, data },
    );
  }

  // ========== 测试数据管理 ==========

  /**
   * 生成单个测试名
   * @param label - 标识，用于生成唯一标签名（内部会自动添加 e2e_ 前缀和时间戳）
   */
  generateE2ePrefixName(label: string): string {
    return `e2e_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 生成多个测试标签名
   */
  generateTagNames(count: number, prefix: string): string[] {
    return Array.from({ length: count }, (_, i) =>
      this.generateE2ePrefixName(`${prefix}_${i}`),
    );
  }

  /**
   * 批量创建图像标签（仅创建标签，不关联到图像）
   * @param count - 标签数量
   * @param prefix - 标签名前缀
   * @returns 创建的标签名数组
   */
  async createImageTags(count: number, prefix: string): Promise<string[]> {
    const page = this.getPage();
    const tagNames = this.generateTagNames(count, prefix);
    await page.evaluate(async (tags: string[]) => {
      for (const tag of tags) {
        await window.electronAPI.addImageTag(tag);
      }
    }, tagNames);
    return tagNames;
  }

  /**
   * 将标签关联到图像
   * @param imageId - 图像ID
   * @param tagNames - 标签名数组
   */
  async linkTagsToImage(imageId: string, tagNames: string[]): Promise<void> {
    const page = this.getPage();
    await page.evaluate(
      async (params: { imageId: string; tags: string[] }) => {
        await window.electronAPI.addImageTags(params.imageId, params.tags);
      },
      { imageId, tags: tagNames },
    );
  }

  /**
   * 将图像标签分配到指定组
   * @param tagNames - 标签名数组
   * @param groupId - 标签组ID
   */
  async assignImageTagsToGroup(
    tagNames: string[],
    groupId: number,
  ): Promise<void> {
    const page = this.getPage();
    await page.evaluate(
      async (params: { tags: string[]; groupId: number }) => {
        for (const tag of params.tags) {
          await window.electronAPI.assignImageTagToBelongGroup(
            tag,
            params.groupId,
          );
        }
      },
      { tags: tagNames, groupId },
    );
  }

  /**
   * 批量创建提示词标签（仅创建标签，不关联到提示词）
   * @param count - 标签数量
   * @param prefix - 标签名前缀
   * @returns 创建的标签名数组
   */
  async createPromptTags(count: number, prefix: string): Promise<string[]> {
    const page = this.getPage();
    const tagNames = this.generateTagNames(count, prefix);
    await page.evaluate(async (tags: string[]) => {
      for (const tag of tags) {
        await window.electronAPI.addPromptTag(tag);
      }
    }, tagNames);
    return tagNames;
  }

  /**
   * 将标签关联到提示词
   * @param promptId - 提示词ID
   * @param tagNames - 标签名数组
   */
  async linkTagsToPrompt(promptId: string, tagNames: string[]): Promise<void> {
    const page = this.getPage();
    await page.evaluate(
      async (params: { promptId: string; tags: string[] }) => {
        await window.electronAPI.addPromptTags(params.promptId, params.tags);
      },
      { promptId, tags: tagNames },
    );
  }

  /**
   * 将提示词标签分配到指定组
   * @param tagNames - 标签名数组
   * @param groupId - 标签组ID
   */
  async assignPromptTagsToGroup(
    tagNames: string[],
    groupId: number,
  ): Promise<void> {
    const page = this.getPage();
    await page.evaluate(
      async (params: { tags: string[]; groupId: number }) => {
        for (const tag of params.tags) {
          await window.electronAPI.assignPromptTagToBelongGroup(
            tag,
            params.groupId,
          );
        }
      },
      { tags: tagNames, groupId },
    );
  }

  /**
   * 获取首位图像标签组ID
   * @returns 首位标签组的ID，如果没有组则返回undefined
   */
  async getFirstImageTagGroupId(): Promise<number | undefined> {
    const page = this.getPage();
    return await page.evaluate(async () => {
      const groups = await window.electronAPI.getImageTagGroups();
      const sortedGroups = groups.sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );
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
      const sortedGroups = groups.sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
      );
      return sortedGroups[0]?.id;
    });
  }

  // ========== 主界面测试数据生成（提示词和图像）==========

  /**
   * 生成测试提示词标题
   * 使用 e2e_ 前缀 + 时间戳确保唯一性
   */
  generatePromptTitle(suffix: string): string {
    return `e2e_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 生成测试图像文件名
   * 使用 e2e_ 前缀 + 时间戳确保唯一性
   */
  generateImageFileName(suffix: string): string {
    return `e2e_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`;
  }

  /**
   * 创建测试提示词
   * @param suffix - 标题后缀
   * @param overrides - 可选，覆盖其他字段
   * @returns 创建的提示词对象
   */
  async createTestPrompt(
    suffix: string,
    overrides?: Partial<Omit<IPrompt, "id">>,
  ): Promise<IPrompt> {
    const page = this.getPage();
    const title = this.generatePromptTitle(suffix);

    const promptData: Omit<IPrompt, "id"> = {
      title,
      content: `e2e_${title}`,
      contentTranslate: "",
      note: "",
      isSafe: 1,
      isFavorite: 0,
      tags: [],
      ...overrides,
    };

    const prompt = await page.evaluate(async (data) => {
      return await window.electronAPI.addPrompt(data);
    }, promptData);

    return prompt;
  }

  /**
   * 批量创建测试提示词
   * @param count - 数量
   * @param prefix - 前缀
   * @returns 创建的提示词数组
   */
  async createTestPrompts(count: number, prefix: string): Promise<IPrompt[]> {
    const prompts: IPrompt[] = [];
    for (let i = 0; i < count; i++) {
      const prompt = await this.createTestPrompt(`${prefix}_${i}`);
      prompts.push(prompt);
    }
    return prompts;
  }

  /**
   * 生成临时纯色测试图像
   * 使用随机颜色，确保每次生成 MD5 唯一
   * @returns 临时文件路径
   */
  private async _generateTempTestImage(): Promise<string> {
    const paths = await this._generateTempTestImages(1);
    return paths[0];
  }

  /**
   * 生成多个临时纯色测试图像
   * 使用随机颜色，确保每次生成 MD5 唯一
   * @param count - 图像数量
   * @returns 临时文件路径数组
   */
  private async _generateTempTestImages(count: number): Promise<string[]> {
    const testDir = join(__dirname, "..", "test-data");
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    const paths: string[] = [];
    const baseTimestamp = Date.now();

    for (let i = 0; i < count; i++) {
      const uniqueId = Math.random().toString(36).slice(2, 8);
      const fileName = `e2e_${baseTimestamp}_${i}_${uniqueId}.png`;
      const outputPath = join(testDir, fileName);

      // 随机颜色背景
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);

      // 生成带时间戳文本的 PNG 图像
      await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 3,
          background: `rgb(${r}, ${g}, ${b})`,
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
              <text x="100" y="55" font-size="12" fill="white" text-anchor="middle" font-family="monospace">
                ${baseTimestamp}-${i}-${uniqueId}
              </text>
            </svg>`,
            ),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toFile(outputPath);

      // 验证文件存在且可读
      if (!existsSync(outputPath)) {
        throw new Error(`Failed to generate test image: ${outputPath}`);
      }

      paths.push(outputPath);
    }

    return paths;
  }

  /**
   * 创建测试图像
   * 自动生成随机颜色的临时测试图像，每次 MD5 唯一
   * @param suffix - 文件名后缀
   * @returns 创建的图像对象
   */
  async createTestImage(suffix: string): Promise<IImage | null> {
    const page = this.getPage();
    const fileName = this.generateImageFileName(suffix);

    // 自动生成临时测试图像
    const tempPath = await this._generateTempTestImage();

    try {
      const result = await page.evaluate(
        async (params: { path: string; fileName: string }) => {
          return await window.electronAPI.saveImageFile(
            params.path,
            params.fileName,
          );
        },
        { path: tempPath, fileName },
      );

      // 获取完整的图像信息（包括重复图像）
      const image = await page.evaluate(async (id: string) => {
        return await window.electronAPI.getImageById(id);
      }, result.id);

      return image;
    } catch (error) {
      console.error("Failed to create test image:", error);
      return null;
    }
  }

  /**
   * 批量创建测试图像
   * 自动生成不同颜色的临时测试图像，不限制数量
   * @param count - 数量（无限制）
   * @param prefix - 前缀
   * @returns 创建的图像数组
   */
  async createTestImages(count: number, prefix: string): Promise<IImage[]> {
    if (count < 1) {
      throw new Error(`createTestImages: count must be >= 1, got ${count}`);
    }
    const images: IImage[] = [];
    for (let i = 0; i < count; i++) {
      const image = await this.createTestImage(`${prefix}_${i}`);
      if (image) {
        images.push(image);
      }
    }
    return images;
  }

  /**
   * 通过 UI 创建测试提示词并返回其 ID
   * 流程: 点击新建按钮 → 填写内容 → 保存 → 等待新卡片出现 → 获取 ID
   * 提示词内容使用 e2e_ 前缀标识, 便于测试后清理
   * @param options - 可选配置
   * @param options.imageCount - 关联的图像数量（默认 0）
   * @param options.promptOverrides - 提示词的自定义字段
   * @returns 新创建的提示词 ID，如果 imageCount > 0 则返回 { promptId, imageIds }
   */
  async createTestPromptViaUI(
    options: {
      imageCount?: number;
      promptOverrides?: Partial<Omit<IPrompt, "id" | "images">>;
    } = {},
  ): Promise<string | { promptId: string; imageIds: string[] }> {
    const page = this.getPage();
    const { imageCount = 0 } = options;
    const content = `e2e_${Date.now()}`;

    // 1. 确保在提示词面板
    await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
    await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_GRID_VIEW_BTN}.active`,
      {
        timeout: 1000,
      },
    );

    // 2. 获取创建前的提示词数量
    const promptCountBefore = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
      return prompts.length;
    });

    // 3. 点击新建提示词按钮
    await page.click(`#${Constants.Ids.PROMPT_ADD_BTN}`);

    // 4. 等待新建提示词页面出现
    await page.waitForSelector(`#${Constants.Ids.NEW_PROMPT_PAGE}.active`, {
      state: "visible",
      timeout: 1000,
    });

    // 5. 填写提示词内容
    await page.fill(`#${Constants.Ids.NEW_PROMPT_CONTENT}`, content);

    // 6. 如果需要关联图像，在新建提示词页面一次性选择所有图像文件（在保存前）
    // 注意：在新建提示词页面，图像是和提示词一起创建的，不是单独上传
    const electronApp = this.getElectronApp();
    if (imageCount > 0) {
      // 生成所有测试图像文件
      const testImagePaths = await this._generateTempTestImages(imageCount);

      // 设置 mock 路径数组（支持多文件）
      await electronApp.evaluate(async (app, paths: string[]) => {
        (global as any).__testMockedImageFilePaths = paths;
      }, testImagePaths);

      // 点击上传区域触发文件选择（一次选择所有文件）
      await page.click(`#${Constants.Ids.NEW_PROMPT_IMAGE_UPLOAD_AREA}`);

      // 等待所有预览图出现（表示文件选择成功）
      await page.waitForFunction(
        (params: { previewListId: string; expectedCount: number }) => {
          const count = document.querySelectorAll(
            `#${params.previewListId} .image-preview-item`,
          ).length;
          return count >= params.expectedCount;
        },
        {
          previewListId: Constants.Ids.NEW_PROMPT_IMAGE_PREVIEW_LIST,
          expectedCount: imageCount,
        },
        { timeout: 1000 },
      );
    }

    // 7. 点击完成按钮保存（提示词和图像一起创建）
    await page.click(`#${Constants.Ids.NEW_PROMPT_DONE_BTN}`);

    // 8. 等待页面关闭
    await page.waitForSelector(`#${Constants.Ids.NEW_PROMPT_PAGE}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 9. 等待提示词数量增加
    await page.waitForFunction(
      (countBefore: number) => {
        return window.electronAPI
          .getPrompts("updatedAt", "desc")
          .then((prompts) => prompts.length > countBefore);
      },
      promptCountBefore,
      { timeout: 1000 },
    );

    // 10. 获取新创建的提示词（最新创建的）及其关联的图像
    const newPrompt = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
      return prompts[0];
    });

    const newPromptId = String(newPrompt.id);
    const imageIds = (newPrompt.images || []).map(
      (img: { id: string }) => img.id,
    );

    // 11. 等待新卡片出现在视图中
    await page.waitForSelector(`.prompt-card[data-id="${newPromptId}"]`, {
      state: "visible",
      timeout: 1000,
    });

    // 12. 如果创建了图像，返回图像 ID
    if (imageIds.length > 0) {
      return { promptId: newPromptId, imageIds };
    }

    return newPromptId;
  }

  /**
   * 通过 UI 创建测试图像并返回其 ID
   * 流程: 点击上传按钮 → 选择文件(mock dialog) → 确认上传 → 等待新卡片出现 → 获取 ID
   * 使用 Electron 主进程 mock dialog.showOpenDialog 绕过原生对话框，但仍走完整 UI 流程
   * 图像文件名使用 e2e_ 前缀标识, 便于测试后清理
   * @param options - 可选配置
   * @param options.withPrompt - 是否同时创建关联的提示词
   * @param options.promptOverrides - 提示词的自定义字段
   * @returns 新创建的图像 ID，如果 withPrompt 为 true 则返回 { imageId, promptId }
   */
  async createTestImageViaUI(
    options: {
      withPrompt?: boolean;
      promptOverrides?: Partial<Omit<IPrompt, "id" | "images">>;
    } = {},
  ): Promise<string | { imageId: string; promptId: string }> {
    const page = this.getPage();
    const { withPrompt = false, promptOverrides = {} } = options;

    // 0. 使用快捷键切换到图像主界面（会自动关闭可能打开的模态框）
    await page.keyboard.press("Control+i");
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 1. 确保切换到网格视图
    await page.click(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}.active`, {
      timeout: 1000,
    });

    // 2. 点击上传图像按钮, 打开上传模态框
    await page.click(`#${Constants.Ids.IMAGE_ADD_BTN}`);

    // 3. 等待上传模态框出现
    await page.waitForSelector(`#${Constants.Ids.IMAGE_UPLOAD_MODAL}.active`, {
      state: "visible",
      timeout: 1000,
    });

    // 4. 使用通用辅助方法上传图像
    const newImageId = await this._uploadSingleImageViaUI(
      `#${Constants.Ids.MODAL_IMAGE_UPLOAD_AREA}`,
      `#${Constants.Ids.MODAL_IMAGE_PREVIEW_LIST}`,
      `#${Constants.Ids.CONFIRM_IMAGE_UPLOAD_BTN}`,
    );

    // 5. 等待模态框关闭
    await page.waitForSelector(`#${Constants.Ids.IMAGE_UPLOAD_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 6. 等待新卡片出现在视图中
    await page.waitForSelector(`.image-card[data-id="${newImageId}"]`, {
      state: "visible",
      timeout: 1000,
    });

    // 7. 如果需要，创建关联的提示词
    if (withPrompt) {
      const promptData: Omit<IPrompt, "id"> = {
        title: this.generatePromptTitle("linked"),
        content: `e2e_linked_prompt_content_${Date.now()}`,
        contentTranslate: "",
        note: "",
        isSafe: 1,
        isFavorite: 0,
        tags: [],
        ...promptOverrides,
      };

      const prompt = await page.evaluate(async (data) => {
        return await window.electronAPI.addPrompt(data);
      }, promptData);

      // 建立提示词和图像的关联
      await page.evaluate(
        async (params: { promptId: string; imageId: string }) => {
          await window.electronAPI.updatePrompt(params.promptId, {
            images: [{ id: params.imageId }],
          });
        },
        { promptId: prompt.id, imageId: newImageId },
      );

      return { imageId: newImageId, promptId: prompt.id };
    }

    return newImageId;
  }

  /**
   * 上传单个图像的通用辅助方法
   * 流程: 设置 mock → 点击上传按钮 → 选择文件 → 确认上传 → 获取图像 ID
   * @param uploadAreaSelector - 上传区域选择器
   * @param previewListSelector - 预览列表选择器
   * @param confirmBtnSelector - 确认按钮选择器
   * @returns 新创建的图像 ID
   */
  private async _uploadSingleImageViaUI(
    uploadAreaSelector: string,
    previewListSelector: string,
    confirmBtnSelector: string,
  ): Promise<string> {
    const page = this.getPage();
    const electronApp = this.getElectronApp();

    // 生成测试图像文件
    const testImagePath = await this._generateTempTestImage();

    // 设置 mock 路径
    await electronApp.evaluate(async (app, testPath: string) => {
      (global as any).__testMockedImageFilePath = testPath;
    }, testImagePath);

    // 获取创建前的图像数量
    const imageCountBefore = await page.evaluate(async () => {
      const images = await window.electronAPI.getImages("updatedAt", "desc");
      return images.length;
    });

    // 点击上传区域触发文件选择
    await page.click(uploadAreaSelector);

    // 等待预览图出现
    await page.waitForSelector(`${previewListSelector} .image-preview-item`, {
      state: "visible",
      timeout: 1000,
    });

    // 先点击确认按钮
    await page.click(confirmBtnSelector);

    // 使用轮询等待图像数量增加（更可靠的方式）
    const startTime = Date.now();
    const maxWaitTime = 5000;
    let currentCount = imageCountBefore;

    while (
      currentCount <= imageCountBefore &&
      Date.now() - startTime < maxWaitTime
    ) {
      currentCount = await page.evaluate(async () => {
        const images = await window.electronAPI.getImages("updatedAt", "desc");
        return images.length;
      });
    }

    if (currentCount <= imageCountBefore) {
      throw new Error(
        `Timeout waiting for image to be created. Before: ${imageCountBefore}, After: ${currentCount}`,
      );
    }

    // 清除 mock（在获取图像之前清除，但图像已经创建完成）
    await electronApp.evaluate(async () => {
      delete (global as any).__testMockedImageFilePath;
    });

    // 获取新创建的图像 ID
    const images = await page.evaluate(async () => {
      return await window.electronAPI.getImages("updatedAt", "desc");
    });

    const newImage = images[0];

    if (!newImage) {
      throw new Error(
        `Failed to get newly created image from database. Images count: ${images.length}`,
      );
    }

    return String(newImage.id);
  }

  /**
   * 根据标题搜索提示词卡片
   * @param title - 提示词标题（部分匹配）
   * @returns 匹配的卡片元素
   */
  findPromptCardByTitle(title: string) {
    const page = this.getPage();
    // 使用 data-title 属性或卡片文本内容定位
    return page.locator(`.prompt-card`).filter({ hasText: title });
  }

  /**
   * 根据文件名搜索图像卡片
   * @param fileName - 图像文件名（部分匹配）
   * @returns 匹配的卡片元素
   */
  findImageCardByFileName(fileName: string) {
    const page = this.getPage();
    // 使用 data-filename 属性或卡片文本内容定位
    return page.locator(`.image-card`).filter({ hasText: fileName });
  }

  /**
   * 根据ID定位提示词卡片
   * @param promptId - 提示词ID
   * @returns 匹配的卡片元素
   */
  findPromptCardById(promptId: string) {
    const page = this.getPage();
    return page.locator(`.prompt-card[data-id="${promptId}"]`);
  }

  /**
   * 根据ID定位图像卡片
   * @param imageId - 图像ID
   * @returns 匹配的卡片元素
   */
  findImageCardById(imageId: string) {
    const page = this.getPage();
    return page.locator(`.image-card[data-id="${imageId}"]`);
  }

  /**
   * 软删除测试提示词到回收站
   * @param promptId - 提示词ID
   */
  async deleteTestPrompt(promptId: string): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async (id: string) => {
      await window.electronAPI.softDeletePrompt(id);
    }, promptId);
  }

  /**
   * 软删除测试图像到回收站
   * @param imageId - 图像ID
   */
  async deleteTestImage(imageId: string): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async (id: string) => {
      await window.electronAPI.softDeleteImage(id);
    }, imageId);
  }

  /**
   * 清理所有测试标签和标签组（图像和提示词）
   */
  private async _cleanupE2eTagsAndGroups(): Promise<void> {
    await this.cleanupImageTagsAndGroups();
    await this.cleanupPromptTagsAndGroups();
  }

  /**
   * 清理所有 e2e 测试数据
   * 包括：图像标签、提示词标签、图像标签组、提示词标签组、测试图像、测试提示词
   * 标签和标签组直接删除，图像和提示词软删除到回收站
   */
  async cleanupAllE2eTestData(): Promise<void> {
    await this._cleanupE2eTagsAndGroups();
    await this.cleanupTestImages();
    await this.cleanupTestPrompts();
  }

  /**
   * 清理图像测试标签和标签组
   */
  async cleanupImageTagsAndGroups(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async () => {
      // 清理图像标签
      const imageTags = await window.electronAPI.getImageTags();
      const testImageTags = imageTags.filter((tag) => tag.startsWith("e2e_"));
      if (testImageTags.length > 0) {
        await window.electronAPI.deleteImageTags(testImageTags);
      }

      // 清理图像标签组
      const imageTagGroups = await window.electronAPI.getImageTagGroups();
      const testImageTagGroups = imageTagGroups.filter((group) =>
        group.name.startsWith("e2e_"),
      );
      for (const group of testImageTagGroups) {
        await window.electronAPI.deleteImageTagGroup(group.id);
      }

      // 清除图像标签缓存
      const app = (
        window as unknown as {
          app?: {
            cacheManager?: {
              getCache: (name: string) => { clear: () => void } | undefined;
            };
          };
        }
      ).app;
      if (app?.cacheManager) {
        app.cacheManager.getCache("imageTags")?.clear();
        app.cacheManager.getCache("imageTagGroups")?.clear();
      }
    });
  }

  /**
   * 清理提示词测试标签和标签组
   */
  async cleanupPromptTagsAndGroups(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async () => {
      // 清理提示词标签
      const promptTags = await window.electronAPI.getPromptTags();
      const testPromptTags = promptTags.filter((tag) => tag.startsWith("e2e_"));
      if (testPromptTags.length > 0) {
        await window.electronAPI.deletePromptTags(testPromptTags);
      }

      // 清理提示词标签组
      const promptTagGroups = await window.electronAPI.getPromptTagGroups();
      const testPromptTagGroups = promptTagGroups.filter((group) =>
        group.name.startsWith("e2e_"),
      );
      for (const group of testPromptTagGroups) {
        await window.electronAPI.deletePromptTagGroup(group.id);
      }

      // 清除提示词标签缓存
      const app = (
        window as unknown as {
          app?: {
            cacheManager?: {
              getCache: (name: string) => { clear: () => void } | undefined;
            };
          };
        }
      ).app;
      if (app?.cacheManager) {
        app.cacheManager.getCache("promptTags")?.clear();
        app.cacheManager.getCache("promptTagGroups")?.clear();
      }
    });
  }

  /**
   * 清除标签缓存
   * 清除 PyTagGroups 使用的缓存，确保获取最新数据
   */
  async clearTagCache(type: "image" | "prompt"): Promise<void> {
    const page = this.getPage();
    await page.evaluate((t) => {
      const app = (
        window as unknown as {
          app?: {
            cacheManager?: {
              getCache: (name: string) => { clear: () => void } | undefined;
            };
          };
        }
      ).app;
      if (app?.cacheManager) {
        const tagsCache = app.cacheManager.getCache(`${t}Tags`);
        const tagGroupsCache = app.cacheManager.getCache(`${t}TagGroups`);
        tagsCache?.clear();
        tagGroupsCache?.clear();
      }
    }, type);
  }

  /**
   * 清理测试创建的图像
   * 通过文件名前缀 e2e_筛选测试数据
   */
  async cleanupTestImages(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async () => {
      const images = await window.electronAPI.getImages("updatedAt", "desc");
      const testImages = images.filter((img) =>
        img.fileName?.startsWith("e2e_"),
      );
      for (const img of testImages) {
        await window.electronAPI.softDeleteImage(String(img.id));
      }
    });
  }

  /**
   * 清理测试创建的提示词
   * 通过内容包含 e2e_ 前缀筛选测试数据
   */
  async cleanupTestPrompts(): Promise<void> {
    const page = this.getPage();
    await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
      const testPrompts = prompts.filter((p) => p.content?.includes("e2e_"));
      for (const prompt of testPrompts) {
        await window.electronAPI.softDeletePrompt(String(prompt.id));
      }
    });
  }

  /**
   * 点击刷新按钮刷新数据
   * 通过点击左下角刷新按钮触发数据刷新
   */
  async refreshData(): Promise<void> {
    const page = this.getPage();
    await page.click(`#${Constants.Ids.REFRESH_DATA_BTN}`);
    // 等待数据刷新完成（通过 toast 提示判断）
    await page.waitForFunction(
      (toastId: string) => {
        const toast = document.getElementById(toastId);
        return toast && toast.textContent?.includes("数据已刷新");
      },
      Constants.Ids.TOAST_CONTAINER,
      { timeout: 1000 },
    );
  }

  /**
   * 点击刷新按钮刷新标签筛选区
   * 通过点击左下角刷新按钮触发标签筛选区刷新
   */
  async refreshTagFilters(): Promise<void> {
    const page = this.getPage();
    await page.click(`#${Constants.Ids.REFRESH_DATA_BTN}`);
    // 使用 waitForFunction 轮询检查 toast 是否显示过"数据已刷新"
    // 因为 toast 可能会很快消失，使用轮询更可靠
    await page.waitForFunction(
      (toastId: string) => {
        const toast = document.getElementById(toastId);
        return toast && toast.textContent?.includes("数据已刷新");
      },
      Constants.Ids.TOAST_CONTAINER,
      { timeout: 1000 },
    );
  }

  /**
   * 验证标签是否存在
   */
  async tagExists(tagName: string, type: "image" | "prompt"): Promise<boolean> {
    const page = this.getPage();
    const tags = await page.evaluate(async (t) => {
      return t === "image"
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
    const imageDetailModal = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_MODAL}`,
    );
    if (await imageDetailModal.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page
        .waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    const promptDetailModal = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_MODAL}`,
    );
    if (await promptDetailModal.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page
        .waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    // 关闭可能打开的标签管理器（使用关闭按钮确保正确关闭）
    const imageTagManagerModal = page.locator(
      `#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`,
    );
    if (await imageTagManagerModal.isVisible().catch(() => false)) {
      await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
      await page
        .waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    const promptTagManagerModal = page.locator(
      `#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`,
    );
    if (await promptTagManagerModal.isVisible().catch(() => false)) {
      await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
      await page
        .waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    // 关闭可能打开的统计和设置模态框
    const statisticsModal = page.locator(`#${Constants.Ids.STATISTICS_MODAL}`);
    if (await statisticsModal.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page
        .waitForSelector(`#${Constants.Ids.STATISTICS_MODAL}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    const settingsModal = page.locator(`#${Constants.Ids.SETTINGS_MODAL}`);
    if (await settingsModal.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page
        .waitForSelector(`#${Constants.Ids.SETTINGS_MODAL}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    // 关闭可能打开的新建提示词页面
    const newPromptPage = page.locator(`#${Constants.Ids.NEW_PROMPT_PAGE}`);
    if (await newPromptPage.isVisible().catch(() => false)) {
      await page.click(`#${Constants.Ids.NEW_PROMPT_CANCEL_BTN}`);
      await page
        .waitForSelector(`#${Constants.Ids.NEW_PROMPT_PAGE}`, {
          state: "hidden",
          timeout: 1000,
        })
        .catch(() => {});
    }

    // 关闭可能打开的批量工具栏（避免 pop mismatch 错误）
    // 使用 evaluate 快速检查元素是否有 visible 类，避免 isVisible() 的等待
    const isImageToolbarVisible = await page.evaluate((toolbarId) => {
      const toolbar = document.getElementById(toolbarId);
      return toolbar?.classList.contains("visible") ?? false;
    }, Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR);
    if (isImageToolbarVisible) {
      await page.keyboard.press("Escape");
      await page
        .waitForFunction(
          (toolbarId) => {
            const toolbar = document.getElementById(toolbarId);
            return !toolbar?.classList.contains("visible");
          },
          Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR,
          { timeout: 1000 },
        )
        .catch(() => {});
    }

    const isPromptToolbarVisible = await page.evaluate((toolbarId) => {
      const toolbar = document.getElementById(toolbarId);
      return toolbar?.classList.contains("visible") ?? false;
    }, Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR);
    if (isPromptToolbarVisible) {
      await page.keyboard.press("Escape");
      await page
        .waitForFunction(
          (toolbarId) => {
            const toolbar = document.getElementById(toolbarId);
            return !toolbar?.classList.contains("visible");
          },
          Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR,
          { timeout: 1000 },
        )
        .catch(() => {});
    }

    // 回到图像主界面
    await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
  }
}

/**
 * 创建测试辅助实例
 * @param testDataDir - 测试数据目录（可选，用于 E2E 测试隔离）
 */
export function createElectronTest(testDataDir?: string) {
  return new ElectronTestHelper(testDataDir);
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
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 如果标签管理器已经打开，先关闭它以确保数据刷新
  const imageTagManagerModal = page.locator(
    `#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`,
  );
  if (await imageTagManagerModal.isVisible().catch(() => false)) {
    await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });
  }

  await page.click(`#${Constants.Ids.IMAGE_TAG_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 等待标签管理器内容区域加载（不强制要求有数据）
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS}`, {
    state: "attached",
    timeout: 1000,
  });
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
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 如果标签管理器已经打开，先关闭它以确保数据刷新
  const promptTagManagerModal = page.locator(
    `#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`,
  );
  if (await promptTagManagerModal.isVisible().catch(() => false)) {
    await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });
  }

  await page.click(`#${Constants.Ids.PROMPT_TAG_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 等待标签列表区域加载（不强制要求有数据）
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS}`, {
    state: "attached",
    timeout: 1000,
  });
}

/**
 * 关闭图像标签管理器
 */
export async function closeImageTagManager(page: any) {
  await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });
}

/**
 * 关闭提示词标签管理器
 */
export async function closePromptTagManager(page: any) {
  await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });
}

/**
 * 在图像标签管理器中创建标签
 * 通过 UI 操作创建，确保标签立即显示在列表中
 * @param page - Playwright page 对象
 * @param tagName - 标签名称
 * @param groupId - 可选，标签组 ID
 * @returns 创建的标签名
 */
export async function createImageTagInManager(
  page: any,
  tagName: string,
  groupId: string = "",
): Promise<string> {
  await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
    state: "visible",
    timeout: 1000,
  });

  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

  if (groupId) {
    await page.selectOption(
      `#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`,
      groupId,
    );
  }

  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // 等待输入模态框关闭
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });

  // 等待标签出现在 UI 列表中（而不是仅通过 API 验证）
  await page.waitForFunction(
    (params: { containerId: string; tagName: string }) => {
      const items = document.querySelectorAll(
        `#${params.containerId} .tag-manager-item`,
      );
      return Array.from(items).some(
        (item) => item.getAttribute("data-tag") === params.tagName,
      );
    },
    { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
    { timeout: 1000 },
  );

  return tagName;
}

/**
 * 在提示词标签管理器中创建标签
 * 通过 UI 操作创建，确保标签立即显示在列表中
 * @param page - Playwright page 对象
 * @param tagName - 标签名称
 * @param groupId - 可选，标签组 ID
 * @returns 创建的标签名
 */
export async function createPromptTagInManager(
  page: any,
  tagName: string,
  groupId: string = "",
): Promise<string> {
  await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
    state: "visible",
    timeout: 1000,
  });

  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

  if (groupId) {
    await page.selectOption(
      `#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`,
      groupId,
    );
  }

  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // 等待输入模态框关闭
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });

  // 等待标签出现在 UI 列表中（而不是仅通过 API 验证）
  await page.waitForFunction(
    (params: { containerId: string; tagName: string }) => {
      const items = document.querySelectorAll(
        `#${params.containerId} .tag-manager-item`,
      );
      return Array.from(items).some(
        (item) => item.getAttribute("data-tag") === params.tagName,
      );
    },
    { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
    { timeout: 1000 },
  );

  return tagName;
}

/**
 * 在图像标签管理器中批量创建标签
 * 支持用逗号或空格分隔多个标签，一次性创建
 * @param page - Playwright page 对象
 * @param tagNames - 标签名称数组
 * @param groupId - 可选，标签组 ID
 * @returns 创建的标签名数组
 */
export async function createImageTagsInManagerBatch(
  page: any,
  tagNames: string[],
  groupId: string = "",
): Promise<string[]> {
  await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
    state: "visible",
    timeout: 1000,
  });

  // 用逗号分隔多个标签
  const batchInput = tagNames.join(", ");
  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, batchInput);

  if (groupId) {
    await page.selectOption(
      `#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`,
      groupId,
    );
  }

  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // 等待输入模态框关闭
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });

  // 等待所有标签出现在 UI 列表中
  await page.waitForFunction(
    (params: { containerId: string; tagNames: string[] }) => {
      const items = document.querySelectorAll(
        `#${params.containerId} .tag-manager-item`,
      );
      const itemTags = Array.from(items).map((item) =>
        item.getAttribute("data-tag"),
      );
      return params.tagNames.every((tag) => itemTags.includes(tag));
    },
    { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagNames },
    { timeout: 1000 },
  );

  return tagNames;
}

/**
 * 在提示词标签管理器中批量创建标签
 * 支持用逗号或空格分隔多个标签，一次性创建
 * @param page - Playwright page 对象
 * @param tagNames - 标签名称数组
 * @param groupId - 可选，标签组 ID
 * @returns 创建的标签名数组
 */
export async function createPromptTagsInManagerBatch(
  page: any,
  tagNames: string[],
  groupId: string = "",
): Promise<string[]> {
  await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
    state: "visible",
    timeout: 1000,
  });

  // 用逗号分隔多个标签
  const batchInput = tagNames.join(", ");
  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, batchInput);

  if (groupId) {
    await page.selectOption(
      `#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`,
      groupId,
    );
  }

  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // 等待输入模态框关闭
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });

  // 等待所有标签出现在 UI 列表中
  await page.waitForFunction(
    (params: { containerId: string; tagNames: string[] }) => {
      const items = document.querySelectorAll(
        `#${params.containerId} .tag-manager-item`,
      );
      const itemTags = Array.from(items).map((item) =>
        item.getAttribute("data-tag"),
      );
      return params.tagNames.every((tag) => itemTags.includes(tag));
    },
    { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagNames },
    { timeout: 1000 },
  );

  return tagNames;
}

/**
 * 在图像详情界面创建标签
 * 通过详情界面的标签输入框创建，确保标签立即显示
 * @param page - Playwright page 对象
 * @param tagName - 标签名称
 * @returns 创建的标签名
 */
export async function createImageTagInDetail(
  page: any,
  tagName: string,
): Promise<string> {
  // 点击详情界面的标签输入区域
  await page.click(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT_AREA}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, {
    state: "visible",
    timeout: 1000,
  });

  // 输入标签名
  await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, tagName);

  // 按回车确认
  await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

  // 等待标签出现在详情界面的标签列表中
  await page.waitForFunction(
    (params: { tagName: string }) => {
      const tags = document.querySelectorAll(".tag-editable");
      return Array.from(tags).some(
        (tag) => tag.getAttribute("data-tag") === params.tagName,
      );
    },
    { tagName },
    { timeout: 1000 },
  );

  return tagName;
}

/**
 * 在提示词详情界面创建标签
 * 通过详情界面的标签输入框创建，确保标签立即显示
 * @param page - Playwright page 对象
 * @param tagName - 标签名称
 * @returns 创建的标签名
 */
export async function createPromptTagInDetail(
  page: any,
  tagName: string,
): Promise<string> {
  // 点击详情界面的标签输入区域
  await page.click(`#${Constants.Ids.PROMPT_DETAIL_TAG_INPUT_AREA}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, {
    state: "visible",
    timeout: 1000,
  });

  // 输入标签名
  await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, tagName);

  // 按回车确认
  await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

  // 等待标签出现在详情界面的标签列表中
  await page.waitForFunction(
    (params: { tagName: string }) => {
      const tags = document.querySelectorAll(".tag-editable");
      return Array.from(tags).some(
        (tag) => tag.getAttribute("data-tag") === params.tagName,
      );
    },
    { tagName },
    { timeout: 1000 },
  );

  return tagName;
}

/**
 * 在主界面批量工具栏创建图像标签
 * 通过批量工具栏的添加标签按钮创建
 * @param page - Playwright page 对象
 * @param tagName - 标签名称
 * @returns 创建的标签名
 */
export async function createImageTagInBatchToolbar(
  page: any,
  tagName: string,
): Promise<string> {
  // 点击批量工具栏的添加标签按钮
  await page.click(`#${Constants.Ids.IMAGE_BATCH_ADD_TAG_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
    state: "visible",
    timeout: 1000,
  });

  // 输入标签名
  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

  // 确认创建
  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // 等待标签创建成功（通过 Toast 或标签列表验证）
  await page.waitForFunction(
    (params: { tagName: string; toastContainerId: string }) => {
      // 检查 Toast 消息
      const toast = document.querySelector(`#${params.toastContainerId}`);
      if (toast && toast.textContent?.includes("标签已创建")) {
        return true;
      }
      // 或者检查标签是否出现在列表中
      const tags = document.querySelectorAll(".tag-item");
      return Array.from(tags).some(
        (tag) => tag.getAttribute("data-tag") === params.tagName,
      );
    },
    { tagName, toastContainerId: Constants.Ids.TOAST_CONTAINER },
    { timeout: 1000 },
  );

  return tagName;
}

/**
 * 在主界面批量工具栏创建提示词标签
 * 通过批量工具栏的添加标签按钮创建
 * @param page - Playwright page 对象
 * @param tagName - 标签名称
 * @returns 创建的标签名
 */
export async function createPromptTagInBatchToolbar(
  page: any,
  tagName: string,
): Promise<string> {
  // 点击批量工具栏的添加标签按钮
  await page.click(`#${Constants.Ids.PROMPT_BATCH_ADD_TAG_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
    state: "visible",
    timeout: 1000,
  });

  // 输入标签名
  await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

  // 确认创建
  await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

  // 等待标签创建成功（通过 Toast 或标签列表验证）
  await page.waitForFunction(
    (params: { tagName: string; toastContainerId: string }) => {
      // 检查 Toast 消息
      const toast = document.querySelector(`#${params.toastContainerId}`);
      if (toast && toast.textContent?.includes("标签已创建")) {
        return true;
      }
      // 或者检查标签是否出现在列表中
      const tags = document.querySelectorAll(".tag-item");
      return Array.from(tags).some(
        (tag) => tag.getAttribute("data-tag") === params.tagName,
      );
    },
    { tagName, toastContainerId: Constants.Ids.TOAST_CONTAINER },
    { timeout: 1000 },
  );

  return tagName;
}

/**
 * 在图像标签管理器中创建标签组
 * 自动添加 e2e_ 前缀和时间戳，返回 groupId 和 groupName
 * @param page - Playwright page 对象
 * @param label - 标签组标识（不需要 e2e_ 前缀，函数会自动添加）
 * @returns 创建的标签组 ID 和组名
 */
export async function createImageTagGroup(
  page: any,
  label: string,
): Promise<{ groupId: number; groupName: string }> {
  // 自动生成带 e2e_ 前缀和时间戳的组名
  const groupName = `e2e_${label}_${Date.now()}`;

  await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
    state: "visible",
    timeout: 1000,
  });

  await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, groupName);
  await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

  // Wait for group to be created via API
  const groupIdHandle = await page.waitForFunction(
    async (name: string) => {
      const groups = await window.electronAPI.getImageTagGroups();
      const group = groups.find(
        (g: { name: string; id: number }) => g.name === name,
      );
      return group?.id;
    },
    groupName,
    { timeout: 1000 },
  );

  const groupId = await groupIdHandle.jsonValue();

  // Wait for modal to close
  await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });

  return { groupId, groupName };
}

/**
 * 在提示词标签管理器中创建标签组
 * 自动添加 e2e_ 前缀和时间戳，返回 groupId 和 groupName
 * @param page - Playwright page 对象
 * @param label - 标签组标识（不需要 e2e_ 前缀，函数会自动添加）
 * @returns 创建的标签组 ID 和组名
 */
export async function createPromptTagGroup(
  page: any,
  label: string,
): Promise<{ groupId: number; groupName: string }> {
  // 自动生成带 e2e_ 前缀和时间戳的组名
  const groupName = `e2e_${label}_${Date.now()}`;

  await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
    state: "visible",
    timeout: 1000,
  });

  await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, groupName);
  await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

  // Wait for group to be created via API
  const groupIdHandle = await page.waitForFunction(
    async (name: string) => {
      const groups = await window.electronAPI.getPromptTagGroups();
      const group = groups.find(
        (g: { name: string; id: number }) => g.name === name,
      );
      return group?.id;
    },
    groupName,
    { timeout: 1000 },
  );

  const groupId = await groupIdHandle.jsonValue();

  // Wait for modal to close
  await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });

  return { groupId, groupName };
}

// ========== 主界面视图导航辅助函数 ==========

/**
 * 进入图像网格视图
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Click imageGridViewBtn to ensure grid view
 * 3. Wait for image grid container to be visible
 */
export async function enterImageGridView(page: any, screenshotPath?: string) {
  // 使用快捷键切换到图像主界面（自动关闭可能打开的模态框）
  await page.keyboard.press("Control+i");
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });
  await page.click(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}`);

  // 等待图像网格容器可见（不依赖卡片存在）
  await page.waitForSelector(`#${Constants.Ids.IMAGE_GRID}`, {
    state: "visible",
    timeout: 1000,
  });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return page.locator(".image-card").first();
}

/**
 * 进入提示词网格视图
 * Steps to enter target interface:
 * 1. Click promptManagerBtn to switch to prompt panel
 * 2. Click promptGridViewBtn to ensure grid view
 * 3. Wait for prompt panel to be active
 */
export async function enterPromptGridView(page: any, screenshotPath?: string) {
  // 使用快捷键切换到提示词主界面（自动关闭可能打开的模态框）
  await page.keyboard.press("Control+p");
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });
  await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);

  // 等待提示词网格容器可见（不依赖卡片存在）
  await page.waitForSelector(`#${Constants.Ids.PROMPT_GRID}`, {
    state: "visible",
    timeout: 1000,
  });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return page.locator(".prompt-card").first();
}

/**
 * 进入图像列表视图
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Click imageListViewBtn to switch to list view
 * 3. Wait for list-item--image elements to be visible
 */
export async function enterImageListView(page: any, screenshotPath?: string) {
  // 使用快捷键切换到图像主界面（自动关闭可能打开的模态框）
  await page.keyboard.press("Control+i");
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 点击列表视图按钮
  await page.click(`#${Constants.Ids.IMAGE_LIST_VIEW_BTN}`);

  // 等待图像列表容器可见
  await page.waitForSelector(`#${Constants.Ids.IMAGE_LIST}`, {
    state: "visible",
    timeout: 1000,
  });
  await page
    .waitForSelector(`#${Constants.Ids.PROMPT_LIST}`, {
      state: "hidden",
      timeout: 1000,
    })
    .catch(() => {});

  // 等待图像列表项可见
  const firstItem = page.locator(".list-item--image").first();
  await expect(firstItem).toBeVisible({ timeout: 1000 });

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
  // 使用快捷键切换到提示词主界面（自动关闭可能打开的模态框）
  await page.keyboard.press("Control+p");
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 点击列表视图按钮
  await page.click(`#${Constants.Ids.PROMPT_LIST_VIEW_BTN}`);

  // 等待提示词列表容器可见
  await page.waitForSelector(`#${Constants.Ids.PROMPT_LIST}`, {
    state: "visible",
    timeout: 1000,
  });
  await page
    .waitForSelector(`#${Constants.Ids.IMAGE_LIST}`, {
      state: "hidden",
      timeout: 1000,
    })
    .catch(() => {});

  // 等待提示词列表项可见
  const firstItem = page.locator(".list-item--prompt").first();
  await expect(firstItem).toBeVisible({ timeout: 1000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return firstItem;
}

/**
 * 进入图像紧凑视图
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Click imageCompactViewBtn to switch to compact view
 * 3. Wait for list-item--image.list-item--compact elements to be visible
 */
export async function enterImageCompactView(
  page: any,
  screenshotPath?: string,
) {
  // 点击图像管理器按钮
  await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });
  await page
    .waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "hidden",
      timeout: 1000,
    })
    .catch(() => {});

  // 点击紧凑视图按钮
  await page.click(`#${Constants.Ids.IMAGE_COMPACT_VIEW_BTN}`);

  // 等待图像列表容器可见
  await page.waitForSelector(`#${Constants.Ids.IMAGE_LIST}`, {
    state: "visible",
    timeout: 1000,
  });
  await page
    .waitForSelector(`#${Constants.Ids.PROMPT_LIST}`, {
      state: "hidden",
      timeout: 1000,
    })
    .catch(() => {});

  // 等待图像紧凑列表项可见
  const firstItem = page
    .locator(".list-item--image.list-item--compact")
    .first();
  await expect(firstItem).toBeVisible({ timeout: 1000 });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return firstItem;
}

/**
 * 进入提示词紧凑视图
 * Steps to enter target interface:
 * 1. Click promptManagerBtn to switch to prompt panel
 * 2. Click promptCompactViewBtn to switch to compact view
 * 3. Wait for list-item--prompt.list-item--compact elements to be visible
 */
export async function enterPromptCompactView(
  page: any,
  screenshotPath?: string,
) {
  // 点击提示词管理器按钮
  await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });
  await page
    .waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "hidden",
      timeout: 1000,
    })
    .catch(() => {});

  // 点击紧凑视图按钮
  await page.click(`#${Constants.Ids.PROMPT_COMPACT_VIEW_BTN}`);

  // 等待提示词列表容器可见
  await page.waitForSelector(`#${Constants.Ids.PROMPT_LIST}`, {
    state: "visible",
    timeout: 1000,
  });
  await page
    .waitForSelector(`#${Constants.Ids.IMAGE_LIST}`, {
      state: "hidden",
      timeout: 1000,
    })
    .catch(() => {});

  // 等待提示词紧凑列表项可见
  const firstItem = page
    .locator(".list-item--prompt.list-item--compact")
    .first();
  await expect(firstItem).toBeVisible({ timeout: 1000 });

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
  const firstCard = page.locator(".image-card").first();
  await firstCard.click();

  const detailModal = page.locator(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`);
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
  const firstCard = page.locator(".prompt-card").first();
  await firstCard.click();

  const detailModal = page.locator(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`);
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
 * 2. Switch to grid view (ensure cards are visible)
 * 3. Wait for image cards to load
 * 4. Get first image ID
 * 5. Click card to open detail
 * 6. Wait for detail modal to show
 */
export async function enterImageDetailView(page: any, screenshotPath?: string) {
  // 使用快捷键切换到图像主界面（自动关闭可能打开的模态框）
  await page.keyboard.press("Control+i");
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 确保切换到网格视图（点击网格视图按钮）
  await page.click(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}.active`, {
    state: "visible",
    timeout: 1000,
  });

  // 确保图像网格已加载
  await page.waitForSelector(".image-card", {
    state: "visible",
    timeout: 1000,
  });

  const firstCard = page.locator(".image-card").first();
  await expect(firstCard).toBeVisible({ timeout: 1000 });

  // 等待卡片可交互
  await firstCard.waitFor({ state: "visible", timeout: 1000 });

  const firstImageId = await firstCard.getAttribute("data-id");
  expect(firstImageId).toBeTruthy();

  // 滚动到卡片位置并点击
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click({ force: true });

  // 等待详情模态框显示
  const detailModal = page.locator(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`);
  await expect(detailModal).toBeVisible({ timeout: 1000 });

  // 等待模态框内容加载（等待图像元素可见）
  await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_IMG}`, {
    state: "visible",
    timeout: 1000,
  });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return { firstImageId, firstCard };
}

/**
 * 进入提示词详情视图（带返回值）
 * Steps:
 * 1. Switch to prompt panel
 * 2. Switch to grid view (ensure cards are visible)
 * 3. Wait for prompt cards to load
 * 4. Get first prompt ID
 * 5. Click card to open detail
 * 6. Wait for detail modal to show
 */
export async function enterPromptDetailView(
  page: any,
  screenshotPath?: string,
) {
  // 使用快捷键切换到提示词主界面（自动关闭可能打开的模态框）
  await page.keyboard.press("Control+p");
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 确保切换到网格视图（点击网格视图按钮）
  await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}.active`, {
    state: "visible",
    timeout: 1000,
  });

  // 确保提示词网格已加载
  await page.waitForSelector(".prompt-card", {
    state: "visible",
    timeout: 1000,
  });

  const firstCard = page.locator(".prompt-card").first();
  await expect(firstCard).toBeVisible({ timeout: 1000 });

  // 等待卡片可交互
  await firstCard.waitFor({ state: "visible", timeout: 1000 });

  const firstPromptId = await firstCard.getAttribute("data-id");
  expect(firstPromptId).toBeTruthy();

  // 滚动到卡片位置并点击
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.click({ force: true });

  // 等待详情模态框显示
  const detailModal = page.locator(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`);
  await expect(detailModal).toBeVisible({ timeout: 1000 });

  // 等待模态框内容加载（等待标题输入框可见）
  await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_TITLE}`, {
    state: "visible",
    timeout: 1000,
  });

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  return { firstPromptId, firstCard };
}

// ========== 数据库操作辅助函数 ==========

/**
 * 从数据库获取图像完整信息
 */
export async function getImageFromDatabase(
  page: any,
  imageId: string,
): Promise<IImage | null> {
  return await page.evaluate(async (id: string) => {
    try {
      const image = await window.electronAPI.getImageById(id);
      return image as IImage;
    } catch (error) {
      console.error("Failed to get image from database:", error);
      return null;
    }
  }, imageId);
}

/**
 * 从数据库获取提示词完整信息
 */
export async function getPromptFromDatabase(
  page: any,
  promptId: string,
): Promise<IPrompt | null> {
  return await page.evaluate(async (id: string) => {
    try {
      const prompt = await window.electronAPI.getPromptById(id);
      return prompt as IPrompt;
    } catch (error) {
      console.error("Failed to get prompt from database:", error);
      return null;
    }
  }, promptId);
}

/**
 * 获取第一个图像的ID
 */
export async function getFirstImageId(page: any): Promise<string> {
  await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });
  await page.click(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}`);

  const firstCard = page.locator(".image-card").first();
  await expect(firstCard).toBeVisible({ timeout: 1000 });

  return (await firstCard.getAttribute("data-id")) || "";
}

/**
 * 获取第一个提示词的ID
 */
export async function getFirstPromptId(page: any): Promise<string> {
  await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });
  await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);

  const firstCard = page.locator(".prompt-card").first();
  await expect(firstCard).toBeVisible({ timeout: 1000 });

  return (await firstCard.getAttribute("data-id")) || "";
}

// ========== 标签筛选区域辅助函数 ==========

/**
 * 确保标签筛选区域展开
 * @param page - Playwright page 对象
 * @param filterSectionId - 标签筛选区域元素ID
 * @param toggleBtnId - 切换按钮元素ID
 */
export async function ensureTagFilterExpanded(
  page: any,
  filterSectionId: string,
  toggleBtnId: string,
) {
  const tagFilterSection = page.locator(`#${filterSectionId}`);
  const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
    el.classList.contains("collapsed"),
  );

  if (isCollapsed) {
    await page.click(`#${toggleBtnId}`);
    // Wait for collapsed class to be removed
    await page.waitForFunction(
      (id: string) => {
        const el = document.getElementById(id);
        return el && !el.classList.contains("collapsed");
      },
      filterSectionId,
      { timeout: 1000 },
    );
  }
}

/**
 * 确保标签筛选区域收起
 * @param page - Playwright page 对象
 * @param filterSectionId - 标签筛选区域元素ID
 * @param toggleBtnId - 切换按钮元素ID
 */
export async function ensureTagFilterCollapsed(
  page: any,
  filterSectionId: string,
  toggleBtnId: string,
) {
  const tagFilterSection = page.locator(`#${filterSectionId}`);
  const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
    el.classList.contains("collapsed"),
  );

  if (!isCollapsed) {
    await page.click(`#${toggleBtnId}`);
    // Wait for collapsed class to be added
    await page.waitForFunction(
      (id: string) => {
        const el = document.getElementById(id);
        return el && el.classList.contains("collapsed");
      },
      filterSectionId,
      { timeout: 1000 },
    );
  }
}

// ========== 提示词详情测试辅助函数 ==========

/**
 * 获取当前显示的图像ID列表
 * @param page - Playwright page 对象
 * @returns 图像ID数组
 */
export async function getDisplayedImageIds(page: Page): Promise<string[]> {
  return await page.evaluate((containerId) => {
    const items = document.querySelectorAll(
      `#${containerId} .image-preview-item`,
    );
    return Array.from(items).map(
      (item) => item.getAttribute("data-image-id") || "",
    );
  }, Constants.Ids.IMAGE_PREVIEW_LIST);
}

/**
 * 右键点击图像并选择"设为首张"
 * @param page - Playwright page 对象
 * @param imageId - 图像ID
 */
export async function rightClickAndSetAsFirst(
  page: Page,
  imageId: string,
): Promise<void> {
  // 右键点击图像
  const imageItem = page.locator(
    `#${Constants.Ids.IMAGE_PREVIEW_LIST} .image-preview-item[data-image-id="${imageId}"]`,
  );
  await imageItem.click({ button: "right" });

  // 等待右键菜单显示（使用包含特定菜单项的选择器来定位图像右键菜单）
  await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', {
    state: "visible",
    timeout: 1000,
  });

  // 点击"设为首张"菜单项
  await page.click('.context-menu-item[data-item-id="setAsFirst"]');

  // 等待菜单消失（通过检查特定菜单项是否隐藏）
  await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', {
    state: "hidden",
    timeout: 1000,
  });
}

/**
 * 获取所有提示词列表
 * @param page - Playwright page 对象
 * @returns 提示词数组
 */
export async function getAllPrompts(page: Page): Promise<IPrompt[]> {
  return await page.evaluate(async () => {
    return await window.electronAPI.getPrompts("updatedAt", "desc");
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
  maxCount: number = -1,
): Promise<string | null> {
  const prompts = await getAllPrompts(page);

  // 获取当前视图中可见的提示词卡片ID
  const visibleCardIds = await page.evaluate(() => {
    const cards = document.querySelectorAll(".prompt-card");
    return Array.from(cards)
      .map((card) => card.getAttribute("data-id"))
      .filter(Boolean);
  });

  // 只在可见的卡片中查找符合条件的提示词
  for (const prompt of prompts) {
    // 跳过不在当前视图中的提示词
    if (!visibleCardIds.includes(prompt.id)) {
      continue;
    }

    const imageCount = prompt.images?.length || 0;
    const withinMin = imageCount >= minCount;
    const withinMax = maxCount === -1 || imageCount <= maxCount;

    if (withinMin && withinMax) {
      return prompt.id;
    }
  }

  return null;
}

// ========== 测试数据恢复辅助函数 ==========

/**
 * 恢复图像收藏状态
 * @param page - Playwright page 对象
 * @param imageId - 图像ID
 * @param isFavorite - 原始收藏状态
 */
export async function restoreImageFavoriteStatus(
  page: Page,
  imageId: string,
  isFavorite: boolean,
): Promise<void> {
  await page.evaluate(
    async (params: { id: string; status: number }) => {
      await window.electronAPI.updateImage(params.id, {
        isFavorite: params.status,
      });
    },
    { id: imageId, status: isFavorite ? 1 : 0 },
  );
}

/**
 * 恢复提示词收藏状态
 * @param page - Playwright page 对象
 * @param promptId - 提示词ID
 * @param isFavorite - 原始收藏状态
 */
export async function restorePromptFavoriteStatus(
  page: Page,
  promptId: string,
  isFavorite: boolean,
): Promise<void> {
  await page.evaluate(
    async (params: { id: string; status: number }) => {
      await window.electronAPI.updatePrompt(params.id, {
        isFavorite: params.status,
      });
    },
    { id: promptId, status: isFavorite ? 1 : 0 },
  );
}

/**
 * 打开指定提示词的详情界面
 * @param page - Playwright page 对象
 * @param promptId - 提示词ID
 */
export async function openPromptDetailById(
  page: Page,
  promptId: string,
): Promise<void> {
  // 确保在提示词面板
  await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 确保网格视图
  await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_GRID}`, {
    state: "visible",
    timeout: 1000,
  });

  // 点击指定提示词卡片
  const promptCard = page.locator(`.prompt-card[data-id="${promptId}"]`);
  await promptCard.click();

  // 等待详情模态框显示
  await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 等待图像预览列表加载完成（显式等待，而非固定等待）
  await page.waitForFunction(
    (containerId) => {
      const imageList = document.getElementById(containerId);
      return imageList !== null;
    },
    Constants.Ids.IMAGE_PREVIEW_LIST,
    { timeout: 1000 },
  );
}

// ========== 共用 Fixture ==========

/**
 * 生成测试专用数据目录路径
 * 使用临时目录，确保测试数据隔离
 */
function getTestDataDir(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 8);
  return join(tmpdir(), `prompt-manager-e2e-${timestamp}-${randomId}`);
}

/**
 * 共用的 Playwright fixture
 * 使用 worker-scoped fixture 管理应用生命周期
 * 每个测试文件只启动和关闭一次应用
 */
export const test = base.extend<
  {
    electronTest: ReturnType<typeof createElectronTest>;
    page: ReturnType<ReturnType<typeof createElectronTest>["getPage"]>;
  },
  {
    _electronTest: ReturnType<typeof createElectronTest>;
    _testDataDir: string;
  }
>({
  // worker-scoped fixture：测试数据目录
  _testDataDir: [
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const testDataDir = getTestDataDir();
      await use(testDataDir);
      // 测试完成后清理测试数据目录
      try {
        rmSync(testDataDir, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    },
    { scope: "worker" },
  ],
  // worker-scoped fixture：在 worker 级别管理应用生命周期
  _electronTest: [
    async ({ _testDataDir }, use) => {
      const electronTest = createElectronTest(_testDataDir);
      await electronTest.launch();
      await use(electronTest);
      await electronTest.close();
    },
    { scope: "worker" },
  ],
  // test-scoped fixture：传递 electronTest 给测试使用
  electronTest: async ({ _electronTest }, use) => {
    await use(_electronTest);
  },
  // test-scoped fixture：传递 page 给测试使用
  page: async ({ _electronTest }, use) => {
    await use(_electronTest.getPage());
  },
});

// ========== 提示词详情测试辅助函数 ==========

/**
 * 等待图像顺序变化为目标顺序
 * @param page - Playwright page 对象
 * @param expectedFirstId - 期望的首张图像ID
 * @param timeout - 超时时间
 */
export async function waitForImageOrderChange(
  page: Page,
  expectedFirstId: string,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (params: { expectedId: string; listId: string }) => {
      const items = document.querySelectorAll(
        `#${params.listId} .image-preview-item`,
      );
      if (items.length === 0) return false;
      const firstId = items[0]?.getAttribute("data-image-id");
      return firstId === params.expectedId;
    },
    { expectedId: expectedFirstId, listId: Constants.Ids.IMAGE_PREVIEW_LIST },
    { timeout },
  );
}

/**
 * 等待数据库中的图像顺序更新
 * @param page - Playwright page 对象
 * @param promptId - 提示词ID
 * @param expectedFirstId - 期望的首张图像ID
 * @param timeout - 超时时间
 */
export async function waitForDatabaseImageOrder(
  page: Page,
  promptId: string,
  expectedFirstId: string,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    async (params: { promptId: string; expectedId: string }) => {
      const prompt = await window.electronAPI.getPromptById(params.promptId);
      if (!prompt || !prompt.images || prompt.images.length === 0) return false;
      return prompt.images[0]?.id === params.expectedId;
    },
    { promptId, expectedId: expectedFirstId },
    { timeout },
  );
}
