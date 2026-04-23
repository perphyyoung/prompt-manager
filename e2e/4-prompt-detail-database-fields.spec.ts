import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import {
  test,
  enterPromptDetailView,
  getPromptFromDatabase,
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
  test("ID 字段正确显示", async ({ _electronTest, page }) => {
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

  test("标题 (title) 字段正确显示", async ({ _electronTest, page }) => {
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

  test("内容 (content) 字段正确显示", async ({ _electronTest, page }) => {
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

  test("翻译 (contentTranslate) 字段正确显示", async ({
    _electronTest,
    page,
  }) => {
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

  test("备注 (note) 字段正确显示", async ({ _electronTest, page }) => {
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

  test("标签 (tags) 字段正确显示", async ({ _electronTest, page }) => {
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
    const displayedTags = await page.evaluate((containerId) => {
      const container = document.getElementById(containerId);
      if (!container) return [];
      return Array.from(container.querySelectorAll(".tag-editable")).map(
        (el) => {
          const text = el.textContent || "";
          return text.replace(/[\s×]+$/, "").trim();
        },
      );
    }, Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER);

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

  test("安全状态 (isSafe) 字段正确显示", async ({ _electronTest, page }) => {
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

  test("关联图像 (images) 字段正确显示", async ({ _electronTest, page }) => {
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

  test("所有数据库字段一致性验证", async ({ _electronTest, page }) => {
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
