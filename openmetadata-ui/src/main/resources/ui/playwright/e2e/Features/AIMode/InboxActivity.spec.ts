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
import {
  createConversationThread,
  insertActivityEventForTest,
} from '../../../utils/activityAPI';
import { clickFeedReaction } from '../../../utils/activityFeed';
import { okJson, settleAll } from '../../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import {
  createInboxTask,
  createPolicyUser,
  deleteInboxTasks,
  InboxTask,
  searchInboxTask,
  switchActivityFeed,
  switchInboxTab,
  visitInbox,
  visitMyData,
  VIEW_ALL_RULE,
} from '../../../utils/inbox';
import {
  waitForOwnedAssetCount,
  waitForSearchIndexed,
} from '../../../utils/polling';
import { performUserLogin } from '../../../utils/user';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

/**
 * The Inbox's Activity tab. The feed is keyed by actor and capped, so the
 * events are authored by, and viewed as, the worker's isolated admin: the
 * shared admin's feed fills with every other spec's events and buries these.
 */

type ActivitySeed = {
  table: TableClass;
  task: InboxTask;
  scopeUser: UserClass;
  denyUser: UserClass;
  ownerUser: UserClass;
  messages: {
    description: string;
    tags: string;
    owner: string;
    viewerConversation: string;
    scopeConversation: string;
    denyConversation: string;
  };
};

// The All feed re-read for a window narrower than the default 30 days.
const DEFAULT_ACTIVITY_DAYS = '30';
const isNarrowedActivityFetch = (r: Response) => {
  const url = new URL(r.url());

  return (
    r.request().method() === 'GET' &&
    url.pathname === '/api/v1/activity' &&
    url.searchParams.get('days') !== DEFAULT_ACTIVITY_DAYS
  );
};

// The Inbox's conversation fetch is the only one carrying the date window;
// the sidebar's unread query sends startTs alone.
const isInboxConversationFetch = (r: Response) => {
  if (
    r.request().method() !== 'GET' ||
    !r.url().includes('/api/v1/conversations?')
  ) {
    return false;
  }
  const params = new URL(r.url()).searchParams;

  return params.get('startTs') !== null && params.get('endTs') !== null;
};

const isActivityReaction =
  (reaction: string, method: 'PUT' | 'DELETE') => (r: Response) =>
    r.request().method() === method &&
    r.url().includes('/api/v1/activity/') &&
    r.url().endsWith(`/reaction/${reaction}`);

const isReplyPost = (r: Response) =>
  /\/api\/v1\/conversations\/.+\/replies/.test(r.url()) &&
  r.request().method() === 'POST';

const isReplyChange = (method: 'PATCH' | 'DELETE') => (r: Response) =>
  /\/api\/v1\/conversations\/.+\/replies\/.+/.test(r.url()) &&
  r.request().method() === method;

const composerEditor = (scope: Locator) =>
  scope.getByTestId('inbox-comment-composer').locator('.ql-editor');

const feedItem = (page: Page, text: string) =>
  page.getByTestId('activity-feed-item').filter({ hasText: text });

const pickActivityDatePreset = async (page: Page, preset: string) => {
  const dateFilter = page.getByTestId('activity-date-filter');
  await dateFilter.click();
  await page.getByRole('menuitemradio', { name: preset }).click();
  await expect(dateFilter).toContainText(preset);
};

/**
 * Open an activity card's thread. The thread preflights
 * GET /permissions/conversation, and hides delete until it answers.
 */
const openThread = async (page: Page, card: Locator) => {
  const permissions = waitForResponseWithStatus(
    page,
    (r) =>
      r.url().includes('/api/v1/permissions/conversation') &&
      r.request().method() === 'GET',
    200
  );
  await card.getByTestId('activity-reply').click();
  const thread = card.getByTestId('activity-thread');
  await expect(thread).toBeVisible();
  await permissions;

  return thread;
};

