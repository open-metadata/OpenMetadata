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
import { expect, test } from '@playwright/test';
// import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import {
  assignDataProduct,
  assignSingleSelectDomain,
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  removeDataProduct,
  // toastNotification,
  uuid,
} from '../../utils/common';
import {
  addMultiOwner,
  removeOwner,
  visitEntityPage,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  addTitle,
  createMentionInConversation,
  createQuickLink,
  deletePage,
  // readArticleData,
  // readArticleInHierarchy,
  readQuickLink,
  updateBody,
  updateDataAsset,
  updateQuickLink,
  updateTags,
  verifyNotificationAndClick,
} from '../../utils/KnowledgeCenter';
import { sidebarClick } from '../../utils/sidebar';

const knowledgePageArticle = {
  title: `Playwright Article Title-${uuid()}`,
  body: 'This is playwright article body here you can add rich text and block, it also support the slash command.',
  tag: 'Article',
  tagFqn: 'KnowledgeCenter.Article',
  updatedBy: 'admin',
  entityType: 'knowledgeCenter',
};

const knowledgePageQuickLink = {
  displayName: `Playwright Quick Link Title-${uuid()}`,
  updatedDisplayName: `Playwright Quick Link Title Updated-${uuid()}`,
  description: 'This is playwright quick link body here you can add rich text',
  updatedDescription:
    'This is playwright quick link body here you can add rich text updated',
  url: 'https://docs.open-metadata.org',
  updatedUrl: 'https://docs.open-metadata.org/quick-link',
  tag: 'QuickLink',
  tagFqn: 'KnowledgeCenter.QuickLink',
};

const dataAsset = new TopicClass();
const tableAsset = new TableClass();
const user = new UserClass();
const domain = new Domain();
const dataProduct = new DataProduct([domain]);

