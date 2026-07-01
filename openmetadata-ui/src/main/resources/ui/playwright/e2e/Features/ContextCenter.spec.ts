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

import { APIRequestContext, expect } from '@playwright/test';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  BulkOperationResult,
  ContextCenterDocument,
  ContextCenterFolder,
  expectBulkIdsRequest,
  expectSelectedCount,
  getDocumentRowByName,
  MEMORIES_API,
  navigateToDocuments,
  navigateToMemories,
  selectDocumentByName,
  uploadDocument as uploadDocumentToApi,
} from '../../utils/ContextCenterUtil';
import { test as base } from '../fixtures/pages';

const test = base;

// ─── Constants ────────────────────────────────────────────────────────────────

const contextFileIdsToCleanup = new Set<string>();
const contextFolderIdsToCleanup = new Set<string>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uploadDocument = async (
  apiContext: APIRequestContext,
  name: string,
  buffer: Buffer,
  folderFqn?: string
): Promise<ContextCenterDocument> => {
  const document = await uploadDocumentToApi(
    apiContext,
    name,
    buffer,
    folderFqn
  );
  contextFileIdsToCleanup.add(document.id);

  return document;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Memories fixtures ──────────────────────────────────────────────────────

let ownerMemoryId = '';
let ownerMemoryName = '';
const OWNER_MEMORY_TITLE = `CC Memory ${uuid()}`;

test.describe('Context Center', () => {
  test.slow(true);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await uploadDocument(
      apiContext,
      `seed-document-${uuid()}.txt`,
      Buffer.from('Playwright seed document')
    );

    // Create a memory owned by admin for card/edit/delete action tests
    ownerMemoryName = `cc_memory_${uuid()}`;
    const memoryRes = await apiContext.post(MEMORIES_API, {
      data: {
        name: ownerMemoryName,
        title: OWNER_MEMORY_TITLE,
        question: 'What is the Playwright memory fixture for?',
        answer: 'It seeds a memory owned by admin for action button tests.',
        shareConfig: { visibility: 'Shared' },
      },
    });
    const memoryData = await memoryRes.json();
    ownerMemoryId = memoryData.id;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await Promise.all(
      Array.from(contextFileIdsToCleanup).map((id) =>
        apiContext.delete(
          `/api/v1/contextCenter/drive/files/${id}?hardDelete=true`
        )
      )
    );
    await Promise.all(
      Array.from(contextFolderIdsToCleanup).map((id) =>
        apiContext.delete(
          `/api/v1/contextCenter/drive/folders/${id}?recursive=true&hardDelete=true`
        )
      )
    );
    if (ownerMemoryId) {
      await apiContext.delete(
        `${MEMORIES_API}/${ownerMemoryId}?hardDelete=true`
      );
    }
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

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
      const fileName = `context-center-upload-${uuid()}.txt`;
      const uploadFile = {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('context center upload test file'),
      };

      await navigateToDocuments(page);

      await page.getByRole('button', { name: /upload file/i }).click();
      const modal = page.getByRole('dialog', { name: /upload documents/i });
      await expect(modal).toBeVisible();

      // Set file on the input via testId; wait for attached (not visible)
      const fileInput = page.getByTestId('file-upload-input');

      await fileInput.waitFor({ state: 'attached' });

      await fileInput.setInputFiles(uploadFile);

      await expect(modal.getByText(fileName).first()).toBeVisible();

      // Attach the file
      const uploadResPromise = page.waitForResponse(
        '/api/v1/contextCenter/drive/files/upload'
      );
      await modal.getByRole('button', { name: /attach/i }).click();
      const uploadRes = await uploadResPromise;
      expect(uploadRes.status()).toBe(201);
      const uploadedDocument =
        (await uploadRes.json()) as ContextCenterDocument;
      contextFileIdsToCleanup.add(uploadedDocument.id);

      // Modal closes automatically after successful upload
      await expect(modal).not.toBeVisible();

      // File appears in document list
      const docRow = page.getByText(fileName);
      await expect(docRow.first()).toBeVisible();
    });

    test('uploaded file shows name, size and download button in list', async ({
      browser,
      page,
    }) => {
      const fileName = `metadata-doc-${uuid()}.txt`;
      const { apiContext, afterAction } = await createNewPage(browser);
      await uploadDocument(
        apiContext,
        fileName,
        Buffer.from('document metadata test')
      );
      await afterAction();

      await navigateToDocuments(page);

      const targetRow = getDocumentRowByName(page, fileName);
      await expect(targetRow).toBeVisible();

      // Name is present
      await expect(targetRow.getByTestId('document-name')).toHaveText(fileName);

      // Download button is present
      await expect(targetRow.getByTestId('download-btn')).toBeVisible();
    });

    test('delete document removes it from the list', async ({
      browser,
      page,
    }) => {
      const fileName = `delete-doc-${uuid()}.txt`;

      // Upload a dedicated document so this test is independent of the download test
      const { apiContext, afterAction } = await createNewPage(browser);
      await uploadDocument(
        apiContext,
        fileName,
        Buffer.from('document for delete test')
      );
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

    test('bulk delete removes selected documents with a single API call', async ({
      browser,
      page,
    }) => {
      const firstFileName = `bulk-delete-one-${uuid()}.txt`;
      const secondFileName = `bulk-delete-two-${uuid()}.txt`;
      const { apiContext, afterAction } = await createNewPage(browser);
      const firstDocument = await uploadDocument(
        apiContext,
        firstFileName,
        Buffer.from('first document for bulk delete')
      );
      const secondDocument = await uploadDocument(
        apiContext,
        secondFileName,
        Buffer.from('second document for bulk delete')
      );
      await afterAction();

      await navigateToDocuments(page);

      await selectDocumentByName(page, firstFileName);
      await selectDocumentByName(page, secondFileName);
      await expectSelectedCount(page, 2);

      await page.getByTestId('bulk-delete-btn').click();
      await expect(page.getByTestId('modal-header')).toContainText(
        'Delete 2 documents'
      );

      const bulkDeleteResPromise = page.waitForResponse(
        '/api/v1/contextCenter/drive/files/bulk/delete'
      );
      await page.getByTestId('confirm-button').click();
      const bulkDeleteRes = await bulkDeleteResPromise;
      const bulkDeleteBody =
        (await bulkDeleteRes.json()) as BulkOperationResult;

      expect(bulkDeleteRes.status()).toBe(200);
      expect(bulkDeleteBody.numberOfRowsPassed).toBe(2);
      expect(bulkDeleteBody.numberOfRowsFailed ?? 0).toBe(0);
      expectBulkIdsRequest(bulkDeleteRes.request().postData(), [
        firstDocument.id,
        secondDocument.id,
      ]);
      await expect(getDocumentRowByName(page, firstFileName)).not.toBeVisible();
      await expect(
        getDocumentRowByName(page, secondFileName)
      ).not.toBeVisible();
    });

    test('bulk move moves selected documents to a folder with a single API call', async ({
      browser,
      page,
    }) => {
      const folderName = `bulk-move-folder-${uuid()}`;
      const firstFileName = `bulk-move-one-${uuid()}.txt`;
      const secondFileName = `bulk-move-two-${uuid()}.txt`;
      const { apiContext, afterAction } = await createNewPage(browser);
      const firstDocument = await uploadDocument(
        apiContext,
        firstFileName,
        Buffer.from('first document for bulk move')
      );
      const secondDocument = await uploadDocument(
        apiContext,
        secondFileName,
        Buffer.from('second document for bulk move')
      );
      await afterAction();

      await navigateToDocuments(page);

      await page.getByTestId('add-folder-btn').click();
      await page
        .getByTestId('folder-name-input')
        .getByRole('textbox')
        .fill(folderName);
      const folderCreateResPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/contextCenter/drive/folders') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('create-folder-btn').click();
      const folderCreateRes = await folderCreateResPromise;
      const targetFolder =
        (await folderCreateRes.json()) as ContextCenterFolder;
      contextFolderIdsToCleanup.add(targetFolder.id);
      expect(folderCreateRes.status()).toBe(201);

      await expect(page.getByText(folderName, { exact: true })).toBeVisible();
      await selectDocumentByName(page, firstFileName);
      await selectDocumentByName(page, secondFileName);
      await expectSelectedCount(page, 2);

      await page.getByTestId('bulk-move-btn').click();

      const bulkMoveResPromise = page.waitForResponse(
        '/api/v1/contextCenter/drive/files/bulk/move'
      );
      await page.getByTestId(`move-to-folder-${targetFolder.id}`).click();
      const bulkMoveRes = await bulkMoveResPromise;
      const bulkMoveBody = (await bulkMoveRes.json()) as BulkOperationResult;

      expect(bulkMoveRes.status()).toBe(200);
      expect(bulkMoveBody.numberOfRowsPassed).toBe(2);
      expect(bulkMoveBody.numberOfRowsFailed ?? 0).toBe(0);
      expectBulkIdsRequest(bulkMoveRes.request().postData(), [
        firstDocument.id,
        secondDocument.id,
      ]);

      await navigateToDocuments(page);
      await expect(
        getDocumentRowByName(page, firstFileName).getByTestId(
          'document-folder-name'
        )
      ).toHaveText(folderName);
      await expect(
        getDocumentRowByName(page, secondFileName).getByTestId(
          'document-folder-name'
        )
      ).toHaveText(folderName);
    });

    test('duplicate filename upload fails case-insensitively in the same folder', async ({
      browser,
      page,
    }) => {
      const duplicateName = `Duplicate-Document-${uuid()}.TXT`;
      const lowerCaseDuplicateName = duplicateName.toLowerCase();
      const { apiContext, afterAction } = await createNewPage(browser);
      await uploadDocument(
        apiContext,
        duplicateName,
        Buffer.from('original duplicate document')
      );
      await afterAction();

      await navigateToDocuments(page);
      await page.getByRole('button', { name: /upload file/i }).click();

      const modal = page.getByRole('dialog', { name: /upload documents/i });
      await expect(modal).toBeVisible();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.waitFor({ state: 'attached' });
      await fileInput.setInputFiles({
        name: lowerCaseDuplicateName,
        mimeType: 'text/plain',
        buffer: Buffer.from('duplicate document'),
      });

      await expect(modal.getByText(lowerCaseDuplicateName)).toBeVisible();

      const duplicateUploadResPromise = page.waitForResponse(
        '/api/v1/contextCenter/drive/files/upload'
      );
      await modal.getByRole('button', { name: /attach/i }).click();
      const duplicateUploadRes = await duplicateUploadResPromise;
      const duplicateUploadBody = await duplicateUploadRes.text();

      expect(duplicateUploadRes.status(), duplicateUploadBody).toBe(400);
      expect(duplicateUploadBody).toContain(lowerCaseDuplicateName);
      await expect(modal.getByText(/failed/i).first()).toBeVisible();
      await expect(
        modal.getByRole('button', { name: /attach/i })
      ).toBeDisabled();
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
      const oversizedInput = page.getByTestId('file-upload-input');
      await oversizedInput.waitFor({ state: 'attached' });
      await oversizedInput.setInputFiles({
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

  // ─── Memories Page ────────────────────────────────────────────────────────

  test.describe('Memories Page', () => {
    test('shows header with title, breadcrumb and Add Memory button', async ({
      page,
    }) => {
      await navigateToMemories(page);

      const header = page.getByTestId('context-center-header');
      await expect(header).toBeVisible();
      await expect(header.getByTestId('breadcrumb')).toBeVisible();
      await expect(header.getByRole('heading')).toContainText('Memor');
      await expect(page.getByTestId('add-memory-btn')).toBeVisible();
    });

    // ─── Card actions ─────────────────────────────────────────────────────

    test('clicking a memory row opens the view-only modal', async ({
      page,
    }) => {
      await navigateToMemories(page);

      const row = page.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await row.click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByText(OWNER_MEMORY_TITLE)
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`memory=${ownerMemoryName}`));
    });

    test('edit-memory button on the row opens the modal in edit mode', async ({
      page,
    }) => {
      await navigateToMemories(page);

      const row = page.getByTestId(`memory-row-${ownerMemoryId}`);
      await row.scrollIntoViewIfNeeded();
      await row.getByTestId('edit-memory-btn').click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('memory-content-input')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Edit' })
      ).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Save Changes' })
      ).toBeVisible();
    });

    test('delete button on the row deletes the memory after confirmation', async ({
      browser,
      page,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      const disposableName = `cc_memory_delete_${uuid()}`;
      const createRes = await apiContext.post(MEMORIES_API, {
        data: {
          name: disposableName,
          title: `CC Memory Delete ${uuid()}`,
          question: 'Disposable memory for row delete test',
          answer: 'Disposable memory for row delete test',
          shareConfig: { visibility: 'Shared' },
        },
      });
      const disposable = await createRes.json();
      await afterAction();

      await navigateToMemories(page);

      const row = page.getByTestId(`memory-row-${disposable.id}`);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();

      await row.getByLabel('Open menu').last().click();
      await page.getByTestId('delete-btn').click();

      const deleteResPromise = page.waitForResponse(
        new RegExp(`${MEMORIES_API}/${disposable.id}`)
      );
      await page.getByTestId('confirm-button').click();
      const deleteRes = await deleteResPromise;
      expect(deleteRes.status()).toBe(200);

      await expect(row).not.toBeVisible();
    });

    // ─── Create memory action ─────────────────────────────────────────────

    test('Add Memory button opens the create modal', async ({ page }) => {
      await navigateToMemories(page);

      await page.getByTestId('add-memory-btn').click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('memory-title-input')).toBeVisible();
      await expect(dialog.getByTestId('memory-content-input')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Delete' })
      ).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Edit' })
      ).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Create Memory' })
      ).toBeVisible();
    });

    // ─── Edit modal actions ───────────────────────────────────────────────

    test.describe('Edit modal actions', () => {
      let editableMemoryId: string;
      let editableMemoryName: string;

      test.beforeEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        editableMemoryName = `cc_memory_edit_${uuid()}`;
        const res = await apiContext.post(MEMORIES_API, {
          data: {
            name: editableMemoryName,
            title: `CC Memory Edit ${uuid()}`,
            question: 'Editable memory seed question',
            answer: 'Editable memory seed answer',
            shareConfig: { visibility: 'Shared' },
          },
        });
        const data = await res.json();
        editableMemoryId = data.id;
        await afterAction();
      });

      test.afterEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await apiContext.delete(
          `${MEMORIES_API}/${editableMemoryId}?hardDelete=true`
        );
        await afterAction();
      });

      test('view modal switches to edit mode and saves changes', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editableMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /^edit$/i }).click();

        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Updated answer via Playwright edit flow.');

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editableMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^(save|create)/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
      });

      test('cancel button closes the modal without saving', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editableMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog
          .getByTestId('memory-title-input')
          .locator('input')
          .fill('This change should be discarded');

        await dialog.getByRole('button', { name: /cancel/i }).click();
        await expect(dialog).not.toBeVisible();

        await navigateToMemories(page);
        const reopenedRow = page.getByTestId(`memory-row-${editableMemoryId}`);
        await reopenedRow.scrollIntoViewIfNeeded();
        await reopenedRow.click();
        await expect(
          dialog.getByTestId('memory-title-input').locator('input')
        ).not.toHaveValue('This change should be discarded');
      });

      test('delete button inside the modal deletes the memory', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editableMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const deleteResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editableMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^delete$/i }).click();
        const deleteRes = await deleteResPromise;
        expect(deleteRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
        await expect(
          page.getByTestId(`memory-row-${editableMemoryId}`)
        ).not.toBeVisible();
      });
    });
  });
});
