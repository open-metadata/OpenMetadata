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

import { expect, test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { getAuthContext, getSavedAdminToken } from '../../utils/common';
import { visitUserProfilePage } from '../../utils/user';

test.use({ storageState: 'playwright/.auth/admin.json' });

let user: UserClass;

test.beforeEach(async () => {
  user = new UserClass();
  const apiContext = await getAuthContext(await getSavedAdminToken());
  try {
    await user.create(apiContext);
  } finally {
    await apiContext.dispose();
  }
});

test.afterEach(async () => {
  if (!user.responseData.id) {
    return;
  }

  const apiContext = await getAuthContext(await getSavedAdminToken());
  try {
    await user.delete(apiContext);
  } finally {
    await apiContext.dispose();
  }
});

test('shows online status below the email after a real login', async ({
  browser,
  page,
}) => {
  const userPage = await browser.newPage({
    storageState: { cookies: [], origins: [] },
  });
  try {
    await user.login(userPage);
  } finally {
    await userPage.close();
  }

  await visitUserProfilePage(page, user.responseData.name);
  const status = page.getByTestId('user-online-status');
  const email = page.getByTestId('user-email-value');
  await expect(status).toHaveText('Online now');
  await expect(status).toBeVisible();
  await expect(email).toHaveText(user.responseData.email);

  const emailBox = await email.boundingBox();
  const statusBox = await status.boundingBox();
  expect(emailBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(statusBox!.y).toBeGreaterThan(emailBox!.y);
});

test('does not show online status for a user who has never logged in', async ({
  page,
}) => {
  await visitUserProfilePage(page, user.responseData.name);
  await expect(page.getByTestId('user-online-status')).toBeHidden();
});

test('shows newly recorded login activity when the profile is reopened', async ({
  browser,
  page,
}) => {
  await visitUserProfilePage(page, user.responseData.name);
  await expect(page.getByTestId('user-online-status')).toBeHidden();

  const userPage = await browser.newPage({
    storageState: { cookies: [], origins: [] },
  });
  try {
    await user.login(userPage);
  } finally {
    await userPage.close();
  }

  await visitUserProfilePage(page, user.responseData.name);
  await expect(page.getByTestId('user-online-status')).toHaveText('Online now');
});
