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

import { type APIRequestContext, type Page } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { expect, test as base } from '../../../support/fixtures/base';
import { performAdminLogin } from '../../../utils/admin';
import { selectOption } from '../../../utils/advancedSearch';
import { clickOutside, redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
});

const TABLE_CP_COLUMNS = ['Name', 'Role'];
const TABLE_CP_SOME_RULE = JSON.stringify({
  and: [
    {
      some: [
        { var: 'extension.%CP_NAME%.rows' },
        { '==': [{ var: 'Name' }, 'karan'] },
      ],
    },
  ],
});

let workflowName: string;
let cpName: string;
let tableCpTypeId: string;
let tableMetadataTypeId: string;

async function createTableCp(apiContext: APIRequestContext) {
  const typesRes = await apiContext.get(
    '/api/v1/metadata/types?category=field&limit=50'
  );
  const types = (await typesRes.json()).data as { name: string; id: string }[];
  const tableCpType = types.find((t) => t.name === 'table-cp');

  expect(tableCpType).toBeDefined();
  tableCpTypeId = tableCpType!.id;

  const tableMetaRes = await apiContext.get(
    '/api/v1/metadata/types/name/table?fields=customProperties'
  );
  const tableMeta = await tableMetaRes.json();
  tableMetadataTypeId = tableMeta.id;

  cpName = `pw-tablecp-${uuid()}`;

  const addCpRes = await apiContext.put(
    `/api/v1/metadata/types/${tableMetadataTypeId}`,
    {
      data: {
        name: cpName,
        description: `PW test table CP ${cpName}`,
        propertyType: {
          name: 'table-cp',
          type: 'type',
          id: tableCpTypeId,
        },
        customPropertyConfig: {
          config: { columns: TABLE_CP_COLUMNS },
        },
      },
    }
  );

  expect(addCpRes.ok()).toBeTruthy();
}

async function deleteTableCp(apiContext: APIRequestContext) {
  if (tableMetadataTypeId && cpName) {
    await apiContext.delete(
      `/api/v1/metadata/types/${tableMetadataTypeId}/customProperties/${cpName}`
    );
  }
}

function getRulesWithCpName() {
  return TABLE_CP_SOME_RULE.replace('%CP_NAME%', cpName);
}

async function createWorkflow(apiContext: APIRequestContext) {
  workflowName = `pw-tablecp-workflow-${uuid()}`;

  const res = await apiContext.post('/api/v1/governance/workflowDefinitions', {
    data: {
      name: workflowName,
      description:
        'Workflow to verify table-type CP check condition uses some-rule shape',
      config: { storeStageStatus: false },
      trigger: {
        type: 'eventBasedEntity',
        config: {
          entityTypes: ['table'],
          events: ['Created', 'Updated'],
          exclude: [],
        },
        output: ['relatedEntity', 'updatedBy'],
      },
      nodes: [
        {
          type: 'startEvent',
          subType: 'startEvent',
          name: 'start',
          displayName: 'Start',
        },
        {
          type: 'automatedTask',
          subType: 'checkEntityAttributesTask',
          name: 'checkEntityAttributesTask_1',
          displayName: 'Check Table CP',
          input: ['relatedEntity'],
          output: ['result'],
          branches: ['true', 'false'],
          config: {
            rules: getRulesWithCpName(),
          },
          inputNamespaceMap: {
            relatedEntity: 'global',
          },
        },
        {
          type: 'endEvent',
          subType: 'endEvent',
          name: 'endEvent_true',
          displayName: 'End True',
        },
        {
          type: 'endEvent',
          subType: 'endEvent',
          name: 'endEvent_false',
          displayName: 'End False',
        },
      ],
      edges: [
        { from: 'start', to: 'checkEntityAttributesTask_1' },
        {
          from: 'checkEntityAttributesTask_1',
          to: 'endEvent_true',
          condition: 'true',
        },
        {
          from: 'checkEntityAttributesTask_1',
          to: 'endEvent_false',
          condition: 'false',
        },
      ],
    },
  });

  return res;
}

async function deleteWorkflow(apiContext: APIRequestContext) {
  if (workflowName) {
    await apiContext.delete(
      `/api/v1/governance/workflowDefinitions/name/${encodeURIComponent(
        workflowName
      )}`,
      { params: { hardDelete: true } }
    );
  }
}

async function navigateToWorkflowDetail(page: Page, name: string) {
  await sidebarClick(page, SidebarItem.GOVERNANCE);

  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/governance/workflowDefinitions') &&
      response.request().method() === 'GET'
  );
  await page.click('[data-testid="app-bar-item-workflows"]');
  await listResponse;
  await waitForAllLoadersToDisappear(page);
  await clickOutside(page);

  const detailResponse = page.waitForResponse(
    '/api/v1/governance/workflowDefinitions/name/*'
  );
  await page.click(`[data-testid="${name}"]`);
  await detailResponse;
  await waitForAllLoadersToDisappear(page);
}

async function openCheckConditionNode(page: Page) {
  const fitViewButton = page.getByTestId('fit-view-button');
  await expect(fitViewButton).toBeVisible();
  await fitViewButton.click();

  await page.getByTestId('edit-workflow-button').click();
  await waitForAllLoadersToDisappear(page);

  const checkNode = page
    .locator('.react-flow__node')
    .filter({ hasText: 'Check Table CP' });

  await expect(checkNode).toBeVisible();
  await checkNode.click();

  const sidebar = page.getByTestId('node-config-sidebar');
  await expect(sidebar).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  return sidebar;
}

