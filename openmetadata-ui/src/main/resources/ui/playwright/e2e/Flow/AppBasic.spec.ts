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
import test, { expect } from '@playwright/test';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test('should call installed app api and it should respond with 200', async ({
  page,
}) => {
  const installedApp = page.waitForResponse('/api/v1/apps/installed');

  await page.goto('/');

  const response = await installedApp;

  expect(response.status()).toBe(200);
});
