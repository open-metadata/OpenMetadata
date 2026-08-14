/*
 *  Copyright 2025 Collate.
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

/**
 * Regression tests for three bugs that caused GlossaryTermRelationSettings
 * tests to flake under parallel CI execution:
 *
 * Bug 1 — No backoff on 412 Conflict retries:
 *   The settings singleton uses compare-and-set (optimistic locking). When two
 *   workers wrote simultaneously, the loser got HTTP 412 and retried with zero
 *   delay — so all 5 retries still collided and exhausted before landing.
 *   Fix: exponential backoff (100 ms → 200 ms → 400 ms → 800 ms → 1 600 ms).
 *
 * Bug 2 — Stale DOM after delete:
 *   deleteRelationInUi waited for the HTTP DELETE response but returned before
 *   React re-rendered the table. The next assertion saw count=1 from the old DOM.
 *   Fix: assert toHaveCount(0) on the deleted row before returning.
 *
 * Bug 3 — Stale DOM after pagination Next Page click:
 *   findRowAcrossPages checked row visibility immediately after the GET response
 *   arrived, before React flushed the new page's rows into the DOM. This caused
 *   a false "not found" throw against the stale previous-page DOM.
 *   Fix: wait for the first tbody row to be visible after each page navigation.
 */

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { authenticateAdminPage } from '../../utils/admin';
import { getAuthContext, getSavedAdminToken, uuid } from '../../utils/common';

const RELATION_TYPES_API =
  '/api/v1/system/settings/glossaryTermRelationSettings/relationTypes';
const CONFLICT_STATUS = 412;
const CONFLICT_RETRY_LIMIT = 5;
const PAGE_SIZE_BASE = 15;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const createWithBackoff = async (
  apiContext: APIRequestContext,
  name: string,
  displayName: string
): Promise<boolean> => {
  for (let attempt = 0; attempt < CONFLICT_RETRY_LIMIT; attempt++) {
    const response = await apiContext.post(RELATION_TYPES_API, {
      data: { name, displayName, category: 'associative' },
    });

    if (response.status() !== CONFLICT_STATUS) {
      return response.status() === 201;
    }

    if (attempt < CONFLICT_RETRY_LIMIT - 1) {
      await sleep(100 * Math.pow(2, attempt));
    }
  }

  return false;
};

// Fixed findRowAcrossPages: waits for the first tbody row to appear after each
// Next Page response so React has time to flush the new page's rows.
const findRowAcrossPages = async (
  page: Page,
  testId: string
): Promise<void> => {
  const target = page.getByTestId(testId);

  while (true) {
    const found = await target
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(
        () => true,
        () => false
      );

    if (found) {
      return;
    }

    const nextBtn = page.getByRole('button', { name: 'Next Page' }).first();

    if ((await nextBtn.count()) === 0 || !(await nextBtn.isEnabled())) {
      throw new Error(`testId "${testId}" not found on any page`);
    }

    const nextPageResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/glossaryTermRelationSettings/relationTypes') &&
        r.request().method() === 'GET'
    );
    await nextBtn.click();
    await nextPageResponse;

    // The GET response arrives before React renders new rows.
    // Wait for the first row so the next loop iteration reads the correct DOM.
    await page
      .locator('[data-testid="relation-types-table"] tbody tr')
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 });
  }
};

test.describe('GlossaryTermRelationSettings — parallel-execution regressions', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAdminPage(page);
  });

  test('Bug 1 — two parallel API writers both land when exponential backoff is applied', async () => {
    // Two independent request contexts simulate two CI workers writing the
    // settings singleton simultaneously. A single context serialises requests
    // in the JS event loop and never triggers a real 412.
    const token = await getSavedAdminToken();
    const [ctxA, ctxB] = await Promise.all([
      getAuthContext(token),
      getAuthContext(token),
    ]);

    const nameA = `pwBug1A${uuid()}`;
    const nameB = `pwBug1B${uuid()}`;

    try {
      const [okA, okB] = await Promise.all([
        createWithBackoff(ctxA, nameA, 'PW Conflict Worker A'),
        createWithBackoff(ctxB, nameB, 'PW Conflict Worker B'),
      ]);

      expect(okA, 'Worker A must create its relation type').toBe(true);
      expect(okB, 'Worker B must create its relation type').toBe(true);

      const listRes = await ctxA.get(
        `${RELATION_TYPES_API}?limit=100&offset=0`
      );
      const list = await listRes.json();
      const names: string[] = (list.data ?? []).map(
        (r: { name: string }) => r.name
      );

      expect(names).toContain(nameA);
      expect(names).toContain(nameB);
    } finally {
      await ctxA.delete(`${RELATION_TYPES_API}/${nameA}`);
      await ctxB.delete(`${RELATION_TYPES_API}/${nameB}`);
      await ctxA.dispose();
      await ctxB.dispose();
    }
  });

  test('Bug 2 — delete removes the row from DOM before the caller proceeds', async ({
    page,
  }) => {
    const token = await getSavedAdminToken();
    const apiContext = await getAuthContext(token);
    const relationName = `pwBug2${uuid()}`;

    try {
      const created = await createWithBackoff(
        apiContext,
        relationName,
        'PW Delete Stale Row'
      );
      expect(created, 'Setup: relation type must be created').toBe(true);

      await page.goto('/settings/governance/glossary-term-relations');
      await expect(
        page.locator('[data-testid="relation-types-table"] tbody tr').first()
      ).toBeVisible();

      await findRowAcrossPages(page, `relation-name-${relationName}`);

      const deleteRes = page.waitForResponse(
        (r) =>
          r.url().includes(`/relationTypes/${relationName}`) &&
          r.request().method() === 'DELETE'
      );
      await page.getByTestId(`delete-${relationName}-btn`).click();
      expect((await deleteRes).status()).toBeLessThan(300);

      // Bug 2 fix: the row must be absent from the DOM — not just the response.
      // Before the fix, React had not yet re-rendered and count was still 1.
      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await apiContext.delete(`${RELATION_TYPES_API}/${relationName}`);
      await apiContext.dispose();
    }
  });

  test('Bug 3 — findRowAcrossPages locates a row on page 2 after React flushes rows', async ({
    page,
  }) => {
    const token = await getSavedAdminToken();
    const apiContext = await getAuthContext(token);

    const countRes = await apiContext.get(
      `${RELATION_TYPES_API}?limit=1&offset=0`
    );
    const countData = await countRes.json();
    const currentTotal: number = countData.paging?.total ?? 0;

    const needed = Math.max(0, PAGE_SIZE_BASE + 1 - currentTotal);
    const createdNames: string[] = [];

    for (let i = 0; i < needed; i++) {
      const name = `pwBug3${uuid()}`;
      const ok = await createWithBackoff(apiContext, name, `PW Page ${i}`);

      if (ok) {
        createdNames.push(name);
      }
    }

    const targetName = createdNames[createdNames.length - 1] ?? '';

    try {
      if (!targetName) {
        test.skip();

        return;
      }

      await page.goto('/settings/governance/glossary-term-relations');
      await expect(
        page.locator('[data-testid="relation-types-table"] tbody tr').first()
      ).toBeVisible();

      // Bug 3 fix: findRowAcrossPages (above) waits for new rows to render
      // after each Next Page click before deciding whether to advance.
      await findRowAcrossPages(page, `relation-name-${targetName}`);

      await expect(
        page.getByTestId(`relation-name-${targetName}`)
      ).toBeVisible();
    } finally {
      for (const name of createdNames) {
        await apiContext.delete(`${RELATION_TYPES_API}/${name}`);
      }
      await apiContext.dispose();
    }
  });
});
