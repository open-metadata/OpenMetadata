/*
 *  Copyright 2025 Collate.
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
import { Page, test as base } from '@playwright/test';
import { startCase } from 'lodash';
import {
  assetsData,
  userWithOwnerPermission,
  userWithTagPermission,
} from '../../constant/conditionalPermissions';
import { performAdminLogin } from '../../utils/admin';
import {
  checkViewAllPermission,
  conditionalPermissionsCleanup,
  conditionalPermissionsPrerequisites,
  getEntityFQN,
} from '../../utils/conditionalPermissions';

const test = base.extend<{
  user1Page: Page;
  user2Page: Page;
}>({
  user1Page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await userWithOwnerPermission.login(page);
    await use(page);
    await page.close();
  },
  user2Page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await userWithTagPermission.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll(async ({ browser }) => {
  test.slow();

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await conditionalPermissionsPrerequisites(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  test.slow();

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await conditionalPermissionsCleanup(apiContext);
  await afterAction();
});

for (const serviceData of assetsData) {
  const {
    asset,
    withOwner,
    withTag,
    assetOwnerUrl,
    assetTagUrl,
    childTabId,
    childTabId2,
    childTableId2,
  } = serviceData;

  test(`User with owner permission can only view owned ${startCase(
    asset
  )}`, async ({ user1Page: page }) => {
    // Get the FQNs of both assets
    const ownerAssetName = getEntityFQN(asset, withOwner);
    const tagAssetName = getEntityFQN(asset, withTag);

    const ownerAssetURL = `${assetOwnerUrl}/${ownerAssetName}`;
    const tagAssetURL = `${assetTagUrl}/${tagAssetName}`;

    await checkViewAllPermission({
      page,
      url1: ownerAssetURL,
      url2: tagAssetURL,
      childTabId,
      childTabId2,
      childTableId2,
    });
  });

  test(`User with matchAnyTag permission can only view ${startCase(
    asset
  )} with the tag`, async ({ user2Page: page }) => {
    // Get the FQNs of both assets
    const ownerAssetName = getEntityFQN(asset, withOwner);
    const tagAssetName = getEntityFQN(asset, withTag);

    const ownerAssetURL = `${assetOwnerUrl}/${ownerAssetName}`;
    const tagAssetURL = `${assetTagUrl}/${tagAssetName}`;

    await checkViewAllPermission({
      page,
      url1: tagAssetURL,
      url2: ownerAssetURL,
      childTabId,
      childTabId2,
      childTableId2,
    });
  });
}
