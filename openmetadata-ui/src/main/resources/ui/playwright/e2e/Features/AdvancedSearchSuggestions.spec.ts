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

import { toLower } from 'lodash';
import { ADVANCED_SEARCH_SUGGESTION_FIELDS } from '../../constant/advancedSearch';
import { SidebarItem } from '../../constant/sidebar';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import {
  getFieldsSuggestionSearchText,
  selectOption,
  showAdvancedSearchDialog,
} from '../../utils/advancedSearch';
import { redirectToHomePage } from '../../utils/common';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Advanced Search Suggestions', () => {
  const testData = { fieldSearchData: {} as Record<string, string> };

  test.beforeAll('Setup pre-requests', async () => {
    testData.fieldSearchData = {
      database: EntityDataClass.database.entityResponseData.name,
      databaseSchema: EntityDataClass.databaseSchema.entityResponseData.name,
      apiCollection: EntityDataClass.apiCollection1.entityResponseData.name,
      glossary: EntityDataClass.glossary1.responseData.displayName,
      domains: EntityDataClass.domain1.responseData.displayName,
      dataProduct: EntityDataClass.dataProduct1.responseData.displayName,
      tag: EntityDataClass.tag1.responseData.fullyQualifiedName,
      certification:
        EntityDataClass.certificationTag1.responseData.fullyQualifiedName,
      tier: EntityDataClass.tierTag1.responseData.fullyQualifiedName,
    };
  });

  ADVANCED_SEARCH_SUGGESTION_FIELDS.forEach((field) => {
    test(`Verify suggestions for ${field.label} field`, async ({ page }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);
      await showAdvancedSearchDialog(page);

      const ruleLocator = page.locator('.rule').nth(0);

      await selectOption(
        page,
        ruleLocator.locator('.rule--field'),
        field.label,
        true
      );

      await selectOption(page, ruleLocator.locator('.rule--operator'), '==');

      const dropdownInput = ruleLocator.locator(
        '.widget--widget input[role="combobox"]'
      );

      const searchText = toLower(
        getFieldsSuggestionSearchText(field.label, testData.fieldSearchData)
      );

      const aggregateRes2 = page.waitForResponse(
        `/api/v1/search/aggregate?*${getEncodedFqn(
          escapeESReservedCharacters(searchText)
        )}*`
      );

      await dropdownInput.fill(searchText);

      await aggregateRes2;

      // Assert on the option's value, not its label. Tag-like fields (Tags,
      // Certification, Tier) render the display name — `Tier1` — while the
      // search text is the FQN `Tier.Tier1`. react-aria exposes the value on
      // `data-key`, which does not move when the label presentation does.
      const listbox = page.locator('[role="listbox"]:visible');
      const byValue = listbox.locator(
        `[role="option"][data-key="${searchText}" i]`
      );
      const byText = listbox
        .locator('[role="option"]')
        .filter({ hasText: searchText });

      await test
        .expect((await byValue.count()) > 0 ? byValue : byText)
        .not.toHaveCount(0);
    });
  });
});
