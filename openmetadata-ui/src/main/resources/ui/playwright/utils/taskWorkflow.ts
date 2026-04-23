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
import { clickOutside, descriptionBox } from './common';
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

const TASK_CARD_SELECTOR = '[data-testid="task-feed-card"]';
const TASK_TAB_SELECTOR = '[data-testid="task-tab"]';
const TASK_PANEL_SELECTOR = '#task-panel';
const VISIBLE_TASK_MODAL_SELECTOR = '.ant-modal-wrap:visible';

const logTaskDebug = (...messages: Array<string | number | boolean>) => {
  if (process.env.PW_TASK_DEBUG) {
    console.log('[PW_TASK_DEBUG]', ...messages);
  }
};

const getDropdownTrigger = (dropdown: Locator) =>
  dropdown.getByRole('button', { name: /down/i }).first();

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
  const tagSelector = root.locator('[data-testid="tag-selector"]').first();
  const tagsInput = tagSelector
    .locator(
      '.ant-select-selection-search-input, input[type="search"], .ant-select-selection-search input'
    )
    .first();
  const tagOption = page.getByTestId(tagTestId).first();
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
    await tagSelector.click({ force: true }).catch(() => undefined);
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
  await page.keyboard.press('Escape');
  logTaskDebug('selectTagSuggestion:done', tagTestId);
};

const clickDropdownMenuItem = async ({
  dropdown,
  page,
  menuPattern,
}: {
  dropdown: Locator;
  page: Page;
  menuPattern: RegExp;
}) => {
  const dropdownTrigger = getDropdownTrigger(dropdown);
  const fallbackTrigger = dropdown.locator('button').last();
  const taskCtaFallbackTrigger = page
    .locator('#task-panel [data-testid="task-cta-buttons"] button')
    .last();
  const plainDownButtonFallbackTrigger = page
    .locator('#task-panel')
    .getByRole('button', { name: /down/i })
    .last();
  const visibleDropdownMenu = page.locator('.task-action-dropdown').last();
  const roleMenuItem = page
    .getByRole('menuitem', { name: menuPattern })
    .first();
  const cssMenuItem = visibleDropdownMenu
    .locator('.ant-dropdown-menu-item')
    .filter({ hasText: menuPattern })
    .first();

  const isMenuItemVisible = async () =>
    (await roleMenuItem.isVisible().catch(() => false)) ||
    (await cssMenuItem.isVisible().catch(() => false));

  const waitForMenuItem = async () => {
    await Promise.race([
      roleMenuItem.waitFor({ state: 'visible', timeout: 1500 }),
      cssMenuItem.waitFor({ state: 'visible', timeout: 1500 }),
    ]).catch(() => undefined);

    return isMenuItemVisible();
  };

  if (await isMenuItemVisible()) {
    if (await roleMenuItem.isVisible().catch(() => false)) {
      await roleMenuItem.click({ force: true });

      return;
    }

    await cssMenuItem.click({ force: true });

    return;
  }

  const triggerCandidates = [
    dropdownTrigger,
    fallbackTrigger,
    taskCtaFallbackTrigger,
    plainDownButtonFallbackTrigger,
  ];
  let resolvedTrigger = dropdownTrigger;

  for (const candidate of triggerCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      resolvedTrigger = candidate;
      break;
    }
  }

  await expect(resolvedTrigger).toBeVisible();
  await resolvedTrigger.scrollIntoViewIfNeeded().catch(() => undefined);

  for (let attempt = 0; attempt < 3; attempt++) {
    logTaskDebug('clickDropdownMenuItem:openAttempt', attempt + 1);
    await resolvedTrigger.click({ force: true }).catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }

    await resolvedTrigger.focus().catch(() => undefined);
    await resolvedTrigger.press('ArrowDown').catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }

    await resolvedTrigger.press('Enter').catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }

    await fallbackTrigger.click({ force: true }).catch(() => undefined);

    if (await waitForMenuItem()) {
      break;
    }
  }

  if (await roleMenuItem.isVisible().catch(() => false)) {
    await roleMenuItem.click({ force: true });

    return;
  }

  await expect(cssMenuItem).toBeVisible();
  await cssMenuItem.click({ force: true });
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
  const assigneeInput = page.locator(
    '[data-testid="select-assignee"] .ant-select-selection-search input'
  );
  const assigneeOption = page.getByTestId(assigneeName).first();
  const assigneeSearchResponse = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('user_search_index'),
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
    await page.locator(descriptionBox).clear();
    await page.locator(descriptionBox).fill(description);
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
  await waitForAllLoadersToDisappear(page);
  logTaskDebug('createTagTaskFromForm:done');

  return (await response.json()) as CreatedTask;
};

