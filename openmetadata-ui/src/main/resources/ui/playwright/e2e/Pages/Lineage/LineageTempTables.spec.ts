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
import { expect, Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { getDefaultAdminAPIContext, uuid } from '../../../utils/common';
import {
  connectEdgeBetweenNodesViaAPI,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

const source = new TableClass();
const target = new TableClass();
// Temp tables are not entities: lineage only names them in the edge's
// tempLineageTables hops, and the UI draws a node for each name.
const tempTable = `pw_tmp_${uuid()}`;

const setShowTempTables = async (page: Page, show: boolean) => {
  await page.getByTestId('lineage-config').click();
  // react-aria keeps the switch input visually hidden; click its label.
  const toggle = page.getByTestId('lineage-config-show-temp-tables');
  const toggleInput = page.getByRole('switch', {
    name: 'Show temporary tables',
  });
  await expect(toggle).toBeVisible();
  if ((await toggleInput.isChecked()) !== show) {
    await toggle.click();
  }
  await expect(toggleInput).toBeChecked({ checked: show });
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(toggle).toBeHidden();
};

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await Promise.all([source.create(apiContext), target.create(apiContext)]);
  const sourceFqn = source.entityResponseData.fullyQualifiedName;
  const targetFqn = target.entityResponseData.fullyQualifiedName;
  const response = await connectEdgeBetweenNodesViaAPI(
    apiContext,
    { id: source.entityResponseData.id, type: 'table' },
    { id: target.entityResponseData.id, type: 'table' },
    undefined,
    {
      tempLineageTables: [
        { fromEntity: sourceFqn, toEntity: tempTable },
        { fromEntity: tempTable, toEntity: targetFqn },
      ],
    }
  );
  expect(response.ok()).toBeTruthy();
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await Promise.all([source.delete(apiContext), target.delete(apiContext)]);
  await afterAction();
});

test.describe('Lineage temporary tables', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('shows temp tables by default, hides them and remembers the choice', async ({
    page,
  }) => {
    const tempNode = page.getByTestId(`lineage-node-${tempTable}`);
    const targetNode = page.getByTestId(
      `lineage-node-${target.entityResponseData.fullyQualifiedName}`
    );
    const directEdge = page.getByTestId(
      `edge-${source.entityResponseData.fullyQualifiedName}-${target.entityResponseData.fullyQualifiedName}`
    );

    await source.visitEntityPage(page);
    await visitLineageTab(page);

    await expect(tempNode).toBeVisible();

    await test.step('hide them from the lineage config dialog', async () => {
      await setShowTempTables(page, false);

      await expect(tempNode).toBeHidden();
      await expect(targetNode).toBeVisible();
      await expect(directEdge).toBeVisible();
    });

    await test.step('stay hidden on the next visit', async () => {
      await source.visitEntityPage(page);
      await visitLineageTab(page);

      await expect(targetNode).toBeVisible();
      await expect(directEdge).toBeVisible();
      await expect(tempNode).toBeHidden();
    });

    await test.step('show them again', async () => {
      await setShowTempTables(page, true);

      await expect(tempNode).toBeVisible();
      await expect(directEdge).toBeHidden();
    });
  });
});
