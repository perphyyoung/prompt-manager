---
name: py-e2e-testing
description: 在编写或调试 Playwright E2E 测试时使用。症状包括：测试不稳定、竞态条件、时间依赖性问题，或需要通过截图和状态检查验证 UI 交互。
---

# E2E 测试规范

> **架构设计参考**：`docs/prds/prd-e2e-测试专用数据库.md`

## 快速开始

```typescript
import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import { test, enterImageGridView } from "./electron-test.ts";

test.describe("功能模块名称", () => {
  // 文件级别：创建基础测试数据
  test.beforeAll(async ({ electronTest }) => {
    await electronTest.createTestImages(3, "shared");
    await electronTest.refreshData();
  });

  test("测试项", async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    // 测试逻辑...
  });
});
```

## 禁止行为

- 禁止使用弃用方法
- 禁止在没有理解代码的情况下编写测试
- 禁止在没有验证的情况下假设页面状态
- 禁止跳过自动化测试验证

## 必须遵守的规则

这些规则是**绝对要求** - 不允许例外：

### 0. timeout 限制

timeout 时间不要超过 1000 毫秒, 超过时需要充足理由

### 1. 调试日志记录

调试时, 使用 `window.electronAPI.logInfo()` 将测试日志记录到 `pm.log`：

```typescript
await page.evaluate((params) => {
  window.electronAPI.logInfo('E2E-Test', '测试操作', {
    param1: params.value1,
    param2: params.value2
  });
}, testData);
```

### 2. 测试描述

在每个测试前用中文记录测试项描述：

```typescript
test.describe('提示词管理功能', () => {
  test('应该创建新提示词', async ({ electronTest, page }) => {
    await electronTest.logTestStart();  // 自动获取测试名并记录
    // ... 测试代码
  });
});
```

### 3. DOM 元素选择

始终使用 `Constants.Ids` 进行 DOM 元素选择：

