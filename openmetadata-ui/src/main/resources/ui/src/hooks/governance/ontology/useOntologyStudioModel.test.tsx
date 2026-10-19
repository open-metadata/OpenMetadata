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
import { useOntologyStudioModel } from './useOntologyStudioModel';

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