export const openEntityTasksTab = async (page: Page) => {
  logTaskDebug('openEntityTasksTab:start');
  const activityFeedTab = page.getByTestId('activity_feed');

  if (await activityFeedTab.isVisible().catch(() => false)) {
    await activityFeedTab.click();
    await waitForPageLoaded(page);
  }

  const menuItemTaskTab = page.getByRole('menuitem', { name: /tasks/i });
  const buttonTaskTab = page.getByRole('button', { name: /tasks/i });

  if (await menuItemTaskTab.isVisible().catch(() => false)) {
    const taskListResponse = waitForTaskListResponse(page);
    await menuItemTaskTab.click();
    await taskListResponse.catch(() => undefined);
  } else if (await buttonTaskTab.isVisible().catch(() => false)) {
    const taskListResponse = waitForTaskListResponse(page);
    await buttonTaskTab.click();
    await taskListResponse.catch(() => undefined);
  }

  await waitForPageLoaded(page);
  await waitForAllLoadersToDisappear(page);
  logTaskDebug('openEntityTasksTab:done');
};

export const getTaskCard = (page: Page, task: CreatedTask) => {
  const taskDisplayId = getTaskDisplayId(task.taskId);

  return page
    .locator(TASK_CARD_SELECTOR)
    .filter({ hasText: `#${taskDisplayId}` })
    .first();
};

export const openTaskDetails = async (page: Page, task: CreatedTask) => {
  const taskCard = getTaskCard(page, task);
  logTaskDebug('openTaskDetails:waitingForCard', task.taskId);
  await expect(taskCard).toBeVisible({ timeout: 15000 });
  logTaskDebug('openTaskDetails:click', task.taskId);
  await taskCard.click();
  await expect(page.locator(TASK_TAB_SELECTOR)).toBeVisible();
  logTaskDebug('openTaskDetails:done', task.taskId);
};

