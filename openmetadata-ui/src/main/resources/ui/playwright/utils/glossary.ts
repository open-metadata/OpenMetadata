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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { get, isUndefined } from 'lodash';
import { SidebarItem } from '../constant/sidebar';
import { GLOSSARY_TERM_PATCH_PAYLOAD } from '../constant/version';
import { PolicyClass } from '../support/access-control/PoliciesClass';
import { RolesClass } from '../support/access-control/RolesClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { Glossary } from '../support/glossary/Glossary';
import {
  GlossaryData,
  GlossaryTermData,
  UserTeamRef,
} from '../support/glossary/Glossary.interface';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../support/tag/ClassificationClass';
import { TagClass } from '../support/tag/TagClass';
import { TeamClass } from '../support/team/TeamClass';
import { UserClass } from '../support/user/UserClass';
import {
  clickOutside,
  closeFirstPopupAlert,
  descriptionBox,
  getApiContext,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  redirectToHomePage,
  toastNotification,
  uuid,
} from './common';
import { addMultiOwner } from './entity';
import { sidebarClick } from './sidebar';
import { TaskDetails, TASK_OPEN_FETCH_LINK } from './task';

type TaskEntity = {
  entityRef: {
    name: string;
  };
};

const GLOSSARY_NAME_VALIDATION_ERROR = 'Name size must be between 1 and 128';

export const checkName = async (page: Page, name: string) => {
  await expect(page.getByTestId('entity-header-name')).toHaveText(name);
};

export const selectActiveGlossary = async (
  page: Page,
  glossaryName: string,
  bWaitForResponse = true
) => {
  const menuItem = page.getByRole('menuitem', { name: glossaryName });
  const isSelected = await menuItem.evaluate((element) => {
    return element.classList.contains('ant-menu-item-selected');
  });
  if (!isSelected) {
    if (bWaitForResponse) {
      const glossaryResponse = page.waitForResponse('/api/v1/glossaryTerms*');
      await menuItem.click();
      await glossaryResponse;
    } else {
      await menuItem.click();
    }
  } else {
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  }
};

export const selectActiveGlossaryTerm = async (
  page: Page,
  glossaryTermName: string
) => {
  await page.getByTestId(glossaryTermName).click();

  await expect(
    page.locator('[data-testid="entity-header-display-name"]')
  ).toContainText(glossaryTermName);
};

export const goToAssetsTab = async (
  page: Page,
  displayName: string,
  count = 0
) => {
  await selectActiveGlossaryTerm(page, displayName);
  await page.getByTestId('assets').click();
  await page.waitForSelector('.ant-tabs-tab-active:has-text("Assets")');

  await expect(
    page.getByTestId('assets').getByTestId('filter-count')
  ).toContainText(`${count}`);
};

export const removeReviewer = async (
  page: Page,
  endpoint: EntityTypeEndpoint
) => {
  const patchResponse = page.waitForResponse(`/api/v1/${endpoint}/*`);

  await page.click('[data-testid="edit-reviewer-button"]');

  await page.click('[data-testid="clear-all-button"]');

  await page.click('[data-testid="selectable-list-update-btn"]');

  await patchResponse;

  await expect(
    page.locator('[data-testid="glossary-reviewer"] [data-testid="Add"]')
  ).toBeVisible();
};

// Create a glossary and two glossary terms, then link them with a related term relationship
export const setupGlossaryAndTerms = async (page: Page) => {
  const glossary = new Glossary();
  const term1 = new GlossaryTerm(glossary);
  const term2 = new GlossaryTerm(glossary);

  // Get API context for performing operations
  const { apiContext, afterAction } = await getApiContext(page);

  // Create glossary and terms
  await glossary.create(apiContext);
  await term1.create(apiContext);
  await term2.create(apiContext);

  // Prepare the payload for linking term2 as a related term to term1
  const relatedTermLink = {
    op: 'add',
    path: '/relatedTerms/0',
    value: {
      id: term1.responseData.id,
      type: 'glossaryTerm',
      displayName: term1.responseData.displayName,
      name: term1.responseData.name,
    },
  };

  // Update term2 to include term1 as a related term
  await term2.patch(apiContext, [
    ...GLOSSARY_TERM_PATCH_PAYLOAD,
    relatedTermLink,
  ]);

  const cleanup = async () => {
    await glossary.delete(apiContext);
    await afterAction();
  };

  return { glossary, term1, term2, cleanup };
};

export const validateForm = async (page: Page) => {
  // Error messages
  await expect(page.locator('#name_help')).toHaveText('Name is required');
  await expect(page.locator('#description_help')).toHaveText(
    'Description is required'
  );

  // Max length validation
  await page.getByTestId('name').fill(INVALID_NAMES.MAX_LENGTH);

  await expect(page.locator('#name_help')).toHaveText(
    NAME_MAX_LENGTH_VALIDATION_ERROR
  );

  // With special char validation
  await page.locator('[data-testid="name"]').clear();
  await page.getByTestId('name').fill(INVALID_NAMES.WITH_SPECIAL_CHARS);

  await expect(page.locator('#name_help')).toHaveText(NAME_VALIDATION_ERROR);
};

