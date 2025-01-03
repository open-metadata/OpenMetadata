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
import { Page, test as setup } from '@playwright/test';
import { JWT_EXPIRY_TIME_MAP } from '../constant/login';
import { AdminClass } from '../support/user/AdminClass';
import { loginAsAdmin } from '../utils/admin';
import { getApiContext } from '../utils/common';
import { updateJWTTokenExpiryTime } from '../utils/login';
import {
  updateDefaultDataConsumerPolicy,
  updateDefaultOrganizationPolicy,
} from '../utils/permission';
import { removeOrganizationPolicyAndRole } from '../utils/team';
const adminFile = 'playwright/.auth/admin.json';

const initialSetup = async (page: Page) => {
  const { apiContext, afterAction } = await getApiContext(page);
  // Update JWT expiry time to 4 hours
  await updateJWTTokenExpiryTime(apiContext, JWT_EXPIRY_TIME_MAP['4 hours']);
  // Remove organization policy and role
  await removeOrganizationPolicyAndRole(apiContext);
  // update default Organization policy
  await updateDefaultOrganizationPolicy(apiContext);
  // update default Data consumer policy
  await updateDefaultDataConsumerPolicy(apiContext);

  await afterAction();
};

setup('authenticate as admin', async ({ page }) => {
  const admin = new AdminClass();

  // login with admin user
  await loginAsAdmin(page, initialSetup, admin);

  // End of authentication steps.
  await page.context().storageState({ path: adminFile });
});
