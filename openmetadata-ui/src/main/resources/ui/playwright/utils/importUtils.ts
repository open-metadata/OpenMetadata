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
import { expect, Page } from '@playwright/test';
import { uuid } from './common';

export const createGlossaryTermRowDetails = () => {
  return {
    name: `playwright,glossaryTerm ${uuid()}`,
    displayName: 'Playwright,Glossary Term',
    description: `Playwright GlossaryTerm description.
      Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
      There is no one who loves pain itself, who seeks after it and wants to have it, simply because it is pain..`,
    tag: 'PII.Sensitive',
    synonyms: 'playwright,glossaryTerm,testing',
    references: 'data;http:sandbox.com',
  };
};

export const fillTextInputDetails = async (page: Page, text: string) => {
  await page.locator('.InovuaReactDataGrid__cell--cell-active').press('Enter');

  await page.locator('.ant-layout-content').getByRole('textbox').fill(text);
  await page
    .locator('.ant-layout-content')
    .getByRole('textbox')
    .press('Enter', { delay: 100 });
};

export const fillDescriptionDetails = async (
  page: Page,
  description: string
) => {
  await page.locator('.InovuaReactDataGrid__cell--cell-active').press('Enter');
  await page.click(
    '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
  );

  await page.fill(
    '.toastui-editor-md-container > .toastui-editor > .ProseMirror',
    description
  );

  await page.click('[data-testid="save"]');
  await page.click('.InovuaReactDataGrid__cell--cell-active');
};

export const fillOwnerDetails = async (page: Page, owners: string[]) => {
  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('Enter', { delay: 100 });

  const userListResponse = page.waitForResponse(
    '/api/v1/users?limit=*&isBot=false*'
  );
  await page.getByRole('tab', { name: 'Users' }).click();
  await userListResponse;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page.click('[data-testid="owner-select-users-search-bar"]');

  for (const owner of owners) {
    await page.locator('[data-testid="owner-select-users-search-bar"]').clear();
    await page.keyboard.type(owner);
    await page.waitForResponse(
      `/api/v1/search/query?q=*${owner}*%20AND%20isBot:false&from=0&size=25&index=user_search_index`
    );

    await page.getByRole('listitem', { name: owner }).click();
  }

  await page.getByTestId('selectable-list-update-btn').click();

  await page.click('.InovuaReactDataGrid__cell--cell-active');
};

export const fillTagDetails = async (page: Page, tag: string) => {
  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('Enter', { delay: 100 });

  await page.click('[data-testid="tag-selector"]');
  await page.locator('[data-testid="tag-selector"] input').fill(tag);
  await page.click(`[data-testid="tag-${tag}"]`);
  await page.click('[data-testid="inline-save-btn"]');
  await page.click('.InovuaReactDataGrid__cell--cell-active');
};

export const fillGlossaryTermDetails = async (
  page: Page,
  glossary: { parent: string; name: string }
) => {
  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('Enter', { delay: 100 });

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await page.click('[data-testid="tag-selector"]');
  await page.locator('[data-testid="tag-selector"] input').fill(glossary.name);
  await page.getByTestId(`tag-"${glossary.parent}"."${glossary.name}"`).click();
  await page.click('[data-testid="saveAssociatedTag"]');
  await page.click('.InovuaReactDataGrid__cell--cell-active');
};

export const fillDomainDetails = async (
  page: Page,
  domains: { name: string; displayName: string }
) => {
  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('Enter', { delay: 100 });

  await page.click('[data-testid="selectable-list"] [data-testid="searchbar"]');
  await page
    .locator('[data-testid="selectable-list"] [data-testid="searchbar"]')
    .fill(domains.name);

  await page.click(`.ant-popover [title="${domains.displayName}"]`);
  await page.waitForTimeout(100);
};

export const fillGlossaryRowDetails = async (
  row: {
    name: string;
    displayName: string;
    description: string;
    synonyms: string;
    relatedTerm: {
      name: string;
      parent: string;
    };
    references: string;
    tag: string;
    reviewers: string[];
    owners: string[];
  },
  page: Page
) => {
  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight');

  await fillTextInputDetails(page, row.name);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight');

  await fillTextInputDetails(page, row.displayName);

  // Navigate to next cell and make cell editable
  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillDescriptionDetails(page, row.description);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.synonyms);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillGlossaryTermDetails(page, row.relatedTerm);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillTextInputDetails(page, row.references);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillTagDetails(page, row.tag);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillOwnerDetails(page, row.reviewers);

  await page
    .locator('.InovuaReactDataGrid__cell--cell-active')
    .press('ArrowRight', { delay: 100 });

  await fillOwnerDetails(page, row.owners);
};

export const validateImportStatus = async (
  page: Page,
  status: { passed: string; failed: string; processed: string }
) => {
  await page.waitForSelector('[data-testid="processed-row"]');
  const processedRow = await page.$eval(
    '[data-testid="processed-row"]',
    (el) => el.textContent
  );

  expect(processedRow).toBe(status.processed);

  const passedRow = await page.$eval(
    '[data-testid="passed-row"]',
    (el) => el.textContent
  );

  expect(passedRow).toBe(status.passed);

  const failedRow = await page.$eval(
    '[data-testid="failed-row"]',
    (el) => el.textContent
  );

  expect(failedRow).toBe(status.failed);

  await page.waitForSelector('.InovuaReactDataGrid__header-layout', {
    state: 'visible',
  });
};
