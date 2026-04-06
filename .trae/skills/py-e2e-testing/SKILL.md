---
name: py-e2e-testing
description: Use when writing or debugging E2E tests with Playwright. Symptoms include flaky tests, race conditions, timing dependencies, or need to verify UI interactions through screenshots and state checks.
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
   - **NEVER use `waitForTimeout` for waiting** - use explicit conditions instead
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
       await page.waitForSelector('#imagePanel.active', { timeout: 5000 });
       await page.click('#imageGridViewBtn');
       await page.waitForSelector('#imageGridView.active', { timeout: 5000 });
       const firstCard = page.locator('.image-card').first();
       await expect(firstCard).toBeVisible({ timeout: 5000 });
       return firstCard;
     }
     ```

4. **Execute step by step**
   - One operation at a time
   - Verify success before next step
   - Check screenshots to locate issues on failure

5. **Use Electron log API for test logging**
   - Use `window.electronAPI.logInfo()` to record test logs to `pm.log`
   - Example:
     ```typescript
     await page.evaluate((params) => {
       window.electronAPI.logInfo('E2E-Test', 'Test operation', {
         param1: params.value1,
         param2: params.value2
       });
       // ... test logic
     }, testData);
     ```
   - Logs will be written to `./pm.log`
   - Use logs for debugging instead of `console.log` in production tests

6. **Add explicit type annotations**
   - All `.evaluate()` callbacks must have explicit parameter types
   - Example:
     ```typescript
     // ❌ Wrong: implicit 'any' type
     await element.evaluate(el => el.classList.contains('active'));
     
     // ✅ Correct: explicit HTMLElement type
     await element.evaluate((el: HTMLElement) => el.classList.contains('active'));
     ```

7. **Run type checking before testing**
   - Verify test file passes TypeScript type checking BEFORE running tests:
     ```bash
     npx tsc --noEmit e2e/<test-file>.spec.ts
     ```
   - Fix all type errors first
   - This ensures test script correctness before execution

8. **Type check after every modification**
   - After making ANY changes to test code:
     1. Run `npx tsc --noEmit` to verify type correctness
     2. Only run tests after type checking passes
   - Workflow:
     ```
     Modify code → Type check → Fix errors (if any) → Run tests
     ```
   - This prevents wasting time running tests with type errors

### Phase 3: Automated Test Verification

After writing E2E tests, you must run automated verification:

1. **Run failed tests first** (when debugging)
   - Use `--grep` to run only the failed test:
     ```bash
     npx playwright test e2e/<test-file>.spec.ts --grep "Test Name" --reporter=list
     ```
   - Fix the issue and verify it passes
   - Then run all tests to ensure no regressions

2. **Run all tests** (after fixes or initial write)
   ```bash
   npx playwright test e2e/<test-file>.spec.ts --reporter=list
   ```

3. **Verify all tests pass**
   - All tests should show "✓" (passed)
   - No "✘" (failed) or "−" (skipped) without reason
   - Check test duration is reasonable (< 30s per test)

4. **Handle test failures**
   - Review error messages
   - Check screenshots in `test-results/` directory
   - Fix issues in code or test, not workarounds
   - Re-run until all pass

5. **Document test results**
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
   - **If thinking process contains words like "可能", "maybe", "probably", "should be", or similar uncertain terms, STOP and re-examine the code. DO NOT proceed with assumptions - verify actual code behavior first.**

4. **Fix and re-verify**
   - Fix the root cause in code or test
   - Return to Phase 3 to re-run verification
   - Do not proceed until all tests pass

### Phase 5: Test Preparation (Before Running Tests)

Before running E2E tests, prepare the environment:

1. **Clear pm.log file (not delete)**
   - Empty the contents of `pm.log` file instead of deleting it
   - This ensures a clean log for debugging while keeping the file handle
   - Example:
     ```powershell
     # Windows PowerShell
     Clear-Content pm.log
     ```

2. **Verify build is up to date**
   - Run `npm run build` to ensure latest code is compiled
   - Check for any build errors before testing

## Reliable Verification (NO Arbitrary Wait Times)

**NEVER extend wait times as a fix for flaky tests.** This masks real issues and slows down tests.

### The Wrong Way (Prohibited)
```typescript
// ❌ WRONG: Extending wait time without understanding why
await page.waitForTimeout(2000); // Was 500ms, increased because "it might help"
```

### The Right Way (Required)

Use explicit wait conditions based on code research:

```typescript
// ✅ CORRECT: Use waitForFunction to poll for state change
// Best for: API calls, data persistence, async operations
await page.waitForFunction(async (tagName: string) => {
  const tags = await window.electronAPI.getAllTags();
  return tags.includes(tagName);
}, testTagName, { timeout: 5000 });

