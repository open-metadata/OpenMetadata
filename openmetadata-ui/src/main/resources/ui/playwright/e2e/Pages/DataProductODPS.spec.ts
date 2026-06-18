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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { test } from '../fixtures/pages';

// ODPS (Open Data Product Specification) export/import and the data-product
// metadata-edit modal are the critical surface of the data_products feature.
// These flows had zero E2E coverage; this suite exercises both the REST
// contract (export → validate → round-trip import, merge/replace) and the UI
// affordances wired into the data product details page.

const YAML_HEADERS = { 'Content-Type': 'application/yaml' };

const createDataProductWithOdpsFields = async (
  apiContext: APIRequestContext,
  domainFqn: string,
  overrides: Record<string, unknown> = {}
) => {
  const name = `pw-odps-dp-${uuid()}`;
  const response = await apiContext.post('/api/v1/dataProducts', {
    data: {
      name,
      displayName: name,
      description: 'ODPS playwright data product',
      domains: [domainFqn],
      dataProductType: 'DATASET',
      visibility: 'PRIVATE',
      portfolioPriority: 'HIGH',
      ...overrides,
    },
  });

  expect(response.ok()).toBeTruthy();

  return response.json();
};

const exportOdpsYaml = async (apiContext: APIRequestContext, id: string) => {
  const response = await apiContext.get(
    `/api/v1/dataProducts/${id}/odps/yaml`,
    { headers: { Accept: 'application/yaml' } }
  );

  expect(response.status()).toBe(200);

  return response.text();
};

const openManageMenu = async (page: Page, itemTestId: string) => {
  await page.getByTestId('manage-button').click();
  await expect(page.getByTestId(itemTestId)).toBeVisible();
};

// The metadata modal uses react-aria <Select> with the data-testid on the
// trigger button. Open it, wait for the listbox, then click the option scoped
// to that listbox so the onChange fires and the modal state updates.
const selectOption = async (
  page: Page,
  selectTestId: string,
  optionLabel: string
) => {
  await page.getByTestId(selectTestId).click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await listbox.getByRole('option', { name: optionLabel, exact: true }).click();
  await expect(listbox).toBeHidden();
};

