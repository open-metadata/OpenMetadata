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

/**
 * End-to-end coverage for the entity-reference custom property field
 * (CoreEntityRefSelect) rendered inside the intake form.
 *
 * Scenarios covered:
 *  1. Initial load — clicking the combobox fires a wildcard search and
 *     pre-populates the dropdown without the user having to type.
 *  2. Search-as-you-type — typing a term in the combobox triggers a
 *     scoped search and shows matching options.
 *  3. Single selection — selecting an option stores the entity reference
 *     in the correct shape in the API payload.
 *  4. Multiple selection (entityReferenceList) — selecting two items in
 *     multi mode stores an array in the payload.
 *  5. Multi-type allowedTypes — when allowedTypes contains more than one
 *     non-user/team type the search API is called with a comma-joined
 *     index (e.g. "glossaryTerm,table").
 */

import { APIRequestContext, expect, Page } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DP_ENTITY_TYPE = 'dataProduct';
const INTAKE_FORMS_API = '/api/v1/governance/intakeForms';
const SEARCH_QUERY_API = '/api/v1/search/query';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const ensureNoIntakeForm = async (
  api: APIRequestContext,
  entityType: string
) => {
  const res = await api.get(`${INTAKE_FORMS_API}?limit=100&include=all`);
  if (res.status() !== 200) {
    return;
  }
  const list = await res.json();
  const forms = (list.data ?? []) as Array<{ id: string; entityType: string }>;
  for (const form of forms) {
    if (form.entityType === entityType) {
      await api.delete(`${INTAKE_FORMS_API}/${form.id}?hardDelete=true`);
    }
  }
};

const ensureCustomProperty = async (
  api: APIRequestContext,
  entityType: string,
  propertyName: string,
  propertyTypeName: string,
  config?: unknown
) => {
  const typeRes = await api.get(
    `/api/v1/metadata/types/name/${entityType}?fields=customProperties`
  );
  expect(typeRes.status()).toBe(200);
  const type = await typeRes.json();
  const existing = (type.customProperties ?? []).find(
    (cp: { name: string }) => cp.name === propertyName
  );
  if (existing) {
    return;
  }
  const propTypeRes = await api.get(
    `/api/v1/metadata/types/name/${propertyTypeName}`
  );
  expect(propTypeRes.status()).toBe(200);
  const propertyType = await propTypeRes.json();
  const put = await api.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Entity-ref custom property for intake-form e2e tests',
      propertyType: { id: propertyType.id, type: 'type' },
      ...(config === undefined ? {} : { customPropertyConfig: { config } }),
    },
  });
  expect(put.status()).toBe(200);
};

const createIntakeForm = async (
  api: APIRequestContext,
  entityType: string,
  fieldPath: string,
  fieldLabel: string
) => {
  const res = await api.post(INTAKE_FORMS_API, {
    data: {
      name: entityType,
      entityType,
      enabled: true,
      requiredFields: [
        { fieldPath, fieldLabel, fieldKind: 'customProperty' },
      ],
    },
  });
  expect(res.status()).toBe(201);
};

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Open the "Add Data Product" form inside a domain page.
 * Waits for the intake form fetch so custom-property fields are rendered.
 */
const openAddDataProductForm = async (page: Page, domain: Domain) => {
  await redirectToHomePage(page);
  await domain.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  const dpTab = page.getByRole('tab', { name: /Data Product/i });
  if (await dpTab.isVisible()) {
    await dpTab.click();
  }

  const intakeFetch = page.waitForResponse(
    (r) =>
      r.url().includes(`${INTAKE_FORMS_API}/entityType/`) &&
      r.request().method() === 'GET'
  );

  // Retry until the Data Products menu item appears (permissions can resolve late).
  const addButton = page.getByRole('button', { name: /Add Data Product/i });
  if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addButton.click();
  } else {
    // Some domain pages surface the add action via a menu.
    const domainAddBtn = page.getByTestId('domain-details-add-button');
    await expect(domainAddBtn).toBeVisible({ timeout: 15000 });
    const dataProductsItem = page.getByRole('menuitem', {
      name: 'Data Products',
    });
    await expect(async () => {
      await page.keyboard.press('Escape');
      await domainAddBtn.click();
      await expect(dataProductsItem).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60000 });
    await dataProductsItem.click();
  }

  await intakeFetch;
  await expect(page.locator('form[data-testid="add-domain"]')).toBeVisible();
};

/**
 * Locate the combobox input inside a CoreEntityRefSelect field.
 */
const entityRefCombobox = (page: Page, testId: string) =>
  page
    .locator(`[data-testid="${testId}"] input[role="combobox"]`)
    .first();

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

