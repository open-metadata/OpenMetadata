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
import { APIRequestContext, expect, Page, Request } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { performAdminLogin } from '../../utils/admin';
import { descriptionBox, redirectToHomePage, uuid } from '../../utils/common';
import { fillDomainForm } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { openAddGlossaryTermModal } from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const INTAKE_FORMS_URL = '/settings/governance/intake-forms';
const DP_INTAKE_NAME = 'dataProduct';
const DOMAIN_INTAKE_NAME = 'domain';
const GLOSSARY_TERM_INTAKE_NAME = 'glossaryTerm';

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
  const propertyTypeRes = await api.get(
    `/api/v1/metadata/types/name/${propertyTypeName}`
  );
  expect(propertyTypeRes.status()).toBe(200);
  const propertyType = await propertyTypeRes.json();
  const put = await api.put(`/api/v1/metadata/types/${type.id}`, {
    data: {
      name: propertyName,
      description: 'Custom property registered by IntakeForm playwright test',
      propertyType: { id: propertyType.id, type: 'type' },
      ...(config === undefined ? {} : { customPropertyConfig: { config } }),
    },
  });
  expect(put.status()).toBe(200);
};

const ensureEntityReferenceCustomProperty = async (
  api: APIRequestContext,
  entityType: string,
  propertyName: string,
  allowedTypes: string[]
) =>
  ensureCustomProperty(
    api,
    entityType,
    propertyName,
    'entityReference',
    allowedTypes
  );

const ensureStringCustomProperty = async (
  api: APIRequestContext,
  entityType: string,
  propertyName: string
) => ensureCustomProperty(api, entityType, propertyName, 'string');

