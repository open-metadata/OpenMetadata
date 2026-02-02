---
name: playwright-test
description: Generate robust, zero-flakiness Playwright E2E tests following OpenMetadata patterns. Creates comprehensive test files with proper waits, API validation, multi-role permissions, and complete entity lifecycle management.
---

# Playwright Test Generator - OpenMetadata

Generate production-ready, zero-flakiness Playwright tests following OpenMetadata conventions.

## Usage

```
/playwright-test
Feature: <feature name>
Category: <Features|Pages|Flow|VersionPages>
Entity: <Table|Dashboard|Pipeline|Topic|Database|User|Team|Glossary|Other>
Domain: <Governance|Discovery|Platform|Observability|Integration>
Scenarios:
  - <scenario 1 description>
  - <scenario 2 description>
  - <scenario 3 description>
Roles: <admin|dataConsumer|dataSteward|owner> (optional, defaults to admin)
```

---

## Core Principles

Every test you generate MUST follow these principles:

1. ✅ **Zero Flakiness** - Pass 10/10 times consistently
2. ✅ **Semantic Locators** - Use accessible, user-facing selectors
3. ✅ **API Validation** - Verify all API interactions
4. ✅ **Explicit Waits** - Wait for UI state changes, never hard timeouts
5. ✅ **Multi-Role Testing** - Test permissions for different user roles
6. ✅ **Clean Setup/Teardown** - Manage test data via API
7. ✅ **Clear Structure** - Use test.step() for logical organization
8. ✅ **Comprehensive Assertions** - Validate both positive and negative cases

---

## CRITICAL: Anti-Flakiness Rules

### ❌ FORBIDDEN - Never Use These

```typescript
// WRONG - Hard waits
await page.waitForTimeout(5000);
await page.wait(1000);

// WRONG - Brittle selectors
await page.locator("div > div:nth-child(3) > button");
await page.locator(".ant-btn-primary").first(); // Positional selectors are fragile!
await page.locator(".table-row").last(); // Fragile to DOM changes!
await page.locator(".option").nth(2); // Breaks when order changes!

// WRONG - Actions without waiting
await page.click("button"); // Missing wait for element
await page.click("button", { force: true }); // NEVER use force: true!

// WRONG - networkidle (unreliable with websockets, polling, streams)
await page.waitForLoadState("networkidle"); // Can cause flakiness!

// WRONG - Storing :visible locator references (becomes stale)
const dropdown = page.locator(".dropdown:visible");
await dropdown.waitFor({ state: "visible" });
const option = dropdown.locator(".option"); // This will fail!
```

### ✅ REQUIRED - Always Use These

```typescript
// CORRECT - Wait for specific elements (PREFERRED)
await expect(page.getByTestId("content")).toBeVisible();
await waitForAllLoadersToDisappear(page);

// CORRECT - Wait for loaders to disappear
await page.waitForSelector('[data-testid="loader"]', { state: "detached" });

// CORRECT - Wait for API responses BEFORE action
const updateResponse = page.waitForResponse("/api/v1/tables/*");
await page.click("button");
const response = await updateResponse;
expect(response.status()).toBe(200);

// CORRECT - Wait for BOTH network AND UI update
await Promise.all([
  page.waitForResponse(
    (r) => r.url().includes("/api/v1/") && r.status() === 200,
  ),
  page.getByRole("button", { name: "Save" }).click(),
]);
await waitForAllLoadersToDisappear(page);
await expect(page.getByTestId("content")).toBeVisible();

// CORRECT - Check element is enabled before clicking
const saveButton = page.getByRole("button", { name: "Save" });
await expect(saveButton).toBeVisible();
await expect(saveButton).toBeEnabled(); // Critical for buttons!
await saveButton.click();

// CORRECT - Semantic locators with auto-wait
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByTestId("result")).toContainText("success");
```

### ⚠️ CRITICAL: The :visible Selector Chain Pattern

**This is the #1 cause of dropdown flakiness!**

