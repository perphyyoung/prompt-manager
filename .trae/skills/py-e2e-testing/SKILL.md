---
name: py-e2e-testing
description: Use when writing or debugging E2E tests with Playwright. Symptoms include flaky tests, race conditions, timing dependencies, or need to verify UI interactions through screenshots and state checks.
---

# E2E Testing Standards

## MUST FOLLOW - Critical Rules

These rules are **ABSOLUTE REQUIREMENTS** - no exceptions allowed:

1. **Use Electron log API for test logging**
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

2. **Log test item description before each test**

   ```typescript
   // ✅ CORRECT: Use Electron log API to log test description
   test('should create new prompt', async ({ page }) => {
     await page.evaluate(() => {
       window.electronAPI.logInfo('E2E-Test', 'Starting test: Create new prompt - Verifies prompt creation flow');
     });
     // ... test code
   });
   ```

   - This helps quickly identify which test is running in logs
   - Use `window.electronAPI.logInfo()` as specified in Rule 1

   **Use ElectronTestHelper's logTestStart method**

   ```typescript
   import { createElectronTest } from './electron-test.ts';

   const electronTest = createElectronTest();

   test('should create new prompt', async () => {
     await electronTest.logTestStart('Create new prompt');
     // ... test code
   });
   ```

3. **ALWAYS use Constants.Ids for DOM element selectors**

   ```typescript
   // ❌ WRONG: Hardcoded ID - prone to errors when source changes
   await page.click('#selectModalOkBtn');

   // ✅ CORRECT: Use Constants.Ids - ensures consistency with source code
   await page.click(`#${Constants.Ids.SELECT_MODAL_OK_BTN}`);
   ```

   - Source code uses `Constants.Ids.Xxx` for type safety
   - Test code must use the same constants to maintain consistency
   - If the constant doesn't exist, check `src/constants.ts` and use the actual ID defined there
   - **For `waitForFunction` and `page.evaluate`**: Pass constants as parameters since they run in browser context

     ```typescript
     // ❌ WRONG: Constants not available in browser context
     await page.waitForFunction(() => {
       const items = document.querySelectorAll(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item`);
       return items.length > 0;
     });

     // ✅ CORRECT: Pass constant value as parameter
     await page.waitForFunction(
       (containerId: string) => {
         const items = document.querySelectorAll(`#${containerId} .tag-manager-item`);
         return items.length > 0;
       },
       Constants.Ids.IMAGE_TAG_GROUP_CARDS  // Pass constant as parameter
     );
     ```

4. **NEVER delete non-test data in E2E tests**
   - Always create test data first, then delete only the test data
   - Use search + select pattern to target only test-created items

5. **NEVER use `waitForTimeout` for waiting**
   - Use explicit conditions instead (waitForSelector, waitForFunction, etc.)
   - See "Reliable Verification" section below for correct patterns

6. **Use shared helper functions from `e2e/electron-test.ts`**
   - Import and reuse existing helper functions instead of duplicating code
   - Available helper categories:
     - **ElectronTestHelper class**: `launch()`, `close()`, `getPage()`, `waitForSelector()`, `click()`, `getText()`, `exists()`, `wait()`, `screenshot()`, `logTestStart()`
     - **Tag Manager helpers**: `enterImageTagManager()`, `enterPromptTagManager()`, `createImageTagInManager()`, `createPromptTagInManager()`, `createImageTagGroup()`, `createPromptTagGroup()`, etc.
     - **View Navigation helpers**: `enterImageGridView()`, `enterPromptGridView()`, `enterImageListView()`, `enterPromptListView()`
     - **Detail View helpers**: `openImageDetail()`, `openPromptDetail()`, `enterImageDetailView()`, `enterPromptDetailView()`
     - **Database helpers**: `getImageFromDatabase()`, `getPromptFromDatabase()`, `getFirstImageId()`, `getFirstPromptId()`
     - **Tag Filter helpers**: `ensureTagFilterExpanded()`
   - See full documentation: [e2e-测试共享辅助函数库.md](e2e-测试共享辅助函数库.md)
   - **When adding new shared functions**: First add to `e2e/electron-test.ts`, then update `e2e-测试共享辅助函数库.md`

   ```typescript
   // ✅ CORRECT: Import and reuse helper functions
   import { createElectronTest, enterImageGridView, getImageFromDatabase } from './electron-test.ts';

   const electronTest = createElectronTest();
   await electronTest.launch();
   const page = electronTest.getPage();
   const firstCard = await enterImageGridView(page);
   ```

7. Safe Delete Patterns (MUST FOLLOW)

When implementing ANY delete operations in E2E tests, you MUST follow these patterns to prevent accidental deletion of non-test data.

### 7.1 Safe Single Delete Pattern

For deleting a single item by clicking its delete button:

```typescript
// ✅ CORRECT: Safe single delete pattern
const testTagName = generateTestTagName('single_delete');

// Create test data
await createImageTagInManager(page, testTagName);

// Search to filter and locate the specific tag
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, testTagName);

