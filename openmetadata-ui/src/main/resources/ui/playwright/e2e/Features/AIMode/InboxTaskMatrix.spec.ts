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
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import {
  expect,
  test as isolatedTest,
} from '../../../support/fixtures/isolatedUser';
import { UserClass } from '../../../support/user/UserClass';
import { okJson, settleAll } from '../../../utils/apiResponse';
import {
  getWorkerAdminAPIContext,
  selectOptionWithRetry,
  uuid,
} from '../../../utils/common';
import {
  createInboxTask,
  deleteInboxTasks,
  driveInboxTask,
  InboxTask,
  inSequence,
  openInboxTask,
  switchInboxTaskStatus,
  visitTriage,
} from '../../../utils/inbox';
import { waitForSearchIndexed } from '../../../utils/polling';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

/**
 * The Inbox Triage queue against a real workflow: one task type driven through
 * every state its workflow reaches, and the transitions the Inbox drives
 * itself, checked by their effect on the asset. How the panel renders every
 * other type in every state is pure rendering of the task, and is covered by
 * the task matrix in TaskDetailPanel.test.tsx.
 *
 * The tasks are filed by the admin API and assigned to the worker's isolated
 * admin, so the viewer is never the requester and its queue holds only its own
 * tasks. Each task's name carries a unique token, and a test finds it through
 * the queue's server-side search rather than scrolling a shared list.
 */

const COMMENT = 'Playwright task matrix';

type MatrixSeed = {
  cells: Map<string, InboxTask>;
  act: Record<
    'tag' | 'ownership' | 'tier' | 'domain' | 'tierReplace' | 'incident',
    InboxTask
  >;
  reassign: InboxTask;
  testCaseIncident: InboxTask;
  tables: Record<
    'tag' | 'ownership' | 'tier' | 'tierReplace' | 'domain',
    TableClass
  >;
  domain: Domain;
  otherUser: UserClass;
};

const APPROVAL_STATES: Record<string, string[]> = {
  Open: [],
  Approved: ['approve'],
  Rejected: ['reject'],
  Cancelled: ['close'],
};

// The task types the approval tests file and act on.
const ACT_TYPES = {
  tag: { category: 'MetadataUpdate', type: 'TagUpdate' },
  ownership: { category: 'MetadataUpdate', type: 'OwnershipUpdate' },
  tier: { category: 'MetadataUpdate', type: 'TierUpdate' },
  domain: { category: 'MetadataUpdate', type: 'DomainUpdate' },
};

type ActKey = keyof typeof ACT_TYPES;

const tagLabel = (tagFQN: string) => ({
  tagFQN,
  source: 'Classification',
  labelType: 'Manual',
  state: 'Confirmed',
});

const tableLink = (table: TableClass) =>
  `<#E::table::${table.entityResponseData.fullyQualifiedName}>`;

const cellKey = (key: string, state: string) => `${key}:${state}`;

type TaskSpec = {
  name: string;
  category: string;
  type: string;
  about: string;
  payload: Record<string, unknown>;
};

const readTable = async <T>(table: TableClass, fields: string) => {
  const apiContext = await getWorkerAdminAPIContext();

  return okJson<T>(
    await apiContext.get(
      `/api/v1/tables/${table.entityResponseData.id}?fields=${fields}`
    ),
    `Read table ${table.entityResponseData.name}`
  );
};

const tierTags = (tags: { tagFQN: string }[] = []) =>
  tags.map(({ tagFQN }) => tagFQN).filter((fqn) => fqn.startsWith('Tier.'));

const waitForResolve = (page: Page, taskId: string) =>
  waitForResponseWithStatus(
    page,
    (r) =>
      r.url().includes(`/api/v1/tasks/${taskId}/resolve`) &&
      r.request().method() === 'POST',
    200
  );

/** Triage on All, so open and closed tasks both show. */
const openTriage = async (page: Page) => {
  await visitTriage(page);
  await switchInboxTaskStatus(page, 'All');
};