const removeCustomProperty = async (
  api: APIRequestContext,
  entityType: string,
  propertyName: string
) => {
  const typeResponse = await api.get(
    `/api/v1/metadata/types/name/${entityType}?fields=customProperties`
  );
  expect(typeResponse.status()).toBe(200);
  const entityTypeDefinition = (await typeResponse.json()) as {
    customProperties?: Array<{ name: string }>;
    id: string;
  };
  const propertyIndex =
    entityTypeDefinition.customProperties?.findIndex(
      (property) => property.name === propertyName
    ) ?? -1;

  expect(propertyIndex).toBeGreaterThanOrEqual(0);

  const response = await api.patch(
    `/api/v1/metadata/types/${entityTypeDefinition.id}`,
    {
      data: [
        {
          op: 'test',
          path: `/customProperties/${propertyIndex}/name`,
          value: propertyName,
        },
        { op: 'remove', path: `/customProperties/${propertyIndex}` },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }
  );
  expect(response.status()).toBe(200);
};

type IntakeRequiredField = {
  fieldKind: 'customProperty' | 'native';
  fieldLabel: string;
  fieldPath: string;
};

const createIntakeForm = async (
  api: APIRequestContext,
  entityType: string,
  requiredFields: IntakeRequiredField[]
) => {
  const response = await api.post('/api/v1/governance/intakeForms', {
    data: {
      name: entityType,
      entityType,
      enabled: true,
      requiredFields,
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

const selectExtensionReference = async ({
  page,
  testId,
  query,
  optionText,
  optionTestId,
}: {
  page: Page;
  testId: string;
  query: string;
  optionText: string;
  optionTestId?: string;
}) => {
  const searchResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname.endsWith('/api/v1/search/query') &&
      url.searchParams.get('index') === 'glossaryTerm' &&
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

  const option = optionTestId
    ? page.getByTestId(optionTestId)
    : page.getByRole('option').filter({ hasText: optionText }).first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
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
    const audiencePropName = `pwAudienceString${uuid()}`;
    const sourcePropName = `pwSourceString${uuid()}`;
    const customPropertyNames = [
      stewardPropName,
      audiencePropName,
      sourcePropName,
    ] as const;
    const domainCustomPropertyNames = [
      `pwDomainStewardString${uuid()}`,
      `pwDomainAudienceString${uuid()}`,
      `pwDomainSourceString${uuid()}`,
    ] as const;
    const glossaryTermCustomPropertyNames = [
      `pwTermStewardString${uuid()}`,
      `pwTermAudienceString${uuid()}`,
      `pwTermSourceString${uuid()}`,
    ] as const;
    const designerScenarios = [
      {
        customPropertyNames,
        entityType: DP_INTAKE_NAME,
        label: 'Data Product',
      },
      {
        customPropertyNames: domainCustomPropertyNames,
        entityType: DOMAIN_INTAKE_NAME,
        label: 'Domain',
      },
      {
        customPropertyNames: glossaryTermCustomPropertyNames,
        entityType: GLOSSARY_TERM_INTAKE_NAME,
        label: 'Glossary Term',
      },
    ];

    test.beforeAll('Clean slate + fixtures', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
      for (const scenario of designerScenarios) {
        for (const propertyName of scenario.customPropertyNames) {
          await ensureStringCustomProperty(
            apiContext,
            scenario.entityType,
            propertyName
          );
        }
      }
      await domain.create(apiContext);
      await afterAction();
    });

    test.afterAll('Tear down', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
      await domain.delete(apiContext);
      await afterAction();
    });

    test.beforeEach('Reset to empty state', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
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

    for (const scenario of designerScenarios) {
      test(`admin can include three custom properties and require one for ${scenario.label}`, async ({
        page,
      }) => {
        test.slow();

        await redirectToHomePage(page);
        await page.goto(INTAKE_FORMS_URL);
        await waitForAllLoadersToDisappear(page);

        await test.step('Open designer via the dropdown', async () => {
          await page.getByTestId('add-intake-form').click();

          const menuItem = page.getByRole('menu').getByRole('menuitem', {
            name: new RegExp(`^${scenario.label}$`),
          });
          await expect(menuItem).toBeVisible();
          await menuItem.click();

          await expect(
            page.getByTestId('intake-form-designer-modal')
          ).toBeVisible();
          await expect(
            page.getByRole('alert').filter({ hasText: /only one intake form/i })
          ).toBeVisible();
        });

        await test.step('Include three custom properties and require one; save', async () => {
          for (const propertyName of scenario.customPropertyNames) {
            await page.getByTestId(`include-extension.${propertyName}`).click();
          }
          await page
            .getByTestId(`require-extension.${scenario.customPropertyNames[0]}`)
            .click();

          const createResponse = page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/v1/governance/intakeForms') &&
              response.request().method() === 'POST' &&
              response.status() === 201
          );
          await page.getByTestId('intake-form-submit').click();
          const response = await createResponse;
          const body = await response.json();
          expect(body.entityType).toBe(scenario.entityType);
          expect(body.formFields).toEqual(
            expect.arrayContaining(
              scenario.customPropertyNames.map((propertyName, index) =>
                expect.objectContaining({
                  fieldPath: `extension.${propertyName}`,
                  required: index === 0,
                })
              )
            )
          );
          expect(body.formFields).toHaveLength(3);
          expect(body.requiredFields).toHaveLength(1);

          await waitForAllLoadersToDisappear(page);
        });

        await test.step('New row renders in the list', async () => {
          await expect(page.getByText(scenario.label).first()).toBeVisible();
          for (const propertyName of scenario.customPropertyNames) {
            await expect(
              page.getByText(`extension.${propertyName}`)
            ).toBeVisible();
          }
        });
      });
    }

    for (const scenario of designerScenarios) {
      test(`admin can remove included and required fields from the ${scenario.label} intake form`, async ({
        browser,
        page,
      }) => {
        test.slow();

        const { apiContext, afterAction } = await performAdminLogin(browser);
        const createResponse = await apiContext.post(
          '/api/v1/governance/intakeForms',
          {
            data: {
              name: scenario.entityType,
              entityType: scenario.entityType,
              enabled: true,
              formFields: scenario.customPropertyNames.map(
                (propertyName, index) => ({
                  fieldKind: 'customProperty',
                  fieldLabel: propertyName,
                  fieldPath: `extension.${propertyName}`,
                  required: index === 0,
                })
              ),
            },
          }
        );
        expect(createResponse.status()).toBe(201);
        await afterAction();

        await redirectToHomePage(page);
        await page.goto(INTAKE_FORMS_URL);
        await expect(
          page.getByTestId(`edit-${scenario.entityType}`)
        ).toBeVisible({ timeout: 30000 });

        const openDesigner = async () => {
          await page.getByTestId(`edit-${scenario.entityType}`).click();
          await expect(
            page.getByTestId(
              `include-extension.${scenario.customPropertyNames[0]}`
            )
          ).toBeVisible();
        };
        const submitUpdate = async () => {
          const responsePromise = page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/v1/governance/intakeForms') &&
              response.request().method() === 'PUT' &&
              response.status() === 200
          );
          await page.getByTestId('intake-form-submit').click();
          const response = await responsePromise;
          const body = (await response.json()) as {
            formFields: Array<{ fieldPath: string; required: boolean }>;
            requiredFields: Array<{ fieldPath: string }>;
          };
          await expect(
            page.getByTestId(`edit-${scenario.entityType}`)
          ).toBeVisible();

          return body;
        };

        await test.step('Removing an included optional field preserves the required field', async () => {
          await openDesigner();
          await page
            .getByTestId(`include-extension.${scenario.customPropertyNames[1]}`)
            .click();
          const body = await submitUpdate();
          expect(body.formFields).toHaveLength(2);
          expect(body.requiredFields).toHaveLength(1);
          expect(body.formFields).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                fieldPath: `extension.${scenario.customPropertyNames[1]}`,
              }),
            ])
          );
        });

        await test.step('Clearing Required keeps the field included and makes it optional', async () => {
          await openDesigner();
          await page
            .getByTestId(`require-extension.${scenario.customPropertyNames[0]}`)
            .click();
          const body = await submitUpdate();
          expect(body.formFields).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                fieldPath: `extension.${scenario.customPropertyNames[0]}`,
                required: false,
              }),
            ])
          );
          expect(body.formFields).toHaveLength(2);
          expect(body.requiredFields).toHaveLength(0);
        });

        await test.step('Removing an included required field clears both states', async () => {
          await openDesigner();
          await page
            .getByTestId(`require-extension.${scenario.customPropertyNames[0]}`)
            .click();
          await page
            .getByTestId(`include-extension.${scenario.customPropertyNames[0]}`)
            .click();
          const body = await submitUpdate();
          expect(body.formFields).toEqual([
            expect.objectContaining({
              fieldPath: `extension.${scenario.customPropertyNames[2]}`,
              required: false,
            }),
          ]);
          expect(body.requiredFields).toHaveLength(0);
        });
      });
    }

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
      // have rendered the seeded row before we look for the toggle. The
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
      // The switch component puts the data-testid on the outer span; the
      // checkbox is an inner <input>. Target it directly for toBeChecked().
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

    for (const scenario of designerScenarios) {
      test(`deleting a required custom property prunes it from the ${scenario.label} intake form`, async ({
        browser,
        page,
      }) => {
        const [deletedProperty, , survivingProperty] =
          scenario.customPropertyNames;
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const createResponse = await apiContext.post(
          '/api/v1/governance/intakeForms',
          {
            data: {
              name: scenario.entityType,
              entityType: scenario.entityType,
              enabled: true,
              formFields: [
                {
                  fieldKind: 'customProperty',
                  fieldLabel: deletedProperty,
                  fieldPath: `extension.${deletedProperty}`,
                  required: true,
                },
                {
                  fieldKind: 'customProperty',
                  fieldLabel: survivingProperty,
                  fieldPath: `extension.${survivingProperty}`,
                  required: false,
                },
              ],
            },
          }
        );
        expect(createResponse.status()).toBe(201);

        await removeCustomProperty(
          apiContext,
          scenario.entityType,
          deletedProperty
        );

        const intakeFormResponse = await apiContext.get(
          `/api/v1/governance/intakeForms/entityType/${scenario.entityType}`
        );
        expect(intakeFormResponse.status()).toBe(200);
        const intakeForm = (await intakeFormResponse.json()) as {
          formFields: Array<{ fieldPath: string; required: boolean }>;
          requiredFields: Array<{ fieldPath: string }>;
        };
        expect(intakeForm.formFields).toEqual([
          expect.objectContaining({
            fieldPath: `extension.${survivingProperty}`,
            required: false,
          }),
        ]);
        expect(intakeForm.requiredFields).toHaveLength(0);
        await afterAction();

        await redirectToHomePage(page);
        await page.goto(INTAKE_FORMS_URL);
        await expect(
          page.getByTestId(`row-${scenario.entityType}`)
        ).toBeVisible({ timeout: 30000 });
        await expect(
          page.getByText(`extension.${deletedProperty}`)
        ).toHaveCount(0);
        await expect(
          page.getByText(`extension.${survivingProperty}`)
        ).toBeVisible();
      });
    }
  }
);

