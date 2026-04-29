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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';

test.describe('Data Access Request - End to End', () => {
  const adminUser = new UserClass();
  const reviewer = new UserClass();
  const requester = new UserClass();
  const table = new TableClass();
  let createdTaskId: string | undefined;

  test.beforeAll('Create users and a Table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await reviewer.create(apiContext);
    await requester.create(apiContext);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    if (createdTaskId) {
      await apiContext.delete(`/api/v1/tasks/${createdTaskId}?hardDelete=true`);
    }
    await table.delete(apiContext);
    await adminUser.delete(apiContext);
    await reviewer.delete(apiContext);
    await requester.delete(apiContext);
    await afterAction();
  });

  test('Create + Approve + Revoke DAR via API', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const tableFqn = table.entityResponseData.fullyQualifiedName as string;

    const createResponse = await apiContext.post('/api/v1/tasks', {
      data: {
        name: `dar-${uuid()}`,
        about: tableFqn,
        aboutType: 'table',
        category: 'DataAccess',
        type: 'DataAccessRequest',
        priority: 'Medium',
        reviewers: [reviewer.responseData.fullyQualifiedName],
        payload: {
          accessType: 'FullAccess',
          requestedAccess: 'Read',
          reason: 'Need access for Q4 analysis',
          duration: 'P14D',
        },
      },
    });
    expect(createResponse.ok()).toBe(true);
    const created = await createResponse.json();
    createdTaskId = created.id;

    expect(created.category).toBe('DataAccess');
    expect(created.type).toBe('DataAccessRequest');
    expect(created.payload.accessType).toBe('FullAccess');
    expect(created.status).toBe('Open');

    const approveResponse = await apiContext.post(
      `/api/v1/tasks/${created.id}/resolve`,
      {
        data: { transitionId: 'approve', resolutionType: 'Approved' },
      }
    );
    expect(approveResponse.ok()).toBe(true);
    const approved = await approveResponse.json();
    expect(approved.status).toBe('Approved');
    expect(approved.resolution?.type).toBe('Approved');

    const refreshed = await apiContext.get(`/api/v1/tasks/${created.id}`);
    const detail = await refreshed.json();
    const revokeAvailable = (detail.availableTransitions ?? []).some(
      (t: { id: string }) => t.id === 'revoke'
    );
    expect(revokeAvailable).toBe(true);

    const revokeResponse = await apiContext.post(
      `/api/v1/tasks/${created.id}/resolve`,
      {
        data: {
          transitionId: 'revoke',
          resolutionType: 'Revoked',
          comment: 'Project completed; access no longer needed',
        },
      }
    );
    expect(revokeResponse.ok()).toBe(true);
    const revoked = await revokeResponse.json();
    expect(revoked.status).toBe('Revoked');
    expect(revoked.resolution?.type).toBe('Revoked');

    await afterAction();
  });

  test('Create + Reject DAR via API', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const tableFqn = table.entityResponseData.fullyQualifiedName as string;

    const createResponse = await apiContext.post('/api/v1/tasks', {
      data: {
        name: `dar-reject-${uuid()}`,
        about: tableFqn,
        aboutType: 'table',
        category: 'DataAccess',
        type: 'DataAccessRequest',
        priority: 'Medium',
        reviewers: [reviewer.responseData.fullyQualifiedName],
        payload: {
          accessType: 'ColumnLevel',
          requestedAccess: 'Read',
          reason: 'Limited dashboard view',
          columns: [`${tableFqn}.email`, `${tableFqn}.name`],
        },
      },
    });
    expect(createResponse.ok()).toBe(true);
    const created = await createResponse.json();
    expect(created.payload.columns).toHaveLength(2);
    expect(created.payload.accessType).toBe('ColumnLevel');

    const rejectResponse = await apiContext.post(
      `/api/v1/tasks/${created.id}/resolve`,
      {
        data: {
          transitionId: 'reject',
          resolutionType: 'Rejected',
          comment: 'Insufficient justification',
        },
      }
    );
    expect(rejectResponse.ok()).toBe(true);
    const rejected = await rejectResponse.json();
    expect(rejected.status).toBe('Rejected');

    await apiContext.delete(`/api/v1/tasks/${created.id}?hardDelete=true`);
    await afterAction();
  });

  test('Validation rejects DAR with missing accessType', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const tableFqn = table.entityResponseData.fullyQualifiedName as string;

    const response = await apiContext.post('/api/v1/tasks', {
      data: {
        name: `dar-invalid-${uuid()}`,
        about: tableFqn,
        aboutType: 'table',
        category: 'DataAccess',
        type: 'DataAccessRequest',
        payload: {
          reason: 'Missing accessType field',
        },
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);

    await afterAction();
  });
});