// ✅ CORRECT: Use waitForSelector with state
// Best for: Modal dialogs, panels, visibility changes
await page.waitForSelector('#imageTagManagerModal', { state: 'hidden', timeout: 5000 });

// ✅ CORRECT: Use expect with toBeVisible
// Best for: Elements that should appear after operation
await expect(page.locator('.tag-filter-item[data-tag="newTag"]')).toBeVisible({ timeout: 5000 });

// ✅ CORRECT: Use waitForSelector with has-text
// Best for: Toast messages, notifications
await page.waitForSelector('#toastContainer:has-text("标签已创建")', { timeout: 5000 });
```

### Choosing the Right Method

| Scenario | Recommended Method | Why |
|----------|-------------------|-----|
| API call completion | `waitForFunction` | Polls until condition met, no arbitrary delays |
| Modal open/close | `waitForSelector` with state | Waits for specific DOM state |
| Element visibility | `expect().toBeVisible()` | Playwright's built-in retry |
| Text content | `waitForSelector` with `:has-text` | Waits for specific text to appear |
| Navigation complete | `waitForURL` or `waitForLoadState` | Playwright's navigation helpers |

### When Tests Fail

1. **DO NOT** increase `waitForTimeout` values
2. **DO** examine the actual code to understand:
   - What event signals operation completion?
   - What DOM change indicates success?
   - What API can verify the state change?
3. **DO** use explicit wait conditions based on code research
4. **DO** verify the fix works reliably across multiple runs

## Special Cases

### Testing Duplicate Submission Prevention / Debounce

When testing duplicate submission prevention or debounce functionality, use `page.evaluate` for rapid operations and verify through API.

**See detailed guide:** [Duplicate Submission Prevention](testing-techniques.md#duplicate-submission-prevention)

---

## Testing Techniques Reference

For specific testing techniques and best practices, see **[testing-techniques.md](testing-techniques.md)**:

- **[Drag and Drop Operations](testing-techniques.md#drag-and-drop-operations)** - Step-by-step mouse operations for reliable drag and drop
- **[Duplicate Submission Prevention](testing-techniques.md#duplicate-submission-prevention)** - Testing debounce and duplicate prevention
- **[Database State Verification](testing-techniques.md#database-state-verification)** - Verifying data through API
- **[Reliable Waiting Strategies](testing-techniques.md#reliable-waiting-strategies)** - Explicit wait conditions instead of arbitrary delays

---

## Prohibited Behaviors

- Do not write tests without understanding the code
- Do not assert without screenshots
- Do not only look at the last screenshot
- Do not assume page state without verification
- Do not skip automated test verification

## Test Cleanup (After All Tests Pass)

After all tests pass, clean up debugging code:

1. **Remove all debug logging**
   - Delete all `console.log()` statements
   - Delete all `window.electronAPI.logInfo()` calls used for debugging
   - Keep only production logging if absolutely necessary
   - Example:
     ```typescript
     // ❌ Before cleanup
     console.log(`Debug: ${value}`);
     window.electronAPI.logInfo('E2E-Test', 'Test step', data);
     
     // ✅ After cleanup
     // (no logging for simple test assertions)
     ```

2. **Remove unnecessary test logic**
   - Simplify complex workarounds that were only for debugging
   - Keep only the essential test assertions

3. **Re-run full test suite**
   - Ensure cleanup didn't break any tests
   - Verify all tests still pass after cleanup

4. **Final type checking verification**
   - Run `npx tsc --noEmit` on the entire project
   - Ensure no type errors remain
