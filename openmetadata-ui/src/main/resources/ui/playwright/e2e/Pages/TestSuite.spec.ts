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
import { expect } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  assignSingleSelectDomain,
  descriptionBox,
  redirectToHomePage,
  removeSingleSelectDomain,
  toastNotification,
  uuid,
} from '../../utils/common';
import { addMultiOwner, removeOwnersFromList } from '../../utils/entity';
import { test } from '../fixtures/pages';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';

const table = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
const domain1 = new Domain();
const domain2 = new Domain();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.create(apiContext);
  await user1.create(apiContext);
  await user2.create(apiContext);
  await table.createTestCase(apiContext);
  await table.createTestCase(apiContext);
  await domain1.create(apiContext);
  await domain2.create(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Logical TestSuite', PLAYWRIGHT_INGESTION_TAG_OBJ, async ({ page, ownerPage }) => {
  test.slow();

  const NEW_TEST_SUITE = {
    name: `mysql_matrix-${uuid()}`,
    description: 'mysql critical matrix',
  };
  const testCaseName1 = table.testCasesResponseData?.[0]?.['name'];
  const testCaseName2 = table.testCasesResponseData?.[1]?.['name'];
  await page.goto('/data-quality/test-suites/bundle-suites');
  await page.waitForLoadState('networkidle');

  const loggedInUserRequest = ownerPage.waitForResponse(
    `/api/v1/users/loggedInUser*`
  );
  await redirectToHomePage(ownerPage);
  const loggedInUserResponse = await loggedInUserRequest;
  const loggedInUser = await loggedInUserResponse.json();

  await test.step('Create', async () => {
    await page.click('[data-testid="add-test-suite-btn"]');
    await page.fill('[data-testid="test-suite-name"]', NEW_TEST_SUITE.name);
    await page.locator(descriptionBox).fill(NEW_TEST_SUITE.description);

    const getTestCase = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*`
    );
    await page.fill(
      '[data-testid="test-case-selection-card"] [data-testid="searchbar"]',
      testCaseName1
    );
    await getTestCase;

    await page.waitForSelector(
      "[data-testid='test-case-selection-card'] [data-testid='loader']",
      { state: 'detached' }
    );

    await page.click(
      `[data-testid="test-case-selection-card"] [data-testid="${testCaseName1}"]`
    );
    const createTestSuiteResponse = page.waitForResponse(
      '/api/v1/dataQuality/testSuites'
    );
    await page.click('[data-testid="submit-button"]');
    await createTestSuiteResponse;
    await toastNotification(page, 'Test Suite created successfully.');

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  });

  await test.step('Domain Add, Update and Remove', async () => {
    await assignSingleSelectDomain(page, domain1.responseData);
    await assignSingleSelectDomain(page, domain2.responseData);
    await removeSingleSelectDomain(page, domain2.responseData, false);
  });

  await test.step(
    'User as Owner assign, update & delete for test suite',
    async () => {
      await addMultiOwner({
        page,
        ownerNames: [user1.getUserDisplayName()],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: EntityTypeEndpoint.TestSuites,
        type: 'Users',
      });
      await removeOwnersFromList({
        page,
        ownerNames: [user1.getUserDisplayName()],
        endpoint: EntityTypeEndpoint.TestSuites,
      });
      await addMultiOwner({
        page,
        ownerNames: [loggedInUser.displayName],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: EntityTypeEndpoint.TestSuites,
        type: 'Users',
      });
    }
  );

  await test.step('Add test case to logical test suite by owner', async () => {
    await ownerPage.goto(`test-suites/${NEW_TEST_SUITE.name}`);
    await ownerPage.waitForLoadState('networkidle');
    await ownerPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    const testCaseResponse = ownerPage.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list*'
    );
    await ownerPage.click('[data-testid="add-test-case-btn"]');
    await testCaseResponse;

    const getTestCase = ownerPage.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*`
    );
    await ownerPage.fill('[data-testid="searchbar"]', testCaseName2);
    await getTestCase;

    await ownerPage.click(`[data-testid="${testCaseName2}"]`);
    const updateTestCase = ownerPage.waitForResponse(
      '/api/v1/dataQuality/testCases/logicalTestCases'
    );
    await ownerPage.click('[data-testid="submit"]');
    await updateTestCase;
    await ownerPage.waitForSelector('.ant-modal-content', {
      state: 'detached',
    });
  });

  await test.step('Add test suite pipeline', async () => {
    await page.getByRole('tab', { name: 'Pipeline' }).click();

    await expect(page.getByTestId('add-placeholder-button')).toBeVisible();

    await page.getByTestId('add-placeholder-button').click();
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

  await test.step(
    'Remove test case from logical test suite by owner',
    async () => {
      await ownerPage.getByTestId(`action-dropdown-${testCaseName1}`).click();
      await ownerPage.click(`[data-testid="remove-${testCaseName1}"]`);
      const removeTestCase1 = ownerPage.waitForResponse(
        '/api/v1/dataQuality/testCases/logicalTestCases/*/*'
      );
      await ownerPage.click('[data-testid="save-button"]');
      await removeTestCase1;
      await ownerPage.getByTestId(`action-dropdown-${testCaseName2}`).click();
      await ownerPage.click(`[data-testid="remove-${testCaseName2}"]`);
      const removeTestCase2 = ownerPage.waitForResponse(
        '/api/v1/dataQuality/testCases/logicalTestCases/*/*'
      );
      await ownerPage.click('[data-testid="save-button"]');
      await removeTestCase2;
    }
  );

  await test.step('Test suite filters', async () => {
    const owner = loggedInUser.displayName;
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
      '/api/v1/search/query?q=&index=user_search_index&*'
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

  await test.step('Delete test suite by owner', async () => {
    await ownerPage.click('[data-testid="manage-button"]');
    await ownerPage.click('[data-testid="delete-button"]');

    // Click on Permanent/Hard delete option
    await ownerPage.click('[data-testid="hard-delete-option"]');
    await ownerPage.fill('[data-testid="confirmation-text-input"]', 'DELETE');
    const deleteResponse = ownerPage.waitForResponse(
      '/api/v1/dataQuality/testSuites/*?hardDelete=true&recursive=true'
    );
    await ownerPage.click('[data-testid="confirm-button"]');
    await deleteResponse;
    await toastNotification(
      ownerPage,
      `"${NEW_TEST_SUITE.name}" deleted successfully!`
    );
  });
});