```typescript
// ❌ 错误：硬编码 ID
await page.click('#selectModalOkBtn');

// ✅ 正确：使用 Constants.Ids
await page.click(`#${Constants.Ids.SELECT_MODAL_OK_BTN}`);
```

**对于 `waitForFunction` 和 `page.evaluate`**：将常量作为参数传递：

```typescript
// ❌ 错误：浏览器上下文中无法使用 Constants
await page.waitForFunction(() => {
  const items = document.querySelectorAll(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item`);
  return items.length > 0;
});

// ✅ 正确：将常量值作为参数传递
// 单参数可以直接传递，多参数建议使用对象形式
await page.waitForFunction(
  (containerId: string) => {
    const items = document.querySelectorAll(`#${containerId} .tag-manager-item`);
    return items.length > 0;
  },
  Constants.Ids.IMAGE_TAG_GROUP_CARDS
);
```

### 4. 数据安全

**绝不在 E2E 测试中删除非测试数据**：

- 始终先创建测试数据，然后仅删除测试数据
- 使用搜索 + 选择模式来仅定位测试创建的项目
- 使用 `generateE2ePrefixName()` 生成带 `e2e_` 前缀的唯一标识

### 5. 等待策略

**绝不使用 `waitForTimeout` 进行等待**：

```typescript
// ❌ 错误
await page.waitForTimeout(1000);

// ✅ 正确：使用显式条件
await page.waitForSelector('#imageTagManagerModal', { state: 'hidden', timeout: 1000 });
```

**例外情况**：当需要等待时间戳变化时（`localTime()` 只精确到秒）：

```typescript
await page.waitForFunction((beforeTime: string | undefined) => {
  const now = new Date().toLocaleString('zh-CN');
  return now !== beforeTime;
}, updatedAtBefore, { timeout: 1000 });
```

### 6. 共享辅助函数

使用 `e2e/electron-test.ts` 中的共享辅助函数：

```typescript
import { test, enterImageGridView, generateE2ePrefixName } from './electron-test.ts';

// 使用辅助函数
await enterImageGridView(page);
const tagName = generateE2ePrefixName('test_suffix');
```

**添加新的共享函数时**：首先添加到 `e2e/electron-test.ts`，然后更新本文档。

### 7. 测试数据管理

使用 `electronTest` fixture 进行测试数据管理：

```typescript
test.describe('标签管理', () => {
  test.beforeAll(async ({ electronTest }) => {
    // 创建基础测试数据
    await electronTest.createTestImages(3, 'shared');
    await electronTest.refreshData();
  });

  test('创建标签', async ({ electronTest, page }) => {
    const tagName = electronTest.generateE2ePrefixName('new_tag');
    await electronTest.createImageTag(tagName);
    // 验证...
  });
});
```

> **注意**：使用测试专用数据库后，**不需要**在 `afterEach` 中调用 `cleanupAndReset()`，测试数据目录会在测试文件完成后自动删除。

## 全局快捷键使用

为避免测试间状态污染，使用全局快捷键切换主界面：

| 快捷键 | 功能 | 使用场景 |
|--------|------|----------|
| `Ctrl+I` | 切换到图像主界面 | 测试辅助函数中替代点击按钮 |
| `Ctrl+P` | 切换到提示词主界面 | 确保进入视图前自动清理模态框 |

**示例**：

```typescript
// 使用快捷键进入图像网格视图
async function enterImageGridView(page: Page) {
  await page.keyboard.press('Control+i');  // 快捷键会先关闭所有模态框
  await page.waitForSelector('#imagePanel.active', { timeout: 1000 });
  await page.click(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}`);
  await page.waitForSelector('#imageGridView.active', { timeout: 1000 });
}
```

## 安全删除模式

### 单个删除

```typescript
const testTagName = electronTest.generateE2ePrefixName('single_delete');
await electronTest.createImageTag(testTagName);

// 搜索以筛选和定位特定标签
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, testTagName);

// 验证搜索返回恰好 1 个结果且与我们的标签匹配
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return items.length === 1 &&
           items[0].getAttribute('data-tag') === params.tagName;
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: testTagName },
  { timeout: 1000 }
);

// 点击特定标签的删除按钮
const deleteBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName}"] .tag-delete-btn`);
await deleteBtn.click();

// 确认删除
await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 1000 });
await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);
```

### 批量删除（带对照组）

```typescript
const searchKeyword = 'batch_test';
const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
const otherTagName = electronTest.generateE2ePrefixName('other');  // 对照组

await electronTest.createImageTag(tagName1);
await electronTest.createImageTag(tagName2);
await electronTest.createImageTag(otherTagName);

// 使用特定关键词搜索
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, searchKeyword);

// 验证：所有可见项目都包含搜索关键词
await page.waitForFunction(
  (params: { containerId: string; keyword: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return items.length >= 2 && Array.from(items).every(item =>
      item.getAttribute('data-tag')?.includes(params.keyword)
    );
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, keyword: searchKeyword },
  { timeout: 1000 }
);

// 进入批量模式并全选
await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);
await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 1000 });

const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
await batchToolbar.locator('.batch-action-select-all').click();

// 删除前验证：所有选中的标签必须包含搜索关键词
await page.waitForFunction(async (keyword: string) => {
  const checkedBoxes = document.querySelectorAll('.tag-batch-checkbox:checked');
  const selectedTags = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-tag'));
  return selectedTags.every(tag => tag?.includes(keyword));
}, searchKeyword, { timeout: 1000 });

// 执行删除
await batchToolbar.locator('.batch-action-delete').click();
await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 1000 });
await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

// 验证对照组仍然存在
await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`)).toBeVisible({ timeout: 1000 });
```

### 关键安全要求

