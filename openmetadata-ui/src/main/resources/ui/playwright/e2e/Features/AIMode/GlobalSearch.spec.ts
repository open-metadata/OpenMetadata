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

/**
 * User flows of the AI-mode global search (⌘K) against a real server: search
 * hits for real entities, the pages their rows open, the Explore hand-off and
 * recents that survive navigation. What the modal renders for a given state
 * (tabs, loaders, keyboard, empty states) is covered by the unit tests in
 * `components/platform/ai-shell/GlobalSearch`.
 */

import { Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForSearchIndexed } from '../../../utils/polling';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

const openSearch = async (page: Page) => {
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByTestId('global-search-input');
  await expect(input).toBeFocused();

  return input;
};

const searchFor = async (page: Page, text: string) => {
  const input = await openSearch(page);
  await input.fill(text);
  await expect(input).toHaveValue(text);
};

/** The entity page the browser landed on, by its FQN in the path. */
const expectOnEntityPage = async (page: Page, route: string, fqn: string) => {
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).pathname))
    .toContain(`/${route}/${fqn}`);
  await expect(page.getByTestId('global-search-modal')).toBeHidden();
};

test.describe(
  'AI mode global search',
  { tag: ['@Features', DOMAIN_TAGS.DISCOVERY] },
  () => {
    let table: TableClass;
    let glossary: Glossary;
    let glossaryTerm: GlossaryTerm;
    let domain: Domain;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(120_000);
      const token = uuid();
      table = new TableClass();
      glossary = new Glossary();
      glossaryTerm = new GlossaryTerm(glossary, undefined, `pwgsterm${token}`);
      domain = new Domain({
        name: `pwgsdomain${token}`,
        displayName: `pwgsdomain${token}`,
        description: 'global search playwright domain',
        domainType: 'Aggregate',
        fullyQualifiedName: `pwgsdomain${token}`,
      });

      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await domain.create(apiContext);
      await waitForSearchIndexed(
        apiContext,
        table.entityResponseData.fullyQualifiedName,
        'table_search_index'
      );
      await waitForSearchIndexed(
        apiContext,
        glossaryTerm.responseData.fullyQualifiedName,
        'glossary_term_search_index'
      );
      await waitForSearchIndexed(
        apiContext,
        domain.responseData.fullyQualifiedName,
        'domain_search_index'
      );
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      // beforeAll may have failed part-way; delete only what was created.
      if (table?.entityResponseData?.id) {
        await table.delete(apiContext);
      }
      if (glossaryTerm?.responseData?.id) {
        await glossaryTerm.delete(apiContext);
      }
      if (glossary?.responseData?.id) {
        await glossary.delete(apiContext);
      }
      if (domain?.responseData?.id) {
        await domain.delete(apiContext);
      }
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await enableAiAppMode(page);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
    });

    test('a data asset previews on the first pick and opens its page on the second', async ({
      page,
    }) => {
      const row = page.getByTestId(
        `global-search-row-${table.entityResponseData.id}`
      );

      await test.step('find the table and switch to Data assets', async () => {
        await searchFor(page, table.entity.displayName);
        await page.getByTestId('global-search-tab-assets').click();
        await expect(
          page.getByTestId('global-search-tab-assets')
        ).toHaveAttribute('aria-selected', 'true');
        await expect(row).toBeVisible();
      });

      await test.step('the first pick opens the summary for that table', async () => {
        await row.click();
        await expect(page.getByTestId('global-search-summary')).toContainText(
          table.entity.displayName
        );
      });

      await test.step('Open goes to the table page and closes search', async () => {
        await page.getByTestId('global-search-summary-open').click();
        await expectOnEntityPage(
          page,
          'table',
          table.entityResponseData.fullyQualifiedName
        );
      });
    });

    test('glossary term and domain hits open their own pages', async ({
      page,
    }) => {
      await test.step('a glossary term hit opens the term page', async () => {
        await searchFor(page, glossaryTerm.data.displayName);
        await page
          .getByTestId(`global-search-row-${glossaryTerm.responseData.id}`)
          .click();
        await expectOnEntityPage(
          page,
          'glossary',
          glossaryTerm.responseData.fullyQualifiedName
        );
      });

      await test.step('a domain hit opens the domain page', async () => {
        await searchFor(page, domain.data.displayName);
        await page
          .getByTestId(`global-search-row-${domain.responseData.id}`)
          .click();
        await expectOnEntityPage(
          page,
          'domain',
          domain.responseData.fullyQualifiedName
        );
      });
    });

    test('Explore opens with the query and sort picked in search', async ({
      page,
    }) => {
      await test.step('sort the Data assets results by name', async () => {
        await searchFor(page, table.entity.displayName);
        await page.getByTestId('global-search-tab-assets').click();
        await expect(
          page.getByTestId(`global-search-row-${table.entityResponseData.id}`)
        ).toBeVisible();

        await page.getByTestId('sorting-dropdown-label').click();
        await page.getByTestId('sort-option-displayName.keyword-asc').click();
        await expect(page.getByRole('menu')).toBeHidden();
      });

      await test.step('Explore shows the same search, sorted the same way', async () => {
        await page.getByTestId('global-search-footer-action').click();

        await expect
          .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
          .toEqual(
            expect.objectContaining({
              search: table.entity.displayName,
              sort: 'displayName.keyword',
              sortOrder: 'asc',
            })
          );
        await expect(
          page.getByTestId(
            `table-data-card_${table.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });
    });

    test('a search that opened a result comes back as a recent search', async ({
      page,
    }) => {
      const term = glossaryTerm.data.displayName;

      await test.step('open a result for the term', async () => {
        await searchFor(page, term);
        await page
          .getByTestId(`global-search-row-${glossaryTerm.responseData.id}`)
          .click();
        await expectOnEntityPage(
          page,
          'glossary',
          glossaryTerm.responseData.fullyQualifiedName
        );
      });

      await test.step('after a reload the term reruns from recent searches', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);
        const input = await openSearch(page);
        await page.getByTestId(`global-search-row-${term}`).click();

        await expect(input).toHaveValue(term);
        await expect(
          page.getByTestId(`global-search-row-${glossaryTerm.responseData.id}`)
        ).toBeVisible();
      });
    });

    test('a page the user visited opens again from recently viewed', async ({
      page,
    }) => {
      await test.step('visit the table page', async () => {
        await table.visitEntityPage(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('open it from recently viewed on another page', async () => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);
        await openSearch(page);
        await page
          .getByTestId(`global-search-row-${table.entityResponseData.id}`)
          .click();

        await expectOnEntityPage(
          page,
          'table',
          table.entityResponseData.fullyQualifiedName
        );
      });
    });
  }
);
