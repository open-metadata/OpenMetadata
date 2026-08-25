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

import test, { APIRequestContext, expect, Page } from '@playwright/test';
import { authenticateAdminPage } from '../../utils/admin';
import {
  getApiContext,
  getAuthContext,
  getSavedAdminToken,
  toastNotification,
  uuid,
} from '../../utils/common';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const PAGE_SIZE_BASE = 15;
const RELATION_SETTINGS_ROUTE = '/settings/governance/glossary-term-relations';
const RELATION_TYPES_API =
  '/api/v1/system/settings/glossaryTermRelationSettings/relationTypes';
const SYSTEM_DEFINED_RELATION = 'relatedTo';

type RelationTypePayload = {
  name: string;
  displayName: string;
  category?: string;
};

const buildRelationName = () => `pwRel${uuid()}`;
const CONFLICT_STATUS = 412;
const CONFLICT_RETRY_LIMIT = 5;

const createRelationTypeViaApi = async (
  apiContext: APIRequestContext,
  payload: RelationTypePayload
) => {
  for (let attempt = 0; attempt < CONFLICT_RETRY_LIMIT; attempt++) {
    const response = await apiContext.post(RELATION_TYPES_API, {
      data: {
        category: 'associative',
        ...payload,
      },
    });

    if (response.status() !== CONFLICT_STATUS) {
      expect(response.status()).toBe(201);

      return;
    }

    // Exponential backoff: 100 ms → 200 ms → 400 ms → 800 ms → 1 600 ms.
    // A bare spin-loop gives other workers no time to release the settings
    // singleton lock, so all retries collide and exhaust before one lands.
    if (attempt < CONFLICT_RETRY_LIMIT - 1) {
      await sleep(100 * Math.pow(2, attempt));
    }
  }

  throw new Error(
    `Failed to create relation type '${payload.name}' after ${CONFLICT_RETRY_LIMIT} conflict retries`
  );
};

const deleteRelationTypeViaApi = async (
  apiContext: APIRequestContext,
  name: string
) => {
  for (let attempt = 0; attempt < CONFLICT_RETRY_LIMIT; attempt++) {
    const response = await apiContext.delete(`${RELATION_TYPES_API}/${name}`);

    if (response.status() !== CONFLICT_STATUS) {
      return;
    }

    if (attempt < CONFLICT_RETRY_LIMIT - 1) {
      await sleep(100 * Math.pow(2, attempt));
    }
  }
};

const goToRelationSettings = async (page: Page) => {
  await page.goto(RELATION_SETTINGS_ROUTE);
  // Wait for at least one row rather than intercepting the API response.
  // React Query may serve data from cache without a network request, so
  // page.waitForResponse would hang forever on repeat navigations.
  await expect(
    page.locator('[data-testid="relation-types-table"] tbody tr').first()
  ).toBeVisible();
};

const fillInput = async (page: Page, testId: string, value: string) => {
  await page.getByTestId(testId).locator('input').fill(value);
};

const selectOption = async (page: Page, testId: string, option: string) => {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

// The drawer's save fires a single non-retrying write against the shared
// settings singleton, so a peer worker committing in the same instant can make
// it lose the compare-and-set (412). The drawer stays open on failure, so retry
// the click until the mutation lands, matching how every other writer to this
// singleton self-heals under parallel execution.
const submitRelationForm = async (
  page: Page,
  method: 'POST' | 'PUT',
  urlPart: string
) => {
  await expect(async () => {
    const mutation = page.waitForResponse(
      (response) =>
        response.url().includes(urlPart) &&
        response.request().method() === method
    );
    await page.getByTestId('save-btn').click();

    expect((await mutation).status()).toBeLessThan(300);
  }).toPass();
};

const deleteRelationInUi = async (page: Page, name: string) => {
  await expect(async () => {
    const mutation = page.waitForResponse(
      (response) =>
        response.url().includes(`/relationTypes/${name}`) &&
        response.request().method() === 'DELETE'
    );
    await page.getByTestId(`delete-${name}-btn`).click();

    expect((await mutation).status()).toBeLessThan(300);
  }).toPass();

  // Wait for React to remove the row from the DOM — the API response arrives
  // before the re-render, so asserting immediately after toPass() can still
  // see count=1 from the stale DOM.
  await expect(page.getByTestId(`relation-name-${name}`)).toHaveCount(0);
};

// Parallel test workers can push the table past PAGE_SIZE_BASE, putting the
// target row on page 2+. Navigate forward page-by-page until the row is
// visible, so individual CRUD tests remain stable regardless of total count.
//
// Uses waitFor (not isVisible) so React has time to flush new rows after each
// page navigation before we decide whether to advance. isVisible() is
// instantaneous and would read the stale DOM from the previous page,
// causing the loop to skip the target and eventually throw.
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

    if (found) return;

    const nextBtn = page.getByRole('button', { name: 'Next Page' }).first();

    if ((await nextBtn.count()) === 0 || !(await nextBtn.isEnabled())) {
      throw new Error(`testId "${testId}" not found on any page`);
    }

    const nextPageResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/glossaryTermRelationSettings/relationTypes') &&
        response.request().method() === 'GET'
    );
    await nextBtn.click();
    await nextPageResponse;

    // The GET response arrives before React renders the new page's rows.
    // Wait for at least one row to be visible so the next loop iteration
    // reads the correct DOM instead of the stale previous page.
    await page
      .locator('[data-testid="relation-types-table"] tbody tr')
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 });
  }
};

