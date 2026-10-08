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
import { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import {
  expect,
  test as isolatedTest,
} from '../../../support/fixtures/isolatedUser';
import { UserClass } from '../../../support/user/UserClass';
import { okJson, settleAll } from '../../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import {
  createInboxTask,
  createPolicyUser,
  deleteInboxTasks,
  driveInboxTask,
  InboxTask,
  inSequence,
  openInboxTask,
  pickMenuItem,
  searchInboxTask,
  switchInboxTaskStatus,
  VIEW_ALL_RULE,
  visitTriage,
  waitForTaskTransitions,
} from '../../../utils/inbox';
import { waitForSearchIndexed } from '../../../utils/polling';
import { performUserLogin } from '../../../utils/user';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

/**
 * The Inbox's Triage queue and task detail. Every task is filed for the
 * worker's isolated admin, so the queue holds this worker's tasks only, and a
 * test finds its task through the queue's server-side search.
 *
 * The generic flows run on description tasks: they carry the workflow's
 * Approve and Reject (Reject asks for a comment) from the moment they are
 * filed, and keep the assignee they were filed with.
 */

type QueueTasks = Record<
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'comment'
  | 'search'
  | 'closed'
  | 'outcome'
  | 'approvalToApprove'
  | 'approvalToReject'
  | 'incident'
  | 'longTitle'
  | 'scoped',
  InboxTask
>;

type QueueSeed = {
  tasks: QueueTasks;
  descriptionTable: TableClass;
  assetTable: TableClass;
  scopeUser: UserClass;
  ownerUser: UserClass;
  suggestedDescription: string;
  longTitle: string;
};

const isResolve = (r: Response) =>
  /\/api\/v1\/tasks\/.+\/resolve/.test(r.url()) &&
  r.request().method() === 'POST';

const isCommentPost = (r: Response) =>
  /\/api\/v1\/tasks\/.+\/comments/.test(r.url()) &&
  r.request().method() === 'POST';

const isCommentChange = (method: 'PATCH' | 'DELETE') => (r: Response) =>
  /\/api\/v1\/tasks\/.+\/comments\/.+/.test(r.url()) &&
  r.request().method() === method;

// The open-task total, read with limit=1 by the sidebar badge and the tabs.
const isOpenTaskCount = (r: Response) => {
  const params = new URL(r.url()).searchParams;

  return (
    r.request().method() === 'GET' &&
    r.url().includes('/api/v1/tasks/visible') &&
    params.get('limit') === '1' &&
    params.get('statusGroup') === 'open' &&
    !params.has('q')
  );
};

const isUnreadMentionsCount = (r: Response) => {
  const params = new URL(r.url()).searchParams;

  return (
    r.request().method() === 'GET' &&
    r.url().includes('/api/v1/conversations?') &&
    params.get('filterType') === 'MENTIONS' &&
    params.get('limit') === '1'
  );
};

const composerEditor = (panel: Locator) =>
  panel.getByTestId('inbox-comment-composer').locator('.ql-editor');

const postTaskComment = async (page: Page, panel: Locator, text: string) => {
  const editor = composerEditor(panel);
  await editor.click();
  await editor.fill(text);
  const posted = waitForResponseWithStatus(page, isCommentPost, 200);
  await editor.press('Enter');
  await posted;
  await expect(
    panel.getByTestId('task-comment-card').filter({ hasText: text })
  ).toBeVisible();
};

const confirmRejectComment = async (page: Page, comment: string) => {
  const commentBox = page
    .getByTestId('task-action-comment')
    .getByRole('textbox');
  await expect(commentBox).toBeVisible();
  await commentBox.fill(comment);
  const confirm = page.getByTestId('task-action-comment-confirm');
  await expect(confirm).toBeEnabled();
  await confirm.click();
};

