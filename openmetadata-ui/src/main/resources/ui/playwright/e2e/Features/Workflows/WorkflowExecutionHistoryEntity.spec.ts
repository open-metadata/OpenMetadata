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
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

const TABLE_FQN = 'sample_data.ecommerce_db.shopify.dim_address';
const RELATED_ENTITY_LINK = `<#E::table::${TABLE_FQN}>`;
const ENTITY_NAME = 'dim_address';

const test = base.extend<{ page: Page; workflowName: string }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
  workflowName: async ({ browser }, use) => {
    const name = `pw-execution-history-entity-${uuid()}`;
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const response = await apiContext.post(
      '/api/v1/governance/workflowDefinitions',
      {
        data: {
          name,
          description:
            'Execution history entity column test workflow created by Playwright',
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
              type: 'endEvent',
              subType: 'endEvent',
              name: 'End',
              displayName: 'End',
            },
          ],
          edges: [{ from: 'Start', to: 'End' }],
        },
      }
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

const mockInstancesResponse = {
  data: [
    {
      id: 'instance-with-entity',
      status: 'FINISHED',
      startedAt: 1730000000000,
      endedAt: 1730000060000,
      timestamp: 1730000000000,
      variables: { global_relatedEntity: RELATED_ENTITY_LINK },
    },
    {
      id: 'instance-without-entity',
      status: 'FINISHED',
      startedAt: 1730000100000,
      endedAt: 1730000160000,
      timestamp: 1730000100000,
      variables: {},
    },
  ],
  paging: { total: 2 },
};

async function openExecutionHistory(page: Page, workflowName: string) {
  await page.route(
    '**/api/v1/governance/workflowInstances**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockInstancesResponse),
      });
    }
  );

  await page.goto(`/workflows/${encodeURIComponent(workflowName)}/workflow`);
  await waitForAllLoadersToDisappear(page);

  await page.getByTestId('workflow-execution-history').click();
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId('workflow-execution-history-table')
  ).toBeVisible();
}

test.describe('Workflow Execution History — Entity column', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('renders a clickable entity link for instances with a related entity', async ({
    page,
    workflowName,
  }) => {
    await openExecutionHistory(page, workflowName);

    const entityLink = page
      .getByTestId('workflow-execution-history-table')
      .getByTestId('related-entity-link');

    await expect(entityLink).toBeVisible();
    await expect(entityLink).toHaveText(ENTITY_NAME);
    await expect(entityLink).toHaveAttribute(
      'href',
      new RegExp(`/table/.*${ENTITY_NAME}`)
    );
  });

  test('navigates to the entity detail page when the link is clicked', async ({
    page,
    workflowName,
  }) => {
    await openExecutionHistory(page, workflowName);

    await page
      .getByTestId('workflow-execution-history-table')
      .getByTestId('related-entity-link')
      .click();

    await expect(page).toHaveURL(new RegExp(`/table/.*${ENTITY_NAME}`));
  });

  test('shows the no-data placeholder for instances without a related entity', async ({
    page,
    workflowName,
  }) => {
    await openExecutionHistory(page, workflowName);

    await expect(page.getByTestId('related-entity-placeholder')).toBeVisible();
  });
});
