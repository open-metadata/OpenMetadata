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
import {
  navigateToDocuments,
  parseResponseJson,
  searchAndGetDocumentRow,
  uploadDocument as uploadDocumentToApi,
  waitForDocumentProcessingComplete,
} from '../../utils/ContextCenterUtil';
import { test } from '../fixtures/pages';

// ─── Fixture content ────────────────────────────────────────────────────────

const MARKDOWN_HEADING = 'Preview Heading';
const MARKDOWN_CONTENT = `# ${MARKDOWN_HEADING}\n\nMarkdown preview body text.`;
const TEXT_CONTENT = 'Plain text preview body for the file preview modal.';

/** A minimal valid 1x1 transparent PNG, used as an in-memory upload fixture. */
const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/**
 * Builds a minimal, real single-page PDF from scratch. pdf.js parses the
 * `xref` table before falling back to a slower object-scan recovery, so the
 * byte offsets below are computed from the objects actually written rather
 * than hardcoded — a wrong offset would otherwise make the file dependent on
 * pdf.js's recovery path instead of exercising the normal parse path.
 */
const buildMinimalPdfBuffer = (): Buffer => {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }

  const xrefOffset = body.length;
  const xrefEntries = offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  const xref = `xref\n0 ${
    objects.length + 1
  }\n0000000000 65535 f \n${xrefEntries}`;
  const trailer = `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body + xref + trailer, 'latin1');
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RendererOverride {
  fileType: string;
  fileExtension?: string;
}

/**
 * The preview modal dispatches purely on the uploaded file's `fileType`
 * (backend classifies it from the filename's guessed content-type, which is
 * JDK/mime-table dependent and not something this UI-behavior test should
 * depend on). Routing the ES search response lets the test pin the exact
 * `fileType`/`fileExtension` combination each renderer dispatches on while
 * the actual preview content still round-trips through the real upload and
 * download endpoints.
 */
const mockSearchHitWithOverride = async (
  page: Page,
  apiContext: APIRequestContext,
  documentId: string,
  override: RendererOverride
): Promise<void> => {
  const detailRes = await apiContext.get(
    `/api/v1/contextCenter/drive/files/${documentId}`,
    { params: { fields: 'folder,memoryCount' } }
  );
  const detailBody = await detailRes.text();
  expect(detailRes.status(), detailBody).toBe(200);
  const document = parseResponseJson<Record<string, unknown>>(detailBody);

  await page.route(
    (url) =>
      url.pathname === '/api/v1/search/query' &&
      url.searchParams.get('index') === 'contextFile',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hits: {
            hits: [
              {
                _source: {
                  ...document,
                  processingStatus: 'Processed',
                  ...override,
                },
              },
            ],
            total: { value: 1 },
          },
        }),
      });
    }
  );
};

const openFilePreviewModal = async (
  page: Page,
  row: Locator,
  fileId: string
): Promise<Locator> => {
  const downloadResPromise = page.waitForResponse(
    (res) =>
      res.url().includes(`/drive/files/${fileId}/download`) &&
      res.request().method() === 'GET'
  );
  await row.getByTestId('preview-btn').click();
  const downloadRes = await downloadResPromise;
  expect(downloadRes.status()).toBe(200);

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  return modal;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Context Center - Document File Preview', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('markdown file renders as formatted markdown in the preview modal', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-md-${uuid()}.md`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      Buffer.from(MARKDOWN_CONTENT)
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'Text',
      fileExtension: 'md',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    const modal = await openFilePreviewModal(page, row, document.id);

    await expect(
      modal.getByRole('heading', { name: MARKDOWN_HEADING })
    ).toBeVisible();
    await expect(modal.locator('[class*="tw:prose"]')).toBeVisible();
  });

  test('plain text file renders inside a pre block in the preview modal', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-txt-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      Buffer.from(TEXT_CONTENT)
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'Text',
      fileExtension: 'txt',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    const modal = await openFilePreviewModal(page, row, document.id);

    await expect(modal.locator('pre')).toBeVisible();
    await expect(modal.locator('pre')).toHaveText(TEXT_CONTENT);
  });

  test('pdf file renders its pages as canvas elements in the preview modal', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-pdf-${uuid()}.pdf`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      buildMinimalPdfBuffer()
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'PDF',
      fileExtension: 'pdf',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    const modal = await openFilePreviewModal(page, row, document.id);

    await expect(modal.locator('canvas')).toBeVisible();
  });

  test('image file renders as an img element in the preview modal', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-png-${uuid()}.png`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'Image',
      fileExtension: 'png',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    const modal = await openFilePreviewModal(page, row, document.id);

    const image = modal.locator('img');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', /^blob:/);
  });

  test('unsupported file type does not offer a preview button', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-unsupported-${uuid()}.docx`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      Buffer.from('unsupported preview fallback test content')
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    // A `fileType` with no dedicated renderer (Document/Spreadsheet/
    // Presentation/Archive/Other) is resolveRenderer's default case, so the
    // row must gate the preview button off while still offering download.
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'Document',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();

    // The preview button keeps its slot (rendered invisible) so the status
    // badge and action icons stay column-aligned with previewable rows.
    await expect(row.getByTestId('preview-btn')).toBeHidden();
    await expect(row.getByTestId('download-btn')).toBeVisible();
  });

  test('preview modal closes on Escape and returns focus to the preview trigger', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-escape-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      Buffer.from(TEXT_CONTENT)
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'Text',
      fileExtension: 'txt',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    const previewButton = row.getByTestId('preview-btn');

    const modal = await openFilePreviewModal(page, row, document.id);
    await expect(modal.locator('pre')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(modal).not.toBeVisible();
    await expect(previewButton).toBeFocused();
  });

  test('preview modal closes via the close button and returns focus to the preview trigger', async ({
    browser,
    page,
  }) => {
    test.slow();
    const fileName = `file-preview-close-btn-${uuid()}.txt`;
    const { apiContext, afterAction } = await createNewPage(browser);
    const document = await uploadDocumentToApi(
      apiContext,
      fileName,
      Buffer.from(TEXT_CONTENT)
    );
    await waitForDocumentProcessingComplete(apiContext, document.id);
    await mockSearchHitWithOverride(page, apiContext, document.id, {
      fileType: 'Text',
      fileExtension: 'txt',
    });
    await afterAction();

    await navigateToDocuments(page);

    const row = await searchAndGetDocumentRow(page, fileName);
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    const previewButton = row.getByTestId('preview-btn');

    const modal = await openFilePreviewModal(page, row, document.id);
    await expect(modal.locator('pre')).toBeVisible();

    await modal.getByRole('button', { name: 'Close' }).click();

    await expect(modal).not.toBeVisible();
    await expect(previewButton).toBeFocused();
  });
});
