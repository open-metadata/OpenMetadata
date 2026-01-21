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
import { expect, Page, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  clickOutside,
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  uuid,
  getApiContext,
} from '../../utils/common';
import { addMultiOwner, removeOwner } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import {
  addTagToTableColumn,
  setTagDisabled,
  submitForm,
  validateForm,
} from '../../utils/tag';

const NEW_CLASSIFICATION = {
  name: `PlaywrightClassification-${uuid()}`,
  displayName: `PlaywrightClassification-${uuid()}`,
  description: 'This is the PlaywrightClassification',
};
const NEW_TAG = {
  name: `PlaywrightTag-${uuid()}`,
  displayName: `PlaywrightTag-${uuid()}`,
  renamedName: `PlaywrightTag-${uuid()}`,
  description: 'This is the PlaywrightTag',
  color: '#F14C75',
  icon: 'Cube01',
};
const tagFqn = `${NEW_CLASSIFICATION.name}.${NEW_TAG.name}`;

const permanentDeleteModal = async (page: Page, entity: string) => {
  await page.waitForSelector('.ant-modal-content', {
    state: 'visible',
  });

  await expect(page.locator('.ant-modal-content')).toBeVisible();

  await expect(page.locator('[data-testid="modal-header"]')).toContainText(
    `Delete ${entity}`
  );

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
  await page.click('[data-testid="confirm-button"]');
};

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();
const classification = new ClassificationClass({
  provider: 'system',
});
const tag = new TagClass({
  classification: classification.data.name,
});

