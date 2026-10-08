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
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
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
  TaskStep,
  visitTriage,
} from '../../../utils/inbox';
import { waitForSearchIndexed } from '../../../utils/polling';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

/**
 * Every task type the Inbox Triage queue holds, in every state its workflow
 * reaches, plus the transitions the Inbox drives itself.
 *
 * The tasks are filed by the admin API and assigned to the worker's isolated
 * admin, so the viewer is never the requester and its queue holds only its own
 * tasks. Each task's name carries a unique token, and a test finds it through
 * the queue's server-side search rather than scrolling a shared list.
 */

const COMMENT = 'Playwright task matrix';

type MatrixTask = InboxTask;

type TypeCase = {
  key: string;
  label: string;
  category: string;
  type: string;
  typeBadge: string;
  approveLabel: string | RegExp;
  rejectLabel: string;
};

type MatrixSeed = {
  cells: Map<string, MatrixTask>;
  act: Record<
    'tag' | 'ownership' | 'tier' | 'domain' | 'tierReplace' | 'incident',
    MatrixTask
  >;
  reassign: MatrixTask;
  testCaseIncident: MatrixTask;
  tables: Record<
    'tag' | 'ownership' | 'tier' | 'tierReplace' | 'domain',
    TableClass
  >;
  domain: Domain;
  otherUser: UserClass;
};

const APPROVAL_STATES: Record<string, TaskStep[]> = {
  Open: [],
  Approved: ['approve'],
  Rejected: ['reject'],
  Cancelled: ['close'],
};

const INCIDENT_STATES: Record<string, TaskStep[]> = {
  Open: [],
  'In Progress': ['ack'],
  Completed: ['ack', 'resolve'],
};

