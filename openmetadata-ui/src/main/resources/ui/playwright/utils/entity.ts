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
import { expect, Page } from '@playwright/test';
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
import {
  clickOutside,
  descriptionBox,
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

export const visitEntityPage = async (data: {
  page: Page;
  searchTerm: string;
  dataTestId: string;
}) => {
  const { page, searchTerm, dataTestId } = data;
  const waitForSearchResponse = page.waitForResponse(
    '/api/v1/search/query?q=*index=dataAsset*'
  );
  await page.waitForLoadState('networkidle');
  await page.getByTestId('searchBox').fill(searchTerm);
  await waitForSearchResponse;
  await page.getByTestId(dataTestId).getByTestId('data-name').click();
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
      '/api/v1/search/query?q=*isBot:false*index=user_search_index*'
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
    await page.getByRole('listitem', { name: owner, exact: true }).click();

    const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
    await page.getByTestId('selectable-list-update-btn').click();
    await patchRequest;
  }

  await expect(
    page.getByTestId(dataTestId ?? 'owner-link').getByTestId(`${owner}`)
  ).toBeVisible();
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

  await expect(
    page.getByTestId(dataTestId ?? 'owner-link').getByTestId(ownerName)
  ).not.toBeVisible();
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
  const owners = isMultipleOwners ? ownerNames : [ownerNames];

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

  if (clearAll && isMultipleOwners) {
    await page.click('[data-testid="clear-all-button"]');
  }

  for (const ownerName of owners) {
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
    const updateButton = page.getByTestId('selectable-list-update-btn');

    if (isSelectableInsideForm) {
      await updateButton.click();
    } else {
      const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
      await updateButton.click();
      await patchRequest;
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
  endpoint: string
) => {
  await page.getByTestId('edit-tier').click();
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  const patchRequest = page.waitForResponse(`/api/v1/${endpoint}/*`);
  await page.getByTestId(`radio-btn-${tier}`).click();
  await patchRequest;
  await clickOutside(page);

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
  await patchRequest;
  await clickOutside(page);

  await expect(page.getByTestId('Tier')).toContainText('No Tier');
};

export const updateDescription = async (
  page: Page,
  description: string,
  isModal = false
) => {
  await page.getByTestId('edit-description').click();
  await page.locator(descriptionBox).first().click();
  await page.locator(descriptionBox).first().clear();
  await page.locator(descriptionBox).first().fill(description);
  await page.getByTestId('save').click();

  if (isModal) {
    await page.waitForSelector('[role="dialog"].description-markdown-editor', {
      state: 'hidden',
    });
  }

  isEmpty(description)
    ? await expect(
        page.getByTestId('asset-description-container')
      ).toContainText('No description')
    : await expect(
        page.getByTestId('asset-description-container').getByRole('paragraph')
      ).toContainText(description);
};

export const assignTag = async (
  page: Page,
  tag: string,
  action: 'Add' | 'Edit' = 'Add',
  parentId = 'KnowledgePanel.Tags'
) => {
  await page
    .getByTestId(parentId)
    .getByTestId('tags-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  const searchTags = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );
  await page.locator('#tagsForm_tags').fill(tag);
  await searchTags;
  await page.getByTestId(`tag-${tag}`).click();

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await expect(page.getByTestId('saveAssociatedTag')).not.toBeVisible();

  await expect(
    page
      .getByTestId(parentId)
      .getByTestId('tags-container')
      .getByTestId(`tag-${tag}`)
  ).toBeVisible();
};

export const assignTagToChildren = async ({
  page,
  tag,
  rowId,
  action = 'Add',
  rowSelector = 'data-row-key',
}: {
  page: Page;
  tag: string;
  rowId: string;
  action?: 'Add' | 'Edit';
  rowSelector?: string;
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
}: {
  page: Page;
  tags: string[];
  rowId: string;
  rowSelector?: string;
}) => {
  for (const tag of tags) {
    await page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('tags-container')
      .getByTestId('edit-button')
      .click();

    await page
      .getByTestId('tag-selector')
      .getByTestId(`selected-tag-${tag}`)
      .getByTestId('remove-tags')
      .click();

    const patchTagRequest = page.waitForResponse(
      (response) => response.request().method() === 'PATCH'
    );

    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();

    await patchTagRequest;

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
  action: 'Add' | 'Edit' = 'Add'
) => {
  await page
    .getByTestId('KnowledgePanel.GlossaryTerms')
    .getByTestId('glossary-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  const searchGlossaryTerm = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(glossaryTerm.displayName)}*`
  );

  await page.locator('#tagsForm_tags').fill(glossaryTerm.displayName);
  await searchGlossaryTerm;
  await page.getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`).click();

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await expect(page.getByTestId('saveAssociatedTag')).not.toBeVisible();

  await expect(
    page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`)
  ).toBeVisible();
};

export const assignGlossaryTermToChildren = async ({
  page,
  glossaryTerm,
  action = 'Add',
  rowId,
  rowSelector = 'data-row-key',
}: {
  page: Page;
  glossaryTerm: GlossaryTermOption;
  rowId: string;
  action?: 'Add' | 'Edit';
  rowSelector?: string;
}) => {
  await page
    .locator(`[${rowSelector}="${rowId}"]`)
    .getByTestId('glossary-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  const searchGlossaryTerm = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(glossaryTerm.displayName)}*`
  );
  await page.locator('#tagsForm_tags').fill(glossaryTerm.displayName);
  await searchGlossaryTerm;
  await page.getByTestId(`tag-${glossaryTerm.fullyQualifiedName}`).click();

  const patchRequest = page.waitForResponse(
    (response) => response.request().method() === 'PATCH'
  );

  await page.waitForSelector(
    '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
    { state: 'visible' }
  );

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await expect(page.getByTestId('saveAssociatedTag')).not.toBeVisible();

  await patchRequest;

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

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();
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
  rowSelector = 'data-row-key',
}: {
  page: Page;
  glossaryTerms: GlossaryTermOption[];
  rowId: string;
  rowSelector?: string;
}) => {
  for (const tag of glossaryTerms) {
    await page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('glossary-container')
      .getByTestId('edit-button')
      .click();

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
  const unFollowResponse = page.waitForResponse(
    `/api/v1/${endpoint}/*/followers/*`
  );
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await page.getByTestId('entity-follow-button').click();
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
  }
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
  await page.click('#announcement-submit');
};

export const createAnnouncement = async (
  page: Page,
  data: { title: string; description: string },
  isForActivityFeedTab: boolean
) => {
  if (isForActivityFeedTab) {
    const activityFeedSelector = page.locator(
      'div[role="tab"][id^="rc-tabs-"][id$="-activity_feed"]'
    );
    await activityFeedSelector.click(); // For Activity Feed
    await page.getByTestId('announcement-sub-tab').click();
  } else {
    await page.getByText('Announcements').click(); // For Service page
  }

  await expect(page.getByTestId('no-data-placeholder-container')).toContainText(
    'No Announcements, Click on add announcement to add one.'
  );

  await page.getByTestId('add-announcement-btn').click();
  const startDate = customFormatDateTime(getCurrentMillis(), 'yyyy-MM-dd');
  const endDate = customFormatDateTime(
    getEpochMillisForFutureDays(5),
    'yyyy-MM-dd'
  );

  await expect(page.locator('.ant-modal-header')).toContainText(
    'Make an announcement'
  );

  await announcementForm(page, { ...data, startDate, endDate });
  await page.reload();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await page.getByTestId('announcement-card').isVisible();

  await expect(page.getByTestId('announcement-title')).toHaveText(data.title);


  // TODO: Review redirection flow for announcement @Ashish8689
  // await redirectToHomePage(page);

  // await page
  //   .getByTestId('announcement-container')
  //   .getByTestId(`announcement-${entityFqn}`)
  //   .locator(`[data-testid="entity-link"] span`)
  //   .first()
  //   .scrollIntoViewIfNeeded();

  // await page
  //   .getByTestId('announcement-container')
  //   .getByTestId(`announcement-${entityFqn}`)
  //   .locator(`[data-testid="entity-link"] span`)
  //   .first()
  //   .click();

  // await page.getByTestId('announcement-card').isVisible();

  // await expect(page.getByTestId('announcement-card')).toContainText(data.title);
};

export const replyAnnouncement = async (page: Page) => {
  await page.click('[data-testid="activity-feed-card-v2"]');

  await expect(page.locator('.comments-input-field')).toBeVisible();

  await page.locator('.comments-input-field').scrollIntoViewIfNeeded();
  await page.locator('.comments-input-field').click();

  await expect(page.locator('.ql-editor')).toBeVisible();

  const sendButtonIsDisabled = await page
    .locator('[data-testid="send-button"]')
    .isEnabled();

  expect(sendButtonIsDisabled).toBe(false);

  await page.fill('[data-testid="editor-wrapper"] .ql-editor', 'Reply message');
  await page.click('[data-testid="send-button"]');

  const feedDataCard = page
    .locator('#feedData')
    .getByTestId('activity-feed-card-v2');

  await expect(feedDataCard).toContainText('1 Reply');

  // Edit the reply message
  await page.hover('[data-testid="feed-replies"]');
  await page.click('[data-testid="edit-message"]');

  await page.fill(
    '[data-testid="editor-wrapper"] .ql-editor',
    'Reply message edited'
  );

  await page.click('[data-testid="send-button"]');

  await expect(
    page.locator(
      '#feed-panel [data-testid="feed-replies"] [data-testid="viewer-container"]'
    )
  ).toHaveText('Reply message edited');
};

export const deleteAnnouncement = async (page: Page) => {
  const feedcard = page.locator('#feedData').getByTestId('feedcardbodyV1');
  await feedcard.waitFor({ state: 'visible' });
  await feedcard.hover();

  await page.click('[data-testid="delete-message"]');
  const modalText = await page.textContent('.ant-modal-body');

  expect(modalText).toContain(
    'Are you sure you want to permanently delete this message?'
  );

  const getFeed = page.waitForResponse('/api/v1/feed/*');
  await page.click('[data-testid="save-button"]');
  await getFeed;
};

export const createInactiveAnnouncement = async (
  page: Page,
  data: { title: string; description: string },
  isForActivityFeedTab: boolean
) => {
  if (isForActivityFeedTab) {
    const activityFeedSelector = page.locator(
      'div[role="tab"][id^="rc-tabs-"][id$="-activity_feed"]'
    );
    await activityFeedSelector.click(); // For Activity Feed
    await page.getByTestId('announcement-sub-tab').click();
  } else {
    await page.getByText('Announcements').click(); // For Service page
  }

  await expect(page.getByTestId('no-data-placeholder-container')).toContainText(
    'No Announcements, Click on add announcement to add one.'
  );

  await page.getByTestId('add-announcement-btn').click();
  const startDate = customFormatDateTime(
    getEpochMillisForFutureDays(6),
    'yyyy-MM-dd'
  );
  const endDate = customFormatDateTime(
    getEpochMillisForFutureDays(11),
    'yyyy-MM-dd'
  );

  await expect(page.locator('.ant-modal-header')).toContainText(
    'Make an announcement'
  );

  await announcementForm(page, { ...data, startDate, endDate });

  await page.reload();
  await page.getByTestId('announcement-filter-icon').click();
  const inactiveAnnouncementsOption = page.getByTestId(
    'inactive-announcements'
  );

  await inactiveAnnouncementsOption.click();

  const feedDataCard = page
    .locator('#feedData')
    .getByTestId('activity-feed-card-v2');

  await expect(feedDataCard).toContainText(data.title);
};

export const updateDisplayNameForEntity = async (
  page: Page,
  displayName: string,
  endPoint: string
) => {
  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="rename-button"]');

  const nameInputIsDisabled = await page.locator('#name').isEnabled();

  expect(nameInputIsDisabled).toBe(false);

  await expect(page.locator('#displayName')).toBeVisible();

  await page.locator('#displayName').clear();

  await page.fill('#displayName', displayName);
  const updateNameResponse = page.waitForResponse(`/api/v1/${endPoint}/*`);
  await page.click('[data-testid="save-button"]');
  await updateNameResponse;

  await expect(
    page.locator('[data-testid="entity-header-display-name"]')
  ).toHaveText(displayName);
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
      deleted
        ? await expect(page.locator(elementSelector)).not.toBeVisible()
        : await expect(page.locator(elementSelector)).toBeVisible();

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
  await page.waitForLoadState('networkidle');
  await toastNotification(
    page,
    /(deleted successfully!|Delete operation initiated)/,
    BIG_ENTITY_DELETE_TIMEOUT
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

  return description.replace(/<[^>]*>/g, '').trim();
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

export const checkExploreSearchFilter = async (
  page: Page,
  filterLabel: string,
  filterKey: string,
  filterValue: string,
  entity?: EntityClass
) => {
  await sidebarClick(page, SidebarItem.EXPLORE);
  await page.click(`[data-testid="search-dropdown-${filterLabel}"]`);
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
      ? encodeURIComponent(escapedValue)
      : rawFilterValue;

  const querySearchURL = `/api/v1/search/query?*index=dataAsset*query_filter=*should*${filterKey}*${filterValueForSearchURL}*`;

  const queryRes = page.waitForResponse(querySearchURL);
  await page.click('[data-testid="update-btn"]');
  await queryRes;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(
    page.getByTestId(
      `table-data-card_${entity?.entityResponseData?.fullyQualifiedName}`
    )
  ).toBeVisible();

  await page.click('[data-testid="clear-filters"]');

  await entity?.visitEntityPage(page);
};
