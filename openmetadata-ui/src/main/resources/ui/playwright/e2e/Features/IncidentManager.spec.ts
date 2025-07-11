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
import { get } from 'lodash';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { resetTokenFromBotPage } from '../../utils/bot';
import {
  clickOutside,
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import {
  acknowledgeTask,
  assignIncident,
  triggerTestSuitePipelineAndWaitForSuccess,
  visitProfilerTab,
} from '../../utils/incidentManager';
import { sidebarClick } from '../../utils/sidebar';

const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const users = [user1, user2, user3];
const table1 = new TableClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

test.describe('Incident Manager', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll(async ({ browser }) => {
    // since we need to poll for the pipeline status, we need to increase the timeout
    test.slow();

    const { afterAction, apiContext, page } = await createNewPage(browser);

    if (!process.env.PLAYWRIGHT_IS_OSS) {
      // Todo: Remove this patch once the issue is fixed #19140
      await resetTokenFromBotPage(page, 'testsuite-bot');
    }

    for (const user of users) {
      await user.create(apiContext);
    }
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
    await triggerTestSuitePipelineAndWaitForSuccess({
      page,
      pipeline,
      apiContext,
    });

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
        `/api/v1/search/query?q=*${user2.data.firstName}*${user2.data.lastName}*&index=user_search_index*`
      );

      await page.getByTestId('select-assignee').locator('div').click();
      await page.getByLabel('Assignee:').fill(assignee1.displayName);
      await searchUserResponse;

      await page.click(`[data-testid="${assignee1.name.toLocaleLowerCase()}"]`);
      const updateAssignee = page.waitForResponse(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
      );
      await page.getByRole('button', { name: 'Save' }).click();

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

        await clickOutside(page);

        await page.click('[data-testid="assignee"] [data-testid="edit-owner"]');
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
          page.locator(`[data-testid=${assignee2.displayName}]`)
        ).toBeVisible();
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
      await page.click('.ant-modal-footer >> text=Save');
      await updateIncident;
    });
  });

  test('Resolving incident & re-run pipeline', async ({ page }) => {
    const testCase = table1.testCasesResponseData[1];
    const testCaseName = testCase?.['name'];
    const pipeline = table1.testSuitePipelineResponseData[0];
    const { apiContext } = await getApiContext(page);

    await test.step("Acknowledge table test case's failure", async () => {
      await acknowledgeTask({
        page,
        testCase: testCaseName,
        table: table1,
      });
    });

    await test.step('Resolve task from incident list page', async () => {
      await visitProfilerTab(page, table1);
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page
        .getByTestId('profiler-tab-left-panel')
        .getByText('Data Quality')
        .click();
      await testCaseResponse;

      await expect(
        page.locator(`[data-testid="${testCaseName}"] .last-run-box.failed`)
      ).toBeVisible();
      await expect(page.getByTestId(`${testCaseName}-status`)).toContainText(
        'Ack'
      );

      const incidentDetailsRes = page.waitForResponse(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*'
      );
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      await incidentDetailsRes;

      await expect(
        page.locator(`[data-testid="test-case-${testCaseName}"]`)
      ).toBeVisible();

      await page.click(
        `[data-testid="${testCaseName}-status"] [data-testid="edit-resolution-icon"]`
      );
      await page.click(`[data-testid="test-case-resolution-status-type"]`);
      await page.click(`[title="Resolved"]`);
      await page.click(
        '#testCaseResolutionStatusDetails_testCaseFailureReason'
      );
      await page.click('[title="Missing Data"]');
      await page.click(descriptionBox);
      await page.fill(descriptionBox, 'test');
      const updateTestCaseIncidentStatus = page.waitForResponse(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
      );
      await page.click('.ant-modal-footer >> text=Save');
      await updateTestCaseIncidentStatus;
    });

    await test.step('Task should be closed', async () => {
      await visitProfilerTab(page, table1);
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page
        .getByTestId('profiler-tab-left-panel')
        .getByText('Data Quality')
        .click();
      await testCaseResponse;

      await expect(
        page.locator(`[data-testid="${testCaseName}"] .last-run-box.failed`)
      ).toBeVisible();

      await page.click(
        `[data-testid="${testCaseName}"] >> text=${testCaseName}`
      );
      await page.click('[data-testid="incident"]');
      await page.click('[data-testid="closed-task"]');
      await page.waitForSelector('[data-testid="task-feed-card"]');

      await expect(page.locator('[data-testid="task-tab"]')).toContainText(
        'Resolved the Task.'
      );
    });

    await test.step('Re-run pipeline', async () => {
      await triggerTestSuitePipelineAndWaitForSuccess({
        page,
        pipeline,
        apiContext,
      });
    });

    await test.step('Verify open and closed task', async () => {
      await acknowledgeTask({
        page,
        testCase: testCaseName,
        table: table1,
      });
      await page.reload();

      await page.click('[data-testid="incident"]');

      await expect(page.locator(`[data-testid="open-task"]`)).toHaveText(
        '1 Open'
      );
      await expect(page.locator(`[data-testid="closed-task"]`)).toHaveText(
        '1 Closed'
      );
    });
  });

  test('Rerunning pipeline for an open incident', async ({ page }) => {
    const testCase = table1.testCasesResponseData[2];
    const testCaseName = testCase?.['name'];
    const pipeline = table1.testSuitePipelineResponseData[0];
    const assignee = {
      name: user1.data.email.split('@')[0],
      displayName: user1.getUserName(),
    };
    const { apiContext } = await getApiContext(page);

    await test.step('Ack incident and verify open task', async () => {
      await acknowledgeTask({
        page,
        testCase: testCaseName,
        table: table1,
      });

      await page.reload();

      await page.click('[data-testid="incident"]');

      await expect(page.locator(`[data-testid="open-task"]`)).toHaveText(
        '1 Open'
      );
    });

    await test.step('Assign incident to user', async () => {
      await assignIncident({
        page,
        testCaseName,
        user: assignee,
      });
    });

    await test.step('Re-run pipeline', async () => {
      await triggerTestSuitePipelineAndWaitForSuccess({
        page,
        pipeline,
        apiContext,
      });
    });

    await test.step("Verify incident's status on DQ page", async () => {
      await visitProfilerTab(page, table1);
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page
        .getByTestId('profiler-tab-left-panel')
        .getByText('Data Quality')
        .click();
      await testCaseResponse;

      await expect(
        page.locator(`[data-testid="${testCaseName}"] .last-run-box.failed`)
      ).toBeVisible();
      await expect(page.getByTestId(`${testCaseName}-status`)).toContainText(
        'Assigned'
      );
    });
  });

  test('Validate Incident Tab in Entity details page', async ({ page }) => {
    const testCases = table1.testCasesResponseData;
    await visitProfilerTab(page, table1);

    const incidentListResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus?*originEntityFQN=${table1.entityResponseData?.['fullyQualifiedName']}*`
    );

    await page
      .getByTestId('profiler-tab-left-panel')
      .getByText('Incidents')
      .click();
    await incidentListResponse;

    for (const testCase of testCases) {
      await expect(
        page.locator(`[data-testid="test-case-${testCase?.['name']}"]`)
      ).toBeVisible();
    }
    const lineageResponse = page.waitForResponse(
      `/api/v1/lineage/getLineage?*fqn=${table1.entityResponseData?.['fullyQualifiedName']}*`
    );

    await page.click('[data-testid="lineage"]');
    await lineageResponse;

    const incidentCountResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus?*originEntityFQN=${table1.entityResponseData?.['fullyQualifiedName']}*limit=0*`
    );
    const nodeFqn = get(table1, 'entityResponseData.fullyQualifiedName');
    await page.locator(`[data-testid="lineage-node-${nodeFqn}"]`).click();
    await incidentCountResponse;

    await page.waitForSelector("[role='dialog']", { state: 'visible' });

    await expect(page.getByTestId('Incidents-label')).toBeVisible();
    await expect(page.getByTestId('Incidents-value')).toContainText('3');

    const incidentResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus?*originEntityFQN=${table1.entityResponseData?.['fullyQualifiedName']}*`
    );
    await page.getByTestId('Incidents-value').click();
    await incidentResponse;

    for (const testCase of testCases) {
      await expect(
        page.locator(`[data-testid="test-case-${testCase?.['name']}"]`)
      ).toBeVisible();
    }
  });

  test("Verify filters in Incident Manager's page", async ({ page }) => {
    const assigneeTestCase = {
      username: user1.data.email.split('@')[0].toLocaleLowerCase(),
      userDisplayName: user1.getUserName(),
      testCaseName: table1.testCasesResponseData[2]?.['name'],
    };
    const testCase1 = table1.testCasesResponseData[0]?.['name'];
    const incidentDetailsRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*'
    );
    await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
    await incidentDetailsRes;

    await page.click('[data-testid="select-assignee"]');
    const searchUserResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${assigneeTestCase.userDisplayName}*index=user_search_index*`
    );
    await page
      .getByTestId('select-assignee')
      .locator('input')
      .fill(assigneeTestCase.userDisplayName);
    await searchUserResponse;

    const assigneeFilterRes = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus?*assignee=${assigneeTestCase.username}*`
    );
    await page.click(`[data-testid="${assigneeTestCase.username}"]`);
    await assigneeFilterRes;

    await expect(
      page.locator(`[data-testid="test-case-${assigneeTestCase.testCaseName}"]`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="test-case-${testCase1}"]`)
    ).not.toBeVisible();

    const nonAssigneeFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*'
    );
    await page
      .getByTestId('select-assignee')
      .getByLabel('close-circle')
      .click();
    await nonAssigneeFilterRes;

    await page.click(`[data-testid="status-select"]`);
    const statusFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*testCaseResolutionStatusType=Assigned*'
    );
    await page.click(`[title="Assigned"]`);
    await statusFilterRes;

    await expect(
      page.locator(`[data-testid="test-case-${assigneeTestCase.testCaseName}"]`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="test-case-${testCase1}"]`)
    ).not.toBeVisible();

    const nonStatusFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*'
    );
    await page.getByTestId('status-select').getByLabel('close-circle').click();
    await nonStatusFilterRes;

    await page.click('[data-testid="test-case-select"]');
    const testCaseResponse = page.waitForResponse(
      `/api/v1/search/query?q=${testCase1}*index=test_case_search_index*`
    );
    await page.getByTestId('test-case-select').locator('input').fill(testCase1);
    await testCaseResponse;

    const testCaseFilterRes = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus?*testCaseFQN=*${testCase1}*`
    );
    await page.click(`[title="${testCase1}"]`);
    await testCaseFilterRes;

    await expect(
      page.locator(`[data-testid="test-case-${assigneeTestCase.testCaseName}"]`)
    ).not.toBeVisible();
    await expect(
      page.locator(`[data-testid="test-case-${testCase1}"]`)
    ).toBeVisible();

    const nonTestCaseFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*'
    );
    await page
      .getByTestId('test-case-select')
      .getByLabel('close-circle')
      .click();
    await nonTestCaseFilterRes;

    await page.click('[data-testid="date-picker-menu"]');
    const timeSeriesFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus?*'
    );
    await page.getByRole('menuitem', { name: 'Yesterday' }).click();
    await timeSeriesFilterRes;

    for (const testCase of table1.testCasesResponseData) {
      await expect(
        page.locator(`[data-testid="test-case-${testCase?.['name']}"]`)
      ).toBeVisible();
    }
  });
});
