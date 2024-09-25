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
import { expect, test as setup } from '@playwright/test';
import { JWT_EXPIRY_TIME_MAP } from '../constant/login';
import { GlobalSettingOptions } from '../constant/settings';
import { AdminClass } from '../support/user/AdminClass';
import { getApiContext } from '../utils/common';
import { updateJWTTokenExpiryTime } from '../utils/login';
import { settingClick } from '../utils/sidebar';
import { removeOrganizationPolicyAndRole } from '../utils/team';
const adminFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  const admin = new AdminClass();

  // login with admin user
  await admin.login(page);
  await page.waitForURL('**/my-data');
  const { apiContext, afterAction } = await getApiContext(page);
  await updateJWTTokenExpiryTime(apiContext, JWT_EXPIRY_TIME_MAP['4 hours']);
  await removeOrganizationPolicyAndRole(apiContext);
  await afterAction();
  await admin.logout(page);
  await page.waitForURL('**/signin');
  await admin.login(page);
  await page.waitForURL('**/my-data');

  await settingClick(page, GlobalSettingOptions.SEARCH_RBAC);

  await page.getByRole('switch').click();

  await expect(page.getByText('Search RBAC updated')).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: adminFile });
});