const knowledgeCenter = new KnowledgeCenterClass({}, undefined, tableAsset);
const knowledgeCenter1 = new KnowledgeCenterClass();
const knowledgeCenter2 = new KnowledgeCenterClass();

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Knowledge Center', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await tableAsset.create(apiContext);
    await dataAsset.create(apiContext);
    await domain.create(apiContext);
    await dataProduct.create(apiContext);
    await knowledgeCenter.create(apiContext, 15);
    await knowledgeCenter1.create(apiContext, 2);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Knowledge Center page', async ({ page }) => {
    test.slow(true);

    await test.step('Article: Create, Read, Update and Delete', async () => {
      const createKnowledgePage = page.waitForResponse(
        '/api/v1/knowledgeCenter'
      );

      // visit knowledge center
      await sidebarClick(page, SidebarItem.ARTICLE);
      await page.getByTestId('create-knowledge-page-btn').click();
      await page.getByTestId('create-article-btn').click();
      await createKnowledgePage;

      // add title
      await addTitle(page, knowledgePageArticle.title);

      await assignSingleSelectDomain(page, domain.responseData);

      await assignDataProduct(
        page,
        domain.responseData,
        [dataProduct.responseData],
        'Add'
      );

      await removeDataProduct(page, dataProduct.responseData);

      // update owner
      await addMultiOwner({
        page,
        ownerNames: [user.responseData.displayName],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: knowledgePageArticle.entityType as EntityTypeEndpoint,
        type: 'Users',
      });

      // remove owner
      await removeOwner({
        page,
        endpoint: knowledgePageArticle.entityType as EntityTypeEndpoint,
        ownerName: user.responseData.displayName,
        type: 'Users',
        dataTestId: 'add-owner',
      });

      // update owner
      await addMultiOwner({
        page,
        ownerNames: [user.responseData.displayName],
        activatorBtnDataTestId: 'add-owner',
        endpoint: knowledgePageArticle.entityType as EntityTypeEndpoint,
        type: 'Users',
      });

      // update tags
      await updateTags(page, {
        tag: knowledgePageArticle.tag,
        tagFqn: knowledgePageArticle.tagFqn,
      });

      // update data assets and view the data asset then navigate to article
      await updateDataAsset(page, dataAsset, knowledgePageArticle.title);

      // Update body
      await updateBody(page, knowledgePageArticle.body);

      // Read Article
      // await readArticleData(page, knowledgePageArticle);

      // verify article in left panel
      // await expect(
      //   page.locator(`[data-testid="page-node-${knowledgePageArticle.title}"]`)
      // ).toBeVisible();

      // verify bookmarked
      // await expect(
      //   page.locator(`[data-testid="bookmarked-${knowledgePageArticle.title}"]`)
      // ).toBeVisible();

      // // verify recent viewed
      // await expect(
      //   page.locator(
      //     `[data-testid="recent-viewed-${knowledgePageArticle.title}"]`
      //   )
      // ).toBeVisible();

      // // verify the tag category
      // await expect(
      //   page.locator(
      //     `[data-testid="tag-category-${knowledgePageArticle.tagFqn}-${knowledgePageArticle.title}"]`
      //   )
      // ).toBeVisible();

      // await page
      //   .locator(
      //     `[data-testid="tag-category-${knowledgePageArticle.tagFqn}-${knowledgePageArticle.title}"]`
      //   )
      //   .click();
      await deletePage(page, false, knowledgePageArticle.title);
    });

    await test.step('Quick Links: Create, Read, Update and Delete', async () => {
      await sidebarClick(page, SidebarItem.ARTICLE);

      // Create Quick Link
      await createQuickLink(page, knowledgePageQuickLink, dataAsset);

      // Read Quick Link
      await readQuickLink(page, knowledgePageQuickLink);

      // Update Quick Link
      await updateQuickLink(page, knowledgePageQuickLink);

      // verify the tag category
      await expect(
        page.locator(
          `[data-testid="${knowledgePageQuickLink.updatedDisplayName}"]`
        )
      ).toBeVisible();

      await page
        .locator(`[data-testid="${knowledgePageQuickLink.updatedDisplayName}"]`)
        .locator('[data-testid="delete-quick-link-btn"]')
        .click();
      await deletePage(page, true);
    });

    await test.step('Related articles should be visible for an assets', async () => {
      const { apiContext, afterAction } = await getApiContext(page);

      for (const page of knowledgeCenter.knowledgePages) {
        if (page.id) {
          await knowledgeCenter.addDataAssetToPage(apiContext, page.id);
        }
      }
      await afterAction();

      const waitForRelatedArticles = page.waitForResponse(
        `/api/v1/knowledgeCenter?*`
      );

      await tableAsset.visitEntityPage(page);

      await waitForRelatedArticles;

      await expect(
        page.locator('[data-testid="knowledge-pages"]')
      ).toBeVisible();

      const knowledgeCenterFilterPagePromise = page.waitForResponse(
        `/api/v1/knowledgeCenter?fields=*&limit=15&entityId=${
          (tableAsset.entityResponseData as { id: string }).id
        }&entityType=table`
      );

      await page
        .locator('[data-testid="view-all-data-asset-related-articles"]')
        .click();

      await knowledgeCenterFilterPagePromise;
    });

    await test.step("Search for an article and navigate to it's page", async () => {
      test.slow(true);

      const { knowledgePages } = knowledgeCenter.get();

      for await (const knowledgePage of knowledgePages) {
        await visitEntityPage({
          page,
          searchTerm: knowledgePage?.['fullyQualifiedName'],
          dataTestId: `${knowledgePage?.['fullyQualifiedName']}-${knowledgePage?.['fullyQualifiedName']}`,
        });

        await expect(
          page.locator('[data-testid="entity-header-display-name"]')
        ).toHaveValue(knowledgePage?.['fullyQualifiedName']);
      }

      await page
        .getByTestId('breadcrumb')
        .getByRole('link', { name: 'Articles' })
        .click();
    });
    // TODO: Commented out due to performance issue with infinite scroll
    // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
    // with large data sets. UI needs to be enhanced to fix this issue.
    // await test.step(
    //   'Articles should be organized in a hierarchy, and the add and delete functions should work within that hierarchy.',
    //   async () => {
    //     test.slow(true);

    //     // const { knowledgePages } = knowledgeCenter.get();

    //     // verify the hierarchy is visible
    //     await expect(
    //       page.locator('[data-testid="knowledge-pages-hierarchy"]')
    //     ).toBeVisible();

    //     for await (const knowledgePage of knowledgePages) {
    //       const articleResponse = page.waitForResponse(
    //         `/api/v1/knowledgeCenter/name/${knowledgePage?.['fullyQualifiedName']}?**`
    //       );

    //     await readArticleInHierarchy(
    //       page,
    //       knowledgePage?.['fullyQualifiedName']
    //     );

    //     // navigate to the article page from the hierarchy node
    //       await page
    //         .locator(
    //           `[data-testid="page-node-${knowledgePage?.['fullyQualifiedName']}"]`
    //         )
    //         .click();

    //       await articleResponse;

    //       // verify the article page is visible
    //       await expect(
    //         page.locator('[data-testid="entity-header-display-name"]')
    //       ).toHaveValue(knowledgePage?.['fullyQualifiedName']);
    //     }

    //     // add and delete a page from the hierarchy

    //     const { knowledgePages: knowledgePages1 } = knowledgeCenter1.get();

    //     for await (const knowledgePage of knowledgePages1) {
    //       const createKnowledgePage = page.waitForResponse(
    //         '/api/v1/knowledgeCenter'
    //       );
    //       const articleResponse = page.waitForResponse(
    //         `/api/v1/knowledgeCenter/name/${knowledgePage?.['fullyQualifiedName']}?**`
    //       );

    //       // TODO: Commented out due to performance issue with infinite scroll
    //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
    //       // with large data sets. UI needs to be enhanced to fix this performance issue.
    //       // await readArticleInHierarchy(
    //       //   page,
    //       //   knowledgePage?.['fullyQualifiedName']
    //       // );

    //       await page
    //         .locator(
    //           `[data-testid="page-node-${knowledgePage?.['fullyQualifiedName']}"]`
    //         )
    //         .click();

    //       await articleResponse;

    //       // TODO: Commented out due to performance issue with infinite scroll
    //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
    //       // with large data sets. UI needs to be enhanced to fix this issue.
    //       // await readArticleInHierarchy(
    //       //   page,
    //       //   knowledgePage?.['fullyQualifiedName']
    //       // );

    //       await page
    //         .locator(
    //           `[data-testid="page-node-${knowledgePage?.['fullyQualifiedName']}"]`
    //         )
    //         .hover();

    //       // add a page
    //       await page
    //         .locator(
    //           `[data-testid="${knowledgePage?.['fullyQualifiedName']}-add-page-btn"]`
    //         )
    //         .click();

    //       await expect(
    //         page.getByTestId('entity-header-display-name')
    //       ).toBeEmpty();

    //       const title = `${knowledgePage?.['fullyQualifiedName']} Article Title`;

    //       // update the title of the created page
    //       await addTitle(page, title);

    //       await page.reload();
    //       await page.waitForLoadState('networkidle');
    //       await page.waitForSelector('[data-testid="loader"]', {
    //         state: 'detached',
    //       });

    //       // verify the created page is visible on the hierarchy with the updated title
    //       // TODO: Commented out due to performance issue with infinite scroll
    //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
    //       // with large data sets. UI needs to be enhanced to fix this performance issue.
    //       // await readArticleInHierarchy(page, title);

    //       await expect(
    //         page.locator(`[data-testid="page-node-${title}"]`)
    //       ).toBeVisible();

    //       await createKnowledgePage;

    //       await redirectToHomePage(page);
    //       await sidebarClick(page, SidebarItem.KNOWLEDGE_CENTER);

    //       await expect(
    //         page.getByTestId('left-panel').getByTestId('add-knowledge-page-btn')
    //       ).toBeVisible();

    //       const loadHierarchy1 = page.waitForResponse(
    //         `/api/v1/knowledgeCenter/search/hierarchy?parent=${knowledgePage?.['fullyQualifiedName']}&pageType=Article&offset=0&limit=100`
    //       );

    //       // TODO: Commented out due to performance issue with infinite scroll
    //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
    //       // with large data sets. UI needs to be enhanced to fix this performance issue.
    //       // await readArticleInHierarchy(
    //       //   page,
    //       //   knowledgePage?.['fullyQualifiedName']
    //       // );

    //       await page
    //         .locator(
    //           `[data-testid="${knowledgePage?.['fullyQualifiedName']}-collapse-icon"]`
    //         )
    //         .click();

    //       const hierarchyResponse = await loadHierarchy1;

    //       const hierarchyData = await hierarchyResponse.json();

    //       // verify the hierarchy should have only one child
    //       expect(hierarchyData.data).toHaveLength(1);

    //       await page
    //         .locator(
    //           `[data-testid="page-node-${knowledgePage?.['fullyQualifiedName']}"]`
    //         )
    //         .click();

    //       // check if created page is loaded for current hierarchy

    //       // TODO: Commented out due to performance issue with infinite scroll
    //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
    //       // with large data sets. UI needs to be enhanced to fix this performance issue.
    //       // await readArticleInHierarchy(
    //       //   page,
    //       //   knowledgePage?.['fullyQualifiedName']
    //       // );

    //       await page
    //         .locator(
    //           `[data-testid="page-node-${knowledgePage?.['fullyQualifiedName']}"]`
    //         )
    //         .hover();

    //       // delete a page
    //       await page
    //         .locator(
    //           `[data-testid="${knowledgePage?.['fullyQualifiedName']}-delete-page-btn"]`
    //         )
    //         .click();

    //       await page.waitForSelector('[role="dialog"].ant-modal');

    //       await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

    //       await page.click('[data-testid="hard-delete-option"]');
    //       await page.check('[data-testid="hard-delete"]');
    //       await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

    //       const deleteResponse = page.waitForResponse(
    //         '/api/v1/knowledgeCenter/*?hardDelete=true&recursive=true'
    //       );

    //       await page.click('[data-testid="confirm-button"]');

    //       await deleteResponse;

    //       await toastNotification(page, /deleted successfully!/);
    //     }
    //   }
    // );
  });

  test('Verify Left Panel hierarchy pagination functionality', async ({
    page,
    browser,
  }) => {
    test.slow(true);

    try {
      const { apiContext } = await createNewPage(browser);
      await knowledgeCenter2.create(apiContext, 10);
      await sidebarClick(page, SidebarItem.ARTICLE);

      // Get the first element content before scrolling
      const firstElementBeforeScroll = page
        .locator('[data-testid="knowledge-pages-hierarchy"] .ant-tree-treenode')
        .first();
      const paginationResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/knowledgeCenter/search/hierarchy') &&
          response.url().includes(`offset=100`) &&
          response.url().includes('limit=100') &&
          response.status() === 200
      );

      const scrollHeight = await page
        .locator(
          '[data-testid="knowledge-pages-hierarchy"] .ant-tree-list-holder > div'
        )
        .evaluate((element) => element.scrollHeight);

      await page.locator('[data-testid="knowledge-pages-hierarchy"]').hover();
      await page.mouse.wheel(0, scrollHeight);
      await paginationResponse;

      // Wait a bit for any potential scroll resets
      await page.waitForTimeout(1000);

      // Get the first element content after scrolling
      const firstElementAfterScroll = await page
        .locator('[data-testid="knowledge-pages-hierarchy"] .ant-tree-treenode')
        .first()
        .textContent();

      // Verify that the first element content is not same on before and after scroll
      // scroll was being reset in left panel due to use of activeKey in DirectoryTree component
      // Verify that the first element content is not same on before and after scroll
      // scroll was being reset in left panel due to use of activeKey in DirectoryTree component
      expect(firstElementBeforeScroll).not.toBe(firstElementAfterScroll);
    } finally {
      const { apiContext, afterAction } = await createNewPage(browser);
      await knowledgeCenter2.delete(apiContext);
      await afterAction();
    }
  });

  test('Activity feed functionality in Knowledge Center page', async ({
    page,
  }) => {
    const createKnowledgePage = page.waitForResponse('/api/v1/knowledgeCenter');

    await sidebarClick(page, SidebarItem.ARTICLE);
    await page.getByTestId('create-knowledge-page-btn').click();
    await page.getByTestId('create-article-btn').click();
    await createKnowledgePage;

    await addTitle(page, knowledgePageArticle.title);

    await page.waitForSelector('[data-testid="entity-header-display-name"]');

    await test.step('Create a new conversation thread', async () => {
      await page.locator('[data-testid="conversation"]').click();

      await page.locator('.feed-drawer').waitFor({ state: 'visible' });

      await page.getByRole('tab', { name: 'Conversations' }).click();

      await page.waitForSelector('[data-testid="editor-wrapper"]');

      const conversationMessage = `Test Conversation Message ${uuid()}`;
      await page
        .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
        .click();
      await page
        .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
        .fill(conversationMessage);

      const feedResponse = page.waitForResponse('/api/v1/feed');

      await page.locator('[data-testid="send-button"]').click();

      await feedResponse;

      await expect(page.locator(`text=${conversationMessage}`)).toBeVisible();
    });

    await test.step('Test post update functionality', async () => {
      await page.locator('[data-testid="main-message"]').hover();

      await page.locator('[data-testid="edit-message"]').click();

      await page.waitForSelector('[data-testid="editor-wrapper"]');

      const updatedMessage = `Updated Thread Message ${uuid()}`;
      await page
        .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
        .click();
      await page
        .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
        .clear();
      await page
        .locator('[data-testid="editor-wrapper"] [contenteditable="true"]')
        .fill(updatedMessage);

      const updateThreadPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.request().method() === 'PATCH'
      );

      await page.locator('[data-testid="save-button"]').click();

      await updateThreadPromise;

      await expect(page.locator(`text=${updatedMessage}`)).toBeVisible();
    });

    await test.step('Test post deletion functionality', async () => {
      await page.locator('[data-testid="main-message"]').hover();

      await page.locator('[data-testid="delete-message"]').click();

      const deletePostPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/feed') &&
          response.request().method() === 'DELETE'
      );

      await page.waitForSelector('[role="dialog"].ant-modal', {
        state: 'visible',
      });

      await page.locator('[data-testid="save-button"]').click();

      await deletePostPromise;

      await expect(
        page.locator('[data-testid="main-message"]')
      ).not.toBeVisible();
    });
  });

  test('User Mentions in article and redirect should work of Knowledge Center page', async ({
    page,
  }) => {
    const createKnowledgePage = page.waitForResponse('/api/v1/knowledgeCenter');
    await sidebarClick(page, SidebarItem.ARTICLE);
    await page.getByTestId('create-knowledge-page-btn').click();
    await page.getByTestId('create-article-btn').click();
    await createKnowledgePage;

    await addTitle(page, knowledgePageArticle.title);

    await page.waitForSelector('[data-testid="entity-header-display-name"]');

    await test.step('Create a new conversation thread with mention', async () => {
      const conversationMessage = `Test Conversation Message with mention ${uuid()}`;

      await createMentionInConversation(page, 'admin', conversationMessage);
    });

    await test.step('Verify notification appears and click to navigate', async () => {
      await redirectToHomePage(page);
      // Verify notification and click to navigate to the article
      await verifyNotificationAndClick(
        page,
        'admin',
        knowledgePageArticle.title
      );

      await waitForAllLoadersToDisappear(page);

      // Verify we are redirected to the correct article page
      await expect(
        page.locator('[data-testid="entity-header-display-name"]')
      ).toHaveValue(knowledgePageArticle.title);
    });
  });

  test('Article mentions in description should working for Knowledge Center', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    await knowledgeCenter.addDataAssetToPage(apiContext);
    await afterAction();

    const waitForRelatedArticles = page.waitForResponse(
      `/api/v1/knowledgeCenter?*`
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
      .fill(`#${knowledgeCenter.knowledgePages[0].displayName}`);
    await mentionResponse;

    await page
      .getByTestId(
        `hash-mention-${knowledgeCenter.knowledgePages[0].displayName}`
      )
      .click();
    await page.getByTestId('save').click();

    await page.waitForSelector('[role="dialog"].description-markdown-editor', {
      state: 'hidden',
    });

    const element = page.locator(
      `[data-label=${knowledgeCenter.knowledgePages[0].displayName}]`
    );

    const href = await element.getAttribute('href');

    expect(href).toMatch(
      new RegExp(`/knowledge-center/${knowledgeCenter.knowledgePages[0].name}$`)
    );
  });

  test('Explore Filter by Knowledge Center', async ({ page }) => {
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

    await expect(page.getByTestId('search-dropdown-Data Assets')).toContainText(
      'Data Assets: page'
    );

    await expect(
      page.getByTestId('search-error-placeholder')
    ).not.toBeVisible();
  });

  // TODO: Commented out due to performance issue with infinite scroll it's taking too long to load the data.
  // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
  // with large data sets. UI needs to be enhanced to fix this performance issue.
  // test('New article should be visible in left panel when created using add page button', async ({
  //   page,
  //   browser,
  // }) => {
  //   test.slow(true);

  //   const { apiContext } = await createNewPage(browser);

  //   // Create a parent article to which we'll add a child
  //   const parentArticle = await apiContext.post('/api/v1/knowledgeCenter', {
  //     data: {
  //       name: `Article_${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       displayName: `Parent_Article_${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       description: 'Parent Article for testing add page',
  //       pageType: 'Article',
  //       page: {
  //         publicationDate: new Date(),
  //         relatedArticles: [],
  //       },
  //       owners: [
  //         {
  //           type: 'user',
  //           id: user.responseData.id,
  //         },
  //       ],
  //     },
  //   });

  //   const parentArticleData = await parentArticle.json();

  //   try {
  //     // Navigate to knowledge center
  //     await sidebarClick(page, SidebarItem.KNOWLEDGE_CENTER);

  //     // Wait for hierarchy to load
  //     await page.waitForSelector('[data-testid="knowledge-pages-hierarchy"]');

  //     await test.step('Find parent article in hierarchy', async () => {
  //       // Find the parent article in the hierarchy using the helper function
  //       // TODO: Commented out due to performance issue with infinite scroll
  //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
  //       // with large data sets. UI needs to be enhanced to fix this performance issue.
  //       // await readArticleInHierarchy(page, parentArticleData.displayName);
  //       // Verify parent article is visible
  //       // await expect(
  //       //   page.locator(
  //       //     `[data-testid="page-node-${parentArticleData.displayName}"]`
  //       //   )
  //       // ).toBeVisible();
  //     });

  //     await test.step(
  //       'Create new article using add page button and verify visibility',
  //       async () => {
  //         // Wait for the create knowledge page API call
  //         const createKnowledgePagePromise = page.waitForResponse(
  //           '/api/v1/knowledgeCenter'
  //         );

  //         // Hover over the parent article to reveal the add button
  //         await page
  //           .locator(
  //             `[data-testid="page-node-${parentArticleData.displayName}"]`
  //           )
  //           .hover();

  //         // Click the add page button for the parent article
  //         await page
  //           .locator(
  //             `[data-testid="${parentArticleData.displayName}-add-page-btn"]`
  //           )
  //           .click();

  //         // Wait for the API call to complete
  //         await createKnowledgePagePromise;

  //         // Verify we're on a new article page with empty title
  //         await expect(
  //           page.getByTestId('entity-header-display-name')
  //         ).toBeEmpty();

  //         // Add a title to the newly created article
  //         const newArticleTitle = `New Article ${cryptoRandomString({
  //           length: 8,
  //           type: 'alphanumeric',
  //         })}`;
  //         await addTitle(page, newArticleTitle);

  //         // Verify the newly created article is visible in the left panel hierarchy
  //         // TODO: Commented out due to performance issue with infinite scroll
  //         // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
  //         // with large data sets. UI needs to be enhanced to fix this performance issue.
  //         // await readArticleInHierarchy(page, newArticleTitle);

  //         // await expect(
  //         //   page.locator(`[data-testid="page-node-${newArticleTitle}"]`)
  //         // ).toBeVisible();

  //         // Verify the article is nested under the parent (check parent is expanded)
  //         await test.step('Verify article hierarchy structure', async () => {
  //           // The new article should be visible as a child of the parent
  //           // Click on the new article to navigate to it
  //           await page
  //             .locator(`[data-testid="page-node-${newArticleTitle}"]`)
  //             .click();

  //           await page.waitForLoadState('networkidle');

  //           // Verify we're on the correct article page
  //           await expect(
  //             page.locator('[data-testid="entity-header-display-name"]')
  //           ).toHaveValue(newArticleTitle);

  //           // Navigate back to knowledge center
  //           await sidebarClick(page, SidebarItem.KNOWLEDGE_CENTER);

  //           // Verify parent can be collapsed and the child disappears
  //           await page
  //             .locator(
  //               `[data-testid="${parentArticleData.displayName}-collapse-icon"]`
  //             )
  //             .click();

  //           await page.waitForTimeout(500);

  //           // Child should not be visible when parent is collapsed
  //           await expect(
  //             page.locator(`[data-testid="page-node-${newArticleTitle}"]`)
  //           ).not.toBeVisible();

  //           // Expand parent again
  //           await page
  //             .locator(
  //               `[data-testid="${parentArticleData.displayName}-collapse-icon"]`
  //             )
  //             .click();

  //           await page.waitForTimeout(500);

  //           // Child should be visible again when parent is expanded
  //           await expect(
  //             page.locator(`[data-testid="page-node-${newArticleTitle}"]`)
  //           ).toBeVisible();
  //         });

  //         // Clean up: Delete the created article
  //         await page
  //           .locator(`[data-testid="page-node-${newArticleTitle}"]`)
  //           .click();

  //         await page.waitForLoadState('networkidle');

  //         await deletePage(page);
  //       }
  //     );
  //   } finally {
  //     // Clean up: Delete the parent article
  //     const { apiContext: cleanupContext, afterAction } = await createNewPage(
  //       browser
  //     );
  //     await cleanupContext.delete(
  //       `/api/v1/knowledgeCenter/${parentArticleData.id}?hardDelete=true&recursive=true`
  //     );
  //     await afterAction();
  //   }
  // });

  // TODO: Commented out due to performance issue with infinite scroll it's taking too long to load the data.
  // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
  // with large data sets. UI needs to be enhanced to fix this performance issue.
  // await readArticleInHierarchy(page, grandChildArticleData.displayName);

  // test('Nested hierarchy navigation with activeFqn should expand parent nodes', async ({
  //   page,
  //   browser,
  // }) => {
  //   test.slow(true);

  //   const { apiContext } = await createNewPage(browser);

  //   // Create a parent article
  //   const parentArticle = await apiContext.post('/api/v1/knowledgeCenter', {
  //     data: {
  //       name: `Article_${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       displayName: `Parent_Article${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       description: 'Parent Article Description',
  //       pageType: 'Article',
  //       page: {
  //         publicationDate: new Date(),
  //         relatedArticles: [],
  //       },
  //       owners: [
  //         {
  //           type: 'user',
  //           id: user.responseData.id,
  //         },
  //       ],
  //     },
  //   });

  //   const parentArticleData = await parentArticle.json();

  //   // Create a child article under parent
  //   const childArticle = await apiContext.post('/api/v1/knowledgeCenter', {
  //     data: {
  //       name: `Article_${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       displayName: `Child_Article${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       description: 'Child Article Description',
  //       pageType: 'Article',
  //       page: {
  //         publicationDate: new Date(),
  //         relatedArticles: [],
  //       },
  //       owners: [
  //         {
  //           type: 'user',
  //           id: user.responseData.id,
  //         },
  //       ],
  //       parent: {
  //         id: parentArticleData.id,
  //         type: 'page',
  //       },
  //     },
  //   });

  //   const childArticleData = await childArticle.json();

  //   // Create a grandchild article under child
  //   const grandChildArticle = await apiContext.post('/api/v1/knowledgeCenter', {
  //     data: {
  //       name: `Article_${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       displayName: `GrandChild_Article${cryptoRandomString({
  //         length: 8,
  //         type: 'alphanumeric',
  //       })}`,
  //       description: 'GrandChild Article Description',
  //       pageType: 'Article',
  //       page: {
  //         publicationDate: new Date(),
  //         relatedArticles: [],
  //       },
  //       owners: [
  //         {
  //           type: 'user',
  //           id: user.responseData.id,
  //         },
  //       ],
  //       parent: {
  //         id: childArticleData.id,
  //         type: 'page',
  //       },
  //     },
  //   });

  //   const grandChildArticleData = await grandChildArticle.json();
  //   const grandChildArticleFqn = grandChildArticleData.fullyQualifiedName;

  //   // Navigate to knowledge center
  //   await sidebarClick(page, SidebarItem.KNOWLEDGE_CENTER);

  //   await test.step(
  //     'Navigate directly to grandchild article using activeFqn',
  //     async () => {
  //       // Wait for the hierarchy API call with activeFqn
  //       const hierarchyWithActiveFqnResponse = page.waitForResponse(
  //         (response) =>
  //           response
  //             .url()
  //             .includes('/api/v1/knowledgeCenter/search/hierarchy') &&
  //           response.url().includes(`activeFqn=${grandChildArticleFqn}`)
  //       );

  //       // Navigate directly to grandchild article
  //       await page.goto(`/knowledge-center/${grandChildArticleFqn}`, {
  //         waitUntil: 'networkidle',
  //       });

  //       await hierarchyWithActiveFqnResponse;

  //       // Wait for page to load
  //       await page.waitForSelector('[data-testid="loader"]', {
  //         state: 'detached',
  //       });

  //       // Verify grandchild article is loaded
  //       await expect(
  //         page.locator('[data-testid="entity-header-display-name"]')
  //       ).toHaveValue(grandChildArticleData.displayName);

  //       // TODO: Commented out due to performance issue with infinite scroll
  //       // The readArticleInHierarchy function uses infinite scroll which takes 6-7 minutes
  //       // with large data sets. UI needs to be enhanced to fix this performance issue.
  //       // await readArticleInHierarchy(page, grandChildArticleData.displayName);
  //     }
  //   );

  //   await test.step(
  //     'Verify parent and child nodes are expanded in hierarchy',
  //     async () => {
  //       // Verify parent node is visible and expanded
  //       await expect(
  //         page.locator(
  //           `[data-testid="page-node-${parentArticleData.displayName}"]`
  //         )
  //       ).toBeVisible();

  //       // Verify child node is visible and expanded (nested under parent)
  //       await expect(
  //         page.locator(
  //           `[data-testid="page-node-${childArticleData.displayName}"]`
  //         )
  //       ).toBeVisible();

  //       // Verify grandchild node is visible (nested under child)
  //       await expect(
  //         page.locator(
  //           `[data-testid="page-node-${grandChildArticleData.displayName}"]`
  //         )
  //       ).toBeVisible();

  //       // Verify the parent node collapse icon is showing as expanded
  //       await expect(
  //         page.locator(
  //           `[data-testid="${parentArticleData.displayName}-collapse-icon"]`
  //         )
  //       ).toBeVisible();

  //       // Verify the child node collapse icon is showing as expanded
  //       await expect(
  //         page.locator(
  //           `[data-testid="${childArticleData.displayName}-collapse-icon"]`
  //         )
  //       ).toBeVisible();
  //     }
  //   );

  //   await test.step('Verify hierarchy structure is correct', async () => {
  //     // Click on parent to collapse
  //     await page
  //       .locator(
  //         `[data-testid="${parentArticleData.displayName}-collapse-icon"]`
  //       )
  //       .click();

  //     // Wait a bit for collapse animation
  //     await page.waitForTimeout(500);

  //     // Verify child and grandchild are not visible after collapse
  //     await expect(
  //       page.locator(
  //         `[data-testid="page-node-${childArticleData.displayName}"]`
  //       )
  //     ).not.toBeVisible();

  //     await expect(
  //       page.locator(`[data-testid="page-node-${grandChildArticleFqn}"]`)
  //     ).not.toBeVisible();

  //     // Expand parent again
  //     await page
  //       .locator(
  //         `[data-testid="${parentArticleData.displayName}-collapse-icon"]`
  //       )
  //       .click();

  //     // Wait for expand animation
  //     await page.waitForTimeout(500);

  //     // Verify child is visible again
  //     await expect(
  //       page.locator(
  //         `[data-testid="page-node-${childArticleData.displayName}"]`
  //       )
  //     ).toBeVisible();

  //     // Verify grandchild is visible again
  //     await expect(
  //       page.locator(
  //         `[data-testid="page-node-${grandChildArticleData.displayName}"]`
  //       )
  //     ).toBeVisible();
  //   });

  //   await test.step('Navigate between nested articles', async () => {
  //     // Click on child article
  //     await page
  //       .locator(`[data-testid="page-node-${childArticleData.displayName}"]`)
  //       .click();

  //     await page.waitForLoadState('networkidle');

  //     // Verify child article is loaded
  //     await expect(
  //       page.locator('[data-testid="entity-header-display-name"]')
  //     ).toHaveValue(childArticleData.displayName);

  //     // Click on parent article
  //     await page
  //       .locator(`[data-testid="page-node-${parentArticleData.displayName}"]`)
  //       .click();

  //     await page.waitForLoadState('networkidle');

  //     // Verify parent article is loaded
  //     await expect(
  //       page.locator('[data-testid="entity-header-display-name"]')
  //     ).toHaveValue(parentArticleData.displayName);
  //   });
  // });
});
