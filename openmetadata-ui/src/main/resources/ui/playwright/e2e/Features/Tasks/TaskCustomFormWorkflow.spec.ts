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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { APIRequestContext } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { authenticateAdminPage, performAdminLogin } from '../../../utils/admin';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  createInboxTask,
  openInboxTask,
  visitTriage,
} from '../../../utils/inbox';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

type TaskFormSchema = {
  id?: string;
  name: string;
  displayName?: string;
  taskType: string;
  taskCategory: string;
  formSchema: Record<string, unknown>;
  uiSchema?: Record<string, unknown>;
  workflowDefinitionRef?: string;
  createFormSchema?: Record<string, unknown>;
  createUiSchema?: Record<string, unknown>;
  transitionForms?: Record<string, unknown>;
  version?: number;
};

type CustomTaskSeed = {
  workflowId?: string;
  schemaToRestore?: TaskFormSchema;
  createdSchema?: TaskFormSchema;
};

/**
 * Point the CustomTask form schema at a fresh workflow whose `approve` form
 * requires `targetField` and `proposedText`. Ids land on `seed` as they are
 * created, so a partial seed is still cleaned up.
 */
const seedCustomTaskWorkflow = async (
  apiContext: APIRequestContext,
  seed: CustomTaskSeed
) => {
  const workflowName = `PlaywrightCustomTaskWorkflow${uuid()}`;

  const createWorkflowResponse = await apiContext.post(
    '/api/v1/governance/workflowDefinitions',
    {
      data: {
        name: workflowName,
        displayName: 'Playwright Custom Task Workflow',
        description: 'Workflow-backed custom task lifecycle for Playwright',
        config: {
          storeStageStatus: true,
        },
        trigger: {
          type: 'noOp',
          config: {},
          output: ['relatedEntity', 'updatedBy'],
        },
        nodes: [
          {
            type: 'startEvent',
            subType: 'startEvent',
            name: 'TaskStart',
            displayName: 'Task Start',
          },
          {
            type: 'userTask',
            subType: 'userApprovalTask',
            name: 'TaskReview',
            displayName: 'Review Task',
            config: {
              assignees: {
                addReviewers: true,
                addOwners: false,
                candidates: [],
              },
              approvalThreshold: 1,
              rejectionThreshold: 1,
              stageId: 'review',
              stageDisplayName: 'Review',
              taskStatus: 'Open',
              assigneeStrategy: 'reviewers-and-assignees',
              transitionMetadata: [
                {
                  id: 'approve',
                  label: 'Approve',
                  targetStageId: 'approved',
                  targetTaskStatus: 'Approved',
                  resolutionType: 'Approved',
                  formRef: 'approve',
                  requiresComment: false,
                },
                {
                  id: 'reject',
                  label: 'Reject',
                  targetStageId: 'rejected',
                  targetTaskStatus: 'Rejected',
                  resolutionType: 'Rejected',
                  formRef: 'reject',
                  requiresComment: true,
                },
              ],
            },
            input: ['relatedEntity'],
            output: ['result'],
            branches: ['approve', 'reject'],
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
          {
            from: 'TaskStart',
            to: 'TaskReview',
          },
          {
            from: 'TaskReview',
            to: 'ApprovedEnd',
            condition: 'approve',
          },
          {
            from: 'TaskReview',
            to: 'RejectedEnd',
            condition: 'reject',
          },
        ],
      },
    }
  );
  expect(createWorkflowResponse.ok()).toBeTruthy();
  const createdWorkflow = await createWorkflowResponse.json();
  seed.workflowId = createdWorkflow.id;

  const schemaListResponse = await apiContext.get(
    `/api/v1/taskFormSchemas?taskType=CustomTask&taskCategory=Custom&limit=1&include=all`
  );
  expect(schemaListResponse.ok()).toBeTruthy();

  const schemaListPayload = await schemaListResponse.json();
  const existingSchema = schemaListPayload.data?.[0] as
    | TaskFormSchema
    | undefined;

  const updatedSchema: TaskFormSchema = {
    ...(existingSchema ?? {
      name: `CustomTaskSchema${uuid()}`,
      taskType: 'CustomTask',
      taskCategory: 'Custom',
    }),
    displayName: 'Playwright Custom Task Form',
    workflowDefinitionRef: workflowName,
    formSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        targetField: {
          type: 'string',
          title: 'Target Field',
        },
        proposedText: {
          type: 'string',
          title: 'Proposed Text',
        },
        reviewNotes: {
          type: 'string',
          title: 'Review Notes',
        },
      },
      required: ['targetField', 'proposedText'],
    },
    uiSchema: {
      'ui:handler': {
        type: 'descriptionUpdate',
        permission: 'EDIT_DESCRIPTION',
        fieldPathField: 'targetField',
        valueField: 'proposedText',
      },
      'ui:editablePayload': {
        fieldPathField: 'targetField',
        editedValueField: 'proposedText',
      },
      'ui:resolution': {
        mode: 'payload',
      },
      'ui:execution': {
        approve: {
          actions: [
            {
              type: 'setDescription',
              fieldPathField: 'targetField',
              valueField: 'proposedText',
            },
          ],
        },
        reject: {
          actions: [],
        },
      },
      'ui:order': ['proposedText', 'reviewNotes', 'targetField'],
      targetField: {
        'ui:widget': 'hidden',
      },
      proposedText: {
        'ui:widget': 'textarea',
      },
      reviewNotes: {
        'ui:widget': 'textarea',
      },
    },
    createFormSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        targetField: {
          type: 'string',
          title: 'Target Field',
        },
        proposedText: {
          type: 'string',
          title: 'Proposed Text',
        },
        reviewNotes: {
          type: 'string',
          title: 'Review Notes',
        },
      },
      required: ['targetField', 'proposedText'],
    },
    createUiSchema: {
      'ui:handler': {
        type: 'descriptionUpdate',
        permission: 'EDIT_DESCRIPTION',
        fieldPathField: 'targetField',
        valueField: 'proposedText',
      },
      'ui:editablePayload': {
        fieldPathField: 'targetField',
        editedValueField: 'proposedText',
      },
      'ui:resolution': {
        mode: 'payload',
      },
      targetField: {
        'ui:widget': 'hidden',
      },
      proposedText: {
        'ui:widget': 'textarea',
      },
      reviewNotes: {
        'ui:widget': 'textarea',
      },
    },
    transitionForms: {
      approve: {
        formSchema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            targetField: {
              type: 'string',
              title: 'Target Field',
            },
            proposedText: {
              type: 'string',
              title: 'Proposed Text',
            },
            reviewNotes: {
              type: 'string',
              title: 'Review Notes',
            },
          },
          required: ['targetField', 'proposedText'],
        },
        uiSchema: {
          'ui:handler': {
            type: 'descriptionUpdate',
            permission: 'EDIT_DESCRIPTION',
            fieldPathField: 'targetField',
            valueField: 'proposedText',
          },
          'ui:resolution': {
            mode: 'payload',
          },
          targetField: {
            'ui:widget': 'hidden',
          },
          proposedText: {
            'ui:widget': 'textarea',
          },
          reviewNotes: {
            'ui:widget': 'textarea',
          },
        },
      },
      reject: {
        formSchema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            comment: {
              type: 'string',
              title: 'Comment',
            },
          },
          required: ['comment'],
        },
        uiSchema: {
          comment: {
            'ui:widget': 'textarea',
          },
        },
      },
    },
  };

  if (existingSchema?.id) {
    seed.schemaToRestore = existingSchema;
    const updateSchemaResponse = await apiContext.put(
      '/api/v1/taskFormSchemas',
      {
        data: updatedSchema,
      }
    );
    expect(updateSchemaResponse.ok()).toBeTruthy();
  } else {
    const createSchemaResponse = await apiContext.post(
      '/api/v1/taskFormSchemas',
      {
        data: updatedSchema,
      }
    );
    expect(createSchemaResponse.ok()).toBeTruthy();
    seed.createdSchema = await createSchemaResponse.json();
  }

  await expect
    .poll(
      async () => {
        const resolvedSchemaResponse = await apiContext.get(
          '/api/v1/taskFormSchemas?taskType=CustomTask&taskCategory=Custom&limit=1&include=all'
        );

        if (!resolvedSchemaResponse.ok()) {
          throw new Error(
            `HTTP ${resolvedSchemaResponse.status()} querying ${resolvedSchemaResponse.url()}`
          );
        }

        const resolvedSchemaPayload = await resolvedSchemaResponse.json();
        const resolvedSchema = resolvedSchemaPayload.data?.[0] as
          | TaskFormSchema
          | undefined;

        return resolvedSchema?.workflowDefinitionRef ?? null;
      },
      {
        timeout: 30000,
        intervals: [500, 1000, 2000],
      }
    )
    .toBe(workflowName);
};

