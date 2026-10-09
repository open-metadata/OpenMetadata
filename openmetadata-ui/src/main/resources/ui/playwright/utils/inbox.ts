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
import {
  APIRequestContext,
  expect,
  Locator,
  Page,
  Response,
} from '@playwright/test';
import { enableAiAppMode } from '../e2e/Utils/appMode';
import {
  PolicyClass,
  PolicyRulesType,
} from '../support/access-control/PoliciesClass';
import { RolesClass } from '../support/access-control/RolesClass';
import { UserClass } from '../support/user/UserClass';
import { assertFulfilled, deleteFixtureEntity, okJson } from './apiResponse';
import { scrollIntoViewAndSettle, selectOptionWithRetry } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { waitForResponseWithStatus } from './waitHelpers';

// The AI shell is heavy to boot; under CPU contention its first paint and the
// Inbox's lazy chunk can outrun the 15s expect default.
export const AI_SHELL_TIMEOUT = 60_000;

export type InboxTab = 'Activity' | 'Triage';
export type ActivityFeedName = 'All' | 'Mentions' | 'My Assets' | 'Following';
export type InboxTaskStatus = 'All' | 'Open' | 'Closed';

/**
 * A tab's accessible name: its label, then its count badge when it has one.
 * The badge reads "99+" past 99 and "<n>+" for a lower bound.
 */
const countedTabName = (label: string) =>
  new RegExp(`^${label}(?:\\s*\\d+\\+?)?$`);

/**
 * Pick a core Dropdown menu item by name. React Aria closes a popover when an
 * ancestor of its trigger scrolls, so the pick is retried until it lands.
 */
export const pickMenuItem = async (
  page: Page,
  trigger: Locator,
  name: string | RegExp
) => {
  await scrollIntoViewAndSettle(trigger);
  await selectOptionWithRetry(
    trigger,
    page.getByRole('menuitemradio', { name })
  );
};

const openAiHome = async (page: Page) => {
  await enableAiAppMode(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ask-sidebar')).toBeVisible({
    timeout: AI_SHELL_TIMEOUT,
  });
};

/**
 * Open the Inbox from the sidebar launcher. A direct `goto('/inbox')` races
 * the AI-mode route registration and can land on a 404.
 */
export const openInboxFromSidebar = async (page: Page) => {
  await openAiHome(page);
  const launcher = page.getByTestId('ai-inbox-icon-btn');
  await expect(launcher).toBeEnabled({ timeout: AI_SHELL_TIMEOUT });
  await launcher.click();
  await expect(page.getByTestId('inbox-page')).toBeVisible({
    timeout: AI_SHELL_TIMEOUT,
  });
  await waitForAllLoadersToDisappear(page);
};

export const switchInboxTab = async (page: Page, tab: InboxTab) => {
  const tabItem = page.getByRole('tab', { name: countedTabName(tab) });
  await tabItem.click();
  await expect(tabItem).toHaveAttribute('aria-selected', 'true');
};

/**
 * Open the Inbox on Activity. The launcher deep-links to Triage when open tasks
 * exist, so the tab is chosen explicitly rather than read from the URL.
 */
export const visitInbox = async (page: Page) => {
  await openInboxFromSidebar(page);
  await switchInboxTab(page, 'Activity');
  await expect(page.getByTestId('inbox-activity-tab')).toBeVisible();
};

/** Open the Inbox on Triage, its task queue. */
export const visitTriage = async (page: Page) => {
  await openInboxFromSidebar(page);
  await switchInboxTab(page, 'Triage');
  await expect(page.getByTestId('inbox-tasks-tab')).toBeVisible();
  await waitForAllLoadersToDisappear(page);
};

/**
 * Open My Data through the sidebar brand: a direct `goto('/my-data')` races
 * the AI-mode route registration as `/inbox` does. The expanded panel and the
 * collapsed rail each draw a brand, so the visible one is used.
 */
export const visitMyData = async (page: Page) => {
  await openAiHome(page);
  const brand = page.getByTestId('ask-logo-btn').filter({ visible: true });
  await expect(brand).toBeVisible({ timeout: AI_SHELL_TIMEOUT });
  await brand.click();
  await expect(page.getByTestId('my-data-page')).toBeVisible({
    timeout: AI_SHELL_TIMEOUT,
  });
};

