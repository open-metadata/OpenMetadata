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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { getGlossariesList } from '../../../rest/glossaryAPI';
import { listOntologies } from '../../../rest/ontologyAPI';
import {
  ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY,
  useOntologyStudioScopes,
} from './useOntologyStudioScopes';

jest.mock('../../../rest/glossaryAPI');
jest.mock('../../../rest/ontologyAPI');

const mockGetGlossariesList = getGlossariesList as jest.MockedFunction<
  typeof getGlossariesList
>;
const mockListOntologies = listOntologies as jest.MockedFunction<
  typeof listOntologies
>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })
    }>
    {children}
  </QueryClientProvider>
);

describe('useOntologyStudioScopes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads every page and sorts both scope kinds by display name', async () => {
    mockListOntologies
      .mockResolvedValueOnce({
        data: [
          {
            fullyQualifiedName: 'zeta',
            id: 'ontology-zeta',
            iri: 'urn:zeta',
            name: 'zeta',
            namespace: 'urn:zeta:',
          },
        ],
        paging: { after: 'ontology-next', total: 2 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            displayName: 'Alpha',
            fullyQualifiedName: 'alpha',
            id: 'ontology-alpha',
            iri: 'urn:alpha',
            name: 'alpha',
            namespace: 'urn:alpha:',
          },
        ],
        paging: { total: 2 },
      });
    mockGetGlossariesList
      .mockResolvedValueOnce({
        data: [{ description: '', id: 'glossary-zeta', name: 'Zeta' }],
        paging: { after: 'glossary-next', total: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ description: '', id: 'glossary-alpha', name: 'Alpha' }],
        paging: { total: 2 },
      });

    const { result } = renderHook(
      () => useOntologyStudioScopes({ enabled: true, knownGlossaries: [] }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.ontologies.map((ontology) => ontology.id)).toEqual([
      'ontology-alpha',
      'ontology-zeta',
    ]);
    expect(result.current.glossaries.map((glossary) => glossary.id)).toEqual([
      'glossary-alpha',
      'glossary-zeta',
    ]);
    expect(mockListOntologies).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ after: 'ontology-next' }),
      expect.any(AbortSignal)
    );
    expect(mockGetGlossariesList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ after: 'glossary-next' }),
      expect.any(AbortSignal)
    );
  });

  it('loads native entry without requesting glossary scopes', async () => {
    mockListOntologies.mockResolvedValue({ data: [], paging: { total: 0 } });
    const { result } = renderHook(
      () =>
        useOntologyStudioScopes({
          enabled: true,
          loadGlossaries: false,
          knownGlossaries: [],
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isOntologyLoading).toBe(false));

    expect(result.current.isOntologyError).toBe(false);
    expect(mockGetGlossariesList).not.toHaveBeenCalled();
  });

  it('reports a background refresh of cached ontologies as fetching, not loading', async () => {
    let resolveList:
      | ((value: { data: never[]; paging: { total: number } }) => void)
      | undefined;
    mockListOntologies.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData([ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY], []);
    const { result } = renderHook(
      () =>
        useOntologyStudioScopes({
          enabled: true,
          loadGlossaries: false,
          knownGlossaries: [],
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      }
    );

    await waitFor(() => expect(result.current.isOntologyFetching).toBe(true));

    expect(result.current.isOntologyLoading).toBe(false);

    resolveList?.({ data: [], paging: { total: 0 } });
    await waitFor(() => expect(result.current.isOntologyFetching).toBe(false));
  });

  it('keeps native loading success independent of glossary failure', async () => {
    mockListOntologies.mockResolvedValue({ data: [], paging: { total: 0 } });
    mockGetGlossariesList.mockRejectedValue(new Error('Glossary forbidden'));
    const { result } = renderHook(
      () =>
        useOntologyStudioScopes({
          enabled: true,
          loadGlossaries: true,
          knownGlossaries: [],
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isOntologyError).toBe(false);
    expect(result.current.ontologies).toEqual([]);
  });

  it('does not fetch until the scope menu is opened', () => {
    renderHook(
      () => useOntologyStudioScopes({ enabled: false, knownGlossaries: [] }),
      { wrapper }
    );

    expect(mockListOntologies).not.toHaveBeenCalled();
    expect(mockGetGlossariesList).not.toHaveBeenCalled();
  });
});
