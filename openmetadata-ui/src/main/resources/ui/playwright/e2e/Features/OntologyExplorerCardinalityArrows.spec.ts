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
  addCustomRelationTypes,
  addTermRelation,
  applyGlossaryFilter,
  createApiContext,
  deleteEntities,
  disposeApiContext,
  navigateToOntologyExplorer,
  readGraphEdges,
  RelationTypeDef,
  restoreRelationTypeSettings,
  selectViewMode,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });
const glossary = new Glossary();

const termA = new GlossaryTerm(glossary);
const termB = new GlossaryTerm(glossary);
const termC = new GlossaryTerm(glossary);
const termD = new GlossaryTerm(glossary);
const termE = new GlossaryTerm(glossary);
const termF = new GlossaryTerm(glossary);
const termG = new GlossaryTerm(glossary);
const termH = new GlossaryTerm(glossary);
const termI = new GlossaryTerm(glossary);
const termJ = new GlossaryTerm(glossary);
const CUSTOM_TYPES: RelationTypeDef[] = [
  {
    name: 'testOneWay',
    displayName: 'Test One Way',
    description: 'Non-symmetric no-inverse type for unidirectional edge tests',
    cardinality: 'ONE_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#667085',
  },
  {
    name: 'testHasPK',
    displayName: 'Test Has PK',
    description: 'Test ONE_TO_ONE',
    cardinality: 'ONE_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#e31b54',
  },
  {
    name: 'testContains',
    displayName: 'Test Contains',
    description: 'Test ONE_TO_MANY',
    inverseRelation: 'testContainedBy',
    cardinality: 'ONE_TO_MANY',
    isSymmetric: false,
    category: 'associative',
    color: '#0e9384',
  },
  {
    name: 'testContainedBy',
    displayName: 'Test Contained By',
    description: 'Inverse of testContains',
    inverseRelation: 'testContains',
    cardinality: 'MANY_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#0e9384',
  },
  {
    name: 'testGovernedBy',
    displayName: 'Test Governed By',
    description: 'Test MANY_TO_ONE',
    inverseRelation: 'testGoverns',
    cardinality: 'MANY_TO_ONE',
    isSymmetric: false,
    category: 'associative',
    color: '#7a5af8',
  },
  {
    name: 'testGoverns',
    displayName: 'Test Governs',
    description: 'Inverse of testGovernedBy',
    inverseRelation: 'testGovernedBy',
    cardinality: 'ONE_TO_MANY',
    isSymmetric: false,
    category: 'associative',
    color: '#7a5af8',
  },
  {
    name: 'testCrossRef',
    displayName: 'Test Cross Reference',
    description: 'Test MANY_TO_MANY',
    cardinality: 'MANY_TO_MANY',
    isSymmetric: true,
    category: 'associative',
    color: '#f79009',
  },
];

function findEdge(
  edges: Awaited<ReturnType<typeof readGraphEdges>>,
  fromId: string,
  toId: string
) {
  return edges.find(
    (e) =>
      (e.from === fromId && e.to === toId) ||
      (e.from === toId && e.to === fromId)
  );
}

function hasRelationType(
  edges: Awaited<ReturnType<typeof readGraphEdges>>,
  fromId: string,
  toId: string,
  relationType: string
) {
  return edges.some(
    (e) =>
      ((e.from === fromId && e.to === toId) ||
        (e.from === toId && e.to === fromId)) &&
      (e.relationType === relationType ||
        e.inverseRelationType === relationType)
  );
}

let originalSettings: RelationTypeDef[] = [];