export const addTeamAsReviewer = async (
  page: Page,
  teamName: string,
  activatorBtnDataTestId: string,
  dataTestId?: string,
  isSelectableInsideForm = false
) => {
  const teamsResponse = page.waitForResponse(
    '/api/v1/search/query?q=*&from=0&size=*&index=team_search_index&deleted=false&sort_field=displayName.keyword&sort_order=asc'
  );

  const teamsSearchResponse = page.waitForResponse(
    `api/v1/search/query?q=*${encodeURI(teamName)}*`
  );

  await page.click(`[data-testid="${activatorBtnDataTestId}"]`);

  await expect(page.locator("[data-testid='select-owner-tabs']")).toBeVisible();

  await teamsResponse;

  await page.fill('[data-testid="owner-select-teams-search-bar"]', teamName);
  await teamsSearchResponse;

  const ownerItem = page.locator(`.ant-popover [title="${teamName}"]`);

  if (isSelectableInsideForm) {
    await ownerItem.click();
  } else {
    const patchRequest = page.waitForRequest(
      (request) => request.method() === 'PATCH'
    );
    await ownerItem.click();
    await patchRequest;
  }

  await expect(
    page.locator(`[data-testid=${dataTestId ?? 'owner-link'}]`)
  ).toContainText(teamName);
};

export const createGlossary = async (
  page: Page,
  glossaryData: GlossaryData,
  bValidateForm: boolean
) => {
  // Click on the "Add Glossary" button
  await page.click('[data-testid="add-glossary"]');

  // Validate redirection to the add glossary page
  await page.waitForSelector('[data-testid="form-heading"]');

  await expect(page.locator('[data-testid="form-heading"]')).toHaveText(
    'Add Glossary'
  );

  // Perform glossary creation steps
  await page.click('[data-testid="save-glossary"]');

  if (bValidateForm) {
    await validateForm(page);
  }

  await page.fill('[data-testid="name"]', glossaryData.name);

  await page.locator(descriptionBox).fill(glossaryData.description);

  await expect(
    page.locator('[data-testid="form-item-alert"]')
  ).not.toBeVisible();

  if (glossaryData.mutuallyExclusive) {
    await page.click('[data-testid="mutually-exclusive-button"]');

    await expect(page.locator('[data-testid="form-item-alert"]')).toBeVisible();
  }

  if (glossaryData.tags && glossaryData.tags.length > 0) {
    const tagsResponse = page.waitForResponse('/api/v1/search/query');

    // Add tag
    await page.click('[data-testid="tag-selector"]');
    await page.fill(
      '[data-testid="tag-selector"] input[type="search"]',
      glossaryData.tags[0]
    );
    await tagsResponse;
    await page.click(`[data-testid="tag-${glossaryData.tags[0]}"]`);
    await page.click('[data-testid="right-panel"]');
  }

  if (glossaryData.reviewers.length > 0) {
    // Add reviewer
    if (glossaryData.reviewers[0].type === 'user') {
      await addMultiOwner({
        page,
        ownerNames: glossaryData.reviewers.map((reviewer) => reviewer.name),
        activatorBtnDataTestId: 'add-reviewers',
        resultTestId: 'reviewers-container',
        endpoint: EntityTypeEndpoint.Glossary,
        isSelectableInsideForm: true,
        type: 'Users',
      });
    } else {
      await addTeamAsReviewer(
        page,
        glossaryData.reviewers[0].name,
        'add-reviewers',
        'reviewers-container',
        true
      );
    }
  }

  const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
  await page.click('[data-testid="save-glossary"]');
  await glossaryResponse;

  await expect(page).toHaveURL(/\/glossary\//);

  await checkName(page, glossaryData.name);
};

export const verifyGlossaryDetails = async (
  page: Page,
  glossaryDetails: GlossaryData
) => {
  await page
    .getByRole('menuitem', { name: glossaryDetails.name })
    .locator('span')
    .click();

  await checkName(page, glossaryDetails.name);

  const viewerContainerText = await page.textContent(
    '[data-testid="viewer-container"]'
  );

  expect(viewerContainerText).toContain(glossaryDetails.description);

  // Owner
  if (glossaryDetails.owners.length > 0) {
    for (const owner of glossaryDetails.owners) {
      await expect(
        page
          .getByTestId('glossary-right-panel-owner-link')
          .getByTestId('owner-label')
      ).toContainText(owner.name);
    }
  }

  // Reviewer
  if (glossaryDetails.reviewers.length > 0) {
    for (const reviewer of glossaryDetails.reviewers) {
      await expect(
        page.getByTestId('glossary-reviewer').getByTestId('owner-link')
      ).toContainText(reviewer.name);
    }
  }

  // Tags
  if (glossaryDetails.tags && glossaryDetails.tags.length > 0) {
    const tagVisibility = await page.isVisible(
      `[data-testid="tag-${glossaryDetails.tags[0]}"]`
    );

    await expect(tagVisibility).toBe(true);
  }
};

export const deleteGlossary = async (page: Page, glossary: GlossaryData) => {
  await page
    .getByRole('menuitem', { name: glossary.displayName })
    .locator('span')
    .click();

  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="delete-button"]');

  await page.waitForSelector('[data-testid="delete-confirmation-modal"]');

  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="modal-header"]')).toBeVisible();

  await expect(page.locator('[data-testid="modal-header"]')).toContainText(
    glossary.displayName
  );

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteGlossary = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaries/') &&
      response.request().method() === 'DELETE' &&
      response.status() === 200
  );

  await page.click('[data-testid="confirm-button"]');

  // Wait for the API response and verify the status code
  await deleteGlossary;

  // Display toast notification
  await expect(page.locator('.toast-notification')).toHaveText(
    '"Glossary" deleted successfully!'
  );
};

