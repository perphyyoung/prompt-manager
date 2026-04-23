# Playwright E2E 测试技术

常见 E2E 测试场景的详细技术说明。

---

## 拖放操作

对于 HTML5 拖放测试，使用逐步鼠标操作以获得更好的可靠性。

### 推荐方法（最可靠）

```typescript
// 步骤 1：悬停在源元素上并验证它已准备就绪
await sourceElement.hover();
await expect(sourceElement).toBeVisible({ timeout: 1000 });

// 步骤 2：按下鼠标按钮（开始拖动）
await page.mouse.down();

// 步骤 3：移动到目标元素并验证它已准备就绪
await targetElement.hover();
await expect(targetElement).toBeVisible({ timeout: 1000 });

// 步骤 4：释放鼠标按钮（完成放置）
await page.mouse.up();

// 步骤 5：使用显式条件验证放置结果
await page.waitForFunction(async (tagName: string) => {
  const tags = await window.electronAPI.getAllTags();
  return tags.includes(tagName);
}, testTagName, { timeout: 1000 });
```

### 为什么这比 `dragTo()` 更好

- 更好地模拟真实用户行为
- 触发正确的事件序列：`mousedown` → `mousemove` → `mouseup`
- 适用于复杂的拖放库
- 使用显式验证而非任意延迟

### 使用 `dragTo()` 的替代方法（更简单但不太可靠）

```typescript
await sourceElement.dragTo(targetElement);
```

### 成功拖放的技巧

1. **验证元素可见且准备就绪** - 在操作前使用 `expect().toBeVisible()`
2. **检查重叠元素** - 它们可能会阻止放置
3. **在每个步骤后截图** - 用于调试失败
4. **使用显式结果验证** - 不要依赖 `waitForTimeout`
5. **如果 `dragTo()` 失败，使用逐步鼠标操作** - 更多控制和可靠性

### 示例：标签拖到卡片

```typescript
// 找到一个不存在于目标卡片上的标签
const allTags = page.locator('#imageTagFilterList .tag-filter-item');
const totalTags = await allTags.count();

let firstTag;
let tagName = '';

for (let i = 0; i < totalTags; i++) {
  const tagElement = allTags.nth(i);
  const tag = (await tagElement.getAttribute('data-tag')) || '';

  const tagAlreadyExists = originalTags.some(t => String(t) === tag);

  if (tag && !tagAlreadyExists) {
    firstTag = tagElement;
    tagName = tag;
    break;
  }
}

if (!tagName) {
  test.skip();
  return;
}

// 执行拖放
await firstTag.hover();
await expect(firstTag).toBeVisible({ timeout: 1000 });

await page.mouse.down();

await firstCard.hover();
await expect(firstCard).toBeVisible({ timeout: 1000 });

await page.mouse.up();

// 使用显式条件验证标签已添加
await page.waitForFunction(async (id: string, tag: string) => {
  const image = await window.electronAPI.getImageById(id);
  return (image as IImage)?.tags?.includes(tag);
}, imageId, tagName, { timeout: 1000 });

// 最终验证
const newTags = await page.evaluate(async (id) => {
  const image = await window.electronAPI.getImageById(id as string);
  return (image as IImage)?.tags || [];
}, imageId);

expect(newTags.length).toBeGreaterThan(originalTags.length);
expect(newTags).toContain(tagName);
```

---

## 重复提交预防

测试重复提交预防或防抖功能时：

### 使用 page.evaluate 进行快速操作

```typescript
// 错误：Playwright 等待元素稳定，可能错过时机
await doneButton.click();
await doneButton.click();

// 正确：在浏览器中快速触发多次点击
await page.evaluate(() => {
  const btn = document.getElementById('doneBtn');
  for (let i = 0; i < 5; i++) btn?.click();
});
```

### 验证策略

- 验证最终状态（例如，数据库记录数）
- 不要依赖中间状态截图
- 通过 API 验证仅创建了一条记录

### 示例

```typescript
// 触发快速点击
await page.evaluate(() => {
  const btn = document.getElementById('submitBtn');
  for (let i = 0; i < 5; i++) btn?.click();
});

// 使用显式条件等待操作完成
await page.waitForFunction(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length > 0;
}, { timeout: 1000 });

// 验证仅创建了一条记录
const count = await page.evaluate(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length;
});

expect(count).toBe(1); // 应该是 1，不是 5
```

---

## 数据库状态验证

E2E 测试应该通过 API 验证数据库状态，而不仅仅是 UI。

### 示例

```typescript
const count = await page.evaluate(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length;
});
expect(count).toBe(expectedCount);
```

### 最佳实践

1. **使用 API 调用** - 比 UI 断言更可靠
2. **验证数据完整性** - 检查实际数据库状态
3. **不要仅依赖 UI** - UI 可能不会立即反映真实状态
4. **对异步操作使用 waitForFunction** - 轮询直到条件满足

---

## 可靠的等待策略

**绝不要在测试中使用 `waitForTimeout()` 进行等待。** 这会创建不稳定的测试并减慢执行速度。

### 改用显式条件

| 场景 | 推荐方法 | 示例 |
|----------|-------------------|---------|
| API 调用完成 | `waitForFunction` | `await page.waitForFunction(async () => { ... }, { timeout: 1000 })` |
| 模态框打开/关闭 | 带状态的 `waitForSelector` | `await page.waitForSelector('#modal', { state: 'hidden', timeout: 1000 })` |
| 元素可见性 | `expect().toBeVisible()` | `await expect(page.locator('.item')).toBeVisible({ timeout: 1000 })` |
| 文本内容 | 带 `:has-text` 的 `waitForSelector` | `await page.waitForSelector('#toast:has-text("完成")', { timeout: 1000 })` |
| 导航完成 | `waitForURL` 或 `waitForLoadState` | `await page.waitForURL('/dashboard', { timeout: 1000 })` |

### 示例

#### 等待 API 操作

```typescript
// 错误：任意延迟
await page.click('#createTag');
await page.waitForTimeout(1000);

// 正确：轮询直到条件满足
await page.click('#createTag');
await page.waitForFunction(async (tagName: string) => {
  const tags = await window.electronAPI.getAllTags();
  return tags.includes(tagName);
}, testTagName, { timeout: 1000 });
```

#### 等待模态框关闭

```typescript
// 错误：任意延迟
await page.click('#closeModal');
await page.waitForTimeout(1000);

// 正确：等待特定状态
await page.click('#closeModal');
await page.waitForSelector('#modalId', { state: 'hidden', timeout: 1000 });
```

#### 等待元素出现

```typescript
// 错误：任意延迟
await page.click('#loadData');
await page.waitForTimeout(3000);
const item = page.locator('.data-item');

// 正确：带超时等待元素
await page.click('#loadData');
const item = page.locator('.data-item');
await expect(item).toBeVisible({ timeout: 1000 });
```

#### 等待文本内容

```typescript
// 错误：任意延迟
await page.click('#save');
await page.waitForTimeout(1000);
const toastText = await page.locator('#toast').textContent();
expect(toastText).toContain('已保存');

// 正确：等待特定文本
await page.click('#save');
await page.waitForSelector('#toast:has-text("已保存")', { timeout: 1000 });
```

---

## 参考

- [Playwright 官方文档](https://playwright.dev)
- [Playwright API: Locator.dragTo()](https://playwright.dev/docs/api/class-locator#locator-drag-to)
- [HTML5 拖放 API](https://developer.mozilla.org/zh-CN/docs/Web/API/HTML_Drag_and_Drop_API)
