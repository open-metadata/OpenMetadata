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
- [Support Classes Reference](#support-classes-reference)
- [Domain Tags](#domain-tags)
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

### Coverage & Roles
- [ ] Multi-role tests use appropriate fixtures
- [ ] Data persistence verified after reload/navigation
- [ ] Error states handled gracefully
