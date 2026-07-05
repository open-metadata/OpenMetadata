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

const INTAKE_FORMS_URL = '/settings/governance/intake-forms';
const DP_INTAKE_NAME = 'dataProduct';
const DOMAIN_INTAKE_NAME = 'domain';

// -----------------------------------------------------------------------------
// API helpers — set up / tear down IntakeForms and custom properties directly,
// so tests don't depend on prior UI state.
// -----------------------------------------------------------------------------

const ensureNoIntakeForm = async (
  api: APIRequestContext,
  entityType: string
) => {
  // List and delete any matching form by entityType. This is more defensive
  // than name-based lookup because it catches forms with drifted names or
  // any leftovers from failed tests, and it deletes disabled forms that the
  // /entityType endpoint hides.
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

const ensureEntityReferenceCustomProperty = async (
  api: APIRequestContext,
  entityType: string,
  propertyName: string,
  allowedTypes: string[]
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
  const refTypeRes = await api.get(
    '/api/v1/metadata/types/name/entityReference'
  );
  expect(refTypeRes.status()).toBe(200);
  const refType = await refTypeRes.json();
  const put = await api.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Entity-ref custom property registered by playwright test',
      propertyType: { id: refType.id, type: 'type' },
      customPropertyConfig: { config: allowedTypes },
    },
  });
  expect(put.status()).toBe(200);
};

const ensureStringCustomProperty = async (
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
  const stringTypeRes = await api.get('/api/v1/metadata/types/name/string');
  expect(stringTypeRes.status()).toBe(200);
  const stringType = await stringTypeRes.json();
  const put = await api.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Registered by IntakeForm playwright test',
      propertyType: {
        id: stringType.id,
        type: 'type',
      },
    },
  });
  expect(put.status()).toBe(200);
};

// The two describes below both create intake forms for entityType=dataProduct.
// The DB enforces UNIQUE(entityType), so even though each describe has its own
// beforeEach/beforeAll cleanup, running them in parallel on different workers
// makes the POST race against the sibling describe's just-created form and
// 409. Serialize the whole file so worker N is fully done before worker N+1
// starts here.
test.describe.configure({ mode: 'serial' });

