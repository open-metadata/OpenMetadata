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

import { APIRequestContext, Browser, expect, Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { Glossary } from '../support/glossary/Glossary';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { getAuthContext, getToken, redirectToHomePage } from '../utils/common';
import { sidebarClick } from '../utils/sidebar';

export interface GraphTermRef {
  id: string;
  name: string;
}

export const DANGLING_GRAPH_NODE_ID = '00000000-0000-0000-0000-000000000000';

export async function applyGlossaryFilter(page: Page, glossaryId: string) {
  const studioGlossaryMenu = page.getByTestId('ontology-glossary-menu-trigger');
  if (await studioGlossaryMenu.isVisible()) {
    if ((await studioGlossaryMenu.getAttribute('aria-expanded')) !== 'true') {
      await studioGlossaryMenu.click();
    }
    const glossaryOption = page.getByTestId(glossaryId);
    await glossaryOption.scrollIntoViewIfNeeded();
    await glossaryOption.click();
    await expect(studioGlossaryMenu).toHaveAttribute('aria-expanded', 'false');
    await expect(studioGlossaryMenu).toHaveAttribute(
      'data-selected-glossary-id',
      glossaryId
    );

    return;
  }

  await page.getByTestId('search-dropdown-glossaryIds').click();
  await page.getByTestId(glossaryId).click();
  const termsResponse = page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/v1/glossaryTerms') &&
        response.status() === 200,
      { timeout: 30000 }
    )
    .catch(() => null);
  await page.getByTestId('update-btn').click();
  await termsResponse;
}

export async function navigateToOntologyStudio(page: Page) {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaries') &&
      response.status() === 200,
    { timeout: 30000 }
  );

  await sidebarClick(page, SidebarItem.ONTOLOGY_EXPLORER);
  await glossaryResponse;
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
}

export async function waitForGraphLoaded(page: Page) {
  await expect(page.getByTestId('ontology-graph-loading')).not.toBeVisible({
    timeout: 30000,
  });
}