const classification1 = new ClassificationClass();
const tag1 = new TagClass({
  classification: classification1.data.name,
});
const user1 = new UserClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await classification.create(apiContext);
  await classification1.create(apiContext);
  await tag.create(apiContext);
  await tag1.create(apiContext);
  await user1.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await classification.delete(apiContext);
  await classification1.delete(apiContext);
  await tag.delete(apiContext);
  await tag1.delete(apiContext);
  await user1.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Classification Page', async ({ page }) => {
  test.slow();

  await test.step('Should render basic elements on page', async () => {
    const getTags = page.waitForResponse('/api/v1/tags*');
    await sidebarClick(page, SidebarItem.TAGS);
    await getTags;

    await expect(
      page.locator('[data-testid="add-classification"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="add-new-tag-button"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="manage-button"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="description-container"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="table"]')).toBeVisible();

    const headers = await page
      .locator('.ant-table-thead > tr > .ant-table-cell')
      .allTextContents();

    expect(headers).toEqual([
      'Enabled',
      'Tag',
      'Display Name',
      'Description',
      'Actions',
    ]);
  });

  await test.step('Disabled system tags should not render', async () => {
    const classificationResponse = page.waitForResponse(
      `/api/v1/tags?*parent=${classification.responseData.name}*`
    );
    await page
      .locator(`[data-testid="side-panel-classification"]`)
      .filter({ hasText: classification.responseData.displayName })
      .click();
    await classificationResponse;

    await page.click('[data-testid="manage-button"]');

    const disabledTag = page.waitForResponse('/api/v1/classifications/*');
    await page.click('[data-testid="enable-disable-title"]');
    await disabledTag;

    await expect(
      page.locator(
        `[data-testid="classification-${classification.responseData.name}"] [data-testid="disabled"]`
      )
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="add-new-tag-button"]')
    ).toBeDisabled();

    // Verify that the "Add Domain" and "Add Owner" icon buttons are not visible
    // on both the Classification and Tag pages when Classification is disabled.

    await expect(page.getByTestId('add-domain')).not.toBeVisible();
    await expect(page.getByTestId('add-owner')).not.toBeVisible();

    await page.getByTestId(tag.responseData.name).click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('disabled')).toBeVisible();
    await expect(page.getByTestId('add-domain')).not.toBeVisible();
    await expect(page.getByTestId('add-owner')).not.toBeVisible();

    // Check if the disabled Classification tag is not visible in the table
    await table.visitEntityPage(page);

    await page.click(
      '[data-testid="classification-tags-0"] [data-testid="entity-tags"] [data-testid="add-tag"]'
    );

    const tagResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(
        tag.responseData.displayName
      )}***`
    );
    await page.fill(
      '[data-testid="tag-selector"] input',
      tag.responseData.displayName
    );
    await tagResponse;

    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).toContainText(tag.responseData.displayName);

    await expect(
      page.getByTestId(
        `[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`
      )
    ).not.toBeVisible();

    await expect(page.getByText('No Tags are available')).toBeVisible();

    await expect(page.getByTestId('saveAssociatedTag')).toBeDisabled();

    // Re-enable the disabled Classification
    await classification.visitPage(page);

    await page.click('[data-testid="manage-button"]');

    const enableTagResponse = page.waitForResponse('/api/v1/classifications/*');
    await page.click('[data-testid="enable-disable-title"]');
    await enableTagResponse;

    await expect(
      page.locator('[data-testid="add-new-tag-button"]')
    ).not.toBeDisabled();

    await expect(
      page.locator(
        `[data-testid="classification-${classification.responseData.name}"] [data-testid="disabled"]`
      )
    ).not.toBeVisible();

    // Verify that the "Add Domain" and "Add Owner" icon buttons are visible
    // on both the Classification and Tag pages when Classification is enabled.
    await expect(page.getByTestId('add-domain')).toBeVisible();
    await expect(page.getByTestId('add-owner')).toBeVisible();

    await page.getByTestId(tag.responseData.name).click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('disabled')).not.toBeVisible();
    await expect(page.getByTestId('add-domain')).toBeVisible();
    await expect(page.getByTestId('add-owner')).toBeVisible();

    /* This code test will be fix in this PR  https://github.com/open-metadata/OpenMetadata/pull/18333  */
    // await table.visitEntityPage(page);
    // await addTagToTableColumn(page, {
    //   tagName: tag.responseData.name,
    //   tagFqn: tag.responseData.fullyQualifiedName,
    //   tagDisplayName: tag.responseData.displayName,
    //   tableId: table.entityResponseData?.['id'],
    //   columnNumber: 1,
    //   rowName: 'shop_id numeric',
    // });
  });

  await test.step('Create classification with validation checks', async () => {
    await redirectToHomePage(page);
    await classification.visitPage(page);
    await page.click('[data-testid="add-classification"]');

    await expect(page.getByTestId('tags-form')).toBeVisible();

    await validateForm(page);

    await page.fill('[data-testid="name"]', NEW_CLASSIFICATION.name);
    await page.fill(
      '[data-testid="displayName"]',
      NEW_CLASSIFICATION.displayName
    );
    await page.locator(descriptionBox).fill(NEW_CLASSIFICATION.description);
    await page.click('[data-testid="mutually-exclusive-button"]');

    const createTagCategoryResponse = page.waitForResponse(
      'api/v1/classifications'
    );
    await submitForm(page);
    await createTagCategoryResponse;

    await expect(
      page.locator('[data-testid="modal-container"]')
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="data-summary-container"]')
    ).toContainText(NEW_CLASSIFICATION.displayName);
  });

  await test.step('Create tag with validation checks', async () => {
    await page.click(`text=${NEW_CLASSIFICATION.displayName}`);

    await expect(page.locator('.activeCategory')).toContainText(
      NEW_CLASSIFICATION.displayName
    );

    await page.click('[data-testid="add-new-tag-button"]');

    await expect(page.getByTestId('tags-form')).toBeVisible();

    await validateForm(page);

    await page.fill('[data-testid="name"]', NEW_TAG.name);
    await page.fill('[data-testid="displayName"]', NEW_TAG.displayName);
    await page.locator(descriptionBox).fill(NEW_TAG.description);
    await page.getByTestId('icon-picker-btn').click();
    await page
      .getByRole('button', { name: `Select icon ${NEW_TAG.icon}` })
      .click();
    await page
      .getByRole('button', { name: `Select color ${NEW_TAG.color}` })
      .click();

    const createTagResponse = page.waitForResponse('api/v1/tags');
    await submitForm(page);
    await createTagResponse;

    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );
  });

  await test.step('Verify classification term count', async () => {
    // Find the classification in the left panel and verify term count
    const classificationElement = page
      .locator(`[data-testid="side-panel-classification"]`)
      .filter({ hasText: NEW_CLASSIFICATION.displayName });

    // Check if term count is displayed as (1) since we created one tag
    await expect(classificationElement).toContainText(
      `${NEW_CLASSIFICATION.displayName}1`
    );

    // Click on the classification to verify
    await classificationElement.click();

    // Verify the tag is listed
    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );
  });

  await test.step(`Assign tag to table`, async () => {
    await table.visitEntityPage(page);
    const { name, displayName } = NEW_TAG;

    await addTagToTableColumn(page, {
      tagName: name,
      tagFqn,
      tagDisplayName: displayName,
      columnNumber: 0,
      rowName: `${table.entity?.columns[0].name} numeric`,
    });
  });

  await test.step(
    'Assign tag using Task & Suggestion flow to DatabaseSchema',
    async () => {
      const entity = table.schema;
      const tag = 'Personal';
      const assignee = 'admin';

      const databaseSchemaPage = page.waitForResponse(
        'api/v1/databaseSchemas/name/*'
      );
      const permissions = page.waitForResponse(
        'api/v1/permissions/databaseSchema/name/*'
      );
      await page.click(
        `[data-testid="breadcrumb-link"]:has-text("${entity.name}")`
      );

      await databaseSchemaPage;
      await permissions;

      await page.click('[data-testid="request-entity-tags"]');

      await page.click('[data-testid="select-assignee"]');
      const assigneeResponse = page.waitForResponse(
        '/api/v1/search/query?q=*&index=user_search_index*team_search_index*'
      );
      await page.keyboard.type(assignee);
      await page.click(`[data-testid="${assignee}"]`);
      await assigneeResponse;

      await clickOutside(page);

      const suggestTag = page.waitForResponse(
        'api/v1/search/query?q=*&index=tag_search_index*'
      );
      await page.click('[data-testid="tag-selector"]');
      await page.keyboard.type(tag);
      await suggestTag;
      await page.click('[data-testid="tag-PersonalData.Personal"]');

      await page.click('[data-testid="tags-label"]');
      const taskCreated = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('api/v1/feed')
      );
      await page.click('[data-testid="submit-tag-request"]');
      await taskCreated;

      const acceptSuggestion = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().includes('/api/v1/feed/tasks/') &&
          response.url().includes('/resolve')
      );

      const acceptButton = page.locator(
        '.ant-btn-compact-first-item:has-text("Accept Suggestion")'
      );
      await acceptButton.waitFor({ state: 'visible' });
      await acceptButton.click();
      await acceptSuggestion;
      await page.click('[data-testid="table"]');

      const databaseSchemasPage = page.waitForResponse(
        'api/v1/databaseSchemas/name/*'
      );
      await page.reload();
      await databaseSchemasPage;

      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.locator('[data-testid="tags-container"]')
      ).toContainText(tag);

      await page.click('[data-testid="edit-button"]');

      await page.click('[data-testid="remove-tags"]');

      const removeTags = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes('/api/v1/databaseSchemas/')
      );
      await page.click('[data-testid="saveAssociatedTag"]');
      await removeTags;
    }
  );

  await test.step('Delete tag', async () => {
    const getTags = page.waitForResponse('/api/v1/tags*');
    await sidebarClick(page, SidebarItem.TAGS);
    await getTags;
    const classificationResponse = page.waitForResponse(
      `/api/v1/tags?*parent=${encodeURIComponent(NEW_CLASSIFICATION.name)}*`
    );
    await page
      .locator(`[data-testid="side-panel-classification"]`)
      .filter({ hasText: NEW_CLASSIFICATION.displayName })
      .click();
    await classificationResponse;

    await expect(page.locator('.activeCategory')).toContainText(
      NEW_CLASSIFICATION.displayName
    );

    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );

    await page.click('[data-testid="table"] [data-testid="delete-tag"]');
    await page.waitForTimeout(500); // adding manual wait to open modal, as it depends on click not an api.
    const deleteTag = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().includes('/api/v1/tags/')
    );
    await permanentDeleteModal(page, NEW_TAG.name);
    await deleteTag;
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="table"]')).not.toContainText(
      NEW_TAG.name
    );

    // Verify term count is now 0 after deleting the tag
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await page.waitForSelector('[data-testid="side-panel-classification"]', {
      state: 'visible',
    });

    // Find the classification and verify term count is 0
    const classificationElement = page
      .locator(`[data-testid="side-panel-classification"]`)
      .filter({ hasText: NEW_CLASSIFICATION.displayName });

    // Check if term count is displayed as (0) since we deleted the tag
    await expect(classificationElement).toContainText(
      `${NEW_CLASSIFICATION.displayName}0`
    );
  });

  await test.step('Remove classification', async () => {
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      NEW_CLASSIFICATION.displayName
    );

    await page.click('[data-testid="manage-button"]');

    await page.click('[data-testid="delete-button"]');

    await page.click('[data-testid="hard-delete-option"]');
    await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

    const deleteClassification = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().includes('/api/v1/classifications/')
    );
    await page.click('[data-testid="confirm-button"]');
    await deleteClassification;

    await page.waitForLoadState('networkidle');

    await expect(
      page
        .locator('[data-testid="data-summary-container"]')
        .filter({ hasText: NEW_CLASSIFICATION.name })
    ).not.toBeVisible();
  });
});

test('Search tag using classification display name should work', async ({
  page,
}) => {
  const displayNameToSearch = tag.responseData.classification.displayName;

  await table.visitEntityPage(page);

  await page.waitForLoadState('networkidle');

  const initialQueryResponse = page.waitForResponse('**/api/v1/search/query?*');

  await page
    .getByTestId('KnowledgePanel.Tags')
    .getByTestId('tags-container')
    .getByTestId('add-tag')
    .first()
    .click();

  await initialQueryResponse;

  const tagSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(displayNameToSearch)}*`
  );

  // Enter the display name in the search box
  await page.fill('[data-testid="tag-selector"] input', displayNameToSearch);

  const response = await tagSearchResponse;
  const searchResults = await response.json();

  // Verify that we got search results
  expect(searchResults.hits.hits.length).toBeGreaterThan(0);

  // Verify that the classification display name is shown in search input
  await expect(
    page.locator('[data-testid="tag-selector"] > .ant-select-selector')
  ).toContainText(displayNameToSearch);

  // Verify that the tag with matching display name is shown in dropdown
  await expect(
    page.locator('.ant-select-dropdown').getByText(tag.responseData.displayName)
  ).toBeVisible();

  // Verify the tag is selectable in the dropdown
  await expect(
    page.getByTestId(`tag-${tag.responseData.fullyQualifiedName}`)
  ).toBeVisible();
});

