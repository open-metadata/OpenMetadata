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
import { Page, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import {
  expect,
  test as base,
} from '../../../support/fixtures/landingPageUser';
import { ignoreClosedTarget } from '../../../support/fixtures/serverLoad';
import { deleteFixtureEntity, okJson } from '../../../utils/apiResponse';
import {
  getWorkerAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';

// The Context Center card kept the Knowledge Center layout key.
const CONTEXT_CENTER_KEY = 'KnowledgePanel.KnowledgeCenter';
const TOPIC_KEY = 'contextCenter';
const PAGES_PATH = '/api/v1/contextCenter/pages';
/** The card lists at most this many pages; the footer opens the rest. */
const MAX_VISIBLE_ROWS = 6;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface KnowledgePage {
  id: string;
  name: string;
  fullyQualifiedName: string;
  updatedAt?: number;
}

interface PagesBody {
  data: KnowledgePage[];
  paging?: { total?: number };
}

const isRecentPagesResponse = (response: Response) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname === PAGES_PATH &&
    url.searchParams.get('sortBy') === 'updatedAt' &&
    url.searchParams.get('sortOrder') === 'desc'
  );
};

/**
 * An article created by the test that reads it.
 *
 * Test-scoped on purpose: the card lists the newest pages server-wide, and the
 * Context Center specs create pages constantly. Created just before the page
 * loads, this one is the newest when the card asks.
 */
const test = base.extend<{ article: KnowledgePage }>({
  // eslint-disable-next-line no-empty-pattern -- Seeded through the worker's admin API context, not a browser.
  article: async ({}, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const name = `pw-landing-article-${uuid()}`;
    const article = await okJson<KnowledgePage>(
      await apiContext.post(PAGES_PATH, {
        data: {
          description: name,
          displayName: name,
          name,
          page: { publicationDate: Date.now(), relatedArticles: [] },
          pageType: 'Article',
        },
      }),
      'Landing page article'
    );

    await use(article);

    await deleteFixtureEntity(
      apiContext,
      `${PAGES_PATH}/${article.id}?hardDelete=true&recursive=true`
    );
  },
});

const openContextCenter = async (page: Page) => {
  const pagesResponse = page.waitForResponse(isRecentPagesResponse);

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, CONTEXT_CENTER_KEY);
  const body = await okJson<PagesBody>(await pagesResponse, 'Recent pages');

  return { body, widget };
};

test.describe(
  'Landing page Context Center',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('lists the most recently updated pages, newest first', async ({
      page,
      article,
    }) => {
      const { body, widget } = await openContextCenter(page);
      const rows = widget.getByTestId('context-center-rows');
      const expectedIds = body.data
        .slice(0, MAX_VISIBLE_ROWS)
        .map((knowledgePage) => `context-page-${knowledgePage.id}`);

      expect(body.data.map((knowledgePage) => knowledgePage.id)).toContain(
        article.id
      );

      // Exactly the pages the card read, in the order it read them: the rows
      // are the digest of that answer, capped, not re-sorted or filtered.
      await expect
        .poll(() =>
          rows
            .locator(':scope > li')
            .evaluateAll((items) =>
              items.map((item) => item.getAttribute('data-testid'))
            )
        )
        .toEqual(expectedIds);
      await expect(
        rows.getByTestId(`context-page-${article.id}`)
      ).toContainText(article.name);
    });

    test('says how many pages changed this week', async ({ page, article }) => {
      const { body, widget } = await openContextCenter(page);
      const card = widget.getByTestId(`topic-card-${TOPIC_KEY}`);
      const since = Date.now() - RECENT_WINDOW_MS;
      const recent = body.data.filter(
        (knowledgePage) => (knowledgePage.updatedAt ?? 0) >= since
      ).length;
      // Every page read was this week and more exist than were read: the count
      // is a floor, and the card says so with a "+".
      const isFloor =
        recent === body.data.length && (body.paging?.total ?? 0) > recent;

      expect(body.data.map((knowledgePage) => knowledgePage.id)).toContain(
        article.id
      );

      await expect(card).toContainText(
        `${recent}${isFloor ? '+' : ''} ${
          recent === 1 ? 'page' : 'pages'
        } updated this week`
      );
      // Something changed this week (the seeded article), so the card does not
      // claim to be caught up. Anchored on the summary above first.
      await expect(card.getByTestId(`topic-status-${TOPIC_KEY}`)).toHaveCount(
        0
      );
    });

    test('opens an article from its row', async ({ page, article }) => {
      const { widget } = await openContextCenter(page);

      await widget.getByTestId(`context-page-open-${article.id}`).click();

      await expect
        .poll(() => decodeURIComponent(new URL(page.url()).pathname))
        .toBe(`/context-center/articles/${article.fullyQualifiedName}`);
    });

    test('the footer opens the Context Center', async ({ page }) => {
      const { widget } = await openContextCenter(page);

      await widget.getByTestId(`topic-action-${TOPIC_KEY}`).click();

      await expect(page).toHaveURL(/\/context-center\/articles$/);
    });

    // No server state can guarantee an empty Context Center while other specs
    // write to it, so the empty answer is served to this page alone.
    test('says when nothing has been published, and offers the first article', async ({
      page,
    }) => {
      await page.route(`**${PAGES_PATH}?*`, async (route) => {
        const url = new URL(route.request().url());

        await ignoreClosedTarget(route, () =>
          url.searchParams.get('sortBy') === 'updatedAt'
            ? route.fulfill({
                json: { data: [], paging: { total: 0 } },
                status: 200,
              })
            : route.fallback()
        );
      });

      const { widget } = await openContextCenter(page);
      const card = widget.getByTestId(`topic-card-${TOPIC_KEY}`);

      await expect(card.getByTestId(`topic-empty-${TOPIC_KEY}`)).toContainText(
        'No articles yet'
      );
      await expect(card.getByTestId('context-center-rows')).toHaveCount(0);
      // Waiting on the first article is not a setup gap, so no header chip —
      // and the footer link into an empty list gives way to the empty state's
      // own call to action.
      await expect(card.getByTestId(`topic-status-${TOPIC_KEY}`)).toHaveCount(
        0
      );
      await expect(card.getByTestId(`topic-action-${TOPIC_KEY}`)).toHaveCount(
        0
      );
      await expect(
        card.getByTestId(`topic-empty-action-${TOPIC_KEY}`)
      ).toBeVisible();
    });
  }
);
