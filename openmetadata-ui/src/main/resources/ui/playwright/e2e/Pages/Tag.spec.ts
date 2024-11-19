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
import { DATA_STEWARD_RULES } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAssetsToTag,
  checkAssetsCount,
  removeAssetsFromTag,
  setupAssetsForTag,
  verifyTagPageUI,
} from '../../utils/tag';

const adminUser = new UserClass();
const dataConsumerUser = new UserClass();
const dataStewardUser = new UserClass();
const policy = new PolicyClass();
const role = new RolesClass();
const classification = new ClassificationClass({
  provider: 'system',
  mutuallyExclusive: true,
});
const tag = new TagClass({
  classification: classification.data.name,
});

const test = base.extend<{
  adminPage: Page;
  dataConsumerPage: Page;
  dataStewardPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
  dataStewardPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataStewardUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await dataConsumerUser.create(apiContext);
  await dataStewardUser.create(apiContext);
  await dataStewardUser.setDataStewardRole(apiContext);
  await policy.create(apiContext, DATA_STEWARD_RULES);
  await role.create(apiContext, [policy.responseData.name]);
  await classification.create(apiContext);
  await tag.create(apiContext);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await dataConsumerUser.delete(apiContext);
  await dataStewardUser.delete(apiContext);
  await policy.delete(apiContext);
  await role.delete(apiContext);
  await classification.delete(apiContext);
  await tag.delete(apiContext);
  await afterAction();
});

test.describe('Tag Page with Admin Roles', () => {
  test.slow(true);

  test('Verify Tag UI', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await verifyTagPageUI(adminPage, classification.data.name, tag);
  });

  test('Rename Tag name', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = adminPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(adminPage);
      await res;
      await adminPage.getByTestId('manage-button').click();

      await expect(
        adminPage.locator('.ant-dropdown-placement-bottomRight')
      ).toBeVisible();

      await adminPage.getByRole('menuitem', { name: 'Rename' }).click();

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage
        .getByPlaceholder('Enter display name')
        .fill('TestDisplayName');

      const updateName = adminPage.waitForResponse(`/api/v1/tags/*`);
      await adminPage.getByTestId('save-button').click();
      updateName;

      await expect(adminPage.getByText('TestDisplayName')).toBeVisible();
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Restyle Tag', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = adminPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(adminPage);
      await res;
      await adminPage.getByTestId('manage-button').click();

      await expect(
        adminPage.locator('.ant-dropdown-placement-bottomRight')
      ).toBeVisible();

      await adminPage.getByRole('menuitem', { name: 'Style' }).click();

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage.getByTestId('color-color-input').fill('#6366f1');

      const updateColor = adminPage.waitForResponse(`/api/v1/tags/*`);
      await adminPage.locator('button[type="submit"]').click();
      updateColor;

      await expect(adminPage.getByText(tag.data.name)).toBeVisible();
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Edit Tag Description', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = adminPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(adminPage);
      await res;
      await adminPage.getByTestId('edit-description').click();

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage.locator('.toastui-editor-pseudo-clipboard').clear();
      await adminPage
        .locator('.toastui-editor-pseudo-clipboard')
        .fill(`This is updated test description for tag ${tag.data.name}.`);

      const editDescription = adminPage.waitForResponse(`/api/v1/tags/*`);
      await adminPage.getByTestId('save').click();
      await editDescription;

      await expect(adminPage.getByTestId('viewer-container')).toContainText(
        `This is updated test description for tag ${tag.data.name}.`
      );
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('Delete a Tag', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = adminPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(adminPage);
      await res;
      await adminPage.getByTestId('manage-button').click();

      await expect(
        adminPage.locator('.ant-dropdown-placement-bottomRight')
      ).toBeVisible();

      await adminPage.getByRole('menuitem', { name: 'Delete' }).click();

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteTag = adminPage.waitForResponse(`/api/v1/tags/*`);
      await adminPage.getByTestId('confirm-button').click();
      deleteTag;

      await expect(
        adminPage.getByText(classification.data.description)
      ).toBeVisible();
    } finally {
      await afterAction();
    }
  });

  test('Add and Remove Assets', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    const { assets } = await setupAssetsForTag(adminPage);
    try {
      await tag.create(apiContext);
      const res = adminPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(adminPage);
      await res;

      await test.step('Add Asset', async () => {
        await addAssetsToTag(adminPage, assets);

        await expect(
          adminPage.locator('[role="dialog"].ant-modal')
        ).not.toBeVisible();
      });

      await test.step('Delete Asset', async () => {
        await removeAssetsFromTag(adminPage, assets);
        await checkAssetsCount(adminPage, 0);
      });
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Tag Page with Data Consumer Roles', () => {
  test.slow(true);

  test('Verify Tag UI for Data Consumer', async ({ dataConsumerPage }) => {
    await redirectToHomePage(dataConsumerPage);
    await verifyTagPageUI(dataConsumerPage, classification.data.name, tag);

    await expect(
      dataConsumerPage.getByTestId('data-classification-add-button')
    ).not.toBeVisible();
    await expect(
      dataConsumerPage.getByTestId('manage-button')
    ).not.toBeVisible();
    await expect(dataConsumerPage.getByTestId('add-domain')).not.toBeVisible();
  });

  test('Edit Tag Description or Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);
    const { apiContext, afterAction } = await getApiContext(dataConsumerPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = dataConsumerPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(dataConsumerPage);
      await res;
      await dataConsumerPage.getByTestId('edit-description').click();

      await expect(dataConsumerPage.getByRole('dialog')).toBeVisible();

      await dataConsumerPage
        .locator('.toastui-editor-pseudo-clipboard')
        .clear();
      await dataConsumerPage
        .locator('.toastui-editor-pseudo-clipboard')
        .fill(`This is updated test description for tag ${tag.data.name}.`);

      const editDescription =
        dataConsumerPage.waitForResponse(`/api/v1/tags/*`);
      await dataConsumerPage.getByTestId('save').click();
      await editDescription;

      await expect(
        dataConsumerPage.getByTestId('viewer-container')
      ).toContainText(
        `This is updated test description for tag ${tag.data.name}.`
      );
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });
});

