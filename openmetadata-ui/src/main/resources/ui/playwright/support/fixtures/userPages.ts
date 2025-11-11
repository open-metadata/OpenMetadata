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

// Declare the types of your fixtures
type UserPages = {
  adminPage: Page;
  dataConsumerPage: Page;
  dataStewardPage: Page;
  ownerPage: Page;
  editDescriptionPage: Page;
  editTagsPage: Page;
  editGlossaryTermPage: Page;
};

// Extend the base test type with your fixtures
export const test = base.extend<UserPages>({
  adminPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/admin.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  dataConsumerPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/dataConsumer.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  dataStewardPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/dataSteward.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  ownerPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/owner.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  editDescriptionPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/editDescription.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  editTagsPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/editTags.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  editGlossaryTermPage: async ({ browser }: { browser: Browser }, use) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/editGlossaryTerm.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
