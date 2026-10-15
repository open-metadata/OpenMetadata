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
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, uuid } from '../../utils/common';
import { getEntityDisplayName } from '../../utils/entity';
import {
  editDisplayNameFromPanel,
  navigateToExploreAndSelectTable,
} from '../../utils/entityPanel';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Entity Title Section - Edit Display Name', () => {
  const table = new TableClass();

  test.beforeAll('Setup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test('should edit display name from entity summary panel', async ({
    page,
  }) => {
    const newDisplayName = `Updated Table ${uuid()}`;

    await navigateToExploreAndSelectTable(
      page,
      getEntityDisplayName(table.entityResponseData)
    );

    const summaryPanel = page.locator('.entity-summary-panel-container');
    await expect(summaryPanel).toBeVisible();

    await editDisplayNameFromPanel(page, newDisplayName);

    const entityLink = summaryPanel.getByTestId('entity-link').first();
    await expect(entityLink).toContainText(newDisplayName);
  });
});