export async function releaseOntologyEditLease(
  page: Page,
  glossaryId: string
): Promise<void> {
  const releaseResponse = page
    .waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/v1/ontologyEditLocks/glossary/${glossaryId}`) &&
        response.request().method() === 'DELETE',
      { timeout: 10_000 }
    )
    .catch(() => undefined);
  await page.getByTestId('mode-tab-view').click();
  await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(
    page.getByTestId('ontology-edit-lease-status')
  ).not.toBeVisible();

  const response = await releaseResponse;
  if (response) {
    expect(response.ok(), await response.text()).toBe(true);
  }
}

export async function readNodePositions(
  page: Page
): Promise<Record<string, { x: number; y: number }>> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      if (el?.dataset.fitViewInProgress === 'true') {
        return false;
      }
      const pos = el?.dataset.nodePositions;
      if (!pos) {
        return false;
      }
      try {
        return Object.keys(JSON.parse(pos)).length > 0;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 20000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (el: HTMLElement) =>
        JSON.parse(el.dataset.nodePositions ?? '{}') as Record<
          string,
          { x: number; y: number }
        >
    );
}

export async function clickFirstGraphNode(page: Page): Promise<void> {
  const positions = await readNodePositions(page);
  const firstPos = Object.values(positions)[0];
  await page.mouse.click(firstPos.x, firstPos.y);
}

export async function clickGraphNode(
  page: Page,
  nodeId: string
): Promise<void> {
  const positions = await readNodePositions(page);
  const position = positions[nodeId];
  if (!position) {
    throw new Error(`Graph node ${nodeId} was not rendered`);
  }
  await page.mouse.click(position.x, position.y);
}

export interface RenderedEdge {
  edgeKind?: string;
  from: string;
  provenance?: string;
  to: string;
  relationType: string;
  inverseRelationType?: string;
}

export async function readGraphEdges(
  page: Page,
  minCount = 1
): Promise<RenderedEdge[]> {
  await page.waitForFunction(
    (min) => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const raw = el?.dataset.edges;
      if (typeof raw !== 'string') {
        return false;
      }
      try {
        const count = (JSON.parse(raw) as unknown[]).length;

        return min === 0 ? true : count >= min;
      } catch {
        return false;
      }
    },
    minCount,
    { timeout: 20000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (el: HTMLElement) =>
        JSON.parse(el.dataset.edges ?? '[]') as RenderedEdge[]
    );
}

export async function readSearchHighlightIds(page: Page): Promise<string[]> {
  await page.waitForFunction(
    () => {
      const element = document.querySelector<HTMLElement>(
        '.ontology-g6-container'
      );
      const value = element?.dataset.searchHighlightIds;

      return typeof value === 'string' && value !== '[]';
    },
    { timeout: 20000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (element: HTMLElement) =>
        JSON.parse(element.dataset.searchHighlightIds ?? '[]') as string[]
    );
}

export function buildRdfGraphJson(
  glossaryId: string,
  term1: GraphTermRef,
  term2: GraphTermRef
) {
  return {
    nodes: [
      { id: term1.id, label: term1.name, type: 'glossaryTerm', glossaryId },
      { id: term2.id, label: term2.name, type: 'glossaryTerm', glossaryId },
    ],
    edges: [{ from: term1.id, to: term2.id, relationType: 'relatedTo' }],
  };
}

export function buildMalformedRdfGraphJson(
  glossaryId: string,
  term1: GraphTermRef,
  term2: GraphTermRef
) {
  return {
    nodes: [
      { id: term1.id, label: term1.name, type: 'glossaryTerm', glossaryId },
      { id: term1.id, label: term1.name, type: 'glossaryTerm', glossaryId },
      { id: term2.id, label: term2.name, type: 'glossaryTerm', glossaryId },
    ],
    edges: [
      { from: term1.id, to: term2.id, relationType: 'relatedTo' },
      { from: term1.id, to: DANGLING_GRAPH_NODE_ID, relationType: 'relatedTo' },
    ],
  };
}

export async function createApiContext(browser: Browser) {
  const page = await browser.newPage({
    storageState: 'playwright/.auth/admin.json',
  });
  await redirectToHomePage(page);
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);
  const afterAction = async () => {
    await apiContext.dispose();
    await page.close();
  };

  return { page, apiContext, afterAction };
}

export async function disposeApiContext(
  afterActionOrPage: (() => Promise<void>) | Page,
  apiContext: APIRequestContext
) {
  if (typeof afterActionOrPage === 'function') {
    await afterActionOrPage();

    return;
  }

  await apiContext.dispose();
  await afterActionOrPage.close();
}

export async function deleteEntities(
  apiContext: APIRequestContext,
  ...entities: Array<Glossary | GlossaryTerm>
) {
  for (const entity of entities) {
    if (entity.responseData?.id) {
      await entity.delete(apiContext);
    }
  }
}

export async function addTermRelation(
  apiContext: APIRequestContext,
  fromTerm: GlossaryTerm,
  toTerm: GlossaryTerm,
  relationType: string
) {
  const toTermRef = {
    id: toTerm.responseData.id,
    type: 'glossaryTerm',
    name: toTerm.responseData.name,
    displayName: toTerm.responseData.displayName,
    fullyQualifiedName: toTerm.responseData.fullyQualifiedName,
  };
  const termRes = await apiContext.get(
    `/api/v1/glossaryTerms/${fromTerm.responseData.id}?fields=relatedTerms`
  );
  const termData = await termRes.json();
  const hasExisting =
    Array.isArray(termData.relatedTerms) && termData.relatedTerms.length > 0;
  const patchOp = hasExisting
    ? {
        op: 'add',
        path: '/relatedTerms/-',
        value: { relationType, term: toTermRef },
      }
    : {
        op: 'add',
        path: '/relatedTerms',
        value: [{ relationType, term: toTermRef }],
      };

  await fromTerm.patch(apiContext, [patchOp]);
}

export async function navigateAndFilterByGlossary(
  page: Page,
  glossaryId: string
) {
  await navigateToOntologyStudio(page);
  await waitForGraphLoaded(page);
  await applyGlossaryFilter(page, glossaryId);
  await waitForGraphLoaded(page);
}

export async function applyRelationTypeFilter(page: Page, typeName: string) {
  await page.getByTestId('search-dropdown-relationTypes').click();
  await page.getByTestId('drop-down-menu').getByText(typeName).click();
  await page.getByTestId('update-btn').click();
  await waitForGraphLoaded(page);
}

export async function readGraphZoom(page: Page): Promise<number> {
  return page.locator('.ontology-g6-container').evaluate((el: HTMLElement) => {
    const zoom = Number(el.dataset.graphZoom);

    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  });
}

export type CardinalityLabels = {
  startLabelText: string;
  endLabelText: string;
};

export async function readCardinalityMap(
  page: Page,
  waitForKeys: string | string[] = []
): Promise<Record<string, CardinalityLabels>> {
  const keys = Array.isArray(waitForKeys) ? waitForKeys : [waitForKeys];

  await page.waitForFunction(
    (requiredKeys) => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const raw = el?.dataset.cardinalityMap;
      if (typeof raw !== 'string') {
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        return requiredKeys.length === 0
          ? Object.keys(parsed).length > 0
          : requiredKeys.every((k) => k in parsed);
      } catch {
        return false;
      }
    },
    keys,
    { timeout: 20000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (el: HTMLElement) =>
        JSON.parse(el.dataset.cardinalityMap ?? '{}') as Record<
          string,
          CardinalityLabels
        >
    );
}

const RELATIONSHIP_TYPES_API = '/api/v1/relationshipTypes';

interface TestRelationType {
  name: string;
  displayName: string;
  cardinality: string;
  sourceMax?: number | null;
  targetMax?: number | null;
}

function buildCardinality(relationType: TestRelationType) {
  switch (relationType.cardinality) {
    case 'ONE_TO_ONE':
      return { sourceMax: 1, targetMax: 1 };
    case 'ONE_TO_MANY':
      return { targetMax: 1 };
    case 'MANY_TO_ONE':
      return { sourceMax: 1 };
    case 'CUSTOM': {
      const cardinality: { sourceMax?: number; targetMax?: number } = {};
      if (relationType.sourceMax != null) {
        cardinality.sourceMax = relationType.sourceMax;
      }
      if (relationType.targetMax != null) {
        cardinality.targetMax = relationType.targetMax;
      }

      return cardinality;
    }
    default:
      return undefined;
  }
}

export async function addRelationTypeWithCardinality(
  apiContext: APIRequestContext,
  relationType: TestRelationType
): Promise<void> {
  const cardinality = buildCardinality(relationType);
  const response = await apiContext.post(RELATIONSHIP_TYPES_API, {
    data: {
      name: relationType.name,
      displayName: relationType.displayName,
      description: '',
      rdfPredicate: `https://example.org/relations/${relationType.name}`,
      category: 'CUSTOM',
      paletteKey: 'BLUE',
      ...(cardinality ? { cardinality } : {}),
    },
  });
  if (!response.ok()) {
    if (response.status() === 409) {
      const concurrentCreate = await apiContext.get(
        `${RELATIONSHIP_TYPES_API}/name/${encodeURIComponent(
          relationType.name
        )}`
      );
      if (concurrentCreate.ok()) {
        return;
      }
    }
    throw new Error(
      `Failed to create relationship type "${
        relationType.name
      }": ${response.status()} ${await response.text()}`
    );
  }
}

