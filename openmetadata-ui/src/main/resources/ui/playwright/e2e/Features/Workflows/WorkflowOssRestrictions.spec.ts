/*
 *  Copyright 2026 Collate.
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

import { expect, test as base, type Page } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { performAdminLogin } from '../../../utils/admin';
import { clickOutside, redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser);
    await use(page);
    await afterAction();
  },
});

let workflowName: string;
let periodicWorkflowName: string;

async function navigateToWorkflowsListPage(page: Page) {
  await page.hover('[data-testid="left-sidebar"]');
  await page.click(`[data-testid="${SidebarItem.GOVERNANCE}"]`);

  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/governance/workflowDefinitions') &&
      response.request().method() === 'GET'
  );

  await page.click('[data-testid="app-bar-item-workflows"]');
  await listResponse;
  await waitForAllLoadersToDisappear(page);
}

async function navigateToWorkflowDetailPage(page: Page, name: string) {
  await navigateToWorkflowsListPage(page);
  await clickOutside(page);

  const detailResponse = page.waitForResponse(
    '/api/v1/governance/workflowDefinitions/name/*'
  );

  await page.click(`[data-testid="${name}"]`);
  await detailResponse;
  await waitForAllLoadersToDisappear(page);
}

async function enterEditMode(page: Page) {
  await page.getByTestId('edit-workflow-button').click();
  await waitForAllLoadersToDisappear(page);
}

async function openTaskNodeSidebar(page: Page) {
  const fitViewButton = page.getByTestId('fit-view-button');

  await expect(fitViewButton).toBeVisible();
  await fitViewButton.click();
  await enterEditMode(page);

  const taskNode = page
    .locator('.react-flow__node')
    .filter({ hasNotText: /^Start$/ })
    .filter({ hasNotText: /^End$/ })
    .filter({ hasNotText: /^Approved$/ })
    .filter({ hasNotText: /^Rejected$/ })
    .first();

  await expect(taskNode).toBeVisible();
  await taskNode.click();

  const sidebar = page.getByTestId('node-config-sidebar');

  await expect(sidebar).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  return sidebar;
}

async function openStartNodeSidebar(page: Page) {
  const fitViewButton = page.getByTestId('fit-view-button');

  await expect(fitViewButton).toBeVisible();
  await fitViewButton.click();
  await enterEditMode(page);

  const startNode = page
    .locator('.react-flow__node')
    .filter({ hasText: /^Start$/ })
    .first();

  await expect(startNode).toBeVisible();
  await startNode.click();

  const sidebar = page.getByTestId('node-config-sidebar');

  await expect(sidebar).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  return sidebar;
}

if (process.env.PLAYWRIGHT_IS_OSS) {
  test.describe('OSS Workflow Capabilities', () => {
    test.beforeAll('Create test workflow via API', async ({ browser }) => {
      workflowName = `pw-oss-test-workflow-${uuid()}`;
      const { apiContext, afterAction } = await performAdminLogin(browser);

      const response = await apiContext.post(
        '/api/v1/governance/workflowDefinitions',
        {
          data: {
            name: workflowName,
            description: 'OSS capability test workflow created by Playwright',
            config: { storeStageStatus: false },
            trigger: {
              type: 'eventBasedEntity',
              config: {
                entityTypes: ['table'],
                events: ['Created'],
                exclude: [],
                include: [],
                filter: {},
              },
              output: ['relatedEntity', 'updatedBy'],
            },
            nodes: [
              {
                type: 'startEvent',
                subType: 'startEvent',
                name: 'Start',
                displayName: 'Start',
              },
              {
                type: 'userTask',
                subType: 'userApprovalTask',
                name: 'ApprovalTask',
                displayName: 'Approval Task',
                config: {
                  assignees: {
                    addReviewers: false,
                    addOwners: false,
                    candidates: [],
                  },
                  approvalThreshold: 1,
                  rejectionThreshold: 1,
                },
                inputNamespaceMap: {
                  relatedEntity: 'global',
                },
              },
              {
                type: 'endEvent',
                subType: 'endEvent',
                name: 'ApprovedEnd',
                displayName: 'Approved',
              },
              {
                type: 'endEvent',
                subType: 'endEvent',
                name: 'RejectedEnd',
                displayName: 'Rejected',
              },
            ],
            edges: [
              { from: 'Start', to: 'ApprovalTask' },
              { from: 'ApprovalTask', to: 'ApprovedEnd', condition: 'true' },
              { from: 'ApprovalTask', to: 'RejectedEnd', condition: 'false' },
            ],
          },
        }
      );

      expect(response.ok()).toBeTruthy();
      await afterAction();
    });

    test.afterAll('Delete test workflow via API', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await apiContext.delete(
        `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
          workflowName
        )}`,
        { params: { hardDelete: true } }
      );

      await afterAction();
    });

    test.describe('Workflow listing page', () => {
      test('create-workflow-button absent on OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowsListPage(page);

        await expect(
          page.getByTestId('create-workflow-button')
        ).not.toBeVisible();
      });
    });

    test.describe('Test workflow — view mode', () => {
      test('edit-workflow-button visible; delete-workflow-button and run-workflow-button absent', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        await expect(page.getByTestId('edit-workflow-button')).toBeVisible();
        await expect(
          page.getByTestId('delete-workflow-button')
        ).not.toBeVisible();
        await expect(page.getByTestId('run-workflow-button')).not.toBeVisible();
      });

      test('clicking a node in view mode opens read-only config sidebar (no save or delete buttons)', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const fitViewButton = page.getByTestId('fit-view-button');

        await expect(fitViewButton).toBeVisible();
        await fitViewButton.click();

        const taskNode = page
          .locator('.react-flow__node')
          .filter({ hasNotText: /^Start$/ })
          .filter({ hasNotText: /^End$/ })
          .filter({ hasNotText: /^Approved$/ })
          .filter({ hasNotText: /^Rejected$/ })
          .first();

        await expect(taskNode).toBeVisible();
        await taskNode.click();

        const sidebar = page.getByTestId('node-config-sidebar');

        await expect(sidebar).toBeVisible();
        await waitForAllLoadersToDisappear(page);

        await expect(
          sidebar.getByTestId('save-node-configuration-button')
        ).not.toBeVisible();
        await expect(
          sidebar.getByTestId('delete-node-button')
        ).not.toBeVisible();
      });
    });

    test.describe('Test workflow — edit mode: structural restrictions', () => {
      test('workflow-node-sidebar (node palette) not rendered in edit mode', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);
        await enterEditMode(page);

        await expect(
          page.getByTestId('workflow-node-sidebar')
        ).not.toBeVisible();
      });

      test('graph canvas contains workflow nodes', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const fitViewButton = page.getByTestId('fit-view-button');

        await expect(fitViewButton).toBeVisible();
        await fitViewButton.click();
        await enterEditMode(page);

        await expect(page.locator('.react-flow__node').first()).toBeVisible();
      });
    });

    test.describe('Test workflow — edit mode: header controls', () => {
      test('save, cancel, and validate buttons visible; delete absent in edit mode', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);
        await enterEditMode(page);

        await expect(page.getByTestId('save-workflow-button')).toBeVisible();
        await expect(page.getByTestId('cancel-workflow-button')).toBeVisible();
        await expect(page.getByTestId('test-workflow-button')).toBeVisible();
        await expect(
          page.getByTestId('delete-workflow-button')
        ).not.toBeVisible();
      });

      test('cancel workflow opens confirmation modal; close-without-saving returns to view mode', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);
        await enterEditMode(page);

        await page.getByTestId('cancel-workflow-button').click();

        await expect(
          page.getByTestId('close-without-saving-button')
        ).toBeVisible();
        await expect(
          page.getByTestId('save-workflow-cancel-modal-button')
        ).toBeVisible();

        await page.getByTestId('close-without-saving-button').click();

        await expect(page.getByTestId('edit-workflow-button')).toBeVisible();
        await expect(
          page.getByTestId('save-workflow-button')
        ).not.toBeVisible();
      });
    });

    test.describe('Test workflow — edit mode: task node config', () => {
      test('task node config sidebar opens and save button is enabled', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openTaskNodeSidebar(page);

        await expect(
          sidebar.getByTestId('save-node-configuration-button')
        ).toBeEnabled();

        await sidebar.getByTestId('cancel-workflow-button').click();
        await expect(sidebar).not.toBeVisible();
      });

      test('delete-node-button absent in node config sidebar (structural edit blocked)', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openTaskNodeSidebar(page);

        await expect(
          sidebar.getByTestId('delete-node-button')
        ).not.toBeVisible();
      });

      test('save-node-configuration-button closes sidebar (local state update)', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openTaskNodeSidebar(page);

        await sidebar.getByTestId('save-node-configuration-button').click();
        await expect(sidebar).not.toBeVisible();
      });

      test('editing a form field and saving node config then workflow fires PUT API with updated data', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openTaskNodeSidebar(page);

        const thresholdInput = sidebar
          .getByTestId('user-approval-approval-threshold-label')
          .locator('input');

        await expect(thresholdInput).toBeEnabled();
        await thresholdInput.fill('2');

        await sidebar.getByTestId('save-node-configuration-button').click();
        await expect(sidebar).not.toBeVisible();

        const saveResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/governance/workflowDefinitions') &&
            response.request().method() === 'PUT' &&
            response.ok()
        );

        await page.getByTestId('save-workflow-button').click();
        await saveResponse;
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('edit-workflow-button')).toBeVisible();
      });
    });

    test.describe('Test workflow — save workflow', () => {
      test('save-workflow-button fires PUT API and returns to view mode', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);
        await enterEditMode(page);

        const saveResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/governance/workflowDefinitions') &&
            response.request().method() === 'PUT' &&
            response.ok()
        );

        await page.getByTestId('save-workflow-button').click();
        await saveResponse;
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('edit-workflow-button')).toBeVisible();
        await expect(
          page.getByTestId('save-workflow-button')
        ).not.toBeVisible();
      });
    });

    test.describe('Test workflow — start node config (event-based)', () => {
      test('workflow-name-input is disabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('workflow-name-input').locator('input')
        ).toBeDisabled();
      });

      test('workflow-description-input is enabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('workflow-description-input').locator('textarea')
        ).toBeEnabled();
      });

      test('data-asset selector is disabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('data-asset').locator('input')
        ).toBeDisabled();
      });

      test('trigger-type-select is disabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('trigger-type-select').locator('button').first()
        ).toBeDisabled();
      });

      test('event-type-select is disabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('event-type-select').locator('input')
        ).toBeDisabled();
      });

      test('exclude-fields-select is enabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('exclude-fields-select').locator('input')
        ).toBeEnabled();
      });

      test('include-fields-select is enabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('include-fields-select').locator('input')
        ).toBeEnabled();
      });

      test('add-event-filter-button is enabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('add-event-filter-button')
        ).toBeEnabled();
      });
    });

    test.describe('Test workflow — start node config (periodic-batch)', () => {
      test.beforeAll(
        'Create periodic-batch test workflow via API',
        async ({ browser }) => {
          periodicWorkflowName = `pw-oss-periodic-workflow-${uuid()}`;
          const { apiContext, afterAction } = await performAdminLogin(browser);

          const response = await apiContext.post(
            '/api/v1/governance/workflowDefinitions',
            {
              data: {
                name: periodicWorkflowName,
                description:
                  'OSS periodic-batch capability test workflow created by Playwright',
                config: { storeStageStatus: false },
                trigger: {
                  type: 'periodicBatchEntity',
                  config: {
                    entityTypes: ['table'],
                    schedule: {
                      scheduleTimeline: 'None',
                      cronExpression: '',
                    },
                  },
                  output: ['relatedEntity'],
                },
                nodes: [
                  {
                    type: 'startEvent',
                    subType: 'startEvent',
                    name: 'Start',
                    displayName: 'Start',
                  },
                  {
                    type: 'userTask',
                    subType: 'userApprovalTask',
                    name: 'ApprovalTask',
                    displayName: 'Approval Task',
                    config: {
                      assignees: {
                        addReviewers: false,
                        addOwners: false,
                        candidates: [],
                      },
                      approvalThreshold: 1,
                      rejectionThreshold: 1,
                    },
                    inputNamespaceMap: {
                      relatedEntity: 'global',
                    },
                  },
                  {
                    type: 'endEvent',
                    subType: 'endEvent',
                    name: 'ApprovedEnd',
                    displayName: 'Approved',
                  },
                  {
                    type: 'endEvent',
                    subType: 'endEvent',
                    name: 'RejectedEnd',
                    displayName: 'Rejected',
                  },
                ],
                edges: [
                  { from: 'Start', to: 'ApprovalTask' },
                  {
                    from: 'ApprovalTask',
                    to: 'ApprovedEnd',
                    condition: 'true',
                  },
                  {
                    from: 'ApprovalTask',
                    to: 'RejectedEnd',
                    condition: 'false',
                  },
                ],
              },
            }
          );

          expect(response.ok()).toBeTruthy();
          await afterAction();
        }
      );

      test.afterAll(
        'Delete periodic-batch test workflow via API',
        async ({ browser }) => {
          const { apiContext, afterAction } = await performAdminLogin(browser);

          await apiContext.delete(
            `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
              periodicWorkflowName
            )}`,
            { params: { hardDelete: true } }
          );

          await afterAction();
        }
      );

      test('schedule-type-select is disabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, periodicWorkflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('schedule-type-select').locator('button').first()
        ).toBeDisabled();
      });

      test('batch-size-input is enabled in OSS', async ({ page }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, periodicWorkflowName);

        const sidebar = await openStartNodeSidebar(page);

        await expect(
          sidebar.getByTestId('batch-size-input').locator('input')
        ).toBeEnabled();
      });
    });

    test.describe('Test workflow — execution history', () => {
      test('execution history tab loads and API call succeeds', async ({
        page,
      }) => {
        await redirectToHomePage(page);
        await navigateToWorkflowDetailPage(page, workflowName);

        const historyResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/governance/workflowInstances') &&
            response.request().method() === 'GET'
        );

        await page.getByTestId('workflow-execution-history').click();
        await waitForAllLoadersToDisappear(page);
        await historyResponse;

        await expect(
          page.getByTestId('workflow-execution-history-table')
        ).toBeVisible();
      });
    });
  });
}
