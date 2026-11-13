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
 * runs on every table edit (a filtered-out edit still records a run, without steps), so the spec
 * follows its own runs by their decided approval step and checks each one right after it lands.
 */

const APPROVAL_NODE = 'ReviewDescription';

type Run = { id: string };
type Step = { stage?: { name?: string; endedAt?: number } };

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
            name: APPROVAL_NODE,
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
          { from: 'Start', to: APPROVAL_NODE },
          { from: APPROVAL_NODE, to: 'ApprovedEnd', condition: 'approve' },
          { from: APPROVAL_NODE, to: 'RejectedEnd', condition: 'reject' },
        ],
      },
    }),
    'createOwnerReview'
  );

const isDecided = async (
  apiContext: APIRequestContext,
  name: string,
  runId: string
) => {
  const { data } = await okJson<{ data: Step[] }>(
    await apiContext.get(
      `/api/v1/governance/workflowInstanceStates/${name}/${runId}`,
      { params: { startTs: 0, endTs: Date.now(), limit: 50 } }
    ),
    'workflowInstanceStates'
  );

  return data.some(
    ({ stage }) => stage?.name === APPROVAL_NODE && stage.endedAt
  );
};

// The run of this table whose approval step has been decided and is not one of `known`.
const awaitDecidedRun = async (
  apiContext: APIRequestContext,
  name: string,
  table: TableClass,
  known: string[]
) => {
  let decidedRunId = '';
  await expect
    .poll(
      async () => {
        const { data } = await okJson<{ data: Run[] }>(
          await apiContext.get('/api/v1/governance/workflowInstances', {
            params: {
              workflowDefinitionName: name,
              entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
              startTs: 0,
              endTs: Date.now(),
              limit: 50,
            },
          }),
          'workflowInstances'
        );
        const fresh = data.filter(({ id }) => !known.includes(id));
        const decided = await Promise.all(
          fresh.map(async ({ id }) =>
            (await isDecided(apiContext, name, id)) ? id : ''
          )
        );
        decidedRunId = decided.find(Boolean) ?? '';

        return decidedRunId;
      },
      { timeout: 90_000 }
    )
    .toBeTruthy();

  return decidedRunId;
};

const expectOutcome = async (
  page: Page,
  name: string,
  runId: string,
  outcome: string
) => {
  await page.goto(`/workflows/${encodeURIComponent(name)}/workflow`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('workflow-execution-history').click();
  await expect(
    page.getByTestId(`workflow-approval-outcome-${runId}`)
  ).toHaveText(outcome);
};

const approveAsOwner = async (
  ownerPage: Page,
  table: TableClass,
  ownerName: string
) => {
  const { apiContext, afterAction } = await getApiContext(ownerPage);
  try {
    let taskId = '';
    await expect
      .poll(
        async () => {
          const { data } = await okJson<{
            data: { id: string; assignees?: { name: string }[] }[];
          }>(
            await apiContext.get('/api/v1/tasks', {
              params: {
                aboutEntity: table.entityResponseData.fullyQualifiedName,
                status: 'Open',
                limit: 20,
                fields: 'assignees',
              },
            }),
            'openTasks'
          );
          taskId =
            data.find((task) =>
              task.assignees?.some(({ name }) => name === ownerName)
            )?.id ?? '';

          return taskId;
        },
        { timeout: 90_000 }
      )
      .toBeTruthy();
    await okJson(
      await apiContext.post(`/api/v1/tasks/${taskId}/resolve`, {
        data: { transitionId: 'approve' },
      }),
      'resolveTask'
    );
  } finally {
    await afterAction();
  }
};

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
      const workflowName = `PwOwnerReview${uuid()}`;
      let workflowId = '';

      try {
        await table.create(apiContext);
        workflowId = (
          await createOwnerReview(
            apiContext,
            workflowName,
            table.entityResponseData.id
          )
        ).id;

        const autoRun =
          await test.step('a run with no owner to ask approves itself', async () => {
            await setDescription(apiContext, table, 'Addresses of customers.');
            const runId = await awaitDecidedRun(
              apiContext,
              workflowName,
              table,
              []
            );
            await expectOutcome(
              page,
              workflowName,
              runId,
              'Auto-approved: no one to assign'
            );

            return runId;
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
          await approveAsOwner(dataConsumerPage, table, owner.name);
          const runId = await awaitDecidedRun(apiContext, workflowName, table, [
            autoRun,
          ]);
          await expectOutcome(
            page,
            workflowName,
            runId,
            `Approved by ${owner.name}`
          );
        });
      } finally {
        if (workflowId) {
          await apiContext.delete(
            `/api/v1/governance/workflowDefinitions/${workflowId}`,
            { params: { hardDelete: true } }
          );
        }
        if (table.entityResponseData.id) {
          await table.delete(apiContext);
        }
        await afterAction();
      }
    });
  }
);
