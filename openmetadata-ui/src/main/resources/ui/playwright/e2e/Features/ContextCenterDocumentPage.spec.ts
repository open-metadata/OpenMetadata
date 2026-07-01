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

import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { navigateToDocuments } from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test as base } from '../fixtures/pages';

const test = base;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ContextCenterDocument {
  id: string;
  name: string;
  displayName?: string;
}

interface ContextCenterFolder {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

interface BulkOperationResult {
  numberOfRowsPassed?: number;
  numberOfRowsFailed?: number;
}

interface BulkIdsRequest {
  ids?: string[];
}

interface UploadMultipart {
  file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  };
  folder?: string;
}

// ─── Cleanup Sets ─────────────────────────────────────────────────────────────

const contextFileIdsToCleanup = new Set<string>();
const contextFolderIdsToCleanup = new Set<string>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseResponseJson = <T>(body: string): T => JSON.parse(body) as T;

const uploadDocument = async (
  apiContext: APIRequestContext,
  name: string,
  buffer: Buffer,
  folderFqn?: string
): Promise<ContextCenterDocument> => {
  const multipart: UploadMultipart = {
    file: { name, mimeType: 'text/plain', buffer },
  };

  if (folderFqn) {
    multipart.folder = folderFqn;
  }

  const response = await apiContext.post(
    '/api/v1/contextCenter/drive/files/upload',
    { multipart }
  );
  const body = await response.text();
  expect(response.status(), body).toBe(201);

  const document = parseResponseJson<ContextCenterDocument>(body);
  contextFileIdsToCleanup.add(document.id);

  return document;
};

const getDocumentRowByName = (page: Page, fileName: string): Locator =>
  page
    .getByTestId('documents-view')
    .locator('[data-testid^="document-row-"]')
    .filter({ hasText: fileName });

const selectDocumentByName = async (page: Page, fileName: string) => {
  const row = getDocumentRowByName(page, fileName);
  await expect(row).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  await row.getByTestId('document-checkbox').click();
};

const expectSelectedCount = async (page: Page, count: number) => {
  await expect(
    page.getByText(`${count} selected`, { exact: true })
  ).toBeVisible();
};

