---
name: py-e2e-testing
description: 在编写或调试 Playwright E2E 测试时使用。症状包括：测试不稳定、竞态条件、时间依赖性问题，或需要通过截图和状态检查验证 UI 交互。
---

# E2E 测试规范

> **架构设计参考**：
>
> - 测试数据库隔离：`docs/prds/prd-e2e-测试专用数据库.md`
> - 测试数据工厂：`docs/prds/prd-e2e-test-data-factory.md`

## 核心架构

### 1. 测试专用数据库

每个 worker 使用独立的临时数据目录，通过 Playwright worker-scoped fixture 实现：

- 每个 worker 使用独立的临时数据目录（位于系统临时目录）
- 通过 `E2E_TEST_DATA_DIR` 环境变量传递测试数据目录路径
- 主进程检测到该环境变量时，使用测试数据目录替代默认数据目录
- 应用在 worker 级别启动和关闭一次（并行时, 每个 worker 进程执行所有分配的测试文件）
- 测试完成后自动删除临时数据目录

#### Playwright 并行配置

```typescript
// playwright.config.ts
{
  workers: 4,        // 最多 4 个 worker 进程
  fullyParallel: false,  // 文件间并行，文件内顺序（默认行为）
}
```

> **前提条件**：worker-scoped fixture 依赖 Playwright 的 worker 复用机制。默认情况下（`fullyParallel: false`），每个测试文件分配独立 worker。

### 2. 测试数据抽象工厂

使用**抽象工厂模式**创建测试数据，统一通过 API 创建，不经过 UI：

```
ITestDataFactory (抽象工厂接口)
        △
ApiTestFactory (具体工厂)
    ├── createPromptFactory() → PromptApiFactory
    └── createImageFactory()  → ImageApiFactory

BaseTestDataFactory<T> (抽象基类)
    ├── generateName()     → e2e_{label}_{timestamp}_{random}
    ├── _batchCreate()     → 循环调用子类 create()
    └── callApi()          → page.evaluate 封装

PromptApiFactory extends BaseTestDataFactory<IPrompt>
    ├── create(data)           → electronAPI.addPrompt()
    ├── createBatch(count, label)
    ├── createTag(tagName)     → electronAPI.addPromptTag()
    ├── createTags(count, label)
    ├── createTagGroup(name, isTop?) → electronAPI.createPromptTagGroup()
    ├── createTagInGroup(groupName, tagLabel, isTop?) → 创建标签组并在其中添加标签
    ├── createWithTags(data, tagNames)
    ├── createWithImages(data, imageIds)
    └── createWithImageCount(label, imageCount, imageLabelPrefix?) → 创建带指定数量图像的提示词

ImageApiFactory extends BaseTestDataFactory<IImage>
    ├── create(data)           → saveImageFile() + getImageById()
    ├── createBatch(count, label)
    ├── createTag(tagName)     → electronAPI.addImageTag()
    ├── createTags(count, label)
    ├── createTagGroup(name, isTop?) → electronAPI.createImageTagGroup()
    ├── createTagInGroup(groupName, tagLabel, isTop?) → 创建标签组并在其中添加标签
    ├── createWithTags(data, tagNames)
    └── createWithPromptCount(label, promptCount, promptLabelPrefix?) → 创建带指定数量提示词的图像
```

**使用方式**：

```typescript
const factory = electronTest.getApiFactory();
const promptFactory = factory.createPromptFactory();
const imageFactory = factory.createImageFactory();

// 批量创建
await imageFactory.createBatch(3, "test");
await promptFactory.createBatch(2, "test");

// 关联创建
await promptFactory.createWithImages({ label: "test" }, ["img1", "img2"]);
await imageFactory.createWithPromptCount("test", 2, "prompt");

// 创建带指定数量关联实体的提示词/图像
await promptFactory.createWithImageCount("prompt_0_img", 0);
await promptFactory.createWithImageCount("prompt_1_img", 1);
await promptFactory.createWithImageCount("prompt_2_imgs", 2);
await imageFactory.createWithPromptCount("img_0_prompt", 0);
await imageFactory.createWithPromptCount("img_1_prompt", 1);
await imageFactory.createWithPromptCount("img_2_prompts", 2);

// 带标签创建
await promptFactory.createWithTags({ label: "test" }, ["tag1"]);
await imageFactory.createWithTags({ label: "test" }, ["tag1"]);

// 创建独立标签
await promptFactory.createTag("e2e_test_tag");
await imageFactory.createTag("e2e_test_tag");

// 批量创建独立标签
await promptFactory.createTags(5, "prompt_tags");
await imageFactory.createTags(5, "image_tags");

// 创建标签组
await imageFactory.createTagGroup("e2e_test_group");
await promptFactory.createTagGroup("e2e_test_group");

// 创建标签组并在其中添加标签（一步到位）
const { group, tagName } = await imageFactory.createTagInGroup("drag_group", "drag_shared", true);
const { group: promptGroup, tagName: promptTagName } = await promptFactory.createTagInGroup("prompt_drag_group", "drag_shared", true);

// 创建首位组（sortOrder 取现有最小值 - 1，无现有组时为 -1）
await imageFactory.createTagGroup("e2e_top_group", true);
await promptFactory.createTagGroup("e2e_top_group", true);

// 创建后刷新界面
await electronTest.refreshData();
```

