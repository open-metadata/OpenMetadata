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
import { expect, Locator, Page } from '@playwright/test';
import {
  clickOutside,
  descriptionBox,
  fillDescriptionBox,
  getDescriptionBox,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { waitForPageLoaded } from './polling';
import {
  waitForTaskActionResponse,
  waitForTaskCommentResponse,
  waitForTaskCreateResponse,
  waitForTaskListResponse,
  waitForTaskResolveResponse,
} from './task';

type TaskRouteAction =
  | 'request-description'
  | 'request-tags'
  | 'update-description'
  | 'update-tags';

export interface CreatedTask {
  id: string;
  taskId: string;
  status?: string;
}

const TASK_TAB_SELECTOR = '[data-testid="task-tab"]';
const TASK_PANEL_SELECTOR = '#task-panel';
// Menu and combobox popovers are role="dialog" too; they carry data-trigger,
// modal dialogs do not. Without the exclusion an open caret menu makes the
// selector match two elements and every strict locator built on it throws.
const VISIBLE_TASK_MODAL_SELECTOR =
  '[role="dialog"]:not([data-trigger]):visible';

const logTaskDebug = (...messages: Array<string | number | boolean>) => {
  if (process.env.PW_TASK_DEBUG) {
    console.log('[PW_TASK_DEBUG]', ...messages);
  }
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const selectTagSuggestion = async ({
  page,
  root,
  searchText,
  tagTestId,
}: {
  page: Page;
  root: Page | Locator;
  searchText: string;
  tagTestId: string;
}) => {
  const tagSelector = root.locator('[data-testid="tag-selector"]');
  const tagsInput = tagSelector.getByRole('combobox');
  const tagOption = page.getByTestId(tagTestId);
  const tagSearchResponse = page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('tag_search_index'),
      { timeout: 5000 }
    )
    .catch(() => null);

  logTaskDebug('selectTagSuggestion:start', searchText, tagTestId);
  if (!(await tagsInput.isVisible().catch(() => false))) {
    await tagSelector.click().catch(() => undefined);
  }

  await expect(tagsInput).toBeVisible({ timeout: 5000 });
  await tagsInput.click().catch(() => undefined);
  await tagsInput.fill(searchText);
  logTaskDebug('selectTagSuggestion:filled', searchText);

  await Promise.race([
    tagSearchResponse,
    tagOption.waitFor({ state: 'visible', timeout: 5000 }),
  ]).catch(() => undefined);

  await expect(tagOption).toBeVisible({ timeout: 5000 });
  logTaskDebug('selectTagSuggestion:optionVisible', tagTestId);
  await tagOption.click();
  // The multi-select schedules a re-open (~150ms) while its input still has
  // focus, which would undo an Escape sent right after the pick. Moving focus
  // away is what closes it for good, but it has to land inside the modal: a
  // click on the body (or a bare blur()) makes the dialog's focus containment
  // hand focus back to the input, and focus re-opens the menu.
  const containingDialog = page.locator(VISIBLE_TASK_MODAL_SELECTOR).filter({
    has: page.getByTestId('tag-selector'),
  });
  if (await containingDialog.count()) {
    // The open menu aria-hides the title, so locate its test ID.
    await containingDialog.getByTestId('dialog-title').click();
  } else {
    await clickOutside(page);
  }
  await expect(tagsInput).toHaveAttribute('aria-expanded', 'false');
  logTaskDebug('selectTagSuggestion:done', tagTestId);
};

// The dialog is visible before its body has mounted, so a one-shot isVisible()
// on the comment field races the mount and silently skips the required comment.
const fillModalComment = async (modal: Locator, comment: string) => {
  const commentInput = modal.locator('textarea').last();
  const hasCommentField = await commentInput
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (hasCommentField) {
    await commentInput.fill(comment);
  }
};

const clickDropdownMenuItem = async ({
  page,
  menuPattern,
}: {
  page: Page;
  menuPattern: RegExp;
}) => {
  // TaskTabNew renders its CTA through renderDropdownButtons(prefix), which
  // stamps `${prefix}-primary` on the main button and `${prefix}-trigger` on
  // the caret, for prefixes workflow-/incident-/glossary-/edit-accept-task-action.
  // Only one task panel is on screen, so the caret is nameable -- which is what
  // the four fallback locators here used to be guessing at, each with .last()
  // and its errors swallowed, so a wrong guess silently changed what got clicked.
  const dropdownTrigger = page.locator(
    '#task-panel [data-testid$="-task-action-trigger"]'
  );
  const menuItem = page
    .locator('.task-action-dropdown:visible')
    .getByRole('menuitem', { name: menuPattern });

  const isMenuItemVisible = () => menuItem.isVisible().catch(() => false);

  const waitForMenuItem = async () => {
    await menuItem
      .waitFor({ state: 'visible', timeout: 1500 })
      .catch(() => undefined);

    return isMenuItemVisible();
  };

  if (await isMenuItemVisible()) {
    await menuItem.click();

    return;
  }

  await expect(dropdownTrigger).toBeVisible();
  await dropdownTrigger.scrollIntoViewIfNeeded().catch(() => undefined);

  // antd's Dropdown.Button does not always open on the first click under load,
  // so the keyboard paths stay -- but they now drive one known element rather
  // than four candidates.
  for (let attempt = 0; attempt < 3; attempt++) {
    logTaskDebug('clickDropdownMenuItem:openAttempt', attempt + 1);
    await dropdownTrigger.click().catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }

    await dropdownTrigger.focus().catch(() => undefined);
    await dropdownTrigger.press('ArrowDown').catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }

    await dropdownTrigger.press('Enter').catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }
  }

  await expect(menuItem).toBeVisible();
  await menuItem.click();
};

