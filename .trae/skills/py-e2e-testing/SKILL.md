---
name: "py-e2e-testing"
description: "E2E测试规范流程。Invoke when writing or debugging E2E tests. Requirements: 1) Understand code logic and DOM ID first 2) Take screenshots after each click 3) Verify page state before continuing"
---

# E2E Testing Standards

## Mandatory Process for Writing E2E Tests

### Phase 1: Understand the Code (Must Complete First)

Before writing any test code, you must:

1. **Find page navigation logic**
   - Search for relevant Manager files
   - Understand how pages open/close
   - Confirm when active class is added

2. **Confirm DOM element IDs**
   - Check HTML template files
   - Confirm IDs for buttons, input fields
   - Confirm basis for state determination

3. **Understand business logic**
   - What buttons display under what conditions
   - Prerequisites for page navigation
   - Completion indicators for async operations

### Phase 2: Write Tests

1. **Take screenshots after each key operation**
   ```typescript
   await page.screenshot({ path: `test-results/debug-${stepName}.png` });
   ```

2. **Verify page state**
   - Do not assume page has switched
   - Use waitForSelector to verify key elements
   - Set reasonable timeouts (1000ms)

3. **Execute step by step**
   - One operation at a time
   - Verify success before next step
   - Check screenshots to locate issues on failure

### Phase 3: Debug

1. **Review all screenshots**
   - Not just the last one
   - Trace the entire flow

2. **Analyze failure causes**
   - What page does the screenshot show?
   - Does the expected element exist?
   - Does the state match expectations?

## Special Cases

### Testing Duplicate Submission Prevention / Debounce

When testing duplicate submission prevention or debounce functionality:

1. **Use page.evaluate for rapid operations**
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

2. **Verification strategy**
   - Verify final state (e.g., database record count)
   - Do not rely on intermediate state screenshots
   - Verify through API that only one record was created

### Setting Test Timeouts

Set reasonable timeouts based on operation complexity:
- Simple UI operations: 1000ms
- Save operations: 3000ms
- File operations: 5000ms

### Database State Verification

E2E tests should verify database state through API, not just UI:
```typescript
const count = await page.evaluate(async () => {
  const records = await window.electronAPI.getRecords();
  return records.length;
});
expect(count).toBe(expectedCount);
```

## Prohibited Behaviors

- Do not write tests without understanding the code
- Do not assert without screenshots
- Do not only look at the last screenshot
- Do not assume page state without verification
