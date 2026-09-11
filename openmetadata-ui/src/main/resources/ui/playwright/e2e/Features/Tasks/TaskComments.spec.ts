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

import { Page } from '@playwright/test';
import { Task, TaskComment } from '../../../../src/generated/entity/tasks/task';
import { TaskClass } from '../../../support/entity/TaskClass';
import {
  createActivityTask,
  expect,
  TaskActivityData,
  test,
} from '../../../support/fixtures/taskActivity';
import { UserClass } from '../../../support/user/UserClass';
import { okJson } from '../../../utils/apiResponse';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

const openInboxTask = async (
  page: Page,
  data: TaskActivityData,
  task: TaskClass,
  user: UserClass
) => {
  await user.login(page);
  await okJson(
    await data.apiContext.put(
      `/api/v1/users/${user.responseData.id}/preferences/appMode`,
      { data: { type: 'appMode', config: { value: 'ai' } } }
    ),
    'Set the isolated comment user’s app mode'
  );
  await page.goto('/inbox/tasks', { waitUntil: 'domcontentloaded' });
  await page.getByTestId(`inbox-task-${task.responseData!.id}`).click();
  const panel = page.getByTestId('task-detail-panel');
  await expect(panel).toContainText(`#${task.responseData!.taskId}`);
  return panel;
};

const getPersistedComments = async (
  data: TaskActivityData,
  task: TaskClass
) => {
  const stored = await okJson<Task>(
    await data.apiContext.get(`/api/v1/tasks/${task.responseData!.id}`, {
      params: { fields: 'comments' },
    }),
    'Read saved task comments'
  );
  return stored.comments ?? [];
};

const addComment = async (page: Page, task: TaskClass, message: string) => {
  const composer = page
    .getByTestId('task-detail-panel')
    .getByTestId('inbox-comment-composer');
  await composer.locator('.ql-editor[contenteditable="true"]').fill(message);
  return submitComment(page, task);
};

const submitComment = async (page: Page, task: TaskClass) => {
  const response = waitForResponseWithStatus(
    page,
    (result) =>
      result.request().method() === 'POST' &&
      new URL(result.url()).pathname ===
        `/api/v1/tasks/${task.responseData!.id}/comments`,
    200
  );
  await page
    .getByTestId('inbox-comment-composer')
    .getByTestId('send-button')
    .click();
  return okJson<Task>(await response, 'Save task comment');
};

const commentWithMessage = (
  comments: TaskComment[] | undefined,
  message: string
) => {
  const comment = comments?.find((item) =>
    item.message.replaceAll('\u00a0', ' ').includes(message)
  );
  expect(comment, `Comment containing ${message}`).toBeDefined();
  return comment!;
};

for (const actor of ['member', 'outsider', 'teammate'] as const) {
  const role = {
    member: 'assignee',
    outsider: 'non-assignee',
    teammate: 'admin',
  }[actor];
  test(`${role} can add a comment that persists after reload`, async ({
    page,
    activityData: data,
  }) => {
    if (actor === 'teammate') await data.teammate.setAdminRole(data.apiContext);
    const task = await createActivityTask(data, data.member.responseData.name);
    const panel = await openInboxTask(page, data, task, data[actor]);
    const message = `Comment from ${role} ${uuid()}`;
    const saved = await addComment(page, task, message);
    const comment = commentWithMessage(saved.comments, message);
    expect(comment.author?.name).toBe(data[actor].responseData.name);
    await expect(
      panel.getByTestId('task-comment-card').filter({ hasText: message })
    ).toBeVisible();
    expect(await getPersistedComments(data, task)).toContainEqual(
      expect.objectContaining({ id: comment.id, message: comment.message })
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId(`inbox-task-${task.responseData!.id}`).click();
    await expect(
      panel.getByTestId('task-comment-card').filter({ hasText: message })
    ).toBeVisible();
  });
}

test('typing a mention shows the matching user suggestion', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const panel = await openInboxTask(page, data, task, data.member);
  const editor = panel
    .getByTestId('inbox-comment-composer')
    .locator('.ql-editor[contenteditable="true"]');
  await editor.pressSequentially(
    `@${data.outsider.responseData.name.slice(0, 12)}`
  );
  await expect(
    page.locator(`[data-value="@${data.outsider.responseData.name}"]`)
  ).toBeVisible();
  expect(await getPersistedComments(data, task)).toHaveLength(0);
});

