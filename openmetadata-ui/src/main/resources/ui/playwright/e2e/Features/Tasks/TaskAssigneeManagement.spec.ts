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

import { TableClass } from '../../../support/entity/TableClass';
import { TaskClass } from '../../../support/entity/TaskClass';
import { expect, test } from '../../../support/fixtures/base';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { getTaskCard, selectAssignee } from '../../../utils/taskWorkflow';

test.describe('Task Assignee Management', () => {
  const adminUser = new UserClass();
  const initialAssignee = new UserClass();
  const nextAssignee = new UserClass();
  const table = new TableClass();
  const task = new TaskClass({
    category: 'MetadataUpdate',
    type: 'DescriptionUpdate',
  });

  test.beforeAll('Setup task for reassignment', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await initialAssignee.create(apiContext);
      await nextAssignee.create(apiContext);
      await table.create(apiContext);

      task.data.about = `<#E::table::${table.entityResponseData.fullyQualifiedName}>`;
      task.data.assignees = [initialAssignee.responseData.name];

      await task.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Cleanup task reassignment data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await task.delete(apiContext);
      await table.delete(apiContext);
      await nextAssignee.delete(apiContext);
      await initialAssignee.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('admin can reassign an existing metadata task from the task details page', async ({
    page,
  }) => {
    await adminUser.signIn(page);
    await table.visitEntityPage(page);
    await page.getByTestId('activity_feed').click();
    await waitForAllLoadersToDisappear(page);

    const tasksMenuItem = page
      .getByTestId('global-setting-left-panel')
      .getByRole('button', { name: /tasks/i });
    await expect(tasksMenuItem).toBeVisible();
    await tasksMenuItem.click();
    await waitForAllLoadersToDisappear(page);

    // The one task this suite seeded, named rather than taken by position.
    await getTaskCard(page, task.responseData!).click();

    await expect(page.getByTestId('task-tab')).toBeVisible();

    await page.getByTestId('edit-assignees').click();
    await expect(page.getByTestId('select-assignee')).toBeVisible();

    // The suite seeds exactly one assignee, so this resolves uniquely -- and
    // fails loudly rather than silently picking one if that ever changes.
    const existingAssigneeRemoveButton = page
      .getByTestId('select-assignee')
      .locator('.ant-select-selection-item-remove');

    await existingAssigneeRemoveButton.click();
    await selectAssignee(page, nextAssignee.responseData.name);

    const patchTaskResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/v1/tasks/${task.responseData?.id}`)
    );

    await page.getByTestId('inline-save-btn').click();
    await patchTaskResponse;

    await expect(page.getByTestId('select-assignee')).not.toBeVisible();

    const { apiContext, afterAction } = await getApiContext(page);

    try {
      const response = await apiContext.get(
        `/api/v1/tasks/${task.responseData?.id}?fields=assignees`
      );
      const updatedTask = await response.json();

      expect(updatedTask.assignees).toHaveLength(1);
      expect(updatedTask.assignees[0].name).toBe(
        nextAssignee.responseData.name
      );
    } finally {
      await afterAction();
    }
  });
});