const cleanupCustomTaskWorkflow = async (
  apiContext: APIRequestContext,
  seed: CustomTaskSeed
) => {
  if (seed.schemaToRestore) {
    await apiContext
      .put('/api/v1/taskFormSchemas', {
        data: seed.schemaToRestore,
      })
      .catch(() => null);
  } else if (seed.createdSchema?.id) {
    // The server caches each task type's form schema and refreshes it
    // only on a create or update, not a delete: relax the schema first,
    // so whatever stays cached cannot reject the Custom tasks later
    // specs create.
    await apiContext
      .put('/api/v1/taskFormSchemas', {
        data: {
          ...seed.createdSchema,
          formSchema: { type: 'object' },
          workflowDefinitionRef: null,
        },
      })
      .catch(() => null);
    await apiContext
      .delete(
        `/api/v1/taskFormSchemas/${seed.createdSchema.id}?hardDelete=true&recursive=true`
      )
      .catch(() => null);
  }

  if (seed.workflowId) {
    await apiContext
      .delete(`/api/v1/governance/workflowDefinitions/${seed.workflowId}`)
      .catch(() => null);
  }
};

const createCustomTask = (
  apiContext: APIRequestContext,
  table: TableClass,
  payload: Record<string, unknown>
) =>
  createInboxTask(apiContext, {
    name: `pw-custom-task-${uuid()}`,
    category: 'Custom',
    type: 'CustomTask',
    about: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
    assignee: 'admin',
    payload,
  });