export const fillGlossaryTermDetails = async (
  page: Page,
  term: GlossaryTermData,
  validateCreateForm = true,
  isGlossaryTerm = false
) => {
  // Safety check to close potential glossary not found alert
  // Arrived due to parallel testing
  await closeFirstPopupAlert(page);

  if (isGlossaryTerm) {
    await page.click('[data-testid="add-placeholder-button"]');
  } else {
    await page.click('[data-testid="add-new-tag-button-header"]');
  }

  await page.waitForSelector('[role="dialog"].edit-glossary-modal');

  await expect(
    page.locator('[role="dialog"].edit-glossary-modal')
  ).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText(
    'Add Glossary Term'
  );

  // Validation should work
  await page.click('[data-testid="save-glossary-term"]');

  if (validateCreateForm) {
    await validateForm(page);
  }

  await expect(page.locator('[data-testid="name"]')).toBeVisible();

  await page.locator('[data-testid="name"]').fill(term.name);

  await expect(page.locator(descriptionBox)).toBeVisible();

  await page.locator(descriptionBox).fill(term.description);

  const synonyms = (term.synonyms ?? '').split(',');

  await expect(page.locator('[data-testid="synonyms"]')).toBeVisible();

  for (const synonym of synonyms) {
    if (synonym === '') {
      continue;
    }
    await page
      .locator('[data-testid="synonyms"] input[type="search"]')
      .fill(`${synonym}`);
    await page
      .locator('[data-testid="synonyms"] input[type="search"]')
      .press('Enter');
  }

  await expect(
    page.locator('[data-testid="form-item-alert"]')
  ).not.toBeVisible();

  if (term.mutuallyExclusive) {
    await page.click('[data-testid="mutually-exclusive-button"]');

    await expect(page.locator('[data-testid="form-item-alert"]')).toBeVisible();
  }

  await expect(page.locator('[data-testid="add-reference"]')).toBeVisible();

  await page.click('[data-testid="add-reference"]');

  await expect(page.locator('#name-0')).toBeVisible();

  await page.locator('#name-0').fill('test');

  await expect(page.locator('#url-0')).toBeVisible();

  await page.locator('#url-0').fill('https://test.com');

  if (term.icon) {
    await page.locator('[data-testid="icon-url"]').fill(term.icon);
  }

  if (term.color) {
    await page.locator('[data-testid="color-color-input"]').fill(term.color);
  }

  if (!isUndefined(term.owners)) {
    await addMultiOwner({
      page,
      ownerNames: term.owners.map((owner) => owner.name),
      activatorBtnDataTestId: 'add-owner',
      resultTestId: 'owner-container',
      endpoint: EntityTypeEndpoint.GlossaryTerm,
      isSelectableInsideForm: true,
      type: 'Users',
    });
  }
};

export const verifyTaskCreated = async (
  page: Page,
  glossaryFqn: string,
  glossaryTermData: string
) => {
  const { apiContext } = await getApiContext(page);
  const entityLink = encodeURIComponent(`<#E::glossary::${glossaryFqn}>`);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(
            `/api/v1/feed?entityLink=${entityLink}&type=Task&taskStatus=Open`
          )
          .then((res) => res.json());

        const arr = response.data.map(
          (item: TaskEntity) => item.entityRef.name
        );

        return arr;
      },
      {
        // Custom expect message for reporting, optional.
        message: 'To get the last run execution status as success',
        timeout: 350_000,
        intervals: [40_000, 30_000],
      }
    )
    .toContain(glossaryTermData);
};

export const validateGlossaryTermTask = async (
  page: Page,
  term: GlossaryTermData
) => {
  await page.click('[data-testid="activity_feed"]');

  const taskFeeds = page.waitForResponse(TASK_OPEN_FETCH_LINK);
  await page
    .getByTestId('global-setting-left-panel')
    .getByText('Tasks')
    .click();

  await taskFeeds;

  const taskFeedCards = page.locator('[data-testid="task-feed-card"]');

  // Filter to find the specific card that contains the text
  const cardWithText = taskFeedCards.filter({
    has: page.locator('[data-testid="entity-link"]', {
      hasText: term.name,
    }),
  });

  await expect(cardWithText).toHaveCount(1);
};

export const approveGlossaryTermTask = async (
  page: Page,
  term: GlossaryTermData
) => {
  await validateGlossaryTermTask(page, term);
  const taskResolve = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
  await page.getByTestId('approve-button').click();
  await taskResolve;

  // Display toast notification
  await toastNotification(page, /Task resolved successfully/);
};

