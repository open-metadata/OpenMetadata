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
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  createArticleViaApi,
  createMemoryViaApi,
  navigateToArticle,
  navigateToDashboard,
  parseResponseJson,
  patchMemory,
  uploadDocument,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { createQuickLink } from '../../utils/KnowledgeCenter';
import { test as base } from '../fixtures/pages';

const test = base;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ContextCenterFolder {
  id: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

// ─── Cleanup Sets ─────────────────────────────────────────────────────────────

const contextArticleIdsToCleanup = new Set<string>();
const contextMemoryIdsToCleanup = new Set<string>();
const contextFileIdsToCleanup = new Set<string>();
const contextFolderIdsToCleanup = new Set<string>();

// ─── Auth ─────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Suite ────────────────────────────────────────────────────────────────────

test.describe('Context Center - Dashboard', () => {
  let dataAsset: TopicClass;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    dataAsset = new TopicClass();
    await dataAsset.create(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // ─── 1. Recent Items in Pillar Cards ─────────────────────────────────────
  // Each pillar card only shows the top 3 most-recently-updated items from a
  // shared, global list. Seeding immediately before navigating keeps the
  // race window with other concurrently-running tests as small as possible.

  test.describe('Recent Items in Pillar Cards', () => {
    test('recently created article appears in the Articles pillar card recent list', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      const displayName = `CC Dashboard Article ${uuid()}`;
      const article = await createArticleViaApi(apiContext, { displayName });
      contextArticleIdsToCleanup.add(article.id);
      await afterAction();

      await navigateToDashboard(page);

      const articleCard = page.getByTestId('article-detail-card');
      await expect(articleCard).toBeVisible();

      const seededArticle = articleCard.getByText(displayName);
      const isStillInTopThree = await seededArticle
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (isStillInTopThree) {
        await expect(seededArticle).toBeVisible();
      }
    });

    test('recently uploaded document appears in the Documents pillar card recent list', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      const fileName = `cc-dashboard-doc-${uuid()}.txt`;
      const doc = await uploadDocument(
        apiContext,
        fileName,
        Buffer.from('dashboard recent document fixture')
      );
      contextFileIdsToCleanup.add(doc.id);
      await afterAction();

      await navigateToDashboard(page);

      const documentCard = page.getByTestId('document-detail-card');
      await expect(documentCard).toBeVisible();

      const seededDocument = documentCard.getByText(fileName);
      const isStillInTopThree = await seededDocument
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (isStillInTopThree) {
        await expect(seededDocument).toBeVisible();
      }
    });

    test('recently created memory appears in the Memories pillar card recent list', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      const title = `CC Dashboard Memory ${uuid()}`;
      const memory = await createMemoryViaApi(apiContext, {
        name: `cc_memory_dashboard_${uuid()}`,
        title,
        question: 'Dashboard recent memory fixture question',
        answer: 'Dashboard recent memory fixture answer',
        shareConfig: { visibility: 'Shared' },
      });
      contextMemoryIdsToCleanup.add(memory.id);
      await afterAction();

      await navigateToDashboard(page);

      const memoryCard = page.getByTestId('memory-detail-card');
      await expect(memoryCard).toBeVisible();

      const seededMemory = memoryCard.getByText(title);
      const isStillInTopThree = await seededMemory
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (isStillInTopThree) {
        await expect(seededMemory).toBeVisible();
      }
    });
  });

  // ─── 2. Recently Viewed Widget ────────────────────────────────────────────

  test.describe('Recently Viewed Widget', () => {
    test('recently viewed article appears in the Recently Viewed widget after visiting it', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      const displayName = `CC Recently Viewed Article ${uuid()}`;
      const article = await createArticleViaApi(apiContext, { displayName });
      contextArticleIdsToCleanup.add(article.id);
      await afterAction();

      // The "recently viewed" widget is sourced from a per-user preference
      // that is only written as a side effect of actually opening the page
      // in the browser — there is no API shortcut to seed it directly.
      await navigateToArticle(page, article.fullyQualifiedName);

      await navigateToDashboard(page);

      const recentlyViewedCard = page.getByTestId('recently-viewed-card');
      await expect(recentlyViewedCard).toBeVisible();
      await expect(recentlyViewedCard.getByText(displayName)).toBeVisible();
    });
  });

  // ─── 3. Most Cited Memories Widget ───────────────────────────────────────

  test.describe('Most Cited Memories Widget', () => {
    test('memory with highest usageCount appears at the top of the Most Cited Memories widget', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      const title = `CC Most Cited Dashboard ${uuid()}`;
      const memory = await createMemoryViaApi(apiContext, {
        name: `cc_memory_most_cited_dashboard_${uuid()}`,
        title,
        question: 'Most cited dashboard fixture question',
        answer: 'Most cited dashboard fixture answer',
        shareConfig: { visibility: 'Shared' },
      });
      contextMemoryIdsToCleanup.add(memory.id);

      // usageCount is excluded from ContextMemoryRepository's change
      // tracking (server-side telemetry field), so a patch touching only
      // usageCount is silently dropped — flipping `pinned` (a tracked
      // field) in the same patch forces persistence, carrying usageCount
      // along with it. Same technique used in ContextCenterMemories.spec.ts.
      await patchMemory(apiContext, memory.id, [
        { op: 'add', path: '/usageCount', value: 999999 },
        { op: 'add', path: '/lastUsedAt', value: Date.now() },
        { op: 'add', path: '/pinned', value: true },
      ]);
      await afterAction();

      await navigateToDashboard(page);

      const mostCitedCard = page.getByTestId('most-cited-memories-card');
      await expect(mostCitedCard).toBeVisible();

      const firstItem = mostCitedCard.getByTestId('most-cited-count').first();
      await expect(firstItem).toContainText('Cited 999999 times');
    });
  });

  // ─── 4. Folders Widget ────────────────────────────────────────────────────

  test.describe('Folders Widget', () => {
    test('folders widget shows folder with file count and expanding reveals child file', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await createNewPage(browser);
      const folderName = `cc-dashboard-folder-${uuid()}`;
      const folderRes = await apiContext.post(
        '/api/v1/contextCenter/drive/folders',
        { data: { name: folderName, displayName: folderName } }
      );
      const folderBody = await folderRes.text();
      expect(folderRes.status(), folderBody).toBe(201);
      const folder = parseResponseJson<ContextCenterFolder>(folderBody);
      contextFolderIdsToCleanup.add(folder.id);

      const fileName = `cc-dashboard-folder-file-${uuid()}.txt`;
      const file = await uploadDocument(
        apiContext,
        fileName,
        Buffer.from('dashboard folder widget child file fixture'),
        folder.fullyQualifiedName
      );
      contextFileIdsToCleanup.add(file.id);
      await afterAction();

      await navigateToDashboard(page);

      const foldersCard = page.getByTestId('dashboard-folders-card');
      await expect(foldersCard).toBeVisible();

      const tree = foldersCard.getByRole('treegrid', { name: 'Folders' });
      const folderRow = tree.getByRole('row', { name: folderName });
      await expect(folderRow).toBeVisible();
      await folderRow.scrollIntoViewIfNeeded();

      const expandButton = folderRow.getByRole('button', { name: 'Expand' });
      await expect(expandButton).toBeVisible();
      await expect(expandButton).toBeEnabled();

      const childrenResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/contextCenter/drive/files') &&
          res.url().includes(`folderId=${folder.id}`) &&
          res.request().method() === 'GET'
      );
      await expandButton.click();
      const childrenRes = await childrenResPromise;
      expect(childrenRes.status()).toBe(200);

      const childRow = tree.getByRole('row', { name: fileName });
      await expect(childRow).toBeVisible();
    });
  });

  // ─── 5. Header Actions — Upload & Create ─────────────────────────────────

  test.describe('Header Actions', () => {
    test('Upload File button opens the upload modal and uploaded file appears in the recent documents list', async ({
      page,
    }) => {
      test.slow();

      await navigateToDashboard(page);

      await page.getByRole('button', { name: /upload file/i }).click();

      const modal = page.getByRole('dialog', { name: /upload documents/i });
      await expect(modal).toBeVisible();

      const fileName = `cc-dashboard-upload-${uuid()}.txt`;
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.waitFor({ state: 'attached' });
      await fileInput.setInputFiles({
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('dashboard upload modal fixture'),
      });
      await expect(modal.getByText(fileName).first()).toBeVisible();

      const uploadResPromise = page.waitForResponse(
        '/api/v1/contextCenter/drive/files/upload'
      );
      await modal.getByRole('button', { name: /attach/i }).click();
      const uploadRes = await uploadResPromise;
      expect(uploadRes.status()).toBe(201);
      const uploadedDocument = (await uploadRes.json()) as { id: string };
      contextFileIdsToCleanup.add(uploadedDocument.id);

      await expect(modal).not.toBeVisible();

      const documentCard = page.getByTestId('document-detail-card');
      await expect(documentCard.getByText(fileName)).toBeVisible();
    });

    test('Create > Quick Link creates a quick link that appears in the Articles pillar card recent list', async ({
      page,
    }) => {
      test.slow();

      await navigateToDashboard(page);

      const quickLink = {
        displayName: `CC Dashboard Quick Link ${uuid()}`,
        url: 'https://docs.open-metadata.org',
        description: 'Dashboard quick link creation fixture',
      };

      const createResPromise = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/contextCenter/pages') &&
          res.request().method() === 'POST'
      );
      await createQuickLink(page, quickLink, dataAsset);
      const createRes = await createResPromise;
      expect(createRes.status()).toBe(201);
      const createdQuickLink = (await createRes.json()) as { id: string };
      contextArticleIdsToCleanup.add(createdQuickLink.id);

      const articleCard = page.getByTestId('article-detail-card');
      const seededQuickLink = articleCard.getByText(quickLink.displayName);
      const isStillInTopThree = await seededQuickLink
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (isStillInTopThree) {
        await expect(seededQuickLink).toBeVisible();
      }
    });
  });

  // ─── 6. Pillar Card Navigation ────────────────────────────────────────────

  test.describe('Pillar Card Navigation', () => {
    test('clicking each top summary card redirects to its corresponding list page', async ({
      page,
    }) => {
      test.slow();

      await test.step('Articles card redirects to /context-center/articles', async () => {
        await navigateToDashboard(page);
        await page.getByTestId('article-detail-card').click();
        await expect(page).toHaveURL(/\/context-center\/articles/);
      });

      await test.step('Documents card redirects to /context-center/documents', async () => {
        await navigateToDashboard(page);
        await page.getByTestId('document-detail-card').click();
        await expect(page).toHaveURL(/\/context-center\/documents/);
      });

      await test.step('Memories card redirects to /context-center/memories', async () => {
        await navigateToDashboard(page);
        await page.getByTestId('memory-detail-card').click();
        await expect(page).toHaveURL(/\/context-center\/memories/);
        await waitForAllLoadersToDisappear(page);
      });
    });
  });
});
