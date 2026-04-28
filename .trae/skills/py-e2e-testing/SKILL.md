---
name: py-e2e-testing
description: 在编写或调试 Playwright E2E 测试时使用。症状包括：测试不稳定、竞态条件、时间依赖性问题，或需要通过截图和状态检查验证 UI 交互。
---

# E2E 测试规范

## 禁止行为

- 禁止使用弃用方法
- 禁止在没有理解代码的情况下编写测试
- 禁止在没有截图的情况下进行断言
- 禁止在没有验证的情况下假设页面状态
- 禁止跳过自动化测试验证

## 测试相关路径

- 测试文件目录: `e2e/`
- 截图目录: `test-results/`

## 必须遵守 - 关键规则

这些规则是**绝对要求** - 不允许例外：

0. timeout 时间不要超过 1000 毫秒, 超过时需要充足理由

1. **使用 Electron 日志 API 进行测试日志记录**
   - 使用 `window.electronAPI.logInfo()` 将测试日志记录到 `pm.log`
   - 示例：

     ```typescript
     await page.evaluate((params) => {
       window.electronAPI.logInfo('E2E-Test', '测试操作', {
         param1: params.value1,
         param2: params.value2
       });
       // ... 测试逻辑
     }, testData);
     ```

   - 日志将写入 `./pm.log`
   - 使用日志进行调试，而不是在生产测试中使用 `console.log`

2. **在每个测试前用中文记录测试项描述**

   - 使用 ElectronTestHelper 的 logTestStart 方法
   - 所有描述都用简洁的中文
   - logTestStart 自动从 Playwright 获取当前测试名，无需传参

   ```typescript
   test.describe('提示词管理功能', () => {
    test('应该创建新提示词', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // ... 测试代码
    });
   });
   ```

3. **始终使用 Constants.Ids 进行 DOM 元素选择**

    - 源代码使用 `Constants.Ids.Xxx` 进行类型安全
    - 测试代码必须使用相同的常量以保持一致性
    - 如果常量不存在，请检查 `src/constants.ts` 并使用其中定义的实际 ID
    - **对于 `waitForFunction` 和 `page.evaluate`**：将常量作为参数传递，因为它们在浏览器上下文中运行

    ```typescript
    // ❌ 错误：硬编码 ID - 源代码变更时容易出错
    await page.click('#selectModalOkBtn');

    // ✅ 正确：使用 Constants.Ids - 确保与源代码一致
    await page.click(`#${Constants.Ids.SELECT_MODAL_OK_BTN}`);
    ```

    ```typescript
    // ❌ 错误：浏览器上下文中无法使用 Constants
    await page.waitForFunction(() => {
      const items = document.querySelectorAll(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item`);
      return items.length > 0;
    });

    // ✅ 正确：将常量值作为参数传递
    await page.waitForFunction(
      (containerId: string) => {
        const items = document.querySelectorAll(`#${containerId} .tag-manager-item`);
        return items.length > 0;
      },
      Constants.Ids.IMAGE_TAG_GROUP_CARDS  // 将常量作为参数传递
    );
    ```

4. **绝不在 E2E 测试中删除非测试数据**
   - 始终先创建测试数据，然后仅删除测试数据
   - 使用搜索 + 选择模式来仅定位测试创建的项目

5. **绝不使用 `waitForTimeout` 进行等待**
   - 改用显式条件（waitForSelector、waitForFunction 等）
   - 参见下方的"可靠验证"部分了解正确模式
   - **例外情况**：当需要等待时间戳变化时（如 `localTime()` 只精确到秒），可以使用 `waitForFunction` 等待下一秒：

     ```typescript
     // 等待下一秒开始，确保操作发生在不同秒（localTime() 只精确到秒）
     await page.waitForFunction((beforeTime: string | undefined) => {
       const now = new Date().toLocaleString('zh-CN');
       return now !== beforeTime;
     }, updatedAtBefore, { timeout: 1000 });
     ```

6. **使用 `e2e/electron-test.ts` 中的共享辅助函数**
    - 导入并重用现有的辅助函数，而不是重复代码
    - 完整文档参见：[e2e-测试共享辅助函数库.md](e2e-测试共享辅助函数库.md)
    - **添加新的共享函数时**：首先添加到 `e2e/electron-test.ts`，然后更新 `e2e-测试共享辅助函数库.md`

    ```typescript
    // ✅ 正确：导入并重用辅助函数
    import { createElectronTest, enterImageGridView, getImageFromDatabase } from './electron-test.ts';

    const electronTest = createElectronTest();
    await electronTest.launch();
    const page = electronTest.getPage();
    const firstCard = await enterImageGridView(page);
    ```

7. **使用 ElectronTestHelper 进行测试数据生成和清理**

    - `ElectronTestHelper` 已集成测试数据管理功能，无需额外导入
    - 使用 `generateTagName()` 生成带有 `e2e_` 前缀的唯一测试标签名
    - 使用 `createImageTag()` / `createPromptTag()` 创建测试标签
    - 在 `afterEach` 中使用 `cleanupAndReset()` 清理测试数据, 并返回图像主界面

    ```typescript
    // ✅ 正确：使用 ElectronTestHelper 进行测试数据管理
    import { createElectronTest } from './electron-test.ts';

    const electronTest = createElectronTest();

    test.afterEach(async () => {
      await electronTest.cleanupAndReset();
    });

    test('应该创建标签', async () => {
      const tagName = electronTest.generateTagName('test_suffix');
      await electronTest.createImageTag(tagName);
      // ... 测试逻辑
    });
    ```

   - 优点：
     - 一致的 `e2e_` 前缀，便于识别和清理
     - 带时间戳的唯一名称防止冲突
     - 集中式清理防止测试之间的数据污染
     - 无需额外导入，简化测试代码

## 安全删除模式（必须遵守）

在 E2E 测试中实现任何删除操作时，必须遵循这些模式以防止意外删除非测试数据。

### 1 安全单个删除模式

通过点击删除按钮删除单个项目时（使用 ElectronTestHelper）：

```typescript
// ✅ 正确：安全单个删除模式
import { createElectronTest } from './electron-test.ts';

const electronTest = createElectronTest();
const testTagName = electronTest.generateTagName('single_delete');

// 创建测试数据
await electronTest.createImageTag('single_delete');

// 搜索以筛选和定位特定标签
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, testTagName);

