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

import {
  APIRequestContext,
  Browser,
  expect,
  Locator,
  Page,
  TestInfo,
} from '@playwright/test';
import {
  OntologyPackInstallJob,
  Status as InstallJobStatus,
} from '../../src/generated/api/data/ontologyPackInstallJob';
import { Ontology } from '../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../src/generated/entity/data/ontologyConcept';
import { ACTION_TIMEOUT } from '../constant/common';
import { Glossary } from '../support/glossary/Glossary';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { UserClass } from '../support/user/UserClass';
import { deleteFixtureEntity, okJson } from './apiResponse';
import {
  getAuthContext,
  getToken,
  redirectToHomePage,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
  uuid,
} from './common';
import { waitForResponseWithStatus } from './waitHelpers';

const SETTLED_INSTALL_JOB = new Set<string>([
  InstallJobStatus.Completed,
  InstallJobStatus.Failed,
  InstallJobStatus.Cancelled,
]);

/**
 * The settled job of a library install into an existing ontology: the start
 * response when the job settles at once, otherwise the poll that sees it settle.
 */
export function waitForPackInstallJob(
  page: Page,
  ontologyId: string
): Promise<OntologyPackInstallJob> {
  const library = `/api/v1/ontologies/${ontologyId}/library/`;

  return page
    .waitForResponse(async (candidate) => {
      const path = new URL(candidate.url()).pathname;
      if (
        !path.startsWith(library) ||
        !(path.endsWith('/install') || path.startsWith(`${library}jobs/`))
      ) {
        return false;
      }
      if (!candidate.ok()) {
        return true;
      }
      const job: OntologyPackInstallJob = await candidate.json();

      return SETTLED_INSTALL_JOB.has(job.status);
    })
    .then((response) =>
      okJson<OntologyPackInstallJob>(response, 'Library install job')
    );
}

export interface GraphTermRef {
  id: string;
  name: string;
}

export const DANGLING_GRAPH_NODE_ID = '00000000-0000-0000-0000-000000000000';

/** The scope menu lists 20 ontologies at a time, so a fixture on a shared backend is found by searching for it. */
export async function findOntologyInScopeMenu(
  page: Page,
  ontology: Pick<Ontology, 'id' | 'name'>
) {
  await page.getByTestId('ontology-scope-search').fill(ontology.name);

  return page.getByTestId(`ontology-scope-${ontology.id}`);
}

/** The concept panel's relationship type is a select; picks one by type id. */
export async function chooseInspectorRelationType(
  page: Page,
  inspector: Locator,
  typeId: string
) {
  await selectOptionWithRetry(
    inspector.getByTestId('ontology-relationship-type').getByRole('button'),
    page.getByTestId(`relation-type-${typeId}`)
  );
}

/** Opens the full relationship chooser (search, glosses, new type) from the panel's select. */
export async function openInspectorRelationChooser(
  page: Page,
  inspector: Locator
) {
  await chooseInspectorRelationType(
    page,
    inspector,
    '__browse-relation-types__'
  );
  await expect(page.getByTestId('relationship-type-picker')).toBeVisible();
}

/**
 * Opens release history: readers have the release chip, editors reach it under
 * Review & publish → Releases.
 */
export async function openReleaseHistory(page: Page) {
  const readerChip = page.getByTestId('ontology-release-history-trigger');
  const publish = page.getByTestId('ontology-publication-trigger');
  // A user has exactly one of the two, so the union never matches twice.
  await expect(readerChip.or(publish)).toBeVisible();
  if (await readerChip.isVisible()) {
    await readerChip.click();

    return;
  }
  await publish.click();
  await page.getByTestId('ontology-publication-tab-releases').click();
  await expect(
    page.getByTestId('ontology-publication-tab-releases')
  ).toHaveAttribute('aria-selected', 'true');
}

/** The Import / export button opens a menu; this opens the Import or the Export dialog. */
export async function openOntologyTransfer(
  page: Page,
  dialog: 'import' | 'export' = 'export'
) {
  await page.getByTestId('ontology-import-export-trigger').click();
  await page.getByTestId(`ontology-${dialog}-menu-item`).click();
}

