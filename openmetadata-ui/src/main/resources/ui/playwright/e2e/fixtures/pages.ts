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
import { Browser, Page, test as base } from '@playwright/test';

// Define the type for our custom fixtures
export type CustomFixtures = {
  page: Page;
  dataConsumerPage: Page;
  dataStewardPage: Page;
  editDescriptionPage: Page;
  editTagsPage: Page;
  editGlossaryTermPage: Page;
  ownerPage: Page;
};

// Helper function to create and setup a page with storage state
async function createPageWithAuth(
  browser: Browser,
  storageStatePath: string
): Promise<Page> {
  const page = await browser.newPage({
    storageState: storageStatePath,
  });

  // Wait for IndexedDB to be ready OR app signals login
  await page.waitForFunction(() =>
    window.indexedDB.databases
      ? window.indexedDB.databases().then((dbs) => dbs.length > 0)
      : true
  );

  return page;
}

// Create a new test object with our custom fixtures
export const test = base.extend<CustomFixtures>({
  // Admin page as default page value
  page: async ({ browser }, use) => {
    const adminPage = await createPageWithAuth(
      browser,
      'playwright/.auth/admin.json'
    );
    await use(adminPage);
    await adminPage.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await createPageWithAuth(
      browser,
      'playwright/.auth/dataConsumer.json'
    );
    await use(page);
    await page.close();
  },
  dataStewardPage: async ({ browser }, use) => {
    const page = await createPageWithAuth(
      browser,
      'playwright/.auth/dataSteward.json'
    );
    await use(page);
    await page.close();
  },
  ownerPage: async ({ browser }, use) => {
    const page = await createPageWithAuth(
      browser,
      'playwright/.auth/owner.json'
    );
    await use(page);
    await page.close();
  },
  editDescriptionPage: async ({ browser }, use) => {
    const page = await createPageWithAuth(
      browser,
      'playwright/.auth/editDescription.json'
    );
    await use(page);
    await page.close();
  },
  editTagsPage: async ({ browser }, use) => {
    const page = await createPageWithAuth(
      browser,
      'playwright/.auth/editTags.json'
    );
    await use(page);
    await page.close();
  },
  editGlossaryTermPage: async ({ browser }, use) => {
    const page = await createPageWithAuth(
      browser,
      'playwright/.auth/editGlossaryTerm.json'
    );
    await use(page);
    await page.close();
  },
});
