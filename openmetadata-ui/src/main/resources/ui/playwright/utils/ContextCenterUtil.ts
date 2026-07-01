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
import { KnowledgeCenterResponseDataType } from '../support/entity/KnowledgeCenter.interface';
import { UserClass } from '../support/user/UserClass';
import { createNewPage, uuid } from './common';
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
export const ARTICLE_DESCRIPTION =
  'Playwright article description for card detail check';
export const QUICK_LINK_URL = 'https://example.com';
export const QUICK_LINK_DESCRIPTION =
  'Playwright quick link description for card detail check';

export const deleteArticleByFqn = async (
  apiContext: APIRequestContext,
  fqn: string
) => {
  const res = await apiContext.get(
    `/api/v1/contextCenter/pages/name/${encodeURIComponent(fqn)}?fields=id`
  );

  if (!res.ok()) {
    return;
  }

  const data = await res.json();

  if (data.id) {
    await apiContext
      .delete(
        `/api/v1/contextCenter/pages/${data.id}?hardDelete=true&recursive=true`
      )
      .catch(() => undefined);
  }
};

export const createArticleViaApi = async (
  apiContext: APIRequestContext,
  data?: Partial<{
    name: string;
    displayName: string;
    description: string;
    owners: Array<{ id: string; type: string }>;
  }>
): Promise<KnowledgeCenterResponseDataType> => {
  const response = await apiContext.post('/api/v1/contextCenter/pages', {
    data: {
      name: data?.name ?? `cc_article_${uuid()}`,
      displayName: data?.displayName ?? `CC Article ${uuid()}`,
      description: data?.description ?? ARTICLE_DESCRIPTION,
      pageType: 'Article',
      page: { publicationDate: Date.now(), relatedArticles: [] },
      ...(data?.owners && { owners: data.owners }),
    },
  });
  const body = await response.json();

  expect(response.status(), JSON.stringify(body)).toBe(201);

  return body;
};

export const createQuickLinkViaApi = async (
  apiContext: APIRequestContext,
  displayName: string,
  url = QUICK_LINK_URL
): Promise<KnowledgeCenterResponseDataType> => {
  const response = await apiContext.post('/api/v1/contextCenter/pages', {
    data: {
      name: `cc_quicklink_${uuid()}`,
      displayName,
      description: QUICK_LINK_DESCRIPTION,
      pageType: 'QuickLink',
      page: { url, publicationDate: Date.now(), relatedArticles: [] },
    },
  });
  const body = await response.json();

  expect(response.status(), JSON.stringify(body)).toBe(201);

  return body;
};

export const scrollHierarchyToNode = async (
  page: Page,
  displayName: string
) => {
  const hierarchy = page.getByTestId('knowledge-pages-hierarchy');
  const node = hierarchy.getByTestId(`page-node-${displayName}`);

  await hierarchy.waitFor({ state: 'visible' });

  let previousLastNode = '';
  for (let attempt = 0; attempt < 50 && !(await node.isVisible()); attempt++) {
    await hierarchy.hover();
    await page.mouse.wheel(0, 3000);
    await expect(
      hierarchy.locator('[data-testid^="page-node-"]').first()
    ).toBeVisible();

    const lastNode = await hierarchy
      .locator('[data-testid^="page-node-"]')
      .last()
      .getAttribute('data-testid');

    if (lastNode === previousLastNode) {
      break;
    }
    previousLastNode = lastNode ?? '';
  }

  await expect(node).toBeVisible();

  return node;
};

export const createArticleFromButton = async (page: Page) => {
  await page.getByTestId('create-knowledge-page-btn').click();
  await page.getByTestId('create-article-btn').click();
};

export const getArticleFqnFromUrl = (page: Page) =>
  decodeURIComponent(
    page.url().split('/context-center/articles/').pop()?.split('/')[0] ?? ''
  );

export const cleanupCurrentArticle = async (page: Page) => {
  const browser = page.context().browser();
  const fqn = getArticleFqnFromUrl(page);

  if (!browser || !fqn) {
    return;
  }

  const { apiContext, afterAction } = await createNewPage(browser);
  await deleteArticleByFqn(apiContext, fqn);
  await afterAction();
};

export const verifyArticleSearch = async (page: Page, searchTerm: string) => {
  const header = page.getByTestId('context-center-header');
  const searchInput = header
    .getByTestId('search-input')
    .getByLabel('Search Articles');
  const searchResPromise = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/search/query') &&
      res.url().includes('index=page')
  );

  await searchInput.fill(searchTerm);
  const searchRes = await searchResPromise;
  expect(searchRes.status()).toBe(200);

  return searchInput;
};

export const assertArticleEditorSaved = async (page: Page) => {
  await expect(page.getByTestId('content-change-state')).toHaveText('Saved');
};

export const scrollListingToCard = async (page: Page, displayName: string) => {
  const listing = page.getByTestId('knowledge-page-listing');
  const card = listing.getByTestId(`knowledge-card-${displayName}`);

  await listing.waitFor({ state: 'visible' });

  let previousLastCard = '';
  for (let attempt = 0; attempt < 50 && !(await card.isVisible()); attempt++) {
    await listing.hover();
    await page.mouse.wheel(0, 3000);
    await expect(
      listing.locator('[data-testid^="knowledge-card-"]').first()
    ).toBeVisible();

    const lastCard = await listing
      .locator('[data-testid^="knowledge-card-"]')
      .last()
      .getAttribute('data-testid');

    if (lastCard === previousLastCard) {
      break;
    }
    previousLastCard = lastCard ?? '';
  }

  await expect(card).toBeVisible();

  return card;
};

const ARTICLE_DETAIL_ROUTE = `${ARTICLES_URL}/:fqn`;

export const navigateToArticle = async (page: Page, articleFqn: string) => {
  const getArticleResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/api/v1/contextCenter/pages/name/${articleFqn}`) &&
      response.status() === 200
  );

  const articlePath = ARTICLE_DETAIL_ROUTE.replace(':fqn', articleFqn);
  await page.goto(articlePath);
  await getArticleResponse;
  await waitForAllLoadersToDisappear(page);
};