// Intake forms are singleton per entityType — run all scenarios serially so
// each test gets a clean form without colliding with its siblings.
test.describe.configure({ mode: 'serial' });

test.describe(
  'IntakeForm — CoreEntityRefSelect entity-reference custom property',
  { tag: ['@Governance'] },
  () => {
    const domain = new Domain();
    const glossary = new Glossary();
    const term1 = new GlossaryTerm(glossary);
    const term2 = new GlossaryTerm(glossary);
    const suffix = uuid();

    const singleRefProp = `pwEntityRefSingle${suffix}`;
    const listRefProp = `pwEntityRefList${suffix}`;
    const multiTypeProp = `pwEntityRefMulti${suffix}`;

    test.beforeAll('Create fixtures', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await ensureNoIntakeForm(apiContext, DP_ENTITY_TYPE);
      await domain.create(apiContext);
      await glossary.create(apiContext);
      await term1.create(apiContext);
      await term2.create(apiContext);

      // Single entityReference → allowedTypes=['glossaryTerm']
      await ensureCustomProperty(
        apiContext,
        DP_ENTITY_TYPE,
        singleRefProp,
        'entityReference',
        ['glossaryTerm']
      );

      // entityReferenceList → allowedTypes=['glossaryTerm'] (multiple)
      await ensureCustomProperty(
        apiContext,
        DP_ENTITY_TYPE,
        listRefProp,
        'entityReferenceList',
        ['glossaryTerm']
      );

      // Single entityReference → allowedTypes=['glossaryTerm','table'] (multi-index)
      await ensureCustomProperty(
        apiContext,
        DP_ENTITY_TYPE,
        multiTypeProp,
        'entityReference',
        ['glossaryTerm', 'table']
      );

      await afterAction();
    });

    test.afterAll('Tear down fixtures', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_ENTITY_TYPE);
      await domain.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    });

    test.beforeEach('Reset intake form', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_ENTITY_TYPE);
      await afterAction();
    });

    // -----------------------------------------------------------------------
    // Scenario 1: Initial load — clicking the combobox fires a wildcard search
    // -----------------------------------------------------------------------
    test('clicking the entity-ref combobox fires an initial wildcard search and shows options', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the single-type entity ref property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createIntakeForm(
          apiContext,
          DP_ENTITY_TYPE,
          `extension.${singleRefProp}`,
          'Glossary Term Ref'
        );
        await afterAction();
      });

      await openAddDataProductForm(page, domain);

      const combobox = entityRefCombobox(page, `extension-${singleRefProp}`);
      await expect(combobox).toBeVisible({ timeout: 15000 });

      // Clicking the combobox should trigger onOpenChange(true) which fires a
      // wildcard search. The API receives q='' (rawSearchQuery skips '**').
      const wildcardSearch = page.waitForResponse(
        (r) =>
          r.url().includes(SEARCH_QUERY_API) &&
          new URL(r.url()).searchParams.get('index')?.includes('glossaryTerm') === true &&
          r.status() === 200
      );
      await combobox.click();
      await wildcardSearch;

      // Dropdown should open and show at least one option (the glossary terms
      // created in beforeAll are indexed and should be returned).
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible({ timeout: 15000 });
      await expect(listbox.getByRole('option').first()).toBeVisible({
        timeout: 15000,
      });
    });

    // -----------------------------------------------------------------------
    // Scenario 2: Search-as-you-type narrows results
    // -----------------------------------------------------------------------
    test('typing in the entity-ref combobox fires a scoped search and shows matching options', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createIntakeForm(
          apiContext,
          DP_ENTITY_TYPE,
          `extension.${singleRefProp}`,
          'Glossary Term Ref'
        );
        await afterAction();
      });

      await openAddDataProductForm(page, domain);

      const combobox = entityRefCombobox(page, `extension-${singleRefProp}`);
      await expect(combobox).toBeVisible({ timeout: 15000 });

      // Open the dropdown first (initial wildcard).
      await combobox.click();
      await page.waitForResponse(
        (r) => r.url().includes(SEARCH_QUERY_API) && r.status() === 200
      );

      // Now type a portion of term1's name to filter.
      const searchTerm = term1.randomName.slice(0, 6);
      const typedSearch = page.waitForResponse(
        (r) =>
          r.url().includes(SEARCH_QUERY_API) &&
          (new URL(r.url()).searchParams.get('q') ?? '').includes(
            searchTerm
          ) &&
          r.status() === 200
      );
      await combobox.fill(searchTerm);
      await typedSearch;

      // The option matching term1 should be visible.
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible({ timeout: 15000 });
      await expect(
        listbox.getByRole('option').filter({ hasText: new RegExp(term1.randomName, 'i') }).first()
      ).toBeVisible({ timeout: 15000 });
    });

    // -----------------------------------------------------------------------
    // Scenario 3: Single selection stores correct entity-reference shape
    // -----------------------------------------------------------------------
    test('selecting a glossaryTerm option stores the correct entity-reference in the API payload', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring entity ref', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createIntakeForm(
          apiContext,
          DP_ENTITY_TYPE,
          `extension.${singleRefProp}`,
          'Glossary Term Ref'
        );
        await afterAction();
      });

      await openAddDataProductForm(page, domain);

      const dpName = `intake-entity-ref-single-${uuid()}`;
      await page.getByTestId('name').locator('input').fill(dpName);
      await page
        .locator('.om-block-editor[contenteditable="true"]')
        .first()
        .fill('Entity-ref single-selection e2e test');

      // Open the entity-ref picker and select term1.
      const combobox = entityRefCombobox(page, `extension-${singleRefProp}`);
      await expect(combobox).toBeVisible({ timeout: 15000 });

      const searchResponse = page.waitForResponse(
        (r) =>
          r.url().includes(SEARCH_QUERY_API) &&
          new URL(r.url()).searchParams.get('index')?.includes('glossaryTerm') === true &&
          r.status() === 200
      );
      await combobox.click();
      await combobox.fill(term1.randomName);
      await searchResponse;

      const option = page
        .getByRole('option')
        .filter({ hasText: new RegExp(term1.data.displayName ?? term1.randomName, 'i') })
        .first();
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();

      // Submit and validate payload.
      const createRequest = page.waitForRequest(
        (req) =>
          req.url().endsWith('/api/v1/dataProducts') &&
          req.method() === 'POST'
      );
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/v1/dataProducts') &&
          r.request().method() === 'POST'
      );
      await page.getByTestId('save-btn').click();

      const req = await createRequest;
      const res = await createResponse;
      expect(res.status()).toBe(201);

      const payload = req.postDataJSON() as {
        extension: Record<string, unknown>;
      };
      const ref = payload.extension[singleRefProp];
      expect(ref).toBeDefined();
      expect(Array.isArray(ref)).toBe(false);
      expect((ref as Record<string, unknown>).type).toBe('glossaryTerm');
      expect(typeof (ref as Record<string, unknown>).id).toBe('string');

      // Clean up the created data product.
      const created = await res.json();
      const cleanup = await performAdminLogin(browser);
      await cleanup.apiContext.delete(
        `/api/v1/dataProducts/${created.id}?hardDelete=true`
      );
      await cleanup.afterAction();
    });

    // -----------------------------------------------------------------------
    // Scenario 4: Multiple selection (entityReferenceList) stores an array
    // -----------------------------------------------------------------------
    test('selecting two terms in list mode stores an array in the API payload', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the list entity ref property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createIntakeForm(
          apiContext,
          DP_ENTITY_TYPE,
          `extension.${listRefProp}`,
          'Related Terms'
        );
        await afterAction();
      });

      await openAddDataProductForm(page, domain);

      const dpName = `intake-entity-ref-list-${uuid()}`;
      await page.getByTestId('name').locator('input').fill(dpName);
      await page
        .locator('.om-block-editor[contenteditable="true"]')
        .first()
        .fill('Entity-ref list multi-selection e2e test');

      // Select term1.
      const combobox = entityRefCombobox(page, `extension-${listRefProp}`);
      await expect(combobox).toBeVisible({ timeout: 15000 });

      const search1 = page.waitForResponse(
        (r) =>
          r.url().includes(SEARCH_QUERY_API) &&
          new URL(r.url()).searchParams.get('index')?.includes('glossaryTerm') === true &&
          r.status() === 200
      );
      await combobox.click();
      await combobox.fill(term1.randomName);
      await search1;

      const option1 = page
        .getByRole('option')
        .filter({ hasText: new RegExp(term1.data.displayName ?? term1.randomName, 'i') })
        .first();
      await expect(option1).toBeVisible({ timeout: 15000 });
      await option1.click();

      // Select term2 — the picker stays open (chip-multi mode).
      await combobox.fill(term2.randomName);
      const search2 = page.waitForResponse(
        (r) =>
          r.url().includes(SEARCH_QUERY_API) &&
          (new URL(r.url()).searchParams.get('q') ?? '').includes(term2.randomName) &&
          r.status() === 200
      );
      await search2;
      const option2 = page
        .getByRole('option')
        .filter({ hasText: new RegExp(term2.data.displayName ?? term2.randomName, 'i') })
        .first();
      await expect(option2).toBeVisible({ timeout: 15000 });
      await option2.click();
      await page.keyboard.press('Escape');

      // Submit and validate that extension contains an array of two refs.
      const createRequest = page.waitForRequest(
        (req) =>
          req.url().endsWith('/api/v1/dataProducts') &&
          req.method() === 'POST'
      );
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/v1/dataProducts') &&
          r.request().method() === 'POST'
      );
      await page.getByTestId('save-btn').click();

      const req = await createRequest;
      const res = await createResponse;
      expect(res.status()).toBe(201);

      const payload = req.postDataJSON() as {
        extension: Record<string, unknown>;
      };
      const refs = payload.extension[listRefProp];
      expect(Array.isArray(refs)).toBe(true);
      expect((refs as unknown[]).length).toBe(2);
      for (const ref of refs as Array<Record<string, unknown>>) {
        expect(ref.type).toBe('glossaryTerm');
        expect(typeof ref.id).toBe('string');
      }

      // Clean up.
      const created = await res.json();
      const cleanup = await performAdminLogin(browser);
      await cleanup.apiContext.delete(
        `/api/v1/dataProducts/${created.id}?hardDelete=true`
      );
      await cleanup.afterAction();
    });

    // -----------------------------------------------------------------------
    // Scenario 5: Multi-type allowedTypes uses a comma-joined search index
    // -----------------------------------------------------------------------
    test('multi-type allowedTypes sends a comma-joined search index to the API', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the multi-type entity ref property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createIntakeForm(
          apiContext,
          DP_ENTITY_TYPE,
          `extension.${multiTypeProp}`,
          'Multi-Type Ref'
        );
        await afterAction();
      });

      await openAddDataProductForm(page, domain);

      const combobox = entityRefCombobox(page, `extension-${multiTypeProp}`);
      await expect(combobox).toBeVisible({ timeout: 15000 });

      // The search index must contain BOTH configured types joined by a comma.
      const multiIndexSearch = page.waitForResponse(
        (r) => {
          if (!r.url().includes(SEARCH_QUERY_API) || r.status() !== 200) {
            return false;
          }
          const index = new URL(r.url()).searchParams.get('index') ?? '';

          return index.includes('glossaryTerm') && index.includes('table');
        }
      );

      await combobox.click();
      await multiIndexSearch;

      // Dropdown should open.
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible({ timeout: 15000 });
    });

    // -----------------------------------------------------------------------
    // Scenario 6: Clearing a selected entity-reference removes it from the value
    // -----------------------------------------------------------------------
    test('clearing a selected entity-reference removes the selection', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await createIntakeForm(
          apiContext,
          DP_ENTITY_TYPE,
          `extension.${singleRefProp}`,
          'Glossary Term Ref'
        );
        await afterAction();
      });

      await openAddDataProductForm(page, domain);

      const fieldContainer = page.getByTestId(`extension-${singleRefProp}`);
      const combobox = entityRefCombobox(page, `extension-${singleRefProp}`);
      await expect(combobox).toBeVisible({ timeout: 15000 });

      // Select term1.
      const search = page.waitForResponse(
        (r) =>
          r.url().includes(SEARCH_QUERY_API) &&
          new URL(r.url()).searchParams.get('index')?.includes('glossaryTerm') === true &&
          r.status() === 200
      );
      await combobox.click();
      await combobox.fill(term1.randomName);
      await search;

      const option = page
        .getByRole('option')
        .filter({ hasText: new RegExp(term1.data.displayName ?? term1.randomName, 'i') })
        .first();
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await page.keyboard.press('Escape');

      // A chip or badge showing the selected term should be visible.
      const selectedLabel = term1.data.displayName ?? term1.randomName;
      const chip = fieldContainer
        .locator(`text=${selectedLabel}`)
        .or(
          fieldContainer.getByRole('option', { name: selectedLabel })
        )
        .first();
      await expect(chip).toBeVisible({ timeout: 10000 });

      // Clear the selection by clicking the remove button on the chip.
      // The chip typically has a close/remove button (×) next to the label.
      const removeBtn = fieldContainer
        .locator('[aria-label*="remove"], [aria-label*="Remove"], button[data-key]')
        .first();

      if (await removeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await removeBtn.click();
        // After clearing, the chip label should no longer be visible.
        await expect(chip).not.toBeVisible({ timeout: 5000 });
      } else {
        // If no explicit remove button, clear via keyboard (Backspace in combobox).
        await combobox.click();
        await page.keyboard.press('Backspace');
        // Combobox should be empty and no chip visible.
        await expect(combobox).toHaveValue('', { timeout: 5000 });
      }
    });
  }
);