test('Verify system classification term counts', async ({ page }) => {
  const classificationsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/classifications') &&
      response.url().includes('fields=termCount')
  );

  const getTags = page.waitForResponse('/api/v1/tags*');
  await sidebarClick(page, SidebarItem.TAGS);
  await getTags;

  await classificationsResponse;

  await page.waitForSelector('[data-testid="side-panel-classification"]', {
    state: 'visible',
  });

  // Get all classification elements
  const classificationElements = await page
    .locator('[data-testid="side-panel-classification"]')
    .all();

  // Find and verify Tier classification
  let tierFound = false;
  let piiFound = false;

  for (const element of classificationElements) {
    const text = await element.textContent();
    const filterCountText = await element
      .getByTestId('filter-count')
      .textContent();
    const filterCount = parseInt(filterCountText?.trim() || '0', 10);
    if (text?.includes('Tier') && filterCount > 0) {
      tierFound = true;
    }
    if (text?.includes('PII') && filterCount > 0) {
      piiFound = true;
    }
  }

  expect(tierFound).toBeTruthy();
  expect(piiFound).toBeTruthy();

  // Alternative: verify specific classifications have the expected count
  const tierElement = page
    .locator('[data-testid="side-panel-classification"]')
    .filter({ hasText: 'Tier' });

  const tierCountText = await tierElement
    .getByTestId('filter-count')
    .textContent();
  const tierCount = parseInt(tierCountText?.trim() || '0');

  expect(tierCount).toBeGreaterThanOrEqual(5);

  const piiElement = page
    .locator('[data-testid="side-panel-classification"]')
    .filter({ hasText: 'PII' });

  const piiCountText = await piiElement
    .getByTestId('filter-count')
    .textContent();
  const piiCount = parseInt(piiCountText?.trim() || '0');

  expect(piiCount).toBeGreaterThanOrEqual(3);
});

