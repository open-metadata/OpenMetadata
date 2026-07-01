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
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  addRelationTypeWithCardinality,
  addTermRelation,
  applyGlossaryFilter,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readCardinalityMap,
  readGraphEdges,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Unique suffix per worker/repeat so parallel runs don't share relation type names.
const RUN_ID = Math.random().toString(36).slice(2, 8);
const CUSTOM_RELATION_NAMES = {
  ONE_TO_ONE: `pw-c-oto-${RUN_ID}`,
  ONE_TO_MANY: `pw-c-otm-${RUN_ID}`,
  MANY_TO_ONE: `pw-c-mto-${RUN_ID}`,
  MANY_TO_MANY: `pw-c-mtm-${RUN_ID}`,
  CUSTOM_1_M: `pw-c-cus-${RUN_ID}`,
} as const;

// Each relation type gets its own isolated source-target pair so no single
// term accumulates multiple cardinality-constrained relations, which would
// trigger backend re-validation failures on the second PATCH.
const glossary = new Glossary();
const otoSrc = new GlossaryTerm(glossary);
const otoDst = new GlossaryTerm(glossary);
const otmSrc = new GlossaryTerm(glossary);
const otmDst = new GlossaryTerm(glossary);
const mtoSrc = new GlossaryTerm(glossary);
const mtoDst = new GlossaryTerm(glossary);
const mtmSrc = new GlossaryTerm(glossary);
const mtmDst = new GlossaryTerm(glossary);
const cusSrc = new GlossaryTerm(glossary);
const cusDst = new GlossaryTerm(glossary);
const relSrc = new GlossaryTerm(glossary);
const relDst = new GlossaryTerm(glossary);

test.describe('Ontology Explorer - Cardinality Labels', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    await glossary.create(apiContext);
    await otoSrc.create(apiContext);
    await otoDst.create(apiContext);
    await otmSrc.create(apiContext);
    await otmDst.create(apiContext);
    await mtoSrc.create(apiContext);
    await mtoDst.create(apiContext);
    await mtmSrc.create(apiContext);
    await mtmDst.create(apiContext);
    await cusSrc.create(apiContext);
    await cusDst.create(apiContext);
    await relSrc.create(apiContext);
    await relDst.create(apiContext);

    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_RELATION_NAMES.ONE_TO_ONE,
      displayName: 'PW One To One',
      cardinality: 'ONE_TO_ONE',
    });
    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_RELATION_NAMES.ONE_TO_MANY,
      displayName: 'PW One To Many',
      cardinality: 'ONE_TO_MANY',
    });
    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_RELATION_NAMES.MANY_TO_ONE,
      displayName: 'PW Many To One',
      cardinality: 'MANY_TO_ONE',
    });
    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_RELATION_NAMES.MANY_TO_MANY,
      displayName: 'PW Many To Many',
      cardinality: 'MANY_TO_MANY',
    });
    await addRelationTypeWithCardinality(apiContext, {
      name: CUSTOM_RELATION_NAMES.CUSTOM_1_M,
      displayName: 'PW Custom 1:M',
      cardinality: 'CUSTOM',
      sourceMax: 1,
      targetMax: null,
    });

    await addTermRelation(
      apiContext,
      otoSrc,
      otoDst,
      CUSTOM_RELATION_NAMES.ONE_TO_ONE
    );
    await addTermRelation(
      apiContext,
      otmSrc,
      otmDst,
      CUSTOM_RELATION_NAMES.ONE_TO_MANY
    );
    await addTermRelation(
      apiContext,
      mtoSrc,
      mtoDst,
      CUSTOM_RELATION_NAMES.MANY_TO_ONE
    );
    await addTermRelation(
      apiContext,
      mtmSrc,
      mtmDst,
      CUSTOM_RELATION_NAMES.MANY_TO_MANY
    );
    await addTermRelation(
      apiContext,
      cusSrc,
      cusDst,
      CUSTOM_RELATION_NAMES.CUSTOM_1_M
    );
    await addTermRelation(apiContext, relSrc, relDst, 'relatedTo');

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    await deleteEntities(
      apiContext,
      otoSrc,
      otoDst,
      otmSrc,
      otmDst,
      mtoSrc,
      mtoDst,
      mtmSrc,
      mtmDst,
      cusSrc,
      cusDst,
      relSrc,
      relDst,
      glossary
    );

    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, glossary.responseData.id);
    await waitForGraphLoaded(page);
  });

  test.describe('Cardinality label map — correct labels per relation type', () => {
    test('ONE_TO_ONE relation type should have label "1" on both ends', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CUSTOM_RELATION_NAMES.ONE_TO_ONE
      );

      expect(cardinalityMap[CUSTOM_RELATION_NAMES.ONE_TO_ONE]).toEqual({
        startLabelText: '1',
        endLabelText: '1',
      });
    });

    test('ONE_TO_MANY relation type should have "1" at source and "M" at target', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CUSTOM_RELATION_NAMES.ONE_TO_MANY
      );

      expect(cardinalityMap[CUSTOM_RELATION_NAMES.ONE_TO_MANY]).toEqual({
        startLabelText: '1',
        endLabelText: 'M',
      });
    });

    test('MANY_TO_ONE relation type should have "M" at source and "1" at target', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CUSTOM_RELATION_NAMES.MANY_TO_ONE
      );

      expect(cardinalityMap[CUSTOM_RELATION_NAMES.MANY_TO_ONE]).toEqual({
        startLabelText: 'M',
        endLabelText: '1',
      });
    });

    test('MANY_TO_MANY relation type should have label "M" on both ends', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CUSTOM_RELATION_NAMES.MANY_TO_MANY
      );

      expect(cardinalityMap[CUSTOM_RELATION_NAMES.MANY_TO_MANY]).toEqual({
        startLabelText: 'M',
        endLabelText: 'M',
      });
    });

    test('CUSTOM relation type with sourceMax=1 and no targetMax should produce "1" → "M"', async ({
      page,
    }) => {
      const cardinalityMap = await readCardinalityMap(
        page,
        CUSTOM_RELATION_NAMES.CUSTOM_1_M
      );

      expect(cardinalityMap[CUSTOM_RELATION_NAMES.CUSTOM_1_M]).toEqual({
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
        relationTypes.has(CUSTOM_RELATION_NAMES.ONE_TO_ONE) ||
          relationTypes.has(CUSTOM_RELATION_NAMES.ONE_TO_MANY) ||
          relationTypes.has(CUSTOM_RELATION_NAMES.MANY_TO_ONE) ||
          relationTypes.has(CUSTOM_RELATION_NAMES.MANY_TO_MANY)
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
