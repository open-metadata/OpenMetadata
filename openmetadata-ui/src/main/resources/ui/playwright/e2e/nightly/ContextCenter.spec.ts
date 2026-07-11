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
import { SHORTCUTS } from '../../constant/KnowledgeCenter.constant';
import { createNewPage, uuid } from '../../utils/common';
import {
  ContextCenterDocument,
  createArticleViaApi,
  deleteArticleByFqn,
  expectBulkIdsRequest,
  expectCapturedDownload,
  expectSelectedCount,
  getDocumentRowByName,
  insertImageViaUpload,
  insertImageViaUrl,
  installDownloadCapture,
  navigateToArticle,
  navigateToDocuments,
  responseMatchesRequestPath,
  selectDocumentByName,
  uploadDocument,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { getEditor, waitForAutoSave } from '../../utils/KnowledgeCenter';
import { test as base } from '../fixtures/pages';

const test = base;

// ─── State ────────────────────────────────────────────────────────────────────

const contextFileIdsToCleanup = new Set<string>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uploadAndTrack = async (
  ...args: Parameters<typeof uploadDocument>
): Promise<ContextCenterDocument> => {
  const document = await uploadDocument(...args);
  contextFileIdsToCleanup.add(document.id);

  return document;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Context Center - Download', () => {
  test.afterAll(async ({ browser }) => {
    if (contextFileIdsToCleanup.size === 0) {
      return;
    }

    const { apiContext, afterAction } = await createNewPage(browser);

    for (const id of contextFileIdsToCleanup) {
      await apiContext.delete(
        `/api/v1/contextCenter/drive/files/${id}?hardDelete=true`
      );
    }

    contextFileIdsToCleanup.clear();
    await afterAction();
  });

  test('download button triggers file download', async ({ browser, page }) => {
    const fileName = `download-doc-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadAndTrack(
      apiContext,
      fileName,
      Buffer.from('document for download test')
    );
    await afterAction();

    await navigateToDocuments(page);

    const targetRow = getDocumentRowByName(page, fileName);
    await expect(targetRow).toBeVisible();
    await installDownloadCapture(page);

    const downloadPath = `/api/v1/contextCenter/drive/files/${document.id}/download`;
    const downloadResPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        responseMatchesRequestPath(response, downloadPath)
    );

    await targetRow.getByTestId('download-btn').click();
    const downloadRes = await downloadResPromise;

    expect([200, 302, 303]).toContain(downloadRes.status());
    await expectCapturedDownload(page, fileName);
  });

  test('bulk download downloads selected documents as a zip with a single API call', async ({
    browser,
    page,
  }) => {
    const firstFileName = `bulk-download-one-${uuid()}.txt`;
    const secondFileName = `bulk-download-two-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const firstDocument = await uploadAndTrack(
      apiContext,
      firstFileName,
      Buffer.from('first document for bulk download')
    );
    const secondDocument = await uploadAndTrack(
      apiContext,
      secondFileName,
      Buffer.from('second document for bulk download')
    );
    await afterAction();

    await navigateToDocuments(page);

    await selectDocumentByName(page, firstFileName);
    await selectDocumentByName(page, secondFileName);
    await expectSelectedCount(page, 2);
    await installDownloadCapture(page);

    const bulkDownloadResPromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/api/v1/contextCenter/drive/files/bulk/download') &&
        response.request().method() === 'POST'
    );

    await page.getByTestId('bulk-download-btn').click();
    const bulkDownloadRes = await bulkDownloadResPromise;

    expect(bulkDownloadRes.status()).toBe(200);
    expectBulkIdsRequest(bulkDownloadRes.request().postData(), [
      firstDocument.id,
      secondDocument.id,
    ]);
    await expectCapturedDownload(page, 'context-center-documents.zip');
    await expect(
      page.getByText('2 selected', { exact: true })
    ).not.toBeVisible();
  });
});

test.describe('Context Center - Article Attachments', () => {
  const articleFqnsToCleanup = new Set<string>();

  test.afterAll(async ({ browser }) => {
    if (articleFqnsToCleanup.size === 0) {
      return;
    }

    const { apiContext, afterAction } = await createNewPage(browser);

    for (const fqn of articleFqnsToCleanup) {
      await deleteArticleByFqn(apiContext, fqn);
    }

    articleFqnsToCleanup.clear();
    await afterAction();
  });

  test('image insert via upload and URL renders in editor, persists on reload, and is downloadable from the attachment widget', async ({
    browser,
    page,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const article = await createArticleViaApi(apiContext);
    await afterAction();
    articleFqnsToCleanup.add(article.fullyQualifiedName);

    const uploadedFileName = `attachment-${uuid()}.png`;

    await test.step('navigate to the article', async () => {
      await navigateToArticle(page, article.fullyQualifiedName);
    });

    await test.step('insert image via file upload', async () => {
      const editor = await getEditor(page, true);
      await editor.click();
      await page.keyboard.press(SHORTCUTS.enter);
      await insertImageViaUpload(page, uploadedFileName);

      await expect(
        page.getByTestId('uploaded-image-node').first()
      ).toBeVisible();
    });

    await test.step('insert image via URL embed', async () => {
      const editor = await getEditor(page, true);
      await editor.click();
      await page.getByRole('paragraph').last().click();
      await page.keyboard.press('Enter');
      await insertImageViaUrl(
        page,
        'https://raw.githubusercontent.com/open-metadata/OpenMetadata/main/openmetadata-docs/images/logo-mark.svg'
      );

      await expect(page.getByTestId('uploaded-image-node')).toHaveCount(2);
    });

    await test.step('verify autosave', async () => {
      await waitForAutoSave(page);
    });

    await test.step('reload and verify persistence and attachment widget', async () => {
      await page.reload();
      await waitForAllLoadersToDisappear(page);
      await getEditor(page, true);

      await expect(
        page.getByTestId('uploaded-image-node').first()
      ).toBeVisible();

      const attachmentWidget = page.getByTestId('attachment-widget');
      await expect(attachmentWidget).toBeVisible();

      const attachmentItem = attachmentWidget
        .locator('[data-testid^="attachment-item-"]')
        .filter({ hasText: uploadedFileName });
      await expect(attachmentItem).toBeVisible();
    });

    await test.step('download attachment from the widget', async () => {
      await installDownloadCapture(page);

      const attachmentWidget = page.getByTestId('attachment-widget');
      const attachmentItem = attachmentWidget
        .locator('[data-testid^="attachment-item-"]')
        .filter({ hasText: uploadedFileName });
      const downloadButton = attachmentItem.locator(
        '[data-testid^="download-attachment-"]'
      );

      const downloadResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/attachments/') &&
          response.url().includes('/download') &&
          response.request().method() === 'GET'
      );

      await downloadButton.click();
      const downloadResponse = await downloadResponsePromise;

      expect([200, 302, 303]).toContain(downloadResponse.status());
      await expectCapturedDownload(page, uploadedFileName);
    });
  });
});
