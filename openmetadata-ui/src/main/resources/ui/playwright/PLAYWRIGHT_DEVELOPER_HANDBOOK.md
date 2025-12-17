# OpenMetadata Playwright Testing Handbook

## Test standards to follow

1. **Descriptive Names**: Use clear, descriptive test names that explain the expected behaviour

2. **Global Setup Utilisation**: Setups/operations commonly used across multiple test files should be moved to global setups/fixtures. Ex. `auth.setup.ts`, `entity-data.setup.ts`, `playwright/e2e/fixtures/pages.ts`.
    - `auth.setup.ts` -> Used for signing in of users with different roles, which can be used in all tests.
    - `entity-data.setup.ts` -> Each type of data asset is created to avoid the data creation in each test file. `Note: No edit/delete operations should be performed on these assets since it can impact the other tests`
    - `playwright/e2e/fixtures/pages.ts` -> contains fixture-based setup of logged-in pages for users with different roles like admin, data consumer, data steward, etc. These pages can be directly used in the specs by using the exported `test` from the file.

3. **Test setups**: Setup operations for creating a test scenario should be handled via API rather than being done from the UI to reduce the time taken for test setups. `Note: Please ensure that the UI flow for the same action is already being tested in some tests`

Ex.
```typescript
describe('Some tests', () => {
  beforeAll(async () => {
    // We are setting the owner of a table using API here rather than setting it from the UI
    // Since the tests for setting the owner from UI already exist.
    await apiContext.patch('/api/v1/table',{data:[owner: 'something']});
  });
});
```

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

5. **Proper Selectors**: Always use data-testid, id or any other type of **unique** selectors. Almost always avoid using `className` as a final selector.

6. **Proper Waits**: Add proper waits before actions that are dependent on any async operations. Always prefer `API awaits` if any action demands or results in a particular API call.

Ex. wait on API/elements/loaders
```typescript
// Wait for API response.
await page.waitForResponse(response => 
  response.url().includes('/api/v1/tables') && response.status() === 200
);

// Wait for specific elements
await expect(page.getByTestId('success-message')).toBeVisible();

// Wait for custom conditions
await page.waitForFunction(() => {
  return page.waitForSelector('[data-testid="Loader"]'),{state: "hidden"});
});

// Use custom wait utilities
await waitForAllLoadersToDisappear(page);
```

7. **API Awaits**: While putting waits on the API calls, keep the following things in check.
    1. The APIs should be as specific as possible.
    Ex. prefer `/api/table/name/${tableName}*` than `/api/table/name/*`

    2. Avoid some common parameters or their values in the API unless they are necessary.
    Ex. prefer `/api/tables?*` than `/api/tables?limit=12&include=deleted` since the parameter values or order may change in future. 
    `Note: Exception would be when we are intentionally waiting on something, like '/api/tables?*filter=new*' after applying some filter.`