### 3. Fixture 机制

使用 **worker-scoped fixture** 管理应用生命周期和测试数据目录：

```typescript
export const test = base.extend<
  { electronTest: ReturnType<typeof createElectronTest>; page: Page },
  { _electronTest: ReturnType<typeof createElectronTest>; _testDataDir: string }
>({
  _testDataDir: [
    async ({}, use) => {
      const testDataDir = getTestDataDir();
      await use(testDataDir);
      rmSync(testDataDir, { recursive: true, force: true });
    },
    { scope: "worker" },
  ],
  _electronTest: [
    async ({ _testDataDir }, use) => {
      const electronTest = createElectronTest(_testDataDir);
      await electronTest.launch();
      await use(electronTest);
      await electronTest.close();
    },
    { scope: "worker" },
  ],
  electronTest: async ({ _electronTest }, use) => { await use(_electronTest); },
  page: async ({ _electronTest }, use) => { await use(_electronTest.getPage()); },
});
```

## 快速开始

```typescript
import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import { test, enterImageGridView } from "./electron-test.ts";

test.describe("功能模块名称", () => {
  // 文件级别：创建基础测试数据
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(3, "shared");
    await factory.createPromptFactory().createBatch(3, "shared");
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
- 禁止使用旧的数据创建方法或通过 UI 流程创建基础测试数据，统一使用 API 工厂
- 禁止在没有验证的情况下假设页面状态
- 禁止跳过自动化测试验证

## 必须遵守的规则

这些规则是**绝对要求** - 不允许例外：

### 0. timeout 限制

timeout 时间不要超过 1000 毫秒, 超过时需要充足理由

### 1. 调试日志记录

调试时, 使用 `electronTest.logDebug()` 将测试日志记录到 `pm.log`：

```typescript
await electronTest.logDebug(page, '测试操作描述', {
  param1: value1,
  param2: value2
});
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
- 测试数据命名模式：`e2e_{label}_{timestamp}_{random}`

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
import { test, enterImageGridView } from './electron-test.ts';