```typescript
// ❌ WRONG - Storing :visible locator (becomes stale when re-queried)
const dropdown = page.locator(".ant-select-dropdown:visible");
await dropdown.waitFor({ state: "visible" });
const option = dropdown.locator('[title="Option"]');
await option.click(); // FAILS - dropdown reference is stale!

// ❌ WRONG - No :visible chain at all
await page.click('[data-testid="select"]');
await page.click('[title="Option"]'); // May click wrong dropdown!

// ✅ CORRECT - Chain :visible selector directly (never store it)
await page.click('[data-testid="select"]');
const option = page
  .locator(".ant-select-dropdown:visible")
  .locator('[title="Option"]');
await expect(option).toBeVisible();
await option.click();

// Verify dropdown closed (check the dropdown itself, not just option)
await expect(page.locator(".ant-select-dropdown:visible")).not.toBeVisible();
```

**Why**: Stored `:visible` locators become stale when re-queried. Always chain them inline!

**Apply to ALL dropdowns**: Column selectors, test types, policies, any `ant-select-dropdown`, any visible popover/menu

### 📋 Modal and Scrollable Container Patterns

```typescript
// ✅ CORRECT - Scroll before interaction in modals
const option = page.locator('[data-testid="option"]');
await option.scrollIntoViewIfNeeded();
await expect(option).toBeVisible();
await option.click();

// ✅ CORRECT - Manually close stubborn dropdowns
await page.getByText("Header Text").click();
await expect(page.locator(".ant-select-dropdown:visible")).not.toBeVisible();

// ✅ CORRECT - Scope to specific container (avoid .first())
await expect(
  modalContainer.locator(".selected").filter({ hasText: "Policy" }),
).toBeVisible();

// ❌ WRONG - Using .first() to avoid strict mode
await expect(page.getByText("Policy").first()).toBeVisible();
```

---

## Selector Priority

Use selectors in this order (most to least preferred):

1. **getByRole** - `page.getByRole('button', { name: 'Save' })`
2. **getByLabel** - `page.getByLabel('Username')`
3. **getByText** - `page.getByText('Welcome')`
4. **getByTestId** - `page.getByTestId('submit-button')`
5. **CSS/XPath** - Only if unavoidable

---

## Test File Structure

```typescript
import { test, expect } from "@playwright/test";
import { performAdminLogin } from "../../utils/admin";
import { redirectToHomePage } from "../../utils/common";
import { sidebarClick } from "../../utils/sidebar";
import { waitForAllLoadersToDisappear } from "../../utils/entity";
import { TableClass } from "../../support/entity/TableClass";
import { UserClass } from "../../support/user/UserClass";
import { DOMAIN_TAGS } from "../../constant/config";
import { uuid } from "../../utils/uuid";

const table = new TableClass();
const user = new UserClass();

test.describe(
  "Feature Name - Category",
  { tag: ["@Features", "@Discovery"] },
  () => {
    test.setTimeout(300000);

    test.beforeAll("Setup entities", async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Create test entities
      await table.create(apiContext);
      await user.create(apiContext);

      // Setup relationships via API
      const patchResponse = await apiContext.patch(
        `/api/v1/tables/${table.entityResponseData?.["id"]}`,
        {
          data: {
            /* patch data */
          },
        },
      );
      expect(patchResponse.status()).toBe(200);

      await afterAction();
    });

    test.afterAll("Cleanup entities", async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    });

    test("test scenario description", async ({ page }) => {
      await test.step("Step description", async () => {
        // Setup API response listener BEFORE action
        const updateResponse = page.waitForResponse("/api/v1/endpoint*");

        // Perform action
        await page.getByRole("button", { name: "Action" }).click();

        // Wait for API and validate
        const response = await updateResponse;
        expect(response.status()).toBe(200);

        // Wait for UI update
        await waitForAllLoadersToDisappear(page);

        // Verify UI state
        await expect(page.getByTestId("result")).toBeVisible();
      });
    });
  },
);
```

---

## Pattern Library

### Pattern 1: Navigation

```typescript
await redirectToHomePage(page);
await waitForAllLoadersToDisappear(page);
await sidebarClick(page, SidebarItem.EXPLORE);
await expect(page).toHaveURL(/.*explore/);
await expect(page.getByTestId("explore-container")).toBeVisible();
```

### Pattern 2: Form Submission with API Validation

