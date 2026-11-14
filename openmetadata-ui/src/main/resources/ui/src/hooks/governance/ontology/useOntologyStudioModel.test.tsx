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
import { AxiosError, AxiosResponse } from 'axios';
import { ReactNode } from 'react';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import { OntologyDefinitionStatus } from '../../../generated/type/ontologyDefinitionStatus';
import {
  listOntologyAxioms,
  listOntologyConcepts,
  listOntologyProperties,
  listOntologyReleaseMembers,
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

  it('retains server lifecycle status in the owner model', async () => {
    mockListOntologyConcepts.mockImplementation(async (params) => ({
      data: [
        {
          ...concept('Order'),
          ...(params?.fields?.includes('lifecycleStatus') && {
            lifecycleStatus: OntologyDefinitionStatus.Draft,
          }),
        },
      ],
      paging: { total: 1 },
    }));

    const { result } = renderHook(() => useOntologyStudioModel(ontology), {
      wrapper,
    });

    await waitFor(() => expect(result.current.model).toBeDefined());

    expect(result.current.model?.concepts[0].lifecycleStatus).toBe(
      OntologyDefinitionStatus.Draft
    );
  });

  it('loads an ontology larger than ten pages of a kind', async () => {
    const pages = 35;
    mockListOntologyConcepts.mockImplementation(async (params) => {
      const pageNumber = Number(params?.after ?? 0);

      return {
        data: Array.from({ length: 1000 }, (_, index) =>
          concept(`C${pageNumber * 1000 + index}`)
        ),
        paging:
          pageNumber + 1 < pages
            ? { after: String(pageNumber + 1), total: pages * 1000 }
            : { total: pages * 1000 },
      };
    });

    const { result } = renderHook(() => useOntologyStudioModel(ontology), {
      wrapper,
    });

    await waitFor(() => expect(result.current.model).toBeDefined(), {
      timeout: 10_000,
    });

    expect(result.current.model?.concepts).toHaveLength(pages * 1000);
    expect(mockListOntologyConcepts).toHaveBeenCalledTimes(pages);
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

  it('retains server lifecycle status in the aggregate models', async () => {
    mockListOntologyConcepts.mockImplementation(async (params) => ({
      data: [
        {
          ...concept('Order'),
          ...(params?.fields?.includes('lifecycleStatus') && {
            lifecycleStatus: OntologyDefinitionStatus.Draft,
          }),
        },
      ],
      paging: { total: 1 },
    }));
    const { result } = renderHook(
      () => useAllOntologyStudioModels([ontology], true),
      { wrapper }
    );

    await waitFor(() => expect(result.current.models).toBeDefined());

    expect(result.current.models?.[0].concepts[0].lifecycleStatus).toBe(
      OntologyDefinitionStatus.Draft
    );
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

  describe('without edit rights on the ontology', () => {
    const forbidden = () =>
      new AxiosError('Forbidden', '403', undefined, undefined, {
        status: 403,
      } as AxiosResponse);
    const published: Ontology = {
      ...ontology,
      publicationStatus: { active: { releaseId: 'release-1' } },
    } as Ontology;

    it('reads the active release when the working definitions are refused', async () => {
      mockListOntologyConcepts.mockRejectedValue(forbidden());
      (
        listOntologyReleaseMembers as jest.MockedFunction<
          typeof listOntologyReleaseMembers
        >
      ).mockImplementation(async (_id, kind) => ({
        data:
          kind === 'CONCEPT'
            ? [
                {
                  memberId: 'concept-Order',
                  memberKind: kind,
                  payload: concept('Order'),
                  payloadBytes: 1,
                  payloadDigest: 'x',
                  releaseId: 'release-1',
                },
              ]
            : [],
        paging: { total: 0 },
      }));

      const { result } = renderHook(() => useOntologyStudioModel(published), {
        wrapper,
      });
      await waitFor(() => expect(result.current.model).toBeDefined());

      expect(result.current.model?.concepts.map(({ name }) => name)).toEqual([
        'Order',
      ]);
      expect(result.current.isError).toBe(false);
    });

    it('reads an unpublished ontology as empty instead of failing', async () => {
      mockListOntologyConcepts.mockRejectedValue(forbidden());

      const { result } = renderHook(() => useOntologyStudioModel(ontology), {
        wrapper,
      });
      await waitFor(() => expect(result.current.model).toBeDefined());

      expect(result.current.model?.concepts).toEqual([]);
      expect(result.current.isError).toBe(false);
    });
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

  it.each([
    ['while counting definitions', 1],
    ['while loading its model', 2],
  ])('skips an ontology deleted %s', async (_, failingCall) => {
    const deleted = {
      ...ontology,
      id: 'deleted',
      name: 'Deleted',
      fullyQualifiedName: 'Deleted',
    };
    const calls = { count: 0 };
    mockListOntologyConcepts.mockImplementation(async (params) => {
      if (params?.ontology === deleted.fullyQualifiedName) {
        calls.count += 1;
        if (calls.count === failingCall) {
          throw new AxiosError('Not found', '404', undefined, undefined, {
            status: 404,
          } as AxiosResponse);
        }
      }

      return {
        data: [{ ...concept('Order'), id: params?.ontology + '-order' }],
        paging: { total: 1 },
      };
    });
    const { result } = renderHook(
      () => useAllOntologyStudioModels([deleted, ontology], true),
      { wrapper }
    );
    await waitFor(() => expect(result.current.graph).not.toBeNull());

    expect(result.current.isError).toBe(false);
    expect(result.current.models?.map((model) => model.ontology.id)).toEqual([
      ontology.id,
    ]);
  });

  describe('reading a release', () => {
    it('builds the model from the release members, not the working draft', async () => {
      const released = { ...concept('Order'), description: 'As released' };
      (
        listOntologyReleaseMembers as jest.MockedFunction<
          typeof listOntologyReleaseMembers
        >
      ).mockImplementation(async (_id, kind) => ({
        data:
          kind === 'CONCEPT'
            ? [
                {
                  memberId: released.id,
                  memberKind: kind,
                  payload: released,
                  payloadBytes: 1,
                  payloadDigest: 'x',
                  releaseId: 'release-1',
                },
              ]
            : [],
        paging: { total: 0 },
      }));
      mockListOntologyConcepts.mockResolvedValue({
        data: [{ ...concept('Order'), description: 'Working draft' }],
        paging: { total: 1 },
      });

      const { result } = renderHook(
        () => useOntologyStudioModel(ontology, 'release-1'),
        { wrapper }
      );

      await waitFor(() => expect(result.current.model).toBeDefined());

      expect(result.current.model?.concepts.map((c) => c.description)).toEqual([
        'As released',
      ]);
      expect(mockListOntologyConcepts).not.toHaveBeenCalled();
    });
  });
});