// 关键：验证搜索返回恰好 1 个结果且与我们的标签匹配
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    // 必须是恰好 1 个项目 AND 它必须是我们的测试标签
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

// 通过 API 验证删除
await page.waitForFunction(async (name: string) => {
  const tags = await window.electronAPI.getImageTags();
  return !tags.includes(name);
}, testTagName, { timeout: 1000 });

// 注意：如果使用 test.afterEach 的 cleanupAndReset()，则不需要手动删除
// 这里的删除操作仅用于测试删除功能本身
```

### 2 安全批量删除模式

批量删除多个项目时（使用 ElectronTestHelper）：

```typescript
// ✅ 正确：安全批量删除模式
import { createElectronTest } from './electron-test.ts';

const electronTest = createElectronTest();
const searchKeyword = 'persist_test';  // 使用特定的测试前缀
const tagName1 = electronTest.generateTagName(searchKeyword);  // e2e_persist_test_xxx
const tagName2 = electronTest.generateTagName(searchKeyword);
const otherTagName = electronTest.generateTagName('other');  // 对照组（不匹配搜索）

// 创建测试数据
await electronTest.createImageTag(tagName1);
await electronTest.createImageTag(tagName2);
await electronTest.createImageTag(otherTagName);  // 不会被删除

// 使用特定关键词搜索
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, searchKeyword);

// 关键：等待搜索筛选完成 AND 验证所有可见项目都匹配搜索
await page.waitForFunction(
  (params: { containerId: string; keyword: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    // 必须验证：1) 预期数量，2) 所有项目都包含搜索关键词
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

// 关键：删除前验证选中的项目
await page.waitForFunction(async (keyword: string) => {
  const checkedBoxes = document.querySelectorAll('.tag-batch-checkbox:checked');
  const selectedTags = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-tag'));
  // 安全检查：所有选中的标签必须包含搜索关键词
  return selectedTags.every(tag => tag?.includes(keyword));
}, searchKeyword, { timeout: 1000 });

// 执行删除
await batchToolbar.locator('.batch-action-delete').click();
await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 1000 });
await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

// 通过 API 验证删除
await page.waitForFunction(async (names: string[]) => {
  const tags = await window.electronAPI.getImageTags();
  return !tags.includes(names[0]) && !tags.includes(names[1]);
}, [tagName1, tagName2], { timeout: 1000 });

// 关键：验证对照组（otherTagName）仍然存在
await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return Array.from(items).some(item => item.getAttribute('data-tag') === params.tagName);
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: otherTagName },
  { timeout: 1000 }
);
await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`)).toBeVisible({ timeout: 1000 });
```

### 3 关键安全要求

**⚠️ 警告：跳过任何这些步骤可能导致数据丢失！**

