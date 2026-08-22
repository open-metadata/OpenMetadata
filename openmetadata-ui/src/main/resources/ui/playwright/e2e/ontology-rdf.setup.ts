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
  APIResponse,
  expect,
  test as setup,
} from '@playwright/test';
import {
  ProjectionState,
  RDFStatus,
} from '../../src/generated/api/rdf/rdfStatus';
import { createAdminApiContext } from '../utils/admin';
import { uuid } from '../utils/common';

interface ProbeEntity {
  id: string;
}

interface ProbeFixture {
  glossaryName: string;
  termId: string;
}

interface SparqlAskResult {
  boolean: boolean;
}

const isProjectionState = (value: unknown): value is ProjectionState =>
  Object.values(ProjectionState).some((state) => state === value);

const isRdfStatus = (value: unknown): value is RDFStatus =>
  typeof value === 'object' &&
  value !== null &&
  'enabled' in value &&
  typeof value.enabled === 'boolean' &&
  'projectionState' in value &&
  isProjectionState(value.projectionState) &&
  'storageType' in value &&
  typeof value.storageType === 'string';

const isProbeEntity = (value: unknown): value is ProbeEntity =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string';

const isSparqlAskResult = (value: unknown): value is SparqlAskResult =>
  typeof value === 'object' &&
  value !== null &&
  'boolean' in value &&
  typeof value.boolean === 'boolean';

const requireEntity = async (
  response: APIResponse,
  entityType: string
): Promise<ProbeEntity> => {
  const body: unknown = await response.json();

  if (!response.ok() || !isProbeEntity(body)) {
    throw new Error(
      `RDF setup could not create ${entityType}: HTTP ${response.status()}`
    );
  }

  return body;
};

const createProbeFixture = async (
  apiContext: APIRequestContext
): Promise<ProbeFixture> => {
  const suffix = uuid().replaceAll('-', '');
  const glossaryName = `pw_rdf_probe_${suffix}`;
  const glossaryResponse = await apiContext.post('/api/v1/glossaries', {
    data: {
      description: 'RDF shard write and read probe',
      displayName: glossaryName,
      mutuallyExclusive: false,
      name: glossaryName,
    },
  });
  await requireEntity(glossaryResponse, 'probe glossary');

  const termResponse = await apiContext.post('/api/v1/glossaryTerms', {
    data: {
      description: 'RDF shard projection probe term',
      displayName: `RdfProbeTerm${suffix}`,
      glossary: glossaryName,
      name: `RdfProbeTerm${suffix}`,
    },
  });
  const term = await requireEntity(termResponse, 'probe glossary term');

  return { glossaryName, termId: term.id };
};

const isProbeProjected = async (
  apiContext: APIRequestContext,
  termId: string
): Promise<boolean> => {
  const termIri = `https://open-metadata.org/entity/glossaryTerm/${termId}`;
  const response = await apiContext.post('/api/v1/rdf/sparql', {
    data: {
      format: 'json',
      inference: 'none',
      query: `ASK { GRAPH ?graph { <${termIri}> ?predicate ?value } }`,
    },
  });
  const body: unknown = response.ok() ? await response.json() : undefined;

  return isSparqlAskResult(body) && body.boolean;
};

const deleteProbeFixture = async (
  apiContext: APIRequestContext,
  glossaryName: string
): Promise<void> => {
  const response = await apiContext.delete(
    `/api/v1/glossaries/name/${encodeURIComponent(
      glossaryName
    )}?recursive=true&hardDelete=true`
  );

  if (!response.ok() && response.status() !== 404) {
    throw new Error(
      `RDF setup could not remove probe glossary: HTTP ${response.status()}`
    );
  }
};

setup('assert RDF health and projection writes', async () => {
  setup.setTimeout(180_000);
  const { apiContext, afterAction } = await createAdminApiContext();
  let fixture: ProbeFixture | undefined;

  try {
    const statusResponse = await apiContext.get('/api/v1/rdf/status');
    const statusBody: unknown = statusResponse.ok()
      ? await statusResponse.json()
      : undefined;

    expect(statusResponse.ok()).toBeTruthy();
    expect(isRdfStatus(statusBody)).toBeTruthy();

    if (!isRdfStatus(statusBody)) {
      throw new Error('RDF status response is not valid');
    }

    expect(statusBody.enabled).toBe(true);
    expect(statusBody.projectionState).not.toBe(ProjectionState.Degraded);
    expect(statusBody.projectionState).not.toBe(ProjectionState.Disabled);
    expect(statusBody.storageType).not.toHaveLength(0);

    const createdFixture = await createProbeFixture(apiContext);
    fixture = createdFixture;
    await expect
      .poll(() => isProbeProjected(apiContext, createdFixture.termId), {
        message: 'RDF projection did not expose the write probe',
        timeout: 120_000,
      })
      .toBe(true);
  } finally {
    if (fixture) {
      await deleteProbeFixture(apiContext, fixture.glossaryName);
    }

    await afterAction();
  }
});
