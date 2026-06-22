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
import { expect, Page, test as base } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  assignDomainOnlyAccess,
  assignDomainToTable,
  safeDelete,
} from './domainIsolationUtils';

// Issue #24180 — a user holding the seeded DomainOnlyAccessRole must only see tasks about entities
// in their accessible domains. Task isolation is role-based (EntityUtil.addDomainQueryParam +
// TaskRepository.applyTaskDomainFilter on /v1/tasks), so it does not depend on enableAccessControl.
const adminUser = new UserClass();
const userA = new UserClass();
const userB = new UserClass();
const tenantA = new Domain();
const tenantB = new Domain();
const tableA = new TableClass();
const tableB = new TableClass();

const test = base.extend<{
  adminPage: Page;
  userAPage: Page;
  userBPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await adminUser.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  userAPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await userA.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
  userBPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    try {
      await userB.login(page);
      await use(page);
    } finally {
      await page.close();
    }
  },
});

const fqnOf = (table: TableClass) =>
  table.entityResponseData?.fullyQualifiedName ?? '';

/**
 * Lands on the home page (which renders the "My Tasks" feed widget), captures the `/api/v1/tasks`
 * list response the widget fires, and returns the FQNs referenced by the returned tasks.
 */
const taskAboutFqns = async (page: Page): Promise<string> => {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/tasks') &&
      response.request().method() === 'GET'
  );
  await redirectToHomePage(page);
  const response = await responsePromise;

  return JSON.stringify(await response.json());
};

test.describe('Domain isolation - tasks @domain-isolation', () => {
  test.slow(true);

  test.beforeAll(
    'Setup domains, tables, tasks, users and role binding',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await userA.create(apiContext);
        await userB.create(apiContext);

        await tenantA.create(apiContext);
        await tenantB.create(apiContext);
        await tableA.create(apiContext);
        await tableB.create(apiContext);
        await assignDomainToTable(
          apiContext,
          tableA.entityResponseData?.id ?? '',
          tenantA
        );
        await assignDomainToTable(
          apiContext,
          tableB.entityResponseData?.id ?? '',
          tenantB
        );

        // Both tasks are assigned to both users so the only thing that can hide a task from a user
        // is the domain filter, not assignment.
        const assignees = [userA.responseData.name, userB.responseData.name];
        for (const [table, label] of [
          [tableA, 'A'],
          [tableB, 'B'],
        ] as [TableClass, string][]) {
          await apiContext.post('/api/v1/tasks', {
            data: {
              name: `pw-domain-task-${label}`,
              about: `<#E::table::${fqnOf(table)}>`,
              type: 'DescriptionUpdate',
              category: 'MetadataUpdate',
              assignees,
            },
          });
        }

        await assignDomainOnlyAccess(apiContext, userA, [tenantA]);
        await assignDomainOnlyAccess(apiContext, userB, [tenantB]);
      } finally {
        await afterAction();
      }
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await safeDelete(() => tableA.delete(apiContext));
      await safeDelete(() => tableB.delete(apiContext));
      await safeDelete(() => tenantA.delete(apiContext));
      await safeDelete(() => tenantB.delete(apiContext));
      await safeDelete(() => userA.delete(apiContext));
      await safeDelete(() => userB.delete(apiContext));
      await safeDelete(() => adminUser.delete(apiContext));
    } finally {
      await afterAction();
    }
  });

  test('userA sees only their own-domain task', async ({ userAPage }) => {
    const tasks = await taskAboutFqns(userAPage);

    expect(tasks).toContain(fqnOf(tableA));
    expect(tasks).not.toContain(fqnOf(tableB));
  });

  test('userB sees only their own-domain task', async ({ userBPage }) => {
    const tasks = await taskAboutFqns(userBPage);

    expect(tasks).toContain(fqnOf(tableB));
    expect(tasks).not.toContain(fqnOf(tableA));
  });

  test('admin sees tasks from both domains', async ({ adminPage }) => {
    const tasks = await taskAboutFqns(adminPage);

    expect(tasks).toContain(fqnOf(tableA));
    expect(tasks).toContain(fqnOf(tableB));
  });
});