1. **使用特定的搜索关键词**：使用唯一的测试前缀创建标签（例如 `persist_test`、`e2e_drag_drop`）
   - 绝不使用宽泛的关键词如 `'e2e'` 单独使用
   - 使用时间戳或 UUID 确保唯一性：`e2e_test_${Date.now()}`

2. **创建对照组**：**强制** - 始终创建至少一个不匹配搜索关键词的标签
   - 这是验证筛选是否正确工作的安全网
   - 没有对照组，你无法检测筛选是否失败

3. **验证搜索筛选**：等待搜索完成 AND 验证所有可见项目都包含搜索关键词
   - 检查数量和内容
   - 使用 `.every()` 确保所有项目都匹配

4. **删除前验证选择**：仔细检查所有选中的项目是否符合搜索条件
   - 查询选中的复选框并验证其 data-tag 属性
   - 如果选中了任何不匹配的标签则抛出错误

5. **验证对照组存活**：删除后，清除搜索并验证对照组标签仍然存在
   - 这确认了仅删除了预期的项目
   - 如果对照组丢失，说明测试有 bug

### 4 反模式（绝不要这样做）

```typescript
// ❌ 错误：危险的批量删除 - 可能删除所有数据
await searchInput.fill('e2e');  // 太宽泛，可能匹配所有内容
await page.waitForFunction(() => {
  const items = document.querySelectorAll('.tag-manager-item');
  return items.length >= 0;  // 始终为真，没有实际验证！
});
await page.click('.batch-action-select-all');  // 可能选中所有标签
await page.click('.batch-action-delete');  // 危险：删除所有内容！

// ❌ 错误：没有对照组 - 无法验证安全性
const tagName = electronTest.generateTagName('test');
await electronTest.createImageTag('test');
await searchInput.fill('test');
await page.click('.batch-action-select-all');
await page.click('.batch-action-delete');  // 如果筛选失败，删除所有内容！

// ❌ 错误：删除前不验证选择了什么
await searchInput.fill(searchKeyword);
await page.click('.batch-action-select-all');
// 不验证选择了什么！
await page.click('.batch-action-delete');
```

**参考实现：**

- 单个删除：`e2e/9-tag-manager.spec.ts`（删除标签测试）
- 带对照组的批量删除：`e2e/10-tag-manager-search-persist.spec.ts`

### 5 测试数据刷新模式（必须遵守）

主界面(网格,列表,紧凑模式)创建测试数据后，必须通过刷新按钮加载最新数据到视图中，**不要使用 `waitForTimeout` 等待数据加载**：

```typescript
// ✅ 正确：使用刷新按钮加载测试数据
import { createElectronTest, enterImageGridView } from './electron-test.ts';

const electronTest = createElectronTest();

test('应该显示新创建的图像', async () => {
  // 创建测试数据
  const testImages = await electronTest.createTestImages(2, 'test_suffix');
  
  // 进入视图
  await enterImageGridView(page);
  
  // 点击左下角刷新按钮加载最新数据
  await page.click(`#${Constants.Ids.REFRESH_DATA_BTN}`);
  
  // 使用显式等待条件验证数据已显示
  await page.waitForFunction((ids: string[]) => {
    const cards = document.querySelectorAll('.image-card');
    const foundIds = Array.from(cards).map(card => card.getAttribute('data-id'));
    return ids.every(id => foundIds.includes(id));
  }, testImages.map(img => img.id), { timeout: 1000 });
});

