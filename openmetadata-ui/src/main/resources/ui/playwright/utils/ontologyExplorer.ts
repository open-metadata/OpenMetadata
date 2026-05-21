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

export async function applyGlossaryFilter(page: Page, glossaryId: string) {
  await page.getByTestId('search-dropdown-Glossary').click();
  await page.getByTestId(glossaryId).click();
  await page.getByTestId('update-btn').click();
}

export async function applyMultipleGlossaryFilters(
  page: Page,
  ...glossaryIds: string[]
) {
  await page.getByTestId('search-dropdown-Glossary').click();
  for (const id of glossaryIds) {
    await page.getByTestId(id).click();
  }
  await page.getByTestId('update-btn').click();
}

export async function navigateToOntologyExplorer(page: Page) {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaries*');
  await sidebarClick(page, SidebarItem.ONTOLOGY_EXPLORER);
  await glossaryResponse;
}

export async function waitForGraphLoaded(page: Page) {
  await expect(page.getByTestId('ontology-graph-loading')).not.toBeVisible({
    timeout: 30000,
  });
}

export async function readNodePositions(
  page: Page
): Promise<Record<string, { x: number; y: number }>> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
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

export interface RenderedEdge {
  from: string;
  to: string;
  relationType: string;
  isBidirectional: boolean;
  inverseRelationType?: string;
}

export interface RelationTypeDef {
  name: string;
  displayName: string;
  description?: string;
  inverseRelation?: string;
  cardinality?: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
  isSymmetric?: boolean;
  color?: string;
  category: 'associative' | 'hierarchical' | 'equivalence';
  isSystemDefined?: boolean;
}

export async function getRelationTypeSettings(
  apiContext: APIRequestContext
): Promise<RelationTypeDef[]> {
  const res = await apiContext.get(
    '/api/v1/system/settings/glossaryTermRelationSettings'
  );
  const body = await res.json();

  return (body?.config_value?.relationTypes ?? []) as RelationTypeDef[];
}

export async function addCustomRelationTypes(
  apiContext: APIRequestContext,
  types: RelationTypeDef[]
): Promise<RelationTypeDef[]> {
  const existing = await getRelationTypeSettings(apiContext);
  const merged = [
    ...existing.filter((e) => !types.some((t) => t.name === e.name)),
    ...types,
  ];
  await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'glossaryTermRelationSettings',
      config_value: { relationTypes: merged },
    },
  });

  return existing;
}

export async function restoreRelationTypeSettings(
  apiContext: APIRequestContext,
  original: RelationTypeDef[]
): Promise<void> {
  await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'glossaryTermRelationSettings',
      config_value: { relationTypes: original },
    },
  });
}

export async function addTermRelationDirect(
  apiContext: APIRequestContext,
  fromTermId: string,
  toTerm: { id: string; name: string; fullyQualifiedName: string },
  relationType: string
): Promise<void> {
  await apiContext.post(`/api/v1/glossaryTerms/${fromTermId}/relations`, {
    data: {
      relationType,
      term: { ...toTerm, type: 'glossaryTerm' },
    },
  });
}

export async function readGraphEdges(page: Page): Promise<RenderedEdge[]> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');

      return typeof el?.dataset.edges === 'string';
    },
    { timeout: 20000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (el: HTMLElement) =>
        JSON.parse(el.dataset.edges ?? '[]') as RenderedEdge[]
    );
}

export async function createApiContext(browser: Browser) {
  const page = await browser.newPage({
    storageState: 'playwright/.auth/admin.json',
  });
  await redirectToHomePage(page);
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);

  return { page, apiContext };
}

export async function disposeApiContext(
  page: Page,
  apiContext: APIRequestContext
) {
  await apiContext.dispose();
  await page.close();
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

export async function tagTableWithGlossaryTerm(
  apiContext: APIRequestContext,
  tableId: string,
  termFQN: string
): Promise<void> {
  await apiContext.patch(`/api/v1/tables/${tableId}`, {
    data: [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          tagFQN: termFQN,
          labelType: 'Manual',
          state: 'Confirmed',
          source: 'Glossary',
        },
      },
    ],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
}

export async function addTermRelation(
  apiContext: APIRequestContext,
  fromTerm: GlossaryTerm,
  toTerm: GlossaryTerm,
  relationType: string
) {
  await fromTerm.patch(apiContext, [
    {
      op: 'add',
      path: '/relatedTerms/0',
      value: {
        relationType,
        term: {
          id: toTerm.responseData.id,
          type: 'glossaryTerm',
          name: toTerm.responseData.name,
          displayName: toTerm.responseData.displayName,
          fullyQualifiedName: toTerm.responseData.fullyQualifiedName,
        },
      },
    },
  ]);
}

export async function navigateAndFilterByGlossary(
  page: Page,
  glossaryId: string
) {
  await navigateToOntologyExplorer(page);
  await waitForGraphLoaded(page);
  await applyGlossaryFilter(page, glossaryId);
  await waitForGraphLoaded(page);
}

export async function applyRelationTypeFilter(page: Page, typeName: string) {
  await page.getByTestId('search-dropdown-Relationship Type').click();
  await page.getByTestId('drop-down-menu').getByText(typeName).click();
  await page.getByTestId('update-btn').click();
  await waitForGraphLoaded(page);
}

export async function selectViewMode(
  page: Page,
  mode: 'overview' | 'hierarchy' | 'crossGlossary'
): Promise<void> {
  await page.getByTestId('view-mode-select').click();
  await page.locator(`[data-key="${mode}"]`).click();
  await waitForGraphLoaded(page);
}

export async function readGraphZoom(page: Page): Promise<number> {
  return page.locator('.ontology-g6-container').evaluate((el: HTMLElement) => {
    const zoom = Number(el.dataset.graphZoom);

    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  });
}

// Badge is at DATA_MODE_TERM_NODE_SIZE/2 + NODE_BADGE_OFFSET_X = 15+8 = 23 px
// to the right and 15+8 = 23 px above the node center (in canvas pixels).
const DATA_MODE_BADGE_CANVAS_OFFSET_PX = 23;

export async function clickDataModeAssetBadge(
  page: Page,
  termId: string
): Promise<void> {
  const positions = await readNodePositions(page);
  const termPos = positions[termId];
  if (!termPos) {
    throw new Error(`Term node ${termId} not found in node positions`);
  }
  const zoom = await readGraphZoom(page);
  const offset = DATA_MODE_BADGE_CANVAS_OFFSET_PX * zoom;
  await page.mouse.click(termPos.x + offset, termPos.y - offset);
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
