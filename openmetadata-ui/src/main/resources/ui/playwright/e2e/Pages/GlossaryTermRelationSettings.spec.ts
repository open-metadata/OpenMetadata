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
import { getApiContext, toastNotification, uuid } from '../../utils/common';

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
  }
};

const goToRelationSettings = async (page: Page) => {
  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/glossaryTermRelationSettings/relationTypes') &&
      response.request().method() === 'GET'
  );
  await page.goto(RELATION_SETTINGS_ROUTE);
  await listResponse;

  await expect(page.getByTestId('relation-types-table')).toBeVisible();
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
});
