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
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should check for glossary term pagination', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    const glossaries = [];
    for (let i = 0; i < 60; i++) {
      const glossary = new Glossary(`Z_PW_GLOSSARY_TEST_${i + 1}`);
      await glossary.create(apiContext);
      glossaries.push(glossary);
    }

    try {
      const glossaryRes = page.waitForResponse(
        '/api/v1/glossaryTerms?*directChildrenOf=*'
      );

      const glossaryAfterRes = page.waitForResponse(
        '/api/v1/glossaries?*after=*'
      );
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await glossaryRes;

      await page
        .getByTestId('glossary-left-panel-scroller')
        .scrollIntoViewIfNeeded();

      const res = await glossaryAfterRes;
      const json = await res.json();

      const firstGlossaryName = json.data[0].displayName;

      await expect(
        page
          .getByTestId('glossary-left-panel')
          .getByRole('menuitem', { name: firstGlossaryName })
      ).toBeVisible();
    } finally {
      for (const glossary of glossaries) {
        await glossary.delete(apiContext);
      }
      await afterAction();
    }
  });
});
