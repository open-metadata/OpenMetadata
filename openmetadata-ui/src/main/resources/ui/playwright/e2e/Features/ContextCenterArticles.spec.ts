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

import { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  ARTICLE_DESCRIPTION,
  assertArticleEditorSaved,
  cleanupCurrentArticle,
  createArticleFromButton,
  createArticleViaApi,
  createQuickLinkViaApi,
  deleteArticleByFqn,
  getArticleFqnFromUrl,
  navigateToArticle,
  navigateToArticles,
  navigateToDashboard,
  QUICK_LINK_DESCRIPTION,
  QUICK_LINK_URL,
  scrollHierarchyToNode,
  scrollListingToCard,
  verifyArticleSearch,
} from '../../utils/ContextCenterUtil';
import {
  addMultiOwner,
  visitEntityPage,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  addTitle,
  createMentionInConversation,
  createQuickLink,
  deletePage,
  getKnowledgePageCardByIndex,
  getKnowledgePageCardEntityIdentifier,
  readArticleInHierarchy,
  readQuickLink,
  toggleKnowledgePageBookmark,
  updateBody,
  updateQuickLink,
  updateTags,
  verifyNotificationAndClick,
} from '../../utils/KnowledgeCenter';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';
import {
  runAdvancedBlocksTest,
  runContentPersistenceTest,
  runEditorOperationsTest,
  runNestedListsTest,
  runSlashCommandsAndBasicBlocksTest,
  runTextFormattingTest,
} from './KnowledgeCenterTextEditor.common';

const RELATED_QUICK_LINK_URL = 'https://docs.open-metadata.org';
const UPDATED_QUICK_LINK_URL = 'https://docs.open-metadata.org/quick-link';
const MIN_CARDS = 10;

