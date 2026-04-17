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

/**
 * E2E tests for team ownership with special characters and exact name matching.
 *
 * Covers two bugs:
 * 1. A team named "Risk & Compliance" could not be set as owner because the
 *    `&` broke the Elasticsearch query-string URL parameter.
 * 2. Searching for "AI Products" returned "AI Product" instead due to fuzzy
 *    matching when both teams exist.
 */

import { expect, test } from '@playwright/test';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { TeamClass } from '../../support/team/TeamClass';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { addOwner, removeOwner } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

const id = uuid();

const specialCharTeam = new TeamClass({
  name: `Risk-and-Compliance-${id}`,
  displayName: `Risk & Compliance ${id}`,
  description: 'Team with special character in display name',
  teamType: 'Group',
});

const shortTeam = new TeamClass({
  name: `ai-product-${id}`,
  displayName: `AI Product ${id}`,
  description: 'Short team name',
  teamType: 'Group',
});

const longTeam = new TeamClass({
  name: `ai-products-${id}`,
  displayName: `AI Products ${id}`,
  description: 'Long team name — must not be confused with AI Product',
  teamType: 'Group',
});

const table = new TableClass();

test.describe(
  'Team ownership — special characters and exact name matching',
  { tag: ['@Ownership', '@Teams'] },
  () => {
    test.beforeAll('Create teams and table', async ({ browser }) => {
      const { apiContext, afterAction } = await getApiContext(browser);
      await specialCharTeam.create(apiContext);
      await shortTeam.create(apiContext);
      await longTeam.create(apiContext);
      await table.create(apiContext);
      await afterAction();
    });

    test.afterAll('Delete teams and table', async ({ browser }) => {
      const { apiContext, afterAction } = await getApiContext(browser);
      await specialCharTeam.delete(apiContext);
      await shortTeam.delete(apiContext);
      await longTeam.delete(apiContext);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should assign team with special character (&) as owner', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await addOwner({
        page,
        owner: specialCharTeam.data.displayName,
        endpoint: EntityTypeEndpoint.Table,
        type: 'Teams',
      });

      await expect(
        page
          .getByTestId('owner-link')
          .getByTestId(specialCharTeam.data.displayName)
      ).toBeVisible();
    });

    test('should assign exact team "AI Products" without resolving to "AI Product"', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await addOwner({
        page,
        owner: longTeam.data.displayName,
        endpoint: EntityTypeEndpoint.Table,
        type: 'Teams',
      });

      await expect(
        page.getByTestId('owner-link').getByTestId(longTeam.data.displayName)
      ).toBeVisible();

      await expect(
        page.getByTestId('owner-link').getByTestId(shortTeam.data.displayName)
      ).not.toBeVisible();
    });

    test('should assign exact team "AI Product" when that is the intended owner', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await addOwner({
        page,
        owner: shortTeam.data.displayName,
        endpoint: EntityTypeEndpoint.Table,
        type: 'Teams',
      });

      await expect(
        page.getByTestId('owner-link').getByTestId(shortTeam.data.displayName)
      ).toBeVisible();

      await expect(
        page.getByTestId('owner-link').getByTestId(longTeam.data.displayName)
      ).not.toBeVisible();
    });
  }
);
