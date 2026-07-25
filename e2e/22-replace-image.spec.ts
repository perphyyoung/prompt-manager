import { expect } from "@playwright/test";
import { test, enterImageDetailView, enterPromptDetailView } from "./electron-test.ts";
import { Constants } from "../src/constants.ts";
import type { IPrompt } from "../src/preload/index.ts";
import { generateTempImage } from "./factories/image-utils.ts";

/**
 * 替换图像功能 E2E 测试
 *
 * 测试场景：
 * 1. 在图像详情界面右键替换当前图像
 * 2. 在提示词详情界面右键替换提示词关联的图像
 * 3. 验证旧图像进入回收站，关联关系迁移到新图像
 */
test.describe("替换图像功能", () => {
  /**
   * 设置替换图像的 mock 文件路径
   */
  async function setReplaceImageMock(electronTest: any, filePath: string): Promise<void> {
    const electronApp = electronTest.getElectronApp();
    await electronApp.evaluate(async (app: any, path: string) => {
      (global as any).__testMockedReplaceImageFilePath = path;
    }, filePath);
  }

  /**
   * 清除替换图像的 mock
   */
  async function clearReplaceImageMock(electronTest: any): Promise<void> {
    const electronApp = electronTest.getElectronApp();
    await electronApp.evaluate(async () => {
      delete (global as any).__testMockedReplaceImageFilePath;
    });
  }

  test("图像详情界面替换图像", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const promptFactory = factory.createPromptFactory();

    // 创建原图像和一个提示词（用于验证关联迁移）
    const [originalImage] = await imageFactory.createBatch(1, "replace_original");
    const prompt = await promptFactory.create({
      label: "replace_test",
      title: "replace_test_prompt",
      content: "replace test content",
      images: [{ id: String(originalImage.id) }],
    });
    await electronTest.refreshData();

    const originalImageId = String(originalImage.id);
    const promptId = String(prompt.id);

    // 进入图像详情
    await enterImageDetailView(page);

    // 确认当前显示的是原图像
    const detailImage = page.locator(`#${Constants.Ids.IMAGE_DETAIL_IMG}`);
    await expect(detailImage).toBeVisible({ timeout: 2000 });

    // 生成替换用的新图像文件
    const replaceImagePath = await generateTempImage();
    await setReplaceImageMock(electronTest, replaceImagePath);

    try {
      // 右键图像打开上下文菜单（使用 force 确保命中目标）
      await detailImage.click({ button: "right", force: true });

      // 点击"替换图像"菜单项
      const menuItem = page.locator(".context-menu-item", {
        hasText: Constants.CONTEXT_MENU_REPLACE_IMAGE,
      });
      await expect(menuItem).toBeVisible({ timeout: 2000 });
      await menuItem.click();

      // 等待成功提示
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("图像已替换")`,
        { timeout: 2000 },
      );

      // 验证旧图像已进入回收站
      const trashImages = await page.evaluate(async () => {
        return await window.electronAPI.getImageTrash();
      });
      const oldImageInTrash = trashImages.find((img) => String(img.id) === originalImageId);
      expect(oldImageInTrash).toBeTruthy();

      // 验证提示词关联的图像已更新（id 不再是原图像）
      const updatedPrompt = await page.evaluate(async (id: string) => {
        return await window.electronAPI.getPromptById(id);
      }, promptId);
      expect(updatedPrompt).toBeTruthy();
      const associatedImageIds = (updatedPrompt as IPrompt).images?.map((img) =>
        typeof img === "string" ? img : String(img.id),
      );
      expect(associatedImageIds).not.toContain(originalImageId);
      expect((associatedImageIds || []).length).toBe(1);
    } finally {
      await clearReplaceImageMock(electronTest);
    }
  });

  test("提示词详情界面替换图像", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const promptFactory = factory.createPromptFactory();

    // 创建原图像和一个提示词
    const [originalImage] = await imageFactory.createBatch(1, "replace_prompt_original");
    const prompt = await promptFactory.create({
      label: "replace_prompt_detail",
      title: "replace_prompt_detail_test",
      content: "replace prompt detail test",
      images: [{ id: String(originalImage.id) }],
    });
    await electronTest.refreshData();

    const originalImageId = String(originalImage.id);
    const promptId = String(prompt.id);

    // 进入提示词详情
    await enterPromptDetailView(page);

    // 确认图像预览存在
    const previewItem = page.locator(".image-preview-item").first();
    await expect(previewItem).toBeVisible({ timeout: 1000 });

    // 生成替换用的新图像文件
    const replaceImagePath = await generateTempImage();
    await setReplaceImageMock(electronTest, replaceImagePath);

    try {
      // 右键图像预览打开上下文菜单
      await previewItem.click({ button: "right" });

      // 点击"替换图像"菜单项
      const menuItem = page.locator(".context-menu-item", {
        hasText: Constants.CONTEXT_MENU_REPLACE_IMAGE,
      });
      await expect(menuItem).toBeVisible({ timeout: 1000 });
      await menuItem.click();

      // 等待成功提示
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("图像已替换")`,
        { timeout: 2000 },
      );

      // 验证旧图像已进入回收站
      const trashImages = await page.evaluate(async () => {
        return await window.electronAPI.getImageTrash();
      });
      const oldImageInTrash = trashImages.find((img) => String(img.id) === originalImageId);
      expect(oldImageInTrash).toBeTruthy();

      // 验证提示词关联的图像已更新
      const updatedPrompt = await page.evaluate(async (id: string) => {
        return await window.electronAPI.getPromptById(id);
      }, promptId);
      expect(updatedPrompt).toBeTruthy();
      const associatedImageIds = (updatedPrompt as IPrompt).images?.map((img) =>
        typeof img === "string" ? img : String(img.id),
      );
      expect(associatedImageIds).not.toContain(originalImageId);
      expect((associatedImageIds || []).length).toBe(1);

      // 验证图像预览已更新为新的图像
      const updatedPreviewItems = page.locator(".image-preview-item");
      await expect(updatedPreviewItems).toHaveCount(1, { timeout: 1000 });
      const newPreviewImageId = await updatedPreviewItems.first().getAttribute("data-image-id");
      expect(newPreviewImageId).toBeTruthy();
      expect(newPreviewImageId).not.toBe(originalImageId);
    } finally {
      await clearReplaceImageMock(electronTest);
    }
  });
});
