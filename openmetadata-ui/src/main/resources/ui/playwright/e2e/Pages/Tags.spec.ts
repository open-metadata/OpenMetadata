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
import { TableClass } from '../../support/entity/TableClass';
import {
  clickOutside,
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';
import { submitForm, validateForm } from '../../utils/tag';

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

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
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

    expect(headers).toEqual(['Tag', 'Display Name', 'Description', 'Actions']);
  });

  await test.step('Create classification with validation checks', async () => {
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
    await page.fill(descriptionBox, NEW_CLASSIFICATION.description);
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
    await page.fill(descriptionBox, NEW_TAG.description);
    await page.fill('[data-testid="icon-url"]', NEW_TAG.icon);
    await page.fill('[data-testid="tags_color-color-input"]', NEW_TAG.color);

    const createTagResponse = page.waitForResponse('api/v1/tags');
    await submitForm(page);
    await createTagResponse;

    await expect(page.locator('[data-testid="table"]')).toContainText(
      NEW_TAG.name
    );
  });

  await test.step(`Assign tag to table`, async () => {
    await table.visitEntityPage(page);
    const { name, displayName } = NEW_TAG;

    await page.click(
      '[data-testid="classification-tags-0"] [data-testid="entity-tags"] [data-testid="add-tag"]'
    );
    await page.fill('[data-testid="tag-selector"] input', name);
    await page.click(`[data-testid="tag-${tagFqn}"]`);

    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).toContainText(displayName);

    const saveAssociatedTag = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .includes(`/api/v1/tables/${table.entityResponseData?.['id']}`)
    );
    await page.click('[data-testid="saveAssociatedTag"]');
    await saveAssociatedTag;

    await page.waitForSelector('.ant-select-dropdown', {
      state: 'detached',
    });

    await expect(
      page
        .getByRole('row', { name: 'user_id numeric Unique' })
        .getByTestId('tags-container')
    ).toContainText(displayName);

    await expect(
      page.locator(
        '[data-testid="classification-tags-0"] [data-testid="tags-container"] [data-testid="icon"]'
      )
    ).toBeVisible();
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
        '/api/v1/search/suggest?q=*&index=user_search_index*team_search_index*'
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

  await test.step(
    'Should have correct tag usage count and redirection should work',
    async () => {
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

      const count = await page
        .locator('[data-testid="usage-count"]')
        .textContent();

      expect(count).toBe('1');

      const getEntityDetailsPage = page.waitForResponse(
        'api/v1/search/query?q=&index=**'
      );
      await page.click('[data-testid="usage-count"]');
      await getEntityDetailsPage;
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

    await expect(
      page
        .locator('[data-testid="data-summary-container"]')
        .filter({ hasText: NEW_CLASSIFICATION.name })
    ).not.toBeVisible();
  });
});