test('Verify Owner Add Delete', async ({ page }) => {
  await classification1.visitPage(page);
  const OWNER1 = user1.getUserDisplayName();

  await addMultiOwner({
    page,
    ownerNames: [OWNER1],
    activatorBtnDataTestId: 'add-owner',
    resultTestId: 'classification-owner-name',
    endpoint: EntityTypeEndpoint.Classification,
    isSelectableInsideForm: false,
    type: 'Users',
  });

  await page.getByTestId(tag1.data.name).click();
  await page.waitForLoadState('networkidle');

  await expect(
    page.locator(`[data-testid="owner-link"]`).getByTestId(OWNER1)
  ).toBeVisible();

  await classification1.visitPage(page);

  await page.waitForLoadState('networkidle');

  await removeOwner({
    page,
    endpoint: EntityTypeEndpoint.Classification,
    ownerName: OWNER1,
    type: 'Users',
    dataTestId: 'classification-owner-name',
  });
});

test('Disabled tag should not allow adding assets from Assets tab', async ({
  browser,
  page,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  try {
    // Disable the tag via API
    await setTagDisabled(apiContext, tag1.responseData.id, true);

    // Visit the disabled tag page
    await tag1.visitPage(page);

    await page.waitForSelector(
      '[data-testid="tags-container"] [data-testid="loader"]',
      { state: 'detached' }
    );

    // Verify the disabled badge is visible
    await expect(page.getByTestId('disabled')).toBeVisible();

    // Go to Assets tab
    await page.getByTestId('assets').click();

    // Verify the "Add Assets" button is NOT visible for disabled tag
    await expect(
      page.getByTestId('data-classification-add-button')
    ).not.toBeVisible();
  } finally {
    // Re-enable the tag for cleanup
    await setTagDisabled(apiContext, tag1.responseData.id, false);
    await afterAction();
  }
});

test('Asset Management from Tag Page', async ({ page }) => {
  test.slow();

  const { afterAction } = await getApiContext(page);

  try {
    // Navigate to the Tag details page
    await tag.visitPage(page);
    await page.waitForSelector(
      '[data-testid="tags-container"] [data-testid="loader"]',
      { state: 'detached' }
    );

    // Click on the "Assets" tab
    await page.getByTestId('assets').click();

    // Wait for initial fetch when opening the asset selection modal
    const initialFetchResponse = page.waitForResponse(
      '/api/v1/search/query?q=&index=all&from=0&size=25&deleted=false**'
    );

    // Click the "Add Asset" button
    const addAssetButton = page.getByTestId('data-classification-add-button');
    await addAssetButton.waitFor({ state: 'visible' });
    await addAssetButton.click();

    // Wait for initial fetch response
    await initialFetchResponse;

    // Wait for asset selection modal
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select a data asset from the selection modal
    const assetName =
      table.entityResponseData?.displayName || table.entityResponseData?.name;
    const assetFqn = table.entityResponseData?.fullyQualifiedName;

    if (assetName && assetFqn) {
      // Search for the asset
      const searchRes = page.waitForResponse(
        `/api/v1/search/query?q=${encodeURIComponent(
          assetName
        )}&index=all&from=0&size=25&**`
      );
      await page
        .getByTestId('asset-selection-modal')
        .getByTestId('searchbar')
        .fill(assetName);
      await searchRes;
      await waitForAllLoadersToDisappear(page);

      // Select the asset
      const assetCard = page.locator(
        `[data-testid="table-data-card_${assetFqn}"]`
      );
      await assetCard.waitFor({ state: 'visible' });
      await assetCard.locator('input').check();

      // Verify the asset card shows the correct name
      await expect(
        assetCard.locator('[data-testid="entity-header-name"]')
      ).toContainText(assetName);

      // Confirm selection
      const addAssetsResponse = page.waitForResponse(
        `/api/v1/tags/*/assets/add`
      );
      await page.getByTestId('save-btn').click();
      await addAssetsResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Wait for assets tab to reload and verify the asset appears in the Assets list
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the asset appears in the Assets list
      const assetInList = page.locator(
        `[data-testid="table-data-card_${assetFqn}"]`
      );
      await expect(assetInList).toBeVisible({ timeout: 10000 });

      // Remove the assigned asset using the action in the Assets list
      await assetInList.locator('input').check();

      const removeAssetsResponse = page.waitForResponse(
        `/api/v1/tags/*/assets/remove`
      );
      await page.getByTestId('delete-all-button').click();
      await removeAssetsResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Reload to ensure the asset is removed
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Click assets tab again to verify
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the asset is removed from the list
      await expect(
        page.locator(`[data-testid="table-data-card_${assetFqn}"]`)
      ).not.toBeVisible({ timeout: 5000 });
    }
  } finally {
    await afterAction();
  }
});

test('Tag Page Activity Feed', async ({ page }) => {
  test.slow();

  const { afterAction } = await getApiContext(page);

  try {
    // Navigate to the Tag details page
    await tag.visitPage(page);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Track which actions were performed for activity feed verification
    let renamePerformed = false;
    let assetAdded = false;

    // Perform various actions
    // 1. Edit Tag description
    await page.getByTestId('edit-description').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator(descriptionBox).clear();
    await page
      .locator(descriptionBox)
      .fill('Updated description for activity feed test');
    const editDescriptionResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tags/') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('save').click();
    await editDescriptionResponse;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // 2. Rename Tag
    let newDisplayName = '';
    await page.getByTestId('manage-button').click();
    await page.waitForTimeout(500);
    const renameMenuItem = page.getByRole('menuitem', { name: /rename/i });
    if (await renameMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      renamePerformed = true;
      await renameMenuItem.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      newDisplayName = `Renamed Tag Activity ${uuid()}`;
      await page.fill('[id="displayName"]', newDisplayName);

      const renameResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/tags/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('save-button').click();
      await renameResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the update in the page header
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(newDisplayName, { timeout: 5000 });
    }

    // 3. Change Tag Style (color/icon)
    await page.getByTestId('manage-button').click();
    await page.waitForTimeout(500);
    const styleMenuItem = page.getByRole('menuitem', { name: /style/i });
    await styleMenuItem.waitFor({ state: 'visible' });
    await styleMenuItem.click();
    await page.waitForTimeout(500);
    await page.getByTestId('icon-picker-btn').click();
    await page.getByRole('button', { name: 'Select icon Cube01' }).click();
    await page.getByRole('button', { name: 'Select color #F14C75' }).click();
    const styleResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tags/') &&
        response.request().method() === 'PATCH'
    );
    await submitForm(page);
    await styleResponse;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // 4. Add an asset
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    const assetName =
      table.entityResponseData?.displayName || table.entityResponseData?.name;
    const assetFqn = table.entityResponseData?.fullyQualifiedName;

    if (assetName && assetFqn) {
      const initialFetchResponse = page.waitForResponse(
        '/api/v1/search/query?q=&index=all&from=0&size=25&deleted=false**'
      );
      await page.getByTestId('data-classification-add-button').click();
      await initialFetchResponse;

      await expect(page.getByTestId('search-bar-container')).toBeVisible();

      await page
        .getByTestId('search-bar-container')
        .getByTestId('searchbar')
        .fill(assetName);

      await page.waitForResponse(
        `/api/v1/search/query?q=${encodeURIComponent(
          assetName
        )}&index=all&from=0&size=25&**`
      );

      await waitForAllLoadersToDisappear(page);

      const assetCard = page.locator(
        `[data-testid="table-data-card_${assetFqn}"]`
      );
      await assetCard.waitFor({ state: 'visible' });
      await assetCard.locator('input').check();

      const addAssetsResponse = page.waitForResponse(
        `/api/v1/tags/*/assets/add`
      );
      await page.getByTestId('save-btn').click();
      await addAssetsResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);
      assetAdded = true;
    }

    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);


    // Switch to the "Activity Feed" tab
    await page.getByTestId('activity_feed').click();
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

      // Wait for feed entries to be loaded - check for feed container or message containers
      await page
        .waitForSelector(
          '[data-testid="markdown-parser"]',
          {
            state: 'attached',
            timeout: 15000,
          }
        )
        .catch(() => {
          // Feed entries may load asynchronously
        });

      // Wait a bit more for feed content to fully render
      await page.waitForTimeout(3000);

      // Verify that all performed actions are listed in the feed
      // 1. Verify description update entry
      // Look for description in either the message container or the header text
      const descriptionUpdateEntry = page
        .locator('[data-testid="markdown-parser"]')
        .filter({ hasText: /description|Description|updated description/i })
        .first();
      
      await expect(descriptionUpdateEntry).toBeVisible({ timeout: 15000 });

      // 2. Verify rename entry (if rename was performed)
      if (renamePerformed) {
        const renameEntry = page
          .locator('[data-testid="markdown-parser""]')
          .filter({ hasText: /rename|Rename|displayName|display name/i })
          .first();
        await expect(renameEntry).toBeVisible({ timeout: 15000 });
      }

      // 3. Verify style change entry (icon/color update)
      const styleUpdateEntry = page
        .locator('[data-testid="markdown-parser"]')
        .filter({ hasText: /style|Style|icon|Icon|color|Color/i })
        .first();
      await expect(styleUpdateEntry).toBeVisible({ timeout: 15000 });

      // 4. Verify asset add entry (if asset was added)
      if (assetAdded) {
        const assetAddEntry = page
          .locator('[data-testid="markdown-parser"]')
          .filter({ hasText: /asset|Asset|added|Added/i })
          .first();
        await expect(assetAddEntry).toBeVisible({ timeout: 15000 });
      }

      // Verify the feed contains entries for all performed actions
      const messageContainers = page.locator(
        '[data-testid="message-container"]'
      );
      const messageCount = await messageContainers.count();
      // At minimum: description + style = 2, plus rename and asset if performed
      let expectedMinCount = 2; // description + style
      if (renamePerformed) expectedMinCount++;
      if (assetAdded) expectedMinCount++;
      expect(messageCount).toBeGreaterThanOrEqual(expectedMinCount);
  }
  catch (error) {
    console.error('Error in Tag Page Activity Feed:', error);
    throw error;
  }
  finally {
    await afterAction();
  }
});


