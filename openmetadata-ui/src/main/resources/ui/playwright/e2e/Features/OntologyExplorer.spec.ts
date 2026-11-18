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
import { SidebarItem } from '../../constant/sidebar';
import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../utils/common';
import {
  addTermRelation,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const glossary = new Glossary();
const source = new GlossaryTerm(glossary);
const target = new GlossaryTerm(glossary);

// Collate serves Ontology Studio on this route, so the read-only Explorer exists only in OSS.
if (process.env.PLAYWRIGHT_IS_OSS) {
  test.describe('Ontology Explorer', () => {
    test.beforeAll('Seed a related pair of terms', async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      await glossary.create(apiContext);
      await source.create(apiContext);
      await target.create(apiContext);
      await addTermRelation(apiContext, source, target, 'relatedTo');

      await afterAction();
    });

    test.afterAll('Clean up the seeded terms', async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      await source.delete(apiContext);
      await target.delete(apiContext);
      await glossary.delete(apiContext);

      await afterAction();
    });

    test('opens from the Govern sidebar with its header, stats and graph', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.ONTOLOGY_EXPLORER);

      await expect(page).toHaveURL(/\/governance\/ontology$/);
      await expect(page.getByTestId('ontology-explorer-header')).toContainText(
        'Ontology Explorer'
      );
      await expect(page.getByTestId('beta-badge')).toBeVisible();
      await waitForGraphLoaded(page);
      await expect(page.getByTestId('ontology-explorer-stats')).toContainText(
        'Terms'
      );
    });

    test('switches between the model graph and the data layer', async ({
      page,
    }) => {
      await page.goto('/governance/ontology');
      await waitForGraphLoaded(page);

      const layers = page.getByTestId('ontology-layer-switch');
      const search = page.getByTestId('ontology-graph-search');

      // The concept search belongs to the model layer only.
      await expect(search).toBeVisible();
      await layers.getByRole('tab', { name: 'Data' }).click();
      await expect(layers.getByRole('tab', { name: 'Data' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(search).toHaveCount(0);

      await layers.getByRole('tab', { name: 'Model' }).click();
      await expect(search).toBeVisible();
    });
  });
}