test('selecting a mention saves the intended user and comment', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const panel = await openInboxTask(page, data, task, data.member);
  const editor = panel
    .getByTestId('inbox-comment-composer')
    .locator('.ql-editor[contenteditable="true"]');
  await editor.pressSequentially(
    `@${data.outsider.responseData.name.slice(0, 12)}`
  );
  await page
    .locator(`[data-value="@${data.outsider.responseData.name}"]`)
    .click();
  const message = `Please review ${uuid()}`;
  await editor.pressSequentially(` ${message}`);
  const saved = await submitComment(page, task);
  const comment = commentWithMessage(saved.comments, message);
  const card = panel
    .getByTestId('task-comment-card')
    .filter({ hasText: message });
  await expect(card).toContainText(data.outsider.responseData.name);
  await expect(
    card.getByRole('link', { name: `@${data.outsider.responseData.name}` })
  ).toHaveAttribute(
    'href',
    new RegExp(
      `/users/${data.outsider.responseData.name.replaceAll('.', '\\.')}$`
    )
  );
  expect(await getPersistedComments(data, task)).toContainEqual(
    expect.objectContaining({ id: comment.id, message: comment.message })
  );
});

test('comment author can edit and cancel without saving', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const panel = await openInboxTask(page, data, task, data.member);
  const message = `Unchanged comment ${uuid()}`;
  const saved = await addComment(page, task, message);
  const comment = commentWithMessage(saved.comments, message);
  const card = panel
    .getByTestId('task-comment-card')
    .filter({ hasText: message });
  await card.hover();
  await expect(card.getByTestId('delete-task-comment')).toBeVisible();
  await card.getByTestId('edit-task-comment').click();
  const editor = panel.getByTestId('edit-task-comment-editor');
  await editor
    .locator('.ql-editor[contenteditable="true"]')
    .fill('Discard this edit');
  await editor.getByTestId('cancel-edit-task-comment').click();
  await expect(card).toContainText(message);
  expect(await getPersistedComments(data, task)).toContainEqual(
    expect.objectContaining({ id: comment.id, message: comment.message })
  );
});

test('comment author edits the saved comment through the inbox', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const panel = await openInboxTask(page, data, task, data.member);
  const original = `Original ${uuid()}`;
  const saved = await addComment(page, task, original);
  const comment = commentWithMessage(saved.comments, original);
  const card = panel
    .getByTestId('task-comment-card')
    .filter({ hasText: original });
  await card.hover();
  await card.getByTestId('edit-task-comment').click();
  const editor = panel.getByTestId('edit-task-comment-editor');
  const message = `Edited ${uuid()}`;
  await editor.locator('.ql-editor[contenteditable="true"]').fill(message);
  const response = waitForResponseWithStatus(
    page,
    (result) =>
      result.request().method() === 'PATCH' &&
      new URL(result.url()).pathname ===
        `/api/v1/tasks/${task.responseData!.id}/comments/${comment.id}`,
    200
  );
  await editor.getByTestId('send-button').click();
  await response;
  await expect(
    panel.getByTestId('task-comment-card').filter({ hasText: message })
  ).toBeVisible();
  await expect(
    panel.getByTestId('task-comment-card').filter({ hasText: original })
  ).toHaveCount(0);
  expect(
    commentWithMessage(await getPersistedComments(data, task), message).id
  ).toBe(comment.id);
});