test.describe('Glossary Term Relation Settings', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAdminPage(page);
  });

  test('creates a custom relation type via the drawer', async ({ page }) => {
    const relationName = buildRelationName();
    const displayName = `PW Relation ${uuid()}`;
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await goToRelationSettings(page);

      await page.getByTestId('add-relation-type-btn').click();
      await expect(page.getByTestId('relation-type-drawer')).toBeVisible();

      await fillInput(page, 'name-input', relationName);
      await fillInput(page, 'display-name-input', displayName);
      await selectOption(page, 'category-select', 'Associative');
      await selectOption(page, 'cardinality-select', 'One to Many');

      await submitRelationForm(page, 'POST', '/relationTypes');

      await toastNotification(page, 'Relation Type updated successfully.');

      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toBeVisible();
    } finally {
      await deleteRelationTypeViaApi(apiContext, relationName);
      await afterAction();
    }
  });

  test('edits a custom relation type and keeps the name immutable', async ({
    page,
  }) => {
    const relationName = buildRelationName();
    const updatedDisplayName = `PW Updated ${uuid()}`;
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await createRelationTypeViaApi(apiContext, {
        name: relationName,
        displayName: 'PW Original',
      });

      await goToRelationSettings(page);

      await findRowAcrossPages(page, `edit-${relationName}-btn`);
      await page.getByTestId(`edit-${relationName}-btn`).click();
      await expect(page.getByTestId('relation-type-drawer')).toBeVisible();

      await expect(
        page.getByTestId('name-input').locator('input')
      ).toBeDisabled();

      await fillInput(page, 'display-name-input', updatedDisplayName);

      await submitRelationForm(page, 'PUT', `/relationTypes/${relationName}`);

      await toastNotification(page, 'Relation Type updated successfully.');

      await expect(page.getByText(updatedDisplayName)).toBeVisible();
    } finally {
      await deleteRelationTypeViaApi(apiContext, relationName);
      await afterAction();
    }
  });

  test('rejects duplicate relation-type names with an inline error', async ({
    page,
  }) => {
    await goToRelationSettings(page);

    await page.getByTestId('add-relation-type-btn').click();
    await fillInput(page, 'name-input', SYSTEM_DEFINED_RELATION);
    await fillInput(page, 'display-name-input', 'PW Duplicate Copy');
    await selectOption(page, 'cardinality-select', 'Many to Many');

    await page.getByTestId('save-btn').click();

    await expect(page.getByText('Relation Type already exists.')).toBeVisible();
    await expect(page.getByTestId('relation-type-drawer')).toBeVisible();
  });

  test('deletes a custom relation type', async ({ page }) => {
    const relationName = buildRelationName();
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await createRelationTypeViaApi(apiContext, {
        name: relationName,
        displayName: 'PW Delete',
      });

      await goToRelationSettings(page);

      await findRowAcrossPages(page, `relation-name-${relationName}`);
      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toBeVisible();

      await deleteRelationInUi(page, relationName);

      await toastNotification(page, 'Relation Type deleted successfully!');

      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toHaveCount(0);
    } finally {
      await deleteRelationTypeViaApi(apiContext, relationName);
      await afterAction();
    }
  });

  test('locks system-defined relation types from edit and delete', async ({
    page,
  }) => {
    await goToRelationSettings(page);

    await findRowAcrossPages(page, `relation-name-${SYSTEM_DEFINED_RELATION}`);
    await expect(
      page.getByTestId(`relation-name-${SYSTEM_DEFINED_RELATION}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`edit-${SYSTEM_DEFINED_RELATION}-btn`)
    ).toBeDisabled();
    await expect(
      page.getByTestId(`delete-${SYSTEM_DEFINED_RELATION}-btn`)
    ).toBeDisabled();
  });

  test('paginates relation types when they exceed a page', async ({ page }) => {
    const createdNames: string[] = [];
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      // Seed enough of our own types that they exceed a single page on their
      // own. The 11 permanent system-defined types can never be deleted and
      // peers only ever add more, so total always stays above PAGE_SIZE_BASE
      // regardless of what else runs in parallel.
      for (let index = 0; index < PAGE_SIZE_BASE + 1; index++) {
        const name = buildRelationName();
        await createRelationTypeViaApi(apiContext, {
          name,
          displayName: `PW Page ${index}`,
        });
        createdNames.push(name);
      }

      await goToRelationSettings(page);

      await expect(page.getByLabel('Current page')).toBeVisible();
      await expect(
        page.getByTestId('relation-types-table').locator('tbody tr')
      ).toHaveCount(PAGE_SIZE_BASE);

      const nextPageResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/relationTypes') &&
          response.url().includes(`offset=${PAGE_SIZE_BASE}`) &&
          response.request().method() === 'GET'
      );

      await page.getByRole('button', { name: 'Next Page' }).first().click();

      expect((await nextPageResponse).ok()).toBe(true);
    } finally {
      for (const name of createdNames) {
        await deleteRelationTypeViaApi(apiContext, name);
      }
      await afterAction();
    }
  });

  // ── Parallel-execution regression tests ────────────────────────────────────
  //
  // These three tests explicitly exercise the race conditions that made the
  // suite flaky under --workers=2 CI runs. They are kept in the same file so
  // all relation-settings coverage is co-located.

  test('parallel API writers both succeed when exponential backoff is applied', async () => {
    // Two independent request contexts simulate two CI workers writing the
    // settings singleton simultaneously. A single context serialises requests
    // in the JS event loop and can never trigger a real 412.
    const token = await getSavedAdminToken();
    const [ctxA, ctxB] = await Promise.all([
      getAuthContext(token),
      getAuthContext(token),
    ]);

    const nameA = `pwParallelA${uuid()}`;
    const nameB = `pwParallelB${uuid()}`;

    try {
      const [resA, resB] = await Promise.all([
        createRelationTypeViaApi(ctxA, {
          name: nameA,
          displayName: 'PW Parallel A',
        }),
        createRelationTypeViaApi(ctxB, {
          name: nameB,
          displayName: 'PW Parallel B',
        }),
      ]);

      // createRelationTypeViaApi asserts status === 201 internally and throws
      // on exhaustion. Both calls resolving without throwing is sufficient
      // proof that both writers landed — no extra round-trip needed.
      expect(resA).toBeUndefined();
      expect(resB).toBeUndefined();
    } finally {
      await deleteRelationTypeViaApi(ctxA, nameA);
      await deleteRelationTypeViaApi(ctxB, nameB);
      await ctxA.dispose();
      await ctxB.dispose();
    }
  });

  test('delete removes the row from the DOM before the caller proceeds', async ({
    page,
  }) => {
    const token = await getSavedAdminToken();
    const apiContext = await getAuthContext(token);
    const relationName = `pwDeleteDOM${uuid()}`;

    try {
      await createRelationTypeViaApi(apiContext, {
        name: relationName,
        displayName: 'PW Delete DOM',
      });

      await goToRelationSettings(page);
      await findRowAcrossPages(page, `relation-name-${relationName}`);

      const deleteRes = page.waitForResponse(
        (r) =>
          r.url().includes(`/relationTypes/${relationName}`) &&
          r.request().method() === 'DELETE'
      );
      await page.getByTestId(`delete-${relationName}-btn`).click();
      expect((await deleteRes).status()).toBeLessThan(300);

      // The HTTP response arrives before React re-renders. Assert toHaveCount(0)
      // to confirm the row is gone from the DOM, not just from the API.
      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await deleteRelationTypeViaApi(apiContext, relationName);
      await apiContext.dispose();
    }
  });

  test('findRowAcrossPages locates a row when the table has multiple pages', async ({
    page,
  }) => {
    const token = await getSavedAdminToken();
    const apiContext = await getAuthContext(token);

    const targetName = `pwFindRow${uuid()}`;
    const fillerNames: string[] = [];

    try {
      // Seed enough rows so the table has at least two pages total, then create
      // the target. findRowAcrossPages must locate it regardless of which page
      // it lands on under the table's actual sort order.
      const countRes = await apiContext.get(
        `${RELATION_TYPES_API}?limit=1&offset=0`
      );
      const currentTotal: number = (await countRes.json()).paging?.total ?? 0;
      const fillerCount = Math.max(0, PAGE_SIZE_BASE + 1 - currentTotal);

      for (let i = 0; i < fillerCount; i++) {
        const name = `pwFiller${uuid()}`;
        await createRelationTypeViaApi(apiContext, {
          name,
          displayName: `PW Filler ${i}`,
        });
        fillerNames.push(name);
      }

      await createRelationTypeViaApi(apiContext, {
        name: targetName,
        displayName: 'PW Find Row Target',
      });

      await goToRelationSettings(page);

      // findRowAcrossPages waits for the first tbody row to appear after each
      // Next Page response so the correct page DOM is read on each iteration.
      await findRowAcrossPages(page, `relation-name-${targetName}`);
      await expect(
        page.getByTestId(`relation-name-${targetName}`)
      ).toBeVisible();
    } finally {
      await deleteRelationTypeViaApi(apiContext, targetName);
      for (const name of fillerNames) {
        await deleteRelationTypeViaApi(apiContext, name);
      }
      await apiContext.dispose();
    }
  });
});
