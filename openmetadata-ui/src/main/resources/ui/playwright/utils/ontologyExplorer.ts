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
  inverseRelationType?: string;
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

export async function addTermRelation(
  apiContext: APIRequestContext,
  fromTerm: GlossaryTerm,
  toTerm: GlossaryTerm,
  relationType: string
) {
  const termRes = await apiContext.get(
    `/api/v1/glossaryTerms/${fromTerm.responseData.id}?fields=relatedTerms`
  );
  const termData = await termRes.json();
  const existingRelations: Array<Record<string, unknown>> =
    termData.relatedTerms ?? [];

  await fromTerm.patch(apiContext, [
    {
      op: 'add',
      path: '/relatedTerms',
      value: [
        ...existingRelations,
        {
          relationType,
          term: {
            id: toTerm.responseData.id,
            type: 'glossaryTerm',
            name: toTerm.responseData.name,
            displayName: toTerm.responseData.displayName,
            fullyQualifiedName: toTerm.responseData.fullyQualifiedName,
          },
        },
      ],
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

export type CardinalityLabels = {
  startLabelText: string;
  endLabelText: string;
};

export async function readCardinalityMap(
  page: Page
): Promise<Record<string, CardinalityLabels>> {
  await page.waitForFunction(
    () =>
      typeof document.querySelector<HTMLElement>('.ontology-g6-container')
        ?.dataset.cardinalityMap === 'string',
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

export async function addRelationTypeWithCardinality(
  apiContext: APIRequestContext,
  relationType: {
    name: string;
    displayName: string;
    cardinality: string;
    sourceMax?: number | null;
    targetMax?: number | null;
  }
): Promise<void> {
  const settingsRes = await apiContext.get(
    '/api/v1/system/settings/glossaryTermRelationSettings'
  );
  const settings = await settingsRes.json();
  const existing: Array<{ name: string }> =
    settings.config_value?.relationTypes ?? [];

  if (existing.some((rt) => rt.name === relationType.name)) {
    return;
  }

  const res = await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'glossaryTermRelationSettings',
      config_value: {
        relationTypes: [
          ...existing,
          {
            name: relationType.name,
            displayName: relationType.displayName,
            category: 'associative',
            cardinality: relationType.cardinality,
            ...(relationType.sourceMax === undefined
              ? {}
              : { sourceMax: relationType.sourceMax }),
            ...(relationType.targetMax === undefined
              ? {}
              : { targetMax: relationType.targetMax }),
          },
        ],
      },
    },
  });

  if (!res.ok()) {
    throw new Error(
      `addRelationTypeWithCardinality: failed to add "${
        relationType.name
      }" — HTTP ${res.status()}`
    );
  }
}

async function clearRelationTypeUsages(
  apiContext: APIRequestContext,
  relationTypeName: string
): Promise<void> {
  let after: string | undefined;
  const pageSize = 100;

  do {
    const url =
      `/api/v1/glossaryTerms?limit=${pageSize}&fields=relatedTerms` +
      (after ? `&after=${after}` : '');
    const res = await apiContext.get(url);
    if (!res.ok()) {
      break;
    }
    const body = await res.json();
    const terms: Array<{
      id: string;
      relatedTerms?: Array<{ relationType: string }>;
    }> = body.data ?? [];

    for (const term of terms) {
      const filtered = (term.relatedTerms ?? []).filter(
        (r) => r.relationType !== relationTypeName
      );
      if (filtered.length !== (term.relatedTerms ?? []).length) {
        await apiContext.patch(`/api/v1/glossaryTerms/${term.id}`, {
          data: [{ op: 'add', path: '/relatedTerms', value: filtered }],
          headers: { 'Content-Type': 'application/json-patch+json' },
        });
      }
    }

    after = body.paging?.after;
  } while (after);
}

export async function removeRelationType(
  apiContext: APIRequestContext,
  relationTypeName: string
): Promise<void> {
  const settingsRes = await apiContext.get(
    '/api/v1/system/settings/glossaryTermRelationSettings'
  );
  const settings = await settingsRes.json();
  const existing: Array<{ name: string }> =
    settings.config_value?.relationTypes ?? [];

  if (!existing.some((rt) => rt.name === relationTypeName)) {
    return;
  }

  await clearRelationTypeUsages(apiContext, relationTypeName);

  const res = await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'glossaryTermRelationSettings',
      config_value: {
        relationTypes: existing.filter((rt) => rt.name !== relationTypeName),
      },
    },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(
      `removeRelationType: failed to remove "${relationTypeName}" — HTTP ${res.status()}: ${body}`
    );
  }
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
