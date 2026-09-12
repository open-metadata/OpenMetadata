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

import { Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import {
  DEFAULT_POLICIES,
  DEFAULT_POLICY_FQNS,
  VIEW_ALL_RULE,
} from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { expect, test } from '../../support/fixtures/base';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { getElementWithPagination } from '../../utils/roles';
import { enableAiAppMode } from '../Utils/appMode';

// ─── Navigation helpers ───────────────────────────────────────────────────────

/**
 * Enable AI app mode, navigate home, then open the personal-space modal and
 * navigate to the Access Control section.
 *
 * NOTE: This function calls redirectToHomePage internally, which populates
 * IndexedDB with the auth token. Call getApiContext AFTER this function, or
 * call redirectToHomePage first before getApiContext when pre-creating API data.
 */
const openAccessControlSettings = async (page: Page): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('profile-nav-access-control').click();
  await page.getByTestId('access-control-landing').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

const navigateToRolesPanel = async (page: Page): Promise<void> => {
  await page.getByTestId('access-control-card-roles').click();
  await page.getByTestId('roles-list-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

const navigateToPoliciesPanel = async (page: Page): Promise<void> => {
  await page.getByTestId('access-control-card-policies').click();
  await page.getByTestId('policies-list-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Use getElementWithPagination scoped to the roles container to avoid strict-mode
 * violations from other paginated components on the page.
 */
const navigateToRoleDetail = async (
  page: Page,
  roleName: string
): Promise<void> => {
  const container = page.getByTestId('roles-list-container');
  const roleRow = container.getByTestId(`role-${roleName}`)
  await getElementWithPagination(page, roleRow, false, 50, container);
  await roleRow.getByTestId('role-name').click();
  await page.getByTestId('role-detail-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Use getElementWithPagination scoped to the policies container to avoid strict-mode
 * violations from other paginated components on the page.
 */
const navigateToPolicyDetail = async (
  page: Page,
  policyName: string
): Promise<void> => {
  const container = page.getByTestId('policies-list-container');
  const policyRow = container.getByTestId(`policy-${policyName}`);
  await getElementWithPagination(page, policyRow, false, 50, container);
  await policyRow.getByTestId('policy-name').click();
  await page.getByTestId('policy-detail-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

const clickDetailTab = async (page: Page, tabText: string): Promise<void> => {
  await page.getByRole('tab', { name: new RegExp(tabText, 'i') }).click();
  await waitForAllLoadersToDisappear(page);
};

// ─── Tests ────────────────────────────────────────────────────────────────────

test.use({ storageState: 'playwright/.auth/admin.json' });

// ─── Landing page ─────────────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Landing',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should show all 4 landing cards and navigate to each panel', async ({
      page,
    }) => {
      await test.step('Open Access Control settings', async () => {
        await openAccessControlSettings(page);
      });

      await test.step('All 4 landing cards are visible', async () => {
        await expect(
          page.getByTestId('access-control-card-roles')
        ).toBeVisible();
        await expect(
          page.getByTestId('access-control-card-policies')
        ).toBeVisible();
        await expect(
          page.getByTestId('access-control-card-permission-debugger')
        ).toBeVisible();
        await expect(
          page.getByTestId('access-control-card-audit-logs')
        ).toBeVisible();
      });

      await test.step('Roles card navigates to roles list', async () => {
        await page.getByTestId('access-control-card-roles').click();
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('roles-list-container')
        ).toBeVisible();
      });

      await test.step('Policies card navigates to policies list', async () => {
        await page
          .getByTestId('profile-content-header')
          .getByText('Access Control', { exact: true } )
          .click();
        await waitForAllLoadersToDisappear(page);
        await page
          .getByTestId('access-control-landing')
          .waitFor({ state: 'visible' });
        await page.getByTestId('access-control-card-policies').click();
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('policies-list-container')
        ).toBeVisible();
      });

      await test.step('Permission Debugger card navigates to debugger panel', async () => {
        await page
          .getByTestId('profile-content-header')
          .getByText('Access Control', { exact: true } )
          .click();
        await waitForAllLoadersToDisappear(page);
        await page
          .getByTestId('access-control-landing')
          .waitFor({ state: 'visible' });
        await page
          .getByTestId('access-control-card-permission-debugger')
          .click();
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('admin-permission-debugger')
        ).toBeVisible();
      });

      await test.step('Audit Logs card navigates to audit logs panel', async () => {
        await page
          .getByTestId('profile-content-header')
          .getByText('Access Control', { exact: true } )
          .click();
        await waitForAllLoadersToDisappear(page);
        await page
          .getByTestId('access-control-landing')
          .waitFor({ state: 'visible' });
        await page.getByTestId('access-control-card-audit-logs').click();
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId('audit-logs-page')).toBeVisible();
      });
    });
  }
);

