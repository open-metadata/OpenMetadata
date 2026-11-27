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

import { type Page } from '@playwright/test';
import { expect, test as base } from '../../../support/fixtures/base';
import { performAdminLogin } from '../../../utils/admin';
import { chooseSelectOption, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
});

let workflowName: string;

// The edit test switches the approval step to Assign admins. A filter that evaluates to true
// excludes the entity, so this one excludes every table: tables other workers create while this
// workflow is deployed never open an admin task.
const EXCLUDE_EVERY_TABLE_FILTER = JSON.stringify({
  '!=': [{ var: 'name' }, `pw-oss-no-such-table-${uuid()}`],
});

// Opened by URL, not from the list: the list shows 12 cards per page and the
// seeded workflows already fill page 1, so the test workflow lands on page 2.
async function navigateToWorkflowDetailPage(page: Page, name: string) {
  const detailResponse = page.waitForResponse(
    '/api/v1/governance/workflowDefinitions/name/*'
  );

  await page.goto(`/workflows/${encodeURIComponent(name)}/workflow`);
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
    .filter({ hasText: /^Start$/ });

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
                filter: { table: EXCLUDE_EVERY_TABLE_FILTER },
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
              { from: 'ApprovalTask', to: 'ApprovedEnd', condition: 'approve' },
              { from: 'ApprovalTask', to: 'RejectedEnd', condition: 'reject' },
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

    test.describe('Test workflow — edit mode: task node config', () => {
      test('editing the threshold and the no-approver strategy then saving fires PUT API with both', async ({
        page,
      }) => {
        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openTaskNodeSidebar(page);

        const thresholdInput = sidebar
          .getByTestId('user-approval-approval-threshold-label')
          .locator('input');

        await expect(thresholdInput).toBeEnabled();
        await thresholdInput.fill('2');

        const strategyTrigger = sidebar
          .getByTestId('user-approval-empty-assignee-strategy-select')
          .getByRole('button');

        await expect(strategyTrigger).toBeEnabled();
        await chooseSelectOption(
          strategyTrigger,
          page.getByTestId(
            'user-approval-empty-assignee-strategy-assignAdmins'
          ),
          strategyTrigger.filter({ hasText: 'Assign to admins' })
        );

        await sidebar.getByTestId('save-node-configuration-button').click();
        await expect(sidebar).not.toBeVisible();

        const saveRequest = page.waitForRequest(
          (request) =>
            request.url().includes('/api/v1/governance/workflowDefinitions') &&
            request.method() === 'PUT'
        );
        const saveResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/api/v1/governance/workflowDefinitions') &&
            response.request().method() === 'PUT',
          'ok'
        );

        await page.getByTestId('save-workflow-button').click();

        const savedWorkflow = (await saveRequest).postDataJSON();

        expect(savedWorkflow.trigger.config.filter.table).toBe(
          EXCLUDE_EVERY_TABLE_FILTER
        );

        const savedApprovalNode = (
          savedWorkflow.nodes as Array<{
            name: string;
            config?: {
              approvalThreshold?: number;
              assignees?: { emptyAssigneeStrategy?: string };
            };
          }>
        ).find((node) => node.name === 'ApprovalTask');

        expect(savedApprovalNode?.config?.approvalThreshold).toBe(2);
        expect(
          savedApprovalNode?.config?.assignees?.emptyAssigneeStrategy
        ).toBe('assignAdmins');

        await saveResponse;
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('edit-workflow-button')).toBeVisible();

        await navigateToWorkflowDetailPage(page, workflowName);
        const reopenedSidebar = await openTaskNodeSidebar(page);

        await expect(
          reopenedSidebar
            .getByTestId('user-approval-empty-assignee-strategy-select')
            .getByRole('button')
        ).toContainText('Assign to admins');
      });
    });

    test.describe('Test workflow — edit mode: start node description', () => {
      test('editing the workflow description on the start node persists it on save', async ({
        page,
      }) => {
        const newDescription = `OSS description edited by Playwright ${uuid()}`;

        await navigateToWorkflowDetailPage(page, workflowName);

        const sidebar = await openStartNodeSidebar(page);
        const descriptionInput = sidebar
          .getByTestId('workflow-description-input')
          .locator('textarea');

        await expect(
          sidebar.getByTestId('workflow-name-input').locator('input')
        ).toBeDisabled();
        await expect(descriptionInput).toBeEnabled();
        await descriptionInput.fill(newDescription);

        await sidebar.getByTestId('save-node-configuration-button').click();
        await expect(sidebar).not.toBeVisible();

        const saveRequest = page.waitForRequest(
          (request) =>
            request.url().includes('/api/v1/governance/workflowDefinitions') &&
            request.method() === 'PUT'
        );
        const saveResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/api/v1/governance/workflowDefinitions') &&
            response.request().method() === 'PUT',
          'ok'
        );

        await page.getByTestId('save-workflow-button').click();

        expect((await saveRequest).postDataJSON().description).toBe(
          newDescription
        );

        await saveResponse;
        await waitForAllLoadersToDisappear(page);

        const detailResponse = page.waitForResponse(
          '/api/v1/governance/workflowDefinitions/name/*'
        );
        await page.reload();
        await detailResponse;
        await waitForAllLoadersToDisappear(page);

        const reopenedSidebar = await openStartNodeSidebar(page);

        await expect(
          reopenedSidebar
            .getByTestId('workflow-description-input')
            .locator('textarea')
        ).toHaveValue(newDescription);
      });
    });

    test.describe('Test workflow — save workflow', () => {
      test('save-workflow-button fires PUT API and returns to view mode', async ({
        page,
      }) => {
        await navigateToWorkflowDetailPage(page, workflowName);
        await enterEditMode(page);

        const saveResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/api/v1/governance/workflowDefinitions') &&
            response.request().method() === 'PUT',
          'ok'
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

    test.describe('Test workflow — execution history', () => {
      test('execution history tab loads and API call succeeds', async ({
        page,
      }) => {
        // Pin the instances payload so the history table renders the same rows on every run.
        await page.route(
          '**/api/v1/governance/workflowInstances**',
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ data: [], paging: { total: 0 } }),
            });
          }
        );

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
          page.getByTestId('workflow-execution-history-empty')
        ).toBeVisible();
      });
    });
  });
}
