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
import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';
import { TagClass } from '../support/tag/TagClass';
import { createAdminApiContext } from './admin';
import { fullUuid, getApiContext } from './common';
import { waitForAllLoadersToDisappear } from './entity';

export const ACTIVITY_EVENT_TIMEOUT = 200_000;
export const ACTIVITY_TEST_TIMEOUT = ACTIVITY_EVENT_TIMEOUT + 60_000;
export const ACTIVITY_FEED_RESPONSE_TIMEOUT = 15_000;
export const FEED_ITEM_TIMEOUT = 30_000;
export const THUMBS_UP_REACTION = 'thumbsUp';
export const THUMBS_UP_EMOJI = '👍';

const JSON_PATCH_CONTENT_TYPE = 'application/json-patch+json';

export type ActivityEventType =
  | 'DescriptionUpdated'
  | 'OwnerUpdated'
  | 'TagsUpdated';

export type ActivityApiEvent = Record<string, unknown> & {
  actor?: { displayName?: string; name?: string };
  eventType?: string;
  summary?: string;
};

export type ActivityApiResponse = {
  data?: ActivityApiEvent[];
};

type FeedThread = {
  id?: string;
  message?: string;
};

type FeedResponse = {
  data?: FeedThread[];
};

export const getTableFqn = (table: TableClass) =>
  table.entityResponseData.fullyQualifiedName ?? '';

export const getTableLeafName = (table: TableClass) =>
  getTableFqn(table).split('.').pop() ?? getTableFqn(table);

const getTableEntityLink = (table: TableClass) =>
  `<#E::table::${getTableFqn(table)}>`;

export const getActivityFeedItems = (page: Page) =>
  page.locator('#center-container').getByTestId('message-container');

export const getFeedItemByText = async (page: Page, text: string) => {
  const feedItem = getActivityFeedItems(page).filter({ hasText: text }).first();

  await expect(feedItem).toBeVisible({ timeout: FEED_ITEM_TIMEOUT });
  await expect(feedItem).toContainText(text);

  return feedItem;
};

export const openActivityFeedAndWaitForApi = async (
  page: Page,
  entityFqn: string
) => {
  const expectedActivityPath = `/api/v1/activity/entity/table/name/${entityFqn}`;
  const activityResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      decodeURIComponent(response.url()).includes(expectedActivityPath) &&
      response.ok(),
    { timeout: ACTIVITY_FEED_RESPONSE_TIMEOUT }
  );

  await page.getByTestId('activity_feed').click();

  const activityResponse = await activityResponsePromise;

  expect(activityResponse.status()).toBe(200);
  await waitForAllLoadersToDisappear(page);

  return (await activityResponse.json()) as ActivityApiResponse;
};

export const visitTableActivityFeed = async (page: Page, table: TableClass) => {
  await table.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  return await openActivityFeedAndWaitForApi(page, getTableFqn(table));
};

export const waitForActivityEvent = async ({
  entityFqn,
  eventType,
  text,
}: {
  entityFqn: string;
  eventType: ActivityEventType;
  text?: string;
}) => {
  const { apiContext, afterAction } = await createAdminApiContext();
  const activityUrl = `/api/v1/activity/entity/table/name/${encodeURIComponent(
    entityFqn
  )}?days=30&limit=50`;
  let events: ActivityApiEvent[] = [];

  let lastStatus = 0;
  let lastEventTypes: string[] = [];

  try {
    try {
      await expect
        .poll(
          async () => {
            const response = await apiContext.get(activityUrl);
            lastStatus = response.status();

            if (!response.ok()) {
              const body = await response.text().catch(() => '');
              throw new Error(
                `Activity API returned ${lastStatus} for ${entityFqn}: ${body}`
              );
            }

            const body = (await response.json()) as ActivityApiResponse;
            events = body.data ?? [];
            lastEventTypes = events.map((e) => e.eventType ?? 'unknown');

            return events.some(
              (event) =>
                event.eventType === eventType &&
                (text === undefined || JSON.stringify(event).includes(text))
            );
          },
          {
            timeout: ACTIVITY_EVENT_TIMEOUT,
            intervals: [5_000, 10_000],
            message: `Waiting for ${eventType} event for ${entityFqn}`,
          }
        )
        .toBe(true);
    } catch (err) {
      if (lastStatus !== 0) {
        throw new Error(
          `Timed out waiting for ${eventType} event for ${entityFqn}. Last status: ${lastStatus}, events found: [${lastEventTypes.join(
            ', '
          )}]`
        );
      }
      throw err;
    }

    return events.find(
      (event) =>
        event.eventType === eventType &&
        (text === undefined || JSON.stringify(event).includes(text))
    );
  } finally {
    await afterAction();
  }
};

