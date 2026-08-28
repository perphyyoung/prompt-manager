import { expect } from "@playwright/test";
import { Constants } from "../src/renderer/constants.ts";
import { enterImageDetailView, test } from "./electron-test.ts";

/**
 * 图像详情界面"编辑提示词"按钮跳转 E2E 测试
 *
 * 测试目标：验证图像详情界面的"编辑提示词"按钮能正确打开
 * 当前选中的提示词详情，无论关联一个还是多个提示词。
 */

async function openPromptDetailFromImageAndVerify(page: any, expectedTitle: string): Promise<void> {
  // 点击编辑按钮
  await page.click(`#${Constants.Ids.EDIT_PROMPT_FROM_IMAGE_BTN}`);

  // 等待提示词详情模态框显示
  await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
    state: "visible",
    timeout: 1000,
  });

  // 验证打开的提示词标题正确
  const titleInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_TITLE}`);
  await expect(titleInput).toHaveValue(expectedTitle);

  // 关闭提示词详情
  await page.click(`#${Constants.Ids.PROMPT_DETAIL_CLOSE_BTN}`);
  await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
    state: "hidden",
    timeout: 1000,
  });
}

test.describe("图像详情界面单提示词编辑跳转", () => {
  const promptTitle = "e2e-single-prompt";

  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();

    // 创建测试图像，并关联一个提示词
    const image = await factory.createImageFactory().create({ label: "single-prompt" });
    await factory
      .createPromptFactory()
      .createWithImages({ title: promptTitle, label: "single" }, [image.id]);

    await electronTest.refreshData();
  });

  test("单提示词下编辑按钮能打开该提示词", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    await enterImageDetailView(page);

    // 验证关联提示词区域只有一个提示词标题
    const promptRefItems = page.locator("#imageDetailPromptTitle .prompt-ref-item");
    await expect(promptRefItems).toHaveCount(1);

    // 验证编辑按钮文本（单提示词时不显示序号）
    const editBtnText = page.locator("#editPromptBtnText");
    await expect(editBtnText).toHaveText("编辑提示词");

    await openPromptDetailFromImageAndVerify(page, promptTitle);
  });
});

test.describe("图像详情界面多提示词编辑跳转", () => {
  const promptOld = "e2e-old-prompt";
  const promptNew = "e2e-new-prompt";

  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();

    // 创建测试图像，并关联两个提示词
    const image = await factory.createImageFactory().create({ label: "multi-prompt" });
    await factory
      .createPromptFactory()
      .createWithImages({ title: promptOld, label: "old" }, [image.id]);
    await factory
      .createPromptFactory()
      .createWithImages({ title: promptNew, label: "new" }, [image.id]);

    await electronTest.refreshData();
  });

  test("多提示词下编辑按钮默认打开最新提示词", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    await enterImageDetailView(page);

    const promptRefItems = page.locator("#imageDetailPromptTitle .prompt-ref-item");
    await expect(promptRefItems).toHaveCount(2);

    const editBtnText = page.locator("#editPromptBtnText");
    await expect(editBtnText).toHaveText("编辑提示词 (1)");

    await openPromptDetailFromImageAndVerify(page, promptNew);
  });

  test("切换第二个提示词后编辑按钮打开对应提示词", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    await enterImageDetailView(page);

    const promptRefItems = page.locator("#imageDetailPromptTitle .prompt-ref-item");
    await expect(promptRefItems).toHaveCount(2);

    // 点击第二个提示词标题切换选中
    const secondRefTitle = promptRefItems.nth(1).locator(".prompt-ref-title");
    await secondRefTitle.click();

    const editBtnText = page.locator("#editPromptBtnText");
    await expect(editBtnText).toHaveText("编辑提示词 (2)");

    await openPromptDetailFromImageAndVerify(page, promptOld);
  });
});