```typescript
await test.step("Update description", async () => {
  await page.getByTestId("edit-description").click();
  await page.getByTestId("description-input").fill("New description");

  const updateResponse = page.waitForResponse("/api/v1/tables/*");
  await page.getByRole("button", { name: "Save" }).click();

  // Validate status code
  const response = await updateResponse;
  expect(response.status()).toBe(200);

  // Validate response data
  const data = await response.json();
  expect(data).toHaveProperty("description", "New description");

  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId("description")).toContainText(
    "New description",
  );
});

// For specific HTTP methods:
const updateResponse = page.waitForResponse(
  (response) =>
    response.url().includes("/api/v1/tables") &&
    response.request().method() === "PATCH",
);
```

### Pattern 3: Multi-Role Permission Testing

```typescript
// Admin test with default page fixture
test("admin can edit", async ({ page }) => {
  await test.step("Navigate and edit", async () => {
    await entity.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const editButton = page.getByTestId("edit-description");
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
  });
});

// Data Consumer test with custom fixture
test("data consumer has restricted access", async ({
  dataConsumerPage: page,
}) => {
  await test.step("Navigate to entity", async () => {
    await redirectToHomePage(page);
    await entity.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);
  });

  await test.step("Edit button is disabled or hidden", async () => {
    const editButton = page.getByTestId("edit-description");
    const isVisible = await editButton.isVisible();

    if (isVisible) {
      await expect(editButton).toBeDisabled();
    } else {
      await expect(editButton).not.toBeVisible();
    }
  });
});
```

### Pattern 4: Dropdown Selection (⚠️ CRITICAL - #1 Flakiness Source)

```typescript
await test.step("Select from dropdown", async () => {
  // Open dropdown
  await page.getByTestId("dropdown-trigger").click();

  // CRITICAL: Chain :visible selector directly - never store it!
  const option = page
    .locator(".ant-select-dropdown:visible")
    .locator('[title="Option Name"]');

  await expect(option).toBeVisible();
  await option.click();

  // Verify dropdown closed (check dropdown itself, not option)
  await expect(page.locator(".ant-select-dropdown:visible")).not.toBeVisible();

  // Verify selection applied
  await expect(page.getByTestId("selected-option")).toBeVisible();
});

// For searchable dropdowns:
await test.step("Select from searchable dropdown", async () => {
  await page.fill('[id="search-input"]', "searchTerm");
  await page.waitForResponse("/api/v1/search*");

  const searchResult = page
    .locator(".ant-select-dropdown:visible")
    .locator('[title="searchTerm"]');

  await expect(searchResult).toBeVisible();
  await searchResult.click();
});
```

### Pattern 5: Search and Filter

```typescript
await test.step("Search for entity", async () => {
  const searchInput = page.getByTestId("searchBox");
  await expect(searchInput).toBeVisible();

  await searchInput.fill(entity.entity.name);
  await searchInput.press("Enter");

  await page.waitForSelector('[data-testid="loader"]', { state: "detached" });

  // Verify specific result instead of using .first()
  await expect(
    page.getByRole("link", { name: entity.entity.name }),
  ).toBeVisible();
});
```

### Pattern 6: Data Persistence Verification

```typescript
await test.step("Verify persistence after reload", async () => {
  await page.reload();
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId("description")).toContainText(testValue);
});

await test.step("Verify persistence after navigation", async () => {
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);

  await entity.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId("description")).toContainText(testValue);
});
```

### Pattern 7: Error Handling

```typescript
test("should handle errors gracefully", async ({ page }) => {
  await test.step("Navigate to invalid entity", async () => {
    await page.goto("/table/invalid.database.invalid.table");

    const errorMessage = page.getByText(/not found|error|does not exist/i);
    await expect(errorMessage).toBeVisible();
  });
});
```

### Pattern 8: Tab Navigation

```typescript
await test.step("Navigate between tabs", async () => {
  const profilerTab = page.getByRole("tab", { name: "Profiler" });
  await profilerTab.click();

  await page.waitForSelector('[data-testid="loader"]', { state: "detached" });

  await expect(profilerTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("profiler-content")).toBeVisible();
});
```

---

## Support Classes Reference

### Entity Classes

Located in `playwright/support/entity/`:

- TableClass, DatabaseClass, DatabaseSchemaClass
- DashboardClass, ChartClass, DataModelClass
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

Before finalizing the test, verify:

### Structure & Organization