// Show the glossary term edit modal from glossary page tree.
// Update the description and verify the changes.
export const updateGlossaryTermDataFromTree = async (
  page: Page,
  termFqn: string
) => {
  // eslint-disable-next-line no-useless-escape
  const escapedFqn = termFqn.replace(/\"/g, '\\"');
  const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
  await termRow.getByTestId('edit-button').click();

  await page.waitForSelector('[role="dialog"].edit-glossary-modal');

  await expect(
    page.locator('[role="dialog"].edit-glossary-modal')
  ).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText(
    'Edit Glossary Term'
  );

  await page.locator(descriptionBox).fill('Updated description');

  const glossaryTermResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByTestId('save-glossary-term').click();
  await glossaryTermResponse;

  await expect(
    termRow.getByRole('cell', { name: 'Updated description' })
  ).toBeVisible();
};

export const validateGlossaryTerm = async (
  page: Page,
  term: GlossaryTermData,
  status: 'Draft' | 'Approved',
  isGlossaryTermPage = false
) => {
  // eslint-disable-next-line no-useless-escape
  const escapedFqn = term.fullyQualifiedName.replace(/\"/g, '\\"');
  const termSelector = `[data-row-key="${escapedFqn}"]`;
  const statusSelector = `[data-testid="${escapedFqn}-status"]`;

  await expect(
    page.getByTestId('glossary-terms-table').getByTestId('loader')
  ).toBeHidden();
  await expect(page.locator('[data-testid="loader"]')).toHaveCount(0);

  await expect(
    page.getByTestId('glossary-terms-table').getByText('Terms')
  ).toBeVisible();
  await expect(
    page.getByTestId('glossary-terms-table').getByText('Description')
  ).toBeVisible();
  await expect(
    page.getByTestId('glossary-terms-table').getByText('Owners')
  ).toBeVisible();
  await expect(
    page.getByTestId('glossary-terms-table').getByText('Status')
  ).toBeVisible();

  if (isGlossaryTermPage) {
    await expect(page.getByTestId(term.name)).toBeVisible();
  } else {
    await expect(page.locator(termSelector)).toContainText(term.name);
    await expect(page.locator(statusSelector)).toContainText(status);
  }
};

export const createGlossaryTerm = async (
  page: Page,
  term: GlossaryTermData,
  status: 'Draft' | 'Approved',
  validateCreateForm = true,
  isGlossaryTermPage = false
) => {
  await fillGlossaryTermDetails(
    page,
    term,
    validateCreateForm,
    isGlossaryTermPage
  );
  const glossaryTermResponse = page.waitForResponse('/api/v1/glossaryTerms');
  await page.click('[data-testid="save-glossary-term"]');
  await glossaryTermResponse;
  await validateGlossaryTerm(page, term, status, isGlossaryTermPage);
};

export const createGlossaryTerms = async (
  page: Page,
  glossary: GlossaryData
) => {
  await selectActiveGlossary(page, glossary.name);

  const termStatus = glossary.reviewers.length > 0 ? 'Draft' : 'Approved';

  for (const term of glossary.terms) {
    await createGlossaryTerm(page, term.data, termStatus, false);
  }
};

export const checkAssetsCount = async (page: Page, assetsCount: number) => {
  await expect(
    page.locator('[data-testid="assets"] [data-testid="filter-count"]')
  ).toHaveText(assetsCount.toString());
};

export const addAssetToGlossaryTerm = async (
  page: Page,
  assets: (TableClass | TopicClass | DashboardClass)[],
  hasExistingAssets = false
) => {
  if (!hasExistingAssets) {
    await page.waitForSelector(
      'text=Adding a new Asset is easy, just give it a spin!'
    );
  }

  await page.click('[data-testid="glossary-term-add-button-menu"]');
  await page.getByRole('menuitem', { name: 'Assets' }).click();

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();
  await expect(
    page.locator('[data-testid="asset-selection-modal"] .ant-modal-title')
  ).toContainText('Add Assets');

  for (const asset of assets) {
    const entityFqn = get(asset, 'entityResponseData.fullyQualifiedName');
    const entityName = get(asset, 'entityResponseData.name');
    const searchRes = page.waitForResponse('/api/v1/search/query*');
    const entityDisplayName = get(asset, 'entityResponseData.displayName');

    const visibleName = entityDisplayName ?? entityName;
    await page
      .locator(
        '[data-testid="asset-selection-modal"] [data-testid="searchbar"]'
      )
      .fill(visibleName);

    await searchRes;
    await page.click(
      `[data-testid="table-data-card_${entityFqn}"] input[type="checkbox"]`
    );

    await expect(
      page.locator(
        `[data-testid="table-data-card_${entityFqn}"] [data-testid="entity-header-name"]`
      )
    ).toContainText(visibleName);
  }

  await page.click('[data-testid="save-btn"]');
  await checkAssetsCount(page, assets.length);
};

export const updateNameForGlossaryTerm = async (
  page: Page,
  name: string,
  endPoint: string
) => {
  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="rename-button"]');

  await expect(page.locator('#name')).toBeVisible();

  // Max length validation
  await page.locator('#name').fill(INVALID_NAMES.MAX_LENGTH);

  await expect(page.locator('#name_help')).toHaveText(
    GLOSSARY_NAME_VALIDATION_ERROR
  );

  await page.fill('#name', name);
  const updateNameResponsePromise = page.waitForResponse(
    `/api/v1/${endPoint}/*`
  );
  await page.click('[data-testid="save-button"]');
  const updateNameResponse = await updateNameResponsePromise;
  const data = await updateNameResponse.json();

  await expect(page.locator('[data-testid="entity-header-name"]')).toHaveText(
    name
  );

  return data;
};

export const verifyGlossaryTermAssets = async (
  page: Page,
  glossary: GlossaryData,
  glossaryTermData: GlossaryTermData,
  assetsLength: number
) => {
  await page.click('[data-testid="overview"]');
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await selectActiveGlossary(page, glossary.displayName);
  await goToAssetsTab(page, glossaryTermData.displayName, assetsLength);
};

export const renameGlossaryTerm = async (
  page: Page,
  glossaryTerm: GlossaryTerm,
  glossaryNewName: string
) => {
  const data = await updateNameForGlossaryTerm(
    page,
    glossaryNewName,
    EntityTypeEndpoint.GlossaryTerm
  );
  await glossaryTerm.rename(data.name, data.fullyQualifiedName);
};

export const dragAndDropTerm = async (
  page: Page,
  dragElement: string,
  dropTarget: string
) => {
  await page.getByRole('cell', { name: dragElement }).hover();
  await page.mouse.down();
  await page.getByRole('cell', { name: dropTarget }).hover();
  await page.mouse.up();
};

export const confirmationDragAndDropGlossary = async (
  page: Page,
  dragElement: string,
  dropElement: string,
  isHeader = false,
  tickCheckbox = false
) => {
  await expect(
    page.locator('[data-testid="confirmation-modal"] .ant-modal-body')
  ).toContainText(
    `Click on Confirm if you’d like to move ${
      isHeader
        ? `${dragElement} under ${dropElement} .`
        : `${dragElement} term under ${dropElement} term.`
    }`
  );

  if (tickCheckbox) {
    await page.getByTestId('confirm-status-checkbox').click();
  }

  const patchGlossaryTermResponse = page.waitForResponse(
    '/api/v1/glossaryTerms/*'
  );
  await page.getByRole('button', { name: 'Move' }).click();
  await patchGlossaryTermResponse;
};

export const changeTermHierarchyFromModal = async (
  page: Page,
  entityDisplayName: string,
  entityFqn: string,
  isGlossaryTerm = true
) => {
  await page.getByTestId('manage-button').click();
  await page.getByTestId('change-parent-button').click();

  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await page.getByLabel('Select Parent').click();
  await page.waitForSelector('.async-tree-select-list-dropdown', {
    state: 'visible',
  });

  if (isGlossaryTerm) {
    const searchRes = page.waitForResponse(`/api/v1/search/query?q=*`);
    await page.getByLabel('Select Parent').fill(entityDisplayName);
    await searchRes;
  }

  await page.getByTestId(`tag-${entityFqn}`).click();

  const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*/moveAsync');
  await page
    .locator('[data-testid="change-parent-hierarchy-modal"]')
    .getByRole('button', { name: 'Save' })
    .click();
  await saveRes;

  await expect(
    page.locator('[role="dialog"].change-parent-hierarchy-modal')
  ).toBeHidden();
};

export const deleteGlossaryOrGlossaryTerm = async (
  page: Page,
  entityName: string,
  isGlossaryTerm = false
) => {
  await page.click('[data-testid="manage-button"]');
  await page.click('[data-testid="delete-button"]');

  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="modal-header"]')).toContainText(
    entityName
  );

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const endpoint = isGlossaryTerm
    ? '/api/v1/glossaryTerms/async/*'
    : '/api/v1/glossaries/async/*';
  const deleteRes = page.waitForResponse(endpoint);
  await page.click('[data-testid="confirm-button"]');
  await deleteRes;

  await toastNotification(page, /deleted successfully!/);
};

