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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { performAdminLogin } from '../../utils/admin';
import { descriptionBox, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const DOMAIN_ENTITY_TYPE = 'domain';
const ID = uuid();

const CP = {
  str: `pwCpString${ID}`,
  table: `pwCpTable${ID}`,
  link: `pwCpLink${ID}`,
  interval: `pwCpInterval${ID}`,
  ref: `pwCpRef${ID}`,
};

const ensureNoIntakeForm = async (
  api: APIRequestContext,
  entityType: string
) => {
  const listRes = await api.get(
    '/api/v1/governance/intakeForms?limit=100&include=all'
  );
  if (listRes.status() !== 200) {
    return;
  }
  const list = await listRes.json();
  const forms = (list.data ?? []) as Array<{ id: string; entityType: string }>;
  for (const form of forms) {
    if (form.entityType === entityType) {
      await api.delete(
        `/api/v1/governance/intakeForms/${form.id}?hardDelete=true`
      );
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
  const exists = (type.customProperties ?? []).some(
    (cp: { name: string }) => cp.name === propertyName
  );
  if (exists) {
    return;
  }
  const propertyTypeRes = await api.get(
    `/api/v1/metadata/types/name/${propertyTypeName}`
  );
  expect(propertyTypeRes.status()).toBe(200);
  const propertyType = await propertyTypeRes.json();
  const put = await api.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Custom property for intake-form field playwright test',
      propertyType: { id: propertyType.id, type: 'type' },
      ...(config === undefined ? {} : { customPropertyConfig: { config } }),
    },
  });
  expect(put.status()).toBe(200);
};

const createIntakeForm = async (
  api: APIRequestContext,
  entityType: string,
  requiredPropertyNames: string[]
) => {
  const response = await api.post('/api/v1/governance/intakeForms', {
    data: {
      name: entityType,
      entityType,
      enabled: true,
      formFields: requiredPropertyNames.map((name) => ({
        fieldPath: `extension.${name}`,
        fieldLabel: name,
        fieldKind: 'customProperty',
        required: true,
      })),
    },
  });
  expect(response.status()).toBe(201);
};

const extensionInput = (page: Page, testId: string) =>
  page
    .locator(
      `[data-testid="${testId}"] input, input[data-testid="${testId}"], textarea[data-testid="${testId}"]`
    )
    .first();

// Mirrors the selectExtensionReference helper in IntakeForm.spec.ts: waits for
// the search response before asserting the option is visible, so the test
// doesn't race the async search API call under CI load.
const selectExtensionReference = async ({
  page,
  testId,
  query,
  optionText,
}: {
  page: Page;
  testId: string;
  query: string;
  optionText: string;
}) => {
  const searchResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname.endsWith('/api/v1/search/query') &&
      (url.searchParams.get('q') ?? '').includes(query) &&
      response.status() === 200
    );
  });
  const input = page
    .locator(
      `[data-testid="${testId}"] input[role="combobox"], [data-testid="${testId}"][role="combobox"]`
    )
    .first();

  await expect(input).toBeVisible({ timeout: 15000 });
  await input.click();
  await input.fill(query);
  await searchResponse;

  const option = page.getByRole('option').filter({ hasText: optionText }).first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
};

// Opens the Add-Domain drawer and waits for both the form heading and the
// intake-form API call to resolve before returning. This ensures the
// custom-property extension section is ready to interact with.
const openCreateDomainForm = async (page: Page) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.DOMAIN);
  await waitForAllLoadersToDisappear(page);

  const intakeFetch = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/governance/intakeForms/entityType/') &&
      response.request().method() === 'GET'
  );

  await page.getByTestId('add-domain').click();
  await page.getByTestId('form-heading').waitFor({ timeout: 10000 });
  await intakeFetch;
};

const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);

test.describe.configure({ mode: 'serial' });

