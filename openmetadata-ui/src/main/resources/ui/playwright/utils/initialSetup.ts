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
import { Page } from '@playwright/test';
import { JWT_EXPIRY_TIME_MAP } from '../constant/login';
import { AdminClass } from '../support/user/AdminClass';
import { enableDisableAutoPilotApplication } from './applications';
import { getApiContext } from './common';
import { updateJWTTokenExpiryTime } from './login';
import {
  updateDefaultDataConsumerPolicy,
  updateDefaultOrganizationPolicy,
} from './permission';
import { removeOrganizationPolicyAndRole } from './team';

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

  if (process.env.PLAYWRIGHT_IN_NIGHTLY) {
    // disable the AutoPilot application
    await enableDisableAutoPilotApplication(apiContext, false);
  }

  await afterAction();
};

export const loginAsAdmin = async (page: Page, admin: AdminClass) => {
  await admin.login(page);
  await page.waitForURL('**/my-data');
  await initialSetup(page);
  await admin.logout(page);
  await page.waitForURL('**/signin');
  await admin.login(page);

  // Close the leftside bar to run tests smoothly
  await page.getByTestId('sidebar-toggle').click();

  await page.waitForURL('**/my-data');
};
