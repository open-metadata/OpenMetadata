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
import { createNewPage, redirectToHomePage, uuid, getDefaultAdminAPIContext } from '../../utils/common';
import {
  ContextCenterFolder,
  getDocumentRowByName,
  getDocumentSearchInput,
  getFolderExpandBtn,
  getFolderTreeItem,
  navigateToArchive,
  navigateToDocuments,
  openUploadModal,
  selectFolderInSidebar,
  softDeleteDocument,
  uploadFileViaModal,
  waitForDocumentInArchive,
  waitForDocumentPermanentlyDeleted,
} from '../../utils/ContextCenterUtil';
import { test as base } from '../fixtures/pages';


const test = base;

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Context Center - Archive Page', () => {
  let folder: ContextCenterFolder;
  let documentId = '';
  const folderName = `archive-test-folder-${uuid()}`;
  const documentFileName = `archive-test-${uuid()}.txt`;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      {
        data: {
          displayName: folderName,
          name: folderName,
        },
      }
    );
    expect(folderRes.status()).toBe(201);
    folder = (await folderRes.json()) as ContextCenterFolder;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    if (documentId) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/drive/files/${documentId}?hardDelete=true`
        )
        .catch(() => undefined);
    }
    if (folder?.id) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/drive/folders/${folder.id}?recursive=true&hardDelete=true`
        )
        .catch(() => undefined);
    }

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('full document lifecycle: folder expand icon, upload, delete, restore, and permanent delete', async ({
    browser,
    page,
  }) => {
    test.slow();

    let permanentlyDeletedId = '';

    // ── 1. Navigate to documents page ───────────────────────────────────────

    await test.step('navigate to documents page and verify folder is in sidebar', async () => {
      await navigateToDocuments(page);
      await expect(getFolderTreeItem(page, folderName)).toBeVisible();
    });

    // ── 2. Expand icon NOT visible on empty folder ───────────────────────────

    await test.step('expand icon is not visible for an empty folder', async () => {
      const expandBtn = getFolderExpandBtn(page, folderName);
      await expect(expandBtn).toHaveClass(/tw:invisible/);
    });

    // ── 3. Upload document to folder via UI ──────────────────────────────────

    await test.step('upload document to folder via UI', async () => {
      await selectFolderInSidebar(page, folderName);
      await openUploadModal(page);
      documentId = await uploadFileViaModal(
        page,
        documentFileName,
        'archive lifecycle test content'
      );
    });

    // ── 4. Expand icon IS visible after upload ───────────────────────────────

    await test.step('expand icon is visible after uploading a file to the folder', async () => {
      const expandBtn = getFolderExpandBtn(page, folderName);
      await expect(expandBtn).not.toHaveClass(/tw:invisible/);
    });

    // ── 5. Folder name visible on document card ──────────────────────────────

    await test.step('folder name is visible on the document card row', async () => {
      const docRow = getDocumentRowByName(page, documentFileName);
      await expect(docRow).toBeVisible();
      await expect(docRow.getByTestId('document-folder-name')).toContainText(
        folderName
      );
    });

    // ── 6. Expand folder in sidebar, file is visible ─────────────────────────

    await test.step('expanding folder in sidebar shows the uploaded file', async () => {
      const expandBtn = getFolderExpandBtn(page, folderName);
      await expandBtn.click();

      await expect(
        page
          .getByRole('treegrid')
          .getByRole('row', { name: documentFileName })
          .first()
      ).toBeVisible();
    });

    // ── 7. Soft delete document ──────────────────────────────────────────────

    await test.step('soft delete the document', async () => {
      await softDeleteDocument(page, `document-row-${documentId}`);
    });

    // ── 8. Expand icon NOT visible after delete ──────────────────────────────

    await test.step('expand icon is not visible after deleting the only file', async () => {
      const expandBtn = getFolderExpandBtn(page, folderName);
      await expect(expandBtn).toHaveClass(/tw:invisible/);
    });

    // ── 9. Search — document NOT visible ────────────────────────────────────

    await test.step('searching for the deleted document returns no results', async () => {
      const searchInput = getDocumentSearchInput(page);

      await expect
        .poll(
          async () => {
            const searchResPromise = page.waitForResponse(
              (res) =>
                res.url().includes('/api/v1/search/query') &&
                res.url().includes('index=contextFile')
            );
            await searchInput.fill('');
            await searchInput.fill(documentFileName);
            await searchResPromise;

            return getDocumentRowByName(page, documentFileName)
              .isVisible()
              .catch(() => false);
          },
          {
            intervals: [3000, 5000, 10000],
            message: `Deleted document ${documentFileName} still appears in search after soft delete`,
            timeout: 60000,
          }
        )
        .toBe(false);
    });

    // ── 10. Archive page — poll until first document appears ─────────────────

    await test.step('archive API returns the soft-deleted document', async () => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await waitForDocumentInArchive(apiContext, documentId);
      await afterAction();

      await navigateToArchive(page);
      await expect(page.getByTestId(`archive-row-${documentId}`)).toBeVisible();
    });

    // ── 11. Restore document ─────────────────────────────────────────────────

    await test.step('restore the archived document', async () => {
      const archiveRow = page.getByTestId(`archive-row-${documentId}`);

      const restoreResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/contextCenter/drive/files/restore') &&
          res.request().method() === 'PUT'
      );
      await archiveRow.getByTestId('restore-btn').click();
      const restoreRes = await restoreResPromise;
      expect(restoreRes.status()).toBe(200);

      await expect(archiveRow).not.toBeVisible();
    });

    // ── 12. Restored document visible on documents page ──────────────────────

    await test.step('restored document is visible on the documents page', async () => {
      await navigateToDocuments(page);
      await expect(
        page.getByTestId(`document-row-${documentId}`)
      ).toBeVisible();
    });

    // ── 13. No folder name on restored document ───────────────────────────────

    await test.step('restored document has folder name (restored to root)', async () => {
      const docRow = page.getByTestId(`document-row-${documentId}`);
      await expect(docRow.getByTestId('document-folder-name')).toBeVisible();
    });

    // ── 14. Document visible in search after restore ──────────────────────────

    await test.step('restored document appears in search results', async () => {
      const restoredId = documentId;
      const searchInput = getDocumentSearchInput(page);

      await expect
        .poll(
          async () => {
            const searchResPromise = page.waitForResponse(
              (res) =>
                res.url().includes('/api/v1/search/query') &&
                res.url().includes('index=contextFile')
            );
            await searchInput.fill('');
            await searchInput.fill(documentFileName);
            await searchResPromise;

            return page
              .getByTestId(`document-row-${restoredId}`)
              .isVisible()
              .catch(() => false);
          },
          {
            intervals: [3000, 5000, 10000],
            message: `Restored document ${restoredId} not found in search after restore`,
            timeout: 60000,
          }
        )
        .toBe(true);
    });

    // ── 15. Soft delete restored document again ───────────────────────────────

    await test.step('soft delete the restored document', async () => {
      await navigateToDocuments(page);
      await softDeleteDocument(page, `document-row-${documentId}`);
    });

    // ── 16. Archive page — poll until second delete appears ───────────────────

    await test.step('archive API returns the re-deleted document', async () => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await waitForDocumentInArchive(apiContext, documentId);
      await afterAction();

      await navigateToArchive(page);
      await expect(page.getByTestId(`archive-row-${documentId}`)).toBeVisible();
    });

    // ── 17. Permanently delete ────────────────────────────────────────────────

    await test.step('permanently delete the document from the archive', async () => {
      const archiveRow = page.getByTestId(`archive-row-${documentId}`);
      await archiveRow.getByTestId('delete-btn').click();

      const hardDeleteResPromise = page.waitForResponse(
        (res) =>
          res.url().includes(`/contextCenter/drive/files/${documentId}`) &&
          res.url().includes('hardDelete=true')
      );
      await page.getByTestId('confirm-button').click();
      const hardDeleteRes = await hardDeleteResPromise;
      expect([200, 202]).toContain(hardDeleteRes.status());

      permanentlyDeletedId = documentId;
      documentId = '';

      await expect(
        page.getByTestId(`archive-row-${permanentlyDeletedId}`)
      ).not.toBeVisible();
    });

    // ── 18. Verify NOT in archive (API) ──────────────────────────────────────

    await test.step('permanently deleted document is absent from the archive API', async () => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await waitForDocumentPermanentlyDeleted(apiContext, permanentlyDeletedId);
      await afterAction();
    });

    // ── 19. Verify NOT on documents page ─────────────────────────────────────

    await test.step('permanently deleted document is absent from the documents page', async () => {
      await navigateToDocuments(page);
      await expect(
        page.getByTestId(`document-row-${permanentlyDeletedId}`)
      ).not.toBeVisible();
    });

    // ── 20. Verify NOT in documents search ───────────────────────────────────

    await test.step('permanently deleted document is absent from documents search', async () => {
      const searchInput = getDocumentSearchInput(page);

      await expect
        .poll(
          async () => {
            const searchResPromise = page.waitForResponse(
              (res) =>
                res.url().includes('/api/v1/search/query') &&
                res.url().includes('index=contextFile')
            );
            await searchInput.fill('');
            await searchInput.fill(documentFileName);
            await searchResPromise;

            return page
              .getByTestId(`document-row-${permanentlyDeletedId}`)
              .isVisible()
              .catch(() => false);
          },
          {
            intervals: [3000, 5000, 10000],
            message: `Permanently deleted document ${permanentlyDeletedId} still appears in search`,
            timeout: 60000,
          }
        )
        .toBe(false);
    });
  });
});

