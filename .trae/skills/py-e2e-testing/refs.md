# Playwright E2E Testing Best Practices

This document contains specific testing techniques and best practices for common UI operations.

## Table of Contents

- [Drag and Drop Operations](#drag-and-drop-operations)
- [Duplicate Submission Prevention](#duplicate-submission-prevention)
- [Database State Verification](#database-state-verification)
- [Test Timeouts](#test-timeouts)

---

## Drag and Drop Operations

For HTML5 drag and drop testing, use step-by-step mouse operations for better reliability.

### Recommended Approach (Most Reliable)

```typescript
// Step 1: Hover over the source element
await sourceElement.hover();
await page.waitForTimeout(100);

// Step 2: Press mouse button (start drag)
await page.mouse.down();
await page.waitForTimeout(100);

// Step 3: Move to target element
await targetElement.hover();
await page.waitForTimeout(100);

// Step 4: Release mouse button (complete drop)
await page.mouse.up();
await page.waitForTimeout(500);
```

### Why This Works Better Than `dragTo()`

- ✅ Better simulates real user behavior
- ✅ Gives application time to react between steps
- ✅ Triggers correct event sequence: `mousedown` → `mousemove` → `mouseup`
- ✅ Works with complex drag-and-drop libraries

### Alternative Using `dragTo()` (Simpler but Less Reliable)

```typescript
await sourceElement.dragTo(targetElement);
```

### Tips for Successful Drag and Drop

1. **Add delays between steps** (100-500ms) - Applications need time to process events
2. **Verify target element is visible and ready** - Use `waitForSelector` or `toBeVisible`
3. **Check for overlapping elements** - They might block the drop
4. **Take screenshots after each step** - For debugging failures
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
await page.waitForTimeout(100);

await page.mouse.down();
await page.waitForTimeout(100);

await firstCard.hover();
await page.waitForTimeout(100);

await page.mouse.up();
await page.waitForTimeout(500);

// Verify the tag was added
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
// ❌ Wrong: Playwright waits for element stability, may miss timing
await doneButton.click();
await doneButton.click();

// ✅ Correct: Trigger multiple clicks rapidly in browser
await page.evaluate(() => {
  const btn = document.getElementById('doneBtn');
  for (let i = 0; i < 5; i++) btn?.click();
});
```

### Verification Strategy

- ✅ Verify final state (e.g., database record count)
- ❌ Do not rely on intermediate state screenshots
- ✅ Verify through API that only one record was created

### Example

```typescript
// Trigger rapid clicks
await page.evaluate(() => {
  const btn = document.getElementById('submitBtn');
  for (let i = 0; i < 5; i++) btn?.click();
});

await page.waitForTimeout(1000);

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

---

## Test Timeouts

Set reasonable timeouts based on operation complexity.

### Timeout Guidelines

| Operation Type | Timeout | Example |
|---------------|---------|---------|
| Simple UI operations | 1000ms | Click, hover |
| Save operations | 3000ms | Form submission |
| File operations | 5000ms | File upload/download |
| Navigation | 5000ms | Page transitions |
| Network requests | 10000ms | API calls |

### Example

```typescript
// Simple UI operation
await page.click('#button');
await page.waitForTimeout(1000);

// Save operation
await page.click('#save');
await page.waitForTimeout(3000);

// File operation
await page.setInputFiles('#upload', 'file.txt');
await page.waitForTimeout(5000);
```

---

## References

- [Playwright Official Documentation](https://playwright.dev)
- [Playwright API: Locator.dragTo()](https://playwright.dev/docs/api/class-locator#locator-drag-to)
- [HTML5 Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
