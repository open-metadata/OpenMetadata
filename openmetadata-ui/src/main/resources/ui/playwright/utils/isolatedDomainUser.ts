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
import { Browser } from '@playwright/test';
import { UserClass } from '../support/user/UserClass';
import { performAdminLogin } from './admin';
import { performUserLogin } from './user';

/**
 * Logs in as a fresh admin created for this test. The navbar domain pick is saved per user, so a
 * test that picks a domain as a shared admin narrows every parallel test's lists for that admin.
 * afterAction deletes the user, which also removes its saved pick even when the test fails.
 */
export const loginAsIsolatedAdmin = async (browser: Browser) => {
  const { apiContext: adminApi, afterAction: adminDone } =
    await performAdminLogin(browser);
  const user = new UserClass(undefined, true);
  await user.create(adminApi);
  const login = await performUserLogin(browser, user);

  return {
    ...login,
    afterAction: async () => {
      await login.afterAction();
      await user.delete(adminApi);
      await adminDone();
    },
  };
};
