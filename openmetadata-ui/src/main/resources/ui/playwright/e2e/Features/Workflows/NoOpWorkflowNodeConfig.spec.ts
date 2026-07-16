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

import { expect, test as base, type Page } from '@playwright/test';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

const WORKFLOW_CREATION_DATA = (name: string) => ({
  name,
  description: 'No-op workflow for Playwright schema-form testing',
  config: { storeStageStatus: false },
  trigger: { type: 'noOp', output: [] },
  nodes: [
    {
      type: 'startEvent',
      subType: 'startEvent',
      name: 'Start',
      displayName: 'Start',
    },
    {
      type: 'automatedTask',
      subType: 'runAppTask',
      name: 'RunApp',
      displayName: 'Run App',
      config: {
        appName: 'DataInsightsApplication',
        waitForCompletion: true,
        timeoutSeconds: 3600,
      },
      input: ['relatedEntity'],
      inputNamespaceMap: { relatedEntity: 'global' },
    },
    {
      type: 'endEvent',
      subType: 'endEvent',
      name: 'End',
      displayName: 'End',
    },
  ],
  edges: [
    { from: 'Start', to: 'RunApp' },
    { from: 'RunApp', to: 'End', condition: 'success' },
    { from: 'RunApp', to: 'End', condition: 'failure' },
  ],
});

const test = base.extend<{ page: Page; workflowName: string }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser);
    await use(page);
    await afterAction();
  },
  workflowName: async ({ browser }, use) => {
    const name = `pw-noop-workflow-${uuid()}`;
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const response = await apiContext.post(
      '/api/v1/governance/workflowDefinitions',
      { data: WORKFLOW_CREATION_DATA(name) }
    );

    expect(response.ok()).toBeTruthy();

    await use(name);

    await apiContext.delete(
      `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(name)}`,
      { params: { hardDelete: true } }
    );

    await afterAction();
  },
});

async function navigateToWorkflowDetailPage(page: Page, name: string) {
  const detailResponse = page.waitForResponse(
    '/api/v1/governance/workflowDefinitions/name/*'
  );

  await page.goto(`/workflows/${encodeURIComponent(name)}/workflow`);
  await detailResponse;
  await waitForAllLoadersToDisappear(page);
}

async function openNodeConfigSidebar(page: Page) {
  const fitViewButton = page.getByTestId('fit-view-button');

  await expect(fitViewButton).toBeVisible();
  await fitViewButton.click();

  const node = page
    .locator('.react-flow__node')
    .filter({ hasText: 'Run App' })
    .first();

  await expect(node).toBeVisible();
  await node.click();

  const sidebar = page.getByTestId('node-config-sidebar');

  await expect(sidebar).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  return sidebar;
}

test.describe('No-Op Workflow — schema-based node config', () => {
  test('schema fields for runAppTask node render with correct labels and values', async ({
    page,
    workflowName,
  }) => {
    await redirectToHomePage(page);
    await navigateToWorkflowDetailPage(page, workflowName);

    const sidebar = await openNodeConfigSidebar(page);

    await expect(sidebar.getByTestId('metadata-form-section')).toBeVisible();
    await expect(sidebar.getByText('App Name')).toBeVisible();
    await expect(sidebar.getByText('Wait for Completion')).toBeVisible();
    await expect(
      sidebar.locator('input[value="DataInsightsApplication"]')
    ).toBeVisible();
  });

  test('schema fields for runAppTask node are read-only', async ({
    page,
    workflowName,
  }) => {
    await redirectToHomePage(page);
    await navigateToWorkflowDetailPage(page, workflowName);

    const sidebar = await openNodeConfigSidebar(page);

    await expect(
      sidebar.locator('input[value="DataInsightsApplication"]')
    ).toBeDisabled();
  });
});
