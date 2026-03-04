/*
 *  Copyright 2022 Collate.
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

import { test, expect } from '../../support/fixtures/userPages';
import { DELETE_TERM } from '../../constant/common';
import { GlobalSettingOptions } from '../../constant/settings';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { TeamClass } from '../../support/team/TeamClass';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { validateFormNameFieldInput } from '../../utils/form';
import {
  checkPersonaInProfile,
  navigateToPersonaSettings,
  navigateToPersonaWithPagination,
  removePersonaDefault,
  setPersonaAsDefault,
  updatePersonaDisplayName,
} from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const PERSONA_DETAILS = {
  name: `persona-with-%-${uuid()}`,
  displayName: `persona ${uuid()}`,
  description: `Persona description ${uuid()}.`,
};

const user = new UserClass();
const persona1 = new PersonaClass();
const persona2 = new PersonaClass();

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe.serial('Persona operations', () => {
  const user = new UserClass();

  test.beforeAll('pre-requisites', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll('cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    const personaListResponse = page.waitForResponse(`/api/v1/personas?*`);
    await settingClick(page, GlobalSettingOptions.PERSONA);
    await personaListResponse;
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('Persona creation should work properly with breadcrumb navigation', async ({
    page,
  }) => {
    await page.getByTestId('add-persona-button').click();

    await validateFormNameFieldInput({
      page,
      value: PERSONA_DETAILS.name,
      fieldName: 'Name',
      fieldSelector: '[data-testid="name"]',
      errorDivSelector: '#name_help',
    });

    await page.getByTestId('displayName').fill(PERSONA_DETAILS.displayName);

    await page.locator(descriptionBox).fill(PERSONA_DETAILS.description);

    const userListResponse = page.waitForResponse(
      '/api/v1/users?limit=*&isBot=false*'
    );
    await page.getByTestId('add-users').click();
    await userListResponse;

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const searchUser = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        user.responseData.displayName
      )}*`
    );
    await page.getByTestId('searchbar').fill(user.responseData.displayName);
    await searchUser;

    await page
      .getByRole('listitem', { name: user.responseData.displayName })
      .click();
    await page.getByTestId('selectable-list-update-btn').click();

    await page.getByRole('button', { name: 'Create' }).click();

    await page.waitForLoadState('networkidle');

    await navigateToPersonaSettings(page);

    await waitForAllLoadersToDisappear(page, 'skeleton-card-loader');

    const personaResponse = page.waitForResponse(
      `/api/v1/personas/name/${encodeURIComponent(
        PERSONA_DETAILS.name
      )}?fields=users`
    );

    await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, true);

    await personaResponse;

    await expect(page).toHaveURL(/.*#customize-ui/);

    // Click on Governance category
    await page.locator('.setting-card-item[data-testid="governance"]').click();

    // Check URL hash
    await expect(page).toHaveURL(/.*#customize-ui.governance/);
    await expect(page.getByTestId('inactive-link')).toHaveText('Governance');

    // Click Persona Name (2nd item)
    await page
      .getByRole('link', {
        name: PERSONA_DETAILS.displayName,
        exact: true,
      })
      .click();

    // Verify redirect
    await expect(page).toHaveURL(/.*#customize-ui/);
    await expect(page).not.toHaveURL(/.*.governance/);

    // Test from Users tab
    await page.getByRole('tab', { name: 'Users' }).click();
    await expect(page).toHaveURL(/.*#users/);

    await page
      .getByRole('link', {
        name: PERSONA_DETAILS.displayName,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/.*#customize-ui/);

    await page.getByRole('tab', { name: 'Users' }).click();

    await page.waitForSelector('[data-testid="entity-header-name"]', {
      state: 'visible',
    });

    await expect(page.getByTestId('entity-header-name')).toContainText(
      PERSONA_DETAILS.name
    );

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      PERSONA_DETAILS.displayName
    );

    await expect(
      page.locator(
        '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
      )
    ).toContainText(PERSONA_DETAILS.description);

    await expect(page.getByTestId(user.responseData.name)).toContainText(
      user.responseData.name
    );
  });

  test('Persona update description flow should work properly', async ({
    page,
  }) => {
    await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, true);

    await page.getByTestId('edit-description').click();

    await page
      .locator(`[data-testid="markdown-editor"] ${descriptionBox}`)
      .clear();

    await page
      .locator(`[data-testid="markdown-editor"] ${descriptionBox}`)
      .fill('Updated description.');

    await page
      .locator(`[data-testid="markdown-editor"] [data-testid="save"]`)
      .click();

    await expect(
      page.locator(
        `[data-testid="viewer-container"] [data-testid="markdown-parser"]`
      )
    ).toContainText('Updated description.');
  });

  test('Persona rename flow should work properly', async ({ page }) => {
    await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, true);

    await updatePersonaDisplayName({ page, displayName: 'Test Persona' });

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      'Test Persona'
    );

    await updatePersonaDisplayName({
      page,
      displayName: PERSONA_DETAILS.displayName,
    });

    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      PERSONA_DETAILS.displayName
    );
  });

  test('Remove users in persona should work properly', async ({ page }) => {
    await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, true);

    await waitForAllLoadersToDisappear(page);
    await page.getByRole('tab', { name: 'Users' }).click();

    await page
      .locator(
        `[data-row-key="${user.responseData.name}"] [data-testid="remove-user-btn"]`
      )
      .click();

    await expect(
      page.locator('[data-testid="remove-confirmation-modal"]')
    ).toContainText(
      `Are you sure you want to remove ${user.responseData.name}?`
    );

    const updateResponse = page.waitForResponse(`/api/v1/personas/*`);

    await page
      .locator('[data-testid="remove-confirmation-modal"]')
      .getByText('Confirm')
      .click();

    await updateResponse;
  });

  test('Delete persona should work properly', async ({ page }) => {
    await navigateToPersonaWithPagination(page, PERSONA_DETAILS.name, true);

    await page.click('[data-testid="manage-button"]');

    await page.click('[data-testid="delete-button-title"]');

    await expect(page.locator('.ant-modal-header')).toContainText(
      PERSONA_DETAILS.displayName
    );

    await page.click(`[data-testid="hard-delete-option"]`);

    await expect(page.locator('[data-testid="confirm-button"]')).toBeDisabled();

    await page
      .locator('[data-testid="confirmation-text-input"]')
      .fill(DELETE_TERM);

    const deleteResponse = page.waitForResponse(
      `/api/v1/personas/*?hardDelete=true&recursive=false`
    );

    await expect(
      page.locator('[data-testid="confirm-button"]')
    ).not.toBeDisabled();

    await page.click('[data-testid="confirm-button"]');
    await deleteResponse;

    await page.waitForURL('**/settings/persona');
  });
});

