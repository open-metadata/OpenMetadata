---
name: playwright-validation
description: Use when validating UI changes in a branch require Playwright E2E testing. Reviews branch changes, validates UI with Playwright MCP, and adds missing test cases.
---

# Playwright Validation Skill

This skill guides you through validating UI changes and ensuring comprehensive Playwright E2E test coverage.

## When to Use

- After completing UI feature development
- Before creating a PR for UI changes
- When reviewing UI-related branches
- To verify existing Playwright tests cover all scenarios

## Workflow

### Phase 1: Review Branch Changes

1. **Identify changed files vs main:**
   ```bash
   git diff main --stat
   git diff main --name-only | grep -E "\.(tsx?|less|css|scss)$"
   ```

2. **Focus on UI component changes:**
   ```bash
   git diff main -- "openmetadata-ui/src/main/resources/ui/src/components/**" --stat
   ```

3. **Check for existing Playwright tests:**
   ```bash
   git diff main --name-only | grep -E "playwright.*\.spec\.ts$"
   ```

4. **Read the changed component files** to understand the UI modifications

### Phase 2: Review Existing Playwright Tests

1. **Locate relevant test files:**
   - Check `playwright/e2e/Pages/` for page-level tests
   - Check `playwright/e2e/Features/` for feature-specific tests
   - Use Glob/Grep to find tests related to the feature

2. **Analyze test coverage:**
   - Read the existing test file(s)
   - Identify the test scenarios already covered
   - Note any gaps in coverage based on the UI changes

3. **Review test utilities:**
   - Check `playwright/utils/` for helper functions
   - Check `playwright/support/` for entity classes and fixtures

### Phase 3: Validate with Playwright MCP

1. **Start the browser and navigate:**
   ```
   mcp__playwright__browser_navigate to http://localhost:8585
   ```

2. **Authenticate if needed:**
   - Use `mcp__playwright__browser_fill_form` for login
   - Default admin: `admin@open-metadata.org` / `admin`

3. **Navigate to the feature area:**
   - Use `mcp__playwright__browser_click` for navigation
   - Use `mcp__playwright__browser_snapshot` to inspect page state

4. **Validate UI behavior:**
   - Test the main user flows
   - Verify visual elements (icons, badges, labels)
   - Check interactive elements (buttons, dropdowns, forms)
   - Verify state changes and API calls

5. **Document findings:**
   - Note what works correctly
   - Identify any issues or missing functionality
   - List scenarios not covered by existing tests

### Phase 4: Add Missing Test Cases

1. **Create a TodoWrite checklist** of missing test scenarios

2. **For each missing test case:**

   a. **Add necessary test fixtures** in `beforeAll`:
      - Create new entity instances (TableClass, DataProduct, etc.)
      - Set up required relationships (domains, assets)

   b. **Add cleanup** in `afterAll`:
      - Delete created entities in reverse order

   c. **Write the test** following the pattern:
      ```typescript
      test('Descriptive Test Name - What it validates', async ({ page }) => {
        test.setTimeout(300000);

        await test.step('Step description', async () => {
          // Test actions and assertions
        });

        await test.step('Next step', async () => {
          // More actions and assertions
        });
      });
      ```

3. **Test patterns to cover:**
   - Happy path (expected behavior)
   - Edge cases (empty states, max values)
   - Error handling (invalid inputs, failed requests)
   - State transitions (before/after actions)
   - UI feedback (loading states, success/error messages)
   - Permissions (disabled buttons, restricted actions)

4. **Run lint check:**
   ```bash
   yarn eslint playwright/e2e/Pages/YourTest.spec.ts
   ```

## Common Test Utilities

### Navigation
```typescript
import { sidebarClick } from '../../utils/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { selectDataProduct, selectDomain } from '../../utils/domain';
```

### Waiting
```typescript
import { waitForAllLoadersToDisappear } from '../../utils/entity';
await page.waitForLoadState('networkidle');
await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
```

### API Responses
```typescript
const response = page.waitForResponse('/api/v1/endpoint*');
await someAction();
await response;
expect((await response).status()).toBe(200);
```

### Assertions
```typescript
await expect(page.getByTestId('element')).toBeVisible();
await expect(page.getByTestId('element')).toContainText('text');
await expect(page.locator('.class')).not.toBeVisible();
```

## Checklist Before Completion

- [ ] All UI changes have corresponding test coverage
- [ ] Tests cover both positive and negative scenarios
- [ ] Tests verify visual indicators (icons, badges, states)
- [ ] Tests validate API interactions
- [ ] Lint check passes with no errors
- [ ] Test fixtures are properly created and cleaned up
- [ ] Test timeouts are appropriate (300000ms for complex tests)

## Example: Data Contract Inheritance Tests

For reference, see the comprehensive test coverage in:
`playwright/e2e/Pages/DataContractInheritance.spec.ts`

This file demonstrates:
- Multiple entity setup in beforeAll
- Domain assignment patches
- Contract creation and validation
- Inheritance icon verification
- Action button state verification (disabled/enabled)
- API response validation (POST vs PATCH)
- Fallback behavior testing