export const formatTaskFieldValue = (value: string) => {
  return value;
};

export const getTaskDisplayId = (taskId?: string) => {
  if (!taskId) {
    return '';
  }

  const matchedTaskId = /^TASK-0*([0-9]+)$/.exec(taskId);

  return matchedTaskId?.[1] ?? taskId;
};

export const buildTaskRoute = ({
  action,
  entityType,
  fqn,
  field,
  value,
}: {
  action: TaskRouteAction;
  entityType: string;
  fqn: string;
  field?: string;
  value?: string;
}) => {
  const params = new URLSearchParams();

  if (field && value) {
    params.set('field', field);
    params.set('value', formatTaskFieldValue(value));
  }

  const queryString = params.toString();

  return `/${action}/${entityType}/${encodeURIComponent(fqn)}${
    queryString ? `?${queryString}` : ''
  }`;
};

export const openTaskForm = async (page: Page, route: string) => {
  await page.goto(route);
  await page.waitForSelector('[data-testid="form-container"]', {
    state: 'visible',
  });
};

export const selectAssignee = async (page: Page, assigneeName: string) => {
  const assigneeInput = page
    .getByTestId('select-assignee')
    .getByRole('combobox');
  const assigneeOption = page.getByTestId(assigneeName);
  const assigneeSearchResponse = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('user'),
      { timeout: 5000 }
    )
    .catch(() => null);

  await assigneeInput.click();
  await assigneeInput.fill(assigneeName);
  await Promise.race([
    assigneeSearchResponse,
    assigneeOption.waitFor({ state: 'visible', timeout: 5000 }),
  ]).catch(() => undefined);
  await expect(assigneeOption).toBeVisible();
  await assigneeOption.click();
  await clickOutside(page);
};

export const createDescriptionTaskFromForm = async ({
  page,
  assigneeName,
  description,
}: {
  page: Page;
  assigneeName: string;
  description?: string;
}): Promise<CreatedTask> => {
  await selectAssignee(page, assigneeName);

  if (description) {
    await getDescriptionBox(page).clear();
    await fillDescriptionBox(page, description);
  }

  const taskCreateResponse = waitForTaskCreateResponse(page);
  await page.getByTestId('submit-btn').click();
  const response = await taskCreateResponse;

  await waitForPageLoaded(page);
  await waitForAllLoadersToDisappear(page);

  return (await response.json()) as CreatedTask;
};