// ✅ 正确：提示词同理
test('应该显示新创建的提示词', async () => {
  const testPrompt = await electronTest.createTestPrompt('test_suffix');
  await enterPromptGridView(page);
  
  // 点击刷新按钮
  await page.click(`#${Constants.Ids.REFRESH_DATA_BTN}`);
  
  // 验证数据已显示
  await page.waitForFunction((id: string) => {
    const cards = document.querySelectorAll('.prompt-card');
    return Array.from(cards).some(card => card.getAttribute('data-id') === id);
  }, testPrompt.id, { timeout: 1000 });
});
```

**关键要点：**

1. **刷新按钮 ID**: `Constants.Ids.REFRESH_DATA_BTN`（位于界面左下角）
2. **何时调用**: 创建测试数据后、验证数据显示前
3. **不要使用**: `await page.waitForTimeout(1000)` 等待数据加载
4. **改用**: 刷新按钮 + 显式等待条件（`waitForFunction`）

## 编写 E2E 测试的强制流程

### 阶段 1：理解代码（必须首先完成）

在编写任何测试代码之前，你必须：

1. **找到页面导航逻辑**
   - 搜索相关的 Manager 文件
   - 理解页面如何打开/关闭
   - 确认何时添加 active 类

2. **确认 DOM 元素 ID**
   - 检查 HTML 模板文件
   - 确认按钮、输入框的 ID
   - 确认状态判断的依据

3. **理解业务逻辑**
   - 什么条件下显示什么按钮
   - 页面导航的前提条件
   - 异步操作的完成指示器

### 阶段 2：编写测试

1. **在每个关键操作后截图**

   ```typescript
   await page.screenshot({ path: `test-results/debug-${stepName}.png` });
   ```

2. **验证页面状态**
   - 不要假设页面已经切换
   - 使用 waitForSelector 验证关键元素
   - 设置合理的超时（1000ms）

3. **按照实际逻辑导航到目标界面**
   - 不要假设测试从目标界面开始
   - 在测试注释中显式编写进入目标界面的步骤
   - 使用辅助函数封装导航逻辑
   - 示例：

     ```typescript
     /**
      * 进入图像网格视图辅助函数
      * 进入目标界面的步骤：
      * 1. 点击 #imageManagerBtn 切换到图像面板
      * 2. 点击 #imageGridViewBtn 确保网格视图
      * 3. 等待 .image-card 元素可见
      */
     async function enterImageGridView(page: any) {
       await page.click('#imageManagerBtn');
       await page.waitForSelector('#imagePanel.active', { timeout: 1000 });
       await page.click('#imageGridViewBtn');
       await page.waitForSelector('#imageGridView.active', { timeout: 1000 });
       const firstCard = page.locator('.image-card').first();
       await expect(firstCard).toBeVisible({ timeout: 1000 });
       return firstCard;
     }
     ```

4. **一步一步执行**
   - 一次一个操作
   - 在进行下一步之前验证成功
   - 失败时检查截图以定位问题

5. **添加显式类型注解**
   - 所有 `.evaluate()` 回调必须有显式参数类型
   - 示例：

     ```typescript
     // ❌ 错误：隐式 'any' 类型
     await element.evaluate(el => el.classList.contains('active'));

     // ✅ 正确：显式 HTMLElement 类型
     await element.evaluate((el: HTMLElement) => el.classList.contains('active'));
     ```

6. **测试前运行类型检查**
   - 在运行测试之前验证测试文件通过 类型检查 和 eslint 检查：

     ```bash
     bun run check
     ```

   - 首先修复所有类型错误
   - 这确保在执行之前测试脚本的正确性

7. **每次修改后进行类型检查**
   - 在对测试代码进行任何更改后：
     1. 运行 `bun run check` 类型验证和 lint 检查
     2. 仅在类型检查通过后运行测试
   - 工作流程：

     ```plain
     修改代码 → 类型检查 → 修复错误（如有）→ 运行测试
     ```

   - 这防止浪费时间运行带有类型错误的测试

### 阶段 3：自动化测试验证

编写 E2E 测试后，必须运行自动化验证：

1. **首先运行失败的测试**（调试时）
   - 使用 `--grep` 仅运行失败的测试：

     ```bash
     bun playwright test e2e/<测试文件>.spec.ts --grep "测试名称" --reporter=list
     ```

   - 修复问题并验证通过
   - 然后运行所有测试以确保没有回归

2. **运行所有测试**（修复后或初始编写后）

   ```bash
   bun playwright test e2e/<测试文件>.spec.ts --reporter=list
   ```

3. **验证所有测试通过**
   - 所有测试应显示 "✓"（通过）
   - 没有 "✘"（失败）或 "−"（跳过）无理由
   - 检查测试持续时间是否合理（< 30s 每个测试）

4. **处理测试失败**
   - 查看错误消息
   - 检查 `test-results/` 目录中的截图
   - 修复代码或测试中的问题，而不是变通方案
   - 重新运行直到全部通过

5. **记录测试结果**
   - 报告通过/失败总数
   - 列出任何跳过的测试及原因
   - 记录验证过程中所做的任何修复

### 阶段 4：调试（当测试失败时）

当自动化验证显示失败时：

1. **查看所有截图**
   - 不只是最后一张
   - 追踪整个流程

2. **分析失败原因**
   - 截图显示什么页面？
   - 预期元素是否存在？
   - 状态是否符合预期？

3. **重新检查代码 - 不要猜测**
   - 当测试失败时，必须重新检查相关源代码
   - 不要假设"可能是 X"并应用变通方案
   - 回到阶段 1：阅读实际实现代码
   - 验证 DOM 结构、字段名称、数据流
   - 仅在理解真正原因后进行修复
   - **如果思考过程包含"可能"、"maybe"、"probably"、"should be"或类似不确定的词语，停止并重新检查代码。不要基于假设继续 - 首先验证实际代码行为。**

4. **修复并重新验证**
   - 修复代码或测试中的根本原因
   - 返回阶段 3 重新运行验证
   - 直到所有测试通过才继续

### 阶段 5：测试准备（运行测试前）

运行 E2E 测试前，准备环境：

1. **清除 pm.log 文件（不要删除）**
   - 清空 `pm.log` 文件的内容而不是删除它
   - 这确保调试时有干净的日志，同时保持文件句柄
   - 示例：

     ```powershell
     # Windows PowerShell
     Clear-Content pm.log
     ```

2. **验证构建是最新的**
   - 运行 `bun run check; bun run build` 确保没有类型错误, 没有 eslint 错误, 且最新代码已编译
   - 测试前检查是否有任何构建错误

## 可靠验证（无任意等待时间）

**绝不要通过延长等待时间来修复不稳定的测试。** 这会掩盖真正的问题并减慢测试速度。

### 错误的方式（禁止）

```typescript
// ❌ 错误：不理解原因的情况下延长等待时间
await page.waitForTimeout(1000); // 原来是 500ms，增加是因为"可能有帮助"
```

### 正确的方式（要求）

使用基于代码研究的显式等待条件：

```typescript
// ✅ 正确：使用 waitForFunction 轮询状态变化
// 最适合：API 调用、数据持久化、异步操作
await page.waitForFunction(async (tagName: string) => {
  const tags = await window.electronAPI.getAllTags();
  return tags.includes(tagName);
}, testTagName, { timeout: 1000 });