// CRITICAL: Verify search returns exactly 1 result and matches our tag
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    // Must be exactly 1 item AND it must be our test tag
    return items.length === 1 && 
           items[0].getAttribute('data-tag') === params.tagName;
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: testTagName },
  { timeout: 5000 }
);

// Click delete button on the SPECIFIC tag
const deleteBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName}"] .tag-delete-btn`);
await deleteBtn.click();

// Confirm deletion
await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

// Verify deletion via API
await page.waitForFunction(async (name: string) => {
  const tags = await window.electronAPI.getImageTags();
  return !tags.includes(name);
}, testTagName, { timeout: 5000 });
```

### 7.2 Safe Batch Delete Pattern

For batch deleting multiple items:

```typescript
// ✅ CORRECT: Safe batch delete pattern
const searchKeyword = 'persist_test';  // Use specific test prefix
const tagName1 = generateTestTagName(searchKeyword);  // e2e_persist_test_xxx
const tagName2 = generateTestTagName(searchKeyword);
const otherTagName = generateTestTagName('other');  // Control group (not matching search)

// Create test data
await createImageTagInManager(page, tagName1);
await createImageTagInManager(page, tagName2);
await createImageTagInManager(page, otherTagName);  // Will NOT be deleted

// Search with specific keyword
await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, searchKeyword);

// CRITICAL: Wait for search to filter AND verify all visible items match search
await page.waitForFunction(
  (params: { containerId: string; keyword: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    // Must verify: 1) expected count, 2) ALL items contain search keyword
    return items.length >= 2 && Array.from(items).every(item =>
      item.getAttribute('data-tag')?.includes(params.keyword)
    );
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, keyword: searchKeyword },
  { timeout: 5000 }
);

// Enter batch mode and select all
await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);
await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
await batchToolbar.locator('.batch-action-select-all').click();

// CRITICAL: Verify selected items before delete
await page.waitForFunction(async (keyword: string) => {
  const checkedBoxes = document.querySelectorAll('.tag-batch-checkbox:checked');
  const selectedTags = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-tag'));
  // Safety check: all selected tags must contain search keyword
  return selectedTags.every(tag => tag?.includes(keyword));
}, searchKeyword, { timeout: 5000 });

// Execute delete
await batchToolbar.locator('.batch-action-delete').click();
await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

// Verify deletion via API
await page.waitForFunction(async (names: string[]) => {
  const tags = await window.electronAPI.getImageTags();
  return !tags.includes(names[0]) && !tags.includes(names[1]);
}, [tagName1, tagName2], { timeout: 5000 });

// CRITICAL: Verify control group (otherTagName) still exists
await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
await page.waitForFunction(
  (params: { containerId: string; tagName: string }) => {
    const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
    return Array.from(items).some(item => item.getAttribute('data-tag') === params.tagName);
  },
  { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: otherTagName },
  { timeout: 5000 }
);
await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`)).toBeVisible({ timeout: 5000 });
```