export const addTagSuggestion = async ({
  page,
  searchText,
  tagTestId,
}: {
  page: Page;
  searchText: string;
  tagTestId: string;
}) => {
  await selectTagSuggestion({
    page,
    root: page,
    searchText,
    tagTestId,
  });
};

export const createTagTaskFromForm = async ({
  page,
  assigneeName,
  searchText,
  tagTestId,
}: {
  page: Page;
  assigneeName: string;
  searchText?: string;
  tagTestId?: string;
}): Promise<CreatedTask> => {
  logTaskDebug('createTagTaskFromForm:start');
  await selectAssignee(page, assigneeName);
  logTaskDebug('createTagTaskFromForm:assigneeSelected', assigneeName);

  if (searchText && tagTestId) {
    await addTagSuggestion({ page, searchText, tagTestId });
  }

  const taskCreateResponse = waitForTaskCreateResponse(page);
  await page.getByTestId('submit-tag-request').click();
  const response = await taskCreateResponse;

  await waitForPageLoaded(page);
  logTaskDebug('createTagTaskFromForm:done');

  return (await response.json()) as CreatedTask;
};

export const openEntityTasksTab = async (page: Page) => {
  logTaskDebug('openEntityTasksTab:start');
  const activityFeedTab = page.getByTestId('activity_feed');
  await activityFeedTab.waitFor({ state: 'visible' });
  await activityFeedTab.click();
  await waitForPageLoaded(page);

  const menuItemTaskTab = page
    .getByTestId('global-setting-left-panel')
    .getByRole('button', { name: /tasks/i });
  await menuItemTaskTab.waitFor({ state: 'visible' });

  const taskListResponse = waitForTaskListResponse(page);
  await menuItemTaskTab.click();
  await taskListResponse.catch(() => undefined);

  await waitForPageLoaded(page);
  logTaskDebug('openEntityTasksTab:done');
};

export const getTaskCard = (page: Page, task: CreatedTask) => {
  const taskDisplayId = getTaskDisplayId(task.taskId);

  // The card renders aria-label="#<displayId> <type>", so its accessible name
  // identifies the task. It is not enough on its own: the card also contains a
  // redirect-task-button-link whose own name starts with the same "#<id>". So
  // require both identities -- the task card AND that accessible name.
  //
  // The pattern is anchored because a substring match on "#12" also hits
  // "#120".
  return page
    .getByTestId('task-feed-card')
    .and(
      page.getByRole('button', { name: new RegExp(`^#${taskDisplayId}\\b`) })
    );
};

export const openTaskDetails = async (page: Page, task: CreatedTask) => {
  const taskCard = getTaskCard(page, task);
  logTaskDebug('openTaskDetails:waitingForCard', task.taskId);
  // The activity-feed UI re-fetches its list after the task is created via
  // API; under Basic-project parallelism the refresh can lag past 15s and
  // the card never appears within the default timeout. 45s gives the feed
  // enough time to propagate without slowing healthy runs.
  await expect(taskCard).toBeVisible({ timeout: 45000 });
  logTaskDebug('openTaskDetails:click', task.taskId);
  await taskCard.click();
  await expect(page.locator(TASK_TAB_SELECTOR)).toBeVisible();
  logTaskDebug('openTaskDetails:done', task.taskId);
};