export const openTaskEditModal = async (page: Page) => {
  logTaskDebug('openTaskEditModal:start');
  const editTransitionPattern =
    /edit suggestion|edit|update description|update tags|add description|add tags/i;
  const visibleTaskModal = page.locator(VISIBLE_TASK_MODAL_SELECTOR).first();
  const workflowTaskActionPrimary = page
    .locator('#task-panel [data-testid="workflow-task-action-primary"]')
    .first();
  const workflowTaskActionDropdown = page
    .locator('#task-panel [data-testid="workflow-task-action-dropdown"]')
    .first();
  const genericTaskActionPanel = page.locator('#task-panel').first();
  const addSuggestionDropdown = page
    .locator('#task-panel [data-testid="add-close-task-dropdown"]')
    .first();
  const editSuggestionDropdown = page
    .locator('#task-panel [data-testid="edit-accept-task-dropdown"]')
    .first();

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
    const dropdownPrimaryButton = workflowTaskActionDropdown
      .locator('[data-testid="workflow-task-action-primary"]')
      .first();
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
        dropdown: workflowTaskActionDropdown,
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
        dropdown: workflowTaskActionDropdown,
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
    const primaryActionButton = addSuggestionDropdown.locator('button').first();

    await primaryActionButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await primaryActionButton.click().catch(() => undefined);

    if (!(await waitForVisibleTaskModal())) {
      await clickDropdownMenuItem({
        dropdown: addSuggestionDropdown,
        page,
        menuPattern: /add description|add tags/i,
      });
    }
  } else if (await editSuggestionDropdown.isVisible().catch(() => false)) {
    logTaskDebug('openTaskEditModal:editSuggestionDropdown');
    await clickDropdownMenuItem({
      dropdown: editSuggestionDropdown,
      page,
      menuPattern: editTransitionPattern,
    });
  } else if (
    await genericTaskActionPanel
      .getByRole('button', { name: /approve|resolve|edit|update|add|down/i })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    logTaskDebug('openTaskEditModal:genericTaskActionPanel');
    const genericPrimaryAction = genericTaskActionPanel
      .getByRole('button', { name: /edit suggestion|edit|resolve|update|add/i })
      .first();
    const genericDropdownTrigger = genericTaskActionPanel
      .getByRole('button', { name: /down/i })
      .first();
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
        dropdown: genericTaskActionPanel,
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
    .first()
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
    .first()
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
    root: page.locator(VISIBLE_TASK_MODAL_SELECTOR).first(),
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
    await commentInput.click({ force: true }).catch(() => undefined);

    if (!(await editor.isVisible().catch(() => false))) {
      await commentInput.press('Enter').catch(() => undefined);
    }
  }

  await expect(editor).toBeVisible({ timeout: 5000 });
  logTaskDebug('addCommentToTask:editorVisible');
  await editor.click({ force: true });
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
  const workflowPrimaryButton = taskPanel
    .getByTestId('workflow-task-action-primary')
    .first();

  await expect(taskPanel).toBeVisible();
  await expect
    .poll(async () => {
      return (
        (await closeButton.isVisible().catch(() => false)) ||
        (await workflowPrimaryButton.isVisible().catch(() => false)) ||
        (await taskPanel
          .locator(
            '[data-testid="workflow-task-action-dropdown"], [data-testid="edit-accept-task-dropdown"], [data-testid="add-close-task-dropdown"]'
          )
          .first()
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
      await workflowPrimaryButton.click({ force: true });
      await taskActionResponse;
      await waitForPageLoaded(page);
      logTaskDebug('closeTaskFromDetails:workflowPrimaryDone');

      return;
    }
  }

  const dropdown = taskPanel
    .locator(
      '[data-testid="workflow-task-action-dropdown"], [data-testid="edit-accept-task-dropdown"], [data-testid="add-close-task-dropdown"]'
    )
    .first();
  const trigger = getDropdownTrigger(dropdown);

  await expect(trigger).toBeVisible();
  logTaskDebug('closeTaskFromDetails:dropdown');
  await trigger.click();
  const taskActionResponse = waitForTaskActionResponse(page);
  await page.getByRole('menuitem', { name: /reject|decline|close/i }).click();

  const visibleModal = page.locator(VISIBLE_TASK_MODAL_SELECTOR).first();
  if (await visibleModal.isVisible().catch(() => false)) {
    const commentInput = visibleModal.locator('textarea').last();
    if (await commentInput.isVisible().catch(() => false)) {
      await commentInput.fill('Rejected by Playwright');
    }

    const rejectButton = visibleModal
      .getByRole('button', { name: /reject|decline|close/i })
      .first();
    const confirmButton = visibleModal
      .getByRole('button', { name: /save|ok/i })
      .first();

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
  const visibleTaskModal = page.locator(VISIBLE_TASK_MODAL_SELECTOR).first();
  const approveButton = taskPanel.getByTestId('approve-button').first();
  const workflowPrimaryButton = taskPanel
    .getByTestId('workflow-task-action-primary')
    .first();
  const workflowDropdownPrimaryButton = taskPanel
    .locator('[data-testid="workflow-task-action-dropdown"] button')
    .first();
  const genericPrimaryButton = taskPanel
    .getByRole('button', { name: /approve|accept|resolve|complete/i })
    .first();

  const clickAndWait = async (button: Locator) => {
    const taskActionResponse = waitForTaskActionResponse(page);
    await button.scrollIntoViewIfNeeded().catch(() => undefined);
    await button.click({ force: true });

    await visibleTaskModal
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => undefined);

    if (await visibleTaskModal.isVisible().catch(() => false)) {
      const commentInput = visibleTaskModal.locator('textarea').last();
      if (await commentInput.isVisible().catch(() => false)) {
        await commentInput.fill('Approved by Playwright');
      }

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