test.describe('Tag Page with Data Steward Roles', () => {
  test.slow(true);

  test('Verify Tag UI for Data Steward', async ({ dataStewardPage }) => {
    await redirectToHomePage(dataStewardPage);
    await verifyTagPageUI(dataStewardPage, classification.data.name, tag);

    await expect(
      dataStewardPage.getByTestId('data-classification-add-button')
    ).not.toBeVisible();
    await expect(
      dataStewardPage.getByTestId('manage-button')
    ).not.toBeVisible();
    await expect(dataStewardPage.getByTestId('add-domain')).not.toBeVisible();
  });

  test('Edit Tag Description for Data Steward', async ({ dataStewardPage }) => {
    await redirectToHomePage(dataStewardPage);
    const { apiContext, afterAction } = await getApiContext(dataStewardPage);
    const tag = new TagClass({
      classification: classification.data.name,
    });
    try {
      await tag.create(apiContext);
      const res = dataStewardPage.waitForResponse(`/api/v1/tags/name/*`);
      await tag.visitPage(dataStewardPage);
      await res;
      await dataStewardPage.getByTestId('edit-description').click();

      await expect(dataStewardPage.getByRole('dialog')).toBeVisible();

      await dataStewardPage.locator('.toastui-editor-pseudo-clipboard').clear();
      await dataStewardPage
        .locator('.toastui-editor-pseudo-clipboard')
        .fill(`This is updated test description for tag ${tag.data.name}.`);

      const editDescription = dataStewardPage.waitForResponse(`/api/v1/tags/*`);
      await dataStewardPage.getByTestId('save').click();
      await editDescription;

      await expect(
        dataStewardPage.getByTestId('viewer-container')
      ).toContainText(
        `This is updated test description for tag ${tag.data.name}.`
      );
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });
});