export const openTaskEditModal = async (page: Page) => {
  logTaskDebug('openTaskEditModal:start');
  const editTransitionPattern =
    /edit suggestion|edit|update description|update tags|add description|add tags/i;
  const visibleTaskModal = page.locator(VISIBLE_TASK_MODAL_SELECTOR);
  const workflowTaskActionPrimary = page.locator(
    '#task-panel [data-testid="workflow-task-action-primary"]'
  );
  const workflowTaskActionDropdown = page.locator(
    '#task-panel [data-testid="workflow-task-action-dropdown"]'
  );
  const genericTaskActionPanel = page.locator('#task-panel');
  const addSuggestionDropdown = page.locator(
    '#task-panel [data-testid="add-close-task-dropdown"]'
  );
  const editSuggestionDropdown = page.locator(
    '#task-panel [data-testid="edit-accept-task-dropdown"]'
  );
  const waitForVisibleTaskModal = async () => {
    await visibleTaskModal
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => undefined);

    return visibleTaskModal.isVisible().catch(() => false);
  };

  if (await visibleTaskModal.isVisible().catch(() => false)) {
    logTaskDebug('openTaskEditModal:alreadyVisible');
    return;
  }

  if (await workflowTaskActionDropdown.isVisible().catch(() => false)) {
    logTaskDebug('openTaskEditModal:workflowDropdown');
    const dropdownPrimaryButton = workflowTaskActionDropdown.locator(
      '[data-testid="workflow-task-action-primary"]'
    );
    const dropdownPrimaryLabel = (
      await dropdownPrimaryButton.textContent().catch(() => '')
    )
      ?.trim()
      .replace(/\s+/g, ' ');
    const isPrimaryEditAction = Boolean(
      dropdownPrimaryLabel?.match(/edit|resolve|update|add/i)
    );

    await dropdownPrimaryButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await dropdownPrimaryButton.click().catch(() => undefined);

    if (!(await waitForVisibleTaskModal()) && isPrimaryEditAction) {
      await waitForPageLoaded(page).catch(() => undefined);
    }

    if (!(await waitForVisibleTaskModal()) && !isPrimaryEditAction) {
      await clickDropdownMenuItem({
        page,
        menuPattern: editTransitionPattern,
      });
    }

    if (!(await waitForVisibleTaskModal()) && isPrimaryEditAction) {
      await dropdownPrimaryButton
        .scrollIntoViewIfNeeded()
        .catch(() => undefined);
      await dropdownPrimaryButton.click().catch(() => undefined);
    }

    if (!(await waitForVisibleTaskModal()) && !isPrimaryEditAction) {
      await waitForPageLoaded(page).catch(() => undefined);
    }

    if (!(await waitForVisibleTaskModal()) && isPrimaryEditAction) {
      const menuPattern = dropdownPrimaryLabel
        ? new RegExp(escapeRegExp(dropdownPrimaryLabel), 'i')
        : editTransitionPattern;

      await clickDropdownMenuItem({
        page,
        menuPattern,
      });
    }
  } else if (await workflowTaskActionPrimary.isVisible().catch(() => false)) {
    logTaskDebug('openTaskEditModal:workflowPrimary');
    await workflowTaskActionPrimary
      .scrollIntoViewIfNeeded()
      .catch(() => undefined);
    await workflowTaskActionPrimary.click().catch(() => undefined);

    if (!(await waitForVisibleTaskModal())) {
      await waitForPageLoaded(page).catch(() => undefined);
      await workflowTaskActionPrimary.click().catch(() => undefined);
    }
  } else if (await addSuggestionDropdown.isVisible().catch(() => false)) {
    logTaskDebug('openTaskEditModal:addSuggestionDropdown');
    const primaryActionButton = addSuggestionDropdown.locator(
      '[data-testid="no-suggestion-task-action-primary"]'
    );

    await primaryActionButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await primaryActionButton.click().catch(() => undefined);

    if (!(await waitForVisibleTaskModal())) {
      await clickDropdownMenuItem({
        page,
        menuPattern: /add description|add tags/i,
      });
    }
  } else if (await editSuggestionDropdown.isVisible().catch(() => false)) {
    logTaskDebug('openTaskEditModal:editSuggestionDropdown');
    await clickDropdownMenuItem({
      page,
      menuPattern: editTransitionPattern,
    });
  } else if (
    await genericTaskActionPanel
      .locator('[data-testid$="-task-action-primary"]')
      .isVisible()
      .catch(() => false)
  ) {
    logTaskDebug('openTaskEditModal:genericTaskActionPanel');
    const genericPrimaryAction = genericTaskActionPanel.locator(
      '[data-testid$="-task-action-primary"]'
    );
    const genericDropdownTrigger = genericTaskActionPanel.locator(
      '[data-testid$="-task-action-trigger"]'
    );
    if (await genericPrimaryAction.isVisible().catch(() => false)) {
      await genericPrimaryAction
        .scrollIntoViewIfNeeded()
        .catch(() => undefined);
      await genericPrimaryAction.click().catch(() => undefined);
    }

    if (
      !(await waitForVisibleTaskModal()) &&
      (await genericDropdownTrigger.isVisible().catch(() => false))
    ) {
      await clickDropdownMenuItem({
        page,
        menuPattern: editTransitionPattern,
      });
    }
  }

  await expect(visibleTaskModal).toBeVisible();
  logTaskDebug('openTaskEditModal:done');
};

