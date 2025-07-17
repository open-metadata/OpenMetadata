/*
 *  Copyright 2024 Collate.
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
import { DATA_CONSUMER_RULES } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  getAllResources,
  getEntityClass,
  getEntityResources,
  getOperationConfig,
  getResourceOperations,
  hasEntityClass,
  SPECIAL_RESOURCE_CONFIG,
} from '../../utils/resourcePermissionConfig';

const adminUser = new UserClass();
const testUser = new UserClass();

const createdEntities: any[] = [];

const test = base.extend<{
  page: Page;
  testUserPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  testUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await testUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await testUser.create(apiContext);

  // Automatically create entities for all entity resources
  const entityResources = getEntityResources();
  for (const resourceName of entityResources) {
    if (hasEntityClass(resourceName)) {
      const entityClass = getEntityClass(resourceName);
      const entity = new entityClass();
      await entity.create(apiContext);
      createdEntities.push({ name: resourceName, entity });
    }
  }

  await afterAction();
});

const testResourceOperationPermissions = async (
  page: Page,
  testUserPage: Page,
  resourceName: string,
  operation: string,
  effect: 'allow' | 'deny',
  expectedVisibility: boolean
) => {
  await redirectToHomePage(page);
  const { apiContext } = await getApiContext(page);

  // Get operation configuration
  const operationConfig = getOperationConfig(resourceName, operation);
  if (!operationConfig) {
    return;
  }

  // Create policy
  const policy = new PolicyClass();
  await policy.create(apiContext, [
    ...DATA_CONSUMER_RULES,
    {
      name: `${resourceName}${effect}${operation}Policy`,
      resources: [resourceName],
      operations: [operation],
      effect,
    },
  ]);

  // Create role and assign to user
  const role = new RolesClass();
  await role.create(apiContext, [policy.responseData.name]);

  await testUser.patch({
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

  // Navigate to the resource page
  await redirectToHomePage(testUserPage);

  if (hasEntityClass(resourceName)) {
    // For entity resources, visit the created entity
    const entity = createdEntities.find((e) => e.name === resourceName)?.entity;
    if (entity) {
      await entity.visitEntityPage(testUserPage);
    }
  } else {
    // For special resources, navigate to the page path
    const specialConfig = SPECIAL_RESOURCE_CONFIG[resourceName];
    if (specialConfig?.pagePath) {
      await testUserPage.goto(specialConfig.pagePath);
    }
  }

  // Check visibility based on expected result
  if (expectedVisibility) {
    await expect(
      testUserPage.locator(`[data-testid="${operationConfig.testId}"]`)
    ).toBeVisible();
  } else {
    await expect(
      testUserPage.locator(`[data-testid="${operationConfig.testId}"]`)
    ).not.toBeVisible();
  }

  const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
    await getApiContext(page);
  await role.delete(cleanupContext);
  await policy.delete(cleanupContext);
  await cleanupAfterAction();
};

// Helper function to test deny override (when both allow and deny rules exist)
const testDenyOverride = async (
  page: Page,
  testUserPage: Page,
  resourceName: string,
  operation: string
) => {
  await redirectToHomePage(page);
  const { apiContext } = await getApiContext(page);

  const operationConfig = getOperationConfig(resourceName, operation);
  if (!operationConfig) {
    return;
  }

  // Create policy with both allow and deny rules (deny should override)
  const overridePolicy = new PolicyClass();
  await overridePolicy.create(apiContext, [
    {
      name: `${resourceName}Allow${operation}Policy`,
      resources: [resourceName],
      operations: ['ViewAll', operation],
      effect: 'allow',
    },
    {
      name: `${resourceName}Deny${operation}Policy`,
      resources: [resourceName],
      operations: [operation],
      effect: 'deny',
    },
  ]);

  // Create role and assign to user
  const overrideRole = new RolesClass();
  await overrideRole.create(apiContext, [overridePolicy.responseData.name]);

  await testUser.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: overrideRole.responseData.id,
            type: 'role',
            name: overrideRole.responseData.name,
          },
        ],
      },
    ],
  });

  // Navigate to the resource page
  await redirectToHomePage(testUserPage);

  if (hasEntityClass(resourceName)) {
    const entity = createdEntities.find((e) => e.name === resourceName)?.entity;
    if (entity) {
      await entity.visitEntityPage(testUserPage);
    }
  } else {
    const specialConfig = SPECIAL_RESOURCE_CONFIG[resourceName];
    if (specialConfig?.pagePath) {
      await testUserPage.goto(specialConfig.pagePath);
    }
  }

  // Check that operation is NOT visible (deny overrides allow)
  await expect(
    testUserPage.locator(`[data-testid="${operationConfig.testId}"]`)
  ).not.toBeVisible();

  const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
    await getApiContext(page);
  await overrideRole.delete(cleanupContext);
  await overridePolicy.delete(cleanupContext);
  await cleanupAfterAction();
};

test.describe(' All Resources and Operations', () => {
  // Test 1: Allow all operations for all resources
  test('Should allow all operations for all resources when explicitly allowed', async ({
    page,
    testUserPage,
  }) => {
    const allResources = getAllResources();

    for (const resourceName of allResources) {
      const operations = getResourceOperations(resourceName);

      for (const operation of operations) {
        await testResourceOperationPermissions(
          page,
          testUserPage,
          resourceName,
          operation,
          'allow',
          true // Should be visible when allowed
        );
      }
    }
  });

  // Test 2: Deny override (deny should override allow)
  test('Should deny override allow for all operations and resources', async ({
    page,
    testUserPage,
  }) => {
    const allResources = getAllResources();

    for (const resourceName of allResources) {
      const operations = getResourceOperations(resourceName);

      for (const operation of operations) {
        await testDenyOverride(page, testUserPage, resourceName, operation);
      }
    }
  });
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await testUser.delete(apiContext);

  for (const { entity } of createdEntities) {
    await entity.delete(apiContext);
  }

  await afterAction();
});