let articleEntity: KnowledgeCenterClass;
let articleTagClassification: ClassificationClass;
let articleTags: TagClass[] = [];
let quickLinkId = '';
let quickLinkTitle = '';
let quickLinkName = '';
let listKnowledgeCenter: KnowledgeCenterClass;
let editorKnowledgeCenter: KnowledgeCenterClass;
let dataConsumerEditorKnowledgeCenter: KnowledgeCenterClass;
let dataStewardEditorKnowledgeCenter: KnowledgeCenterClass;
let relatedKnowledgeCenter: KnowledgeCenterClass;
let dataAsset: TopicClass;
let tableAsset: TableClass;
let user: UserClass;
let domain: Domain;
let dataProduct: DataProduct;

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Context Center Articles', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    articleEntity = new KnowledgeCenterClass({
      displayName: `CC Article ${uuid()}`,
      name: `cc_article_${uuid()}`,
      description: ARTICLE_DESCRIPTION,
    });
    await articleEntity.create(apiContext);
    await articleEntity.patch(apiContext, [
      {
        op: 'replace',
        path: '/displayName',
        value: articleEntity.data.displayName,
      },
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

    quickLinkTitle = `CC QuickLink ${uuid()}`;
    quickLinkName = `cc_quicklink_${uuid()}`;
    const qlRes = await apiContext.post('/api/v1/contextCenter/pages', {
      data: {
        name: quickLinkName,
        displayName: quickLinkTitle,
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

    listKnowledgeCenter = new KnowledgeCenterClass();
    editorKnowledgeCenter = new KnowledgeCenterClass();
    dataConsumerEditorKnowledgeCenter = new KnowledgeCenterClass();
    dataStewardEditorKnowledgeCenter = new KnowledgeCenterClass();
    tableAsset = new TableClass();
    dataAsset = new TopicClass();
    user = new UserClass();
    domain = new Domain();
    dataProduct = new DataProduct([domain]);
    relatedKnowledgeCenter = new KnowledgeCenterClass(
      {},
      undefined,
      tableAsset
    );

    await user.create(apiContext);
    await tableAsset.create(apiContext);
    await dataAsset.create(apiContext);
    await domain.create(apiContext);
    await dataProduct.create(apiContext);
    await listKnowledgeCenter.create(apiContext, MIN_CARDS);
    await editorKnowledgeCenter.create(apiContext, 6);
    await dataConsumerEditorKnowledgeCenter.create(apiContext, 6);
    await dataStewardEditorKnowledgeCenter.create(apiContext, 6);
    await relatedKnowledgeCenter.create(apiContext, 15);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await articleEntity?.delete(apiContext).catch(() => undefined);
    await listKnowledgeCenter?.delete(apiContext).catch(() => undefined);
    await editorKnowledgeCenter?.delete(apiContext).catch(() => undefined);
    await dataConsumerEditorKnowledgeCenter
      ?.delete(apiContext)
      .catch(() => undefined);
    await dataStewardEditorKnowledgeCenter
      ?.delete(apiContext)
      .catch(() => undefined);
    await relatedKnowledgeCenter?.delete(apiContext).catch(() => undefined);

    if (quickLinkId) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/pages/${quickLinkId}?hardDelete=true&recursive=true`
        )
        .catch(() => undefined);
    }

    await Promise.all(
      articleTags.map((tag) => tag.delete(apiContext).catch(() => undefined))
    );
    await articleTagClassification?.delete(apiContext).catch(() => undefined);
    await dataProduct?.delete(apiContext).catch(() => undefined);
    await domain?.delete(apiContext).catch(() => undefined);
    await user?.delete(apiContext).catch(() => undefined);
    await dataAsset?.delete(apiContext).catch(() => undefined);
    await tableAsset?.delete(apiContext).catch(() => undefined);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Empty article can be deleted immediately without polluting the list', async ({
    page,
  }) => {
    await navigateToArticles(page);

    const createResPromise = page.waitForResponse(
      '/api/v1/contextCenter/pages'
    );
    await createArticleFromButton(page);
    const createRes = await createResPromise;
    expect(createRes.status()).toBe(201);

    await expect(page).toHaveURL(/\/context-center\/articles\//);
    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      ''
    );

    const fqn = getArticleFqnFromUrl(page);
    await deletePage(page, false, fqn);

    await expect(page).toHaveURL(/\/context-center\/articles$/);
    await expect(page.getByTestId('knowledge-card-Untitled')).not.toBeVisible();
  });

  test('Article list basics and creation entrypoints', async ({ page }) => {
    await test.step('dashboard create article redirects to detail page', async () => {
      await navigateToDashboard(page);

      const createResPromise = page.waitForResponse(
        '/api/v1/contextCenter/pages'
      );
      await createArticleFromButton(page);
      const createRes = await createResPromise;

      expect(createRes.status()).toBe(201);
      await expect(page).toHaveURL(/\/context-center\/articles\//);
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();
      await cleanupCurrentArticle(page);
    });

    await test.step('dashboard view all articles opens article list', async () => {
      await navigateToDashboard(page);
      await page.getByTestId('article-detail-card').click();

      await expect(page).toHaveURL(/\/context-center\/articles/);
    });

    await test.step('articles page renders header and create menu', async () => {
      await navigateToArticles(page);

      const header = page.getByTestId('context-center-header');
      await expect(header).toBeVisible();
      await expect(header.getByTestId('breadcrumb')).toBeVisible();
      await expect(header.getByRole('heading')).toContainText('Articles');

      await page.getByTestId('create-knowledge-page-btn').click();
      await expect(page.getByTestId('create-article-btn')).toBeVisible();
      await expect(page.getByTestId('create-quick-link-btn')).toBeVisible();
    });

    await test.step('articles list create article redirects to detail page', async () => {
      await navigateToArticles(page);

      const createResPromise = page.waitForResponse(
        '/api/v1/contextCenter/pages'
      );
      await createArticleFromButton(page);
      const createRes = await createResPromise;

      expect(createRes.status()).toBe(201);
      await expect(page).toHaveURL(/\/context-center\/articles\//);
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();
      await cleanupCurrentArticle(page);
    });
  });

  test('Article listing search filters, clears, and shows empty state', async ({
    page,
  }) => {
    await navigateToArticles(page);

    const searchInput = await verifyArticleSearch(
      page,
      articleEntity.responseData.displayName
    );
    await scrollListingToCard(page, articleEntity.responseData.displayName);

    await verifyArticleSearch(page, 'zzznomatchzzz_playwright');
    await expect(page.getByTestId('no-data-placeholder')).toBeVisible({
      timeout: 8000,
    });

    await searchInput.clear();
    await waitForAllLoadersToDisappear(page);
    await scrollListingToCard(page, articleEntity.responseData.displayName);
  });

  test('Global search and Explore Knowledge Center filter navigate to articles', async ({
    page,
  }) => {
    await test.step('global search opens article detail page', async () => {
      await visitEntityPage({
        page,
        searchTerm: articleEntity.responseData.fullyQualifiedName,
        dataTestId: `${articleEntity.responseData.fullyQualifiedName}-${articleEntity.responseData.fullyQualifiedName}`,
      });

      await expect(
        page.locator('[data-testid="entity-header-display-name"]')
      ).toHaveValue(articleEntity.responseData.displayName);
    });

    await test.step('Explore Knowledge Center filter returns results', async () => {
      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('explore-tree-title-Knowledge Center')
      ).toContainText('Knowledge Center');

      await page
        .locator('div')
        .filter({ hasText: /^Knowledge Center$/ })
        .locator('svg')
        .first()
        .click();

      await expect(
        page.getByTestId('explore-tree-title-Knowledge Page')
      ).toContainText('Knowledge Page');

      const apiRes = page.waitForResponse(
        '/api/v1/search/query?q=&index=dataAsset*'
      );

      await page.getByTestId('explore-tree-title-Knowledge Page').click();
      const response = await apiRes;
      const responseData = await response.json();

      expect(responseData.hits.total.value).toBeGreaterThan(0);
      await expect(
        page.getByTestId('search-dropdown-Data Assets')
      ).toContainText('Data Assets: (1)');
      await expect(
        page.getByTestId('search-error-placeholder')
      ).not.toBeVisible();
    });
  });

  test('Quick link lifecycle validates, creates, edits, and deletes from card', async ({
    page,
  }) => {
    const testQuickLink = {
      displayName: `CC QL Test ${uuid()}`,
      updatedDisplayName: `CC QL Test Updated ${uuid()}`,
      description: 'Quick link created from Playwright modal',
      updatedDescription: 'Quick link updated from Playwright modal',
      url: RELATED_QUICK_LINK_URL,
      updatedUrl: UPDATED_QUICK_LINK_URL,
      tag: 'QuickLink',
      tagFqn: 'KnowledgeCenter.QuickLink',
    };

    await navigateToArticles(page);
    await page.getByTestId('create-knowledge-page-btn').click();
    await page.getByTestId('create-quick-link-btn').click();

    const modal = page.locator('.quick-link-form-modal');
    await expect(modal).toBeVisible();

    await modal.locator('[data-testid="url"] input').fill('not-a-valid-url');
    await modal.getByRole('button', { name: 'Save' }).click();
    await expect(modal.getByText(/Invalid URL format/i)).toBeVisible();
    await page.keyboard.press('Escape');

    await createQuickLink(page, testQuickLink, dataAsset);
    await readQuickLink(page, testQuickLink);

    await readArticleInHierarchy(page, testQuickLink.displayName);
    await scrollHierarchyToNode(page, testQuickLink.displayName);

    const searchInput = await verifyArticleSearch(
      page,
      testQuickLink.displayName
    );
    await expect(
      page.getByTestId(`knowledge-card-${testQuickLink.displayName}`)
    ).toBeVisible();

    await searchInput.clear();
    await waitForAllLoadersToDisappear(page);
    await updateQuickLink(page, testQuickLink);

    const updatedCard = page.getByTestId(
      `knowledge-card-${testQuickLink.updatedDisplayName}`
    );
    await expect(updatedCard).toBeVisible();
    await expect(
      updatedCard.getByTestId('knowledge-card-description')
    ).toHaveText(testQuickLink.updatedDescription);

    await updatedCard.getByTestId('delete-quick-link-btn').click();
    await deletePage(page, true);
    await expect(updatedCard).not.toBeVisible();
  });

  test('Quick link created from API can be opened and deleted from hierarchy', async ({
    page,
    browser,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await createNewPage(browser);
    const apiQuickLink = await createQuickLinkViaApi(
      apiContext,
      `CC API QuickLink ${uuid()}`
    );
    await afterAction();

    await navigateToArticles(page);
    const node = await scrollHierarchyToNode(page, apiQuickLink.displayName);
    await node.click();
    await expect(
      page.getByRole('textbox', { name: 'Display Name' })
    ).toHaveValue(apiQuickLink.displayName);
    await page.keyboard.press('Escape');
    await node.hover();
    await page
      .getByTestId(`${apiQuickLink.displayName}-delete-page-btn`)
      .click();

    const deleteResPromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/v1/contextCenter/pages/${apiQuickLink.id}`) &&
        response.url().includes('hardDelete=true')
    );
    await page.getByTestId('confirm-button').click();
    const deleteRes = await deleteResPromise;

    expect(deleteRes.status()).toBe(200);
    await expect(
      page.getByTestId(`page-node-${apiQuickLink.displayName}`)
    ).not.toBeVisible();
  });

  test('Quick link card opens the configured url in a new tab', async ({
    page,
  }) => {
    test.slow();
    await navigateToArticles(page);
    await verifyArticleSearch(page, quickLinkTitle);

    const card = await scrollListingToCard(page, quickLinkTitle);

    const link = card.getByTestId('knowledge-link');
    await expect(link).toHaveAttribute('href', QUICK_LINK_URL);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('Article card metadata, widgets, and listing search update from UI edits', async ({
    page,
  }) => {
    test.slow();
    const title = `CC Metadata Article ${uuid()}`;
    const description = 'Article metadata flow description';

    await navigateToArticles(page);
    const createResPromise = page.waitForResponse(
      '/api/v1/contextCenter/pages'
    );
    await createArticleFromButton(page);
    await createResPromise;
    await addTitle(page, title);
    await updateBody(page, description);

    await navigateToArticles(page);
    let card = page.getByTestId(`knowledge-card-${title}`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId('knowledge-card-description')).toContainText(
      description
    );
    await expect(card.getByTestId('owner-label')).not.toBeVisible();
    await expect(card.getByTestId('domain-link')).not.toBeVisible();

    await card.click();
    await page.getByTestId('edit-domain-btn').click();
    await waitForAllLoadersToDisappear(page);

    const searchDomain = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(encodeURIComponent(domain.responseData.name))
    );

    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill(domain.responseData.name);
    await searchDomain;

    const domainTagSelector = page.getByTestId(
      `tag-${domain.responseData.fullyQualifiedName}`
    );
    await domainTagSelector.waitFor({ state: 'visible' });

    const domainPatchReq = page.waitForResponse(
      (req) => req.request().method() === 'PATCH'
    );
    await domainTagSelector.click();
    await domainPatchReq;
    await waitForAllLoadersToDisappear(page);

    await addMultiOwner({
      page,
      ownerNames: [user.responseData.displayName],
      activatorBtnDataTestId: 'edit-owner-btn',
      endpoint: 'contextCenter/pages' as EntityTypeEndpoint,
      type: 'Users',
    });
    await updateTags(page, {
      tag: 'Article',
      tagFqn: 'KnowledgeCenter.Article',
    });
    await page
      .getByTestId('tags-container')
      .getByTestId('edit-button')
      .waitFor({ state: 'visible' });
    await updateTags(page, {
      tag: 'HowToGuide',
      tagFqn: 'KnowledgeCenter.HowToGuide',
    });

    const followBtn = page.getByTestId('follow-btn');
    await toggleKnowledgePageBookmark(page, followBtn);

    await navigateToArticles(page);
    card = page.getByTestId(`knowledge-card-${title}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(domain.responseData.displayName);
    await expect(card).toContainText(user.responseData.displayName);
    await expect(page.getByTestId(`recent-viewed-${title}`)).toBeVisible();
    await expect(page.getByTestId(`bookmarked-${title}`)).toBeVisible();
    await expect(
      page.getByTestId(`tag-category-KnowledgeCenter.Article-${title}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`tag-category-KnowledgeCenter.HowToGuide-${title}`)
    ).toBeVisible();

    await verifyArticleSearch(page, title);
    await expect(card).toBeVisible();

    const { apiContext, afterAction } = await getApiContext(page);
    await deleteArticleByFqn(apiContext, title);
    await afterAction();
  });

  test('Article list cards, recently viewed widget, and pagination work', async ({
    page,
  }) => {
    await navigateToArticles(page);

    const card = await getKnowledgePageCardByIndex(page, 0);
    await expect(card.getByTestId('knowledge-card-title')).toBeVisible();
    await expect(card.getByTestId('knowledge-card-description')).toBeVisible();
    await expect(card.getByTestId('knowledge-page-link')).toBeVisible();
    await expect(card.getByTestId('updated-at')).toBeVisible();

    const viewedCard = await getKnowledgePageCardByIndex(page, 3);
    const cardIdentifier = await getKnowledgePageCardEntityIdentifier(
      viewedCard
    );
    const cardDisplayText =
      (
        await viewedCard.getByTestId('knowledge-card-title').textContent()
      )?.trim() ?? '';

    await viewedCard.getByTestId('knowledge-page-link').click();
    await page.waitForURL((url) =>
      url.pathname.includes('/context-center/articles/')
    );
    await waitForAllLoadersToDisappear(page);

    await navigateToArticles(page);
    const rightPanel = page.getByTestId('knowledge-center-right-panel');
    await expect(rightPanel.getByText('Recently Viewed')).toBeVisible();

    const recentlyViewedItem = rightPanel.getByTestId(
      `recent-viewed-${cardIdentifier}`
    );
    await recentlyViewedItem.scrollIntoViewIfNeeded();
    await expect(recentlyViewedItem).toBeVisible();
    await recentlyViewedItem.click();
    await page.waitForURL((url) =>
      url.pathname.includes('/context-center/articles/')
    );

    const expectedValue = cardDisplayText === 'Untitled' ? '' : cardDisplayText;
    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      expectedValue
    );

    await navigateToArticles(page);
    const listing = page.getByTestId('knowledge-page-listing');
    const cards = listing.locator('[data-testid^="knowledge-card-"]');
    const initialCardCount = await cards.count();

    const observerElement = page.getByTestId('observer-element');
    const paginationResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/contextCenter/pages') &&
        response.url().includes('offset=')
    );

    await observerElement.scrollIntoViewIfNeeded();
    await paginationResponse;
    await waitForAllLoadersToDisappear(page);

    expect(await cards.count()).toBeGreaterThan(initialCardCount);
  });

  test('Left hierarchy pagination and expand collapse actions work', async ({
    page,
  }) => {
    test.slow();
    await navigateToArticles(page);

    const targetArticle =
      listKnowledgeCenter.knowledgePages[MIN_CARDS - 1].displayName;
    const node = await scrollHierarchyToNode(page, targetArticle);
    await node.click();

    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      targetArticle
    );

    const parent = listKnowledgeCenter.knowledgePages[0];
    const { apiContext, afterAction } = await getApiContext(page);
    const child = await createArticleViaApi(apiContext, {
      displayName: `CC Hierarchy Child ${uuid()}`,
      name: `cc_hierarchy_child_${uuid()}`,
    });

    await apiContext.patch(`/api/v1/contextCenter/pages/${child.id}`, {
      data: [
        {
          op: 'add',
          path: '/parent',
          value: {
            id: parent.id,
            type: 'page',
            fullyQualifiedName: parent.fullyQualifiedName,
            displayName: parent.displayName,

            name: parent.name,
          },
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
    await afterAction();

    await navigateToArticles(page);
    await scrollHierarchyToNode(page, parent.displayName);
    const ExpandIcon = page.getByRole('button', {
      name: `Expand ${parent.displayName}`,
    });
    await expect(ExpandIcon).toBeVisible();
    await ExpandIcon.click();
    await expect(
      page.getByTestId(`page-node-${child.displayName}`)
    ).toBeVisible();
    const collapseIcon = page.getByRole('button', {
      name: `Collapse ${parent.displayName}`,
    });
    await collapseIcon.click();
    await expect(
      page.getByTestId(`page-node-${child.displayName}`)
    ).not.toBeVisible();

    await page.getByLabel('Expand All').click();
    await expect(
      page.getByTestId(`page-node-${child.displayName}`)
    ).toBeVisible();
    await page.getByLabel('Collapse All').click();
    await expect(
      page.getByTestId(`page-node-${child.displayName}`)
    ).not.toBeVisible();

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await getApiContext(page);
    await deleteArticleByFqn(
      cleanupContext,
      `${parent.fullyQualifiedName}.${child.name}`
    );
    await cleanupAfterAction();
  });

  test('Article detail layout, drawer, activity tab, and version page work', async ({
    page,
    browser,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await createNewPage(browser);
    const article = await createArticleViaApi(apiContext, {
      displayName: `CC Version Article ${uuid()}`,
      name: `cc_version_article_${uuid()}`,
      description: 'Version page test description',
    });
    await afterAction();

    await navigateToArticle(page, article.fullyQualifiedName);

    const header = page.getByTestId('article-detail-header');
    await expect(header).toBeVisible();
    await expect(header.getByTestId('breadcrumb')).toBeVisible();
    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      article.displayName
    );
    await expect(header.getByTestId('version-btn')).toBeVisible();
    await expect(header.getByTestId('manage-button')).toBeVisible();
    await expect(header.getByRole('tab', { name: /content/i })).toBeVisible();
    await expect(header.getByRole('tab', { name: /activity/i })).toBeVisible();

    const rightPanel = page.getByTestId('knowledge-page-right-panel');
    const toggleBtn = header.getByTestId('right-panel-toggle-btn');
    await expect(rightPanel).toBeVisible();
    await toggleBtn.click();
    await expect(rightPanel).not.toBeVisible();
    await toggleBtn.click();
    await expect(rightPanel).toBeVisible();

    const leftPanelToggle = page.getByTestId('left-panel-toggle-btn');
    if (await leftPanelToggle.isVisible()) {
      const leftPanel = page.getByTestId('left-panel');
      await leftPanelToggle.click();
      await expect(leftPanel).not.toBeVisible();
      await leftPanelToggle.click();
      await expect(leftPanel).toBeVisible();
    }

    await header.getByRole('tab', { name: /activity/i }).click();
    await expect(page).toHaveURL(/activity_feed/);

    await navigateToArticle(page, article.fullyQualifiedName);
    const updatedTitle = `${article.displayName} v2`;
    await addTitle(page, updatedTitle);
    await updateBody(page, 'Version page updated body text');

    await header.getByTestId('version-btn').click();
    await expect(page).toHaveURL(/\/versions\//);
    await expect(page.getByTestId('article-version-header')).toBeVisible();
    await expect(page.getByTestId('breadcrumb')).toBeVisible();
    await expect(page.locator('.om-block-editor')).toContainText(
      'Version pagetestupdateddescriptionbody text'
    );
    await expect(page.getByTestId('manage-button')).not.toBeVisible();
    await expect(page.getByTestId('right-panel-toggle-btn')).not.toBeVisible();

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await createNewPage(browser);
    await deleteArticleByFqn(cleanupContext, article.fullyQualifiedName);
    await cleanupAfterAction();
  });

  test('Article edit persistence and unsaved title behavior are correct', async ({
    page,
    browser,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await createNewPage(browser);
    const article = await createArticleViaApi(apiContext, {
      displayName: `CC Edit Article ${uuid()}`,
      name: `cc_edit_article_${uuid()}`,
      description: 'Initial edit article description',
    });
    await afterAction();

    const updatedTitle = `${article.displayName} Updated`;
    await navigateToArticle(page, article.fullyQualifiedName);
    await addTitle(page, updatedTitle);
    await updateBody(page, 'Updated article body text');
    await updateTags(page, {
      tag: 'Article',
      tagFqn: 'KnowledgeCenter.Article',
    });
    await addMultiOwner({
      page,
      ownerNames: [user.responseData.displayName],
      activatorBtnDataTestId: 'edit-owner-btn',
      endpoint: 'contextCenter/pages' as EntityTypeEndpoint,
      type: 'Users',
    });

    await assertArticleEditorSaved(page);
    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      updatedTitle
    );
    await scrollHierarchyToNode(page, updatedTitle);

    await navigateToArticles(page);
    await expect(
      page.getByTestId(`knowledge-card-${updatedTitle}`)
    ).toBeVisible();
    await scrollHierarchyToNode(page, updatedTitle);

    await navigateToArticle(page, article.fullyQualifiedName);
    const titleInput = page.getByTestId('entity-header-display-name');
    await titleInput.fill(`${updatedTitle} Unsaved`);
    await page.goBack();
    await waitForAllLoadersToDisappear(page);
    await expect(
      page.getByTestId(`knowledge-card-${updatedTitle}`)
    ).toBeVisible();

    await navigateToArticle(page, article.fullyQualifiedName);
    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      updatedTitle
    );

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await createNewPage(browser);
    await deleteArticleByFqn(cleanupContext, updatedTitle);
    await cleanupAfterAction();
  });

  test('Article copy, delete, sidebar delete, and same-name recreate do not preserve stale metadata', async ({
    page,
    browser,
  }) => {
    test.slow();
    const { apiContext, afterAction } = await createNewPage(browser);
    const reusableName = `cc_recreate_article_${uuid()}`;
    const reusableTitle = `CC Recreate Article ${uuid()}`;
    const article = await createArticleViaApi(apiContext, {
      name: reusableName,
      displayName: reusableTitle,
      description: 'Original article description',
      owners: [{ id: user.responseData.id, type: 'user' }],
    });
    await afterAction();

    await navigateToArticle(page, article.fullyQualifiedName);
    await page.getByTestId('copy-btn').click();
    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      new RegExp(`${reusableTitle}`)
    );

    await navigateToArticle(page, article.fullyQualifiedName);
    await deletePage(page, false, article.fullyQualifiedName);
    await expect(page).toHaveURL(/\/context-center\/articles$/);

    const { apiContext: recreateContext, afterAction: recreateAfterAction } =
      await createNewPage(browser);
    const recreated = await createArticleViaApi(recreateContext, {
      name: reusableName,
      displayName: reusableTitle,
      description: 'Fresh article description',
    });
    await recreateAfterAction();

    await navigateToArticle(page, recreated.fullyQualifiedName);
    await expect(page.getByText('Fresh article description')).toBeVisible();
    await expect(
      page.getByText('Original article description')
    ).not.toBeVisible();
    await expect(
      page.getByText(user.responseData.displayName)
    ).not.toBeVisible();

    const {
      apiContext: sidebarDeleteContext,
      afterAction: sidebarDeleteAfterAction,
    } = await getApiContext(page);
    const sidebarDelete = await createArticleViaApi(sidebarDeleteContext, {
      displayName: `CC Sidebar Delete ${uuid()}`,
      name: `cc_sidebar_delete_${uuid()}`,
    });
    await sidebarDeleteAfterAction();
    await navigateToArticles(page);
    const sidebarNode = await scrollHierarchyToNode(
      page,
      sidebarDelete.displayName
    );
    await sidebarNode.hover();
    await page
      .getByTestId(`${sidebarDelete.displayName}-delete-page-btn`)
      .click();
    await page.getByTestId('confirm-button').click();
    await expect(
      page.getByTestId(`page-node-${sidebarDelete.displayName}`)
    ).not.toBeVisible();

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await createNewPage(browser);
    await deleteArticleByFqn(cleanupContext, recreated.fullyQualifiedName);
    await cleanupAfterAction();
  });

  test('Related assets, activity feed, user mentions, and article mentions work', async ({
    page,
  }) => {
    test.slow();
    const {
      apiContext: createArticleContext,
      afterAction: createArticleAfterAction,
    } = await getApiContext(page);
    const mentionArticle = await createArticleViaApi(createArticleContext, {
      displayName: `CC Mention Article ${uuid()}`,
      name: `cc_mention_article_${uuid()}`,
    });
    await createArticleAfterAction();

    await test.step('related articles are visible on asset page', async () => {
      const { apiContext, afterAction } = await getApiContext(page);

      for (const knowledgePage of relatedKnowledgeCenter.knowledgePages) {
        await relatedKnowledgeCenter.addDataAssetToPage(
          apiContext,
          knowledgePage.id
        );
      }
      await afterAction();

      const waitForRelatedArticles = page.waitForResponse(
        `/api/v1/contextCenter/pages?*`
      );

      await tableAsset.visitEntityPage(page);
      await waitForRelatedArticles;

      await expect(
        page.locator('[data-testid="knowledge-pages"]')
      ).toBeVisible();

      const filterPagePromise = page.waitForResponse(
        `/api/v1/contextCenter/pages?fields=*&limit=15&entityId=${
          (tableAsset.entityResponseData as { id: string }).id
        }&entityType=table`
      );

      await page
        .locator('[data-testid="view-all-data-asset-related-articles"]')
        .click();
      await filterPagePromise;
    });

    await test.step('activity feed supports create, edit, and delete', async () => {
      await navigateToArticle(page, mentionArticle.fullyQualifiedName);
      await page.locator('[data-testid="conversation"]').click();
      await page.locator('.feed-drawer').waitFor({ state: 'visible' });
      await page.getByRole('tab', { name: 'Conversations' }).click();

      const conversationMessage = `Test Conversation Message ${uuid()}`;
      const editor = page.locator(
        '[data-testid="editor-wrapper"] [contenteditable="true"]'
      );
      await editor.click();
      await editor.fill(conversationMessage);

      const feedResponse = page.waitForResponse('/api/v1/feed');
      await page.locator('[data-testid="send-button"]').click();
      await feedResponse;
      await expect(page.getByText(conversationMessage)).toBeVisible();

      await page.locator('[data-testid="main-message"]').hover();
      await page.locator('[data-testid="edit-message"]').click();

      const updatedMessage = `Updated Thread Message ${uuid()}`;
      await editor.click();
      await editor.clear();
      await editor.fill(updatedMessage);

      const updateThreadPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.request().method() === 'PATCH'
      );
      await page.locator('[data-testid="save-button"]').click();
      await updateThreadPromise;
      await expect(page.getByText(updatedMessage)).toBeVisible();

      await page.locator('[data-testid="main-message"]').hover();
      await page.locator('[data-testid="delete-message"]').click();
      const deletePostPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.request().method() === 'DELETE'
      );
      await page.getByTestId('save-button').click();
      await deletePostPromise;
      await expect(
        page.locator('[data-testid="main-message"]')
      ).not.toBeVisible();
    });

    await test.step('user mention notification redirects to article', async () => {
      await navigateToArticle(page, mentionArticle.fullyQualifiedName);
      const conversationMessage = `Test Conversation Message with mention ${uuid()}`;
      await createMentionInConversation(page, 'admin', conversationMessage);

      await redirectToHomePage(page);
      await verifyNotificationAndClick(
        page,
        'admin',
        mentionArticle.displayName
      );
      await waitForAllLoadersToDisappear(page);
      await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
        mentionArticle.displayName
      );
    });

    await test.step('article mention in asset description links to article', async () => {
      const { apiContext, afterAction } = await getApiContext(page);
      await relatedKnowledgeCenter.addDataAssetToPage(apiContext);
      await afterAction();

      const waitForRelatedArticles = page.waitForResponse(
        `/api/v1/contextCenter/pages?*`
      );
      await dataAsset.visitEntityPage(page);
      await waitForRelatedArticles;

      await page.getByTestId('edit-description').click();
      await page.locator(descriptionBox).first().click();
      await page.locator(descriptionBox).first().clear();

      const mentionResponse = page.waitForResponse('/api/v1/search/query?**');
      await page
        .locator(descriptionBox)
        .first()
        .fill(`#${relatedKnowledgeCenter.knowledgePages[0].displayName}`);
      await mentionResponse;

      await page
        .getByTestId(
          `hash-mention-${relatedKnowledgeCenter.knowledgePages[0].displayName}`
        )
        .click();
      await page.getByTestId('save').click();

      await page.waitForSelector(
        '[role="dialog"].description-markdown-editor',
        { state: 'hidden' }
      );

      const element = page.locator(
        `[data-label=${relatedKnowledgeCenter.knowledgePages[0].displayName}]`
      );
      const href = await element.getAttribute('href');

      expect(href).toMatch(
        new RegExp(
          `/knowledge-center/${relatedKnowledgeCenter.knowledgePages[0].name}$`
        )
      );
    });

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await getApiContext(page);
    await deleteArticleByFqn(cleanupContext, mentionArticle.fullyQualifiedName);
    await cleanupAfterAction();
  });

  test('Other user editing is visible in the article header editor list', async ({
    page,
    dataConsumerPage,
  }) => {
    test.slow();
    const {
      apiContext: createArticleContext,
      afterAction: createArticleAfterAction,
    } = await getApiContext(page);
    const article = await createArticleViaApi(createArticleContext, {
      displayName: `CC Editor List Article ${uuid()}`,
      name: `cc_editor_list_article_${uuid()}`,
    });
    await createArticleAfterAction();

    await navigateToArticle(dataConsumerPage, article.fullyQualifiedName);
    await updateBody(dataConsumerPage, `Edited by data consumer ${uuid()}`);

    await navigateToArticle(page, article.fullyQualifiedName);
    await expect(
      page.locator('a[href*="/users/pw-data-consumer"]')
    ).toBeVisible();
    const { apiContext, afterAction } = await getApiContext(page);
    await deleteArticleByFqn(apiContext, article.fullyQualifiedName);
    await afterAction();
  });

  test.describe('Rich Text Editor - Admin Role', () => {
    test('Slash commands and basic blocks', async ({ page }) => {
      await runSlashCommandsAndBasicBlocksTest(
        page,
        editorKnowledgeCenter.knowledgePages[0]
      );
    });

    test('Text formatting', async ({ page }) => {
      await runTextFormattingTest(
        page,
        editorKnowledgeCenter.knowledgePages[1]
      );
    });

    test('Editor operations', async ({ page }) => {
      await runEditorOperationsTest(
        page,
        editorKnowledgeCenter.knowledgePages[2]
      );
    });

    test('Nested lists', async ({ page }) => {
      await runNestedListsTest(page, editorKnowledgeCenter.knowledgePages[3]);
    });

    test('Content persistence', async ({ page }) => {
      await runContentPersistenceTest(
        page,
        editorKnowledgeCenter.knowledgePages[4]
      );
    });

    test('Advanced blocks', async ({ page }) => {
      await runAdvancedBlocksTest(
        page,
        editorKnowledgeCenter.knowledgePages[5]
      );
    });
  });

  test.describe('Rich Text Editor - Data Consumer Role', () => {
    test('Slash commands and basic blocks', async ({ dataConsumerPage }) => {
      await runSlashCommandsAndBasicBlocksTest(
        dataConsumerPage,
        dataConsumerEditorKnowledgeCenter.knowledgePages[0]
      );
    });

    test('Text formatting', async ({ dataConsumerPage }) => {
      await runTextFormattingTest(
        dataConsumerPage,
        dataConsumerEditorKnowledgeCenter.knowledgePages[1]
      );
    });

    test('Editor operations', async ({ dataConsumerPage }) => {
      await runEditorOperationsTest(
        dataConsumerPage,
        dataConsumerEditorKnowledgeCenter.knowledgePages[2]
      );
    });

    test('Nested lists', async ({ dataConsumerPage }) => {
      await runNestedListsTest(
        dataConsumerPage,
        dataConsumerEditorKnowledgeCenter.knowledgePages[3]
      );
    });

    test('Content persistence', async ({ dataConsumerPage }) => {
      await runContentPersistenceTest(
        dataConsumerPage,
        dataConsumerEditorKnowledgeCenter.knowledgePages[4]
      );
    });

    test('Advanced blocks', async ({ dataConsumerPage }) => {
      await runAdvancedBlocksTest(
        dataConsumerPage,
        dataConsumerEditorKnowledgeCenter.knowledgePages[5]
      );
    });
  });

  test.describe('Rich Text Editor - Data Steward Role', () => {
    test('Slash commands and basic blocks', async ({ dataStewardPage }) => {
      await runSlashCommandsAndBasicBlocksTest(
        dataStewardPage,
        dataStewardEditorKnowledgeCenter.knowledgePages[0]
      );
    });

    test('Text formatting', async ({ dataStewardPage }) => {
      await runTextFormattingTest(
        dataStewardPage,
        dataStewardEditorKnowledgeCenter.knowledgePages[1]
      );
    });

    test('Editor operations', async ({ dataStewardPage }) => {
      await runEditorOperationsTest(
        dataStewardPage,
        dataStewardEditorKnowledgeCenter.knowledgePages[2]
      );
    });

    test('Nested lists', async ({ dataStewardPage }) => {
      await runNestedListsTest(
        dataStewardPage,
        dataStewardEditorKnowledgeCenter.knowledgePages[3]
      );
    });

    test('Content persistence', async ({ dataStewardPage }) => {
      await runContentPersistenceTest(
        dataStewardPage,
        dataStewardEditorKnowledgeCenter.knowledgePages[4]
      );
    });

    test('Advanced blocks', async ({ dataStewardPage }) => {
      await runAdvancedBlocksTest(
        dataStewardPage,
        dataStewardEditorKnowledgeCenter.knowledgePages[5]
      );
    });
  });
});
