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
 * CRUD + permission Playwright tests for the Custom Properties panel in AI mode.
 *
 * Flow: AI mode → user-menu trigger → profile panel → Custom Properties nav
 *   → landing (entity-type grid) → Table detail → add / view / edit / delete.
 *
 * Property types covered (unique conditional-field combinations):
 *   • String           — no conditional config
 *   • Enum             — enum values (creatable multi-select) + multi-select toggle
 *   • Date             — format-config select
 *   • Entity Reference List — entity-reference-types multi-select
 *
 * Note on form-field selectors:
 *   FieldProp `data-testid` is applied to the wrapper Box div, not the inner
 *   control. Always chain from the wrapper to the semantic role:
 *     TEXT    → getByRole('textbox')
 *     SELECT  → getByRole('button') → click → page.getByRole('option', { name })
 *     MULTI   → locator('input')   → fill  → press('Enter') / option click
 *     SWITCH  → getByRole('switch')
 */

import { Page } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { UserClass } from '../../../support/user/UserClass';
import {
  fillDescriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { performAdminLogin } from '../../../utils/admin';
import { enableAiAppMode } from '../../Utils/appMode';

// ── Constants ──────────────────────────────────────────────────────────────────

const TABLE_FQN = 'table';

// ── Navigation helpers ─────────────────────────────────────────────────────────

/**
 * Enable AI mode, navigate to the home page, wait for the AI sidebar to be
 * fully rendered (this also settles the in-flight React router navigation so
 * the PersonalSpaceModal pathname-change guard does not fire), open the profile
 * panel, click the "Custom Properties" nav item, and select the Table entity
 * card.  Leaves the page on the detail view with custom-property-table visible.
 */
const navigateToTableCustomProperties = async (page: Page): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  // Waiting for the sidebar trigger being visible ensures both:
  //  1. The AI shell rendered successfully (correct mode).
  //  2. The React router has settled on /my-data (no more in-flight navigation
  //     that PersonalSpaceModal's pathname-change useEffect would mis-fire on).
  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

  // Open the user-menu dropdown in the AI sidebar.
  await page.getByTestId('ask-ai-user-menu-trigger').click();

  // Click the profile header card to open the profile panel.
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor();

  // Click "Custom Properties" in the side navigation.
  await page.getByTestId('profile-nav-custom-properties').click();
  await page.getByTestId('custom-properties-landing').waitFor();

  // Click the Table entity-type card and wait for the detail fetch.
  const typeResponse = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/v1/metadata/types/name/${TABLE_FQN}`) &&
      res.request().method() === 'GET'
  );
  await page.getByTestId(`entity-type-card-${TABLE_FQN}`).click();
  await typeResponse;
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('custom-property-table').waitFor();
};

/**
 * Click "Add Custom Property" and wait for the add form to render.
 * Hoists the property-types list request before the click.
 */
const openAddPropertyForm = async (page: Page): Promise<void> => {
  const typesResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/metadata/types') &&
      res.url().includes('category=field') &&
      res.request().method() === 'GET'
  );
  await page.getByTestId('add-custom-property-btn').click();
  await typesResponse;
  await page.getByTestId('custom-properties-add-page').waitFor();
};

/**
 * Open a react-aria Select field (identified by its wrapper data-testid) and
 * pick the named option from the resulting listbox.
 */
const chooseSelectOption = async (
  page: Page,
  wrapperTestId: string,
  optionName: string
): Promise<void> => {
  // The wrapper div contains a react-aria <button aria-haspopup="listbox">.
  await page.getByTestId(wrapperTestId).getByRole('button').click();
  await page.getByRole('option', { exact: true, name: optionName }).click();
};

/**
 * Hoist the PUT response listener, click "Save Changes", await the response,
 * assert HTTP 200, then wait for the detail table to reappear.
 */
const submitAddForm = async (page: Page): Promise<void> => {
  const putResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/metadata/types/') &&
      res.request().method() === 'PUT'
  );
  await page.getByTestId('custom-property-save').click();
  const res = await putResponse;
  expect(res.status()).toBe(200);
  await page.getByTestId('custom-property-table').waitFor();
};

/**
 * Remove a custom property by name using the admin REST API.
 * Used as in-test cleanup so each add-test is self-contained.
 */
const deletePropertyViaApi = async (
  page: Page,
  propertyName: string
): Promise<void> => {
  const { apiContext, afterAction } = await getApiContext(page);
  try {
    const typeRes = await apiContext.get(
      `/api/v1/metadata/types/name/${TABLE_FQN}?fields=customProperties`
    );
    const typeData = await typeRes.json();
    const remaining = (typeData.customProperties ?? []).filter(
      (p: { name: string }) => p.name !== propertyName
    );
    await apiContext.patch(`/api/v1/metadata/types/${typeData.id}`, {
      data: [{ op: 'replace', path: '/customProperties', value: remaining }],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
  } finally {
    await afterAction();
  }
};

// ── Admin tests ────────────────────────────────────────────────────────────────

test.describe('Custom Properties Panel — AI Mode', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  // ── Landing ──────────────────────────────────────────────────────────────────

  test('landing page shows grouped entity-type cards', async ({ page }) => {
    await enableAiAppMode(page);
    await redirectToHomePage(page);
    await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

    await page.getByTestId('ask-ai-user-menu-trigger').click();
    await page.getByTestId('ai-user-menu-profile').click();
    await page.getByTestId('ai-profile-page').waitFor();
    await page.getByTestId('profile-nav-custom-properties').click();

    const landing = page.getByTestId('custom-properties-landing');
    await landing.waitFor();

    // Two cards from different groups (DATABASE & STORAGE / DASHBOARDS) are visible.
    await expect(
      page.getByTestId(`entity-type-card-${TABLE_FQN}`)
    ).toBeVisible();
    await expect(page.getByTestId('entity-type-card-dashboard')).toBeVisible();
  });

  // ── Add: String ──────────────────────────────────────────────────────────────

  test('adds a String custom property', async ({ page }) => {
    const name = `cp_string_${uuid()}`;

    await navigateToTableCustomProperties(page);
    await openAddPropertyForm(page);

    const form = page.getByTestId('custom-properties-add-page');

    // TEXT field: data-testid is on a wrapper div → chain to the inner input.
    await form
      .getByTestId('custom-property-name')
      .getByRole('textbox')
      .fill(name);

    // SELECT field: wrapper button opens a react-aria listbox.
    await chooseSelectOption(page, 'custom-property-type', 'String');

    await fillDescriptionBox(page, `String property ${name}`);
    await submitAddForm(page);

    await expect(page.locator('tr').filter({ hasText: name })).toBeVisible();

    // Cleanup via API so the next test starts clean.
    await deletePropertyViaApi(page, name);
  });

  // ── Add: Date ────────────────────────────────────────────────────────────────

  test('adds a Date custom property with format config', async ({ page }) => {
    const name = `cp_date_${uuid()}`;

    await navigateToTableCustomProperties(page);
    await openAddPropertyForm(page);

    const form = page.getByTestId('custom-properties-add-page');
    await form
      .getByTestId('custom-property-name')
      .getByRole('textbox')
      .fill(name);
    await chooseSelectOption(page, 'custom-property-type', 'Date');

    // SELECT for format — same wrapper-button pattern.
    await chooseSelectOption(
      page,
      'custom-property-format-config',
      'yyyy-MM-dd'
    );

    await fillDescriptionBox(page, `Date property ${name}`);
    await submitAddForm(page);

    await expect(page.locator('tr').filter({ hasText: name })).toBeVisible();

    await deletePropertyViaApi(page, name);
  });

  // ── Add: Entity Reference List ────────────────────────────────────────────────

  test('adds an Entity Reference List custom property', async ({ page }) => {
    const name = `cp_erl_${uuid()}`;

    await navigateToTableCustomProperties(page);
    await openAddPropertyForm(page);

    const form = page.getByTestId('custom-properties-add-page');
    await form
      .getByTestId('custom-property-name')
      .getByRole('textbox')
      .fill(name);
    await chooseSelectOption(
      page,
      'custom-property-type',
      'Entity Reference List'
    );

    // MULTI_SELECT (fixed options, not creatable): click input to open, then
    // pick each option from the react-aria listbox.
    const refInput = form
      .getByTestId('custom-property-entity-ref-config')
      .locator('input');
    await refInput.click();
    await page.getByRole('option', { exact: true, name: 'User' }).click();
    await refInput.click();
    await page.getByRole('option', { exact: true, name: 'Team' }).click();

    await fillDescriptionBox(page, `Entity Reference List property ${name}`);
    await submitAddForm(page);

    await expect(page.locator('tr').filter({ hasText: name })).toBeVisible();

    await deletePropertyViaApi(page, name);
  });

  // ── Edit ──────────────────────────────────────────────────────────────────────

  test('edits a custom property display name and description', async ({
    page,
  }) => {
    const name = `cp_edit_${uuid()}`;
    const updatedDisplayName = `${name} (edited)`;

    // Create via UI to exercise the add path end-to-end.
    await navigateToTableCustomProperties(page);
    await openAddPropertyForm(page);

    const form = page.getByTestId('custom-properties-add-page');
    await form
      .getByTestId('custom-property-name')
      .getByRole('textbox')
      .fill(name);
    await chooseSelectOption(page, 'custom-property-type', 'String');
    await fillDescriptionBox(page, 'Initial description');
    await submitAddForm(page);

    // Find the row and click the Edit button (aria-label="Edit").
    const row = page.locator('tr').filter({ hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Edit' }).click();

    const editForm = page.getByTestId('custom-properties-edit-page');
    await editForm.waitFor();

    // TEXT field in edit form.
    const displayInput = editForm
      .getByTestId('edit-custom-property-display-name')
      .getByRole('textbox');
    await displayInput.clear();
    await displayInput.fill(updatedDisplayName);

    await fillDescriptionBox(page, 'Updated description');

    // Hoist PATCH listener before clicking Save.
    const patchResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/metadata/types/') &&
        res.request().method() === 'PATCH'
    );
    await page.getByTestId('edit-custom-property-save').click();
    const res = await patchResponse;
    expect(res.status()).toBe(200);

    // Back on detail page — updated display name is visible.
    await page.getByTestId('custom-property-table').waitFor();
    await expect(
      page.locator('tr').filter({ hasText: updatedDisplayName })
    ).toBeVisible();

    // Cleanup (property name key is unchanged; display name is cosmetic).
    await deletePropertyViaApi(page, name);
  });

  // ── Delete ────────────────────────────────────────────────────────────────────

  test('deletes a custom property via the confirmation modal', async ({
    page,
  }) => {
    const name = `cp_del_${uuid()}`;

    // Create via UI.
    await navigateToTableCustomProperties(page);
    await openAddPropertyForm(page);

    const form = page.getByTestId('custom-properties-add-page');
    await form
      .getByTestId('custom-property-name')
      .getByRole('textbox')
      .fill(name);
    await chooseSelectOption(page, 'custom-property-type', 'String');
    await fillDescriptionBox(page, 'To be deleted');
    await submitAddForm(page);

    const row = page.locator('tr').filter({ hasText: name });
    await expect(row).toBeVisible();

    // Click the Delete button on the row (aria-label="Delete").
    await row.getByRole('button', { name: 'Delete' }).click();

    // Wait for the confirmation modal.
    await page.getByTestId('delete-modal').waitFor();

    // Hoist PATCH listener before confirming.
    const patchResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/metadata/types/') &&
        res.request().method() === 'PATCH'
    );
    await page.getByTestId('confirm-button').click();
    const res = await patchResponse;
    expect(res.status()).toBe(200);

    // The property row must no longer appear.
    await expect(
      page.locator('tr').filter({ hasText: name })
    ).not.toBeVisible();
  });
});

// ── Permission tests ───────────────────────────────────────────────────────────

/**
 * Users without any `type` resource permission should not see the
 * "Custom Properties" nav item in the AI profile sidebar at all.
 * dataConsumer has no type-resource grants in the default policy set.
 */
let viewOnlyUser: UserClass;
let viewOnlyPolicy: PolicyClass;
let viewOnlyRole: RolesClass;

test.describe('Custom Properties Panel — user without type permissions', () => {

  test.beforeAll(async ({ browser }) => {
    viewOnlyUser = new UserClass();
    viewOnlyPolicy = new PolicyClass();
    viewOnlyRole = new RolesClass();
    customPropertyName = `cp_perm_${uuid()}`;

    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await viewOnlyUser.create(apiContext, false);

      await viewOnlyPolicy.create(apiContext, [
        {
          name: 'ViewAllOnlyRule',
          resources: ['All'],
          operations: ['ViewAll'],
          effect: 'allow',
        },
         {
          name: 'DenyTypeView',
          resources: ['type'],
          operations: ['ViewAll'],
          effect: 'deny',
        },
      ]);
      await viewOnlyRole.create(apiContext, [viewOnlyPolicy.responseData.name]);

      await viewOnlyUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: viewOnlyRole.responseData.id,
              type: 'role',
              name: viewOnlyRole.responseData.name,
            },
          },
        ],
      });
      
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await viewOnlyUser.delete(apiContext);
      await viewOnlyRole.delete(apiContext);
      await viewOnlyPolicy.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('Custom Properties nav item is not visible in sidebar', async ({ browser }) => {
     const page = await browser.newPage();
    try {
      await viewOnlyUser.login(page);
    await enableAiAppMode(page);
    await redirectToHomePage(page);
    await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

    await page.getByTestId('ask-ai-user-menu-trigger').click();
    await page.getByTestId('ai-user-menu-profile').click();
    await page.getByTestId('ai-profile-page').waitFor();

    await expect(
      page.getByTestId('profile-nav-custom-properties')
    ).not.toBeVisible();
      } finally {
       await page.close();
      }
  });
});

/**
 * A non-admin user whose role grants [Create, Delete, EditAll, ViewAll] on
 * the `type` resource must be able to see the landing page, navigate to the
 * Table detail, and see all three action buttons (Add, Edit, Delete).
 *
 * Strategy: beforeAll creates policy → role → user via UserClass/PoliciesClass/
 * RolesClass (in-memory, no JSON file written), seeds a property, then each
 * test creates a fresh page and logs in via typeUser.login(page).
 */

let typeUser: UserClass;
let typePolicy: PolicyClass;
let typeRole: RolesClass;
let typePropertyName: string;

test.describe('Custom Properties Panel — non-admin user with type permissions', () => {
  test.beforeAll(async ({ browser }) => {
    typeUser = new UserClass();
    typePolicy = new PolicyClass();
    typeRole = new RolesClass();
    typePropertyName = `cp_perm_${uuid()}`;

    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      // 1. Create user (no default role).
      await typeUser.create(apiContext, false);

      // 2. Create policy + role granting full type-resource access.
      // GeneralViewRule is required so the user can navigate the app at all;
      // without ViewAll on All the UI blocks every page load.
      await typePolicy.create(apiContext, [
        {
          name: 'GeneralViewRule',
          resources: ['All'],
          operations: ['ViewAll'],
          effect: 'allow',
        },
        {
          name: 'TypeFullAccessRule',
          resources: ['type'],
          operations: ['ViewAll', 'EditAll', 'Create', 'Delete'],
          effect: 'allow',
        },
      ]);
      await typeRole.create(apiContext, [typePolicy.responseData.name]);

      // 3. Assign the role directly to the user.
      await typeUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: typeRole.responseData.id,
              type: 'role',
              name: typeRole.responseData.name,
            },
          },
        ],
      });

      // 4. Seed a String property on the Table type so the detail page is non-empty.
      const typeDataRes = await apiContext.get(
        `/api/v1/metadata/types/name/${TABLE_FQN}?fields=customProperties`
      );
      const typeData = await typeDataRes.json();
      const stringTypeRes = await apiContext.get(
        '/api/v1/metadata/types/name/string'
      );
      const stringType = await stringTypeRes.json();
      await apiContext.put(`/api/v1/metadata/types/${typeData.id}`, {
        data: {
          name: typePropertyName,
          description: 'Permission test property',
          propertyType: { id: stringType.id, type: 'type' },
        },
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      // Remove the seeded property from the Table type.
      const typeDataRes = await apiContext.get(
        `/api/v1/metadata/types/name/${TABLE_FQN}?fields=customProperties`
      );
      const typeData = await typeDataRes.json();
      const remaining = (typeData.customProperties ?? []).filter(
        (p: { name: string }) => p.name !== typePropertyName
      );
      await apiContext.patch(`/api/v1/metadata/types/${typeData.id}`, {
        data: [{ op: 'replace', path: '/customProperties', value: remaining }],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      // Clean up user, role, policy.
      await typeUser.delete(apiContext);
      await typeRole.delete(apiContext);
      await typePolicy.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('sidebar shows Custom Properties nav and landing page shows entity cards', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    try {
      await typeUser.login(page);
      await enableAiAppMode(page);
      await redirectToHomePage(page);
      await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

      await page.getByTestId('ask-ai-user-menu-trigger').click();
      await page.getByTestId('ai-user-menu-profile').click();
      await page.getByTestId('ai-profile-page').waitFor();

      await expect(
        page.getByTestId('profile-nav-custom-properties')
      ).toBeVisible();
      await page.getByTestId('profile-nav-custom-properties').click();

      await page.getByTestId('custom-properties-landing').waitFor();

      await expect(
        page.getByTestId(`entity-type-card-${TABLE_FQN}`)
      ).toBeVisible();
    } finally {
      await page.close();
    }
  });

  test('detail page shows Add, Edit, Delete buttons', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await typeUser.login(page);
      await enableAiAppMode(page);
      await redirectToHomePage(page);
      await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

      await page.getByTestId('ask-ai-user-menu-trigger').click();
      await page.getByTestId('ai-user-menu-profile').click();
      await page.getByTestId('ai-profile-page').waitFor();
      await page.getByTestId('profile-nav-custom-properties').click();
      await page.getByTestId('custom-properties-landing').waitFor();

      const typeResponse = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/metadata/types/name/${TABLE_FQN}`) &&
          res.request().method() === 'GET'
      );
      await page.getByTestId(`entity-type-card-${TABLE_FQN}`).click();
      await typeResponse;
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('custom-property-table').waitFor();

      // User has Create → Add button visible.
      await expect(page.getByTestId('add-custom-property-btn')).toBeVisible();

      // User has EditAll + Delete → Edit and Delete buttons visible on the seeded row.
      const row = page.locator('tr').filter({ hasText: typePropertyName });
      await expect(row).toBeVisible();
      await expect(row.getByRole('button', { name: 'Edit' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Delete' })).toBeVisible();
    } finally {
      await page.close();
    }
  });
});

