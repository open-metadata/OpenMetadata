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
import { get } from 'lodash';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { addMentionCommentInFeed } from '../../utils/activityFeed';
import { performAdminLogin } from '../../utils/admin';
import { resetTokenFromBotPage } from '../../utils/bot';
import {
  clickOutside,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { addOwner, waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  acknowledgeTask,
  addAssigneeFromPopoverWidget,
  assignIncident,
  triggerTestSuitePipelineAndWaitForSuccess,
  visitProfilerTab,
} from '../../utils/incidentManager';
import { makeRetryRequest } from '../../utils/serviceIngestion';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const users = [user1, user2, user3];
const table1 = new TableClass();

test.describe.configure({ mode: 'serial' });

/**
 * Incident Manager — End-to-End Coverage
 * @description Validates the full lifecycle of Data Quality incidents: acknowledge, assign/reassign, mentions/notifications,
 * resolve, and interactions with pipeline reruns. Also verifies filters in the Incident Manager page and incident counts in lineage.
 *
 * Preconditions
 * - Admin-authenticated session and bot setup.
 * - Three users created and three test cases on a table; TestSuite pipeline deployed and executed to create failures.
 *
 * Coverage
 * - Lifecycle: Claim table ownership, acknowledge failure, assign & reassign incident, add mention, resolve.
 * - Reruns: Trigger pipeline rerun and verify incident states across Data Quality and Incident tabs.
 * - Filters: Assignee, status, test case, time-range filters.
 * - Lineage: Incident counts displayed on lineage node flyout.
 *
 * API Interactions
 * - POST `/api/v1/services/ingestionPipelines/deploy/:id` deploys TestSuite pipeline.
 * - Various `GET/POST` under `/api/v1/dataQuality/testCases/*` for incident state and assignment.
 * - Search endpoints for user and test case selectors.
 */
test.describe('Incident Manager', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll(async ({ browser }) => {
    // since we need to poll for the pipeline status, we need to increase the timeout
    test.slow();

    const { afterAction, apiContext, page } = await performAdminLogin(browser);

    if (!process.env.PLAYWRIGHT_IS_OSS) {
      // Todo: Remove this patch once the issue is fixed #19140
      await resetTokenFromBotPage(page, 'testsuite-bot');
    }

    for (const user of users) {
      await user.create(apiContext);
    }

    for (let i = 0; i < 3; i++) {
      await table1.createTestCase(apiContext, {
        parameterValues: [
          { name: 'minColValue', value: 12 },
          { name: 'maxColValue', value: 24 },
        ],
        testDefinition: 'tableColumnCountToBeBetween',
      });
    }

    const pipeline = await table1.createTestSuitePipeline(apiContext);

    await makeRetryRequest({
      page,
      fn: () =>
        apiContext.post(
          `/api/v1/services/ingestionPipelines/deploy/${pipeline.id}`
        ),
    });

    await triggerTestSuitePipelineAndWaitForSuccess({
      page,
      pipeline,
      apiContext,
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    for (const entity of [...users, table1]) {
      await entity.delete(apiContext);
    }
    await afterAction();
  });

  test.slow(true);

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  /**
   * Complete incident lifecycle with table owner
   * @description Claims table ownership, acknowledges a failed test case, assigns and reassigns the incident,
   * validates notifications for mentions, and resolves the incident.
   */
  test('Complete Incident lifecycle with table owner', async ({
    page: adminPage,
    ownerPage: page,
  }) => {
    const testCase = table1.testCasesResponseData[0];
    const testCaseName = testCase?.['name'];
    const assignee = {
      name: user1.data.email.split('@')[0],
      displayName: user1.getUserDisplayName(),
    };

    /**
     * Step: Claim ownership of table
     * @description Admin assigns logged-in user as table owner to enable incident actions.
     */
    await test.step('Claim ownership of table', async () => {
      const loggedInUserRequest = page.waitForResponse(
        `/api/v1/users/loggedInUser*`
      );
      await redirectToHomePage(page);
      const loggedInUserResponse = await loggedInUserRequest;
      const loggedInUser = await loggedInUserResponse.json();

      await redirectToHomePage(adminPage);

      await table1.visitEntityPage(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await addOwner({
        page: adminPage,
        owner: loggedInUser.displayName,
        type: 'Users',
        endpoint: EntityTypeEndpoint.Table,
        dataTestId: 'data-assets-header',
      });
    });

    /**
     * Step: Acknowledge failure
     * @description Acknowledge the failed test case to transition incident state.
     */
    await test.step("Acknowledge table test case's failure", async () => {
      await acknowledgeTask({
        page,
        testCase: testCaseName,
        table: table1,
      });
    });

    /**
     * Step: Assign incident
     * @description Assigns incident to a specific user and confirms state update.
     */
    await test.step('Assign incident to user', async () => {
      await assignIncident({
        page,
        testCaseName,
        user: assignee,
        direct: true,
      });
    });

    /**
     * Step: Reassign incident
     * @description Reassigns the incident to another user via header actions.
     */
    await test.step('Re-assign incident to user', async () => {
      const assignee1 = {
        name: user2.data.email.split('@')[0],
        displayName: user2.getUserDisplayName(),
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
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.waitForSelector('.ant-skeleton-content', {
        state: 'detached',
      });

      await page.locator('role=button[name="down"]').scrollIntoViewIfNeeded();
      await page.waitForSelector('role=button[name="down"]', {
        state: 'visible',
      });

      await page.getByRole('button', { name: 'down' }).click();
      // there is no API call to wait for here, so adding a small timeout
      await page.waitForTimeout(1000);
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

    /**
     * Step: Notifications and mentions
     * @description Adds a mention in entity feed and verifies corresponding notification entry.
     */
    await test.step(
      'Verify that notifications correctly display mentions for the incident manager',
      async () => {
        const testcaseName = await page
          .getByTestId('entity-header-name')
          .innerText();
        await addMentionCommentInFeed(page, 'admin', true);

        await adminPage.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(adminPage);
        await adminPage.getByRole('button', { name: 'Notifications' }).click();
        await adminPage.getByText('Mentions').click();
        await adminPage.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(adminPage);

        await expect(adminPage.getByLabel('Mentions')).toContainText(
          `mentioned you on the testCase ${testcaseName}`
        );
      }
    );

    /**
     * Step: Reassign from header
     * @description Uses popover assign widget to change assignee from the test case header.
     */
    await test.step(
      "Re-assign incident from test case page's header",
      async () => {
        const assignee2 = {
          name: user3.data.email.split('@')[0],
          displayName: user3.getUserDisplayName(),
        };
        const testCaseResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/name/*?fields=*'
        );
        await page.reload();

        await testCaseResponse;

        await clickOutside(page);

        await addAssigneeFromPopoverWidget({ page, user: assignee2 });
      }
    );

    /**
     * Step: Resolve incident
     * @description Marks incident as resolved with reason and comment.
     */
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

  /**
   * Resolve incident and rerun pipeline
   * @description Resolves a failed incident from the list page, confirms closed status, and reruns the TestSuite pipeline
   * to re-evaluate incident state.
   */
  test('Resolving incident & re-run pipeline', async ({ page }) => {
    const testCase = table1.testCasesResponseData[1];
    const testCaseName = testCase?.['name'];
    const pipeline = table1.testSuitePipelineResponseData[0];
    const { apiContext } = await getApiContext(page);

    /**
     * Step: Acknowledge failure
     * @description Acknowledges the failed test case to update incident status.
     */
    await test.step("Acknowledge table test case's failure", async () => {
      await acknowledgeTask({
        page,
        testCase: testCaseName,
        table: table1,
      });
    });

    /**
     * Step: Resolve from list page
     * @description Resolves incident via Incident Manager page with reason and comment.
     */
    await test.step('Resolve task from incident list page', async () => {
      await visitProfilerTab(page, table1);
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.getByRole('tab', { name: 'Data Quality' }).click();
      await testCaseResponse;

      await expect(
        page.locator(`[data-testid="status-badge-${testCaseName}"]`)
      ).toContainText('Failed');
      await expect(page.getByTestId(`${testCaseName}-status`)).toContainText(
        'Ack'
      );

      const incidentDetailsRes = page.waitForResponse(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
      );
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      await incidentDetailsRes;

      await expect(
        page.locator(`[data-testid="test-case-${testCaseName}"]`)
      ).toBeVisible();

      await page.click(`[data-testid="${testCaseName}-status"]`);
      await page.getByRole('menuitem', { name: 'Resolved' }).click();
      await page.click('[data-testid="reason-chip-MissingData"]');
      await page.getByTestId('resolved-comment-textarea').click();
      await page
        .locator('[data-testid="resolved-comment-textarea"] textarea')
        .first()
        .fill('test');
      const updateTestCaseIncidentStatus = page.waitForResponse(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
      );
      await page.getByTestId('submit-resolved-popover-button').click();
      await updateTestCaseIncidentStatus;
    });

    /**
     * Step: Verify closed task
     * @description Confirms resolved status appears under Closed tab in incident details.
     */
    await test.step('Task should be closed', async () => {
      await visitProfilerTab(page, table1);
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.getByRole('tab', { name: 'Data Quality' }).click();
      await testCaseResponse;

      await expect(
        page.locator(`[data-testid="status-badge-${testCaseName}"]`)
      ).toContainText('Failed');

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

    /**
     * Step: Re-run pipeline
     * @description Triggers TestSuite pipeline rerun and waits for successful completion.
     */
    await test.step('Re-run pipeline', async () => {
      await triggerTestSuitePipelineAndWaitForSuccess({
        page,
        pipeline,
        apiContext,
      });
    });

    /**
     * Step: Verify open vs closed
     * @description Verifies incident counts for Open and Closed after rerun and re-acknowledgement.
     */
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

  /**
   * Rerun pipeline for open incident
   * @description Acknowledges and assigns an open incident, reruns pipeline, and validates status reflects Assigned.
   */
  test('Rerunning pipeline for an open incident', async ({ page }) => {
    const testCase = table1.testCasesResponseData[2];
    const testCaseName = testCase?.['name'];
    const pipeline = table1.testSuitePipelineResponseData[0];
    const assignee = {
      name: user1.data.email.split('@')[0],
      displayName: user1.getUserDisplayName(),
    };
    const { apiContext } = await getApiContext(page);

    /**
     * Step: Ack and verify open
     * @description Acknowledges incident and verifies Open task count.
     */
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

    /**
     * Step: Assign incident
     * @description Assigns the incident and confirms state.
     */
    await test.step('Assign incident to user', async () => {
      await assignIncident({
        page,
        testCaseName,
        user: assignee,
      });
    });

    /**
     * Step: Re-run pipeline
     * @description Triggers pipeline rerun for the open incident.
     */
    await test.step('Re-run pipeline', async () => {
      await triggerTestSuitePipelineAndWaitForSuccess({
        page,
        pipeline,
        apiContext,
      });
    });

    /**
     * Step: Verify status on DQ page
     * @description Confirms incident shows Failed + Assigned status in the Data Quality tab post-rerun.
     */
    await test.step("Verify incident's status on DQ page", async () => {
      await visitProfilerTab(page, table1);
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.getByRole('tab', { name: 'Data Quality' }).click();
      await testCaseResponse;

      await expect(
        page.locator(`[data-testid="status-badge-${testCaseName}"]`)
      ).toContainText('Failed');
      await expect(page.getByTestId(`${testCaseName}-status`)).toContainText(
        'Assigned'
      );
    });
  });

  /**
   * Validate Incident tab in entity page
   * @description Verifies incidents list within entity details, lineage incident counts, and navigation back to tab.
   */
  test('Validate Incident Tab in Entity details page', async ({ page }) => {
    const testCases = table1.testCasesResponseData;
    await visitProfilerTab(page, table1);

    const incidentListResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*originEntityFQN=${table1.entityResponseData?.['fullyQualifiedName']}*`
    );

    await page.getByRole('tab', { name: 'Incidents' }).click();
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

    await expect(page.getByTestId('Incidents-label')).toBeVisible();
    await expect(page.getByTestId('Incidents-value')).toContainText('3');

    const incidentTabResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*originEntityFQN=${table1.entityResponseData?.['fullyQualifiedName']}*`
    );

    await page.getByTestId('Incidents-value').locator('a').click();

    await incidentTabResponse;

    for (const testCase of testCases) {
      await expect(
        page.locator(`[data-testid="test-case-${testCase?.['name']}"]`)
      ).toBeVisible();
    }
  });

  /**
   * Verify filters in Incident Manager page
   * @description Tests Assignee, Status, Test Case, and Date filters and confirms list updates accordingly.
   */
  test("Verify filters in Incident Manager's page", async ({ page }) => {
    const assigneeTestCase = {
      username: user1.data.email.split('@')[0].toLocaleLowerCase(),
      userDisplayName: user1.getUserDisplayName(),
      testCaseName: table1.testCasesResponseData[2]?.['name'],
    };
    const testCase1 = table1.testCasesResponseData[0]?.['name'];
    const incidentDetailsRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
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
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*assignee=${assigneeTestCase.username}*`
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
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
    );
    await page
      .getByTestId('select-assignee')
      .getByLabel('close-circle')
      .click();
    await nonAssigneeFilterRes;

    await page.click(`[data-testid="status-select"]`);
    const statusFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*testCaseResolutionStatusType=Assigned*'
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
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
    );
    await page.getByTestId('status-select').getByLabel('close-circle').click();
    await nonStatusFilterRes;

    await page.click('[data-testid="test-case-select"]');
    const testCaseResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/v1/search/query`) && response.url().includes("index=test_case_search_index") && response.url().includes(encodeURIComponent(testCase1))
    );
    await page.getByTestId('test-case-select').locator('input').fill(testCase1);
    await testCaseResponse;

    const testCaseFilterRes = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*testCaseFQN=*`
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
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
    );
    await page
      .getByTestId('test-case-select')
      .getByLabel('close-circle')
      .click();
    await nonTestCaseFilterRes;

    await page.click('[data-testid="mui-date-picker-menu"]');
    const timeSeriesFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
    );
    await page.getByTestId('date-range-option-yesterday').click();
    await timeSeriesFilterRes;

    for (const testCase of table1.testCasesResponseData) {
      await expect(
        page.locator(`[data-testid="test-case-${testCase?.['name']}"]`)
      ).toBeVisible();
    }
  });
});
