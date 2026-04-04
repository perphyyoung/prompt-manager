import { test, expect } from '@playwright/test';
import { createElectronTest } from './electron-test.ts';
import type { IElectronAPI, IImage } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 标签拖拽功能 E2E 测试
 * 
 * 测试场景：
 * 1. 通过标签管理器创建测试标签
 * 2. 将标签拖拽到图像卡片
 * 3. 验证标签添加成功
 * 4. 重复拖拽相同标签，验证提示"标签已存在"
 */
test.describe('标签拖拽功能', () => {
  const electronTest = createElectronTest();
  
  // 存储测试用图像的 ID
  let testImageId: string = '';

  test.beforeAll(async () => {
    await electronTest.launch();
    
    // 在开始所有测试前，找到第一张有提示词关联的图像
    const page = electronTest.getPage();
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(500);
    await page.click('#imageGridViewBtn');
    await page.waitForTimeout(500);
    
    // 查找第一个有关联提示词的图像
    const images = await page.evaluate(async () => {
      const allImages = await window.electronAPI.getImages('date', 'desc');
      // 找到第一个有提示词引用的图像
      const imageWithPrompt = allImages.find(img => img.promptRefs && img.promptRefs.length > 0 && img.promptRefs[0].promptContent);
      return imageWithPrompt || allImages[0];
    });
    
    testImageId = String(images.id);
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  /**
   * 进入图像网格视图的辅助函数
   */
  async function enterImageGridView(page: any) {
    // 1. 切换到图像面板
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/refactor/01-image-panel.png' });

    // 2. 确保处于网格视图（点击网格视图按钮）
    const gridViewBtn = page.locator('#imageGridViewBtn');
    await gridViewBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/refactor/02-grid-view.png' });

    // 3. 等待图像卡片加载
    const firstCard = page.locator('.image-card').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/refactor/03-cards-loaded.png' });

    return firstCard;
  }

  test('标签拖拽到卡片功能 - 展开状态', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 使用预先选定的测试图像
    const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
    await expect(targetCard).toBeVisible({ timeout: 5000 });

    // 获取当前图像的标签
    const originalTags = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.tags || [];
    }, testImageId);

    // 确保标签筛选区域展开（检查是否 collapsed）
    const tagFilterSection = page.locator('#imageTagFilterSection');
    const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
    
    if (isCollapsed) {
      // 点击展开按钮
      await page.click('#imageTagFilterToggleBtn');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/refactor/09-tag-filter-expanded.png' });
    }

    // 验证标签筛选区域已展开
    const isContentVisible = await page.locator('#imageTagFilterContent').isVisible();
    expect(isContentVisible).toBe(true);

    // 创建测试标签（通过图像标签管理器添加）
    const testTagName = `e2e_test_tag_${Date.now()}`;
    
    // 1. 打开图像标签管理器
    await page.click('#imageTagManagerBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/refactor/09-tag-manager-opened.png' });
    
    // 2. 点击"新建标签"按钮
    await page.click('#addImageTagInManagerBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/refactor/10-tag-input-dialog.png' });
    
    // 3. 在弹窗中输入标签名称
    const tagInputDialogInput = page.locator('#inputModalField');
    await tagInputDialogInput.fill(testTagName);
    await page.waitForTimeout(100);
    
    // 4. 选择标签组（选择第一个组，即首位组）
    const groupSelect = page.locator('#inputModalGroupSelect');
    await groupSelect.selectOption({ index: 1 }); // 选择第一个非"未分组"的选项
    await page.waitForTimeout(100);
    
    // 5. 点击确认按钮
    const confirmBtn = page.locator('#inputOkBtn');
    await confirmBtn.click();
    await page.waitForTimeout(2000); // 等待标签创建和刷新完成
    await page.screenshot({ path: 'test-results/refactor/11-tag-created.png' });
    
    // 6. 验证标签是否创建成功（通过 API 检查）
    const allTags = await page.evaluate(async () => {
      return await window.electronAPI.getAllTags();
    });
    expect(allTags).toContain(testTagName);
    
    // 7. 关闭标签管理器
    await page.click('#closeImageTagManagerModal');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/refactor/12-manager-closed.png' });
    
    // 8. 确保标签筛选区域展开
    const tagFilterSectionAfterClose = page.locator('#imageTagFilterSection');
    const isCollapsedAfterClose = await tagFilterSectionAfterClose.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
    if (isCollapsedAfterClose) {
      await page.click('#imageTagFilterToggleBtn');
      await page.waitForTimeout(500);
    }
    
    // 9. 验证测试标签已出现在筛选器中（因为标签在首位组，即使计数为 0 也会显示）
    const newTagElement = page.locator(`#imageTagFilterList .tag-filter-item[data-tag="${testTagName}"]`);
    await expect(newTagElement).toBeVisible({ timeout: 5000 });

    // 执行拖拽操作（将测试标签拖拽到目标卡片）
    // 根据 Playwright 官方文档和最佳实践，使用分步鼠标操作更可靠
    // 参考：https://runebook.dev/en/articles/playwright/api/class-locator/locator-drag-to
    
    // 步骤 1: hover 到源标签元素
    await newTagElement.hover();
    await page.waitForTimeout(100);
    
    // 步骤 2: 按下鼠标左键（开始拖拽）
    await page.mouse.down();
    await page.waitForTimeout(100);
    
    // 步骤 3: 移动到目标卡片
    await targetCard.hover();
    await page.waitForTimeout(100);
    
    // 步骤 4: 释放鼠标（完成拖拽）
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'test-results/refactor/11-tag-dropped.png' });

    // 验证标签已添加到目标图像（第一次拖拽应该成功）
    const newTags = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.tags || [];
    }, testImageId);

    expect(newTags.length).toBeGreaterThan(originalTags.length);
    expect(newTags).toContain(testTagName);
    
    // 验证第一次拖拽成功提示
    const toastContainer = page.locator('#toastContainer');
    const toastMessage = await toastContainer.textContent();
    expect(toastMessage).toContain('标签已添加');
    
    // 第二次拖拽相同标签，应该提示"标签已存在"
    await newTagElement.hover();
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await targetCard.hover();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // 验证 toast 提示"标签已存在"
    const toastMessageAfterSecondDrop = await toastContainer.textContent();
    expect(toastMessageAfterSecondDrop).toContain('该标签已存在');
  });
});