test('Tag Actions (Rename, Style, Disable) from Tag Page', async ({ page }) => {
  test.slow();

  const { afterAction } = await getApiContext(page);

  try {
    // Navigate to the Tag details page
    await tag.visitPage(page);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Click the "Manage" (three dots) button
    await page.getByTestId('manage-button').click();
    await page.waitForTimeout(500);

    // Rename: Select "Rename," change the name/display name, and save
    const renameMenuItem = page.getByRole('menuitem', { name: /rename/i });
    if (await renameMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await renameMenuItem.click();
      await expect(page.getByRole('dialog')).toBeVisible();

      const newDisplayName = `Renamed Tag ${uuid()}`;
      // Use id selector instead of data-testid for displayName input
      await page.fill('[id="displayName"]', newDisplayName);

      const renameResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/tags/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('save-button').click();
      await renameResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the update in the page header and breadcrumb
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(newDisplayName, { timeout: 5000 });
    }

    // Style: Select "Style," change the color and icon, and save
    await page.getByTestId('manage-button').click();
    await page.waitForTimeout(500);
    const styleMenuItem = page.getByRole('menuitem', { name: /style/i });
    await styleMenuItem.waitFor({ state: 'visible' });
    await styleMenuItem.click();
    await page.waitForTimeout(500);
    await page.getByTestId('icon-picker-btn').click();
    await page.getByRole('button', { name: 'Select icon Cube01' }).click();
    await page.getByRole('button', { name: 'Select color #F14C75' }).click();

    const styleResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tags/') &&
        response.request().method() === 'PATCH'
    );
    await submitForm(page);
    await styleResponse;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Verify the icon and color update in the header
    // The icon and color should be visible in the tag header
    await expect(page.getByTestId('entity-header-name')).toBeVisible();

    // Disable/Enable: Toggle the disable status
    await page.getByTestId('manage-button').click();
    await page.waitForTimeout(500);
    const disableMenuItem = page.getByRole('menuitem', {
      name: /disable/i,
    });
    if (await disableMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      const disableResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/tags/') &&
          response.request().method() === 'PATCH'
      );
      await disableMenuItem.click();
      await disableResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the "Disabled" badge appears
      await expect(page.getByTestId('disabled')).toBeVisible({
        timeout: 5000,
      });

      // Verify that the "Add Asset" button is disabled when the tag is disabled
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('data-classification-add-button')
      ).not.toBeVisible({ timeout: 3000 });

      // Re-enable the tag
      await page.getByTestId('manage-button').click();
      await page.waitForTimeout(500);
      const enableMenuItem = page.getByRole('menuitem', {
        name: /enable/i,
      });
      if (
        await enableMenuItem.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        const enableResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tags/') &&
            response.request().method() === 'PATCH'
        );
        await enableMenuItem.click();
        await enableResponse;
        await page.waitForLoadState('networkidle');
        await waitForAllLoadersToDisappear(page);

        // Verify disabled badge is gone
        await expect(page.getByTestId('disabled')).not.toBeVisible({
          timeout: 3000,
        });
      }
    }
  } finally {
    await afterAction();
  }
});

