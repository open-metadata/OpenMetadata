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

import { Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { expect, test } from '../../../support/fixtures/base';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { navigateToTestLibrary } from '../../../utils/testDefinitionFilter';

const TEST_DEFINITION_API = '/api/v1/dataQuality/testDefinitions';

// One marker shared by all three fixtures. The search box matches it in the
// name, so the listing narrows to exactly these rows and their order can be
// asserted absolutely instead of against whatever the catalog is seeded with.
const MARKER = `pwsort${uuid()}`;

// Display names sort the opposite way to the internal names, and every sortable
// column holds a distinct value per row. An ordering that fell back to `name`,
// or one that tie-broke on a random id, fails here rather than passing by
// coincidence.
const RULES = [
  {
    name: `${MARKER}_zzz`,
    displayName: `Alpha rule ${MARKER}`,
    entityType: 'COLUMN',
    testPlatforms: ['Soda'],
  },
  {
    name: `${MARKER}_aaa`,
    displayName: `Zulu rule ${MARKER}`,
    entityType: 'TABLE',
    testPlatforms: ['OpenMetadata'],
  },
  {
    name: `${MARKER}_mmm`,
    displayName: `Mike rule ${MARKER}`,
    entityType: 'TABLE',
    testPlatforms: ['dbt'],
  },
];

// The only rule of the three that runs on the OpenMetadata platform, so the
// only one whose Enabled toggle is ever live. Asserting the refetch holds the
// controls shut has to happen on this row - on an external rule the toggle is
// disabled either way and the assertion would pass without the refetch.
const TOGGLEABLE_RULE = `${MARKER}_aaa`;

const BY_DISPLAY_NAME_ASC = [
  `Alpha rule ${MARKER}`,
  `Mike rule ${MARKER}`,
  `Zulu rule ${MARKER}`,
];
const BY_DISPLAY_NAME_DESC = [...BY_DISPLAY_NAME_ASC].reverse();
const BY_TEST_PLATFORM_ASC = [
  `Mike rule ${MARKER}`,
  `Zulu rule ${MARKER}`,
  `Alpha rule ${MARKER}`,
];

const createdIds: string[] = [];

const ruleNameCells = (page: Page) =>
  page.getByTestId('test-definition-table').locator('tbody tr td:first-child');

// Two of the three rules share an entity type, so they tie on that sort key and
// break on a random id. Asserting the entity type column rather than the names
// keeps the expectation deterministic - both tied rows read TABLE either way.
const entityTypeCells = (page: Page) =>
  page.getByTestId('test-definition-table').locator('tbody tr td:nth-child(3)');

const searchForMarker = async (page: Page) => {
  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes(TEST_DEFINITION_API) &&
      response.url().includes(`q=${MARKER}`)
  );

  await page.getByTestId('test-definition-search').fill(MARKER);

  const response = await listResponse;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
  await expect(ruleNameCells(page)).toHaveCount(RULES.length);
};