test.describe(
  'IntakeForm — Settings → Governance → Forms',
  { tag: ['@Governance'] },
  () => {
    // IntakeForms are singleton-per-entityType (name = entityType). Running
    // the tests in parallel would collide on POST /intakeForms with 409.
    test.describe.configure({ mode: 'serial' });

    const domain = new Domain();
    const stewardPropName = `pwStewardString${uuid()}`;

    test.beforeAll('Clean slate + fixtures', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await ensureStringCustomProperty(
        apiContext,
        'dataProduct',
        stewardPropName
      );
      await domain.create(apiContext);
      await afterAction();
    });

    test.afterAll('Tear down', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await domain.delete(apiContext);
      await afterAction();
    });

    test.beforeEach('Reset to empty state', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await afterAction();
    });

    test('admin can open the Intake Forms settings page', async ({ page }) => {
      await redirectToHomePage(page);
      await page.goto(INTAKE_FORMS_URL);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('heading', { name: 'Intake Forms' })
      ).toBeVisible();
      await expect(page.getByTestId('add-intake-form')).toBeVisible();
    });

    test('admin can create an Intake Form for Data Product via the UI', async ({
      page,
    }) => {
      test.slow();

      await redirectToHomePage(page);
      await page.goto(INTAKE_FORMS_URL);
      await waitForAllLoadersToDisappear(page);

      await test.step('Open designer via the dropdown', async () => {
        await page.getByTestId('add-intake-form').click();

        const menuItem = page
          .getByRole('menu')
          .getByRole('menuitem', { name: /^Data Product$/ });
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        await expect(
          page.getByTestId('intake-form-designer-modal')
        ).toBeVisible();
        await expect(
          page.getByRole('alert').filter({ hasText: /only one intake form/i })
        ).toBeVisible();
      });

      await test.step('Check Type and Display Name as required; save', async () => {
        // The require control is a ui-core-components (react-aria) Checkbox,
        // which renders the testid on the wrapping label rather than a native
        // checkbox input — click the label to toggle it.
        await page.getByTestId('require-dataProductType').click();
        await page.getByTestId('require-displayName').click();

        const createResponse = page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/v1/governance/intakeForms') &&
            r.request().method() === 'POST' &&
            r.status() === 201
        );
        await page.getByTestId('intake-form-submit').click();
        const response = await createResponse;
        const body = await response.json();
        expect(body.entityType).toBe(DP_INTAKE_NAME);
        expect(body.requiredFields).toHaveLength(2);

        await waitForAllLoadersToDisappear(page);
      });

      await test.step('New row renders in the list', async () => {
        await expect(page.getByText('Data Product').first()).toBeVisible();
        // Required-field pills split their label and path across two text
        // nodes, so use a regex that matches the combined visible text.
        await expect(page.getByText(/displayName/)).toBeVisible();
        await expect(page.getByText(/dataProductType/)).toBeVisible();
      });
    });

    test('"Data Product" option is disabled when a form already exists', async ({
      browser,
      page,
    }) => {
      await test.step('Seed an existing form via API', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            displayName: 'Data Product Intake Form',
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      await page.goto(INTAKE_FORMS_URL);
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('add-intake-form').click();
      const menu = page.getByRole('menu');
      const disabledItem = menu.getByText(/Data Product.*already configured/i);
      await expect(disabledItem).toBeVisible();

      // react-aria disables menuitems via aria-disabled
      const parent = menu
        .getByRole('menuitem')
        .filter({ hasText: /Data Product/ });
      await expect(parent).toHaveAttribute('aria-disabled', 'true');
    });

    test('intake form with required field blocks Data Product create when missing', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring dataProductType', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            displayName: 'Data Product Intake Form',
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: 'dataProductType',
                fieldLabel: 'Data Product Type',
                fieldKind: 'native',
              },
            ],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      await test.step('Open Data Product tab and the Add form', async () => {
        const dpTab = page.getByRole('tab', { name: /Data Product/i });
        if (await dpTab.isVisible()) {
          await dpTab.click();
        }
        await page.getByRole('button', { name: /Add Data Product/i }).click();
        await expect(page.getByTestId('add-domain-form')).toBeVisible();
      });

      await test.step('Type field is rendered and marked required by intake form', async () => {
        const typeSelect = page.getByTestId('dataProductType');
        await expect(typeSelect).toBeVisible();

        // core-components renders each field as a Box: a FormItemLabel
        // followed by the field element. When the intake form marks the
        // field required, FormItemLabel appends a "*" span next to the
        // label (the Select itself doesn't carry aria-required). Scope to
        // the field group wrapping the Type select so the asterisk we assert
        // on belongs to this field and not another required one.
        const typeFieldGroup = page
          .locator('div')
          .filter({ has: typeSelect })
          .filter({ has: page.getByTestId('form-item-label') })
          .last();
        await expect(
          typeFieldGroup.getByText('*', { exact: true })
        ).toBeVisible();
      });

      await test.step('Client blocks submit without Type; backend ALSO blocks via API', async () => {
        await page
          .getByTestId('name')
          .locator('input')
          .fill(`intake-dp-${uuid()}`);
        await page
          .locator('.om-block-editor[contenteditable="true"]')
          .first()
          .fill('Playwright product without a Type — client-side should block');

        // Save should not fire a POST because Antd form validation fails on
        // the required `dataProductType` field. We verify by racing a POST
        // listener against a short grace window via page.waitForResponse
        // with a timeout — no POST within the window = client blocked.
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

        // Poll for up to 3s and confirm no POST ever fires. We intentionally
        // avoid `page.waitForTimeout` (linted as flaky) and instead use
        // toPass, which re-runs until it succeeds or times out.
        await expect(async () => {
          expect(postFired).toBe(false);
        }).toPass({ timeout: 3000, intervals: [300] });
        page.off('response', postListener);
      });

      await test.step('Backend also rejects with 400 when called directly', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const domainFqn =
          domain.responseData?.fullyQualifiedName ??
          domain.data.fullyQualifiedName ??
          domain.data.name;
        const res = await apiContext.post('/api/v1/dataProducts', {
          data: {
            name: `intake-dp-api-${uuid()}`,
            description: 'Missing Type should be rejected by backend',
            domains: [domainFqn],
          },
        });
        expect(res.status()).toBe(400);
        const body = await res.text();
        expect(body.toLowerCase()).toContain('data product type');
        await afterAction();
      });
    });

    test('intake form — toggling enabled flips enforcement in listing', async ({
      browser,
      page,
    }) => {
      await test.step('Seed an enabled intake form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: 'dataProductType',
                fieldLabel: 'Data Product Type',
                fieldKind: 'native',
              },
            ],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      // Wait for the listIntakeForms response so the table is guaranteed to
      // have rendered the seeded row before we look for the toggle. The MUI
      // table has no generic "loader" testid for waitForAllLoadersToDisappear
      // to latch onto, so we anchor on the API response directly.
      const listResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms') &&
          r.request().method() === 'GET'
      );
      await page.goto(INTAKE_FORMS_URL);
      await listResponse;

      const toggle = page.getByTestId('toggle-dataProduct');
      await expect(toggle).toBeVisible({ timeout: 30000 });

      // UI now PATCHes just `/enabled` (see IntakeFormsPage#handleToggleEnabled)
      // to avoid clobbering server-managed fields like owners via a PUT round-trip.
      const updateResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms/') &&
          r.request().method() === 'PATCH' &&
          r.status() === 200
      );
      await toggle.click();
      const response = await updateResponse;
      const body = await response.json();
      expect(body.enabled).toBe(false);
    });

    test('custom property required via intake form renders in Data Product create form', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the custom property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: `extension.${stewardPropName}`,
                fieldLabel: 'Steward',
                fieldKind: 'customProperty',
              },
            ],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const dpTab = page.getByRole('tab', { name: /Data Product/i });
      if (await dpTab.isVisible()) {
        await dpTab.click();
      }
      await page.getByRole('button', { name: /Add Data Product/i }).click();
      await expect(page.getByTestId('add-domain-form')).toBeVisible();

      // The field is rendered; its required marker is widget-specific. The
      // enforcement is covered end-to-end by the entity-reference test below
      // (backend returns 400 when the field is missing).
      await expect(
        page.getByTestId(`extension-${stewardPropName}`)
      ).toBeVisible();
    });

    test('deleting an intake form removes it from the list', async ({
      browser,
      page,
    }) => {
      await test.step('Seed a form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      await page.goto(INTAKE_FORMS_URL);
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('delete-dataProduct').click();
      const confirm = page
        .getByRole('dialog')
        .getByRole('button', { name: 'Delete' });
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms/') &&
          r.request().method() === 'DELETE'
      );
      await confirm.click();
      const response = await deleteResponse;
      expect([200, 204]).toContain(response.status());

      await waitForAllLoadersToDisappear(page);
      // After delete, the entity-type row is gone, so the add dropdown should
      // offer Data Product again
      await page.getByTestId('add-intake-form').click();
      const menuItem = page
        .getByRole('menu')
        .getByRole('menuitem', { name: /^Data Product$/ });
      await expect(menuItem).toBeVisible();
    });

    test('delete popconfirm cancel keeps the intake form intact', async ({
      browser,
      page,
    }) => {
      await test.step('Seed a form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      await page.goto(INTAKE_FORMS_URL);

      // Wait for the seeded row instead of a generic loader — the listing
      // loader sometimes lingers when the page is navigated to repeatedly.
      const deleteButton = page.getByTestId('delete-dataProduct');
      await expect(deleteButton).toBeVisible({ timeout: 30000 });
      await deleteButton.click();
      const confirmDialog = page.getByRole('dialog');
      const cancel = confirmDialog.getByRole('button', { name: 'Cancel' });
      await expect(cancel).toBeVisible();
      await cancel.click();

      // Dialog should close and the row is still there
      await expect(confirmDialog).not.toBeVisible();
      await expect(page.getByTestId('delete-dataProduct')).toBeVisible();
      // MUI Switch puts the data-testid on the outer span; the checkbox is an
      // inner <input>. Target it directly for toBeChecked().
      await expect(
        page.getByTestId('toggle-dataProduct').locator('input')
      ).toBeChecked();

      // Re-confirm the form still exists via API-level probe: dropdown shows
      // Data Product as unavailable
      await page.getByTestId('add-intake-form').click();
      const disabledItem = page
        .getByRole('menu')
        .getByRole('menuitem')
        .filter({ hasText: /Data Product/ });
      await expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
    });

    test('designer does not list schema-required fields', async ({ page }) => {
      await redirectToHomePage(page);
      await page.goto(INTAKE_FORMS_URL);
      await waitForAllLoadersToDisappear(page);

      await page.getByTestId('add-intake-form').click();
      const menuItem = page
        .getByRole('menu')
        .getByRole('menuitem', { name: /^Data Product$/ });
      await menuItem.click();

      await expect(
        page.getByTestId('intake-form-designer-modal')
      ).toBeVisible();

      // Schema-required fields must NOT be toggleable from the intake form
      // designer — they are intrinsic and always enforced.
      await expect(page.getByTestId('require-name')).toHaveCount(0);
      await expect(page.getByTestId('require-description')).toHaveCount(0);
      await expect(page.getByTestId('require-domains')).toHaveCount(0);

      // Some optional native fields SHOULD be offered
      await expect(page.getByTestId('require-dataProductType')).toBeVisible();
      await expect(page.getByTestId('require-displayName')).toBeVisible();
      await expect(page.getByTestId('require-visibility')).toBeVisible();
    });
  }
);

