import { expect } from "@playwright/test";
import {
  test,
  enterImageDetailView,
  enterPromptDetailView,
  enterImageTagManager,
  enterPromptTagManager,
  closeImageTagManager,
  closePromptTagManager,
  createImageTagInManager,
  createPromptTagInManager,
  createImageTagGroup,
  createPromptTagGroup,
  getImageFromDatabase,
  getPromptFromDatabase,
} from "./electron-test.ts";

import { Constants } from "../src/constants.ts";

/**
 * TagService 高级功能 E2E 测试
 * 补充测试 TagService 中未被其他测试文件覆盖的功能：
 * 1. unlinkTagFromItem - 从项目移除标签（详情界面删除标签）
 * 2. 标签存在检查（通过 getImageTags/getAllTags 模拟）
 * 3. 获取组内标签（通过 getImageTagGroups 模拟）
 * 4. parseTagInput - 标签输入解析
 * 5. updated_at 字段更新验证
 */
test.describe("TagService 高级功能测试", () => {
  // ========== 详情界面标签删除测试（unlinkTagFromItem） ==========

  test.describe("详情界面标签删除", () => {
    test("图像详情界面 - 删除已关联的标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart("图像详情界面 - 删除已关联的标签");

      // 1. 进入图像详情界面
      const { firstImageId } = await enterImageDetailView(page);

      // 2. 创建一个测试标签并添加到当前图像
      const testTagName = electronTest.generateE2ePrefixName("detail_unlink");
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, testTagName);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

      // 等待标签添加成功
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 3. 记录当前时间戳（用于后续比较）
      const imageBefore = await getImageFromDatabase(page, firstImageId);
      const updatedAtBefore = imageBefore?.updatedAt;

      // 4. 等待下一秒开始，确保删除操作发生在不同秒
      // （localTime() 只精确到秒，同一秒内操作时间戳相同）
      await page.waitForFunction(
        (beforeTime: string | undefined) => {
          const now = new Date().toLocaleString("zh-CN");
          return now !== beforeTime;
        },
        updatedAtBefore,
        { timeout: 1000 },
      );

      // 5. 点击标签上的删除按钮（X按钮）
      const tagElement = page.locator(
        `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable.tag-removable[data-tag="${testTagName}"]`,
      );
      await expect(tagElement).toBeVisible({ timeout: 1000 });
      const deleteBtn = tagElement.locator(".tag-remove-btn");
      await expect(deleteBtn).toBeVisible({ timeout: 1000 });
      await deleteBtn.click();

      // 6. 等待确认对话框并确认
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 7. 验证标签已从界面移除
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable.tag-removable[data-tag="${testTagName}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });

      // 8. 通过 API 验证标签已从图像移除
      const imageAfter = await getImageFromDatabase(page, firstImageId);
      expect(imageAfter?.tags).not.toContain(testTagName);

      // 9. 验证 updated_at 已更新
      expect(imageAfter?.updatedAt).not.toBe(updatedAtBefore);
    });

    test("提示词详情界面 - 删除已关联的标签", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart("提示词详情界面 - 删除已关联的标签");

      // 1. 进入提示词详情界面
      const { firstPromptId } = await enterPromptDetailView(page);

      // 2. 创建一个测试标签并添加到当前提示词
      const testTagName = electronTest.generateE2ePrefixName("prompt_unlink");
      await page.fill(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
        testTagName,
      );
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

      // 等待标签添加成功
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 3. 记录当前时间戳（用于后续比较）
      const promptBefore = await getPromptFromDatabase(page, firstPromptId);
      const updatedAtBefore = promptBefore?.updatedAt;

      // 4. 等待下一秒开始，确保删除操作发生在不同秒
      // （localTime() 只精确到秒，同一秒内操作时间戳相同）
      await page.waitForFunction(
        (beforeTime: string | undefined) => {
          const now = new Date().toLocaleString("zh-CN");
          return now !== beforeTime;
        },
        updatedAtBefore,
        { timeout: 1000 },
      );

      // 5. 点击标签上的删除按钮（X按钮）
      const tagElement = page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable.tag-removable[data-tag="${testTagName}"]`,
      );
      await expect(tagElement).toBeVisible({ timeout: 1000 });
      const deleteBtn = tagElement.locator(".tag-remove-btn");
      await expect(deleteBtn).toBeVisible({ timeout: 1000 });
      await deleteBtn.click();

      // 6. 等待确认对话框并确认
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 7. 验证标签已从界面移除
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable.tag-removable[data-tag="${testTagName}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });

      // 8. 通过 API 验证标签已从提示词移除
      const promptAfter = await getPromptFromDatabase(page, firstPromptId);
      expect(promptAfter?.tags).not.toContain(testTagName);

      // 9. 验证 updated_at 已更新
      expect(promptAfter?.updatedAt).not.toBe(updatedAtBefore);
    });
  });

  // ========== 标签存在检查测试（通过 API 模拟 tagExists） ==========

  test.describe("标签存在检查", () => {
    test("图像标签 - 检查标签是否存在", async ({ electronTest, page }) => {
      await electronTest.logTestStart("图像标签 - 检查标签是否存在");

      await enterImageTagManager(page);

      // 1. 创建一个测试标签
      const existingTagName = electronTest.generateE2ePrefixName("exists_test");
      await createImageTagInManager(page, existingTagName);

      // 2. 通过 API 检查标签存在性（模拟 tagExists）
      const existsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getImageTags();
        return tags.includes(tagName);
      }, existingTagName);

      expect(existsResult).toBe(true);

      // 3. 检查一个不存在的标签
      const nonExistentTag = electronTest.generateE2ePrefixName("non_existent");
      const notExistsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getImageTags();
        return tags.includes(tagName);
      }, nonExistentTag);

      expect(notExistsResult).toBe(false);

      await closeImageTagManager(page);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("提示词标签 - 检查标签是否存在", async ({ electronTest, page }) => {
      await electronTest.logTestStart("提示词标签 - 检查标签是否存在");

      await enterPromptTagManager(page);

      // 1. 创建一个测试标签
      const existingTagName =
        electronTest.generateE2ePrefixName("prompt_exists");
      await createPromptTagInManager(page, existingTagName);

      // 2. 通过 API 检查标签存在性（模拟 tagExists）
      const existsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(tagName);
      }, existingTagName);

      expect(existsResult).toBe(true);

      // 3. 检查一个不存在的标签
      const nonExistentTag = electronTest.generateE2ePrefixName(
        "prompt_non_existent",
      );
      const notExistsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(tagName);
      }, nonExistentTag);

      expect(notExistsResult).toBe(false);

      await closePromptTagManager(page);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });
  });

  // ========== 获取组内标签测试（通过 API 模拟 getTagsByGroup） ==========

  test.describe("获取组内标签", () => {
    test("图像标签组 - 获取组内所有标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart("图像标签组 - 获取组内所有标签");

      await enterImageTagManager(page);

      // 1. 创建标签组
      const { groupId } = await createImageTagGroup(page, "测试组");

      // 2. 创建多个标签并分配到该组
      const tagName1 = electronTest.generateE2ePrefixName("in_group_1");
      const tagName2 = electronTest.generateE2ePrefixName("in_group_2");

      await createImageTagInManager(page, tagName1, String(groupId));
      await createImageTagInManager(page, tagName2, String(groupId));

      // 3. 通过 API 获取组内标签（模拟 getTagsByGroup）
      const tagsInGroup = await page.evaluate(async (gid: number) => {
        const groups = await window.electronAPI.getImageTagGroups();
        const group = groups.find((g) => g.id === gid);
        return group?.tags || [];
      }, groupId);

      // 4. 验证组内包含创建的标签
      expect(tagsInGroup).toContain(tagName1);
      expect(tagsInGroup).toContain(tagName2);

      await closeImageTagManager(page);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("提示词标签组 - 获取组内所有标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart("提示词标签组 - 获取组内所有标签");

      await enterPromptTagManager(page);

      // 1. 创建标签组
      const { groupId } = await createPromptTagGroup(page, "提示词测试组");

      // 2. 创建多个标签并分配到该组
      const tagName1 = electronTest.generateE2ePrefixName("prompt_in_group_1");
      const tagName2 = electronTest.generateE2ePrefixName("prompt_in_group_2");

      await createPromptTagInManager(page, tagName1, String(groupId));
      await createPromptTagInManager(page, tagName2, String(groupId));

      // 3. 通过 API 获取组内标签（模拟 getTagsByGroup）
      const tagsInGroup = await page.evaluate(async (gid: number) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        const group = groups.find((g) => g.id === gid);
        return group?.tags || [];
      }, groupId);

      // 4. 验证组内包含创建的标签
      expect(tagsInGroup).toContain(tagName1);
      expect(tagsInGroup).toContain(tagName2);

      await closePromptTagManager(page);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });
  });

  // ========== 标签输入解析测试（parseTagInput） ==========

  test.describe("标签输入解析", () => {
    test("图像标签 - 解析多种分隔符的输入", async ({ electronTest, page }) => {
      await electronTest.logTestStart("图像标签 - 解析多种分隔符的输入");

      await enterImageDetailView(page);

      // 测试用例：空格分隔
      const tag1 = electronTest.generateE2ePrefixName("space");
      const tag2 = electronTest.generateE2ePrefixName("space");
      await page.fill(
        `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
        `${tag1} ${tag2}`,
      );
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

      // 验证两个标签都被添加
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("提示词标签 - 解析多种分隔符的输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart("提示词标签 - 解析多种分隔符的输入");

      await enterPromptDetailView(page);

      // 测试用例：英文逗号分隔
      const tag1 = electronTest.generateE2ePrefixName("comma1");
      const tag2 = electronTest.generateE2ePrefixName("comma2");
      await page.fill(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
        `${tag1},${tag2}`,
      );
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

      // 验证两个标签都被添加
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });

    test("图像标签 - 解析中文逗号分隔", async ({ electronTest, page }) => {
      await electronTest.logTestStart("图像标签 - 解析中文逗号分隔");

      await enterImageDetailView(page);

      // 测试用例：中文逗号分隔（图像标签也支持中文逗号）
      const tag1 = electronTest.generateE2ePrefixName("cncomma1");
      const tag2 = electronTest.generateE2ePrefixName("cncomma2");
      await page.fill(
        `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
        `${tag1}，${tag2}`,
      );
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

      // 验证两个标签都被添加
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("提示词标签 - 解析中文逗号分隔", async ({ electronTest, page }) => {
      await electronTest.logTestStart("提示词标签 - 解析中文逗号分隔");

      await enterPromptDetailView(page);

      // 测试用例：中文逗号分隔
      const tag1 = electronTest.generateE2ePrefixName("cncomma1");
      const tag2 = electronTest.generateE2ePrefixName("cncomma2");
      await page.fill(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
        `${tag1}，${tag2}`,
      );
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

      // 验证两个标签都被添加
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });
  });

  // ========== updated_at 更新验证测试 ==========

  test.describe("updated_at 字段更新验证", () => {
    test("图像 - 添加标签时 updated_at 更新", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart("图像 - 添加标签时 updated_at 更新");

      // 1. 进入图像详情界面
      const { firstImageId } = await enterImageDetailView(page);

      // 2. 获取当前 updated_at
      const imageBefore = await getImageFromDatabase(page, firstImageId);
      const updatedAtBefore = imageBefore?.updatedAt;

      // 3. 添加新标签
      const testTagName = electronTest.generateE2ePrefixName("updated_at_test");
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, testTagName);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

      // 等待标签添加成功
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 4. 验证 updated_at 已更新
      const imageAfter = await getImageFromDatabase(page, firstImageId);
      expect(imageAfter?.updatedAt).not.toBe(updatedAtBefore);
      expect(new Date(imageAfter?.updatedAt || "").getTime()).toBeGreaterThan(
        new Date(updatedAtBefore || "").getTime(),
      );

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("提示词 - 添加标签时 updated_at 更新", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart("提示词 - 添加标签时 updated_at 更新");

      // 1. 进入提示词详情界面
      const { firstPromptId } = await enterPromptDetailView(page);

      // 2. 获取当前 updated_at
      const promptBefore = await getPromptFromDatabase(page, firstPromptId);
      const updatedAtBefore = promptBefore?.updatedAt;

      // 3. 添加新标签
      const testTagName =
        electronTest.generateE2ePrefixName("prompt_updated_at");
      await page.fill(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
        testTagName,
      );
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

      // 等待标签添加成功
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 4. 验证 updated_at 已更新
      const promptAfter = await getPromptFromDatabase(page, firstPromptId);
      expect(promptAfter?.updatedAt).not.toBe(updatedAtBefore);
      expect(new Date(promptAfter?.updatedAt || "").getTime()).toBeGreaterThan(
        new Date(updatedAtBefore || "").getTime(),
      );

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });

    test("图像 - 批量添加标签时 updated_at 更新", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart("图像 - 批量添加标签时 updated_at 更新");

      // 1. 进入图像详情界面
      const { firstImageId } = await enterImageDetailView(page);

      // 2. 获取当前 updated_at
      const imageBefore = await getImageFromDatabase(page, firstImageId);
      const updatedAtBefore = imageBefore?.updatedAt;

      // 3. 批量添加多个标签（空格分隔）
      const tag1 = electronTest.generateE2ePrefixName("batch1");
      const tag2 = electronTest.generateE2ePrefixName("batch2");
      const tag3 = electronTest.generateE2ePrefixName("batch3");
      await page.fill(
        `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
        `${tag1} ${tag2} ${tag3}`,
      );
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

      // 等待所有标签添加成功
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 4. 验证 updated_at 已更新
      const imageAfter = await getImageFromDatabase(page, firstImageId);
      expect(imageAfter?.updatedAt).not.toBe(updatedAtBefore);

      // 5. 验证所有标签都已关联
      expect(imageAfter?.tags).toContain(tag1);
      expect(imageAfter?.tags).toContain(tag2);
      expect(imageAfter?.tags).toContain(tag3);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("提示词 - 批量添加标签时 updated_at 更新", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart(
        "提示词 - 批量添加标签时 updated_at 更新",
      );

      // 1. 进入提示词详情界面
      const { firstPromptId } = await enterPromptDetailView(page);

      // 2. 获取当前 updated_at
      const promptBefore = await getPromptFromDatabase(page, firstPromptId);
      const updatedAtBefore = promptBefore?.updatedAt;

      // 3. 批量添加多个标签（逗号分隔）
      const tag1 = electronTest.generateE2ePrefixName("pbatch1");
      const tag2 = electronTest.generateE2ePrefixName("pbatch2");
      await page.fill(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
        `${tag1},${tag2}`,
      );
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

      // 等待所有标签添加成功
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 4. 验证 updated_at 已更新
      const promptAfter = await getPromptFromDatabase(page, firstPromptId);
      expect(promptAfter?.updatedAt).not.toBe(updatedAtBefore);

      // 5. 验证所有标签都已关联
      expect(promptAfter?.tags).toContain(tag1);
      expect(promptAfter?.tags).toContain(tag2);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });
  });
});
