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

import { expect } from '@playwright/test';
import { test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  backToLanding,
  createRelationTypeViaApi,
  deleteRelationTypeByNameViaApi,
  ensureCustomProperty,
  ensureNoIntakeForm,
  fillInput,
  fillTextArea,
  findRowAcrossPages,
  INTAKE_FORMS_API,
  navigateToGlossaryList,
  navigateToIntakeList,
  openGovernanceSettings,
  RELATION_TYPES_API,
  selectOption,
} from '../../utils/governance';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

const SYSTEM_DEFINED_RELATION = 'broader';

// ─── Tests ────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Profile Governance — Landing',
  { tag: ['@Governance', '@Features'] },
  () => {
    test('shows 2 landing cards and navigates to each section', async ({
      page,
    }) => {

      await test.step('Open Governance settings tab', async () => {
        await openGovernanceSettings(page);
      });

      await test.step('Both landing cards are visible', async () => {
        await expect(
          page.getByTestId('governance-card-glossary-relations')
        ).toBeVisible();
        await expect(
          page.getByTestId('governance-card-intake-forms')
        ).toBeVisible();
      });

      await test.step('Glossary Relations card navigates to the list', async () => {
        await navigateToGlossaryList(page);
        await expect(page.getByTestId('relation-types-table')).toBeVisible();
      });

      await test.step('Back breadcrumb returns to landing', async () => {
        await backToLanding(page);
        await expect(
          page.getByTestId('governance-card-intake-forms')
        ).toBeVisible();
      });

      await test.step('Intake Forms card navigates to the list', async () => {
        await page.getByTestId('governance-card-intake-forms').click();
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId('add-intake-form')).toBeVisible();
      });
    });
  }
);

