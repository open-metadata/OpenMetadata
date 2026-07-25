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
import { SLASH_COMMANDS } from '../constant/KnowledgeCenter.constant';
import { PolicyRulesType } from '../support/access-control/PoliciesClass';
import { KnowledgeCenterResponseDataType } from '../support/entity/KnowledgeCenter.interface';
import { UserClass } from '../support/user/UserClass';
import { createNewPage, uuid } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { executeSlashCommand } from './KnowledgeCenter';

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

/**
 * The sidebar folder tree is paginated (FOLDER_PAGE_SIZE), so a folder
 * created earlier in a test/suite run may not be on the currently loaded
 * page. Callers that need to interact with a folder row (expand it, hover
 * it, etc.) should go through this instead of `getFolderTreeItem` directly,
 * which only returns a locator without ensuring the row has been paginated
 * into view. Tests asserting a folder is NOT yet present (e.g. before a
 * scroll) should keep using `getFolderTreeItem` + `toHaveCount(0)` directly.
 */
export const revealFolderRow = async (
  page: Page,
  folderName: string
): Promise<Locator> => {
  const target = getFolderTreeItem(page, folderName);
  if (!(await target.isVisible())) {
    const tree = page.getByRole('treegrid', { name: 'Folders' });
    await scrollUntilResponse(
      page,
      tree,
      target,
      (res) =>
        res.url().includes('/api/v1/contextCenter/drive/folders') &&
        res.url().includes('after=') &&
        res.request().method() === 'GET'
    );
  }

  return target;
};

export const getDocumentSearchInput = (page: Page): Locator =>
  page.getByTestId('search-input').getByLabel('Search Documents');

/**
 * Searches for a document by name and returns its row locator.
 * The document list is paginated, so a document created earlier in the
 * suite may not be on the currently loaded page — searching re-queries
 * page 1 and guarantees the row is present if it matches.
 */
export const searchAndGetDocumentRow = async (
  page: Page,
  fileName: string
): Promise<Locator> => {
  const searchResPromise = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/search/query') &&
      res.url().includes('index=contextFile') &&
      res.request().method() === 'GET'
  );
  await getDocumentSearchInput(page).fill(fileName);
  await searchResPromise;
  await waitForAllLoadersToDisappear(page);

  return page
    .getByTestId('documents-view')
    .locator('[data-testid^="document-row-"]')
    .filter({ hasText: fileName });
};

export const selectFolderInSidebar = async (
  page: Page,
  folderName: string
): Promise<void> => {
  const target = await revealFolderRow(page, folderName);
  await target.click();
  await waitForAllLoadersToDisappear(page);
};

