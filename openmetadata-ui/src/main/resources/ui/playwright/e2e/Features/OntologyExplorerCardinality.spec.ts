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

import { expect, test } from '@playwright/test';
import { OntologyExplorerCardinalityData as CardinalityData } from '../../support/entity/OntologyExplorerDataClass';
import {
  applyGlossaryFilter,
  createApiContext,
  disposeApiContext,
  navigateToOntologyExplorer,
  readCardinalityMap,
  readGraphEdges,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Ontology Explorer - Cardinality Labels', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await CardinalityData.setup(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createApiContext(browser);
    await CardinalityData.teardown(apiContext);
    await disposeApiContext(afterAction, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, CardinalityData.glossary.responseData.id);
    await waitForGraphLoaded(page);
  });

  test.describe('Cardinality label map — correct labels per relation type', () => {
    test('ONE_TO_ONE relation type should have label "1" on both ends', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CardinalityData.CUSTOM_RELATION_NAMES.ONE_TO_ONE
      );

      expect(
        cardinalityMap[CardinalityData.CUSTOM_RELATION_NAMES.ONE_TO_ONE]
      ).toEqual({
        startLabelText: '1',
        endLabelText: '1',
      });
    });

    test('ONE_TO_MANY relation type should have "1" at source and "M" at target', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CardinalityData.CUSTOM_RELATION_NAMES.ONE_TO_MANY
      );

      expect(
        cardinalityMap[CardinalityData.CUSTOM_RELATION_NAMES.ONE_TO_MANY]
      ).toEqual({
        startLabelText: '1',
        endLabelText: 'M',
      });
    });

    test('MANY_TO_ONE relation type should have "M" at source and "1" at target', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CardinalityData.CUSTOM_RELATION_NAMES.MANY_TO_ONE
      );

      expect(
        cardinalityMap[CardinalityData.CUSTOM_RELATION_NAMES.MANY_TO_ONE]
      ).toEqual({
        startLabelText: 'M',
        endLabelText: '1',
      });
    });

    test('MANY_TO_MANY relation type should have label "M" on both ends', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CardinalityData.CUSTOM_RELATION_NAMES.MANY_TO_MANY
      );

      expect(
        cardinalityMap[CardinalityData.CUSTOM_RELATION_NAMES.MANY_TO_MANY]
      ).toEqual({
        startLabelText: 'M',
        endLabelText: 'M',
      });
    });

    test('CUSTOM relation type with sourceMax=1 and no targetMax should produce "1" → "M"', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CardinalityData.CUSTOM_RELATION_NAMES.CUSTOM_1_M
      );

      expect(
        cardinalityMap[CardinalityData.CUSTOM_RELATION_NAMES.CUSTOM_1_M]
      ).toEqual({
        startLabelText: '1',
        endLabelText: 'M',
      });
    });

    test('built-in relation type shows M:M cardinality in the cardinality map', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(page, 'relatedTo');

      expect(cardinalityMap['relatedTo']).toEqual({
        startLabelText: 'M',
        endLabelText: 'M',
      });
    });
  });

  test.describe('Graph renders correctly with cardinality-typed edges', () => {
    test('edges for cardinality-typed relations appear in the graph edge data', async ({
      page,
    }) => {
      // Wait for at least 5 edges so all custom-cardinality types are present.
      const edges = await readGraphEdges(page, 5);
      const relationTypes = new Set(edges.map((e) => e.relationType));

      expect(
        relationTypes.has(CardinalityData.CUSTOM_RELATION_NAMES.ONE_TO_ONE) ||
          relationTypes.has(
            CardinalityData.CUSTOM_RELATION_NAMES.ONE_TO_MANY
          ) ||
          relationTypes.has(
            CardinalityData.CUSTOM_RELATION_NAMES.MANY_TO_ONE
          ) ||
          relationTypes.has(CardinalityData.CUSTOM_RELATION_NAMES.MANY_TO_MANY)
      ).toBe(true);
    });

    test('graph renders without error when cardinality relation types are active', async ({
      page,
    }) => {
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
      await expect(page.getByTestId('ontology-graph-empty')).not.toBeVisible();
    });

    test('stats reflect the cardinality-typed edges in the relation count', async ({
      page,
    }) => {
      const stats = page.getByTestId('ontology-explorer-stats');
      await expect(stats).toBeVisible();
      const text = await stats.textContent();
      const match = text?.match(/(\d+)\s+Relations?/);
      const relationCount = match ? Number(match[1]) : 0;

      expect(relationCount).toBeGreaterThan(0);
    });
  });

  test.describe('Edge labels toggle with cardinality edges', () => {
    test('cardinality map is populated when edge labels are on (default)', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(page);

      expect(Object.keys(cardinalityMap).length).toBeGreaterThan(0);
    });

    test('graph remains stable after toggling edge labels off and back on', async ({
      page,
    }) => {
      await page.getByTestId('ontology-graph-settings').click();
      await expect(page.getByTestId('graph-settings-close')).toBeVisible();

      const toggle = page.getByTestId('graph-settings-edge-labels-toggle');
      await toggle.click();
      await expect(toggle).not.toHaveAttribute('data-selected', 'true');

      await toggle.click();
      await expect(toggle).toHaveAttribute('data-selected', 'true');

      await page.getByTestId('graph-settings-close').click();
      await expect(page.getByTestId('ontology-explorer')).toBeVisible();
    });
  });
});