const sortByColumn = async (page: Page, columnName: string, query: string) => {
  const header = page.getByRole('columnheader', { name: columnName });
  await expect(header).toBeVisible();

  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes(TEST_DEFINITION_API) &&
      response.url().includes(query)
  );

  await header.click();

  const response = await listResponse;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Test Definition Sorting and Search',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Test_Library` },
  () => {
    test.beforeAll('Create sortable test definitions', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      for (const rule of RULES) {
        const response = await apiContext.post(TEST_DEFINITION_API, {
          data: {
            ...rule,
            description: 'Test definition for sort and search coverage',
          },
        });
        expect(response.status()).toBe(201);
        createdIds.push((await response.json()).id);
      }

      await afterAction();
    });

    test.afterAll('Remove sortable test definitions', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      for (const id of createdIds) {
        await apiContext.delete(
          `${TEST_DEFINITION_API}/${id}?hardDelete=true&recursive=false`
        );
      }

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await navigateToTestLibrary(page);
    });

    test('should search across the listing and back it with the url', async ({
      page,
    }) => {
      test.slow();

      await test.step('Narrow the listing to the searched rules', async () => {
        await searchForMarker(page);

        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_ASC);
        expect(page.url()).toContain(`q=${MARKER}`);
      });

      await test.step('Restore the search from the url on reload', async () => {
        await page.reload();
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('test-definition-search')).toHaveValue(
          MARKER
        );
        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_ASC);
      });
    });

    test('should sort by display name in both directions', async ({ page }) => {
      test.slow();

      await searchForMarker(page);

      await test.step('Default order is the display name ascending', async () => {
        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_ASC);
        await expect(
          page.getByRole('columnheader', { name: 'Name' })
        ).toHaveAttribute('aria-sort', 'ascending');
      });

      await test.step('Clicking Name reverses it', async () => {
        await sortByColumn(page, 'Name', 'sortOrder=desc');

        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_DESC);
        await expect(
          page.getByRole('columnheader', { name: 'Name' })
        ).toHaveAttribute('aria-sort', 'descending');
        expect(page.url()).toContain('sortField=displayName');
        expect(page.url()).toContain('sortOrder=desc');
      });

      await test.step('The sorted view survives a reload', async () => {
        await page.reload();
        await waitForAllLoadersToDisappear(page);

        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_DESC);
        await expect(
          page.getByRole('columnheader', { name: 'Name' })
        ).toHaveAttribute('aria-sort', 'descending');
      });
    });

    test('should sort by entity type and test platforms', async ({ page }) => {
      test.slow();

      await searchForMarker(page);

      await test.step('Entity type groups COLUMN before TABLE', async () => {
        await sortByColumn(page, 'Entity Type', 'sortField=entityType');

        await expect(entityTypeCells(page)).toHaveText([
          'COLUMN',
          'TABLE',
          'TABLE',
        ]);
        expect(page.url()).toContain('sortField=entityType');
      });

      await test.step('Test platforms orders on the first platform declared', async () => {
        await sortByColumn(page, 'Test Platforms', 'sortField=testPlatforms');

        await expect(ruleNameCells(page)).toHaveText(BY_TEST_PLATFORM_ASC);
        expect(page.url()).toContain('sortField=testPlatforms');
      });
    });

    test('should offer a sort affordance only on the sortable columns', async ({
      page,
    }) => {
      for (const column of ['Name', 'Entity Type', 'Test Platforms']) {
        await expect(
          page.getByRole('columnheader', { name: column })
        ).toHaveAttribute('aria-sort', /ascending|descending|none/);
      }

      for (const column of ['Description', 'Enabled', 'Actions']) {
        await expect(
          page.getByRole('columnheader', { name: column })
        ).not.toHaveAttribute('aria-sort', /.*/);
      }
    });

    test('should restore a sorted listing from the url', async ({ page }) => {
      const listResponse = page.waitForResponse(
        (response) =>
          response.url().includes(TEST_DEFINITION_API) &&
          response.url().includes('sortField=entityType')
      );

      await page.goto(
        `/test-library?q=${MARKER}&sortField=entityType&sortOrder=desc`
      );

      expect((await listResponse).status()).toBe(200);
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('columnheader', { name: 'Entity Type' })
      ).toHaveAttribute('aria-sort', 'descending');
      await expect(entityTypeCells(page)).toHaveText([
        'TABLE',
        'TABLE',
        'COLUMN',
      ]);
    });

    test('should reset pagination when the sort changes', async ({ page }) => {
      test.slow();

      await test.step('Move to the second page', async () => {
        await expect(page.getByTestId('pagination')).toBeVisible();

        const nextButton = page.getByTestId('next');
        await expect(nextButton).toBeEnabled();

        const pageResponse = page.waitForResponse((response) =>
          response.url().includes(TEST_DEFINITION_API)
        );
        await nextButton.click();
        await pageResponse;
        await waitForAllLoadersToDisappear(page);

        expect(page.url()).toContain('currentPage=2');
      });

      await test.step('Sorting returns to the first page', async () => {
        await sortByColumn(page, 'Entity Type', 'sortField=entityType');

        expect(page.url()).not.toContain('currentPage=2');
        expect(page.url()).toContain('sortField=entityType');
      });
    });

    test('should keep the previous rows visible but inert while refetching', async ({
      page,
    }) => {
      test.slow();

      await searchForMarker(page);

      // The response is held open deliberately so the refetch state can be
      // observed. Nothing here waits on a timer: the gate is released only
      // after the assertions run.
      let releaseListing: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        releaseListing = resolve;
      });

      await page.route(`**${TEST_DEFINITION_API}?*`, async (route) => {
        await gate;
        await route.continue();
      });

      await page.getByRole('columnheader', { name: 'Name' }).click();

      await test.step('Rows stay on screen and are marked busy', async () => {
        await expect(
          page.getByTestId('test-definition-table-container')
        ).toHaveAttribute('aria-busy', 'true');
        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_ASC);
      });

      await test.step('Their controls are held shut', async () => {
        await expect(
          page.getByTestId(`enable-switch-${TOGGLEABLE_RULE}`)
        ).toBeDisabled();
        await expect(
          page.getByTestId(`edit-test-definition-${TOGGLEABLE_RULE}`)
        ).toBeDisabled();
        await expect(
          page.getByTestId(`delete-test-definition-${TOGGLEABLE_RULE}`)
        ).toBeDisabled();
      });

      await test.step('The new order lands once the response arrives', async () => {
        const listResponse = page.waitForResponse((response) =>
          response.url().includes(TEST_DEFINITION_API)
        );

        // The handler stays installed for the rest of the test. With the gate
        // resolved it passes every request straight through, and unrouting here
        // would race the request it is still holding: dropping an interceptor
        // makes Playwright auto-continue the route that handler owns, so the
        // handler's own continue() then fails with "Route is already handled!".
        releaseListing();

        expect((await listResponse).status()).toBe(200);
        await waitForAllLoadersToDisappear(page);

        await expect(ruleNameCells(page)).toHaveText(BY_DISPLAY_NAME_DESC);
        await expect(
          page.getByTestId('test-definition-table-container')
        ).toHaveAttribute('aria-busy', 'false');
        await expect(
          page.getByTestId(`enable-switch-${TOGGLEABLE_RULE}`)
        ).toBeEnabled();
      });
    });
  }
);
