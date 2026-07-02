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
import { createNewPage, uuid } from '../../utils/common';
import {
  ContextCenterDocument,
  expectBulkIdsRequest,
  expectCapturedDownload,
  expectSelectedCount,
  getDocumentRowByName,
  installDownloadCapture,
  navigateToDocuments,
  responseMatchesRequestPath,
  selectDocumentByName,
  uploadDocument,
} from '../../utils/ContextCenterUtil';
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