/** The export scope, options, preview and SHACL check sit in the dialog's collapsed Advanced section. */
export async function openExportAdvanced(page: Page) {
  const advanced = page.getByTestId('ontology-export-advanced');
  if ((await advanced.getAttribute('aria-expanded')) !== 'true') {
    await advanced.click();
  }
  await expect(advanced).toHaveAttribute('aria-expanded', 'true');
}

/** Opens one ontology's Import dialog and points it at a new ontology instead. */
export async function openNewOntologyImport(
  page: Page,
  owner: Pick<Ontology, 'id'>
) {
  await page.goto(`/governance/ontology?ontology=${owner.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await openOntologyTransfer(page, 'import');
  await page.getByTestId('ontology-native-import-target').click();
  await page.getByRole('option', { name: /new ontology/i }).click();
}

/** The ontology chooser is a searchable dropdown; typing the name shows the fixture's option. */
export async function findOntologyInQueryPicker(
  page: Page,
  ontology: Pick<Ontology, 'id' | 'name' | 'displayName'>
) {
  await expect(page.getByTestId('ontology-query-picker')).toBeVisible();
  await page
    .getByTestId('ontology-query-picker')
    .getByRole('combobox')
    .fill(ontology.displayName ?? ontology.name);
  const option = page.getByTestId(
    `ontology-query-picker-option-${ontology.id}`
  );
  await expect(option).toBeVisible();

  return option;
}

export async function applyGlossaryFilter(page: Page, glossaryId: string) {
  const scopeMenu = page.getByTestId('ontology-scope-menu-trigger');
  if ((await scopeMenu.getAttribute('aria-expanded')) !== 'true') {
    await scopeMenu.click();
  }
  const glossaryOption = page.getByTestId(glossaryId);
  await glossaryOption.scrollIntoViewIfNeeded();
  await glossaryOption.click();
  await expect(scopeMenu).toHaveAttribute('aria-expanded', 'false');
  await expect(scopeMenu).toHaveAttribute(
    'data-scope-key',
    `glossary:${glossaryId}`
  );
}

export async function navigateToOntologyStudio(page: Page) {
  const glossaryResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/glossaries'),
    200,
    { timeout: ACTION_TIMEOUT }
  );

  await page.goto('/governance/ontology?scope=glossary:all');
  await glossaryResponse;
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await expect(page.getByTestId('ontology-scope-menu-trigger')).toHaveAttribute(
    'data-scope-key',
    'glossary:all'
  );
}

export async function waitForGraphLoaded(page: Page) {
  await expect(page.getByTestId('ontology-graph-loading')).not.toBeVisible({
    timeout: ACTION_TIMEOUT,
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
    'aria-selected',
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

export type GraphPoints = Record<string, { x: number; y: number }>;

/**
 * Client-space points the studio graph publishes for specs: node centres,
 * edge midpoints and the Edit-mode connect handles.
 */
/** The studio's own graph, never the SPARQL results graph that query mode mounts beside it. */
const STUDIO_GRAPH_CONTAINER =
  '.ontology-g6-container:not([data-testid="ontology-sparql-result-graph"] *)';

export async function readGraphPoints(
  page: Page,
  kind: 'node' | 'edge' | 'port'
): Promise<GraphPoints> {
  return page
    .locator(STUDIO_GRAPH_CONTAINER)
    .evaluate((el: HTMLElement, key) => {
      const raw = {
        node: el.dataset.nodePositions,
        edge: el.dataset.edgePositions,
        port: el.dataset.portPositions,
      }[key];

      return JSON.parse(raw ?? '{}') as Record<
        string,
        { x: number; y: number }
      >;
    }, kind);
}

/** Waits until the graph publishes a point for every id, then returns them. */
export async function waitForGraphPoints(
  page: Page,
  kind: 'node' | 'edge' | 'port',
  ids: string[]
): Promise<GraphPoints> {
  let points: GraphPoints = {};
  await expect
    .poll(async () => {
      points = await readGraphPoints(page, kind);

      return ids.every(
        (id) => Number.isFinite(points[id]?.x) && Number.isFinite(points[id]?.y)
      );
    })
    .toBe(true);

  return points;
}

/** A canvas point at least `clearance` px from every node, inside the graph area. */
const CANVAS_OVERLAY_TEST_IDS = [
  'ontology-conflicts-panel',
  'ontology-health-panel',
  'ontology-canvas-toolbar',
  'ontology-graph-controls',
  'ontology-graph-mode-model',
];

export async function findEmptyCanvasPoint(
  page: Page,
  clearance = 160,
  { besideDrawer = false } = {}
): Promise<{ x: number; y: number }> {
  // The graph re-fits when a side panel opens or closes, so measure only once
  // two reads agree.
  let previous = '';
  let positions = await readNodePositions(page);
  await expect
    .poll(
      async () => {
        positions = await readNodePositions(page);
        const current = JSON.stringify(positions);
        const settled = current === previous;
        previous = current;

        return settled;
      },
      { intervals: [300], timeout: 6000 }
    )
    .toBe(true);
  // Measured after the settle: the panel that just closed resizes the canvas.
  const box = await page.locator(STUDIO_GRAPH_CONTAINER).boundingBox();
  if (!box) {
    throw new Error('The graph canvas is not rendered');
  }
  const nodes = Object.values(positions);
  // Cards and toolbars float over the canvas; a double-click there never reaches it.
  const overlays = (
    await Promise.all(
      CANVAS_OVERLAY_TEST_IDS.map((id) =>
        page
          .getByTestId(id)
          .boundingBox({ timeout: 1000 })
          .catch(() => null)
      )
    )
  ).filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  const isUnderOverlay = (x: number, y: number) =>
    overlays.some(
      (rect) =>
        x >= rect.x - 40 &&
        x <= rect.x + rect.width + 40 &&
        y >= rect.y - 40 &&
        y <= rect.y + rect.height + 40
    );
  // A studio drawer is 40vw with a 420px floor plus its 8px inset
  // (ADR:2026-11-12-ontology-studio-drawers-are-40vw-with-a-420px-floor). A node created
  // under it is panned into view when it opens, so it no longer sits at the click.
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const right = besideDrawer
    ? Math.min(
        box.x + box.width,
        viewportWidth - Math.max(viewportWidth * 0.4, 420) - 8
      )
    : box.x + box.width;
  const candidates = [];
  for (let x = box.x + 120; x < right - 120; x += 40) {
    for (let y = box.y + 120; y < box.y + box.height - 120; y += 40) {
      if (!isUnderOverlay(x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  const distance = (point: { x: number; y: number }) =>
    Math.min(
      ...nodes.map((node) => Math.hypot(node.x - point.x, node.y - point.y))
    );
  const best = candidates.sort((a, b) => distance(b) - distance(a))[0];
  if (!best || distance(best) < clearance) {
    throw new Error(
      'No empty canvas point is at least ' + clearance + 'px from a node'
    );
  }

  return best;
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

/**
 * The query-results graph, for callers that run with the studio's own graph also
 * on screen.
 *
 * Query mode mounts OntologyGraphG6 twice -- once for the explorer and once for
 * the SPARQL results -- and both carry `.ontology-g6-container`, so a bare
 * selector matches two elements and a Playwright locator raises a strict-mode
 * violation. Worse when it does not: `document.querySelector` silently takes
 * whichever happens to be first, so a caller meaning to read the results could
 * read the explorer instead and still find the edge it was looking for.
 */
export const QUERY_RESULT_GRAPH_CONTAINER =
  '[data-testid="ontology-sparql-result-graph"] .ontology-g6-container';

export async function readGraphEdges(
  page: Page,
  minCount = 1,
  containerSelector = '.ontology-g6-container'
): Promise<RenderedEdge[]> {
  await page.waitForFunction(
    ({ min, selector }) => {
      const el = document.querySelector<HTMLElement>(selector);
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
    { min: minCount, selector: containerSelector },
    { timeout: 20000 }
  );

  return page
    .locator(containerSelector)
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
    { timeout: ACTION_TIMEOUT }
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
  const termsResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/glossaryTerms'),
    200,
    { timeout: ACTION_TIMEOUT }
  );
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

export const STUDIO_PATH = '/governance/ontology';

export type OntologyRoleName =
  | 'OntologyAuthor'
  | 'OntologyReviewer'
  | 'DataSteward'
  | 'DataConsumer';

/** A signed-up user holding exactly the named roles, on top of the DataConsumer default the signup grants. */
export async function createUserWithRoles(
  api: APIRequestContext,
  roles: OntologyRoleName[]
): Promise<UserClass> {
  const user = new UserClass();
  await user.create(api);
  for (const roleName of roles.filter((name) => name !== 'DataConsumer')) {
    const role = await okJson<{ id: string }>(
      await api.get(`/api/v1/roles/name/${roleName}`),
      `Read the ${roleName} role`
    );
    await okJson(
      await api.patch(`/api/v1/users/${user.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/roles/-',
            value: { id: role.id, type: 'role' },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      }),
      `Assign ${roleName}`
    );
  }

  return user;
}

