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
  Page,
  test as base,
} from '@playwright/test';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getDefaultAdminAPIContext, uuid } from '../../utils/common';
import {
  buildPermissionRule,
  createDisposableArchivedDocument,
  loginAsUser,
  MEMORIES_API,
  navigateToArticles,
  navigateToDashboard,
  navigateToDocuments,
  navigateToMemories,
  uploadDisposableDocument,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

const deleteDisposableArticleByFqn = async (
  apiContext: APIRequestContext,
  fqn: string
) => {
  const res = await apiContext.get(
    `/api/v1/contextCenter/pages/name/${fqn}?fields=id`
  );
  const data = await res.json();
  await apiContext.delete(
    `/api/v1/contextCenter/pages/${data.id}?hardDelete=true&recursive=true`
  );
};

const test = base.extend<{
  viewOnlyPage: Page;
  createAllPage: Page;
  editAllPage: Page;
  deleteAllPage: Page;
  allPermissionPage: Page;
}>({
  viewOnlyPage: async ({ browser }, use) => {
    const page = await loginAsUser(browser, viewOnlyUser);
    await use(page);
    await page.close();
  },
  createAllPage: async ({ browser }, use) => {
    const page = await loginAsUser(browser, createAllUser);
    await use(page);
    await page.close();
  },
  editAllPage: async ({ browser }, use) => {
    const page = await loginAsUser(browser, editAllUser);
    await use(page);
    await page.close();
  },
  deleteAllPage: async ({ browser }, use) => {
    const page = await loginAsUser(browser, deleteAllUser);
    await use(page);
    await page.close();
  },
  allPermissionPage: async ({ browser }, use) => {
    const page = await loginAsUser(browser, allPermissionUser);
    await use(page);
    await page.close();
  },
});

// ─── Permission-matrix users (resource-level, ['All']) ─────────────────────

let viewOnlyUser: UserClass;
let createAllUser: UserClass;
let editAllUser: UserClass;
let deleteAllUser: UserClass;
let allPermissionUser: UserClass;

const VIEW_ONLY_RULE = buildPermissionRule(
  'cc-permission-view-only',
  ['All'],
  ['ViewAll']
);
const CREATE_ALL_RULE = buildPermissionRule(
  'cc-permission-create-all',
  ['All'],
  ['Create', 'ViewAll']
);
const EDIT_ALL_RULE = buildPermissionRule(
  'cc-permission-edit-all',
  ['All'],
  ['EditAll', 'ViewAll']
);
const DELETE_ALL_RULE = buildPermissionRule(
  'cc-permission-delete-all',
  ['All'],
  ['Delete', 'ViewAll']
);
const FULL_PERMISSION_RULE = buildPermissionRule(
  'cc-permission-full',
  ['All'],
  ['Create', 'EditAll', 'Delete', 'ViewAll']
);

// ─── Test data ───────────────────────────────────────────────────────────────

let articleEntity: KnowledgeCenterClass;
let documentId = '';
let documentName = '';
let folderId = '';
let archivedDocumentId = '';

let ownerMemoryId = '';

let quickLinkId = '';
let quickLinkDisplayName = '';

let editAllOwnMemoryId = '';
let deleteAllOwnMemoryId = '';
let allPermissionOwnMemoryId = '';
let viewOnlyOwnMemoryId = '';

test.describe('Context Center Permissions', () => {
  test.slow(true);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    articleEntity = new KnowledgeCenterClass({
      displayName: `CC Permission Article ${uuid()}`,
      name: `cc_permission_article_${uuid()}`,
    });
    await articleEntity.create(apiContext);

    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      {
        data: { name: `cc_permission_folder_${uuid()}` },
      }
    );
    const folderData = await folderRes.json();
    folderId = folderData.id;

    documentName = `cc-permission-doc-${uuid()}.txt`;
    const docRes = await apiContext.post(
      '/api/v1/contextCenter/drive/files/upload',
      {
        multipart: {
          file: {
            name: documentName,
            mimeType: 'text/plain',
            buffer: Buffer.from('Playwright permission test document'),
          },
        },
      }
    );
    const docData = await docRes.json();
    documentId = docData.id;

    const archivedDocName = `cc-permission-archived-doc-${uuid()}.txt`;
    const archivedDocRes = await apiContext.post(
      '/api/v1/contextCenter/drive/files/upload',
      {
        multipart: {
          file: {
            name: archivedDocName,
            mimeType: 'text/plain',
            buffer: Buffer.from('Playwright permission test archived document'),
          },
        },
      }
    );
    const archivedDocData = await archivedDocRes.json();
    archivedDocumentId = archivedDocData.id;
    await apiContext.delete(
      `/api/v1/contextCenter/drive/files/${archivedDocumentId}?hardDelete=false`
    );

    quickLinkDisplayName = `CC Permission QuickLink ${uuid()}`;
    const qlRes = await apiContext.post('/api/v1/contextCenter/pages', {
      data: {
        name: `cc_permission_ql_${uuid()}`,
        displayName: quickLinkDisplayName,
        description: 'Quick link for permission matrix tests',
        pageType: 'QuickLink',
        page: { url: 'https://example.com' },
      },
    });
    quickLinkId = (await qlRes.json()).id;

    const memoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: `cc_permission_memory_${uuid()}`,
        title: `CC Permission Memory ${uuid()}`,
        question: 'Owned by admin for permission matrix tests',
        answer: 'Owned by admin for permission matrix tests',
        shareConfig: { visibility: 'Entity' },
      },
    });
    ownerMemoryId = (await memoryRes.json()).id;

    viewOnlyUser = new UserClass();
    await viewOnlyUser.create(apiContext, false);
    await viewOnlyUser.setCustomRulePolicy(
      apiContext,
      VIEW_ONLY_RULE,
      'context-center-permission-view-only'
    );

    createAllUser = new UserClass();
    await createAllUser.create(apiContext, false);
    await createAllUser.setCustomRulePolicy(
      apiContext,
      CREATE_ALL_RULE,
      'context-center-permission-create-all'
    );

    editAllUser = new UserClass();
    await editAllUser.create(apiContext, false);
    await editAllUser.setCustomRulePolicy(
      apiContext,
      EDIT_ALL_RULE,
      'context-center-permission-edit-all'
    );

    deleteAllUser = new UserClass();
    await deleteAllUser.create(apiContext, false);
    await deleteAllUser.setCustomRulePolicy(
      apiContext,
      DELETE_ALL_RULE,
      'context-center-permission-delete-all'
    );

    allPermissionUser = new UserClass();
    await allPermissionUser.create(apiContext, false);
    await allPermissionUser.setCustomRulePolicy(
      apiContext,
      FULL_PERMISSION_RULE,
      'context-center-permission-full'
    );

    const editAllMemoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: `cc_permission_memory_edit_all_${uuid()}`,
        title: `CC Permission Memory Edit-All ${uuid()}`,
        question: 'Owned by editAllUser',
        answer: 'Owned by editAllUser',
        shareConfig: { visibility: 'Entity' },
        owners: [{ id: editAllUser.responseData.id, type: 'user' }],
      },
    });
    editAllOwnMemoryId = (await editAllMemoryRes.json()).id;

    const deleteAllMemoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: `cc_permission_memory_delete_all_${uuid()}`,
        title: `CC Permission Memory Delete-All ${uuid()}`,
        question: 'Owned by deleteAllUser',
        answer: 'Owned by deleteAllUser',
        shareConfig: { visibility: 'Entity' },
        owners: [{ id: deleteAllUser.responseData.id, type: 'user' }],
      },
    });
    deleteAllOwnMemoryId = (await deleteAllMemoryRes.json()).id;

    const allPermissionMemoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: `cc_permission_memory_full_${uuid()}`,
        title: `CC Permission Memory Full ${uuid()}`,
        question: 'Owned by allPermissionUser',
        answer: 'Owned by allPermissionUser',
        shareConfig: { visibility: 'Entity' },
        owners: [{ id: allPermissionUser.responseData.id, type: 'user' }],
      },
    });
    allPermissionOwnMemoryId = (await allPermissionMemoryRes.json()).id;

    const viewOnlyMemoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: `cc_permission_memory_view_only_${uuid()}`,
        title: `CC Permission Memory View-Only Owner ${uuid()}`,
        question: 'Owned by the view-only user',
        answer: 'Owned by the view-only user',
        shareConfig: { visibility: 'Entity' },
        owners: [{ id: viewOnlyUser.responseData.id, type: 'user' }],
      },
    });
    viewOnlyOwnMemoryId = (await viewOnlyMemoryRes.json()).id;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    await articleEntity.delete(apiContext);
    if (quickLinkId) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/pages/${quickLinkId}?hardDelete=true&recursive=true`
        )
        .catch(() => undefined);
    }
    if (folderId) {
      await apiContext.delete(
        `/api/v1/contextCenter/drive/folders/${folderId}?hardDelete=true`
      );
    }
    if (documentId) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/drive/files/${documentId}?hardDelete=true`
        )
        .catch(() => undefined);
    }
    if (archivedDocumentId) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/drive/files/${archivedDocumentId}?hardDelete=true`
        )
        .catch(() => undefined);
    }
    for (const memoryId of [
      ownerMemoryId,
      editAllOwnMemoryId,
      deleteAllOwnMemoryId,
      allPermissionOwnMemoryId,
      viewOnlyOwnMemoryId,
    ]) {
      if (memoryId) {
        await apiContext
          .delete(`${MEMORIES_API}/${memoryId}?hardDelete=true`)
          .catch(() => undefined);
      }
    }
    for (const user of [
      viewOnlyUser,
      createAllUser,
      editAllUser,
      deleteAllUser,
      allPermissionUser,
    ]) {
      if (user?.responseData?.id) {
        await user.delete(apiContext);
      }
    }
    await afterAction();
  });

  // ─── Dashboard Permissions ──────────────────────────────────────────────

  test.describe('Dashboard Permissions', () => {
    test('user with view-only permission cannot see create or upload actions', async ({
      viewOnlyPage,
    }) => {
      await navigateToDashboard(viewOnlyPage);

      await expect(
        viewOnlyPage.getByTestId('create-knowledge-page-btn')
      ).not.toBeVisible();
      await expect(
        viewOnlyPage.getByRole('button', { name: /upload file/i })
      ).not.toBeVisible();
    });

    test('user with createAll permission can see create and upload actions and perform them', async ({
      createAllPage,
      browser,
    }) => {
      await navigateToDashboard(createAllPage);

      await expect(
        createAllPage.getByTestId('create-knowledge-page-btn')
      ).toBeVisible();
      await expect(
        createAllPage.getByRole('button', { name: /upload file/i })
      ).toBeVisible();

      await test.step('can create an article', async () => {
        const createResPromise = createAllPage.waitForResponse(
          '/api/v1/contextCenter/pages'
        );
        await createAllPage.getByTestId('create-knowledge-page-btn').click();
        await createAllPage.getByTestId('create-article-btn').click();
        const createRes = await createResPromise;

        expect(createRes.status()).toBe(201);
        await expect(createAllPage).toHaveURL(/\/context-center\/articles\//);
        await expect(
          createAllPage.getByTestId('entity-header-display-name')
        ).toBeVisible();

        const fqn = createAllPage
          .url()
          .split('/context-center/articles/')
          .pop()
          ?.split('/')[0];
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        if (fqn) {
          await deleteDisposableArticleByFqn(
            apiContext,
            decodeURIComponent(fqn)
          );
        }
        await afterAction();
      });

      await test.step('can upload a document', async () => {
        await navigateToDashboard(createAllPage);
        await createAllPage
          .getByRole('button', { name: /upload file/i })
          .click();

        const modal = createAllPage.getByRole('dialog', {
          name: /upload documents/i,
        });
        await expect(modal).toBeVisible();

        const fileName = `cc-dashboard-upload-${uuid()}.txt`;
        const fileInput = createAllPage.getByTestId('file-upload-input');
        await fileInput.waitFor({ state: 'attached' });
        await fileInput.setInputFiles({
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from('Playwright dashboard upload test'),
        });

        const uploadResPromise = createAllPage.waitForResponse(
          '/api/v1/contextCenter/drive/files/upload'
        );
        await modal.getByRole('button', { name: /attach/i }).click();
        const uploadRes = await uploadResPromise;

        expect(uploadRes.status()).toBe(201);
        await expect(modal).not.toBeVisible();

        const uploadedData = await uploadRes.json();
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await apiContext
          .delete(
            `/api/v1/contextCenter/drive/files/${uploadedData.id}?hardDelete=true`
          )
          .catch(() => undefined);
        await afterAction();
      });
    });

    test('user with editAll permission cannot see create or upload actions', async ({
      editAllPage,
    }) => {
      await navigateToDashboard(editAllPage);

      await expect(
        editAllPage.getByTestId('create-knowledge-page-btn')
      ).not.toBeVisible();
      await expect(
        editAllPage.getByRole('button', { name: /upload file/i })
      ).not.toBeVisible();
    });

    test('user with deleteAll permission cannot see create or upload actions', async ({
      deleteAllPage,
    }) => {
      await navigateToDashboard(deleteAllPage);

      await expect(
        deleteAllPage.getByTestId('create-knowledge-page-btn')
      ).not.toBeVisible();
      await expect(
        deleteAllPage.getByRole('button', { name: /upload file/i })
      ).not.toBeVisible();
    });

    test('user with all permissions can see create and upload actions', async ({
      allPermissionPage,
    }) => {
      await navigateToDashboard(allPermissionPage);

      await expect(
        allPermissionPage.getByTestId('create-knowledge-page-btn')
      ).toBeVisible();
      await expect(
        allPermissionPage.getByRole('button', { name: /upload file/i })
      ).toBeVisible();
    });
  });

  // ─── Articles Permissions ───────────────────────────────────────────────

  test.describe('Articles Permissions', () => {
    test('user with view-only permission cannot see create or delete actions, but can use share/vote/conversation actions', async ({
      viewOnlyPage,
    }) => {
      await viewOnlyPage.locator('.ant-skeleton-input').waitFor({
        state: 'detached',
      });
      await test.step('articles list create action is hidden', async () => {
        await navigateToArticles(viewOnlyPage);

        await expect(
          viewOnlyPage.getByTestId('create-knowledge-page-btn')
        ).not.toBeVisible();
      });

      await test.step('hierarchy tree delete button is hidden for articles', async () => {
        await navigateToArticles(viewOnlyPage);

        const articleNode = viewOnlyPage.getByTestId(
          `page-node-${articleEntity.responseData.displayName}`
        );
        await expect(articleNode).toBeVisible();
        await articleNode.hover();
        await expect(
          viewOnlyPage.getByTestId(
            `${articleEntity.responseData.displayName}-delete-page-btn`
          )
        ).not.toBeVisible();
      });

      await test.step('quick link card has no edit or delete buttons', async () => {
        await navigateToArticles(viewOnlyPage);

        const qlCard = viewOnlyPage.getByTestId(
          `knowledge-card-${quickLinkDisplayName}`
        );
        await expect(qlCard).toBeVisible();
        await expect(
          qlCard.getByTestId('edit-quick-link-btn')
        ).not.toBeVisible();
        await expect(
          qlCard.getByTestId('delete-quick-link-btn')
        ).not.toBeVisible();
      });

      await test.step('article detail manage (delete) and edit-domain/edit-owner actions are hidden', async () => {
        await viewOnlyPage.goto(
          `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(viewOnlyPage);

        await expect(
          viewOnlyPage.getByTestId('manage-button')
        ).not.toBeVisible();
        await expect(
          viewOnlyPage.getByTestId('edit-domain-btn')
        ).not.toBeVisible();
        await expect(
          viewOnlyPage.getByTestId('edit-owner-btn')
        ).not.toBeVisible();
      });

      await test.step('can copy article link', async () => {
        const shareBtn = viewOnlyPage.getByTestId('share-btn');
        await expect(shareBtn).toBeVisible();
        await shareBtn.click();

        await expect(
          viewOnlyPage.getByText('Link copied to clipboard')
        ).toBeVisible();
      });

      await test.step('can upvote and downvote the article', async () => {
        const upvoteBtn = viewOnlyPage.getByTestId('upvote-btn');
        const downvoteBtn = viewOnlyPage.getByTestId('downvote-btn');
        await expect(upvoteBtn).toBeVisible();
        await expect(downvoteBtn).toBeVisible();

        const upvoteResPromise = viewOnlyPage.waitForResponse(
          `/api/v1/contextCenter/pages/${articleEntity.responseData.id}/vote`
        );
        await upvoteBtn.click();
        const upvoteRes = await upvoteResPromise;

        expect(upvoteRes.status()).toBe(200);
        await expect(upvoteBtn.locator('svg')).toHaveClass(
          /fill-utility-blue-500/
        );

        const downvoteResPromise = viewOnlyPage.waitForResponse(
          `/api/v1/contextCenter/pages/${articleEntity.responseData.id}/vote`
        );
        await downvoteBtn.click();
        const downvoteRes = await downvoteResPromise;

        expect(downvoteRes.status()).toBe(200);
        await expect(downvoteBtn.locator('svg')).toHaveClass(
          /fill-utility-blue-500/
        );
      });

      await test.step('can start a conversation on the article', async () => {
        await viewOnlyPage.getByTestId('conversation').click();
        await viewOnlyPage
          .locator('.feed-drawer')
          .waitFor({ state: 'visible' });
        await viewOnlyPage.getByRole('tab', { name: 'Conversations' }).click();
        const editor = viewOnlyPage.locator(
          '[data-testid="editor-wrapper"] [contenteditable="true"]'
        );
        await expect(editor).toBeVisible();

        const conversationMessage = `Permission test conversation ${uuid()}`;
        await editor.click();
        await editor.fill(conversationMessage);

        const feedResPromise = viewOnlyPage.waitForResponse('/api/v1/feed');
        await viewOnlyPage.getByTestId('send-button').click();
        const feedRes = await feedResPromise;

        expect(feedRes.status()).toBe(201);
        await expect(viewOnlyPage.getByText(conversationMessage)).toBeVisible();
        await viewOnlyPage.getByTestId('closeDrawer').click();
      });

      await test.step('can follow and unfollow the article', async () => {
        const followBtn = viewOnlyPage.getByTestId('follow-btn');
        await expect(followBtn).toBeVisible();

        const followResPromise = viewOnlyPage.waitForResponse(
          `/api/v1/contextCenter/pages/${articleEntity.responseData.id}/followers`
        );
        await followBtn.click();
        const followRes = await followResPromise;

        expect(followRes.status()).toBe(200);
        await expect(followBtn).toHaveClass(/text-brand-600/);

        const unfollowResPromise = viewOnlyPage.waitForResponse((response) =>
          response
            .url()
            .includes(
              `/api/v1/contextCenter/pages/${articleEntity.responseData.id}/followers/`
            )
        );
        await followBtn.click();
        const unfollowRes = await unfollowResPromise;

        expect(unfollowRes.status()).toBe(200);
        await expect(followBtn).not.toHaveClass(/text-brand-600/);
      });
    });

    test('user with createAll permission can see create action but not delete action, and can create an article', async ({
      createAllPage,
      browser,
    }) => {
      await test.step('articles list create action is visible', async () => {
        await navigateToArticles(createAllPage);

        await expect(
          createAllPage.getByTestId('create-knowledge-page-btn')
        ).toBeVisible();
      });

      await test.step('hierarchy tree delete button is hidden for articles', async () => {
        await navigateToArticles(createAllPage);

        const articleNode = createAllPage.getByTestId(
          `page-node-${articleEntity.responseData.displayName}`
        );
        await expect(articleNode).toBeVisible();
        await articleNode.hover();
        await expect(
          createAllPage.getByTestId(
            `${articleEntity.responseData.displayName}-delete-page-btn`
          )
        ).not.toBeVisible();
      });

      await test.step('can create a quick link', async () => {
        await navigateToArticles(createAllPage);

        await createAllPage.getByTestId('create-knowledge-page-btn').click();
        await createAllPage.getByTestId('create-quick-link-btn').click();

        const modal = createAllPage.getByTestId('quick-link-form');
        await expect(modal).toBeVisible();

        const qlDisplayName = `CC Permission Create QL ${uuid()}`;
        await createAllPage
          .getByTestId('displayName')
          .locator('input')
          .fill(qlDisplayName);
        await createAllPage
          .getByTestId('url')
          .locator('input')
          .fill('https://example.com');

        const createResPromise = createAllPage.waitForResponse(
          '/api/v1/contextCenter/pages'
        );
        await createAllPage.getByRole('button', { name: /^save$/i }).click();
        const createRes = await createResPromise;

        expect(createRes.status()).toBe(201);

        const createdQl = await createRes.json();
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await apiContext
          .delete(
            `/api/v1/contextCenter/pages/${createdQl.id}?hardDelete=true&recursive=true`
          )
          .catch(() => undefined);
        await afterAction();
      });

      await test.step('article detail manage (delete) action is hidden', async () => {
        await createAllPage.goto(
          `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(createAllPage);

        await expect(
          createAllPage.getByTestId('manage-button')
        ).not.toBeVisible();
      });

      await test.step('can create an article from the articles page', async () => {
        await navigateToArticles(createAllPage);

        await createAllPage.getByTestId('create-knowledge-page-btn').click();
        const articleItem = createAllPage.getByTestId('create-article-btn');
        await expect(articleItem).toBeVisible();

        const createResPromise = createAllPage.waitForResponse(
          '/api/v1/contextCenter/pages'
        );
        await articleItem.click();
        const createRes = await createResPromise;

        expect(createRes.status()).toBe(201);
        await expect(createAllPage).toHaveURL(/\/context-center\/articles\//);
        await expect(
          createAllPage.getByTestId('entity-header-display-name')
        ).toBeVisible();

        const fqn = createAllPage
          .url()
          .split('/context-center/articles/')
          .pop()
          ?.split('/')[0];
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        if (fqn) {
          await deleteDisposableArticleByFqn(
            apiContext,
            decodeURIComponent(fqn)
          );
        }
        await afterAction();
      });
      await test.step('cannot be able to move an article under another article', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const parentName = `cc_permission_move_parent_${uuid()}`;
        const childName = `cc_permission_move_child_${uuid()}`;
        const parentRes = await apiContext.post('/api/v1/contextCenter/pages', {
          data: {
            name: parentName,
            displayName: `CC Permission Move Parent ${uuid()}`,
            description: 'Disposable parent article for editAll move test',
            pageType: 'Article',
            page: { publicationDate: Date.now(), relatedArticles: [] },
          },
        });
        const parentArticle = await parentRes.json();
        const childRes = await apiContext.post('/api/v1/contextCenter/pages', {
          data: {
            name: childName,
            displayName: `CC Permission Move Child ${uuid()}`,
            description: 'Disposable child article for editAll move test',
            pageType: 'Article',
            page: { publicationDate: Date.now(), relatedArticles: [] },
          },
        });
        const childArticle = await childRes.json();
        await afterAction();

        const childDisplayName = childArticle.displayName;
        const parentDisplayName = parentArticle.displayName;

        // Poll until ES indexes both new articles into the hierarchy tree
        await createAllPage.waitForFunction(
          async ([childDN, parentDN]) => {
            const res = await fetch(
              `/api/v1/contextCenter/pages/search/hierarchy?pageType=Article&offset=0&limit=100`
            );
            const json = await res.json();
            const names = new Set(
              (json.data ?? []).map(
                (n: { displayName?: string }) => n.displayName
              )
            );

            return names.has(childDN) && names.has(parentDN);
          },
          [childDisplayName, parentDisplayName],
          { timeout: 30000, polling: 2000 }
        );

        await navigateToArticles(createAllPage);
        await createAllPage
          .getByTestId(`page-node-${childDisplayName}`)
          .waitFor({ state: 'visible' });
        await createAllPage
          .getByTestId(`page-node-${childDisplayName}`)
          .dragTo(createAllPage.getByTestId(`page-node-${parentDisplayName}`));

        const confirmationModal =
          createAllPage.getByTestId('confirmation-modal');
        await expect(confirmationModal).not.toBeVisible();

        const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
          await getDefaultAdminAPIContext(browser);
        await deleteDisposableArticleByFqn(
          cleanupContext,
          `${parentArticle.fullyQualifiedName}.${childArticle.name}`
        );
        await deleteDisposableArticleByFqn(
          cleanupContext,
          parentArticle.fullyQualifiedName
        );
        await cleanupAfterAction();
      });
    });

    test('user with editAll permission cannot see create or delete actions, and can move an article under another article', async ({
      editAllPage,
      browser,
    }) => {
      await test.step('articles list create action is hidden', async () => {
        await navigateToArticles(editAllPage);

        await expect(
          editAllPage.getByTestId('create-knowledge-page-btn')
        ).not.toBeVisible();
      });

      await test.step('quick link card shows edit button but not delete button', async () => {
        await navigateToArticles(editAllPage);

        const qlCard = editAllPage.getByTestId(
          `knowledge-card-${quickLinkDisplayName}`
        );
        await expect(qlCard).toBeVisible();
        await expect(qlCard.getByTestId('edit-quick-link-btn')).toBeVisible();
        await expect(
          qlCard.getByTestId('delete-quick-link-btn')
        ).not.toBeVisible();
      });

      await test.step('article detail manage (delete) action is hidden, but edit-domain/edit-owner actions are visible', async () => {
        await editAllPage.goto(
          `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(editAllPage);

        await expect(
          editAllPage.getByTestId('manage-button')
        ).not.toBeVisible();
        await expect(editAllPage.getByTestId('edit-domain-btn')).toBeVisible();
        await expect(editAllPage.getByTestId('edit-owner-btn')).toBeVisible();
      });

      await test.step('can move an article under another article', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const parentName = `cc_permission_move_parent_${uuid()}`;
        const childName = `cc_permission_move_child_${uuid()}`;
        const parentRes = await apiContext.post('/api/v1/contextCenter/pages', {
          data: {
            name: parentName,
            displayName: `CC Permission Move Parent ${uuid()}`,
            description: 'Disposable parent article for editAll move test',
            pageType: 'Article',
            page: { publicationDate: Date.now(), relatedArticles: [] },
          },
        });
        const parentArticle = await parentRes.json();
        const childRes = await apiContext.post('/api/v1/contextCenter/pages', {
          data: {
            name: childName,
            displayName: `CC Permission Move Child ${uuid()}`,
            description: 'Disposable child article for editAll move test',
            pageType: 'Article',
            page: { publicationDate: Date.now(), relatedArticles: [] },
          },
        });
        const childArticle = await childRes.json();
        await afterAction();

        const childDisplayName = childArticle.displayName;
        const parentDisplayName = parentArticle.displayName;

        // Poll until ES indexes both new articles into the hierarchy tree
        await editAllPage.waitForFunction(
          async ([childDN, parentDN]) => {
            const res = await fetch(
              `/api/v1/contextCenter/pages/search/hierarchy?pageType=Article&offset=0&limit=100`
            );
            const json = await res.json();
            const names = new Set(
              (json.data ?? []).map(
                (n: { displayName?: string }) => n.displayName
              )
            );

            return names.has(childDN) && names.has(parentDN);
          },
          [childDisplayName, parentDisplayName],
          { timeout: 30000, polling: 2000 }
        );

        await navigateToArticles(editAllPage);
        await editAllPage
          .getByTestId(`page-node-${childDisplayName}`)
          .waitFor({ state: 'visible' });

        await editAllPage
          .getByTestId(`page-node-${childDisplayName}`)
          .dragTo(editAllPage.getByTestId(`page-node-${parentDisplayName}`));

        const confirmationModal = editAllPage.getByTestId('confirmation-modal');
        await expect(confirmationModal).toBeVisible();

        const moveResPromise = editAllPage.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/contextCenter/pages/') &&
            response.request().method() === 'PATCH'
        );
        await confirmationModal
          .getByRole('button', { name: /^confirm$/i })
          .click();
        const moveRes = await moveResPromise;

        expect(moveRes.status()).toBe(200);
        await expect(confirmationModal).not.toBeVisible();

        await editAllPage
          .getByTestId(`page-node-${parentDisplayName}`)
          .waitFor({ state: 'visible' });
        const parentNode = editAllPage.getByTestId(
          `page-node-${parentDisplayName}`
        );
        await parentNode.click();
        await editAllPage
          .getByTestId(`page-node-${childDisplayName}`)
          .waitFor({ state: 'visible' });
        await expect(
          editAllPage.getByTestId(`page-node-${childDisplayName}`)
        ).toBeVisible();

        const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
          await getDefaultAdminAPIContext(browser);
        await deleteDisposableArticleByFqn(
          cleanupContext,
          `${parentArticle.fullyQualifiedName}.${childArticle.name}`
        );
        await deleteDisposableArticleByFqn(
          cleanupContext,
          parentArticle.fullyQualifiedName
        );
        await cleanupAfterAction();
      });
    });

    test('user with deleteAll permission can see delete action but not create action, and can delete an article', async ({
      deleteAllPage,
      browser,
    }) => {
      await test.step('quick link card shows delete button but not edit button, and can delete the quick link', async () => {
        await navigateToArticles(deleteAllPage);

        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const disposableQlDisplayName = `CC Permission Delete QL ${uuid()}`;
        const qlRes = await apiContext.post('/api/v1/contextCenter/pages', {
          data: {
            name: `cc_permission_ql_delete_${uuid()}`,
            displayName: disposableQlDisplayName,
            description: 'Disposable quick link for deleteAll permission test',
            pageType: 'QuickLink',
            page: { url: 'https://example.com' },
          },
        });
        const disposableQl = await qlRes.json();
        await afterAction();

        await navigateToArticles(deleteAllPage);

        const qlCard = deleteAllPage.getByTestId(
          `knowledge-card-${disposableQlDisplayName}`
        );
        await expect(qlCard).toBeVisible();
        await expect(
          qlCard.getByTestId('edit-quick-link-btn')
        ).not.toBeVisible();
        await expect(qlCard.getByTestId('delete-quick-link-btn')).toBeVisible();

        const deleteResPromise = deleteAllPage.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/contextCenter/pages/${disposableQl.id}`) &&
            response.url().includes('hardDelete=true')
        );
        await qlCard.getByTestId('delete-quick-link-btn').click();
        await deleteAllPage.getByTestId('confirm-button').click();
        const deleteRes = await deleteResPromise;

        expect(deleteRes.status()).toBe(200);
        await expect(qlCard).not.toBeVisible();
      });

      await test.step('articles list create action is hidden', async () => {
        await navigateToArticles(deleteAllPage);

        await expect(
          deleteAllPage.getByTestId('create-knowledge-page-btn')
        ).not.toBeVisible();
      });

      await test.step('article detail manage (delete) action is visible', async () => {
        await deleteAllPage.goto(
          `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(deleteAllPage);

        await expect(deleteAllPage.getByTestId('manage-button')).toBeVisible();
      });

      await test.step('can delete a disposable article', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const createRes = await apiContext.post('/api/v1/contextCenter/pages', {
          data: {
            name: `cc_permission_delete_article_${uuid()}`,
            displayName: `CC Permission Delete Article ${uuid()}`,
            description: 'Disposable article for deleteAll permission test',
            pageType: 'Article',
            page: { publicationDate: Date.now(), relatedArticles: [] },
          },
        });
        const disposableArticle = await createRes.json();
        await afterAction();

        await deleteAllPage.goto(
          `/context-center/articles/${disposableArticle.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(deleteAllPage);

        await deleteAllPage.getByTestId('manage-button').click();
        await deleteAllPage.getByTestId('delete-btn').click();

        const deleteResPromise = deleteAllPage.waitForResponse(
          /\/api\/v1\/contextCenter\/pages\/[^?]+\?recursive=true&hardDelete=false/
        );
        await deleteAllPage.getByTestId('confirm-button').click();
        const deleteRes = await deleteResPromise;

        expect(deleteRes.status()).toBe(200);
        await expect(deleteAllPage).toHaveURL(/\/context-center\/articles$/);
      });
    });

    test('user with all permissions can see create and delete actions', async ({
      allPermissionPage,
    }) => {
      await test.step('articles list create action is visible', async () => {
        await navigateToArticles(allPermissionPage);

        await expect(
          allPermissionPage.getByTestId('create-knowledge-page-btn')
        ).toBeVisible();
      });

      await test.step('article detail manage (delete) action is visible', async () => {
        await allPermissionPage.goto(
          `/context-center/articles/${articleEntity.responseData.fullyQualifiedName}`
        );
        await waitForAllLoadersToDisappear(allPermissionPage);

        await expect(
          allPermissionPage.getByTestId('manage-button')
        ).toBeVisible();
      });
    });
  });

  // ─── Documents Permissions ──────────────────────────────────────────────

  test.describe('Documents Permissions', () => {
    const openRowMenu = async (page: Page) => {
      const row = page.getByTestId(`document-row-${documentId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await row.locator('button[aria-label="Open menu"]').click();
    };

    test('user with view-only permission cannot see upload, folder, or row actions', async ({
      viewOnlyPage,
    }) => {
      await navigateToDocuments(viewOnlyPage);

      await expect(
        viewOnlyPage.getByRole('button', { name: /upload file/i })
      ).not.toBeVisible();
      await expect(
        viewOnlyPage.getByTestId('add-folder-btn')
      ).not.toBeVisible();

      const row = viewOnlyPage.getByTestId(`document-row-${documentId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(
        row.locator('button[aria-label="Open menu"]')
      ).not.toBeVisible();

      await test.step('selecting a document shows only download in bulk bar (no move or delete)', async () => {
        await row.getByTestId('document-checkbox').click();

        await expect(
          viewOnlyPage.getByTestId('bulk-download-btn')
        ).toBeVisible();
        await expect(
          viewOnlyPage.getByTestId('bulk-move-btn')
        ).not.toBeVisible();
        await expect(
          viewOnlyPage.getByTestId('bulk-delete-btn')
        ).not.toBeVisible();

        await viewOnlyPage.getByTestId('clear-selection-btn').click();
      });
    });

    test('user with createAll permission can see upload and folder create actions but no row actions, and can create a folder', async ({
      createAllPage,
      browser,
    }) => {
      await navigateToDocuments(createAllPage);

      await expect(
        createAllPage.getByRole('button', { name: /upload file/i })
      ).toBeVisible();
      await expect(createAllPage.getByTestId('add-folder-btn')).toBeVisible();

      const row = createAllPage.getByTestId(`document-row-${documentId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(
        row.locator('button[aria-label="Open menu"]')
      ).not.toBeVisible();

      await test.step('can create a folder', async () => {
        const folderName = `cc-permission-folder-${uuid()}`;
        await createAllPage.getByTestId('add-folder-btn').click();
        await createAllPage
          .getByTestId('folder-name-input')
          .getByRole('textbox', { name: 'Folder Name' })
          .fill(folderName);

        const createResPromise = createAllPage.waitForResponse(
          '/api/v1/contextCenter/drive/folders'
        );
        await createAllPage.getByTestId('create-folder-btn').click();
        const createRes = await createResPromise;

        expect(createRes.status()).toBeLessThan(300);
        const createdFolder = await createRes.json();

        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await apiContext
          .delete(
            `/api/v1/contextCenter/drive/folders/${createdFolder.id}?hardDelete=true`
          )
          .catch(() => undefined);
        await afterAction();
      });

      await test.step('can upload a document from the documents page', async () => {
        await navigateToDocuments(createAllPage);
        await createAllPage
          .getByRole('button', { name: /upload file/i })
          .click();

        const modal = createAllPage.getByRole('dialog', {
          name: /upload documents/i,
        });
        await expect(modal).toBeVisible();

        const fileName = `cc-documents-upload-${uuid()}.txt`;
        const fileInput = createAllPage.getByTestId('file-upload-input');
        await fileInput.waitFor({ state: 'attached' });
        await fileInput.setInputFiles({
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from('Playwright documents page upload test'),
        });

        const uploadResPromise = createAllPage.waitForResponse(
          '/api/v1/contextCenter/drive/files/upload'
        );
        await modal.getByRole('button', { name: /attach/i }).click();
        const uploadRes = await uploadResPromise;

        expect(uploadRes.status()).toBe(201);
        await expect(modal).not.toBeVisible();

        const uploadedData = await uploadRes.json();
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await apiContext
          .delete(
            `/api/v1/contextCenter/drive/files/${uploadedData.id}?hardDelete=true`
          )
          .catch(() => undefined);
        await afterAction();
      });
    });

    test('user with editAll permission sees row move action but no upload, folder create, or delete actions, and can move a document', async ({
      editAllPage,
      browser,
    }) => {
      await navigateToDocuments(editAllPage);

      await expect(
        editAllPage.getByRole('button', { name: /upload file/i })
      ).not.toBeVisible();
      await expect(editAllPage.getByTestId('add-folder-btn')).not.toBeVisible();

      await openRowMenu(editAllPage);
      await expect(editAllPage.getByTestId('move-btn')).toBeVisible();
      await expect(editAllPage.getByTestId('delete-btn')).not.toBeVisible();

      await test.step('selecting a document shows download and move in bulk bar but not delete', async () => {
        await editAllPage.keyboard.press('Escape');
        const row = editAllPage.getByTestId(`document-row-${documentId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('document-checkbox').click();

        await expect(
          editAllPage.getByTestId('bulk-download-btn')
        ).toBeVisible();
        await expect(editAllPage.getByTestId('bulk-move-btn')).toBeVisible();
        await expect(
          editAllPage.getByTestId('bulk-delete-btn')
        ).not.toBeVisible();

        await editAllPage.getByTestId('clear-selection-btn').click();
      });

      await test.step('can move a document into a folder', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const { id: disposableDocId } = await uploadDisposableDocument(
          apiContext,
          'cc-move-doc'
        );
        const folderRes = await apiContext.post(
          '/api/v1/contextCenter/drive/folders',
          { data: { name: `cc-move-dest-folder-${uuid()}` } }
        );
        const destinationFolder = await folderRes.json();
        await afterAction();

        await navigateToDocuments(editAllPage);
        const docRow = editAllPage.getByTestId(
          `document-row-${disposableDocId}`
        );
        await docRow.scrollIntoViewIfNeeded();
        await expect(docRow).toBeVisible();
        await docRow.locator('button[aria-label="Open menu"]').click();
        await editAllPage.getByTestId('move-btn').click();

        const moveResPromise = editAllPage.waitForResponse(
          new RegExp(
            `/api/v1/contextCenter/drive/files/${disposableDocId}/move`
          )
        );
        await editAllPage
          .getByTestId(`move-to-folder-${destinationFolder.id}`)
          .click();
        const moveRes = await moveResPromise;

        expect(moveRes.status()).toBe(200);

        const { apiContext: cleanupContext, afterAction: cleanupAfter } =
          await getDefaultAdminAPIContext(browser);
        await cleanupContext
          .delete(
            `/api/v1/contextCenter/drive/files/${disposableDocId}?hardDelete=true`
          )
          .catch(() => undefined);
        await cleanupContext
          .delete(
            `/api/v1/contextCenter/drive/folders/${destinationFolder.id}?hardDelete=true`
          )
          .catch(() => undefined);
        await cleanupAfter();
      });
    });

    test('user with deleteAll permission sees row delete action but no upload, folder create, or move actions, and can delete a document', async ({
      deleteAllPage,
      browser,
    }) => {
      await navigateToDocuments(deleteAllPage);

      await expect(
        deleteAllPage.getByRole('button', { name: /upload file/i })
      ).not.toBeVisible();
      await expect(
        deleteAllPage.getByTestId('add-folder-btn')
      ).not.toBeVisible();

      await openRowMenu(deleteAllPage);
      await expect(deleteAllPage.getByTestId('move-btn')).not.toBeVisible();
      await expect(deleteAllPage.getByTestId('delete-btn')).toBeVisible();

      await test.step('selecting a document shows download and delete in bulk bar but not move', async () => {
        await deleteAllPage.keyboard.press('Escape');
        const row = deleteAllPage.getByTestId(`document-row-${documentId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('document-checkbox').click();

        await expect(
          deleteAllPage.getByTestId('bulk-download-btn')
        ).toBeVisible();
        await expect(
          deleteAllPage.getByTestId('bulk-move-btn')
        ).not.toBeVisible();
        await expect(
          deleteAllPage.getByTestId('bulk-delete-btn')
        ).toBeVisible();

        await deleteAllPage.getByTestId('clear-selection-btn').click();
      });

      await test.step('can delete a document', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const { id: disposableDocId } = await uploadDisposableDocument(
          apiContext,
          'cc-delete-doc'
        );
        await afterAction();

        await navigateToDocuments(deleteAllPage);
        const docRow = deleteAllPage.getByTestId(
          `document-row-${disposableDocId}`
        );
        await docRow.scrollIntoViewIfNeeded();
        await expect(docRow).toBeVisible();
        await docRow.locator('button[aria-label="Open menu"]').click();
        await deleteAllPage.getByTestId('delete-btn').click();

        const deleteResPromise = deleteAllPage.waitForResponse(
          new RegExp(
            String.raw`/api/v1/contextCenter/drive/files/${disposableDocId}\?hardDelete=false`
          )
        );
        await deleteAllPage.getByTestId('confirm-button').click();
        const deleteRes = await deleteResPromise;

        expect(deleteRes.status()).toBe(200);
        await expect(docRow).not.toBeVisible();
      });
    });

    test('user with all permissions can see upload, folder create, and all row actions', async ({
      allPermissionPage,
    }) => {
      await navigateToDocuments(allPermissionPage);

      await expect(
        allPermissionPage.getByRole('button', { name: /upload file/i })
      ).toBeVisible();
      await expect(
        allPermissionPage.getByTestId('add-folder-btn')
      ).toBeVisible();

      await openRowMenu(allPermissionPage);
      await expect(allPermissionPage.getByTestId('move-btn')).toBeVisible();
      await expect(allPermissionPage.getByTestId('delete-btn')).toBeVisible();
    });
  });

  // ─── Archive Permissions (documents only — article archive is being removed) ──

  test.describe('Archive Permissions', () => {
    const goToArchive = async (page: Page) => {
      await page.goto('/context-center/archive');
      await page
        .getByTestId('context-center-archive-page')
        .waitFor({ state: 'visible' });
      await waitForAllLoadersToDisappear(page);
    };

    test('user with view-only permission cannot see restore or delete actions on an archived document', async ({
      viewOnlyPage,
    }) => {
      await goToArchive(viewOnlyPage);

      const row = viewOnlyPage.getByTestId(`archive-row-${archivedDocumentId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('restore-btn')).not.toBeVisible();
      await expect(row.getByTestId('delete-btn')).not.toBeVisible();
    });

    test('user with createAll permission cannot see restore or delete actions on an archived document', async ({
      createAllPage,
    }) => {
      await goToArchive(createAllPage);

      const row = createAllPage.getByTestId(
        `archive-row-${archivedDocumentId}`
      );
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('restore-btn')).not.toBeVisible();
      await expect(row.getByTestId('delete-btn')).not.toBeVisible();
    });

    test('user with editAll permission can see restore action but not delete action on an archived document, and can restore it', async ({
      editAllPage,
      browser,
    }) => {
      await goToArchive(editAllPage);

      const row = editAllPage.getByTestId(`archive-row-${archivedDocumentId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('restore-btn')).toBeVisible();
      await expect(row.getByTestId('delete-btn')).not.toBeVisible();

      await test.step('can restore a disposable archived document', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const { id: disposableArchivedDocId } =
          await createDisposableArchivedDocument(apiContext, 'cc-restore-doc');
        await afterAction();

        await goToArchive(editAllPage);
        const disposableRow = editAllPage.getByTestId(
          `archive-row-${disposableArchivedDocId}`
        );
        await disposableRow.scrollIntoViewIfNeeded();
        await expect(disposableRow).toBeVisible();

        const restoreResPromise = editAllPage.waitForResponse(
          '/api/v1/contextCenter/drive/files/restore'
        );
        await disposableRow.getByTestId('restore-btn').click();
        const restoreRes = await restoreResPromise;

        expect(restoreRes.status()).toBe(200);
        await expect(disposableRow).not.toBeVisible();

        const { apiContext: cleanupContext, afterAction: cleanupAfter } =
          await getDefaultAdminAPIContext(browser);
        await cleanupContext
          .delete(
            `/api/v1/contextCenter/drive/files/${disposableArchivedDocId}?hardDelete=true`
          )
          .catch(() => undefined);
        await cleanupAfter();
      });
    });

    test('user with deleteAll permission can see delete action but not restore action on an archived document, and can delete it', async ({
      deleteAllPage,
      browser,
    }) => {
      await goToArchive(deleteAllPage);

      const row = deleteAllPage.getByTestId(
        `archive-row-${archivedDocumentId}`
      );
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('restore-btn')).not.toBeVisible();
      await expect(row.getByTestId('delete-btn')).toBeVisible();

      await test.step('can delete a disposable archived document', async () => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        const { id: disposableArchivedDocId } =
          await createDisposableArchivedDocument(
            apiContext,
            'cc-archive-delete-doc'
          );
        await afterAction();

        await goToArchive(deleteAllPage);
        const disposableRow = deleteAllPage.getByTestId(
          `archive-row-${disposableArchivedDocId}`
        );
        await disposableRow.scrollIntoViewIfNeeded();
        await expect(disposableRow).toBeVisible();

        await disposableRow.getByTestId('delete-btn').click();

        const deleteResPromise = deleteAllPage.waitForResponse(
          new RegExp(
            String.raw`/api/v1/contextCenter/drive/files/${disposableArchivedDocId}\?hardDelete=true`
          )
        );
        await deleteAllPage.getByTestId('confirm-button').click();
        const deleteRes = await deleteResPromise;

        expect(deleteRes.status()).toBe(202);
        await expect(disposableRow).not.toBeVisible();
      });
    });

    test('user with all permissions can see restore and delete actions on an archived document', async ({
      allPermissionPage,
    }) => {
      await goToArchive(allPermissionPage);

      const row = allPermissionPage.getByTestId(
        `archive-row-${archivedDocumentId}`
      );
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('restore-btn')).toBeVisible();
      await expect(row.getByTestId('delete-btn')).toBeVisible();
    });
  });

  // ─── Memories Permissions (includes isOwner matrix) ─────────────────────

  test.describe('Memories Permissions', () => {
    test('user with view-only permission sees no Add Memory button, no row actions, and no modal action buttons', async ({
      viewOnlyPage,
    }) => {
      await navigateToMemories(viewOnlyPage);

      await expect(
        viewOnlyPage.getByTestId('add-memory-btn')
      ).not.toBeVisible();

      const row = viewOnlyPage.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('edit-memory-btn')).not.toBeVisible();

      await row.click();
      const dialog = viewOnlyPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^edit$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();
    });

    test('user with view-only permission who owns a memory still cannot edit or delete it', async ({
      viewOnlyPage,
    }) => {
      await navigateToMemories(viewOnlyPage);

      const ownRow = viewOnlyPage.getByTestId(
        `memory-row-${viewOnlyOwnMemoryId}`
      );
      await ownRow.scrollIntoViewIfNeeded();
      await expect(ownRow).toBeVisible();
      await expect(ownRow.getByTestId('edit-memory-btn')).not.toBeVisible();

      await ownRow.click();
      const dialog = viewOnlyPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^edit$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();
    });

    test('user with createAll permission sees Add Memory button but no row edit/delete actions or modal action buttons, and can create a memory', async ({
      createAllPage,
      browser,
    }) => {
      await navigateToMemories(createAllPage);

      await expect(createAllPage.getByTestId('add-memory-btn')).toBeVisible();

      const row = createAllPage.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('edit-memory-btn')).not.toBeVisible();

      await row.click();
      const dialog = createAllPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^edit$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();
      await dialog.getByRole('button', { name: /^cancel$/i }).click();

      await test.step('can create a memory', async () => {
        await createAllPage.getByTestId('add-memory-btn').click();
        const createDialog = createAllPage.getByRole('dialog');
        await expect(createDialog).toBeVisible();

        const memoryTitle = `CC Permission Create Memory ${uuid()}`;
        await createDialog
          .getByTestId('memory-title-input')
          .locator('input')
          .fill(memoryTitle);
        await createDialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Created via Playwright createAll permission test.');

        const createResPromise = createAllPage.waitForResponse(MEMORIES_API);
        await createDialog
          .getByRole('button', { name: /create memory/i })
          .click();
        const createRes = await createResPromise;

        expect(createRes.status()).toBe(201);
        await expect(createDialog).not.toBeVisible();

        const createdMemory = await createRes.json();
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await apiContext
          .delete(`${MEMORIES_API}/${createdMemory.id}?hardDelete=true`)
          .catch(() => undefined);
        await afterAction();
      });
    });

    test('user with editAll permission sees no row edit action on memories they do not own, but can edit and save their own memory', async ({
      editAllPage,
    }) => {
      await navigateToMemories(editAllPage);

      await expect(editAllPage.getByTestId('add-memory-btn')).not.toBeVisible();

      const foreignRow = editAllPage.getByTestId(`memory-row-${ownerMemoryId}`);
      await foreignRow.scrollIntoViewIfNeeded();
      await expect(foreignRow).toBeVisible();
      await expect(foreignRow.getByTestId('edit-memory-btn')).not.toBeVisible();

      const ownRow = editAllPage.getByTestId(
        `memory-row-${editAllOwnMemoryId}`
      );
      await ownRow.scrollIntoViewIfNeeded();
      await expect(ownRow).toBeVisible();
      await expect(ownRow.getByTestId('edit-memory-btn')).toBeVisible();

      await ownRow.getByTestId('edit-memory-btn').click();
      const dialog = editAllPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^(save|create)/i })
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();

      await test.step('can edit and save own memory', async () => {
        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Updated via Playwright editAll permission test.');

        const saveResPromise = editAllPage.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editAllOwnMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^(save|create)/i }).click();
        const saveRes = await saveResPromise;

        expect(saveRes.status()).toBe(200);
        await expect(dialog).not.toBeVisible();
      });
    });

    test('user with deleteAll permission sees no row delete action on memories they do not own, but can delete their own memory from the modal', async ({
      deleteAllPage,
    }) => {
      await navigateToMemories(deleteAllPage);

      const foreignRow = deleteAllPage.getByTestId(
        `memory-row-${ownerMemoryId}`
      );
      await foreignRow.scrollIntoViewIfNeeded();
      await expect(foreignRow).toBeVisible();
      await expect(foreignRow.getByTestId('edit-memory-btn')).not.toBeVisible();

      const ownRow = deleteAllPage.getByTestId(
        `memory-row-${deleteAllOwnMemoryId}`
      );
      await ownRow.scrollIntoViewIfNeeded();
      await expect(ownRow).toBeVisible();
      await expect(ownRow.getByTestId('edit-memory-btn')).not.toBeVisible();

      await ownRow.click();
      const dialog = deleteAllPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^edit$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();

      await test.step('can delete own memory from the modal', async () => {
        const deleteResPromise = deleteAllPage.waitForResponse(
          new RegExp(`${MEMORIES_API}/${deleteAllOwnMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^delete$/i }).click();
        const deleteRes = await deleteResPromise;

        expect(deleteRes.status()).toBe(200);
        await expect(dialog).not.toBeVisible();
        await expect(ownRow).not.toBeVisible();
      });
    });

    test('user with all permissions but not owner sees read-only banner and no edit/delete on the row', async ({
      allPermissionPage,
    }) => {
      await navigateToMemories(allPermissionPage);

      const row = allPermissionPage.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await expect(row.getByTestId('edit-memory-btn')).not.toBeVisible();

      await row.click();
      const dialog = allPermissionPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/can.?t edit this memory/i)).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^edit$/i })
      ).not.toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();
    });

    test('admin user can edit and save a memory owned by another user', async ({
      browser,
    }) => {
      const { page: adminPage, afterAction } = await performAdminLogin(browser);

      await navigateToMemories(adminPage);

      const row = adminPage.getByTestId(`memory-row-${editAllOwnMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();

      await test.step('edit button is visible on another user memory row when clicked in view modal', async () => {
        await row.click();
        const dialog = adminPage.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByRole('button', { name: /^edit$/i })
        ).toBeVisible();
        await dialog.getByRole('button', { name: /^cancel$/i }).click();
        await expect(dialog).not.toBeVisible();
      });

      await test.step('edit button is visible on row and admin can edit and save the memory', async () => {
        await expect(row.getByTestId('edit-memory-btn')).toBeVisible();
        await row.getByTestId('edit-memory-btn').click();

        const editDialog = adminPage.getByRole('dialog');
        await expect(editDialog).toBeVisible();

        await editDialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Updated by admin via Playwright permission test.');

        const saveResPromise = adminPage.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editAllOwnMemoryId}`)
        );
        await editDialog
          .getByRole('button', { name: /^(save|create)/i })
          .click();
        const saveRes = await saveResPromise;

        expect(saveRes.status()).toBe(200);
        await expect(editDialog).not.toBeVisible();
      });

      await afterAction();
    });

    test('user with all permissions and owner can see Add Memory button and all row/modal actions', async ({
      allPermissionPage,
    }) => {
      await navigateToMemories(allPermissionPage);

      await expect(
        allPermissionPage.getByTestId('add-memory-btn')
      ).toBeVisible();

      const ownRow = allPermissionPage.getByTestId(
        `memory-row-${allPermissionOwnMemoryId}`
      );
      await ownRow.scrollIntoViewIfNeeded();
      await expect(ownRow).toBeVisible();
      await expect(ownRow.getByTestId('edit-memory-btn')).toBeVisible();

      await ownRow.getByTestId('edit-memory-btn').click();
      const dialog = allPermissionPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^(save|create)/i })
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^delete$/i })
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /^cancel$/i })
      ).toBeVisible();
    });
  });
});
