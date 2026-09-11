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
import { DEFAULT_POLICIES, VIEW_ALL_RULE } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { expect, test } from '../../support/fixtures/base';
import {
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// ─── Navigation helper ────────────────────────────────────────────────────────

/**
 * Open the personal-space modal and navigate to the Access Control section.
 * The access control panel lives inside a modal, not a URL-based route.
 */
const openAccessControlSettings = async (page: Page): Promise<void> => {
  await redirectToHomePage(page);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor({ state: 'visible' });
  await page.getByTestId('profile-nav-access-control').click();
  await page.getByTestId('access-control-landing').waitFor({ state: 'visible' });
};

/**
 * Navigate to the Roles panel from the landing view by clicking the roles card.
 */
const navigateToRolesPanel = async (page: Page): Promise<void> => {
  await page.getByTestId('access-control-card-roles').click();
  await page.getByTestId('roles-list-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Navigate to the Policies panel from the landing view by clicking the policies card.
 */
const navigateToPoliciesPanel = async (page: Page): Promise<void> => {
  await page.getByTestId('access-control-card-policies').click();
  await page.getByTestId('policies-list-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Click a role name link in the roles list table to open the role detail view.
 * Uses the `data-testid="role-{entityName}"` row and the `role-name` button inside it.
 */
const navigateToRoleDetail = async (
  page: Page,
  roleName: string
): Promise<void> => {
  const roleRow = page.getByTestId(`role-${roleName}`);
  await roleRow.waitFor({ state: 'visible' });
  await roleRow.getByTestId('role-name').click();
  await page.getByTestId('role-detail-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Click a policy name link in the policies list table to open the policy detail view.
 */
const navigateToPolicyDetail = async (
  page: Page,
  policyName: string
): Promise<void> => {
  const policyRow = page.getByTestId(`policy-${policyName}`);
  await policyRow.waitFor({ state: 'visible' });
  await policyRow.getByTestId('policy-name').click();
  await page.getByTestId('policy-detail-container').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

/**
 * Click a tab by its text content within the role/policy detail view.
 */
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
        await expect(
          page.getByTestId('roles-list-container')
        ).toBeVisible();
      });

      await test.step('Policies card navigates to policies list', async () => {
        // Navigate back to landing via the "Access Control" breadcrumb in the header
        await page
          .getByTestId('profile-content-header')
          .getByText('Access Control')
          .click();
        await page.getByTestId('access-control-landing').waitFor({ state: 'visible' });
        await page.getByTestId('access-control-card-policies').click();
        await expect(
          page.getByTestId('policies-list-container')
        ).toBeVisible();
      });

      await test.step('Permission Debugger card navigates to debugger panel', async () => {
        await page
          .getByTestId('profile-content-header')
          .getByText('Access Control')
          .click();
        await page.getByTestId('access-control-landing').waitFor({ state: 'visible' });
        await page.getByTestId('access-control-card-permission-debugger').click();
        await expect(
          page.getByTestId('admin-permission-debugger')
        ).toBeVisible();
      });

      await test.step('Audit Logs card navigates to audit logs panel', async () => {
        await page
          .getByTestId('profile-content-header')
          .getByText('Access Control')
          .click();
        await page.getByTestId('access-control-landing').waitFor({ state: 'visible' });
        await page.getByTestId('access-control-card-audit-logs').click();
        await expect(
          page.getByTestId('audit-logs-page')
        ).toBeVisible();
      });
    });
  }
);

// ─── Roles ────────────────────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Roles',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should create a role via the UI and verify it appears in the list', async ({
      page,
    }) => {
      const roleName = `PW-AC-Role-${uuid()}`;

      const { apiContext, afterAction } = await getApiContext(page);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);

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
        await policyAutocomplete.getByRole('combobox').fill('Data Consumer');
        await page
          .getByRole('option', { name: DEFAULT_POLICIES.dataConsumerPolicy })
          .click();
      });

      await test.step('Submit and verify role created', async () => {
        const responsePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') && r.status() === 201
        );
        await page.getByTestId('submit-btn').click();
        await responsePromise;

        // Should navigate back to roles list
        await page
          .getByTestId('roles-list-container')
          .waitFor({ state: 'visible' });
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId(`role-${roleName}`)).toBeVisible();
      });

      // Cleanup
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
      const { apiContext, afterAction } = await getApiContext(page);

      // Pre-create role with a policy
      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);

      // Add admin user to role via API so the Users tab is non-empty
      const adminUser = await apiContext
        .get('/api/v1/users/name/admin?fields=id,name,displayName')
        .then((r) => r.json());
      await apiContext.patch(
        `/api/v1/roles/${role.responseData.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/users/-',
              value: {
                id: adminUser.id,
                type: 'user',
                name: adminUser.name,
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);

      await test.step('Policies tab (default) shows policy', async () => {
        // Default tab is policies
        await expect(page.getByRole('tab', { name: /policies/i })).toBeVisible();
        // The policy should appear as a row in the policies table
        await expect(
          page.getByText(DEFAULT_POLICIES.dataConsumerPolicy)
        ).toBeVisible();
      });

      await test.step('Teams tab shows empty state', async () => {
        await clickDetailTab(page, 'teams');
        // No teams assigned — empty placeholder
        await expect(page.getByRole('cell', { name: /no.*found/i })).toBeVisible();
      });

      await test.step('Users tab shows pre-added user', async () => {
        await clickDetailTab(page, 'users');
        await expect(
          page.getByTestId(adminUser.name)
        ).toBeVisible();
      });

      await role.delete(apiContext);
      await afterAction();
    });

    test('should edit role description', async ({ page }) => {
      const role = new RolesClass();
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);

      const updatedDescription = `Updated description ${uuid()}`;

      await test.step('Click edit description button', async () => {
        await page.getByTestId('edit-description-btn').click();
        // RichTextEditor appears
        await page
          .locator('.om-block-editor[contenteditable="true"]')
          .waitFor({ state: 'visible' });
      });

      await test.step('Fill new description and save', async () => {
        const editor = page.locator('.om-block-editor[contenteditable="true"]');
        await editor.clear();
        await editor.fill(updatedDescription);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        // Scope Save to the detail container to avoid matching header buttons
        await page
          .getByTestId('role-detail-container')
          .getByRole('button', { name: 'Save' })
          .click();
        await patchPromise;
      });

      await test.step('Verify description is updated', async () => {
        // Editor should close
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
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);

      const newDisplayName = `Renamed Role ${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);

      await test.step('Click rename button', async () => {
        await page.getByTestId('rename-role-btn').click();
        await page
          .getByTestId('rename-input')
          .waitFor({ state: 'visible' });
      });

      await test.step('Fill new name and save', async () => {
        const renameInput = page.getByTestId('rename-input').getByRole('textbox');
        await renameInput.clear();
        await renameInput.fill(newDisplayName);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByRole('button', { name: /save/i }).click();
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
      const { apiContext, afterAction } = await getApiContext(page);

      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);
      await extraPolicy.create(apiContext, VIEW_ALL_RULE);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);

      await test.step('Click Add Policy button in Policies tab', async () => {
        await page.getByTestId('add-policy').click();
        await page
          .getByTestId('add-policy-select')
          .waitFor({ state: 'visible' });
      });

      await test.step('Select the extra policy', async () => {
        const autocomplete = page.getByTestId('add-policy-select');
        await autocomplete.getByRole('combobox').fill(extraPolicy.responseData.displayName);
        await page
          .getByRole('option', { name: extraPolicy.responseData.displayName })
          .click();
      });

      await test.step('Confirm adding policy', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByRole('button', { name: /save/i }).click();
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
      const { apiContext, afterAction } = await getApiContext(page);

      await policyToRemove.create(apiContext, VIEW_ALL_RULE);
      // Role needs 2 policies so removing one is valid
      await role.create(apiContext, [
        DEFAULT_POLICIES.dataConsumerPolicy,
        policyToRemove.responseData.name,
      ]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);

      const policyDisplayName = policyToRemove.responseData.displayName;

      await test.step('Click remove button for the policy', async () => {
        await page
          .getByTestId(`remove-${policyDisplayName}`)
          .click();
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

      await test.step('Verify policy is no longer listed', async () => {
        await expect(
          page.getByText(policyDisplayName)
        ).not.toBeVisible();
      });

      await role.delete(apiContext);
      await policyToRemove.delete(apiContext);
      await afterAction();
    });

    test('should remove a user from a role via the Users tab', async ({
      page,
    }) => {
      const role = new RolesClass();
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);

      // Add admin user to role via API
      const adminUser = await apiContext
        .get('/api/v1/users/name/admin?fields=id,name,displayName')
        .then((r) => r.json());

      await apiContext.patch(
        `/api/v1/roles/${role.responseData.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/users/-',
              value: {
                id: adminUser.id,
                type: 'user',
                name: adminUser.name,
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);
      await clickDetailTab(page, 'users');

      await test.step('User row is visible', async () => {
        await expect(page.getByTestId(adminUser.name)).toBeVisible();
      });

      await test.step('Click remove button and confirm', async () => {
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
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);

      const roleName = role.responseData.name;

      await test.step('Click delete action in the table row', async () => {
        await page.getByTestId(`delete-action-${roleName}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
      });

      await test.step('Role row is no longer visible', async () => {
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId(`role-${roleName}`)).not.toBeVisible();
      });

      await afterAction();
    });

    test('should delete a role from the role detail header', async ({
      page,
    }) => {
      const role = new RolesClass();
      const { apiContext, afterAction } = await getApiContext(page);
      await role.create(apiContext, [DEFAULT_POLICIES.dataConsumerPolicy]);

      await openAccessControlSettings(page);
      await navigateToRolesPanel(page);
      await navigateToRoleDetail(page, role.responseData.name);

      await test.step('Click delete role button in header', async () => {
        await page.getByTestId('delete-role-btn').click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/roles') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
      });

      await test.step('Navigates back to roles list', async () => {
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
    test('should create a policy via the UI and verify it appears in the list', async ({
      page,
    }) => {
      const policyName = `PW-AC-Policy-${uuid()}`;
      const ruleName = `PW-Rule-${uuid()}`;
      const { apiContext, afterAction } = await getApiContext(page);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);

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
        await page.getByTestId('rule-name').getByRole('textbox').fill(ruleName);

        // Select resource: All — scope to the open listbox to avoid positional locator
        const resourcesAutocomplete = page.getByTestId('resources');
        await resourcesAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();

        // Select operation: All
        const operationsAutocomplete = page.getByTestId('operations');
        await operationsAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();

        // Effect is already Allow by default — leave it
      });

      await test.step('Submit and verify policy created', async () => {
        const responsePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') && r.status() === 201
        );
        await page.getByTestId('submit-btn').click();
        await responsePromise;

        await page
          .getByTestId('policies-list-container')
          .waitFor({ state: 'visible' });
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId(`policy-${policyName}`)).toBeVisible();
      });

      // Cleanup
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
      const { apiContext, afterAction } = await getApiContext(page);

      await policy.create(apiContext, VIEW_ALL_RULE);
      // Create a role and link it to the policy via API
      await role.create(apiContext, [policy.responseData.name]);

      // Add a team to the policy via API PATCH — use the default "Organization" team
      const orgTeam = await apiContext
        .get('/api/v1/teams/name/Organization?fields=id,name,displayName')
        .then((r) => r.json());

      await policy.patch(apiContext, [
        {
          op: 'add',
          path: '/teams/-',
          value: { id: orgTeam.id, type: 'team', name: orgTeam.name },
        },
      ]);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Rules tab (default) shows rule card', async () => {
        await expect(
          page.getByTestId(`rule-${VIEW_ALL_RULE[0].name}`)
        ).toBeVisible();
      });

      await test.step('Roles tab shows pre-linked role', async () => {
        await clickDetailTab(page, 'roles');
        await expect(
          page.getByTestId(role.responseData.name)
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
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const updatedDescription = `Updated description ${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Click edit description and fill new value', async () => {
        await page.getByTestId('edit-description-btn').click();
        const editor = page.locator('.om-block-editor[contenteditable="true"]');
        await editor.waitFor({ state: 'visible' });
        await editor.clear();
        await editor.fill(updatedDescription);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        // Scope Save to the detail container to avoid matching header buttons
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
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const newDisplayName = `Renamed Policy ${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Click rename button and fill new name', async () => {
        await page.getByTestId('rename-policy-btn').click();
        await page.getByTestId('rename-input').waitFor({ state: 'visible' });
        const renameInput = page.getByTestId('rename-input').getByRole('textbox');
        await renameInput.clear();
        await renameInput.fill(newDisplayName);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByRole('button', { name: /save/i }).click();
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
      const { apiContext, afterAction } = await getApiContext(page);
      // Create policy with no rules (empty rules array)
      await policy.create(apiContext, []);

      const newRuleName = `PW-Rule-${uuid()}`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Click Add Rule button', async () => {
        await page.getByTestId('add-rule').click();
        await page.getByTestId('rule-name').waitFor({ state: 'visible' });
      });

      await test.step('Fill rule form', async () => {
        await page.getByTestId('rule-name').getByRole('textbox').fill(newRuleName);

        // Select resource — scope to open listbox to avoid positional locator
        const resourcesAutocomplete = page.getByTestId('resources');
        await resourcesAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();

        // Select operation
        const operationsAutocomplete = page.getByTestId('operations');
        await operationsAutocomplete.click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: 'All', exact: true })
          .click();
      });

      await test.step('Save rule and verify card appears', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByRole('button', { name: /save/i }).click();
        await patchPromise;

        await expect(
          page.getByTestId(`rule-${newRuleName}`)
        ).toBeVisible();
      });

      await policy.delete(apiContext);
      await afterAction();
    });

    test('should edit a rule in a policy', async ({ page }) => {
      const policy = new PolicyClass();
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      const existingRuleName = VIEW_ALL_RULE[0].name;
      const updatedRuleName = `${existingRuleName}-Updated`;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Click edit rule button', async () => {
        await page.getByTestId(`edit-rule-${existingRuleName}`).click();
        await page.getByTestId('rule-name').waitFor({ state: 'visible' });
      });

      await test.step('Change the rule name', async () => {
        const ruleNameInput = page.getByTestId('rule-name').getByRole('textbox');
        await ruleNameInput.clear();
        await ruleNameInput.fill(updatedRuleName);

        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByRole('button', { name: /save/i }).click();
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
      // Need 2 rules so we can delete one (backend requires >=1)
      const twoRules = [
        ...VIEW_ALL_RULE,
        {
          name: `PW-Extra-Rule-${uuid()}`,
          resources: ['All'],
          operations: ['ViewAll'],
          effect: 'allow',
        },
      ];
      const policy = new PolicyClass();
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, twoRules);

      const ruleToDelete = twoRules[1].name;

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Click delete rule button', async () => {
        await page.getByTestId(`delete-rule-${ruleToDelete}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion', async () => {
        const patchPromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'PATCH' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await patchPromise;
      });

      await test.step('Rule card is gone', async () => {
        await expect(
          page.getByTestId(`rule-${ruleToDelete}`)
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
      const { apiContext, afterAction } = await getApiContext(page);

      await policy.create(apiContext, VIEW_ALL_RULE);
      // Create role linked to this policy
      await role.create(apiContext, [policy.responseData.name]);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);
      await clickDetailTab(page, 'roles');

      await test.step('Role row is visible', async () => {
        await expect(page.getByTestId(role.responseData.name)).toBeVisible();
      });

      await test.step('Click remove and confirm', async () => {
        await page.getByTestId(`remove-${role.responseData.name}`).click();
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
          page.getByTestId(role.responseData.name)
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
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      // Link the Organization team to the policy via API
      const orgTeam = await apiContext
        .get('/api/v1/teams/name/Organization?fields=id,name,displayName')
        .then((r) => r.json());

      await policy.patch(apiContext, [
        {
          op: 'add',
          path: '/teams/-',
          value: { id: orgTeam.id, type: 'team', name: orgTeam.name },
        },
      ]);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);
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
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);

      const policyName = policy.responseData.name;

      await test.step('Click delete action in the table row', async () => {
        await page.getByTestId(`delete-action-${policyName}`).click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
      });

      await test.step('Policy row is no longer visible', async () => {
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId(`policy-${policyName}`)
        ).not.toBeVisible();
      });

      await afterAction();
    });

    test('should delete a policy from the policy detail header', async ({
      page,
    }) => {
      const policy = new PolicyClass();
      const { apiContext, afterAction } = await getApiContext(page);
      await policy.create(apiContext, VIEW_ALL_RULE);

      await openAccessControlSettings(page);
      await navigateToPoliciesPanel(page);
      await navigateToPolicyDetail(page, policy.responseData.name);

      await test.step('Click delete policy button in header', async () => {
        await page.getByTestId('delete-policy-btn').click();
        await page
          .getByTestId('delete-modal')
          .waitFor({ state: 'visible' });
      });

      await test.step('Confirm deletion', async () => {
        const deletePromise = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/policies') &&
            r.request().method() === 'DELETE' &&
            r.status() === 200
        );
        await page.getByTestId('confirm-button').click();
        await deletePromise;
      });

      await test.step('Navigates back to policies list', async () => {
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
    test('should render the permission debugger panel', async ({ page }) => {
      await openAccessControlSettings(page);
      await page.getByTestId('access-control-card-permission-debugger').click();

      await expect(
        page.getByTestId('admin-permission-debugger')
      ).toBeVisible();
      await expect(
        page.getByTestId('evaluate-permission-button')
      ).toBeVisible();
    });
  }
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

test.describe(
  'Access Control Settings — Audit Logs',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should render the audit logs panel with filters and export button', async ({
      page,
    }) => {
      await openAccessControlSettings(page);
      await page.getByTestId('access-control-card-audit-logs').click();

      await expect(page.getByTestId('audit-logs-page')).toBeVisible();
      await expect(
        page.getByTestId('export-audit-logs-button')
      ).toBeVisible();
      await expect(page.getByTestId('audit-log-filters')).toBeVisible();
    });
  }
);
