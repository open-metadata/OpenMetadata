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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { navigateToArticles } from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';
import { test } from '../fixtures/pages';

const DOMAIN_FILTER_TESTID = 'search-dropdown-Domains';
const OWNER_FILTER_TESTID = 'search-dropdown-Owners';
const TAG_FILTER_TESTID = 'search-dropdown-Tag';
const TIER_FILTER_TESTID = 'search-dropdown-Tier';
const PAGE_INDEX_SEARCH = '/api/v1/search/query';
const REST_LIST = '/api/v1/contextCenter/pages';
const DOMAIN_A_ARTICLE_COUNT = 6;
const DOMAIN_B_ARTICLE_COUNT = 4;

const domainA = new Domain();
const domainB = new Domain();
const classification = new ClassificationClass();
const topicTag = new TagClass({ classification: classification.data.name });

const createdArticleFqns: string[] = [];

const createArticle = async (
  apiContext: APIRequestContext,
  options: {
    displayName: string;
    domainFqn: string;
    tagFqns: string[];
    ownerId: string;
    publicationDate: number;
  }
): Promise<string> => {
  const response = await apiContext.post('/api/v1/contextCenter/pages', {
    data: {
      name: `pw_cc_filter_${uuid()}`,
      displayName: options.displayName,
      description: 'Playwright filter/sort seed article.',
      pageType: 'Article',
      page: { publicationDate: options.publicationDate, relatedArticles: [] },
      owners: [{ id: options.ownerId, type: 'user' }],
      domains: [options.domainFqn],
      tags: options.tagFqns.map((tagFQN) => ({
        tagFQN,
        source: 'Classification',
        labelType: 'Manual',
        state: 'Confirmed',
      })),
    },
  });
  const body = await response.json();

  expect(response.status(), JSON.stringify(body)).toBe(201);

  return body.fullyQualifiedName;
};

const applyDomainFilter = async (page: Page, domainDisplayName: string) => {
  await page.getByTestId(DOMAIN_FILTER_TESTID).click();

  const option = page.getByRole('menuitemcheckbox', {
    name: domainDisplayName,
  });
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.scrollIntoViewIfNeeded();
  await option.click();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(PAGE_INDEX_SEARCH) &&
      response.url().includes('index=page') &&
      response.status() === 200
  );
  await page.getByTestId('update-btn').click();

  return searchResponse;
};

const selectSort = async (page: Page, sortLabel: string) => {
  await page.getByRole('button', { name: /sort/i }).click();
  const menuItem = page.getByRole('menuitemradio', { name: sortLabel });
  await expect(menuItem).toBeVisible();
  await menuItem.click();
  await expect(page.getByTestId('articles-sort-button')).toContainText(
    sortLabel
  );
};