const test = isolatedTest.extend<object, { matrix: MatrixSeed }>({
  matrix: [
    async ({ isolatedUserSession }, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const viewer = isolatedUserSession.user.responseData;
      const run = `pwmx${uuid()}`;
      const tasks: InboxTask[] = [];
      const file = async (
        key: string,
        state: string,
        spec: Omit<TaskSpec, 'name'>
      ) => {
        const name = `${run}_${key}_${state.replace(/\s+/g, '')}`;
        const task = await createInboxTask(apiContext, {
          ...spec,
          name,
          displayName: `Task matrix ${name}`,
          assignee: viewer.name,
        });
        tasks.push(task);

        return task;
      };

      const otherUser = new UserClass();
      // One table serves the rendered Tag requests: those are only read, never
      // approved. Each approval test changes, and so owns, its own table.
      const matrixTable = new TableClass();
      const incidentTable = new TableClass();
      const testCaseTable = new TableClass();
      const tables = {
        tag: new TableClass(),
        ownership: new TableClass(),
        tier: new TableClass(),
        tierReplace: new TableClass(),
        domain: new TableClass(),
      };
      const domain = new Domain();
      const allTables = [
        matrixTable,
        incidentTable,
        testCaseTable,
        ...Object.values(tables),
      ];

      // Removes what was created, also when seeding fails part way: a fixture
      // whose setup throws never reaches the code after `use`.
      const cleanup = async () => {
        // Tasks before the assets they are about; the assets go even if a
        // task delete failed.
        try {
          await deleteInboxTasks(apiContext, tasks);
        } finally {
          await removeAssets();
        }
      };
      const removeAssets = async () => {
        await settleAll(
          allTables
            .filter((table) => table.entityResponseData?.id)
            .map((table) => table.delete(apiContext))
        );
        await settleAll(
          [domain, otherUser]
            .filter((entity) => entity.responseData?.id)
            .map((entity) => entity.delete(apiContext))
        );
      };

      try {
        await settleAll([
          otherUser.create(apiContext),
          domain.create(apiContext),
          ...allTables.map((table) => table.create(apiContext)),
        ]);
        // The tier replacement starts from an existing tier.
        await tables.tierReplace.patch({
          apiContext,
          patchData: [
            { op: 'add', path: '/tags', value: [tagLabel('Tier.Tier3')] },
          ],
        });

        const payloads: Record<ActKey, () => Record<string, unknown>> = {
          tag: () => ({
            operation: 'Add',
            currentTags: [],
            tagsToAdd: [tagLabel('PII.Sensitive')],
          }),
          ownership: () => ({
            currentOwners: [],
            newOwners: [
              {
                id: otherUser.responseData.id,
                type: 'user',
                name: otherUser.responseData.name,
              },
            ],
          }),
          tier: () => ({ newTier: tagLabel('Tier.Tier1') }),
          domain: () => ({
            newDomain: { id: domain.responseData.id, type: 'domain' },
          }),
        };

        const cells = new Map<string, InboxTask>();
        const seedCell = async (
          key: string,
          state: string,
          steps: string[],
          spec: Omit<TaskSpec, 'name'>
        ) => {
          const task = await file(key, state, spec);
          await driveInboxTask(apiContext, task.id, steps);
          cells.set(cellKey(key, state), task);
        };

        // One task at a time: see inSequence.
        for (const [state, steps] of Object.entries(APPROVAL_STATES)) {
          await seedCell('tag', state, steps, {
            ...ACT_TYPES.tag,
            about: tableLink(matrixTable),
            payload: payloads.tag(),
          });
        }

        // Open tasks the transition tests act on through the UI.
        const actSpec = (key: ActKey, table: TableClass) =>
          file(`act-${key}`, 'Open', {
            ...ACT_TYPES[key],
            about: tableLink(table),
            payload: payloads[key](),
          });
        const [
          tag,
          ownership,
          tier,
          domainTask,
          tierReplace,
          incident,
          reassign,
        ] = await inSequence([
          () => actSpec('tag', tables.tag),
          () => actSpec('ownership', tables.ownership),
          () => actSpec('tier', tables.tier),
          () => actSpec('domain', tables.domain),
          () =>
            file('act-tier-replace', 'Open', {
              category: 'MetadataUpdate',
              type: 'TierUpdate',
              about: tableLink(tables.tierReplace),
              payload: {
                currentTier: tagLabel('Tier.Tier3'),
                newTier: tagLabel('Tier.Tier1'),
              },
            }),
          () =>
            file('act-incident', 'Open', {
              category: 'Incident',
              type: 'IncidentResolution',
              about: tableLink(incidentTable),
              payload: { incidentType: 'Volume', severity: 'Medium' },
            }),
          () =>
            file('act-reassign', 'Open', {
              category: 'Incident',
              type: 'IncidentResolution',
              about: tableLink(incidentTable),
              payload: { incidentType: 'Schema', severity: 'Low' },
            }),
        ]);

        // A test-case incident: its task is raised by the incident status API,
        // not by POST /tasks, and is found by its test case's name.
        const testCase = await testCaseTable.createTestCase(apiContext);
        await testCaseTable.addTestCaseResult(
          apiContext,
          testCase.fullyQualifiedName,
          {
            timestamp: Date.now(),
            testCaseStatus: 'Failed',
            result: COMMENT,
          }
        );
        const incidentStatus = await okJson<{ stateId: string }>(
          await apiContext.post(
            '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
            {
              data: {
                testCaseReference: testCase.fullyQualifiedName,
                testCaseResolutionStatusType: 'Assigned',
                severity: 'Severity2',
                testCaseResolutionStatusDetails: {
                  assignee: { id: viewer.id, type: 'user' },
                },
              },
            }
          ),
          'Assign the test case incident'
        );
        const testCaseIncident = {
          id: incidentStatus.stateId,
          name: testCase.name,
        };
        // The incident API files its task on its own; it reaches the viewer's
        // queue once the viewer is its assignee.
        await expect
          .poll(async () => {
            const task = await okJson<{ assignees?: { id: string }[] }>(
              await apiContext.get(
                `/api/v1/tasks/${testCaseIncident.id}?fields=assignees`
              ),
              'Read the test case incident task'
            );

            return (task.assignees ?? []).map(({ id }) => id);
          })
          .toContain(viewer.id);

        // Ownership and reassignment pick this user from the search index.
        await waitForSearchIndexed(
          apiContext,
          otherUser.responseData.fullyQualifiedName,
          'user',
          { timeout: 60_000, intervals: [2_000] }
        );

        await use({
          cells,
          act: {
            tag,
            ownership,
            tier,
            domain: domainTask,
            tierReplace,
            incident,
          },
          reassign,
          testCaseIncident,
          tables,
          domain,
          otherUser,
        });
      } finally {
        await cleanup();
      }
    },
    // Seeding drives a dozen tasks through their workflows over the API.
    { scope: 'worker', timeout: 300_000 },
  ],
});

