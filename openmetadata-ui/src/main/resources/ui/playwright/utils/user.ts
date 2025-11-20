/*
 *  Copyright 2024 Collate.
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

import { Browser, expect, Page, Response } from '@playwright/test';
import {
  GLOBAL_SETTING_PERMISSIONS,
  SETTING_PAGE_ENTITY_PERMISSION,
} from '../constant/permission';
import { VISIT_SERVICE_PAGE_DETAILS } from '../constant/service';
import {
  GlobalSettingOptions,
  SETTINGS_OPTIONS_PATH,
  SETTING_CUSTOM_PROPERTIES_PATH,
} from '../constant/settings';
import { SidebarItem } from '../constant/sidebar';
import { UserClass } from '../support/user/UserClass';
import {
  descriptionBox,
  descriptionBoxReadOnly,
  getAuthContext,
  getToken,
  redirectToHomePage,
  toastNotification,
  visitOwnProfilePage,
} from './common';
import { customFormatDateTime, getEpochMillisForFutureDays } from './dateTime';
import { waitForAllLoadersToDisappear } from './entity';
import { settingClick, SettingOptionsType, sidebarClick } from './sidebar';

export const visitUserListPage = async (page: Page) => {
  const fetchUsers = page.waitForResponse('/api/v1/users?*');
  await settingClick(page, GlobalSettingOptions.USERS);
  await fetchUsers;
};

export const performUserLogin = async (browser: Browser, user: UserClass) => {
  const page = await browser.newPage();
  await user.login(page);
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);
  const afterAction = async () => {
    await apiContext.dispose();
    await page.close();
  };

  return { page, apiContext, afterAction };
};

export const nonDeletedUserChecks = async (page: Page) => {
  await expect(
    page
      .locator('[data-testid="user-profile"] [data-testid="edit-user-persona"]')
      .first()
  ).toBeVisible();

  await expect(page.locator('[data-testid="edit-teams-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="edit-roles-button"]')).toBeVisible();
};

export const deletedUserChecks = async (page: Page) => {
  const deletedBadge = page.locator('[data-testid="deleted-badge"]');

  await expect(deletedBadge).toHaveText('Deleted');

  await expect(
    page.locator(
      '[data-testid="user-profile-details"] [data-testid="edit-persona"]'
    )
  ).not.toBeVisible();
  await expect(
    page.locator('[data-testid="change-password-button"]')
  ).not.toBeVisible();
  await expect(
    page.locator('[data-testid="edit-teams-button"]')
  ).not.toBeVisible();
  await expect(
    page.locator('[data-testid="persona-list"] [data-testid="edit-persona"]')
  ).not.toBeVisible();
};

export const visitUserProfilePage = async (page: Page, userName: string) => {
  await settingClick(page, GlobalSettingOptions.USERS);
  await page.waitForSelector(
    '[data-testid="user-list-v1-component"] [data-testid="loader"]',
    {
      state: 'detached',
    }
  );
  const userResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=*&from=0&size=*'
  );
  const loader = page.waitForSelector(
    '[data-testid="user-list-v1-component"] [data-testid="loader"]',
    {
      state: 'detached',
    }
  );
  await page.getByTestId('searchbar').fill(userName);
  await userResponse;
  await loader;
  await page.getByTestId(userName).click();
};

export const softDeleteUserProfilePage = async (
  page: Page,
  userName: string,
  displayName: string
) => {
  const userResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=*&from=0&size=*'
  );
  await page.getByTestId('searchbar').fill(userName);
  await userResponse;
  await page.waitForSelector('.user-list-table [data-testid="loader"]', {
    state: 'detached',
  });

  await page.getByTestId(userName).click();

  await nonDeletedUserChecks(page);

  await page.waitForSelector('[data-testid="user-profile-manage-btn"]', {
    state: 'visible',
  });
  await page.click('[data-testid="user-profile-manage-btn"]');

  await page.waitForSelector('.ant-popover:not(.ant-popover-hidden)', {
    state: 'visible',
  });

  await page.getByText('Delete Profile').click();

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText(displayName);

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteResponse = page.waitForResponse(
    '/api/v1/users/*?hardDelete=false&recursive=true'
  );
  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;

  await toastNotification(page, /deleted successfully!/);

  await deletedUserChecks(page);
};

export const restoreUserProfilePage = async (page: Page, fqn: string) => {
  await page.click('[data-testid="user-profile-manage-btn"]');
  await page.getByText('Restore').click();

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText('Restore user');

  await expect(
    page.locator('[data-testid="restore-modal-body"]')
  ).toContainText(`Are you sure you want to restore ${fqn}?`);

  const restoreResponse = page.waitForResponse('/api/v1/users/restore');
  await page.click('.ant-modal-footer .ant-btn-primary');

  await restoreResponse;

  await toastNotification(page, /User restored successfully/);

  await nonDeletedUserChecks(page);
};

export const hardDeleteUserProfilePage = async (
  page: Page,
  displayName: string
) => {
  await page.getByTestId('user-profile-manage-btn').click();
  await page.getByText('Delete Profile').click();
  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText(displayName);

  await page.click('[data-testid="hard-delete-option"]');
  await page.check('[data-testid="hard-delete"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteResponse = page.waitForResponse(
    '/api/v1/users/*?hardDelete=true&recursive=true'
  );
  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;

  await expect(page.getByTestId('alert-bar')).toHaveText(
    /deleted successfully!/
  );
};

export const editDisplayName = async (page: Page, editedUserName: string) => {
  await page.click('[data-testid="user-profile-manage-btn"]');
  await page.click('[data-testid="edit-displayname"]');

  await expect(page.locator('.ant-modal-wrap')).toBeVisible();

  await page.getByTestId('displayName-input').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(editedUserName);
  const saveResponse = page.waitForResponse('/api/v1/users/*');
  await page.getByText('Save').click();
  await saveResponse;

  await expect(page.locator('.ant-modal-wrap')).not.toBeVisible();

  // Verify the updated display name
  const userName = await page.textContent('[data-testid="user-display-name"]');

  expect(userName).toContain(editedUserName);
};

export const editTeams = async (page: Page, teamName: string) => {
  await page.click('[data-testid="edit-teams-button"]');
  await page.click('.ant-select-selection-item-remove > .anticon');

  await page.click('[data-testid="team-select"]');
  await page.getByTestId('team-select').fill(teamName);

  // Click the team from the dropdown
  await page.click('.filter-node > .ant-select-tree-node-content-wrapper');

  const updateTeamResponse = page.waitForResponse('/api/v1/users/*');
  await page.click('[data-testid="inline-save-btn"]');
  await updateTeamResponse;

  // Verify the new team link is visible
  await expect(page.locator(`[data-testid="${teamName}-link"]`)).toBeVisible();
};

export const editDescription = async (
  page: Page,
  updatedDescription: string
) => {
  await page.click('[data-testid="edit-description"]');

  // Clear and type the new description
  await page.locator(descriptionBox).fill(updatedDescription);

  const updateDescription = page.waitForResponse('/api/v1/users/*');
  await page.click('[data-testid="save"]');
  await updateDescription;

  await page.click('.ant-collapse-expand-icon > .anticon > svg');

  // Verify the updated description
  const description = page.locator(
    `[data-testid="asset-description-container"] ${descriptionBoxReadOnly}`
  );

  await expect(description).toContainText(updatedDescription);
};

export const handleAdminUpdateDetails = async (
  page: Page,
  editedUserName: string
) => {
  const feedResponse = page.waitForResponse('/api/v1/feed?type=Conversation');
  await visitOwnProfilePage(page);
  await feedResponse;

  // edit displayName
  await editDisplayName(page, editedUserName);
};

export const handleUserUpdateDetails = async (
  page: Page,
  editedUserName: string
) => {
  const feedResponse = page.waitForResponse(
    '/api/v1/feed?type=Conversation&filterType=OWNER_OR_FOLLOWS&userId=*'
  );
  await visitOwnProfilePage(page);
  await feedResponse;

  // edit displayName
  await editDisplayName(page, editedUserName);
};

export const updateUserDetails = async (
  page: Page,
  updatedDisplayName: string,
  isAdmin?: boolean
) => {
  if (isAdmin) {
    await handleAdminUpdateDetails(page, updatedDisplayName);
  } else {
    await handleUserUpdateDetails(page, updatedDisplayName);
  }
};

export const softDeleteUser = async (
  page: Page,
  username: string,
  displayName: string
) => {
  // Wait for the loader to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  const searchResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&index=*&from=0&size=*'
  );
  await page.fill('[data-testid="searchbar"]', username);
  await searchResponse;

  // Click on delete button
  await page.click(`[data-testid="delete-user-btn-${username}"]`);
  // Soft deleting the user
  await page.click('[data-testid="soft-delete"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const fetchUpdatedUsers = page.waitForResponse('/api/v1/users/*');
  const deleteResponse = page.waitForResponse(
    '/api/v1/users/*?hardDelete=false&recursive=false'
  );
  await page.click('[data-testid="confirm-button"]');
  await deleteResponse;
  await fetchUpdatedUsers;

  await toastNotification(page, `"${displayName}" deleted successfully!`);

  // Wait for the loader to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  // Search soft deleted user in non-deleted mode
  const searchSoftDeletedUserResponse = page.waitForResponse(
    '/api/v1/search/query*'
  );
  await page.fill('[data-testid="searchbar"]', username);
  await searchSoftDeletedUserResponse;

  // Verify the search error placeholder is visible
  const searchErrorPlaceholder = page.locator(
    '[data-testid="search-error-placeholder"]'
  );

  await expect(searchErrorPlaceholder).toBeVisible();
};

export const restoreUser = async (
  page: Page,
  username: string,
  editedUserName: string
) => {
  // Click on deleted user toggle
  const fetchDeletedUsers = page.waitForResponse(
    '/api/v1/users?**include=deleted'
  );
  await page.click('[data-testid="show-deleted"]');
  await fetchDeletedUsers;

  // Wait for the loader to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  const searchUsers = page.waitForResponse('/api/v1/search/query*');
  await page.fill('[data-testid="searchbar"]', username);
  await searchUsers;

  // Click on restore user button
  await page.click(`[data-testid="restore-user-btn-${username}"]`);

  // Verify the modal content
  const modalContent = page.locator('.ant-modal-body > p');

  await expect(modalContent).toContainText(
    `Are you sure you want to restore ${editedUserName}?`
  );

  // Click the confirm button in the modal
  const restoreUserResponse = page.waitForResponse('/api/v1/users/restore');
  await page.click('.ant-modal-footer > .ant-btn-primary');
  await restoreUserResponse;

  await toastNotification(page, 'User restored successfully');
};

export const permanentDeleteUser = async (
  page: Page,
  username: string,
  displayName: string,
  isUserSoftDeleted = true
) => {
  if (isUserSoftDeleted) {
    // Click on deleted user toggle to off it
    const fetchDeletedUsers = page.waitForResponse(
      '/api/v1/users?**include=non-deleted'
    );
    await page.click('[data-testid="show-deleted"]');
    await fetchDeletedUsers;
  }

  // Wait for the loader to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  // Search the user
  const searchUserResponse = page.waitForResponse('/api/v1/search/query*');
  await page.fill('[data-testid="searchbar"]', username);
  await searchUserResponse;

  // Wait for the loader to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  // Click on delete user button
  await page.click(`[data-testid="delete-user-btn-${username}"]`);

  // Click on hard delete
  await page.click('[data-testid="hard-delete"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const reFetchUsers = page.waitForResponse(
    '/api/v1/users?**include=non-deleted'
  );
  const hardDeleteUserResponse = page.waitForResponse(
    'api/v1/users/*?hardDelete=true&recursive=false'
  );
  await page.click('[data-testid="confirm-button"]');
  await hardDeleteUserResponse;

  await toastNotification(page, `"${displayName}" deleted successfully!`);
  await reFetchUsers;

  // Wait for the loader to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  // Search the user again
  const searchUserAfterDeleteResponse = page.waitForResponse(
    '/api/v1/search/query*'
  );
  await page.fill('[data-testid="searchbar"]', username);

  await searchUserAfterDeleteResponse;

  // Verify the search error placeholder is visible
  const searchErrorPlaceholder = page.locator(
    '[data-testid="search-error-placeholder"]'
  );

  await expect(searchErrorPlaceholder).toBeVisible();
};

export const generateToken = async (page: Page) => {
  await expect(page.locator('[data-testid="no-token"]')).toBeVisible();

  await page.click('[data-testid="auth-mechanism"] > span');

  await page.click('[data-testid="token-expiry"]');

  await page.locator('[title="1 hour"] div').click();

  await expect(page.locator('[data-testid="token-expiry"]')).toBeVisible();

  const generateToken = page.waitForResponse('/api/v1/users/security/token');
  await page.click('[data-testid="save-edit"]');
  await generateToken;
};

export const revokeToken = async (page: Page, isBot?: boolean) => {
  await page.click('[data-testid="revoke-button"]');

  await expect(page.locator('[data-testid="body-text"]')).toContainText(
    `Are you sure you want to revoke access for ${
      isBot ? 'JWT Token' : 'Personal Access Token'
    }?`
  );

  await page.click('[data-testid="save-button"]');

  await expect(page.locator('[data-testid="revoke-button"]')).not.toBeVisible();
};

export const updateExpiration = async (page: Page, expiry: number) => {
  await page.click('[data-testid="token-expiry"]');
  await page.click(`text=${expiry} day${expiry > 1 ? 's' : ''}`);

  const expiryDate = customFormatDateTime(
    getEpochMillisForFutureDays(expiry as number),
    `ccc d'th' MMMM, yyyy`
  );

  // Wait for dropdown to close and ensure no overlays are present
  await page.waitForTimeout(100);

  // Click outside to close any open dropdowns
  await page.mouse.click(1, 1);

  // Wait for any dropdown animations to complete
  await page.waitForSelector('.ant-select-dropdown', { state: 'hidden' });

  // Now click the save button
  await page.click('[data-testid="save-edit"]');

  await expect(
    page.locator('[data-testid="center-panel"] [data-testid="revoke-button"]')
  ).toBeVisible();

  await expect(page.locator('[data-testid="token-expiry"]')).toContainText(
    `Expires on ${expiryDate}`
  );

  await revokeToken(page);
};

export const checkDataConsumerPermissions = async (page: Page) => {
  // check Add domain permission
  await expect(page.locator('[data-testid="add-domain"]')).not.toBeVisible();
  await expect(
    page.locator('[data-testid="edit-displayName-button"]')
  ).not.toBeVisible();

  // Check edit owner permission
  await expect(page.locator('[data-testid="edit-owner"]')).not.toBeVisible();

  // Check edit description permission
  await expect(page.locator('[data-testid="edit-description"]')).toBeVisible();

  // Check edit tier permission
  await expect(page.locator('[data-testid="edit-tier"]')).toBeVisible();

  // Check right panel add tags button
  await expect(
    page.locator(
      '[data-testid="KnowledgePanel.Tags"] [data-testid="tags-container"] [data-testid="add-tag"]'
    )
  ).toBeVisible();

  // Check right panel add glossary term button
  await expect(
    page.locator(
      '[data-testid="KnowledgePanel.GlossaryTerms"] [data-testid="glossary-container"] [data-testid="add-tag"]'
    )
  ).toBeVisible();

  await expect(page.locator('[data-testid="manage-button"]')).toBeVisible();

  await page.click('[data-testid="manage-button"]');

  await expect(page.locator('[data-testid="export-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="import-button"]')).not.toBeVisible();
  await expect(
    page.locator('[data-testid="announcement-button"]')
  ).not.toBeVisible();
  await expect(page.locator('[data-testid="delete-button"]')).not.toBeVisible();

  await page.click('[data-testid="lineage"]');

  await waitForAllLoadersToDisappear(page);

  await page.getByTestId('lineage-config').click();

  await expect(
    page.getByRole('menuitem', { name: 'Edit Lineage' })
  ).not.toBeVisible();

  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel' })
    .click();
};

export const checkStewardServicesPermissions = async (page: Page) => {
  // Click on the sidebar item for Explore
  await sidebarClick(page, SidebarItem.EXPLORE);

  // Iterate through the service page details and check for the add service button
  for (const service of Object.values(VISIT_SERVICE_PAGE_DETAILS)) {
    await settingClick(page, service.settingsMenuId as SettingOptionsType);

    await expect(
      page.locator('[data-testid="add-service-button"] > span')
    ).not.toBeVisible();
  }

  // Click on the sidebar item for Explore again
  const queryResponse = page.waitForResponse('/api/v1/search/query?q=*');
  await sidebarClick(page, SidebarItem.EXPLORE);
  await queryResponse;
  // Perform search actions
  await page.click('[data-testid="search-dropdown-Data Assets"]');

  await page.getByTestId('drop-down-menu').getByTestId('loader').waitFor({
    state: 'detached',
  });

  const dataAssetDropdownRequest = page.waitForResponse(
    '/api/v1/search/aggregate?index=dataAsset&field=entityType.keyword*'
  );

  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill('table');
  await dataAssetDropdownRequest;

  await page.locator('[data-testid="table-checkbox"]').scrollIntoViewIfNeeded();
  await page.click('[data-testid="table-checkbox"]');

  const getSearchResultResponse = page.waitForResponse(
    '/api/v1/search/query?q=*'
  );
  await page.click('[data-testid="update-btn"]');

  await getSearchResultResponse;

  // Click on the entity link in the drawer title
  await page.click('.summary-panel-container [data-testid="entity-link"]');

  await page.waitForLoadState('networkidle');

  // Check if the edit tier button is visible
  await expect(page.locator('[data-testid="edit-icon-tier"]')).toBeVisible();
};

export const checkStewardPermissions = async (page: Page) => {
  // Check Add domain permission
  await expect(page.locator('[data-testid="add-domain"]')).not.toBeVisible();

  await expect(
    page
      .getByRole('cell', { name: 'user_id' })
      .getByTestId('edit-displayName-button')
  ).toBeVisible();

  // Check edit owner permission
  await expect(page.locator('[data-testid="edit-owner"]')).toBeVisible();

  // Check edit description permission
  await expect(page.locator('[data-testid="edit-description"]')).toBeVisible();

  // Check edit tier permission
  await expect(page.locator('[data-testid="edit-tier"]')).toBeVisible();

  // Check right panel add tags button
  await expect(
    page.locator(
      '[data-testid="KnowledgePanel.Tags"] [data-testid="tags-container"] [data-testid="add-tag"]'
    )
  ).toBeVisible();

  // Check right panel add glossary term button
  await expect(
    page.locator(
      '[data-testid="KnowledgePanel.GlossaryTerms"] [data-testid="glossary-container"] [data-testid="add-tag"]'
    )
  ).toBeVisible();

  // Check manage button
  await expect(page.locator('[data-testid="manage-button"]')).toBeVisible();

  // Click on lineage item
  await page.click('[data-testid="lineage"]');
  await waitForAllLoadersToDisappear(page);

  // Check if edit lineage option is available
  await page.getByTestId('lineage-config').click();

  await expect(
    page.getByRole('menuitem', { name: 'Edit Lineage' })
  ).toBeVisible();
};

export const addUser = async (
  page: Page,
  {
    name,
    email,
    password,
    role,
  }: {
    name: string;
    email: string;
    password: string;
    role: string;
  }
) => {
  await page.click('[data-testid="add-user"]');

  await page.fill('[data-testid="email"]', email);

  await page.fill('[data-testid="displayName"]', name);

  await page.locator(descriptionBox).fill('Adding new user');

  await page.click(':nth-child(2) > .ant-radio > .ant-radio-input');
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);

  await page.click('[data-testid="roles-dropdown"] > .ant-select-selector');
  await page.getByTestId('roles-dropdown').getByRole('combobox').fill(role);
  await page.click('.ant-select-item-option-content');
  await page.click('[data-testid="roles-dropdown"] > .ant-select-selector');

  const saveResponse = page.waitForResponse('/api/v1/users');
  await page.click('[data-testid="save-user"]');
  await saveResponse;

  expect((await saveResponse).status()).toBe(201);
};

export const checkForUserExistError = async (
  page: Page,
  {
    name,
    email,
    password,
  }: {
    name: string;
    email: string;
    password: string;
  }
) => {
  await page.click('[data-testid="add-user"]');

  await page.fill('[data-testid="email"]', email);

  await page.fill('[data-testid="displayName"]', name);

  await page.locator(descriptionBox).fill('Adding new user');

  await page.click(':nth-child(2) > .ant-radio > .ant-radio-input');
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);

  const saveResponse = page.waitForResponse('/api/v1/users');
  await page.click('[data-testid="save-user"]');
  await saveResponse;

  expect((await saveResponse).status()).toBe(409);

  await expect(page.getByRole('alert')).toBeVisible();

  await expect(page.getByTestId('inline-alert-description')).toContainText(
    `A user with the name "${name}" already exists. Please choose another email.`
  );

  await page.click('[data-testid="cancel-user"]');
};

const resetPasswordModal = async (
  page: Page,
  oldPassword: string,
  newPassword: string,
  isOldPasswordCorrect = true
) => {
  await page.fill('[data-testid="input-oldPassword"]', oldPassword);
  await page.fill('[data-testid="input-newPassword"]', newPassword);
  await page.fill('[data-testid="input-confirm-newPassword"]', newPassword);

  const saveResetPasswordResponse = page.waitForResponse(
    '/api/v1/users/changePassword'
  );
  await page.click(
    '.ant-modal-footer > .ant-btn-primary:has-text("Update Password")'
  );

  await saveResetPasswordResponse;

  await toastNotification(
    page,
    isOldPasswordCorrect
      ? 'Password updated successfully.'
      : 'Old Password is not correct'
  );
};

export const resetPassword = async (
  page: Page,
  oldCorrectPassword: string,
  oldWrongPassword: string,
  newPassword: string
) => {
  await visitOwnProfilePage(page);

  await page.click('[data-testid="user-profile-manage-btn"]');
  await page.click('[data-testid="change-password-button"]');

  await expect(page.locator('.ant-modal-wrap')).toBeVisible();

  // Try with the wrong old password should throw an error
  await resetPasswordModal(page, oldWrongPassword, newPassword, false);

  // Try with the Correct old password should reset the password
  await resetPasswordModal(page, oldCorrectPassword, newPassword);
};

export const expectSettingEntityNotVisible = async (
  page: Page,
  path: string[]
) => {
  await expect(page.getByTestId(path[0])).not.toBeVisible();
};

// Check the permissions for the settings page for DataSteward and DataConsumer
export const settingPageOperationPermissionCheck = async (page: Page) => {
  await redirectToHomePage(page);

  for (const id of Object.values(SETTING_PAGE_ENTITY_PERMISSION)) {
    let apiResponse: Promise<Response> | undefined;
    if (id?.api) {
      apiResponse = page.waitForResponse(id.api);
    }
    // Navigate to settings and respective tab page
    await settingClick(page, id.testid as SettingOptionsType);
    if (id?.api && apiResponse) {
      await apiResponse;
    }

    await expect(page.locator('.ant-skeleton-button')).not.toBeVisible();
    await expect(page.getByTestId(id.button)).not.toBeVisible();
  }

  for (const id of Object.values(GLOBAL_SETTING_PERMISSIONS)) {
    if (id.testid === GlobalSettingOptions.METADATA) {
      await settingClick(page, id.testid);
    } else {
      await sidebarClick(page, SidebarItem.SETTINGS);
      let paths =
        SETTINGS_OPTIONS_PATH[id.testid as keyof typeof SETTINGS_OPTIONS_PATH];

      if (id.isCustomProperty) {
        paths =
          SETTING_CUSTOM_PROPERTIES_PATH[
            id.testid as keyof typeof SETTING_CUSTOM_PROPERTIES_PATH
          ];
      }

      await expectSettingEntityNotVisible(page, paths);
    }
  }
};

export const checkEditOwnerButtonPermission = async (page: Page) => {
  await expect(page.locator('[data-testid="edit-owner"]')).not.toBeVisible();
};