test.describe(
  'Profile Governance — Glossary Term Relations CRUD',
  { tag: ['@Governance', '@Features'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    // Populates IndexedDB so getApiContext(page) can read the auth token.
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('creates a custom relation type via the form page', async ({
      page,
    }) => {

      const relationName = `pwRelModal${uuid()}`;
      const displayName = `PW Modal Relation ${uuid()}`;
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await openGovernanceSettings(page);
        await navigateToGlossaryList(page);

        await test.step('Header "Add Relation Type" button opens the form page', async () => {
          await page.getByTestId('add-relation-type').click();
          await expect(page.getByTestId('glossary-form-page')).toBeVisible();
        });

        await test.step('Fill all form fields', async () => {
          await fillInput(page, 'name-input', relationName);
          await fillInput(page, 'display-name-input', displayName);
          await fillTextArea(
            page,
            'description-input',
            `Playwright modal form test for ${relationName}`
          );
          await fillInput(
            page,
            'rdf-predicate-input',
            `https://example.org/${relationName}`
          );
          await selectOption(page, 'category-select', 'Custom · Admin-defined');
          await selectOption(page, 'cardinality-select', 'One to Many');
          await fillInput(
            page,
            'inverse-relation-input',
            `narrower-${relationName}`
          );
          await selectOption(page, 'color-select', 'Purple');
          // Toggle a characteristic
          await page.getByTestId('characteristic-IRREFLEXIVE').click();
        });

        await test.step('Save creates the entity and returns to the list', async () => {
          const createResponse = waitForResponseWithStatus(
            page,
            (r) =>
              r.url().includes(RELATION_TYPES_API) &&
              r.request().method() === 'POST',
            201
          );
          await page.getByTestId('glossary-form-save').click();
          await createResponse;

          await toastNotification(page, 'Relation Type created successfully.');
          await expect(page.getByTestId('relation-types-table')).toBeVisible();
          await findRowAcrossPages(page, `relation-name-${relationName}`);
          await expect(
            page.getByTestId(`relation-name-${relationName}`)
          ).toBeVisible();
        });
      } finally {
        await deleteRelationTypeByNameViaApi(apiContext, relationName);
        await afterAction();
      }
    });

    test('cancel on the form page returns to the list without creating', async ({
      page,
    }) => {

      const relationName = `pwRelCancelModal${uuid()}`;

      await openGovernanceSettings(page);
      await navigateToGlossaryList(page);

      await page.getByTestId('add-relation-type').click();
      await expect(page.getByTestId('glossary-form-page')).toBeVisible();

      await fillInput(page, 'name-input', relationName);

      await page.getByTestId('glossary-form-cancel').click();

      await expect(page.getByTestId('relation-types-table')).toBeVisible();
      await expect(
        page.getByTestId(`relation-name-${relationName}`)
      ).toHaveCount(0);
    });

    test('edits a custom relation type — name field is immutable', async ({
      page,
    }) => {

      const relationName = `pwRelEditModal${uuid()}`;
      const updatedDisplayName = `PW Modal Updated ${uuid()}`;
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await createRelationTypeViaApi(apiContext, {
          name: relationName,
          displayName: 'PW Modal Original',
        });

        await openGovernanceSettings(page);
        await navigateToGlossaryList(page);

        await test.step('Open edit form page', async () => {
          await findRowAcrossPages(page, `edit-${relationName}-btn`);
          await page.getByTestId(`edit-${relationName}-btn`).click();
          await expect(page.getByTestId('glossary-form-page')).toBeVisible();
        });

        await test.step('Name input is disabled in edit mode', async () => {
          await expect(
            page.getByTestId('name-input').locator('input')
          ).toBeDisabled();
        });

        await test.step('Update display name and description', async () => {
          await fillInput(page, 'display-name-input', updatedDisplayName);
          await fillTextArea(
            page,
            'description-input',
            'Updated description from modal'
          );
        });

        await test.step('Save updates the entity', async () => {
          const updateResponse = waitForResponseWithStatus(
            page,
            (r) =>
              r.url().includes(RELATION_TYPES_API) &&
              r.request().method() === 'PUT',
            200
          );
          await page.getByTestId('glossary-form-save').click();
          await updateResponse;

          await toastNotification(page, 'Relation Type updated successfully.');
          await expect(page.getByTestId('relation-types-table')).toBeVisible();
          await expect(
            page
              .getByTestId('relation-types-table')
              .getByText(updatedDisplayName)
          ).toBeVisible();
        });
      } finally {
        await deleteRelationTypeByNameViaApi(apiContext, relationName);
        await afterAction();
      }
    });

    test('deletes a custom relation type', async ({ page }) => {

      const relationName = `pwRelDeleteModal${uuid()}`;
      const { apiContext, afterAction } = await getApiContext(page);

      try {
        const relationshipType = await createRelationTypeViaApi(apiContext, {
          name: relationName,
          displayName: 'PW Modal Delete',
        });

        await openGovernanceSettings(page);
        await navigateToGlossaryList(page);

        await findRowAcrossPages(page, `relation-name-${relationName}`);
        await expect(
          page.getByTestId(`relation-name-${relationName}`)
        ).toBeVisible();

        await test.step('Click delete and confirm', async () => {
          const deleteResponse = waitForResponseWithStatus(
            page,
            (r) =>
              r
                .url()
                .includes(`${RELATION_TYPES_API}/${relationshipType.id}`) &&
              r.request().method() === 'DELETE',
            200
          );
          await page.getByTestId(`delete-${relationName}-btn`).click();
          await page.getByTestId('confirm-delete-btn').click();
          await deleteResponse;
        });

        await toastNotification(page, 'Relation Type deleted successfully!');
        await expect(
          page.getByTestId(`relation-name-${relationName}`)
        ).toHaveCount(0);
      } finally {
        await deleteRelationTypeByNameViaApi(apiContext, relationName);
        await afterAction();
      }
    });

    test('system-defined relation types are locked from edit and delete', async ({
      page,
    }) => {
      await openGovernanceSettings(page);
      await navigateToGlossaryList(page);

      await findRowAcrossPages(
        page,
        `relation-name-${SYSTEM_DEFINED_RELATION}`
      );
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

    test('header breadcrumb navigates back from glossary form page', async ({
      page,
    }) => {
      await openGovernanceSettings(page);
      await navigateToGlossaryList(page);

      await page.getByTestId('add-relation-type').click();
      await expect(page.getByTestId('glossary-form-page')).toBeVisible();

      // Click "Glossary Term Relations" in breadcrumb
      await page
        .getByTestId('profile-content-header')
        .getByLabel('Breadcrumb')
        .getByText('Glossary Term Relations', { exact: true })
        .click();

      await expect(page.getByTestId('relation-types-table')).toBeVisible();
    });
  }
);

test.describe(
  'Profile Governance — Intake Forms CRUD',
  { tag: ['@Governance', '@Features'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    const DP_ENTITY_TYPE = 'dataProduct';
    const suffix = uuid();
    const customPropertyName = `pwModalIntakeProp${suffix}`;

    test.beforeAll(
      'Ensure clean state and custom property',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await ensureNoIntakeForm(apiContext, DP_ENTITY_TYPE);
        await ensureCustomProperty(
          apiContext,
          DP_ENTITY_TYPE,
          customPropertyName,
          'string'
        );
        await afterAction();
      }
    );

    test.beforeEach(
      'Reset to empty state + populate IndexedDB',
      async ({ browser, page }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await ensureNoIntakeForm(apiContext, DP_ENTITY_TYPE);
        await afterAction();
        // Populate IndexedDB so getApiContext(page) works inside test bodies
        await redirectToHomePage(page);
      }
    );

    test.afterAll('Tear down intake forms', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await ensureNoIntakeForm(apiContext, DP_ENTITY_TYPE);
      await afterAction();
    });

    test('creates a Data Product intake form via the form page', async ({
      page,
    }) => {

      await openGovernanceSettings(page);
      await navigateToIntakeList(page);

      await test.step('Open the add form via dropdown', async () => {
        await page.getByTestId('add-intake-form').click();
        const menuItem = page
          .getByRole('menu')
          .getByRole('menuitem', { name: /^Data Product$/ });
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        await expect(page.getByTestId('intake-form-page')).toBeVisible();
        await expect(
          page.getByTestId('intake-form-designer-body')
        ).toBeVisible();
      });

      await test.step('Form shows the one-per-type help alert', async () => {
        await expect(
          page.getByRole('alert').filter({ hasText: /only one intake form/i })
        ).toBeVisible();
      });

      await test.step('Fill description and enabled toggle', async () => {
        await page
          .getByTestId('intake-form-description')
          .locator('textarea')
          .fill('Data Product intake form created from profile modal');
        // Toggle is on by default — verify it is checked
        await expect(
          page.getByTestId('intake-form-enabled').locator('input')
        ).toBeChecked();
      });

      await test.step('Include and require the custom property', async () => {
        const includeCheckbox = page.getByTestId(
          `include-extension.${customPropertyName}`
        );
        await expect(includeCheckbox).toBeVisible();
        await includeCheckbox.click();

        const requireCheckbox = page.getByTestId(
          `require-extension.${customPropertyName}`
        );
        await expect(requireCheckbox).toBeVisible();
        await requireCheckbox.click();

        await page
          .getByTestId(`error-extension.${customPropertyName}`)
          .locator('input')
          .fill('This field is required by governance policy');
      });

      await test.step('Submit creates the form and returns to the list', async () => {
        const createResponse = waitForResponseWithStatus(
          page,
          (r) =>
            r.url().endsWith(INTAKE_FORMS_API) &&
            r.request().method() === 'POST',
          201
        );
        await page.getByTestId('intake-form-submit').click();
        const response = await createResponse;
        const body = await response.json();
        expect(body.entityType).toBe(DP_ENTITY_TYPE);
        expect(body.formFields).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              fieldPath: `extension.${customPropertyName}`,
              required: true,
            }),
          ])
        );

        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId('add-intake-form')).toBeVisible();
        await expect(page.getByTestId(`row-${DP_ENTITY_TYPE}`)).toBeVisible();
      });
    });

    test('cancel on the intake form page returns to the list without saving', async ({
      page,
    }) => {

      await openGovernanceSettings(page);
      await navigateToIntakeList(page);

      await page.getByTestId('add-intake-form').click();
      const menuItem = page
        .getByRole('menu')
        .getByRole('menuitem', { name: /^Data Product$/ });
      await menuItem.click();

      await expect(page.getByTestId('intake-form-page')).toBeVisible();

      await page.getByTestId('intake-form-cancel').click();

      await expect(page.getByTestId('add-intake-form')).toBeVisible();
      // No row should exist since we cancelled
      await expect(page.getByTestId(`row-${DP_ENTITY_TYPE}`)).toHaveCount(0);
    });

    test('edits an existing intake form via the form page', async ({
      browser,
      page,
    }) => {

      await test.step('Seed a form via API', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post(INTAKE_FORMS_API, {
          data: {
            name: DP_ENTITY_TYPE,
            entityType: DP_ENTITY_TYPE,
            enabled: true,
            formFields: [
              {
                fieldKind: 'customProperty',
                fieldLabel: customPropertyName,
                fieldPath: `extension.${customPropertyName}`,
                required: false,
              },
            ],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await openGovernanceSettings(page);
      await navigateToIntakeList(page);

      await expect(page.getByTestId(`edit-${DP_ENTITY_TYPE}`)).toBeVisible({
        timeout: 30_000,
      });

      await test.step('Open edit form page', async () => {
        await page.getByTestId(`edit-${DP_ENTITY_TYPE}`).click();
        await expect(page.getByTestId('intake-form-page')).toBeVisible();
        await expect(
          page.getByTestId('intake-form-designer-body')
        ).toBeVisible();
      });

      await test.step('Mark the custom property as required', async () => {
        await page
          .getByTestId(`require-extension.${customPropertyName}`)
          .click();
      });

      await test.step('Save updates the form', async () => {
        const updateResponse = waitForResponseWithStatus(
          page,
          (r) =>
            r.url().endsWith(INTAKE_FORMS_API) &&
            r.request().method() === 'PUT',
          200
        );
        await page.getByTestId('intake-form-submit').click();
        const response = await updateResponse;
        const body = await response.json();
        expect(body.formFields).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              fieldPath: `extension.${customPropertyName}`,
              required: true,
            }),
          ])
        );

        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId(`row-${DP_ENTITY_TYPE}`)).toBeVisible();
      });
    });

    test('toggle enabled/disabled for an intake form', async ({
      browser,
      page,
    }) => {
      await test.step('Seed an enabled form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post(INTAKE_FORMS_API, {
          data: {
            name: DP_ENTITY_TYPE,
            entityType: DP_ENTITY_TYPE,
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await openGovernanceSettings(page);

      const listResponse = page.waitForResponse(
        (r) =>
          r.url().includes(INTAKE_FORMS_API) && r.request().method() === 'GET'
      );
      await page.getByTestId('governance-card-intake-forms').click();
      await listResponse;

      const toggle = page.getByTestId(`toggle-${DP_ENTITY_TYPE}`);
      await expect(toggle).toBeVisible({ timeout: 30_000 });

      const patchResponse = waitForResponseWithStatus(
        page,
        (r) =>
          r.url().includes(`${INTAKE_FORMS_API}/`) &&
          r.request().method() === 'PATCH',
        200
      );
      await toggle.click();
      const response = await patchResponse;
      const body = await response.json();
      expect(body.enabled).toBe(false);

      // Toggle input should now be unchecked
      await expect(toggle.locator('input')).not.toBeChecked();
    });

    test('deletes an intake form from the list', async ({ browser, page }) => {
      await test.step('Seed a form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post(INTAKE_FORMS_API, {
          data: {
            name: DP_ENTITY_TYPE,
            entityType: DP_ENTITY_TYPE,
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await openGovernanceSettings(page);
      await navigateToIntakeList(page);

      await expect(page.getByTestId(`delete-${DP_ENTITY_TYPE}`)).toBeVisible({
        timeout: 30_000,
      });

      await test.step('Delete via the confirm dialog', async () => {
        const deleteResponse = page.waitForResponse(
          (r) =>
            r.url().includes(INTAKE_FORMS_API + '/') &&
            r.request().method() === 'DELETE'
        );
        await page.getByTestId(`delete-${DP_ENTITY_TYPE}`).click();
        const dialog = page.getByTestId('intake-form-delete-confirm');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Delete' }).click();
        const response = await deleteResponse;
        expect([200, 204]).toContain(response.status());
      });

      await waitForAllLoadersToDisappear(page);

      // Row is gone; Data Product is available in the add dropdown again
      await page.getByTestId('add-intake-form').click();
      const menuItem = page
        .getByRole('menu')
        .getByRole('menuitem', { name: /^Data Product$/ });
      await expect(menuItem).toBeVisible();
      await expect(menuItem).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('cancel delete keeps the intake form intact', async ({
      browser,
      page,
    }) => {
      await test.step('Seed a form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post(INTAKE_FORMS_API, {
          data: {
            name: DP_ENTITY_TYPE,
            entityType: DP_ENTITY_TYPE,
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await openGovernanceSettings(page);
      await navigateToIntakeList(page);

      const deleteButton = page.getByTestId(`delete-${DP_ENTITY_TYPE}`);
      await expect(deleteButton).toBeVisible({ timeout: 30_000 });
      await deleteButton.click();

      const dialog = page.getByTestId('intake-form-delete-confirm');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await expect(dialog).not.toBeVisible();
      // Row and its toggle are still there
      await expect(page.getByTestId(`delete-${DP_ENTITY_TYPE}`)).toBeVisible();
      await expect(
        page.getByTestId(`toggle-${DP_ENTITY_TYPE}`).locator('input')
      ).toBeChecked();
    });

    test('"Data Product" option is disabled when a form already exists', async ({
      browser,
      page,
    }) => {
      await test.step('Seed a form', async () => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const res = await apiContext.post(INTAKE_FORMS_API, {
          data: {
            name: DP_ENTITY_TYPE,
            entityType: DP_ENTITY_TYPE,
            enabled: true,
            requiredFields: [],
          },
        });
        expect(res.status()).toBe(201);
        await afterAction();
      });

      await openGovernanceSettings(page);
      await navigateToIntakeList(page);

      await page.getByTestId('add-intake-form').click();
      const menu = page.getByRole('menu');
      const disabledItem = menu.getByText(/Data Product.*already configured/i);
      await expect(disabledItem).toBeVisible();
      const menuItem = menu
        .getByRole('menuitem')
        .filter({ hasText: /Data Product/ });
      await expect(menuItem).toHaveAttribute('aria-disabled', 'true');
    });
  }
);
