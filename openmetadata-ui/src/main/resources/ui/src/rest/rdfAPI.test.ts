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

import { isEqual } from 'lodash';
import { ProjectionState } from '../generated/api/rdf/rdfStatus';
import APIClient from './axiosClient';
import {
  fetchRdfConfig,
  getSparqlQueryTemplates,
  replaceSavedSparqlQueries,
  runGlossarySparqlQuery,
  runSparqlQuery,
} from './rdfAPI';

jest.mock('./axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const mockedApiClient = APIClient as jest.Mocked<typeof APIClient>;
const QUERY = 'SELECT ?concept WHERE { ?concept ?predicate ?value }';

describe('rdfAPI SPARQL routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.post.mockResolvedValue({
      data: '{"head":{"vars":[]},"results":{"bindings":[]}}',
      headers: { 'content-type': 'application/sparql-results+json' },
    });
  });

  it('routes glossary queries through the authorized ontology endpoint', async () => {
    await runGlossarySparqlQuery('glossary-id', { query: QUERY });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/glossaries/glossary-id/sparql',
      { format: 'json', inference: 'none', query: QUERY },
      expect.objectContaining({
        headers: { Accept: 'application/sparql-results+json' },
      })
    );
  });

  it('keeps the unrestricted route explicit for administrator callers', async () => {
    await runSparqlQuery({ query: QUERY });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/rdf/sparql',
      { format: 'json', inference: 'none', query: QUERY },
      expect.any(Object)
    );
  });

  it('loads the effective RDF and Ontology AI capability status', async () => {
    const status = {
      aiEnabled: true,
      baseUri: 'https://open-metadata.org/',
      enabled: true,
      inference: {
        availableLevels: ['none'],
        defaultLevel: 'none',
        enabled: false,
      },
      projectionState: ProjectionState.Ready,
      storageType: 'fuseki',
    };
    mockedApiClient.get.mockResolvedValue({ data: status });

    const result = await fetchRdfConfig();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/rdf/status');
    expect(result).toEqual(status);
  });
});

describe('rdfAPI saved queries', () => {
  it('keeps the ontology a saved query belongs to through a library save', async () => {
    const scoped = {
      id: 'scoped',
      name: 'Scoped',
      query: QUERY,
      format: 'json' as const,
      inference: 'none' as const,
      savedAt: 1,
      ontologyId: 'ontology-id',
    };
    mockedApiClient.put.mockResolvedValue({ data: { queries: [scoped] } });

    const stored = await replaceSavedSparqlQueries([scoped]);

    expect(mockedApiClient.put).toHaveBeenCalledWith('/rdf/queries/saved', {
      queries: [scoped],
    });
    expect(stored[0].ontologyId).toBe('ontology-id');
  });

  it('returns an unscoped template equal to what the server stored', async () => {
    const template = {
      id: 'template',
      name: 'Template',
      query: QUERY,
      format: 'json',
      inference: 'none',
      savedAt: 0,
    };
    mockedApiClient.get.mockResolvedValue({
      data: { queryTemplates: [template] },
    });

    const [stored] = await getSparqlQueryTemplates();

    expect(stored).not.toHaveProperty('ontologyId');
    expect(isEqual(stored, template)).toBe(true);
  });
});