export const saveTaskEditModal = async (page: Page) => {
  logTaskDebug('saveTaskEditModal:start');
  const taskResolveResponse = waitForTaskResolveResponse(page);
  await page
    .locator(VISIBLE_TASK_MODAL_SELECTOR)
    .getByRole('button', { name: /save|ok/i })
    .click();
  await taskResolveResponse;
  await waitForPageLoaded(page);
  logTaskDebug('saveTaskEditModal:done');
};

export const editDescriptionAndAccept = async (
  page: Page,
  updatedDescription: string
) => {
  logTaskDebug('editDescriptionAndAccept:start');
  await openTaskEditModal(page);
  logTaskDebug('editDescriptionAndAccept:modalOpen');
  const editor = page
    .locator(VISIBLE_TASK_MODAL_SELECTOR)
    .locator(descriptionBox);
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  logTaskDebug('editDescriptionAndAccept:cleared');
  await editor.fill(updatedDescription);
  logTaskDebug('editDescriptionAndAccept:filled');
  await saveTaskEditModal(page);
  logTaskDebug('editDescriptionAndAccept:done');
};

export const editTagsAndAccept = async ({
  page,
  searchText,
  tagTestId,
}: {
  page: Page;
  searchText: string;
  tagTestId: string;
}) => {
  logTaskDebug('editTagsAndAccept:start');
  await openTaskEditModal(page);
  await selectTagSuggestion({
    page,
    root: page.locator(VISIBLE_TASK_MODAL_SELECTOR),
    searchText,
    tagTestId,
  });
  await saveTaskEditModal(page);
  logTaskDebug('editTagsAndAccept:done');
};

export const addCommentToTask = async (page: Page, comment: string) => {
  logTaskDebug('addCommentToTask:start');
  const taskPanel = page.locator(TASK_PANEL_SELECTOR);
  const commentInput = taskPanel.getByTestId('comments-input-field');
  const editor = taskPanel.locator('[data-testid="editor-wrapper"] .ql-editor');

  if (!(await editor.isVisible().catch(() => false))) {
    await expect(commentInput).toBeVisible({ timeout: 5000 });
    await commentInput.scrollIntoViewIfNeeded().catch(() => undefined);
    logTaskDebug('addCommentToTask:openingEditor');
    await commentInput.click().catch(() => undefined);

    const editorAppearedAfterClick = await editor
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!editorAppearedAfterClick) {
      await commentInput.press('Enter').catch(() => undefined);
    }
  }

  await expect(editor).toBeVisible({ timeout: 15000 });
  logTaskDebug('addCommentToTask:editorVisible');
  await editor.click();
  await editor.type(comment);
  logTaskDebug('addCommentToTask:commentEntered');

  const taskCommentResponse = waitForTaskCommentResponse(page);
  const sendButton = taskPanel.getByTestId('send-button');
  await expect(sendButton).toBeEnabled({ timeout: 5000 });
  logTaskDebug('addCommentToTask:sendButtonEnabled');
  await sendButton.click();
  logTaskDebug('addCommentToTask:submit');
  await taskCommentResponse;
  await waitForPageLoaded(page);
  logTaskDebug('addCommentToTask:done');
};