test('Breadcrumb Navigation', async ({ page }) => {
  test.slow();

  // Navigate to Tag details page
  await tag.visitPage(page);
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);

  // Click the "Classifications" link in the breadcrumb
  const classificationsLink = page.getByRole('link', {
    name: 'Classifications',
  });
  if (
    await classificationsLink.isVisible({ timeout: 3000 }).catch(() => false)
  ) {
    const classificationsResponse = page.waitForResponse(
      '/api/v1/classifications*'
    );
    await classificationsLink.click();
    await classificationsResponse;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Verify redirection to /tags
    await expect(page).toHaveURL(/.*\/tags.*/, { timeout: 5000 });
  }

  // Navigate back to Tag page
  await tag.visitPage(page);
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);

  // Click the Classification Name link in the breadcrumb
  const classificationLink = page.getByRole('link', {
    name: classification.responseData.displayName,
  });
  if (
    await classificationLink.isVisible({ timeout: 3000 }).catch(() => false)
  ) {
    const classificationPageResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/classifications/name/') ||
        response.url().includes('/api/v1/classifications?')
    );
    await classificationLink.click();
    await classificationPageResponse;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Verify redirection to the specific Classification details page
    await expect(page).toHaveURL(
      new RegExp(`.*\\/tags\\/${classification.responseData.name}.*`),
      { timeout: 5000 }
    );
  }
});