test.describe.serial('Default persona setting and removal flow', () => {
  test.beforeAll('Setup user for default persona flow', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    const adminResponse = await apiContext.get('/api/v1/users/name/admin');
    const adminData = await adminResponse.json();

    await persona1.create(apiContext, [user.responseData.id, adminData.id]);
    await persona2.create(apiContext, [user.responseData.id]);
    await afterAction();
  });

  test('Set and remove default persona should work properly', async ({
    adminPage,
    browser,
  }) => {
    const userContext = await browser.newContext({ storageState: undefined });
    const userPage = await userContext.newPage();
    await user.login(userPage);

    test.slow(true);

    await test.step(
      'Admin creates a persona and sets the default persona',
      async () => {
        await navigateToPersonaSettings(adminPage);
        await adminPage.getByTestId('add-persona-button').click();

        await validateFormNameFieldInput({
          page: adminPage,
          value: PERSONA_DETAILS.name,
          fieldName: 'Name',
          fieldSelector: '[data-testid="name"]',
          errorDivSelector: '#name_help',
        });

        await adminPage
          .getByTestId('displayName')
          .fill(PERSONA_DETAILS.displayName);

        await adminPage
          .locator(descriptionBox)
          .fill(PERSONA_DETAILS.description);

        const userListResponse = adminPage.waitForResponse(
          '/api/v1/users?limit=*&isBot=false*'
        );
        await adminPage.getByTestId('add-users').click();
        await userListResponse;

        await adminPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const searchUser = adminPage.waitForResponse(
          `/api/v1/search/query?q=*${encodeURIComponent(
            user.responseData.displayName
          )}*`
        );
        await adminPage
          .getByTestId('searchbar')
          .fill(user.responseData.displayName);
        await searchUser;

        await adminPage
          .getByRole('listitem', { name: user.responseData.displayName })
          .click();
        await adminPage.getByTestId('selectable-list-update-btn').click();

        await adminPage.getByRole('button', { name: 'Create' }).click();

        await adminPage.waitForLoadState('networkidle');

        await navigateToPersonaSettings(adminPage);

        await waitForAllLoadersToDisappear(adminPage, 'skeleton-card-loader');

        const personaResponse = adminPage.waitForResponse(
          `/api/v1/personas/name/${encodeURIComponent(
            PERSONA_DETAILS.name
          )}?fields=users`
        );

        await navigateToPersonaWithPagination(
          adminPage,
          PERSONA_DETAILS.name,
          true
        );

        await personaResponse;

        await adminPage.getByRole('tab', { name: 'Users' }).click();

        await adminPage.waitForSelector('[data-testid="entity-header-name"]', {
          state: 'visible',
        });

        await expect(adminPage.getByTestId('entity-header-name')).toContainText(
          PERSONA_DETAILS.name
        );

        await expect(
          adminPage.getByTestId('entity-header-display-name')
        ).toContainText(PERSONA_DETAILS.displayName);

        await expect(
          adminPage.locator(
            '[data-testid="viewer-container"] [data-testid="markdown-parser"]'
          )
        ).toContainText(PERSONA_DETAILS.description);

        await expect(
          adminPage.getByTestId(user.responseData.name)
        ).toContainText(user.responseData.name);

        await setPersonaAsDefault(adminPage);
      }
    );

    await test.step(
      'User refreshes and checks the default persona is applied',
      async () => {
        await userPage.reload();
        await waitForAllLoadersToDisappear(userPage);
        await checkPersonaInProfile(userPage, PERSONA_DETAILS.displayName);
      }
    );

    await test.step('Changing default persona', async () => {
      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);

      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;
      await navigateToPersonaWithPagination(
        adminPage,
        persona1.responseData.fullyQualifiedName ?? persona1.responseData.name,
        true
      );

      await adminPage.waitForLoadState('networkidle');
      await setPersonaAsDefault(adminPage);
    });

    await test.step('Verify changed default persona for new user', async () => {
      await userPage.reload();
      await waitForAllLoadersToDisappear(userPage);
      await checkPersonaInProfile(userPage, persona1.responseData.displayName);
    });

    await test.step('Admin removes the default persona', async () => {
      await navigateToPersonaSettings(adminPage);
      await removePersonaDefault(
        adminPage,
        persona1.responseData?.fullyQualifiedName
      );
    });

    await test.step('User refreshes and sees no default persona', async () => {
      await userPage.reload();
      await waitForAllLoadersToDisappear(userPage);
      await checkPersonaInProfile(userPage); // Expect no persona again
    });
  });
});