test.describe(
  'Context Center Articles - Filters & Sort',
  { tag: ['@Features', '@Governance'] },
  () => {
    let adminId = '';

    test.beforeAll('Setup entities and articles', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      const adminResponse = await apiContext.get(
        '/api/v1/users/name/admin?fields=id'
      );
      adminId = (await adminResponse.json()).id;

      await domainA.create(apiContext);
      await domainB.create(apiContext);
      await classification.create(apiContext);
      await topicTag.create(apiContext);

      const tagFqns = [
        topicTag.responseData.fullyQualifiedName,
        'Tier.Tier1',
      ];

      for (let i = 0; i < DOMAIN_A_ARTICLE_COUNT; i++) {
        const fqn = await createArticle(apiContext, {
          displayName: `PW Filter Alpha ${String.fromCharCode(65 + i)} ${uuid()}`,
          domainFqn: domainA.responseData.fullyQualifiedName,
          tagFqns,
          ownerId: adminId,
          publicationDate: Date.now() - i * 86_400_000,
        });
        createdArticleFqns.push(fqn);
      }

      for (let i = 0; i < DOMAIN_B_ARTICLE_COUNT; i++) {
        const fqn = await createArticle(apiContext, {
          displayName: `PW Filter Beta ${String.fromCharCode(65 + i)} ${uuid()}`,
          domainFqn: domainB.responseData.fullyQualifiedName,
          tagFqns: [topicTag.responseData.fullyQualifiedName],
          ownerId: adminId,
          publicationDate: Date.now() - i * 43_200_000,
        });
        createdArticleFqns.push(fqn);
      }

      await Promise.all(
        createdArticleFqns.map((fqn) =>
          waitForSearchIndexed(apiContext, fqn, 'page')
        )
      );

      await afterAction();
    });

    test.afterAll('Cleanup entities and articles', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      for (const fqn of createdArticleFqns) {
        const res = await apiContext.get(
          `/api/v1/contextCenter/pages/name/${encodeURIComponent(fqn)}?fields=id`
        );
        if (res.ok()) {
          const { id } = await res.json();
          await apiContext
            .delete(`/api/v1/contextCenter/pages/${id}?hardDelete=true&recursive=true`)
            .catch(() => undefined);
        }
      }

      await topicTag.delete(apiContext);
      await classification.delete(apiContext);
      await domainA.delete(apiContext);
      await domainB.delete(apiContext);

      await afterAction();
    });

    test('renders the filter + sort toolbar', async ({ page }) => {
      await navigateToArticles(page);

      await test.step('Toolbar and controls are visible', async () => {
        await expect(page.getByTestId('articles-list-toolbar')).toBeVisible();
        await expect(page.getByTestId(DOMAIN_FILTER_TESTID)).toBeVisible();
        await expect(page.getByTestId(OWNER_FILTER_TESTID)).toBeVisible();
        await expect(page.getByTestId(TAG_FILTER_TESTID)).toBeVisible();
        await expect(page.getByTestId(TIER_FILTER_TESTID)).toBeVisible();

        const sortButton = page.getByTestId('articles-sort-button');
        await expect(sortButton).toBeVisible();
        await expect(sortButton).toContainText('Recently updated');
      });
    });

    test('domain filter narrows the list and Clear resets it', async ({
      page,
    }) => {
      test.slow();
      await navigateToArticles(page);

      await test.step('Apply domain filter', async () => {
        const searchResponse = await applyDomainFilter(
          page,
          domainA.responseData.displayName
        );
        const response = await searchResponse;
        const body = await response.json();

        expect(body.hits.total.value).toBe(DOMAIN_A_ARTICLE_COUNT);
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('clear-articles-filters')
        ).toBeVisible();
      });

      await test.step('Clear resets to the unfiltered listing', async () => {
        const listResponse = page.waitForResponse(
          (response) =>
            response.url().includes(REST_LIST) && response.status() === 200
        );
        await page.getByTestId('clear-articles-filters').click();
        await listResponse;

        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('clear-articles-filters')
        ).toHaveCount(0);
      });
    });

    test('sort options route to the correct data path', async ({ page }) => {
      test.slow();
      await navigateToArticles(page);

      await test.step('Alphabetical uses the REST list with displayName', async () => {
        const listResponse = page.waitForResponse(
          (response) =>
            response.url().includes(REST_LIST) &&
            response.url().includes('sortBy=displayName') &&
            response.status() === 200
        );
        await selectSort(page, 'Alphabetical');
        await listResponse;
      });

      await test.step('Publication date uses the ES search path', async () => {
        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes(PAGE_INDEX_SEARCH) &&
            response.url().includes('index=page') &&
            response.url().includes('sort_field=page.publicationDate') &&
            response.status() === 200
        );
        await selectSort(page, 'Publication date');
        await searchResponse;
      });

      await test.step('Popularity uses the ES search path', async () => {
        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes(PAGE_INDEX_SEARCH) &&
            response.url().includes('index=page') &&
            response.url().includes('sort_field=totalVotes') &&
            response.status() === 200
        );
        await selectSort(page, 'Popularity');
        await searchResponse;
      });
    });

    test('filters stay applied and consistent across every sort', async ({
      page,
    }) => {
      test.slow();
      await navigateToArticles(page);

      await test.step('Apply domain filter', async () => {
        const searchResponse = await applyDomainFilter(
          page,
          domainA.responseData.displayName
        );
        const response = await searchResponse;
        const body = await response.json();

        expect(body.hits.total.value).toBe(DOMAIN_A_ARTICLE_COUNT);
      });

      for (const sortLabel of [
        'Alphabetical',
        'Publication date',
        'Popularity',
        'Recently updated',
      ]) {
        await test.step(`Filter stays applied under "${sortLabel}"`, async () => {
          const searchResponse = page.waitForResponse(
            (response) =>
              response.url().includes(PAGE_INDEX_SEARCH) &&
              response.url().includes('index=page') &&
              response.status() === 200
          );
          await selectSort(page, sortLabel);
          const response = await searchResponse;
          const body = await response.json();

          expect(body.hits.total.value).toBe(DOMAIN_A_ARTICLE_COUNT);
          await expect(
            page.getByTestId('clear-articles-filters')
          ).toBeVisible();
        });
      }
    });
  }
);