1. **使用特定的搜索关键词**：使用唯一的测试前缀（如 `batch_test`、`drag_drop`）
2. **创建对照组**：始终创建至少一个不匹配搜索关键词的标签
3. **验证搜索筛选**：等待搜索完成 AND 验证所有可见项目都匹配
4. **删除前验证选择**：检查所有选中的项目是否符合搜索条件
5. **验证对照组存活**：删除后验证对照组标签仍然存在

## 测试数据刷新

创建测试数据后，调用 `refreshData()` 刷新界面：

```typescript
test('应该显示新创建的图像', async ({ electronTest, page }) => {
  const testImages = await electronTest.createTestImages(2, 'test_suffix');
  await enterImageGridView(page);

  // 刷新界面以显示新数据
  await electronTest.refreshData();

  // 验证数据已显示
  await page.waitForFunction((ids: string[]) => {
    const cards = document.querySelectorAll('.image-card');
    const foundIds = Array.from(cards).map(card => card.getAttribute('data-id'));
    return ids.every(id => foundIds.includes(id));
  }, testImages.map(img => img.id), { timeout: 1000 });
});
```

## 可靠验证方法

| 场景 | 推荐方法 | 示例 |
|------|----------|------|
| API 调用完成 | `waitForFunction` | `await page.waitForFunction(async (tagName: string) => { const tags = await window.electronAPI.getImageTags(); return tags.includes(tagName); }, testTagName, { timeout: 1000 });` |
| 模态框打开/关闭 | `waitForSelector` | `await page.waitForSelector('#modal', { state: 'hidden', timeout: 1000 });` |
| 元素可见性 | `expect().toBeVisible()` | `await expect(page.locator('.item')).toBeVisible({ timeout: 1000 });` |
| 文本内容 | `:has-text` | `await page.waitForSelector('#toast:has-text("成功")', { timeout: 1000 });` |

## 调试指南

### 阶段 1：理解代码（必须首先完成）

1. **找到页面导航逻辑**：搜索相关的 Manager 文件，理解页面如何打开/关闭
2. **确认 DOM 元素 ID**：检查 HTML 模板文件，确认按钮、输入框的 ID
3. **理解业务逻辑**：什么条件下显示什么按钮，异步操作的完成指示器

### 阶段 2：编写测试

1. **在每个关键操作后截图(初次编写和调试时)**：

   ```typescript
   await page.screenshot({ path: `test-results/debug-${stepName}.png` });
   ```

   - 初次编写测试脚本时, 或调试时, 需要截图
   - 测试通过后, 我会手动删除截图操作, 不再要求截图

2. **验证页面状态**：
   - 不要假设页面已经切换
   - 使用 waitForSelector 验证关键元素

3. **添加显式类型注解**：

   ```typescript
   // ✅ 正确：显式 HTMLElement 类型
   await element.evaluate((el: HTMLElement) => el.classList.contains('active'));
   ```

4. **测试前运行类型检查**：

   ```bash
   bun run check
   ```

### 阶段 3：自动化验证

```bash
# 运行单个测试
bun playwright test e2e/<测试文件>.spec.ts --grep "测试名称" --reporter=list

# 运行整个文件
bun playwright test e2e/<测试文件>.spec.ts --reporter=list
```

### 阶段 4：调试失败

1. **查看所有截图**：不只是最后一张，追踪整个流程
2. **分析失败原因**：截图显示什么页面？预期元素是否存在？
3. **重新检查代码**：当测试失败时，必须重新检查相关源代码，不要假设
4. **修复并重新验证**：修复根本原因，重新运行直到通过

### 阶段 5：测试准备

```powershell
# 清空日志（不要删除文件）
Clear-Content pm.log

# 验证构建是最新的
bun run check; bun run build
```

## 测试路径

- 测试文件目录: `e2e/`
- 截图目录: `test-results/`

## 参考

- **架构设计**：`docs/prds/prd-e2e-测试专用数据库.md`
- **共享辅助函数库**：`e2e/electron-test.ts`