// A task with a workflow must name one of its own transitions; one without
// must name none and carry its resolution instead. A transition the task does
// not have is what the server rejects with a 400.
const expectResolveBody = (
  body: Record<string, unknown>,
  transitionIds: string[],
  legacy: { resolutionType: string; newValue?: string }
) => {
  if (transitionIds.length > 0) {
    expect(transitionIds).toContain(body.transitionId);

    return;
  }
  expect(body).not.toHaveProperty('transitionId');
  expect(body.resolutionType).toBe(legacy.resolutionType);
  if (legacy.newValue !== undefined) {
    expect(body.newValue).toBe(legacy.newValue);
  }
};

// The UI has loaded the task's actions once its button is enabled, and the
// seed waited for every workflow to attach them, so this is what it sends.
const readTransitionIds = async (taskId: string) =>
  waitForTaskTransitions(await getWorkerAdminAPIContext(), taskId);

const tableLink = (table: TableClass) =>
  `<#E::table::${table.entityResponseData.fullyQualifiedName}>`;

const confirmedTag = (tagFQN: string) => ({
  tagFQN,
  source: 'Classification',
  labelType: 'Manual',
  state: 'Confirmed',
});

const seedQueue = async (
  apiContext: APIRequestContext,
  viewer: UserClass,
  scopeUser: UserClass,
  tables: Record<'base' | 'description' | 'asset', TableClass>,
  id: string,
  created: InboxTask[]
) => {
  const suggestedDescription = `Description suggested by the Inbox e2e ${id}`;
  const longTitle =
    `Inbox e2e long title ${id} ${'that keeps going past the two lines the detail header shows '.repeat(
      5
    )}`.trim();
  const file = async (
    key: string,
    spec: {
      type?: string;
      category?: string;
      about?: string;
      assignee?: string;
      displayName?: string;
      payload?: Record<string, unknown>;
    } = {}
  ) => {
    const task = await createInboxTask(apiContext, {
      name: `pw-inbox-${id}-${key}`,
      category: spec.category ?? 'MetadataUpdate',
      type: spec.type ?? 'DescriptionUpdate',
      about: spec.about ?? tableLink(tables.base),
      assignee: spec.assignee ?? viewer.responseData.name,
      displayName: spec.displayName,
      payload: spec.payload ?? {
        fieldPath: 'description',
        newDescription: `Described by ${key}`,
      },
    });
    created.push(task);

    return task;
  };
  const approval = {
    category: 'Approval',
    type: 'RequestApproval',
    payload: {},
  };

  const [
    approve,
    reject,
    cancel,
    comment,
    search,
    closed,
    outcome,
    approvalToApprove,
    approvalToReject,
    incident,
    longTitleTask,
    scoped,
  ] = await inSequence([
    () =>
      file('approve', {
        about: tableLink(tables.description),
        payload: {
          fieldPath: 'description',
          newDescription: suggestedDescription,
        },
      }),
    () => file('reject'),
    () => file('cancel'),
    () => file('comment', { about: tableLink(tables.asset) }),
    () => file('search'),
    () => file('closed'),
    () => file('outcome'),
    () => file('approval-approve', approval),
    () => file('approval-reject', approval),
    () =>
      file('incident', {
        category: 'Incident',
        type: 'IncidentResolution',
        payload: { incidentType: 'Freshness', severity: 'High' },
      }),
    () => file('long-title', { ...approval, displayName: longTitle }),
    () => file('scoped', { assignee: scopeUser.responseData.name }),
  ]);
  await driveInboxTask(apiContext, closed.id, ['approve']);
  await driveInboxTask(apiContext, outcome.id, ['reject']);
  // Settle every open task's workflow before a test reads it, so the UI and
  // the test see the same transitions.
  await Promise.all(
    created
      .filter(({ id }) => id !== closed.id && id !== outcome.id)
      .map(({ id }) => waitForTaskTransitions(apiContext, id))
  );

  return {
    tasks: {
      approve,
      reject,
      cancel,
      comment,
      search,
      closed,
      outcome,
      approvalToApprove,
      approvalToReject,
      incident,
      longTitle: longTitleTask,
      scoped,
    },
    suggestedDescription,
    longTitle,
  };
};

