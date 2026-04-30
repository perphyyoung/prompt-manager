import { expect } from "@playwright/test";
import {
  test,
  enterImageTagManager,
  enterPromptTagManager,
  closeImageTagManager,
  closePromptTagManager,
  createImageTagInManager,
  createPromptTagInManager,
  createImageTagsInManagerBatch,
  createPromptTagsInManagerBatch,
  createImageTagGroup,
  createPromptTagGroup,
} from "./electron-test.ts";

import { Constants } from "../src/constants.ts";

/**
 * 标签管理功能 E2E 测试
 *
 * 测试场景：
 * 1. 图像标签管理 - 非批量功能
 *    - 打开/关闭标签管理器
 *    - 新建标签
 *    - 编辑标签（重命名）
 *    - 删除标签
 *    - 搜索标签
 *    - 排序标签
 *    - 新建标签组
 *    - 编辑标签组
 *    - 删除标签组
 * 2. 提示词标签管理 - 非批量功能
 */
test.describe("标签管理功能", () => {
  test.beforeAll(async ({ electronTest }) => {
    await electronTest.createImageTags(7, "shared");
    await electronTest.createPromptTags(7, "shared");
    await electronTest.refreshData();
  });

  test.describe("图像标签管理 - 非批量功能", () => {
    test("打开和关闭标签管理器", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Verify modal is active
      const modal = page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`);
      await expect(modal).toHaveClass(/active/);

      // Verify toolbar elements exist
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`),
      ).toBeVisible();
      await expect(
        page.locator(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`),
      ).toBeVisible();
      await expect(
        page.locator(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`),
      ).toBeVisible();
      await expect(
        page.locator(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`),
      ).toBeVisible();

      await closeImageTagManager(page);

      // Verify modal is hidden
      await expect(modal).not.toHaveClass(/active/);
    });

    test("新建标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      const testTagName = electronTest.generateE2ePrefixName("img_tag");
      await createImageTagInManager(page, testTagName);

      // Verify tag appears in the list
      const tagElement = page.locator(
        `.tag-manager-item[data-tag="${testTagName}"]`,
      );
      await expect(tagElement).toBeVisible({ timeout: 1000 });

      // Verify toast message - 匹配 "成功创建 X 个标签"
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("成功创建")`,
        { timeout: 1000 },
      );

      await closeImageTagManager(page);
    });

    test("编辑标签（重命名）", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Create a test tag first
      const originalTagName = electronTest.generateE2ePrefixName("img_edit");
      await createImageTagInManager(page, originalTagName);

      // Click edit button on the tag (限定在图像标签组卡片容器内)
      const tagItem = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`,
      );
      await expect(tagItem).toBeVisible({ timeout: 1000 });

      const editBtn = tagItem.locator(".tag-edit-btn");
      await editBtn.click();

      // Wait for input dialog
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
        state: "visible",
        timeout: 1000,
      });

      // Rename the tag
      const newTagName = electronTest.generateE2ePrefixName("img_renamed");
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // Wait for rename via API and UI refresh
      await page.waitForFunction(
        async (params: { old: string; new: string }) => {
          const tags = await window.electronAPI.getImageTags();
          return !tags.includes(params.old) && tags.includes(params.new);
        },
        { old: originalTagName, new: newTagName },
        { timeout: 1000 },
      );

      // Verify new tag name appears (限定在图像标签组卡片容器内)
      const renamedTag = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
      );
      await expect(renamedTag).toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已重命名")`,
        { timeout: 1000 },
      );

      await closeImageTagManager(page);
    });

    test("删除标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Create a test tag first
      const testTagName = electronTest.generateE2ePrefixName("img_delete");
      await createImageTagInManager(page, testTagName);

      // Click delete button on the tag
      const tagItem = page.locator(
        `.tag-manager-item[data-tag="${testTagName}"]`,
      );
      await expect(tagItem).toBeVisible({ timeout: 1000 });

      const deleteBtn = tagItem.locator(".tag-delete-btn");
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getImageTags();
          return !tags.includes(name);
        },
        testTagName,
        { timeout: 1000 },
      );

      // Verify tag is removed
      await expect(tagItem).not.toBeVisible({ timeout: 1000 });

      // Verify toast message - 匹配 "图像标签已删除" 或 "提示词标签已删除"
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已删除")`,
        { timeout: 1000 },
      );

      await closeImageTagManager(page);
    });

    test("排序标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Change sort order
      await page.selectOption(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SORT_SELECT}`,
        "name-asc",
      );

      // Toggle sort direction
      await page.click(`#${Constants.Ids.IMAGE_TAG_MANAGER_ORDER_BTN}`);

      // Change back to count sort
      await page.selectOption(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SORT_SELECT}`,
        "count-desc",
      );

      await closeImageTagManager(page);
    });

    test("新建标签组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      const { groupId } = await createImageTagGroup(page, "img_group");

      expect(groupId).toBeTruthy();

      // Verify group appears in the list (限定在图像标签组卡片容器内)
      const groupCard = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupCard).toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已创建")`,
        { timeout: 1000 },
      );

      await closeImageTagManager(page);
    });

    test("编辑标签组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Create a test group first
      const { groupId } = await createImageTagGroup(page, "img_group_edit");

      // Click edit button on the group
      const groupCard = page.locator(
        `.tag-group-card[data-group-id="${groupId}"]`,
      );
      const editBtn = groupCard.locator(".tag-group-btn.edit");
      await editBtn.click();

      // Wait for edit modal
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // Rename the group
      const newGroupName =
        electronTest.generateE2ePrefixName("img_group_renamed");
      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
        newGroupName,
      );
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // Wait for update via API
      await page.waitForFunction(
        async (params: { id: number; name: string }) => {
          const groups = await window.electronAPI.getImageTagGroups();
          const group = groups.find(
            (g: { id: number; name: string }) => g.id === params.id,
          );
          return group?.name === params.name;
        },
        { id: groupId, name: newGroupName },
        { timeout: 1000 },
      );

      // Verify new group name appears
      const renamedGroup = page.locator(
        `.tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(renamedGroup).toContainText(newGroupName);

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已更新")`,
        { timeout: 1000 },
      );

      await closeImageTagManager(page);
    });

    test("删除标签组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Create a test group first
      const { groupId } = await createImageTagGroup(page, "img_group_delete");

      // Click delete button on the group
      const groupCard = page.locator(
        `.tag-group-card[data-group-id="${groupId}"]`,
      );
      const deleteBtn = groupCard.locator(".tag-group-btn.delete");
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(
        async (id: number) => {
          const groups = await window.electronAPI.getImageTagGroups();
          return !groups.some((g: { id: number }) => g.id === id);
        },
        groupId,
        { timeout: 1000 },
      );

      // Verify group is removed
      await expect(groupCard).not.toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已删除")`,
        { timeout: 1000 },
      );

      await closeImageTagManager(page);
    });

    test("搜索并批量删除 e2e 标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // Create multiple e2e test tags with specific keyword
      const searchKeyword = "img_e2e_batch";
      const testTagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const testTagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      // CRITICAL: Create control group that does NOT match search keyword
      const controlTagName = electronTest.generateE2ePrefixName(
        "control_not_deleted",
      );
      await createImageTagsInManagerBatch(page, [
        testTagName1,
        testTagName2,
        controlTagName,
      ]);

      // Search for specific keyword (not just 'e2e')
      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      // Wait for search results to update - verify only matching tags are visible
      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
          return (
            items.length >= 2 &&
            Array.from(items).every((item) =>
              item.getAttribute("data-tag")?.includes(params.keyword),
            )
          );
        },
        {
          containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS,
          keyword: searchKeyword,
        },
        { timeout: 1000 },
      );

      // Click on container to ensure search input loses focus before Ctrl+A
      await page.click(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS}`);

      // Press Ctrl+A to select all visible tags and enter batch mode
      await page.keyboard.press("Control+a");

      // Verify checkboxes appear (batch mode is active)
      const checkboxes = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`,
      );
      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThanOrEqual(2);

      // Verify batch toolbar is visible
      const batchToolbar = page.locator(
        `#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`,
      );
      await expect(batchToolbar).toBeVisible({ timeout: 1000 });

      // CRITICAL: Verify all selected tags contain search keyword before delete
      const selectedTags = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".tag-batch-checkbox:checked"),
        ).map((cb) => cb.getAttribute("data-tag"));
      });
      const unsafeTags = selectedTags.filter(
        (tag) => !tag?.includes(searchKeyword),
      );
      if (unsafeTags.length > 0) {
        throw new Error(
          `安全错误：试图删除非目标标签: ${unsafeTags.join(", ")}`,
        );
      }

      const checkedCount = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox`,
        );
        return Array.from(checkboxes).filter(
          (cb) => (cb as HTMLInputElement).checked,
        ).length;
      }, Constants.Ids.IMAGE_TAG_GROUP_CARDS);
      expect(checkedCount).toBeGreaterThanOrEqual(2);

      // Click delete button
      const deleteBtn = batchToolbar.locator(".batch-action-delete");
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(
        async (names: string[]) => {
          const tags = await window.electronAPI.getImageTags();
          return !tags.includes(names[0]) && !tags.includes(names[1]);
        },
        [testTagName1, testTagName2],
        { timeout: 1000 },
      );

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("已删除")`,
        { timeout: 1000 },
      );

      // CRITICAL: Clear search first, then verify deleted tags don't exist in full list
      await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);

      // Verify e2e tags are removed (in the full list)
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName1}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName2}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });

      // CRITICAL: Verify control group still exists
      await page.waitForFunction(
        (params: { containerId: string; tagName: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
          return Array.from(items).some(
            (item) => item.getAttribute("data-tag") === params.tagName,
          );
        },
        {
          containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS,
          tagName: controlTagName,
        },
        { timeout: 1000 },
      );
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${controlTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);
    });
  });

  test.describe("提示词标签管理 - 非批量功能", () => {
    test("打开和关闭标签管理器", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Verify modal is active
      const modal = page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`);
      await expect(modal).toHaveClass(/active/);

      // Verify toolbar elements exist
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`),
      ).toBeVisible();
      await expect(
        page.locator(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`),
      ).toBeVisible();
      await expect(
        page.locator(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`),
      ).toBeVisible();
      await expect(
        page.locator(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`),
      ).toBeVisible();

      await closePromptTagManager(page);

      // Verify modal is hidden
      await expect(modal).not.toHaveClass(/active/);
    });

    test("新建标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      const testTagName = electronTest.generateE2ePrefixName("prompt_tag");
      await createPromptTagInManager(page, testTagName);

      // Verify tag appears in the list
      const tagElement = page.locator(
        `.tag-manager-item[data-tag="${testTagName}"]`,
      );
      await expect(tagElement).toBeVisible({ timeout: 1000 });

      // Verify toast message - 匹配 "成功创建 X 个标签"
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("成功创建")`,
        { timeout: 1000 },
      );

      await closePromptTagManager(page);
    });

    test("编辑标签（重命名）", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Create a test tag first
      const originalTagName = electronTest.generateE2ePrefixName("prompt_edit");
      await createPromptTagInManager(page, originalTagName);

      // Click edit button on the tag (限定在提示词标签组卡片容器内)
      const tagItem = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`,
      );
      await expect(tagItem).toBeVisible({ timeout: 1000 });

      const editBtn = tagItem.locator(".tag-edit-btn");
      await editBtn.click();

      // Wait for input dialog
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
        state: "visible",
        timeout: 1000,
      });

      // Rename the tag
      const newTagName = electronTest.generateE2ePrefixName("prompt_renamed");
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // Wait for rename via API and UI refresh
      await page.waitForFunction(
        async (params: { old: string; new: string }) => {
          const tags = await window.electronAPI.getAllTags();
          return !tags.includes(params.old) && tags.includes(params.new);
        },
        { old: originalTagName, new: newTagName },
        { timeout: 1000 },
      );

      // Verify new tag name appears (限定在提示词标签组卡片容器内)
      const renamedTag = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
      );
      await expect(renamedTag).toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已重命名")`,
        { timeout: 1000 },
      );

      await closePromptTagManager(page);
    });

    test("删除标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Create a test tag first
      const testTagName = electronTest.generateE2ePrefixName("prompt_delete");
      await createPromptTagInManager(page, testTagName);

      // Click delete button on the tag
      const tagItem = page.locator(
        `.tag-manager-item[data-tag="${testTagName}"]`,
      );
      await expect(tagItem).toBeVisible({ timeout: 1000 });

      const deleteBtn = tagItem.locator(".tag-delete-btn");
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getAllTags();
          return !tags.includes(name);
        },
        testTagName,
        { timeout: 1000 },
      );

      // Verify tag is removed
      await expect(tagItem).not.toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已删除")`,
        { timeout: 1000 },
      );

      await closePromptTagManager(page);
    });

    test("排序标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Change sort order
      await page.selectOption(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SORT_SELECT}`,
        "name-asc",
      );

      // Toggle sort direction
      await page.click(`#${Constants.Ids.PROMPT_TAG_MANAGER_ORDER_BTN}`);

      // Change back to count sort
      await page.selectOption(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SORT_SELECT}`,
        "count-desc",
      );

      await closePromptTagManager(page);
    });

    test("新建标签组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      const { groupId } = await createPromptTagGroup(page, "prompt_group");

      expect(groupId).toBeTruthy();

      // Verify group appears in the list (限定在提示词标签组卡片容器内)
      const groupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupCard).toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已创建")`,
        { timeout: 1000 },
      );

      await closePromptTagManager(page);
    });

    test("编辑标签组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Create a test group first
      const { groupId } = await createPromptTagGroup(page, "prompt_group_edit");

      // Click edit button on the group (限定在提示词标签组卡片容器内)
      const groupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      const editBtn = groupCard.locator(".tag-group-btn.edit");
      await editBtn.click();

      // Wait for edit modal
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // Rename the group
      const newGroupName = electronTest.generateE2ePrefixName(
        "prompt_group_renamed",
      );
      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
        newGroupName,
      );
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // Wait for update via API
      await page.waitForFunction(
        async (params: { id: number; name: string }) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          const group = groups.find(
            (g: { id: number; name: string }) => g.id === params.id,
          );
          return group?.name === params.name;
        },
        { id: groupId, name: newGroupName },
        { timeout: 1000 },
      );

      // Verify new group name appears (限定在提示词标签组卡片容器内)
      const renamedGroup = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(renamedGroup).toContainText(newGroupName);

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已更新")`,
        { timeout: 1000 },
      );

      await closePromptTagManager(page);
    });

    test("删除标签组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Create a test group first
      const { groupId } = await createPromptTagGroup(
        page,
        "prompt_group_delete",
      );

      // Click delete button on the group (限定在提示词标签组卡片容器内)
      const groupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      const deleteBtn = groupCard.locator(".tag-group-btn.delete");
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(
        async (id: number) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          return !groups.some((g: { id: number }) => g.id === id);
        },
        groupId,
        { timeout: 1000 },
      );

      // Verify group is removed (使用相同的限定选择器)
      await expect(groupCard).not.toBeVisible({ timeout: 1000 });

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已删除")`,
        { timeout: 1000 },
      );

      await closePromptTagManager(page);
    });

    test("搜索并批量删除 e2e 标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // Create multiple e2e test tags with specific keyword
      const searchKeyword = "prompt_e2e_batch";
      const testTagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const testTagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      // CRITICAL: Create control group that does NOT match search keyword
      const controlTagName = electronTest.generateE2ePrefixName(
        "control_not_deleted",
      );
      await createPromptTagsInManagerBatch(page, [
        testTagName1,
        testTagName2,
        controlTagName,
      ]);

      // Search for specific keyword (not just 'e2e')
      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      // Wait for search results to update - verify only matching tags are visible
      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
          return (
            items.length >= 2 &&
            Array.from(items).every((item) =>
              item.getAttribute("data-tag")?.includes(params.keyword),
            )
          );
        },
        {
          containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS,
          keyword: searchKeyword,
        },
        { timeout: 1000 },
      );

      // Click on container to ensure search input loses focus before Ctrl+A
      await page.click(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS}`);

      // Press Ctrl+A to select all visible tags and enter batch mode
      await page.keyboard.press("Control+a");

      // Verify checkboxes appear (batch mode is active)
      const checkboxes = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`,
      );
      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThanOrEqual(2);

      // Verify batch toolbar is visible
      const batchToolbar = page.locator(
        `#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`,
      );
      await expect(batchToolbar).toBeVisible({ timeout: 1000 });

      // Verify all checkboxes are checked
      const checkedCount = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox`,
        );
        return Array.from(checkboxes).filter(
          (cb) => (cb as HTMLInputElement).checked,
        ).length;
      }, Constants.Ids.PROMPT_TAG_GROUP_CARDS);
      expect(checkedCount).toBeGreaterThanOrEqual(2);

      // Click delete button
      const deleteBtn = batchToolbar.locator(".batch-action-delete");
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(
        async (names: string[]) => {
          const tags = await window.electronAPI.getAllTags();
          return !tags.includes(names[0]) && !tags.includes(names[1]);
        },
        [testTagName1, testTagName2],
        { timeout: 1000 },
      );

      // Verify toast message
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("已删除")`,
        { timeout: 1000 },
      );

      // CRITICAL: Clear search first, then verify deleted tags don't exist in full list
      await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);

      // Verify e2e tags are removed (in the full list)
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName1}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName2}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });

      // CRITICAL: Verify control group still exists
      await page.waitForFunction(
        (params: { containerId: string; tagName: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
          return Array.from(items).some(
            (item) => item.getAttribute("data-tag") === params.tagName,
          );
        },
        {
          containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS,
          tagName: controlTagName,
        },
        { timeout: 1000 },
      );
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${controlTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);
    });
  });
});