- [ ] Test uses `test.step()` for clear organization
- [ ] Test timeout set to 300000ms
- [ ] Domain tags added to test.describe()
- [ ] Proper imports from utils and support classes
- [ ] beforeAll creates entities via API
- [ ] afterAll deletes entities in reverse order

### Anti-Flakiness (CRITICAL)

- [ ] No `waitForTimeout()` or hard waits
- [ ] No `networkidle` usage
- [ ] No `{ force: true }` on clicks/fills
- [ ] No positional selectors (`.first()`, `.last()`, `.nth()`)
- [ ] No stored `:visible` locator references
- [ ] All dropdowns use `:visible` chain pattern correctly
- [ ] All buttons check `.toBeEnabled()` before clicking
- [ ] All dropdown closures verify dropdown itself, not just option
- [ ] Elements in modals use `scrollIntoViewIfNeeded()`

### API & Network

- [ ] All API calls have `.waitForResponse()` listeners set up BEFORE action
- [ ] All API responses validate status code (200, 201, 204)
- [ ] Critical actions use `Promise.all([waitForResponse, action])`

### Waits & Assertions

- [ ] All actions followed by `waitForAllLoadersToDisappear(page)`
- [ ] Semantic locators (getByRole, getByTestId) used
- [ ] No brittle selectors (nth-child, complex CSS)
- [ ] Assertions use `.toBeVisible()` instead of `.waitForSelector()`

### Coverage & Roles

- [ ] Multi-role tests use appropriate fixtures
- [ ] Data persistence verified after reload/navigation
- [ ] Error states handled gracefully
- [ ] Dropdowns properly opened, selected with :visible chain, and closed

---

## Advanced Patterns

### Pattern: Serial Execution (Only When Tests Have Dependencies)

```typescript
// Only use serial mode when tests MUST run in a specific order
test.describe.configure({ mode: "serial" });

test.describe("Feature Name", () => {
  test("first test - creates baseline data", async ({ page }) => {
    // This test creates data needed by next test
  });

  test("second test - depends on first test data", async ({ page }) => {
    // This test uses data from first test
  });
});
```

**Note**: Avoid serial mode when possible. Tests should be independent for parallel execution.

### Pattern: Conditional Actions with Proper Waits

```typescript
const followButton = page.getByTestId("entity-follow-button");

if (await followButton.isVisible()) {
  const followResponse = page.waitForResponse("/api/v1/tables/*");
  await followButton.click();
  await followResponse;

  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId("entity-unfollow-button")).toBeVisible();
}
```

### Pattern: Login as Different User

```typescript
await test.step("Login as owner and verify", async () => {
  await ownerUser.login(page);
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);

  // Verify user-specific content
  await expect(page.getByTestId("user-profile")).toContainText(
    ownerUser.responseData.displayName,
  );
});
```

### Pattern: Complex API Patches in Setup

```typescript
test.beforeAll("Setup with relationships", async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await entity.create(apiContext);

  // Patch to add domain/owner/tags
  const patchResponse = await apiContext.patch(
    `/api/v1/tables/${entity.entityResponseData?.["id"]}`,
    {
      data: JSON.stringify([
        {
          op: "add",
          path: "/domain",
          value: { id: domainId, type: "domain" },
        },
      ]),
      headers: { "Content-Type": "application/json-patch+json" },
    },
  );
  expect(patchResponse.status()).toBe(200);

  await afterAction();
});
```

---

## Final Notes

- **No Comments for Obvious Code**: Don't add comments like `// Create entity` before `entity.create()`
- **Use Translation Keys**: Don't hardcode button text, use semantic role-based selectors
- **Test Independence**: Each test must run independently in any order
- **Parallel Execution**: Tests run in parallel by default. Only use `test.describe.configure({ mode: 'serial' })` when tests have dependencies
- **Cleanup Reliability**: Always delete in afterAll, even if test fails
- **Reference Examples**: See `playwright/e2e/Pages/DataContractInheritance.spec.ts`, `playwright/e2e/Features/TableOwner.spec.ts`, `playwright/e2e/Features/DataAssetRulesDisabled.spec.ts` for comprehensive patterns

Generate tests that are **production-ready, maintainable, and zero-flakiness** by following these patterns exactly.
