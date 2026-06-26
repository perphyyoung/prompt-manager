import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import {
  test,
  enterPromptDetailView,
  enterImageDetailView,
} from "./electron-test.ts";

/**
 * 测试详情界面标签输入框的各种添加方式
 * 包括：直接回车、点击下拉建议项、下拉框中回车选择、批量添加多个标签
 *
 * 测试顺序：先统一测试图像方面，再测试提示词方面
 */

// 文件级别：创建共享的基础测试数据
test.describe("详情界面标签输入方法", () => {
  // 共享标签名
  let sharedImageTagForClick: string;
  let sharedImageTagForTrigger: string;
  let sharedImageTagsForNav: string[];
  let sharedPromptTagForClick: string;
  let sharedPromptTagForTrigger: string;
  let sharedPromptTagsForNav: string[];

  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();

    // 创建基础图像和提示词（用于进入详情页）
    await factory.createImageFactory().createBatch(1, "detail_view");
    await factory.createPromptFactory().createBatch(1, "detail_view");

    // 创建图像标签
    sharedImageTagForClick =
      electronTest.generateE2ePrefixName("existing_for_click");
    sharedImageTagForTrigger =
      electronTest.generateE2ePrefixName("existing_trigger");
    await factory.createImageFactory().createTag(sharedImageTagForClick);
    await factory.createImageFactory().createTag(sharedImageTagForTrigger);
    sharedImageTagsForNav = await factory
      .createImageFactory()
      .createTags(3, "keyboard_nav");

    // 创建提示词标签
    sharedPromptTagForClick =
      electronTest.generateE2ePrefixName("existing_for_click");
    sharedPromptTagForTrigger =
      electronTest.generateE2ePrefixName("existing_trigger");
    await factory.createPromptFactory().createTag(sharedPromptTagForClick);
    await factory.createPromptFactory().createTag(sharedPromptTagForTrigger);
    sharedPromptTagsForNav = await factory
      .createPromptFactory()
      .createTags(3, "keyboard_nav");

    await electronTest.refreshData();
  });

  /**
   * 在图像详情界面测试：直接回车添加单个标签（无下拉建议）
   */
  test("图像详情界面 - 直接回车添加单个标签（无下拉建议）", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像详情界面
    const { firstImageId } = await enterImageDetailView(page);

    // 生成唯一测试标签名
    const testTagName = electronTest.generateE2ePrefixName("enter_no_dropdown");

    // 在标签输入框输入标签名
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, testTagName);

    // 按回车键添加标签
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

    // 验证标签已添加 - 通过检查输入框被清空
    await page.waitForFunction(
      (inputId: string) => {
        const input = document.getElementById(inputId) as HTMLInputElement;
        return input && input.value === "";
      },
      Constants.Ids.IMAGE_DETAIL_TAG_INPUT,
      { timeout: 1000 },
    );

    // 验证标签显示在标签列表中
    await expect(
      page.locator(
        `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 通过 API 验证标签已关联到当前图像
    const image = await page.evaluate(async (id: string) => {
      return await window.electronAPI.getImageById(id);
    }, firstImageId);

    expect(image?.tags).toContain(testTagName);
  });

  /**
   * 在图像详情界面测试：点击下拉建议项添加标签
   */
  test("图像详情界面 - 点击下拉建议项添加标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像详情界面
    await enterImageDetailView(page);

    // 输入标签名的前缀以触发自动完成
    const prefix = sharedImageTagForClick.slice(0, 8);
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, prefix);

    // 等待下拉框显示
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "visible", timeout: 1000 },
    );

    // 点击下拉建议项
    await page.click(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE} .tag-autocomplete-item[data-tag="${sharedImageTagForClick}"]`,
    );

    // 验证标签已添加
    await expect(
      page.locator(
        `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${sharedImageTagForClick}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证输入框被清空
    const inputValue = await page.inputValue(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
    );
    expect(inputValue).toBe("");
  });

  /**
   * 在图像详情界面测试：使用键盘导航选择下拉建议并回车添加
   */
  test("图像详情界面 - 使用键盘导航选择下拉建议并回车添加", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像详情界面
    await enterImageDetailView(page);

    // 输入共同前缀（使用第一个标签的前16个字符作为前缀）
    const prefix = sharedImageTagsForNav[0].slice(0, 16);

    // 清除输入框
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "");

    // 输入前缀触发自动完成
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, prefix);

    // 等待下拉框显示
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "visible", timeout: 2000 },
    );

    // 获取下拉框中的第二个建议项
    const itemSelector = `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE} .tag-autocomplete-item`;
    const secondItem = await page.locator(itemSelector).nth(1);
    const expectedTag = await secondItem.getAttribute("data-tag");
    expect(expectedTag).not.toBeNull();

    // 按两次向下箭头选择第二个建议
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "ArrowDown");
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "ArrowDown");

    // 按回车选择
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

    // 验证标签已添加（第二个标签）
    await expect(
      page.locator(
        `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${expectedTag}"]`,
      ),
    ).toBeVisible({ timeout: 2000 });

    // 验证输入框被清空
    const inputValue = await page.inputValue(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
    );
    expect(inputValue).toBe("");
  });

  /**
   * 在图像详情界面测试：批量添加多个标签（使用空格分隔）
   */
  test("图像详情界面 - 批量添加多个标签（使用空格分隔）", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像详情界面
    await enterImageDetailView(page);

    // 生成多个测试标签名
    const tag1 = electronTest.generateE2ePrefixName("space_1");
    const tag2 = electronTest.generateE2ePrefixName("space_2");

    // 输入空格分隔的标签
    const inputValue = `${tag1} ${tag2}`;
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, inputValue);

    // 按回车批量添加
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

    // 验证所有标签都已添加
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

    // 验证输入框被清空
    const inputValueAfter = await page.inputValue(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
    );
    expect(inputValueAfter).toBe("");

    // 通过 API 验证所有标签都已保存
    const allTagsExist = await page.evaluate(
      async (tags: string[]) => {
        const allTags = await window.electronAPI.getImageTags();
        return tags.every((tag) => allTags.includes(tag));
      },
      [tag1, tag2],
    );

    expect(allTagsExist).toBe(true);
  });

  /**
   * 在图像详情界面测试：下拉框激活时回车添加当前输入（无选中项）
   */
  test("图像详情界面 - 下拉框激活时回车添加当前输入（无选中项）", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像详情界面
    await enterImageDetailView(page);

    // 生成新标签名（使用相同前缀确保能触发下拉框）
    const newTagName = electronTest.generateE2ePrefixName(
      "existing_trigger_new",
    );

    // 输入现有标签的前缀以触发下拉框
    const prefix = sharedImageTagForTrigger.slice(0, 10);
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, prefix);

    // 等待下拉框显示
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "visible", timeout: 1000 },
    );

    // 按 Escape 清除选中状态
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Escape");
    
    // 输入新标签名（不匹配任何现有标签）
    await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, newTagName);
    
    // 等待下拉框隐藏（因为没有匹配项）
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "hidden", timeout: 1000 },
    );
    
    // 按回车 - 应该批量添加输入的内容
    await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, "Enter");

    // 验证标签已添加
    await expect(
      page.locator(
        `#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${newTagName}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证输入框被清空
    const inputValueAfter = await page.inputValue(
      `#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`,
    );
    expect(inputValueAfter).toBe("");
  });

  /**
   * 在提示词详情界面测试：直接回车添加单个标签（无下拉建议）
   */
  test("提示词详情界面 - 直接回车添加单个标签（无下拉建议）", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词详情界面
    const { firstPromptId } = await enterPromptDetailView(page);

    // 生成唯一测试标签名
    const testTagName = electronTest.generateE2ePrefixName("enter_no_dropdown");

    // 在标签输入框输入标签名
    await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, testTagName);

    // 按回车键添加标签
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

    // 验证标签已添加 - 通过检查输入框被清空
    await page.waitForFunction(
      (inputId: string) => {
        const input = document.getElementById(inputId) as HTMLInputElement;
        return input && input.value === "";
      },
      Constants.Ids.PROMPT_DETAIL_TAGS_INPUT,
      { timeout: 1000 },
    );

    // 验证标签显示在标签列表中
    await expect(
      page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 通过 API 验证标签已关联到当前提示词
    const prompt = await page.evaluate(async (id: string) => {
      return await window.electronAPI.getPromptById(id);
    }, firstPromptId);

    expect(prompt?.tags).toContain(testTagName);
  });

  /**
   * 在提示词详情界面测试：点击下拉建议项添加标签
   */
  test("提示词详情界面 - 点击下拉建议项添加标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词详情界面
    await enterPromptDetailView(page);
    
    // 输入标签名的前缀以触发自动完成
    const prefix = sharedPromptTagForClick.slice(0, 8);
    await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, prefix);

    // 等待下拉框显示
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "visible", timeout: 1000 },
    );

    // 点击下拉建议项
    await page.click(
      `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE} .tag-autocomplete-item[data-tag="${sharedPromptTagForClick}"]`,
    );

    // 验证标签已添加
    await expect(
      page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${sharedPromptTagForClick}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证输入框被清空
    const inputValue = await page.inputValue(
      `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
    );
    expect(inputValue).toBe("");
  });

  /**
   * 在提示词详情界面测试：使用键盘导航选择下拉建议并回车添加
   */
  test("提示词详情界面 - 使用键盘导航选择下拉建议并回车添加", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词详情界面
    await enterPromptDetailView(page);

    // 输入共同前缀以触发自动完成
    const prefix = sharedPromptTagsForNav[0].slice(0, 16);
    await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, prefix);

    // 等待下拉框显示
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "visible", timeout: 2000 },
    );

    // 获取下拉框中的第二个建议项
    const promptItemSelector = `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE} .tag-autocomplete-item`;
    const secondItem = await page.locator(promptItemSelector).nth(1);
    const expectedTag = await secondItem.getAttribute("data-tag");
    expect(expectedTag).not.toBeNull();

    // 按两次向下箭头选择第二个建议
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "ArrowDown");
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "ArrowDown");

    // 按回车选择
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

    // 验证标签已添加（第二个标签）
    await expect(
      page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${expectedTag}"]`,
      ),
    ).toBeVisible({ timeout: 2000 });

    // 验证输入框被清空
    const inputValue = await page.inputValue(
      `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
    );
    expect(inputValue).toBe("");
  });

  /**
   * 在提示词详情界面测试：批量添加多个标签（使用逗号分隔）
   */
  test("提示词详情界面 - 批量添加多个标签（使用逗号分隔）", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词详情界面
    await enterPromptDetailView(page);

    // 生成多个测试标签名
    const tag1 = electronTest.generateE2ePrefixName("batch_1");
    const tag2 = electronTest.generateE2ePrefixName("batch_2");
    const tag3 = electronTest.generateE2ePrefixName("batch_3");

    // 输入逗号分隔的标签
    const inputValue = `${tag1},${tag2}，${tag3}`; // 混合使用英文和中文逗号
    await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, inputValue);

    // 按回车批量添加
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

    // 验证所有标签都已添加
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
    await expect(
      page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag3}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证输入框被清空
    const inputValueAfter = await page.inputValue(
      `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
    );
    expect(inputValueAfter).toBe("");

    // 通过 API 验证所有标签都已保存
    const allTagsExist = await page.evaluate(
      async (tags: string[]) => {
        const allTags = await window.electronAPI.getAllTags();
        return tags.every((tag) => allTags.includes(tag));
      },
      [tag1, tag2, tag3],
    );

    expect(allTagsExist).toBe(true);
  });

  /**
   * 在提示词详情界面测试：下拉框激活时回车添加当前输入（无选中项）
   */
  test("提示词详情界面 - 下拉框激活时回车添加当前输入（无选中项）", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词详情界面
    await enterPromptDetailView(page);

    // 生成新标签名（使用相同前缀确保能触发下拉框）
    const newTagName = electronTest.generateE2ePrefixName(
      "existing_trigger_new",
    );

    // 输入现有标签的前缀以触发下拉框
    const prefix = sharedPromptTagForTrigger.slice(0, 10);
    await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, prefix);

    // 等待下拉框显示
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "visible", timeout: 1000 },
    );

    // 按 Escape 清除选中状态
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Escape");

    // 输入新标签名（不匹配任何现有标签）
    await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, newTagName);

    // 等待下拉框隐藏（因为没有匹配项）
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_DETAIL_TAG_AUTOCOMPLETE}.active`,
      { state: "hidden", timeout: 1000 },
    );

    // 按回车 - 应该批量添加输入的内容
    await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, "Enter");

    // 验证标签已添加
    await expect(
      page.locator(
        `#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${newTagName}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证输入框被清空
    const inputValueAfter = await page.inputValue(
      `#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`,
    );
    expect(inputValueAfter).toBe("");
  });
});