test.describe.serial(
  'Task Custom Form Workflow',
  { tag: ['@workflow'] },
  () => {
    const seed: CustomTaskSeed = {};

    test.beforeAll('Seed the custom task workflow', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await seedCustomTaskWorkflow(apiContext, seed);
      } finally {
        await afterAction();
      }
    });

    test.afterAll('Clean up the custom task workflow', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await cleanupCustomTaskWorkflow(apiContext, seed);
      } finally {
        await afterAction();
      }
    });

    test('renders and resolves a workflow-driven custom task end to end', async ({
      page,
    }) => {
      test.setTimeout(90000);

      const proposedDescription = `Playwright proposed description ${uuid()}`;
      const updatedDescription = `Playwright updated description ${uuid()}`;
      const initialReviewNotes = `Initial review notes ${uuid()}`;
      const updatedReviewNotes = `Updated review notes ${uuid()}`;
      const table = new TableClass();
      let taskId: string | undefined;

      await authenticateAdminPage(page);

      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await table.create(apiContext);

        taskId = (
          await createCustomTask(apiContext, table, {
            targetField: 'description',
            proposedText: proposedDescription,
            reviewNotes: initialReviewNotes,
          })
        ).id;

        await table.visitEntityPage(page);
        await page.getByTestId('activity_feed').click();
        await waitForAllLoadersToDisappear(page);
        await page
          .getByTestId('global-setting-left-panel')
          .getByRole('button', { name: /tasks/i })
          .click();
        await waitForAllLoadersToDisappear(page);
        await expect(
          page
            .locator('[data-testid="task-feed-card"]')
            .filter({ visible: true })
        ).not.toHaveCount(0);
        await page.locator('[data-testid="task-feed-card"]').first().click();
        await expect(page.getByTestId('task-tab')).toBeVisible();
        await expect(page.getByTestId('task-payload-details')).toContainText(
          proposedDescription
        );
        await expect(page.getByTestId('task-payload-details')).toContainText(
          initialReviewNotes
        );

        const editAcceptDropdown = page.getByTestId(
          'edit-accept-task-dropdown'
        );

        if (await editAcceptDropdown.isVisible().catch(() => false)) {
          await editAcceptDropdown.locator('button').last().click();
          await page.getByTestId('task-action-menu-item-edit').click();
        } else {
          const workflowActionButton = page
            .locator(
              '[data-testid="workflow-task-action-primary"], [data-testid="workflow-task-action-dropdown"]'
            )
            .first();
          await expect(workflowActionButton).toBeVisible();
          await workflowActionButton.click();
        }

        const visibleModal = page.getByRole('dialog').first();
        await expect(visibleModal).toBeVisible();
        const proposedTextField = visibleModal.getByRole('textbox', {
          name: /Proposed Text/,
        });
        const reviewNotesField = visibleModal.getByRole('textbox', {
          name: /Review Notes/,
        });

        await proposedTextField.fill(updatedDescription);
        await reviewNotesField.fill(updatedReviewNotes);

        const resolveTaskResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes(`/api/v1/tasks/${taskId}/resolve`) &&
            response.request().method() === 'POST',
          'ok'
        );

        await visibleModal.getByRole('button', { name: /^ok$/i }).click();
        await resolveTaskResponse;

        await expect
          .poll(
            async () => {
              const updatedTableResponse = await apiContext.get(
                `/api/v1/tables/${table.entityResponseData.id}`
              );

              if (!updatedTableResponse.ok()) {
                throw new Error(
                  `HTTP ${updatedTableResponse.status()} querying ${updatedTableResponse.url()}`
                );
              }

              const updatedTable = await updatedTableResponse.json();

              return updatedTable.description ?? null;
            },
            {
              timeout: 15000,
              intervals: [500, 1000, 2000],
            }
          )
          .toBe(updatedDescription);

        const resolvedTaskResponse = await apiContext.get(
          `/api/v1/tasks/${taskId}`
        );
        expect(resolvedTaskResponse.ok()).toBeTruthy();
        const resolvedTask = await resolvedTaskResponse.json();

        expect(resolvedTask.status).not.toBe('Open');
      } finally {
        if (taskId) {
          await apiContext
            .delete(`/api/v1/tasks/${taskId}?hardDelete=true`)
            .catch(() => null);
        }

        if (table.entityResponseData?.id) {
          await table.delete(apiContext).catch(() => null);
        }

        await afterAction();
      }
    });

    test('collects the required transition form in the Inbox before resolving', async ({
      page,
    }) => {
      test.setTimeout(120000);

      const proposedDescription = `Playwright proposed description ${uuid()}`;
      const editedDescription = `Playwright inbox description ${uuid()}`;
      const table = new TableClass();
      let taskId: string | undefined;

      await authenticateAdminPage(page);

      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await table.create(apiContext);
        const task = await createCustomTask(apiContext, table, {
          targetField: 'description',
          proposedText: proposedDescription,
        });
        taskId = task.id;

        await visitTriage(page);
        const panel = await openInboxTask(page, task);

        await panel.getByTestId('task-approve').click();

        const formModal = page.getByTestId('task-transition-form-modal');
        await expect(formModal).toBeVisible();

        const proposedTextField = formModal.getByRole('textbox', {
          name: /Proposed Text/,
        });
        await expect(proposedTextField).toHaveValue(proposedDescription);
        await proposedTextField.fill(editedDescription);

        const resolveTaskResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes(`/api/v1/tasks/${task.id}/resolve`) &&
            response.request().method() === 'POST',
          'ok'
        );
        await formModal.getByTestId('task-transition-form-confirm').click();
        const resolveResponse = await resolveTaskResponse;

        expect(resolveResponse.request().postDataJSON()).toMatchObject({
          transitionId: 'approve',
          payload: { proposedText: editedDescription },
        });
        await expect(formModal).toBeHidden();

        await expect
          .poll(
            async () => {
              const updatedTableResponse = await apiContext.get(
                `/api/v1/tables/${table.entityResponseData.id}`
              );

              return (await updatedTableResponse.json()).description ?? null;
            },
            { timeout: 15000, intervals: [500, 1000, 2000] }
          )
          .toBe(editedDescription);
      } finally {
        if (taskId) {
          await apiContext
            .delete(`/api/v1/tasks/${taskId}?hardDelete=true`)
            .catch(() => null);
        }

        if (table.entityResponseData?.id) {
          await table.delete(apiContext).catch(() => null);
        }

        await afterAction();
      }
    });
  }
);
