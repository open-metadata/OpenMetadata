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
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  createMemoryViaApi,
  getLoggedInUser,
  LoggedInUser,
  MEMORIES_API,
  MEMORIES_URL,
  navigateToMemories,
  patchMemory,
  searchAndGetMemoryRow,
} from '../../utils/ContextCenterUtil';
import {
  copyAndGetClipboardText,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';
import { test as base } from '../fixtures/pages';

const test = base;

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Shared test data ─────────────────────────────────────────────────────────

const SHARED_MEMORY_TITLE = `CC Memory Shared ${uuid()}`;
const SHARED_NOT_WITH_CONSUMER_TITLE = `CC Memory Shared Elsewhere ${uuid()}`;
const PRIVATE_MEMORY_TITLE = `CC Memory Private ${uuid()}`;
const ENTITY_MEMORY_TITLE = `CC Memory Entity ${uuid()}`;

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe(
  'Context Center - Memories',
  { tag: ['@Features', '@Governance'] },
  () => {
    let sharedMemoryId: string;
    let sharedMemoryName: string;
    let sharedNotWithConsumerId: string;
    let privateMemoryId: string;
    let privateMemoryName: string;
    let entityMemoryId: string;
    let dataConsumerUser: LoggedInUser;
    let secondAuthorMemoryId: string;
    let secondAuthorMemoryTitle: string;

    /** Real table asset, used for linked-entity assertions instead of skipping when ES is empty. */
    const linkedTable = new TableClass();

    /** All memory IDs created in beforeAll — cleaned up in afterAll. */
    const globalMemoryIds: string[] = [];
    // 11 memories forces 2 pages (page size = 10)
    const PAGINATION_COUNT = 11;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await linkedTable.create(apiContext);

      // dataConsumerPage is a per-test fixture and isn't resolved inside
      // beforeAll, so open a page against the same storage state directly.
      const dataConsumerSetupPage = await browser.newPage({
        storageState: 'playwright/.auth/dataConsumer.json',
      });
      await redirectToHomePage(dataConsumerSetupPage);
      const {
        apiContext: dataConsumerApiContext,
        afterAction: dataConsumerAfterAction,
      } = await getApiContext(dataConsumerSetupPage);
      dataConsumerUser = await getLoggedInUser(dataConsumerApiContext);
      await dataConsumerAfterAction();
      await dataConsumerSetupPage.close();

      for (let i = 0; i < PAGINATION_COUNT; i++) {
        const data = await createMemoryViaApi(apiContext, {
          name: `cc_memory_pg_${uuid()}`,
          title: `Pagination Memory ${String(i + 1).padStart(2, '0')}`,
          question: `Pagination question ${i + 1}`,
          answer: `Pagination answer ${i + 1}`,
          shareConfig: { visibility: 'Shared' },
        });
        globalMemoryIds.push(data.id);
      }

      // ── Second author — attributed to the dataConsumer fixture via `owners`,
      // no separate login needed since the author filter/"Created by Me" tab
      // both query by `owners`, not by the authenticated creator. ───────────
      await waitForSearchIndexed(
        apiContext,
        dataConsumerUser.name,
        'user_search_index'
      );

      secondAuthorMemoryTitle = `Second Author Memory ${uuid()}`;
      const secondAuthorMemory = await createMemoryViaApi(apiContext, {
        name: `cc_memory_second_author_${uuid()}`,
        title: secondAuthorMemoryTitle,
        question: 'Memory created by a second, distinct author',
        answer: 'Used to verify author filtering and sorting are real.',
        shareConfig: { visibility: 'Entity' },
        owners: [{ id: dataConsumerUser.id, type: 'user' }],
      });
      secondAuthorMemoryId = secondAuthorMemory.id;
      globalMemoryIds.push(secondAuthorMemoryId);

      // ── Shared memory — explicitly shared with the dataConsumer fixture ────
      sharedMemoryName = `cc_memory_shared_${uuid()}`;
      const sharedData = await createMemoryViaApi(apiContext, {
        name: sharedMemoryName,
        title: SHARED_MEMORY_TITLE,
        question: 'What is a shared memory?',
        answer:
          'A **shared** memory is visible to its owner and to the specific users or teams it has been explicitly shared with.',
        shareConfig: {
          visibility: 'Shared',
          sharedWith: [
            {
              principal: {
                id: dataConsumerUser.id,
                type: 'user',
                name: dataConsumerUser.name,
              },
              role: 'Viewer',
            },
          ],
        },
      });
      sharedMemoryId = sharedData.id;
      globalMemoryIds.push(sharedMemoryId);

      // ── Shared memory — NOT shared with the dataConsumer (negative fixture) ─
      const sharedElsewhereData = await createMemoryViaApi(apiContext, {
        name: `cc_memory_shared_elsewhere_${uuid()}`,
        title: SHARED_NOT_WITH_CONSUMER_TITLE,
        question: 'Shared with someone else entirely',
        answer:
          'Only visible to the owner and whoever it is explicitly shared with.',
        shareConfig: { visibility: 'Shared', sharedWith: [] },
      });
      sharedNotWithConsumerId = sharedElsewhereData.id;
      globalMemoryIds.push(sharedNotWithConsumerId);

      // ── Private memory ─────────────────────────────────────────────────────
      privateMemoryName = `cc_memory_private_${uuid()}`;
      const privateData = await createMemoryViaApi(apiContext, {
        name: privateMemoryName,
        title: PRIVATE_MEMORY_TITLE,
        question: 'Private memory question',
        answer: 'Only the owner (and an admin) can see this.',
        shareConfig: { visibility: 'Private' },
      });
      privateMemoryId = privateData.id;
      globalMemoryIds.push(privateMemoryId);

      // ── Entity-visibility memory — visible to every authenticated user ─────
      const entityData = await createMemoryViaApi(apiContext, {
        name: `cc_memory_entity_${uuid()}`,
        title: ENTITY_MEMORY_TITLE,
        question: 'Entity memory question',
        answer: 'Visible to every authenticated user, regardless of ownership.',
        shareConfig: { visibility: 'Entity' },
      });
      entityMemoryId = entityData.id;
      globalMemoryIds.push(entityMemoryId);

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    // ─── 0. Page Header ───────────────────────────────────────────────────────

    test.describe('Page Header', () => {
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
    });

    // ─── 1. Form Validation ─────────────────────────────────────────────────

    test.describe('Form Validation', () => {
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
        await expect(
          page.getByRole('button', { name: 'Cancel' })
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Create Memory' })
        ).toBeVisible();
      });

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
        await expect(dialog.locator('.prose strong')).toContainText(
          'Bold text'
        );
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

        const row = await searchAndGetMemoryRow(
          page,
          memoryTitle,
          createdMemoryId
        );
        await expect(row).toBeVisible();
        await expect(row).toContainText(memoryTitle);
      });
    });

    // ─── 4. Memory Row Card — Visible Metadata ──────────────────────────────

    test.describe('Memory Row Card Metadata', () => {
      test('row shows owner name and memory title', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          SHARED_MEMORY_TITLE,
          sharedMemoryId
        );
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

        const table = linkedTable.entityResponseData;

        const { apiContext, afterAction } = await createNewPage(browser);
        const linkedName = `cc_memory_linked_${uuid()}`;
        const created = await createMemoryViaApi(apiContext, {
          name: linkedName,
          title: `Linked Entity Memory ${uuid()}`,
          question: 'Memory with linked entity',
          answer: 'Linked to a data asset.',
          shareConfig: { visibility: 'Shared' },
          primaryEntity: {
            id: table.id,
            type: 'table',
            name: table.name,
            displayName: table.displayName,
            fullyQualifiedName: table.fullyQualifiedName,
          },
        });
        const linkedMemoryId = created.id;
        await afterAction();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          created.title,
          linkedMemoryId
        );
        await expect(row).toBeVisible();
        await expect(row).toContainText(table.displayName ?? table.name);

        const { apiContext: cleanCtx, afterAction: cleanAfter } =
          await createNewPage(browser);
        await cleanCtx.delete(
          `${MEMORIES_API}/${linkedMemoryId}?hardDelete=true`
        );
        await cleanAfter();
      });

      test('clicking a memory row opens the view-only modal with owner action buttons', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          SHARED_MEMORY_TITLE,
          sharedMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(SHARED_MEMORY_TITLE)).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Delete' })
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Cancel' })
        ).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`memory=${sharedMemoryName}`));

        await page.getByRole('button', { name: /cancel/i }).click();
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
        await expect(
          page.getByTestId(`memory-row-${secondAuthorMemoryId}`)
        ).not.toBeVisible();
      });

      test('clearing search restores the unfiltered list', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);
        const noMatchQuery = 'zzz_no_match_expected';
        const searchPromise = page.waitForResponse((res) => {
          const url = new URL(res.url());

          return (
            url.pathname === MEMORIES_API &&
            url.searchParams.get('q') === noMatchQuery &&
            res.request().method() === 'GET'
          );
        });
        const searchInput = page.getByTestId('search-input').locator('input');
        await searchInput.fill(noMatchQuery);
        await searchPromise;
        await waitForAllLoadersToDisappear(page);

        await page
          .getByText('No matching results')
          .waitFor({ state: 'visible' });
        
        const restoreResPromise = page.waitForResponse((res) => {
          const url = new URL(res.url());

          return (
            url.pathname === MEMORIES_API &&
            !url.searchParams.has('q') &&
            url.searchParams.get('limit') === '10' &&
            res.request().method() === 'GET'
          );
        });
        await searchInput.clear();
        await restoreResPromise;
        await waitForAllLoadersToDisappear(page);

        // The list is paginated, so search for the title rather than
        // assuming the memory is visible on the currently-loaded page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).toBeVisible();
      });

      test('"Created by Me" tab shows admin\'s own memories and hides the second author\'s', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
        );
        await page.getByRole('tab', { name: /created by me/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        // The list is paginated, so search for the title rather than
        // assuming the memory is visible on the currently-loaded page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).toBeVisible();
        await expect(
          page.getByTestId(`memory-row-${secondAuthorMemoryId}`)
        ).not.toBeVisible();
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
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
        );
        // Click the first summary card (Total Memories)
        await page
          .getByText(/total memor/i)
          .first()
          .click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        // All memories are shown again, including the second author's.
        // The list is paginated, so search for each title individually
        // (search always re-queries page 1) rather than assuming either
        // memory is visible on the currently-loaded unfiltered page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).toBeVisible();
        await expect(
          await searchAndGetMemoryRow(
            page,
            secondAuthorMemoryTitle,
            secondAuthorMemoryId
          )
        ).toBeVisible();
      });

      test('clicking "Created by Me" count card activates the created-by-me filter', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
        );
        // Click the "Created by Me" summary card
        await page
          .locator('[data-testid="memory-count-card-created-by-me"]')
          .click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        // Admin's shared memory visible; the second author's memory is not.
        // The list is paginated, so search for the title rather than
        // assuming the memory is visible on the currently-loaded page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).toBeVisible();
        await expect(
          page.getByTestId(`memory-row-${secondAuthorMemoryId}`)
        ).not.toBeVisible();
      });

      test('selecting the second author in the author filter shows only their memory', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        await page.getByRole('button', { name: /all.*author/i }).click();

        const authorSearch = page.getByPlaceholder(/search.*author/i);
        await expect(authorSearch).toBeVisible();
        await authorSearch.fill(dataConsumerUser.name);
        await waitForAllLoadersToDisappear(page);

        const authorOption = page.getByRole('menuitemradio', {
          name: dataConsumerUser.displayName,
        });
        await expect(authorOption).toBeVisible();

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
        );
        await authorOption.click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId(`memory-row-${secondAuthorMemoryId}`)
        ).toBeVisible();
        // Search narrows further within the active author filter, so this
        // confirms sharedMemoryId is excluded rather than merely off-page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).not.toBeVisible();
        await expect(
          page.getByRole('button', { name: /clear all/i })
        ).toBeVisible();
      });

      test('"Clear All" button resets the author filter and restores the full list', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        await page.getByRole('button', { name: /all.*author/i }).click();
        const authorSearch = page.getByPlaceholder(/search.*author/i);
        await expect(authorSearch).toBeVisible();
        await authorSearch.fill(dataConsumerUser.name);
        await waitForAllLoadersToDisappear(page);

        const authorOption = page.getByRole('menuitemradio', {
          name: dataConsumerUser.displayName,
        });
        await expect(authorOption).toBeVisible();
        await authorOption.click();
        await waitForAllLoadersToDisappear(page);

        // Search narrows further within the active author filter, so this
        // confirms sharedMemoryId is excluded rather than merely off-page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).not.toBeVisible();

        const clearBtn = page.getByRole('button', { name: /clear all/i });
        await expect(clearBtn).toBeVisible();

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
        );
        await clearBtn.click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: /clear all/i })
        ).not.toBeVisible();
        // The list is paginated, so search for each title individually
        // rather than assuming either memory is visible on the currently
        // loaded unfiltered page.
        await expect(
          page.getByTestId(`memory-row-${sharedMemoryId}`)
        ).toBeVisible();
        await expect(
          await searchAndGetMemoryRow(
            page,
            secondAuthorMemoryTitle,
            secondAuthorMemoryId
          )
        ).toBeVisible();
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
        await authorSearch.fill(dataConsumerUser.name);
        await waitForAllLoadersToDisappear(page);

        const authorOption = page.getByRole('menuitemradio', {
          name: dataConsumerUser.displayName,
        });
        await expect(authorOption).toBeVisible();
        await authorOption.click();
        await waitForAllLoadersToDisappear(page);

        // "All" tab clears the author filter
        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
        );
        await page.getByRole('tab', { name: /^all$/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: /clear all/i })
        ).not.toBeVisible();
        // The list is paginated, so search for the title rather than
        // assuming the memory is visible on the currently-loaded page.
        await expect(
          await searchAndGetMemoryRow(page, SHARED_MEMORY_TITLE, sharedMemoryId)
        ).toBeVisible();
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

        await expect(page.getByText('No matching results')).toBeVisible();
      });
    });

    // ─── 6. Sort Options ────────────────────────────────────────────────────

    test.describe('Sort Options', () => {
      test('sort dropdown shows all three sort options', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByRole('button', { name: /sort/i }).click();

        await expect(
          page.getByRole('menuitemradio', { name: 'Recently Updated' })
        ).toBeVisible();
        await expect(
          page.getByRole('menuitemradio', { name: 'Most Used' })
        ).toBeVisible();
        await expect(
          page.getByRole('menuitemradio', { name: 'Updated By' })
        ).toBeVisible();
      });

      test('selecting "Most Used" actually reorders rows by usageCount', async ({
        browser,
        page,
      }) => {
        test.slow();

        const { apiContext, afterAction } = await createNewPage(browser);
        // Make the entity-visibility memory the clear most-used memory in
        // the whole fixture set, so it must render first once sorted.
        // usageCount/lastUsedAt are excluded from ContextMemoryRepository's
        // change tracking (server-side telemetry fields), so a patch that
        // touches ONLY usageCount is silently dropped before it's persisted —
        // also flipping `pinned` (a tracked field) forces the patch to
        // persist, carrying usageCount along with it.
        await patchMemory(apiContext, entityMemoryId, [
          { op: 'add', path: '/usageCount', value: 999999 },
          { op: 'add', path: '/lastUsedAt', value: Date.now() },
          { op: 'add', path: '/pinned', value: true },
        ]);
        await afterAction();

        await navigateToMemories(page);
        await page.getByRole('button', { name: /sort/i }).click();

        const listResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(MEMORIES_API) &&
            res.url().includes('sortBy=usageCount') &&
            res.request().method() === 'GET'
        );
        await page.getByRole('menuitemradio', { name: /most used/i }).click();
        await listResPromise;
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: /most used/i })
        ).toBeVisible();

        const rows = page.locator('[data-testid^="memory-row-"]');
        await expect(
          rows.first().getByText('Cited 999999 times')
        ).toBeVisible();

        // lastUsedAt is rendered next to the usage count as
        // "Cited N times · Last {relative-time}" — assert the "Last" label
        // is present rather than a specific relative-time string, since the
        // exact rendered value depends on wall-clock time between the patch
        // above and this assertion.
        await expect(rows.first()).toContainText(/Last/);
      });
    });

    // ─── 7. Copy Link ────────────────────────────────────────────────────────

    test.describe('Copy Link', () => {
      test('clicking a memory row adds ?memory= param to the URL', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          sharedMemoryName,
          sharedMemoryId
        );
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

        const row = await searchAndGetMemoryRow(
          page,
          sharedMemoryName,
          sharedMemoryId
        );
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

        await page
          .context()
          .grantPermissions(['clipboard-read', 'clipboard-write']);

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          sharedMemoryName,
          sharedMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();

        const copyBtn = row.getByTestId('copy-link-btn');
        const clipboard = await copyAndGetClipboardText(page, copyBtn);
        expect(clipboard).toContain(`memory=${sharedMemoryName}`);
      });
    });

    // ─── 8. Edit Memory — Each Field ────────────────────────────────────────

    test.describe('Edit Memory — Each Field', () => {
      let editMemoryId: string;
      let editMemoryName: string;

      test.beforeEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        const name = `cc_memory_each_field_edit_${uuid()}`;
        const data = await createMemoryViaApi(apiContext, {
          name,
          title: `Edit Fields Memory ${uuid()}`,
          question: 'Original question text',
          answer: 'Original answer text',
          shareConfig: { visibility: 'Shared' },
        });
        editMemoryId = data.id;
        editMemoryName = data.displayName || data.name;
        await afterAction();
      });

      test.afterEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await apiContext.delete(
          `${MEMORIES_API}/${editMemoryId}?hardDelete=true`
        );
        await afterAction();
      });

      test('edit-memory button on the row opens the modal in edit mode', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('memory-content-input')).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Delete' })
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Edit' })
        ).not.toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Cancel' })
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Save Changes' })
        ).toBeVisible();
      });

      test('view modal switches to edit mode and saves changes', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /^edit$/i }).click();

        await dialog
          .getByTestId('memory-content-input')
          .locator('textarea')
          .fill('Updated via view-to-edit switch.');

        const updateResPromise = page.waitForResponse(
          new RegExp(`${MEMORIES_API}/${editMemoryId}`)
        );
        await dialog.getByRole('button', { name: /^(save|create)/i }).click();
        const updateRes = await updateResPromise;
        expect(updateRes.status()).toBe(200);

        await expect(dialog).not.toBeVisible();
      });

      test('cancel button in edit mode closes the modal without saving', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
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
        const reopenedRow = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
        await reopenedRow.click();

        const viewDialog = page.getByRole('dialog');
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog).not.toContainText(
          'This change should be discarded'
        );
        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('editing title updates the memory and the row reflects the new title', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
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

        const updatedRow = await searchAndGetMemoryRow(
          page,
          newTitle,
          editMemoryId
        );
        await expect(updatedRow).toContainText(newTitle);
      });

      test('editing memory content updates the memory', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
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
        await expect(
          viewDialog.getByTestId('description-field-preview')
        ).toContainText(newContent);
        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('editing memory type persists after save', async ({ page }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
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

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // In edit mode the visibility section shows the edit pencil icon for owners
        // Click the edit icon next to the visibility badge
        const editVisibilityBtn = dialog.getByTestId(
          'memory-visibility-edit-button'
        );
        await editVisibilityBtn.click();

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
        page,
      }) => {
        test.slow();

        const table = linkedTable.entityResponseData;

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          editMemoryName,
          editMemoryId
        );
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();

        const assetSearch = page
          .getByTestId('picker-popover')
          .getByRole('textbox');
        await expect(assetSearch).toBeVisible();
        await assetSearch.fill(table.name);
        await waitForAllLoadersToDisappear(page);

        const option = page.getByRole('option', {
          name: table.displayName ?? table.name,
        });
        await expect(option).toBeVisible();
        await option.click();

        await page.keyboard.press('Escape'); // Close the picker popover
        await option.waitFor({ state: 'detached' });

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
        await expect(updatedRow).toContainText(table.displayName ?? table.name);
      });
    });

    // ─── 9. Visibility Badge Text in Modal ──────────────────────────────────

    test.describe('Visibility Badge Text', () => {
      test('Shared memory shows the shared-with-specific-people description', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          sharedMemoryName,
          sharedMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog).toContainText(/shared/i);

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('Private memory shows "visible only to you" description', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          privateMemoryName,
          privateMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog).toContainText(/private/i);
        await expect(dialog).toContainText('Only visible to you.');

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('Entity memory shows "visible to linked entities" description', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          ENTITY_MEMORY_TITLE,
          entityMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await row.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await expect(dialog).toContainText(/entity/i);
        await expect(dialog).toContainText(
          "Visible within selected entity's context."
        );

        await page.getByRole('button', { name: /cancel/i }).click();
      });

      test('changing visibility from Shared to Private shows "visible only to you" after save', async ({
        browser,
        page,
      }) => {
        test.slow();

        const { apiContext, afterAction } = await createNewPage(browser);
        const name = `cc_memory_vis_badge_${uuid()}`;
        const visBadgeMemory = await createMemoryViaApi(apiContext, {
          name,
          title: `Visibility Badge Memory ${uuid()}`,
          question: 'Visibility badge test',
          answer: 'Testing badge text after visibility change',
          shareConfig: { visibility: 'Shared' },
        });
        const visBadgeMemoryId = visBadgeMemory.id;
        await afterAction();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(page, name, visBadgeMemoryId);
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(/shared/i);

        // Open the visibility editor
        const editVisibilityBtn = dialog.getByTestId(
          'memory-visibility-edit-button'
        );
        await editVisibilityBtn.click();

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
        const updatedRow = await searchAndGetMemoryRow(
          page,
          name,
          visBadgeMemoryId
        );
        await updatedRow.scrollIntoViewIfNeeded();
        await updatedRow.click();

        const viewDialog = page.getByRole('dialog');
        await expect(viewDialog).toBeVisible();
        await expect(viewDialog).toContainText('Only visible to you.');
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
    //
    // Backend rule (ContextMemoryVisibility.isVisibleToUser):
    //   Private -> owner/admin only.
    //   Shared  -> owner/admin plus whoever is explicitly listed in
    //              shareConfig.sharedWith (by user, team, or domain).
    //   Entity  -> every authenticated user, unconditionally.

    test.describe('Visibility Enforcement', () => {
      test('private memory (admin-owned) is NOT visible to a non-owner', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        await expect(
          page.getByTestId(`memory-row-${privateMemoryId}`)
        ).not.toBeVisible();
      });

      test('shared memory IS visible to a user explicitly listed in sharedWith', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          SHARED_MEMORY_TITLE,
          sharedMemoryId
        );
        await expect(row).toBeVisible();
        await expect(row).toContainText(SHARED_MEMORY_TITLE);
      });

      test('shared memory is NOT visible to a user absent from sharedWith', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        await expect(
          page.getByTestId(`memory-row-${sharedNotWithConsumerId}`)
        ).not.toBeVisible();
      });

      test('entity-visibility memory is visible to every authenticated user', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          ENTITY_MEMORY_TITLE,
          entityMemoryId
        );
        await expect(row).toBeVisible();
        await expect(row).toContainText(ENTITY_MEMORY_TITLE);
      });

      test('data consumer sees a read-only modal for shared memories they do not own', async ({
        dataConsumerPage: page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          SHARED_MEMORY_TITLE,
          sharedMemoryId
        );
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

    // ─── 12. Linked Asset Selection ─────────────────────────────────────────

    test.describe('Linked Asset Selection', () => {
      test('link an asset button opens the search popover', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();
        await page.getByText('Loading...').waitFor({ state: 'detached' });
        await expect(
          page.getByTestId('picker-popover').getByRole('textbox')
        ).toBeVisible();
      });

      test('typing the linked table name in the asset search returns it as a result', async ({
        page,
      }) => {
        test.slow();

        const table = linkedTable.entityResponseData;

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();
        await page.getByText('Loading...').waitFor({ state: 'detached' });
        const assetSearch = page
          .getByTestId('picker-popover')
          .getByRole('textbox');
        await expect(assetSearch).toBeVisible();

        const searchResPromise = page.waitForResponse(
          (res) => res.url().includes('/search/query') && res.status() === 200
        );
        await assetSearch.fill(table.name);
        await searchResPromise;

        await expect(
          page.getByRole('option', { name: table.displayName ?? table.name })
        ).toBeVisible();
      });

      test('ArrowDown + Enter keyboard navigation selects the linked table result', async ({
        page,
      }) => {
        test.slow();

        const table = linkedTable.entityResponseData;

        await navigateToMemories(page);
        await page.getByTestId('add-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: /link.*asset/i }).click();
        await page.getByText('Loading...').waitFor({ state: 'detached' });
        const assetSearch = page
          .getByTestId('picker-popover')
          .getByRole('textbox');
        await expect(assetSearch).toBeVisible();

        const searchResPromise = page.waitForResponse(
          (res) => res.url().includes('/search/query') && res.status() === 200
        );
        await assetSearch.fill(table.name);
        await searchResPromise;

        const option = page.getByRole('option', {
          name: table.displayName ?? table.name,
        });
        await expect(option).toBeVisible();

        // Navigate with keyboard
        await assetSearch.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');
        await option.waitFor({ state: 'detached' });

        // The selected asset name should appear in the linked assets section
        await expect(dialog).toContainText(table.displayName ?? table.name);
      });

      test('linked asset card shows remove button; clicking it removes the asset', async ({
        browser,
        page,
      }) => {
        test.slow();

        const table = linkedTable.entityResponseData;

        // Create a memory with a linked entity so we can test removal in edit mode
        const { apiContext, afterAction } = await createNewPage(browser);
        const name = `cc_memory_remove_asset_${uuid()}`;
        const created = await createMemoryViaApi(apiContext, {
          name,
          title: `Remove Asset Test ${uuid()}`,
          question: 'Remove asset test',
          answer: 'Remove asset test',
          shareConfig: { visibility: 'Shared' },
          primaryEntity: {
            id: table.id,
            type: 'table',
            name: table.name,
            fullyQualifiedName: table.fullyQualifiedName,
          },
        });
        const removeAssetMemId = created.id;
        await afterAction();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          created.title,
          removeAssetMemId
        );
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(table.displayName ?? table.name);

        // Remove button is the X inside the linked asset card
        const assetCard = dialog
          .getByTestId('linked-asset-card')
          .filter({ hasText: table.displayName ?? table.name });
        const removeBtn = assetCard.getByTestId('remove-linked-asset-btn');
        await expect(removeBtn).toBeVisible();
        await removeBtn.click();

        await expect(dialog).not.toContainText(table.displayName ?? table.name);

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

        const table = linkedTable.entityResponseData;

        await navigateToMemories(page);

        // The asset filter button is labeled "All Assets" by default, but
        // its accessible name changes to the selected asset's name once one
        // is picked — use the stable testid instead of the label so the
        // button can still be found (and reopened) after a selection.
        const assetFilterButton = page.getByTestId('asset-filter-button');

        // Opening the popover fires an immediate, unfiltered loadOptions('')
        // fetch — wait for it so the picker's initial state has settled
        // before searching, otherwise a later waitForResponse could match
        // this stale request instead of the actual search.
        const initialLoadResPromise = page.waitForResponse(
          (res) =>
            res.url().includes('/search/query') && res.url().includes('q=*')
        );
        await assetFilterButton.click();
        await initialLoadResPromise;

        const assetSearch = page
          .getByTestId('picker-popover')
          .getByRole('textbox');
        await expect(assetSearch).toBeVisible();

        const searchResPromise = page.waitForResponse(
          (res) => res.url().includes('/search/query') && res.status() === 200
        );
        await assetSearch.fill(table.name);
        await searchResPromise;

        const option = page.getByRole('option', {
          name: table.displayName ?? table.name,
        });
        await expect(option).toBeVisible();
        await option.click();
        await waitForAllLoadersToDisappear(page);

        // "Clear All" appears since an asset filter is now active
        await expect(
          page
            .getByTestId('empty-placeholder')
            .getByRole('button', { name: 'Clear All' })
        ).toBeVisible();

        // Reopen the same filter trigger (now showing the selected asset's
        // name) to click its "All Assets" reset option. Reopening fires
        // another loadOptions('') fetch — wait for it before looking for
        // the reset option.
        const reopenLoadResPromise = page.waitForResponse(
          (res) =>
            res.url().includes('/search/query') && res.url().includes('q=*')
        );
        await assetFilterButton.click();
        await reopenLoadResPromise;

        const allAssetsOption = page.getByRole('button', {
          name: 'All Assets',
        });
        await expect(allAssetsOption).toBeVisible();
        await allAssetsOption.click();

        await waitForAllLoadersToDisappear(page);

        await expect(
          page
            .getByTestId('empty-placeholder')
            .getByRole('button', { name: 'Clear All' })
        ).not.toBeVisible();
      });
    });

    // ─── 13. Delete Memory ───────────────────────────────────────────────────

    test.describe('Delete Memory', () => {
      let deleteMemoryId: string;
      let deleteMemoryTitle: string;

      test.beforeEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        deleteMemoryTitle = `Delete Me ${uuid()}`;
        const data = await createMemoryViaApi(apiContext, {
          name: `cc_memory_delete_${uuid()}`,
          title: deleteMemoryTitle,
          question: 'Delete flow test',
          answer: 'This memory exists only to be deleted.',
          shareConfig: { visibility: 'Shared' },
        });
        deleteMemoryId = data.id;
        await afterAction();
      });

      test.afterEach(async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await apiContext
          .delete(`${MEMORIES_API}/${deleteMemoryId}?hardDelete=true`)
          .catch(() => undefined);
        await afterAction();
      });

      test('deleting a memory via the row actions menu removes it from the list', async ({
        page,
      }) => {
        test.slow();

        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          deleteMemoryTitle,
          deleteMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await expect(row).toBeVisible();

        await row.getByTestId('manage-button').click();
        await page.getByTestId('delete-btn').click();

        const deleteResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(`${MEMORIES_API}/${deleteMemoryId}`) &&
            res.request().method() === 'DELETE'
        );
        await page.getByTestId('confirm-button').click();
        const deleteRes = await deleteResPromise;
        expect(deleteRes.ok()).toBeTruthy();

        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId(`memory-row-${deleteMemoryId}`)
        ).not.toBeVisible();
      });

      test('delete button inside the edit modal deletes the memory', async ({
        page,
      }) => {
        await navigateToMemories(page);

        const row = await searchAndGetMemoryRow(
          page,
          deleteMemoryTitle,
          deleteMemoryId
        );
        await row.scrollIntoViewIfNeeded();
        await row.getByTestId('edit-memory-btn').click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const deleteResPromise = page.waitForResponse(
          (res) =>
            res.url().includes(`${MEMORIES_API}/${deleteMemoryId}`) &&
            res.request().method() === 'DELETE'
        );
        await dialog.getByRole('button', { name: /^delete$/i }).click();
        const deleteRes = await deleteResPromise;
        expect(deleteRes.ok()).toBeTruthy();

        await expect(dialog).not.toBeVisible();
        await expect(
          page.getByTestId(`memory-row-${deleteMemoryId}`)
        ).not.toBeVisible();
      });
    });

    // ─── 14. Pagination ──────────────────────────────────────────────────────

    test.describe('Pagination', () => {
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
            res.url().includes(MEMORIES_API) && res.request().method() === 'GET'
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
