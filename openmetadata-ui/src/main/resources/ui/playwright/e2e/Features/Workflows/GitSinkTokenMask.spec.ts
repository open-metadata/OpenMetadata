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

import { APIRequestContext, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test as base } from '../../fixtures/pages';

const WORKFLOW_DEFINITIONS_API = '/api/v1/governance/workflowDefinitions';
const SECRET_MASK = '*********';
const STORED_TOKEN = 'ghp_playwrightStoredToken';
const REPLACEMENT_TOKEN = '*hunter2*';

interface SinkNode {
  subType?: string;
  config?: { sinkConfig?: { credentials?: { token?: string } } };
}

interface WorkflowBody {
  nodes?: SinkNode[];
}

// A periodic batch that is never scheduled, so the sink never runs against GitHub.
const GIT_SINK_WORKFLOW = (name: string) => ({
  name,
  displayName: name,
  description: 'Git sink token mask round trip',
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
      name: 'gitSink',
      displayName: 'Git Sink',
      type: 'automatedTask',
      subType: 'sinkTask',
      config: {
        sinkType: 'git',
        sinkConfig: {
          repositoryUrl: 'https://github.com/open-metadata/sink-mask-e2e.git',
          credentials: { type: 'token', token: STORED_TOKEN },
        },
        batchMode: true,
      },
    },
    { name: 'end', displayName: 'End', type: 'endEvent', subType: 'endEvent' },
  ],
  edges: [
    { from: 'start', to: 'gitSink' },
    { from: 'gitSink', to: 'end' },
  ],
  config: { storeStageStatus: false },
});

const getSinkToken = (workflow: WorkflowBody) =>
  workflow.nodes?.find((node) => node.subType === 'sinkTask')?.config
    ?.sinkConfig?.credentials?.token;

const test = base.extend<{ workflowName: string }>({
  workflowName: async ({ browser }, use) => {
    const name = `pw-git-sink-mask-${uuid()}`;
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const response = await apiContext.post(WORKFLOW_DEFINITIONS_API, {
      data: GIT_SINK_WORKFLOW(name),
    });

    expect(response.ok()).toBeTruthy();

    await use(name);

    await apiContext.delete(
      `${WORKFLOW_DEFINITIONS_API}/name/${encodeURIComponent(name)}`,
      { params: { hardDelete: true } }
    );
    await afterAction();
  },
});

const getStoredSinkToken = async (
  apiContext: APIRequestContext,
  name: string
) => {
  const response = await apiContext.get(
    `${WORKFLOW_DEFINITIONS_API}/name/${encodeURIComponent(name)}`
  );

  expect(response.ok()).toBeTruthy();

  return getSinkToken((await response.json()) as WorkflowBody);
};

const openSinkTokenInput = async (page: Page, name: string) => {
  const detailResponse = page.waitForResponse(
    `${WORKFLOW_DEFINITIONS_API}/name/*`
  );
  await page.goto(`/workflows/${encodeURIComponent(name)}/workflow`, {
    waitUntil: 'domcontentloaded',
  });
  await detailResponse;
  await waitForAllLoadersToDisappear(page);

  await page.getByTestId('fit-view-button').click();
  await page.getByTestId('edit-workflow-button').click();
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('workflow-sinktask-node').click();

  const sidebar = page.getByTestId('node-config-sidebar');

  await expect(sidebar).toBeVisible();

  return {
    sidebar,
    tokenInput: sidebar.getByTestId('token-input').locator('input'),
  };
};

// Saves the sink node, then the workflow, and returns the sink token the builder sent.
const saveSinkAndWorkflow = async (page: Page) => {
  const sidebar = page.getByTestId('node-config-sidebar');
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

  await expect(page.getByTestId('edit-workflow-button')).toBeVisible();

  return {
    sentToken: getSinkToken(response.request().postDataJSON() as WorkflowBody),
    returnedToken: getSinkToken((await response.json()) as WorkflowBody),
  };
};

test.describe(
  'Git sink token mask round trip',
  { tag: `${DOMAIN_TAGS.GOVERNANCE}:Workflows` },
  () => {
    test('saving the sink without typing a token keeps the stored token', async ({
      page,
      workflowName,
    }) => {
      await redirectToHomePage(page);
      const { tokenInput } = await openSinkTokenInput(page, workflowName);

      await expect(tokenInput).toHaveValue(SECRET_MASK);

      await tokenInput.focus();

      await expect(tokenInput).toHaveValue('');

      await tokenInput.blur();

      await expect(tokenInput).toHaveValue(SECRET_MASK);

      const { sentToken, returnedToken } = await saveSinkAndWorkflow(page);

      expect(sentToken).toBe(SECRET_MASK);
      expect(returnedToken).toBe(SECRET_MASK);

      const { apiContext, afterAction } = await getApiContext(page);

      expect(await getStoredSinkToken(apiContext, workflowName)).toBe(
        SECRET_MASK
      );

      await afterAction();
    });

    test('a token typed over the mask is saved verbatim', async ({
      page,
      workflowName,
    }) => {
      await redirectToHomePage(page);
      const { tokenInput } = await openSinkTokenInput(page, workflowName);

      await expect(tokenInput).toHaveValue(SECRET_MASK);

      await tokenInput.fill(REPLACEMENT_TOKEN);

      await expect(tokenInput).toHaveValue(REPLACEMENT_TOKEN);

      const { sentToken, returnedToken } = await saveSinkAndWorkflow(page);

      expect(sentToken).toBe(REPLACEMENT_TOKEN);
      expect(returnedToken).toBe(SECRET_MASK);

      const { apiContext, afterAction } = await getApiContext(page);

      expect(await getStoredSinkToken(apiContext, workflowName)).toBe(
        SECRET_MASK
      );

      await afterAction();
    });
  }
);
