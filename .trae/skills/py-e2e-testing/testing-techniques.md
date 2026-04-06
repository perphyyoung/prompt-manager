# Playwright E2E Testing Techniques

Detailed techniques for common E2E testing scenarios.

---

## Drag and Drop Operations

For HTML5 drag and drop testing, use step-by-step mouse operations for better reliability.

### Recommended Approach (Most Reliable)

```typescript
// Step 1: Hover over the source element and verify it's ready
await sourceElement.hover();
await expect(sourceElement).toBeVisible({ timeout: 5000 });

// Step 2: Press mouse button (start drag)
await page.mouse.down();

// Step 3: Move to target element and verify it's ready
await targetElement.hover();
await expect(targetElement).toBeVisible({ timeout: 5000 });

// Step 4: Release mouse button (complete drop)
await page.mouse.up();

// Step 5: Verify drop result using explicit condition
await page.waitForFunction(async (tagName: string) => {
  const tags = await window.electronAPI.getAllTags();
  return tags.includes(tagName);
}, testTagName, { timeout: 5000 });
```

### Why This Works Better Than `dragTo()`

- Better simulates real user behavior
- Triggers correct event sequence: `mousedown` → `mousemove` → `mouseup`
- Works with complex drag-and-drop libraries
- Uses explicit verification instead of arbitrary delays

### Alternative Using `dragTo()` (Simpler but Less Reliable)

```typescript
await sourceElement.dragTo(targetElement);
```

### Tips for Successful Drag and Drop

1. **Verify elements are visible and ready** - Use `expect().toBeVisible()` before operations
2. **Check for overlapping elements** - They might block the drop
3. **Take screenshots after each step** - For debugging failures
4. **Use explicit result verification** - Don't rely on `waitForTimeout`
5. **If `dragTo()` fails, use step-by-step mouse operations** - More control and reliability

### Example: Tag Drag to Card

```typescript
// Find a tag that doesn't exist on the target card
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

// Execute drag and drop
await firstTag.hover();
await expect(firstTag).toBeVisible({ timeout: 5000 });

await page.mouse.down();

await firstCard.hover();
await expect(firstCard).toBeVisible({ timeout: 5000 });

await page.mouse.up();

// Verify the tag was added using explicit condition
await page.waitForFunction(async (id: string, tag: string) => {
  const image = await window.electronAPI.getImageById(id);
  return (image as IImage)?.tags?.includes(tag);
}, imageId, tagName, { timeout: 5000 });

// Final verification
const newTags = await page.evaluate(async (id) => {
  const image = await window.electronAPI.getImageById(id as string);
  return (image as IImage)?.tags || [];
}, imageId);

expect(newTags.length).toBeGreaterThan(originalTags.length);
expect(newTags).toContain(tagName);
```

---

## Duplicate Submission Prevention

When testing duplicate submission prevention or debounce functionality:

### Use page.evaluate for Rapid Operations

```typescript
// Wrong: Playwright waits for element stability, may miss timing
await doneButton.click();
await doneButton.click();

// Correct: Trigger multiple clicks rapidly in browser
await page.evaluate(() => {
  const btn = document.getElementById('doneBtn');
  for (let i = 0; i < 5; i++) btn?.click();
});
```

### Verification Strategy

- Verify final state (e.g., database record count)
- Do not rely on intermediate state screenshots
- Verify through API that only one record was created

### Example

```typescript
// Trigger rapid clicks
await page.evaluate(() => {
  const btn = document.getElementById('submitBtn');
  for (let i = 0; i < 5; i++) btn?.click();
});

// Wait for operation completion using explicit condition
await page.waitForFunction(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length > 0;
}, { timeout: 5000 });

// Verify only one record was created
const count = await page.evaluate(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length;
});

expect(count).toBe(1); // Should be 1, not 5
```

---

## Database State Verification

E2E tests should verify database state through API, not just UI.

### Example

```typescript
const count = await page.evaluate(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length;
});
expect(count).toBe(expectedCount);
```

### Best Practices

1. **Use API calls** - More reliable than UI assertions
2. **Verify data integrity** - Check actual database state
3. **Don't rely solely on UI** - UI might not reflect true state immediately
4. **Use waitForFunction for async operations** - Poll until condition is met

---

## Reliable Waiting Strategies

**NEVER use `waitForTimeout()` for waiting in tests.** It creates flaky tests and slows execution.

### Use Explicit Conditions Instead

| Scenario | Recommended Method | Example |
|----------|-------------------|---------|
| API call completion | `waitForFunction` | `await page.waitForFunction(async () => { ... }, { timeout: 5000 })` |
| Modal open/close | `waitForSelector` with state | `await page.waitForSelector('#modal', { state: 'hidden', timeout: 5000 })` |
| Element visibility | `expect().toBeVisible()` | `await expect(page.locator('.item')).toBeVisible({ timeout: 5000 })` |
| Text content | `waitForSelector` with `:has-text` | `await page.waitForSelector('#toast:has-text("Done")', { timeout: 5000 })` |
| Navigation complete | `waitForURL` or `waitForLoadState` | `await page.waitForURL('/dashboard', { timeout: 5000 })` |

### Examples

#### Waiting for API Operation

```typescript
// Wrong: Arbitrary delay
await page.click('#createTag');
await page.waitForTimeout(2000);

// Correct: Poll until condition is met
await page.click('#createTag');
await page.waitForFunction(async (tagName: string) => {
  const tags = await window.electronAPI.getAllTags();
  return tags.includes(tagName);
}, testTagName, { timeout: 5000 });
```

#### Waiting for Modal to Close

```typescript
// Wrong: Arbitrary delay
await page.click('#closeModal');
await page.waitForTimeout(1000);

// Correct: Wait for specific state
await page.click('#closeModal');
await page.waitForSelector('#modalId', { state: 'hidden', timeout: 5000 });
```

#### Waiting for Element to Appear

```typescript
// Wrong: Arbitrary delay
await page.click('#loadData');
await page.waitForTimeout(3000);
const item = page.locator('.data-item');

// Correct: Wait for element with timeout
await page.click('#loadData');
const item = page.locator('.data-item');
await expect(item).toBeVisible({ timeout: 5000 });
```

#### Waiting for Text Content

```typescript
// Wrong: Arbitrary delay
await page.click('#save');
await page.waitForTimeout(2000);
const toastText = await page.locator('#toast').textContent();
expect(toastText).toContain('Saved');

// Correct: Wait for specific text
await page.click('#save');
await page.waitForSelector('#toast:has-text("Saved")', { timeout: 5000 });
```

---

## References

- [Playwright Official Documentation](https://playwright.dev)
- [Playwright API: Locator.dragTo()](https://playwright.dev/docs/api/class-locator#locator-drag-to)
- [HTML5 Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
