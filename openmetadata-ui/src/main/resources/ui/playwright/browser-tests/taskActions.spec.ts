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
import { openTaskEditModal } from '../utils/taskWorkflow';

for (const variant of [
  'workflow-accept',
  'workflow-resolve',
  'legacy-accept',
]) {
  test(
    'editing a task selects one edit action: ' + variant,
    async ({ page }) => {
      const workflow = variant.startsWith('workflow');
      const primaryIsEdit = variant === 'workflow-resolve';
      const prefix = workflow
        ? 'workflow-task-action'
        : 'edit-accept-task-action';
      const dropdown = workflow
        ? 'workflow-task-action-dropdown'
        : 'edit-accept-task-dropdown';
      await page.setContent(`
      <div id="task-panel"><div data-testid="task-cta-buttons"><div data-testid="${dropdown}">
        <button data-testid="${prefix}-primary" onclick="openModal('${
        primaryIsEdit ? 'edit' : 'accept'
      }')">${primaryIsEdit ? 'Resolve' : 'Accept'}</button>
        <button data-testid="${prefix}-trigger" aria-label="down" onclick="document.getElementById('menu').hidden=false">Open</button>
      </div></div></div>
      <div id="menu" hidden class="task-action-dropdown"><div role="menu">
        <button role="menuitem" onclick="openModal('edit')">Edit suggestion</button>
      </div></div>
      <div id="modal" hidden class="ant-modal-wrap"><div role="dialog">Task action</div></div>
      <script>
        window.taskActions = [];
        function openModal(action) {
          window.taskActions.push(action);
          document.getElementById('modal').hidden=false;
          document.getElementById('modal').dataset.action=action;
        }
      </script>
    `);
      await openTaskEditModal(page);
      await expect(page.locator('#modal')).toHaveAttribute(
        'data-action',
        'edit'
      );
      expect(
        await page.evaluate(
          () => (window as unknown as { taskActions: string[] }).taskActions
        )
      ).toEqual(['edit']);
    }
  );
}