const postReply = async (page: Page, thread: Locator, text: string) => {
  const editor = composerEditor(thread);
  await editor.click();
  await editor.fill(text);
  const posted = waitForResponseWithStatus(page, isReplyPost, 201);
  await editor.press('Enter');
  await posted;
  await expect(
    thread.getByTestId('feed-reply-card').filter({ hasText: text })
  ).toBeVisible();
};

// Poll the endpoint the Activity tab reads, so the suite starts only once the
// seeded event is in the feed the UI renders.
const waitForSeededActivity = async (
  apiContext: APIRequestContext,
  userId: string,
  summary: string
) => {
  await expect
    .poll(
      async () => {
        const feed = await okJson<{ data?: { summary?: string }[] }>(
          await apiContext.get(
            `/api/v1/activity/user/${userId}?days=30&limit=200`
          ),
          'Read the viewer activity feed'
        );

        return (feed.data ?? []).some((event) =>
          event.summary?.includes(summary)
        );
      },
      { timeout: 60_000, intervals: [2_000] }
    )
    .toBe(true);
};

const test = isolatedTest.extend<object, { activity: ActivitySeed }>({
  activity: [
    async ({ browser, isolatedUserSession }, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const viewer = isolatedUserSession.user;
      const id = uuid();
      const messages = {
        description: `Inbox description activity ${id}`,
        tags: `Inbox tags activity ${id}`,
        owner: `Inbox owner activity ${id}`,
        viewerConversation: `Inbox viewer conversation ${id}`,
        scopeConversation: `Inbox owned conversation ${id}`,
        denyConversation: `Inbox denied conversation ${id}`,
      };

      // `table` is the viewer's: its events, its conversation, its My Data.
      const table = new TableClass();
      const scopeTable = new TableClass();
      const denyTable = new TableClass();
      const ownerUser = new UserClass();
      const policyUsers: Awaited<ReturnType<typeof createPolicyUser>>[] = [];
      let task: InboxTask | undefined;
      // Removes what was created, also when seeding fails part way: a fixture
      // whose setup throws never reaches the code after `use`.
      const cleanup = async () => {
        await deleteInboxTasks(apiContext, task ? [task] : []);
        await settleAll([
          ...[table, scopeTable, denyTable]
            .filter((entity) => entity.entityResponseData?.id)
            .map((entity) => entity.delete(apiContext)),
          ...(ownerUser.responseData?.id ? [ownerUser.delete(apiContext)] : []),
          ...policyUsers.map((policyUser) => policyUser.cleanup()),
        ]);
      };

      try {
        await settleAll([
          table.create(apiContext),
          scopeTable.create(apiContext),
          denyTable.create(apiContext),
          ownerUser.create(apiContext),
        ]);
        const scope = await createPolicyUser(apiContext, [VIEW_ALL_RULE]);
        policyUsers.push(scope);
        // A deny outranks the OrganizationPolicy isOwner() allow, so even the
        // author's own comments are not deletable.
        const deny = await createPolicyUser(apiContext, [
          VIEW_ALL_RULE,
          {
            name: 'pw-inbox-deny-delete',
            description: 'Deny Delete everywhere.',
            resources: ['All'],
            operations: ['Delete'],
            effect: 'deny',
          },
        ]);
        policyUsers.push(deny);

        await settleAll([
          table.setOwner(apiContext, {
            id: viewer.responseData.id,
            type: 'user',
          }),
          scopeTable.setOwner(apiContext, {
            id: scope.user.responseData.id,
            type: 'user',
          }),
          denyTable.setOwner(apiContext, {
            id: deny.user.responseData.id,
            type: 'user',
          }),
        ]);
        await settleAll([
          createConversationThread(
            apiContext,
            table,
            messages.viewerConversation
          ),
          createConversationThread(
            apiContext,
            scopeTable,
            messages.scopeConversation
          ),
          createConversationThread(
            apiContext,
            denyTable,
            messages.denyConversation
          ),
        ]);

        // test-insert stamps the actor from the calling session, so the events
        // are authored as the viewer and land in its actor-scoped feed.
        const { apiContext: viewerApi, afterAction } = await performUserLogin(
          browser,
          viewer
        );
        try {
          await insertActivityEventForTest(
            viewerApi,
            table,
            messages.description,
            'DescriptionUpdated'
          );
          await insertActivityEventForTest(
            viewerApi,
            table,
            messages.tags,
            'TagsUpdated'
          );
          await insertActivityEventForTest(
            viewerApi,
            table,
            messages.owner,
            'OwnerUpdated'
          );
          for (const summary of [
            messages.description,
            messages.tags,
            messages.owner,
          ]) {
            await waitForSeededActivity(
              viewerApi,
              viewer.responseData.id,
              summary
            );
          }
        } finally {
          await afterAction();
        }

        task = await createInboxTask(apiContext, {
          name: `pw-inbox-activity-${id}`,
          category: 'MetadataUpdate',
          type: 'DescriptionUpdate',
          about: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
          assignee: viewer.responseData.name,
          payload: {
            fieldPath: 'description',
            newDescription: `Described ${id}`,
          },
        });

        // My Data lists the viewer's assets from the search index.
        await waitForOwnedAssetCount(apiContext, viewer.responseData.id, 1, {
          timeout: 60_000,
        });
        // The mention picker reads the search index, not the entity API.
        await waitForSearchIndexed(
          apiContext,
          ownerUser.responseData.fullyQualifiedName,
          'user',
          { timeout: 60_000, intervals: [2_000] }
        );

        await use({
          table,
          task,
          scopeUser: scope.user,
          denyUser: deny.user,
          ownerUser,
          messages,
        });
      } finally {
        await cleanup();
      }
    },
    { scope: 'worker', timeout: 180_000 },
  ],
});

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Inbox — Activity',
  { tag: ['@Features', DOMAIN_TAGS.DISCOVERY] },
  () => {
    test('shows the seeded activity and task on their tabs', async ({
      isolatedUserPage: page,
      activity,
    }) => {
      await visitInbox(page);

      await test.step('My Assets lists the seeded event and conversation, merged', async () => {
        await switchActivityFeed(page, 'My Assets');
        await expect(
          feedItem(page, activity.messages.description)
        ).toBeVisible();
        await expect(
          feedItem(page, activity.messages.viewerConversation)
        ).toBeVisible();
      });

      await test.step('Triage lists the seeded task', async () => {
        await switchInboxTab(page, 'Triage');
        await expect(await searchInboxTask(page, activity.task)).toBeVisible();
      });

      await test.step('Switching back to Activity restores the item', async () => {
        await switchInboxTab(page, 'Activity');
        await switchActivityFeed(page, 'My Assets');
        await expect(
          feedItem(page, activity.messages.description)
        ).toBeVisible();
      });

      await test.step('The sidebar inbox badge shows a count', async () => {
        await expect(page.getByTestId('ai-inbox-badge')).toHaveText(
          /^(\d+|99\+)$/
        );
      });
    });

    // An activity's replies live in a conversation keyed by the activity id;
    // the card opens them inline, under itself.
    test('replies to an activity item in its inline thread', async ({
      isolatedUserPage: page,
      activity,
    }) => {
      await visitInbox(page);
      await switchActivityFeed(page, 'My Assets');
      const card = feedItem(page, activity.messages.description);
      await expect(card).toBeVisible();

      await card.getByTestId('activity-reply').click();
      const thread = card.getByTestId('activity-thread');
      const editor = composerEditor(thread);
      await expect(editor).toBeVisible();

      const reply = `Activity reply ${uuid()}`;
      await editor.click();
      await editor.fill(reply);
      const posted = waitForResponseWithStatus(
        page,
        (r) => {
          const { pathname } = new URL(r.url());

          return (
            r.request().method() === 'POST' &&
            pathname.includes('/api/v1/activity/') &&
            pathname.endsWith('/replies')
          );
        },
        201
      );
      await editor.press('Enter');
      await posted;

      await expect(
        thread.getByTestId('feed-reply-card').filter({ hasText: reply })
      ).toBeVisible();
    });

    test('a non-admin author edits then deletes their own comment', async ({
      browser,
      activity,
    }) => {
      // Runs as the scoped non-admin: the delete is the author path the backend
      // allows through the OrganizationPolicy isOwner() rule.
      const { page, afterAction } = await performUserLogin(
        browser,
        activity.scopeUser
      );

      try {
        await visitInbox(page);
        await switchActivityFeed(page, 'My Assets');
        const card = feedItem(page, activity.messages.scopeConversation);
        await expect(card).toBeVisible();
        const thread = await openThread(page, card);

        const original = `Editable reply ${uuid()}`;
        const edited = `${original} edited`;
        await postReply(page, thread, original);

        await test.step('Edit the comment', async () => {
          const replyCard = thread
            .getByTestId('feed-reply-card')
            .filter({ hasText: original });
          await replyCard.hover();
          await replyCard.getByTestId('edit-message').click();
          const editEditor = replyCard
            .getByTestId('edit-message-editor')
            .locator('.ql-editor');
          await expect(editEditor).toBeVisible();
          await editEditor.fill(edited);
          const patched = waitForResponseWithStatus(
            page,
            isReplyChange('PATCH'),
            200
          );
          await editEditor.press('Enter');
          await patched;
          await expect(
            thread.getByTestId('feed-reply-card').filter({ hasText: edited })
          ).toBeVisible();
        });

        await test.step('Delete the comment through the confirm dialog', async () => {
          const editedCard = thread
            .getByTestId('feed-reply-card')
            .filter({ hasText: edited });
          await editedCard.hover();
          await editedCard.getByTestId('delete-message').click();
          const confirm = page.getByTestId('confirm-button');
          await expect(confirm).toBeEnabled();
          const deleted = waitForResponseWithStatus(
            page,
            isReplyChange('DELETE'),
            200
          );
          await confirm.click();
          await deleted;
          await expect(editedCard).toHaveCount(0);
        });
      } finally {
        await afterAction();
      }
    });

    test('hides the comment delete action when Delete is denied', async ({
      browser,
      activity,
    }) => {
      const { page, afterAction } = await performUserLogin(
        browser,
        activity.denyUser
      );

      try {
        await visitInbox(page);
        await switchActivityFeed(page, 'My Assets');
        const card = feedItem(page, activity.messages.denyConversation);
        await expect(card).toBeVisible();
        const thread = await openThread(page, card);

        // The denied user authors the comment: the strongest case, since even
        // the author must not see delete when the evaluated access is deny.
        const comment = `Undeletable reply ${uuid()}`;
        await postReply(page, thread, comment);

        const replyCard = thread
          .getByTestId('feed-reply-card')
          .filter({ hasText: comment });
        await replyCard.hover();
        // Edit is author-gated and proves the actions row rendered, so a
        // missing delete cannot be a hover miss.
        await expect(replyCard.getByTestId('edit-message')).toBeVisible();
        await expect(replyCard.getByTestId('delete-message')).toHaveCount(0);
      } finally {
        await afterAction();
      }
    });

    test('mentions a user with @ in a conversation comment', async ({
      browser,
      activity,
    }) => {
      const { page, afterAction } = await performUserLogin(
        browser,
        activity.scopeUser
      );

      try {
        await visitInbox(page);
        await switchActivityFeed(page, 'My Assets');
        const card = feedItem(page, activity.messages.scopeConversation);
        await expect(card).toBeVisible();
        await card.getByTestId('activity-reply').click();
        const thread = card.getByTestId('activity-thread');
        const editor = composerEditor(thread);
        await expect(editor).toBeVisible();

        let posted = false;
        page.on('response', (response) => {
          if (isReplyPost(response)) {
            posted = true;
          }
        });

        // A dot-free prefix matches in the picker; the full generated name
        // does not.
        const mentionQuery = activity.ownerUser.responseData.name.split('.')[0];
        await editor.click();
        await page.keyboard.type(`@${mentionQuery}`);

        await test.step('Picking the user inserts the mention without submitting', async () => {
          const mentionItem = page
            .locator('.ql-mention-list-item')
            .filter({ hasText: mentionQuery });
          await expect(mentionItem).toBeVisible();
          await mentionItem.click();
          await expect(editor.getByRole('link')).toBeVisible();
          expect(posted).toBe(false);
        });

        await test.step('Enter posts the comment carrying the mention', async () => {
          // Space-free: the rendered reply uses non-breaking spaces.
          const unique = `review-${uuid()}`;
          await page.keyboard.type(` ${unique}`);
          const post = waitForResponseWithStatus(page, isReplyPost, 201);
          await editor.press('Enter');
          await post;
          const replyCard = thread
            .getByTestId('feed-reply-card')
            .filter({ hasText: unique });
          await expect(replyCard).toBeVisible();
          await expect(replyCard).toContainText(mentionQuery);
        });

        await test.step('The send button posts a comment too', async () => {
          const viaSend = `sendbtn-${uuid()}`;
          await editor.click();
          await page.keyboard.type(viaSend);
          const sendButton = thread
            .getByTestId('inbox-comment-composer')
            .getByTestId('send-button');
          await expect(sendButton).toBeEnabled();
          const post = waitForResponseWithStatus(page, isReplyPost, 201);
          await sendButton.click();
          await post;
          await expect(
            thread.getByTestId('feed-reply-card').filter({ hasText: viaSend })
          ).toBeVisible();
        });
      } finally {
        await afterAction();
      }
    });

    test('refetches the feed for a narrower date range and keeps the label', async ({
      isolatedUserPage: page,
    }) => {
      await visitInbox(page);

      await test.step('A shorter preset re-reads the feed for its window', async () => {
        const refetch = waitForResponseWithStatus(
          page,
          isNarrowedActivityFetch,
          200
        );
        await pickActivityDatePreset(page, 'Last 7 days');
        await refetch;
      });

      await test.step('The label survives a Triage → Activity round trip', async () => {
        await switchInboxTab(page, 'Triage');
        await expect(page.getByTestId('inbox-tasks-tab')).toBeVisible();
        await switchInboxTab(page, 'Activity');
        await expect(page.getByTestId('activity-date-filter')).toContainText(
          'Last 7 days'
        );
      });
    });

    test('likes, reacts to and un-likes an activity item', async ({
      isolatedUserPage: page,
      activity,
    }) => {
      await visitInbox(page);
      await switchActivityFeed(page, 'My Assets');
      const card = feedItem(page, activity.messages.tags);
      await expect(card).toBeVisible();
      const like = card.getByTestId('activity-like');

      await test.step('Like adds a thumbs-up reaction', async () => {
        await expect(like).toHaveAttribute('aria-pressed', 'false');
        const added = waitForResponseWithStatus(
          page,
          isActivityReaction('thumbsUp', 'PUT'),
          200
        );
        await like.click();
        await added;
        await expect(like).toHaveAttribute('aria-pressed', 'true');
      });

      await test.step('Any other emoji joins as its own pill', async () => {
        await card.getByTestId('add-reactions').click();
        const added = waitForResponseWithStatus(
          page,
          isActivityReaction('rocket', 'PUT'),
          200
        );
        await clickFeedReaction(page, 'rocket');
        await added;
        await expect(card.getByTestId('emoji-button')).toBeVisible();
      });

      await test.step('Liking again removes it', async () => {
        const removed = waitForResponseWithStatus(
          page,
          isActivityReaction('thumbsUp', 'DELETE'),
          200
        );
        await like.click();
        await removed;
        await expect(like).toHaveAttribute('aria-pressed', 'false');
      });
    });

    test('caps the date filter to the 30-day window', async ({
      isolatedUserPage: page,
    }) => {
      await visitInbox(page);
      await page.getByTestId('activity-date-filter').click();

      // Presets within the API's 30-day cap are offered; longer ones and a
      // custom range (which the API would silently clamp) are not.
      await expect(
        page.getByRole('menuitemradio', { name: 'Last 30 days' })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitemradio', { name: 'Last 60 days' })
      ).toHaveCount(0);
      await expect(
        page.getByRole('menuitemradio', { name: 'Custom Range' })
      ).toHaveCount(0);
    });

    test('fetches every conversation the viewer can see on All', async ({
      isolatedUserPage: page,
    }) => {
      // All is everything the viewer may see, so its conversation fetch carries
      // no filter. Every sub-tab's count loads too, so match All's by its
      // missing filterType.
      const allConversations = waitForResponseWithStatus(
        page,
        (r) =>
          isInboxConversationFetch(r) &&
          new URL(r.url()).searchParams.get('filterType') === null,
        200
      );
      await visitInbox(page);
      const response = await allConversations;

      expect(new URL(response.url()).searchParams.get('userId')).toBeNull();
    });

    test('words each activity card as a whole sentence', async ({
      isolatedUserPage: page,
      activity,
    }) => {
      await visitInbox(page);
      await switchActivityFeed(page, 'My Assets');

      // The seeded events carry a summary, not a readable before/after, so the
      // sentence names the change without counting it.
      await expect(feedItem(page, activity.messages.tags)).toContainText(
        'changed the tags'
      );
      await expect(feedItem(page, activity.messages.owner)).toContainText(
        'changed the owner'
      );
    });

    // Triage is a work queue: an open task never ages out, so it has no window.
    test('offers no date filter on Triage', async ({
      isolatedUserPage: page,
    }) => {
      await visitInbox(page);
      await expect(page.getByTestId('activity-date-filter')).toBeVisible();
      await switchInboxTab(page, 'Triage');

      await expect(page.getByTestId('inbox-tasks-tab')).toBeVisible();
      await expect(page.getByTestId('activity-date-filter')).toHaveCount(0);
    });

    test('lists owner-scoped conversations for a non-admin on My Assets', async ({
      browser,
      activity,
    }) => {
      const { page, afterAction } = await performUserLogin(
        browser,
        activity.scopeUser
      );

      try {
        // Every sub-tab's count loads with the page, so My Assets' request
        // fires before its tab is picked.
        const ownedConversations = waitForResponseWithStatus(
          page,
          (r) =>
            isInboxConversationFetch(r) &&
            new URL(r.url()).searchParams.get('filterType') === 'OWNER',
          200
        );
        await visitInbox(page);
        await switchActivityFeed(page, 'My Assets');

        await test.step('My Assets scopes the conversation fetch to the user', async () => {
          const response = await ownedConversations;
          expect(new URL(response.url()).searchParams.get('userId')).toBe(
            activity.scopeUser.responseData.id
          );
        });

        const card = feedItem(page, activity.messages.scopeConversation);
        await expect(card).toBeVisible();

        await test.step('Liking the card reacts to the conversation itself', async () => {
          const reacted = waitForResponseWithStatus(
            page,
            (r) =>
              r.request().method() === 'PUT' &&
              r.url().includes('/api/v1/conversations/') &&
              r.url().endsWith('/reaction/thumbsUp') &&
              // The root's reaction, never a reply's.
              !r.url().includes('/replies/'),
            200
          );
          await card.getByTestId('activity-like').click();
          await reacted;
          await expect(card.getByTestId('activity-like')).toHaveAttribute(
            'aria-pressed',
            'true'
          );
        });
      } finally {
        await afterAction();
      }
    });

    test('renders the owned assets and stat cards on My Data', async ({
      isolatedUserPage: page,
      activity,
    }) => {
      await visitMyData(page);

      await expect(page.getByTestId('stat-card-assets-owned')).toBeVisible();
      await expect(page.getByTestId('stat-card-data-health')).toBeVisible();
      await expect(page.getByTestId('stat-card-open-incidents')).toBeVisible();
      await expect(page.getByTestId('stat-card-queries')).toBeVisible();
      // The viewer owns the seeded table, so the list renders, not the empty
      // state.
      await expect(page.getByTestId('my-data-assets')).toContainText(
        activity.table.entityResponseData.displayName ??
          activity.table.entityResponseData.name
      );
      await expect(page.getByTestId('my-data-empty')).toHaveCount(0);
    });
  }
);
