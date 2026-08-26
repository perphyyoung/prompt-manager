import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import {
  test,
  enterImageGridView,
  enterPromptGridView,
  openImageDetail,
  openPromptDetail,
} from "./electron-test.ts";

test.describe("Esc 键快捷键功能", () => {
  // ========== 初始化和清理 ==========
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(3, "esc");
    await factory.createPromptFactory().createBatch(3, "esc");
    await factory.createImageFactory().createTag("e2e_esc_autocomplete");
    await factory.createPromptFactory().createTag("e2e_esc_autocomplete");

    await electronTest.refreshData();
  });

  // ========== Esc 关闭统计视图 ==========
  test.describe("Esc 关闭统计视图", () => {
    test("图像面板 - Esc 关闭统计视图", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);
      await page.click(`#${Constants.Ids.STATISTICS_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.STATISTICS_MODAL}.active`, {
        timeout: 1000,
      });

      const statisticsModal = page.locator(
        `#${Constants.Ids.STATISTICS_MODAL}`,
      );
      await expect(statisticsModal).toHaveClass(/active/);

      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.STATISTICS_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      await expect(statisticsModal).not.toHaveClass(/active/);
    });

    test("提示词面板 - Esc 关闭统计视图", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);
      await page.click(`#${Constants.Ids.STATISTICS_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.STATISTICS_MODAL}.active`, {
        timeout: 1000,
      });

      const statisticsModal = page.locator(
        `#${Constants.Ids.STATISTICS_MODAL}`,
      );
      await expect(statisticsModal).toHaveClass(/active/);

      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.STATISTICS_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      await expect(statisticsModal).not.toHaveClass(/active/);
    });
  });

  test.describe("Esc 关闭设置视图", () => {
    test("图像面板 - Esc 关闭设置视图", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);
      await page.click(`#${Constants.Ids.SETTINGS_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.SETTINGS_MODAL}.active`, {
        timeout: 1000,
      });

      const settingsModal = page.locator(`#${Constants.Ids.SETTINGS_MODAL}`);
      await expect(settingsModal).toHaveClass(/active/);

      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.SETTINGS_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      await expect(settingsModal).not.toHaveClass(/active/);
    });

    test("提示词面板 - Esc 关闭设置视图", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);
      await page.click(`#${Constants.Ids.SETTINGS_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.SETTINGS_MODAL}.active`, {
        timeout: 1000,
      });

      const settingsModal = page.locator(`#${Constants.Ids.SETTINGS_MODAL}`);
      await expect(settingsModal).toHaveClass(/active/);

      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.SETTINGS_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      await expect(settingsModal).not.toHaveClass(/active/);
    });
  });

  test.describe("Esc 关闭详情视图", () => {
    test("图像面板 - Esc 关闭图像详情视图", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);
      await openImageDetail(page);

      const detailModal = page.locator(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`);
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      await expect(detailModal).not.toHaveClass(/active/);
    });

    test("提示词面板 - Esc 关闭提示词详情视图", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);
      await openPromptDetail(page);

      const detailModal = page.locator(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`);
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      await expect(detailModal).not.toHaveClass(/active/);
    });
  });

  test.describe("Esc 清除主界面批量选择", () => {
    test("图像面板 - Esc 清除批量选择", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);

      const firstCard = page.locator(".image-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_GRID}.selection-mode`,
        {
          timeout: 1000,
        },
      );

      const batchToolbar = page.locator(".batch-toolbar.visible");
      await expect(batchToolbar).toBeVisible();

      await page.keyboard.press("Escape");
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_GRID}.selection-mode`,
        {
          state: "detached",
          timeout: 1000,
        },
      );

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate((gridId) => {
        const container = document.getElementById(gridId);
        return container?.classList.contains("selection-mode");
      }, Constants.Ids.IMAGE_GRID);
      expect(hasSelectionMode).toBe(false);
    });

    test("提示词面板 - Esc 清除批量选择", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);

      const firstCard = page.locator(".prompt-card").first();
      await firstCard.hover();
      await firstCard.locator(".card-checkbox").click();
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_GRID}.selection-mode`,
        {
          timeout: 1000,
        },
      );

      const batchToolbar = page.locator(".batch-toolbar.visible");
      await expect(batchToolbar).toBeVisible();

      await page.keyboard.press("Escape");
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_GRID}.selection-mode`,
        {
          state: "detached",
          timeout: 1000,
        },
      );

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate((gridId) => {
        const container = document.getElementById(gridId);
        return container?.classList.contains("selection-mode");
      }, Constants.Ids.PROMPT_GRID);
      expect(hasSelectionMode).toBe(false);
    });
  });

  // ==================== 对话框功能测试（独立于面板）====================

  test("Esc 关闭对话框", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    await enterImageGridView(page);

    const firstCard = page.locator(".image-card").first();
    await firstCard.hover();
    await firstCard.locator(".card-checkbox").click();
    await page.waitForSelector(".batch-toolbar.visible", {
      state: "visible",
      timeout: 1000,
    });

    const batchToolbar = page.locator(".batch-toolbar.visible");
    const deleteBtn = batchToolbar.locator('[data-action="Delete"]');
    await deleteBtn.click();
    await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
      state: "visible",
      timeout: 1000,
    });

    const confirmModalVisible = await page.evaluate((modalId) => {
      const modal = document.getElementById(modalId);
      return modal && modal.style.display !== "none";
    }, Constants.Ids.CONFIRM_MODAL);
    expect(confirmModalVisible).toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    const confirmModalHidden = await page.evaluate((modalId) => {
      const modal = document.getElementById(modalId);
      return !modal || modal.style.display === "none";
    }, Constants.Ids.CONFIRM_MODAL);
    expect(confirmModalHidden).toBe(true);

    await expect(batchToolbar).toBeVisible();
  });

  // ==================== 回收站功能测试（独立于面板）====================

  test.describe("Esc 关闭回收站视图", () => {
    test("图像回收站 - Esc 关闭回收站视图", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);
      await page.click(`#${Constants.Ids.IMAGE_TRASH_BTN}`);
      await page.waitForFunction(
        (modalId) => {
          const modal = document.getElementById(modalId);
          return modal && modal.style.display !== "none";
        },
        Constants.Ids.IMAGE_TRASH_MODAL,
        { timeout: 1000 },
      );
      const trashModalVisible = await page.evaluate((modalId) => {
        const modal = document.getElementById(modalId);
        return modal && modal.style.display !== "none";
      }, Constants.Ids.IMAGE_TRASH_MODAL);
      expect(trashModalVisible).toBe(true);

      await page.keyboard.press("Escape");
      await page.waitForFunction(
        (modalId) => {
          const modal = document.getElementById(modalId);
          return !modal || modal.style.display === "none";
        },
        Constants.Ids.IMAGE_TRASH_MODAL,
        { timeout: 1000 },
      );

      const trashModalHidden = await page.evaluate((modalId) => {
        const modal = document.getElementById(modalId);
        return !modal || modal.style.display === "none";
      }, Constants.Ids.IMAGE_TRASH_MODAL);
      expect(trashModalHidden).toBe(true);
    });

    test("提示词回收站 - Esc 关闭回收站视图", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);
      await page.click(`#${Constants.Ids.PROMPT_TRASH_BTN}`);
      await page.waitForFunction(
        (modalId) => {
          const modal = document.getElementById(modalId);
          return modal && modal.style.display !== "none";
        },
        Constants.Ids.PROMPT_TRASH_MODAL,
        { timeout: 1000 },
      );

      const trashModalVisible = await page.evaluate((modalId) => {
        const modal = document.getElementById(modalId);
        return modal && modal.style.display !== "none";
      }, Constants.Ids.PROMPT_TRASH_MODAL);
      expect(trashModalVisible).toBe(true);

      await page.keyboard.press("Escape");
      await page.waitForFunction(
        (modalId) => {
          const modal = document.getElementById(modalId);
          return !modal || modal.style.display === "none";
        },
        Constants.Ids.PROMPT_TRASH_MODAL,
        { timeout: 1000 },
      );

      const trashModalHidden = await page.evaluate((modalId) => {
        const modal = document.getElementById(modalId);
        return !modal || modal.style.display === "none";
      }, Constants.Ids.PROMPT_TRASH_MODAL);
      expect(trashModalHidden).toBe(true);
    });
  });

  // ==================== 图像特有功能测试 ====================

  test("Esc 关闭全屏查看器", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    await enterImageGridView(page);
    await openImageDetail(page);

    const image = page.locator(`#${Constants.Ids.IMAGE_DETAIL_IMG}`);
    await image.dblclick();
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_FULLSCREEN_VIEWER}.active`,
      {
        timeout: 1000,
      },
    );

    const fullscreenViewer = page.locator(
      `#${Constants.Ids.IMAGE_FULLSCREEN_VIEWER}`,
    );
    await expect(fullscreenViewer).toHaveClass(/active/);

    await page.keyboard.press("Escape");
    await page.waitForSelector(`#${Constants.Ids.IMAGE_FULLSCREEN_VIEWER}`, {
      state: "hidden",
      timeout: 1000,
    });

    await expect(fullscreenViewer).not.toHaveClass(/active/);

    const detailModal = page.locator(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`);
    await expect(detailModal).toHaveClass(/active/);
  });

  // ==================== 自动完成功能测试（同时测试图像和提示词）====================

  test.describe("Esc 关闭标签自动完成下拉", () => {
    test("图像详情 - Esc 关闭标签自动完成下拉", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);
      await openImageDetail(page);

      // 使用测试标签的前缀触发自动完成
      const tagInput = page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`);
      await tagInput.click();
      await tagInput.fill("e2e");

      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE}.active`,
        { timeout: 1000 },
      );

      const autocompleteDropdown = page.locator(
        `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE}`,
      );
      const isVisible = await autocompleteDropdown.evaluate((el: HTMLElement) =>
        el.classList.contains("active"),
      );
      expect(isVisible).toBe(true);

      await page.keyboard.press("Escape");
      await page.waitForFunction(
        (dropdownId) => {
          const dropdown = document.getElementById(dropdownId);
          return !dropdown?.classList.contains("active");
        },
        Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE,
        { timeout: 1000 },
      );

      const isHidden = await autocompleteDropdown.evaluate(
        (el: HTMLElement) => !el.classList.contains("active"),
      );
      expect(isHidden).toBe(true);

      const detailModal = page.locator(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`);
      await expect(detailModal).toHaveClass(/active/);

      // 关闭详情界面
      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });
    });

    test("提示词详情 - Esc 关闭标签自动完成下拉", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);
      await openPromptDetail(page);

      const tagInput = page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
      );
      await tagInput.click();
      await tagInput.fill("e2e");

      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE}.active`,
        { timeout: 1000 },
      );

      const autocompleteDropdown = page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE}`,
      );
      const isVisible = await autocompleteDropdown.evaluate((el: HTMLElement) =>
        el.classList.contains("active"),
      );
      expect(isVisible).toBe(true);

      await page.keyboard.press("Escape");
      await page.waitForFunction(
        (dropdownId) => {
          const dropdown = document.getElementById(dropdownId);
          return !dropdown?.classList.contains("active");
        },
        Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE,
        { timeout: 1000 },
      );

      const isHidden = await autocompleteDropdown.evaluate(
        (el: HTMLElement) => !el.classList.contains("active"),
      );
      expect(isHidden).toBe(true);

      const detailModal = page.locator(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`);
      await expect(detailModal).toHaveClass(/active/);

      // 关闭详情界面
      await page.keyboard.press("Escape");
      await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });
    });
  });
});
