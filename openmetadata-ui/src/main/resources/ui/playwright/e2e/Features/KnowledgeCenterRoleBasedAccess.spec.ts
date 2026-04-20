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
import { expect, Page, test as base } from '@playwright/test';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { test as testWithRolesPages } from '../fixtures/pages';
import { navigateToKnowledgeCenter } from '../../utils/KnowledgeCenter';

let testUser: UserClass;
const testPolicy = new PolicyClass();
const testRole = new RolesClass();

const test = base.extend<{
  userPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await testUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  testUser = new UserClass();
  await testUser.create(apiContext, false);

  const policyRules = [
    {
      name: `KnowledgeCenterPagePolicy-${uuid()}`,
      resources: ['page'],
      operations: ['ViewAll'],
      effect: 'allow',
    },
  ];

  await testPolicy.create(apiContext, policyRules);
  await testRole.create(apiContext, [testPolicy.responseData.name]);

  await testUser.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: {
          id: testRole.responseData.id,
          type: 'role',
          name: testRole.responseData.name,
        },
      },
    ],
  });

  await afterAction();
});

test('Knowledge Center ViewAll role based access validations', async ({
  userPage,
}) => {
  await navigateToKnowledgeCenter(userPage);

  const addButton = userPage.getByTestId('add-knowledge-page-btn');
  await expect(addButton).not.toBeVisible();

  const articleResponse = userPage.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/knowledgeCenter/') &&
      response.request().method() === 'GET'
  );

  await userPage
    .getByTestId('knowledge-pages-hierarchy')
    .getByRole('link')
    .first()
    .click();

  await articleResponse;

  await userPage.waitForSelector('.ant-skeleton-active', {
    state: 'detached',
  });

  await expect(
    userPage.getByTestId('entity-header-display-name')
  ).toHaveAttribute('readOnly', '');

  // Verify add domain button is not visible
  await expect(userPage.getByTestId('add-domain')).not.toBeVisible();

  // Verify add data product button is not visible
  await expect(
    userPage
      .getByTestId('KnowledgePanel.DataProducts')
      .getByTestId('data-products-container')
      .getByTestId('add-data-product')
  ).not.toBeVisible();

  // Verify add reviewer button is not visible
  await expect(userPage.getByTestId('Add')).not.toBeVisible();

  // Verify edit owner button is not visible
  await expect(userPage.getByTestId('edit-owner')).not.toBeVisible();

  // Verify add tags button is not visible
  await expect(
    userPage
      .getByTestId('KnowledgePanel.Tags')
      .getByTestId('tags-container')
      .getByTestId('add-tag')
  ).not.toBeVisible();

  // Verify add glossary terms button is not visible
  await expect(
    userPage
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
  ).not.toBeVisible();

  // Verify related data assets add button is not visible
  await expect(userPage.getByTestId('related-data-assets')).not.toBeVisible();
});

testWithRolesPages(
  'Data Consumer can view and edit content but cannot add article, domain, reviewer, data product, or data assets',
  async ({ dataConsumerPage }) => {
    await navigateToKnowledgeCenter(dataConsumerPage);

    const addButton = dataConsumerPage.getByTestId('add-knowledge-page-btn');
    await expect(addButton).not.toBeVisible();

    const articleResponse = dataConsumerPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/knowledgeCenter/') &&
        response.request().method() === 'GET'
    );

    await dataConsumerPage
      .getByTestId('knowledge-pages-hierarchy')
      .getByRole('link')
      .first()
      .click();

    await articleResponse;

    await dataConsumerPage.waitForURL(/\/knowledge-center\/.*/);

    await dataConsumerPage.waitForSelector('.ant-skeleton-active', {
      state: 'detached',
    });

    await expect(
      dataConsumerPage.getByTestId('entity-header-display-name')
    ).toBeVisible();

    const editor = dataConsumerPage.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('contenteditable', 'true');

    await expect(dataConsumerPage.getByTestId('add-domain')).not.toBeVisible();

    await expect(
      dataConsumerPage
        .getByTestId('KnowledgePanel.DataProducts')
        .getByTestId('data-products-container')
        .getByTestId('add-data-product')
    ).not.toBeVisible();

    await expect(dataConsumerPage.getByTestId('Add')).not.toBeVisible();

    await expect(dataConsumerPage.getByTestId('edit-owner')).not.toBeVisible();

    const ownerLabel = dataConsumerPage.getByTestId('owner-label');
    const hasOwner = await ownerLabel
      .getByTestId('owner-link')
      .first()
      .isVisible();

    if (hasOwner) {
      await expect(dataConsumerPage.getByTestId('add-owner')).not.toBeVisible();
    } else {
      await expect(dataConsumerPage.getByTestId('add-owner')).toBeVisible();
    }

    await expect(
      dataConsumerPage.getByTestId('add-data-assets-container')
    ).not.toBeVisible();
    await expect(
      dataConsumerPage.getByTestId('edit-data-assets')
    ).not.toBeVisible();
  }
);

testWithRolesPages(
  'Data Steward can edit content, title, owners, tags, and glossary terms but cannot add article, domain, reviewer, data product, or data assets',
  async ({ dataStewardPage }) => {
    await navigateToKnowledgeCenter(dataStewardPage);

    const addButton = dataStewardPage.getByTestId('add-knowledge-page-btn');
    await expect(addButton).not.toBeVisible();

    const articleResponse = dataStewardPage.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/knowledgeCenter/') &&
        response.request().method() === 'GET'
    );

    await dataStewardPage
      .getByTestId('knowledge-pages-hierarchy')
      .getByRole('link')
      .first()
      .click();

    await articleResponse;

    await dataStewardPage.waitForURL(/\/knowledge-center\/.*/);

    await dataStewardPage.waitForSelector('.ant-skeleton-active', {
      state: 'detached',
    });

    await expect(
      dataStewardPage.getByTestId('entity-header-display-name')
    ).toBeVisible();

    const titleInput = dataStewardPage.getByTestId(
      'entity-header-display-name'
    );
    await expect(titleInput).not.toHaveAttribute('readOnly', '');
    const editor = dataStewardPage.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('contenteditable', 'true');

    const ownerLabel = dataStewardPage.getByTestId('owner-label');
    const hasOwner = await ownerLabel
      .getByTestId('owner-link')
      .first()
      .isVisible();

    if (hasOwner) {
      await expect(dataStewardPage.getByTestId('edit-owner')).toBeVisible();
      await expect(dataStewardPage.getByTestId('add-owner')).not.toBeVisible();
    } else {
      await expect(dataStewardPage.getByTestId('add-owner')).toBeVisible();
      await expect(dataStewardPage.getByTestId('edit-owner')).not.toBeVisible();
    }

    const rightPanel = dataStewardPage.getByTestId('right-panel');
    await rightPanel.evaluate((el) => el.scrollTo(0, el.scrollHeight));

    await expect(
      dataStewardPage.getByTestId('tags-container').getByTestId('add-tag')
    ).toBeVisible();

    await expect(dataStewardPage.getByTestId('add-domain')).not.toBeVisible();

    await expect(
      dataStewardPage
        .getByTestId('data-products-container')
        .getByTestId('add-data-product')
    ).not.toBeVisible();
    await expect(dataStewardPage.getByTestId('Add')).not.toBeVisible();

    await expect(
      dataStewardPage.getByTestId('add-data-assets-container')
    ).not.toBeVisible();
    await expect(
      dataStewardPage.getByTestId('edit-data-assets')
    ).not.toBeVisible();
  }
);
