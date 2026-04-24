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
import {
  expect,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { get } from 'lodash';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { resetTokenFromBotPage } from '../../utils/bot';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  acknowledgeTask,
  addAssigneeFromPopoverWidget,
  assignIncident,
  triggerTestSuitePipelineAndWaitForSuccess,
  visitProfilerTab,
} from '../../utils/incidentManager';
import { makeRetryRequest } from '../../utils/serviceIngestion';
import { sidebarClick } from '../../utils/sidebar';
import { waitForTaskResolveResponse } from '../../utils/task';
import { test } from '../fixtures/pages';

let user1: UserClass;
let user2: UserClass;
let user3: UserClass;
let users: UserClass[] = [];
let table1: TableClass;
let tablePagination: TableClass;
const PAGINATION_INCIDENT_COUNT = 22;

const performIncidentAdminLogin = async (browser: Browser) => {
  try {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/admin.json',
    });
    const page = await context.newPage();
    await redirectToHomePage(page);
    const { apiContext } = await getApiContext(page);
    const afterAction = async () => {
      await apiContext.dispose();
      await page.close();
      await context.close();
    };

    return { page, apiContext, afterAction };
  } catch {
    return performAdminLogin(browser);
  }
};

const openIncidentTaskTab = async (page: Page, waitForTaskPanel = false) => {
  const incidentTab = page.getByRole('tab', { name: /Incident/i });
  const taskListResponse = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/api/v1/tasks') &&
        response.url().includes('aboutEntity='),
      {
        timeout: 10_000,
      }
    )
    .catch(() => null);

  await expect(incidentTab).toBeVisible();
  await incidentTab.click();
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('issue-tab-container')).toBeVisible();
  await taskListResponse;

  if (waitForTaskPanel) {
    await expect(page.getByTestId('task-cta-buttons')).toBeVisible({
      timeout: 30_000,
    });
  }
};

const waitForIncidentTask = async (page: Page, testCaseFqn?: string) => {
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get('/api/v1/tasks', {
            params: {
              category: 'Incident',
              limit: 100,
              fields: 'about,payload,assignees',
            },
          });

          if (!response.ok()) {
            return false;
          }

          const body = await response.json();

          return (body.data ?? []).some(
            (task: {
              about?: { fullyQualifiedName?: string };
              payload?: {
                testCaseResult?: { fullyQualifiedName?: string };
                testCaseReference?: { fullyQualifiedName?: string };
              };
            }) =>
              task.about?.fullyQualifiedName === testCaseFqn ||
              task.payload?.testCaseResult?.fullyQualifiedName ===
                testCaseFqn ||
              task.payload?.testCaseReference?.fullyQualifiedName ===
                testCaseFqn
          );
        },
        {
          message: `Wait for incident task for ${testCaseFqn}`,
          timeout: 60_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe(true);
  } finally {
    await afterAction();
  }
};

const isVisible = async (locator: Locator) =>
  locator.isVisible().catch(() => false);

const expectIncidentTableRowsToContain = async (page: Page, text: string) => {
  const rows = page.locator(
    '.ant-table-tbody tr:not(.ant-table-measure-row):not(.ant-table-placeholder)'
  );
  const rowCount = await rows.count();

  expect(rowCount).toBeGreaterThan(0);

  for (let index = 0; index < rowCount; index++) {
    await expect(rows.nth(index)).toContainText(text);
  }
};