export async function deleteRelationTypeByName(
  apiContext: APIRequestContext,
  name: string
): Promise<void> {
  const lookup = await apiContext.get(
    `${RELATIONSHIP_TYPES_API}/name/${encodeURIComponent(name)}`
  );
  if (lookup.status() === 404) {
    return;
  }
  if (!lookup.ok()) {
    throw new Error(
      `Failed to look up relationship type "${name}": ${lookup.status()} ${await lookup.text()}`
    );
  }

  const relationType = (await lookup.json()) as { id: string };
  const response = await apiContext.delete(
    `${RELATIONSHIP_TYPES_API}/${relationType.id}`
  );
  if (!response.ok() && response.status() !== 404) {
    throw new Error(
      `Failed to delete relationship type "${name}": ${response.status()} ${await response.text()}`
    );
  }
}

// Relationship types are first-class entities, so parallel workers can create
// independent types without replacing a shared settings document.
export async function addRelationTypesWithCardinality(
  apiContext: APIRequestContext,
  relationTypes: TestRelationType[]
): Promise<void> {
  await Promise.all(
    relationTypes.map(async (relationType) => {
      const lookup = await apiContext.get(
        `${RELATIONSHIP_TYPES_API}/name/${encodeURIComponent(
          relationType.name
        )}`
      );
      if (lookup.ok()) {
        return;
      }
      if (lookup.status() !== 404) {
        throw new Error(
          `Failed to look up relationship type "${
            relationType.name
          }": ${lookup.status()} ${await lookup.text()}`
        );
      }

      await addRelationTypeWithCardinality(apiContext, relationType);
    })
  );
}

export async function waitForMoreNodesThan(
  page: Page,
  count: number
): Promise<void> {
  await page.waitForFunction(
    (minCount) => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const pos = el?.dataset.nodePositions;
      if (!pos) {
        return false;
      }
      try {
        return Object.keys(JSON.parse(pos)).length > minCount;
      } catch {
        return false;
      }
    },
    count,
    { timeout: 30000 }
  );
}
export async function applyMultiGlossaryFilter(
  page: Page,
  ...glossaryIds: string[]
): Promise<void> {
  await page.getByTestId('search-dropdown-glossaryIds').click();
  for (const id of glossaryIds) {
    await page.getByTestId(id).click();
  }
  const termsResponse = page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/v1/glossaryTerms') &&
        response.status() === 200,
      { timeout: 30000 }
    )
    .catch(() => null);
  await page.getByTestId('update-btn').click();
  await termsResponse;
}

export async function waitForNodePresent(
  page: Page,
  termId: string
): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const raw = el?.dataset.nodePositions;
      if (!raw) {
        return false;
      }
      try {
        return id in JSON.parse(raw);
      } catch {
        return false;
      }
    },
    termId,
    { timeout: 20000 }
  );
}

export async function waitForNodeAbsent(
  page: Page,
  termId: string
): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const raw = el?.dataset.nodePositions;
      if (!raw) {
        return false;
      }
      try {
        const positions = JSON.parse(raw);

        return !(id in positions) && Object.keys(positions).length > 0;
      } catch {
        return false;
      }
    },
    termId,
    { timeout: 20000 }
  );
}
