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

import { expect } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

// Shaped like the FQNs the MSSQL synonym sweep writes to Table.aliases, so the
// assertion mirrors what the connector actually produces rather than an
// arbitrary label.
const ALIAS_NAMES = [`legacy_customers_${uuid()}`, `legacy_orders_${uuid()}`];
const ALIASES = ALIAS_NAMES.map((name) => `mssql_synonym_svc.dbo.${name}`);

test.describe('Table Aliases widget', { tag: [DOMAIN_TAGS.DISCOVERY] }, () => {
  const tableWithAliases = new TableClass();
  const tableWithoutAliases = new TableClass();

  test.beforeAll('Create tables', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableWithAliases.create(apiContext);
    // aliases is source-managed (no create-time UI field), so it is written
    // the same way ingestion would apply it: a PATCH after creation.
    await tableWithAliases.patch({
      apiContext,
      patchData: [{ op: 'add', path: '/aliases', value: ALIASES }],
    });

    await tableWithoutAliases.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup tables', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableWithAliases.delete(apiContext);
    await tableWithoutAliases.delete(apiContext);

    await afterAction();
  });

  test('renders each alias and offers no edit affordance', async ({ page }) => {
    await redirectToHomePage(page);
    await tableWithAliases.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const aliasesWidget = page.getByTestId('table-aliases-table');

    await expect(aliasesWidget).toBeVisible();

    // The widget shows only the trailing alias name; the service, database and
    // schema are already implied by the page, and the full FQN stays available
    // as the cell's title attribute.
    for (const [index, name] of ALIAS_NAMES.entries()) {
      const cell = aliasesWidget.getByText(name, { exact: true });

      await expect(cell).toBeVisible();
      await expect(cell).toHaveAttribute('title', ALIASES[index]);
    }

    await expect(aliasesWidget.getByText(ALIASES[0])).toHaveCount(0);

    // Deliberately no edit affordance: the MSSQL connector overwrites
    // aliases on every ingestion run, so an editable control would silently
    // discard user input (Task 11 design decision).
    await expect(aliasesWidget.getByRole('button')).toHaveCount(0);
  });

  test('hides the widget entirely when the table has no aliases', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await tableWithoutAliases.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('table-aliases-table')).not.toBeVisible();
  });
});