// ✅ 正确：使用带状态的 waitForSelector
// 最适合：模态框、面板、可见性变化
await page.waitForSelector('#imageTagManagerModal', { state: 'hidden', timeout: 1000 });

// ✅ 正确：使用带 toBeVisible 的 expect
// 最适合：操作后应该出现的元素
await expect(page.locator('.tag-filter-item[data-tag="newTag"]')).toBeVisible({ timeout: 1000 });

// ✅ 正确：使用带 has-text 的 waitForSelector
// 最适合：Toast 消息、通知
await page.waitForSelector('#toastContainer:has-text("标签已创建")', { timeout: 1000 });
```

### 选择正确的方法

| 场景 | 推荐方法 | 原因 |
|----------|-------------------|-----|
| API 调用完成 | `waitForFunction` | 轮询直到条件满足，无任意延迟 |
| 模态框打开/关闭 | 带状态的 `waitForSelector` | 等待特定 DOM 状态 |
| 元素可见性 | `expect().toBeVisible()` | Playwright 的内置重试 |
| 文本内容 | 带 `:has-text` 的 `waitForSelector` | 等待特定文本出现 |
| 导航完成 | `waitForURL` 或 `waitForLoadState` | Playwright 的导航辅助函数 |

### 当测试失败时

1. **禁止** 增加 `waitForTimeout` 值
2. **要** 检查实际代码以理解：
   - 什么事件表示操作完成？
   - 什么 DOM 变化表示成功？
   - 什么 API 可以验证状态变化？
3. **要** 使用基于代码研究的显式等待条件
4. **要** 验证修复在多次运行中可靠工作

## 特殊情况

### 测试重复提交预防 / 防抖

测试重复提交预防或防抖功能时，使用 `page.evaluate` 进行快速操作并通过 API 验证。

**参见详细指南：** [重复提交预防](testing-techniques.md#duplicate-submission-prevention)

---

## 测试技术参考

有关特定的测试技术和最佳实践，参见 **[testing-techniques.md](testing-techniques.md)**：

- **[拖放操作](testing-techniques.md#drag-and-drop-operations)** - 用于可靠拖放的逐步鼠标操作
- **[重复提交预防](testing-techniques.md#duplicate-submission-prevention)** - 测试防抖和重复预防
- **[数据库状态验证](testing-techniques.md#database-state-verification)** - 通过 API 验证数据
- **[可靠等待策略](testing-techniques.md#reliable-waiting-strategies)** - 显式等待条件而非任意延迟

## 测试清理（所有测试通过后）

所有测试通过后，清理调试代码：

1. **移除不必要的测试逻辑**
   - 简化仅为调试而存在的复杂变通方案
   - 仅保留基本的测试断言

2. **重新运行完整测试套件**
   - 确保清理没有破坏任何测试
   - 验证清理后所有测试仍然通过

3. **最终类型检查验证**
   - 在整个项目上运行 `bun run check`
   - 确保没有类型错误残留
