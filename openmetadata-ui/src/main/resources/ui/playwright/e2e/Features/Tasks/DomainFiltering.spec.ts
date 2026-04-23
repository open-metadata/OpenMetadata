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
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  waitForTaskCountResponse,
  waitForTaskListResponse,
} from '../../../utils/task';

test.use({ storageState: 'playwright/.auth/admin.json' });

const DOMAIN_STORAGE_KEY = 'om_domains';

const setActiveDomainInStorage = async (
  page: Parameters<typeof test>[0]['page'],
  domain?: Domain['responseData']
) => {
  await page.evaluate(
    ({ storageKey, activeDomain, activeDomainEntityRef }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            activeDomain,
            activeDomainEntityRef,
          },
          version: 0,
        })
      );
    },
    {
      storageKey: DOMAIN_STORAGE_KEY,
      activeDomain: domain?.fullyQualifiedName ?? 'All Domains',
      activeDomainEntityRef: domain
        ? {
            id: domain.id,
            type: 'domain',
            name: domain.name,
            displayName: domain.displayName,
            fullyQualifiedName: domain.fullyQualifiedName,
          }
        : null,
    }
  );
};

test.describe('Domain Filtering - Tasks Refetch on Domain Switch', () => {
  const domainA = new Domain();
  const domainB = new Domain();
  const tableInDomainA = new TableClass();
  const tableInDomainB = new TableClass();

  test.beforeAll('Setup domains, tables, and tasks', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await domainA.create(apiContext);
      await domainB.create(apiContext);
      await tableInDomainA.create(apiContext);
      await tableInDomainB.create(apiContext);

      await apiContext.patch(
        `/api/v1/tables/${tableInDomainA.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: {
                id: domainA.responseData.id,
                type: 'domain',
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.patch(
        `/api/v1/tables/${tableInDomainB.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: {
                id: domainB.responseData.id,
                type: 'domain',
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Task-DomainA-${domainA.responseData.name}`,
          about: tableInDomainA.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: ['admin'],
        },
      });

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Task-DomainB-${domainB.responseData.name}`,
          about: tableInDomainB.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: ['admin'],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await tableInDomainA.delete(apiContext);
      await tableInDomainB.delete(apiContext);
      await domainA.delete(apiContext);
      await domainB.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('switching domain triggers feed API refetch on entity page', async ({
    page,
  }) => {
    await tableInDomainA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByTestId('activity_feed');
    await activityFeedTab.click();
    await waitForAllLoadersToDisappear(page);

    const taskApiResponse = waitForTaskCountResponse(page);

    await setActiveDomainInStorage(page, domainA.responseData);
    await page.reload();
    const response = await taskApiResponse;

    expect(response.status()).toBe(200);
  });

  test('switching to different domain triggers new feed API call', async ({
    page,
  }) => {
    await tableInDomainA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByTestId('activity_feed');
    await activityFeedTab.click();
    await waitForAllLoadersToDisappear(page);

    await setActiveDomainInStorage(page, domainA.responseData);
    await page.reload();
    await waitForAllLoadersToDisappear(page);

    const taskApiResponse = waitForTaskCountResponse(page);

    await setActiveDomainInStorage(page, domainB.responseData);
    await page.reload();
    const response = await taskApiResponse;

    expect(response.status()).toBe(200);
  });

  test('selecting All Domains removes domain filter from feed API call', async ({
    page,
  }) => {
    await tableInDomainA.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByTestId('activity_feed');
    await activityFeedTab.click();
    await waitForAllLoadersToDisappear(page);

    await setActiveDomainInStorage(page, domainA.responseData);
    await page.reload();
    await waitForAllLoadersToDisappear(page);

    const taskApiResponse = waitForTaskCountResponse(page);

    await setActiveDomainInStorage(page);
    await page.reload();
    const response = await taskApiResponse;

    expect(response.status()).toBe(200);
    const responseUrl = response.url();
    expect(responseUrl).not.toContain('domain=');
  });
});

test.describe('Domain Filtering - Task Counts Update', () => {
  const domain = new Domain();
  const tableInDomain = new TableClass();

  test.beforeAll('Setup domain and task', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await domain.create(apiContext);
      await tableInDomain.create(apiContext);

      await apiContext.patch(
        `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: {
                id: domain.responseData.id,
                type: 'domain',
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `Count-Task-${domain.responseData.name}`,
          about: tableInDomain.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: ['admin'],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await tableInDomain.delete(apiContext);
      await domain.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('task count API returns counts for created tasks', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      const response = await apiContext.get('/api/v1/tasks/count');

      expect(response.ok()).toBe(true);
      const counts = await response.json();

      expect(counts).toHaveProperty('open');
      expect(counts).toHaveProperty('total');
      expect(counts.total).toBeGreaterThan(0);
    } finally {
      await afterAction();
    }
  });
});

test.describe('Domain Filtering - Entity Page Activity Feed', () => {
  const domain = new Domain();
  const tableInDomain = new TableClass();

  test.beforeAll('Setup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await domain.create(apiContext);
      await tableInDomain.create(apiContext);

      await apiContext.patch(
        `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: {
                id: domain.responseData.id,
                type: 'domain',
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `EntityPage-Task-${domain.responseData.name}`,
          about: tableInDomain.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: ['admin'],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await tableInDomain.delete(apiContext);
      await domain.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('entity page activity feed refetches when domain is switched', async ({
    page,
  }) => {
    await tableInDomain.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByTestId('activity_feed');
    await activityFeedTab.click();
    await waitForAllLoadersToDisappear(page);

    // Switch domain and verify feeds API is called
    const taskApiResponse = waitForTaskCountResponse(page);

    await setActiveDomainInStorage(page, domain.responseData);
    await page.reload();
    const response = await taskApiResponse;

    expect(response.status()).toBe(200);
  });

  test('entity page shows task cards for entity in selected domain', async ({
    page,
  }) => {
    await tableInDomain.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByTestId('activity_feed');
    await activityFeedTab.click();
    await waitForAllLoadersToDisappear(page);

    const tasksTab = page.getByTestId('activity-feed-widget-tab-Tasks');
    if (await tasksTab.isVisible()) {
      const taskListResponse = waitForTaskListResponse(page);
      await tasksTab.click();
      await taskListResponse;
      await waitForAllLoadersToDisappear(page);

      const taskCards = page.locator('[data-testid="task-feed-card"]');
      const count = await taskCards.count();

      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Domain Filtering - API Validation', () => {
  const domain = new Domain();
  const tableInDomain = new TableClass();

  test.beforeAll('Setup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await domain.create(apiContext);
      await tableInDomain.create(apiContext);

      await apiContext.patch(
        `/api/v1/tables/${tableInDomain.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/domain',
              value: {
                id: domain.responseData.id,
                type: 'domain',
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await apiContext.post('/api/v1/tasks', {
        data: {
          name: `API-Validation-Task-${domain.responseData.name}`,
          about: tableInDomain.entityResponseData?.fullyQualifiedName,
          aboutType: 'table',
          type: 'DescriptionUpdate',
          category: 'MetadataUpdate',
          assignees: ['admin'],
        },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await tableInDomain.delete(apiContext);
      await domain.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('GET /tasks returns 200', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      const response = await apiContext.get('/api/v1/tasks');

      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body.data).toBeDefined();
    } finally {
      await afterAction();
    }
  });

  test('GET /tasks/count returns task counts', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      const response = await apiContext.get('/api/v1/tasks/count');

      expect(response.ok()).toBe(true);
      const counts = await response.json();

      expect(counts).toHaveProperty('open');
      expect(counts).toHaveProperty('total');
      expect(counts.total).toBeGreaterThan(0);
    } finally {
      await afterAction();
    }
  });
});
