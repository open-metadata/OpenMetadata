# OpenMetadata Playwright Testing Handbook

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Standards to Follow](#test-standards-to-follow)
- [API Setups for Test Data](#api-setups-for-test-data)
- [Locator Priority Order](#locator-priority-order)
- [Anti-Flakiness Patterns](#anti-flakiness-patterns)
- [Test Timeouts](#test-timeouts)
- [Test File Structure Template](#test-file-structure-template)
- [Common Test Patterns](#common-test-patterns)
- [Visual Snapshot Testing](#visual-snapshot-testing)
- [Support Classes Reference](#support-classes-reference)
- [Domain Tags](#domain-tags)
- [ESLint Enforcement](#eslint-enforcement)
- [Validation Checklist](#validation-checklist)

---

## Testing Philosophy

We adopt a user-centric approach to testing that focuses on behavior rather than implementation.

### Avoid Testing Implementation Details

**Implementation details** are things which users of your code will not typically use, see, or even know about. Testing them leads to:

1. **False Negatives**: Tests break when you refactor code, even though the application still works correctly. This leads to brittle tests that require constant maintenance.

2. **False Positives**: Tests pass even when the application is broken, because they're not testing what users actually experience.

#### Example: False Negative (Bad Test)

```typescript
// ❌ BAD: Testing implementation details
test('accordion state changes correctly', async ({ page }) => {
  // This test accesses internal state - it will break if we rename the state variable
  const accordion = await page.evaluate(() => {
    const component = document.querySelector('[data-testid="accordion"]');
    return component.__reactInternalState.openIndex; // Testing internal state!
  });
  expect(accordion).toBe(0);
});

// ✅ GOOD: Testing user-visible behavior
test('accordion shows content when clicked', async ({ page }) => {
  // Test what the user actually sees and does
  await expect(page.getByText('Section 1 Content')).toBeVisible();
  await expect(page.getByText('Section 2 Content')).not.toBeVisible();
  
  await page.getByRole('button', { name: 'Section 2' }).click();
  
  await expect(page.getByText('Section 2 Content')).toBeVisible();
});
```

#### Example: False Positive (Bad Test)

```typescript
// ❌ BAD: Test passes but doesn't catch broken functionality
test('setOwner function exists', async ({ page }) => {
  // This only checks the function exists, not that it's wired up correctly
  const hasFunction = await page.evaluate(() => {
    return typeof window.setOwner === 'function';
  });
  expect(hasFunction).toBe(true);
  // Bug: Button onClick might not call setOwner - test still passes!
});

// ✅ GOOD: Test verifies actual user flow
test('user can set table owner', async ({ page }) => {
  await page.goto('/table/my-table');
  await page.getByTestId('edit-owner-button').click();
  await page.getByTestId('owner-select').fill('John Doe');
  await page.getByText('John Doe').click();
  await page.getByTestId('save-button').click();
  
  // Verify the owner is actually displayed
  await expect(page.getByTestId('owner-value')).toHaveText('John Doe');
});
```

### The Single User Principle (E2E)

In E2E testing, there is only one user to consider: **the end user**.

- They navigate to URLs
- They click buttons and fill forms
- They read text and see visual feedback
- They don't know or care about React components, state management, or API internals

**Your E2E tests should only do what end users can do** — interact with the browser and verify what's visible on screen.

### The Golden Rule

> *"The more your tests resemble the way your software is used, the more confidence they can give you."*

**Do:**
- Test user-visible behavior and outcomes
- Interact with elements the way users would (click buttons, fill forms, read text)
- Assert on what users see and experience

**Don't:**
- Test internal state or implementation details
- Access component instances or internal methods
- Rely on component/function names that might change during refactoring

#### Example: Testing Like a User

```typescript
// ❌ BAD: Testing implementation
test('form validation state updates', async ({ page }) => {
  // Checking internal validation state
  const isValid = await page.evaluate(() => formComponent.isValid);
  expect(isValid).toBe(false);
});

// ✅ GOOD: Testing user experience
test('form shows error when email is invalid', async ({ page }) => {
  await page.getByLabel('Email').fill('invalid-email');
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Assert on what user sees
  await expect(page.getByText('Please enter a valid email')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
});
```

### Making Tests Resilient to Change

Use stable selectors that won't change with visual updates. Prefer `data-testid` attributes for elements that need to be tested but have no natural accessible selector. Avoid selecting by class names, tag names, or CSS structure.

> See **[Locator Priority Order](#locator-priority-order)** for detailed guidelines and examples.

---

## Test Standards to Follow

1. **Descriptive Names**: Use clear, descriptive test names that explain the expected behaviour

2. **Global Setup Utilisation**: Setups/operations commonly used across multiple test files should be moved to global setups/fixtures. Ex. `auth.setup.ts`, `entity-data.setup.ts`, `playwright/e2e/fixtures/pages.ts`.
    - `auth.setup.ts` -> Used for signing in of users with different roles, which can be used in all tests.
    - `entity-data.setup.ts` -> Each type of data asset is created to avoid the data creation in each test file. `Note: No edit/delete operations should be performed on these assets since it can impact the other tests. For such cases asset creation should be performed separately for that test in beforeAll.`
    - `playwright/e2e/fixtures/pages.ts` -> contains fixture-based setup of logged-in pages for users with different roles like admin, data consumer, data steward, etc. These pages can be directly used in the specs by using the exported `test` from the file.

3. **Test Setups via API**: Setup operations should be handled via API rather than UI — see **[API Setups for Test Data](#api-setups-for-test-data)** for detailed patterns and examples.

4. **Nested Describe Blocks and Setup Hooks**: When using `beforeAll` hooks inside nested `describe` blocks, follow these guidelines. Setup-hooks execute from outer to inner scope

```typescript
describe('Outer describe', () => {
  beforeAll(async () => {
    // Executes before all the tests inside inner describe 1 & 2
    // Only common/expensive setups that are necessary for both the describe blocks should come in here.
  });

  describe('Inner describe 1', () => {
    beforeAll(async () => {
      // Executes before all tests inside inner describe 1
    });
  });

  describe('Inner describe 2', () => {
    beforeAll(async () => {
      // Executes before all tests inside inner describe 2
    });
  });
});
```

5. **Proper Selectors**: See **[Locator Priority Order](#locator-priority-order)** for selector guidelines.

6. **Proper Waits**: Add proper waits before actions that are dependent on any async operations. Always prefer `API awaits` if any action demands or results in a particular API call.

Ex. wait on API/elements/loaders
```typescript
// Wait for API response.
await page.waitForResponse(response => 
  response.url().includes('/api/v1/tables') && response.status() === 200
);

// Wait for specific elements
await expect(page.getByTestId('success-message')).toBeVisible();

// Wait for loader to disappear
await page.waitForSelector('[data-testid="Loader"]', { state: 'hidden' });

// Use custom wait utilities
await waitForAllLoadersToDisappear(page);
```

7. **API Awaits**: While putting waits on the API calls, keep the following things in check.
    1. The APIs should be as specific as possible.
    Ex. prefer `/api/table/name/${tableName}*` than `/api/table/name/*`

    2. Avoid some common parameters or their values in the API unless they are necessary.
    Ex. prefer `/api/tables?*` than `/api/tables?limit=12&include=deleted` since the parameter values or order may change in future. 
    `Note: Exception would be when we are intentionally waiting on something, like '/api/tables?*filter=new*' after applying some filter.`

---

## API Setups for Test Data

### Why Use API for Test Setup?

Using API calls instead of UI interactions for test setup provides:
- **Speed**: API calls are significantly faster than navigating through UI
- **Reliability**: Less prone to flakiness from UI animations, loading states, or timing issues
- **Focus**: Tests focus on what they're actually testing, not setup steps

### Best Practices

1. **Create test data via API in `beforeAll`/`beforeEach` hooks**:
```typescript
describe('Table operations', () => {
  let testTable: Table;
  
  beforeAll(async ({ apiContext }) => {
    // Create test data via API
    testTable = await apiContext.post('/api/v1/tables', {
      data: { name: 'test-table', database: 'test-db' }
    });
  });
});
```

2. **Use unique identifiers for test data** to avoid conflicts:
```typescript
const uniqueName = `test-entity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

3. **Leverage fixtures for reusable data setup**:
```typescript
// In fixtures file
export const test = base.extend({
  testUser: async ({ apiContext }, use) => {
    const user = await apiContext.post('/api/v1/users', { data: userData });
    await use(user);
    await apiContext.delete(`/api/v1/users/${user.id}`);
  },
});
```

4. **Only test UI flows once** — if a UI flow is already tested, use API for setup in other tests that depend on that state.

---

## Locator Priority Order

When selecting elements in tests, use locators in the following priority order. This ensures tests are resilient, accessible, and maintainable.

### Recommended Priority

| Priority | Locator | When to Use | Example |
|----------|---------|-------------|---------|
| 1 | `getByTestId` | **Preferred for most cases.** Stable, unique identifiers that don't change with UI updates | `page.getByTestId('submit-button')` |
| 2 | `getByRole` | When testing accessible elements (buttons, links, headings) | `page.getByRole('button', { name: 'Submit' })` |
| 3 | `getByLabel` | For form inputs with associated labels | `page.getByLabel('Email address')` |
| 4 | `getByPlaceholder` | For inputs with placeholder text | `page.getByPlaceholder('Enter your email')` |
| 5 | `getByText` | For elements identified by their visible text | `page.getByText('Welcome back')` |
| 6 | `getByTitle` | For elements with title attributes | `page.getByTitle('Close dialog')` |
| 7 | `getByAltText` | For images with alt text | `page.getByAltText('Company logo')` |
| 8 | `locator` (CSS/XPath) | **Last resort.** Only when above options aren't feasible | `page.locator('.custom-component >> nth=0')` |

### Guidelines

1. **Always prefer `data-testid`** for interactive elements that need testing — it decouples tests from implementation and styling changes.

2. **Use `getByRole` for accessibility testing** — it verifies your app is accessible while also being stable.

3. **Avoid class names and CSS selectors** — these frequently change during styling updates and create brittle tests.

4. **Avoid structural selectors** like `div > span:nth-child(2)` — these break easily with markup changes.

5. **Combine locators for specificity** when needed:
```typescript
// Good: Specific and stable
page.getByTestId('user-table').getByRole('row', { name: /john/i });

// Avoid: Brittle structural selector
page.locator('table tbody tr:nth-child(3)');
```

### Adding data-testid Attributes

When adding `data-testid` to components:
```tsx
// Good: Descriptive and unique
<button data-testid="submit-form-button">Submit</button>
<div data-testid="user-profile-card">...</div>

// Avoid: Generic or unclear
<button data-testid="btn">Submit</button>
<div data-testid="card">...</div>
```

---

## Anti-Flakiness Patterns

### ❌ FORBIDDEN - Never Use These

```typescript
// WRONG - Hard waits
await page.waitForTimeout(5000);

// WRONG - Brittle positional selectors
await page.locator(".ant-btn-primary").first();
await page.locator(".table-row").last();
await page.locator(".option").nth(2);

// WRONG - Actions without waiting
await page.click("button", { force: true }); // NEVER use force: true!

// WRONG - networkidle (unreliable with websockets, polling)
await page.waitForLoadState("networkidle");

// WRONG - Storing :visible locator references (becomes stale)
const dropdown = page.locator(".dropdown:visible");
await dropdown.waitFor({ state: "visible" });
const option = dropdown.locator(".option"); // This will fail!
```

### ✅ REQUIRED - Always Use These

```typescript
// CORRECT - Wait for specific elements
await expect(page.getByTestId("content")).toBeVisible();
await waitForAllLoadersToDisappear(page);

// CORRECT - Wait for API responses BEFORE action
const updateResponse = page.waitForResponse("/api/v1/tables/*");
await page.click("button");
const response = await updateResponse;
expect(response.status()).toBe(200);

// CORRECT - Wait for BOTH network AND UI update
await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/v1/") && r.status() === 200),
  page.getByRole("button", { name: "Save" }).click(),
]);
await waitForAllLoadersToDisappear(page);

// CORRECT - Check element is enabled before clicking
const saveButton = page.getByRole("button", { name: "Save" });
await expect(saveButton).toBeVisible();
await expect(saveButton).toBeEnabled();
await saveButton.click();
```

### ⚠️ CRITICAL: The :visible Selector Chain Pattern

**This is the #1 cause of dropdown flakiness!**

```typescript
// ❌ WRONG - Storing :visible locator (becomes stale)
const dropdown = page.locator(".ant-select-dropdown:visible");
await dropdown.waitFor({ state: "visible" });
const option = dropdown.locator('[title="Option"]');
await option.click(); // FAILS - dropdown reference is stale!

// ✅ CORRECT - Chain :visible selector directly (never store it)
await page.click('[data-testid="select"]');
const option = page
  .locator(".ant-select-dropdown:visible")
  .locator('[title="Option"]');
await expect(option).toBeVisible();
await option.click();

// Verify dropdown closed
await expect(page.locator(".ant-select-dropdown:visible")).not.toBeVisible();
```

**Why**: Stored `:visible` locators become stale when re-queried. Always chain them inline!

### ⚠️ CRITICAL: Clicking an Ant Design Dropdown Menu Item

**A click on the item you located can select the item above it.**

Ant Design animates a dropdown open with `transform: scaleY(0.8) -> scaleY(1)` around
`transform-origin: 0 0`, and rc-motion applies the start class one frame before the `-active`
class that begins the transition. Playwright's actionability check ("bounding box unchanged
across two consecutive animation frames") can be satisfied on those pre-transition frames, so
the click point is computed against the 0.8-scaled menu. Once the menu finishes growing, that
point has slid onto the previous item. Under CI worker contention this happens often.

```typescript
// ❌ WRONG - clicks while the menu is still scaling open
await trigger.click();
const response = page.waitForResponse("/api/v1/activity/following");
await page.getByRole("menuitem", { name: "Following" }).click();
await response; // may hang forever - "My Data" was selected and my-feed was fetched

// ✅ CORRECT - wait for the popup to settle, then assert the selection took
await trigger.click();
const menuItem = page.getByRole("menuitem", { name: "Following" });
await expect(menuItem).toBeVisible();
await waitForAntdPopupToSettle(page); // from playwright/utils/common.ts
const response = page.waitForResponse("/api/v1/activity/following");
await menuItem.click();
await expect(trigger).toContainText("Following"); // fails fast if the click drifted
await response;
```

**Always assert the post-click state** (trigger label, `ant-*-item-selected`, rendered content)
before awaiting a response. A `waitForResponse` whose predicate can never match does not fail —
it hangs until the test timeout and then reports `Target page, context or browser has been
closed`, which points nowhere near the real cause.

`playwright/utils/widgetFilters.ts` (`selectWidgetSortOption`) is the reference implementation.

### Modal and Scrollable Container Patterns

```typescript
// ✅ CORRECT - Scroll before interaction in modals
const option = page.locator('[data-testid="option"]');
await option.scrollIntoViewIfNeeded();
await expect(option).toBeVisible();
await option.click();

// ✅ CORRECT - Manually close stubborn dropdowns
await page.getByText("Header Text").click();
await expect(page.locator(".ant-select-dropdown:visible")).not.toBeVisible();

// ✅ CORRECT - Scope to specific container
await expect(
  modalContainer.locator(".selected").filter({ hasText: "Policy" })
).toBeVisible();
```

---

## Test Timeouts

### ✅ RECOMMENDED: test.slow()

**Default approach** - Use `test.slow()` to triple timeouts (30s → 90s):

```typescript
test("complex operation", async ({ page }) => {
  test.slow(); // PREFERRED - triples the timeout

  await test.step("Long running operation", async () => {
    // Your test logic
  });
});
```

**When to use**: Tests with multiple API calls, file uploads/downloads, complex UI interactions, or background processing. Used 145+ times in the codebase.

### ⚠️ RARE: test.setTimeout()

**Only for specific timeout values** that don't fit the 3x multiplier:

```typescript
test("extremely long operation", async ({ page }) => {
  test.setTimeout(300_000); // 5 minutes - only when 3x isn't suitable
});
```

### ❌ AVOID: test.describe.configure()

```typescript
// AVOID - affects ALL tests in the suite
test.describe.configure({ timeout: 300000 });
```

**Why avoid**: Less flexible, harder to maintain. Prefer `test.slow()` inside individual tests.

---

## Test File Structure Template

Use this structure for all generated tests:

```typescript
import { test, expect } from "@playwright/test";
import { performAdminLogin } from "../../utils/admin";
import { redirectToHomePage } from "../../utils/common";
import { sidebarClick } from "../../utils/sidebar";
import { waitForAllLoadersToDisappear } from "../../utils/entity";
import { <EntityClass> } from "../../support/entity/<EntityClass>";
import { UserClass } from "../../support/user/UserClass";
import { uuid } from "../../utils/common";

const entity = new <EntityClass>();
const user = new UserClass();

test.describe(
  "<Feature Name> - <Category>",
  { tag: ["@<Category>", "@<Domain>"] },
  () => {
    test.beforeAll("Setup entities", async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Create test entities via API
      await entity.create(apiContext);
      await user.create(apiContext);

      // Setup relationships via API if needed
      // const patchResponse = await apiContext.patch(`/api/v1/...`, { data: ... });
      // expect(patchResponse.status()).toBe(200);

      await afterAction();
    });

    test.afterAll("Cleanup entities", async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    });

    test("scenario description", async ({ page }) => {
      test.slow(); // Use for tests with multiple API calls or complex interactions

      await test.step("Step description", async () => {
        // 1. Setup API response listener BEFORE action
        const updateResponse = page.waitForResponse("/api/v1/endpoint*");

        // 2. Perform action
        await page.getByRole("button", { name: "Action" }).click();

        // 3. Wait for API and validate
        const response = await updateResponse;
        expect(response.status()).toBe(200);

        // 4. Wait for UI update
        await waitForAllLoadersToDisappear(page);

        // 5. Verify UI state
        await expect(page.getByTestId("result")).toBeVisible();
      });
    });
  },
);
```

---

## Common Test Patterns

### Pattern: Form Submission with API Validation

```typescript
await test.step("Update description", async () => {
  await page.getByTestId("edit-description").click();
  await page.getByTestId("description-input").fill("New description");

  const updateResponse = page.waitForResponse("/api/v1/tables/*");
  await page.getByRole("button", { name: "Save" }).click();

  const response = await updateResponse;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId("description")).toContainText("New description");
});
```

### Pattern: Dropdown Selection

```typescript
await test.step("Select from dropdown", async () => {
  await page.getByTestId("dropdown-trigger").click();

  // CRITICAL: Chain :visible selector directly - never store it!
  const option = page
    .locator(".ant-select-dropdown:visible")
    .locator('[title="Option Name"]');

  await expect(option).toBeVisible();
  await option.click();

  // Verify dropdown closed
  await expect(page.locator(".ant-select-dropdown:visible")).not.toBeVisible();
});
```

### Pattern: Multi-Role Permission Testing

```typescript
// Admin test with default page fixture
test("admin can edit", async ({ page }) => {
  await entity.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  const editButton = page.getByTestId("edit-description");
  await expect(editButton).toBeVisible();
  await expect(editButton).toBeEnabled();
});

// Data Consumer test with custom fixture
test("data consumer has restricted access", async ({ dataConsumerPage: page }) => {
  await redirectToHomePage(page);
  await entity.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  const editButton = page.getByTestId("edit-description");
  const isVisible = await editButton.isVisible();

  if (isVisible) {
    await expect(editButton).toBeDisabled();
  } else {
    await expect(editButton).not.toBeVisible();
  }
});
```

### Pattern: Data Persistence Verification

```typescript
await test.step("Verify persistence after reload", async () => {
  await page.reload();
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId("description")).toContainText(testValue);
});
```

---

## Visual Snapshot Testing

Use snapshot testing to catch **visual regressions** in rendered output that cannot be verified by DOM assertions alone — primarily downloaded images such as exported PNGs where the visual content (e.g. presence of edge lines in a lineage graph) is what matters.

> **Do not** use snapshot testing for regular page UI. Use `expect(locator).toBeVisible()` and standard Playwright assertions for those cases. Snapshots are brittle for dynamic pages; reserve them for stable, file-based output.

### How It Works

1. **First run** — Playwright saves the downloaded file bytes as a reference PNG inside `__snapshots__/`. You commit this file.
2. **Subsequent runs** — Playwright reads the reference and compares pixel-by-pixel with a configurable tolerance. If the diff exceeds the threshold the test fails and a diff image is written to `playwright/output/test-results/`.
3. **Intentional change** — update the reference by running with `--update-snapshots` (see below), inspect the diff, then commit the new reference.

### File Layout

The project's `playwright.config.ts` sets a custom `snapshotPathTemplate` that omits `{projectName}` and `{platform}`, so **one file works on both macOS and Linux**:

```
playwright/e2e/Features/
  LineageExportPNGSnapshot.spec.ts
  __snapshots__/
    LineageExportPNGSnapshot.spec.ts-snapshots/
      lineage-export-with-edges.png   ← single committed reference (no platform suffix)
```

This avoids the common CI failure where a macOS-generated `chromium-darwin.png` reference causes "snapshot doesn't exist" on a Linux runner that looks for `chromium-linux.png`.

### Step 1 — Generate the initial reference snapshot

The test **will fail on the very first run** with `"snapshot doesn't exist"`. That is expected. Run with `--update-snapshots` against a live server to produce the reference:

```bash
# From the ui/ directory, with a running OpenMetadata server
yarn playwright:run --update-snapshots \
  playwright/e2e/Features/LineageExportPNGSnapshot.spec.ts
```

Inspect the generated PNG in `LineageExportPNGSnapshot.spec.ts-snapshots/` to confirm it looks correct (edges visible, nodes readable), then commit it:

```bash
git add playwright/e2e/Features/LineageExportPNGSnapshot.spec.ts-snapshots/
git commit -m "test(lineage): add reference snapshot for PNG export"
```

### Step 2 — Running the test normally

```bash
# Run only the snapshot spec
yarn playwright:run LineageExportPNGSnapshot.spec.ts

# Run against a specific base URL
PLAYWRIGHT_TEST_BASE_URL=https://your-server:8585 \
  yarn playwright:run LineageExportPNGSnapshot.spec.ts
```

A passing run produces no output. A failing run writes diff images to `playwright/output/test-results/` — open them to see exactly which pixels changed.

### Step 3 — Updating the reference after an intentional change

If the lineage layout, node styles, or edge colors change intentionally (e.g. a UI redesign), the snapshot will fail. Update it:

```bash
yarn playwright:run --update-snapshots \
  playwright/e2e/Features/LineageExportPNGSnapshot.spec.ts
```

Review the diff, then commit the updated reference. **Never update snapshots blindly** — always inspect the before/after images to confirm the change is expected.

### Threshold Settings

The current snapshot uses:

```typescript
expect(buffer).toMatchSnapshot('lineage-export-with-edges.png', {
  threshold: 0.1,          // per-channel tolerance: 0–1 (0.1 = 10% per channel)
  maxDiffPixelRatio: 0.05, // at most 5% of pixels may differ
});
```

`threshold: 0.1` allows minor sub-pixel anti-aliasing differences between environments. `maxDiffPixelRatio: 0.05` ensures that large-scale regressions (e.g. all edge pixels turning white) always fail. Do not raise `maxDiffPixelRatio` above `0.1` without a strong reason — it would let significant visual regressions pass silently.

### Canvas Readiness — Why We Poll the Canvas

The lineage graph renders nodes in the React DOM and edges on an HTML5 `<canvas>` element via `requestAnimationFrame`. Simply waiting for the API response is not enough — the canvas draw cycle runs asynchronously. The snapshot spec polls until the canvas has non-zero dimensions, which confirms the first draw frame has completed:

```typescript
await page.waitForFunction(() => {
  const canvas = document.querySelector(
    '#lineage-container canvas'
  ) as HTMLCanvasElement | null;
  return canvas !== null && canvas.width > 0 && canvas.height > 0;
});
```

Do not remove or shorten this wait — doing so may capture a blank canvas before edges are drawn and produce a misleading "passing" snapshot.

### When to Use Snapshot Testing

| Scenario | Use snapshot? | Reason |
|---|---|---|
| Exported PNG includes edge lines | ✅ Yes | DOM assertions cannot inspect canvas pixel content |
| Page component is visible | ❌ No | Use `toBeVisible()` — snapshots of live pages are brittle |
| CSV export contains correct rows | ❌ No | Parse the CSV and assert on values directly |
| Chart renders correct colors | ⚠️ Maybe | Only if the chart is SVG/Canvas and color is the critical property |

### Existing Snapshot Tests

| Spec file | Snapshot name | What it guards |
|---|---|---|
| `e2e/Features/LineageExportPNGSnapshot.spec.ts` | `lineage-export-with-edges.png` | Edges are present in exported lineage PNG (regression for issue #29124) |

---

## Support Classes Reference

### Entity Classes

Located in `playwright/support/entity/`:
- TableClass, DatabaseClass, DatabaseSchemaClass
- DashboardClass, ChartClass, DashboardDataModelClass
- PipelineClass, TopicClass, ContainerClass
- MlModelClass, SearchIndexClass, StoredProcedureClass
- APIEndpointClass, APICollectionClass, MetricClass
- TagClass, GlossaryClass, GlossaryTermClass
- DataProductClass, DomainClass

### User & Access Control Classes

Located in `playwright/support/user/` and `playwright/support/access-control/`:
- UserClass, TeamClass
- RoleClass, PolicyClass

### Common Methods

```typescript
await entity.create(apiContext); // Create via API
await entity.visitEntityPage(page); // Navigate to entity
await entity.delete(apiContext); // Delete via API
await entity.rename(newName, page); // Rename entity
```

---

## Domain Tags

Use appropriate domain tags based on feature area:

```typescript
test.describe("Feature Name", { tag: ["@Features", "@Governance"] }, () => {
  // Tests for Governance features
});
```

Available domain tags (from `DOMAIN_TAGS` in `playwright/constant/config.ts`):
- `@Governance` - Policies, Glossary, Classification, Domains
- `@Discovery` - Tables, Dashboards, Pipelines, Topics, Data Assets
- `@Platform` - Settings, Users, Teams, Roles, Authentication
- `@Observability` - Incidents, Data Quality, Profiling, Monitoring
- `@Integration` - Ingestion, Connectors, External Integrations

---

## ESLint Enforcement

Playwright tests are linted with `eslint-plugin-playwright` to automatically catch common anti-patterns. This runs as a CI check on all PRs touching `playwright/` files.

### Running the Lint

```bash
cd openmetadata-ui/src/main/resources/ui
yarn lint:playwright               # check only — never writes
yarn lint:playwright:suppressions  # check, then prune entries you have fixed
```

Both run the same rules over the whole corpus against `eslint-suppressions.json`. The difference is
only what happens once you have *fixed* something: `lint:playwright` reports the now-unused entry and
exits non-zero, while `lint:playwright:suppressions` removes it and rewrites the file for you. Run
the second after a cleanup and commit the rewritten baseline — that commit is what ratchets the count
down. Neither will let a *new* violation through; adding to the baseline needs an explicit
`--suppress-all`.

### Rule Levels

Every guardrail rule — `playwright/*` and `om-playwright/*` — runs at `error`. Existing violations at
the time each rule was promoted are snapshotted in `eslint-suppressions.json`; that file may shrink
as violations are fixed, never grow, so nothing new gets in without failing CI.

The severity column is authoritative, not decorative: read it rather than assuming. A rule may
legitimately sit at `warn` while its call sites are migrated — `openmetadata-playwright/*` rules come
from the repo-wide plugin in `eslint-rules/` and set their own severity on that basis.

This table is generated from `eslint.config.mjs` by `scripts/generate-playwright-rule-table.mjs` — do
not hand-edit it, run `yarn generate:playwright-rules` instead.

<!-- BEGIN GENERATED RULE TABLE -->

| Rule | Severity | What it catches |
|---|---|---|
| `om-playwright/justified-rule-disable` | error | Require a justification comment when disabling a playwright lint rule |
| `om-playwright/no-awaited-wait-for-response` | error | Disallow awaiting page.waitForResponse() directly — register the listener before the action instead |
| `om-playwright/no-blanket-test-slow` | error | Disallow test.slow() at file or describe scope |
| `om-playwright/no-positional-locator` | error | Disallow positional locators (.first(), .last(), .nth()) |
| `om-playwright/require-assertion-per-test` | error | Flag tests that only perform page interactions and verify nothing |
| `openmetadata-playwright/require-aggregation-wait-helper` | warn | Require waitForAggregation instead of waiting on search/aggregate directly |
| `playwright/missing-playwright-await` | error | Identify false positives when async Playwright APIs are not properly awaited. |
| `playwright/no-element-handle` | error | The use of ElementHandle is discouraged, use Locator instead |
| `playwright/no-eval` | error | The use of `page.$eval` and `page.$$eval` are discouraged, use `locator.evaluate` or `locator.evaluateAll` instead |
| `playwright/no-focused-test` | error | Prevent usage of `.only()` focus test annotation |
| `playwright/no-force-option` | error | Prevent usage of `{ force: true }` option. |
| `playwright/no-networkidle` | error | Prevent usage of the networkidle option |
| `playwright/no-page-pause` | error | Prevent usage of page.pause() |
| `playwright/no-skipped-test` | error | Prevent usage of the `.skip()` skip test annotation. |
| `playwright/no-useless-await` | error | Disallow unnecessary awaits for Playwright methods |
| `playwright/no-wait-for-selector` | error | Prevent usage of page.waitForSelector() |
| `playwright/no-wait-for-timeout` | error | Prevent usage of page.waitForTimeout() |
| `playwright/prefer-web-first-assertions` | error | Prefer web first assertions |
| `playwright/valid-expect` | error | Enforce valid `expect()` usage |

<!-- END GENERATED RULE TABLE -->

---

## Validation Checklist

Before finalizing tests, verify:

### Structure & Organization
- [ ] Test uses `test.step()` for clear organization
- [ ] Domain tags added to `test.describe()`
- [ ] Proper imports from utils and support classes
- [ ] `beforeAll` creates entities via API
- [ ] `afterAll` deletes entities in reverse order

### Anti-Flakiness (CRITICAL)
- [ ] No `waitForTimeout()` or hard waits
- [ ] No `networkidle` usage
- [ ] No `{ force: true }` on clicks/fills
- [ ] No positional selectors (`.first()`, `.last()`, `.nth()`)
- [ ] No stored `:visible` locator references
- [ ] All dropdowns use `:visible` chain pattern correctly
- [ ] All buttons check `.toBeEnabled()` before clicking
- [ ] Elements in modals use `scrollIntoViewIfNeeded()`

### API & Network
- [ ] All API calls have `.waitForResponse()` listeners set up BEFORE action
- [ ] All API responses validate status code (200, 201, 204)

### Waits & Assertions
- [ ] All actions followed by `waitForAllLoadersToDisappear(page)`
- [ ] Semantic locators (getByRole, getByTestId) used
- [ ] Assertions use `.toBeVisible()` instead of `.waitForSelector()`

### ESLint
- [ ] `yarn lint:playwright` passes with zero errors (this is what CI runs)
- [ ] No new warnings introduced (fix existing ones when touching a file)

### Coverage & Roles
- [ ] Multi-role tests use appropriate fixtures
- [ ] Data persistence verified after reload/navigation
- [ ] Error states handled gracefully