const openIncidentReassignModal = async (page: Page, testCaseName?: string) => {
  const visibleReassignButton = page
    .getByRole('button', { name: /^Re-?assign$/ })
    .last();
  const primaryActionButton = page
    .locator(
      '[data-testid="incident-task-action-primary"]:visible, [data-testid="workflow-task-action-primary"]:visible'
    )
    .last();
  const actionTrigger = page
    .locator(
      '[data-testid="incident-task-action-trigger"]:visible, [data-testid="workflow-task-action-trigger"]:visible'
    )
    .last();
  const editAssigneesButton = page
    .locator('[data-testid="edit-assignees"]:visible')
    .last();
  const reassignModal = page
    .locator('.ant-modal-wrap:visible')
    .filter({ hasText: /Re-?assign Task/i });
  const reassignMenuItem = page
    .locator('.task-action-dropdown:visible')
    .getByRole('menuitem', { name: /^Reassign$/ })
    .last();
  const incidentListRowAction = testCaseName
    ? page
        .locator('.ant-table-tbody tr')
        .filter({ hasText: testCaseName })
        .first()
        .locator('button')
        .last()
    : null;
  const getPrimaryActionText = async () =>
    (await primaryActionButton.textContent())?.trim() ?? '';

  if (await isVisible(visibleReassignButton)) {
    await visibleReassignButton.click();
    await expect(reassignModal).toBeVisible({ timeout: 10_000 });

    return reassignModal;
  }

  try {
    await expect
      .poll(getPrimaryActionText, {
        timeout: 15_000,
      })
      .toContain('Reassign');

    await primaryActionButton.click();

    await expect(reassignModal).toBeVisible({ timeout: 10_000 });

    return reassignModal;
  } catch {
    // Fall back to explicit menu selection if the incident status has not
    // switched the primary action to Reassign yet.
  }

  if (await isVisible(editAssigneesButton)) {
    await editAssigneesButton.click();
    await expect(reassignModal).toBeVisible({ timeout: 10_000 });

    return reassignModal;
  }

  if (incidentListRowAction && (await isVisible(incidentListRowAction))) {
    await incidentListRowAction.click();
    await expect(reassignModal).toBeVisible({ timeout: 10_000 });

    return reassignModal;
  }

  await expect(actionTrigger).toBeVisible();
  await actionTrigger.scrollIntoViewIfNeeded();
  await actionTrigger.click();
  await expect(reassignMenuItem).toBeVisible();
  await reassignMenuItem.click();

  try {
    await expect(reassignModal).toBeVisible({ timeout: 3_000 });
  } catch {
    await expect
      .poll(getPrimaryActionText, {
        timeout: 3_000,
      })
      .toContain('Reassign');
    await primaryActionButton.click();
    await expect(reassignModal).toBeVisible({ timeout: 10_000 });
  }

  return reassignModal;
};

const reassignIncidentTask = async (
  page: Page,
  assignee: {
    name: string;
    displayName: string;
  },
  testCaseName?: string
) => {
  const reassignModal = await openIncidentReassignModal(page, testCaseName);
  const assigneeSelect = reassignModal.getByTestId('select-assignee');
  const assigneeSelector = assigneeSelect.locator('.ant-select-selector');
  const assigneeInput = assigneeSelect.locator('input').last();
  const assigneeOption = page.getByTestId(assignee.name.toLowerCase());

  await expect(assigneeSelector).toBeVisible();
  await assigneeSelector.click();
  await assigneeInput.fill(assignee.displayName);
  await expect(assigneeOption).toBeVisible({ timeout: 30_000 });

  await assigneeOption.click();

  const updateAssignee = waitForTaskResolveResponse(page);

  await reassignModal.getByRole('button', { name: 'Save' }).click();

  await updateAssignee;
  await waitForAllLoadersToDisappear(page);

  try {
    await expect(reassignModal).not.toBeVisible({ timeout: 10_000 });

    return;
  } catch {
    // Fall through and close the modal explicitly only if it remains open.
  }

  const cancelButton = reassignModal.getByRole('button', { name: 'Cancel' });

  if (await isVisible(cancelButton)) {
    await cancelButton.click();
  }
  await expect(reassignModal).not.toBeVisible();
};