/** Pick one of the Activity feed's sub-tabs (All, Mentions, …). */
export const switchActivityFeed = async (
  page: Page,
  feed: ActivityFeedName
) => {
  const feedTab = page
    .getByTestId('activity-toolbar')
    .getByRole('tab', { name: countedTabName(feed) });
  await feedTab.click();
  await expect(feedTab).toHaveAttribute('aria-selected', 'true');
};

const isTaskListFetch = (status: InboxTaskStatus) => (r: Response) => {
  if (
    r.request().method() !== 'GET' ||
    !r.url().includes('/api/v1/tasks/visible')
  ) {
    return false;
  }
  const params = new URL(r.url()).searchParams;
  const statusGroup = params.get('statusGroup');

  // The tab badges count with limit=1; the list is the other request.
  return (
    params.get('limit') !== '1' &&
    (status === 'All'
      ? statusGroup === null
      : statusGroup === status.toLowerCase())
  );
};

/**
 * Move Triage to another status. Triage opens on Open, so call this only to
 * leave the current status: clicking the selected tab fetches nothing.
 */
export const switchInboxTaskStatus = async (
  page: Page,
  status: InboxTaskStatus
) => {
  const statusTab = page
    .getByTestId('inbox-tasks-tab')
    .getByRole('tablist')
    .getByRole('tab', { name: countedTabName(status) });
  const listFetch = waitForResponseWithStatus(
    page,
    isTaskListFetch(status),
    200
  );
  await statusTab.click();
  await listFetch;
  await expect(statusTab).toHaveAttribute('aria-selected', 'true');
  await waitForAllLoadersToDisappear(page);
};

/**
 * Narrow the Triage queue to one task by its unique name and return its row.
 * The queue pages and other specs' tasks can sit around it, so a task is found
 * through the server-side search, never by scrolling.
 */
export const searchInboxTask = async (
  page: Page,
  task: { id: string; name: string }
): Promise<Locator> => {
  const search = page.getByTestId('inbox-tasks-search');
  const searchFetch = waitForResponseWithStatus(
    page,
    (r) =>
      r.url().includes('/api/v1/tasks/visible') &&
      new URL(r.url()).searchParams.get('q') === task.name,
    200
  );
  await search.fill(task.name);
  await searchFetch;

  const row = page.getByTestId(`inbox-task-${task.id}`);
  await expect(row).toBeVisible();

  return row;
};

/** Open a task's detail from the Triage queue and return the detail pane. */
export const openInboxTask = async (
  page: Page,
  task: { id: string; name: string }
): Promise<Locator> => {
  const row = await searchInboxTask(page, task);
  await row.click();
  const panel = page.getByTestId('task-detail-panel');
  await expect(panel.getByTestId('task-type-badge')).toBeVisible();

  return panel;
};

export type InboxTask = { id: string; name: string };

/**
 * Run task operations one after another. Creating, resolving or deleting a task
 * starts or stops its workflow, and a burst of them exhausts the workflow
 * engine's connection pool on the server, hanging every task call after it.
 */
export const inSequence = async <T>(
  operations: (() => Promise<T>)[]
): Promise<T[]> => {
  const results: T[] = [];
  for (const operation of operations) {
    results.push(await operation());
  }

  return results;
};

/**
 * Hard-delete seeded tasks one at a time (see {@link inSequence}), attempting
 * every one even after a failure, then reporting all failures together.
 */
export const deleteInboxTasks = async (
  apiContext: APIRequestContext,
  tasks: { id: string }[]
) => {
  const results: PromiseSettledResult<unknown>[] = [];
  for (const { id } of tasks) {
    results.push(
      ...(await Promise.allSettled([
        deleteFixtureEntity(apiContext, `/api/v1/tasks/${id}?hardDelete=true`),
      ]))
    );
  }
  assertFulfilled(results);
};

/**
 * File a task assigned to one user. Its unique `name` is what the Triage
 * search finds it by, and its `displayName` is its title.
 */
