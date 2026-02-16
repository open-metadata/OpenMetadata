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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';

/**
 * Task Suggestion API Tests
 *
 * Tests the new suggestion-specific task APIs including:
 * - PUT /api/v1/tasks/{id}/suggestion/apply - Apply a suggestion task
 * - POST /api/v1/tasks/bulk - Bulk operations on tasks
 */

test.describe('Task Suggestion APIs', () => {
  const adminUser = new UserClass();
  const ownerUser = new UserClass();
  const table = new TableClass();

  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await ownerUser.create(apiContext);

      await table.create(apiContext);

      await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: ownerUser.responseData.id, type: 'user' }],
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await table.delete(apiContext);
      await ownerUser.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should apply suggestion via PUT /api/v1/tasks/{id}/suggestion/apply', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const suggestedDescription = 'AI-generated description for table';

    try {
      // Create a Suggestion task with SuggestionPayload
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'Suggestion',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestionType: 'Description',
            fieldPath: 'description',
            suggestedValue: suggestedDescription,
            source: 'Agent',
            confidence: 85,
            reasoning: 'Generated from column statistics',
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);
      expect(task.type).toBe('Suggestion');

      // Apply the suggestion using the new endpoint
      const applyResponse = await apiContext.put(
        `/api/v1/tasks/${task.id}/suggestion/apply?comment=Looks good`
      );
      expect(applyResponse.ok()).toBe(true);

      const appliedTask = await applyResponse.json();
      expect(appliedTask.status).toBe('Approved');

      // Verify the description was applied to the table
      const tableResponse = await apiContext.get(
        `/api/v1/tables/${table.entityResponseData?.id}`
      );
      const updatedTable = await tableResponse.json();
      expect(updatedTable.description).toBe(suggestedDescription);
    } finally {
      await afterAction();
    }
  });

  test('should reject non-suggestion task via apply endpoint', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create a regular DescriptionUpdate task (not a Suggestion)
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestedValue: 'New description',
          },
        },
      });
      const task = await taskResponse.json();
      expect(taskResponse.ok()).toBe(true);

      // Try to apply via suggestion endpoint - should fail
      const applyResponse = await apiContext.put(
        `/api/v1/tasks/${task.id}/suggestion/apply`
      );
      expect(applyResponse.ok()).toBe(false);
      expect(applyResponse.status()).toBe(400);
    } finally {
      await afterAction();
    }
  });

  test('should perform bulk approve on multiple tasks', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create multiple suggestion tasks
      const task1Response = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'Suggestion',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestionType: 'Description',
            fieldPath: `columns::${table.entityResponseData?.columns?.[0]?.name}::description`,
            suggestedValue: 'Column 1 description',
            source: 'Agent',
            confidence: 90,
          },
        },
      });
      const task1 = await task1Response.json();

      const task2Response = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'Suggestion',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestionType: 'Description',
            fieldPath: `columns::${table.entityResponseData?.columns?.[1]?.name}::description`,
            suggestedValue: 'Column 2 description',
            source: 'Agent',
            confidence: 88,
          },
        },
      });
      const task2 = await task2Response.json();

      // Bulk approve both tasks
      const bulkResponse = await apiContext.post('/api/v1/tasks/bulk', {
        data: {
          taskIds: [task1.id, task2.id],
          operation: 'Approve',
          params: {
            comment: 'Bulk approving suggestions',
          },
        },
      });
      expect(bulkResponse.ok()).toBe(true);

      const bulkResult = await bulkResponse.json();
      expect(bulkResult.totalRequested).toBe(2);
      expect(bulkResult.successful).toBe(2);
      expect(bulkResult.failed).toBe(0);
      expect(bulkResult.results).toHaveLength(2);
      expect(bulkResult.results[0].status).toBe('success');
      expect(bulkResult.results[1].status).toBe('success');

      // Verify tasks were approved
      const verifyTask1 = await apiContext.get(`/api/v1/tasks/${task1.id}`);
      const task1Data = await verifyTask1.json();
      expect(task1Data.status).toBe('Approved');

      const verifyTask2 = await apiContext.get(`/api/v1/tasks/${task2.id}`);
      const task2Data = await verifyTask2.json();
      expect(task2Data.status).toBe('Approved');
    } finally {
      await afterAction();
    }
  });

  test('should perform bulk reject on multiple tasks', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create multiple suggestion tasks
      const task1Response = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'Suggestion',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestionType: 'Description',
            fieldPath: 'description',
            suggestedValue: 'Bad suggestion 1',
            source: 'Agent',
            confidence: 30,
          },
        },
      });
      const task1 = await task1Response.json();

      const task2Response = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'Suggestion',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestionType: 'Description',
            fieldPath: 'description',
            suggestedValue: 'Bad suggestion 2',
            source: 'Agent',
            confidence: 25,
          },
        },
      });
      const task2 = await task2Response.json();

      // Bulk reject both tasks
      const bulkResponse = await apiContext.post('/api/v1/tasks/bulk', {
        data: {
          taskIds: [task1.id, task2.id],
          operation: 'Reject',
          params: {
            comment: 'Low confidence suggestions - rejecting',
          },
        },
      });
      expect(bulkResponse.ok()).toBe(true);

      const bulkResult = await bulkResponse.json();
      expect(bulkResult.successful).toBe(2);

      // Verify tasks were rejected
      const verifyTask1 = await apiContext.get(`/api/v1/tasks/${task1.id}`);
      const task1Data = await verifyTask1.json();
      expect(task1Data.status).toBe('Rejected');
    } finally {
      await afterAction();
    }
  });

  test('should perform bulk assign operation', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create a new user to assign to
      const newAssignee = new UserClass();
      await newAssignee.create(apiContext);

      // Create tasks
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            newDescription: 'New description',
          },
        },
      });
      const task = await taskResponse.json();

      // Bulk assign to new user
      const bulkResponse = await apiContext.post('/api/v1/tasks/bulk', {
        data: {
          taskIds: [task.id],
          operation: 'Assign',
          params: {
            assignees: [newAssignee.responseData.name],
          },
        },
      });
      const bulkResult = await bulkResponse.json();
      expect(bulkResponse.ok()).toBe(true);

      // Check if all operations succeeded
      expect(bulkResult.successful).toBe(1);

      // Verify task was reassigned
      const verifyTask = await apiContext.get(
        `/api/v1/tasks/${task.id}?fields=assignees`
      );
      const taskData = await verifyTask.json();
      expect(taskData.assignees).toBeDefined();
      expect(taskData.assignees.some((a: { name: string }) => a.name === newAssignee.responseData.name)).toBe(true);

      // Cleanup
      await newAssignee.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('should perform bulk cancel operation', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create tasks
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestedValue: 'Description to cancel',
          },
        },
      });
      const task = await taskResponse.json();

      // Bulk cancel
      const bulkResponse = await apiContext.post('/api/v1/tasks/bulk', {
        data: {
          taskIds: [task.id],
          operation: 'Cancel',
          params: {
            comment: 'No longer needed',
          },
        },
      });
      expect(bulkResponse.ok()).toBe(true);

      // Verify task was cancelled
      const verifyTask = await apiContext.get(`/api/v1/tasks/${task.id}`);
      const taskData = await verifyTask.json();
      expect(taskData.status).toBe('Cancelled');
    } finally {
      await afterAction();
    }
  });

  test('should handle partial failures in bulk operations', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Create one valid task
      const taskResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: table.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: [ownerUser.responseData.name],
          payload: {
            suggestedValue: 'Valid task description',
          },
        },
      });
      const validTask = await taskResponse.json();

      // Bulk operation with one valid and one invalid task ID
      const bulkResponse = await apiContext.post('/api/v1/tasks/bulk', {
        data: {
          taskIds: [validTask.id, '00000000-0000-0000-0000-000000000000'],
          operation: 'Approve',
        },
      });
      expect(bulkResponse.ok()).toBe(true);

      const bulkResult = await bulkResponse.json();
      expect(bulkResult.totalRequested).toBe(2);
      expect(bulkResult.successful).toBe(1);
      expect(bulkResult.failed).toBe(1);

      // Check that first task succeeded and second failed
      const successResult = bulkResult.results.find(
        (r: { taskId: string }) => r.taskId === validTask.id
      );
      const failedResult = bulkResult.results.find(
        (r: { taskId: string }) => r.taskId === '00000000-0000-0000-0000-000000000000'
      );

      expect(successResult?.status).toBe('success');
      expect(failedResult?.status).toBe('failed');
      expect(failedResult?.error).toBeDefined();
    } finally {
      await afterAction();
    }
  });
});
