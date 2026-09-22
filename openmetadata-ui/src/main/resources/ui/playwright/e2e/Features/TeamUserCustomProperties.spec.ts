/*
 *  Copyright 2026 Collate.
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

/**
 * Teams and users are the two custom-property entities that live under Settings rather
 * than in Explore, so they sit outside the entity-page suite in
 * `e2e/Pages/CustomProperties.spec.ts` (its shared block ends in an advanced-search
 * assertion that only applies to searchable data assets). This spec covers the same
 * round trip for them: define a property in Settings, set a value on the entity's
 * Custom Properties tab, read it back, then remove the property.
 */

import { Page } from '@playwright/test';
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import { GlobalSettingOptions } from '../../constant/settings';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { expect, test } from '../../support/fixtures/base';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  setValueForProperty,
  validateValueForProperty,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const STRING_PROPERTY_TYPE = 'String';

// UserClass has no page-visit helper; the profile route takes the user name directly.
const visitUserProfile = async (page: Page, userName: string) => {
  const userDetailsResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/api/v1/users/name/${encodeURIComponent(userName)}`) &&
      response.request().method() === 'GET'
  );

  await page.goto(`/users/${encodeURIComponent(userName)}`);

  expect((await userDetailsResponse).ok()).toBeTruthy();

  await waitForAllLoadersToDisappear(page);
};

test.describe('Team custom properties', () => {
  test.describe.configure({ mode: 'default' });

  const team = new TeamClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await team.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await team.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('set and read a string custom property on a team', async ({ page }) => {
    test.slow();

    const propertyName = `cpTeam${uuid().replace(/-/g, '')}`;
    const propertyValue = `cost-centre-${uuid()}`;

    await settingClick(page, GlobalSettingOptions.TEAMS, true);
    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: CUSTOM_PROPERTIES_ENTITIES.entity_team,
      customType: STRING_PROPERTY_TYPE,
    });

    await team.visitTeamPage(page);
    await setValueForProperty({
      page,
      propertyName,
      value: propertyValue,
      propertyType: 'string',
      endpoint: EntityTypeEndpoint.Teams,
    });
    await validateValueForProperty({
      page,
      propertyName,
      value: propertyValue,
      propertyType: 'string',
    });

    await settingClick(page, GlobalSettingOptions.TEAMS, true);
    await deleteCreatedProperty(page, propertyName);
  });
});

test.describe('User custom properties', () => {
  test.describe.configure({ mode: 'default' });

  const user = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('set and read a string custom property on a user', async ({ page }) => {
    test.slow();

    const propertyName = `cpUser${uuid().replace(/-/g, '')}`;
    const propertyValue = `desk-${uuid()}`;

    await settingClick(page, GlobalSettingOptions.USERS, true);
    await addCustomPropertiesForEntity({
      page,
      propertyName,
      customPropertyData: CUSTOM_PROPERTIES_ENTITIES.entity_user,
      customType: STRING_PROPERTY_TYPE,
    });

    await visitUserProfile(page, user.responseData.name);
    await setValueForProperty({
      page,
      propertyName,
      value: propertyValue,
      propertyType: 'string',
      endpoint: EntityTypeEndpoint.User,
    });
    await validateValueForProperty({
      page,
      propertyName,
      value: propertyValue,
      propertyType: 'string',
    });

    await settingClick(page, GlobalSettingOptions.USERS, true);
    await deleteCreatedProperty(page, propertyName);
  });
});

test.describe('Custom property settings pages', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Settings lists Teams and Users as custom-property entities', async ({
    page,
  }) => {
    const options: SettingOptionsType[] = [
      GlobalSettingOptions.TEAMS,
      GlobalSettingOptions.USERS,
    ];

    for (const option of options) {
      await settingClick(page, option, true);

      await expect(page.getByTestId('add-field-button')).toBeVisible();
    }
  });
});
