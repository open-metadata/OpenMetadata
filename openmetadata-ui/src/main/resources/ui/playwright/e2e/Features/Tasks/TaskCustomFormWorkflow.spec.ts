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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { authenticateAdminPage } from '../../../utils/admin';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

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

type CreatedTask = {
  id: string;
  taskId: string;
  status?: string;
};

test.describe.serial('Task Custom Form Workflow', () => {
  test('renders and resolves a workflow-driven custom task end to end', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const proposedDescription = `Playwright proposed description ${uuid()}`;
    const updatedDescription = `Playwright updated description ${uuid()}`;
    const initialReviewNotes = `Initial review notes ${uuid()}`;
    const updatedReviewNotes = `Updated review notes ${uuid()}`;
    const workflowName = `PlaywrightCustomTaskWorkflow${uuid()}`;
    const table = new TableClass();
    let taskId: string | undefined;
    let workflowId: string | undefined;
    let schemaToRestore: TaskFormSchema | undefined;
    let createdSchemaId: string | undefined;

    await authenticateAdminPage(page);

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await table.create(apiContext);

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
      workflowId = createdWorkflow.id;

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
        schemaToRestore = existingSchema;
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
        const createdSchema = await createSchemaResponse.json();
        createdSchemaId = createdSchema.id;
      }

      await expect
        .poll(
          async () => {
            const resolvedSchemaResponse = await apiContext.get(
              '/api/v1/taskFormSchemas?taskType=CustomTask&taskCategory=Custom&limit=1&include=all'
            );

            if (!resolvedSchemaResponse.ok()) {
              return null;
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

      const createTaskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          name: `pw-custom-task-${uuid()}`,
          description: 'Playwright custom task form workflow',
          category: 'Custom',
          type: 'CustomTask',
          about: table.entityResponseData.fullyQualifiedName,
          aboutType: 'table',
          assignees: ['admin'],
          payload: {
            targetField: 'description',
            proposedText: proposedDescription,
            reviewNotes: initialReviewNotes,
          },
        },
      });
      expect(createTaskResponse.ok()).toBeTruthy();

      const createdTask = (await createTaskResponse.json()) as CreatedTask;
      taskId = createdTask.id;

      await table.visitEntityPage(page);
      await page.getByTestId('activity_feed').click();
      await waitForAllLoadersToDisappear(page);
      await page.getByRole('menuitem', { name: /tasks/i }).click();
      await waitForAllLoadersToDisappear(page);
      await expect(
        page.locator('[data-testid="task-feed-card"]').first()
      ).toBeVisible();
      await page.locator('[data-testid="task-feed-card"]').first().click();
      await expect(page.getByTestId('task-tab')).toBeVisible();
      await expect(page.getByTestId('task-payload-details')).toContainText(
        proposedDescription
      );
      await expect(page.getByTestId('task-payload-details')).toContainText(
        initialReviewNotes
      );

      const editAcceptDropdown = page.getByTestId('edit-accept-task-dropdown');

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
      const proposedTextField = visibleModal
        .locator('.ant-form-item')
        .filter({ hasText: 'Proposed Text' })
        .getByRole('textbox')
        .first();
      const reviewNotesField = visibleModal
        .locator('.ant-form-item')
        .filter({ hasText: 'Review Notes' })
        .getByRole('textbox')
        .first();

      await proposedTextField.fill(updatedDescription);
      await reviewNotesField.fill(updatedReviewNotes);

      const resolveTaskResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/tasks/${taskId}/resolve`) &&
          response.request().method() === 'POST' &&
          response.ok()
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
              return null;
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

      if (schemaToRestore) {
        await apiContext
          .put('/api/v1/taskFormSchemas', {
            data: schemaToRestore,
          })
          .catch(() => null);
      } else if (createdSchemaId) {
        await apiContext
          .delete(
            `/api/v1/taskFormSchemas/${createdSchemaId}?hardDelete=true&recursive=true`
          )
          .catch(() => null);
      }

      if (workflowId) {
        await apiContext
          .delete(`/api/v1/governance/workflowDefinitions/${workflowId}`)
          .catch(() => null);
      }

      await afterAction();
    }
  });
});
