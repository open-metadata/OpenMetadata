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
import { expect, Locator, Page } from '@playwright/test';
import { JSDOM } from 'jsdom';
import { isEmpty, lowerCase } from 'lodash';
import {
  BIG_ENTITY_DELETE_TIMEOUT,
  ENTITIES_WITHOUT_FOLLOWING_BUTTON,
  LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT,
  LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED,
} from '../constant/delete';
import { ES_RESERVED_CHARACTERS } from '../constant/entity';
import { SidebarItem } from '../constant/sidebar';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { EntityClass } from '../support/entity/EntityClass';
import { EntityType } from '../support/entity/EntityDataClass.interface';
import { TableClass } from '../support/entity/TableClass';
import { TagClass } from '../support/tag/TagClass';
import {
  clickOutside,
  descriptionBox,
  readElementInListWithScroll,
  redirectToHomePage,
  toastNotification,
  uuid,
} from './common';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForFutureDays,
} from './dateTime';
import { searchAndClickOnOption } from './explore';
import { sidebarClick } from './sidebar';

export const waitForAllLoadersToDisappear = async (
  page: Page,
  dataTestId = 'loader',
  timeout = 30000
) => {
  const loaders = page.locator(`[data-testid="${dataTestId}"]`);

  // Wait for the loader elements count to become 0
  await expect(loaders).toHaveCount(0, { timeout });
};

export const visitEntityPage = async (data: {
  page: Page;
  searchTerm: string;
  dataTestId: string;
}) => {
  const { page, searchTerm, dataTestId } = data;
  await page.waitForLoadState('networkidle');

  // Unified loader handling
  await waitForAllLoadersToDisappear(page);

  // Dismiss welcome screen if visible
  const isWelcomeScreenVisible = await page
    .getByTestId('welcome-screen')
    .isVisible();

  if (isWelcomeScreenVisible) {
    await page.getByTestId('welcome-screen-close-btn').click();
    await page.waitForLoadState('networkidle');
  }

  const waitForSearchResponse = page.waitForResponse(
    '/api/v1/search/query?q=*index=dataAsset*'
  );
  await page.getByTestId('searchBox').fill(searchTerm);
  await waitForSearchResponse;

  await page.getByTestId(dataTestId).getByTestId('data-name').click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await page.getByTestId('searchBox').clear();
};

export const addOwner = async ({
  page,
  owner,
  endpoint,
  type = 'Users',
  dataTestId,
  initiatorId = 'edit-owner',
}: {
  page: Page;
  owner: string;
  endpoint: EntityTypeEndpoint;
  type?: 'Teams' | 'Users';
  dataTestId?: string;
  initiatorId?: string;
}) => {
  await page.getByTestId(initiatorId).click();
  if (type === 'Users') {
    const userListResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=user_search_index&*'
    );
    await page.getByRole('tab', { name: type }).click();
    await userListResponse;
  }
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const ownerSearchBar = await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .isVisible();

  if (!ownerSearchBar) {
    await page.getByRole('tab', { name: type }).click();
  }

  const searchUser = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(owner)}*`
  );
  await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .fill(owner);
  await searchUser;

  if (type === 'Teams') {
    const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
    await page.getByRole('listitem', { name: owner, exact: true }).click();
    await patchRequest;
  } else {
    const ownerItem = page.getByRole('listitem', {
      name: owner,
      exact: true,
    });

    await ownerItem.waitFor({ state: 'visible' });
    await ownerItem.click();
    const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
    await page.getByTestId('selectable-list-update-btn').click();
    await patchRequest;
  }

  await expect(
    page.getByTestId(dataTestId ?? 'owner-link').getByTestId(`${owner}`)
  ).toBeVisible();
};

export const addOwnerWithoutValidation = async ({
  page,
  owner,
  type = 'Users',
  initiatorId = 'edit-owner',
}: {
  page: Page;
  owner: string;
  type?: 'Teams' | 'Users';
  initiatorId?: string;
}) => {
  await page.getByTestId(initiatorId).click();
  if (type === 'Users') {
    const userListResponse = page.waitForResponse(
      '/api/v1/search/query?q=&index=user_search_index&*'
    );
    await page.getByRole('tab', { name: type }).click();
    await userListResponse;
  }
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const ownerSearchBar = await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .isVisible();

  if (!ownerSearchBar) {
    await page.getByRole('tab', { name: type }).click();
  }

  const searchUser = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(owner)}*`
  );
  await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .fill(owner);
  await searchUser;

  if (type === 'Teams') {
    await page.getByRole('listitem', { name: owner, exact: true }).click();
  } else {
    await page.getByRole('listitem', { name: owner, exact: true }).click();
    await page.getByTestId('selectable-list-update-btn').click();
  }
};