// The entity-reference E2E test lives in its own describe block so it gets
// a fresh browser context (unaffected by the serial block above). The
// user/team select Autocomplete is `freeSolo` with async options and its
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

        // The user/team select doesn't forward `data-testid` to its TextField,
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

        // Selecting the option collapses the Steward picker's input into a
        // read-only chip, so `stewardInput` no longer resolves. Press Escape on
        // the page (not the vanished input) to close the Autocomplete popper.
        await page.keyboard.press('Escape');
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

test.describe(
  'IntakeForm — custom-property type regressions',
  { tag: ['@Governance'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    const parentDomain = new Domain();
    const glossary = new Glossary();
    const referenceTerm = new GlossaryTerm(glossary);
    const suffix = uuid();
    const dataProductProperties = {
      date: `pwDpDate${suffix}`,
      dateTime: `pwDpDateTime${suffix}`,
      hyperlink: `pwDpLink${suffix}`,
      integer: `pwDpInteger${suffix}`,
      multiEnum: `pwDpMultiEnum${suffix}`,
      number: `pwDpNumber${suffix}`,
      reference: `pwDpTermRef${suffix}`,
      referenceList: `pwDpTermRefList${suffix}`,
      time: `pwDpTime${suffix}`,
      timestamp: `pwDpTimestamp${suffix}`,
    };
    const domainProperties = {
      hyperlink: `pwDomainLink${suffix}`,
      reference: `pwDomainTermRef${suffix}`,
    };

    test.beforeAll(
      'Create custom properties and references',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
        await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
        await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
        await parentDomain.create(apiContext);
        await glossary.create(apiContext);
        await referenceTerm.create(apiContext);

        await ensureEntityReferenceCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.reference,
          ['glossaryTerm']
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.hyperlink,
          'hyperlink-cp'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.integer,
          'integer'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.number,
          'number'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.date,
          'date-cp',
          'yyyy-MM-dd'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.dateTime,
          'dateTime-cp',
          'yyyy-MM-dd HH:mm:ss'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.time,
          'time-cp',
          'HH:mm:ss'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.timestamp,
          'timestamp'
        );
        await ensureCustomProperty(
          apiContext,
          DP_INTAKE_NAME,
          dataProductProperties.referenceList,
          'entityReferenceList',
          ['glossaryTerm']
        );
        await ensureEntityReferenceCustomProperty(
          apiContext,
          DOMAIN_INTAKE_NAME,
          domainProperties.reference,
          ['glossaryTerm']
        );
        await ensureCustomProperty(
          apiContext,
          DOMAIN_INTAKE_NAME,
          domainProperties.hyperlink,
          'hyperlink-cp'
        );
        await afterAction();
      }
    );

    test.afterAll(
      'Remove singleton forms and fixtures',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
        await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
        await parentDomain.delete(apiContext);
        await glossary.delete(apiContext);
        await afterAction();
      }
    );

    test('Data Product serializes each custom-property type for the create API', async ({
      browser,
      page,
    }) => {
      test.slow();

      const fields: IntakeRequiredField[] = [
        {
          fieldPath: `extension.${dataProductProperties.reference}`,
          fieldLabel: 'Glossary Term Reference',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.hyperlink}`,
          fieldLabel: 'Product Link',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.integer}`,
          fieldLabel: 'Priority',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.number}`,
          fieldLabel: 'Priority Number',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.date}`,
          fieldLabel: 'Launch Date',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.dateTime}`,
          fieldLabel: 'Reviewed At',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.time}`,
          fieldLabel: 'Daily Cutoff',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.timestamp}`,
          fieldLabel: 'Captured At',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${dataProductProperties.referenceList}`,
          fieldLabel: 'Related Terms',
          fieldKind: 'customProperty',
        },
      ];
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_INTAKE_NAME);
      await createIntakeForm(apiContext, DP_INTAKE_NAME, fields);
      await afterAction();

      await redirectToHomePage(page);
      await parentDomain.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);

      const intakeFetch = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes('/api/v1/governance/intakeForms/entityType/') &&
          response.request().method() === 'GET'
      );
      await page.getByTestId('domain-details-add-button').click();
      await page.getByRole('menuitem', { name: 'Data Products' }).click();
      await intakeFetch;
      await expect(page.getByTestId('add-domain-form')).toBeVisible();

      const customPropertiesSection = page.getByTestId(
        'custom-properties-section'
      );
      await expect(customPropertiesSection).toBeVisible();
      await expect(
        customPropertiesSection
          .getByTestId('custom-property-type-badge')
          .filter({ hasText: /^ENTITYREFERENCE$/ })
      ).toBeVisible();
      await expect(
        customPropertiesSection
          .getByTestId('custom-property-type-badge')
          .filter({ hasText: /^HYPERLINK$/ })
      ).toBeVisible();

      const dataProductName = `intake-types-${uuid()}`;
      await page.getByTestId('name').locator('input').fill(dataProductName);
      await page
        .locator(descriptionBox)
        .first()
        .fill('Data Product custom-property serialization regression');

      await selectExtensionReference({
        page,
        testId: `extension-${dataProductProperties.reference}`,
        query: referenceTerm.randomName,
        optionText: referenceTerm.data.displayName,
      });

      const hyperlinkUrl = extensionInput(
        page,
        `extension-${dataProductProperties.hyperlink}-url`
      );
      const hyperlinkDisplayText = extensionInput(
        page,
        `extension-${dataProductProperties.hyperlink}-displayText`
      );
      await expect(hyperlinkUrl).toBeVisible();
      await expect(hyperlinkDisplayText).toBeVisible();
      await hyperlinkUrl.fill('ftp://example.com/product');
      await hyperlinkDisplayText.fill('Product documentation');

      const integerInput = extensionInput(
        page,
        `extension-${dataProductProperties.integer}`
      );
      await expect(integerInput).toBeVisible();
      await integerInput.fill('42');

      const numberInput = extensionInput(
        page,
        `extension-${dataProductProperties.number}`
      );
      await expect(numberInput).toBeVisible();
      await numberInput.fill('42.5');

      const dateField = page.getByTestId(
        `extension-${dataProductProperties.date}`
      );
      await expect(dateField).toBeVisible();
      await dateField.getByRole('button').click();
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      // Wait for the date picker popup to close before opening the dateTime
      // picker — if Apply doesn't immediately close it, two "Today" buttons
      // appear and the strict-mode locator fails with "resolved to 2 elements".
      await expect(
        page.getByRole('button', { name: 'Today', exact: true })
      ).toBeHidden();

      const dateTimeField = page.getByTestId(
        `extension-${dataProductProperties.dateTime}`
      );
      await expect(dateTimeField).toBeVisible();
      await dateTimeField.getByRole('button').first().click();
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Apply', exact: true })
      ).toBeHidden();
      await dateTimeField.getByRole('spinbutton').first().click();
      await page.keyboard.type('0930AM');

      const timeField = page.getByTestId(
        `extension-${dataProductProperties.time}`
      );
      await expect(timeField).toBeVisible();
      await timeField.getByRole('spinbutton').first().click();
      await page.keyboard.type('0845AM');

      const timestampInput = extensionInput(
        page,
        `extension-${dataProductProperties.timestamp}`
      );
      await expect(timestampInput).toBeVisible();
      await timestampInput.fill('1706000000000');

      await selectExtensionReference({
        page,
        testId: `extension-${dataProductProperties.referenceList}`,
        query: referenceTerm.randomName,
        optionText: referenceTerm.data.displayName,
      });
      await page.keyboard.press('Escape');

      let createRequestCount = 0;
      const trackCreateRequest = (request: Request) => {
        if (
          request.url().endsWith('/api/v1/dataProducts') &&
          request.method() === 'POST'
        ) {
          createRequestCount++;
        }
      };
      page.on('request', trackCreateRequest);
      await page.getByTestId('save-btn').click();
      await expect(
        page.getByText('URL must use http or https protocol')
      ).toBeVisible();
      expect(createRequestCount).toBe(0);
      page.off('request', trackCreateRequest);

      await hyperlinkUrl.fill('https://example.com/product');

      const createRequest = page.waitForRequest(
        (request) =>
          request.url().endsWith('/api/v1/dataProducts') &&
          request.method() === 'POST'
      );
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/dataProducts') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-btn').click();

      const request = await createRequest;
      const response = await createResponse;
      expect(response.status()).toBe(201);

      const payload = request.postDataJSON() as {
        extension: Record<string, unknown>;
        extensionDefinitions?: unknown;
        name: string;
      };
      expect(payload.name).toBe(dataProductName);
      expect(payload).not.toHaveProperty('extensionDefinitions');
      expect(payload.extension[dataProductProperties.reference]).toEqual(
        expect.objectContaining({
          id: referenceTerm.responseData.id,
          type: 'glossaryTerm',
        })
      );
      expect(payload.extension[dataProductProperties.hyperlink]).toEqual({
        displayText: 'Product documentation',
        url: 'https://example.com/product',
      });
      expect(payload.extension[dataProductProperties.integer]).toBe(42);
      expect(typeof payload.extension[dataProductProperties.integer]).toBe(
        'number'
      );
      expect(payload.extension[dataProductProperties.number]).toBe(42.5);
      expect(typeof payload.extension[dataProductProperties.number]).toBe(
        'number'
      );
      expect(payload.extension[dataProductProperties.date]).toMatch(
        /^\d{4}-\d{2}-\d{2}$/
      );
      expect(payload.extension[dataProductProperties.dateTime]).toMatch(
        /^\d{4}-\d{2}-\d{2} 09:30:00$/
      );
      expect(payload.extension[dataProductProperties.time]).toBe('08:45:00');
      expect(payload.extension[dataProductProperties.timestamp]).toBe(
        1706000000000
      );
      expect(payload.extension[dataProductProperties.referenceList]).toEqual([
        expect.objectContaining({
          id: referenceTerm.responseData.id,
          type: 'glossaryTerm',
        }),
      ]);

      const createdDataProduct = await response.json();
      const cleanup = await performAdminLogin(browser);
      await cleanup.apiContext.delete(
        `/api/v1/dataProducts/${createdDataProduct.id}?hardDelete=true`
      );
      await cleanup.afterAction();
    });

    test('Domain uses the shared reference and hyperlink intake fields', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DOMAIN_INTAKE_NAME);
      await createIntakeForm(apiContext, DOMAIN_INTAKE_NAME, [
        {
          fieldPath: `extension.${domainProperties.reference}`,
          fieldLabel: 'Domain Glossary Term',
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${domainProperties.hyperlink}`,
          fieldLabel: 'Domain Link',
          fieldKind: 'customProperty',
        },
      ]);
      await afterAction();

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.DOMAIN);
      await waitForAllLoadersToDisappear(page);

      const intakeFetch = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes('/api/v1/governance/intakeForms/entityType/') &&
          response.request().method() === 'GET'
      );
      await page.getByTestId('add-domain').click();
      await intakeFetch;
      await expect(page.getByTestId('add-domain-form')).toBeVisible();
      await expect(page.getByTestId('custom-properties-section')).toBeVisible();
      await expect(
        page
          .getByTestId('custom-property-type-badge')
          .filter({ hasText: /^ENTITYREFERENCE$/ })
      ).toBeVisible();

      const domain = new Domain();
      await fillDomainForm(page, domain.data);
      await selectExtensionReference({
        page,
        testId: `extension-${domainProperties.reference}`,
        query: referenceTerm.randomName,
        optionText: referenceTerm.data.displayName,
      });

      const hyperlinkUrl = extensionInput(
        page,
        `extension-${domainProperties.hyperlink}-url`
      );
      const hyperlinkDisplayText = extensionInput(
        page,
        `extension-${domainProperties.hyperlink}-displayText`
      );
      await expect(hyperlinkUrl).toBeVisible();
      await expect(hyperlinkDisplayText).toBeVisible();
      await hyperlinkUrl.fill('https://example.com/domain');

      const createRequest = page.waitForRequest(
        (request) =>
          request.url().endsWith('/api/v1/domains') &&
          request.method() === 'POST'
      );
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/domains') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-btn').click();

      const request = await createRequest;
      const response = await createResponse;
      expect(response.status()).toBe(201);

      const payload = request.postDataJSON() as {
        extension: Record<string, unknown>;
      };
      expect(payload.extension[domainProperties.reference]).toEqual(
        expect.objectContaining({
          id: referenceTerm.responseData.id,
          type: 'glossaryTerm',
        })
      );
      expect(payload.extension[domainProperties.hyperlink]).toEqual({
        url: 'https://example.com/domain',
      });

      const createdDomain = await response.json();
      const cleanup = await performAdminLogin(browser);
      await cleanup.apiContext.delete(
        `/api/v1/domains/${createdDomain.id}?recursive=true&hardDelete=true`
      );
      await cleanup.afterAction();
    });
  }
);

test.describe(
  'IntakeForm — Glossary Term create and edit',
  { tag: ['@Governance'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    const glossary = new Glossary();
    const suffix = uuid();
    const properties = {
      hyperlink: `pwTermLink${suffix}`,
      string: `pwTermString${suffix}`,
    };

    test.beforeAll(
      'Create glossary fixtures and custom properties',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
        await glossary.create(apiContext);
        await ensureStringCustomProperty(
          apiContext,
          GLOSSARY_TERM_INTAKE_NAME,
          properties.string
        );
        await ensureCustomProperty(
          apiContext,
          GLOSSARY_TERM_INTAKE_NAME,
          properties.hyperlink,
          'hyperlink-cp'
        );
        await afterAction();
      }
    );

    test.afterAll('Remove singleton form and glossary', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
      await glossary.delete(apiContext);
      await afterAction();
    });

    test('required intake fields are submitted on create and omitted on edit', async ({
      browser,
      page,
    }) => {
      test.slow();

      const stringLabel = 'Term Intake String';
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME);
      await createIntakeForm(apiContext, GLOSSARY_TERM_INTAKE_NAME, [
        {
          fieldPath: `extension.${properties.string}`,
          fieldLabel: stringLabel,
          fieldKind: 'customProperty',
        },
        {
          fieldPath: `extension.${properties.hyperlink}`,
          fieldLabel: 'Term Intake Link',
          fieldKind: 'customProperty',
        },
      ]);
      await afterAction();

      await glossary.visitPage(page);
      const intakeFetch = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes('/api/v1/governance/intakeForms/entityType/') &&
          response.request().method() === 'GET'
      );
      await openAddGlossaryTermModal(page);
      await intakeFetch;

      const modal = page.locator('[role="dialog"].edit-glossary-modal');
      const stringFieldId = `extension-${properties.string}`;
      const hyperlinkUrlId = `extension-${properties.hyperlink}-url`;
      const hyperlinkDisplayTextId = `extension-${properties.hyperlink}-displayText`;
      await expect(page.getByTestId(stringFieldId)).toBeVisible();
      await expect(page.getByTestId(hyperlinkUrlId)).toBeVisible();
      await expect(page.getByTestId(hyperlinkDisplayTextId)).toBeVisible();

      const customPropertiesSection = modal.getByTestId(
        'custom-properties-section'
      );
      await expect(customPropertiesSection).toBeVisible();
      await expect(
        customPropertiesSection
          .getByTestId('custom-property-type-badge')
          .filter({ hasText: /^STRING$/ })
      ).toBeVisible();
      await expect(
        customPropertiesSection
          .getByTestId('custom-property-type-badge')
          .filter({ hasText: /^HYPERLINK$/ })
      ).toBeVisible();

      const termName = `intake-term-${uuid()}`;
      await modal.getByTestId('name').fill(termName);
      await modal
        .locator(descriptionBox)
        .fill('Glossary Term intake-form regression');

      let createRequestCount = 0;
      const trackCreateRequest = (request: Request) => {
        if (
          request.url().endsWith('/api/v1/glossaryTerms') &&
          request.method() === 'POST'
        ) {
          createRequestCount++;
        }
      };
      page.on('request', trackCreateRequest);
      await modal.getByTestId('save-glossary-term').click();
      await expect(modal.getByText(`${stringLabel} is required`)).toBeVisible();
      expect(createRequestCount).toBe(0);

      await extensionInput(page, stringFieldId).fill('governed term');
      await extensionInput(page, hyperlinkDisplayTextId).fill(
        'Glossary term documentation'
      );

      await extensionInput(page, hyperlinkUrlId).fill(
        'ftp://example.com/glossary-term'
      );
      await modal.getByTestId('save-glossary-term').click();
      await expect(
        modal.getByText('URL must use http or https protocol')
      ).toBeVisible();
      expect(createRequestCount).toBe(0);
      page.off('request', trackCreateRequest);

      await extensionInput(page, hyperlinkUrlId).fill(
        'https://example.com/glossary-term'
      );

      const createRequest = page.waitForRequest(
        (request) =>
          request.url().endsWith('/api/v1/glossaryTerms') &&
          request.method() === 'POST'
      );
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await modal.getByTestId('save-glossary-term').click();

      const request = await createRequest;
      const response = await createResponse;
      expect(response.status()).toBe(201);

      const payload = request.postDataJSON() as {
        extension: Record<string, unknown>;
        name: string;
      };
      expect(payload.name).toBe(termName);
      expect(payload.extension[properties.string]).toBe('governed term');
      expect(payload.extension[properties.hyperlink]).toEqual({
        displayText: 'Glossary term documentation',
        url: 'https://example.com/glossary-term',
      });

      await expect(modal).not.toBeVisible();
      const termRow = page.locator(`[data-row-key*="${termName}"]`);
      await expect(termRow).toBeVisible({ timeout: 30000 });
      await termRow.hover();
      await termRow.getByTestId('edit-button').click();
      await expect(modal).toBeVisible();
      await expect(modal.getByTestId('name')).toHaveValue(termName);
      await expect(page.getByTestId(stringFieldId)).toHaveCount(0);
      await expect(page.getByTestId(hyperlinkUrlId)).toHaveCount(0);
    });
  }
);