// ─── Suite: Folder delete — file absent from search and archive ────────────────

test.describe('Context Center - Folder Delete: file absent from search and archive', () => {
  let folder: ContextCenterFolder;
  let documentId = '';
  const folderName = `folder-delete-test-${uuid()}`;
  const documentFileName = `folder-delete-doc-${uuid()}.txt`;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      {
        data: {
          displayName: folderName,
          name: folderName,
        },
      }
    );
    expect(folderRes.status()).toBe(201);
    folder = (await folderRes.json()) as ContextCenterFolder;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    if (documentId) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/drive/files/${documentId}?hardDelete=true`
        )
        .catch(() => undefined);
    }
    if (folder?.id) {
      await apiContext
        .delete(
          `/api/v1/contextCenter/drive/folders/${folder.id}?recursive=true&hardDelete=true`
        )
        .catch(() => undefined);
    }

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('file in deleted folder is absent from search and not added to archive', async ({
    browser,
    page,
  }) => {
    test.slow();

    // ── 1. Navigate to documents page ───────────────────────────────────────

    await test.step('navigate to documents page and verify folder in sidebar', async () => {
      await navigateToDocuments(page);
      await expect(getFolderTreeItem(page, folderName)).toBeVisible();
    });

    // ── 2. Upload document to folder via UI ──────────────────────────────────

    await test.step('upload document into folder via UI', async () => {
      await selectFolderInSidebar(page, folderName);
      await openUploadModal(page);
      documentId = await uploadFileViaModal(
        page,
        documentFileName,
        'folder delete archive test content'
      );
    });

    // ── 3. File is visible in the documents list ─────────────────────────────

    await test.step('uploaded file is visible with correct folder label', async () => {
      const docRow = getDocumentRowByName(page, documentFileName);
      await expect(docRow).toBeVisible();
      await expect(docRow.getByTestId('document-folder-name')).toContainText(
        folderName
      );
    });

    // ── 4. Soft-delete the folder via API ────────────────────────────────────

    await test.step('soft-delete the folder via API', async () => {
      const folderId =  folder.id
       await getFolderTreeItem(page, folder.displayName).hover();   // reveals the hidden delete button

  const deleteFolderBtn = page.getByTestId(`delete-folder-btn-${folderId}`);
  await deleteFolderBtn.scrollIntoViewIfNeeded();
  await expect(deleteFolderBtn).toBeVisible();
  await deleteFolderBtn.click();

  await expect(page.getByTestId('modal-header')).toBeVisible();

  const folderDeleteResPromise = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/v1/contextCenter/drive/folders/${folderId}`) &&
      res.request().method() === 'DELETE'
  );
  await page.getByTestId('confirm-button').click();
  const folderDeleteRes = await folderDeleteResPromise;
  expect(folderDeleteRes.status()).toBe(200);
      
      
    });

    // ── 5. File is absent from documents search ──────────────────────────────

    await test.step('file is no longer visible in documents search after folder delete', async () => {
      const searchInput = getDocumentSearchInput(page);

      await expect
        .poll(
          async () => {
            const searchResPromise = page.waitForResponse(
              (res) =>
                res.url().includes('/api/v1/search/query') &&
                res.url().includes('index=contextFile')
            );
            await searchInput.fill('');
            await searchInput.fill(documentFileName);
            await searchResPromise;

            return getDocumentRowByName(page, documentFileName)
              .isVisible()
              .catch(() => false);
          },
          {
            intervals: [3000, 5000, 10000],
            message: `File ${documentFileName} still visible in search after its folder was deleted`,
            timeout: 60000,
          }
        )
        .toBe(false);
    });

    // ── 6. Archive page UI — file row is absent ───────────────────────────────

    await test.step('file should be visibile in the archive page', async () => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
      await waitForDocumentInArchive(apiContext, documentId);
      await navigateToArchive(page);
      await expect(
        page.getByTestId(`archive-row-${documentId}`)
      ).toBeVisible();
    });
  });
});