test('comment author deletes only the selected comment', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const panel = await openInboxTask(page, data, task, data.member);
  const remove = `Remove ${uuid()}`;
  const keep = `Keep ${uuid()}`;
  const saved = await addComment(page, task, remove);
  const comment = commentWithMessage(saved.comments, remove);
  await addComment(page, task, keep);
  const card = panel
    .getByTestId('task-comment-card')
    .filter({ hasText: remove });
  await card.hover();
  await card.getByTestId('delete-task-comment').click();
  const response = waitForResponseWithStatus(
    page,
    (result) =>
      result.request().method() === 'DELETE' &&
      new URL(result.url()).pathname ===
        `/api/v1/tasks/${task.responseData!.id}/comments/${comment.id}`,
    200
  );
  await page.getByTestId('delete-modal').getByTestId('confirm-button').click();
  await response;
  await expect(card).toHaveCount(0);
  await expect(
    panel.getByTestId('task-comment-card').filter({ hasText: keep })
  ).toBeVisible();
  const comments = await getPersistedComments(data, task);
  expect(comments).toHaveLength(1);
  expect(comments[0].message.replaceAll('\u00a0', ' ')).toBe(keep);
});

test('non-author has no edit or delete controls and both API mutations are forbidden', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const message = `Admin authored ${uuid()}`;
  const saved = await okJson<Task>(
    await data.apiContext.post(
      `/api/v1/tasks/${task.responseData!.id}/comments`,
      { data: { message } }
    ),
    'Seed another author’s comment'
  );
  const comment = commentWithMessage(saved.comments, message);
  const panel = await openInboxTask(page, data, task, data.member);
  const card = panel
    .getByTestId('task-comment-card')
    .filter({ hasText: message });
  await expect(card).toBeVisible();
  await card.hover();
  await expect(card.getByTestId('edit-task-comment')).toHaveCount(0);
  await expect(card.getByTestId('delete-task-comment')).toHaveCount(0);
  const user = await getApiContext(page);
  try {
    const path = `/api/v1/tasks/${task.responseData!.id}/comments/${
      comment.id
    }`;
    expect(
      (
        await user.apiContext.patch(path, {
          data: { message: 'Forbidden change' },
        })
      ).status()
    ).toBe(403);
    expect((await user.apiContext.delete(path)).status()).toBe(403);
    expect(await getPersistedComments(data, task)).toContainEqual(
      expect.objectContaining({ id: comment.id, message: comment.message })
    );
  } finally {
    await user.afterAction();
  }
});

test('comments from separate authors retain their identities', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const adminMessage = `Admin ${uuid()}`;
  await okJson<Task>(
    await data.apiContext.post(
      `/api/v1/tasks/${task.responseData!.id}/comments`,
      { data: { message: adminMessage } }
    ),
    'Seed admin comment'
  );
  const panel = await openInboxTask(page, data, task, data.member);
  const message = `Assignee ${uuid()}`;
  await addComment(page, task, message);
  await expect(panel.getByTestId('task-comment-card')).toHaveCount(2);
  const comments = await getPersistedComments(data, task);
  expect(commentWithMessage(comments, message).author?.name).toBe(
    data.member.responseData.name
  );
  expect(commentWithMessage(comments, adminMessage).author?.name).toBe('admin');
});

test('empty comment cannot be submitted', async ({
  page,
  activityData: data,
}) => {
  const task = await createActivityTask(data, data.member.responseData.name);
  const panel = await openInboxTask(page, data, task, data.member);
  const composer = panel.getByTestId('inbox-comment-composer');
  await expect(composer.getByTestId('send-button')).toBeDisabled();
  await composer.locator('.ql-editor[contenteditable="true"]').fill('   ');
  await expect(composer.getByTestId('send-button')).toBeDisabled();
  expect(await getPersistedComments(data, task)).toHaveLength(0);
});