test.describe.serial('Team persona setting flow', () => {
  const teamPersona = new PersonaClass();
  const teamPersona2 = new PersonaClass();
  const teamUser = new UserClass();
  const testTeam = new TeamClass();

  test.beforeAll(
    'Setup user, team and persona for team persona flow',
    async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await teamUser.create(apiContext);

      testTeam.data.users = [teamUser.responseData.id];
      await testTeam.create(apiContext);

      await teamPersona.create(apiContext);
      await teamPersona2.create(apiContext);
      await afterAction();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await testTeam.delete(apiContext);
    await teamUser.delete(apiContext);
    await teamPersona.delete(apiContext);
    await teamPersona2.delete(apiContext);
    await afterAction();
  });

  test('Set default persona for team should work properly', async ({
    adminPage,
  }) => {
    test.slow(true);

    await test.step('Admin sets default persona for a team', async () => {
      await redirectToHomePage(adminPage);

      await testTeam.visitTeamPage(adminPage);

      // const teamSettingsResponse = adminPage.waitForResponse('/api/v1/teams/*');

      // Click to edit default persona
      await adminPage.getByTestId('default-edit-user-persona').click();

      // Wait for dropdown to open and options to load
      await adminPage.waitForSelector(
        '[data-testid="default-persona-select-list"]'
      );
      await adminPage.waitForSelector('.ant-select-dropdown', {
        state: 'visible',
      });

      const option = adminPage.getByTitle(teamPersona.responseData.displayName);

      await expect(option).toBeVisible();
      await option.click();

      // Verify the selected option is correct
      await expect(
        adminPage.locator(
          `span.ant-select-selection-item[title="${teamPersona.responseData.displayName}"]`
        )
      ).toBeVisible();

      const teamPatchResponse = adminPage.waitForResponse('/api/v1/teams/*');

      // Save the default persona for team
      await adminPage
        .getByTestId('user-profile-default-persona-edit-save')
        .click();
      await teamPatchResponse;

      // Ensure dropdown closed
      await expect(
        adminPage.locator('.ant-select-dropdown:visible')
      ).not.toBeVisible();

      // Verify persona renders in team UI
      await expect(adminPage.getByTestId('team-persona')).toContainText(
        teamPersona.responseData.displayName
      );

      // Verify switching to a different persona in the single-select dropdown replaces the first one
      await adminPage.getByTestId('default-edit-user-persona').click();
      await adminPage.waitForSelector(
        '[data-testid="default-persona-select-list"]'
      );
      await adminPage.waitForSelector('.ant-select-dropdown', {
        state: 'visible',
      });

      // Click the new persona (teamPersona2)
      const userPersonaOption = adminPage.getByTitle(
        teamPersona2.responseData.displayName
      );
      await expect(userPersonaOption).toBeVisible();
      await userPersonaOption.click();

      // Verify the new option replaces the old option in the dropdown selection display
      await expect(
        adminPage.locator(
          `span.ant-select-selection-item[title="${teamPersona2.responseData.displayName}"]`
        )
      ).toBeVisible();
      await expect(
        adminPage.locator(
          `span.ant-select-selection-item[title="${teamPersona.responseData.displayName}"]`
        )
      ).not.toBeVisible();

      // Save it and re-verify
      const teamPatchSwitchResponse =
        adminPage.waitForResponse('/api/v1/teams/*');
      await adminPage
        .getByTestId('user-profile-default-persona-edit-save')
        .click();
      await teamPatchSwitchResponse;

      await expect(adminPage.getByTestId('team-persona')).toContainText(
        teamPersona2.responseData.displayName
      );

      // Revert it back to teamPersona for the rest of the test
      await adminPage.getByTestId('default-edit-user-persona').click();
      await adminPage.waitForSelector('.ant-select-dropdown', {
        state: 'visible',
      });
      const revertOption = adminPage.getByTitle(
        teamPersona.responseData.displayName
      );
      await expect(revertOption).toBeVisible();
      await revertOption.click();
      const teamPatchRevertResponse =
        adminPage.waitForResponse('/api/v1/teams/*');
      await adminPage
        .getByTestId('user-profile-default-persona-edit-save')
        .click();
      await teamPatchRevertResponse;
    });

    await test.step(
      'Admin can verify the team persona is applied to the team user',
      async () => {
        // Navigate to the Users tab in the Team page
        await adminPage.getByTestId('users').click();

        // Wait for list to load and click on the specific user
        const userProfileResponse = adminPage.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/users/name/') &&
            response.request().method() === 'GET' &&
            response.status() === 200
        );
        await adminPage.getByTestId(teamUser.responseData.name).click();
        await userProfileResponse;

        // Verify the user inherited the team's default persona
        await adminPage.waitForSelector('[data-testid="persona-details-card"]');
        const defaultPersonaChip = adminPage
          .locator(
            '[data-testid="default-persona-chip"] [data-testid="tag-chip"]'
          )
          .first();

        await expect(defaultPersonaChip).toContainText(
          teamPersona.responseData.displayName
        );

        // Verify the inherited icon is displayed
        await expect(
          adminPage.locator(
            '[data-testid="default-persona-chip"] .inherit-icon'
          )
        ).toBeVisible();
      }
    );
  });

  test('Admin can remove the default persona for a team', async ({
    adminPage,
  }) => {
    await test.step(
      'Admin removes the default persona for a team',
      async () => {
        await redirectToHomePage(adminPage);
        await testTeam.visitTeamPage(adminPage);

        await adminPage.getByTestId('default-edit-user-persona').click();
        await adminPage.waitForSelector('.ant-select-dropdown', {
          state: 'visible',
        });

        // Clear selection
        await adminPage.locator('.profile-edit-popover').hover();
        await adminPage.locator('.ant-select-clear').click();

        const teamPatchRemoveResponse =
          adminPage.waitForResponse('/api/v1/teams/*');
        await adminPage
          .getByTestId('user-profile-default-persona-edit-save')
          .click();
        await teamPatchRemoveResponse;

        await expect(adminPage.getByTestId('team-persona')).toContainText(
          'No persona assigned'
        );
      }
    );
  });

  test('User without permissions cannot edit team persona', async ({
    dataConsumerPage,
  }) => {
    await test.step(
      'User without permissions cannot edit team persona',
      async () => {
        await redirectToHomePage(dataConsumerPage);
        await testTeam.visitTeamPage(dataConsumerPage);

        await expect(
          dataConsumerPage.getByTestId('default-edit-user-persona')
        ).not.toBeVisible();
      }
    );
  });

  test('Non-group team types do not have a default persona setting', async ({
    adminPage,
    browser,
  }) => {
    await test.step('Verify non-group teams cannot set a persona', async () => {
      const { apiContext, afterAction } = await createNewPage(browser);
      const businessUnitTeam = new TeamClass();
      businessUnitTeam.setTeamType('BusinessUnit');
      await businessUnitTeam.create(apiContext);

      await redirectToHomePage(adminPage);
      await businessUnitTeam.visitTeamPage(adminPage);

      await expect(adminPage.getByTestId('team-persona')).not.toBeVisible();
      await expect(
        adminPage.getByTestId('default-edit-user-persona')
      ).not.toBeVisible();

      // Cleanup
      await businessUnitTeam.delete(apiContext);
      await afterAction();
    });
  });
});
