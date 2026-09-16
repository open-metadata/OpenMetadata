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
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForSearchIndexed } from '../../utils/polling';

test.use({ storageState: 'playwright/.auth/admin.json' });

let classification: ClassificationClass;
let usedTag: TagClass;
let unusedTag: TagClass;
let table: TableClass;

// The fixture tags exactly one table, and only that table's own document
// carries the tag, so the count is exact
const USED_TAG_ASSET_COUNT = '1';

test.describe(
  'Classification tag usage counts',
  { tag: ['@Governance'] },
  () => {
    test.beforeAll(async ({ browser }) => {
      classification = new ClassificationClass();
      usedTag = new TagClass({
        name: `pw-used-tag-${uuid()}`,
        classification: classification.data.name,
      });
      unusedTag = new TagClass({
        name: `pw-unused-tag-${uuid()}`,
        classification: classification.data.name,
      });
      table = new TableClass();

      const { apiContext, afterAction } = await createNewPage(browser);
      await classification.create(apiContext);
      await usedTag.create(apiContext);
      await unusedTag.create(apiContext);
      await table.create(apiContext);
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/tags/0',
            value: { tagFQN: usedTag.responseData.fullyQualifiedName },
          },
        ],
      });
      await waitForSearchIndexed(
        apiContext,
        table.entityResponseData.fullyQualifiedName,
        'table_search_index',
        {
          queryFilter: JSON.stringify({
            query: {
              bool: {
                must: [
                  {
                    term: {
                      'tags.tagFQN': usedTag.responseData.fullyQualifiedName,
                    },
                  },
                ],
              },
            },
          }),
        }
      );
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await usedTag.delete(apiContext);
      await unusedTag.delete(apiContext);
      await classification.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('shows how many assets carry each tag without opening them', async ({
      page,
    }) => {
      await classification.visitPage(page);
      await waitForAllLoadersToDisappear(page);

      const usedCount = page.getByTestId(`usage-count-${usedTag.data.name}`);

      await expect(usedCount).toHaveText(USED_TAG_ASSET_COUNT);
      await expect(usedCount).toHaveAttribute('href', /.+/);

      const unusedCount = page.getByTestId(
        `usage-count-${unusedTag.data.name}`
      );

      await expect(unusedCount).toHaveText('0');
      await expect(unusedCount).not.toHaveAttribute('href');
    });

    test('opens the tagged assets from the usage count', async ({ page }) => {
      await test.step('Open the classification', async () => {
        await classification.visitPage(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Follow the count through to the assets', async () => {
        const usageCount = page.getByTestId(`usage-count-${usedTag.data.name}`);

        await expect(usageCount).toHaveText(USED_TAG_ASSET_COUNT);
        await usageCount.click();

        await expect(
          page.getByTestId(
            `table-data-card_${table.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible({ timeout: 30_000 });
        await expect(
          page.getByTestId('assets').getByTestId('count')
        ).toHaveText(USED_TAG_ASSET_COUNT);
      });
    });
  }
);