const waitForConversationThread = async ({
  apiContext,
  entityLink,
  message,
  threadId,
}: {
  apiContext: APIRequestContext;
  entityLink: string;
  message: string;
  threadId?: string;
}) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get('/api/v1/feed', {
          params: {
            entityLink,
            type: 'Conversation',
            limit: '25',
          },
        });

        if (!response.ok()) {
          return false;
        }

        const data = (await response.json()) as FeedResponse;

        return (data.data ?? []).some(
          (thread) => thread.id === threadId || thread.message === message
        );
      },
      {
        timeout: 60_000,
        intervals: [2_000],
        message: `Timed out waiting for conversation "${message}"`,
      }
    )
    .toBe(true);
};

export const createConversationThread = async (
  apiContext: APIRequestContext,
  table: TableClass,
  message: string
) => {
  const entityLink = getTableEntityLink(table);
  const response = await apiContext.post('/api/v1/feed', {
    data: {
      message,
      about: entityLink,
    },
  });

  expect(response.ok()).toBeTruthy();

  const thread = (await response.json()) as FeedThread;

  await waitForConversationThread({
    apiContext,
    entityLink,
    message,
    threadId: thread.id,
  });

  return thread;
};

export const createConversationThreadFromPage = async (
  page: Page,
  table: TableClass,
  message: string
) => {
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    return await createConversationThread(apiContext, table, message);
  } finally {
    await afterAction();
  }
};

export const patchTableDescription = async (
  apiContext: APIRequestContext,
  table: TableClass,
  description: string
) => {
  const response = await apiContext.patch(
    `/api/v1/tables/${table.entityResponseData.id}`,
    {
      data: [
        {
          op: 'add',
          path: '/description',
          value: description,
        },
      ],
      headers: {
        'Content-Type': JSON_PATCH_CONTENT_TYPE,
      },
    }
  );

  expect(response.ok()).toBeTruthy();
};

export const createDescriptionActivityEventFromPage = async (
  page: Page,
  table: TableClass,
  description: string
) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const entityFqn = getTableFqn(table);

  try {
    await patchTableDescription(apiContext, table, description);
  } finally {
    await afterAction();
  }

  return await waitForActivityEvent({
    entityFqn,
    eventType: 'DescriptionUpdated',
    text: description,
  });
};

/**
 * Inserts an activity event directly into the activity stream via the test-only endpoint,
 * bypassing the async change-event pipeline. Use this in test setup when you need a feed
 * item to exist but are not testing the pipeline itself.
 */
export const insertActivityEventForTest = async (
  apiContext: APIRequestContext,
  table: TableClass,
  text: string
) => {
  const userResponse = await apiContext.get('/api/v1/users/loggedInUser');
  const adminUser = await userResponse.json();
  const tableData = table.entityResponseData;

  const fqn = tableData.fullyQualifiedName ?? '';

  const response = await apiContext.post('/api/v1/activity/test-insert', {
    data: {
      id: fullUuid(),
      eventType: 'DescriptionUpdated',
      about: `<#E::table::${fqn}>`,
      entity: {
        id: tableData.id,
        type: 'table',
        name: tableData.name,
        fullyQualifiedName: fqn,
      },
      actor: { id: adminUser.id, type: 'user' },
      timestamp: Date.now(),
      summary: text,
      newValue: text,
    },
  });

  expect(response.ok()).toBeTruthy();
};

export const addTagToTable = async (
  apiContext: APIRequestContext,
  table: TableClass,
  tag: TagClass
) => {
  const response = await apiContext.patch(
    `/api/v1/tables/${table.entityResponseData.id}`,
    {
      data: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            tagFQN: tag.responseData.fullyQualifiedName,
            source: 'Classification',
          },
        },
      ],
      headers: {
        'Content-Type': JSON_PATCH_CONTENT_TYPE,
      },
    }
  );

  expect(response.ok()).toBeTruthy();
};

export const toggleThumbsUpReaction = async (feedItem: Locator, page: Page) => {
  const addReactionButton = feedItem
    .getByTestId('feed-reaction-container')
    .getByTestId('add-reactions');

  await expect(addReactionButton).toBeVisible();
  await expect(addReactionButton).toBeEnabled();
  await addReactionButton.click();
  await expect(page.locator('.ant-popover-feed-reactions')).toBeVisible();

  const reactionResponse = page.waitForResponse(
    (response) =>
      (response.url().includes('/api/v1/activity') ||
        response.url().includes('/api/v1/feed')) &&
      response.url().includes(`/reaction/${THUMBS_UP_REACTION}`) &&
      response.ok()
  );

  await page
    .locator(`[data-testid="reaction-button"][title="${THUMBS_UP_REACTION}"]`)
    .click();

  const response = await reactionResponse;

  expect(response.ok()).toBeTruthy();
  await waitForAllLoadersToDisappear(page);
};