export const updateOwner = async ({
  page,
  owner,
  endpoint,
  type = 'Users',
  dataTestId,
}: {
  page: Page;
  owner: string;
  endpoint: EntityTypeEndpoint;
  type?: 'Teams' | 'Users';
  dataTestId?: string;
}) => {
  await page.getByTestId('edit-owner').click();
  await page.getByRole('tab', { name: type }).click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const searchUser = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(owner)}*`
  );
  await page
    .getByTestId(`owner-select-${lowerCase(type)}-search-bar`)
    .fill(owner);
  await searchUser;

  if (type === 'Teams') {
    const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
    await page.getByRole('listitem', { name: owner, exact: true }).click();
    await patchRequest;
  } else {
    await page.getByRole('listitem', { name: owner, exact: true }).click();

    const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
    await page.getByTestId('selectable-list-update-btn').click();
    await patchRequest;
  }

  await expect(
    page.getByTestId(dataTestId ?? 'owner-link').getByTestId(`${owner}`)
  ).toBeVisible();
};

export const removeOwnersFromList = async ({
  page,
  endpoint,
  ownerNames,
  dataTestId,
}: {
  page: Page;
  endpoint: EntityTypeEndpoint;
  ownerNames: string[];
  dataTestId?: string;
}) => {
  await page.getByTestId('edit-owner').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  for (const ownerName of ownerNames) {
    const ownerItem = page.getByRole('listitem', {
      name: ownerName,
      exact: true,
    });

    await ownerItem.click();
  }
  const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
  await page.click('[data-testid="selectable-list-update-btn"]');
  await patchRequest;

  for (const ownerName of ownerNames) {
    await expect(
      page.getByTestId(dataTestId ?? 'owner-link').getByTestId(ownerName)
    ).not.toBeVisible();
  }
};

// Removes All Owners
export const removeOwner = async ({
  page,
  endpoint,
  ownerName,
  type = 'Users',
  dataTestId,
}: {
  page: Page;
  endpoint: EntityTypeEndpoint;
  ownerName: string;
  type?: 'Teams' | 'Users';
  dataTestId?: string;
}) => {
  await page.getByTestId('edit-owner').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
  if (type === 'Teams') {
    await expect(page.getByTestId('remove-owner').locator('svg')).toBeVisible();

    await page.getByTestId('remove-owner').locator('svg').click();
  } else {
    await page.click('[data-testid="clear-all-button"]');
    await page.click('[data-testid="selectable-list-update-btn"]');
  }

  await patchRequest;

  await page
    .getByTestId(dataTestId ?? 'owner-link')
    .getByTestId(ownerName)
    .waitFor({ state: 'hidden' });
};

export const addMultiOwner = async (data: {
  page: Page;
  ownerNames: string | string[];
  activatorBtnDataTestId: string;
  endpoint: EntityTypeEndpoint;
  resultTestId?: string;
  isSelectableInsideForm?: boolean;
  type: 'Teams' | 'Users';
  clearAll?: boolean;
}) => {
  const {
    page,
    ownerNames,
    activatorBtnDataTestId,
    resultTestId = 'owner-link',
    isSelectableInsideForm = false,
    endpoint,
    type,
    clearAll = true,
  } = data;
  const isMultipleOwners = Array.isArray(ownerNames);
  const owners = isMultipleOwners ? ownerNames : [ownerNames]

  await page.click(`[data-testid="${activatorBtnDataTestId}"]`);

  await expect(page.locator("[data-testid='select-owner-tabs']")).toBeVisible();

  await page.waitForSelector(
    '[data-testid="select-owner-tabs"] [data-testid="loader"]',
    { state: 'detached' }
  );

  await page
    .locator("[data-testid='select-owner-tabs']")
    .getByRole('tab', { name: 'Users' })
    .click();

  await page.waitForSelector(
    '[data-testid="select-owner-tabs"] [data-testid="loader"]',
    { state: 'detached' }
  );

  const isClearButtonVisible = await page
    .getByTestId('select-owner-tabs')
    .locator('[id^="rc-tabs-"][id$="-panel-users"]')
    .getByTestId('clear-all-button')
    .isVisible();

  // If the user is not in the Users tab, switch to it
  if (!isClearButtonVisible) {
    await page
      .getByTestId('select-owner-tabs')
      .getByRole('tab', { name: 'Users' })
      .click();

    await page.waitForSelector(
      '[data-testid="select-owner-tabs"] [data-testid="loader"]',
      { state: 'detached' }
    );
  }

  if (clearAll && isMultipleOwners) {
    const clearButton = page
      .locator('[id^="rc-tabs-"][id$="-panel-users"]')
      .getByTestId('clear-all-button');

    await clearButton.click();

    await expect(page.getByTestId('select-owner-tabs')).toBeVisible();
  }

  for (const ownerName of owners) {
    await expect(
      page.locator('[data-testid="owner-select-users-search-bar"]')
    ).toBeVisible();

    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.locator('[data-testid="owner-select-users-search-bar"]').clear();
    await page.fill('[data-testid="owner-select-users-search-bar"]', ownerName);
    await searchOwner;
    await page.waitForSelector(
      '[data-testid="select-owner-tabs"] [data-testid="loader"]',
      { state: 'detached' }
    );

    const ownerItem = page.getByRole('listitem', {
      name: ownerName,
      exact: true,
    });
    await ownerItem.waitFor({ state: 'visible' });

    // Wait for the item to exist and be visible before clicking

    if (type === 'Teams') {
      if (isSelectableInsideForm) {
        await ownerItem.click();
      } else {
        const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
        await ownerItem.click();
        await patchRequest;
      }
    } else {
      await ownerItem.click();
    }
  }

  if (isMultipleOwners) {
    const updateButton = page
      .locator('[id^="rc-tabs-"][id$="-panel-users"]')
      .getByTestId('selectable-list-update-btn');

    if (isSelectableInsideForm) {
      await updateButton.click();
    } else {
      const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
      await updateButton.click();
      await patchRequest;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.waitForSelector('[data-testid="select-owner-tabs"] ', {
        state: 'detached',
      });
    }
  }

  for (const name of owners) {
    await expect(
      page.locator(`[data-testid="${resultTestId}"]`).getByTestId(name)
    ).toBeVisible();
  }
};

export const assignTier = async (
  page: Page,
  tier: string,
  endpoint: string,
  initiatorId = 'edit-tier'
) => {
  // Wait for the edit button to be visible and clickable
  const editButton = page.getByTestId(initiatorId);
  await editButton.waitFor({ state: 'visible' });
  await editButton.click();

  // Wait for all loaders to disappear
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // Wait for the tier selection radio buttons to be visible
  const tierRadioButton = page.getByTestId(`radio-btn-${tier}`);
  await tierRadioButton.waitFor({ state: 'visible' });

  // Set up response wait before clicking
  const patchRequest = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${endpoint}`) &&
      response.request().method() === 'PATCH'
  );

  await tierRadioButton.click();

  // Wait for the update button to be visible and clickable
  const updateButton = page.getByTestId('update-tier-card');
  await updateButton.waitFor({ state: 'visible' });
  await updateButton.click();

  // Wait for the PATCH request to complete and validate status
  const response = await patchRequest;
  expect(response.status()).toBe(200);

  // Wait for loaders to finish
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // Close the tier popover
  await clickOutside(page);

  // Verify the tier was updated
  await expect(page.getByTestId('Tier')).toContainText(tier);
};

export const removeTier = async (page: Page, endpoint: string) => {
  await page.getByTestId('edit-tier').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  const patchRequest = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${endpoint}`) &&
      response.request().method() === 'PATCH'
  );
  await page.getByTestId('clear-tier').click();

  const response = await patchRequest;
  expect(response.status()).toBe(200);

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await clickOutside(page);

  await expect(page.getByTestId('Tier')).toContainText('--');
};

export const assignCertification = async (
  page: Page,
  certification: TagClass,
  endpoint: string
) => {
  const certificationResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/tags') &&
      response.url().includes('parent=Certification')
  );
  await page.getByTestId('edit-certification').click();

  const tagsResponse = await certificationResponse;
  expect(tagsResponse.status()).toBe(200);

  await page.waitForSelector('.certification-card-popover', {
    state: 'visible',
  });
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await readElementInListWithScroll(
    page,
    page.getByTestId(
      `radio-btn-${certification.responseData.fullyQualifiedName}`
    ),
    page.locator('[data-testid="certification-cards"] .ant-radio-group')
  );

  await page
    .getByTestId(`radio-btn-${certification.responseData.fullyQualifiedName}`)
    .click();
  const patchRequest = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${endpoint}`) &&
      response.request().method() === 'PATCH'
  );
  await page.getByTestId('update-certification').click();

  const patchResponse = await patchRequest;
  expect(patchResponse.status()).toBe(200);

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await clickOutside(page);

  await expect(page.getByTestId('certification-label')).toContainText(
    certification.responseData.displayName
  );
};