// ─── Roles ────────────────────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Roles',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should create a role via the UI and verify via toast', async ({
      page,
    }) => {
      const roleName = `PW-AC-Role-${uuid()}`;

      // Navigate first so IndexedDB is populated before getApiContext
      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);

      const { apiContext, afterAction } = await getApiContext(page);

      await test.step('Click Add Role button', async () => {
        await page.getByTestId('add-role').click();
        await page
          .getByTestId('add-role-container')
          .waitFor({ state: 'visible' });
      });

      await test.step('Fill role name', async () => {
        await page
          .getByTestId('role-name-input')
          .getByRole('textbox')
          .fill(roleName);
      });

      await test.step('Select a policy', async () => {
        const policyAutocomplete = page.getByTestId('role-policies-select');
        await policyAutocomplete.click();
        await policyAutocomplete
          .getByRole('combobox')
          .fill('Data Consumer');
        await page
          .getByRole('option', { name: DEFAULT_POLICIES.dataConsumerPolicy })
          .click();
      });

      await test.step('Submit and verify via toast', async () => {
        const responsePromise = page.waitForResponse(
          (r) => r.url().includes('/api/v1/roles') && r.status() === 201
        );
        await page.getByTestId('submit-btn').click();
        await responsePromise;

        // No search in the list — verify via success toast
        await toastNotification(page, /successfully/i);
      });

      // Cleanup via API (the role was just created)
      const roleData = await apiContext
        .get(`/api/v1/roles/name/${encodeURIComponent(roleName)}`)
        .then((r) => r.json());
      await apiContext.delete(
        `/api/v1/roles/${roleData.id}?hardDelete=true&recursive=true`
      );
      await afterAction();
    });

    test('should navigate to role detail and verify all 3 tabs', async ({
      page,
    }) => {
      const role = new RolesClass();

      // Navigate to home first so token is available for API pre-creation
      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);

      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);

      // Add admin user to role via API so the Users tab is non-empty
      const adminUser = await apiContext
        .get('/api/v1/users/name/admin?fields=id,name,displayName')
        .then((r) => r.json());
      await apiContext.patch(`/api/v1/roles/${role.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users/-',
            value: { id: adminUser.id, type: 'user', name: adminUser.name },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);

      await test.step('Policies tab (default) shows policy row', async () => {
        await expect(
          page.getByRole('tab', { name: /policies/i })
        ).toBeVisible();
        await expect(
          page.getByText(DEFAULT_POLICIES.dataConsumerPolicy)
        ).toBeVisible();
      });

      await test.step('Teams tab shows empty state', async () => {
        await clickDetailTab(page, 'teams');
        await expect(
          page.getByText('No Teams found')
        ).toBeVisible();
      });

      await test.step('Users tab shows pre-added user', async () => {
        await clickDetailTab(page, 'users');
        await expect(page.getByTestId(adminUser.name)).toBeVisible();
      });

      await role.delete(apiContext);
      await afterAction();
    });

    test('should edit role description', async ({ page }) => {
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);

      const updatedDescription = `Updated description ${uuid()}`;

      await test.step('Click edit description and fill', async () => {
        await page.getByTestId('edit-description-btn').click();
        const editor = page.locator(
          '.om-block-editor[contenteditable="true"]'
        );
        await editor.waitFor({ state: 'visible' });
        await editor.clear();
        await editor.fill(updatedDescription);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('role-detail-container')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify description updated', async () => {
        await expect(
          page.locator('.om-block-editor[contenteditable="true"]')
        ).not.toBeVisible();
        await expect(page.getByText(updatedDescription)).toBeVisible();
      });

      await role.delete(apiContext);
      await afterAction();
    });

    test('should rename a role', async ({ page }) => {
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);

      const newDisplayName = `Renamed Role ${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);

      await test.step('Click rename button and fill new name', async () => {
        await page.getByTestId('rename-role-btn').click();
        await page
          .getByTestId('rename-input')
          .waitFor({ state: 'visible' });
        const renameInput = page
          .getByTestId('rename-input')
          .getByRole('textbox');
        await renameInput.clear();
        await renameInput.fill(newDisplayName);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('profile-content-header')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify new display name is shown', async () => {
        await expect(page.getByTestId('rename-input')).not.toBeVisible();
        await expect(page.getByText(newDisplayName)).toBeVisible();
      });

      await role.delete(apiContext);
      await afterAction();
    });

    test('should add a policy to an existing role', async ({ page }) => {
      const role = new RolesClass();
      const extraPolicy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);
      await extraPolicy.create(apiContext, VIEW_ALL_RULE);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);

      await test.step('Click Add Policy button in Policies tab', async () => {
        await page.getByTestId('add-policy').click();
        await page
          .getByTestId('add-policy-select')
          .waitFor({ state: 'visible' });
      });

      await test.step('Select the extra policy', async () => {
        const autocomplete = page.getByTestId('add-policy-select');
        await autocomplete
          .getByRole('combobox')
          .fill(extraPolicy.responseData.displayName);
        await page
          .getByRole('option', {
            name: extraPolicy.responseData.displayName,
          })
          .click();
      });

      await test.step('Confirm adding policy', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('role-detail-container')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify new policy appears in the table', async () => {
        await expect(
          page.getByText(extraPolicy.responseData.displayName)
        ).toBeVisible();
      });

      await role.delete(apiContext);
      await extraPolicy.delete(apiContext);
      await afterAction();
    });

    test('should remove a policy from a role', async ({ page }) => {
      const role = new RolesClass();
      const policyToRemove = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policyToRemove.create(apiContext, VIEW_ALL_RULE);
      await role.create(apiContext, [
        DEFAULT_POLICY_FQNS.dataConsumerPolicy,
        policyToRemove.responseData.name,
      ]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);

      const policyDisplayName = policyToRemove.responseData.displayName;

      await test.step('Click remove button for the policy', async () => {
        await page.getByTestId(`remove-${policyDisplayName}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm removal', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await patchPromise;
      });

      await test.step('Policy is no longer listed', async () => {
        await expect(page.getByText(policyDisplayName)).not.toBeVisible();
      });

      await role.delete(apiContext);
      await policyToRemove.delete(apiContext);
      await afterAction();
    });

    test('should remove a user from a role via the Users tab', async ({
      page,
    }) => {
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);

      const adminUser = await apiContext
        .get('/api/v1/users/name/admin?fields=id,name,displayName')
        .then((r) => r.json());
      await apiContext.patch(`/api/v1/roles/${role.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/users/-',
            value: { id: adminUser.id, type: 'user', name: adminUser.name },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);
      await clickDetailTab(page, 'users');

      await test.step('User row is visible', async () => {
        await expect(page.getByTestId(adminUser.name)).toBeVisible();
      });

      await test.step('Click remove and confirm', async () => {
        await page.getByTestId(`remove-${adminUser.name}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await patchPromise;
      });

      await test.step('User row is gone', async () => {
        await expect(page.getByTestId(adminUser.name)).not.toBeVisible();
      });

      await role.delete(apiContext);
      await afterAction();
    });

    test('should delete a role from the roles list table', async ({ page }) => {
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);

      const roleName = role.responseData.displayName;
      const rolesContainer = page.getByTestId('roles-list-container');

      await test.step('Find role row via pagination and click delete', async () => {
        const roleRow = rolesContainer.getByTestId(`role-${roleName}`);
        await getElementWithPagination(page, roleRow, false, 50, rolesContainer);
        await roleRow.getByTestId(`delete-action-${roleName}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion and verify toast', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
        await toastNotification(page, /successfully/i);
      });

      await afterAction();
    });

    test('should delete a role from the role detail header', async ({
      page,
    }) => {
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICY_FQNS.dataConsumerPolicy]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.displayName);

      await test.step('Click delete role button in header', async () => {
        await page.getByTestId('delete-role-btn').click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion and verify navigation back to list', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
        await page
          .getByTestId('roles-list-container')
          .waitFor({ state: 'visible' });
      });

      await afterAction();
    });
  }
);