/** A signed-in page for the user, in its own browser context so two roles can act in one test. */
export async function openPageAs(
  browser: Browser,
  user: UserClass
): Promise<Page> {
  const page = await browser.newPage();
  await user.signIn(page);

  return page;
}

export interface FlowOntologyOptions {
  prefix: string;
  ownerIds?: string[];
  reviewerIds?: string[];
  concepts?: string[];
}

export async function createFlowConcept(
  api: APIRequestContext,
  ontology: Ontology,
  label: string
): Promise<OntologyConcept> {
  return okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name: label,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
        description: `${label} definition`,
      },
    }),
    `Create the ${label} concept`
  );
}

/** An ontology with a name unique to the run, because hard delete archives one that has releases and archived names stay taken. */
export async function createFlowOntology(
  api: APIRequestContext,
  {
    prefix,
    ownerIds = [],
    reviewerIds = [],
    concepts = [],
  }: FlowOntologyOptions
): Promise<{ ontology: Ontology; concepts: OntologyConcept[] }> {
  const name = `${prefix}_${uuid()}`;
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: `https://example.org/${name}`,
        namespace: `https://example.org/${name}/`,
        owners: ownerIds.map((id) => ({ id, type: 'user' })),
        reviewers: reviewerIds.map((id) => ({ id, type: 'user' })),
      },
    }),
    'Create the flow ontology'
  );
  const created: OntologyConcept[] = [];
  for (const label of concepts) {
    created.push(await createFlowConcept(api, ontology, label));
  }

  return { ontology, concepts: created };
}

