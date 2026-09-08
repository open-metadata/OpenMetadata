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

const PAGE_SIZE_BASE = 15;
const RELATION_SETTINGS_ROUTE = '/settings/governance/glossary-term-relations';
const RELATION_TYPES_API = '/api/v1/relationshipTypes';
const SYSTEM_DEFINED_RELATION = 'broader';

type RelationTypePayload = {
  name: string;
  displayName: string;
};

type RelationshipTypeResponse = RelationTypePayload & { id: string };

const buildRelationName = () => `pwRel${uuid()}`;

const createRelationTypeViaApi = async (
  apiContext: APIRequestContext,
  payload: RelationTypePayload
) => {
  const response = await apiContext.post(RELATION_TYPES_API, {
    data: {
      ...payload,
      category: 'CUSTOM',
      description: '',
      paletteKey: 'BLUE',
      rdfPredicate: `https://example.org/${payload.name}`,
    },
  });
  expect(response.status()).toBe(201);

  return response.json() as Promise<RelationshipTypeResponse>;
};

const deleteRelationTypeViaApi = async (
  apiContext: APIRequestContext,
  id: string
) => {
  const response = await apiContext.delete(`${RELATION_TYPES_API}/${id}`);
  expect([200, 204, 404]).toContain(response.status());
};

const deleteRelationTypeByNameViaApi = async (
  apiContext: APIRequestContext,
  name: string
) => {
  const response = await apiContext.get(
    `${RELATION_TYPES_API}/name/${encodeURIComponent(name)}`
  );
  if (response.ok()) {
    const relationshipType =
      (await response.json()) as RelationshipTypeResponse;
    await deleteRelationTypeViaApi(apiContext, relationshipType.id);
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

const submitRelationForm = async (
  page: Page,
  method: 'POST' | 'PUT',
  urlPart: string
) => {
  const mutation = page.waitForResponse(
    (response) =>
      response.url().includes(urlPart) && response.request().method() === method
  );
  await page.getByTestId('save-btn').click();

  expect((await mutation).status()).toBeLessThan(300);
};

const deleteRelationInUi = async (page: Page, id: string, name: string) => {
  const mutation = page.waitForResponse(
    (response) =>
      response.url().includes(`${RELATION_TYPES_API}/${id}`) &&
      response.request().method() === 'DELETE'
  );
  await page.getByTestId(`delete-${name}-btn`).click();
  await page.getByTestId('confirm-delete-btn').click();

  expect((await mutation).status()).toBeLessThan(300);

  // Wait for React to remove the row from the DOM — the API response arrives
  // before the re-render, so the helper must not return while the stale row remains.
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

    const currentPage = page.getByLabel('Current page');
    const pageNumber = Number(await currentPage.inputValue());
    await nextBtn.click();
    await expect(currentPage).toHaveValue(String(pageNumber + 1));

    // The page indicator is the cache-safe signal that pagination completed. Wait for a row too so
    // the next iteration reads the rendered page rather than the previous DOM.
    await page
      .locator('[data-testid="relation-types-table"] tbody tr')
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 });
  }
};