// ─── Policies ─────────────────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Policies',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should create a policy via the UI and verify via toast', async ({
      page,
    }) => {
      const policyName = `PW-AC-Policy-${uuid()}`;
      const ruleName = `PW-Rule-${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);

      const { apiContext, afterAction } = await getApiContext(page);

      await test.step('Click Add Policy button', async () => {
        await page.getByTestId('add-policy').click();
        await page
          .getByTestId('add-policy-container')
          .waitFor({ state: 'visible' });
      });

      await test.step('Fill policy name', async () => {
        await page
          .getByTestId('policy-name-input')
          .getByRole('textbox')
          .fill(policyName);
      });

      await test.step('Fill rule fields', async () => {
        await page
          .getByTestId('rule-name')
          .getByRole('textbox')
          .fill(ruleName);

        const resourcesAutocomplete = page.getByTestId('resources');
        await resourcesAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();

        const operationsAutocomplete = page.getByTestId('operations');
        await operationsAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();
      });

      await test.step('Submit and verify via toast', async () => {
        const responsePromise = page.waitForResponse(
          (r) => r.url().includes('/api/v1/policies') && r.status() === 201
        );
        await page.getByTestId('submit-btn').click();
        await responsePromise;

        // No search in the list — verify via success toast
        await toastNotification(page, /successfully/i);
      });

      const policyData = await apiContext
        .get(`/api/v1/policies/name/${encodeURIComponent(policyName)}`)
        .then((r) => r.json());
      await apiContext.delete(
        `/api/v1/policies/${policyData.id}?hardDelete=true&recursive=true`
      );
      await afterAction();
    });

    test('should view policy detail and verify all 3 tabs', async ({
      page,
    }) => {
      const policy = new PolicyClass();
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);

      await policy.create(apiContext, VIEW_ALL_RULE);
      await role.create(apiContext, [policy.responseData.name]);

      const orgTeam = await apiContext
        .get('/api/v1/teams/name/Organization?fields=id,name,displayName')
        .then((r) => r.json());

      // Use /teams (not /teams/-) to initialise the array — a freshly created
      // policy has no teams field and JSON-patch rejects the /teams/- append.
      await policy.patch(apiContext, [
        {
          op: 'add',
          path: '/teams',
          value: [{ id: orgTeam.id, type: 'team', name: orgTeam.name }],
        },
      ]);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Rules tab (default) shows rule card', async () => {
        await expect(
          page.getByTestId(`rule-${VIEW_ALL_RULE[0].name}`)
        ).toBeVisible();
      });

      await test.step('Roles tab shows pre-linked role', async () => {
        await clickDetailTab(page, 'roles');
        await expect(
          page.getByTestId(role.responseData.displayName)
        ).toBeVisible();
      });

      await test.step('Teams tab shows pre-linked team', async () => {
        await clickDetailTab(page, 'teams');
        await expect(page.getByTestId(orgTeam.name)).toBeVisible();
      });

      await role.delete(apiContext);
      await policy.delete(apiContext);
      await afterAction();
    });

    test('should edit policy description', async ({ page }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const updatedDescription = `Updated description ${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Click edit description and fill new value', async () => {
        await page.getByTestId('edit-description-btn').click();
        const editor = page.locator(
          '.om-block-editor[contenteditable="true"]'
        );
        await editor.waitFor({ state: 'visible' });
        await editor.clear();
        await editor.fill(updatedDescription);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('policy-detail-container')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify description updated', async () => {
        await expect(
          page.locator('.om-block-editor[contenteditable="true"]')
        ).not.toBeVisible();
        await expect(page.getByText(updatedDescription)).toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should rename a policy', async ({ page }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const newDisplayName = `Renamed Policy ${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Click rename button and fill new name', async () => {
        await page.getByTestId('rename-policy-btn').click();
        await page
          .getByTestId('rename-input')
          .waitFor({ state: 'visible' });
        const renameInput = page
          .getByTestId('rename-input')
          .getByRole('textbox');
        await renameInput.clear();
        await renameInput.fill(newDisplayName);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('profile-content-header')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify new display name is shown', async () => {
        await expect(page.getByTestId('rename-input')).not.toBeVisible();
        await expect(page.getByText(newDisplayName)).toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should add a rule to a policy', async ({ page }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);

      // Seed with a rule — the API requires at least one rule at creation time.
      await policy.create(apiContext, VIEW_ALL_RULE);

      const newRuleName = `PW-Rule-${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Existing seeded rule card is visible', async () => {
        await expect(
          page.getByTestId(`rule-${VIEW_ALL_RULE[0].name}`)
        ).toBeVisible();
      });

      await test.step('Click Add Rule button', async () => {
        await page.getByTestId('add-rule').click();
        await page.getByTestId('rule-name').waitFor({ state: 'visible' });
      });

      await test.step('Fill rule form', async () => {
        await page
          .getByTestId('rule-name')
          .getByRole('textbox')
          .fill(newRuleName);

        const resourcesAutocomplete = page.getByTestId('resources');
        await resourcesAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();

        const operationsAutocomplete = page.getByTestId('operations');
        await operationsAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();
      });

      await test.step('Save rule and verify new card appears', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('policy-detail-container')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
        await expect(page.getByTestId(`rule-${newRuleName}`)).toBeVisible();
        // Original seeded rule is still present
        await expect(
          page.getByTestId(`rule-${VIEW_ALL_RULE[0].name}`)
        ).toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should edit a rule in a policy', async ({ page }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const existingRuleName = VIEW_ALL_RULE[0].name;
      const updatedRuleName = `${existingRuleName}-Updated`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Click edit rule button', async () => {
        await page.getByTestId(`edit-rule-${existingRuleName}`).click();
        await page.getByTestId('rule-name').waitFor({ state: 'visible' });
      });

      await test.step('Change the rule name', async () => {
        const ruleNameInput = page
          .getByTestId('rule-name')
          .getByRole('textbox');
        await ruleNameInput.clear();
        await ruleNameInput.fill(updatedRuleName);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page
          .getByTestId('policy-detail-container')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify updated rule card appears', async () => {
        await expect(
          page.getByTestId(`rule-${updatedRuleName}`)
        ).toBeVisible();
        await expect(
          page.getByTestId(`rule-${existingRuleName}`)
        ).not.toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should delete a rule from a policy', async ({ page }) => {
      const extraRuleName = `PW-Extra-Rule-${uuid()}`;
      const twoRules = [
        ...VIEW_ALL_RULE,
        {
          name: extraRuleName,
          resources: ['All'],
          operations: ['ViewAll'],
          effect: 'allow',
        },
      ];
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, twoRules);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Click delete rule button and confirm', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH'
        );
        await page.getByTestId(`delete-rule-${extraRuleName}`).click();
        await patchPromise;
      });

      await test.step('Rule card is gone', async () => {
        await expect(
          page.getByTestId(`rule-${extraRuleName}`)
        ).not.toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should remove a role from a policy via Roles tab', async ({
      page,
    }) => {
      const policy = new PolicyClass();
      const role = new RolesClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);
      await role.create(apiContext, [policy.responseData.name]);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);
      await clickDetailTab(page, 'roles');

      await test.step('Role row is visible', async () => {
        await expect(
          page.getByTestId(role.responseData.displayName)
        ).toBeVisible();
      });

      await test.step('Click remove and confirm', async () => {
        await page.getByTestId(`remove-${role.responseData.displayName}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await patchPromise;
      });

      await test.step('Role row is gone', async () => {
        await expect(
          page.getByTestId(role.responseData.displayName)
        ).not.toBeVisible();
      });

      await role.delete(apiContext);
      await policy.delete(apiContext);
      await afterAction();
    });

    test('should remove a team from a policy via Teams tab', async ({
      page,
    }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const orgTeam = await apiContext
        .get('/api/v1/teams/name/Organization?fields=id,name,displayName')
        .then((r) => r.json());

      // Use /teams (not /teams/-) to initialise the array — a freshly created
      // policy has no teams field and JSON-patch rejects the /teams/- append.
      await policy.patch(apiContext, [
        {
          op: 'add',
          path: '/teams',
          value: [{ id: orgTeam.id, type: 'team', name: orgTeam.name }],
        },
      ]);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);
      await clickDetailTab(page, 'teams');

      await test.step('Team row is visible', async () => {
        await expect(page.getByTestId(orgTeam.name)).toBeVisible();
      });

      await test.step('Click remove and confirm', async () => {
        await page.getByTestId(`remove-${orgTeam.name}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await patchPromise;
      });

      await test.step('Team row is gone', async () => {
        await expect(page.getByTestId(orgTeam.name)).not.toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should delete a policy from the policies list table', async ({
      page,
    }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);

      const policyName = policy.responseData.displayName;
      const policiesContainer = page.getByTestId('policies-list-container');

      await test.step('Find policy row via pagination and click delete', async () => {
        const policyRow = policiesContainer.getByTestId(`policy-${policyName}`);
        await getElementWithPagination(
          page,
          policyRow,
          false,
          50,
          policiesContainer
        );
        await policyRow
          .getByTestId(`delete-action-${policyName}`)
          .click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion and verify toast', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
        await toastNotification(page, /successfully/i);
      });

      await afterAction();
    });

    test('should delete a policy from the policy detail header', async ({
      page,
    }) => {
      const policy = new PolicyClass();

      await redirectToHomePage(page);
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.displayName);

      await test.step('Click delete policy button in header', async () => {
        await page.getByTestId('delete-policy-btn').click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion and verify navigation back to list', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
        await page
          .getByTestId('policies-list-container')
          .waitFor({ state: 'visible' });
      });

      await afterAction();
    });
  }
);

// ─── Permission Debugger ──────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Permission Debugger',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should render debugger, load user permissions, evaluate and show result', async ({
      page,
    }) => {
      await openAccessControlSettings(page);
      await page
        .getByTestId('access-control-card-permission-debugger')
        .click();
      await page
        .getByTestId('admin-permission-debugger')
        .waitFor({ state: 'visible' });

      await test.step('Evaluate button is hidden until a user is selected', async () => {
        await expect(
          page.getByTestId('evaluate-permission-button')
        ).not.toBeVisible();
      });

      await test.step('Select a user and wait for permissions to load', async () => {
        const permissionsPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/permissions/debug') &&
            r.status() === 200
        );
        // ComboBox has no data-testid — locate by placeholder text
        const userCombobox = page.getByPlaceholder(/search.*user/i);
        await userCombobox.fill('admin');
        await page.getByRole('option', { name: /admin/i }).click();
        await permissionsPromise;
      });

      await test.step('Evaluate button is now visible', async () => {
        await expect(
          page.getByTestId('evaluate-permission-button')
        ).toBeVisible();
      });

      await test.step('User permissions card is visible with the selected username', async () => {
        const debugger_ = page.getByTestId('admin-permission-debugger');
        await expect(debugger_).toContainText('admin');
      });

      await test.step('Select resource (table) and operation (ViewAll)', async () => {
        const debugger_ = page.getByTestId('admin-permission-debugger');
        // Resource Select — trigger identified by its placeholder label
        await debugger_
          .getByRole('button', { name: /select.*resource/i })
          .click();
        await page.getByRole('option', { name: 'table' }).click();

        // Operation Select
        await debugger_
          .getByRole('button', { name: /select.*operation/i })
          .click();
        await page.getByRole('option', { name: 'ViewAll' }).click();
      });

      await test.step('Click Evaluate and wait for API response', async () => {
        const evaluatePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/permissions/debug/evaluate') &&
            r.status() === 200
        );
        await page.getByTestId('evaluate-permission-button').click();
        await evaluatePromise;
      });

      await test.step('Evaluation result card is visible with decision', async () => {
        await expect(
          page.getByTestId('evaluation-result')
        ).toBeVisible();
        await expect(
          page.getByTestId('evaluation-result')
        ).toContainText(/allowed|denied/i);
      });

      await test.step('Summary stats are shown in the result card', async () => {
        const resultCard = page.getByTestId('evaluation-result');
        await expect(resultCard).toContainText(/policies.*evaluated/i);
        await expect(resultCard).toContainText(/rules.*evaluated/i);
      });

      await test.step('At least one evaluation step is listed', async () => {
        await expect(
          page.getByTestId('evaluation-result')
        ).toContainText(/step 1/i);
      });
    });
  }
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Audit Logs',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should render audit logs with search, filters, and export', async ({
      page,
    }) => {
      // Hoist the initial-load listener before navigation so we don't miss it.
      const initialLoadPromise = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/audit/logs') &&
          !r.url().includes('/export')
      );
      await openAccessControlSettings(page);
      await page.getByTestId('access-control-card-audit-logs').click();
      await page.getByTestId('audit-logs-page').waitFor({ state: 'visible' });
      await initialLoadPromise;
      await waitForAllLoadersToDisappear(page);

      await test.step('Audit log search input accepts input and triggers API', async () => {
        const searchInput = page.getByTestId('audit-log-search');
        await expect(searchInput).toBeVisible();

        const searchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs') &&
            !r.url().includes('/export')
        );
        await searchInput.fill('admin');
        await searchPromise;
        await expect(searchInput).toHaveValue('admin');

        const clearPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs') &&
            !r.url().includes('/export')
        );
        await searchInput.clear();
        await clearPromise;
        await expect(searchInput).toHaveValue('');
      });

      await test.step('Entity-type filter chips appear and API is called', async () => {
        const filterContainer = page.getByTestId('audit-log-filters');
        await expect(filterContainer).toBeVisible();

        // Open the Entity Type dropdown — SearchDropdown renders a button with the label
        const entityTypeFilterPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs') &&
            r.url().includes('entityType=table')
        );
        await filterContainer
          .getByRole('button', { name: /entity.type/i })
          .click();
        await page.getByTestId('Table-checkbox').getByText('Table').click();
        await page.getByTestId('update-btn').click();
        await entityTypeFilterPromise;

        // Filter chip for entity type should now be visible
        await expect(
          page.getByTestId('filter-chip-entityType')
        ).toBeVisible();

        // Remove the filter chip and verify it disappears
        const removeFilterPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs') &&
            !r.url().includes('/export')
        );
        await page.getByTestId('remove-filter-entityType').click();
        await removeFilterPromise;
        await expect(
          page.getByTestId('filter-chip-entityType')
        ).not.toBeVisible();
      });

      await test.step('Clear-all filters button works and triggers API', async () => {
        // Apply a search term first so there is something to clear
        const applyPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs') &&
            !r.url().includes('/export')
        );
        await page.getByTestId('audit-log-search').fill('test');
        await applyPromise;

        // Now clear everything
        const clearAllPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs') &&
            !r.url().includes('/export')
        );
        await page.getByTestId('clear-filters').click();
        await clearAllPromise;

        await expect(
          page.getByTestId('filter-selection-container')
        ).not.toBeVisible();
      });

      await test.step('Export modal opens with required elements', async () => {
        await page.getByTestId('export-audit-logs-button').click();
        await page
          .getByTestId('export-audit-logs-modal')
          .waitFor({ state: 'visible' });

        // Date range picker must be present
        await expect(
          page.getByTestId('export-date-range-picker')
        ).toBeVisible();

        // Export (OK) button must be disabled until a date range is selected
        const modalFooter = page.getByTestId('export-audit-logs-modal');
        await expect(
          modalFooter.getByRole('button', { name: 'Export' })
        ).toBeDisabled();
      });

      await test.step('Selecting a date range enables the export button and triggers export API', async () => {
        // Open the calendar
        await page.getByTestId('export-date-range-picker').click();
        const dropdown = page.getByRole('button', { name: 'Calendar Date range picker' });
        await dropdown.waitFor({ state: 'visible' });
        await dropdown.click();

        // Pick Sep 1 (start) and Sep 5 (end) — both are in the past relative to
        // the test run date of 2026-09-11 so they will never be disabled.
        await page.getByRole('button', { name: 'Today', exact: true }).click();
        await page.getByRole('button', { name: 'Apply' }).click();

        // Export button should now be enabled
        const modalFooter = page.getByTestId('export-audit-logs-modal');
        await expect(
          modalFooter.getByRole('button', { name: 'Export' })
        ).toBeEnabled();

        // Click export and wait for the export-job creation API call
        const exportPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/audit/logs/export')
        );
        await modalFooter.getByRole('button', { name: 'Export' }).click();
        await exportPromise;
      });
    });
  }
);
