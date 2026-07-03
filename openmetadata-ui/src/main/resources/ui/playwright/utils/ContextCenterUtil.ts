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
  Browser,
  expect,
  Locator,
  Page,
  Response,
} from '@playwright/test';
import { PolicyRulesType } from '../support/access-control/PoliciesClass';
import { UserClass } from '../support/user/UserClass';
import { uuid } from './common';
import { waitForAllLoadersToDisappear } from './entity';

// ─── Document types ───────────────────────────────────────────────────────────

export interface ContextCenterDocument {
  id: string;
  name: string;
  displayName?: string;
}

export interface ContextCenterFolder {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

export interface BulkOperationResult {
  numberOfRowsPassed?: number;
  numberOfRowsFailed?: number;
}

export interface BulkIdsRequest {
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

interface CapturedDownload {
  download: string;
  href: string;
}

interface DownloadCaptureWindow extends Window {
  __contextCenterCapturedDownloads?: CapturedDownload[];
  __contextCenterOriginalAnchorClick?: HTMLAnchorElement['click'];
}

// ─── Document helpers ─────────────────────────────────────────────────────────

export const parseResponseJson = <T>(body: string): T => JSON.parse(body) as T;

export const uploadDocument = async (
  apiContext: APIRequestContext,
  name: string,
  buffer: Buffer,
  folderFqn?: string
): Promise<ContextCenterDocument> => {
  const multipart: UploadMultipart = {
    file: {
      name,
      mimeType: 'text/plain',
      buffer,
    },
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

  return parseResponseJson<ContextCenterDocument>(body);
};

export const getDocumentRowByName = (page: Page, fileName: string): Locator =>
  page
    .getByTestId('documents-view')
    .locator('[data-testid^="document-row-"]')
    .filter({ hasText: fileName });

export const selectDocumentByName = async (page: Page, fileName: string) => {
  const row = getDocumentRowByName(page, fileName);
  await expect(row).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  await row.getByTestId('document-checkbox').click();
};

export const expectSelectedCount = async (page: Page, count: number) => {
  await expect(
    page.getByText(`${count} selected`, { exact: true })
  ).toBeVisible();
};

export const expectBulkIdsRequest = (
  postData: string | null,
  expectedIds: string[]
) => {
  expect(postData).toBeTruthy();

  const request = parseResponseJson<BulkIdsRequest>(postData ?? '{}');

  expect(new Set(request.ids)).toEqual(new Set(expectedIds));
};

export const responseMatchesRequestPath = (
  response: Response,
  expectedPath: string
): boolean => {
  let request = response.request();

  while (request) {
    if (request.url().includes(expectedPath)) {
      return true;
    }

    request = request.redirectedFrom();
  }

  return false;
};

export const installDownloadCapture = async (page: Page) => {
  await page.evaluate(() => {
    const captureWindow = window as DownloadCaptureWindow;
    captureWindow.__contextCenterCapturedDownloads = [];

    if (captureWindow.__contextCenterOriginalAnchorClick) {
      return;
    }

    captureWindow.__contextCenterOriginalAnchorClick =
      HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      captureWindow.__contextCenterCapturedDownloads?.push({
        download: this.download,
        href: this.href,
      });
      captureWindow.__contextCenterOriginalAnchorClick?.call(this);
    };
  });
};

export const expectCapturedDownload = async (page: Page, fileName: string) => {
  const capturedDownload = await page.waitForFunction((expectedFileName) => {
    const captureWindow = window as DownloadCaptureWindow;

    return captureWindow.__contextCenterCapturedDownloads?.find(
      (download) => download.download === expectedFileName
    );
  }, fileName);
  const download = (await capturedDownload.jsonValue()) as CapturedDownload;

  expect(download.href.startsWith('blob:')).toBe(true);
};

export const DASHBOARD_URL = '/context-center/dashboard';
export const ARTICLES_URL = '/context-center/articles';
export const DOCUMENTS_URL = '/context-center/documents';
export const MEMORIES_URL = '/context-center/memories';
export const MEMORIES_API = '/api/v1/contextCenter/memories';

export const navigateToDashboard = async (page: Page) => {
  await page.goto(DASHBOARD_URL);
  await page
    .getByTestId('context-center-dashboard-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  // Wait for article section to finish loading (either cards or empty state)
  const section = page.getByTestId('dashboard-detail-card');
  await section.waitFor({ state: 'visible' });
};

export const navigateToArticles = async (page: Page) => {
  await page.goto(ARTICLES_URL);
  await page
    .getByTestId('context-center-articles-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToDocuments = async (page: Page) => {
  await page.goto(DOCUMENTS_URL);
  await page
    .getByTestId('context-center-documents-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToMemories = async (page: Page) => {
  await page.goto(MEMORIES_URL);
  await page
    .getByTestId('context-center-memories-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const navigateToArchive = async (page: Page) => {
  await page.goto('/context-center/archive');
  await page
    .getByTestId('context-center-archive-page')
    .waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

// ─── Archive page test helpers ─────────────────────────────────────────────────

export const getFolderTreeItem = (page: Page, folderName: string): Locator =>
  page
    .getByRole('treegrid', { name: 'Folders' })
    .getByRole('row', {
      name: folderName,
    })
    .first();

export const getFolderExpandBtn = (page: Page, folderName: string): Locator =>
  getFolderTreeItem(page, folderName).locator('button[slot="chevron"]').first();

export const getDocumentSearchInput = (page: Page): Locator =>
  page.getByTestId('search-input').getByLabel('Search Documents');

export const selectFolderInSidebar = async (
  page: Page,
  folderName: string
): Promise<void> => {
  await getFolderTreeItem(page, folderName).click();
  await waitForAllLoadersToDisappear(page);
};

export const openUploadModal = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /upload file/i }).click();
  await expect(
    page.getByRole('dialog', { name: /upload documents/i })
  ).toBeVisible();
};

export const uploadFileViaModal = async (
  page: Page,
  fileName: string,
  content: string
): Promise<string> => {
  const modal = page.getByRole('dialog', { name: /upload documents/i });
  const fileInput = page.getByTestId('file-upload-input');
  await fileInput.waitFor({ state: 'attached' });
  await fileInput.setInputFiles({
    buffer: Buffer.from(content),
    mimeType: 'text/plain',
    name: fileName,
  });

  await expect(modal.getByText(fileName).first()).toBeVisible();

  const uploadResPromise = page.waitForResponse(
    '/api/v1/contextCenter/drive/files/upload'
  );
  await modal.getByRole('button', { name: /attach/i }).click();
  const uploadRes = await uploadResPromise;
  expect(uploadRes.status()).toBe(201);

  await expect(modal).not.toBeVisible();

  const uploadData = (await uploadRes.json()) as { id: string };

  return uploadData.id;
};

export const softDeleteDocument = async (
  page: Page,
  docRowId: string
): Promise<void> => {
  const docRow = page.getByTestId(docRowId);
  await expect(docRow).toBeVisible();
  await docRow.locator('button[aria-label="Open menu"]').click();
  await page.getByTestId('delete-btn').click();

  const deleteResPromise = page.waitForResponse(
    /\/api\/v1\/contextCenter\/drive\/files\/[^?]+\?hardDelete=false/
  );
  await page.getByTestId('confirm-button').click();
  const deleteRes = await deleteResPromise;
  expect(deleteRes.status()).toBe(200);
};

export const buildPermissionRule = (
  namePrefix: string,
  resources: string[],
  operations: string[]
): PolicyRulesType[] => [
  {
    name: `${namePrefix}-${uuid()}`,
    resources,
    operations,
    effect: 'allow',
  },
];

export const loginAsUser = async (
  browser: Browser,
  user: UserClass
): Promise<Page> => {
  const page = await browser.newPage();
  await user.login(page);

  return page;
};

export const uploadDisposableDocument = async (
  apiContext: APIRequestContext,
  namePrefix = 'cc-disposable-doc'
): Promise<{ id: string; name: string }> => {
  const name = `${namePrefix}-${uuid()}.txt`;
  const response = await apiContext.post(
    '/api/v1/contextCenter/drive/files/upload',
    {
      multipart: {
        file: {
          name,
          mimeType: 'text/plain',
          buffer: Buffer.from('Playwright disposable document'),
        },
      },
    }
  );
  const data = await response.json();

  return { id: data.id, name };
};

export const createDisposableArchivedDocument = async (
  apiContext: APIRequestContext,
  namePrefix = 'cc-disposable-archived-doc'
): Promise<{ id: string; name: string }> => {
  const { id, name } = await uploadDisposableDocument(apiContext, namePrefix);
  await apiContext.delete(
    `/api/v1/contextCenter/drive/files/${id}?hardDelete=false`
  );

  return { id, name };
};

export async function waitForDocumentInArchive(
  apiContext: APIRequestContext,
  documentId: string,
  timeout = 60_000,
  interval = 2_000
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(
      '/api/v1/contextCenter/drive/files?include=deleted&limit=1000'
    );

    expect(response.ok()).toBeTruthy();

    const files = await response.json();

    const found = (files?.data ?? []).some(
      (file: { id: string; deleted: boolean }) =>
        file.id === documentId && file.deleted === true
    );

    if (found) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Document ${documentId} did not appear in archive API within ${timeout}ms`
  );
}

export async function waitForDocumentPermanentlyDeleted(
  apiContext: APIRequestContext,
  documentId: string,
  timeout = 60_000,
  interval = 2_000
) {
  const start = Date.now();
  const pageSize = 200;

  while (Date.now() - start < timeout) {
    let after: string | undefined;
    let foundInArchive = false;

    do {
      const response = await apiContext.get(
        `/api/v1/contextCenter/drive/files?include=deleted&limit=${pageSize}${
          after ? `&after=${after}` : ''
        }`
      );

      expect(response.ok()).toBeTruthy();

      const files = await response.json();

      foundInArchive = (files?.data ?? []).some(
        (file: { id: string }) => file.id === documentId
      );

      after = files?.paging?.after;
    } while (!foundInArchive && after);

    if (!foundInArchive) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Document ${documentId} was still present in the archive API after ${timeout}ms`
  );
}
