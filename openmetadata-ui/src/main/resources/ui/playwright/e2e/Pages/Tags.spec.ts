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
import {
  clickOutside,
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { addMultiOwner, removeOwner } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { addTagToTableColumn, submitForm, validateForm } from '../../utils/tag';

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
  color: '#FF5733',
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAACFCAMAAAAKN9SOAAAAA1BMVEXmGSCqexgYAAAAI0lEQVRoge3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAHgaMeAAAUWJHZ4AAAAASUVORK5CYII=',
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

test.fixme('Classification Page', async ({ page }) => {
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

    expect(headers).toEqual(['Tag', 'Display Name', 'Description', 'Actions']);
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

    const fetchTags = page.waitForResponse(
      `/api/v1/tags?fields=usageCount&parent=${classification.responseData.name}*`
    );
    const disabledTag = page.waitForResponse('/api/v1/classifications/*');
    await page.click('[data-testid="enable-disable-title"]');
    await disabledTag;
    await fetchTags;

    await expect(
      page.locator(
        `[data-testid="classification-${classification.responseData.name}"] [data-testid="disabled"]`
      )
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="add-new-tag-button"]')
    ).toBeDisabled();

    await expect(
      page.locator('[data-testid="no-data-placeholder"]')
    ).toBeVisible();

    // Check if the disabled Classification tag is not visible in the table
    await table.visitEntityPage(page);

    await page.click(
      '[data-testid="classification-tags-0"] [data-testid="entity-tags"] [data-testid="add-tag"]'
    );

    const tagResponse = page.waitForResponse(
      `/api/v1/search/query?q=*${tag.responseData.displayName}***`
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
    await page.waitForSelector('.ant-modal-content', {
      state: 'visible',
    });

    await expect(page.locator('.ant-modal-content')).toBeVisible();

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

    await page.waitForSelector('.ant-modal-content', {
      state: 'visible',
    });

    await expect(page.locator('.ant-modal-content')).toBeVisible();

    await validateForm(page);

    await page.fill('[data-testid="name"]', NEW_TAG.name);
    await page.fill('[data-testid="displayName"]', NEW_TAG.displayName);
    await page.locator(descriptionBox).fill(NEW_TAG.description);
    await page.fill('[data-testid="icon-url"]', NEW_TAG.icon);
    await page.fill('[data-testid="tags_color-color-input"]', NEW_TAG.color);

    const createTagResponse = page.waitForResponse('api/v1/tags');
    await submitForm(page);
    await createTagResponse;

    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );
  });

  await test.step('Verify classification term count', async () => {
    // Navigate back to classifications list
    await sidebarClick(page, SidebarItem.TAGS);

    // Wait for classifications to load with termCount field
    const classificationsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/classifications') &&
        response.url().includes('fields=termCount')
    );
    await classificationsResponse;

    // Find the classification in the left panel and verify term count
    const classificationElement = page
      .locator(`[data-testid="side-panel-classification"]`)
      .filter({ hasText: NEW_CLASSIFICATION.displayName });

    // Check if term count is displayed as (1) since we created one tag
    await expect(classificationElement).toContainText('(1)');

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
      tableId: table.entityResponseData?.['id'],
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
        'api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*'
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
      await page.click(
        '.ant-btn-compact-first-item:has-text("Accept Suggestion")'
      );
      await acceptSuggestion;
      await page.click('[data-testid="table"]');

      const databaseSchemasPage = page.waitForResponse(
        'api/v1/databaseSchemas/name/*'
      );
      await page.reload();
      await databaseSchemasPage;

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
    await sidebarClick(page, SidebarItem.TAGS);

    // Wait for classifications to reload with updated termCount
    const classificationsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/classifications') &&
        response.url().includes('fields=termCount')
    );
    await classificationsResponse;

    // Find the classification and verify term count is 0
    const classificationElement = page
      .locator(`[data-testid="side-panel-classification"]`)
      .filter({ hasText: NEW_CLASSIFICATION.displayName });

    // Check if term count is displayed as (0) since we deleted the tag
    await expect(classificationElement).toContainText('(0)');
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

    await user1.visitPage(page);
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

  await sidebarClick(page, SidebarItem.TAGS);

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

  await expect(tierElement.getByTestId('filter-count')).toContainText('5');

  const piiElement = page
    .locator('[data-testid="side-panel-classification"]')
    .filter({ hasText: 'PII' });

  await expect(piiElement.getByTestId('filter-count')).toContainText('3');
});

test('Verify Owner Add Delete', async ({ page }) => {
  await classification1.visitPage(page);
  const OWNER1 = user1.getUserName();

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
    page.locator(`[data-testid="tag-owner-name"]`).getByTestId(OWNER1)
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