const openIncidentResolveDialog = async (
  page: Page,
  allowProgressTransition = true
) => {
  const primaryActionButton = page
    .locator(
      '[data-testid="incident-task-action-primary"]:visible, [data-testid="workflow-task-action-primary"]:visible'
    )
    .last();
  const actionTrigger = page
    .locator(
      '[data-testid="incident-task-action-trigger"]:visible, [data-testid="workflow-task-action-trigger"]:visible'
    )
    .last();
  const resolveModal = page.locator('.ant-modal .ant-modal-content').last();
  const modalTextareas = resolveModal.locator('textarea');

  if (await isVisible(resolveModal)) {
    return resolveModal;
  }

  const primaryActionText =
    (await primaryActionButton.textContent())?.trim() ?? '';
  const canAdvanceWorkflowFromPrimaryAction =
    allowProgressTransition &&
    /move to pending|start progress/i.test(primaryActionText);

  if (primaryActionText.includes('Resolve')) {
    await primaryActionButton.click();
  } else if (canAdvanceWorkflowFromPrimaryAction) {
    const advanceIncident = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/v1/tasks/') &&
        response.url().includes('/resolve')
    );

    await primaryActionButton.click();
    const response = await advanceIncident;
    expect(response.ok()).toBeTruthy();

    await waitForAllLoadersToDisappear(page);

    return openIncidentResolveDialog(page, false);
  } else {
    await expect(actionTrigger).toBeVisible();
    await actionTrigger.scrollIntoViewIfNeeded();
    await actionTrigger.click();

    const resolveMenuItem = page
      .locator(
        '[data-testid="task-action-menu-item-resolve"]:visible, [data-testid="workflow-transition-menu-item-resolve"]:visible'
      )
      .last();
    const startProgressMenuItem = page
      .locator(
        '[data-testid="task-action-menu-item-startProgress"]:visible, [data-testid="workflow-transition-menu-item-startProgress"]:visible'
      )
      .last();
    const workflowMenuItem = page
      .locator(
        '[data-testid="task-action-menu-item-resolve"]:visible, [data-testid="workflow-transition-menu-item-resolve"]:visible, [data-testid="task-action-menu-item-startProgress"]:visible, [data-testid="workflow-transition-menu-item-startProgress"]:visible'
      )
      .first();

    await expect(workflowMenuItem).toBeVisible({ timeout: 5_000 });

    if (await resolveMenuItem.isVisible().catch(() => false)) {
      await resolveMenuItem.click();
    } else if (
      allowProgressTransition &&
      (await startProgressMenuItem.isVisible().catch(() => false))
    ) {
      await startProgressMenuItem.click();

      if (await resolveModal.isVisible().catch(() => false)) {
        const advanceIncident = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/tasks/') &&
            response.url().includes('/resolve')
        );

        await resolveModal.getByRole('button', { name: /ok|save/i }).click();
        await advanceIncident;
      } else {
        await expect
          .poll(async () => (await primaryActionButton.textContent())?.trim(), {
            timeout: 10_000,
          })
          .toContain('Resolve');
      }

      await waitForAllLoadersToDisappear(page);

      return openIncidentResolveDialog(page, false);
    } else {
      await expect(resolveMenuItem).toBeVisible();
    }

    if (!(await isVisible(resolveModal))) {
      await expect
        .poll(async () => (await primaryActionButton.textContent())?.trim(), {
          timeout: 5_000,
        })
        .toContain('Resolve');
      await page.keyboard.press('Escape').catch(() => undefined);
      await primaryActionButton.click();
    }
  }

  await expect(resolveModal).toBeVisible({
    timeout: 10_000,
  });
  await expect(modalTextareas.first()).toBeVisible({
    timeout: 10_000,
  });

  return resolveModal;
};

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
    // Setup provisions test cases and waits for a TestSuite pipeline run before the first
    // incident workflow assertion can start, so the default slow timeout is not sufficient.
    test.setTimeout(7 * 60 * 1000);

    const { afterAction, apiContext, page } = await performIncidentAdminLogin(
      browser
    );

    user1 = new UserClass();
    user2 = new UserClass();
    user3 = new UserClass();
    users = [user1, user2, user3];
    table1 = new TableClass();
    tablePagination = new TableClass();

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
    const { apiContext, afterAction } = await performIncidentAdminLogin(
      browser
    );
    for (const entity of [...users, table1].filter(Boolean)) {
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
    ownerPage,
    browser,
  }) => {
    const testCase = table1.testCasesResponseData[0];
    const testCaseName = testCase?.['name'];
    const testCaseFqn = testCase?.['fullyQualifiedName'];
    let actorPage = ownerPage;
    const assignee = {
      name: user1.data.email.split('@')[0],
      displayName: user1.getUserDisplayName(),
    };

    /**
     * Step: Claim ownership of table
     * @description Admin assigns logged-in user as table owner to enable incident actions.
     */
    await test.step('Claim ownership of table', async () => {
      const loggedInUserRequest = actorPage.waitForResponse(
        `/api/v1/users/loggedInUser*`
      );
      await redirectToHomePage(actorPage);
      const loggedInUserResponse = await loggedInUserRequest;
      const loggedInUser = await loggedInUserResponse.json();
      const { apiContext, afterAction } = await getApiContext(adminPage);

      try {
        await table1.setOwner(apiContext, {
          id: loggedInUser.id,
          type: 'user',
        });

        await expect
          .poll(
            async () => {
              const tableResponse = await apiContext.get(
                `/api/v1/tables/name/${encodeURIComponent(
                  table1.entityResponseData.fullyQualifiedName ?? ''
                )}?fields=owners`
              );
              const table = await tableResponse.json();

              return (
                table.owners?.some(
                  (owner: { id: string }) => owner.id === loggedInUser.id
                ) ?? false
              );
            },
            {
              timeout: 30_000,
              intervals: [1_000, 2_000, 5_000],
            }
          )
          .toBe(true);
      } finally {
        await afterAction();
      }

      await table1.visitEntityPage(adminPage);
      await waitForAllLoadersToDisappear(adminPage);
    });

    /**
     * Step: Acknowledge failure
     * @description Acknowledge the failed test case to transition incident state.
     */
    await test.step("Acknowledge table test case's failure", async () => {
      await acknowledgeTask({
        page: actorPage,
        testCase: testCaseName,
        table: table1,
      });
    });

    /**
     * Step: Assign incident
     * @description Assigns incident to a specific user and confirms state update.
     */
    await test.step('Assign incident to user', async () => {
      await waitForIncidentTask(actorPage, testCaseFqn);
      await assignIncident({
        page: actorPage,
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
      const testCasePageUrl = `/test-case/${encodeURIComponent(
        testCase.fullyQualifiedName
      )}/test-case-results`;
      actorPage = await browser.newPage();
      await user1.login(actorPage);
      const testCaseResponse = actorPage.waitForResponse(
        '/api/v1/dataQuality/testCases/name/*?fields=*'
      );
      await actorPage.goto(testCasePageUrl);

      await testCaseResponse;
      await waitForIncidentTask(actorPage, testCaseFqn);
      await expect(actorPage.getByTestId('entity-page-header')).toBeVisible();
      await openIncidentTaskTab(actorPage, true);
      await reassignIncidentTask(actorPage, assignee1);
      await expect(
        actorPage.getByTestId('incident-manager-task-header-container')
      ).toContainText(assignee1.displayName);
    });

    /**
     * Step: Mentions
     * @description Adds a mention in entity feed and verifies the mention reaches the incident manager.
     * Notification drawer and Mentions tab UI are covered in dedicated activity feed tests.
     */
    await test.step('Verify that incident mentions are created for the incident manager', async () => {
      const testcaseName = testCaseName;
      const { apiContext: actorApiContext, afterAction: afterActorApiAction } =
        await getApiContext(actorPage);

      try {
        await actorApiContext.post('/api/v1/feed', {
          data: {
            message: 'Can you resolve this thread for me? <#E::user::admin>',
            about: `<#E::testCase::${get(testCase, 'fullyQualifiedName')}>`,
            type: 'Conversation',
          },
        });
      } finally {
        await afterActorApiAction();
      }

      await waitForAllLoadersToDisappear(adminPage);
      await adminPage.getByRole('button', { name: 'Notifications' }).click();
      await expect(adminPage.locator('.notification-box')).toBeVisible();

      const mentionResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.url().includes('filterType=MENTIONS') &&
          response.request().method() === 'GET'
      );
      await adminPage.getByText('Mentions').click();
      const mention = await mentionResponse;
      expect(mention.status()).toBe(200);

      await waitForAllLoadersToDisappear(adminPage);

      const { apiContext: adminApiContext, afterAction: afterAdminApiAction } =
        await getApiContext(adminPage);

      try {
        const loggedInUserResponse = await adminApiContext.get(
          '/api/v1/users/loggedInUser'
        );
        const loggedInUser = await loggedInUserResponse.json();

        await expect
          .poll(
            async () => {
              const mentionsResponse = await adminApiContext.get(
                '/api/v1/feed',
                {
                  params: {
                    userId: loggedInUser.id,
                    filterType: 'MENTIONS',
                  },
                }
              );
              const mentions = await mentionsResponse.json();

              return JSON.stringify(mentions.data ?? []);
            },
            {
              timeout: 60_000,
              intervals: [5_000],
            }
          )
          .toContain(testcaseName);

        await expect(adminPage.getByLabel('Mentions')).toContainText(
          `mentioned you on the testCase ${testcaseName}`
        );
      } finally {
        await afterAdminApiAction();
      }
    });

    /**
     * Step: Reassign from header
     * @description Uses popover assign widget to change assignee from the test case header.
     */
    await test.step("Re-assign incident from test case page's header", async () => {
      const assignee2 = {
        name: user3.data.email.split('@')[0],
        displayName: user3.getUserDisplayName(),
      };
      const testCasePageUrl = `/test-case/${encodeURIComponent(
        testCase.fullyQualifiedName
      )}/test-case-results`;
      actorPage = ownerPage;
      await redirectToHomePage(actorPage);
      const testCaseResponse = actorPage.waitForResponse(
        '/api/v1/dataQuality/testCases/name/*?fields=*'
      );
      await actorPage.goto(testCasePageUrl);

      await testCaseResponse;
      await expect(actorPage.getByTestId('entity-page-header')).toBeVisible();
      await openIncidentTaskTab(actorPage, true);
      await addAssigneeFromPopoverWidget({
        page: actorPage,
        user: assignee2,
      });
    });

    /**
     * Step: Resolve incident
     * @description Marks incident as resolved with reason and comment.
     */
    await test.step('Resolve incident', async () => {
      const currentUrl = actorPage.url();
      actorPage = await browser.newPage();
      await user3.login(actorPage);
      const testCaseResponse = actorPage.waitForResponse(
        '/api/v1/dataQuality/testCases/name/*?fields=*'
      );
      await actorPage.goto(currentUrl);

      await testCaseResponse;
      await expect(actorPage.getByTestId('entity-page-header')).toBeVisible();
      await openIncidentTaskTab(actorPage, true);
      const resolveModal = await openIncidentResolveDialog(actorPage);
      const resolveTextareas = resolveModal.locator('textarea');
      const resolveReasonSelect = resolveModal
        .locator('.ant-select-selector')
        .first();
      const textareaCount = await resolveTextareas.count();

      if (await resolveReasonSelect.isVisible().catch(() => false)) {
        await resolveReasonSelect.click();
        await actorPage.keyboard.press('ArrowDown');
        await actorPage.keyboard.press('Enter');
        await resolveTextareas.first().fill('test');
      } else if (textareaCount >= 2) {
        await resolveTextareas.nth(0).fill('Missing Data');
        await resolveTextareas.nth(1).fill('test');
      } else {
        await resolveTextareas.first().fill('test');
      }

      const updateIncident = waitForTaskResolveResponse(actorPage);
      await resolveModal.getByRole('button', { name: /Save|Ok/i }).click();
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
      await waitForAllLoadersToDisappear(page);

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
      const updateTestCaseIncidentStatus = waitForTaskResolveResponse(page);
      await page.getByTestId('submit-resolved-popover-button').click();
      await updateTestCaseIncidentStatus;
    });

    /**
     * Step: Verify closed task
     * @description Confirms resolved status appears under Closed tab in incident details.
     */
    await test.step('Task should be closed', async () => {
      await visitProfilerTab(page, table1);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.locator(`[data-testid="status-badge-${testCaseName}"]`)
      ).toContainText('Failed');

      await page.click(
        `[data-testid="${testCaseName}"] >> text=${testCaseName}`
      );
      await expect(page.getByTestId('entity-page-header')).toBeVisible();
      await openIncidentTaskTab(page);
      await page.click('[data-testid="closed-task"]');
      await page.getByTestId('task-feed-card').waitFor();

      const taskTab = page.getByTestId('task-tab');

      await expect(taskTab).toContainText('Resolved');
      await expect(taskTab).toContainText('Failure Comment:');
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

      await openIncidentTaskTab(page);

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

      await openIncidentTaskTab(page);

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
      await waitForAllLoadersToDisappear(page);

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

    await assignIncident({
      page,
      testCaseName: assigneeTestCase.testCaseName,
      user: {
        name: assigneeTestCase.username,
        displayName: assigneeTestCase.userDisplayName,
      },
      direct: true,
    });

    await page.click('[data-testid="select-assignee"]');
    const assigneeOption = page.locator(
      `[data-testid="${assigneeTestCase.username}"]`
    );
    await page
      .getByTestId('select-assignee')
      .locator('input')
      .fill(assigneeTestCase.userDisplayName);
    await expect(assigneeOption).toBeVisible();

    const assigneeFilterRes = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*assignee=${assigneeTestCase.username}*`
    );
    await assigneeOption.click();
    await assigneeFilterRes;

    await expectIncidentTableRowsToContain(
      page,
      assigneeTestCase.userDisplayName
    );

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

    await expectIncidentTableRowsToContain(page, 'Assigned');

    const nonStatusFilterRes = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*'
    );
    await page.getByTestId('status-select').getByLabel('close-circle').click();
    await nonStatusFilterRes;

    await page.click('[data-testid="test-case-select"]');
    const testCaseOption = page.locator(`[title="${testCase1}"]`);
    await page.getByTestId('test-case-select').locator('input').fill(testCase1);
    await expect(testCaseOption).toBeVisible();

    const testCaseFilterRes = page.waitForResponse(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?*testCaseFQN=*`
    );
    await testCaseOption.click();
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

  /**
   * Incident Manager pagination
   * @description Uses a dedicated table with 20+ test cases to ensure multiple pages of incidents.
   * Verifies Next/Previous and page indicator when pagination is shown.
   */
  test.describe('Incident Manager pagination', () => {
    test.beforeAll(async ({ browser }) => {
      test.slow();
      const { afterAction, apiContext, page } = await performAdminLogin(
        browser
      );

      if (!process.env.PLAYWRIGHT_IS_OSS) {
        await resetTokenFromBotPage(page, 'testsuite-bot');
      }

      for (let i = 0; i < PAGINATION_INCIDENT_COUNT; i++) {
        await tablePagination.createTestCase(apiContext, {
          parameterValues: [
            { name: 'minColValue', value: 12 },
            { name: 'maxColValue', value: 24 },
          ],
          testDefinition: 'tableColumnCountToBeBetween',
        });
      }

      const pipeline = await tablePagination.createTestSuitePipeline(
        apiContext
      );

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

    test('Next, Previous and page indicator', async ({ page }) => {
      test.slow();
      const listUrl =
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list';

      const initialListRes = page.waitForResponse((res) =>
        res.url().includes(listUrl)
      );
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      await initialListRes;

      await expect(
        page.getByTestId('test-case-incident-manager-table')
      ).toBeVisible();
      await expect(page.getByTestId('pagination')).toBeVisible();
      await expect(page.getByTestId('page-indicator')).toContainText('1');

      const nextListRes = page.waitForResponse(
        (res) => res.url().includes(listUrl) && res.url().includes('offset=15')
      );
      await page.getByTestId('next').click();
      await nextListRes;

      await expect(page.getByTestId('page-indicator')).toContainText('2');

      const prevListRes = page.waitForResponse(
        (res) => res.url().includes(listUrl) && res.url().includes('offset=0')
      );
      await page.getByTestId('previous').click();
      await prevListRes;

      await expect(page.getByTestId('page-indicator')).toContainText('1');
    });

    test('Page size dropdown updates list limit and resets to page 1', async ({
      page,
    }) => {
      test.slow();
      const listUrl =
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list';

      const initialListRes = page.waitForResponse((res) =>
        res.url().includes(listUrl)
      );
      await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
      await initialListRes;

      await expect(page.getByTestId('pagination')).toBeVisible();
      await expect(
        page.getByTestId('page-size-selection-dropdown')
      ).toBeVisible();

      await page.getByTestId('page-size-selection-dropdown').click();
      const listWithLimit50 = page.waitForResponse(
        (res) => res.url().includes(listUrl) && res.url().includes('limit=50')
      );
      await page.getByRole('menuitem', { name: /50.*page/i }).click();
      await listWithLimit50;

      await expect(page.getByTestId('page-indicator')).toContainText('1');
      await expect(
        page.getByTestId('page-size-selection-dropdown')
      ).toContainText('50');
    });
  });
});