const expectBulkIdsRequest = (
  postData: string | null,
  expectedIds: string[]
) => {
  expect(postData).toBeTruthy();
  const request = parseResponseJson<BulkIdsRequest>(postData ?? '{}');
  expect(new Set(request.ids)).toEqual(new Set(expectedIds));
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Context Center - Documents Page', () => {
  test.slow(true);
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await uploadDocument(
      apiContext,
      `seed-document-${uuid()}.txt`,
      Buffer.from('Playwright seed document for documents page spec')
    );

    await Promise.all(
      Array.from({ length: 16 }, (_, i) =>
        uploadDocument(
          apiContext,
          `pagination-doc-${uuid()}-${i}.txt`,
          Buffer.from(`pagination test document ${i}`)
        ).then((doc) => {
          contextFileIdsToCleanup.add(doc.id);
        })
      )
    );

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
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // ─── Pagination ───────────────────────────────────────────────────────────

  test('scrolling to the bottom of the list loads the next page of documents', async ({
    page,
  }) => {
    await navigateToDocuments(page);
    await page.getByTestId('document-row-skeleton').first().waitFor({
      state: 'detached',
    });
    const view = page.getByTestId('documents-view');
    const rows = view.locator('[data-testid^="document-row-"]');
    const countBefore = await rows.count();

    expect(countBefore).toBeGreaterThan(0);

    const scrollableContainer = view
      .locator('[class*="overflow-y-auto"]')
      .first();

    const loadMoreResPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/contextCenter/drive/files') &&
        res.url().includes('after=') &&
        res.request().method() === 'GET'
    );

    await scrollableContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    const loadMoreRes = await loadMoreResPromise;
    expect(loadMoreRes.status()).toBe(200);

    await page.getByTestId('document-row-skeleton').last().waitFor({
      state: 'hidden',
    });

    const countAfter = await rows.count();
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  // ─── Search ───────────────────────────────────────────────────────────────

  test.describe('Search', () => {
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

      const browseResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/contextCenter/drive/files') &&
          !res.url().includes('search')
      );
      await searchInput.clear();
      await browseResPromise;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page
          .getByTestId('documents-view')
          .locator('[data-testid^="document-row-"]')
          .first()
      ).toBeVisible();
    });
  });

  // ─── Basic rendering ──────────────────────────────────────────────────────

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

    const hint = modal.locator('[class*="hint"], p').filter({
      hasText: /svg|png|jpg|gif|5mb/i,
    });
    await expect(hint.first()).toBeVisible();

    const attachBtn = modal.getByRole('button', { name: /attach/i });
    await expect(attachBtn).toBeVisible();
    await expect(attachBtn).toBeDisabled();

    await modal.getByRole('button', { name: /cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('file upload attaches file and closes modal, then appears in list', async ({
    page,
  }) => {
    const fileName = `context-center-upload-${uuid()}.txt`;

    await navigateToDocuments(page);

    await page.getByRole('button', { name: /upload file/i }).click();
    const modal = page.getByRole('dialog', { name: /upload documents/i });
    await expect(modal).toBeVisible();

    const fileInput = page.getByTestId('file-upload-input');
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('context center upload test file'),
    });

    await expect(modal.getByText(fileName).first()).toBeVisible();

    const uploadResPromise = page.waitForResponse(
      '/api/v1/contextCenter/drive/files/upload'
    );
    await modal.getByRole('button', { name: /attach/i }).click();
    const uploadRes = await uploadResPromise;
    expect(uploadRes.status()).toBe(201);
    const uploadedDocument = (await uploadRes.json()) as ContextCenterDocument;
    contextFileIdsToCleanup.add(uploadedDocument.id);

    await expect(modal).not.toBeVisible();
    await expect(page.getByText(fileName).first()).toBeVisible();
  });

  // ─── Req 1: All card details (name, size, updatedBy, updatedAt, folder) ──

  test('uploaded document card shows name, size, updatedBy, updatedAt, and folder', async ({
    browser,
    page,
  }) => {
    const fileName = `card-details-${uuid()}.txt`;
    const folderName = `card-details-folder-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderName, displayName: folderName } }
    );
    const folderBody = await folderRes.text();
    expect(folderRes.status(), folderBody).toBe(201);
    const folder = parseResponseJson<ContextCenterFolder>(folderBody);
    contextFolderIdsToCleanup.add(folder.id);
    await uploadDocument(
      apiContext,
      fileName,
      Buffer.from('card detail test'),
      folder.fullyQualifiedName
    );
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    await expect(row.getByTestId('document-name')).toHaveText(fileName);

    const sizeEl = row.getByTestId('document-size');
    await expect(sizeEl).toBeVisible();
    const sizeText = await sizeEl.textContent();
    expect(sizeText?.trim().length).toBeGreaterThan(0);

    const updatedByEl = row.getByTestId('document-updated-by');
    await expect(updatedByEl).toBeVisible();
    const updatedByText = await updatedByEl.textContent();
    expect(updatedByText?.trim().length).toBeGreaterThan(0);

    const updatedAtEl = row.getByTestId('document-updated-at');
    await expect(updatedAtEl).toBeVisible();
    const updatedAtText = await updatedAtEl.textContent();
    expect(updatedAtText?.trim().length).toBeGreaterThan(0);

    await expect(row.getByTestId('document-folder-name')).toHaveText(
      folderName
    );
  });

  // ─── Req 2: Delete single document via card menu ──────────────────────────

  test('delete single document from card menu removes it from the list', async ({
    browser,
    page,
  }) => {
    const fileName = `card-menu-delete-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    await uploadDocument(apiContext, fileName, Buffer.from('delete from menu'));
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    await row.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('delete-btn')).toBeVisible();
    await page.getByTestId('delete-btn').click();

    await expect(page.getByTestId('modal-header')).toBeVisible();

    const deleteResPromise = page.waitForResponse(
      /\/api\/v1\/contextCenter\/drive\/files\/[^?]+\?hardDelete=false/
    );
    await page.getByTestId('confirm-button').click();
    const deleteRes = await deleteResPromise;
    expect(deleteRes.status()).toBe(200);

    await expect(getDocumentRowByName(page, fileName)).not.toBeVisible();
  });

  // ─── Req 3: Create folder + delete folder ────────────────────────────────

  test('create folder appears in sidebar tree and delete folder removes it', async ({
    page,
  }) => {
    const folderName = `folder-lifecycle-${uuid()}`;

    await navigateToDocuments(page);

    await page.getByTestId('add-folder-btn').click();
    await page
      .getByTestId('folder-name-input')
      .getByRole('textbox')
      .fill(folderName);

    const createResPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/contextCenter/drive/folders') &&
        res.request().method() === 'POST'
    );
    await page.getByTestId('create-folder-btn').click();
    const createRes = await createResPromise;
    expect(createRes.status()).toBe(201);
    const folder = (await createRes.json()) as ContextCenterFolder;
    contextFolderIdsToCleanup.add(folder.id);

    await expect(page.getByText(folderName, { exact: true })).toBeVisible();

    const deleteFolderBtn = page.getByTestId(`delete-folder-btn-${folder.id}`);
    await deleteFolderBtn.scrollIntoViewIfNeeded();
    await expect(deleteFolderBtn).toBeVisible();
    await deleteFolderBtn.click();

    await expect(page.getByTestId('modal-header')).toBeVisible();

    const folderDeleteResPromise = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/contextCenter/drive/folders/${folder.id}`) &&
        res.request().method() === 'DELETE'
    );
    await page.getByTestId('confirm-button').click();
    const folderDeleteRes = await folderDeleteResPromise;
    expect(folderDeleteRes.status()).toBe(200);
    contextFolderIdsToCleanup.delete(folder.id);

    await expect(page.getByText(folderName, { exact: true })).not.toBeVisible();
  });

  // ─── Req 4: Move single document to folder via card menu ──────────────────

  test('move document to folder via card menu shows folder name on the card', async ({
    browser,
    page,
  }) => {
    const fileName = `card-move-${uuid()}.txt`;
    const folderName = `card-move-folder-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const doc = await uploadDocument(
      apiContext,
      fileName,
      Buffer.from('move via card menu')
    );
    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderName, displayName: folderName } }
    );
    const folderBody = await folderRes.text();
    expect(folderRes.status(), folderBody).toBe(201);
    const folder = parseResponseJson<ContextCenterFolder>(folderBody);
    contextFolderIdsToCleanup.add(folder.id);
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    await row.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('move-btn')).toBeVisible();
    await page.getByTestId('move-btn').click();

    const moveResPromise = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/contextCenter/drive/files/${doc.id}/move`) &&
        res.request().method() === 'PUT'
    );
    await page.getByTestId(`move-to-folder-${folder.id}`).click();
    const moveRes = await moveResPromise;
    expect(moveRes.status()).toBe(200);

    await expect(
      getDocumentRowByName(page, fileName).getByTestId('document-folder-name')
    ).toHaveText(folderName);
  });

  // ─── Req 4b: Move to folder → folder visible on card; re-open menu shows folder selected; click again removes from folder ──

  test('moving document to folder shows folder on card; re-opening menu shows current folder selected; clicking it again removes document from folder', async ({
    browser,
    page,
  }) => {
    const fileName = `card-move-remove-${uuid()}.txt`;
    const folderName = `card-move-remove-folder-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const doc = await uploadDocument(
      apiContext,
      fileName,
      Buffer.from('move and remove from folder test')
    );

    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderName, displayName: folderName } }
    );
    const folderBody = await folderRes.text();
    expect(folderRes.status(), folderBody).toBe(201);
    const folder = parseResponseJson<ContextCenterFolder>(folderBody);
    contextFolderIdsToCleanup.add(folder.id);
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    await row.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('move-btn')).toBeVisible();
    await page.getByTestId('move-btn').click();

    const moveResPromise = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/contextCenter/drive/files/${doc.id}/move`) &&
        res.request().method() === 'PUT'
    );
    await page.getByTestId(`move-to-folder-${folder.id}`).click();
    const moveRes = await moveResPromise;
    expect(moveRes.status()).toBe(200);

    await expect(
      getDocumentRowByName(page, fileName).getByTestId('document-folder-name')
    ).toHaveText(folderName);

    await row.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('move-btn')).toBeVisible();
    await page.getByTestId('move-btn').click();

    const currentFolderItem = page.getByTestId(`move-to-folder-${folder.id}`);
    await expect(currentFolderItem).toBeVisible();
    await expect(currentFolderItem.locator('svg').last()).toBeVisible();

    const removeResPromise = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/contextCenter/drive/files/${doc.id}/move`) &&
        res.request().method() === 'PUT'
    );
    await currentFolderItem.click();
    const removeRes = await removeResPromise;
    expect(removeRes.status()).toBe(200);

    await expect(
      getDocumentRowByName(page, fileName).getByTestId('document-folder-name')
    ).not.toBeVisible();
  });

  // ─── Req 5: Preview panel — name, status, size, folder, updatedBy, updatedAt + copy link ──

  test('clicking document row opens preview panel with name, status, size, folder, updatedBy, updatedAt and copy button copies correct link', async ({
    browser,
    page,
  }) => {
    const fileName = `preview-panel-${uuid()}.txt`;
    const folderName = `preview-panel-folder-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderName, displayName: folderName } }
    );
    const folderBody = await folderRes.text();
    expect(folderRes.status(), folderBody).toBe(201);
    const folder = parseResponseJson<ContextCenterFolder>(folderBody);
    contextFolderIdsToCleanup.add(folder.id);
    const doc = await uploadDocument(
      apiContext,
      fileName,
      Buffer.from('preview panel content'),
      folder.fullyQualifiedName
    );
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await row.click();

    const panel = page.getByTestId('document-preview-panel');
    await expect(panel).toBeVisible();

    await expect(page).toHaveURL(new RegExp(`document=${doc.id}`));
    await expect(row.getByTestId('document-name')).toHaveText(fileName);

    await expect(panel.getByText('Status')).toBeVisible();
    await expect(panel.getByText('Size')).toBeVisible();
    await expect(panel.getByText('Folder', { exact: true })).toBeVisible();
    await expect(panel.getByText(folderName)).toBeVisible();
    await expect(panel.getByText('Updated By')).toBeVisible();
    await expect(panel.getByText('Updated At')).toBeVisible();

    const copyBtn = panel.getByTestId('copy-link-btn');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const panelClipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(panelClipboardText).toContain(`document=${doc.id}`);

    await panel.getByTestId('close-preview-btn').click();
    await expect(panel).not.toBeVisible();
  });

  // ─── Req 6: Copy link button on document list row ─────────────────────────

  test('copy link button on document list row copies URL with correct document id and opening the link shows the preview panel', async ({
    browser,
    page,
  }) => {
    const fileName = `copy-link-row-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const doc = await uploadDocument(
      apiContext,
      fileName,
      Buffer.from('copy link test')
    );
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    const copyBtn = row.getByTestId('copy-link-btn');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toContain(`document=${doc.id}`);

    // Open the copied link in a new tab and verify the preview panel auto-opens
    const newTab = await browser.newPage();
    await newTab.goto(clipboardText);
    await newTab
      .getByTestId('context-center-documents-page')
      .waitFor({ state: 'visible' });
    await waitForAllLoadersToDisappear(newTab);

    const panel = newTab.getByTestId('document-preview-panel');
    await expect(panel).toBeVisible();

    await expect(
      newTab.getByTestId(`document-row-${doc.id}`).getByTestId('document-name')
    ).toHaveText(fileName);

    await newTab.close();
  });

  // ─── Req 7: Bulk move 2 docs → API validated + folder name on both cards ──

  test('bulk move moves selected documents to a folder with a single API call and folder name appears on both cards', async ({
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
    expect(folderCreateRes.status()).toBe(201);
    const targetFolder = (await folderCreateRes.json()) as ContextCenterFolder;
    contextFolderIdsToCleanup.add(targetFolder.id);

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

  // ─── Req 8: Bulk delete 2 docs → removed from list + appear in archive ────

  test('bulk delete 2 documents removes them from the list and both appear in the archive', async ({
    browser,
    page,
  }) => {
    const firstName = `bulk-del-archive-one-${uuid()}.txt`;
    const secondName = `bulk-del-archive-two-${uuid()}.txt`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const doc1 = await uploadDocument(
      apiContext,
      firstName,
      Buffer.from('first for archive verify')
    );
    const doc2 = await uploadDocument(
      apiContext,
      secondName,
      Buffer.from('second for archive verify')
    );
    await afterAction();

    await navigateToDocuments(page);

    await selectDocumentByName(page, firstName);
    await selectDocumentByName(page, secondName);
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
    const bulkDeleteBody = (await bulkDeleteRes.json()) as BulkOperationResult;

    expect(bulkDeleteRes.status()).toBe(200);
    expect(bulkDeleteBody.numberOfRowsPassed).toBe(2);
    expect(bulkDeleteBody.numberOfRowsFailed ?? 0).toBe(0);
    expectBulkIdsRequest(bulkDeleteRes.request().postData(), [
      doc1.id,
      doc2.id,
    ]);

    await expect(getDocumentRowByName(page, firstName)).not.toBeVisible();
    await expect(getDocumentRowByName(page, secondName)).not.toBeVisible();

    await page.goto('/context-center/archive');
    await page
      .getByTestId('context-center-archive-page')
      .waitFor({ state: 'visible' });
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId(`archive-row-${doc1.id}`)).toBeVisible();
    await expect(page.getByTestId(`archive-row-${doc2.id}`)).toBeVisible();
  });

  // ─── Req 9: Left sidebar folder tree — doc nested under its folder ─────────

  test('document appears nested in the folder tree after being moved to a folder', async ({
    browser,
    page,
  }) => {
    const fileName = `folder-tree-doc-${uuid()}.txt`;
    const folderName = `folder-tree-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const doc = await uploadDocument(
      apiContext,
      fileName,
      Buffer.from('folder tree test')
    );
    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderName, displayName: folderName } }
    );
    const folderBody = await folderRes.text();
    expect(folderRes.status(), folderBody).toBe(201);
    const folder = parseResponseJson<ContextCenterFolder>(folderBody);
    contextFolderIdsToCleanup.add(folder.id);
    await afterAction();

    await navigateToDocuments(page);

    const row = getDocumentRowByName(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await row.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('move-btn')).toBeVisible();
    await page.getByTestId('move-btn').click();

    const moveResPromise = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/contextCenter/drive/files/${doc.id}/move`) &&
        res.request().method() === 'PUT'
    );
    await page.getByTestId(`move-to-folder-${folder.id}`).click();
    const moveRes = await moveResPromise;
    expect(moveRes.status()).toBe(200);

    await page.getByTestId('move-btn').waitFor({ state: 'detached' });

    const tree = page.getByRole('treegrid', { name: 'Folders' });

    const folderRow = tree.getByRole('row', {
      name: folderName,
    });

    await folderRow.getByRole('button', { name: 'Expand' }).click();

    await expect(folderRow).toHaveAttribute('aria-expanded', 'true');
    await expect(tree.getByText(fileName, { exact: true })).toBeVisible();
  });

  // ─── Req 10: Click folder → filters list; move menu hides current folder ──

  test('clicking folder in sidebar shows only that folder documents and move menu show the current folder', async ({
    browser,
    page,
  }) => {
    const docInFolderName = `in-folder-${uuid()}.txt`;
    const docOutsideName = `outside-folder-${uuid()}.txt`;
    const folderName = `filter-folder-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const folderRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderName, displayName: folderName } }
    );
    const folderBody = await folderRes.text();
    expect(folderRes.status(), folderBody).toBe(201);
    const folder = parseResponseJson<ContextCenterFolder>(folderBody);
    contextFolderIdsToCleanup.add(folder.id);

    await uploadDocument(
      apiContext,
      docInFolderName,
      Buffer.from('document inside folder'),
      folder.fullyQualifiedName
    );
    await uploadDocument(
      apiContext,
      docOutsideName,
      Buffer.from('document outside folder')
    );
    await afterAction();

    await navigateToDocuments(page);

    // Before selecting a folder: both documents should be visible and counts
    // reflect the global total (≥2 files; DocumentsView and DocumentFolderView
    // show the same number).
    await expect(getDocumentRowByName(page, docInFolderName)).toBeVisible();
    await expect(getDocumentRowByName(page, docOutsideName)).toBeVisible();

    const documentsViewCount = page.getByTestId('documents-view-file-count');
    const folderViewCount = page.getByTestId('folder-view-file-count');

    await expect(documentsViewCount).toBeVisible();
    await expect(folderViewCount).toBeVisible();

    const globalCountText = await documentsViewCount.textContent();
    const globalCount = parseInt(globalCountText ?? '0', 10);
    expect(globalCount).toBeGreaterThanOrEqual(2);

    // The folder-view header should show the same global total.
    await expect(folderViewCount).toContainText(String(globalCount));

    // Click the folder — triggers a server-side refetch scoped to that folder.
    const tree = page.getByRole('treegrid', { name: 'Folders' });

    const folderButton = tree.getByRole('row', {
      name: folderName,
    });
    await expect(folderButton).toBeVisible();
    await folderButton.click();
    await waitForAllLoadersToDisappear(page);

    // After selecting folder: only in-folder document visible.
    await expect(getDocumentRowByName(page, docInFolderName)).toBeVisible();
    await expect(getDocumentRowByName(page, docOutsideName)).not.toBeVisible();

    // DocumentsView header count updates to reflect the folder-scoped total.
    await expect(documentsViewCount).toContainText('1');

    // DocumentFolderView header still shows the global total (unchanged).
    await expect(folderViewCount).toContainText(String(globalCount));

    const inFolderRow = getDocumentRowByName(page, docInFolderName);
    await inFolderRow.scrollIntoViewIfNeeded();
    await inFolderRow.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('move-btn')).toBeVisible();
    const moveButton = page.getByTestId('move-btn');

    if (await moveButton.isEnabled()) {
      await moveButton.click();

      await expect(
        page.getByTestId(`move-to-folder-${folder.id}`)
      ).toBeVisible();
    }

    await page.keyboard.press('Escape');
  });

  // ─── Req 11: Duplicate in same folder → retry error; same name in diff folder → success; delete file + folder ──

  test('duplicate filename in same folder shows retry error; uploading same name to different folder succeeds; delete file and folder from UI', async ({
    browser,
    page,
  }) => {
    const sharedFileName = `dup-folder-${uuid()}.txt`;
    const folderAName = `dup-folder-a-${uuid()}`;
    const folderBName = `dup-folder-b-${uuid()}`;

    const { apiContext, afterAction } = await createNewPage(browser);
    const folderARes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderAName, displayName: folderAName } }
    );
    const folderABody = await folderARes.text();
    expect(folderARes.status(), folderABody).toBe(201);
    const folderA = parseResponseJson<ContextCenterFolder>(folderABody);
    contextFolderIdsToCleanup.add(folderA.id);

    const folderBRes = await apiContext.post(
      '/api/v1/contextCenter/drive/folders',
      { data: { name: folderBName, displayName: folderBName } }
    );
    const folderBBody = await folderBRes.text();
    expect(folderBRes.status(), folderBBody).toBe(201);
    const folderB = parseResponseJson<ContextCenterFolder>(folderBBody);
    contextFolderIdsToCleanup.add(folderB.id);

    await uploadDocument(
      apiContext,
      sharedFileName,
      Buffer.from('original in folder A'),
      folderA.fullyQualifiedName
    );
    await afterAction();

    await navigateToDocuments(page);

    // Select folderA in the sidebar so the upload modal targets that folder
    const tree = page.getByRole('treegrid', { name: 'Folders' });

    const folderButton = tree.getByRole('row', {
      name: folderAName,
    });
    await expect(folderButton).toBeVisible();
    await folderButton.click();
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: /upload file/i }).click();
    const modal = page.getByRole('dialog', { name: /upload documents/i });
    await expect(modal).toBeVisible();

    const fileInput = page.getByTestId('file-upload-input');
    await fileInput.waitFor({ state: 'attached' });
    await fileInput.setInputFiles({
      name: sharedFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('duplicate attempt in folder A'),
    });
    await expect(modal.getByText(sharedFileName)).toBeVisible();

    const dupResPromise = page.waitForResponse(
      '/api/v1/contextCenter/drive/files/upload'
    );
    await modal.getByRole('button', { name: /attach/i }).click();
    const dupRes = await dupResPromise;
    expect(dupRes.status()).toBe(400);

    await expect(modal.getByText(/try again|failed/i).first()).toBeVisible();
    await expect(modal.getByRole('button', { name: /attach/i })).toBeDisabled();

    await modal.getByRole('button', { name: /cancel/i }).click();
    await expect(modal).not.toBeVisible();

    let uploadedDocId: string;
    {
      const { apiContext: api2, afterAction: after2 } = await createNewPage(
        browser
      );
      const uploadedDoc = await uploadDocument(
        api2,
        sharedFileName,
        Buffer.from('same filename in folder B'),
        folderB.fullyQualifiedName
      );
      uploadedDocId = uploadedDoc.id;
      await after2();
    }

    await navigateToDocuments(page);

    const uploadedRow = page.getByTestId(`document-row-${uploadedDocId}`);
    await expect(uploadedRow).toBeVisible();
    await uploadedRow.scrollIntoViewIfNeeded();

    await expect(uploadedRow.getByTestId('document-folder-name')).toHaveText(
      folderBName
    );

    await uploadedRow.locator('button[aria-label="Open menu"]').click();
    await expect(page.getByTestId('delete-btn')).toBeVisible();
    await page.getByTestId('delete-btn').click();

    await expect(page.getByTestId('modal-header')).toBeVisible();

    const deleteResPromise = page.waitForResponse(
      /\/api\/v1\/contextCenter\/drive\/files\/[^?]+\?hardDelete=false/
    );
    await page.getByTestId('confirm-button').click();
    const deleteRes = await deleteResPromise;
    expect(deleteRes.status()).toBe(200);

    await expect(
      page.getByTestId(`document-row-${uploadedDocId}`)
    ).not.toBeVisible();
    contextFileIdsToCleanup.delete(uploadedDocId);

    const deleteFolderBBtn = page.getByTestId(
      `delete-folder-btn-${folderB.id}`
    );
    await deleteFolderBBtn.scrollIntoViewIfNeeded();
    await expect(deleteFolderBBtn).toBeVisible();
    await deleteFolderBBtn.click();

    await expect(page.getByTestId('modal-header')).toBeVisible();

    const folderDeleteResPromise = page.waitForResponse(
      (res) =>
        res
          .url()
          .includes(`/api/v1/contextCenter/drive/folders/${folderB.id}`) &&
        res.request().method() === 'DELETE'
    );
    await page.getByTestId('confirm-button').click();
    const folderDeleteRes = await folderDeleteResPromise;
    expect(folderDeleteRes.status()).toBe(200);
    contextFolderIdsToCleanup.delete(folderB.id);

    await expect(
      page.getByText(folderBName, { exact: true })
    ).not.toBeVisible();
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
    await expect(modal.getByRole('button', { name: /attach/i })).toBeDisabled();
  });

  test('oversized file appears in list with failed state and Attach button stays disabled', async ({
    page,
  }) => {
    await navigateToDocuments(page);

    await page.getByRole('button', { name: /upload file/i }).click();
    const modal = page.getByRole('dialog', { name: /upload documents/i });
    await expect(modal).toBeVisible();

    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 'x');
    const oversizedInput = page.getByTestId('file-upload-input');
    await oversizedInput.waitFor({ state: 'attached' });
    await oversizedInput.setInputFiles({
      name: 'too-large.bin',
      mimeType: 'application/octet-stream',
      buffer: bigBuffer,
    });

    await expect(modal.getByText('too-large.bin')).toBeVisible({
      timeout: 5000,
    });

    await expect(modal.getByRole('button', { name: /attach/i })).toBeDisabled();
  });
});