test.describe('Glossary Term Relation Settings', () => {
  test.describe.configure({ mode: 'serial' });

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
      await fillInput(
        page,
        'rdf-predicate-input',
        `https://example.org/${relationName}`
      );
      await selectOption(page, 'cardinality-select', 'One to Many');

      await submitRelationForm(page, 'POST', RELATION_TYPES_API);

      await toastNotification(page, 'Relation Type created successfully.');

      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toBeVisible();
    } finally {
      await deleteRelationTypeByNameViaApi(apiContext, relationName);
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

      await submitRelationForm(page, 'PUT', RELATION_TYPES_API);

      await toastNotification(page, 'Relation Type updated successfully.');

      await expect(page.getByText(updatedDisplayName)).toBeVisible();
    } finally {
      await deleteRelationTypeByNameViaApi(apiContext, relationName);
      await afterAction();
    }
  });

  test('rejects duplicate relation-type names and keeps the drawer open', async ({
    page,
  }) => {
    await goToRelationSettings(page);

    await page.getByTestId('add-relation-type-btn').click();
    await fillInput(page, 'name-input', SYSTEM_DEFINED_RELATION);
    await fillInput(page, 'display-name-input', 'PW Duplicate Copy');
    await fillInput(
      page,
      'rdf-predicate-input',
      `https://example.org/duplicate-${uuid()}`
    );
    await selectOption(page, 'cardinality-select', 'Many to Many');

    await page.getByTestId('save-btn').click();

    await toastNotification(page, /already exists/i);
    await expect(page.getByTestId('relation-type-drawer')).toBeVisible();
  });

  test('deletes a custom relation type', async ({ page }) => {
    const relationName = buildRelationName();
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      const relationshipType = await createRelationTypeViaApi(apiContext, {
        name: relationName,
        displayName: 'PW Delete',
      });

      await goToRelationSettings(page);

      await findRowAcrossPages(page, `relation-name-${relationName}`);
      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toBeVisible();

      await deleteRelationInUi(page, relationshipType.id, relationName);

      await toastNotification(page, 'Relation Type deleted successfully!');

      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toHaveCount(0);
    } finally {
      await deleteRelationTypeByNameViaApi(apiContext, relationName);
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
    const createdRelationshipTypes: RelationshipTypeResponse[] = [];
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      for (let index = 0; index < PAGE_SIZE_BASE + 1; index++) {
        const name = buildRelationName();
        createdRelationshipTypes.push(
          await createRelationTypeViaApi(apiContext, {
            name,
            displayName: `PW Page ${index}`,
          })
        );
      }

      await goToRelationSettings(page);

      await expect(page.getByLabel('Current page')).toBeVisible();
      await expect(
        page.getByTestId('relation-types-table').locator('tbody tr')
      ).toHaveCount(PAGE_SIZE_BASE);

      await page.getByRole('button', { name: 'Next Page' }).first().click();

      await expect(page.getByLabel('Current page')).toHaveValue('2');
    } finally {
      for (const relationshipType of createdRelationshipTypes) {
        await deleteRelationTypeViaApi(apiContext, relationshipType.id);
      }
      await afterAction();
    }
  });

  // ── Parallel-execution regression tests ────────────────────────────────────
  //
  // These tests exercise the parallel and pagination paths that previously made this suite flaky
  // under multi-worker CI runs.

  test('parallel API writers both create relationship types', async () => {
    // Independent request contexts ensure the first-class relationship type API accepts concurrent
    // writers rather than only serialized requests from one browser session.
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

      expect(resA.id).toBeTruthy();
      expect(resB.id).toBeTruthy();
    } finally {
      await deleteRelationTypeByNameViaApi(ctxA, nameA);
      await deleteRelationTypeByNameViaApi(ctxB, nameB);
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
      const relationshipType = await createRelationTypeViaApi(apiContext, {
        name: relationName,
        displayName: 'PW Delete DOM',
      });

      await goToRelationSettings(page);
      await findRowAcrossPages(page, `relation-name-${relationName}`);

      await deleteRelationInUi(page, relationshipType.id, relationName);

      // The HTTP response arrives before React re-renders. Assert toHaveCount(0)
      // to confirm the row is gone from the DOM, not just from the API.
      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await deleteRelationTypeByNameViaApi(apiContext, relationName);
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

      // findRowAcrossPages waits for the page indicator and rendered rows before inspecting the
      // next page.
      await findRowAcrossPages(page, `relation-name-${targetName}`);
      await expect(
        page.getByTestId(`relation-name-${targetName}`)
      ).toBeVisible();
    } finally {
      await deleteRelationTypeByNameViaApi(apiContext, targetName);
      for (const name of fillerNames) {
        await deleteRelationTypeByNameViaApi(apiContext, name);
      }
      await apiContext.dispose();
    }
  });
});
