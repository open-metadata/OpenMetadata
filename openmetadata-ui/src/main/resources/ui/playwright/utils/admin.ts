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
import { Browser } from '@playwright/test';
import { AdminClass } from '../support/user/AdminClass';
import { getAuthContext, getToken, redirectToHomePage } from './common';

export const performAdminLogin = async (browser: Browser) => {
  const admin = new AdminClass();
  const page = await browser.newPage();
  await admin.login(page);
  await redirectToHomePage(page);
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);
  const afterAction = async () => {
    await apiContext.dispose();
    await page.close();
  };

  return { page, apiContext, afterAction };
};
