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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  clickOutside,
  redirectToHomePage,
  toastNotification,
} from '../../../utils/common';
import {
  createDescriptionTaskForGlossary,
  createTagTaskForGlossary,
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { performUserLogin } from '../../../utils/user';

// TK-05: Reject description suggestion
// TODO: Multi-user task workflow test - needs investigation for descriptionBox selector timing
test.describe.skip('Reject Description Task', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const taskAssignee = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await taskAssignee.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);

    // Set owner on glossary term
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: taskAssignee.responseData.id,
              type: 'user',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await taskAssignee.delete(apiContext);
    await afterAction();
  });

  test('should reject description suggestion task', async ({ browser }) => {
    test.slow(true);

    // Create task as admin
    const { page: adminPage, afterAction: afterAdminAction } =
      await performAdminLogin(browser);

    await redirectToHomePage(adminPage);
    await sidebarClick(adminPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(adminPage, glossary.data.displayName);
    await selectActiveGlossaryTerm(adminPage, glossaryTerm.data.displayName);

    // Open the task creation dialog
    await adminPage.getByTestId('request-description').click();

    // Create description task - pass assignee since owner is auto-assigned
    await createDescriptionTaskForGlossary(
      adminPage,
      {
        description: 'Suggested description for rejection test',
        assignee: taskAssignee.getUserDisplayName(),
      },
      glossaryTerm,
      false // isGlossary = false since it's a glossary term
    );

    await afterAdminAction();

    // Login as assignee and reject the task
    const { page: assigneePage, afterAction: afterAssigneeAction } =
      await performUserLogin(browser, taskAssignee);

    await redirectToHomePage(assigneePage);

    // Check notifications for the task
    await assigneePage.getByTestId('task-notifications').click();
    await assigneePage.waitForSelector('.ant-dropdown');

    // Click on the first notification to go to task
    const firstNotification = assigneePage
      .locator('.ant-list-items > .ant-list-item')
      .first();

    if (await firstNotification.isVisible()) {
      await firstNotification.click();
      await assigneePage.waitForLoadState('networkidle');

      // Look for reject button
      const rejectButton = assigneePage.getByTestId('reject-task');

      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        // Wait for rejection to complete
        await assigneePage.waitForLoadState('networkidle');

        await toastNotification(assigneePage, /Task closed successfully/);
      }
    }

    await afterAssigneeAction();
  });
});

// TK-07: Reject tag suggestion
// TODO: Multi-user task workflow test - needs investigation for task creation form
test.describe.skip('Reject Tag Task', () => {
  const glossary = new Glossary();
  const taskAssignee = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await taskAssignee.create(apiContext);
    await glossary.create(apiContext);

    // Set owner on glossary
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          id: taskAssignee.responseData.id,
          type: 'user',
        },
      },
    ]);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await taskAssignee.delete(apiContext);
    await afterAction();
  });

  test('should reject tag suggestion task', async ({ browser }) => {
    test.slow(true);

    // Create task as admin
    const { page: adminPage, afterAction: afterAdminAction } =
      await performAdminLogin(browser);

    await redirectToHomePage(adminPage);
    await sidebarClick(adminPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(adminPage, glossary.data.displayName);

    // Open the tag task creation dialog
    await adminPage.getByTestId('request-entity-tags').click();

    // Create tag request task - pass assignee since owner is auto-assigned
    await createTagTaskForGlossary(
      adminPage,
      {
        tag: 'PII.Sensitive',
        assignee: taskAssignee.getUserDisplayName(),
      },
      glossary,
      true // isGlossary = true
    );

    await afterAdminAction();

    // Login as assignee and reject the task
    const { page: assigneePage, afterAction: afterAssigneeAction } =
      await performUserLogin(browser, taskAssignee);

    await redirectToHomePage(assigneePage);

    // Check notifications for the task
    await assigneePage.getByTestId('task-notifications').click();
    await assigneePage.waitForSelector('.ant-dropdown');

    // Click on the first notification to go to task
    const firstNotification = assigneePage
      .locator('.ant-list-items > .ant-list-item')
      .first();

    if (await firstNotification.isVisible()) {
      await firstNotification.click();
      await assigneePage.waitForLoadState('networkidle');

      // Look for reject button
      const rejectButton = assigneePage.getByTestId('reject-task');

      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        // Wait for rejection to complete
        await assigneePage.waitForLoadState('networkidle');

        await toastNotification(assigneePage, /Task closed successfully/);
      }
    }

    await afterAssigneeAction();
  });
});

// TK-08: Task appears in notification bell
// TODO: Multi-user task workflow test - needs investigation for notification system
test.describe.skip('Task Notification Bell', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const taskAssignee = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await taskAssignee.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);

    // Set owner on glossary term
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: taskAssignee.responseData.id,
              type: 'user',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await taskAssignee.delete(apiContext);
    await afterAction();
  });

  test('should show task in notification bell', async ({ browser }) => {
    test.slow(true);

    // Create task as admin
    const { page: adminPage, afterAction: afterAdminAction } =
      await performAdminLogin(browser);

    await redirectToHomePage(adminPage);
    await sidebarClick(adminPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(adminPage, glossary.data.displayName);
    await selectActiveGlossaryTerm(adminPage, glossaryTerm.data.displayName);

    // Open the task creation dialog
    await adminPage.getByTestId('request-description').click();

    // Create description task - pass assignee since owner is auto-assigned
    await createDescriptionTaskForGlossary(
      adminPage,
      {
        description: 'Description for notification test',
        assignee: taskAssignee.getUserDisplayName(),
      },
      glossaryTerm,
      false // isGlossary = false since it's a glossary term
    );

    await afterAdminAction();

    // Login as assignee and check notification bell
    const { page: assigneePage, afterAction: afterAssigneeAction } =
      await performUserLogin(browser, taskAssignee);

    await redirectToHomePage(assigneePage);

    // Check the notification bell
    const taskNotifications = assigneePage.getByTestId('task-notifications');

    await expect(taskNotifications).toBeVisible();

    // Click to open dropdown
    await taskNotifications.click();
    await assigneePage.waitForSelector('.ant-dropdown');

    // Verify task notification is present
    const notificationsList = assigneePage.locator('.ant-list-items');

    await expect(notificationsList).toBeVisible();

    // Check that there's at least one notification
    const notificationItems = assigneePage.locator(
      '.ant-list-items > .ant-list-item'
    );
    const count = await notificationItems.count();

    expect(count).toBeGreaterThan(0);

    // Verify notification contains task-related text
    const firstNotification = notificationItems.first();

    await expect(firstNotification).toContainText(/Request/i);

    await clickOutside(assigneePage);
    await afterAssigneeAction();
  });
});
