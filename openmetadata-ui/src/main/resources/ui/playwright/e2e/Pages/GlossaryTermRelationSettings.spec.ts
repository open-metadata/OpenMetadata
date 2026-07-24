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
  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes(RELATION_TYPES_API) &&
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
      const relationshipType = await createRelationTypeViaApi(apiContext, {
        name: relationName,
        displayName: 'PW Delete',
      });

      await goToRelationSettings(page);

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
});
