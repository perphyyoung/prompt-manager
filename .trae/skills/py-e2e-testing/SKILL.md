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

3. **Navigate to target interface according to actual logic**
   - Do not assume the test starts at the target interface
   - Explicitly write steps to enter the target interface in test comments
   - Use helper functions to encapsulate navigation logic
   - Example:
     ```typescript
     /**
      * Enter image grid view helper function
      * Steps to enter target interface:
      * 1. Click #imageManagerBtn to switch to image panel
      * 2. Click #imageGridViewBtn to ensure grid view
      * 3. Wait for .image-card elements to be visible
      */
     async function enterImageGridView(page: any) {
       await page.click('#imageManagerBtn');
       await page.waitForTimeout(500);
       await page.click('#imageGridViewBtn');
       await page.waitForTimeout(500);
       const firstCard = page.locator('.image-card').first();
       await expect(firstCard).toBeVisible({ timeout: 5000 });
       return firstCard;
     }
     ```

4. **Execute step by step**
   - One operation at a time
   - Verify success before next step
   - Check screenshots to locate issues on failure

### Phase 3: Automated Test Verification

After writing E2E tests, you must run automated verification:

1. **Run all tests**
   ```bash
   npx playwright test e2e/<test-file>.spec.ts --reporter=list
   ```

2. **Verify all tests pass**
   - All tests should show "✓" (passed)
   - No "✘" (failed) or "−" (skipped) without reason
   - Check test duration is reasonable (< 30s per test)

3. **Handle test failures**
   - Review error messages
   - Check screenshots in `test-results/` directory
   - Fix issues in code or test, not workarounds
   - Re-run until all pass

4. **Document test results**
   - Report total passed/failed count
   - List any skipped tests with reasons
   - Note any fixes made during verification

### Phase 4: Debug (When Tests Fail)

When automated verification reveals failures:

1. **Review all screenshots**
   - Not just the last one
   - Trace the entire flow

2. **Analyze failure causes**
   - What page does the screenshot show?
   - Does the expected element exist?
   - Does the state match expectations?

3. **Re-examine the code - DO NOT GUESS**
   - When tests fail, you MUST re-examine the relevant source code
   - Do not assume "it might be X" and apply workarounds
   - Go back to Phase 1: read the actual implementation code
   - Verify DOM structure, field names, data flow
   - Only fix after understanding the real cause

4. **Fix and re-verify**
   - Fix the root cause in code or test
   - Return to Phase 3 to re-run verification
   - Do not proceed until all tests pass

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
- Do not skip automated test verification
