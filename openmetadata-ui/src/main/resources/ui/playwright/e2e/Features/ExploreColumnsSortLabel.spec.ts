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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// Regression for #32645: on the Columns Explore tab the default sort field
// (totalVotes) is not a member of columnSortingFields, which made the sort
// dropdown render a blank trigger label. A search term forces the Explore index
// to resolve to COLUMN, and omitting the sort param exercises the default sort.
test.describe(
  'Explore Columns sort dropdown label',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should never render a blank label on the Columns tab default sort', async ({
      browser,
    }) => {
      test.slow(true);

      const { page, afterAction } = await performAdminLogin(browser, {
        navigate: true,
      });

      try {
        await page.goto('/explore/columns?search=id');
        await waitForAllLoadersToDisappear(page);

        const sortLabel = page.getByTestId('sorting-dropdown-label');

        await expect(sortLabel).toBeVisible();
        // The button contains a trailing chevron icon, so assert on text: a blank
        // label (the bug) has no text node, only the icon.
        await expect(sortLabel).toHaveText('Data Type');
      } finally {
        await afterAction();
      }
    });

    test('should reflect an explicit valid sort field on the Columns tab', async ({
      browser,
    }) => {
      test.slow(true);

      const { page, afterAction } = await performAdminLogin(browser, {
        navigate: true,
      });

      try {
        await page.goto('/explore/columns?search=id&sort=displayName.keyword');
        await waitForAllLoadersToDisappear(page);

        const sortLabel = page.getByTestId('sorting-dropdown-label');

        await expect(sortLabel).toBeVisible();
        await expect(sortLabel).toHaveText('Name');
      } finally {
        await afterAction();
      }
    });
  }
);