test.use({ isolatedUserOptions: { isAdmin: true } });
// One worker per shard runs this file, so its tasks are seeded once rather than
// by every worker that picks up one of its tests.
test.describe.configure({ mode: 'default' });

test.describe(
  'Inbox task matrix',
  { tag: ['@Features', DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test('shows a Tag request task in every state', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);

      await test.step('Open: waiting on the viewer, with its own actions', async () => {
        const panel = await openInboxTask(
          page,
          matrix.cells.get(cellKey('tag', 'Open')) as InboxTask
        );
        await expect(panel.getByTestId('task-type-badge')).toHaveText(
          'Tag request'
        );
        await expect(panel.getByTestId('task-status-badge')).toContainText(
          'Pending approval'
        );
        await expect(panel.getByTestId('task-approve')).toHaveText(
          'Approve Tag'
        );
        await expect(panel.getByTestId('task-reject')).toHaveText('Reject');
      });

      for (const state of ['Approved', 'Rejected', 'Cancelled'] as const) {
        await test.step(`${state}: reads as ${state}, with nothing left to do`, async () => {
          const panel = await openInboxTask(
            page,
            matrix.cells.get(cellKey('tag', state)) as InboxTask
          );
          await expect(panel.getByTestId('task-status-badge')).toContainText(
            state
          );
          await expect(panel.getByTestId('task-approve')).toHaveCount(0);
          await expect(panel.getByTestId('task-reject')).toHaveCount(0);
        });
      }
    });

    test('approving a tag request tags the asset', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.act.tag);

      const resolved = waitForResolve(page, matrix.act.tag.id);
      await panel.getByTestId('task-approve').click();
      await resolved;
      await expect(panel.getByTestId('task-status-badge')).toContainText(
        'Approved'
      );

      await expect
        .poll(async () =>
          (
            (
              await readTable<{ tags?: { tagFQN: string }[] }>(
                matrix.tables.tag,
                'tags'
              )
            ).tags ?? []
          ).map(({ tagFQN }) => tagFQN)
        )
        .toContain('PII.Sensitive');
    });

    test('approving an ownership request assigns the proposed owner', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.act.ownership);

      const approve = panel.getByTestId('task-approve');
      await expect(approve).toHaveText(/^Assign /);
      const resolved = waitForResolve(page, matrix.act.ownership.id);
      await approve.click();
      await resolved;
      await expect(panel.getByTestId('task-status-badge')).toContainText(
        'Approved'
      );

      await expect
        .poll(async () =>
          (
            (
              await readTable<{ owners?: { id: string }[] }>(
                matrix.tables.ownership,
                'owners'
              )
            ).owners ?? []
          ).map(({ id }) => id)
        )
        .toContain(matrix.otherUser.responseData.id);
    });

    test('approving a domain request moves the asset into the domain', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.act.domain);

      const resolved = waitForResolve(page, matrix.act.domain.id);
      await panel.getByTestId('task-approve').click();
      await resolved;
      await expect(panel.getByTestId('task-status-badge')).toContainText(
        'Approved'
      );

      await expect
        .poll(async () =>
          (
            (
              await readTable<{ domains?: { id: string }[] }>(
                matrix.tables.domain,
                'domains'
              )
            ).domains ?? []
          ).map(({ id }) => id)
        )
        .toContain(matrix.domain.responseData.id);
    });

    test('approving a tier request sets the new tier', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.act.tier);

      const resolved = waitForResolve(page, matrix.act.tier.id);
      await panel.getByTestId('task-approve').click();
      await resolved;
      await expect(panel.getByTestId('task-status-badge')).toContainText(
        'Approved'
      );

      await expect
        .poll(async () =>
          tierTags(
            (
              await readTable<{ tags?: { tagFQN: string }[] }>(
                matrix.tables.tier,
                'tags'
              )
            ).tags
          )
        )
        .toEqual(['Tier.Tier1']);
    });

    // A TierUpdate must swap the tier, not add a second one: two mutually
    // exclusive tiers block every later write to the asset.
    test('approving a tier request replaces the previous tier', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.act.tierReplace);

      const resolved = waitForResolve(page, matrix.act.tierReplace.id);
      await panel.getByTestId('task-approve').click();
      await resolved;
      await expect(panel.getByTestId('task-status-badge')).toContainText(
        'Approved'
      );

      await expect
        .poll(async () =>
          tierTags(
            (
              await readTable<{ tags?: { tagFQN: string }[] }>(
                matrix.tables.tierReplace,
                'tags'
              )
            ).tags
          )
        )
        .toEqual(['Tier.Tier1']);
    });

    test('an incident is acknowledged, then resolved with a reason', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.act.incident);

      await test.step('Acknowledge takes no input and starts the work', async () => {
        const acknowledge = panel.getByTestId('task-transition-ack');
        await expect(acknowledge).toHaveText('Acknowledge');
        const resolved = waitForResolve(page, matrix.act.incident.id);
        await acknowledge.click();
        await resolved;
        await expect(
          panel.getByTestId('task-transition-resolve')
        ).toBeVisible();
      });

      await test.step('Resolve asks for a reason and a comment', async () => {
        await panel.getByTestId('task-transition-resolve').click();
        const dialog = page.getByTestId('task-action-comment');
        await expect(dialog).toBeVisible();

        const rootCause = page.getByTestId('task-action-root-cause');
        await selectOptionWithRetry(
          rootCause,
          page.getByRole('option', { name: 'FalsePositive' })
        );
        await expect(rootCause).toContainText('FalsePositive');
        await dialog.getByRole('textbox').fill('Resolved by the task matrix.');

        const confirm = page.getByTestId('task-action-comment-confirm');
        await expect(confirm).toBeEnabled();
        const resolved = waitForResolve(page, matrix.act.incident.id);
        await confirm.click();
        await resolved;
        await expect(panel.getByTestId('task-status-badge')).toContainText(
          'Completed'
        );
      });
    });

    test('a test case incident resolves through the reason dialog', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);
      const panel = await openInboxTask(page, matrix.testCaseIncident);
      await expect(panel.getByTestId('task-type-badge')).toHaveText('Incident');

      await panel.getByTestId('task-transition-resolve').click();
      const dialog = page.getByTestId('task-action-comment');
      await expect(dialog).toBeVisible();
      const rootCause = page.getByTestId('task-action-root-cause');
      await selectOptionWithRetry(
        rootCause,
        page.getByRole('option', { name: 'MissingData' })
      );
      await expect(rootCause).toContainText('MissingData');
      await dialog.getByRole('textbox').fill('Resolved by the task matrix.');

      const resolved = waitForResolve(page, matrix.testCaseIncident.id);
      await page.getByTestId('task-action-comment-confirm').click();
      await resolved;
      await expect(panel.getByTestId('task-status-badge')).toContainText(
        'Completed'
      );
      await expect(panel.getByTestId('task-transition-resolve')).toHaveCount(0);
    });

    test('reassigns an incident to another user', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      const { otherUser, reassign } = matrix;
      await openTriage(page);
      const panel = await openInboxTask(page, reassign);

      // The assignee picker is the shared owner picker.
      await panel.getByTestId('task-transition-assign').click();
      const usersTab = page.getByRole('tab', { name: 'Users' });
      await usersTab.click();
      await expect(usersTab).toHaveAttribute('aria-selected', 'true');

      const userSearch = waitForResponseWithStatus(
        page,
        (r) =>
          r.url().includes('/api/v1/search/query') &&
          r.url().includes(encodeURIComponent(otherUser.responseData.name)),
        200
      );
      await page
        .getByTestId('owner-select-users-search-bar')
        .fill(otherUser.responseData.name);
      await userSearch;

      // The picker lists users by display name; one pick applies at once.
      const option = page.getByTestId('owner-option').filter({
        hasText:
          otherUser.responseData.displayName ?? otherUser.responseData.name,
      });
      await expect(option).toBeVisible();
      const resolved = waitForResolve(page, reassign.id);
      await option.click();
      await resolved;

      await expect
        .poll(async () => {
          const apiContext = await getWorkerAdminAPIContext();
          const task = await okJson<{ assignees?: { id: string }[] }>(
            await apiContext.get(
              `/api/v1/tasks/${reassign.id}?fields=assignees`
            ),
            'Read the reassigned task'
          );

          return (task.assignees ?? []).map(({ id }) => id);
        })
        .toContain(otherUser.responseData.id);
      // Now someone else's, the task leaves the viewer's queue.
      await expect(page.getByTestId(`inbox-task-${reassign.id}`)).toHaveCount(
        0
      );
    });
  }
);
