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
import { DATA_CONSUMER_RULES } from '../../../constant/permission';
import {
  PolicyClass,
  PolicyRulesType,
} from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/isolatedUser';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import { fillDeleteConfirmationIfPresent } from '../../../utils/entity';
import { setupTestCaseWithFailedRows } from '../../../utils/testCases';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

type Grant = 'editAllOnly' | 'deleteSampleOnly';

// DELETE …/failedRowsSample authorizes DeleteTestCaseFailedRowsSample, which
// EditAll does not subsume (ADR:2026-11-22-deleting-a-failed-rows-sample-is-its-own-grant).
const testCaseGrant = (operation: string): PolicyRulesType[] => [
  ...DATA_CONSUMER_RULES,
  {
    name: `pw-test-case-${operation}-${uuid()}`,
    resources: ['testCase'],
    operations: [operation],
    effect: 'allow',
  },
];

// Rebuilt at the top of beforeAll: under fullyParallel the hook can run more than once per worker.
let roles: Record<Grant, { policy: PolicyClass; role: RolesClass }>;

const assignOnlyRole = async (user: UserClass, role: RolesClass) => {
  const apiContext = await getWorkerAdminAPIContext();
  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: role.responseData.id,
            type: 'role',
            name: role.responseData.name,
          },
        ],
      },
    ],
  });
};

/** A table with one Failed test case that holds a failed-rows sample. */
const createFailedTestCaseWithSample = async () => {
  const apiContext = await getWorkerAdminAPIContext();
  const table = new TableClass();
  await table.create(apiContext);
  await table.createTestCase(apiContext);
  await setupTestCaseWithFailedRows(apiContext, table);

  return table;
};

/** Opens the test case results once its entity-level permissions have been served. */
const openTestCaseResults = async (page: Page, table: TableClass) => {
  const testCaseFqn = table.testCasesResponseData[0].fullyQualifiedName ?? '';
  const testCasePermission = waitForResponseWithStatus(
    page,
    (response) =>
      new URL(response.url()).pathname.startsWith(
        '/api/v1/permissions/testCase/name/'
      ),
    200
  );
  await page.goto(`/test-case/${encodeURIComponent(testCaseFqn)}`);
  await testCasePermission;

  // The sample must be on screen, or a hidden Delete would pass vacuously.
  await expect(page.getByTestId('sample-data-table')).toBeVisible();
};

const deleteFailedRowsSample = async (page: Page) => {
  await page.getByTestId('sample-data-manage-button').click();
  await page.getByTestId('delete-button').click();
  await fillDeleteConfirmationIfPresent(page);
  const deleteResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().includes('/failedRowsSample'),
    200
  );
  await page.getByTestId('confirm-button').click();
  await deleteResponse;

  await expect(page.getByTestId('sample-data-table')).toBeHidden();
};

test.describe(
  'Failed rows sample Delete follows DeleteTestCaseFailedRowsSample',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    test.beforeAll('Create the test case roles', async ({ browser }) => {
      roles = {} as typeof roles;
      const grants: Record<Grant, PolicyRulesType[]> = {
        editAllOnly: testCaseGrant('EditAll'),
        deleteSampleOnly: testCaseGrant('DeleteTestCaseFailedRowsSample'),
      };
      const { apiContext, afterAction } = await performAdminLogin(browser);

      for (const [grant, rules] of Object.entries(grants)) {
        const policy = new PolicyClass();
        const role = new RolesClass();
        await policy.create(apiContext, rules);
        await role.create(apiContext, [policy.responseData.name]);
        roles[grant as Grant] = { policy, role };
      }

      await afterAction();
    });

    test.afterAll('Delete the test case roles', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      for (const { policy, role } of Object.values(roles)) {
        await role.delete(apiContext);
        await policy.delete(apiContext);
      }

      await afterAction();
    });

    test('hides sample Delete from a user whose role grants only EditAll on test cases', async ({
      freshUserPage: { page, user },
    }) => {
      const table = await createFailedTestCaseWithSample();

      try {
        await assignOnlyRole(user, roles.editAllOnly.role);
        await openTestCaseResults(page, table);
        // The EditAll grant shows the parameter edit button from the same test case
        // permission that gates Delete, so the absence below is checked once it applied.
        await expect(page.getByTestId('edit-parameter-icon')).toBeVisible();

        await expect(page.getByTestId('sample-data-manage-button')).toHaveCount(
          0
        );
      } finally {
        await table.delete(await getWorkerAdminAPIContext());
      }
    });

    test('lets the table owner delete the failed-rows sample', async ({
      freshUserPage: { page, user },
    }) => {
      const table = await createFailedTestCaseWithSample();

      try {
        await table.setOwner(await getWorkerAdminAPIContext(), {
          id: user.responseData.id,
          type: 'user',
        });
        await openTestCaseResults(page, table);

        await deleteFailedRowsSample(page);
      } finally {
        await table.delete(await getWorkerAdminAPIContext());
      }
    });

    test('lets a user granted only DeleteTestCaseFailedRowsSample delete the sample', async ({
      freshUserPage: { page, user },
    }) => {
      const table = await createFailedTestCaseWithSample();

      try {
        await assignOnlyRole(user, roles.deleteSampleOnly.role);
        await openTestCaseResults(page, table);

        await deleteFailedRowsSample(page);
      } finally {
        await table.delete(await getWorkerAdminAPIContext());
      }
    });
  }
);
