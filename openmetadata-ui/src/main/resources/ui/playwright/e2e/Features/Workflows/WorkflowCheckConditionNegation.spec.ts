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
import { Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { performAdminLogin } from '../../../utils/admin';
import { selectOption } from '../../../utils/advancedSearch';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test as base } from '../../fixtures/pages';

const WORKFLOW_DEFINITIONS_API = '/api/v1/governance/workflowDefinitions';
const CHECK_NODE_NAME = 'checkTags';
const CHECK_NODE_LABEL = 'Check Tags';
const TAG_FQN = 'PII.Sensitive';

const tagIs = (fqn: string) => ({
  some: [{ var: 'tags' }, { '==': [{ var: 'tagFQN' }, fqn] }],
});

// A periodic batch that is never scheduled, so the check never runs.
const CHECK_CONDITION_WORKFLOW = (name: string, rules: unknown) => ({
  name,
  displayName: name,
  description: 'Check condition negation round trip',
  trigger: {
    type: 'periodicBatchEntity',
    config: {
      entityTypes: ['table'],
      schedule: { scheduleTimeline: 'None' },
      batchSize: 10,
      filters: '{}',
    },
    output: ['relatedEntity', 'updatedBy'],
  },
  nodes: [
    {
      name: 'start',
      displayName: 'Start',
      type: 'startEvent',
      subType: 'startEvent',
    },
    {
      name: CHECK_NODE_NAME,
      displayName: CHECK_NODE_LABEL,
      type: 'automatedTask',
      subType: 'checkEntityAttributesTask',
      config: { rules: JSON.stringify(rules) },
      inputNamespaceMap: { relatedEntity: 'global' },
    },
    {
      name: 'matched',
      displayName: 'Matched',
      type: 'endEvent',
      subType: 'endEvent',
    },
    {
      name: 'unmatched',
      displayName: 'Unmatched',
      type: 'endEvent',
      subType: 'endEvent',
    },
  ],
  edges: [
    { from: 'start', to: CHECK_NODE_NAME },
    { from: CHECK_NODE_NAME, to: 'matched', condition: 'true' },
    { from: CHECK_NODE_NAME, to: 'unmatched', condition: 'false' },
  ],
  config: { storeStageStatus: false },
});

interface WorkflowBody {
  nodes?: { name?: string; config?: { rules?: string } }[];
}

const test = base.extend<{
  createWorkflow: (rules: unknown) => Promise<string>;
}>({
  createWorkflow: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const created: string[] = [];

    await use(async (rules) => {
      const name = `pw-check-negation-${uuid()}`;
      const response = await apiContext.post(WORKFLOW_DEFINITIONS_API, {
        data: CHECK_CONDITION_WORKFLOW(name, rules),
      });

      expect(response.ok()).toBeTruthy();

      created.push(name);

      return name;
    });

    for (const name of created) {
      await apiContext.delete(
        `${WORKFLOW_DEFINITIONS_API}/name/${encodeURIComponent(name)}`,
        { params: { hardDelete: true } }
      );
    }
    await afterAction();
  },
});

const openCheckNode = async (page: Page, name: string, edit = false) => {
  const detailResponse = page.waitForResponse(
    `${WORKFLOW_DEFINITIONS_API}/name/*`
  );
  await page.goto(`/workflows/${encodeURIComponent(name)}/workflow`, {
    waitUntil: 'domcontentloaded',
  });
  await detailResponse;
  await waitForAllLoadersToDisappear(page);

  await page.getByTestId('fit-view-button').click();

  if (edit) {
    await page.getByTestId('edit-workflow-button').click();
    await waitForAllLoadersToDisappear(page);
  }

  await page
    .locator('.react-flow__node')
    .filter({ hasText: CHECK_NODE_LABEL })
    .click();

  const sidebar = page.getByTestId('node-config-sidebar');

  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByTestId('query-builder')).toBeVisible();

  return sidebar;
};

const getSavedRules = (workflow: WorkflowBody) =>
  JSON.parse(
    workflow.nodes?.find((node) => node.name === CHECK_NODE_NAME)?.config
      ?.rules ?? '{}'
  );

test.describe(
  'Workflow check condition negation',
  { tag: `${DOMAIN_TAGS.GOVERNANCE}:Workflows` },
  () => {
    test('a negated tag rule saved through the API reads as "Is Not"', async ({
      page,
      createWorkflow,
    }) => {
      const name = await createWorkflow({ '!': { and: [tagIs(TAG_FQN)] } });
      const sidebar = await openCheckNode(page, name);

      await expect(
        sidebar
          .getByTestId('advanced-search-operator-select')
          .locator('input[role="combobox"]')
      ).toHaveValue('Is Not');
      await expect(
        sidebar.getByTestId('query-builder-negated-group')
      ).not.toBeVisible();
    });

    test('a NOT over several conditions is shown, not dropped', async ({
      page,
      createWorkflow,
    }) => {
      const name = await createWorkflow({
        '!': { and: [tagIs(TAG_FQN), tagIs('PII.NonSensitive')] },
      });
      const sidebar = await openCheckNode(page, name);

      await expect(
        sidebar.getByTestId('query-builder-negated-group')
      ).toBeVisible();
      await expect(
        sidebar.getByText('At least one condition must not match')
      ).toBeVisible();
    });

    test('"Is Not" on tags saves as "no tag is X"', async ({
      page,
      createWorkflow,
    }) => {
      const name = await createWorkflow({ and: [tagIs(TAG_FQN)] });
      const sidebar = await openCheckNode(page, name, true);

      await selectOption(
        page,
        sidebar.getByTestId('advanced-search-operator-select'),
        'Is Not'
      );
      await sidebar.getByTestId('save-node-configuration-button').click();

      await expect(sidebar).not.toBeVisible();

      const saveResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes(WORKFLOW_DEFINITIONS_API) &&
          response.request().method() === 'PUT',
        'ok'
      );
      await page.getByTestId('save-workflow-button').click();
      const response = await saveResponse;

      expect(
        getSavedRules(response.request().postDataJSON() as WorkflowBody)
      ).toEqual({ and: [{ '!': tagIs(TAG_FQN) }] });
    });
  }
);
