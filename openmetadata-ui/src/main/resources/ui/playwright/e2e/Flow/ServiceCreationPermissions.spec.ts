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

import { test as base, expect, Page } from '@playwright/test';
import {
  SERVICE_CREATOR_RULES,
  SERVICE_VIEWER_RULES,
} from '../../constant/permission';
import { GlobalSettingOptions } from '../../constant/settings';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { updateDescription } from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';
import { settingClick } from '../../utils/sidebar';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';

const serviceOwnerPolicy = new PolicyClass();
const serviceOwnerRole = new RolesClass();
const serviceViewerPolicy = new PolicyClass();
const serviceViewerRole = new RolesClass();
const serviceOwnerUser = new UserClass();
const anotherUser = new UserClass();
const adminOwnedService = new DatabaseServiceClass(
  `pw-admin-service-${uuid()}`
);

const test = base.extend<{
  serviceOwnerPage: Page;
  anotherUserPage: Page;
}>({
  serviceOwnerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await serviceOwnerUser.login(page);
    await use(page);
    await page.close();
  },
  anotherUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await anotherUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe('Service Creation with isOwner() Permissions', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.slow();

  test.beforeAll('Setup prerequisites', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await serviceOwnerUser.create(apiContext, false);
    await anotherUser.create(apiContext, false);

    // Create policy and role for serviceOwnerUser (can create and manage owned services)
    const creatorPolicyResponse = await serviceOwnerPolicy.create(
      apiContext,
      SERVICE_CREATOR_RULES
    );
    const creatorRoleResponse = await serviceOwnerRole.create(apiContext, [
      creatorPolicyResponse.fullyQualifiedName,
    ]);

    // Create policy and role for anotherUser (view only)
    const viewerPolicyResponse = await serviceViewerPolicy.create(
      apiContext,
      SERVICE_VIEWER_RULES
    );
    const viewerRoleResponse = await serviceViewerRole.create(apiContext, [
      viewerPolicyResponse.fullyQualifiedName,
    ]);

    await serviceOwnerUser.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/roles',
          value: [
            {
              id: creatorRoleResponse.id,
              type: 'role',
              name: creatorRoleResponse.name,
            },
          ],
        },
      ],
    });

    await anotherUser.patch({
      apiContext,
      patchData: [
        {
          op: 'replace',
          path: '/roles',
          value: [
            {
              id: viewerRoleResponse.id,
              type: 'role',
              name: viewerRoleResponse.name,
            },
          ],
        },
      ],
    });

    await adminOwnedService.create(apiContext);

    await afterAction();
  });
  // Needed proper cleanup, while using multiple workers tests might act flaky
  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminOwnedService.delete(apiContext);
    await serviceOwnerRole.delete(apiContext);
    await serviceOwnerPolicy.delete(apiContext);
    await serviceViewerRole.delete(apiContext);
    await serviceViewerPolicy.delete(apiContext);
    await serviceOwnerUser.delete(apiContext);
    await anotherUser.delete(apiContext);

    await afterAction();
  });

  test('User with service creation permission can create a new database service', async ({
    serviceOwnerPage: page,
  }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.DATABASES);

    await expect(page.getByTestId('add-service-button')).toBeVisible();

    await page.getByTestId('add-service-button').click();

    await page.getByTestId('Mysql').click();
    await page.getByTestId('next-button').click();

    const serviceName = `pw-user-owned-service-${uuid()}`;
    await page.getByTestId('service-name').fill(serviceName);
    await page.getByTestId('next-button').click();

    await page.locator('#root\\/username').fill('test_user');
    await page.locator('#root\\/authType\\/password').fill('test_password');
    await page.locator('#root\\/hostPort').fill('localhost:3306');

    await page.getByTestId('submit-btn').click();
    await page.getByTestId('submit-btn').click();

    await expect(page.getByTestId('entity-header-title')).toContainText(
      serviceName
    );

    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button-title').click();
    await page.getByTestId('confirmation-text-input').fill('DELETE');
    await page.getByTestId('confirm-button').click();

    await toastNotification(
      page,
      /(deleted successfully!|Delete operation initiated)/
    );
  });

  test('User can view but cannot modify services they do not own', async ({
    serviceOwnerPage: page,
  }) => {
    await redirectToHomePage(page);

    await adminOwnedService.visitEntityPage(page);

    await expect(page.getByTestId('entity-header-name')).toBeVisible();

    // Manage button is visible but rename/delete options should not be available
    await page.getByTestId('manage-button').click();
    await expect(
      page.getByTestId('manage-dropdown-list-container')
    ).toBeVisible();
    await expect(page.getByTestId('rename-button')).not.toBeVisible();
    await expect(page.getByTestId('delete-button')).not.toBeVisible();
  });

  test('User can update connection details of their own service', async ({
    serviceOwnerPage: page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const userOwnedService = new DatabaseServiceClass(
      `pw-user-connection-test-${uuid()}`
    );
    await userOwnedService.create(apiContext);

    await userOwnedService.patch(apiContext, [
      {
        op: 'add',
        path: '/owners',
        value: [
          {
            id: serviceOwnerUser.responseData.id,
            type: 'user',
          },
        ],
      },
    ]);

    await afterAction();

    await redirectToHomePage(page);
    await visitServiceDetailsPage(
      page,
      {
        name: userOwnedService.entity.name,
        type: GlobalSettingOptions.DATABASES,
      },
      false,
      false
    );

    await page.getByRole('tab', { name: 'Connection' }).click();
    await page.getByTestId('edit-connection-button').click();

    await page.locator('#root\\/username').clear();
    await page.locator('#root\\/username').fill('updated_user');

    const saveResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/services/databaseServices')
    );

    await page.getByTestId('submit-btn').click();
    await page.getByTestId('submit-btn').click();
    await saveResponse;

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await userOwnedService.delete(cleanupContext);
    await cleanupAfterAction();
  });

  test('Different user can view but cannot modify service owned by another user', async ({
    serviceOwnerPage: ownerPage,
    anotherUserPage: otherPage,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const userOwnedService = new DatabaseServiceClass(
      `pw-owner-isolation-test-${uuid()}`
    );
    await userOwnedService.create(apiContext);

    await userOwnedService.patch(apiContext, [
      {
        op: 'add',
        path: '/owners',
        value: [
          {
            id: serviceOwnerUser.responseData.id,
            type: 'user',
          },
        ],
      },
    ]);

    await afterAction();

    await redirectToHomePage(ownerPage);
    await visitServiceDetailsPage(
      ownerPage,
      {
        name: userOwnedService.entity.name,
        type: GlobalSettingOptions.DATABASES,
      },
      false
    );

    await expect(ownerPage.getByTestId('entity-header-name')).toBeVisible();
    await expect(ownerPage.getByTestId('manage-button')).toBeVisible();

    await redirectToHomePage(otherPage);
    await userOwnedService.visitEntityPage(otherPage);

    await expect(otherPage.getByTestId('entity-header-name')).toBeVisible();

    // Manage button is visible but rename/delete options should not be available for non-owner
    await otherPage.getByTestId('manage-button').click();
    await expect(
      otherPage.getByTestId('manage-dropdown-list-container')
    ).toBeVisible();
    await expect(otherPage.getByTestId('rename-button')).not.toBeVisible();
    await expect(otherPage.getByTestId('delete-button')).not.toBeVisible();

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await userOwnedService.delete(cleanupContext);
    await cleanupAfterAction();
  });

  test('Owner can delete their own service', async ({
    serviceOwnerPage: page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const serviceToDelete = new DatabaseServiceClass(
      `pw-delete-test-${uuid()}`
    );
    await serviceToDelete.create(apiContext);

    await serviceToDelete.patch(apiContext, [
      {
        op: 'add',
        path: '/owners',
        value: [
          {
            id: serviceOwnerUser.responseData.id,
            type: 'user',
          },
        ],
      },
    ]);

    await afterAction();

    await redirectToHomePage(page);
    await visitServiceDetailsPage(
      page,
      {
        name: serviceToDelete.entity.name,
        type: GlobalSettingOptions.DATABASES,
      },
      false
    );

    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button-title').click();
    await page.getByTestId('confirmation-text-input').fill('DELETE');

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/services/databaseServices') &&
        response.request().method() === 'DELETE'
    );

    await page.getByTestId('confirm-button').click();

    await deleteResponse;

    await toastNotification(
      page,
      /(deleted successfully!|Delete operation initiated)/
    );
  });

  test('Owner can update description of their service', async ({
    serviceOwnerPage: page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const serviceToUpdate = new DatabaseServiceClass(
      `pw-description-test-${uuid()}`
    );
    await serviceToUpdate.create(apiContext);

    await serviceToUpdate.patch(apiContext, [
      {
        op: 'add',
        path: '/owners',
        value: [
          {
            id: serviceOwnerUser.responseData.id,
            type: 'user',
          },
        ],
      },
    ]);

    await afterAction();

    await redirectToHomePage(page);
    await visitServiceDetailsPage(
      page,
      {
        name: serviceToUpdate.entity.name,
        type: GlobalSettingOptions.DATABASES,
      },
      false
    );

    await updateDescription(page, 'Updated service description');

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await serviceToUpdate.delete(cleanupContext);
    await cleanupAfterAction();
  });
});
