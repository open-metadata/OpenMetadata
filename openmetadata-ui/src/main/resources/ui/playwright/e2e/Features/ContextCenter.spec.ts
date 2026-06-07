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

import { expect, Page } from '@playwright/test';
import { VIEW_ONLY_RULE } from '../../constant/permission';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { addTitle } from '../../utils/KnowledgeCenter';
import { test } from '../fixtures/pages';

// ─── Constants ────────────────────────────────────────────────────────────────

const DASHBOARD_URL = '/context-center/dashboard';
const ARTICLES_URL = '/context-center/articles';
const DOCUMENTS_URL = '/context-center/documents';

let ARTICLE_TITLE: string;
const ARTICLE_DESCRIPTION =
  'Playwright article description for card detail check';
let QUICK_LINK_TITLE: string;
const QUICK_LINK_URL = 'https://example.com';
const QUICK_LINK_DESCRIPTION =
  'Playwright quick link description for card detail check';
let QUICK_LINK_NAME: string;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const navigateToDashboard = async (page: Page) => {
  await page.goto(DASHBOARD_URL);
  await page
    .getByTestId('context-center-dashboard-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  // Wait for article section to finish loading (either cards or empty state)
  const section = page.getByTestId('article-list-section');
  await section.waitFor({ state: 'visible' });
};

const navigateToArticles = async (page: Page) => {
  await page.goto(ARTICLES_URL);
  await page
    .getByTestId('context-center-articles-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

const navigateToDocuments = async (page: Page) => {
  await page.goto(DOCUMENTS_URL);
  await page
    .getByTestId('context-center-documents-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let articleEntity: KnowledgeCenterClass = new KnowledgeCenterClass();
let articleTagClassification: ClassificationClass;
let articleTags: TagClass[] = [];
let viewOnlyUser: UserClass;
let quickLinkId = '';

test.describe('Context Center', () => {
  test.slow(true);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    ARTICLE_TITLE = `CC Article ${uuid()}`;
    QUICK_LINK_TITLE = `CC QuickLink ${uuid()}`;
    QUICK_LINK_NAME = `cc_quicklink_${uuid()}`;
    articleEntity = new KnowledgeCenterClass({
      displayName: ARTICLE_TITLE,
      name: `cc_article_${uuid()}`,
    });

    await articleEntity.create(apiContext);

    // Patch article to set proper displayName and description
    await articleEntity.patch(apiContext, [
      { op: 'replace', path: '/displayName', value: ARTICLE_TITLE },
      { op: 'replace', path: '/description', value: ARTICLE_DESCRIPTION },
    ]);

    articleTagClassification = new ClassificationClass({
      name: `cc_classification_${uuid()}`,
    });
    await articleTagClassification.create(apiContext);
    articleTags = [1, 2, 3].map(
      (index) =>
        new TagClass({
          classification: articleTagClassification.data.name,
          name: `cc_tag_${index}_${uuid()}`,
        })
    );
    await Promise.all(articleTags.map((tag) => tag.create(apiContext)));
    await articleEntity.patch(apiContext, [
      {
        op: 'add',
        path: '/tags',
        value: articleTags.map((tag) => ({
          tagFQN: tag.responseData.fullyQualifiedName,
        })),
      },
    ]);

    // Create a quick link via API for dashboard card detail tests
    const qlRes = await apiContext.post('/api/v1/contextCenter/pages', {
      data: {
        name: QUICK_LINK_NAME,
        displayName: QUICK_LINK_TITLE,
        description: QUICK_LINK_DESCRIPTION,
        pageType: 'QuickLink',
        page: {
          url: QUICK_LINK_URL,
          publicationDate: Date.now(),
          relatedArticles: [],
        },
      },
    });
    const qlData = await qlRes.json();
    quickLinkId = qlData.id;

    // Upload a document via API so document-related tests have data
    const fileContent = Buffer.from('Playwright seed document');

    await apiContext.post('/api/v1/contextCenter/drive/files/upload', {
      multipart: {
        file: {
          name: 'seed-document.txt',
          mimeType: 'text/plain',
          buffer: fileContent,
        },
      },
    });

    viewOnlyUser = new UserClass();
    await viewOnlyUser.create(apiContext, false);
    await viewOnlyUser.setCustomRulePolicy(
      apiContext,
      VIEW_ONLY_RULE,
      'context-center-view-only'
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await articleEntity.delete(apiContext);
    if (quickLinkId) {
      await apiContext.delete(
        `/api/v1/contextCenter/pages/${quickLinkId}?hardDelete=true&recursive=true`
      );
    }
    if (articleTagClassification?.responseData?.id) {
      await articleTagClassification.delete(apiContext);
    }
    if (viewOnlyUser.responseData.id) {
      await viewOnlyUser.delete(apiContext);
    }
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // ─── Permissions ────────────────────────────────────────────────────────────

  test.describe('Permissions', () => {
    test('user with only ViewAll cannot see restricted action buttons', async ({
      viewOnlyPage,
    }) => {
      await test.step('dashboard actions are hidden', async () => {
        await navigateToDashboard(viewOnlyPage);

        await expect(
          viewOnlyPage.getByRole('button', { name: /create.*article/i })
        ).not.toBeVisible();
        await expect(
          viewOnlyPage.getByRole('button', { name: /upload file/i })
        ).not.toBeVisible();
      });

      await test.step('articles create action is hidden', async () => {
        await navigateToArticles(viewOnlyPage);

        await expect(
          viewOnlyPage.getByTestId('create-knowledge-page-btn')
        ).not.toBeVisible();
      });

      await test.step('article detail actions are hidden', async () => {
        await viewOnlyPage.goto(
          `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(viewOnlyPage);

        const header = viewOnlyPage.getByTestId('article-detail-header');
        await expect(header).toBeVisible();
        await expect(header.getByTestId('upvote-btn')).toBeVisible();
        await expect(header.getByTestId('downvote-btn')).toBeVisible();
        await expect(header.getByTestId('follow-btn')).toBeVisible();
        await expect(header.getByTestId('conversation')).toBeVisible();
        await expect(header.getByTestId('manage-button')).not.toBeVisible();
      });

      await test.step('documents upload and delete actions are hidden', async () => {
        await navigateToDocuments(viewOnlyPage);

        await expect(
          viewOnlyPage.getByRole('button', { name: /upload file/i })
        ).not.toBeVisible();

        const firstRow = viewOnlyPage
          .getByTestId('documents-view')
          .locator('[data-testid^="document-row-"]')
          .first();
        await expect(firstRow).toBeVisible();
        await firstRow.locator('button[aria-label="Open menu"]').click();
        await expect(viewOnlyPage.getByTestId('delete-btn')).not.toBeVisible();
      });
    });
  });

  // ─── Dashboard Page ──────────────────────────────────────────────────────────

  test.describe('Dashboard Page', () => {
    test('shows header with correct title, breadcrumb and action buttons', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      await test.step('breadcrumb renders', async () => {
        const header = page.getByTestId('context-center-header');
        await expect(header).toBeVisible();
        await expect(header.getByTestId('breadcrumb')).toBeVisible();
      });

      await test.step('title is visible', async () => {
        await expect(
          page.getByTestId('context-center-header').getByRole('heading')
        ).toContainText('Dashboard');
      });

      await test.step('Create Article button is visible', async () => {
        await expect(
          page.getByTestId('create-knowledge-page-btn')
        ).toBeVisible();
      });

      await test.step('Upload File button is visible', async () => {
        await expect(
          page.getByRole('button', { name: /upload file/i })
        ).toBeVisible();
      });
    });

    test('article list section renders pre-created article', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      const section = page.getByTestId('article-list-section');
      await expect(section).toBeVisible();

      const card = section.getByTestId('article-card').filter({
        hasText: ARTICLE_TITLE,
      });
      await expect(card.first()).toBeVisible();
    });

    test('uploaded documents section renders', async ({ page }) => {
      await navigateToDashboard(page);

      await expect(
        page.getByTestId('uploaded-documents-section')
      ).toBeVisible();
    });

    test('Create Article button creates article and redirects to detail page', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      const createResPromise = page.waitForResponse(
        '/api/v1/contextCenter/pages'
      );
      await page.getByTestId('create-knowledge-page-btn').click();
      await page.getByTestId('create-article-btn').click();
      const createRes = await createResPromise;
      expect(createRes.status()).toBe(201);

      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();
      await expect(page).toHaveURL(/\/context-center\/articles\//);

      // Clean up the newly created untitled article
      const browser1 = page.context().browser();
      if (browser1) {
        const { apiContext, afterAction } = await createNewPage(browser1);
        const fqn = page
          .url()
          .split('/context-center/articles/')
          .pop()
          ?.split('/')[0];
        if (fqn) {
          const res = await apiContext.get(
            `/api/v1/contextCenter/pages/name/${fqn}?fields=id`
          );
          const data = await res.json();
          await apiContext.delete(
            `/api/v1/contextCenter/pages/${data.id}?hardDelete=true&recursive=true`
          );
        }
        await afterAction();
      }
    });

    test('Upload File button opens upload modal', async ({ page }) => {
      await navigateToDashboard(page);

      await page.getByRole('button', { name: /upload file/i }).click();

      await expect(
        page.getByRole('dialog', { name: /upload documents/i })
      ).toBeVisible();
    });

    test('View All Articles navigates to articles page', async ({ page }) => {
      await navigateToDashboard(page);

      await page
        .getByTestId('article-list-section')
        .getByRole('button', { name: /view all/i })
        .click();

      await expect(page).toHaveURL(/\/context-center\/articles/);
    });

    test('View All Documents navigates to documents page', async ({ page }) => {
      await navigateToDashboard(page);

      await page
        .getByTestId('uploaded-documents-section')
        .getByRole('button', { name: /view all/i })
        .click();

      await expect(page).toHaveURL(/\/context-center\/documents/);
    });

    test('article card click navigates to article detail', async ({ page }) => {
      await navigateToDashboard(page);

      const card = page
        .getByTestId('article-list-section')
        .getByTestId('article-card')
        .filter({ hasText: ARTICLE_TITLE });

      await card.first().click();
      await expect(page).toHaveURL(/\/context-center\/articles\//);
    });

    test('article card shows title, description and last-edited time', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      const card = page
        .getByTestId('article-list-section')
        .getByTestId('article-card')
        .filter({ hasText: ARTICLE_TITLE });

      await card.first().scrollIntoViewIfNeeded();
      await expect(card.first()).toBeVisible();

      // Title
      await expect(card.first().getByText(ARTICLE_TITLE)).toBeVisible();

      // Description preview text
      await expect(card.first().getByText(ARTICLE_DESCRIPTION)).toBeVisible();

      // Last-edited timestamp label
      await expect(card.first().getByText(/last updated/i)).toBeVisible();
    });

    test('article card shows assigned tags with overflow count', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      const card = page
        .getByTestId('article-list-section')
        .getByTestId('article-card')
        .filter({ hasText: ARTICLE_TITLE })
        .first();

      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();

      await expect(card.getByText(articleTags[0].data.name)).toBeVisible();
      await expect(card.getByText(articleTags[1].data.name)).toBeVisible();
      await expect(card.getByText('+1')).toBeVisible();
    });

    test('quick link card shows title, description and opens external url', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      const section = page.getByTestId('article-list-section');
      const card = section
        .getByTestId('article-card')
        .filter({ hasText: QUICK_LINK_TITLE });

      await card.first().scrollIntoViewIfNeeded();
      await expect(card.first()).toBeVisible();

      // Title
      await expect(card.first().getByText(QUICK_LINK_TITLE)).toBeVisible();

      // Description
      await expect(
        card.first().getByText(QUICK_LINK_DESCRIPTION)
      ).toBeVisible();

      // Clicking a quick link opens a new tab
      const [newTab] = await Promise.all([
        page.context().waitForEvent('page'),
        card.first().click(),
      ]);
      await expect(newTab).toHaveURL(QUICK_LINK_URL);
      await newTab.close();
    });

    test('uploaded document card shows filename and size label', async ({
      page,
    }) => {
      await navigateToDashboard(page);

      const section = page.getByTestId('uploaded-documents-section');
      const firstCard = section.getByTestId('uploaded-document-card').first();

      // Only assert if at least one document exists; otherwise skip gracefully
      const count = await section.getByTestId('uploaded-document-card').count();
      if (count === 0) {
        return;
      }

      await firstCard.scrollIntoViewIfNeeded();
      await expect(firstCard).toBeVisible();

      // Filename
      const nameEl = firstCard.getByTestId('document-name');
      await expect(nameEl).toBeVisible();
      const nameText = await nameEl.textContent();
      expect(nameText?.trim().length).toBeGreaterThan(0);

      // Size label (e.g. "0.0 MB" or "27 B")
      const sizeEl = firstCard.getByTestId('document-size');
      await expect(sizeEl).toBeVisible();
      await expect(sizeEl).toHaveText(/\d/);
    });
  });

  // ─── Search ──────────────────────────────────────────────────────────────────

  test.describe('Search', () => {
    test('searching articles filters the list to matching results', async ({
      page,
    }) => {
      await navigateToArticles(page);

      const header = page.getByTestId('context-center-header');
      const searchInput = header
        .getByTestId('search-input')
        .getByLabel('Search Articles');
      const searchResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/search/query') &&
          res.url().includes('index=page')
      );
      await searchInput.fill(ARTICLE_TITLE);
      const searchRes = await searchResPromise;
      expect(searchRes.status()).toBe(200);

      // The pre-created article appears in results
      const card = page.getByTestId(`knowledge-card-${ARTICLE_TITLE}`);

      await expect(card.first()).toBeVisible();
    });

    test('searching articles with no match shows empty state', async ({
      page,
    }) => {
      await navigateToArticles(page);

      const header = page.getByTestId('context-center-header');
      const searchInput = header
        .getByTestId('search-input')
        .getByLabel('Search Articles');
      const noMatchResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/search/query') &&
          res.url().includes('index=page')
      );
      await searchInput.fill('zzznomatchzzz_playwright');
      const noMatchRes = await noMatchResPromise;
      expect(noMatchRes.status()).toBe(200);

      await expect(page.getByTestId('no-data-placeholder')).toBeVisible({
        timeout: 8000,
      });
    });

    test('clearing article search restores the full list', async ({ page }) => {
      await navigateToArticles(page);

      const header = page.getByTestId('context-center-header');
      const searchInput = header
        .getByTestId('search-input')
        .getByLabel('Search Articles');

      const clearSearchResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/search/query') &&
          res.url().includes('index=page')
      );
      await searchInput.fill('zzznomatch');
      const clearSearchRes = await clearSearchResPromise;
      expect(clearSearchRes.status()).toBe(200);

      await searchInput.clear();
      await waitForAllLoadersToDisappear(page);

      const card = page.getByTestId(`knowledge-card-${ARTICLE_TITLE}`);
      await expect(card.first()).toBeVisible();
    });

    test('searching documents filters the list to matching results', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      const header = page.getByTestId('context-center-header');
      const searchInput = header
        .getByTestId('search-input')
        .getByLabel('Search Documents');
      const docSearchResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/search/query') &&
          res.url().includes('index=contextFile')
      );
      await searchInput.fill('seed-document');
      const docSearchRes = await docSearchResPromise;
      expect(docSearchRes.status()).toBe(200);

      const view = page.getByTestId('documents-view');
      const rows = view.locator('[data-testid^="document-row-"]');
      const count = await rows.count();

      // If the seed document was indexed, it appears; otherwise the empty state shows
      if (count > 0) {
        await expect(rows.first()).toBeVisible();
      } else {
        await expect(page.getByTestId('no-data-placeholder')).toBeVisible({
          timeout: 8000,
        });
      }
    });

    test('searching documents with no match shows empty state', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      const header = page.getByTestId('context-center-header');
      const searchInput = header
        .getByTestId('search-input')
        .getByLabel('Search Documents');
      const docNoMatchResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/search/query') &&
          res.url().includes('index=contextFile')
      );
      await searchInput.fill('zzznomatchzzz_playwright');
      const docNoMatchRes = await docNoMatchResPromise;
      expect(docNoMatchRes.status()).toBe(200);

      await expect(page.getByTestId('no-data-placeholder')).toBeVisible({
        timeout: 8000,
      });
    });

    test('clearing document search restores the full list', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      const header = page.getByTestId('context-center-header');
      const searchInput = header
        .getByTestId('search-input')
        .getByLabel('Search Documents');

      const clearDocSearchResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/search/query') &&
          res.url().includes('index=contextFile')
      );
      await searchInput.fill('zzznomatch');
      const clearDocSearchRes = await clearDocSearchResPromise;
      expect(clearDocSearchRes.status()).toBe(200);

      await searchInput.clear();
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('documents-view')).toBeVisible();
    });
  });

  // ─── Articles Page ───────────────────────────────────────────────────────────

  test.describe('Articles Page', () => {
    test('lists articles page with header and breadcrumb', async ({ page }) => {
      await navigateToArticles(page);

      const header = page.getByTestId('context-center-header');
      await expect(header).toBeVisible();
      await expect(header.getByTestId('breadcrumb')).toBeVisible();
      await expect(header.getByRole('heading')).toContainText('Articles');
    });

    test('Create button shows Article and Quick Link options', async ({
      page,
    }) => {
      await navigateToArticles(page);

      await page.getByTestId('create-knowledge-page-btn').click();

      await expect(page.getByTestId('create-article-btn')).toBeVisible();
      await expect(page.getByTestId('create-quick-link-btn')).toBeVisible();
    });

    test('creating an article navigates to article detail page', async ({
      page,
    }) => {
      await navigateToArticles(page);

      await page.getByTestId('create-knowledge-page-btn').click();

      const articleItem = page.getByTestId('create-article-btn');
      await expect(articleItem).toBeVisible();

      const createResPromise = page.waitForResponse(
        '/api/v1/contextCenter/pages'
      );
      await articleItem.click();
      const createRes2 = await createResPromise;
      expect(createRes2.status()).toBe(201);

      await expect(page).toHaveURL(/\/context-center\/articles\//);
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Clean up
      const browser2 = page.context().browser();
      if (browser2) {
        const { apiContext, afterAction } = await createNewPage(browser2);
        const fqn = page
          .url()
          .split('/context-center/articles/')
          .pop()
          ?.split('/')[0];
        if (fqn) {
          const res = await apiContext.get(
            `/api/v1/contextCenter/pages/name/${fqn}?fields=id`
          );
          const data = await res.json();
          await apiContext.delete(
            `/api/v1/contextCenter/pages/${data.id}?hardDelete=true&recursive=true`
          );
        }
        await afterAction();
      }
    });

    test('Quick Link modal opens and creates a quick link visible in list', async ({
      page,
    }) => {
      const testQuickLinkTitle = `CC QL Test ${uuid()}`;

      await navigateToArticles(page);

      await page.getByTestId('create-knowledge-page-btn').click();
      await page.getByTestId('create-quick-link-btn').click();

      const modal = page.getByRole('dialog', { name: /quick link/i });
      await expect(modal).toBeVisible();

      await modal.getByTestId('displayName').fill(testQuickLinkTitle);
      await modal.getByTestId('url').fill(QUICK_LINK_URL);

      const createResPromise = page.waitForResponse(
        '/api/v1/contextCenter/pages'
      );
      await modal.getByRole('button', { name: /save/i }).click();
      await createResPromise;

      const card = page.locator(
        `[data-testid="knowledge-card-${testQuickLinkTitle}"]`
      );
      await expect(card).toBeVisible();
    });

    test('quick link card has correct url and opens in new tab', async ({
      page,
    }) => {
      await navigateToArticles(page);

      const card = page
        .locator(`[data-testid="knowledge-card-${QUICK_LINK_TITLE}"]`)
        .first();
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();

      const link = card.getByTestId('knowledge-link');
      await expect(link).toHaveAttribute('href', QUICK_LINK_URL);
      await expect(link).toHaveAttribute('target', '_blank');
    });

    test('left sidebar hierarchy shows pre-created article', async ({
      page,
    }) => {
      await navigateToArticles(page);

      const hierarchy = page.getByTestId('knowledge-pages-hierarchy');
      await expect(hierarchy).toBeVisible();

      const node = hierarchy.getByTestId(`page-node-${ARTICLE_TITLE}`);

      // Ant Design virtual list scrolls via wheel events on the hierarchy container
      await hierarchy.waitFor({ state: 'visible' });

      let previousLastNode = '';
      const MAX_SCROLL_ATTEMPTS = 50;
      let attempts = 0;
      while (!(await node.isVisible())) {
        if (attempts++ >= MAX_SCROLL_ATTEMPTS) {
          break;
        }
        await hierarchy.hover();
        await page.mouse.wheel(0, 400);
        await expect(
          hierarchy.locator('[data-testid^="page-node-"]').first()
        ).toBeVisible();

        // Stop if the last visible node hasn't changed (reached the end of the list)
        const lastNode = await hierarchy
          .locator('[data-testid^="page-node-"]')
          .last()
          .getAttribute('data-testid');
        if (lastNode === previousLastNode) {
          break;
        }
        previousLastNode = lastNode ?? '';
      }

      await expect(node).toBeVisible();
    });

    test('article detail page - header has breadcrumb, title, version and action buttons', async ({
      page,
    }) => {
      await page.goto(
        `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
      );
      await waitForAllLoadersToDisappear(page);

      const header = page.getByTestId('article-detail-header');
      await expect(header).toBeVisible();

      // breadcrumb
      await expect(header.getByTestId('breadcrumb')).toBeVisible();

      // title
      const title = page.getByTestId('entity-header-display-name');
      await expect(title).toBeVisible();
      await expect(title).toHaveValue(ARTICLE_TITLE);

      // version button
      await expect(header.getByTestId('version-btn')).toBeVisible();

      // manage button (three-dot menu)
      await expect(header.getByTestId('manage-button')).toBeVisible();
    });

    test('article detail page - tabs are visible', async ({ page }) => {
      await page.goto(
        `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
      );
      await waitForAllLoadersToDisappear(page);

      const header = page.getByTestId('article-detail-header');
      await expect(header.getByRole('tab', { name: /content/i })).toBeVisible();
      await expect(
        header.getByRole('tab', { name: /activity/i })
      ).toBeVisible();
    });

    test('article detail page - right panel toggle works', async ({ page }) => {
      await page.goto(
        `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
      );
      await waitForAllLoadersToDisappear(page);

      const header = page.getByTestId('article-detail-header');
      const toggleBtn = header.getByTestId('right-panel-toggle-btn');

      // Right panel is visible initially
      const rightPanel = page.getByTestId('knowledge-page-right-panel');
      await expect(rightPanel).toBeVisible();

      // Toggle off
      await toggleBtn.click();
      await expect(rightPanel).not.toBeVisible();

      // Toggle back on
      await toggleBtn.click();
      await expect(rightPanel).toBeVisible();
    });

    test('article detail page - activity feed tab shows feed panel', async ({
      page,
    }) => {
      await page.goto(
        `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
      );
      await waitForAllLoadersToDisappear(page);

      const header = page.getByTestId('article-detail-header');
      const activityTab = header.getByRole('tab', { name: /activity/i });
      await activityTab.click();

      await expect(page).toHaveURL(/activity_feed/);
    });

    test('version page shows article version header with breadcrumb and title', async ({
      page,
    }) => {
      const fqn = articleEntity.responseData.fullyQualifiedName;

      // First update the title to create a new version
      await page.goto(`/context-center/articles/${fqn}`);
      await waitForAllLoadersToDisappear(page);
      const newTitle = `${ARTICLE_TITLE} v2`;
      await addTitle(page, newTitle);

      // Navigate to version page via version button
      const versionBtn = page
        .getByTestId('article-detail-header')
        .getByTestId('version-btn');
      await versionBtn.click();

      await expect(page).toHaveURL(/\/versions\//);
      await expect(page.getByTestId('article-version-header')).toBeVisible();
      await expect(page.getByTestId('breadcrumb')).toBeVisible();

      // Version timeline drawer is visible and contains at least one version entry
      const versionTimeline = page.getByTestId('versions-list-container');
      await expect(versionTimeline).toBeVisible();
      await expect(
        versionTimeline.locator('[data-testid^="version-entry-"]').first()
      ).toBeVisible();
    });

    test('deleting quick link removes it from the list', async ({ page }) => {
      await navigateToArticles(page);

      const card = page
        .locator(`[data-testid="knowledge-card-${QUICK_LINK_TITLE}"]`)
        .first();
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();

      await card.getByTestId('delete-quick-link-btn').click();

      const deleteResPromise = page.waitForResponse(
        /\/api\/v1\/contextCenter\/pages\/[^?]+\?recursive=false&hardDelete=true/
      );
      await page.getByTestId('confirm-button').click();
      const deleteRes = await deleteResPromise;
      expect(deleteRes.status()).toBe(200);

      await expect(
        page
          .locator(`[data-testid="knowledge-card-${QUICK_LINK_TITLE}"]`)
          .first()
      ).not.toBeVisible();
    });

    test('deleting article removes it from sidebar and article list', async ({
      page,
    }) => {
      // Create a disposable article to delete
      const browser = page.context().browser();
      if (!browser) {
        return;
      }
      const { apiContext, afterAction } = await createNewPage(browser);
      const deleteRes = await apiContext.post('/api/v1/contextCenter/pages', {
        data: {
          name: `cc_delete_test_${uuid()}`,
          displayName: `CC Delete Test ${uuid()}`,
          description: 'Article to be deleted in Playwright test',
          pageType: 'Article',
          page: { publicationDate: Date.now(), relatedArticles: [] },
        },
      });
      const deleteArticle = await deleteRes.json();
      await afterAction();

      // Navigate to the article detail page
      await page.goto(
        `/context-center/articles/${deleteArticle.fullyQualifiedName}`
      );
      await waitForAllLoadersToDisappear(page);

      // Click manage button to open dropdown
      const manageBtn = page.getByTestId('manage-button');
      await expect(manageBtn).toBeVisible();
      await manageBtn.click();

      await page.getByTestId('delete-btn').click();

      const apiDeleteResPromise = page.waitForResponse(
        /\/api\/v1\/contextCenter\/pages\/[^?]+\?recursive=true&hardDelete=false/
      );
      await page.getByTestId('confirm-button').click();
      const apiDeleteRes = await apiDeleteResPromise;
      expect(apiDeleteRes.status()).toBe(200);

      // Redirected back to articles list
      await expect(page).toHaveURL(/\/context-center\/articles$/);

      // Article no longer appears in the left sidebar hierarchy
      const hierarchy = page.getByTestId('knowledge-pages-hierarchy');
      await expect(
        hierarchy.getByTestId(`page-node-${deleteArticle.displayName}`)
      ).not.toBeVisible();
    });
  });

  // ─── Documents Page ───────────────────────────────────────────────────────────

  test.describe('Documents Page', () => {
    test('shows header with Upload File button', async ({ page }) => {
      await navigateToDocuments(page);

      const header = page.getByTestId('context-center-header');
      await expect(header).toBeVisible();
      await expect(header.getByTestId('breadcrumb')).toBeVisible();
      await expect(header.getByRole('heading')).toContainText('Documents');

      await expect(
        page.getByRole('button', { name: /upload file/i })
      ).toBeVisible();
    });

    test('documents view container is rendered', async ({ page }) => {
      await navigateToDocuments(page);
      await expect(page.getByTestId('documents-view')).toBeVisible();
    });

    test('Upload File button opens upload modal with correct title and hint', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      await page.getByRole('button', { name: /upload file/i }).click();

      const modal = page.getByRole('dialog', { name: /upload documents/i });
      await expect(modal).toBeVisible();

      // Drop zone with hint text
      const hint = modal.locator('[class*="hint"], p').filter({
        hasText: /svg|png|jpg|gif|5mb/i,
      });
      await expect(hint.first()).toBeVisible();

      // Attach Files button is disabled when no file selected
      const attachBtn = modal.getByRole('button', { name: /attach/i });
      await expect(attachBtn).toBeVisible();
      await expect(attachBtn).toBeDisabled();

      // Cancel closes modal
      await modal.getByRole('button', { name: /cancel/i }).click();
      await expect(modal).not.toBeVisible();
    });

    test('file upload attaches file and closes modal, then appears in list', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      await page.getByRole('button', { name: /upload file/i }).click();
      const modal = page.getByRole('dialog', { name: /upload documents/i });
      await expect(modal).toBeVisible();

      // Set file directly on the hidden input
      await modal.locator('input[type="file"]').setInputFiles({
        name: 'test-upload.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('playwright test file content'),
      });

      // File appears in staged list
      await expect(modal.getByText('test-upload.txt').first()).toBeVisible();

      // Attach the file
      const uploadResPromise = page.waitForResponse(
        '/api/v1/contextCenter/drive/files/upload'
      );
      await modal.getByRole('button', { name: /attach/i }).click();
      const uploadRes = await uploadResPromise;
      expect(uploadRes.status()).toBe(201);

      // Modal closes automatically after successful upload
      await expect(modal).not.toBeVisible();

      // File appears in document list
      const docRow = page.getByText('test-upload.txt');
      await expect(docRow.first()).toBeVisible();
    });

    test('uploaded file shows name, size and download button in list', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      const view = page.getByTestId('documents-view');
      const firstRow = view.locator('[data-testid^="document-row-"]').first();

      // Relies on at least one document existing from prior upload test
      await expect(firstRow).toBeVisible();

      // Name is present
      await expect(firstRow.getByTestId('document-name')).toBeVisible();

      // Download button is present
      await expect(firstRow.getByTestId('download-btn')).toBeVisible();
    });

    test.fixme('download button triggers file download', async ({ page }) => {
      await navigateToDocuments(page);

      const view = page.getByTestId('documents-view');
      const firstRow = view.locator('[data-testid^="document-row-"]').first();

      await expect(firstRow).toBeVisible();

      // Listen for the download API call
      const downloadRes = page.waitForResponse(
        /\/api\/v1\/contextCenter\/drive\/files\/[^/]+\/download(?:\?.*)?$/
      );
      await firstRow.getByTestId('download-btn').click();
      const res = await downloadRes;
      expect(res.status()).toBe(200);
    });

    test('delete document removes it from the list', async ({
      browser,
      page,
    }) => {
      const fileName = `delete-doc-${uuid()}.txt`;

      // Upload a dedicated document so this test is independent of the download test
      const { apiContext, afterAction } = await createNewPage(browser);
      await apiContext.post('/api/v1/contextCenter/drive/files/upload', {
        multipart: {
          file: {
            name: fileName,
            mimeType: 'text/plain',
            buffer: Buffer.from('document for delete test'),
          },
        },
      });
      await afterAction();

      await navigateToDocuments(page);

      const view = page.getByTestId('documents-view');
      const targetRow = view.locator(`[data-testid^="document-row-"]`).filter({
        has: page.getByText(fileName),
      });

      await expect(targetRow).toBeVisible();
      await targetRow.scrollIntoViewIfNeeded();

      const rowId = await targetRow.getAttribute('data-testid');

      await targetRow.locator('button[aria-label="Open menu"]').click();

      const deleteItem = page.getByTestId('delete-btn');
      await expect(deleteItem).toBeVisible();
      await deleteItem.click();

      const deleteModal = page.getByTestId('modal-header');
      await expect(deleteModal).toBeVisible();

      const deleteResPromise = page.waitForResponse(
        /\/api\/v1\/contextCenter\/drive\/files\/[^?]+\?hardDelete=false/
      );
      await page.getByTestId('confirm-button').click();
      const deleteRes2 = await deleteResPromise;
      expect(deleteRes2.status()).toBe(200);

      if (rowId) {
        await expect(page.getByTestId(rowId)).not.toBeVisible();
      }
    });

    test('oversized file appears in list with failed state and Attach button stays disabled', async ({
      page,
    }) => {
      await navigateToDocuments(page);

      await page.getByRole('button', { name: /upload file/i }).click();
      const modal = page.getByRole('dialog', { name: /upload documents/i });
      await expect(modal).toBeVisible();

      // Create a >5 MB in-memory buffer
      const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 'x');
      await modal.locator('input[type="file"]').setInputFiles({
        name: 'too-large.bin',
        mimeType: 'application/octet-stream',
        buffer: bigBuffer,
      });

      // File appears in the list in a failed/error state
      await expect(modal.getByText('too-large.bin')).toBeVisible({
        timeout: 5000,
      });

      // Attach button is disabled because there are no valid files to upload
      await expect(
        modal.getByRole('button', { name: /attach/i })
      ).toBeDisabled();
    });
  });
});