await enterImageGridView(page);
```

**添加新的共享函数时**：首先添加到 `e2e/electron-test.ts`，然后更新该文档。

### 7. 测试数据管理

**核心原则：`beforeAll` 创建文件级共享的基础测试数据**

每个测试文件应使用 `test.describe` 包裹所有测试，并在其中通过 `beforeAll` 创建共享的基础测试数据：

```typescript
test.describe('功能模块名称', () => {
  // 文件级别：创建基础测试数据（所有测试复用）
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(3, "shared");
    await factory.createPromptFactory().createBatch(3, "shared");
    await electronTest.refreshData();
  });

  test('不涉及数据操作的测试项', async ({ electronTest, page }) => {
    await electronTest.logTestStart();
    // 复用 beforeAll 创建的数据
  });
});
```

**数据创建原则**：

- ✅ **`beforeAll` 中创建文件级共享的基础测试数据**：如基础图像、提示词、标签等
- ✅ **不涉及数据操作的测试项复用 `beforeAll` 创建的基础数据**：如界面展示、交互测试
- ✅ **新建类测试跳过 `beforeAll` 创建，直接测试新建功能**：如创建新图像、新提示词、新标签
- ✅ **删除类测试在 `beforeAll` 创建足够数据，删除后不影响后续**：确保删除操作有足够数据可用

**测试目标与数据创建方式**：

- **如果测试目标是 UI 创建流程**（如"标签组管理 - 创建、编辑、删除"），则**使用 UI 操作**创建测试数据，以验证完整的 UI 流程
- **如果测试目标是其他功能**（如搜索、重命名、批量操作），则**使用 API 工厂**创建前置测试数据，然后测试目标功能

**测试运行先决条件**：

- 使用 `enterImageDetailView` 或 `enterImageGridView` 前，**必须在 `beforeAll` 中创建至少 1 个图像**
- 使用 `enterPromptDetailView` 或 `enterPromptGridView` 前，**必须在 `beforeAll` 中创建至少 1 个提示词**
- 使用标签相关功能前，**必须在 `beforeAll` 中创建所需标签**
- 创建数据后**必须调用 `electronTest.refreshData()`** 刷新界面显示

**使用工厂方法创建测试数据**：

```typescript
test.describe('标签管理', () => {
  test('创建标签', async ({ electronTest, page }) => {
    // ✅ 正确：通过工厂创建独立标签
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createTag("e2e_test_tag");
    await factory.createPromptFactory().createTag("e2e_test_prompt_tag");

    // ✅ 正确：批量创建独立标签
    const imageTags = await factory.createImageFactory().createTags(3, "batch");
    const promptTags = await factory.createPromptFactory().createTags(2, "batch");

    // ✅ 正确：创建实体并关联标签
    await factory.createImageFactory().createWithTags({ label: "test" }, ["tag1", "tag2"]);

    await electronTest.refreshData();
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
// 创建测试数据 + 对照组
const factory = electronTest.getApiFactory();
await factory.createImageFactory().createBatch(1, "delete_test");
await factory.createImageFactory().createBatch(1, "control"); // 对照组
await electronTest.refreshData();

// 搜索以筛选和定位
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, "e2e_delete_test");

// 等待搜索完成并验证筛选结果
await page.waitForFunction(
  (params: { containerId: string; keyword: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return items.length >= 1 && Array.from(items).every(item =>
      item.getAttribute("data-tag")?.includes(params.keyword)
    );
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, keyword: "e2e_delete_test" },
  { timeout: 1000 }
);

// 执行删除操作...
// 验证对照组仍然存在
await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return Array.from(items).some(item => item.getAttribute("data-tag") === params.tagName);
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: "e2e_control_..." },
  { timeout: 1000 }
);
```

### 批量删除（带对照组）

```typescript
const factory = electronTest.getApiFactory();
const searchKeyword = "batch_delete_test";

// 创建测试标签 + 对照组标签
const tagName1 = electronTest.generateE2ePrefixName(`${searchKeyword}_1`);
const tagName2 = electronTest.generateE2ePrefixName(`${searchKeyword}_2`);
const controlTagName = electronTest.generateE2ePrefixName("control_group");
await factory.createImageFactory().createTag(tagName1);
await factory.createImageFactory().createTag(tagName2);
await factory.createImageFactory().createTag(controlTagName);
await electronTest.refreshData();

// 使用特定关键词搜索
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, searchKeyword);

// 关键：等待搜索筛选完成 AND 验证所有可见项目都包含搜索关键词
await page.waitForFunction(
  (params: { containerId: string; keyword: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return items.length >= 2 && Array.from(items).every(item =>
      item.getAttribute("data-tag")?.includes(params.keyword)
    );
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, keyword: searchKeyword },
  { timeout: 1000 }
);

// 点击批量管理按钮
await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

// 等待工具栏出现
const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
await expect(toolbar).toBeVisible({ timeout: 1000 });

// 全选
await toolbar.locator('[data-action="SelectAll"]').click();

// 关键：删除前验证选中的项目
await page.waitForFunction(
  async (keyword: string) => {
    const checkedBoxes = document.querySelectorAll(".tag-batch-checkbox:checked");
    const selectedTags = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-tag"));
    // 安全检查：所有选中的标签必须包含搜索关键词
    return selectedTags.every(tag => tag?.includes(keyword));
  },
  searchKeyword,
  { timeout: 1000 }
);

// 点击"删除"按钮
await toolbar.locator('[data-action="Delete"]').click();

// 验证确认对话框出现并确认
const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
await expect(confirmModal).toBeVisible({ timeout: 1000 });
await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);
await expect(confirmModal).toBeHidden({ timeout: 1000 });

// 通过 API 验证删除
await page.waitForFunction(
  async (names: string[]) => {
    const tags = await window.electronAPI.getImageTags();
    return !tags.includes(names[0]) && !tags.includes(names[1]);
  },
  [tagName1, tagName2],
  { timeout: 1000 }
);

// 关键：验证对照组仍然存在
await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return Array.from(items).some(item => item.getAttribute("data-tag") === params.tagName);
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: controlTagName },
  { timeout: 1000 }
);
```

### 关键安全要求

1. **使用特定的搜索关键词**：使用唯一的测试前缀
2. **创建对照组**：始终创建至少一个不匹配搜索关键词的项目
3. **验证搜索筛选**：等待搜索完成 AND 验证所有可见项目都匹配
4. **删除前验证选择**：检查所有选中的项目是否符合搜索条件
5. **验证对照组存活**：删除后验证对照组仍然存在

## 测试数据刷新

创建测试数据后，调用 `refreshData()` 刷新界面：

```typescript
test('应该显示新创建的图像', async ({ electronTest, page }) => {
  const factory = electronTest.getApiFactory();
  await factory.createImageFactory().createBatch(2, "test");

  // 刷新界面以显示新数据
  await electronTest.refreshData();

  // 验证数据已显示...
});
```

## 可靠验证方法

| 场景 | 推荐方法 | 示例 |
|------|----------|------|
| API 调用完成 | `waitForFunction` | 见下方示例 |
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
   pnpm check
   ```

### 阶段 3：自动化验证

```bash
# 运行单个测试
pnpm e2e e2e/<测试文件>.spec.ts --grep "测试名称" --reporter=list

# 运行整个文件
pnpm e2e --reporter=list
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
pnpm check; pnpm build
```

## 测试路径

- 测试文件目录: `e2e/`
- 截图目录: `test-results/`

## 参考

- **测试数据库隔离设计**：`docs/prds/prd-e2e-测试专用数据库.md`
- **测试数据工厂设计**：`docs/prds/prd-e2e-test-data-factory.md`
- **共享辅助函数库**：`e2e/electron-test.ts`
- **测试数据工厂实现**：`e2e/factories/`