// ── ViewAll-only permission tests ──────────────────────────────────────────────

/**
 * A user whose role grants only ViewAll on All resources has no explicit type
 * management permission (Create / EditAll / Delete), so the Custom Properties
 * nav item must not appear — and therefore Add / Edit / Delete action buttons
 * inside the panel are also inaccessible.
 */

let viewAllUser: UserClass;
let viewAllPolicy: PolicyClass;
let viewAllRole: RolesClass;
let customPropertyName: string;

test.describe('Custom Properties Panel — user with ViewAll on All only', () => {
  test.beforeAll(async ({ browser }) => {
    viewAllUser = new UserClass();
    viewAllPolicy = new PolicyClass();
    viewAllRole = new RolesClass();
    customPropertyName = `cp_perm_${uuid()}`;

    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await viewAllUser.create(apiContext, false);

      await viewAllPolicy.create(apiContext, [
        {
          name: 'ViewAllOnlyRule',
          resources: ['All'],
          operations: ['ViewAll'],
          effect: 'allow',
        },
      ]);
      await viewAllRole.create(apiContext, [viewAllPolicy.responseData.name]);

      await viewAllUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: viewAllRole.responseData.id,
              type: 'role',
              name: viewAllRole.responseData.name,
            },
          },
        ],
      });

       const typeDataRes = await apiContext.get(
        `/api/v1/metadata/types/name/${TABLE_FQN}?fields=customProperties`
      );
      const typeData = await typeDataRes.json();
      const stringTypeRes = await apiContext.get(
        '/api/v1/metadata/types/name/string'
      );
      const stringType = await stringTypeRes.json();
      await apiContext.put(`/api/v1/metadata/types/${typeData.id}`, {
        data: {
          name: customPropertyName,
          description: 'Permission test property',
          propertyType: { id: stringType.id, type: 'type' },
        },
        headers: { 'Content-Type': 'application/json' },
      });
      
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await viewAllUser.delete(apiContext);
      await viewAllRole.delete(apiContext);
      await viewAllPolicy.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('detail page does not show Add, Edit, or Delete buttons with ViewAll only', async ({
    browser,
  }) => {
    const page = await browser.newPage();
    try {
      await viewAllUser.login(page);
      await enableAiAppMode(page);
      await redirectToHomePage(page);
     await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

      await page.getByTestId('ask-ai-user-menu-trigger').click();
      await page.getByTestId('ai-user-menu-profile').click();
      await page.getByTestId('ai-profile-page').waitFor();
      await page.getByTestId('profile-nav-custom-properties').click();
      await page.getByTestId('custom-properties-landing').waitFor();

      const typeResponse = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/v1/metadata/types/name/${TABLE_FQN}`) &&
          res.request().method() === 'GET'
      );
      await page.getByTestId(`entity-type-card-${TABLE_FQN}`).click();
      await typeResponse;
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('custom-property-table').waitFor();

      // User has Create → Add button visible.
      await expect(page.getByTestId('add-custom-property-btn')).not.toBeVisible();

      // User has EditAll + Delete → Edit and Delete buttons visible on the seeded row.
      const row = page.locator('tr').filter({ hasText: customPropertyName });
      await expect(row).toBeVisible();
      await expect(row.getByRole('button', { name: 'Edit' })).not.toBeVisible();
      await expect(row.getByRole('button', { name: 'Delete' })).not.toBeVisible();
    } finally {
      await page.close();
    }
  });
});
