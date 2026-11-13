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
import { TableClass } from '../../../support/entity/TableClass';
import { okJson } from '../../../utils/apiResponse';
import { getApiContext, redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { expect, test } from '../../fixtures/pages';

/**
 * A workflow's execution history says how each run's approval step was decided: by the workflow
 * itself when the table had no owner to ask, or by the owner who approved the task. The workflow
 * watches description edits on one table, so no other spec's edits start a run.
 */

type Run = { id: string; status: string };

const loggedInUserName = async (page: Page) => {
  await redirectToHomePage(page);
  const { apiContext, afterAction } = await getApiContext(page);
  const user = await okJson<{ id: string; name: string }>(
    await apiContext.get('/api/v1/users/loggedInUser'),
    'loggedInUser'
  );
  await afterAction();

  return user;
};

// The approval step asks the table's owners; with none it approves the run itself.
const createOwnerReview = async (
  apiContext: APIRequestContext,
  name: string,
  tableId: string
) =>
  okJson<{ id: string }>(
    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: {
        name,
        displayName: 'Playwright owner review',
        description: 'Asks the owners of one table to review its description.',
        config: { storeStageStatus: true },
        trigger: {
          type: 'eventBasedEntity',
          config: {
            entityTypes: ['table'],
            events: ['Updated'],
            include: ['description'],
            exclude: [],
            filter: {
              table: JSON.stringify({ '!=': [{ var: 'id' }, tableId] }),
            },
          },
          output: ['relatedEntity', 'updatedBy'],
        },
        nodes: [
          { type: 'startEvent', subType: 'startEvent', name: 'Start' },
          {
            type: 'userTask',
            subType: 'userApprovalTask',
            name: 'ReviewDescription',
            displayName: 'Review description',
            config: {
              assignees: {
                addReviewers: false,
                addOwners: true,
                candidates: [],
              },
              approvalThreshold: 1,
              rejectionThreshold: 1,
            },
            inputNamespaceMap: { relatedEntity: 'global' },
          },
          { type: 'endEvent', subType: 'endEvent', name: 'ApprovedEnd' },
          { type: 'endEvent', subType: 'endEvent', name: 'RejectedEnd' },
        ],
        edges: [
          { from: 'Start', to: 'ReviewDescription' },
          {
            from: 'ReviewDescription',
            to: 'ApprovedEnd',
            condition: 'approve',
          },
          {
            from: 'ReviewDescription',
            to: 'RejectedEnd',
            condition: 'reject',
          },
        ],
      },
    }),
    'createOwnerReview'
  );

const finishedRuns = async (apiContext: APIRequestContext, name: string) => {
  const { data } = await okJson<{ data: Run[] }>(
    await apiContext.get('/api/v1/governance/workflowInstances', {
      params: {
        workflowDefinitionName: name,
        startTs: 0,
        endTs: Date.now(),
        limit: 20,
      },
    }),
    'workflowInstances'
  );

  return data.filter((run) => run.status === 'FINISHED');
};

const awaitFinishedRuns = (
  apiContext: APIRequestContext,
  name: string,
  count: number
) =>
  expect
    .poll(async () => (await finishedRuns(apiContext, name)).length, {
      timeout: 90_000,
    })
    .toBeGreaterThanOrEqual(count);

const setDescription = (
  apiContext: APIRequestContext,
  table: TableClass,
  description: string
) =>
  table.patch({
    apiContext,
    patchData: [{ op: 'add', path: '/description', value: description }],
  });

test.describe(
  'Workflow run approval outcome',
  { tag: ['@workflow', '@Governance'] },
  () => {
    test('execution history says who decided each approval', async ({
      page,
      dataConsumerPage,
    }) => {
      test.slow();
      const owner = await loggedInUserName(dataConsumerPage);
      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      const table = new TableClass();
      await table.create(apiContext);
      const workflowName = `PwOwnerReview${uuid()}`;
      const workflow = await createOwnerReview(
        apiContext,
        workflowName,
        table.entityResponseData.id
      );

      try {
        await test.step('a run with no owner to ask approves itself', async () => {
          await setDescription(apiContext, table, 'Addresses of customers.');
          await awaitFinishedRuns(apiContext, workflowName, 1);
        });

        await test.step('a run the owner approves names the owner', async () => {
          await table.patch({
            apiContext,
            patchData: [
              {
                op: 'add',
                path: '/owners',
                value: [{ id: owner.id, type: 'user' }],
              },
            ],
          });
          await setDescription(
            apiContext,
            table,
            'Billing and shipping addresses of customers.'
          );
          const ownerContext = await getApiContext(dataConsumerPage);
          let taskId: string | undefined;
          await expect
            .poll(
              async () => {
                const { data } = await okJson<{
                  data: { id: string; assignees?: { name: string }[] }[];
                }>(
                  await ownerContext.apiContext.get('/api/v1/tasks', {
                    params: {
                      aboutEntity: table.entityResponseData.fullyQualifiedName,
                      status: 'Open',
                      limit: 20,
                      fields: 'assignees',
                    },
                  }),
                  'openTasks'
                );
                taskId = data.find((task) =>
                  task.assignees?.some(({ name }) => name === owner.name)
                )?.id;

                return taskId;
              },
              { timeout: 90_000 }
            )
            .toBeTruthy();
          await okJson(
            await ownerContext.apiContext.post(
              `/api/v1/tasks/${taskId}/resolve`,
              { data: { transitionId: 'approve' } }
            ),
            'resolveTask'
          );
          await ownerContext.afterAction();
          await awaitFinishedRuns(apiContext, workflowName, 2);
        });

        await test.step('the execution history shows both decisions', async () => {
          await page.goto(
            `/workflows/${encodeURIComponent(workflowName)}/workflow`,
            { waitUntil: 'domcontentloaded' }
          );
          await waitForAllLoadersToDisappear(page);
          await page.getByTestId('workflow-execution-history').click();
          const history = page.getByTestId('workflow-execution-history-table');
          await expect(history).toBeVisible();

          const outcomes = history.locator(
            '[data-testid^="workflow-approval-outcome-"]'
          );
          await expect(outcomes).toHaveText(
            [`Approved by ${owner.name}`, 'Auto-approved: no one to assign'],
            { timeout: 30_000 }
          );
        });
      } finally {
        await apiContext.delete(
          `/api/v1/governance/workflowDefinitions/${workflow.id}`,
          { params: { hardDelete: true } }
        );
        await table.delete(apiContext);
        await afterAction();
      }
    });
  }
);