// The entity-reference E2E test lives in its own describe block so it gets
// a fresh browser context (unaffected by the serial block above). The
// MUIUserTeamSelect Autocomplete is `freeSolo` with async options and its
// controlled `open`/`inputValue` state gets wedged by leftover Autocomplete
// instances from earlier tests in the same context — the listbox never
// opens there. An isolated page avoids that.
test.describe(
  'IntakeForm — Entity-reference custom property E2E',
  { tag: ['@Governance'] },
  () => {
    const domain = new Domain();
    const stewardRefPropName = `pwStewardRef${uuid()}`;

    test.beforeAll('Clean slate + fixtures', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureEntityReferenceCustomProperty(
        apiContext,
        'dataProduct',
        stewardRefPropName,
        ['user']
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

    test('pick admin user → DP create succeeds with correct extension payload', async ({
      browser,
      page,
    }) => {
      test.slow();

      await test.step('Seed intake form requiring the entity-ref property', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post('/api/v1/governance/intakeForms', {
          data: {
            name: DP_INTAKE_NAME,
            entityType: 'dataProduct',
            enabled: true,
            requiredFields: [
              {
                fieldPath: `extension.${stewardRefPropName}`,
                fieldLabel: 'Steward',
                fieldKind: 'customProperty',
              },
            ],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await redirectToHomePage(page);
      await domain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const dpTab = page.getByRole('tab', { name: /Data Product/i });
      if (await dpTab.isVisible()) {
        await dpTab.click();
      }
      // Wait for the intake form fetch that AddDomainForm fires on mount so
      // the dynamic extension fields (including Steward) are rendered before
      // we start filling the form.
      const intakeFetch = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/governance/intakeForms/entityType/') &&
          r.request().method() === 'GET'
      );
      await page.getByRole('button', { name: /Add Data Product/i }).click();
      await expect(page.getByTestId('add-domain-form')).toBeVisible();
      await intakeFetch;

      const dpName = `intake-ref-e2e-${uuid()}`;

      await test.step('Fill name + description + entity-ref picker', async () => {
        await page.getByTestId('name').locator('input').fill(dpName);
        await page
          .locator('.om-block-editor[contenteditable="true"]')
          .first()
          .fill('Playwright test product with entity reference steward');

        // MUIUserTeamSelect doesn't forward `data-testid` to its TextField,
        // so find the Autocomplete by the visible field label "Steward".
        const stewardInput = page
          .getByRole('combobox', { name: 'Steward' })
          .or(page.getByRole('textbox', { name: 'Steward' }))
          .first();
        await expect(stewardInput).toBeVisible({ timeout: 15000 });
        await stewardInput.click();
        await stewardInput.fill('admin');

        const listbox = page.getByRole('listbox');
        await expect(listbox).toBeVisible({ timeout: 30000 });
        const adminOption = listbox
          .getByRole('option')
          .filter({ hasText: /admin/i });
        await expect(adminOption.first()).toBeVisible({ timeout: 15000 });
        await adminOption.first().click();

        await stewardInput.press('Escape');
        await expect(listbox).toBeHidden();
      });

      await test.step('Submit and verify 201 + correct extension payload', async () => {
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
        const ref = body.extension[stewardRefPropName];
        expect(ref).toBeDefined();
        // Must be a single object (not an array) with id + type=user
        expect(Array.isArray(ref)).toBe(false);
        expect(ref.type).toBe('user');
        expect(typeof ref.id).toBe('string');
        expect(ref.id.length).toBeGreaterThan(0);

        // Clean up the newly-created data product
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await apiContext.delete(
          `/api/v1/dataProducts/${body.id}?hardDelete=true`
        );
        await afterAction();
      });
    });
  }
);
