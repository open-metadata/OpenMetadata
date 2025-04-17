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
import { Domain } from '../../support/domain/Domain';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  addAssetsToTag,
  editTagPageDescription,
  LIMITED_USER_RULES,
  removeAssetsFromTag,
  setupAssetsForTag,
  submitForm,
  validateForm,
  verifyCertificationTagPageUI,
  verifyTagPageUI,
} from '../../utils/tag';

const adminUser = new UserClass();
const dataConsumerUser = new UserClass();
const dataStewardUser = new UserClass();
const limitedAccessUser = new UserClass();

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
  limitedAccessPage: Page;
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
  limitedAccessPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await limitedAccessUser.login(page);
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
  await limitedAccessUser.create(apiContext);
  await classification.create(apiContext);
  await tag.create(apiContext);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await dataConsumerUser.delete(apiContext);
  await dataStewardUser.delete(apiContext);
  await limitedAccessUser.delete(apiContext);
  await classification.delete(apiContext);
  await tag.delete(apiContext);
  await afterAction();
});

test.describe('Tag Page with Admin Roles', () => {
  test.slow(true);

  test('Verify Tag UI', async ({ adminPage }) => {
    await verifyTagPageUI(adminPage, classification.data.name, tag);
  });

  test('Certification Page should not have Asset button', async ({
    adminPage,
  }) => {
    await verifyCertificationTagPageUI(adminPage);
  });

  test('Rename Tag name', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
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
  });

  test('Restyle Tag', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
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

    await adminPage.waitForLoadState('networkidle');

    await expect(adminPage.getByText(tag.data.name)).toBeVisible();
  });

  test('Edit Tag Description', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const res = adminPage.waitForResponse(`/api/v1/tags/name/*`);
    await tag.visitPage(adminPage);
    await res;
    await adminPage.getByTestId('edit-description').click();

    await expect(adminPage.getByRole('dialog')).toBeVisible();

    await adminPage.locator(descriptionBox).clear();
    await adminPage
      .locator(descriptionBox)
      .fill(`This is updated test description for tag ${tag.data.name}.`);

    const editDescription = adminPage.waitForResponse(`/api/v1/tags/*`);
    await adminPage.getByTestId('save').click();
    await editDescription;

    await expect(adminPage.getByTestId('viewer-container')).toContainText(
      `This is updated test description for tag ${tag.data.name}.`
    );
  });

  test('Delete a Tag', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
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
  });

  test('Add and Remove Assets', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const { assets, assetCleanup } = await setupAssetsForTag(adminPage);

    await test.step('Add Asset ', async () => {
      await addAssetsToTag(adminPage, assets, tag);
    });

    await test.step('Delete Asset', async () => {
      await removeAssetsFromTag(adminPage, assets, tag);
      await assetCleanup();
    });
  });
});

test.describe('Tag Page with Data Consumer Roles', () => {
  test.slow(true);

  test('Verify Tag UI for Data Consumer', async ({ dataConsumerPage }) => {
    await verifyTagPageUI(
      dataConsumerPage,
      classification.data.name,
      tag,
      true
    );
  });

  test('Certification Page should not have Asset button for Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await verifyCertificationTagPageUI(dataConsumerPage);
  });

  test('Edit Tag Description for Data Consumer', async ({
    dataConsumerPage,
  }) => {
    await editTagPageDescription(dataConsumerPage, tag);
  });

  test('Add and Remove Assets for Data Consumer', async ({
    adminPage,
    dataConsumerPage,
  }) => {
    const { assets, assetCleanup } = await setupAssetsForTag(adminPage);
    await redirectToHomePage(dataConsumerPage);

    await test.step('Add Asset ', async () => {
      await addAssetsToTag(dataConsumerPage, assets, tag);
    });

    await test.step('Delete Asset', async () => {
      await removeAssetsFromTag(dataConsumerPage, assets, tag);
      await assetCleanup();
    });
  });
});

test.describe('Tag Page with Data Steward Roles', () => {
  test.slow(true);

  test('Verify Tag UI for Data Steward', async ({ dataStewardPage }) => {
    await verifyTagPageUI(dataStewardPage, classification.data.name, tag, true);
  });

  test('Certification Page should not have Asset button for Data Steward', async ({
    dataStewardPage,
  }) => {
    await verifyCertificationTagPageUI(dataStewardPage);
  });

  test('Edit Tag Description for Data Steward', async ({ dataStewardPage }) => {
    await editTagPageDescription(dataStewardPage, tag);
  });

  test('Add and Remove Assets for Data Steward', async ({
    adminPage,
    dataStewardPage,
  }) => {
    const { assets, assetCleanup } = await setupAssetsForTag(adminPage);
    await redirectToHomePage(dataStewardPage);

    await test.step('Add Asset ', async () => {
      await addAssetsToTag(dataStewardPage, assets, tag);
    });

    await test.step('Delete Asset', async () => {
      await removeAssetsFromTag(dataStewardPage, assets, tag);
      await assetCleanup();
    });
  });
});