export async function removeFlowOntologies(
  api: APIRequestContext,
  ontologies: Array<Ontology | undefined>
): Promise<void> {
  for (const ontology of ontologies) {
    if (ontology) {
      await deleteFixtureEntity(
        api,
        `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
      );
    }
  }
}

export async function openOntologyInStudio(
  page: Page,
  ontologyId: string,
  query = ''
): Promise<void> {
  await page.goto(`${STUDIO_PATH}?ontology=${ontologyId}${query}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
}

/** Attaches a full-page screenshot to the report under the P1 name, such as `p1-create`. */
export async function attachStudioShot(
  page: Page,
  testInfo: TestInfo,
  name: string
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/**
 * Picks an ontology from a core Select the way a user does in a long list. Past
 * 100 items the list is virtualized and only the rows in view are in the DOM,
 * so typing the name lets react-aria's type-to-select focus and scroll to the
 * row. The trigger is settled in view first because a scroll of its container
 * after the popover opens closes the popover. A picker that is replaced by the
 * next step once a row is chosen passes `replacedOnPick` instead of showing the
 * name in its trigger.
 */
export async function selectOntologyOption(
  page: Page,
  trigger: Locator,
  name: string,
  { replacedOnPick = false }: { replacedOnPick?: boolean } = {}
) {
  await scrollIntoViewAndSettle(trigger);
  await trigger.click();
  const listbox = page.locator('[role="listbox"]:focus-within');
  await expect(listbox).toHaveCount(1);
  await page.keyboard.type(name, { delay: 20 });
  await listbox.getByRole('option', { name, exact: true }).click();
  await expect(listbox).toHaveCount(0);
  if (replacedOnPick) {
    await expect(trigger).toHaveCount(0);
  } else {
    await expect(trigger).toContainText(name);
  }
}