export const openUploadModal = async (page: Page): Promise<void> => {
  await page
    .getByTestId('header-shell')
    .getByRole('button', { name: /upload file/i })
    .click();
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
  await docRow.getByTestId('manage-button').click();
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

export async function waitForDocumentInFileList(
  apiContext: APIRequestContext,
  documentId: string,
  timeout = 60_000,
  interval = 2_000
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const response = await apiContext.get('/api/v1/contextCenter/drive/files', {
      params: { orderBy: 'DESC', limit: 100 },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Unexpected response while polling the file list for document ${documentId}: ${response.status()} ${body}`
      );
    }

    const { data } = await response.json();
    if (
      (data as Array<{ id: string }>).some((file) => file.id === documentId)
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Document ${documentId} did not appear in the file list after ${timeout}ms`
  );
}

const NON_TERMINAL_PROCESSING_STATUSES = new Set([
  'Uploaded',
  'Analyzing',
  'ExtractingContext',
]);

export async function waitForDocumentProcessingComplete(
  apiContext: APIRequestContext,
  documentId: string,
  timeout = 90_000,
  interval = 2_000
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(
      `/api/v1/contextCenter/drive/files/${documentId}`
    );

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Unexpected response while polling processing status for document ${documentId}: ${response.status()} ${body}`
      );
    }

    const data = await response.json();
    if (!NON_TERMINAL_PROCESSING_STATUSES.has(data.processingStatus)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

export const createDisposableArchivedDocument = async (
  apiContext: APIRequestContext,
  namePrefix = 'cc-disposable-archived-doc'
): Promise<{ id: string; name: string }> => {
  const { id, name } = await uploadDisposableDocument(apiContext, namePrefix);
  await waitForDocumentInFileList(apiContext, id);
  await waitForDocumentProcessingComplete(apiContext, id);
  await apiContext.delete(
    `/api/v1/contextCenter/drive/files/${id}?hardDelete=false`
  );

  return { id, name };
};

export async function waitForDocumentPermanentlyDeleted(
  apiContext: APIRequestContext,
  documentId: string,
  timeout = 60_000,
  interval = 2_000
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(
      `/api/v1/contextCenter/drive/files/${documentId}?include=all`
    );

    if (response.status() === 404) {
      return;
    }

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Unexpected response while polling for permanent deletion of document ${documentId}: ${response.status()} ${body}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Document ${documentId} was still present in the archive API after ${timeout}ms`
  );
}

interface WaitForDocumentInArchiveOptions {
  updatedBy?: string;
  timeout?: number;
  interval?: number;
  limit?: number;
}

export async function waitForDocumentInArchive(
  apiContext: APIRequestContext,
  documentId: string,
  {
    updatedBy,
    timeout = 60_000,
    interval = 2_000,
    limit = 100,
  }: WaitForDocumentInArchiveOptions = {}
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const response = await apiContext.get('/api/v1/contextCenter/drive/files', {
      params: {
        include: 'deleted',
        orderBy: 'DESC',
        limit,
        ...(updatedBy ? { updatedBy } : {}),
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Unexpected response while polling the archive list for document ${documentId}: ${response.status()} ${body}`
      );
    }

    const { data } = await response.json();
    if (
      (data as Array<{ id: string }>).some((file) => file.id === documentId)
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Document ${documentId} did not appear in the archive list (limit=${limit}) after ${timeout}ms`
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

/**
 * Both the knowledge-pages hierarchy and the article listing sit inside two
 * nested scrollable ancestors (.center-panel with overflow-y: scroll, and an
 * inner Box with overflow-auto that actually grows with content). A synthetic
 * `page.mouse.wheel` on the listing/hierarchy locator is ambiguous about which
 * ancestor consumes the delta, and once the outer one's small scroll range is
 * exhausted the inner container stops receiving scroll input — so infinite
 * scroll silently stalls partway through the list. Scrolling the real
 * scrollable ancestor's scrollTop directly removes that ambiguity.
 */
const scrollNearestScrollableAncestor = async (locator: Locator) => {
  await locator.evaluate((element) => {
    let current: HTMLElement | null = element as HTMLElement;
    while (current && current.scrollHeight <= current.clientHeight) {
      current = current.parentElement;
    }
    current?.scrollBy({ top: 3000 });
  });
};

/**
 * Scrolls the nearest scrollable ancestor of `containerLocator` until
 * `targetLocator` becomes visible, waiting on `responseMatcher` after each
 * scroll to give the pagination fetch a render+network tick to land. Mirrors
 * `scrollHierarchyToNode`'s stale-tolerant retry loop so callers don't have
 * to hand-roll scroll-then-waitForResponse races for every dropdown/list.
 */
export const scrollUntilResponse = async (
  page: Page,
  containerLocator: Locator,
  targetLocator: Locator,
  responseMatcher: (response: Response) => boolean,
  maxAttempts = 10
) => {
  for (
    let attempt = 0;
    attempt < maxAttempts && !(await targetLocator.isVisible());
    attempt++
  ) {
    const responsePromise = page
      .waitForResponse(responseMatcher, { timeout: 5000 })
      .catch(() => null);
    await scrollNearestScrollableAncestor(containerLocator);
    await responsePromise;
  }

  await expect(targetLocator).toBeVisible();
};

export const scrollHierarchyToNode = async (
  page: Page,
  displayName: string
) => {
  const hierarchy = page.getByTestId('knowledge-pages-hierarchy');
  const node = hierarchy.getByTestId(`page-node-${displayName}`);

  await hierarchy.waitFor({ state: 'visible' });

  const getLastNode = () =>
    hierarchy
      .locator('[data-testid^="page-node-"]')
      .last()
      .getAttribute('data-testid');

  let previousLastNode = '';
  // Require 3 consecutive unchanged readings before concluding end-of-list.
  // A single unchanged reading can be a false positive when the scroll lands
  // just before the next infinite-scroll fetch threshold.
  let staleCount = 0;

  for (let attempt = 0; attempt < 100 && !(await node.isVisible()); attempt++) {
    await scrollNearestScrollableAncestor(hierarchy);
    await expect(
      hierarchy.locator('[data-testid^="page-node-"]').first()
    ).toBeVisible();

    let lastNode = await getLastNode();

    if (lastNode === previousLastNode) {
      // The last node may look unchanged because the scroll has only just
      // flipped the observer element into view — the component still needs
      // a render tick before its effect fires and issues the pagination
      // fetch. Register the response wait now (not before the scroll) so
      // its timeout window covers that render+effect+network latency
      // instead of racing against it.
      await page
        .waitForResponse((res) => res.url().includes('/hierarchy'), {
          timeout: 5000,
        })
        .catch(() => null);

      lastNode = await getLastNode();

      if (lastNode === previousLastNode) {
        staleCount += 1;
        await page.waitForTimeout(1000);
        if (staleCount >= 5) {
          break;
        }
      } else {
        staleCount = 0;
      }
    } else {
      staleCount = 0;
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

  const getLastCard = () =>
    listing
      .locator('[data-testid^="knowledge-card-"]')
      .last()
      .getAttribute('data-testid');

  let previousLastCard = '';
  // Require 3 consecutive unchanged readings before concluding end-of-list.
  // A single unchanged reading can be a false positive when the scroll lands
  // just before the next infinite-scroll fetch threshold.
  let staleCount = 0;

  for (let attempt = 0; attempt < 50 && !(await card.isVisible()); attempt++) {
    await scrollNearestScrollableAncestor(listing);
    await expect(
      listing.locator('[data-testid^="knowledge-card-"]').first()
    ).toBeVisible();

    let lastCard = await getLastCard();

    if (lastCard === previousLastCard) {
      // The last card may look unchanged because the scroll has only just
      // flipped the observer element into view — the component still needs
      // a render tick before its effect fires and issues the pagination
      // fetch. Register the response wait now (not before the scroll) so
      // its timeout window covers that render+effect+network latency
      // instead of racing against it.
      await page
        .waitForResponse(
          (res) => res.url().includes('/api/v1/contextCenter/pages'),
          { timeout: 5000 }
        )
        .catch(() => null);

      lastCard = await getLastCard();

      if (lastCard === previousLastCard) {
        staleCount += 1;
        await page.waitForTimeout(1000);
        if (staleCount >= 5) {
          break;
        }
      } else {
        staleCount = 0;
      }
    } else {
      staleCount = 0;
    }

    previousLastCard = lastCard ?? '';
  }

  await expect(card).toBeVisible();

  return card;
};

const ARTICLE_DETAIL_ROUTE = `${ARTICLES_URL}/:fqn`;

/**
 * The right-panel BookMarkWidget fetches GET /users/{id}?fields=follows once
 * on mount and renders whatever that single response contains — it never
 * refetches while the /articles page is open. So if the follow relationship
 * hasn't propagated to that endpoint yet, waiting on the DOM afterwards can't
 * help: the widget has already rendered its (stale) final state. Poll the API
 * directly until the article shows up in `follows`, then navigate — by the
 * time the widget mounts and fetches, the relationship is guaranteed present.
 */
export const waitForArticleInFollows = async (
  apiContext: APIRequestContext,
  userId: string,
  articleId: string,
  timeout = 30_000,
  interval = 1_000
) => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(`/api/v1/users/${userId}`, {
      params: { fields: 'follows' },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Unexpected response while polling follows for user ${userId}: ${response.status()} ${body}`
      );
    }

    const { follows } = await response.json();
    if (
      (follows as Array<{ id: string }> | undefined)?.some(
        (reference) => reference.id === articleId
      )
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Article ${articleId} did not appear in user ${userId}'s follows after ${timeout}ms`
  );
};

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

/** Returns the first table asset from ES, or undefined if none exist. */
export const fetchFirstTable = async (page: Page) => {
  const res = await page.request.get(
    '/api/v1/search/query?q=*&index=table_search_index&from=0&size=1'
  );
  if (!res.ok()) {
    return undefined;
  }
  const data = await res.json();

  return data.hits?.hits?.[0]?._source;
};

export const patchMemory = async (
  apiContext: APIRequestContext,
  id: string,
  patch: Record<string, unknown>[]
) => {
  const res = await apiContext.patch(`${MEMORIES_API}/${id}`, {
    data: patch,
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
  expect(res.ok()).toBeTruthy();

  return res.json();
};

export interface LoggedInUser {
  id: string;
  name: string;
  displayName: string;
}

/** Identifies the currently authenticated user via their own session. */
export const getLoggedInUser = async (
  apiContext: APIRequestContext
): Promise<LoggedInUser> => {
  const res = await apiContext.get('/api/v1/users/loggedInUser');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();

  return {
    id: data.id,
    name: data.name,
    displayName: data.displayName ?? data.name,
  };
};

export const createMemoryViaApi = async (
  apiContext: APIRequestContext,
  overrides: Record<string, unknown>
) => {
  const res = await apiContext.post(MEMORIES_API, { data: overrides });
  expect(res.status()).toBe(201);

  return res.json();
};

/**
 * Searches for a memory by a unique query string and returns its row locator.
 * The list is paginated, so a memory created earlier in the suite may not be
 * on the currently loaded page — searching re-queries page 1 and guarantees
 * the row is present if it matches.
 */
export const searchAndGetMemoryRow = async (
  page: Page,
  query: string,
  memoryId: string
) => {
  const searchResPromise = page.waitForResponse((res) => {
    const url = new URL(res.url());

    return (
      url.pathname === MEMORIES_API &&
      url.searchParams.get('q') === query &&
      res.request().method() === 'GET'
    );
  });
  await page.getByTestId('search-input').locator('input').fill(query);
  await searchResPromise;
  await waitForAllLoadersToDisappear(page);

  return page.getByTestId(`memory-row-${memoryId}`);
};
export const readDraftStore = async (
  page: Page
): Promise<Record<string, unknown>> => {
  const raw = await page.evaluate(
    (key: string) => localStorage.getItem(key),
    'om-article-drafts'
  );

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as {
      state?: { drafts?: Record<string, unknown> };
    };

    return (parsed?.state?.drafts as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
};

/**
 * A minimal valid 1x1 transparent PNG, used as an in-memory upload fixture
 * since this repo has no binary image fixtures under playwright/test-data/.
 */
const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export const insertImageViaUpload = async (
  page: Page,
  fileName: string
): Promise<void> => {
  await executeSlashCommand(page, SLASH_COMMANDS.image);
  await page.getByTestId('add-image-container').click();
  await page.getByRole('tab', { name: 'Upload' }).click();

  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/attachments/upload') &&
      response.request().method() === 'POST'
  );

  await page.getByTestId('upload-file-input').setInputFiles({
    name: fileName,
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'),
  });

  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(201);
};

export const insertImageViaUrl = async (
  page: Page,
  url: string
): Promise<void> => {
  await executeSlashCommand(page, SLASH_COMMANDS.image);
  await page.getByTestId('add-image-container').last().click();
  const embedForm = page.getByTestId('embed-link-form');
  await expect(embedForm).toBeVisible();
  await embedForm.getByTestId('embed-input').fill(url);
  await embedForm.getByRole('button', { name: /embed/i }).click();

  await expect(embedForm).not.toBeVisible();
};