export const closeTaskFromDetails = async (page: Page) => {
  logTaskDebug('closeTaskFromDetails:start');
  const taskPanel = page.locator(TASK_PANEL_SELECTOR);
  const closeButton = taskPanel.getByTestId('close-button');
  const workflowPrimaryButton = taskPanel.getByTestId(
    'workflow-task-action-primary'
  );

  await expect(taskPanel).toBeVisible();
  await expect
    .poll(async () => {
      return (
        (await closeButton.isVisible().catch(() => false)) ||
        (await workflowPrimaryButton.isVisible().catch(() => false)) ||
        (await taskPanel
          .locator('[data-testid$="-task-action-trigger"]')
          .isVisible()
          .catch(() => false))
      );
    })
    .toBe(true);

  if (await closeButton.isVisible().catch(() => false)) {
    const taskActionResponse = waitForTaskActionResponse(page);
    await closeButton.click();
    await taskActionResponse;
    logTaskDebug('closeTaskFromDetails:closeButtonDone');

    return;
  }

  if (await workflowPrimaryButton.isVisible().catch(() => false)) {
    const primaryLabel = (
      await workflowPrimaryButton.textContent().catch(() => '')
    )
      ?.trim()
      .replace(/\s+/g, ' ');

    if (primaryLabel?.match(/reject|decline|close/i)) {
      const taskActionResponse = waitForTaskActionResponse(page);
      await workflowPrimaryButton.click();
      await taskActionResponse;
      await waitForPageLoaded(page);
      logTaskDebug('closeTaskFromDetails:workflowPrimaryDone');

      return;
    }
  }

  logTaskDebug('closeTaskFromDetails:dropdown');
  const taskActionResponse = waitForTaskActionResponse(page);
  await clickDropdownMenuItem({
    page,
    menuPattern: /reject|decline|close/i,
  });

  const visibleModal = page.locator(VISIBLE_TASK_MODAL_SELECTOR);
  await visibleModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => undefined);

  if (await visibleModal.isVisible().catch(() => false)) {
    await fillModalComment(visibleModal, 'Rejected by Playwright');

    const rejectButton = visibleModal.getByRole('button', {
      name: /reject|decline|close/i,
    });
    const confirmButton = visibleModal.getByRole('button', {
      name: /save|ok/i,
    });

    if (await rejectButton.isVisible().catch(() => false)) {
      await rejectButton.click();
    } else {
      await confirmButton.click();
    }
  }

  await taskActionResponse;
  await waitForPageLoaded(page);
  logTaskDebug('closeTaskFromDetails:done');
};

export const approveTaskFromDetails = async (page: Page) => {
  logTaskDebug('approveTaskFromDetails:start');
  const taskPanel = page.locator(TASK_PANEL_SELECTOR);
  const visibleTaskModal = page.locator(VISIBLE_TASK_MODAL_SELECTOR);
  const approveButton = taskPanel.getByTestId('approve-button');
  const workflowPrimaryButton = taskPanel.getByTestId(
    'workflow-task-action-primary'
  );
  const workflowDropdownPrimaryButton = taskPanel.locator(
    '[data-testid="workflow-task-action-dropdown"] [data-testid="workflow-task-action-primary"]'
  );
  const genericPrimaryButton = taskPanel.locator(
    '[data-testid$="-task-action-primary"]'
  );

  const clickAndWait = async (button: Locator) => {
    const taskActionResponse = waitForTaskActionResponse(page);
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await button.click();

    await visibleTaskModal
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => undefined);

    if (await visibleTaskModal.isVisible().catch(() => false)) {
      await fillModalComment(visibleTaskModal, 'Approved by Playwright');

      const confirmButton = visibleTaskModal
        .getByRole('button', { name: /approve|accept|ok|save/i })
        .last();

      await expect(confirmButton).toBeVisible();
      await confirmButton.click();
    }

    await taskActionResponse;
    await waitForPageLoaded(page);
  };

  if (await approveButton.isVisible().catch(() => false)) {
    await clickAndWait(approveButton);
    logTaskDebug('approveTaskFromDetails:approveButton');

    return;
  }

  if (await workflowPrimaryButton.isVisible().catch(() => false)) {
    await clickAndWait(workflowPrimaryButton);
    logTaskDebug('approveTaskFromDetails:workflowPrimaryButton');

    return;
  }

  if (await workflowDropdownPrimaryButton.isVisible().catch(() => false)) {
    await clickAndWait(workflowDropdownPrimaryButton);
    logTaskDebug('approveTaskFromDetails:workflowDropdownPrimaryButton');

    return;
  }

  await expect(genericPrimaryButton).toBeVisible();
  await clickAndWait(genericPrimaryButton);
  logTaskDebug('approveTaskFromDetails:genericPrimaryButton');
};
