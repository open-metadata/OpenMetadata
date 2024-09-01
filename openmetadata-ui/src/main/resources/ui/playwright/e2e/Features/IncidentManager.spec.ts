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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
import { acknowledgeTask, assignIncident } from '../../utils/incidentManager';

const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const users = [user1, user2, user3];
const table1 = new TableClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll(async ({ browser }) => {
  // since we need to poll for the pipeline status, we need to increase the timeout
  test.setTimeout(90000);

  const { afterAction, apiContext, page } = await createNewPage(browser);

  const { pipeline } = await table1.createTestSuiteAndPipelines(apiContext);
  for (let i = 0; i < 3; i++) {
    await table1.createTestCase(apiContext, {
      parameterValues: [
        { name: 'minColValue', value: 12 },
        { name: 'maxColValue', value: 24 },
      ],
      testDefinition: 'tableColumnCountToBeBetween',
    });
  }
  await apiContext.post(
    `/api/v1/services/ingestionPipelines/deploy/${pipeline.id}`
  );
  // wait for 2s before the pipeline to be run
  await page.waitForTimeout(2000);
  await apiContext.post(
    `/api/v1/services/ingestionPipelines/trigger/${pipeline.id}`
  );

  // Wait for the run to complete
  await page.waitForTimeout(2000);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(
            `/api/v1/services/ingestionPipelines?fields=pipelineStatuses&testSuite=${table1.testSuiteResponseData?.['fullyQualifiedName']}&pipelineType=TestSuite`
          )
          .then((res) => res.json());

        return response.data?.[0]?.pipelineStatuses?.pipelineState;
      },
      {
        // Custom expect message for reporting, optional.
        message: 'Wait for the pipeline to be successful',
        timeout: 60_000,
        intervals: [5_000, 10_000],
      }
    )
    .toBe('success');

  for (const user of users) {
    await user.create(apiContext);
  }

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  for (const entity of [...users, table1]) {
    await entity.delete(apiContext);
  }
  await afterAction();
});

test.slow(true);

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Basic Scenario', async ({ page }) => {
  const testCase = table1.testCasesResponseData[0];
  const testCaseName = testCase?.['name'];
  const assignee = {
    name: user1.data.email.split('@')[0],
    displayName: user1.getUserName(),
  };

  await test.step("Acknowledge table test case's failure", async () => {
    await acknowledgeTask({
      page,
      testCase: testCaseName,
      table: table1,
    });
  });

  await test.step('Assign incident to user', async () => {
    await assignIncident({
      page,
      testCaseName,
      user: assignee,
    });
  });

  await test.step('Re-assign incident to user', async () => {
    const assignee1 = {
      name: user2.data.email.split('@')[0],
      displayName: user2.getUserName(),
    };
    const testCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/name/*?fields=*'
    );
    await page.click(`[data-testid="test-case-${testCaseName}"]`);

    await testCaseResponse;

    const incidentDetails = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/*'
    );
    await page.click('[data-testid="incident"]');
    await incidentDetails;

    await page.getByRole('button', { name: 'down' }).click();
    await page.waitForSelector('role=menuitem[name="Reassign"]', {
      state: 'visible',
    });
    await page.getByRole('menuitem', { name: 'Reassign' }).click();

    const searchUserResponse = page.waitForResponse(
      `/api/v1/search/suggest?q=*${user2.data.firstName}*${user2.data.lastName}*&index=user_search_index*`
    );

    await page.getByTestId('select-assignee').locator('div').click();
    await page.getByLabel('Assignee:').fill(assignee1.displayName);
    await searchUserResponse;

    await page.click(`[data-testid="${assignee1.name.toLocaleLowerCase()}"]`);
    const updateAssignee = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
    );
    await page.getByRole('button', { name: 'Submit' }).click();

    await updateAssignee;
  });

  await test.step(
    "Re-assign incident from test case page's header",
    async () => {
      const assignee2 = {
        name: user3.data.email.split('@')[0],
        displayName: user3.getUserName(),
      };
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/name/*?fields=*'
      );
      await page.reload();

      await testCaseResponse;

      const listUserResponse = page.waitForResponse('/api/v1/users?*');
      await page.click('[data-testid="assignee"] [data-testid="edit-owner"]');
      listUserResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const searchUserResponse = page.waitForResponse(
        '/api/v1/search/query?q=*'
      );
      await page.fill(
        '[data-testid="owner-select-users-search-bar"]',
        assignee2.displayName
      );
      await searchUserResponse;

      const updateIncident = page.waitForResponse(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
      );
      await page.click(`.ant-popover [title="${assignee2.displayName}"]`);
      await updateIncident;

      await page.waitForSelector(
        '[data-testid="assignee"] [data-testid="owner-link"]'
      );

      await expect(
        page.locator('[data-testid="assignee"] [data-testid="owner-link"]')
      ).toContainText(assignee2.displayName);
    }
  );

  await test.step('Resolve incident', async () => {
    await page.click('[data-testid="incident"]');
    await page.getByRole('button', { name: 'Resolve' }).click();
    await page.click('#testCaseFailureReason');
    await page.click('[title="Missing Data"]');
    await page.click(descriptionBox);
    await page.fill(descriptionBox, 'test');

    const updateIncident = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
    );
    await page.click('.ant-modal-footer >> text=Submit');
    await updateIncident;
  });
});