### 7.3 Critical Safety Requirements

**⚠️ WARNING: Skipping any of these steps may result in data loss!**

1. **Use specific search keywords**: Create tags with unique test prefixes (e.g., `persist_test`, `e2e_drag_drop`)
   - NEVER use broad keywords like `'e2e'` alone
   - Use timestamp or UUID to ensure uniqueness: `e2e_test_${Date.now()}`

2. **Create control group**: **MANDATORY** - Always create at least one tag that does NOT match the search keyword
   - This is your safety net to verify filtering worked correctly
   - Without control group, you cannot detect if filtering failed

3. **Verify search filtering**: Wait for search to complete AND verify ALL visible items contain the search keyword
   - Check both count AND content
   - Use `.every()` to ensure ALL items match

4. **Verify selection before delete**: Double-check that all selected items match the search criteria
   - Query selected checkboxes and verify their data-tag attributes
   - Throw error if any non-matching tag is selected

5. **Verify control group survives**: After deletion, clear search and verify the control group tag still exists
   - This confirms only intended items were deleted
   - If control group is missing, the test has a bug

### 7.4 Anti-patterns (NEVER DO THIS)

```typescript
// ❌ WRONG: Dangerous batch delete - may delete all data
await searchInput.fill('e2e');  // Too broad, may match everything
await page.waitForFunction(() => {
  const items = document.querySelectorAll('.tag-manager-item');
  return items.length >= 0;  // Always true, no actual verification!
});
await page.click('.batch-action-select-all');  // May select ALL tags
await page.click('.batch-action-delete');  // DANGER: Deletes everything!

// ❌ WRONG: No control group - cannot verify safety
const testTag = generateTestTagName('test');
await createImageTagInManager(page, testTag);
await searchInput.fill('test');
await page.click('.batch-action-select-all');
await page.click('.batch-action-delete');  // If filtering failed, deletes everything!

// ❌ WRONG: Not verifying selection before delete
await searchInput.fill(searchKeyword);
await page.click('.batch-action-select-all');
// No verification of what was selected!
await page.click('.batch-action-delete');
```

**Reference Implementations:**

- Single delete: `e2e/9-tag-manager.spec.ts` (删除标签测试)
- Batch delete with control group: `e2e/10-tag-manager-search-persist.spec.ts`

## Prohibited Behaviors

- Do not write tests without understanding the code
- Do not assert without screenshots
- Do not only look at the last screenshot
- Do not assume page state without verification
- Do not skip automated test verification

---

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

5. **Add explicit type annotations**
   - All `.evaluate()` callbacks must have explicit parameter types
   - Example:

     ```typescript
     // ❌ Wrong: implicit 'any' type
     await element.evaluate(el => el.classList.contains('active'));

     // ✅ Correct: explicit HTMLElement type
     await element.evaluate((el: HTMLElement) => el.classList.contains('active'));
     ```

6. **Run type checking before testing**
   - Verify test file passes TypeScript type checking BEFORE running tests:

     ```bash
     npx tsc --noEmit e2e/<test-file>.spec.ts
     ```

   - Fix all type errors first
   - This ensures test script correctness before execution

7. **Type check after every modification**
   - After making ANY changes to test code:
     1. Run `npx tsc --noEmit` to verify type correctness
     2. Only run tests after type checking passes
   - Workflow:

     ```plain
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
   - Run `npx tsc --noEmit; npm run build` to ensure no type error and latest code is compiled
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

## Test Cleanup (After All Tests Pass)

After all tests pass, clean up debugging code:

1. **Remove unnecessary test logic**
   - Simplify complex workarounds that were only for debugging
   - Keep only the essential test assertions

2. **Re-run full test suite**
   - Ensure cleanup didn't break any tests
   - Verify all tests still pass after cleanup

3. **Final type checking verification**
   - Run `npx tsc --noEmit` on the entire project
   - Ensure no type errors remain
