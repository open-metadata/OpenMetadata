/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { expect, test } from '@playwright/test';
import { AlertClass } from '../../../support/entity/AlertClass';
import { TableClass } from '../../../support/entity/TableClass';
import { getApiContext, toastNotification, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode, redirectToAiModeHomePage } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('AI mode Observability', () => {
  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  test('index route should redirect to data-quality', async ({ page }) => {
    await page.goto('/observability', {
      waitUntil: 'domcontentloaded',
    });
    // Wait for React to mount and process the <Navigate> redirect
    await page.waitForURL('**/observability/data-quality**', {
      timeout: 15000,
    });

    await expect(page).toHaveURL(/\/observability\/data-quality/);
  });

  test.describe('Page Rendering', () => {
    const pages = [
      {
        name: 'Data Quality',
        path: '/observability/data-quality',
        expectedText: 'Data Quality',
      },
      {
        name: 'Incident Manager',
        path: '/observability/incident-manager',
        expectedText: 'Incident Manager',
      },
      {
        name: 'Alerts',
        path: '/observability/alerts',
        expectedText: 'Observability Alert',
      },
      {
        name: 'Test Library',
        path: '/observability/test-library',
        expectedText: 'Data Quality Rules',
      },
    ];

    for (const { name, path, expectedText } of pages) {
      test(`${name} page should render inside the AI shell`, async ({
        page,
      }) => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        // eslint-disable-next-line om-playwright/no-positional-locator -- the module label also renders in the AI sidebar nav, so the page body copy is the second match; this only asserts the page painted, not which node
        await expect(page.getByText(expectedText).first()).toBeVisible();
      });
    }
  });

  test.describe('Test Library — Add Test Definition (modal variant)', () => {
    test('opens the form as a centered modal (no drawer doc panel) and cancels', async ({
      page,
    }) => {
      await page.goto('/observability/test-library', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('add-test-definition-button').click();

      // AI mode renders the migrated form as a centered modal: the shared form
      // body + Create footer are present, and there is no drawer doc panel.
      await page
        .getByTestId('test-definition-form-body')
        .waitFor({ state: 'visible' });

      await expect(page.getByTestId('create-btn')).toBeVisible();
      await expect(page.getByTestId('cancel-btn')).toBeVisible();
      await expect(page.locator('.drawer-doc-panel')).toHaveCount(0);
      await expect(page.getByTestId('test-definition-name')).toBeVisible();
      await expect(page.getByTestId('entity-type')).toBeVisible();

      await page.getByTestId('cancel-btn').click();

      await expect(
        page.getByTestId('test-definition-form-body')
      ).not.toBeVisible();
    });

    test('creates a test definition through the modal', async ({ page }) => {
      const testDefinitionName = `AiModalTestDefinition${uuid()}`;

      await page.goto('/observability/test-library', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const { apiContext } = await getApiContext(page);

      try {
        await page.getByTestId('add-test-definition-button').click();
        await page
          .getByTestId('test-definition-form-body')
          .waitFor({ state: 'visible' });

        await page
          .getByTestId('test-definition-name')
          .locator('input')
          .fill(testDefinitionName);

        // Entity type is a react-aria Select: click the field, pick the option.
        await page.locator('[id="root/entityType"]').click();
        await page.getByRole('option', { exact: true, name: 'TABLE' }).click();

        // supportedDataTypes is required while the default OpenMetadata
        // platform is selected. Select two values to guard its multi-select
        // contract; the listbox stays open between selections.
        const supportedDataTypes = page.locator(
          '[id="root/supportedDataTypes"]'
        );
        await supportedDataTypes.fill('NUMBER');
        await page.getByRole('option', { exact: true, name: 'NUMBER' }).click();
        await supportedDataTypes.fill('VARCHAR');
        await page
          .getByRole('option', { exact: true, name: 'VARCHAR' })
          .click();
        await expect(
          page
            .getByTestId('supported-data-types')
            .getByText('NUMBER', { exact: true })
        ).toBeVisible();
        await expect(
          page
            .getByTestId('supported-data-types')
            .getByText('VARCHAR', { exact: true })
        ).toBeVisible();
        // Dismiss the combobox popover by clicking another field inside the
        // dismissable modal. Escape would close the modal itself.
        await page.getByTestId('test-definition-name').locator('input').click();
        await expect(page.getByRole('listbox')).toBeHidden();
        await expect(
          page.getByTestId('test-definition-form-body')
        ).toBeVisible();

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'POST'
        );

        await page.getByTestId('create-btn').click();

        const response = await createResponse;

        expect(response.status()).toBe(201);
        expect(response.request().postDataJSON()).toEqual(
          expect.objectContaining({
            supportedDataTypes: ['NUMBER', 'VARCHAR'],
          })
        );

        await toastNotification(page, /created successfully/i);
      } finally {
        // Cleanup runs even if an assertion fails, so no orphaned definition
        // is left behind in the shared environment.
        await apiContext.delete(
          `/api/v1/dataQuality/testDefinitions/name/${testDefinitionName}?hardDelete=true&recursive=false`
        );
      }
    });

    test('edits a test definition through the modal', async ({ page }) => {
      // "Aaaa" prefix sorts the row to the first page so its edit action is
      // reliably rendered without paginating.
      const testDefinitionName = `AaaaAiModalEditDefinition${uuid()}`;

      // Load the app first so getApiContext picks up the admin auth token.
      await page.goto('/observability/test-library', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const { apiContext } = await getApiContext(page);

      try {
        // Seed via API so the edit path is deterministic (no UI create step).
        const seedResponse = await apiContext.post(
          '/api/v1/dataQuality/testDefinitions',
          {
            data: {
              description: 'Seed for the AI modal edit test',
              displayName: testDefinitionName,
              entityType: 'TABLE',
              name: testDefinitionName,
              supportedDataTypes: ['NUMBER'],
              testPlatforms: ['OpenMetadata'],
            },
          }
        );
        expect(seedResponse.status()).toBe(201);

        // Reload so the seeded definition appears in the table.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);

        await page
          .getByTestId(`edit-test-definition-${testDefinitionName}`)
          .click();

        // Edit opens the same migrated form as a centered modal (no drawer doc
        // panel), pre-filled, with the immutable name disabled.
        await page
          .getByTestId('test-definition-form-body')
          .waitFor({ state: 'visible' });
        await expect(page.locator('.drawer-doc-panel')).toHaveCount(0);

        const nameInput = page
          .getByTestId('test-definition-name')
          .locator('input');
        await expect(nameInput).toHaveValue(testDefinitionName);
        await expect(nameInput).toBeDisabled();

        const updatedDisplayName = `${testDefinitionName} Updated`;
        const displayNameInput = page
          .getByTestId('display-name')
          .locator('input');
        await displayNameInput.clear();
        await displayNameInput.fill(updatedDisplayName);

        const patchResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testDefinitions') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('create-btn').click();

        const response = await patchResponse;
        expect(response.status()).toBe(200);

        const updatedBody = await response.json();
        expect(updatedBody.displayName).toBe(updatedDisplayName);

        await toastNotification(page, /updated successfully/i);
      } finally {
        await apiContext.delete(
          `/api/v1/dataQuality/testDefinitions/name/${testDefinitionName}?hardDelete=true&recursive=false`
        );
      }
    });

    // Regression: the route used to sit inside a LiveRefreshBoundary, which
    // remounts its child on every testCase/testSuite websocket invalidation.
    // Those types are broadcast to every connected client, so any parallel
    // spec (or any colleague) touching a test case tore this page down and
    // took the open modal — and whatever had been typed into it — with it.
    // The Test Library renders test DEFINITIONS and nothing derived from
    // testCase/testSuite, so it must not react to them at all.
    test('modal survives a testCase/testSuite invalidation', async ({
      page,
    }) => {
      await page.goto('/observability/test-library', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const { apiContext } = await getApiContext(page);

      await page.getByTestId('add-test-definition-button').click();
      await page
        .getByTestId('test-definition-form-body')
        .waitFor({ state: 'visible' });

      const typedName = `SurvivesInvalidation${uuid()}`;
      await page
        .getByTestId('test-definition-name')
        .locator('input')
        .fill(typedName);

      // Emit a real invalidation: create + delete a logical test suite. The
      // server broadcasts testSuite create AND delete to every client, so this
      // is the same signal a colleague's action produces.
      const suiteName = `InvalidationProbe${uuid()}`;
      const created = await apiContext.post('/api/v1/dataQuality/testSuites', {
        data: { name: suiteName },
      });

      expect(created.status()).toBe(201);

      const { id: suiteId } = await created.json();
      await apiContext.delete(
        `/api/v1/dataQuality/testSuites/${suiteId}?hardDelete=true&recursive=true`
      );

      // Server coalesces bursts over 500ms and the client over 300ms; give the
      // signal room to land so a pass can't just be the test outrunning it.
      // eslint-disable-next-line playwright/no-wait-for-timeout -- the debounce being verified has no observable signal: the point is that nothing arrives during the window, so there is no response or DOM change to await
      await page.waitForTimeout(3000);

      await expect(page.getByTestId('test-definition-form-body')).toBeVisible();
      await expect(
        page.getByTestId('test-definition-name').locator('input')
      ).toHaveValue(typedName);

      await page.getByTestId('cancel-btn').click();
    });
  });

  test.describe('Data Quality Tab Navigation', () => {
    test('tabs should navigate within AI mode', async ({ page }) => {
      await page.goto('/observability/data-quality', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      // Verify all tabs are present
      await expect(page.getByRole('tab', { name: 'Summary' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Test Cases' })).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Test Suites' })
      ).toBeVisible();

      // Navigate to Test Cases — should stay in AI mode
      await page.getByRole('tab', { name: 'Test Cases' }).click();
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/\/observability\/data-quality\/test-cases/);
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();

      // Navigate to Test Suites — should stay in AI mode
      await page.getByRole('tab', { name: 'Test Suites' }).click();
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        /\/observability\/data-quality\/test-suites/
      );

      // Navigate back to Summary — should stay in AI mode
      await page.getByRole('tab', { name: 'Summary' }).click();
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/\/observability\/data-quality\/dashboard/);
    });

    test('Test Suites sub-tabs should navigate within AI mode', async ({
      page,
    }) => {
      test.slow();

      await redirectToAiModeHomePage(page);

      const { apiContext, afterAction } = await getApiContext(page);
      const table = new TableClass();

      try {
        // Create table with test suite so sub-tabs have data
        await table.create(apiContext);
        await table.createTestSuiteAndPipelines(apiContext);

        await page.goto('/observability/data-quality/test-suites', {
          waitUntil: 'domcontentloaded',
        });
        await waitForAllLoadersToDisappear(page);

        // Click Bundle Suites sub-tab
        const bundleSuitesTab = page.getByTestId('bundle-suite-radio-btn');

        await expect(bundleSuitesTab).toBeVisible();
        await bundleSuitesTab.click();
        await waitForAllLoadersToDisappear(page);

        await expect(page).toHaveURL(
          /\/observability\/data-quality\/test-suites\/bundle-suites/
        );
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();

        // Click Table Suites sub-tab
        const tableSuitesTab = page.getByTestId('table-suite-radio-btn');

        await expect(tableSuitesTab).toBeVisible();
        await tableSuitesTab.click();
        await waitForAllLoadersToDisappear(page);

        await expect(page).toHaveURL(
          /\/observability\/data-quality\/test-suites\/table-suites/
        );
      } finally {
        await table.delete(apiContext);
        await afterAction();
      }
    });

    test('direct URL to deep route should render correctly', async ({
      page,
    }) => {
      await page.goto('/observability/data-quality/test-cases', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Test Cases' })).toBeVisible();
    });
  });

  test.describe('Alerts Navigation', () => {
    test('Add Alert button should open modal within AI mode', async ({
      page,
    }) => {
      await page.goto('/observability/alerts', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const addButton = page.getByTestId('add-alert-button');

      await expect(addButton).toBeVisible();
      await addButton.click();
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/\/observability\/alerts$/);
      // eslint-disable-next-line om-playwright/no-positional-locator -- 'Add Alert' labels both the page button and its modal trigger; either proves the alerts page rendered
      await expect(page.getByText('Add Alert').first()).toBeVisible();
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });

  test('Alerts page should not show home breadcrumb in AI mode', async ({
    page,
  }) => {
    await page.goto('/observability/alerts', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    // eslint-disable-next-line om-playwright/no-positional-locator -- the label also renders in the AI sidebar nav; this only asserts the alerts page painted
    await expect(page.getByText('Observability Alert').first()).toBeVisible();
    await expect(page.getByTestId('breadcrumb')).toBeVisible();
    await expect(page.getByTestId('breadcrumb').getByLabel('Home')).toHaveCount(
      0
    );
  });

  test.describe('Internal routing — destination routes mount inside the AI shell', () => {
    let table: TableClass;
    let alert: AlertClass;

    test.beforeAll(async ({ browser }) => {
      const setupPage = await browser.newPage();
      await redirectToAiModeHomePage(setupPage);
      const { apiContext, afterAction } = await getApiContext(setupPage);

      table = new TableClass();
      await table.create(apiContext);
      await table.createTestSuiteAndPipelines(apiContext);
      await table.createTestCase(apiContext);

      alert = new AlertClass({ alertType: 'Observability' });
      await alert.create(apiContext);

      await afterAction();
      await setupPage.close();
    });

    test.afterAll(async ({ browser }) => {
      const teardownPage = await browser.newPage();
      const { apiContext, afterAction } = await getApiContext(teardownPage);

      await alert?.delete(apiContext);
      await table?.delete(apiContext);

      await afterAction();
      await teardownPage.close();
    });

    test('test-suite detail URL renders inside the AI shell', async ({
      page,
    }) => {
      const fqn = table.testSuiteResponseData.fullyQualifiedName;
      await page.goto(`/observability/test-suites/${encodeURIComponent(fqn)}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/\/observability\/test-suites\/[^/?]+/);
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });

    test('test-case detail URL renders inside the AI shell', async ({
      page,
    }) => {
      const fqn = table.testCasesResponseData[0]?.fullyQualifiedName;
      await page.goto(
        `/observability/test-case/${encodeURIComponent(fqn)}/test-case-results`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        /\/observability\/test-case\/[^/?]+\/test-case-results/
      );
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });

    test('alert detail URL renders inside the AI shell', async ({ page }) => {
      const fqn = alert.responseData.fullyQualifiedName;
      await page.goto(
        `/observability/alert/${encodeURIComponent(fqn)}/configuration`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        /\/observability\/alert\/[^/?]+\/configuration/
      );
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });
});