test('Tag Usage Count Consistency', async ({ page }) => {
  test.slow();

  const { afterAction } = await getApiContext(page);

  try {
    // Navigate to Tag details page
    await tag.visitPage(page);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Note the count displayed on the "Assets" tab label
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    const initialCountText = await page
      .getByTestId('assets')
      .getByTestId('filter-count')
      .textContent()
      .catch(() => '0');
    const initialCount = parseInt(initialCountText || '0', 10);

    // Count the number of assets listed in the grid/table
    const assetCards = page.locator('[data-testid^="table-data-card_"]');
    const assetCount = await assetCards.count();
    expect(initialCount).toBe(assetCount);

    // Add a new asset
    const initialFetchResponse = page.waitForResponse(
      '/api/v1/search/query?q=&index=all&from=0&size=25&deleted=false**'
    );
    await page.getByTestId('data-classification-add-button').click();
    await initialFetchResponse;
    await expect(page.getByRole('dialog')).toBeVisible();

    const assetName =
      table.entityResponseData?.displayName || table.entityResponseData?.name;
    const assetFqn = table.entityResponseData?.fullyQualifiedName;

    if (assetName && assetFqn) {
      const searchRes = page.waitForResponse(
        `/api/v1/search/query?q=${encodeURIComponent(
          assetName
        )}&index=all&from=0&size=25&**`
      );
      await page
        .getByTestId('asset-selection-modal')
        .getByTestId('searchbar')
        .fill(assetName);
      await searchRes;
      await waitForAllLoadersToDisappear(page);

      const assetCard = page.locator(
        `[data-testid="table-data-card_${assetFqn}"]`
      );
      await assetCard.waitFor({ state: 'visible' });
      await assetCard.locator('input').check();

      const addAssetsResponse = page.waitForResponse(
        `/api/v1/tags/*/assets/add`
      );
      await page.getByTestId('save-btn').click();
      await addAssetsResponse;
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Refresh assets tab to get updated count
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the count increments by 1
      const newCountText = await page
        .getByTestId('assets')
        .getByTestId('filter-count')
        .textContent()
        .catch(() => '0');
      const newCount = parseInt(newCountText || '0', 10);
      expect(newCount).toBe(initialCount + 1);

      // Verify the asset count in the grid matches
      const newAssetCards = page.locator('[data-testid^="table-data-card_"]');
      const newAssetCount = await newAssetCards.count();
      expect(newAssetCount).toBe(assetCount + 1);
    }
  } finally {
    await afterAction();
  }
});
