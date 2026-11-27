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
import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { settleAll } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  createNewPage,
  fillDescriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  classificationTagPickerRow,
  escapeESReservedCharacters,
  getEncodedFqn,
  openClassificationTagPicker,
} from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const userClassification = new ClassificationClass();
const systemClassification = new ClassificationClass({
  name: 'PII',
  displayName: 'PII',
  provider: 'system',
});

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await userClassification.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await userClassification.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Edit a user classification from the manage button', async ({ page }) => {
  test.slow();

  await userClassification.visitPage(page);

  await page.click('[data-testid="manage-button"]');

  await expect(page.getByTestId('edit-classification')).toBeVisible();

  await page.click('[data-testid="edit-classification"]');

  // The same drawer used for "Add" opens in edit mode and pre-filled
  await expect(page.getByTestId('tags-form')).toBeVisible();
  await expect(page.getByTestId('drawer-heading')).toContainText(
    'Edit Classification'
  );

  const nameField = page.getByTestId('name').getByRole('textbox');

  await expect(nameField).toHaveValue(userClassification.responseData.name);
  // Name is editable for a user (non-system) classification
  await expect(nameField).toBeEnabled();

  const updatedDisplayName = `Edited-${uuid()}`;
  await page
    .getByTestId('displayName')
    .getByRole('textbox')
    .fill(updatedDisplayName);

  const patchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/api/v1/classifications/')
  );
  await page.click('[data-testid="save-button"]');
  await patchResponse;

  await expect(page.getByTestId('tags-form')).not.toBeVisible();
  await expect(page.getByTestId('entity-header-display-name')).toContainText(
    updatedDisplayName
  );
});

test('System classification name is disabled in the edit drawer', async ({
  page,
}) => {
  await systemClassification.visitPage(page);

  await page.click('[data-testid="manage-button"]');

  await expect(page.getByTestId('edit-classification')).toBeVisible();

  await page.click('[data-testid="edit-classification"]');

  await expect(page.getByTestId('tags-form')).toBeVisible();
  // System-provided classification name must not be editable
  await expect(page.getByTestId('name').getByRole('textbox')).toBeDisabled();

  await page.click('[data-testid="cancel-button"]');

  await expect(page.getByTestId('tags-form')).not.toBeVisible();
});

test.describe(
  'Child tag creation',
  { tag: ['@Pages', DOMAIN_TAGS.GOVERNANCE] },
  () => {
    let classification: ClassificationClass;
    let parent: TagClass;
    let table: TableClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      classification = new ClassificationClass();
      table = new TableClass();
      parent = new TagClass({
        classification: classification.data.name,
        name: 'Contact.Details',
      });

      try {
        await settleAll([
          classification.create(apiContext),
          table.create(apiContext),
        ]);
        await parent.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        if (table?.entityResponseData.id) {
          await table.delete(apiContext);
        }
      } finally {
        try {
          if (classification?.responseData.id) {
            await classification.delete(apiContext);
          }
        } finally {
          await afterAction();
        }
      }
    });

    test('Creates a child tag and preserves it on a tagged table', async ({
      page,
    }) => {
      test.slow();

      const parentFqn = parent.responseData.fullyQualifiedName;
      const childName = `Email-${uuid()}`;
      const childFqn =
        await test.step('Create the child from its parent row', async () => {
          await classification.visitPage(page);
          await page
            .getByRole('row')
            .filter({
              has: page.getByRole('link', {
                name: parent.data.name,
                exact: true,
              }),
            })
            .getByTestId('add-child-tag-button')
            .click();

          const drawer = page.getByTestId('tag-form-drawer');
          await expect(drawer).toContainText(parentFqn);
          await drawer.getByTestId('name').getByRole('textbox').fill(childName);
          await fillDescriptionBox(drawer, 'Email contact information');

          const createResponse = waitForResponseWithStatus(
            page,
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname === '/api/v1/tags',
            201
          );
          await clickIgnoringToasts(drawer.getByTestId('save-button'));
          const response = await createResponse;
          expect(response.request().postDataJSON()).toMatchObject({
            name: childName,
            parent: parentFqn,
          });
          const { fullyQualifiedName }: { fullyQualifiedName: string } =
            await response.json();
          expect(fullyQualifiedName).toBe(`${parentFqn}.${childName}`);
          await expect(drawer).toBeHidden();

          const childLink = page.getByRole('link', {
            name: childName,
            exact: true,
          });
          await expect(
            page.getByRole('row').filter({ has: childLink })
          ).toContainText(parentFqn);
          const tagDetails = waitForResponseWithStatus(
            page,
            (response) =>
              response.request().method() === 'GET' &&
              new URL(response.url()).pathname ===
                `/api/v1/tags/name/${getEncodedFqn(fullyQualifiedName)}`,
            200
          );
          await childLink.click();
          await tagDetails;

          return fullyQualifiedName;
        });

      const tagsWidget = page.getByTestId('KnowledgePanel.Tags');
      const appliedTag = tagsWidget.getByTestId(`tag-${childFqn}`);

      await test.step('Apply the indexed child tag to the table', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        try {
          await waitForSearchIndexed(apiContext, childFqn, 'tag');
        } finally {
          await afterAction();
        }
        await table.visitEntityPage(page);

        const waitForTagSearch = (query: string) =>
          waitForResponseWithStatus(
            page,
            (response) => {
              const url = new URL(response.url());

              return (
                response.request().method() === 'GET' &&
                url.pathname === '/api/v1/search/query' &&
                url.searchParams.get('index') === 'tag' &&
                url.searchParams.get('q') === query
              );
            },
            200
          );
        const initialTags = waitForTagSearch('');
        await openClassificationTagPicker(
          page,
          tagsWidget.getByTestId('add-tag')
        );
        await initialTags;

        const optionResponse = waitForTagSearch(
          `*${escapeESReservedCharacters(childName)}*`
        );
        await page
          .getByTestId('classification-tag-picker-search')
          .fill(childName);
        await optionResponse;

        const option = classificationTagPickerRow(page, childFqn);
        await expect(option).toHaveText(`${childName} (${parentFqn})`);
        await option.click();

        const patchResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.request().method() === 'PATCH' &&
            new URL(response.url()).pathname ===
              `/api/v1/tables/${table.entityResponseData.id}`,
          200
        );
        await clickIgnoringToasts(page.getByTestId('update-btn'));
        expect((await (await patchResponse).json()).tags).toContainEqual(
          expect.objectContaining({ tagFQN: childFqn })
        );
        await expect(appliedTag).toHaveText(childName);
      });

      await test.step('Verify the same tag after reloading the asset', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(appliedTag).toHaveText(childName);
      });
    });
  }
);
