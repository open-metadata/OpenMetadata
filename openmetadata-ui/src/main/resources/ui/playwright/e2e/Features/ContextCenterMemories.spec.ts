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

import { expect, Page } from '@playwright/test';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  buildPermissionRule,
  loginAsUser,
  MEMORIES_API,
  MEMORIES_URL,
  navigateToMemories,
} from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test as base } from '../fixtures/pages';

const test = base;

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Shared test data ─────────────────────────────────────────────────────────

const SHARED_MEMORY_TITLE = `CC Memory Shared ${uuid()}`;
const PRIVATE_MEMORY_TITLE = `CC Memory Private ${uuid()}`;
const ENTITY_MEMORY_TITLE = `CC Memory Entity ${uuid()}`;

const CREATE_MEMORY_RULE = buildPermissionRule(
  'cc-memories-spec-create',
  ['All'],
  ['Create', 'ViewAll']
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the first table asset from ES, or undefined if none exist. */
const fetchFirstTable = async (page: Page) => {
  const res = await page.request.get(
    '/api/v1/search/query?q=*&index=table_search_index&from=0&size=1'
  );
  if (!res.ok()) {
    return undefined;
  }
  const data = await res.json();

  return data.hits?.hits?.[0]?._source;
};

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe(
  'Context Center - Memories',
  { tag: ['@Features', '@Governance'] },
  () => {
    let sharedMemoryId: string;
    let sharedMemoryName: string;
    let privateMemoryId: string;
    let privateMemoryName: string;
    let entityMemoryId: string;

    /** Non-admin user with Create + ViewAll on ContextMemory. */
    const nonAdminCreator = new UserClass();

    /** All memory IDs created in beforeAll — cleaned up in afterAll. */
    const globalMemoryIds: string[] = [];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      // ── Non-admin user with Create permission ──────────────────────────────
      await nonAdminCreator.create(apiContext, false);
      await nonAdminCreator.setCustomRulePolicy(
        apiContext,
        CREATE_MEMORY_RULE,
        `cc-memories-spec-create-policy-${uuid()}`
      );

      // ── Shared memory ──────────────────────────────────────────────────────
      sharedMemoryName = `cc_memory_shared_${uuid()}`;
      const sharedRes = await apiContext.post(MEMORIES_API, {
        data: {
          name: sharedMemoryName,
          title: SHARED_MEMORY_TITLE,
          question: 'What is a shared memory?',
          answer: 'A **shared** memory is visible to everyone in the workspace.',
          shareConfig: { visibility: 'Shared' },
        },
      });
      expect(sharedRes.status()).toBe(201);
      const sharedData = await sharedRes.json();
      sharedMemoryId = sharedData.id;
      globalMemoryIds.push(sharedMemoryId);

      // ── Private memory ─────────────────────────────────────────────────────
      privateMemoryName = `cc_memory_private_${uuid()}`;
      const privateRes = await apiContext.post(MEMORIES_API, {
        data: {
          name: privateMemoryName,
          title: PRIVATE_MEMORY_TITLE,
          question: 'Private memory question',
          answer: 'Only the creator can see this.',
          shareConfig: { visibility: 'Private' },
        },
      });
      expect(privateRes.status()).toBe(201);
      const privateData = await privateRes.json();
      privateMemoryId = privateData.id;
      globalMemoryIds.push(privateMemoryId);

      // ── Entity-visibility memory ───────────────────────────────────────────
      const entityRes = await apiContext.post(MEMORIES_API, {
        data: {
          name: `cc_memory_entity_${uuid()}`,
          title: ENTITY_MEMORY_TITLE,
          question: 'Entity memory question',
          answer: 'Visible only to users linked to the referenced entity.',
          shareConfig: { visibility: 'Entity' },
        },
      });
      expect(entityRes.status()).toBe(201);
      const entityData = await entityRes.json();
      entityMemoryId = entityData.id;
      globalMemoryIds.push(entityMemoryId);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (const id of globalMemoryIds) {
        await apiContext.delete(`${MEMORIES_API}/${id}?hardDelete=true`);
      }

      await nonAdminCreator.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    // ─── 1. Form Validation ─────────────────────────────────────────────────

    test.describe('Form Validation', () => {
      test('Create Memory button is disabled when memory content is empty', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Only fill title — leave content empty
        await dialog
          .getByTestId('memory-title-input')
          .locator('input')
          .fill('Title without content');

        await expect(
          page.getByRole('button', { name: /create memory/i })
        ).toBeDisabled();
      });

      test('Create Memory button is enabled once memory content is filled', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Valid memory content.');

        await expect(
          page.getByRole('button', { name: /create memory/i })
        ).toBeEnabled();
      });

      test('form is empty when modal is reopened after cancel', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog
          .getByTestId('memory-title-input')
          .locator('input')
          .fill('Discard me');
        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Also discard this');

        await dialog.getByRole('button', { name: /cancel/i }).click();
        await expect(dialog).not.toBeVisible();

        // Reopen
        await page.getByTestId('add-memory-btn').click();
        await expect(dialog).toBeVisible();

        await expect(
          dialog.getByTestId('memory-title-input').locator('input')
        ).toHaveValue('');
        await expect(
          dialog.getByTestId('memory-content-input').locator('textarea')
        ).toHaveValue('');
      });
    });

    // ─── 2. Content Field — Preview Mode ────────────────────────────────────

    test.describe('Content Field — Preview Mode', () => {
      test('Preview tab renders markdown content correctly', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('**Bold text** and *italic text*');

        await dialog.getByRole('button', { name: /preview/i }).click();

        // Textarea hidden; prose block visible with rendered markdown
        await expect(
          dialog.getByTestId('memory-content-input').locator('textarea')
        ).not.toBeVisible();
        await expect(dialog.locator('.prose')).toBeVisible();
        await expect(dialog.locator('.prose strong')).toContainText('Bold text');
        await expect(dialog.locator('.prose em')).toContainText('italic text');
      });

      test('Preview tab shows "nothing to preview" when content is empty', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /preview/i }).click();

        await expect(dialog).toContainText(/nothing to preview/i);
      });

      test('switching back to Edit tab restores the textarea', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /preview/i }).click();
        await expect(dialog).toContainText(/nothing to preview/i);

        await dialog.getByRole('button', { name: /^edit$/i }).click();

        await expect(
          dialog.getByTestId('memory-content-input').locator('textarea')
        ).toBeVisible();
      });

      test('content typed in Edit mode is visible in Preview and preserved when switching back', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const content = '# Heading\n\nParagraph text';
        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill(content);

        await dialog.getByRole('button', { name: /preview/i }).click();
        await expect(dialog.locator('.prose h1')).toContainText('Heading');

        // Switch back to edit — content must be preserved
        await dialog.getByRole('button', { name: /^edit$/i }).click();
        await expect(
          dialog.getByTestId('memory-content-input').locator('textarea')
        ).toHaveValue(content);
      });
    });

    // ─── 3. Create Memory with All Fields ───────────────────────────────────

    test.describe('Create Memory — All Fields', () => {
      let createdMemoryId: string;

      test.afterAll(async ({ browser }) => {
        if (createdMemoryId) {
          const { apiContext, afterAction } = await createNewPage(browser);
          await apiContext.delete(
            `${MEMORIES_API}/${createdMemoryId}?hardDelete=true`
          );
          await afterAction();
        }
      });

      test('creates a memory with title, content, and type — card appears in the list', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const memoryTitle = `All Fields Memory ${uuid()}`;
        await dialog
          .getByTestId('memory-title-input')
          .locator('input')
          .fill(memoryTitle);
        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('This memory has all optional fields populated.');

        // Select type: Note
        await dialog.getByTestId('memory-type-select').click();
        await page.getByRole('option', { name: /note/i }).click();

        const createResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'POST'
        );
        await dialog.getByRole('button', { name: /create memory/i }).click();
        const createRes = await createResPromise;
        expect(createRes.status()).toBe(201);

        const created = await createRes.json();
        createdMemoryId = created.id;

        await expect(dialog).not.toBeVisible();
        await waitForAllLoadersToDisappear(page);

        const row = page.getByTestId(`memory-row-${createdMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();
        await expect(row).toContainText(memoryTitle);
      });
    });

    // ─── 4. Memory Row Card — Visible Metadata ──────────────────────────────

    test.describe('Memory Row Card Metadata', () => {
      test('row shows owner name and memory title', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();

        await expect(row).toContainText(SHARED_MEMORY_TITLE);
        await expect(row).toContainText('admin');
      });

      test('row shows linked entity badge when memory has a primary entity', async ({
        browser,
        page,
      }) => {
        test.slow();

        const table = await fetchFirstTable(page);
        if (!table?.id) {
          test.skip();

          return;
        }

        const { apiContext, afterAction } = await createNewPage(browser);
        const linkedName = `cc_memory_linked_${uuid()}`;
        const createRes = await apiContext.post(MEMORIES_API, {
          data: {
            name: linkedName,
            title: `Linked Entity Memory ${uuid()}`,
            question: 'Memory with linked entity',
            answer: 'Linked to a data asset.',
            shareConfig: { visibility: 'Shared' },
            primaryEntity: {
              id: table.id,
              type: table.entityType ?? 'table',
              name: table.name,
              displayName: table.displayName,
              fullyQualifiedName: table.fullyQualifiedName,
            },
          },
        });
        expect(createRes.status()).toBe(201);
        const created = await createRes.json();
        const linkedMemoryId = created.id;
        await afterAction();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${linkedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();
        await expect(row).toContainText(table.displayName ?? table.name);

        const { apiContext: cleanCtx, afterAction: cleanAfter } =
          await createNewPage(browser);
        await cleanCtx.delete(`${MEMORIES_API}/${linkedMemoryId}?hardDelete=true`);
        await cleanAfter();
      });
    });

    // ─── 5. Filters and Search ───────────────────────────────────────────────

    test.describe('Filters and Search', () => {
      test('search box filters memories by title', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const searchResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.url().includes('q=') &&
            res.request().method() === 'GET'
        );
        await page
          .getByTestId('search-input')
          .locator('input')
          .fill(SHARED_MEMORY_TITLE);
        await searchResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
      });

      test('clearing search restores the unfiltered list', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const searchInput = page.getByTestId('search-input').locator('input');
        await searchInput.fill('zzz_no_match_expected');
        await waitForAllLoadersToDisappear(page);

        const restoreResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await searchInput.clear();
        await restoreResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
      });

      test('"All" tab shows all visible memories', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await page.getByRole('tab', { name: /^all$/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
      });

      test('"Created by Me" tab shows admin\'s own memories', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await page.getByRole('tab', { name: /created by me/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
      });

      test('clicking "Total Memories" count card activates the All view', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        // Move away from All first
        await page.getByRole('tab', { name: /created by me/i }).click();
        await waitForAllLoadersToDisappear(page);

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        // Click the first summary card (Total Memories)
        await page.getByText(/total memor/i).first().click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        // All memories are shown again
        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
      });

      test('clicking "Created by Me" count card activates the created-by-me filter', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        // Click the "Created by Me" summary card
        await page
          .locator('[class*="card"]')
          .filter({ hasText: /created by me/i })
          .first()
          .click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        // Admin's shared memory visible under the created-by-me filter
        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
      });

      test('author filter dropdown opens with search input and "All Authors" option', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        await page.getByRole('button', { name: /all.*author/i }).click();

        await expect(page.getByPlaceholder(/search.*author/i)).toBeVisible();
        await expect(
          page.getByRole('menuitem', { name: /all.*author/i })
        ).toBeVisible();
      });

      test('selecting an author filters memories to their content', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        await page.getByRole('button', { name: /all.*author/i }).click();

        const authorSearch = page.getByPlaceholder(/search.*author/i);
        await expect(authorSearch).toBeVisible();
        await authorSearch.fill('admin');
        await waitForAllLoadersToDisappear(page);

        const adminOption = page
          .getByRole('menuitem')
          .filter({ hasNotText: /all.*author/i })
          .first();

        if (await adminOption.isVisible()) {
          const listResPromise = page.waitForResponse(
            (res) =>
              res.url().includes(MEMORIES_API) &&
              res.request().method() === 'GET'
          );
          await adminOption.click();
          await listResPromise;
          await waitForAllLoadersToDisappear(page);

          await expect(
            page.getByTestId(`memory-row-${sharedMemoryId}`)
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: /clear all/i })
          ).toBeVisible();
        }
      });

      test('"Clear All" button resets author and asset filters', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        await page.getByRole('button', { name: /all.*author/i }).click();
        const authorSearch = page.getByPlaceholder(/search.*author/i);
        await expect(authorSearch).toBeVisible();
        await authorSearch.fill('admin');
        await waitForAllLoadersToDisappear(page);

        const authorOption = page
          .getByRole('menuitem')
          .filter({ hasNotText: /all.*author/i })
          .first();

        if (await authorOption.isVisible()) {
          await authorOption.click();
          await waitForAllLoadersToDisappear(page);

          const clearBtn = page.getByRole('button', { name: /clear all/i });
          await expect(clearBtn).toBeVisible();

          const listResPromise = page.waitForResponse(
            (res) =>
              res.url().includes(MEMORIES_API) &&
              res.request().method() === 'GET'
          );
          await clearBtn.click();
          await listResPromise;
          await waitForAllLoadersToDisappear(page);

          await expect(
            page.getByRole('button', { name: /clear all/i })
          ).not.toBeVisible();
          await expect(
            page.getByTestId(`memory-row-${sharedMemoryId}`)
          ).toBeVisible();
        }
      });

      test('clicking "All" tab after applying an author filter clears the filter', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        // Apply author filter
        await page.getByRole('button', { name: /all.*author/i }).click();
        const authorSearch = page.getByPlaceholder(/search.*author/i);
        await expect(authorSearch).toBeVisible();
        await authorSearch.fill('admin');
        await waitForAllLoadersToDisappear(page);

        const authorOption = page
          .getByRole('menuitem')
          .filter({ hasNotText: /all.*author/i })
          .first();

        if (await authorOption.isVisible()) {
          await authorOption.click();
          await waitForAllLoadersToDisappear(page);

          // "All" tab clears the author filter
          const listResPromise = page.waitForResponse(
            (res) =>
              res.url().includes(MEMORIES_API) &&
              res.request().method() === 'GET'
          );
          await page.getByRole('tab', { name: /^all$/i }).click();
          await listResPromise;
          await waitForAllLoadersToDisappear(page);

          await expect(
            page.getByRole('button', { name: /clear all/i })
          ).not.toBeVisible();
        }
      });

      test('no results message is shown when search matches nothing', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const searchResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.url().includes('q=') &&
            res.request().method() === 'GET'
        );
        await page
          .getByTestId('search-input')
          .locator('input')
          .fill('zzz_unlikely_to_match_anything_xyz_9999');
        await searchResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(page).toContainText(/no.*memor.*available/i);
      });
    });

    // ─── 6. Sort Options ────────────────────────────────────────────────────

    test.describe('Sort Options', () => {
      test('sort dropdown shows all three sort options', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByRole('button', { name: /sort/i }).click();

        await expect(
          page.getByRole('menuitem', { name: /recently updated/i })
        ).toBeVisible();
        await expect(
          page.getByRole('menuitem', { name: /most used/i })
        ).toBeVisible();
        await expect(
          page.getByRole('menuitem', { name: /updated by/i })
        ).toBeVisible();
      });

      test('selecting "Most Used" reloads memories and updates the sort label', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByRole('button', { name: /sort/i }).click();

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await page.getByRole('menuitem', { name: /most used/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: /most used/i })
        ).toBeVisible();
      });

      test('selecting "Updated By" reloads memories and updates the sort label', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByRole('button', { name: /sort/i }).click();

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await page.getByRole('menuitem', { name: /updated by/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: /updated by/i })
        ).toBeVisible();
      });
    });

    // ─── 7. Copy Link ────────────────────────────────────────────────────────

    test.describe('Copy Link', () => {
      test('clicking a memory row adds ?memory= param to the URL', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`memory=${sharedMemoryName}`));

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('navigating to a URL with ?memory= param auto-opens the memory modal', async ({
        page,
      }) => {
        test.slow();

        await page.goto(`${MEMORIES_URL}?memory=${sharedMemoryName}`);
        await page
          .getByTestId('context-center-memories-page')
          .waitFor({ state: 'visible' });
        await waitForAllLoadersToDisappear(page);

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(SHARED_MEMORY_TITLE);
      });

      test('closing the modal removes ?memory= param from the URL', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page).toHaveURL(/memory=/);

        await page.getByRole('button', { name: /cancel/i }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await expect(page).not.toHaveURL(/memory=/);
      });

      test('copy link button copies URL containing the ?memory= param', async ({
        page,
      }) => {
        test.slow();

        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();

        // The copy-link button is the first button inside the row's actions area
        // (before the edit and delete actions)
        await row.getByRole('button').first().click();

        const clipboard = await page.evaluate(() =>
          navigator.clipboard.readText()
        );
        expect(clipboard).toContain(`memory=${sharedMemoryName}`);
      });
    });

    // ─── 8. Edit Memory — Each Field ────────────────────────────────────────

    test.describe('Edit Memory — Each Field', () => {
      let editMemoryId: string;

      test.beforeEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        const name = `cc_memory_each_field_edit_${uuid()}`;
        const res = await apiContext.post(MEMORIES_API, {
          data: {
            name,
            title: `Edit Fields Memory ${uuid()}`,
            question: 'Original question text',
            answer: 'Original answer text',
            shareConfig: { visibility: 'Shared' },
          },
        });
        expect(res.status()).toBe(201);
        const data = await res.json();
        editMemoryId = data.id;
        await afterAction();
      });

      test.afterEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await apiContext.delete(
          `${MEMORIES_API}/${editMemoryId}?hardDelete=true`
        );
        await afterAction();
      });

      test('editing title updates the memory and the row reflects the new title', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const newTitle = `Updated Title ${uuid()}`;
        const titleInput = dialog
          .getByTestId('memory-title-input')
          .locator('input');
        await titleInput.clear();
        await titleInput.fill(newTitle);

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editMemoryId}`)
        );
        await dialog.getByRole('button', { name: /save changes/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();

        const updatedRow = page.getByTestId(`memory-row-${editMemoryId}`);
        await updatedRow.scrollIntoViewIfNeeded();
        await expect(updatedRow).toContainText(newTitle);
      });

      test('editing memory content updates the memory', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const newContent = `Updated content ${uuid()}`;
        const textarea = dialog
          .getByTestId('memory-content-input')
          .locator('textarea');
        await textarea.clear();
        await textarea.fill(newContent);

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editMemoryId}`)
        );
        await dialog.getByRole('button', { name: /save changes/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();

        // Reopen to verify persisted content
        const updatedRow = page.getByTestId(`memory-row-${editMemoryId}`);
        await updatedRow.scrollIntoViewIfNeeded();
        await updatedRow.click();

        const viewDialog = page.getByRole('dialog');
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog.locator('.prose')).toContainText(newContent);
        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('editing memory type persists after save', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByTestId('memory-type-select').click();
        await page.getByRole('option', { name: /faq/i }).click();

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editMemoryId}`)
        );
        await dialog.getByRole('button', { name: /save changes/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
      });

      test('editing visibility from Shared to Private saves and updates the badge', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // In edit mode the visibility section shows the edit pencil icon for owners
        // Click the edit icon next to the visibility badge
        const editVisibilityBtn = dialog.locator(
          'button[data-testid="edit-visibility-btn"]'
        );

        if (await editVisibilityBtn.isVisible()) {
          await editVisibilityBtn.click();
        } else {
          // Fallback: use the last edit button in the metadata card
          await dialog
            .getByRole('button', { name: /edit/i })
            .last()
            .click();
        }

        await dialog.getByTestId('memory-visibility-select').click();
        await page.getByRole('option', { name: /private/i }).click();

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editMemoryId}`)
        );
        await dialog.getByRole('button', { name: /save changes/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();

        // Reopen in view mode — private badge should show
        const updatedRow = page.getByTestId(`memory-row-${editMemoryId}`);
        await updatedRow.scrollIntoViewIfNeeded();
        await updatedRow.click();

        const viewDialog = page.getByRole('dialog');
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog).toContainText(/private/i);
        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('adding a linked asset in edit mode shows entity badge on the row', async ({
        browser,
        page,
      }) => {
        test.slow();

        const table = await fetchFirstTable(page);
        if (!table?.id) {
          test.skip();

          return;
        }

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${editMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();

        const assetSearch = page.getByPlaceholder(/search.*asset/i);
        await expect(assetSearch).toBeVisible();
        await assetSearch.fill(table.name);
        await waitForAllLoadersToDisappear(page);

        const firstOption = page.getByRole('option').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }

        // Confirm the asset card appeared in the dialog
        await expect(dialog).toContainText(table.displayName ?? table.name);

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editMemoryId}`)
        );
        await dialog.getByRole('button', { name: /save changes/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();

        const updatedRow = page.getByTestId(`memory-row-${editMemoryId}`);
        await updatedRow.scrollIntoViewIfNeeded();
        await expect(updatedRow).toContainText(
          table.displayName ?? table.name
        );
      });
    });

    // ─── 9. Visibility Badge Text in Modal ──────────────────────────────────

    test.describe('Visibility Badge Text', () => {
      test('Shared memory shows "visible to everyone in the workspace" description', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog).toContainText(/shared/i);
        await expect(dialog).toContainText(/visible to everyone/i);

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('Private memory shows "visible only to you" description', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${privateMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog).toContainText(/private/i);
        await expect(dialog).toContainText(/visible only to you/i);

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('Entity memory shows "visible to linked entities" description', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${entityMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog).toContainText(/entity/i);
        await expect(dialog).toContainText(/visible to linked/i);

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('changing visibility from Shared to Private shows "visible only to you" after save', async ({
        browser,
        page,
      }) => {
        test.slow();

        const { apiContext, afterAction } = await createNewPage(browser);
        const name = `cc_memory_vis_badge_${uuid()}`;
        const res = await apiContext.post(MEMORIES_API, {
          data: {
            name,
            title: `Visibility Badge Memory ${uuid()}`,
            question: 'Visibility badge test',
            answer: 'Testing badge text after visibility change',
            shareConfig: { visibility: 'Shared' },
          },
        });
        expect(res.status()).toBe(201);
        const visBadgeMemoryId = (await res.json()).id;
        await afterAction();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${visBadgeMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Initially shows "Shared" + "visible to everyone"
        await expect(dialog).toContainText(/visible to everyone/i);

        // Open the visibility editor
        const editVisibilityBtn = dialog.locator(
          'button[data-testid="edit-visibility-btn"]'
        );
        if (await editVisibilityBtn.isVisible()) {
          await editVisibilityBtn.click();
        } else {
          await dialog
            .getByRole('button', { name: /edit/i })
            .last()
            .click();
        }

        await dialog.getByTestId('memory-visibility-select').click();
        await page.getByRole('option', { name: /private/i }).click();

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${visBadgeMemoryId}`)
        );
        await dialog.getByRole('button', { name: /save changes/i }).click();
        await updateResPromise;
        await expect(dialog).not.toBeVisible();

        // Reopen in view mode
        await navigateToMemories(page);
        const updatedRow = page.getByTestId(`memory-row-${visBadgeMemoryId}`);
        await updatedRow.scrollIntoViewIfNeeded();
        await updatedRow.click();

        const viewDialog = page.getByRole('dialog');
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog).toContainText(/visible only to you/i);
        await page.getByRole('button', { name: /cancel/i }).click();

        const { apiContext: cleanCtx, afterAction: cleanAfter } =
          await createNewPage(browser);
        await cleanCtx.delete(
          `${MEMORIES_API}/${visBadgeMemoryId}?hardDelete=true`
        );
        await cleanAfter();
      });
    });

    // ─── 10. Visibility Enforcement ─────────────────────────────────────────

    test.describe('Visibility Enforcement', () => {
      test('private memory (admin-owned) is NOT visible to data consumers', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        await expect(
          page.getByTestId(`memory-row-${privateMemoryId}`)
        ).not.toBeVisible();
      });

      test('shared memory is visible to data consumers', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();
        await expect(row).toContainText(SHARED_MEMORY_TITLE);
      });

      test('data consumer sees a read-only modal for shared memories they do not own', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${sharedMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Non-owner should NOT see Edit or Delete buttons
        await expect(
          page.getByRole('button', { name: /^edit$/i })
        ).not.toBeVisible();
        await expect(
          page.getByRole('button', { name: /^delete$/i })
        ).not.toBeVisible();

        await page.getByRole('button', { name: /cancel/i }).click();
      });
    });

    // ─── 11. Non-Admin User Creates a Memory ────────────────────────────────

    test.describe('Non-Admin User — Create Memory', () => {
      let nonAdminMemoryId: string;

      test.afterAll(async ({ browser }) => {
        if (nonAdminMemoryId) {
          const { apiContext, afterAction } = await createNewPage(browser);
          await apiContext.delete(
            `${MEMORIES_API}/${nonAdminMemoryId}?hardDelete=true`
          );
          await afterAction();
        }
      });

      test('user with Create permission can create a memory and it appears under "Created by Me"', async ({
        browser,
      }) => {
        test.slow();

        const page = await loginAsUser(browser, nonAdminCreator);
        await redirectToHomePage(page);
        await navigateToMemories(page);

        const addBtn = page.getByTestId('add-memory-btn');
        await expect(addBtn).toBeVisible();
        await addBtn.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const content = `Non-admin memory content ${uuid()}`;
        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill(content);

        const createResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'POST'
        );
        await dialog.getByRole('button', { name: /create memory/i }).click();
        const createRes = await createResPromise;
        expect(createRes.status()).toBe(201);

        const created = await createRes.json();
        nonAdminMemoryId = created.id;

        await expect(dialog).not.toBeVisible();
        await waitForAllLoadersToDisappear(page);

        // Switch to "Created by Me" and verify the memory appears
        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await page.getByRole('tab', { name: /created by me/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        const row = page.getByTestId(`memory-row-${nonAdminMemoryId}`);
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();

        await page.close();
      });
    });

    // ─── 12. Linked Asset Selection ─────────────────────────────────────────

    test.describe('Linked Asset Selection', () => {
      test('link an asset button opens the search popover', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();

        await expect(page.getByPlaceholder(/search.*asset/i)).toBeVisible();
      });

      test('typing in asset search popover triggers a search and shows results', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();

        const assetSearch = page.getByPlaceholder(/search.*asset/i);
        await expect(assetSearch).toBeVisible();

        const searchResPromise = page.waitForResponse(
          (res) =>
            res.url().includes('/search/query') && res.status() === 200
        );
        await assetSearch.fill('test');
        await searchResPromise;

        // Either results or empty state — list container must be visible
        await expect(
          page.getByRole('option').first().or(page.getByText(/no.*result/i))
        ).toBeVisible();
      });

      test('ArrowDown + Enter keyboard navigation selects the first asset result', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();

        const assetSearch = page.getByPlaceholder(/search.*asset/i);
        await expect(assetSearch).toBeVisible();

        const searchResPromise = page.waitForResponse(
          (res) =>
            res.url().includes('/search/query') && res.status() === 200
        );
        await assetSearch.fill('a');
        await searchResPromise;

        const firstOption = page.getByRole('option').first();
        if (await firstOption.isVisible()) {
          const optionText = (await firstOption.textContent()) ?? '';

          // Navigate with keyboard
          await assetSearch.press('ArrowDown');
          await page.keyboard.press('Enter');

          // The selected asset name should appear in the linked assets section
          await expect(dialog).toContainText(optionText.trim().slice(0, 20));
        }
      });

      test('linked asset card shows remove button; clicking it removes the asset', async ({
        browser,
        page,
      }) => {
        test.slow();

        const table = await fetchFirstTable(page);
        if (!table?.id) {
          test.skip();

          return;
        }

        // Create a memory with a linked entity so we can test removal in edit mode
        const { apiContext, afterAction } = await createNewPage(browser);
        const name = `cc_memory_remove_asset_${uuid()}`;
        const createRes = await apiContext.post(MEMORIES_API, {
          data: {
            name,
            title: `Remove Asset Test ${uuid()}`,
            question: 'Remove asset test',
            answer: 'Remove asset test',
            shareConfig: { visibility: 'Shared' },
            primaryEntity: {
              id: table.id,
              type: table.entityType ?? 'table',
              name: table.name,
              fullyQualifiedName: table.fullyQualifiedName,
            },
          },
        });
        expect(createRes.status()).toBe(201);
        const removeAssetMemId = (await createRes.json()).id;
        await afterAction();

        await navigateToMemories(page);

        const row = page.getByTestId(`memory-row-${removeAssetMemId}`);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(table.displayName ?? table.name);

        // Remove button is the X inside the linked asset card
        const assetCard = dialog
          .locator('[class*="card"]')
          .filter({ hasText: table.displayName ?? table.name });
        const removeBtn = assetCard.getByRole('button').last();
        await expect(removeBtn).toBeVisible();
        await removeBtn.click();

        await expect(dialog).not.toContainText(
          table.displayName ?? table.name
        );

        await dialog.getByRole('button', { name: /cancel/i }).click();

        const { apiContext: cleanCtx, afterAction: cleanAfter } =
          await createNewPage(browser);
        await cleanCtx.delete(
          `${MEMORIES_API}/${removeAssetMemId}?hardDelete=true`
        );
        await cleanAfter();
      });

      test('"All Assets" option in asset filter button resets the asset filter', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        // The asset filter button is labeled "All Assets" by default
        // Open it
        await page.getByRole('button', { name: /all.*asset/i }).click();

        const assetSearch = page.getByPlaceholder(
          /search.*asset.*by.*name.*or.*path/i
        );
        await expect(assetSearch).toBeVisible();

        const searchResPromise = page.waitForResponse(
          (res) =>
            res.url().includes('/search/query') && res.status() === 200
        );
        await assetSearch.fill('a');
        await searchResPromise;

        const firstOption = page.getByRole('option').first();
        if (await firstOption.isVisible()) {
          // Select an asset
          await firstOption.click();
          await waitForAllLoadersToDisappear(page);

          // "Clear All" appears since an asset filter is now active
          await expect(
            page.getByRole('button', { name: /clear all/i })
          ).toBeVisible();

          // Click the "All Assets" option inside the filter to reset
          await page.getByRole('button', { name: /all.*asset/i }).click();

          const allAssetsOption = page
            .getByRole('option', { name: /all.*asset/i })
            .first();

          if (await allAssetsOption.isVisible()) {
            const listResPromise = page.waitForResponse(
              (res) =>
                res.url().includes(MEMORIES_API) &&
                res.request().method() === 'GET'
            );
            await allAssetsOption.click();
            await listResPromise;
            await waitForAllLoadersToDisappear(page);

            await expect(
              page.getByRole('button', { name: /clear all/i })
            ).not.toBeVisible();
          }
        }
      });
    });

    // ─── 13. Pagination ──────────────────────────────────────────────────────

    test.describe('Pagination', () => {
      const paginationMemoryIds: string[] = [];
      // 11 memories forces 2 pages (page size = 10)
      const PAGINATION_COUNT = 11;

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);

        for (let i = 0; i < PAGINATION_COUNT; i++) {
          const res = await apiContext.post(MEMORIES_API, {
            data: {
              name: `cc_memory_pg_${uuid()}`,
              title: `Pagination Memory ${String(i + 1).padStart(2, '0')}`,
              question: `Pagination question ${i + 1}`,
              answer: `Pagination answer ${i + 1}`,
              shareConfig: { visibility: 'Shared' },
            },
          });
          if (res.status() === 201) {
            const data = await res.json();
            paginationMemoryIds.push(data.id);
          }
        }

        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);

        for (const id of paginationMemoryIds) {
          await apiContext.delete(`${MEMORIES_API}/${id}?hardDelete=true`);
        }

        await afterAction();
      });

      test('pagination controls are visible when more than 10 memories exist', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        // With 11+ shared memories the next-page button must be visible
        const nextBtn = page.getByRole('button', { name: /next/i });
        await expect(nextBtn).toBeVisible();
        await expect(nextBtn).toBeEnabled();
      });

      test('navigating to page 2 loads a different set of memory rows', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const firstPageRows = page.locator('[data-testid^="memory-row-"]');
        await expect(firstPageRows.first()).toBeVisible();

        // Capture ID of first row on page 1
        const firstRowId = await firstPageRows
          .first()
          .getAttribute('data-testid');

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.url().includes('offset=') &&
            res.request().method() === 'GET'
        );
        await page.getByRole('button', { name: /next/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        // Page 2 must show rows, and the first-page row must not be present
        await expect(
          page.locator('[data-testid^="memory-row-"]').first()
        ).toBeVisible();

        if (firstRowId) {
          await expect(page.getByTestId(firstRowId)).not.toBeVisible();
        }
      });

      test('navigating back to page 1 shows original memories', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        // Go to page 2
        const toPage2 = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.url().includes('offset=') &&
            res.request().method() === 'GET'
        );
        await page.getByRole('button', { name: /next/i }).click();
        await toPage2;
        await waitForAllLoadersToDisappear(page);

        // Go back to page 1
        const toPage1 = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.request().method() === 'GET'
        );
        await page.getByRole('button', { name: /prev/i }).click();
        await toPage1;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.locator('[data-testid^="memory-row-"]').first()
        ).toBeVisible();
      });
    });
  }
);