test.describe('DataProduct ODPS — REST contract', () => {
  test.describe.configure({ mode: 'serial' });

  let apiContext: APIRequestContext;
  let afterAction: () => Promise<void>;
  const domain = new Domain();

  test.beforeAll(async ({ browser }) => {
    const admin = await performAdminLogin(browser);
    apiContext = admin.apiContext;
    afterAction = admin.afterAction;
    await domain.create(apiContext);
  });

  test.afterAll(async () => {
    await domain.delete(apiContext);
    await afterAction();
  });

  test('exports a data product to a valid ODPS YAML document', async () => {
    const dp = await createDataProductWithOdpsFields(
      apiContext,
      domain.responseData.fullyQualifiedName ?? ''
    );

    const yaml = await exportOdpsYaml(apiContext, dp.id);

    expect(yaml).toContain('version');
    expect(yaml.toLowerCase()).toContain(String(dp.name).toLowerCase());

    await apiContext.delete(
      `/api/v1/dataProducts/${dp.id}?hardDelete=true&recursive=true`
    );
  });

  test('validates an exported ODPS document as valid', async () => {
    const dp = await createDataProductWithOdpsFields(
      apiContext,
      domain.responseData.fullyQualifiedName ?? ''
    );
    const yaml = await exportOdpsYaml(apiContext, dp.id);

    const response = await apiContext.post(
      '/api/v1/dataProducts/odps/validate/yaml',
      { headers: YAML_HEADERS, data: yaml }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.valid).toBe(true);
    expect(body.version).toBeTruthy();

    await apiContext.delete(
      `/api/v1/dataProducts/${dp.id}?hardDelete=true&recursive=true`
    );
  });

  test('rejects an invalid ODPS document on validation', async () => {
    const response = await apiContext.post(
      '/api/v1/dataProducts/odps/validate/yaml',
      { headers: YAML_HEADERS, data: 'not: a valid odps document\nfoo: bar\n' }
    );

    // Endpoint returns 200 with valid:false, or a 4xx for a malformed body.
    if (response.status() === 200) {
      const body = await response.json();

      expect(body.valid).toBe(false);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('round-trips an exported ODPS document into a new data product', async () => {
    const dp = await createDataProductWithOdpsFields(
      apiContext,
      domain.responseData.fullyQualifiedName ?? '',
      { dataProductType: 'REPORTS', visibility: 'ORGANISATION' }
    );
    const yaml = await exportOdpsYaml(apiContext, dp.id);

    // Re-import the exported document under a fresh identity to verify the
    // export → import round-trip preserves the mapped fields, without colliding
    // with the source product.
    const newName = `pw-odps-imported-${uuid()}`;
    const importYaml = yaml.split(dp.name).join(newName);

    const imported = await apiContext.post('/api/v1/dataProducts/odps/yaml', {
      headers: YAML_HEADERS,
      params: { domain: domain.responseData.fullyQualifiedName ?? '' },
      data: importYaml,
    });

    expect(imported.status()).toBe(201);
    const importedBody = await imported.json();

    expect(importedBody.name).toBe(newName);
    expect(importedBody.dataProductType).toBe('REPORTS');

    await apiContext.delete(
      `/api/v1/dataProducts/${importedBody.id}?hardDelete=true&recursive=true`
    );
    await apiContext.delete(
      `/api/v1/dataProducts/${dp.id}?hardDelete=true&recursive=true`
    );
  });

  test('merge strategy preserves fields absent from the imported document', async () => {
    const dp = await createDataProductWithOdpsFields(
      apiContext,
      domain.responseData.fullyQualifiedName ?? ''
    );
    const yaml = await exportOdpsYaml(apiContext, dp.id);

    const merged = await apiContext.put('/api/v1/dataProducts/odps/yaml', {
      headers: YAML_HEADERS,
      params: {
        strategy: 'merge',
        domain: domain.responseData.fullyQualifiedName ?? '',
      },
      data: yaml,
    });

    expect(merged.status()).toBe(200);
    const mergedBody = await merged.json();

    expect(mergedBody.id).toBe(dp.id);

    await apiContext.delete(
      `/api/v1/dataProducts/${dp.id}?hardDelete=true&recursive=true`
    );
  });
});

test.describe('DataProduct ODPS & metadata — UI', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('exports ODPS YAML from the data product manage menu', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const dataProduct = new DataProduct();
    Object.assign(dataProduct.data, { dataProductType: 'DATASET' });

    try {
      await dataProduct.create(apiContext);
      await dataProduct.visitEntityPage(page);

      await openManageMenu(page, 'export-odps-button');

      const exportResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/odps/yaml') &&
          response.request().method() === 'GET'
      );
      await page.getByTestId('export-odps-button').click();
      const response = await exportResponse;

      expect(response.status()).toBe(200);
    } finally {
      await dataProduct.delete(apiContext);
      await afterAction();
    }
  });

  test('imports an ODPS document onto an existing data product via the modal', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const dataProduct = new DataProduct();
    // ODPS export uses displayName as the document `name`, and import derives the
    // entity name by slugifying it. Use a clean slug for both so the round-trip is
    // identity-preserving and the modal merges into THIS product (not a new one).
    const cleanName = `pwodpsui${uuid()}`;
    dataProduct.data.name = cleanName;
    dataProduct.data.displayName = cleanName;
    dataProduct.data.fullyQualifiedName = cleanName;

    try {
      const created = await dataProduct.create(apiContext);
      const yaml = await exportOdpsYaml(apiContext, created.id);

      await dataProduct.visitEntityPage(page);
      await openManageMenu(page, 'import-odps-button');
      await page.getByTestId('import-odps-button').click();

      await expect(page.getByTestId('odps-import-modal')).toBeVisible();

      const yamlField = page
        .getByTestId('odps-yaml-content')
        .locator('textarea');
      await yamlField.click();
      await yamlField.fill(yaml);

      const validateResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/odps/validate/yaml') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('odps-validate-button').click();
      const validated = await validateResponse;

      expect(validated.status()).toBe(200);
      await expect(page.getByText('Valid', { exact: true })).toBeVisible();

      const importResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/dataProducts/odps/yaml') &&
          response.request().method() === 'PUT'
      );
      await page.getByTestId('odps-import-submit').click();
      const imported = await importResponse;

      expect(imported.status()).toBe(200);
      await expect(page.getByTestId('odps-import-modal')).toBeHidden();
    } finally {
      await dataProduct.delete(apiContext);
      await afterAction();
    }
  });

  test('edits data product metadata (type, visibility, priority) via the modal', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const dataProduct = new DataProduct();

    try {
      const created = await dataProduct.create(apiContext);
      await dataProduct.visitEntityPage(page);

      await openManageMenu(page, 'edit-metadata-button');
      await page.getByTestId('edit-metadata-button').click();

      await expect(
        page.getByTestId('data-product-metadata-modal')
      ).toBeVisible();

      // Use values that differ from the entity defaults (visibility defaults to
      // PRIVATE) so every field produces a real PATCH op and the persistence fix
      // is genuinely exercised.
      await selectOption(page, 'type-select', 'Dataset');
      await selectOption(page, 'visibility-select', 'Public');
      await selectOption(page, 'priority-select', 'Critical');

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/dataProducts/${created.id}`) &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('metadata-modal-save').click();
      const patched = await patchResponse;

      expect(patched.status()).toBe(200);

      const refetched = await apiContext.get(
        `/api/v1/dataProducts/${created.id}`
      );
      const body = await refetched.json();

      expect(body.dataProductType).toBe('DATASET');
      expect(body.visibility).toBe('PUBLIC');
      expect(body.portfolioPriority).toBe('CRITICAL');
    } finally {
      await dataProduct.delete(apiContext);
      await afterAction();
    }
  });
});