export const addSynonyms = async (page: Page, synonyms: string[]) => {
  await page.getByTestId('synonym-add-button').click();
  await page.locator('.ant-select-selection-overflow').click();

  for (const synonym of synonyms) {
    await page.locator('#synonyms-select').fill(synonym);
    await page.locator('#synonyms-select').press('Enter');
  }

  const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByTestId('save-synonym-btn').click();
  await saveRes;

  for (const synonym of synonyms) {
    await expect(page.getByTestId(synonym)).toBeVisible();
  }
};

export const addReferences = async (
  page: Page,
  references: { name: string; url: string }[]
) => {
  await page.getByTestId('term-references-add-button').click();

  await expect(
    page.getByTestId('glossary-term-references-modal').getByText('References')
  ).toBeVisible();

  for (const [index, value] of references.entries()) {
    await page.locator(`#references_${index}_name`).fill(value.name);
    await page.locator(`#references_${index}_endpoint`).fill(value.url);
    if (index < references.length - 1) {
      await page.getByTestId('add-references-button').click();
    }
  }
  const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByTestId('save-btn').click();
  await saveRes;

  for (const reference of references) {
    await expect(
      page.getByTestId(`reference-link-${reference.name}`)
    ).toBeVisible();
  }
};

export const addRelatedTerms = async (
  page: Page,
  relatedTerms: GlossaryTerm[]
) => {
  await page.getByTestId('related-term-add-button').click();
  for (const term of relatedTerms) {
    const entityName = get(term, 'responseData.name');
    const entityFqn = get(term, 'responseData.fullyQualifiedName');
    await page.locator('#tagsForm_tags').fill(entityName);
    await page.getByTestId(`tag-${entityFqn}`).click();
  }

  const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByTestId('saveAssociatedTag').click();
  await saveRes;

  for (const term of relatedTerms) {
    const entityName = get(term, 'responseData.displayName');

    await expect(page.getByTestId(entityName)).toBeVisible();
  }
};

