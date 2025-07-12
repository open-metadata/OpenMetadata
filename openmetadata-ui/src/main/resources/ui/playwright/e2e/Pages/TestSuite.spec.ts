/*
 *  Copyright 2024 Collate.
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
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import {
  assignDomain,
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  removeDomain,
  toastNotification,
  updateDomain,
  uuid,
} from '../../utils/common';
import { addMultiOwner, removeOwnersFromList } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
const domain1 = new Domain();
const domain2 = new Domain();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await user1.create(apiContext);
  await user2.create(apiContext);
  await table.createTestCase(apiContext);
  await table.createTestCase(apiContext);
  await domain1.create(apiContext);
  await domain2.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await user1.delete(apiContext);
  await user2.delete(apiContext);
  await domain1.delete(apiContext);
  await domain2.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Logical TestSuite', async ({ page }) => {
  test.slow();

  const NEW_TEST_SUITE = {
    name: `mysql_matrix-${uuid()}`,
    description: 'mysql critical matrix',
  };
  const testCaseName1 = table.testCasesResponseData?.[0]?.['name'];
  const testCaseName2 = table.testCasesResponseData?.[1]?.['name'];
  await page.goto('/data-quality/test-suites/bundle-suites');
  await page.waitForLoadState('networkidle');

  await test.step('Create', async () => {
    await page.click('[data-testid="add-test-suite-btn"]');
    await page.fill('[data-testid="test-suite-name"]', NEW_TEST_SUITE.name);
    await page.locator(descriptionBox).fill(NEW_TEST_SUITE.description);

    const getTestCase = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*${testCaseName1}*`
    );
    await page.fill(
      '[data-testid="test-case-selection-card"] [data-testid="searchbar"]',
      testCaseName1
    );
    await getTestCase;

    await page.click(
      `[data-testid="test-case-selection-card"] [data-testid="${testCaseName1}"]`
    );
    const createTestSuiteResponse = page.waitForResponse(
      '/api/v1/dataQuality/testSuites'
    );
    await page.click('[data-testid="submit-button"]');
    await createTestSuiteResponse;
    await toastNotification(page, 'Test Suite created successfully.');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const searchTestSuiteResponse = page.waitForResponse(
      `/api/v1/dataQuality/testSuites/search/list?*${NEW_TEST_SUITE.name}*testSuiteType=logical*`
    );
    await page.getByTestId('searchbar').fill(NEW_TEST_SUITE.name);
    await searchTestSuiteResponse;

    await page.click(`[data-testid="${NEW_TEST_SUITE.name}"]`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  });

  await test.step('Domain Add, Update and Remove', async () => {
    await assignDomain(page, domain1.responseData);
    await updateDomain(page, domain2.responseData);
    await removeDomain(page, domain2.responseData);
  });

  await test.step(
    'User as Owner assign, update & delete for test suite',
    async () => {
      await addMultiOwner({
        page,
        ownerNames: [user1.getUserName()],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: EntityTypeEndpoint.TestSuites,
        type: 'Users',
      });
      await removeOwnersFromList({
        page,
        ownerNames: [user1.getUserName()],
        endpoint: EntityTypeEndpoint.TestSuites,
      });
      await addMultiOwner({
        page,
        ownerNames: [user2.getUserName()],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: EntityTypeEndpoint.TestSuites,
        type: 'Users',
      });
    }
  );

  await test.step('Add test case to logical test suite', async () => {
    const testCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list*'
    );
    await page.click('[data-testid="add-test-case-btn"]');
    await testCaseResponse;

    const getTestCase = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*${testCaseName2}*`
    );
    await page.fill('[data-testid="searchbar"]', testCaseName2);
    await getTestCase;

    await page.click(`[data-testid="${testCaseName2}"]`);
    const updateTestCase = page.waitForResponse(
      '/api/v1/dataQuality/testCases/logicalTestCases'
    );
    await page.click('[data-testid="submit"]');
    await updateTestCase;
    await page.waitForSelector('.ant-modal-content', {
      state: 'detached',
    });
  });

  await test.step('Add test suite pipeline', async () => {
    await page.getByRole('tab', { name: 'Pipeline' }).click();

    await expect(page.getByTestId('add-pipeline-button')).toBeVisible();

    await page.getByTestId('add-pipeline-button').click();
    await page.getByTestId('select-all-test-cases').click();

    await expect(page.getByTestId('cron-type').getByText('Day')).toBeAttached();

    await page.getByTestId('deploy-button').click();

    await expect(page.getByTestId('view-service-button')).toBeVisible();

    await page.waitForSelector('[data-testid="body-text"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('success-line')).toContainText(
      /has been created and deployed successfully/
    );

    await page.getByTestId('view-service-button').click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  });

  await test.step('Remove test case from logical test suite', async () => {
    await page.click(`[data-testid="remove-${testCaseName1}"]`);
    const removeTestCase1 = page.waitForResponse(
      '/api/v1/dataQuality/testCases/logicalTestCases/*/*'
    );
    await page.click('[data-testid="save-button"]');
    await removeTestCase1;
    await page.click(`[data-testid="remove-${testCaseName2}"]`);
    const removeTestCase2 = page.waitForResponse(
      '/api/v1/dataQuality/testCases/logicalTestCases/*/*'
    );
    await page.click('[data-testid="save-button"]');
    await removeTestCase2;
  });

  await test.step('Test suite filters', async () => {
    const owner = user2.getUserName();
    const testSuite = page.waitForResponse(
      '/api/v1/dataQuality/testSuites/search/list?*testSuiteType=logical*'
    );
    await page.getByRole('link', { name: 'Test Suites' }).click();
    await testSuite;

    await page.click('[data-testid="owner-select-filter"]');
    await page.waitForSelector("[data-testid='select-owner-tabs']", {
      state: 'visible',
    });
    await page.waitForSelector(`[data-testid="loader"]`, {
      state: 'detached',
    });
    const getOwnerList = page.waitForResponse(
      '/api/v1/search/query?q=*isBot:false*index=user_search_index*'
    );
    await page.click('.ant-tabs [id*=tab-users]');
    await getOwnerList;
    await page.waitForSelector(`[data-testid="loader"]`, {
      state: 'detached',
    });

    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.fill('[data-testid="owner-select-users-search-bar"]', owner);
    await searchOwner;

    const testSuiteByOwner = page.waitForResponse(
      '/api/v1/dataQuality/testSuites/search/list?*owner=*'
    );
    await page.click(`.ant-popover [title="${owner}"]`);
    await testSuiteByOwner;
    await page.waitForSelector(`[data-testid="${NEW_TEST_SUITE.name}"]`, {
      state: 'visible',
    });

    await expect(
      page.locator(`[data-testid="${NEW_TEST_SUITE.name}"]`)
    ).toBeVisible();

    await page.click(`[data-testid="${NEW_TEST_SUITE.name}"]`);
  });

  await test.step('Delete', async () => {
    await page.click('[data-testid="manage-button"]');
    await page.click('[data-testid="delete-button"]');

    // Click on Permanent/Hard delete option
    await page.click('[data-testid="hard-delete-option"]');
    await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
    const deleteResponse = page.waitForResponse(
      '/api/v1/dataQuality/testSuites/*?hardDelete=true&recursive=true'
    );
    await page.click('[data-testid="confirm-button"]');
    await deleteResponse;
    await toastNotification(
      page,
      `"${NEW_TEST_SUITE.name}" deleted successfully!`
    );
  });
});
