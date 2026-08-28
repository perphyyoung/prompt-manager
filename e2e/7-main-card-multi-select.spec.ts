import { expect } from "@playwright/test";
import { test } from "./electron-test.ts";
import type { IImage, IPrompt } from "../src/preload/index.ts";
import { Constants } from "../src/renderer/constants.ts";

/**
 * 主界面卡片视图多选功能 E2E 测试
 *
 * 测试场景：
 * 1. 复选框选中/取消选中（图像和提示词）
 * 2. 进入多选模式后复选框一直显示（图像和提示词）
 * 3. 批量工具栏按钮功能（反选、添加标签、收藏、删除、取消选择）（图像和提示词）
 * 4. Ctrl+A 全选（图像和提示词）
 * 5. 批量收藏功能（图像和提示词）
 * 6. 多选后切换视图保留选择状态（提示词）
 */
test.describe("主界面卡片视图多选功能", () => {
  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest, page }) => {
    // 创建测试数据：至少3个图像和3个提示词（用于多选测试）
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(3, "multi_select");
    await factory.createPromptFactory().createBatch(3, "multi_select");

    // 刷新界面以显示新数据
    await electronTest.refreshData();

    // 使用快捷键切换到图像面板并确保在网格视图
    await page.keyboard.press("Control+i");
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
    await page.waitForSelector(`#${Constants.Ids.IMAGE_GRID}`, {
      state: "visible",
      timeout: 1000,
    });
  });

  test.describe("图像面板多选功能", () => {
    test("图像复选框选中后进入多选模式 - 验证点击复选框后显示批量工具栏并进入多选模式", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterImageGridView，因为 beforeAll 已准备好视图
      // 且 enterImageGridView 使用 Ctrl+I 快捷键会关闭批量工具栏
      const firstCard = page.locator(".image-card").first();
      await expect(firstCard).toBeVisible({ timeout: 1000 });

      await firstCard.hover();

      const firstCheckbox = firstCard.locator(".card-checkbox");
      await expect(firstCheckbox).toBeVisible();
      await firstCheckbox.click();

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      const countText = batchToolbar.locator(".batch-toolbar-count");
      await expect(countText).toContainText("1");

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains("selection-mode");
      }, Constants.Ids.IMAGE_GRID);
      expect(hasSelectionMode).toBe(true);
    });

    test("图像多选模式下复选框一直显示 - 验证进入多选模式后复选框始终可见", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterImageGridView，因为 beforeAll 已准备好视图

      const firstCard = page.locator(".image-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const secondCard = page.locator(".image-card").nth(1);
      const secondCheckbox = secondCard.locator(".card-checkbox");
      await expect(secondCheckbox).toBeVisible();
    });

    test("图像批量工具栏 - 反选功能 - 验证反选按钮正确切换选择状态", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterImageGridView，因为 beforeAll 已准备好视图

      const searchInput = page.locator(`#${Constants.Ids.IMAGE_SEARCH_INPUT}`);
      await searchInput.fill("");

      const filterActionBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
      const btnText = await filterActionBtn.textContent();
      if (btnText === "清除筛选") {
        await filterActionBtn.click();
        await page.waitForFunction(
          (btnId) => {
            const btn = document.getElementById(btnId);
            return btn?.textContent === "标签筛选";
          },
          Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN,
          { timeout: 1000 },
        );
      }

      const visibleCards = await page.locator(".image-card").count();

      if (visibleCards < 2) {
        test.skip();
        return;
      }

      const firstCard = page.locator(".image-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);

      // 等待按钮可见且稳定
      const invertBtn = batchToolbar.locator('[data-action="Invert"]');
      await expect(invertBtn).toBeVisible({ timeout: 1000 });
      await invertBtn.click();

      const expectedCount = visibleCards - 1;

      if (expectedCount === 0) {
        await expect(batchToolbar).not.toBeVisible();
      } else {
        await page.waitForFunction(
          ({ count, toolbarId }: { count: number; toolbarId: string }) => {
            const toolbar = document.getElementById(toolbarId);
            const countElement = toolbar?.querySelector(".batch-toolbar-count");
            return countElement?.textContent?.includes(`${count}`);
          },
          {
            count: expectedCount,
            toolbarId: Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR,
          },
          { timeout: 1000 },
        );

        const countText = await batchToolbar.locator(".batch-toolbar-count").textContent();
        expect(countText).toContain(`${expectedCount}`);
      }
    });

    test("图像批量工具栏 - 取消选择功能 - 验证取消按钮清除选择并退出多选模式", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterImageGridView，因为 beforeAll 已准备好视图

      const firstCard = page.locator(".image-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Cancel"]').click();

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains("selection-mode");
      }, Constants.Ids.IMAGE_GRID);
      expect(hasSelectionMode).toBe(false);
    });

    test("图像 Ctrl+A 全选功能 - 验证 Ctrl+A 快捷键全选所有可见图像", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterImageGridView，因为 beforeAll 已准备好视图

      const totalImages = await page.evaluate(async () => {
        const images = await window.electronAPI.getImages("createdAt", "desc");
        return images.filter((img: IImage) => !img.isDeleted).length;
      });

      if (totalImages === 0) {
        test.skip();
        return;
      }

      await page.focus(`#${Constants.Ids.IMAGE_GRID}`);
      await page.keyboard.press("Control+a");

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      await page.waitForFunction(
        ({ count, toolbarId }: { count: number; toolbarId: string }) => {
          const toolbar = document.getElementById(toolbarId);
          const countElement = toolbar?.querySelector(".batch-toolbar-count");
          return countElement?.textContent?.includes(`${count}`);
        },
        {
          count: totalImages,
          toolbarId: Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR,
        },
        { timeout: 1000 },
      );

      const countText = await batchToolbar.locator(".batch-toolbar-count").textContent();
      expect(countText).toContain(`${totalImages}`);

      // 清理：退出批量模式，避免影响后续测试
      await page.keyboard.press("Escape");
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
    });

    test("图像批量收藏功能 - 验证批量收藏按钮切换图像收藏状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 先清除可能遗留的选择状态
      await page.keyboard.press("Escape");
      // 等待批量工具栏消失（如果存在）
      const batchToolbarBefore = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbarBefore.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});

      // 注意：不在此调用 enterImageGridView，因为 beforeAll 已准备好视图

      // 获取第一个图像的ID和当前收藏状态
      const firstCard = page.locator(".image-card").first();
      await expect(firstCard).toBeVisible({ timeout: 1000 });

      // 先获取ID，然后再点击复选框
      const firstImageId = await firstCard.getAttribute("data-id");

      // 记录当前收藏状态（在点击复选框之前）
      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return !!(image as IImage)?.isFavorite;
      }, firstImageId as string);

      await firstCard.hover();
      const firstCheckbox = firstCard.locator(".card-checkbox");
      await expect(firstCheckbox).toBeVisible({ timeout: 1000 });
      await firstCheckbox.click();

      // 点击复选框后立即等待工具栏显示
      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
        timeout: 1000,
      });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Favorite"]').click();

      // 根据 PRD 约束：批量收藏后选中集不变，工具栏保持显示
      // 等待收藏操作完成 - 使用 waitForFunction 检查状态变化
      await page.waitForFunction(
        async (args: { id: string; originalStatus: boolean }) => {
          const image = await window.electronAPI.getImageById(args.id);
          const currentStatus = !!image?.isFavorite;
          return currentStatus !== args.originalStatus;
        },
        { id: firstImageId as string, originalStatus: originalFavoriteStatus },
        { timeout: 1000 },
      );

      // 验证工具栏仍然可见（选中集不变）
      await expect(batchToolbar).toBeVisible();

      // 验证选中数量仍为 1
      const countText = batchToolbar.locator(".batch-toolbar-count");
      await expect(countText).toContainText("1");

      // 验证状态已切换
      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return !!(image as IImage)?.isFavorite;
      }, firstImageId as string);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      // 清理：退出批量模式
      await page.keyboard.press("Escape");
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 });
    });
  });

  test.describe("提示词面板多选功能", () => {
    // 提示词面板测试的初始化：切换到提示词面板并确保在网格视图
    test.beforeAll(async ({ page }) => {
      await page.keyboard.press("Control+p");
      await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.waitForSelector(`#${Constants.Ids.PROMPT_GRID}`, {
        state: "visible",
        timeout: 1000,
      });
    });

    test("提示词复选框选中后进入多选模式 - 验证点击复选框后显示批量工具栏并进入多选模式", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterPromptGridView，因为 beforeAll 已准备好视图
      // 且 enterPromptGridView 使用 Ctrl+P 快捷键会关闭批量工具栏

      const firstCard = page.locator(".prompt-card").first();
      await expect(firstCard).toBeVisible({ timeout: 1000 });

      await firstCard.hover();

      const firstCheckbox = firstCard.locator(".card-checkbox");
      await expect(firstCheckbox).toBeVisible();
      await firstCheckbox.click();

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      const countText = batchToolbar.locator(".batch-toolbar-count");
      await expect(countText).toContainText("1");

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains("selection-mode");
      }, Constants.Ids.PROMPT_GRID);
      expect(hasSelectionMode).toBe(true);
    });

    test("提示词多选模式下复选框一直显示 - 验证进入多选模式后复选框始终可见", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterPromptGridView，因为 beforeAll 已准备好视图

      const firstCard = page.locator(".prompt-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const secondCard = page.locator(".prompt-card").nth(1);
      const secondCheckbox = secondCard.locator(".card-checkbox");
      await expect(secondCheckbox).toBeVisible();
    });

    test("提示词批量工具栏 - 反选功能 - 验证反选按钮正确切换选择状态", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterPromptGridView，因为 beforeAll 已准备好视图

      const searchInput = page.locator(`#${Constants.Ids.PROMPT_SEARCH_INPUT}`);
      await searchInput.fill("");

      const filterActionBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
      const btnText = await filterActionBtn.textContent();
      if (btnText === "清除筛选") {
        await filterActionBtn.click();
        await page.waitForFunction(
          (btnId) => {
            const btn = document.getElementById(btnId);
            return btn?.textContent === "标签筛选";
          },
          Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN,
          { timeout: 1000 },
        );
      }

      const visibleCards = await page.locator(".prompt-card").count();

      if (visibleCards < 2) {
        test.skip();
        return;
      }

      const firstCard = page.locator(".prompt-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      // 等待按钮可见且稳定
      const invertBtn = batchToolbar.locator('[data-action="Invert"]');
      await expect(invertBtn).toBeVisible({ timeout: 1000 });
      await invertBtn.click();

      const expectedCount = visibleCards - 1;

      if (expectedCount === 0) {
        await expect(batchToolbar).not.toBeVisible();
      } else {
        await page.waitForFunction(
          ({ count, toolbarId }: { count: number; toolbarId: string }) => {
            const toolbar = document.getElementById(toolbarId);
            const countElement = toolbar?.querySelector(".batch-toolbar-count");
            return countElement?.textContent?.includes(`${count}`);
          },
          {
            count: expectedCount,
            toolbarId: Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR,
          },
          { timeout: 1000 },
        );

        const countText = await batchToolbar.locator(".batch-toolbar-count").textContent();
        expect(countText).toContain(`${expectedCount}`);
      }
    });

    test("提示词批量工具栏 - 取消选择功能 - 验证取消按钮清除选择并退出多选模式", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterPromptGridView，因为 beforeAll 已准备好视图

      const firstCard = page.locator(".prompt-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Cancel"]').click();

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains("selection-mode");
      }, Constants.Ids.PROMPT_GRID);
      expect(hasSelectionMode).toBe(false);
    });

    test("提示词 Ctrl+A 全选功能 - 验证 Ctrl+A 快捷键全选所有可见提示词", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      // 注意：不在此调用 enterPromptGridView，因为 beforeAll 已准备好视图

      const totalPrompts = await page.evaluate(async () => {
        const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
        return prompts.filter((p: IPrompt) => !p.isDeleted).length;
      });

      if (totalPrompts === 0) {
        test.skip();
        return;
      }

      await page.focus(`#${Constants.Ids.PROMPT_GRID}`);
      await page.keyboard.press("Control+a");

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
      });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      await page.waitForFunction(
        ({ count, toolbarId }: { count: number; toolbarId: string }) => {
          const toolbar = document.getElementById(toolbarId);
          const countElement = toolbar?.querySelector(".batch-toolbar-count");
          return countElement?.textContent?.includes(`${count}`);
        },
        {
          count: totalPrompts,
          toolbarId: Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR,
        },
        { timeout: 1000 },
      );

      const countText = await batchToolbar.locator(".batch-toolbar-count").textContent();
      expect(countText).toContain(`${totalPrompts}`);

      // 清理：退出批量模式，避免影响后续测试
      await page.keyboard.press("Escape");
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
    });

    test("提示词批量收藏功能 - 验证批量收藏按钮切换提示词收藏状态", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 注意：不在此调用 enterPromptGridView，因为 beforeAll 已准备好视图

      const firstCard = page.locator(".prompt-card").first();
      await expect(firstCard).toBeVisible({ timeout: 1000 });

      // 先获取ID，然后再点击复选框
      const firstPromptId = await firstCard.getAttribute("data-id");

      // 记录当前收藏状态（在点击复选框之前）
      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return !!prompt?.isFavorite;
      }, firstPromptId as string);

      await firstCard.hover();
      const firstCheckbox = firstCard.locator(".card-checkbox");
      await expect(firstCheckbox).toBeVisible({ timeout: 1000 });
      await firstCheckbox.click();

      // 点击复选框后立即等待工具栏显示
      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, {
        state: "visible",
        timeout: 1000,
      });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      // 等待按钮可见且稳定
      const favoriteBtn = batchToolbar.locator('[data-action="Favorite"]');
      await expect(favoriteBtn).toBeVisible({ timeout: 1000 });
      await favoriteBtn.click();

      // 根据 PRD 约束：批量收藏后选中集不变，工具栏保持显示
      // 等待收藏操作完成 - 使用 waitForFunction 检查状态变化
      await page.waitForFunction(
        async (args: { id: string; originalStatus: boolean }) => {
          const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
          const prompt = prompts.find((p: IPrompt) => String(p.id) === args.id);
          const currentStatus = !!prompt?.isFavorite;
          return currentStatus !== args.originalStatus;
        },
        { id: firstPromptId as string, originalStatus: originalFavoriteStatus },
        { timeout: 1000 },
      );

      // 验证工具栏仍然可见（选中集不变）
      await expect(batchToolbar).toBeVisible();

      // 验证选中数量仍为 1
      const countText = batchToolbar.locator(".batch-toolbar-count");
      await expect(countText).toContainText("1");

      // 验证状态已切换
      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return !!prompt?.isFavorite;
      }, firstPromptId as string);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      // 清理：退出批量模式
      await page.keyboard.press("Escape");
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 });
    });
  });
});