export const assignTagToGlossaryTerm = async (
  page: Page,
  tag: string,
  action: 'Add' | 'Edit' = 'Add',
  parentTestId = 'KnowledgePanel.GlossaryTerms'
) => {
  await page
    .getByTestId(parentTestId)
    .getByTestId('tags-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button')
    .click();

  const searchTags = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(tag)}*`
  );
  await page.locator('#tagsForm_tags').fill(tag);
  await searchTags;
  await page.getByTestId(`tag-${tag}`).click();

  await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

  await page.getByTestId('saveAssociatedTag').click();

  await expect(page.getByRole('heading')).toContainText(
    'Would you like to proceed with updating the tags?'
  );

  const validateRes = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByRole('button', { name: 'Yes, confirm' }).click();
  await validateRes;

  await expect(
    page
      .getByTestId(parentTestId)
      .getByTestId('tags-container')
      .getByTestId(`tag-${tag}`)
  ).toBeVisible();
};

export const createDescriptionTaskForGlossary = async (
  page: Page,
  value: TaskDetails,
  entity: Glossary | GlossaryTerm,
  isGlossary = true,
  addDescription = true
) => {
  const entityType = isGlossary ? 'glossary' : 'glossaryTerm';
  const entityName = get(entity, 'responseData.displayName');

  expect(await page.locator('#title').inputValue()).toBe(
    `${
      addDescription ? 'Update' : 'Request'
    } description for ${entityType} ${entityName}`
  );

  if (isUndefined(value.assignee)) {
    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector')
        .innerText()
    ).toBe(value.assignee);

    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector input')
        .isDisabled()
    );
  } else {
    const assigneeField = page.locator(
      '[data-testid="select-assignee"] > .ant-select-selector #assignees'
    );
    await assigneeField.click();

    const userSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${value.assignee}**&index=user_search_index%2Cteam_search_index*`
    );
    await assigneeField.fill(value.assignee);
    await userSearchResponse;

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee);
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  if (addDescription) {
    await page.locator(descriptionBox).clear();
    await page
      .locator(descriptionBox)
      .fill(value.description ?? 'Updated description');
  }
  await page.click('button[type="submit"]');

  await toastNotification(page, /Task created successfully./);
};

export const createTagTaskForGlossary = async (
  page: Page,
  value: TaskDetails,
  entity: Glossary | GlossaryTerm,
  isGlossary = true,
  addTag = true
) => {
  const entityType = isGlossary ? 'glossary' : 'glossaryTerm';
  const entityName = get(entity, 'responseData.displayName');

  expect(await page.locator('#title').inputValue()).toBe(
    `Request tags for ${entityType} ${entityName}`
  );

  if (isUndefined(value.assignee)) {
    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector')
        .innerText()
    ).toBe(value.assignee);

    expect(
      await page
        .locator('[data-testid="select-assignee"] > .ant-select-selector input')
        .isDisabled()
    );
  } else {
    // select assignee
    const assigneeField = page.locator(
      '[data-testid="select-assignee"] > .ant-select-selector #assignees'
    );
    await assigneeField.click();
    const userSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${value.assignee}**&index=user_search_index%2Cteam_search_index*`
    );
    await assigneeField.fill(value.assignee);
    await userSearchResponse;

    // select value from dropdown
    const dropdownValue = page.getByTestId(value.assignee);
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  if (addTag) {
    // select tags
    const suggestTags = page.locator(
      '[data-testid="tag-selector"] > .ant-select-selector .ant-select-selection-search-input'
    );
    await suggestTags.click();

    const querySearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${value.tag}*&index=tag_search_index&*`
    );
    await suggestTags.fill(value.tag ?? '');

    await querySearchResponse;

    // select value from dropdown
    const dropdownValue = page.getByTestId(`tag-${value.tag ?? ''}`);
    await dropdownValue.hover();
    await dropdownValue.click();
    await clickOutside(page);
  }

  await page.click('button[type="submit"]');

  await toastNotification(page, /Task created successfully./);
};

export const approveTagsTask = async (
  page: Page,
  value: TaskDetails,
  entity: Glossary | GlossaryTerm
) => {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaryTerms*');
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await glossaryResponse;
  await selectActiveGlossary(page, entity.data.displayName);

  await page.click('[data-testid="activity_feed"]');

  const taskFeeds = page.waitForResponse(TASK_OPEN_FETCH_LINK);
  await page
    .getByTestId('global-setting-left-panel')
    .getByText('Tasks')
    .click();

  await taskFeeds;

  const taskResolve = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
  await page.click('.ant-btn-compact-first-item:has-text("Accept Suggestion")');
  await taskResolve;

  await redirectToHomePage(page);
  const glossaryTermsResponse = page.waitForResponse('/api/v1/glossaryTerms*');
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await glossaryTermsResponse;
  await selectActiveGlossary(page, entity.data.displayName);
  await page.waitForLoadState('networkidle');

  const tagVisibility = page.locator(`[data-testid="tag-${value.tag}"]`);
  await tagVisibility.scrollIntoViewIfNeeded();

  await expect(tagVisibility).toBeVisible();
};

export async function openColumnDropdown(page: Page): Promise<void> {
  const dropdownButton = page.getByTestId('column-dropdown');

  await expect(dropdownButton).toBeVisible();

  await dropdownButton.click();

  await page.waitForSelector(
    '.ant-dropdown [role="menu"] [data-testid="column-dropdown-title"]',
    {
      state: 'visible',
    }
  );
}

export async function selectColumns(
  page: Page,
  checkboxLabels: string[]
): Promise<void> {
  for (const label of checkboxLabels) {
    const checkbox = page.locator('.draggable-menu-item-button', {
      hasText: label,
    });
    await checkbox.click();
  }
  await clickOutside(page);
}