export const createInboxTask = async (
  apiContext: APIRequestContext,
  task: {
    name: string;
    displayName?: string;
    category: string;
    type: string;
    about?: string;
    assignee: string;
    payload?: Record<string, unknown>;
  }
): Promise<InboxTask> => {
  const { assignee, displayName, ...rest } = task;
  const created = await okJson<{ id: string }>(
    await apiContext.post('/api/v1/tasks', {
      data: {
        ...rest,
        displayName: displayName ?? task.name,
        priority: 'Medium',
        assignees: [assignee],
        description: `Inbox e2e: ${task.name}`,
      },
    }),
    `Create task ${task.name}`
  );

  return { id: created.id, name: task.name };
};

export const VIEW_ALL_RULE: PolicyRulesType = {
  name: 'pw-inbox-view-all',
  description: 'Allow ViewAll so the user can open the Inbox.',
  resources: ['All'],
  operations: ['ViewAll'],
  effect: 'allow',
};

/**
 * A non-admin user granted `rules` through its own policy and role, with the
 * cleanup that removes all three.
 */
export const createPolicyUser = async (
  apiContext: APIRequestContext,
  rules: PolicyRulesType[]
) => {
  const user = new UserClass();
  const policy = new PolicyClass();
  const role = new RolesClass();
  // Every created entity gets its delete, even after one fails.
  const cleanup = async () => {
    const results: PromiseSettledResult<unknown>[] = [];
    for (const entity of [user, role, policy]) {
      if (entity.responseData?.id) {
        results.push(
          ...(await Promise.allSettled([entity.delete(apiContext)]))
        );
      }
    }
    assertFulfilled(results);
  };

  try {
    await user.create(apiContext);
    await policy.create(apiContext, rules);
    await role.create(apiContext, [policy.responseData.name]);
    await user.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/-',
          value: { id: role.responseData.id, type: 'role' },
        },
      ],
    });
  } catch (error) {
    await cleanup();
    throw error;
  }

  return { user, cleanup };
};

// A step is a workflow transition id, or "close" to cancel the task.

const STEP_COMMENT = 'Playwright inbox seed';

const readTransitionIds = async (
  apiContext: APIRequestContext,
  taskId: string
): Promise<string[]> => {
  const task = await okJson<{ availableTransitions?: { id: string }[] }>(
    await apiContext.get(`/api/v1/tasks/${taskId}?fields=availableTransitions`),
    `Read transitions of task ${taskId}`
  );

  return (task.availableTransitions ?? []).map(({ id }) => id);
};

/**
 * The ids of a task's workflow transitions, once the workflow has attached
 * them: it does so after create answers. A task with no workflow never offers
 * any, so an empty list after the wait means a legacy task.
 */
export const waitForTaskTransitions = async (
  apiContext: APIRequestContext,
  taskId: string
): Promise<string[]> => {
  let transitionIds: string[] = [];
  await expect
    .poll(
      async () => {
        transitionIds = await readTransitionIds(apiContext, taskId);

        return transitionIds.length > 0;
      },
      { timeout: 20_000, intervals: [1_000] }
    )
    .toBe(true)
    .catch(() => undefined);

  return transitionIds;
};

const driveStep = async (
  apiContext: APIRequestContext,
  taskId: string,
  step: string
) => {
  if (step === 'close') {
    await okJson(
      await apiContext.post(
        `/api/v1/tasks/${taskId}/close?comment=${encodeURIComponent(
          STEP_COMMENT
        )}`
      ),
      `Close task ${taskId}`
    );

    return;
  }

  const transitionIds = await waitForTaskTransitions(apiContext, taskId);

  const legacyResolution = { approve: 'Approved', reject: 'Rejected' }[step];
  const offered = transitionIds.includes(step);
  expect(
    offered || (transitionIds.length === 0 && Boolean(legacyResolution)),
    `Task ${taskId} never offered step '${step}'`
  ).toBe(true);

  await okJson(
    await apiContext.post(`/api/v1/tasks/${taskId}/resolve`, {
      data: offered
        ? { transitionId: step, comment: STEP_COMMENT }
        : { resolutionType: legacyResolution, comment: STEP_COMMENT },
    }),
    `Resolve task ${taskId} with '${step}'`
  );
};

/**
 * Drive a task through `steps` with the /resolve calls the Inbox makes. A task
 * with no workflow resolves approve and reject by resolutionType instead.
 */
export const driveInboxTask = async (
  apiContext: APIRequestContext,
  taskId: string,
  steps: string[]
) => {
  for (const step of steps) {
    await driveStep(apiContext, taskId, step);
  }
};