if (!process.env.PLAYWRIGHT_IS_OSS) {
  test.describe('Table type custom property — workflow check condition', () => {
    test.beforeAll(
      'Create table-type CP and workflow via API',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createTableCp(apiContext);
        const res = await createWorkflow(apiContext);
        expect(res.ok()).toBeTruthy();
        await afterAction();
      }
    );

    test.afterAll('Clean up CP and workflow via API', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await deleteWorkflow(apiContext);
      await deleteTableCp(apiContext);
      await afterAction();
    });

    test('Check Condition node loads the some-rule for table CP and re-saves it correctly', async ({
      page,
    }) => {
      test.slow(); // workflow UI interactions are heavyweight

      await redirectToHomePage(page);
      await navigateToWorkflowDetail(page, workflowName);
      const sidebar = await openCheckConditionNode(page);

      const queryBuilder = sidebar.locator(
        '[data-testid="query-builder-form-field"]'
      );
      await expect(queryBuilder).toBeVisible();

      const ruleRow = queryBuilder.locator('.rule, .group--children .rule');
      await expect(ruleRow).toBeVisible({ timeout: 15000 });

      const saveButton = sidebar.getByTestId('save-node-configuration-button');
      await expect(saveButton).toBeVisible();

      const saveResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/governance/workflowDefinitions') &&
          response.request().method() === 'PUT'
      );
      await saveButton.click();
      const response = await saveResponse;
      const body = JSON.parse(response.request().postData() ?? '{}');

      const checkNode = body.nodes?.find(
        (n: { name: string }) => n.name === 'checkEntityAttributesTask_1'
      );
      expect(checkNode).toBeDefined();

      const savedRules = JSON.parse(checkNode.config.rules);

      expect(savedRules).toHaveProperty('and');

      const firstCondition = savedRules.and[0];
      expect(firstCondition).toHaveProperty('some');
      expect(firstCondition.some[0]).toEqual({
        var: `extension.${cpName}.rows`,
      });
      expect(firstCondition.some[1]).toHaveProperty('==');
    });

    test('Selecting a table CP column in the query builder emits a some-rule', async ({
      page,
    }) => {
      test.slow(); // workflow UI interactions are heavyweight

      await redirectToHomePage(page);
      await navigateToWorkflowDetail(page, workflowName);

      const fitViewButton = page.getByTestId('fit-view-button');
      await expect(fitViewButton).toBeVisible();
      await fitViewButton.click();

      await page.getByTestId('edit-workflow-button').click();
      await waitForAllLoadersToDisappear(page);

      const checkNode = page
        .locator('.react-flow__node')
        .filter({ hasText: 'Check Table CP' });
      await expect(checkNode).toBeVisible();
      await checkNode.click();

      const sidebar = page.getByTestId('node-config-sidebar');
      await expect(sidebar).toBeVisible();
      await waitForAllLoadersToDisappear(page);

      const queryBuilder = sidebar.locator(
        '[data-testid="query-builder-form-field"]'
      );
      await expect(queryBuilder).toBeVisible();

      await queryBuilder
        .locator('[data-testid="advanced-search-add-rule"]')
        .click();

      const rules = queryBuilder.locator('.rule');
      const ruleCount = await rules.count();
      const newRule = rules.nth(ruleCount - 1); // eslint-disable-line om-playwright/no-positional-locator -- the rule was just added; filtering by empty state is fragile across RAQB versions, so nth(count-1) is the stable approach here
      await expect(newRule).toBeVisible();

      await selectOption(
        page,
        newRule.locator('.rule--field'),
        'Custom Properties',
        true
      );
      await selectOption(page, newRule.locator('.rule--field'), 'Table', true);
      await selectOption(page, newRule.locator('.rule--field'), cpName, true);
      await selectOption(page, newRule.locator('.rule--field'), 'Role', true);

      const valueInput = newRule.locator('.rule--widget input[type="text"]');
      await expect(valueInput).toBeVisible();
      await valueInput.fill('Admin');

      const saveResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/governance/workflowDefinitions') &&
          response.request().method() === 'PUT'
      );
      await sidebar.getByTestId('save-node-configuration-button').click();
      const response = await saveResponse;
      const body = JSON.parse(response.request().postData() ?? '{}');

      const checkNodeConfig = body.nodes?.find(
        (n: { name: string }) => n.name === 'checkEntityAttributesTask_1'
      );
      expect(checkNodeConfig).toBeDefined();

      const savedRules = JSON.parse(checkNodeConfig.config.rules);
      const conditions = savedRules.and;

      expect(conditions.length).toBeGreaterThanOrEqual(2);

      for (const condition of conditions) {
        expect(condition).toHaveProperty('some');
        expect(condition.some[0]).toEqual({
          var: `extension.${cpName}.rows`,
        });
      }

      const roleCondition = conditions.find(
        (c: { some: [unknown, { '==': [{ var: string }, string] }] }) =>
          c.some?.[1]?.['==']?.[0]?.var === 'Role'
      );
      expect(roleCondition).toBeDefined();
      expect(roleCondition.some[1]['==']).toEqual([{ var: 'Role' }, 'Admin']);
    });
  });
}
