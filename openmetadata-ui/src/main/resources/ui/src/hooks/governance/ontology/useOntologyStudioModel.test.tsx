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
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
} from '../../../rest/ontologyAPI';
import {
  useAllOntologyStudioModels,
  useOntologyStudioModel,
} from './useOntologyStudioModel';

jest.mock('../../../rest/ontologyAPI');

const mockListOntologyAxioms = listOntologyAxioms as jest.MockedFunction<
  typeof listOntologyAxioms
>;
const mockListOntologyConcepts = listOntologyConcepts as jest.MockedFunction<
  typeof listOntologyConcepts
>;
const mockListOntologyProperties =
  listOntologyProperties as jest.MockedFunction<typeof listOntologyProperties>;

const ontology: Ontology = {
  fullyQualifiedName: 'Retail',
  id: 'ontology-retail',
  iri: 'urn:retail',
  name: 'Retail',
  namespace: 'urn:retail:',
};

const concept = (name: string): OntologyConcept => ({
  conceptType: OntologyConceptType.OwlClass,
  fullyQualifiedName: `Retail.${name}`,
  id: `concept-${name}`,
  iri: `urn:retail:${name}`,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { gcTime: 0, retry: false } },
      })
    }>
    {children}
  </QueryClientProvider>
);

describe('useOntologyStudioModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListOntologyProperties.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockListOntologyAxioms.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  it('loads every model page before building the graph', async () => {
    mockListOntologyConcepts
      .mockResolvedValueOnce({
        data: [concept('Order')],
        paging: { after: 'next-concept', total: 2 },
      })
      .mockResolvedValueOnce({
        data: [concept('Customer')],
        paging: { total: 2 },
      });

    const { result } = renderHook(() => useOntologyStudioModel(ontology), {
      wrapper,
    });

    await waitFor(() => expect(result.current.model).toBeDefined());

    expect(result.current.model?.concepts.map(({ name }) => name)).toEqual([
      'Order',
      'Customer',
    ]);
    expect(mockListOntologyConcepts).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ after: 'next-concept' }),
      expect.any(AbortSignal)
    );
  });

  it('fails visibly when a cursor repeats instead of returning a truncated model', async () => {
    const page = Array.from({ length: 5_000 }, () => concept('Repeated'));
    mockListOntologyConcepts.mockResolvedValue({
      data: page,
      paging: { after: 'same-cursor', total: 15_000 },
    });

    const { result } = renderHook(() => useOntologyStudioModel(ontology), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.model).toBeUndefined();
    expect(mockListOntologyConcepts).toHaveBeenCalledTimes(2);
  });
});

describe('all native ontology models', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockListOntologyConcepts.mockResolvedValue({
      data: [concept('Order')],
      paging: { total: 1 },
    });
    mockListOntologyProperties.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockListOntologyAxioms.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  it('loads native definitions with their owning ontology', async () => {
    const second = {
      ...ontology,
      id: 'other',
      name: 'Other',
      fullyQualifiedName: 'Other',
    };
    mockListOntologyConcepts.mockImplementation(async (params) => ({
      data: [{ ...concept('Order'), id: params?.ontology + '-order' }],
      paging: { total: 1 },
    }));
    const { result } = renderHook(
      () => useAllOntologyStudioModels([ontology, second], true),
      { wrapper }
    );
    await waitFor(() => expect(result.current.graph?.nodes).toHaveLength(2));

    expect(result.current.graph?.nodes.map((node) => node.glossaryId)).toEqual([
      ontology.id,
      second.id,
    ]);
  });

  it('fails instead of issuing an unscoped definition request for a missing name', async () => {
    const { result } = renderHook(
      () =>
        useAllOntologyStudioModels(
          [{ ...ontology, fullyQualifiedName: '' }],
          true
        ),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.graph).toBeNull();
    expect(mockListOntologyConcepts).not.toHaveBeenCalled();
  });

  it('refuses too many ontologies before requesting definitions', async () => {
    const { result } = renderHook(
      () =>
        useAllOntologyStudioModels(
          Array.from({ length: 21 }, (_, id) => ({
            ...ontology,
            id: String(id),
          })),
          true
        ),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isTooLarge).toBe(true));

    expect(result.current.graph).toBeNull();
    expect(mockListOntologyConcepts).not.toHaveBeenCalled();
  });

  it('refuses aggregate definition totals before fetching model bodies', async () => {
    mockListOntologyConcepts.mockResolvedValue({
      data: [],
      paging: { total: 2001 },
    });
    const { result } = renderHook(
      () => useAllOntologyStudioModels([ontology], true),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isTooLarge).toBe(true));

    expect(result.current.graph).toBeNull();
    expect(mockListOntologyConcepts).toHaveBeenCalledTimes(1);
  });

  it('enforces the definition budget if totals change during loading', async () => {
    mockListOntologyConcepts
      .mockResolvedValueOnce({ data: [], paging: { total: 1 } })
      .mockResolvedValueOnce({
        data: Array.from({ length: 2001 }, () => concept('Order')),
        paging: { total: 2001 },
      });
    const { result } = renderHook(
      () => useAllOntologyStudioModels([ontology], true),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isTooLarge).toBe(true));

    expect(result.current.graph).toBeNull();
  });

  it('never returns a partial graph when one model fails', async () => {
    mockListOntologyAxioms.mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(
      () => useAllOntologyStudioModels([ontology], true),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.graph).toBeNull();
  });
});
