import { expect } from "@playwright/test";
import { test, enterImageGridView } from "./electron-test.ts";
import type { IPrompt } from "../src/preload/index.ts";
import { Constants } from "../src/constants.ts";

/**
 * 新建提示词防重复提交 E2E 测试
 *
 * 测试前提：应用已有至少一个图像数据
 * 测试场景：用户快速点击"完成"按钮多次，应该只创建一个提示词
 *
 * 进入目标界面步骤：
 * 1. 点击 #imageManagerBtn 切换到图像面板
 * 2. 点击 #imageGridViewBtn 确保处于网格视图
 * 3. 等待 .image-card 元素可见
 * 4. 点击第一个图像打开详情
 */
test.describe("新建提示词防重复提交", () => {
  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest }) => {
    // 创建测试数据：至少1个图像（用于新建提示词测试）
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(1, "duplicate_test");

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  test("快速点击完成按钮应该只创建一个提示词", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并获取第一个图像
    const firstImage = await enterImageGridView(page);

    // 点击第一个图像打开详情
    await firstImage.click();

    // 等待图像详情页面加载
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 检查按钮状态，如有"编辑"则先解除关联
    const editPromptBtn = page.locator(
      `#${Constants.Ids.EDIT_PROMPT_FROM_IMAGE_BTN}`,
    );
    await editPromptBtn.waitFor({ state: "visible", timeout: 1000 });

    const btnText = await editPromptBtn.textContent();

    if (btnText?.includes("编辑")) {
      const unlinkBtn = page.locator(".prompt-ref-unlink").first();
      await expect(unlinkBtn).toBeVisible();
      await unlinkBtn.click();

      await page.waitForSelector(
        `#${Constants.Ids.CONFIRM_MODAL}[style*="flex"]`,
        { timeout: 1000 },
      );
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      await page.waitForFunction(
        (params: { btnTextId: string }) => {
          const text = document.getElementById(params.btnTextId)?.textContent;
          return text === "添加提示词";
        },
        { btnTextId: Constants.Ids.EDIT_PROMPT_BTN_TEXT },
        { timeout: 1500 }, // 连续测试时容易超时, 1000 -> 1500
      );
    }

    // 点击"添加提示词"按钮
    await editPromptBtn.click();

    // 等待新建提示词页面加载
    await page.waitForSelector(`#${Constants.Ids.NEW_PROMPT_PAGE}.active`, {
      timeout: 1000,
    });

    // 输入提示词内容
    const testContent = `测试提示词 ${Date.now()}`;
    await page.fill(`#${Constants.Ids.NEW_PROMPT_CONTENT}`, testContent);

    // 获取当前提示词数量
    const initialPromptCount = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.length;
    });

    // 使用 page.evaluate 在浏览器端快速点击完成按钮多次
    // 这样可以在防重复提交机制生效前连续触发多次点击

    await page.evaluate(
      (params: { doneBtnId: string }) => {
        const doneBtn = document.getElementById(params.doneBtnId);
        if (doneBtn) {
          // 快速连续触发5次点击事件
          for (let i = 0; i < 5; i++) {
            doneBtn.click();
          }
        }
      },
      { doneBtnId: Constants.Ids.NEW_PROMPT_DONE_BTN },
    );

    // 等待操作完成 - 页面应该关闭
    await page.waitForFunction(
      (params: { pageId: string }) => {
        const page = document.getElementById(params.pageId);
        return !page?.classList.contains("active");
      },
      { pageId: Constants.Ids.NEW_PROMPT_PAGE },
      { timeout: 1000 },
    );

    // 验证只创建了一个提示词
    const finalPromptCount = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.length;
    });

    expect(finalPromptCount).toBe(initialPromptCount + 1);

    // 验证创建的提示词内容正确
    const createdPrompt = await page.evaluate(
      async (params: { content: string }): Promise<IPrompt | undefined> => {
        const prompts = await window.electronAPI.getPrompts(
          "createdAt",
          "desc",
        );
        return prompts.find((p: IPrompt) => p.content === params.content);
      },
      { content: testContent },
    );

    expect(createdPrompt).toBeDefined();
    expect(createdPrompt?.content).toBe(testContent);
  });

  test("重复点击完成按钮时应该只执行一次保存", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并获取第一个图像
    const firstImage = await enterImageGridView(page);

    // 点击第一个图像打开详情
    await firstImage.click();

    // 等待图像详情页面加载
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 检查按钮状态，如有"编辑"则先解除关联
    const editPromptBtn = page.locator(
      `#${Constants.Ids.EDIT_PROMPT_FROM_IMAGE_BTN}`,
    );
    await editPromptBtn.waitFor({ state: "visible", timeout: 1000 });

    const btnText = await editPromptBtn.textContent();

    if (btnText?.includes("编辑")) {
      const unlinkBtn = page.locator(".prompt-ref-unlink").first();
      await expect(unlinkBtn).toBeVisible();
      await unlinkBtn.click();

      await page.waitForSelector(
        `#${Constants.Ids.CONFIRM_MODAL}[style*="flex"]`,
        { timeout: 1000 },
      );
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      await page.waitForFunction(
        (params: { btnTextId: string }) => {
          const text = document.getElementById(params.btnTextId)?.textContent;
          return text === "添加提示词";
        },
        { btnTextId: Constants.Ids.EDIT_PROMPT_BTN_TEXT },
        { timeout: 1000 },
      );
    }

    // 点击"添加提示词"按钮
    await editPromptBtn.click();

    // 等待新建提示词页面加载
    await page.waitForSelector(`#${Constants.Ids.NEW_PROMPT_PAGE}.active`, {
      timeout: 1000,
    });

    // 输入提示词内容
    const testContent = `测试防重复提示 ${Date.now()}`;
    await page.fill(`#${Constants.Ids.NEW_PROMPT_CONTENT}`, testContent);

    // 获取当前提示词数量
    const initialPromptCount = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.length;
    });

    // 在浏览器端快速点击完成按钮多次
    await page.evaluate(
      (params: { doneBtnId: string }) => {
        const doneBtn = document.getElementById(params.doneBtnId);
        if (doneBtn) {
          // 快速连续触发10次点击事件
          for (let i = 0; i < 10; i++) {
            doneBtn.click();
          }
        }
      },
      { doneBtnId: Constants.Ids.NEW_PROMPT_DONE_BTN },
    );

    // 等待页面关闭
    await page.waitForFunction(
      (params: { pageId: string }) => {
        const page = document.getElementById(params.pageId);
        return !page?.classList.contains("active");
      },
      { pageId: Constants.Ids.NEW_PROMPT_PAGE },
      { timeout: 1000 },
    );

    // 验证只创建了一个提示词
    const finalPromptCount = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.length;
    });

    expect(finalPromptCount).toBe(initialPromptCount + 1);

    // 验证只创建了指定内容的提示词
    const createdPrompts = await page.evaluate(
      async (params: { content: string }) => {
        const prompts = await window.electronAPI.getPrompts(
          "createdAt",
          "desc",
        );
        return prompts.filter((p: IPrompt) => p.content === params.content);
      },
      { content: testContent },
    );

    expect(createdPrompts.length).toBe(1);
  });

  test("空内容时不应该创建提示词", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并获取第一个图像
    const firstImage = await enterImageGridView(page);

    // 点击第一个图像打开详情
    await firstImage.click();

    // 等待图像详情页面加载
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 检查按钮状态，如有"编辑"则先解除关联
    const editPromptBtn = page.locator(
      `#${Constants.Ids.EDIT_PROMPT_FROM_IMAGE_BTN}`,
    );
    await editPromptBtn.waitFor({ state: "visible", timeout: 1000 });

    const btnText = await editPromptBtn.textContent();

    if (btnText?.includes("编辑")) {
      const unlinkBtn = page.locator(".prompt-ref-unlink").first();
      await expect(unlinkBtn).toBeVisible();
      await unlinkBtn.click();

      await page.waitForSelector(
        `#${Constants.Ids.CONFIRM_MODAL}[style*="flex"]`,
        { timeout: 1000 },
      );
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      await page.waitForFunction(
        (params: { btnTextId: string }) => {
          const text = document.getElementById(params.btnTextId)?.textContent;
          return text === "添加提示词";
        },
        { btnTextId: Constants.Ids.EDIT_PROMPT_BTN_TEXT },
        { timeout: 1000 },
      );
    }

    // 点击"添加提示词"按钮
    await editPromptBtn.click();

    // 等待新建提示词页面加载
    await page.waitForSelector(`#${Constants.Ids.NEW_PROMPT_PAGE}.active`, {
      timeout: 1000,
    });

    // 获取当前提示词数量
    const initialPromptCount = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.length;
    });

    // 不输入内容，直接点击完成按钮
    const doneButton = page.locator(`#${Constants.Ids.NEW_PROMPT_DONE_BTN}`);
    await doneButton.waitFor({ state: "visible", timeout: 1000 });
    await doneButton.click();

    // 等待页面保持打开状态（验证空内容不会关闭页面）
    await page.waitForFunction(
      (params: { pageId: string }) => {
        const page = document.getElementById(params.pageId);
        return page?.classList.contains("active");
      },
      { pageId: Constants.Ids.NEW_PROMPT_PAGE },
      { timeout: 3000 },
    );

    // 验证页面没有关闭（因为内容为空）
    const isPageActive = await page.evaluate(
      (params: { pageId: string }) => {
        const page = document.getElementById(params.pageId);
        return page?.classList.contains("active");
      },
      { pageId: Constants.Ids.NEW_PROMPT_PAGE },
    );

    expect(isPageActive).toBe(true);

    // 验证提示词数量没有变化
    const finalPromptCount = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.length;
    });

    expect(finalPromptCount).toBe(initialPromptCount);

    // 取消关闭页面
    await page.click(`#${Constants.Ids.NEW_PROMPT_CANCEL_BTN}`);
    await page.waitForFunction(
      (params: { pageId: string }) => {
        const page = document.getElementById(params.pageId);
        return !page?.classList.contains("active");
      },
      { pageId: Constants.Ids.NEW_PROMPT_PAGE },
      { timeout: 1000 },
    );
  });
});
