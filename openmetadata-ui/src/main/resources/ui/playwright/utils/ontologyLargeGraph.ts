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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { Ontology } from '../../src/generated/entity/data/ontology';
import { OntologyChangeSet } from '../../src/generated/entity/data/ontologyChangeSet';
import { OntologyEditLock } from '../../src/generated/type/ontologyEditLock';
import { deleteFixtureEntity, okJson } from './apiResponse';
import { uuid } from './common';

// The native import endpoint refuses more than 1,000 changed definitions at once, and each concept adds a relation.
const IMPORT_BATCH_SIZE = 450;
const CSV_HEADER =
  'kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,superProperties,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy';

export interface LargeOntologyFixture {
  readonly api: APIRequestContext;
  readonly namespace: string;
  readonly ontology: Ontology;
  readonly cleanup: () => Promise<void>;
}

export const conceptIri = (fixture: { namespace: string }, index: number) =>
  `${fixture.namespace}C${index}`;

export const conceptLabel = (index: number) => `Concept ${index}`;

/** Concept N is a child of concept floor((N - 1) / 4), so the hierarchy is 4-ary. */
const csvRow = (namespace: string, index: number) => {
  const parent =
    index === 0 ? '' : `${namespace}C${Math.floor((index - 1) / 4)}`;

  return `CONCEPT,${namespace}C${index},${conceptLabel(
    index
  )},,OWL_CLASS,${parent},,,,,,,,,,,,,,,,,,,,,,`;
};

const importBatch = async (
  api: APIRequestContext,
  ontology: Ontology,
  csv: string
) => {
  const preview = await okJson<{ changeSet: unknown }>(
    await api.post(`/api/v1/ontologies/${ontology.id}/imports/preview`, {
      data: { data: csv, fileName: 'concepts.csv' },
    }),
    'Preview large ontology import'
  );
  const draft = await okJson<OntologyChangeSet>(
    await api.post('/api/v1/ontologyChangeSets', { data: preview.changeSet }),
    'Create large ontology change set'
  );
  const sessionId = crypto.randomUUID();
  const lock = await okJson<OntologyEditLock>(
    await api.post('/api/v1/ontologyEditLocks/acquire', {
      data: {
        leaseSeconds: 300,
        resourceId: draft.id,
        resourceType: 'ontologyChangeSet',
        sessionId,
      },
    }),
    'Lease large ontology change set'
  );
  const applied = await okJson<OntologyChangeSet>(
    await api.post(`/api/v1/ontologyChangeSets/${draft.id}/apply`, {
      data: { lease: { sessionId, version: lock.version } },
    }),
    'Apply large ontology import'
  );
  expect(applied.state).toBe('APPLIED');
  await api.delete(`/api/v1/ontologyEditLocks/ontologyChangeSet/${draft.id}`, {
    params: { sessionId },
  });
};

/** Creates an ontology of `count` concepts in a 4-ary hierarchy, imported in bounded batches. */
export const createLargeOntology = async (
  api: APIRequestContext,
  count: number,
  prefix = 'pw_large_graph'
): Promise<LargeOntologyFixture> => {
  const name = `${prefix}_${count}_${uuid()}`;
  const namespace = `https://example.org/${name}/`;
  const reviewer = await okJson<{ id: string }>(
    await api.get('/api/v1/users/loggedInUser'),
    'Read large graph reviewer'
  );
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: namespace.slice(0, -1),
        namespace,
        reviewers: [{ id: reviewer.id, type: 'user' }],
      },
    }),
    'Create large graph ontology'
  );
  const cleanup = async () => {
    await deleteFixtureEntity(
      api,
      `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
    );
  };
  try {
    for (let start = 0; start < count; start += IMPORT_BATCH_SIZE) {
      const rows = Array.from(
        { length: Math.min(IMPORT_BATCH_SIZE, count - start) },
        (_, offset) => csvRow(namespace, start + offset)
      );
      await importBatch(
        api,
        ontology,
        [CSV_HEADER, ...rows].join('\r\n') + '\r\n'
      );
    }
  } catch (error) {
    await cleanup();
    throw error;
  }

  return { api, cleanup, namespace, ontology };
};

export const setAppMode = async (
  api: APIRequestContext,
  userId: string,
  mode: 'ai' | 'classic'
) => {
  const response = await api.put(
    `/api/v1/users/${userId}/preferences/appMode`,
    { data: { type: 'appMode', config: { value: mode } } }
  );
  expect(response.ok()).toBeTruthy();
};

export interface GraphVisibility {
  readonly total: number;
  readonly visible: number;
  readonly zoom: number;
  readonly canvas: { height: number; left: number; top: number; width: number };
}

/** Node positions are published in viewport coordinates, so a node is drawn when it falls inside the canvas box. */
export const readGraphVisibility = (page: Page): Promise<GraphVisibility> =>
  page.locator('.ontology-g6-container').evaluate((element) => {
    const box = element.getBoundingClientRect();
    const positions = Object.values(
      JSON.parse(
        (element as HTMLElement).dataset.nodePositions ?? '{}'
      ) as Record<string, { x: number; y: number }>
    );

    return {
      canvas: {
        height: box.height,
        left: box.left,
        top: box.top,
        width: box.width,
      },
      total: positions.length,
      visible: positions.filter(
        ({ x, y }) =>
          x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
      ).length,
      zoom: Number((element as HTMLElement).dataset.graphZoom ?? '0'),
    };
  });

export const openLargeOntology = async (
  page: Page,
  fixture: LargeOntologyFixture,
  conceptId?: string
) => {
  await page.goto(
    `/governance/ontology?ontology=${fixture.ontology.id}${
      conceptId ? `&concept=${conceptId}` : ''
    }`
  );
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
};

/** Concept ids by display label, read page by page so a 2,000 concept ontology is complete. */
export const listConceptIds = async (
  api: APIRequestContext,
  ontology: Ontology
): Promise<Map<string, string>> => {
  const ids = new Map<string, string>();
  let after: string | undefined;
  do {
    const page = await okJson<{
      data: { displayName?: string; id: string; name: string }[];
      paging: { after?: string };
    }>(
      await api.get('/api/v1/ontologyConcepts', {
        params: {
          limit: 1000,
          ontology: ontology.fullyQualifiedName ?? ontology.name,
          ...(after ? { after } : {}),
        },
      }),
      'List large ontology concepts'
    );
    page.data.forEach(({ displayName, id, name }) =>
      ids.set(displayName ?? name, id)
    );
    after = page.paging.after;
  } while (after);

  return ids;
};