export const removeCertification = async (page: Page, endpoint: string) => {
  await page.getByTestId('edit-certification').click();
  await page.waitForSelector('.certification-card-popover', {
    state: 'visible',
  });
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  const patchRequest = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${endpoint}`) &&
      response.request().method() === 'PATCH'
  );
  await page.getByTestId('clear-certification').click();

  const response = await patchRequest;
  expect(response.status()).toBe(200);

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await clickOutside(page);

  await expect(page.getByTestId('certification-label')).toContainText('--');
};

export const updateDescription = async (
  page: Page,
  description: string,
  isModal = false,
  validationContainerTestId = 'asset-description-container',
  endpoint?: EntityTypeEndpoint
) => {
  const editDescriptionButton = page.getByTestId('edit-description');
  const editButton = page.getByTestId('edit-button');

  try {
    await expect(editDescriptionButton).toBeVisible();
    await editDescriptionButton.click();
  } catch {
    await expect(editButton).toBeVisible();
    await editButton.click();
  }

  // Wait for description box to be visible and ready
  const descBox = page.locator(descriptionBox).first();
  await expect(descBox).toBeVisible();
  await descBox.click();
  await descBox.clear();
  await descBox.fill(description);

  // Wait for save button and click
  const saveButton = page.getByTestId('save');
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();

  // Always wait for the PATCH request, not just when endpoint is provided
  const patchRequest = endpoint
    ? page.waitForResponse(`/api/v1/${endpoint}/*`)
    : page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' && response.status() === 200
      );

  await saveButton.click();
  await patchRequest;
  if (isModal) {
    await page.waitForSelector('[role="dialog"].description-markdown-editor', {
      state: 'hidden',
    });
  }

  // CRITICAL: Wait for UI to update after save
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  if (validationContainerTestId) {
    if (isEmpty(description)) {
      // Check for either "No description" or handle potential UI duplication issue
      const container = page.getByTestId(validationContainerTestId);
      const text = await container.textContent();

      expect(text).toMatch(/No description|Descriptiondescription/);
    } else {
      await expect(
        page.getByTestId(validationContainerTestId).getByRole('paragraph')
      ).toContainText(description);
    }
  }
};

export const updateDescriptionForChildren = async (
  page: Page,
  description: string,
  rowId: string,
  rowSelector: string,
  entityEndpoint: string
) => {
  const editButton = page
    .locator(`[${rowSelector}="${rowId}"]`)
    .getByTestId('description')
    .first()
    .getByTestId('edit-button');

  await expect(editButton).toBeVisible();
  await editButton.click();

  // Wait for modal to be visible
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // Wait for editor to be ready
  const modalEditor = modal.locator(descriptionBox);
  await expect(modalEditor).toBeVisible();
  await modalEditor.click();
  await modalEditor.clear();
  await modalEditor.fill(description);

  // REMOVED: toHaveText check - rich text editor may have formatting that makes exact match unreliable
  // The final verification after save is sufficient

  // Wait for API response
  let updateRequest;
  if (
    entityEndpoint === 'tables' ||
    entityEndpoint === 'dashboard/datamodels'
  ) {
    updateRequest = page.waitForResponse('/api/v1/columns/name/*');
  } else {
    updateRequest = page.waitForResponse(`/api/v1/${entityEndpoint}/*`);
  }

  const saveButton = page.getByTestId('save');
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await updateRequest;

  // Wait for modal to close
  await expect(modal).not.toBeVisible();

  // CRITICAL: Wait for UI to update after API response
  // The modal closing doesn't guarantee the row has updated yet
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  // Verify the description was updated in the UI
  if (isEmpty(description)) {
    await expect(
      page.locator(`[${rowSelector}="${rowId}"]`).getByTestId('description')
    ).toContainText('No Description');
  } else {
    await expect(
      page
        .locator(`[${rowSelector}="${rowId}"]`)
        .getByTestId('viewer-container')
        .getByRole('paragraph')
    ).toContainText(description);
  }
};

export const assignTag = async (
  page: Page,
  tag: string,
  action: 'Add' | 'Edit' = 'Add',
  endpoint: string,
  parentId = 'KnowledgePanel.Tags',
  tagFqn?: string
) => {
  const tagButton = page
    .getByTestId(parentId)
    .getByTestId('tags-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .first();

  await expect(tagButton).toBeVisible();
  await tagButton.click();

  await expect(page.locator('#tagsForm_tags')).toBeVisible();

  const searchTags = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );

  await page.locator('#tagsForm_tags').fill(tag);

  await searchTags;

  await page
    .getByTestId(`tag-${tagFqn ? `${tagFqn}` : tag}`)
    .first()
    .click();

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await patchRequest;
  await page.waitForSelector(
    '[data-testid="saveAssociatedTag"] [data-icon="loading"]',
    { state: 'detached' }
  );
  await expect(page.getByTestId('saveAssociatedTag')).not.toBeVisible();

  await expect(
    page
      .getByTestId(parentId)
      .getByTestId('tags-container')
      .getByTestId(`tag-${tagFqn ? `${tagFqn}` : tag}`)
  ).toBeVisible();
};

export const assignTagToChildren = async ({
  page,
  tag,
  rowId,
  action = 'Add',
  rowSelector = 'data-row-key',
  entityEndpoint,
}: {
  page: Page;
  tag: string;
  rowId: string;
  action?: 'Add' | 'Edit';
  rowSelector?: string;
  entityEndpoint: string;
}) => {
  await page
    .locator(`[${rowSelector}="${rowId}"]`)
    .getByTestId('tags-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  const searchTags = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );

  await page.locator('#tagsForm_tags').fill(tag);

  await searchTags;

  await page.getByTestId(`tag-${tag}`).click();
  let patchRequest;
  if (
    entityEndpoint === 'tables' ||
    entityEndpoint === 'dashboard/datamodels'
  ) {
    patchRequest = page.waitForResponse('/api/v1/columns/name/*');
  } else {
    patchRequest = page.waitForResponse(`/api/v1/${entityEndpoint}/*`);
  }

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await patchRequest;

  await page.waitForSelector(
    '[data-testid="saveAssociatedTag"] [data-icon="loading"]',
    { state: 'detached' }
  );
  await expect(page.getByTestId('saveAssociatedTag')).not.toBeVisible();

  await expect(
    page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('tags-container')
      .getByTestId(`tag-${tag}`)
  ).toBeVisible();
};

export const removeTag = async (page: Page, tags: string[]) => {
  for (const tag of tags) {
    await page
      .getByTestId('KnowledgePanel.Tags')
      .getByTestId('tags-container')
      .getByTestId('edit-button')
      .click();

    await page
      .getByTestId(`selected-tag-${tag}`)
      .getByTestId('remove-tags')
      .locator('svg')
      .click();

    const patchRequest = page.waitForResponse(
      (response) => response.request().method() === 'PATCH'
    );

    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();
    await patchRequest;

    await expect(
      page
        .getByTestId('KnowledgePanel.Tags')
        .getByTestId('tags-container')
        .getByTestId(`tag-${tag}`)
    ).not.toBeVisible();
  }
};

export const removeTagsFromChildren = async ({
  page,
  rowId,
  tags,
  rowSelector = 'data-row-key',
  entityEndpoint,
}: {
  page: Page;
  tags: string[];
  rowId: string;
  rowSelector?: string;
  entityEndpoint: string;
}) => {
  for (const tag of tags) {
    await page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('tags-container')
      .getByTestId('edit-button')
      .first()
      .click();

    await page
      .getByTestId('tag-selector')
      .getByTestId(`selected-tag-${tag}`)
      .getByTestId('remove-tags')
      .click();

    let patchRequest;
    if (
      entityEndpoint === 'tables' ||
      entityEndpoint === 'dashboard/datamodels'
    ) {
      patchRequest = page.waitForResponse('/api/v1/columns/name/*');
    } else {
      patchRequest = page.waitForResponse(`/api/v1/${entityEndpoint}/*`);
    }
    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();

    await patchRequest;

    await expect(
      page
        .locator(`[${rowSelector}="${rowId}"]`)
        .getByTestId('tags-container')
        .getByTestId(`tag-${tag}`)
    ).not.toBeVisible();
  }
};

type GlossaryTermOption = {
  displayName: string;
  name: string;
  fullyQualifiedName: string;
};

export const assignGlossaryTerm = async (
  page: Page,
  glossaryTerm: GlossaryTermOption,
  action: 'Add' | 'Edit' = 'Add',
  entityEndpoint: string
) => {
  await page
    .getByTestId('KnowledgePanel.GlossaryTerms')
    .getByTestId('glossary-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();
  const searchGlossaryTerm = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(glossaryTerm.displayName)}*`
  );
  await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });

  await page.locator('#tagsForm_tags').fill(glossaryTerm.displayName);
  await searchGlossaryTerm;

  await page.getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`).click();

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  await expect(
    page.getByTestId('custom-drop-down-menu').getByTestId('saveAssociatedTag')
  ).toBeEnabled();

  const patchRequest = page.waitForResponse(`/api/v1/${entityEndpoint}/*`);

  await page
    .getByTestId('custom-drop-down-menu')
    .getByTestId('saveAssociatedTag')
    .click();

  await patchRequest;
  await expect(
    page.getByTestId('custom-drop-down-menu').getByTestId('saveAssociatedTag')
  ).not.toBeVisible();

  await expect(
    page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`)
  ).toBeVisible();
};

export const openColumnDetailPanel = async ({
  page,
  rowSelector = 'data-row-key',
  columnId,
  columnNameTestId = 'column-name',
  entityType,
}: {
  page: Page;
  rowSelector?: string;
  columnId: string;
  columnNameTestId?: string;
  entityType?: EntityType;
}) => {
  if (entityType === 'MlModel') {
    const columnName = page
      .locator(`[${rowSelector}="${columnId}"]`)
      .getByTestId(columnNameTestId)
      .first();
    await columnName.waitFor({ state: 'visible' });
    await columnName.click();
  } else {
    const row = page.locator(`[${rowSelector}="${columnId}"]`).first();
    await row.waitFor({ state: 'visible' });

    const nameCell = row.getByTestId('column-name-cell');

    await nameCell.waitFor({ state: 'visible' });

    const columnNameElement = nameCell.getByTestId(columnNameTestId);

    if ((await columnNameElement.count()) > 0) {
      await columnNameElement.click({ force: false });
    } else {
      await nameCell.click({ force: false });
    }
  }
  await expect(page.locator('.column-detail-panel')).toBeVisible();

  await page.waitForLoadState('networkidle');

  const panelContainer = page.locator('.column-detail-panel');

  // Wait for the panel content to be loaded
  await expect(panelContainer.getByTestId('entity-link')).toBeVisible();

  return panelContainer;
};

export const closeColumnDetailPanel = async (page: Page) => {
  const panelContainer = page.locator('.column-detail-panel');
  await panelContainer.getByTestId('close-button').click();

  await expect(page.locator('.column-detail-panel')).not.toBeVisible();
};

export const assignGlossaryTermToChildren = async ({
  page,
  glossaryTerm,
  action = 'Add',
  rowId,
  rowSelector = 'data-row-key',
  entityEndpoint,
}: {
  page: Page;
  glossaryTerm: GlossaryTermOption;
  rowId: string;
  action?: 'Add' | 'Edit';
  rowSelector?: string;
  entityEndpoint: string;
}) => {
  // First, wait for the row itself to be visible
  const rowLocator = page.locator(`[${rowSelector}="${rowId}"]`);
  await expect(rowLocator).toBeVisible();

  // Scroll the row into view to ensure it's accessible
  await rowLocator.scrollIntoViewIfNeeded();

  const addButton = rowLocator
    .getByTestId('glossary-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .first();

  await expect(addButton).toBeVisible();
  await addButton.click();

  // Wait for input field to be visible
  const glossaryInput = page.locator('#tagsForm_tags');
  await expect(glossaryInput).toBeVisible();

  const searchGlossaryTerm = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(glossaryTerm.displayName)}*`
  );
  await glossaryInput.fill(glossaryTerm.displayName);
  await searchGlossaryTerm;

  // Wait for loader to disappear after search
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  // Wait for glossary term tag to be visible before clicking
  const glossaryTermTag = page.getByTestId(
    `tag-${glossaryTerm.fullyQualifiedName}`
  );
  await expect(glossaryTermTag).toBeVisible();

  // CRITICAL: Set up waitForResponse BEFORE the click that triggers it
  const putRequest = page.waitForResponse(
    (response) => response.request().method() === 'PUT'
  );
  await glossaryTermTag.click();

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  let patchRequest;
  if (
    entityEndpoint === 'tables' ||
    entityEndpoint === 'dashboard/datamodels'
  ) {
    patchRequest = page.waitForResponse('/api/v1/columns/name/*');
  } else {
    patchRequest = page.waitForResponse(`/api/v1/${entityEndpoint}/*`);
  }

  const saveButton = page.getByTestId('saveAssociatedTag');
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await patchRequest;

  await expect(saveButton).not.toBeVisible();

  await putRequest;

  // CRITICAL: Wait for UI to update after API responses
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(
    page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('glossary-container')
      .getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`)
  ).toBeVisible();
};

export const removeGlossaryTerm = async (
  page: Page,
  glossaryTerms: GlossaryTermOption[]
) => {
  for (const tag of glossaryTerms) {
    await page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('edit-button')
      .click();
      //small timeout to avoid popup collide with click
      await page.waitForTimeout(500)

    await page
      .getByTestId('glossary-container')
      .getByTestId(new RegExp(tag.name))
      .getByTestId('remove-tags')
      .locator('svg')
      .click();

    const patchRequest = page.waitForResponse(
      (response) => response.request().method() === 'PATCH'
    );

    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(
      page.getByTestId('custom-drop-down-menu').getByTestId('saveAssociatedTag')
    ).toBeEnabled();

    await page
      .getByTestId('custom-drop-down-menu')
      .getByTestId('saveAssociatedTag')
      .click();
    await patchRequest;

    await expect(
      page
        .getByTestId('KnowledgePanel.GlossaryTerms')
        .getByTestId('glossary-container')
        .getByTestId(`tag-${tag.fullyQualifiedName}`)
    ).not.toBeVisible();
  }
};

export const removeGlossaryTermFromChildren = async ({
  page,
  glossaryTerms,
  rowId,
  entityEndpoint,
  rowSelector = 'data-row-key',
}: {
  page: Page;
  glossaryTerms: GlossaryTermOption[];
  rowId: string;
  entityEndpoint: string;
  rowSelector?: string;
}) => {
  for (const tag of glossaryTerms) {
    await page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('glossary-container')
      .getByTestId('edit-button')
      .first()
      .click();

    await page
      .getByTestId('glossary-container')
      .getByTestId(new RegExp(tag.name))
      .getByTestId('remove-tags')
      .locator('svg')
      .click();

    let patchRequest;
    if (
      entityEndpoint === 'tables' ||
      entityEndpoint === 'dashboard/datamodels'
    ) {
      patchRequest = page.waitForResponse('/api/v1/columns/name/*');
    } else {
      patchRequest = page.waitForResponse(`/api/v1/${entityEndpoint}/*`);
    }

    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();

    await patchRequest;

    expect(
      page
        .locator(`[${rowSelector}="${rowId}"]`)
        .getByTestId('glossary-container')
        .getByTestId(`tag-${tag.fullyQualifiedName}`)
    ).not.toBeVisible();
  }
};

export const upVote = async (page: Page, endPoint: string) => {
  const patchRequest = page.waitForResponse(`/api/v1/${endPoint}/*/vote`);

  await page.getByTestId('up-vote-btn').click();
  await patchRequest;

  await expect(page.getByTestId('up-vote-count')).toContainText('1');
};

export const downVote = async (page: Page, endPoint: string) => {
  const patchRequest = page.waitForResponse(`/api/v1/${endPoint}/*/vote`);
  await page.getByTestId('down-vote-btn').click();
  await patchRequest;

  await expect(page.getByTestId('down-vote-count')).toContainText('1');
};

export const followEntity = async (
  page: Page,
  endpoint: EntityTypeEndpoint
) => {
  const followResponse = page.waitForResponse(
    `/api/v1/${endpoint}/*/followers`
  );
  await page.getByTestId('entity-follow-button').click();
  await followResponse;

  await expect(page.getByTestId('entity-follow-button')).toContainText(
    'Unfollow'
  );
};

export const unFollowEntity = async (
  page: Page,
  endpoint: EntityTypeEndpoint
) => {
  await page.waitForLoadState('networkidle');

  const followButton = page.getByTestId('entity-follow-button');

  await followButton.waitFor({ state: 'visible' });

  await expect(followButton).toContainText('Unfollow');

  const unFollowResponse = page.waitForResponse(
    `/api/v1/${endpoint}/*/followers/*`
  );
  await followButton.click();
  await unFollowResponse;

  await expect(page.getByTestId('entity-follow-button')).toContainText(
    'Follow'
  );
};

export const validateFollowedEntityToWidget = async (
  page: Page,
  entity: string,
  isFollowing: boolean
) => {
  await redirectToHomePage(page);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  if (isFollowing) {
    await page.getByTestId('following-widget').isVisible();

    await page.getByTestId(`following-${entity}`).isVisible();
  } else {
    await page.getByTestId('following-widget').isVisible();

    await expect(page.getByTestId(`following-${entity}`)).not.toBeVisible();
  }
};

const announcementForm = async (
  page: Page,
  data: {
    title: string;
    startDate: string;
    endDate: string;
    description: string;
  },
  hideAlert = true
) => {
  await page.fill('#title', data.title);

  await page.click('#startTime');
  await page.fill('#startTime', `${data.startDate}`);
  await page.press('#startTime', 'Enter');

  await page.click('#endTime');
  await page.fill('#endTime', `${data.endDate}`);
  await page.press('#startTime', 'Enter');

  await page.locator(descriptionBox).fill(data.description);

  await page.locator('#announcement-submit').scrollIntoViewIfNeeded();
  const announcementSubmit = page.waitForResponse(
    '/api/v1/feed?entityLink=*type=Announcement*'
  );
  await page.click('#announcement-submit');
  await announcementSubmit;
  await page.click('[data-testid="announcement-close"]');
  if (hideAlert) {
    await page.click('[data-testid="alert-icon-close"]');
  }
};

export const createAnnouncement = async (
  page: Page,
  data: { title: string; description: string },
  hideAlert?: boolean
) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId('announcement-button').click();
  const startDate = customFormatDateTime(getCurrentMillis(), 'yyyy-MM-dd');
  const endDate = customFormatDateTime(
    getEpochMillisForFutureDays(5),
    'yyyy-MM-dd'
  );

  await expect(page.getByTestId('announcement-error')).toContainText(
    'No Announcements, Click on add announcement to add one.'
  );

  await page.getByTestId('add-announcement').click();

  await expect(page.locator('.ant-modal-header')).toContainText(
    'Make an announcement'
  );

  await announcementForm(page, { ...data, startDate, endDate }, hideAlert);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('announcement-card')).toBeVisible();
  await expect(page.getByTestId('announcement-title')).toHaveText(data.title);

  await expect(page.getByTestId('announcement-card')).toContainText(
    data.description
  );
};

export const replyAnnouncement = async (page: Page) => {
  await page.click('[data-testid="announcement-card"]');

  await page.hover(
    '[data-testid="announcement-thread-body"] [data-testid="announcement-card"] [data-testid="main-message"]'
  );

  await page.waitForSelector('.ant-popover', { state: 'visible' });

  await expect(page.getByTestId('add-reply').locator('svg')).toBeVisible();

  await page.getByTestId('add-reply').locator('svg').click();

  await expect(page.locator('.ql-editor')).toBeVisible();

  const sendButtonIsDisabled = await page
    .locator('[data-testid="send-button"]')
    .isEnabled();

  expect(sendButtonIsDisabled).toBe(false);

  await page.fill('[data-testid="editor-wrapper"] .ql-editor', 'Reply message');
  await page.click('[data-testid="send-button"]');

  await expect(
    page.locator('[data-testid="replies"] [data-testid="viewer-container"]')
  ).toHaveText('Reply message');
  await expect(page.locator('[data-testid="show-reply-thread"]')).toHaveText(
    '1 replies'
  );

  await page.hover('[data-testid="replies"] > [data-testid="main-message"]');
  await page.waitForSelector('.ant-popover', { state: 'visible' });
  await page.click('[data-testid="edit-message"]');

  await page.fill(
    '[data-testid="editor-wrapper"] .ql-editor',
    'Reply message edited'
  );

  await page.click('[data-testid="save-button"]');

  await expect(
    page.locator('[data-testid="replies"] [data-testid="viewer-container"]')
  ).toHaveText('Reply message edited');

  await page.reload();
};

export const deleteAnnouncement = async (page: Page) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId('announcement-button').click();

  await page
    .locator(
      '[data-testid="announcement-thread-body"] [data-testid="announcement-card"]'
    )
    .isVisible();

  await page.hover(
    '[data-testid="announcement-thread-body"] [data-testid="announcement-card"] [data-testid="main-message"]'
  );

  await page.waitForSelector('.ant-popover', { state: 'visible' });

  await page.click('[data-testid="delete-message"]');
  const modalText = await page.textContent('.ant-modal-body');

  expect(modalText).toContain(
    'Are you sure you want to permanently delete this message?'
  );

  const getFeed = page.waitForResponse('/api/v1/feed/*');
  await page.click('[data-testid="save-button"]');
  await getFeed;

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByTestId('manage-button').click();
  await page.getByTestId('announcement-button').click();

  await expect(page.getByTestId('announcement-error')).toContainText(
    'No Announcements, Click on add announcement to add one.'
  );
};

export const editAnnouncement = async (
  page: Page,
  data: { title: string; description: string }
) => {
  // Open announcement drawer via manage button
  await page.getByTestId('manage-button').click();
  await page.getByTestId('announcement-button').click();

  // Wait for drawer to open and announcement cards to be visible
  await expect(page.getByTestId('announcement-drawer')).toBeVisible();

  // Target the announcement card specifically inside the drawer
  const drawerAnnouncementCard = page.locator(
    '[data-testid="announcement-drawer"] [data-testid="announcement-thread-body"] [data-testid="announcement-card"] [data-testid="main-message"]'
  );

  await expect(drawerAnnouncementCard).toBeVisible();

  // Hover over the announcement card inside the drawer to show the edit options popover
  await drawerAnnouncementCard.hover();

  // Wait for the popover to become visible
  await page.waitForSelector('.ant-popover', { state: 'visible' });

  // Click the edit message button in the popover
  await page.click('[data-testid="edit-message"]');

  // Wait for the edit announcement modal to open
  await expect(page.locator('.ant-modal-header')).toContainText(
    'Edit an Announcement'
  );

  // Clear and fill the title field
  await page.fill('[data-testid="edit-announcement"] #title', '');
  await page.fill('[data-testid="edit-announcement"] #title', data.title);

  // Clear and fill the description field
  await page
    .locator('[data-testid="edit-announcement"]')
    .locator(descriptionBox)
    .fill('');
  await page
    .locator('[data-testid="edit-announcement"]')
    .locator(descriptionBox)
    .fill(data.description);

  // Save the changes and wait for the API response
  const updateResponse = page.waitForResponse('/api/v1/feed/*');
  await page
    .locator(
      '[data-testid="edit-announcement"] .ant-modal-footer .ant-btn-primary'
    )
    .click();
  await updateResponse;

  // Wait for modal to close
  await expect(
    page.locator('[data-testid="edit-announcement"]')
  ).not.toBeVisible();

  // Verify the changes were applied within the drawer
  await expect(drawerAnnouncementCard).toContainText(data.title);
  await expect(drawerAnnouncementCard).toContainText(data.description);

  // Close the announcement drawer
  await page.locator('[data-testid="announcement-close"]').click();

  await expect(page.getByTestId('announcement-drawer')).not.toBeVisible();
};

export const createInactiveAnnouncement = async (
  page: Page,
  data: { title: string; description: string },
  hideAlert?: boolean
) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId('announcement-button').click();
  const startDate = customFormatDateTime(
    getEpochMillisForFutureDays(6),
    'yyyy-MM-dd'
  );
  const endDate = customFormatDateTime(
    getEpochMillisForFutureDays(11),
    'yyyy-MM-dd'
  );

  await page.getByTestId('add-announcement').click();

  await expect(page.locator('.ant-modal-header')).toContainText(
    'Make an announcement'
  );

  await announcementForm(page, { ...data, startDate, endDate }, hideAlert);
  await page.getByTestId('inActive-announcements').isVisible();
  await page.reload();
};

export const updateDisplayNameForEntity = async (
  page: Page,
  displayName: string,
  endPoint: string,
  isRemoved?: boolean
) => {
  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="rename-button"]');

  const nameInputIsDisabled = await page.locator('#name').isDisabled();
  expect(nameInputIsDisabled).toBe(true);

  await expect(page.locator('#displayName')).toBeVisible();

  await page.locator('#displayName').clear();

  await page.fill('#displayName', displayName);
  const updateNameResponse = page.waitForResponse(`/api/v1/${endPoint}/*`);
  await page.click('[data-testid="save-button"]');
  await updateNameResponse;

  if (isRemoved) {
    await expect(
      page.locator('[data-testid="entity-header-display-name"]')
    ).not.toBeVisible();
  } else {
    await expect(
      page.locator('[data-testid="entity-header-display-name"]')
    ).toHaveText(displayName);
  }
};

export const updateDisplayNameForEntityChildren = async (
  page: Page,
  displayName: { oldDisplayName: string; newDisplayName: string },
  rowId: string,
  rowSelector = 'data-row-key'
) => {
  await page
    .locator(`[${rowSelector}="${rowId}"]`)
    .getByTestId('edit-displayName-button')
    .click();

  const nameInputIsDisabled = await page.locator('#name').isEnabled();

  expect(nameInputIsDisabled).toBe(false);

  await expect(page.locator('#displayName')).toBeVisible();

  expect(await page.locator('#displayName').inputValue()).toBe(
    displayName.oldDisplayName
  );

  await page.locator('#displayName').fill(displayName.newDisplayName);

  const updateRequest = page.waitForResponse(
    (req) =>
      ['PUT', 'PATCH'].includes(req.request().method()) &&
      !req.url().includes('api/v1/analytics/web/events/collect')
  );

  await page.click('[data-testid="save-button"]');
  await updateRequest;

  if (displayName.newDisplayName === '') {
    await expect(
      page
        .locator(`[${rowSelector}="${rowId}"]`)
        .getByTestId('column-display-name')
    ).not.toBeAttached();
  } else {
    await expect(
      page
        .locator(`[${rowSelector}="${rowId}"]`)
        .getByTestId('column-display-name')
    ).toHaveText(displayName.newDisplayName);
  }
};

export const removeDisplayNameForEntityChildren = async (
  page: Page,
  displayName: string,
  rowId: string,
  rowSelector = 'data-row-key'
) => {
  await page
    .locator(`[${rowSelector}="${rowId}"]`)
    .getByTestId('edit-displayName-button')
    .click();

  const nameInputIsDisabled = await page.locator('#name').isEnabled();

  expect(nameInputIsDisabled).toBe(false);

  await expect(page.locator('#displayName')).toBeVisible();

  expect(await page.locator('#displayName').inputValue()).toBe(displayName);

  await page.locator('#displayName').fill('');

  const updateRequest = page.waitForResponse((response) => {
    const method = response.request().method();
    const url = response.url();

    // Check Analytics Api Does Not Intterupt With PUT CAll
    return (
      (method === 'PUT' || method === 'PATCH') &&
      !url.includes('api/v1/analytics/web/events/collect')
    );
  });
  await page.click('[data-testid="save-button"]');
  await updateRequest;

  await expect(
    page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('column-display-name')
  ).not.toBeVisible();
};

export const checkForEditActions = async ({
  page,
  entityType,
  deleted = false,
}: {
  page: Page;
  entityType: string;
  deleted?: boolean;
}) => {
  for (const {
    containerSelector,
    elementSelector,
  } of LIST_OF_FIELDS_TO_EDIT_TO_BE_DISABLED) {
    if (
      elementSelector === '[data-testid="entity-follow-button"]' &&
      ENTITIES_WITHOUT_FOLLOWING_BUTTON.includes(entityType)
    ) {
      continue;
    }

    if (entityType.startsWith('services/')) {
      await page.getByRole('tab').nth(1).click();

      await page.waitForLoadState('networkidle');

      continue;
    }

    if (elementSelector === '[data-testid="entity-follow-button"]') {
      if (deleted) {
        await expect(page.locator(elementSelector)).not.toBeVisible();
      } else {
        await expect(page.locator(elementSelector)).toBeVisible();
      }

      continue;
    }

    const isDisabled = await page
      .locator(`${containerSelector} ${elementSelector}`)
      .isEnabled();

    expect(isDisabled).toBe(!deleted);
  }

  for (const {
    containerSelector,
    elementSelector,
  } of LIST_OF_FIELDS_TO_EDIT_NOT_TO_BE_PRESENT) {
    if (!deleted) {
      await expect(
        page.locator(`${containerSelector} ${elementSelector}`)
      ).toBeVisible();
    } else {
      const exists = await page
        .locator(`${containerSelector} ${elementSelector}`)
        .isVisible();

      expect(exists).toBe(false);
    }
  }
};

export const checkLineageTabActions = async (page: Page, deleted?: boolean) => {
  // Click the lineage tab
  const lineageApi = page.waitForResponse('/api/v1/lineage/getLineage?fqn=*');
  await page.click('[data-testid="lineage"]');

  // Ensure the response has been received and check the status code
  await lineageApi;

  await waitForAllLoadersToDisappear(page);

  // Check the presence or absence of the edit-lineage element based on the deleted flag
  if (deleted) {
    await expect(
      page.locator('[data-testid="edit-lineage"]')
    ).not.toBeVisible();
  } else {
    await expect(page.locator('[data-testid="edit-lineage"]')).toBeVisible();
  }
};

export const checkForTableSpecificFields = async (
  page: Page,
  deleted?: boolean
) => {
  const queryDataUrl = `/api/v1/search/query?q=*index=query_search_index*`;

  const queryApi = page.waitForResponse(queryDataUrl);
  // Click the table queries tab
  await page.click('[data-testid="table_queries"]');

  if (!deleted) {
    await queryApi;
    // Check if the add-query button is enabled
    const addQueryButton = page.locator('[data-testid="add-query-btn"]');

    await expect(addQueryButton).toBeEnabled();
  } else {
    // Check for the no data placeholder message
    const noDataPlaceholder = page
      .getByTestId('no-queries')
      .getByTestId('no-data-placeholder');

    await expect(noDataPlaceholder).toContainText(
      'Queries data is not available for deleted entities.'
    );
  }

  // Click the profiler tab
  await page.click('[data-testid="profiler"]');

  // Check the visibility of profiler buttons based on the deleted flag
  const addTableTestButton = page.locator(
    '[data-testid="profiler-add-table-test-btn"]'
  );
  const settingButton = page.locator('[data-testid="profiler-setting-btn"]');

  if (!deleted) {
    await expect(addTableTestButton).toBeVisible();
    await expect(settingButton).toBeVisible();
  } else {
    await expect(addTableTestButton).not.toBeVisible();
    await expect(settingButton).not.toBeVisible();
  }
};

export const deletedEntityCommonChecks = async ({
  page,
  endPoint,
  deleted,
}: {
  page: Page;
  endPoint: EntityTypeEndpoint;
  deleted?: boolean;
}) => {
  const isTableEntity = endPoint === EntityTypeEndpoint.Table;

  // Check if all the edit actions are available for the entity
  await checkForEditActions({
    page,
    entityType: endPoint,
    deleted,
  });

  if (isTableEntity) {
    await checkLineageTabActions(page, deleted);
  }

  if (isTableEntity) {
    await checkForTableSpecificFields(page, deleted);
  }

  await page.click('[data-testid="manage-button"]');

  if (deleted) {
    // only two menu options (restore and delete) should be present
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="announcement-button"]'
      )
    ).toBeHidden();
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
      )
    ).toBeHidden();
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="profiler-setting-button"]'
      )
    ).toBeHidden();
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="restore-button"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="delete-button"]'
      )
    ).toBeVisible();
  } else {
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="announcement-button"]'
      )
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="rename-button"]'
      )
    ).toBeVisible();

    if (
      [EntityTypeEndpoint.Database, EntityTypeEndpoint.DatabaseSchema].includes(
        endPoint
      )
    ) {
      await expect(
        page.locator(
          '[data-testid="manage-dropdown-list-container"] [data-testid="profiler-setting-button"]'
        )
      ).toBeVisible();
    }

    await expect(
      page.locator(
        '[data-testid="manage-dropdown-list-container"] [data-testid="delete-button"]'
      )
    ).toBeVisible();
  }

  await clickOutside(page);
};

export const restoreEntity = async (page: Page) => {
  await expect(page.locator('[data-testid="deleted-badge"]')).toBeVisible();

  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="restore-button"]');
  await page.click('button:has-text("Restore")');

  await toastNotification(page, /restored successfully/);

  const exists = await page
    .locator('[data-testid="deleted-badge"]')
    .isVisible();

  expect(exists).toBe(false);
};

export const softDeleteEntity = async (
  page: Page,
  entityName: string,
  endPoint: EntityTypeEndpoint,
  displayName: string
) => {
  await deletedEntityCommonChecks({
    page,
    endPoint,
    deleted: false,
  });

  await clickOutside(page);

  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="delete-button"]');

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText(displayName);

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
  const deleteResponse = page.waitForResponse(
    `/api/v1/${endPoint}/async/*?hardDelete=false&recursive=true`
  );
  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;
  await page.waitForLoadState('networkidle');

  await toastNotification(
    page,
    /(deleted successfully!|Delete operation initiated)/,
    BIG_ENTITY_DELETE_TIMEOUT
  );

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  // Retry mechanism for checking deleted badge
  let deletedBadge = page.locator('[data-testid="deleted-badge"]');
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const isVisible = await deletedBadge.isVisible();
    if (isVisible) {
      break;
    }

    attempts++;
    if (attempts < maxAttempts) {
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      deletedBadge = page.locator('[data-testid="deleted-badge"]');
    }
  }

  await expect(deletedBadge).toHaveText('Deleted');

  await deletedEntityCommonChecks({
    page,
    endPoint,
    deleted: true,
  });

  await clickOutside(page);

  if (endPoint === EntityTypeEndpoint.Table) {
    await page.click('[data-testid="breadcrumb-link"]:last-child');
    const deletedTableResponse = page.waitForResponse(
      '/api/v1/tables?*databaseSchema=*'
    );
    await page.click('[data-testid="show-deleted"]');
    await deletedTableResponse;
    const tableCount = page.locator(
      '[data-testid="table"] [data-testid="count"]'
    );

    await expect(tableCount).toContainText('1');

    await page.click(`[data-testid="${entityName}"]`);
  }

  await restoreEntity(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  await deletedEntityCommonChecks({
    page,
    endPoint,
    deleted: false,
  });
};

export const hardDeleteEntity = async (
  page: Page,
  entityName: string,
  endPoint: EntityTypeEndpoint
) => {
  await clickOutside(page);
  await page.click('[data-testid="manage-button"]');
  await page.waitForSelector('[data-testid="delete-button"]');
  await page.click('[data-testid="delete-button"]');

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await expect(
    page.locator('[data-testid="delete-modal"] .ant-modal-title')
  ).toHaveText(new RegExp(entityName));

  await page.click('[data-testid="hard-delete-option"]');
  await page.check('[data-testid="hard-delete"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
  const deleteResponse = page.waitForResponse(
    `/api/v1/${endPoint}/async/*?hardDelete=true&recursive=true`
  );
  await page.click('[data-testid="confirm-button"]');
  await deleteResponse;

  await expect(page.getByTestId('alert-bar')).toHaveText(
    /(deleted successfully!|Delete operation initiated)/,
    { timeout: BIG_ENTITY_DELETE_TIMEOUT }
  );
};

export const checkDataAssetWidget = async (page: Page, serviceType: string) => {
  await clickOutside(page);
  const quickFilterResponse = page.waitForResponse(
    `/api/v1/search/query?q=&index=dataAsset*${serviceType}*`
  );

  await page
    .locator(`[data-testid="data-asset-service-${serviceType}"]`)
    .click();

  await quickFilterResponse;

  await expect(
    page.locator('[data-testid="search-dropdown-Service Type"]')
  ).toContainText(serviceType);

  await expect(
    page
      .getByTestId('explore-tree')
      .locator('span')
      .filter({ hasText: serviceType })
      .first()
  ).toHaveClass(/ant-tree-node-selected/);
};

export const escapeESReservedCharacters = (text?: string) => {
  const reUnescapedHtml = /[\\[\]#+=&|><!(){}^"~*?:/-]/g;
  const reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

  const getReplacedChar = (char: string) => {
    return ES_RESERVED_CHARACTERS[char] ?? char;
  };

  return text && reHasUnescapedHtml.test(text)
    ? text.replace(reUnescapedHtml, getReplacedChar)
    : text ?? '';
};

export const getEncodedFqn = (fqn: string, spaceAsPlus = false) => {
  let uri = encodeURIComponent(fqn);

  if (spaceAsPlus) {
    uri = uri.replaceAll('%20', '+');
  }

  return uri;
};

export const getEntityDisplayName = (entity?: {
  name?: string;
  displayName?: string;
}) => {
  return entity?.displayName || entity?.name || '';
};

/**
 *
 * @param description HTML string
 * @returns Text from HTML string
 */
export const getTextFromHtmlString = (description?: string): string => {
  if (!description) {
    return '';
  }

  const dom = new JSDOM(description);

  return dom.window.document.body.textContent?.trim() ?? '';
};

export const getFirstRowColumnLink = (page: Page) => {
  return page
    .getByTestId('databaseSchema-tables')
    .locator('[data-testid="column-name"] a')
    .first();
};

export const generateEntityChildren = (entityName: string, count = 25) => {
  return Array.from({ length: count }, (_, i) => {
    const id = uuid();

    return {
      name: `pw-${entityName}-${i + 1}-${id}`,
      displayName: `pw-${entityName}-${i + 1}-${id}`,
    };
  });
};

export const checkItemNotExistsInQuickFilter = async (
  page: Page,
  filterLabel: string,
  filterValue: string
) => {
  await sidebarClick(page, SidebarItem.EXPLORE);
  await page.waitForLoadState('networkidle');
  await page.click(`[data-testid="search-dropdown-${filterLabel}"]`);
  const testId = filterValue.toLowerCase();

  // testId should not be present
  await expect(page.getByTestId(testId)).toBeHidden();

  await clickOutside(page);
};

export const checkExploreSearchFilter = async (
  page: Page,
  filterLabel: string,
  filterKey: string,
  filterValue: string,
  entity?: EntityClass
) => {
  await sidebarClick(page, SidebarItem.EXPLORE);
  if (filterKey === 'tier.tagFQN') {
    const tierList = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=tier.tagFQN**`
    );
    await page.click(`[data-testid="search-dropdown-${filterLabel}"]`);
    await tierList;
  } else {
    await page.click(`[data-testid="search-dropdown-${filterLabel}"]`);
  }
  await searchAndClickOnOption(
    page,
    {
      label: filterLabel,
      key: filterKey,
      value: filterValue,
    },
    true
  );

  const rawFilterValue = (filterValue ?? '').replace(/ /g, '+').toLowerCase();

  // Escape double quotes before encoding
  const escapedValue = rawFilterValue.replace(/"/g, '\\"');

  const filterValueForSearchURL =
    filterKey === 'tier.tagFQN'
      ? filterValue
      : /["%]/.test(filterValue ?? '')
      ? escapedValue
      : rawFilterValue;

  // Use a predicate to check the response URL contains the correct filter
  const queryRes = page.waitForResponse(
    (response) => {
      const url = response.url();
      if (
        !url.includes('/api/v1/search/query') ||
        !url.includes('index=dataAsset')
      ) {
        return false;
      }

      // Check if the URL contains the filterKey in query_filter
      const urlObj = new URL(url);
      const queryFilter = urlObj.searchParams.get('query_filter');

      if (!queryFilter) {
        return false;
      }

      try {
        const filterObj = JSON.parse(queryFilter);
        const filterStr = JSON.stringify(filterObj);

        // Check if the filter contains both the filterKey and filterValue
        return (
          filterStr.includes(filterKey) &&
          filterStr.includes(filterValueForSearchURL)
        );
      } catch {
        // Fallback to simple string match if JSON parse fails
        return (
          queryFilter.includes(filterKey) &&
          queryFilter.includes(filterValueForSearchURL)
        );
      }
    },
    { timeout: 30_000 }
  );

  await page.click('[data-testid="update-btn"]');
  await queryRes;
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId(
      `table-data-card_${
        (entity as TableClass)?.entityResponseData?.fullyQualifiedName
      }`
    )
  ).toBeVisible();

  await page.click('[data-testid="clear-filters"]');

  await entity?.visitEntityPage(page);
};

export const getEntityDataTypeDisplayPatch = (entity: EntityClass) => {
  switch (entity.getType()) {
    case 'Table':
    case 'DashboardDataModel':
      return '/columns/0/dataTypeDisplay';
    case 'ApiEndpoint':
      return '/requestSchema/schemaFields/0/dataTypeDisplay';
    case 'Topic':
      return '/messageSchema/schemaFields/0/dataTypeDisplay';
    case 'Container':
      return '/dataModel/columns/0/dataTypeDisplay';
    case 'SearchIndex':
      return '/fields/0/dataTypeDisplay';

    default:
      return undefined;
  }
};
/**
 * Test utility for verifying copy link button functionality across different entity types.
 * Follows Playwright Developer Handbook guidelines for user-centric testing.
 *
 * This function tests the copy link feature by:
 * 1. Clicking the copy button
 * 2. Reading clipboard content via navigator.clipboard API
 * 3. Verifying the clipboard URL contains expected values
 *
 * Note: This requires the test to run in a secure context (HTTPS or localhost)
 *
 * @param page - Playwright Page object
 * @param buttonTestId - Test ID of the copy button ('copy-column-link-button' or 'copy-field-link-button')
 * @param containerTestId - Test ID of the container element to wait for
 * @param expectedUrlPath - Expected URL path segment (e.g., '/table/', '/container/')
 * @param entityFqn - Fully qualified name of the entity to verify in clipboard
 */
export const testCopyLinkButton = async ({
  page,
  buttonTestId,
  containerTestId,
  expectedUrlPath,
  entityFqn,
}: {
  page: Page;
  buttonTestId: 'copy-column-link-button' | 'copy-field-link-button';
  containerTestId: string;
  expectedUrlPath: string;
  entityFqn: string;
}) => {
  await expect(page.getByTestId(containerTestId)).toBeVisible();

  // Find the first copy button and verify it's visible
  const copyButton = page.getByTestId(buttonTestId).first();
  await expect(copyButton).toBeVisible();

  // Click copy button and get clipboard text
  const clipboardText = await copyAndGetClipboardText(page, copyButton);

  // Verify the clipboard text contains expected URL path and entity FQN
  expect(clipboardText).toContain(expectedUrlPath);
  expect(clipboardText).toContain(entityFqn);
};

/**
 * Clicks a copy button and returns the copied text from clipboard.
 * Handles clipboard interception internally - works across all environments.
 *
 * @param page - Playwright Page object
 * @param locator - Locator for the copy button to click
 * @returns The clipboard text content
 */
export const copyAndGetClipboardText = async (
  page: Page,
  locator: Locator
): Promise<string> => {
  // Hover and click the copy button
  await locator.hover();
  await locator.click({ force: true });

  // Small delay to allow clipboard write to complete
  await page.waitForTimeout(300);

  // Read clipboard using paste method (works reliably in all environments)
  const textareaId = '__clipboard_reader__';

  await page.evaluate((id) => {
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(textarea);
  }, textareaId);

  await page.locator(`#${textareaId}`).focus();
  await page.keyboard.press('ControlOrMeta+V');

  const clipboardText = await page.locator(`#${textareaId}`).inputValue();

  await page.evaluate((id) => {
    document.getElementById(id)?.remove();
  }, textareaId);

  return clipboardText;
};

/**
 * Validates the format and structure of a copied link URL.
 * Ensures URLs are properly formatted, contain all required components, and follow expected patterns.
 *
 * @param clipboardText - The text copied to clipboard
 * @param expectedEntityType - Expected entity type in URL (e.g., 'table', 'topic', 'container')
 * @param entityFqn - Fully qualified name of the entity
 * @param options - Optional validation options
 * @returns Validation result with details
 */
export const validateCopiedLinkFormat = ({
  clipboardText,
  expectedEntityType,
  entityFqn,
  options = {},
}: {
  clipboardText: string;
  expectedEntityType: string;
  entityFqn: string;
  options?: {
    allowedProtocols?: string[]; // Allowed protocols (default: ['http:', 'https:'])
  };
}) => {
  const { allowedProtocols = ['http:', 'https:'] } = options;

  // Parse the URL
  let url: URL;
  try {
    url = new URL(clipboardText);
  } catch (error) {
    throw new Error(`Invalid URL format: ${clipboardText}. Error: ${error}`);
  }

  // Validate protocol
  expect(allowedProtocols).toContain(url.protocol);

  // Validate hostname exists
  expect(url.hostname).toBeTruthy();

  // Validate path structure: should contain /{entityType}/{fqn}
  const pathPattern = new RegExp(`^/${expectedEntityType}/`);
  expect(url.pathname).toMatch(pathPattern);

  // Validate FQN is in the path
  expect(url.pathname).toContain(entityFqn);

  // Return parsed URL for additional assertions if needed
  return {
    url,
    protocol: url.protocol,
    hostname: url.hostname,
    pathname: url.pathname,
    fragment: url.hash,
    isValid: true,
  };
};
