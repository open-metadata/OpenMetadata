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

import { ProjectionState } from '../generated/api/rdf/rdfStatus';
import APIClient from './index';
import {
  fetchRdfConfig,
  runGlossarySparqlQuery,
  runSparqlQuery,
} from './rdfAPI';

jest.mock('./index', () => ({
  get: jest.fn(),
  post: jest.fn(),
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
      askCollateEnabled: true,
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