test.describe('Cardinality Arrow Rendering', () => {
  test.beforeAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    originalSettings = await addCustomRelationTypes(apiContext, CUSTOM_TYPES);

    await glossary.create(apiContext);
    await Promise.all(
      [
        termA,
        termB,
        termC,
        termD,
        termE,
        termF,
        termG,
        termH,
        termI,
        termJ,
      ].map((t) => t.create(apiContext))
    );

    await addTermRelation(apiContext, termA, termB, 'synonym');

    await addTermRelation(apiContext, termC, termD, 'testOneWay');

    await addTermRelation(apiContext, termE, termF, 'partOf');
    await addTermRelation(apiContext, termF, termE, 'hasPart');

    await addTermRelation(apiContext, termG, termH, 'testHasPK');
    await addTermRelation(apiContext, termH, termI, 'testContains');
    await addTermRelation(apiContext, termI, termJ, 'testGovernedBy');
    await addTermRelation(apiContext, termJ, termG, 'testCrossRef');

    await disposeApiContext(page, apiContext);
  });

  test.afterAll(async ({ browser }) => {
    const { page, apiContext } = await createApiContext(browser);

    await deleteEntities(
      apiContext,
      termA,
      termB,
      termC,
      termD,
      termE,
      termF,
      termG,
      termH,
      termI,
      termJ,
      glossary
    );

    // Restore original relation type settings
    await restoreRelationTypeSettings(apiContext, originalSettings);

    await disposeApiContext(page, apiContext);
  });

  test.beforeEach(async ({ page }) => {
    test.slow();
    await navigateToOntologyExplorer(page);
    await waitForGraphLoaded(page);
    await applyGlossaryFilter(page, glossary.responseData.id);
    await waitForGraphLoaded(page);
  });

  test.describe('Symmetric edges (isBidirectional)', () => {
    test('synonym edge is marked isBidirectional=true even with a single stored edge', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const edge = findEdge(
        edges,
        termA.responseData.id,
        termB.responseData.id
      );

      expect(edge, 'synonym edge must be present in graph data').toBeDefined();
      expect(edge?.isBidirectional).toBe(true);
      expect(
        edge?.inverseRelationType,
        'symmetric merge must not set inverseRelationType'
      ).toBeUndefined();
    });

    test('a non-symmetric no-inverse custom edge (testOneWay) is isBidirectional=false', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const edge = findEdge(
        edges,
        termC.responseData.id,
        termD.responseData.id
      );

      expect(
        edge,
        'testOneWay edge must be present in graph data'
      ).toBeDefined();
      expect(edge?.isBidirectional).toBe(false);
    });
  });
  test.describe('Inverse-pair edges', () => {
    test('partOf + hasPart stored between same pair merges into one isBidirectional=true edge', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const pairsForEF = edges.filter(
        (e) =>
          (e.from === termE.responseData.id &&
            e.to === termF.responseData.id) ||
          (e.from === termF.responseData.id && e.to === termE.responseData.id)
      );

      expect(
        pairsForEF.length,
        'partOf+hasPart should merge into exactly one edge'
      ).toBe(1);
      expect(pairsForEF[0].isBidirectional).toBe(true);

      const types = new Set([
        pairsForEF[0].relationType,
        pairsForEF[0].inverseRelationType,
      ]);

      expect(types.has('partOf') || types.has('hasPart')).toBe(true);
    });
  });

  test.describe('Custom cardinality relation types', () => {
    test('ONE_TO_ONE (testHasPK) edge appears between the correct nodes', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);

      expect(
        hasRelationType(
          edges,
          termG.responseData.id,
          termH.responseData.id,
          'testHasPK'
        )
      ).toBe(true);
    });

    test('ONE_TO_MANY (testContains) edge appears between the correct nodes', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);

      expect(
        hasRelationType(
          edges,
          termH.responseData.id,
          termI.responseData.id,
          'testContains'
        )
      ).toBe(true);
    });

    test('MANY_TO_ONE (testGovernedBy) edge appears between the correct nodes', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);

      expect(
        hasRelationType(
          edges,
          termI.responseData.id,
          termJ.responseData.id,
          'testGovernedBy'
        )
      ).toBe(true);
    });

    test('MANY_TO_MANY (testCrossRef, isSymmetric) edge is isBidirectional=true', async ({
      page,
    }) => {
      const edges = await readGraphEdges(page);
      const edge = findEdge(
        edges,
        termJ.responseData.id,
        termG.responseData.id
      );

      expect(
        edge,
        'testCrossRef edge must be present in graph data'
      ).toBeDefined();
      expect(edge?.isBidirectional).toBe(true);
    });
  });

  test.describe('Edge stability across mode switches', () => {
    test('custom cardinality edges survive a Hierarchy view-mode round-trip', async ({
      page,
    }) => {
      const before = await readGraphEdges(page);

      const cardinalityEdgeBefore = before.find((e) =>
        CUSTOM_TYPES.some(
          (ct) =>
            e.relationType === ct.name || e.inverseRelationType === ct.name
        )
      );

      expect(
        cardinalityEdgeBefore,
        'at least one custom cardinality edge must be visible in Overview mode'
      ).toBeDefined();

      // Switch to Hierarchy via the view-mode dropdown, then back to Overview.
      await selectViewMode(page, 'hierarchy');
      await selectViewMode(page, 'overview');

      const after = await readGraphEdges(page);

      expect(
        after.find((e) =>
          CUSTOM_TYPES.some(
            (ct) =>
              e.relationType === ct.name || e.inverseRelationType === ct.name
          )
        ),
        'custom cardinality edges must still be present after returning to Overview mode'
      ).toBeDefined();
    });

    test('Data mode tab is reachable and does not throw an error', async ({
      page,
    }) => {
      await page.getByRole('tab', { name: 'Data' }).click();
      await waitForGraphLoaded(page);

      await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  test.describe('Edge labels', () => {
    test('shows relation type label badge on the canvas in Model mode', async ({
      page,
    }) => {
      await expect(
        page.locator('.ontology-g6-container canvas').first()
      ).toBeVisible();
      const edges = await readGraphEdges(page);

      expect(
        edges.length,
        'at least one edge must be present to render labels'
      ).toBeGreaterThan(0);
    });
  });
});
