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
import { APIRequestContext, expect } from '@playwright/test';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

const DP_INTAKE_NAME = 'dataProduct';

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
      const del = await api.delete(
        `/api/v1/governance/intakeForms/${form.id}?hardDelete=true`
      );
      expect([200, 204, 404]).toContain(del.status());
    }
  }
};

const ensureHyperlinkCustomProperty = async (
  api: APIRequestContext,
  entityType: string,
  propertyName: string
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
  // The hyperlink custom-property type isn't addressable by a clean path name,
  // so discover it from the field-type listing instead of a name lookup.
  const fieldTypesRes = await api.get(
    '/api/v1/metadata/types?category=field&limit=100'
  );
  expect(fieldTypesRes.status()).toBe(200);
  const fieldTypes = await fieldTypesRes.json();
  const hyperlinkType = (fieldTypes.data ?? []).find(
    (t: { name: string }) => t.name === 'hyperlink-cp'
  );
  expect(hyperlinkType).toBeDefined();
  const put = await api.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Hyperlink custom property registered by playwright test',
      propertyType: { id: hyperlinkType.id, type: 'type' },
    },
  });
  expect(put.status()).toBe(200);
};

test.describe(
  'Data Product Intake Form — Hyperlink custom property',
  { tag: ['@Governance'] },
  () => {
    // The dataProduct intake form is a singleton (UNIQUE entityType), so the
    // three tests below must not run concurrently — serialize them.
    test.describe.configure({ mode: 'serial' });

    const domain = new Domain();
    const docLinkPropName = `pwDocLink${uuid()}`;

    test.beforeAll('Clean slate + fixtures', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureHyperlinkCustomProperty(
        apiContext,
        'dataProduct',
        docLinkPropName
      );
      await domain.create(apiContext);
      await afterAction();
    });

    test.afterAll('Tear down', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await domain.delete(apiContext);
      await afterAction();
    });

    test('url + displayText → DP create succeeds with a { url, displayText } object payload', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the hyperlink property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.put('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: `extension.${docLinkPropName}`,
                fieldLabel: 'Doc Link',
                fieldKind: 'customProperty',
              },
            ],
          },
        });
        expect([200, 201]).toContain(res.status());
        await afterAction();
      });

      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const dpTab = page.getByRole('tab', { name: /Data Product/i });
      if (await dpTab.isVisible()) {
        await dpTab.click();
      }

      const intakeFetch = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms/entityType/') &&
          r.request().method() === 'GET'
      );
      await page.getByRole('button', { name: /Add Data Product/i }).click();
      await expect(page.getByTestId('add-domain-form')).toBeVisible();
      await intakeFetch;

      const dpName = `intake-hyperlink-e2e-${uuid()}`;
      const url = 'https://www.google.com';
      const displayText = 'Google';

      await test.step('Fill name + description + hyperlink url/displayText', async () => {
        await page.getByTestId('name').locator('input').fill(dpName);
        await page
          .locator('.om-block-editor[contenteditable="true"]')
          .first()
          .fill('Playwright test product with a hyperlink custom property');

        const urlInput = page
          .getByTestId(`extension-${docLinkPropName}-url`)
          .locator('input');
        await expect(urlInput).toBeVisible({ timeout: 15000 });
        await urlInput.fill(url);

        await page
          .getByTestId(`extension-${docLinkPropName}-displayText`)
          .locator('input')
          .fill(displayText);
      });

      await test.step('Submit and verify 201 + a { url, displayText } object payload', async () => {
        const createResponse = page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/v1/dataProducts') &&
            r.request().method() === 'POST'
        );
        await page.getByTestId('save-btn').click();
        const response = await createResponse;
        expect(response.status()).toBe(201);

        const body = await response.json();
        expect(body.name).toBe(dpName);
        expect(body.extension).toBeDefined();
        const link = body.extension[docLinkPropName];

        expect(link).toBeDefined();
        expect(typeof link).toBe('object');
        expect(Array.isArray(link)).toBe(false);
        expect(link.url).toBe(url);
        expect(link.displayText).toBe(displayText);

        const { apiContext, afterAction } = await performAdminLogin(browser);
        await apiContext.delete(
          `/api/v1/dataProducts/${body.id}?hardDelete=true`
        );
        await afterAction();
      });
    });

    test('blank displayText is blocked client-side (required); backend still accepts url-only', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the hyperlink property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.put('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: `extension.${docLinkPropName}`,
                fieldLabel: 'Doc Link',
                fieldKind: 'customProperty',
              },
            ],
          },
        });
        expect([200, 201]).toContain(res.status());
        await afterAction();
      });

      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const dpTab = page.getByRole('tab', { name: /Data Product/i });
      if (await dpTab.isVisible()) {
        await dpTab.click();
      }
      const intakeFetch = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms/entityType/') &&
          r.request().method() === 'GET'
      );
      await page.getByRole('button', { name: /Add Data Product/i }).click();
      await expect(page.getByTestId('add-domain-form')).toBeVisible();
      await intakeFetch;

      const url = 'https://example.com';

      await test.step('Filling only url (blank displayText) must not fire a create POST', async () => {
        await page
          .getByTestId('name')
          .locator('input')
          .fill(`intake-hyperlink-nodisplay-${uuid()}`);
        await page
          .locator('.om-block-editor[contenteditable="true"]')
          .first()
          .fill('Playwright hyperlink product without display text');

        const urlInput = page
          .getByTestId(`extension-${docLinkPropName}-url`)
          .locator('input');
        await expect(urlInput).toBeVisible({ timeout: 15000 });
        await urlInput.fill(url);

        let postFired = false;
        const postListener = (r: import('@playwright/test').Response) => {
          if (
            r.url().endsWith('/api/v1/dataProducts') &&
            r.request().method() === 'POST'
          ) {
            postFired = true;
          }
        };
        page.on('response', postListener);
        await page.getByTestId('save-btn').click();

        await expect(async () => {
          expect(postFired).toBe(false);
        }).toPass({ timeout: 3000, intervals: [300] });
        page.off('response', postListener);
      });

      await test.step('Backend still accepts a url-only hyperlink and omits displayText', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const domainFqn =
          domain.responseData?.fullyQualifiedName ??
          domain.data.fullyQualifiedName ??
          domain.data.name;

        const res = await apiContext.post('/api/v1/dataProducts', {
          data: {
            name: `intake-hyperlink-api-nodisplay-${uuid()}`,
            description: 'url-only hyperlink is valid at the API',
            domains: [domainFqn],
            extension: { [docLinkPropName]: { url } },
          },
        });
        expect(res.status()).toBe(201);

        const body = await res.json();
        const link = body.extension[docLinkPropName];
        expect(link).toBeDefined();
        expect(typeof link).toBe('object');
        expect(link.url).toBe(url);
        expect(link.displayText ?? '').toBe('');

        await apiContext.delete(
          `/api/v1/dataProducts/${body.id}?hardDelete=true`
        );
        await afterAction();
      });
    });

    test('blank url is blocked client-side (required) and by the backend', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the hyperlink property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.put('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: `extension.${docLinkPropName}`,
                fieldLabel: 'Doc Link',
                fieldKind: 'customProperty',
              },
            ],
          },
        });
        expect([200, 201]).toContain(res.status());
        await afterAction();
      });

      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const dpTab = page.getByRole('tab', { name: /Data Product/i });
      if (await dpTab.isVisible()) {
        await dpTab.click();
      }
      const intakeFetch = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms/entityType/') &&
          r.request().method() === 'GET'
      );
      await page.getByRole('button', { name: /Add Data Product/i }).click();
      await expect(page.getByTestId('add-domain-form')).toBeVisible();
      await intakeFetch;

      await test.step('Filling only displayText must not fire a create POST', async () => {
        await page
          .getByTestId('name')
          .locator('input')
          .fill(`intake-hyperlink-nourl-${uuid()}`);
        await page
          .locator('.om-block-editor[contenteditable="true"]')
          .first()
          .fill('Hyperlink product missing the required url');

        await page
          .getByTestId(`extension-${docLinkPropName}-displayText`)
          .locator('input')
          .fill('Only a label, no URL');

        let postFired = false;
        const postListener = (r: import('@playwright/test').Response) => {
          if (
            r.url().endsWith('/api/v1/dataProducts') &&
            r.request().method() === 'POST'
          ) {
            postFired = true;
          }
        };
        page.on('response', postListener);
        await page.getByTestId('save-btn').click();

        await expect(async () => {
          expect(postFired).toBe(false);
        }).toPass({ timeout: 3000, intervals: [300] });
        page.off('response', postListener);
      });

      await test.step('Backend also rejects a bare-string hyperlink with 400', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const domainFqn =
          domain.responseData?.fullyQualifiedName ??
          domain.data.fullyQualifiedName ??
          domain.data.name;

        const res = await apiContext.post('/api/v1/dataProducts', {
          data: {
            name: `intake-hyperlink-api-${uuid()}`,
            description: 'Bare-string hyperlink should be rejected',
            domains: [domainFqn],
            extension: { [docLinkPropName]: 'https://www.google.com' },
          },
        });
        expect(res.status()).toBe(400);
        await afterAction();
      });
    });
  }
);
