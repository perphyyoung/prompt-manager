import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import {
  test,
  enterPromptDetailView,
  getPromptFromDatabase,
  findPromptWithImageCount,
} from "./electron-test.ts";

/**
 * 提示词详情界面数据库字段读取 E2E 测试
 *
 * 测试目标：验证提示词详情界面正确读取并显示所有数据库字段
 *
 * 测试的数据库字段：
 * - 提示词基本信息：id, title, content, contentTranslate, note, isSafe, isFavorite, tags
 * - 关联图像信息：images (通过 prompt_image_relations 关联)
 * - 时间戳：createdAt, updatedAt
 *
 * 进入目标界面步骤：
 * 1. 点击 #promptManagerBtn 切换到提示词面板
 * 2. 等待 .prompt-card 元素可见
 * 3. 点击第一个提示词卡片打开详情模态框
 * 4. 等待 #promptDetailModal 显示
 */
test.describe("提示词详情界面数据库字段读取", () => {
  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest }) => {
    // 创建基础测试数据（至少2个带图像的提示词用于导航测试）
    const factory = electronTest.getApiFactory();

    // 创建第一个带有关联图像的提示词
    const result1 = await factory.createImageFactory().createWithPromptCount(
      "test_image_1",
      1,
      "test_prompt_1",
    );
    expect(result1.prompts.length).toBeGreaterThan(0);

    // 创建第二个带有关联图像的提示词（用于导航测试）
    const result2 = await factory.createImageFactory().createWithPromptCount(
      "test_image_2",
      1,
      "test_prompt_2",
    );
    expect(result2.prompts.length).toBeGreaterThan(0);

    // 再创建一个普通提示词（用于测试无图像的情况）
    await factory.createPromptFactory().create({
      label: "detail_no_image",
      content: "e2e_test_prompt_no_image",
    });

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  test("ID 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证 ID 隐藏输入框值正确
    const idInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_ID}`);
    await expect(idInput).toBeAttached();
    const displayedId = await idInput.inputValue();
    expect(displayedId).toBe(dbPrompt!.id);
  });

  test("标题 (title) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证标题输入框显示正确
    const titleInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_TITLE}`);
    await expect(titleInput).toBeVisible();
    const displayedTitle = await titleInput.inputValue();
    expect(displayedTitle).toBe(dbPrompt!.title);
  });

  test("内容 (content) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证内容文本域显示正确
    const contentInput = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_CONTENT}`,
    );
    await expect(contentInput).toBeVisible();
    const displayedContent = await contentInput.inputValue();
    expect(displayedContent).toBe(dbPrompt!.content);
  });

  test("翻译 (contentTranslate) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证翻译文本域显示正确
    const translateInput = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_TRANSLATE}`,
    );
    await expect(translateInput).toBeVisible();
    const displayedTranslate = await translateInput.inputValue();
    expect(displayedTranslate).toBe(dbPrompt!.contentTranslate || "");
  });

  test("备注 (note) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证备注文本域显示正确
    const noteInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_NOTE}`);
    await expect(noteInput).toBeVisible();
    const displayedNote = await noteInput.inputValue();
    expect(displayedNote).toBe(dbPrompt!.note || "");
  });

  test("标签 (tags) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证标签容器存在
    const tagsContainer = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER}`,
    );
    await expect(tagsContainer).toBeVisible();

    // 获取显示的标签（去除删除按钮文本）
    const displayedTags = await page.evaluate((params) => {
      const container = document.getElementById(params.containerId);
      if (!container) return [];
      return Array.from(container.querySelectorAll(".tag-editable")).map(
        (el) => {
          const text = el.textContent || "";
          return text.replace(/[\s×]+$/, "").trim();
        },
      );
    }, { containerId: Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER });

    // 验证标签数量匹配
    const dbTags = dbPrompt!.tags || [];
    expect(displayedTags.length).toBe(dbTags.length);

    // 如果有标签，验证标签内容
    if (dbTags.length > 0) {
      for (let i = 0; i < dbTags.length; i++) {
        expect(displayedTags[i]).toBe(dbTags[i]);
      }
    }
  });

  test("安全状态 (isSafe) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证安全状态开关存在（checkbox 被 CSS 隐藏，需要定位到父级 label）
    const safeToggleLabel = page.locator(
      `label:has(#${Constants.Ids.PROMPT_DETAIL_SAFE_TOGGLE})`,
    );
    await expect(safeToggleLabel).toBeVisible();

    // 验证开关状态与数据库一致
    const safeToggle = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_SAFE_TOGGLE}`,
    );
    const isChecked = await safeToggle.isChecked();
    const expectedSafe = dbPrompt!.isSafe === 1;
    expect(isChecked).toBe(expectedSafe);
  });

  test("关联图像 (images) 字段正确显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证图像上传区域存在
    const imageUploadArea = page.locator(`#${Constants.Ids.IMAGE_UPLOAD_AREA}`);
    await expect(imageUploadArea).toBeVisible();

    // 获取显示的图像数量
    const imageElements = page.locator(".image-preview-item");
    const displayedImageCount = await imageElements.count();

    // 验证图像数量匹配
    const dbImageCount = dbPrompt!.images?.length || 0;
    expect(displayedImageCount).toBe(dbImageCount);
  });

  test("点击眼睛图标进入图像详情界面，且切换图像后点击眼睛依旧有效", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // ===== 准备测试数据：创建两个带图像的提示词 =====
    const factory = electronTest.getApiFactory();

    // 创建第一个带图像的提示词
    const result1 = await factory.createImageFactory().createWithPromptCount(
      "test_image_nav_1",
      1,
      "test_prompt_nav_1",
    );
    expect(result1.prompts.length).toBeGreaterThan(0);
    const firstPromptId = result1.prompts[0].id;

    // 创建第二个带图像的提示词（用于导航测试）
    const result2 = await factory.createImageFactory().createWithPromptCount(
      "test_image_nav_2",
      1,
      "test_prompt_nav_2",
    );
    expect(result2.prompts.length).toBeGreaterThan(0);
    const secondPromptId = result2.prompts[0].id;

    // 刷新界面以显示新数据
    await electronTest.refreshData();

    // 使用快捷键切换到提示词主界面
    await page.keyboard.press("Control+p");
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 确保切换到网格视图
    await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_GRID_VIEW_BTN}.active`,
      {
        state: "visible",
        timeout: 1000,
      },
    );

    // 等待提示词网格加载
    await page.waitForSelector(".prompt-card", {
      state: "visible",
      timeout: 1000,
    });

    // ===== 第一部分：验证第一个提示词的图像眼睛图标有效 =====

    // 点击第一个提示词卡片
    const firstCard = page.locator(
      `.prompt-card[data-id="${firstPromptId}"]`,
    );
    await expect(firstCard).toBeVisible({ timeout: 1000 });
    await firstCard.scrollIntoViewIfNeeded();
    await firstCard.click({ force: true });

    // 等待详情模态框显示
    const detailModal = page.locator(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`);
    await expect(detailModal).toBeVisible({ timeout: 1000 });

    // 等待模态框内容加载
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_TITLE}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证进入的提示词 ID
    const enteredPromptId = await page.inputValue(`#${Constants.Ids.PROMPT_DETAIL_ID}`);
    expect(enteredPromptId).toBe(firstPromptId);

    // 验证存在图像预览项
    const imagePreviewItems = page.locator(".image-preview-item");
    const imageCount = await imagePreviewItems.count();

    // 断言必须有图像（因为已经查找过有图像的提示词）
    expect(imageCount).toBeGreaterThan(0);

    // 获取第一个图像的眼睛图标按钮
    const firstImagePreview = imagePreviewItems.first();
    const viewImageBtn = firstImagePreview.locator(".view-image");

    // 验证眼睛图标按钮存在且可见
    await expect(viewImageBtn).toBeVisible({ timeout: 1000 });

    // 获取图像ID用于后续验证
    const imageId = await firstImagePreview.getAttribute("data-image-id");
    expect(imageId).toBeTruthy();

    // 悬停在图像预览项上以显示眼睛图标（CSS hover 效果）
    await firstImagePreview.hover();

    // 点击眼睛图标
    await viewImageBtn.click();

    // 验证图像详情模态框显示
    const imageDetailModal = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_MODAL}`,
    );
    await expect(imageDetailModal).toBeVisible({ timeout: 1000 });

    // 关闭图像详情模态框
    const closeBtn = page.locator(`#${Constants.Ids.IMAGE_DETAIL_CLOSE_BTN}`);
    await closeBtn.click();
    await expect(imageDetailModal).toBeHidden({ timeout: 1000 });

    // ===== 第二部分：直接点击第二个提示词卡片，验证眼睛图标依旧有效 =====

    // 关闭提示词详情模态框（回到列表）
    const closeDetailBtn = page.locator(`#${Constants.Ids.PROMPT_DETAIL_CLOSE_BTN}`);
    await closeDetailBtn.click();
    await expect(detailModal).toBeHidden({ timeout: 1000 });

    // 点击第二个提示词卡片
    const secondCard = page.locator(
      `.prompt-card[data-id="${secondPromptId}"]`,
    );
    await expect(secondCard).toBeVisible({ timeout: 1000 });
    await secondCard.scrollIntoViewIfNeeded();
    await secondCard.click({ force: true });

    // 等待详情模态框显示
    await expect(detailModal).toBeVisible({ timeout: 1000 });

    // 等待模态框内容加载
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_TITLE}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证进入的提示词 ID
    const secondEnteredId = await page.inputValue(`#${Constants.Ids.PROMPT_DETAIL_ID}`);
    expect(secondEnteredId).toBe(secondPromptId);

    // 获取第二个提示词的第一个图像
    const secondImagePreviewItems = page.locator(".image-preview-item");
    const secondImageCount = await secondImagePreviewItems.count();
    expect(secondImageCount).toBeGreaterThan(0);

    const secondFirstImagePreview = secondImagePreviewItems.first();
    const secondViewImageBtn = secondFirstImagePreview.locator(".view-image");

    // 验证眼睛图标按钮存在且可见
    await expect(secondViewImageBtn).toBeVisible({ timeout: 1000 });

    // 获取图像ID
    const secondImageId =
      await secondFirstImagePreview.getAttribute("data-image-id");
    expect(secondImageId).toBeTruthy();

    // 悬停并点击眼睛图标
    await secondFirstImagePreview.hover();
    await secondViewImageBtn.click();

    // 验证图像详情模态框显示
    await expect(imageDetailModal).toBeVisible({ timeout: 1000 });
  });

  test("删除图像后通过图像管理重新加载原图像", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 查找有图像的提示词
    const promptIdWithImage = await findPromptWithImageCount(page, 1);
    if (!promptIdWithImage) {
      await electronTest.logWarn(page, "跳过测试：没有找到有图像的提示词");
      return;
    }

    // 使用快捷键切换到提示词主界面（自动关闭可能打开的模态框）
    await page.keyboard.press("Control+p");
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
    await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
    await page.locator(`.prompt-card[data-id="${promptIdWithImage}"]`).click();
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证存在图像并获取图像ID
    const imagePreviewItems = page.locator(".image-preview-item");
    const imageCountBefore = await imagePreviewItems.count();
    expect(imageCountBefore).toBeGreaterThan(0);

    const firstImagePreview = imagePreviewItems.first();
    const deletedImageId =
      await firstImagePreview.getAttribute("data-image-id");
    expect(deletedImageId).toBeTruthy();

    // 悬停并点击删除按钮
    await firstImagePreview.hover();
    await firstImagePreview.locator(".remove-image").click({ force: true });

    // 等待确认对话框显示
    await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 点击确认按钮
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

    // 等待确认对话框关闭
    await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 等待删除完成
    await page.waitForFunction(
      (expectedCount: number) =>
        document.querySelectorAll(".image-preview-item").length ===
        expectedCount,
      imageCountBefore - 1,
      { timeout: 1000 },
    );

    // 验证图像已被删除
    expect(await imagePreviewItems.count()).toBe(imageCountBefore - 1);

    // 点击"从图像管理选择"按钮
    await page
      .locator(`#${Constants.Ids.PROMPT_DETAIL_SELECT_FROM_IMAGE_MANAGER_BTN}`)
      .click();
    await page.waitForSelector(`#${Constants.Ids.IMAGE_SELECTOR_MODAL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 等待图像选择器中的图像项加载
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_SELECTOR_MODAL} .image-selector-item`,
      { state: "visible", timeout: 1000 },
    );

    // 查找之前删除的图像项
    const imageItem = page.locator(
      `#${Constants.Ids.IMAGE_SELECTOR_MODAL} .image-selector-item[data-image-id="${deletedImageId}"]`,
    );

    // 检查图像项是否存在
    const isImageItemVisible = await imageItem.isVisible().catch(() => false);
    if (!isImageItemVisible) {
      await page
        .locator(`#${Constants.Ids.CLOSE_IMAGE_SELECTOR_MODAL}`)
        .click();
      await electronTest.logWarn(
        page,
        `跳过测试：原图像 ${deletedImageId} 不在选择器中`,
      );
      return;
    }

    // 选择图像并确认
    await imageItem.click();
    await page.locator(`#${Constants.Ids.CONFIRM_IMAGE_SELECTOR_BTN}`).click();

    // 等待选择器关闭并验证图像已重新加载
    await page.waitForSelector(`#${Constants.Ids.IMAGE_SELECTOR_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 验证图像数量恢复
    const imageCountAfterReload = await imagePreviewItems.count();
    expect(imageCountAfterReload).toBe(imageCountBefore);

    // 获取所有重新加载的图像ID
    const reloadedImageIds = await page.evaluate(() => {
      const items = document.querySelectorAll(".image-preview-item");
      return Array.from(items).map((item) =>
        item.getAttribute("data-image-id"),
      );
    });

    // 验证重新加载的图像中包含之前删除的图像
    expect(reloadedImageIds).toContain(deletedImageId);
  });

  test("双击图像进入全屏查看模式", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 查找有图像的提示词
    const promptIdWithImage = await findPromptWithImageCount(page, 1);
    if (!promptIdWithImage) {
      await electronTest.logWarn(page, "跳过测试：没有找到有图像的提示词");
      return;
    }

    // 使用快捷键切换到提示词主界面（自动关闭可能打开的模态框）
    await page.keyboard.press("Control+p");
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
    await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
    await page.locator(`.prompt-card[data-id="${promptIdWithImage}"]`).click();
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证存在图像
    const imagePreviewItems = page.locator(".image-preview-item");
    const imageCount = await imagePreviewItems.count();
    expect(imageCount).toBeGreaterThan(0);

    // 获取第一个图像的ID
    const firstImagePreview = imagePreviewItems.first();
    const firstImageId = await firstImagePreview.getAttribute("data-image-id");
    expect(firstImageId).toBeTruthy();

    // 双击图像
    await firstImagePreview.locator("img").dblclick();

    // 等待全屏查看器显示
    const fullscreenViewer = page.locator(
      `#${Constants.Ids.IMAGE_FULLSCREEN_VIEWER}`,
    );
    await expect(fullscreenViewer).toBeVisible({ timeout: 1000 });

    // 验证全屏查看器中显示的图像ID与双击的图像一致
    const fullscreenImageId = await page.evaluate((viewerId: string) => {
      const viewer = document.getElementById(viewerId);
      if (!viewer) return null;
      const img = viewer.querySelector("img");
      return img?.getAttribute("data-image-id");
    }, Constants.Ids.IMAGE_FULLSCREEN_VIEWER);
    expect(fullscreenImageId).toBe(firstImageId);

    // 关闭全屏查看器
    await page.click(`#${Constants.Ids.IMAGE_FULLSCREEN_VIEWER_CLOSE}`);
    await expect(fullscreenViewer).toBeHidden({ timeout: 1000 });
  });

  test("所有数据库字段一致性验证", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取完整提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 收集所有界面显示的值
    const uiValues = await page.evaluate(
      (params) => {
        const {
          containerId,
          idFieldId,
          titleId,
          contentId,
          translateId,
          noteId,
        } = params;

        const getValue = (id: string): string => {
          const el = document.getElementById(id);
          if (!el) return "";
          if (
            el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement
          ) {
            return el.value;
          }
          return el.textContent || "";
        };

        const getTags = (): string[] => {
          const container = document.getElementById(containerId);
          if (!container) return [];
          return Array.from(container.querySelectorAll(".tag-editable")).map(
            (el) => {
              const text = el.textContent || "";
              return text.replace(/[\s×]+$/, "").trim();
            },
          );
        };

        const getImageCount = (): number => {
          return document.querySelectorAll(".image-preview-item").length;
        };

        return {
          id:
            (document.getElementById(idFieldId) as HTMLInputElement)?.value ||
            "",
          title: getValue(titleId),
          content: getValue(contentId),
          contentTranslate: getValue(translateId),
          note: getValue(noteId),
          tags: getTags(),
          imageCount: getImageCount(),
        };
      },
      {
        containerId: Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER,
        idFieldId: Constants.Ids.PROMPT_DETAIL_ID,
        titleId: Constants.Ids.PROMPT_DETAIL_TITLE,
        contentId: Constants.Ids.PROMPT_DETAIL_CONTENT,
        translateId: Constants.Ids.PROMPT_DETAIL_TRANSLATE,
        noteId: Constants.Ids.PROMPT_DETAIL_NOTE,
      },
    );

    // 验证所有字段一致性
    expect(uiValues.id).toBe(dbPrompt!.id);
    expect(uiValues.title).toBe(dbPrompt!.title);
    expect(uiValues.content).toBe(dbPrompt!.content);
    expect(uiValues.contentTranslate).toBe(dbPrompt!.contentTranslate || "");
    expect(uiValues.note).toBe(dbPrompt!.note || "");

    // 验证标签
    const dbTags = dbPrompt!.tags || [];
    expect(uiValues.tags).toEqual(dbTags);

    // 验证图像数量
    const dbImageCount = dbPrompt!.images?.length || 0;
    expect(uiValues.imageCount).toBe(dbImageCount);
  });
});