const test = isolatedTest.extend<object, { queue: QueueSeed }>({
  queue: [
    async ({ isolatedUserSession }, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const viewer = isolatedUserSession.user;
      const id = uuid();
      const tables = {
        base: new TableClass(),
        description: new TableClass(),
        asset: new TableClass(),
      };
      const ownerUser = new UserClass();
      const created: InboxTask[] = [];
      let scope: Awaited<ReturnType<typeof createPolicyUser>> | undefined;
      // Removes what was created, also when seeding fails part way: a fixture
      // whose setup throws never reaches the code after `use`.
      const cleanup = async () => {
        // The tables and users go even if a task delete failed.
        try {
          await deleteInboxTasks(apiContext, created);
        } finally {
          await removeOthers();
        }
      };
      const removeOthers = async () => {
        await settleAll([
          ...Object.values(tables)
            .filter((table) => table.entityResponseData?.id)
            .map((table) => table.delete(apiContext)),
          ...(ownerUser.responseData?.id ? [ownerUser.delete(apiContext)] : []),
          ...(scope ? [scope.cleanup()] : []),
        ]);
      };

      try {
        await settleAll([
          ...Object.values(tables).map((table) => table.create(apiContext)),
          ownerUser.create(apiContext),
        ]);
        // A non-admin that can open the Inbox, so its queue is only its own.
        scope = await createPolicyUser(apiContext, [VIEW_ALL_RULE]);
        // The asset card reads a tier and a PII-tagged column off the table.
        await tables.asset.patch({
          apiContext,
          patchData: [
            { op: 'add', path: '/tags', value: [confirmedTag('Tier.Tier1')] },
            {
              op: 'add',
              path: '/columns/0/tags',
              value: [confirmedTag('PII.Sensitive')],
            },
          ],
        });

        const seeded = await seedQueue(
          apiContext,
          viewer,
          scope.user,
          tables,
          id,
          created
        );

        // The mention picker reads the search index, not the entity API.
        await waitForSearchIndexed(
          apiContext,
          ownerUser.responseData.fullyQualifiedName,
          'user',
          { timeout: 60_000, intervals: [2_000] }
        );

        await use({
          ...seeded,
          descriptionTable: tables.description,
          assetTable: tables.asset,
          scopeUser: scope.user,
          ownerUser,
        });
      } finally {
        await cleanup();
      }
    },
    { scope: 'worker', timeout: 300_000 },
  ],
});

test.use({ isolatedUserOptions: { isAdmin: true } });
// One worker per shard runs this file, so its tasks are seeded once rather than
// by every worker that picks up one of its tests.
test.describe.configure({ mode: 'default' });