test.describe(
  'IntakeForm custom-property fields render and serialize correctly on the create form',
  { tag: ['@Governance'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll('Set up custom properties + intake form', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await ensureNoIntakeForm(apiContext, DOMAIN_ENTITY_TYPE);
      await ensureCustomProperty(apiContext, DOMAIN_ENTITY_TYPE, CP.str, 'string');
      await ensureCustomProperty(apiContext, DOMAIN_ENTITY_TYPE, CP.table, 'table-cp', {
        columns: ['id', 'value'],
      });
      await ensureCustomProperty(apiContext, DOMAIN_ENTITY_TYPE, CP.link, 'hyperlink-cp');
      await ensureCustomProperty(
        apiContext,
        DOMAIN_ENTITY_TYPE,
        CP.interval,
        'timeInterval'
      );
      await ensureCustomProperty(apiContext, DOMAIN_ENTITY_TYPE, CP.ref, 'entityReference', [
        'glossaryTerm',
      ]);

      await createIntakeForm(apiContext, DOMAIN_ENTITY_TYPE, [
        CP.str,
        CP.table,
        CP.link,
        CP.interval,
        CP.ref,
      ]);

      await afterAction();
    });

    test.afterAll('Tear down', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DOMAIN_ENTITY_TYPE);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    });

    test('required custom properties show the asterisk and block an empty submit', async ({
      page,
    }) => {
      test.slow();

      await openCreateDomainForm(page);

      // Wait for the custom-properties section to be rendered before asserting
      // on labels — the section appears after both the intake form and custom
      // property API calls resolve.
      await expect(page.getByTestId('custom-properties-section')).toBeVisible({
        timeout: 30000,
      });

      // Required marker is on the labelled Form.Item for every required field,
      // including the split-layout hyperlink and timeInterval fields.
      await expect(
        page.locator('.ant-form-item-required', { hasText: CP.link })
      ).toBeVisible();
      await expect(
        page.locator('.ant-form-item-required', { hasText: CP.interval })
      ).toBeVisible();

      // A submit with required custom properties empty must NOT reach the API.
      let postFired = false;
      const listener = (r: import('@playwright/test').Response) => {
        if (
          r.url().endsWith('/api/v1/domains') &&
          r.request().method() === 'POST'
        ) {
          postFired = true;
        }
      };
      page.on('response', listener);

      await extensionInput(page, `extension-${CP.str}`).fill(`d ${ID}`);
      await page.locator('#root\\/name').fill(`pwDomainNeg${ID}`);
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(async () => {
        expect(postFired).toBe(false);
      }).toPass({ intervals: [300], timeout: 4000 });
      page.off('response', listener);
    });

    test('all custom-property widgets fill and the submit payload preserves every value', async ({
      page,
    }) => {
      test.slow();

      const name = `pwDomainPos${ID}`;
      const tableId = '42';
      const tableValue = 'answer';
      const linkUrl = 'https://collate.io';
      const startVal = '10';
      const endVal = '20';
      const strVal = `hello ${ID}`;

      await openCreateDomainForm(page);

      // Wait for the custom-properties section to confirm the intake form has
      // loaded and rendered extension fields before filling anything. Without
      // this guard the test races the async API call and times out.
      await expect(page.getByTestId('custom-properties-section')).toBeVisible({
        timeout: 30000,
      });

      await page.locator('#root\\/name').fill(name);
      await page.locator('#root\\/displayName').fill(name);
      await page.locator(descriptionBox).fill('intake field test');

      await page.getByRole('combobox', { name: 'Domain Type' }).click();
      await page.getByRole('option', { name: 'Aggregate' }).click();

      // string
      await extensionInput(page, `extension-${CP.str}`).fill(strVal);

      // hyperlink (url + display text)
      await extensionInput(page, `extension-${CP.link}-url`).fill(linkUrl);
      await extensionInput(page, `extension-${CP.link}-displayText`).fill(
        'Collate'
      );

      // time interval (start + end)
      await extensionInput(page, `extension-${CP.interval}-start`).fill(startVal);
      await extensionInput(page, `extension-${CP.interval}-end`).fill(endVal);

      // entity reference — use the search-response-aware helper so we don't
      // click the option before the async search API call has resolved.
      await selectExtensionReference({
        page,
        testId: `extension-${CP.ref}`,
        query: glossaryTerm.data.name,
        optionText: glossaryTerm.data.displayName,
      });

      const table = page.getByTestId(`extension-${CP.table}`);
      await table.getByRole('button', { name: /add\s*row/i }).click();

      const idCell = table.locator('.rdg-cell-id').first();
      await idCell.dblclick();
      await page.keyboard.type(tableId);
      await page.keyboard.press('Enter');

      const valueCell = table.locator('.rdg-cell-value').first();
      await valueCell.dblclick();
      await page.keyboard.type(tableValue);
      await page.keyboard.press('Enter');

      await expect(idCell).toContainText(tableId);
      await expect(valueCell).toContainText(tableValue);

      // Capture the create request and its response together.
      const [request, response] = await Promise.all([
        page.waitForRequest(
          (r) => r.url().endsWith('/api/v1/domains') && r.method() === 'POST'
        ),
        page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/v1/domains') &&
            r.request().method() === 'POST'
        ),
        page.getByRole('button', { name: 'Save' }).click(),
      ]);

      // Server accepted it (required validation satisfied, no dropped values).
      expect(response.status()).toBe(201);

      const ext = request.postDataJSON().extension;

      expect(ext[CP.str]).toBe(strVal);

      // table: id column preserved, and NO stray keys beyond the config columns
      expect(ext[CP.table].rows).toHaveLength(1);
      expect(ext[CP.table].rows[0]).toEqual({ id: tableId, value: tableValue });
      expect(Object.keys(ext[CP.table].rows[0]).sort()).toEqual(['id', 'value']);

      // hyperlink object
      expect(ext[CP.link].url).toBe(linkUrl);

      // time interval serialized to numbers
      expect(ext[CP.interval]).toEqual({
        start: Number(startVal),
        end: Number(endVal),
      });

      // single entity reference present (not dropped)
      expect(ext[CP.ref]).toMatchObject({ type: 'glossaryTerm' });
      expect(ext[CP.ref].id).toBeTruthy();

      // Clean up the created domain.
      const { apiContext, afterAction } = await performAdminLogin(
        page.context().browser()!
      );
      await apiContext.delete(
        `/api/v1/domains/name/${name}?recursive=true&hardDelete=true`
      );
      await afterAction();
    });
  }
);