export async function deselectColumns(
  page: Page,
  checkboxLabels: string[]
): Promise<void> {
  for (const label of checkboxLabels) {
    const checkbox = page.locator('.draggable-menu-item-button', {
      hasText: label,
    });
    await checkbox.click();
  }
  await clickOutside(page);
}

export async function verifyColumnsVisibility(
  page: Page,
  checkboxLabels: string[],
  shouldBeVisible: boolean
): Promise<void> {
  const glossaryTermsTable = page.getByTestId('glossary-terms-table');

  await expect(glossaryTermsTable).toBeVisible();

  for (const label of checkboxLabels) {
    const termsColumnHeader = glossaryTermsTable.locator('th', {
      hasText: label,
    });
    if (shouldBeVisible) {
      await expect(termsColumnHeader).toBeVisible();
    } else {
      await expect(termsColumnHeader).toBeHidden();
    }
  }
}

export async function toggleBulkActionColumnsSelection(
  page: Page,
  isViewAllSelected: boolean
): Promise<void> {
  await openColumnDropdown(page);

  const button = page.getByTestId('column-dropdown-action-button');

  if (isViewAllSelected) {
    await expect(button).toHaveText('Hide All');

    await button.click();
  } else {
    await expect(button).toHaveText('View All');

    await button.click();
  }

  await clickOutside(page);
}

export async function verifyAllColumns(
  page: Page,
  tableColumns: string[],
  shouldBeVisible: boolean
): Promise<void> {
  const glossaryTermsTable = page.getByTestId('glossary-terms-table');

  await expect(glossaryTermsTable).toBeVisible();

  for (const columnHeader of tableColumns) {
    const termsColumnHeader = glossaryTermsTable.locator('th', {
      hasText: columnHeader,
    });

    if (shouldBeVisible) {
      await expect(termsColumnHeader).toBeVisible();
    } else {
      if (columnHeader !== 'TERMS') {
        await expect(termsColumnHeader).not.toBeVisible();
      } else {
        await expect(termsColumnHeader).toBeVisible();
      }
    }
  }
}
export const filterStatus = async (
  page: Page,
  statusLabels: string[],
  expectedStatus: string[]
): Promise<void> => {
  const dropdownButton = page.getByTestId('glossary-status-dropdown');
  await dropdownButton.click();

  for (const label of statusLabels) {
    const checkbox = page.locator('.glossary-dropdown-label', {
      hasText: label,
    });
    await checkbox.click();
  }

  const saveButton = page.locator('.ant-btn-primary', {
    hasText: 'Save',
  });
  await saveButton.click();

  const glossaryTermsTable = page.getByTestId('glossary-terms-table');
  // will select all <tr> elements inside the <tbody> but exclude those with aria-hidden="true"
  // since we have added re-sizeable columns, that one <tr> entry is present in the tbody
  const rows = glossaryTermsTable.locator(
    'tbody.ant-table-tbody > tr:not([aria-hidden="true"])'
  );
  const statusColumnIndex = 2;

  for (let i = 0; i < (await rows.count()); i++) {
    const statusCell = rows
      .nth(i)
      .locator(`td:nth-child(${statusColumnIndex + 1})`);
    const statusText = await statusCell.textContent();

    expect(expectedStatus).toContain(statusText);
  }
};

export const addMultiOwnerInDialog = async (data: {
  page: Page;
  ownerNames: string | string[];
  activatorBtnLocator: string;
  endpoint: EntityTypeEndpoint;
  resultTestId?: string;
  isSelectableInsideForm?: boolean;
  type: 'Teams' | 'Users';
  clearAll?: boolean;
}) => {
  const {
    page,
    ownerNames,
    activatorBtnLocator,
    resultTestId = 'owner-link',
    isSelectableInsideForm = false,
    endpoint,
    type,
    clearAll = true,
  } = data;
  const isMultipleOwners = Array.isArray(ownerNames);
  const owners = isMultipleOwners ? ownerNames : [ownerNames];

  await page.click(activatorBtnLocator);

  await expect(page.locator("[data-testid='select-owner-tabs']")).toBeVisible();

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page
    .locator("[data-testid='select-owner-tabs']")
    .getByRole('tab', { name: 'Users' })
    .click();

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

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
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

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
    await expect(page.locator(`[data-testid="${resultTestId}"]`)).toContainText(
      name
    );
  }
};

export const dragAndDropColumn = async (
  page: Page,
  dragColumn: string,
  dropColumn: string
) => {
  await page.waitForSelector(`.draggable-menu-item:has-text("${dragColumn}")`, {
    state: 'visible',
  });

  await page
    .locator('.draggable-menu-item', { hasText: dragColumn })
    .dragTo(page.locator('.draggable-menu-item', { hasText: dropColumn }), {
      sourcePosition: {
        x: 16,
        y: 16,
      },
      targetPosition: {
        x: 16,
        y: 16,
      },
    });
};