test.describe(
  'Inbox — Triage',
  { tag: ['@Features', DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test('approving a description task applies it and leaves the Open queue', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      const task = queue.tasks.approve;
      await visitTriage(page);
      const row = await searchInboxTask(page, task);
      await row.click();
      const panel = page.getByTestId('task-detail-panel');
      await expect(panel).toContainText(task.name);

      await test.step('Approve resolves against the task’s own transitions', async () => {
        const approve = panel.getByTestId('task-approve');
        await expect(approve).toBeEnabled();
        const transitionIds = await readTransitionIds(task.id);
        const resolved = waitForResponseWithStatus(page, isResolve, 200);
        // The tab badges re-count once the task moves.
        const recount = waitForResponseWithStatus(
          page,
          (r) =>
            r.url().includes('/api/v1/tasks/visible') &&
            new URL(r.url()).searchParams.get('limit') === '1',
          200
        );
        await approve.click();
        const response = await resolved;
        await recount;
        expectResolveBody(response.request().postDataJSON(), transitionIds, {
          resolutionType: 'Approved',
          newValue: queue.suggestedDescription,
        });
        await expect(row).toHaveCount(0);
      });

      await test.step('The suggested description is applied to the table', async () => {
        await expect
          .poll(async () => {
            const apiContext = await getWorkerAdminAPIContext();
            const table = await okJson<{ description?: string }>(
              await apiContext.get(
                `/api/v1/tables/${queue.descriptionTable.entityResponseData.id}`
              ),
              'Read the described table'
            );

            return table.description;
          })
          .toBe(queue.suggestedDescription);
      });
    });

    test('rejecting a task asks for a comment and lowers the sidebar count', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      const task = queue.tasks.reject;
      // The badge is open tasks plus unread mentions, each its own request.
      let unread = 0;
      page.on('response', async (response) => {
        if (isUnreadMentionsCount(response) && response.ok()) {
          unread = (await response.json()).paging?.total ?? 0;
        }
      });
      const openCount = waitForResponseWithStatus(page, isOpenTaskCount, 200);
      await visitTriage(page);
      const openBefore = (await (await openCount).json()).paging.total;

      const row = await searchInboxTask(page, task);
      await row.click();
      await expect(page.getByTestId('task-detail-panel')).toContainText(
        task.name
      );

      const reject = page.getByTestId('task-reject');
      await expect(reject).toBeEnabled();
      await reject.click();
      const resolved = waitForResponseWithStatus(page, isResolve, 200);
      const recount = waitForResponseWithStatus(page, isOpenTaskCount, 200);
      await confirmRejectComment(page, 'Rejecting this request via e2e.');
      await resolved;

      await expect(row).toHaveCount(0);
      // The open count re-runs now, not at the next navigation, and the badge
      // follows it.
      expect((await (await recount).json()).paging.total).toBe(openBefore - 1);
      await expect(async () => {
        await expect(page.getByTestId('ai-inbox-badge')).toHaveText(
          String(openBefore - 1 + unread),
          { timeout: 2_000 }
        );
      }).toPass();
    });

    test('approves an approval task, naming a transition only when it has one', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      const task = queue.tasks.approvalToApprove;
      await visitTriage(page);
      const panel = await openInboxTask(page, task);

      const approve = panel.getByTestId('task-approve');
      await expect(approve).toBeEnabled();
      const transitionIds = await readTransitionIds(task.id);
      const resolved = waitForResponseWithStatus(page, isResolve, 200);
      await approve.click();
      const response = await resolved;

      expectResolveBody(response.request().postDataJSON(), transitionIds, {
        resolutionType: 'Approved',
        newValue: 'approved',
      });
      await expect(page.getByTestId(`inbox-task-${task.id}`)).toHaveCount(0);
    });

    test('rejects an approval task through whichever resolve path it has', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      const task = queue.tasks.approvalToReject;
      await visitTriage(page);
      const panel = await openInboxTask(page, task);

      const reject = panel.getByTestId('task-reject');
      await expect(reject).toBeEnabled();
      const transitionIds = await readTransitionIds(task.id);
      const resolved = waitForResponseWithStatus(page, isResolve, 200);
      await reject.click();
      // A workflow's Reject asks for a comment; a legacy one resolves at once.
      if (transitionIds.length > 0) {
        await confirmRejectComment(page, 'Rejecting this request via e2e.');
      }
      const response = await resolved;

      expectResolveBody(response.request().postDataJSON(), transitionIds, {
        resolutionType: 'Rejected',
        newValue: 'rejected',
      });
      await expect(page.getByTestId(`inbox-task-${task.id}`)).toHaveCount(0);
    });

    // An incident resolves through its own transitions (a root cause and a
    // comment), which a generic approve or reject cannot stand in for.
    test('offers no approve or reject on an incident', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const panel = await openInboxTask(page, queue.tasks.incident);

      await expect(panel.getByTestId('task-type-badge')).toHaveText('Incident');
      // Its own action has rendered, so the missing ones are truly absent.
      await expect(panel.getByTestId('task-transition-ack')).toBeVisible();
      await expect(panel.getByTestId('task-approve')).toHaveCount(0);
      await expect(panel.getByTestId('task-reject')).toHaveCount(0);
    });

    test('posts, edits and deletes a task comment', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const panel = await openInboxTask(page, queue.tasks.comment);
      const original = `Editable task reply ${uuid()}`;
      const edited = `${original} (edited)`;

      await postTaskComment(page, panel, original);

      await test.step('Edit the comment', async () => {
        const card = panel
          .getByTestId('task-comment-card')
          .filter({ hasText: original });
        await card.hover();
        await card.getByTestId('edit-task-comment').click();
        const editEditor = card
          .getByTestId('edit-task-comment-editor')
          .locator('.ql-editor');
        await expect(editEditor).toBeVisible();
        await editEditor.fill(edited);
        const patched = waitForResponseWithStatus(
          page,
          isCommentChange('PATCH'),
          200
        );
        await editEditor.press('Enter');
        await patched;
        await expect(
          panel.getByTestId('task-comment-card').filter({ hasText: edited })
        ).toBeVisible();
      });

      await test.step('Delete the comment through the confirm dialog', async () => {
        const card = panel
          .getByTestId('task-comment-card')
          .filter({ hasText: edited });
        await card.hover();
        await card.getByTestId('delete-task-comment').click();
        const confirm = page.getByTestId('confirm-button');
        await expect(confirm).toBeEnabled();
        const deleted = waitForResponseWithStatus(
          page,
          isCommentChange('DELETE'),
          200
        );
        await confirm.click();
        await deleted;
        await expect(card).toHaveCount(0);
      });
    });

    test('reads the task history oldest first, comments included', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const panel = await openInboxTask(page, queue.tasks.comment);

      await expect(panel.getByTestId('task-timeline-event')).toContainText([
        'created this task',
        'Assigned to',
      ]);

      const older = `Older comment ${uuid()}`;
      const newer = `Newer comment ${uuid()}`;
      await postTaskComment(page, panel, older);
      await postTaskComment(page, panel, newer);

      await expect(panel.getByTestId('task-comment-card')).toContainText([
        older,
        newer,
      ]);
    });

    test('inserts a mention on Enter, then submits on the next Enter', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const panel = await openInboxTask(page, queue.tasks.comment);
      const editor = composerEditor(panel);

      let posted = false;
      page.on('response', (response) => {
        if (isCommentPost(response)) {
          posted = true;
        }
      });

      // A dot-free prefix matches in the picker; the full name does not.
      const mentionQuery = queue.ownerUser.responseData.name.split('.')[0];
      await editor.click();
      await page.keyboard.type(`@${mentionQuery}`);

      await test.step('Enter picks the highlighted mention and does not submit', async () => {
        await expect(
          page
            .locator('.ql-mention-list-item')
            .filter({ hasText: mentionQuery })
        ).toBeVisible();
        await editor.press('Enter');
        await expect(editor.getByRole('link')).toBeVisible();
        expect(posted).toBe(false);
      });

      await test.step('A second Enter posts the comment', async () => {
        const unique = `review-${uuid()}`;
        await page.keyboard.type(` ${unique}`);
        const post = waitForResponseWithStatus(page, isCommentPost, 200);
        await editor.press('Enter');
        await post;
        await expect(
          panel.getByTestId('task-comment-card').filter({ hasText: unique })
        ).toBeVisible();
      });
    });

    test('links the task’s asset in the header to its Tasks tab', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const panel = await openInboxTask(page, queue.tasks.comment);

      await panel.getByTestId('task-about-link').click();

      await expect(page).toHaveURL(
        new RegExp(
          `/table/${queue.assetTable.entityResponseData.fullyQualifiedName}/activity_feed/tasks`
        )
      );
    });

    test('shows the task detail as one pane: asset, events and composer', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const panel = await openInboxTask(page, queue.tasks.comment);

      await expect(panel.getByTestId('task-asset-card')).toBeVisible();
      await expect(panel.getByTestId('task-activity-timeline')).toBeVisible();
      await expect(panel.getByTestId('inbox-comment-composer')).toBeVisible();
      // No tab hides half the pane.
      await expect(panel.getByRole('tab')).toHaveCount(0);
    });

    test('shows the asset a task concerns with its tier, PII and columns', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const card = (await openInboxTask(page, queue.tasks.comment)).getByTestId(
        'task-asset-card'
      );

      await expect(card).toContainText(
        queue.assetTable.entityResponseData.displayName ??
          queue.assetTable.entityResponseData.name
      );
      await expect(card).toContainText(/Tier ?1/);
      // Exact, so it is the badge and not the column tile's "1 PII".
      await expect(card.getByText('PII', { exact: true })).toBeVisible();
      await expect(card).toContainText('Columns · 1 PII');
    });

    test('cancelling the reject comment leaves the task untouched', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      let resolved = false;
      page.on('request', (request) => {
        if (/\/api\/v1\/tasks\/.+\/resolve/.test(request.url())) {
          resolved = true;
        }
      });
      await visitTriage(page);
      const row = await searchInboxTask(page, queue.tasks.cancel);
      await row.click();

      const reject = page.getByTestId('task-reject');
      await expect(reject).toBeEnabled();
      await reject.click();
      await expect(page.getByTestId('task-action-comment')).toBeVisible();
      await page.getByTestId('task-action-comment-cancel').click();

      await expect(page.getByTestId('task-action-comment')).toHaveCount(0);
      await expect(row).toBeVisible();
      expect(resolved).toBe(false);
    });

    test('filters the queue across the Open, All and Closed statuses', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);

      await test.step('Open, the default, lists an open task', async () => {
        await expect(
          await searchInboxTask(page, queue.tasks.comment)
        ).toBeVisible();
      });

      await test.step('All keeps the open task', async () => {
        await switchInboxTaskStatus(page, 'All');
        await expect(
          page.getByTestId(`inbox-task-${queue.tasks.comment.id}`)
        ).toBeVisible();
      });

      await test.step('Closed lists the approved task', async () => {
        await switchInboxTaskStatus(page, 'Closed');
        await expect(
          await searchInboxTask(page, queue.tasks.closed)
        ).toBeVisible();
      });
    });

    test('leads a closed task with its outcome', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      await switchInboxTaskStatus(page, 'Closed');
      const panel = await openInboxTask(page, queue.tasks.outcome);

      // "Rejected by admin on Oct 8, 2026": who decided, and when.
      await expect(panel).toContainText(
        /Rejected by .+ on [A-Z][a-z]{2} \d{1,2}, \d{4}/
      );
    });

    test('groups the queue by task type and lists it flat on demand', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const groupBy = page.getByTestId('inbox-tasks-group-by');

      await test.step('By default the queue is grouped under type headers', async () => {
        await expect(groupBy).toContainText('Group: Type');
        await expect(
          page
            .getByTestId('inbox-task-group')
            .filter({ hasText: 'Description' })
        ).toBeVisible();
      });

      await test.step('No grouping drops the headers, keeping the tasks', async () => {
        await pickMenuItem(page, groupBy, 'None');
        await expect(groupBy).toContainText('Group: None');
        await expect(
          await searchInboxTask(page, queue.tasks.comment)
        ).toBeVisible();
        await expect(page.getByTestId('inbox-task-group')).toHaveCount(0);
      });
    });

    test('narrows the queue to the chosen task types', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const typeFilter = page.getByTestId('inbox-tasks-type-filter');
      const groups = page.getByTestId('inbox-task-group');
      const menu = page.getByTestId('drop-down-menu');

      await test.step('Filtering to descriptions leaves only their group', async () => {
        await typeFilter.click();
        await menu.getByTestId('label.description').click();
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);

        await expect(groups).toHaveCount(1);
        await expect(groups).toContainText('Description');
        // Found in the list as it is, not by a search that would also narrow it.
        await expect(
          page.getByTestId(`inbox-task-${queue.tasks.comment.id}`)
        ).toBeVisible();
      });

      await test.step('Clearing the filter brings the other types back', async () => {
        await typeFilter.click();
        await menu.getByTestId('clear-filter-btn').click();
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);

        await expect(groups.filter({ hasText: 'Description' })).toBeVisible();
        await expect(groups.filter({ hasText: 'Incident' })).toBeVisible();
      });
    });

    test('searches the queue on the server without losing focus', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const search = page.getByTestId('inbox-tasks-search');
      const query = queue.tasks.search.name;

      await test.step('Only matching tasks remain, and typing can continue', async () => {
        const searched = waitForResponseWithStatus(
          page,
          (r) =>
            r.url().includes('/api/v1/tasks/visible') &&
            new URL(r.url()).searchParams.get('q') === query,
          200
        );
        await search.fill(query);
        await searched;

        await expect(
          page.getByTestId(`inbox-task-${queue.tasks.search.id}`)
        ).toBeVisible();
        await expect(
          page.getByTestId(`inbox-task-${queue.tasks.comment.id}`)
        ).toHaveCount(0);
        // The detail pane opens the first match with a comment composer; it
        // must not pull focus out of the search box.
        await expect(page.getByTestId('task-detail-panel')).toContainText(
          queue.tasks.search.name
        );
        await expect(search).toBeFocused();
      });

      await test.step('Clearing the search restores the full queue', async () => {
        await search.fill('');
        await expect(
          page.getByTestId(`inbox-task-${queue.tasks.comment.id}`)
        ).toBeVisible();
      });
    });

    test('scopes a non-admin’s queue to their own tasks', async ({
      browser,
      queue,
    }) => {
      const { page, afterAction } = await performUserLogin(
        browser,
        queue.scopeUser
      );

      try {
        await visitTriage(page);

        await test.step('Their own task is listed', async () => {
          await expect(
            await searchInboxTask(page, queue.tasks.scoped)
          ).toBeVisible();
        });

        await test.step('Someone else’s task is not', async () => {
          const searched = waitForResponseWithStatus(
            page,
            (r) =>
              r.url().includes('/api/v1/tasks/visible') &&
              new URL(r.url()).searchParams.get('q') ===
                queue.tasks.comment.name,
            200
          );
          await page
            .getByTestId('inbox-tasks-search')
            .fill(queue.tasks.comment.name);
          const response = await searched;
          const body = (await response.json()) as { data?: { id: string }[] };

          expect((body.data ?? []).map((task) => task.id)).not.toContain(
            queue.tasks.comment.id
          );
          await expect(
            page.getByTestId(`inbox-task-${queue.tasks.comment.id}`)
          ).toHaveCount(0);
        });

        await test.step('With nothing closed, Closed shows its empty state', async () => {
          await page.getByTestId('inbox-tasks-search').fill('');
          await switchInboxTaskStatus(page, 'Closed');
          await expect(
            page.getByTestId('inbox-tasks-closed-empty')
          ).toBeVisible();
        });
      } finally {
        await afterAction();
      }
    });

    test('shows a clamped title in full in a tooltip', async ({
      isolatedUserPage: page,
      queue,
    }) => {
      await visitTriage(page);
      const title = (
        await openInboxTask(page, queue.tasks.longTitle)
      ).getByTestId('clamped-text');
      await expect(title).toBeVisible();

      await title.hover();

      await expect(page.getByRole('tooltip')).toContainText(queue.longTitle);
    });
  }
);
