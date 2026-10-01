# OpenMetadata Playwright Testing Handbook

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Why Tests Flake Here](#why-tests-flake-here)
- [Test Standards to Follow](#test-standards-to-follow)
- [API Setups for Test Data](#api-setups-for-test-data)
- [Test Data Isolation](#test-data-isolation)
- [Locator Priority Order](#locator-priority-order)
- [Anti-Flakiness Patterns](#anti-flakiness-patterns)
- [Waiting for Asynchronous State](#waiting-for-asynchronous-state)
- [Test Timeouts](#test-timeouts)
- [Test File Structure Template](#test-file-structure-template)
- [Common Test Patterns](#common-test-patterns)
- [Flake-Avoidance Helpers](#flake-avoidance-helpers)
- [Diagnosing a Flaky Test](#diagnosing-a-flaky-test)
- [Quarantine Policy](#quarantine-policy)
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

## Why Tests Flake Here

Almost every flake fixed in this suite traces back to one of five facts about how it runs. A test
that ignores them passes locally and fails in CI or in the merge queue.

1. **One shared server, many parallel workers.** `fullyParallel: true`, 3+ workers per shard, many
   shards against the same instance. Every other spec is creating, renaming and deleting entities
   while your test runs. Lists, counts, "first item" defaults and search results are not yours.
2. **One shared admin session.** Most specs act as the same admin user. Websocket notifications,
   toasts, activity feeds and "my data" views fan out to *every* worker logged in as that user.
3. **Search is eventually consistent.** An API create/update returns 200 before Elasticsearch /
   OpenSearch has indexed it. Any search-backed UI (explore, pickers, user/domain lists, asset counts)
   can show the pre-change state for seconds.
4. **HTTP 200 does not mean "done".** Moves, contract validation, inheritance propagation, reindex,
   RDF projection and deletes run asynchronously after the response.
5. **CI runners are slow and noisy.** A degraded shard runs 1.5–3.5x slower than a healthy one.
   Animations, debounces and lazy chunks that finish "instantly" on a laptop land mid-click in CI.

And one fact about how failures surface: **retries hide first-attempt failures.** CI runs with
`retries: 1`; a test that passes on retry is reported `flaky` and the shard goes green. Fix the cause
— do not rely on the retry (see [Quarantine Policy](#quarantine-policy)).

> **Rule of thumb:** before writing an assertion, ask *"could another worker, a slow index, or a slow
> runner change this?"* If yes, scope it to data the test owns or wait on the signal that proves the
> state is final.

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
// Wait for API response — register BEFORE the action, match the request, assert status after.
const tablesResponse = waitForResponseWithStatus(
  page,
  (response) =>
    response.url().includes('/api/v1/tables') &&
    response.request().method() === 'GET',
  200
);
await page.getByTestId('tables-tab').click();
await tablesResponse;

// Wait for specific elements
await expect(page.getByTestId('success-message')).toBeVisible();

// Wait for loaders (and lazy right-panel widgets) to disappear
await waitForAllLoadersToDisappear(page);
await waitForWidgetsToRender(page);
```

7. **API Awaits**: While putting waits on the API calls, keep the following things in check.
    1. The APIs should be as specific as possible.
    Ex. prefer `/api/table/name/${tableName}*` than `/api/table/name/*`

    2. Avoid some common parameters or their values in the API unless they are necessary.
    Ex. prefer `/api/tables?*` than `/api/tables?limit=12&include=deleted` since the parameter values or order may change in future. 
    `Note: Exception would be when we are intentionally waiting on something, like '/api/tables?*filter=new*' after applying some filter.`

    3. **Match on the request, assert the status afterwards.** Never put `response.status() === 200`
    inside the predicate: a 400/500 then never matches, and the test hangs until timeout and reports
    `Target page, context or browser has been closed` — pointing nowhere near the failed call. Use
    `waitForResponseWithStatus` or `clickAndWaitFor` (`playwright/utils/waitHelpers.ts`), which throw a
    legible `expected HTTP 200, received 400` at the call that failed.

    4. **Include the HTTP method** when a GET and a PATCH/PUT share a path, and a distinguishing
    parameter (`value=`, `size=25`, `track_total_hits=true`, the typed search text) when one action
    fires several requests to the same endpoint — e.g. a list query plus a `size=0` count query. A
    looser predicate resolves on whichever arrives first.

    5. **A bare `waitForResponse` is satisfied by an error.** If you do not use the helpers above,
    assert `expect(response.status()).toBe(200)` on every awaited response. Support classes must read
    bodies with `okJson()` (`playwright/utils/apiResponse.ts`), never a bare `response.json()` — the
    latter returns the error body, the entity's `id` silently becomes `undefined`, and the run breaks
    several steps later somewhere unrelated.

---

## API Setups for Test Data

### Why Use API for Test Setup?

Using API calls instead of UI interactions for test setup provides:
- **Speed**: API calls are significantly faster than navigating through UI
- **Reliability**: Less prone to flakiness from UI animations, loading states, or timing issues
- **Focus**: Tests focus on what they're actually testing, not setup steps

### Best Practices

1. **Create test data via API in `beforeAll`/`beforeEach` hooks**. Prefer the support classes
   (`new TableClass().create(apiContext)`) — they build a valid payload and its parent hierarchy.
   When you call the API directly, send every field the create schema requires and read the body
   with `okJson` so a failed create throws here instead of leaking `undefined` ids downstream:
```typescript
test.describe('Table operations', () => {
  let testTable: Table;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    testTable = await okJson<Table>(
      await apiContext.post('/api/v1/tables', {
        data: {
          name: `pw-table-${uuid()}`,
          databaseSchema: schemaFqn,
          columns: [{ name: 'id', dataType: 'INT' }],
        },
      }),
      'Create table'
    );
    await afterAction();
  });
});
```

2. **Use unique identifiers for test data** to avoid conflicts — `uuid()` from
   `playwright/utils/common.ts`:
```typescript
const uniqueName = `pw-entity-${uuid()}`;
```

3. **Generate names inside the hook, not at module scope or in a constructor.** On retry Playwright
   re-runs `beforeAll` in the same worker; a name fixed at module load is reused and every create
   answers **409**. When a retry may legitimately hit its own leftovers, create through
   `createOrFetch()` (`playwright/utils/apiResponse.ts`) — it fetches on 409 and refuses to hand back a
   soft-deleted entity.

4. **Create independent fixtures concurrently** with `settleAll()` — faster `beforeAll`, and partial
   successes are still reported before the `AggregateError` throws:
```typescript
await settleAll([table.create(apiContext), user.create(apiContext), domain.create(apiContext)]);
```

5. **Clean up with `deleteFixtureEntity()`** — idempotent (tolerates 400/401/404) but still fails on
   403/5xx, so a real permission bug is not swallowed. A leaked fixture is not harmless: it shifts
   sort order, pagination and counts for every other spec (see
   [Test Data Isolation](#test-data-isolation)).

6. **Leverage fixtures for reusable data setup**:
```typescript
// In fixtures file
export const test = base.extend<{ testUser: UserClass }>({
  testUser: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const user = new UserClass();
    await user.create(apiContext);
    await use(user);
    await user.delete(apiContext);
    await afterAction();
  },
});
```

7. **Only test UI flows once** — if a UI flow is already tested, use API for setup in other tests that depend on that state.

---

## Test Data Isolation

Your test shares the server with every other worker. Anything global is a moving target.

### Own your data — never mutate shared fixtures

- Assets from `entity-data.setup.ts` are **read-only**. Edit/delete/rename them and you break a test
  in another file on another shard. Create a dedicated entity in `beforeAll` instead.
- Instantiate entity classes **inside** the `describe`/test that uses them, not in an outer
  `forEach` or at module scope shared by several describes. Two workers creating and deleting "the
  same" instance produces 404s and "node is not in the graph".
- If a test must mutate shared state (an edge, a setting, a type definition), restore it in a
  `finally` block so a failure midway does not poison later tests.

### Never assert on global counts, totals, or "the first item"

```typescript
// ❌ WRONG — the total includes other workers' entities and changes mid-test
const before = await page.getByTestId('count').textContent();
await createTag();
await expect(page.getByTestId('count')).toHaveText(String(Number(before) + 1));

// ❌ WRONG — the default selection is "first by name"; a leaked fixture that sorts earlier wins
await sidebarClick(page, SidebarItem.TAGS);
await expect(page.getByTestId('manage-button')).not.toBeVisible();

// ✅ CORRECT — assert on the entity the test owns, navigate to it explicitly
await visitClassificationPage(page, classification.data.name, classification.data.displayName);
await expect(getRowByName(page, tag.data.name)).toBeVisible();
```

- Replace `toHaveCount(n)` on search/list results with a content assertion on your own rows, or
  `>= 1` when presence is all that matters.
- Do not compare a list's count before and after an action — with pagination it is vacuous or wrong.
- Pages that open "the first item" (Tags → first classification, Glossary → first glossary, landing
  widgets) must be navigated by URL or by the helper that pins the item (`visitClassificationPage`,
  `entity.visitEntityPage`). A classification whose name sorts before `Certification` changes the
  default for every other spec.

### Do not depend on list, page, or bucket caps

Leftover fixtures from other shards routinely push your entity past a UI or ES cap: a 50-page
pagination walk, a 9-result page, a top-N aggregation bucket, an infinite-scroll tree.

- Prefer the **detail page by URL** (`/table/<fqn>`, `/domain/<fqn>`, `/settings/access/roles/<name>`)
  over finding the row in a list.
- If the list itself is under test, **search / filter by the test's unique suffix** first.
- For infinite-scroll hierarchies use `scrollHierarchyToNode` (`playwright/utils/ContextCenterUtil.ts`).

### Actor-scoped and capped feeds need a dedicated user

Activity feeds, "my data", notifications and task inboxes are scoped to the viewer and often capped
(e.g. the newest 200 events). Every parallel spec acting as the shared admin fills that feed, burying
your seeded rows — it passes on the first test locally and fails later in CI. **Seed and view as a
spec-dedicated user** (`new UserClass()` + its own logged-in page), and poll the exact endpoint the UI
reads.

### Global settings and read-modify-write races

- A full-document `PUT` of a global setting or type definition overwrites whatever another worker
  wrote between your GET and your PUT. Batch changes into **one read + one write** and re-verify
  (`addRelationTypesWithCardinality` in `playwright/utils/ontologyStudio.ts`).
- Never JSON-Patch by array index (`/tags/1`, `/customProperties/3`) on shared documents — indexes
  shift under concurrent writes. Append with `/-`, address by name, or guard with a JSON Patch `test`
  op.
- Specs that toggle server-wide config (auth config, search settings, `enableAccessControl`, data
  asset rules) or trigger a **full reindex** must run in their dedicated single-worker project in
  `playwright.config.ts` (`sso-auth`, `DomainIsolation`, `Reindex`, `DataAssetRules*`, …). Never
  add them to the parallel `chromium` lane.

### The shared admin session broadcasts to every worker

Websocket events and toasts are fanned out to every socket of the user. Another worker's
`"pw-xxx" deleted successfully!` toast can cover your button or trip a strict-mode `alert-bar`
locator.

- Scope toast assertions by message: `waitForToastToDisappear(page, message)`,
  `expectNoErrorToast(page, message?)` (`playwright/utils/common.ts`).
- To click a control the stack can cover, use `clickIgnoringToasts(locator)` — see
  [A control under the toast stack](#a-control-under-the-toast-stack). Do not wait for the stack to
  empty: another worker refills it faster than it drains.
- When the UI under test is websocket-driven, isolate it with `setupWebSocketMock` /
  `emitWebSocketEvent` (`playwright/utils/websocket.ts`), set up **before** navigating, instead of
  waiting for a real event another job may also emit.

### Signing in: use the role page fixtures, not a bespoke user

`support/fixtures/userPages.ts` is the **single** place a signed-in page is built. It exposes one
fixture per pre-seeded role — `adminPage`, `dataConsumerPage`, `dataStewardPage`, `ownerPage`,
`editDescriptionPage`, `editTagsPage`, `editGlossaryTermPage`, `viewOnlyPage` — whose storage
states `e2e/auth.setup.ts` creates once and every worker reuses.

`e2e/fixtures/pages.ts` re-exports those and additionally aliases the built-in `page` to
`adminPage`. It contains no page-construction logic. Import it when the spec is admin-first and
wants `{ page }` to be a signed-in admin; import `support/fixtures/userPages` when the spec drives
named roles and wants `page` left as Playwright's own, so a file-level `test.use({ storageState })`
still applies.

```typescript
// yes — one context, no login on the critical path
import { test } from '../fixtures/pages';

test('a consumer cannot edit the description', async ({ page, dataConsumerPage }) => { … });

// no — a signup, a UI login, and a user teardown, per test
const user = new UserClass();
await user.create(apiContext);
const { page } = await performUserLogin(browser, user);
```

### When a seeded role will not do: `isolatedUser`

Some tests genuinely need their own account — their own team, their own policy, or they rename or
delete the account they are signed in as. That case has a fixture too, so there is never a reason
to hand-roll the lifecycle:

```typescript
import { test } from '../../support/fixtures/isolatedUser';

test.use({ isolatedUserOptions: { isAdmin: true } });

test('…', async ({ isolatedUserPage, isolatedUser }) => { … });
```

| Fixture | Scope | Cost | Use when |
|---|---|---|---|
| `isolatedUserPage` + `isolatedUser` | one account per **worker**, fresh page per test | one signup + one sign-in per worker | the test needs an account that is not a seeded role, but does not modify the account itself |
| `freshUserPage` | a new account per **test** | a signup + a sign-in per test | the test mutates the account it is signed in as (rename, role change, deactivate, delete) |

Both create the account and delete it in teardown. That is the whole point: the lifecycle is
Playwright's, not yours, so the `beforeAll` + array + `afterAll` shape that produces the merge
queue's number-one flake cannot be written by accident. `isolatedUserPage` also restores a
captured storage state — including IndexedDB, where the app keeps its token — instead of signing
in for every test.

### Signing in without the form: `signInViaApi`

Both fixtures authenticate through `utils/apiSignIn.ts` rather than `UserClass.login()`:

```typescript
await user.signIn(page); // one POST + two navigations
```

`UserClass.login()` performs nine UI interactions — navigate to /signin, wait for the form, fill,
Tab, fill, click, await the response, await the redirect, dismiss the getting-started modal,
collapse the sidebar. The suite does that ~290 times and none of it is what the tests are testing.
`signInViaApi` posts to `/api/v1/auth/login` (the same request `createAdminApiContext` makes, with
the base64 password the UI's `btoa()` produces) and writes the returned token with `setToken`,
which is the exact inverse of the `getToken` that `auth.setup.ts` reads back after a real sign-in.

`performUserLogin` already routes through it, so its call sites got the speed-up without changing;
it signs in with `landingPath: '/'` so the app resolves the user's configured landing page, the way
the form does. When a spec genuinely needs the form, call `signInThroughForm(page, user)` from
`utils/formSignIn.ts` — never `UserClass.login()` directly, which the lint rule rejects.

Two things to know if you touch this path:

- The navigation to the app origin before writing the token is required — IndexedDB is
  origin-scoped, so there is nowhere to write until the page has loaded the origin.
- `tokenStorage` only uses IndexedDB when `'serviceWorker' in navigator`, which is false on a
  non-secure origin; it silently falls back to localStorage there. Any test of this path must run
  against `localhost` or it exercises the fallback and proves nothing.
  `e2e/Features/TokenStorage.spec.ts` guards both, and the third case in it exists specifically to
  fail if the fallback is what is under test.

`openmetadata-playwright/no-form-sign-in` runs at **error** with no suppressions: the
whole corpus was migrated, so a `login()` in a spec is either new code that should be using
`signIn()` or a fixture, or a spec that is genuinely testing the sign-in form. It flags
*authenticating as* a bespoke user, not *creating* one — `new UserClass()` for an owner, reviewer
or assignee is ordinary test data and is untouched, as is `performUserLogin`, which signs in
through the API and owns its page, context and teardown.

Seven files legitimately drive the form, and they call `signInThroughForm(page, user)` from
`utils/formSignIn.ts` — the one module on the rule's exemption list, so no file needs a disable.
Two reasons qualify: the form is the subject (`Auth/Login.spec.ts`), or the *route the app lands on*
after sign-in is the assertion (`Features/AppMode/**`, where `AppModeAiPersonaLandsAtRoot` records
every navigation and asserts `/my-data` is never among them). If you find yourself adding an eighth,
check first that `signIn()` really cannot do the job.

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

### A control under the toast stack

Toasts render in a fixed strip at the bottom-center of the viewport, and the backend fans
notifications out to **every** session of the logged-in user — so another worker's cleanup toast can
land on top of your button at any moment. Pagination rows, dialog footers and bottom-aligned actions
are the usual victims.

```typescript
// ❌ WRONG - force only silences Playwright's hit-target check. The browser still
// delivers the event to whatever occupies that coordinate, so the toast is clicked.
await page.getByTestId("next-button").click({ force: true });

// ❌ WRONG - waiting for the stack to empty. Other workers refill it faster than it
// drains; one failing run polled 18 times across 15s and found a toast every time.
await expect(page.getByTestId("alert-bar")).toHaveCount(0);
await page.getByTestId("next-button").click();

// ✅ CORRECT - activate with the keyboard
await clickIgnoringToasts(page.getByTestId("next-button"));
```

A mouse click is delivered **to a coordinate**, so anything drawn over that coordinate takes it. A
key press is delivered **to the focused element**, so nothing painted on top is on its path — and on
a button the browser turns Enter into the same `click` event the mouse would have produced. The
helper asserts visible and enabled first, because `locator.press` runs no actionability checks of
its own and focusing a hidden element is a silent no-op.

Only for controls the browser activates with Enter (buttons, links, menu items). A checkbox needs
Space; a custom widget may need its own key. Check the target is a real `<button>` before switching.

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

### ⚠️ CRITICAL: React Aria Popovers Close on Scroll

React Aria closes a non-modal popover (Select, ComboBox, MultiSelect from `ui-core-components`)
when an ancestor of its trigger scrolls. Playwright's click-time actionability scroll lands one
frame after the popover opens, closes it, and the option click hangs with `element was detached`.

```typescript
// ❌ WRONG - the actionability scroll closes the popover under the click
await trigger.click();
await page.getByRole('option', { name: 'Table' }).click();

// ✅ CORRECT - settle the trigger in view first, then open and pick with retry
await scrollIntoViewAndSettle(trigger);
await selectOptionWithRetry(trigger, page.getByRole('option', { name: 'Table' }));
await expect(trigger).toContainText('Table');
```

Helpers (`playwright/utils/common.ts`): `scrollIntoViewAndSettle` (centre + two animation frames),
`selectOptionWithRetry(trigger, option, open?)` (re-opens if the popover closed),
`chooseSelectOption` (keyboard path for comboboxes).

A trace showing `detached` during a click is often a **product re-render bug** (unstable `options`
identity rebuilding the collection, unmemoized handlers cancelling a debounced fetch). Check the
component before adding test-side retries.

### Point-in-Time Reads Are Races

`isVisible()`, `isChecked()`, `textContent()`, `count()` and `getAttribute()` return the state *at
that instant* and never wait. Branching on them or comparing their result is a race with rendering.

```typescript
// ❌ WRONG - branches on whatever rendered first; hydrating views read ""
if (await editButton.isVisible()) {
  await expect(editButton).toBeDisabled();
}
const name = await header.textContent();
expect(name).toBe(entity.displayName);

// ✅ CORRECT - web-first assertions retry until the state settles
await expect(header).toContainText(entity.displayName);

// ✅ CORRECT - wait for either of two MUTUALLY EXCLUSIVE outcomes, then assert the one you expect
await expect(emptyState.or(resultsTable)).toBeVisible();
await expect(resultsTable).toBeVisible();

// ✅ CORRECT - poll a derived value
await expect.poll(async () => (await rows.allTextContents()).join()).toContain(tag.data.name);
```

`.or()` is strict: if either side can match more than one element it throws, so only use it for
mutually exclusive affordances.

### Assert Something Positive Before Anything Negative

`not.toBeVisible()` / `toHaveCount(0)` pass immediately on a blank or still-loading page.
`waitForAllLoadersToDisappear` also passes in the frame *before* a loader mounts. Always prove the
view rendered first.

```typescript
// ❌ WRONG - vacuously true before the page renders
await expect(page.getByTestId('delete-button')).not.toBeVisible();

// ✅ CORRECT - anchor on content that must exist, then assert absence
await expect(page.getByTestId('entity-header-name')).toContainText(table.entity.name);
await expect(page.getByTestId('delete-button')).not.toBeVisible();
```

### Prefer Idempotent Actions Over Toggles

A click-toggle races any async state restore (saved selections, persisted filters, form hydration):
the toggle lands before the restore, the restore re-applies, and the net state is inverted.

```typescript
// ❌ WRONG - toggles before the saved selection is restored, nets back to checked
await selectAll.click();

// ✅ CORRECT - wait for the restored state (also the persistence proof), then act idempotently
await expect(selectAll).toBeChecked();
await selectAll.uncheck();
await expect(selectAll).not.toBeChecked();
```

Use `check()` / `uncheck()` / `fill()` / `selectOption()` — they converge on a target state.
`click()` flips whatever the state happens to be.

### Ambiguous Page-Global Locators

A locator that matches both a modal's editor and the page behind it is not fixed by `.first()` — the
click lands on the page and fails with `ant-modal-wrap intercepts pointer events`. Scope it to the
dialog (`page.getByRole('dialog').getByTestId(...)`), or use the dedicated resolvers such as
`fillDescriptionBox` / `getDescriptionBox` (`playwright/utils/common.ts`), which prefer the editor
inside an open dialog.

---

## Waiting for Asynchronous State

Pick the wait that proves the state the **next step depends on** — not a generic "page is idle".

| The next step depends on… | Wait on | Not |
|---|---|---|
| A request your action fires | `waitForResponseWithStatus` / `clickAndWaitFor`, registered before the action | `waitForResponse` after the action |
| Page chrome and data loaders | `waitForAllLoadersToDisappear(page)` | `networkidle` |
| Right-panel widgets (tags, owners, glossary, domain) | `waitForWidgetsToRender(page)` or `waitForPageLoaded(page)` | loaders alone — the Suspense skeleton is not `data-testid="loader"` |
| An entity created/updated via API showing up in search-backed UI | `waitForSearchIndexed` / `waitForOwnerIndexed` / `waitForOwnedAssetCount` (`playwright/utils/polling.ts`) | a bare `/search/query` wait — the component's initial query satisfies it |
| A dropdown's aggregation for typed text | `waitForAggregation(page, { field, value })` (`playwright/utils/searchAggregation.ts`) | `waitForResponse('/search/aggregate*')` |
| An async backend job (move, validation, propagation) | `expect.poll` on the entity GET | the 200 of the triggering call |
| An Ant Design overlay/dropdown to finish animating | `waitForAntOverlayToOpen(overlay)` / `waitForAntdPopupToSettle(page)` | `toBeVisible()` alone |
| Client-side persistence with no network call | poll the store (`waitForDraftPersisted`, `waitForRecentlyViewed` in `playwright/utils/ContextCenterUtil.ts`) | a hard wait |

### Search index lag

API writes return before the index catches up, and most list UIs issue **one** search on mount and
re-query only when the search text changes — so a late index update is never picked up.

In order of preference:

1. **Don't go through search.** Navigate to the detail page by URL and wait on its immediately
   consistent GET (`/api/v1/tables/name/<fqn>`, `/api/v1/users/name/<name>`).
2. **Gate on the index** before the first search-backed UI step:
   ```typescript
   await table.create(apiContext);
   await waitForSearchIndexed(apiContext, table.entityResponseData.fullyQualifiedName, 'table_search_index');
   ```
   Use `waitForOwnerIndexed` after an owner PATCH (owners is a nested field — a plain term query
   silently matches nothing).
3. **Only then** retry the UI query inside `toPass` (re-type or reload), bounding each attempt.

### Async backend work: poll the entity, check `ok()` inside the poll

```typescript
await expect
  .poll(
    async () => {
      const res = await apiContext.get(`/api/v1/glossaryTerms/name/${encodeURIComponent(fqn)}?fields=parent`);
      expect(res.ok()).toBe(true); // an error body must not satisfy the check below
      return (await res.json()).parent?.fullyQualifiedName;
    },
    { timeout: 30_000, intervals: [500, 1_000, 2_000] }
  )
  .toBe(newParent.responseData.fullyQualifiedName);
```

Size the poll **below** the enclosing test/hook budget, or its own failure message never surfaces —
the test just times out.

### Debounced search: wait out the focus-time query

Focusing a search box fires an empty query; typing fires another. `debounce` only coalesces within
its window, so both run and the slower empty one can win, leaving results for `''` while the input
shows your text.

- Register a wait for the focus-time/initial query and await it **before** typing.
- Match the typed-query predicate on the typed text, not just the path.
- Re-typing the same term (`fill('')` + `fill(x)` inside the debounce window) dispatches nothing — a
  wait for a "new" response then hangs. Change the term or reload instead.

### Navigation

- Navigate by URL (`page.goto(route, { waitUntil: 'domcontentloaded' })`) rather than hovering the
  sidebar — the sidebar may not be mounted at `domcontentloaded`, and hover menus are timing-sensitive.
- For routes that auto-redirect (e.g. `/glossary` → first glossary), use `waitUntil: 'commit'`
  to avoid `net::ERR_ABORTED`.
- Import route constants from `playwright/constant/`, never from app `src/constants` (that pulls SVG
  and i18n into the test bundle).

### Route interception must survive teardown

A request still in flight when the page closes makes a `page.route` handler throw
`Route is already handled!`, `Response has been disposed` or `socket hang up`, and fails an otherwise
green test. Narrow the glob to the exact request, guard bodies (`body.data ?? []` — error responses
have no `data`), and swallow closed-target errors the way `support/fixtures/serverLoad.ts`
(`ignoreClosedTarget`, `fetchRouteResponse`) does.

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
`om-playwright/no-blanket-test-slow` rejects `test.slow()` at file or describe scope.

### Budget Sizing Rules

Defaults: test `60s`, `expect` `15s`, navigation `60s`. Size against a **degraded CI shard**
(1.5–3.5x a healthy one), not your laptop.

- **Measure before raising.** Add `test.slow()` only when CI timings show the test body over ~40s on
  healthy shards. A hang does not get fixed by more time — it just burns 180s instead of 60s.
- **`beforeAll`/`afterAll` inherit the test timeout.** A hook that seeds many entities or polls an
  index needs its own `test.setTimeout(...)` inside the hook; or make it faster with `settleAll`.
- **Inner waits must fit inside the outer budget.** A 90s poll inside a 60s test never reports its
  own message. Keep `expect.poll` / `toPass` / helper timeouts below the enclosing budget.
- **Bound the actions inside `toPass` / `expect.poll` callbacks.** An unbounded `click()` or `fill()`
  inside a retry block waits the whole test timeout on its first attempt, so it never retries. Pass
  an explicit `{ timeout }` to each action inside the block.
- **`page.goto` waits for `load` by default.** Use `waitUntil: 'domcontentloaded'` and then wait for
  the specific content you need.

### "Test timeout exceeded" Is Usually Not Where It Says

When the budget expires, Playwright reports whichever action happened to be running — often
`Target page, context or browser has been closed`. Before touching code:

1. Open the trace and check whether the test was **progressing steadily** (budget cliff) or **stuck
   on one wait** (hang — usually a predicate that can never match, see
   [Test Standards §7](#test-standards-to-follow)).
2. Check whether the **whole shard** was slow. CI uploads `playwright-timings-<shard>` artifacts
   with per-test `durationMs`:
   ```bash
   gh run download <runId> --pattern 'playwright-timings-*' -D failing
   gh run download <passingRunId> --pattern 'playwright-timings-*' -D passing
   ```
   Join the two by test `id`. If the shard-wide median slowdown is **> 1.3x**, the runner was degraded
   and the failure is a budget cliff, not a code regression.

---

## Test File Structure Template

Use this structure for all generated tests:

```typescript
import { test, expect } from "../../support/fixtures/base";
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

  // Anchor on rendered content first — a negative assertion on a blank page is vacuous.
  await expect(page.getByTestId("entity-header-name")).toBeVisible();

  // Assert the ONE expected outcome. Never branch on isVisible(): it reads a single
  // instant, and "either outcome passes" means the test verifies nothing.
  await expect(page.getByTestId("edit-description")).not.toBeVisible();
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

## Flake-Avoidance Helpers

Search here before writing a new wait or locator helper. Every entry exists because a flake was
root-caused to the problem it solves. Paths are relative to `playwright/`.

### Waits and responses

| Helper | File | Use when |
|---|---|---|
| `waitForResponseWithStatus(page, predicate, status)` | `utils/waitHelpers.ts` | Awaiting a response: matches the request, then throws a legible error on the wrong status |
| `clickAndWaitFor(page, locator, urlPattern, status?)` | `utils/waitHelpers.ts` | Click + hoisted response listener + status check in one call |
| `waitForAntOverlayToOpen(overlay)` | `utils/waitHelpers.ts` | Before clicking inside an Ant modal/popover still running its zoom animation |
| `waitForAntdPopupToSettle(page)` | `utils/common.ts` | Before clicking an Ant dropdown menu item (scale animation drift) |
| `waitForAllLoadersToDisappear(page)` | `utils/entity.ts` | Data loaders gone |
| `waitForWidgetsToRender(page)` | `utils/entity.ts` | Right-panel Suspense skeletons gone (tags, owners, glossary, domain) |
| `waitForPageLoaded(page)` | `utils/polling.ts` | `domcontentloaded` + loaders + widgets; the `networkidle` replacement |
| `waitForSearchIndexed(apiContext, fqn, index, opts?)` | `utils/polling.ts` | After an API create/update, before any search-backed UI step |
| `waitForOwnerIndexed(page, fqn, index, ownerId, present)` | `utils/polling.ts` | After an owner PATCH, before reading owners from search |
| `waitForOwnedAssetCount(apiContext, ownerId, count)` | `utils/polling.ts` | Before opening a page that reads an owner's asset count once on load |
| `waitForAggregation(page, { field, value })` | `utils/searchAggregation.ts` | Filter dropdown aggregation for the typed value (lint-enforced) |
| `triggerContractValidation` | `utils/dataContracts.ts` | Polls contract validation to a terminal status |

### Fixtures and API

| Helper | File | Use when |
|---|---|---|
| `okJson(response, label)` | `utils/apiResponse.ts` | Reading any API body in setup/support classes — throws at the failed call |
| `createOrFetch(apiContext, opts)` | `utils/apiResponse.ts` | Creates that may 409 on retry; rejects soft-deleted matches |
| `settleAll(promises)` | `utils/apiResponse.ts` | Parallel fixture creation with aggregated errors |
| `deleteFixtureEntity(apiContext, url)` | `utils/apiResponse.ts` | Idempotent cleanup that still surfaces 403/5xx |
| `withNotFoundRetry(send)` | `utils/apiResponse.ts` | A brief 404 on a just-created id while the reference lookup lags |
| `buildFqn(...segments)` / `quoteFqnSegment(name)` | `utils/apiResponse.ts` | Names that may contain `.` or `"` |

### Locators and interactions

| Helper | File | Use when |
|---|---|---|
| `getRowByName(page, name, rowSelector?)` | `utils/scopedLocators.ts` | Table rows by your entity's name instead of `.nth()` |
| `getCellByName(page, name)` | `utils/scopedLocators.ts` | Cells across Ant `Table` and react-aria `TableV2` |
| `scrollIntoViewAndSettle(locator)` | `utils/common.ts` | Before opening a React Aria popover near a scroll container |
| `selectOptionWithRetry(trigger, option, open?)` | `utils/common.ts` | React Aria Select/ComboBox option picks |
| `chooseSelectOption(trigger, option)` | `utils/common.ts` | Keyboard-driven combobox selection |
| `clickIgnoringToasts(locator)` | `utils/common.ts` | Clicking anything the bottom-center toast strip can cover (pagination, dialog footers) |
| `waitForToastToDisappear` / `expectNoErrorToast` / `dismissToasts` | `utils/common.ts` | Toasts under cross-worker notifications |
| `dismissHoverPopovers(page)` | `utils/common.ts` | Lingering Ant hover popovers covering the next target |
| `fillDescriptionBox` / `getDescriptionBox` | `utils/common.ts` | The description editor, preferring the one inside an open dialog |
| `scrollHierarchyToNode` | `utils/ContextCenterUtil.ts` | Infinite-scroll trees |
| `setupWebSocketMock` / `emitWebSocketEvent` / `cleanupWebSocketMock` | `utils/websocket.ts` | Websocket-driven UI isolated from other workers' events |
| `guardStorageStateBoot` / `claimFirstBoot` | `utils/storageStateRecovery.ts` | Contexts that boot to `/signin` despite valid storage state (already wired into shared login paths) |

---

## Diagnosing a Flaky Test

Fix the cause, once, where it lives. Adding a wait, raising a timeout, or wrapping in `toPass` without
knowing the mechanism moves the flake instead of removing it.

1. **Get the evidence.** Download the trace for the failing attempt (`trace: 'on-first-retry'`) and
   the shard's `playwright-timings-*` artifact. Note the exact error and the last *successful* step.
2. **Rule out the runner** (see [Test Timeouts](#test-timeouts)): a shard-wide median slowdown
   > 1.3x means a budget cliff, not a regression.
3. **Classify the failure** against [Why Tests Flake Here](#why-tests-flake-here):

   | Trace shows | Likely cause | Go to |
   |---|---|---|
   | Row/entity not found, 404, 409 on retry, wrong count | Shared data, leaked fixtures, caps | [Test Data Isolation](#test-data-isolation) |
   | Just-created entity missing from a list/picker | Search index lag | [Waiting for Asynchronous State](#waiting-for-asynchronous-state) |
   | Stuck on `waitForResponse` until timeout | Predicate never matches (status in predicate, wrong request, listener registered late) | [Test Standards §7](#test-standards-to-follow) |
   | Click selected the item above | Ant dropdown scale animation | [Anti-Flakiness Patterns](#anti-flakiness-patterns) → Ant Design dropdown |
   | `element was detached` during a click | Popover closed on scroll, or a product re-render | [Anti-Flakiness Patterns](#anti-flakiness-patterns) → React Aria popovers |
   | `... intercepts pointer events` | A toast, modal wrap or hover popover on top | [A control under the toast stack](#a-control-under-the-toast-stack), [Ambiguous locators](#ambiguous-page-global-locators) |
   | State inverted after reload/reopen | Toggle raced an async restore | [Idempotent actions](#prefer-idempotent-actions-over-toggles) |
   | `Route is already handled!` / `Response has been disposed` | Route handler outlived the page | [Route interception](#route-interception-must-survive-teardown) |

4. **Reproduce under load, not on an idle laptop.** Contention-dependent flakes rarely reproduce
   with a single worker:
   ```bash
   npx playwright test path/to/Spec.spec.ts --repeat-each=10 --workers=4
   ```
   Pair it with CPU throttling or run the whole affected directory alongside it. A 10/10 pass on an
   idle machine is not evidence of a fix.
5. **Run a control.** Before blaming your change, run the same spec on unpatched `main`. A test that
   fails on both is pre-existing — fix it separately and say so in the PR.
6. **Look for a product bug.** Several "test flakes" were real races in the product (stale debounced
   responses, lost multi-page selections, unstable component identity). If the user could hit the
   same race, fix the component and keep the test strict.
7. **Write down the mechanism** in the PR description (symptom → mechanism → fix), and in a short
   *why* comment at the call site when the fix is non-obvious (an extra wait, an unusual predicate).

---

## Quarantine Policy

Retries turn first-attempt failures into a green `flaky` status, which hides them. Quarantine makes
the lost coverage visible instead.

- **Threshold:** a test that fails its first attempt in **2 or more** merge-queue / AUT runs (counted
  per generated variant) is quarantined while it is diagnosed.
- **How:** add `{ tag: '@quarantine' }` to the test and record the evidence (runs, error, suspected
  mechanism, owner) in [`QUARANTINE.md`](./QUARANTINE.md). `playwright.config.ts` excludes the tag
  from every lane.
- **Soak:** `PLAYWRIGHT_RUN_QUARANTINED=true npx playwright test` runs only the quarantined set (setup
  and teardown projects still run so login and seeding happen).
- **Release:** root-cause, fix, remove the tag in the same PR, and move the entry to the released
  table in `QUARANTINE.md`. Quarantine is a holding pen, not a resting place — a tag without an entry
  or an owner is a bug.
- **Never** fix a flake by `test.skip`, deleting assertions, loosening an assertion until it cannot
  fail, or raising `retries`.

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
| `openmetadata-playwright/no-form-sign-in` | error | Do not authenticate by driving the sign-in form; use signIn() or a page fixture |
| `openmetadata-playwright/require-aggregation-wait-helper` | error | Require waitForAggregation instead of waiting on search/aggregate directly |
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
- [ ] Clicks on bottom-aligned controls use `clickIgnoringToasts`, never a wait for an empty toast stack
- [ ] No positional selectors (`.first()`, `.last()`, `.nth()`)
- [ ] No stored `:visible` locator references
- [ ] All dropdowns use `:visible` chain pattern correctly
- [ ] Ant dropdown items clicked only after `waitForAntdPopupToSettle`; post-click selection asserted
- [ ] React Aria pickers use `scrollIntoViewAndSettle` / `selectOptionWithRetry`
- [ ] No branching on `isVisible()` / `textContent()` / `count()` — web-first assertions only
- [ ] Every negative assertion is preceded by a positive one proving the view rendered
- [ ] State changes use idempotent actions (`check`/`uncheck`/`fill`), not click-toggles

### Test Data Isolation
- [ ] Every entity the test mutates is created by the test, with a `uuid()` name generated inside the hook
- [ ] No edits to `entity-data.setup.ts` assets; shared state mutated in a test is restored in `finally`
- [ ] No assertions on global counts/totals or on "the first item" of a list sorted by name
- [ ] Rows found by the test's unique name (or detail page by URL), not by position or page walk
- [ ] Viewer-scoped feeds (activity, inbox, my data) seeded and viewed as a dedicated user
- [ ] Specs that change server-wide settings or reindex run in their single-worker project
- [ ] Toast assertions scoped by message

### API & Network
- [ ] All response listeners registered BEFORE the action that triggers them
- [ ] Predicates match URL + method (+ distinguishing param); status asserted after, never inside
- [ ] All API responses validate status code (200, 201, 204) — `waitForResponseWithStatus` / `clickAndWaitFor`
- [ ] Support-class bodies read with `okJson`, creates that may 409 go through `createOrFetch`
- [ ] Search-backed UI after an API write is gated by `waitForSearchIndexed` (or bypassed via URL)
- [ ] Async backend work verified with `expect.poll` on the entity, `res.ok()` checked inside the poll

### Waits & Assertions
- [ ] Each wait proves the state the next step depends on (see [Waiting for Asynchronous State](#waiting-for-asynchronous-state))
- [ ] Right-panel widgets awaited with `waitForWidgetsToRender`, not loaders alone
- [ ] Semantic locators (getByRole, getByTestId) used
- [ ] Assertions use `.toBeVisible()` instead of `.waitForSelector()`

### Timeouts
- [ ] `test.slow()` only inside tests measured > ~40s in CI; never at file/describe scope
- [ ] Heavy `beforeAll` hooks set their own timeout; inner polls sized below the enclosing budget
- [ ] Actions inside `toPass` / `expect.poll` callbacks carry an explicit `{ timeout }`

### Stability Proof
- [ ] Spec passes `--repeat-each=10 --workers=4` locally
- [ ] New or re-enabled spec files have entries in `.github/playwright/timing-baseline.json` — `build_playwright_shards.py` fails the plan for a file with ≥ 5 tests and no timing history, and under-budgets its shard otherwise

### ESLint
- [ ] `yarn lint:playwright` passes with zero errors (this is what CI runs)
- [ ] No new warnings introduced (fix existing ones when touching a file)

### Coverage & Roles
- [ ] Multi-role tests use appropriate fixtures
- [ ] Data persistence verified after reload/navigation
- [ ] Error states handled gracefully