export const getEscapedTermFqn = (term: GlossaryTermData) => {
  // eslint-disable-next-line no-useless-escape
  return term.fullyQualifiedName.replace(/\"/g, '\\"');
};

export const openEditGlossaryTermModal = async (
  page: Page,
  term: GlossaryTermData
) => {
  const escapedFqn = getEscapedTermFqn(term);
  const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
  const glossaryTermRes = page.waitForResponse('/api/v1/glossaryTerms/name/*');
  await termRow.getByTestId('edit-button').click();
  await glossaryTermRes;
  await page.waitForSelector('[role="dialog"].edit-glossary-modal');

  await expect(
    page.locator('[role="dialog"].edit-glossary-modal')
  ).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toContainText(
    'Edit Glossary Term'
  );
};

export const updateGlossaryTermOwners = async (
  page: Page,
  term: GlossaryTermData,
  owners: UserTeamRef[]
) => {
  await openEditGlossaryTermModal(page, term);
  const ownerLocator = '.edit-glossary-modal [data-testid="add-owner"]';
  await addMultiOwnerInDialog({
    page,
    ownerNames: owners.map((owner) => owner.name),
    activatorBtnLocator: ownerLocator,
    resultTestId: 'owner-container',
    endpoint: EntityTypeEndpoint.GlossaryTerm,
    isSelectableInsideForm: true,
    type: 'Users',
  });

  const glossaryTermResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByTestId('save-glossary-term').click();
  await glossaryTermResponse;
};

export const updateGlossaryReviewer = async (
  page: Page,
  reviewers: string[]
) => {
  await addMultiOwner({
    page,
    ownerNames: reviewers,
    activatorBtnDataTestId: 'Add',
    resultTestId: 'glossary-reviewer',
    endpoint: EntityTypeEndpoint.Glossary,
    isSelectableInsideForm: true,
    type: 'Users',
  });
};

export const updateGlossaryTermReviewers = async (
  page: Page,
  term: GlossaryTermData,
  reviewers: UserTeamRef[]
) => {
  await openEditGlossaryTermModal(page, term);
  const reviewerLocator = '.edit-glossary-modal [data-testid="add-reviewers"]';

  await addMultiOwnerInDialog({
    page,
    ownerNames: reviewers.map((reviewer) => reviewer.name),
    activatorBtnLocator: reviewerLocator,
    resultTestId: 'reviewers-container',
    endpoint: EntityTypeEndpoint.Glossary,
    isSelectableInsideForm: true,
    type: 'Users',
  });

  const glossaryTermResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
  await page.getByTestId('save-glossary-term').click();
  await glossaryTermResponse;
};

export const checkGlossaryTermDetails = async (
  page: Page,
  term: GlossaryTermData,
  owner: UserClass,
  reviewer: UserClass
) => {
  await openEditGlossaryTermModal(page, term);

  await expect(page.locator('[data-testid="name"]')).toHaveValue(term.name);
  await expect(page.locator('[data-testid="display-name"]')).toHaveValue(
    term.displayName
  );
  await expect(page.getByTestId('editor')).toContainText(term.description);

  await expect(
    page.locator('[data-testid="owner-container"] [data-testid="owner-link"]')
  ).toContainText(owner.responseData.displayName);

  await expect(
    page.locator(
      '[data-testid="reviewers-container"] [data-testid="owner-link"]'
    )
  ).toContainText(reviewer.responseData.displayName);
};

export const setupGlossaryDenyPermissionTest = async (
  apiContext: any,
  isGlossary?: boolean
) => {
  // Create all necessary resources
  const dataConsumerUser = new UserClass();
  const id = uuid();
  const glossary1 = new Glossary();
  const glossaryTerm1 = new GlossaryTerm(glossary1);
  await glossary1.create(apiContext);
  await glossaryTerm1.create(apiContext);

  const classification = new ClassificationClass({
    provider: 'system',
    mutuallyExclusive: true,
  });
  const tag = new TagClass({
    classification: classification.data.name,
  });

  await dataConsumerUser.create(apiContext);
  await classification.create(apiContext);
  await tag.create(apiContext);

  // Setup permissions
  const dataConsumerPolicy = new PolicyClass();
  const dataConsumerRole = new RolesClass();

  // Create domain access policy
  const matchTagRule = [
    {
      name: 'Hidden from Non Admins',
      description: '',
      resources: ['All'],
      operations: ['All'],
      effect: 'deny',
      condition: `matchAllTags('${tag.responseData.fullyQualifiedName}')`,
    },
  ];

  await dataConsumerPolicy.create(apiContext, matchTagRule);
  await dataConsumerRole.create(apiContext, [
    dataConsumerPolicy.responseData.name,
  ]);

  // Create team for the user
  const dataConsumerTeam = new TeamClass({
    name: `PW_data_consumer_team-${id}`,
    displayName: `PW Data Consumer Team ${id}`,
    description: 'playwright data consumer team description',
    teamType: 'Group',
    users: [dataConsumerUser.responseData.id ?? ''],
    defaultRoles: [dataConsumerRole.responseData.id ?? ''],
  });

  await dataConsumerTeam.create(apiContext);

  // Set domain ownership
  await (isGlossary ? glossary1 : glossaryTerm1).patch(apiContext, [
    {
      op: 'add',
      path: '/tags/0',
      value: {
        tagFQN: tag.responseData.fullyQualifiedName,
        source: 'Classification',
      },
    },
  ]);

  // Return cleanup function and all created resources
  const cleanup = async (apiContext1: APIRequestContext) => {
    await glossaryTerm1.delete(apiContext);
    await glossary1.delete(apiContext);
    await dataConsumerUser.delete(apiContext1);
    await dataConsumerTeam.delete(apiContext1);
    await dataConsumerPolicy.delete(apiContext1);
    await dataConsumerRole.delete(apiContext1);
  };

  return {
    dataConsumerUser,
    glossary1,
    glossaryTerm1,
    dataConsumerTeam,
    dataConsumerPolicy,
    dataConsumerRole,
    cleanup,
  };
};