// RecognizerFeedbackApproval is left out: its workflow reads the feedback the
// recognizer flow submits, so a task filed directly starts a workflow that
// fails on every run.
const TYPE_CASES: TypeCase[] = [
  {
    key: 'tag',
    label: 'Tag request',
    category: 'MetadataUpdate',
    type: 'TagUpdate',
    typeBadge: 'Tag request',
    approveLabel: 'Approve Tag',
    rejectLabel: 'Reject',
  },
  {
    key: 'description',
    label: 'Description',
    category: 'MetadataUpdate',
    type: 'DescriptionUpdate',
    typeBadge: 'Description',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'ownership',
    label: 'Ownership',
    category: 'MetadataUpdate',
    type: 'OwnershipUpdate',
    typeBadge: 'Ownership',
    approveLabel: /^Assign /,
    rejectLabel: 'Dismiss',
  },
  {
    key: 'tier',
    label: 'Tier',
    category: 'MetadataUpdate',
    type: 'TierUpdate',
    typeBadge: 'Tier',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'domain',
    label: 'Domain',
    category: 'MetadataUpdate',
    type: 'DomainUpdate',
    typeBadge: 'Domain',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'suggestion',
    label: 'Suggestion',
    category: 'MetadataUpdate',
    type: 'Suggestion',
    typeBadge: 'Suggestion',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'approval',
    label: 'Approval request',
    category: 'Approval',
    type: 'RequestApproval',
    typeBadge: 'Approval',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'custom',
    label: 'Custom task',
    category: 'Custom',
    type: 'CustomTask',
    typeBadge: 'Custom task',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'dq-review',
    label: 'Data quality review',
    category: 'Review',
    type: 'DataQualityReview',
    typeBadge: 'Data quality review',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'pipeline-review',
    label: 'Pipeline review',
    category: 'Review',
    type: 'PipelineReview',
    typeBadge: 'Pipeline review',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
  {
    key: 'glossary',
    label: 'Glossary approval',
    category: 'Approval',
    type: 'GlossaryApproval',
    typeBadge: 'Glossary',
    approveLabel: 'Approve',
    rejectLabel: 'Reject',
  },
];

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
      const tasks: MatrixTask[] = [];
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
      // One table serves every rendered task: those are only read, never
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
      const glossary = new Glossary();
      const allTables = [
        matrixTable,
        incidentTable,
        testCaseTable,
        ...Object.values(tables),
      ];

      const glossaryTerm = new GlossaryTerm(glossary);
      // Removes what was created, also when seeding fails part way: a fixture
      // whose setup throws never reaches the code after `use`.
      const cleanup = async () => {
        // Tasks before the assets they are about.
        await deleteInboxTasks(apiContext, tasks);
        await settleAll(
          allTables
            .filter((table) => table.entityResponseData?.id)
            .map((table) => table.delete(apiContext))
        );
        if (glossaryTerm.responseData?.id) {
          await glossaryTerm.delete(apiContext);
        }
        await settleAll(
          [glossary, domain, otherUser]
            .filter((entity) => entity.responseData?.id)
            .map((entity) => entity.delete(apiContext))
        );
      };

      try {
        await settleAll([
          otherUser.create(apiContext),
          domain.create(apiContext),
          glossary.create(apiContext),
          ...allTables.map((table) => table.create(apiContext)),
        ]);
        await glossaryTerm.create(apiContext);
        // The tier replacement starts from an existing tier.
        await tables.tierReplace.patch({
          apiContext,
          patchData: [
            { op: 'add', path: '/tags', value: [tagLabel('Tier.Tier3')] },
          ],
        });

        const payloads: Record<string, () => Record<string, unknown>> = {
          tag: () => ({
            operation: 'Add',
            currentTags: [],
            tagsToAdd: [tagLabel('PII.Sensitive')],
          }),
          description: () => ({
            fieldPath: 'description',
            currentDescription: '',
            newDescription: 'Described by the task matrix.',
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
          suggestion: () => ({
            suggestionType: 'Description',
            fieldPath: 'description',
            suggestedValue: 'Suggested by the task matrix.',
          }),
          'dq-review': () => ({ reviewType: 'DataQuality' }),
          'pipeline-review': () => ({ reviewType: 'Pipeline' }),
          glossary: () => ({
            glossaryTerm: {
              id: glossaryTerm.responseData.id,
              type: 'glossaryTerm',
            },
            action: 'Create',
          }),
        };
        const aboutOf = (key: string) =>
          key === 'glossary'
            ? `<#E::glossaryTerm::${glossaryTerm.responseData.fullyQualifiedName}>`
            : tableLink(matrixTable);

        const cells = new Map<string, MatrixTask>();
        const seedCell = async (
          key: string,
          state: string,
          steps: TaskStep[],
          spec: Omit<TaskSpec, 'name'>
        ) => {
          const task = await file(key, state, spec);
          await driveInboxTask(apiContext, task.id, steps);
          cells.set(cellKey(key, state), task);
        };

        // One task at a time: see inSequence.
        for (const { key, category, type } of TYPE_CASES) {
          for (const [state, steps] of Object.entries(APPROVAL_STATES)) {
            await seedCell(key, state, steps, {
              category,
              type,
              about: aboutOf(key),
              payload: payloads[key]?.() ?? {},
            });
          }
        }
        for (const [state, steps] of Object.entries(INCIDENT_STATES)) {
          await seedCell('incident', state, steps, {
            category: 'Incident',
            type: 'IncidentResolution',
            about: tableLink(incidentTable),
            payload: { incidentType: 'Freshness', severity: 'High' },
          });
        }

        // Open tasks the transition tests act on through the UI.
        const actSpec = (key: string, table: TableClass) => {
          const typeCase = TYPE_CASES.find((c) => c.key === key) as TypeCase;

          return file(`act-${key}`, 'Open', {
            category: typeCase.category,
            type: typeCase.type,
            about: tableLink(table),
            payload: payloads[key](),
          });
        };
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
    // Seeding drives some 60 tasks through their workflows over the API.
    { scope: 'worker', timeout: 300_000 },
  ],
});

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Inbox task matrix',
  { tag: ['@Features', DOMAIN_TAGS.GOVERNANCE] },
  () => {
    for (const typeCase of TYPE_CASES) {
      test(`shows a ${typeCase.label} task in every state`, async ({
        isolatedUserPage: page,
        matrix,
      }) => {
        await openTriage(page);

        await test.step('Open: waiting on the viewer, with its own actions', async () => {
          const panel = await openInboxTask(
            page,
            matrix.cells.get(cellKey(typeCase.key, 'Open')) as MatrixTask
          );
          await expect(panel.getByTestId('task-type-badge')).toHaveText(
            typeCase.typeBadge
          );
          await expect(panel.getByTestId('task-status-badge')).toContainText(
            'Pending approval'
          );
          await expect(panel.getByTestId('task-approve')).toHaveText(
            typeCase.approveLabel
          );
          await expect(panel.getByTestId('task-reject')).toHaveText(
            typeCase.rejectLabel
          );
        });

        for (const state of ['Approved', 'Rejected', 'Cancelled'] as const) {
          await test.step(`${state}: reads as ${state}, with nothing left to do`, async () => {
            const panel = await openInboxTask(
              page,
              matrix.cells.get(cellKey(typeCase.key, state)) as MatrixTask
            );
            await expect(panel.getByTestId('task-status-badge')).toContainText(
              state
            );
            await expect(panel.getByTestId('task-approve')).toHaveCount(0);
            await expect(panel.getByTestId('task-reject')).toHaveCount(0);
          });
        }
      });
    }

    test('shows an incident in every state of its workflow', async ({
      isolatedUserPage: page,
      matrix,
    }) => {
      await openTriage(page);

      const expected: Record<string, string[]> = {
        Open: ['task-transition-ack'],
        'In Progress': ['task-transition-resolve'],
        Completed: [],
      };

      for (const [state, actions] of Object.entries(expected)) {
        await test.step(`${state}: offers ${
          actions.join(', ') || 'nothing'
        }`, async () => {
          const panel = await openInboxTask(
            page,
            matrix.cells.get(cellKey('incident', state)) as MatrixTask
          );
          await expect(panel.getByTestId('task-type-badge')).toHaveText(
            'Incident'
          );
          for (const action of actions) {
            await expect(panel.getByTestId(action)).toBeVisible();
          }
          // An incident resolves through its own transitions, never a generic
          // approve or reject.
          await expect(panel.getByTestId('task-approve')).toHaveCount(0);
          await expect(panel.getByTestId('task-reject')).toHaveCount(0);
        });
      }

      await test.step('Completed: reads as completed', async () => {
        await expect(
          page.getByTestId('task-detail-panel').getByTestId('task-status-badge')
        ).toContainText('Completed');
      });
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
