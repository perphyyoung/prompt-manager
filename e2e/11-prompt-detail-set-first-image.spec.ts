import { test, expect } from '@playwright/test';
import {
  createElectronTest,
  getPromptFromDatabase,
  getDisplayedImageIds,
  rightClickAndSetAsFirst,
  findPromptWithImageCount,
  openPromptDetailById
} from './electron-test.ts';
import type { IElectronAPI } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 等待图像顺序变化为目标顺序
 * @param page - Playwright page 对象
 * @param expectedFirstId - 期望的首张图像ID
 * @param timeout - 超时时间
 */
async function waitForImageOrderChange(
  page: any,
  expectedFirstId: string,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    (expectedId: string) => {
      const items = document.querySelectorAll('#imagePreviewList .image-preview-item');
      if (items.length === 0) return false;
      const firstId = items[0]?.getAttribute('data-image-id');
      return firstId === expectedId;
    },
    expectedFirstId,
    { timeout }
  );
}

/**
 * 等待数据库中的图像顺序更新
 * @param page - Playwright page 对象
 * @param promptId - 提示词ID
 * @param expectedFirstId - 期望的首张图像ID
 * @param timeout - 超时时间
 */
async function waitForDatabaseImageOrder(
  page: any,
  promptId: string,
  expectedFirstId: string,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    async (params: { promptId: string; expectedId: string }) => {
      const prompt = await window.electronAPI.getPromptById(params.promptId);
      if (!prompt || !prompt.images || prompt.images.length === 0) return false;
      return prompt.images[0]?.id === params.expectedId;
    },
    { promptId, expectedId: expectedFirstId },
    { timeout }
  );
}

/**
 * 提示词详情界面"设为首张"功能 E2E 测试
 *
 * 测试目标：验证右键菜单中的"设为首张"功能正常工作
 *
 * 测试分组（按图像数量要求）：
 * 1. 空图像测试组（0张图像）
 * 2. 单图像测试组（1张图像）
 * 3. 双图像测试组（≥2张图像）
 * 4. 三图像测试组（≥3张图像）
 */