test.describe('Tag Page with Limited EditTag Permission', () => {
  test.slow(true);

  test('Add and Remove Assets and Check Restricted Entity', async ({
    adminPage,
    limitedAccessPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const { assets, otherAsset, assetCleanup } = await setupAssetsForTag(
      adminPage
    );
    const id = uuid();
    const policy = new PolicyClass();
    const role = new RolesClass();
    let limitedAccessTeam: TeamClass | null = null;

    try {
      await policy.create(apiContext, LIMITED_USER_RULES);
      await role.create(apiContext, [policy.responseData.name]);

      limitedAccessTeam = new TeamClass({
        name: `PW%limited_user_access_team-${id}`,
        displayName: `PW Limited User Access Team ${id}`,
        description: 'playwright data steward team description',
        teamType: 'Group',
        users: [limitedAccessUser.responseData.id],
        defaultRoles: role.responseData.id ? [role.responseData.id] : [],
      });
      await limitedAccessTeam.create(apiContext);

      await redirectToHomePage(limitedAccessPage);

      await test.step('Add Asset ', async () => {
        await addAssetsToTag(limitedAccessPage, assets, tag, otherAsset);
      });

      await test.step('Delete Asset', async () => {
        await removeAssetsFromTag(limitedAccessPage, assets, tag);
      });
    } finally {
      await tag.delete(apiContext);
      await policy.delete(apiContext);
      await role.delete(apiContext);
      if (limitedAccessTeam) {
        await limitedAccessTeam.delete(apiContext);
      }
      await assetCleanup();
      await afterAction();
    }
  });
});

test.describe('Create tag with domain', () => {
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

  test('Create tag with domain', async ({ adminPage, request }) => {
    await test.step(
      'Create classification with validation checks',
      async () => {
        await redirectToHomePage(adminPage);
        await classification.visitPage(adminPage);
        await adminPage.click('[data-testid="add-classification"]');
        await adminPage.waitForSelector('.ant-modal-content', {
          state: 'visible',
        });

        await expect(adminPage.locator('.ant-modal-content')).toBeVisible();

        await validateForm(adminPage);

        await adminPage.fill('[data-testid="name"]', NEW_CLASSIFICATION.name);
        await adminPage.fill(
          '[data-testid="displayName"]',
          NEW_CLASSIFICATION.displayName
        );
        await adminPage
          .locator(descriptionBox)
          .fill(NEW_CLASSIFICATION.description);
        await adminPage.click('[data-testid="mutually-exclusive-button"]');

        const createTagCategoryResponse = adminPage.waitForResponse(
          'api/v1/classifications'
        );
        await submitForm(adminPage);
        await createTagCategoryResponse;

        await expect(
          adminPage.locator('[data-testid="modal-container"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="data-summary-container"]')
        ).toContainText(NEW_CLASSIFICATION.displayName);
      }
    );

    const { apiContext } = await getApiContext(adminPage);
    const domain = new Domain();
    await domain.create(apiContext);
    await adminPage.reload();
    await adminPage.click(`text=${NEW_CLASSIFICATION.displayName}`);

    await expect(adminPage.locator('.activeCategory')).toContainText(
      NEW_CLASSIFICATION.displayName
    );

    await adminPage.click('[data-testid="add-new-tag-button"]');

    await adminPage.waitForSelector('.ant-modal-content', {
      state: 'visible',
    });

    await expect(adminPage.locator('.ant-modal-content')).toBeVisible();

    await validateForm(adminPage);

    await adminPage.fill('[data-testid="name"]', NEW_TAG.name);
    await adminPage.fill('[data-testid="displayName"]', NEW_TAG.displayName);
    await adminPage.locator(descriptionBox).fill(NEW_TAG.description);
    await adminPage.fill('[data-testid="icon-url"]', NEW_TAG.icon);
    await adminPage.fill(
      '[data-testid="tags_color-color-input"]',
      NEW_TAG.color
    );
    await adminPage.click('[data-testid="add-domain"]');

    await adminPage
      .getByTestId(`tag-${domain.responseData.fullyQualifiedName}`)
      .click();

    const createTagResponse = adminPage.waitForResponse((response) => {
      if (response.url().includes('api/v1/tags')) {
        return (
          response.request().postDataJSON().domain ===
          domain.responseData.fullyQualifiedName
        );
      }

      return false;
    });
    await submitForm(adminPage);
    await createTagResponse;
  });
});