test.describe('提示词详情界面"设首张"功能', () => {
  const electronTest = createElectronTest();

  test.beforeAll(async () => {
    await electronTest.launch();
  });

  test.afterEach(async () => {
    await electronTest.cleanupAndReset();
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  // ========== 空图像测试组（0张图像）==========

  test('空图像：验证界面正常显示无错误', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('空图像：验证界面正常显示无错误');

    // 查找无图像的提示词
    const promptId = await findPromptWithImageCount(page, 0, 0);
    expect(promptId, '需要至少1个无图像的提示词').not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 验证图像预览列表为空
    const imageIds = await getDisplayedImageIds(page);
    expect(imageIds.length).toBe(0);

    // 验证页面没有报错
    const errorElements = await page.$$('.error-message');
    expect(errorElements.length).toBe(0);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/01-empty-image-list.png' });
  });

  // ========== 单图像测试组（1张图像）==========

  test('单图像：首张图像右键不显示菜单', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('单图像：首张图像右键不显示菜单');

    // 查找只有1张图像的提示词
    const promptId = await findPromptWithImageCount(page, 1, 1);
    expect(promptId, '需要至少1个只有1张图像的提示词').not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取数据库中的提示词信息
    const dbPrompt = await getPromptFromDatabase(page, promptId!);
    expect(dbPrompt).toBeTruthy();
    expect(dbPrompt!.images?.length).toBe(1);

    // 获取首张图像ID
    const imageIds = await getDisplayedImageIds(page);
    const firstImageId = imageIds[0];

    // 右键点击首张图像
    const firstImageItem = page.locator(`#imagePreviewList .image-preview-item[data-image-id="${firstImageId}"]`);
    await firstImageItem.click({ button: 'right' });

    // 验证右键菜单没有显示（首张图像不显示菜单）
    // 使用 waitForFunction 轮询检查菜单状态，而不是固定等待
    await page.waitForFunction(() => {
      const menu = document.querySelector('.context-menu');
      // 菜单不存在，或者 display 不是 block，都视为未显示
      return !(menu && (menu as HTMLElement).style.display === 'block');
    }, { timeout: 2000 });

    // 再次验证菜单确实没有显示
    const menuVisible = await page.evaluate(() => {
      const menu = document.querySelector('.context-menu');
      return menu && (menu as HTMLElement).style.display === 'block';
    });
    expect(menuVisible).toBe(false);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/02-single-image-no-menu.png' });
  });

  // ========== 双图像测试组（≥2张图像）==========

  test('双图像：右键点击第二张图像并设为首张', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：右键点击第二张图像并设为首张');

    // 查找有≥2张图像的提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId, '需要至少1个有2张及以上图像的提示词').not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取当前显示的图像ID列表
    const beforeImageIds = await getDisplayedImageIds(page);
    expect(beforeImageIds.length).toBeGreaterThanOrEqual(2);

    // 记录第二张图像的ID（将被设为首张）
    const secondImageId = beforeImageIds[1];

    // 截图：操作前
    await page.screenshot({ path: 'test-results/set-first-image/03-before-set-first.png' });

    // 右键点击第二张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, secondImageId);

    // 等待图像顺序变化（显式等待，而非固定等待）
    await waitForImageOrderChange(page, secondImageId);

    // 获取操作后的图像ID列表
    const afterImageIds = await getDisplayedImageIds(page);

    // 验证第二张图像已移动到首位
    expect(afterImageIds[0]).toBe(secondImageId);

    // 验证图像总数不变
    expect(afterImageIds.length).toBe(beforeImageIds.length);

    // 截图：操作后
    await page.screenshot({ path: 'test-results/set-first-image/04-after-set-first.png' });
  });

  test('双图像：最后一张图像设为首张', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：最后一张图像设为首张');

    // 复用同一个提示词（已在上一测试中找到）
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取当前显示的图像ID列表
    const beforeImageIds = await getDisplayedImageIds(page);
    const lastImageId = beforeImageIds[beforeImageIds.length - 1];

    // 右键点击最后一张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, lastImageId);

    // 等待图像顺序变化
    await waitForImageOrderChange(page, lastImageId);

    // 获取操作后的图像ID列表
    const afterImageIds = await getDisplayedImageIds(page);

    // 验证最后一张图像已移动到首位
    expect(afterImageIds[0]).toBe(lastImageId);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/05-last-image-to-first.png' });
  });

  test('双图像：设为首张后刷新页面验证顺序保持', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：设为首张后刷新页面验证顺序保持');

    // 复用同一个提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取当前显示的图像ID列表
    const beforeImageIds = await getDisplayedImageIds(page);
    const targetImageId = beforeImageIds[1];

    // 右键点击第二张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, targetImageId);

    // 等待图像顺序变化
    await waitForImageOrderChange(page, targetImageId);

    // 获取操作后的图像ID列表
    const afterSetFirstIds = await getDisplayedImageIds(page);
    expect(afterSetFirstIds[0]).toBe(targetImageId);

    // 关闭详情模态框
    await page.click('#promptDetailCloseBtn');
    await page.waitForSelector('#promptDetailModal', { state: 'hidden', timeout: 5000 });

    // 重新打开同一个提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取重新打开后的图像ID列表
    const afterReopenIds = await getDisplayedImageIds(page);

    // 验证顺序保持一致
    expect(afterReopenIds[0]).toBe(targetImageId);
    expect(afterReopenIds).toEqual(afterSetFirstIds);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/06-persist-after-reopen.png' });
  });

  test('双图像：检查数据库中images字段正确更新', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：检查数据库中images字段正确更新');

    // 复用同一个提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取数据库中的原始图像顺序
    const dbPromptBefore = await getPromptFromDatabase(page, promptId!);
    expect(dbPromptBefore).toBeTruthy();
    const dbImageIdsBefore = dbPromptBefore!.images?.map((img) => String(img.id)) || [];
    const targetImageId = dbImageIdsBefore[1];

    // 右键点击第二张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, targetImageId);

    // 等待数据库中的顺序更新（显式等待）
    await waitForDatabaseImageOrder(page, promptId!, targetImageId);

    // 重新从数据库获取提示词信息
    const dbPromptAfter = await getPromptFromDatabase(page, promptId!);
    expect(dbPromptAfter).toBeTruthy();

    // 获取数据库中的新图像顺序
    const dbImageIdsAfter = dbPromptAfter!.images?.map((img) => String(img.id)) || [];

    // 验证数据库中的顺序已更新
    expect(dbImageIdsAfter[0]).toBe(targetImageId);

    // 验证图像总数不变
    expect(dbImageIdsAfter.length).toBe(dbImageIdsBefore.length);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/07-database-updated.png' });
  });

  test('双图像：右键菜单正常显示', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：右键菜单正常显示');

    // 复用同一个提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取第二张图像ID
    const imageIds = await getDisplayedImageIds(page);
    const secondImageId = imageIds[1];

    // 右键点击第二张图像
    const secondImageItem = page.locator(`#imagePreviewList .image-preview-item[data-image-id="${secondImageId}"]`);
    await secondImageItem.click({ button: 'right' });

    // 等待右键菜单显示（使用特定菜单项选择器来定位图像右键菜单）
    await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', { state: 'visible', timeout: 5000 });

    // 验证菜单项存在
    const menuItem = await page.$('.context-menu-item[data-item-id="setAsFirst"]');
    expect(menuItem).not.toBeNull();

    // 验证菜单项文本
    const menuText = await page.evaluate(() => {
      const item = document.querySelector('.context-menu-item[data-item-id="setAsFirst"] .context-menu-label');
      return item?.textContent || '';
    });
    expect(menuText).toBe('设为首张');

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/08-context-menu-display.png' });

    // 关闭菜单（点击其他地方）
    await page.click('#promptDetailModal');
    await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', { state: 'hidden', timeout: 5000 });
  });

  test('双图像：菜单项点击响应正常', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：菜单项点击响应正常');

    // 复用同一个提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取第二张图像ID
    const imageIds = await getDisplayedImageIds(page);
    const secondImageId = imageIds[1];

    // 右键点击第二张图像
    const secondImageItem = page.locator(`#imagePreviewList .image-preview-item[data-image-id="${secondImageId}"]`);
    await secondImageItem.click({ button: 'right' });

    // 等待右键菜单显示（使用特定菜单项选择器来定位图像右键菜单）
    await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', { state: 'visible', timeout: 5000 });

    // 点击菜单项
    await page.click('.context-menu-item[data-item-id="setAsFirst"]');

    // 验证菜单消失
    await page.waitForSelector('.context-menu-item[data-item-id="setAsFirst"]', { state: 'hidden', timeout: 5000 });

    // 等待图像顺序变化
    await waitForImageOrderChange(page, secondImageId);

    // 验证图像顺序已改变
    const afterImageIds = await getDisplayedImageIds(page);
    expect(afterImageIds[0]).toBe(secondImageId);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/09-menu-click-response.png' });
  });

  test('双图像：验证currentImagesCache正确更新', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：验证currentImagesCache正确更新');

    // 复用同一个提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取当前显示的图像ID列表
    const beforeImageIds = await getDisplayedImageIds(page);
    const targetImageId = beforeImageIds[1];

    // 右键点击第二张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, targetImageId);

    // 等待图像顺序变化
    await waitForImageOrderChange(page, targetImageId);

    // 通过API获取缓存中的图像顺序
    const cacheImageIds = await page.evaluate(() => {
      const cache = (window as any).app?.currentImagesCache;
      if (!cache) return [];
      return Array.from(cache.values()).map((img: any) => String(img.id));
    });

    // 获取界面显示的图像顺序
    const uiImageIds = await getDisplayedImageIds(page);

    // 验证缓存与界面显示一致
    expect(cacheImageIds[0]).toBe(targetImageId);
    expect(cacheImageIds).toEqual(uiImageIds);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/10-cache-consistency.png' });
  });

  test('双图像：验证缓存与数据库数据一致', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('双图像：验证缓存与数据库数据一致');

    // 复用同一个提示词
    const promptId = await findPromptWithImageCount(page, 2);
    expect(promptId).not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取当前显示的图像ID列表
    const beforeImageIds = await getDisplayedImageIds(page);
    const targetImageId = beforeImageIds[1];

    // 右键点击第二张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, targetImageId);

    // 等待数据库中的顺序更新
    await waitForDatabaseImageOrder(page, promptId!, targetImageId);

    // 通过API获取缓存中的图像顺序
    const cacheImageIds = await page.evaluate(() => {
      const cache = (window as any).app?.currentImagesCache;
      if (!cache) return [];
      return Array.from(cache.values()).map((img: any) => String(img.id));
    });

    // 重新从数据库获取提示词信息
    const dbPromptAfter = await getPromptFromDatabase(page, promptId!);
    expect(dbPromptAfter).toBeTruthy();

    // 获取数据库中的图像顺序
    const dbImageIds = dbPromptAfter!.images?.map((img) => String(img.id)) || [];

    // 验证缓存与数据库一致
    expect(cacheImageIds).toEqual(dbImageIds);
    expect(cacheImageIds[0]).toBe(targetImageId);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/11-cache-database-consistency.png' });
  });

  // ========== 三图像测试组（≥3张图像）==========

  test('三图像：验证其他图像顺序正确调整', async () => {
    const page = electronTest.getPage();
    await electronTest.logTestStart('三图像：验证其他图像顺序正确调整');

    // 查找有≥3张图像的提示词
    const promptId = await findPromptWithImageCount(page, 3);
    expect(promptId, '需要至少1个有3张及以上图像的提示词').not.toBeNull();

    // 打开提示词详情
    await openPromptDetailById(page, promptId!);

    // 获取当前显示的图像ID列表
    const beforeImageIds = await getDisplayedImageIds(page);
    expect(beforeImageIds.length).toBeGreaterThanOrEqual(3);

    // 记录原始顺序
    const originalFirstId = beforeImageIds[0];
    const targetImageId = beforeImageIds[2]; // 第三张图像

    // 右键点击第三张图像并选择"设为首张"
    await rightClickAndSetAsFirst(page, targetImageId);

    // 等待图像顺序变化
    await waitForImageOrderChange(page, targetImageId);

    // 获取操作后的图像ID列表
    const afterImageIds = await getDisplayedImageIds(page);

    // 验证第三张图像已移动到首位
    expect(afterImageIds[0]).toBe(targetImageId);

    // 验证原来的首张图像移动到了第二位
    expect(afterImageIds[1]).toBe(originalFirstId);

    // 截图
    await page.screenshot({ path: 'test-results/set-first-image/12-order-adjustment.png' });
  });
});
