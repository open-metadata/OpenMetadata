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

import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Paging } from '../../../generated/type/paging';
import {
  getGlossariesList,
  getGlossaryTermAssets,
  getGlossaryTerms,
  getGlossaryTermsAssetCounts,
  getGlossaryTermsByIds,
  getOntologyDataGraph,
  getOntologySummary,
} from '../../../rest/glossaryAPI';
import { getMetrics } from '../../../rest/metricsAPI';
import { listRelationshipTypes } from '../../../rest/ontologyAPI';
import { checkRdfEnabled } from '../../../rest/rdfAPI';
import { useOntologyExplorer } from './useOntologyExplorer';

jest.mock('../../../rest/glossaryAPI');
jest.mock('../../../rest/metricsAPI');
jest.mock('../../../rest/ontologyAPI');
jest.mock('../../../rest/rdfAPI');

const mockGetGlossariesList = getGlossariesList as jest.MockedFunction<
  typeof getGlossariesList
>;
const mockGetGlossaryTermAssets = getGlossaryTermAssets as jest.MockedFunction<
  typeof getGlossaryTermAssets
>;
const mockGetOntologyDataGraph = getOntologyDataGraph as jest.MockedFunction<
  typeof getOntologyDataGraph
>;
const mockGetOntologySummary = getOntologySummary as jest.MockedFunction<
  typeof getOntologySummary
>;
const mockGetGlossaryTerms = getGlossaryTerms as jest.MockedFunction<
  typeof getGlossaryTerms
>;
const mockGetGlossaryTermsAssetCounts =
  getGlossaryTermsAssetCounts as jest.MockedFunction<
    typeof getGlossaryTermsAssetCounts
  >;
const mockGetGlossaryTermsByIds = getGlossaryTermsByIds as jest.MockedFunction<
  typeof getGlossaryTermsByIds
>;
const mockGetMetrics = getMetrics as jest.MockedFunction<typeof getMetrics>;
const mockListRelationshipTypes = listRelationshipTypes as jest.MockedFunction<
  typeof listRelationshipTypes
>;
const mockCheckRdfEnabled = checkRdfEnabled as jest.MockedFunction<
  typeof checkRdfEnabled
>;

const loadedGlossary: Glossary = {
  description: 'Loaded glossary',
  fullyQualifiedName: 'LoadedGlossary',
  id: '00000000-0000-0000-0000-000000000001',
  name: 'LoadedGlossary',
  termCount: 300,
};
const filteredGlossary: Glossary = {
  description: 'Filtered glossary',
  fullyQualifiedName: 'FilteredGlossary',
  id: '00000000-0000-0000-0000-000000000002',
  name: 'FilteredGlossary',
  termCount: 1,
};
const filteredTerm: GlossaryTerm = {
  description: 'Filtered term',
  fullyQualifiedName: 'FilteredGlossary.FilteredTerm',
  glossary: {
    id: filteredGlossary.id,
    name: filteredGlossary.name,
    type: 'glossary',
  },
  id: '00000000-0000-0000-0000-000000000003',
  name: 'FilteredTerm',
};

function createLoadedTerms(): GlossaryTerm[] {
  return Array.from({ length: 300 }, (_, index) => ({
    description: `Loaded term ${index}`,
    fullyQualifiedName: `LoadedGlossary.Term${index}`,
    glossary: {
      id: loadedGlossary.id,
      name: loadedGlossary.name,
      type: 'glossary',
    },
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Term${index}`,
  }));
}

function createDeferredTerms() {
  let resolveTerms: (value: {
    data: GlossaryTerm[];
    paging: Paging;
  }) => void = () => undefined;
  const terms = new Promise<{ data: GlossaryTerm[]; paging: Paging }>(
    (resolve) => {
      resolveTerms = resolve;
    }
  );

  return { resolveTerms, terms };
}

function createDeferredAssets() {
  type AssetsResponse = Awaited<ReturnType<typeof getGlossaryTermAssets>>;
  let resolveAssets: (value: AssetsResponse) => void = () => undefined;
  const assets = new Promise<AssetsResponse>((resolve) => {
    resolveAssets = resolve;
  });

  return { assets, resolveAssets };
}

describe('useOntologyExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRdfEnabled.mockResolvedValue(false);
    mockGetOntologyDataGraph.mockResolvedValue({
      clusters: [],
      edges: [],
      lineageEdges: [],
      paging: { limit: 12, offset: 0, total: 0 },
      seedTermIds: [],
    });
    mockGetOntologySummary.mockResolvedValue({
      connectedPercentage: 0,
      isolatedPreview: [],
      isolatedTerms: 0,
      paging: { limit: 5, offset: 0, total: 0 },
      totalRelations: 0,
      totalTerms: 0,
    });
    mockGetGlossaryTermsAssetCounts.mockResolvedValue({});
    mockGetGlossaryTermsByIds.mockResolvedValue([]);
    mockGetMetrics.mockResolvedValue({ data: [], paging: { total: 0 } });
    mockListRelationshipTypes.mockResolvedValue({ data: [], paging: {} });
    mockGetGlossariesList.mockResolvedValue({
      data: [loadedGlossary, filteredGlossary],
      paging: { total: 2 },
    });
  });

  it('loads a filtered glossary after the latest global request settles', async () => {
    const firstLoad = createDeferredTerms();
    const latestLoad = createDeferredTerms();
    const pendingGlobalLoads = [firstLoad.terms, latestLoad.terms];
    mockGetGlossaryTerms.mockImplementation(({ glossary }) => {
      const response =
        glossary === loadedGlossary.id
          ? pendingGlobalLoads.shift() ??
            Promise.resolve({ data: [], paging: {} })
          : Promise.resolve({ data: [filteredTerm], paging: {} });

      return response;
    });
    const { result } = renderHook(
      () => useOntologyExplorer({ scope: 'global' }),
      { wrapper: StrictMode }
    );

    await waitFor(() =>
      expect(
        mockGetGlossaryTerms.mock.calls.filter(
          ([request]) => request.glossary === loadedGlossary.id
        )
      ).toHaveLength(2)
    );
    act(() => {
      result.current.setFilters((previous) => ({
        ...previous,
        glossaryIds: [filteredGlossary.id],
      }));
    });

    expect(mockGetGlossaryTerms).not.toHaveBeenCalledWith(
      expect.objectContaining({ glossary: filteredGlossary.id })
    );

    await act(async () => {
      firstLoad.resolveTerms({
        data: createLoadedTerms(),
        paging: { total: 300 },
      });
      await firstLoad.terms;
    });

    expect(mockGetGlossaryTerms).not.toHaveBeenCalledWith(
      expect.objectContaining({ glossary: filteredGlossary.id })
    );

    latestLoad.resolveTerms({
      data: createLoadedTerms(),
      paging: { total: 300 },
    });

    await waitFor(() =>
      expect(mockGetGlossaryTerms).toHaveBeenCalledWith(
        expect.objectContaining({ glossary: filteredGlossary.id })
      )
    );
    await waitFor(() =>
      expect(result.current.filteredGraphData?.nodes).toEqual([
        expect.objectContaining({ id: filteredTerm.id }),
      ])
    );
  });

  it('loads global Data mode with one bounded request and no asset fanout', async () => {
    mockGetGlossaryTerms.mockResolvedValue({ data: [], paging: {} });
    const { result } = renderHook(() =>
      useOntologyExplorer({ scope: 'global' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleModeChange('data'));

    await waitFor(() =>
      expect(mockGetOntologyDataGraph).toHaveBeenCalledWith({
        assetPreviewSize: 4,
        connectedTermLimit: 48,
        edgeLimit: 100,
        limit: 12,
        lineageEdgeLimit: 100,
        offset: 0,
        parent: undefined,
      })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetGlossaryTermAssets).not.toHaveBeenCalled();
    expect(mockGetGlossaryTermsAssetCounts).not.toHaveBeenCalled();
  });

  it('advances Data pagination by ranked seeds instead of connected context clusters', async () => {
    const firstSeedIds = Array.from(
      { length: 12 },
      (_, index) => `seed-${index}`
    );
    const contextIds = Array.from(
      { length: 48 },
      (_, index) => `context-${index}`
    );
    const clusters = [...firstSeedIds, ...contextIds].map((id) => ({
      assetCount: 1,
      assets: [],
      term: {
        fullyQualifiedName: `LoadedGlossary.${id}`,
        id,
        name: id,
      },
    }));
    mockGetGlossaryTerms.mockResolvedValue({ data: [], paging: {} });
    mockGetOntologyDataGraph
      .mockResolvedValueOnce({
        clusters,
        edges: [],
        lineageEdges: [],
        paging: { limit: 12, offset: 0, total: 24 },
        seedTermIds: firstSeedIds,
      })
      .mockResolvedValueOnce({
        clusters: clusters.filter((cluster) =>
          contextIds.slice(0, 12).includes(cluster.term.id)
        ),
        edges: [],
        lineageEdges: [],
        paging: { limit: 12, offset: 12, total: 24 },
        seedTermIds: contextIds.slice(0, 12),
      });
    const { result } = renderHook(() =>
      useOntologyExplorer({ scope: 'global' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleModeChange('data'));
    await waitFor(() => expect(result.current.hasMoreDataTerms).toBe(true));

    expect(result.current.loadedTermCount).toBe(12);
    expect(result.current.graphDataToShow?.nodes).toHaveLength(60);

    act(() => result.current.handleLoadMore());

    await waitFor(() =>
      expect(mockGetOntologyDataGraph).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 12 })
      )
    );
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.loadedTermCount).toBe(24);
    expect(result.current.hasMoreDataTerms).toBe(false);
  });

  it('loads one bounded asset page when a data cluster requests more', async () => {
    const termId = '00000000-0000-0000-0000-000000000004';
    mockGetGlossaryTerms.mockResolvedValue({ data: [], paging: {} });
    mockGetOntologyDataGraph.mockResolvedValue({
      clusters: [
        {
          assetCount: 101,
          assets: Array.from({ length: 4 }, (_, index) => ({
            id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
            name: `Asset${index}`,
            type: 'table',
          })),
          term: {
            fullyQualifiedName: 'LoadedGlossary.PagedTerm',
            id: termId,
            name: 'PagedTerm',
          },
        },
      ],
      edges: [],
      lineageEdges: [],
      paging: { limit: 12, offset: 0, total: 1 },
      seedTermIds: [termId],
    });
    mockGetGlossaryTermAssets.mockResolvedValue({
      data: [],
      paging: { limit: 6, offset: 4, total: 101 },
    });
    const { result } = renderHook(() =>
      useOntologyExplorer({ scope: 'global' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleModeChange('data'));
    await waitFor(() =>
      expect(result.current.filteredGraphData?.nodes).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: termId })])
      )
    );
    const termNode = result.current.filteredGraphData?.nodes.find(
      (node) => node.id === termId
    );

    expect(termNode).toBeDefined();

    if (!termNode) {
      throw new Error('Paged term was not loaded into the data graph');
    }
    act(() =>
      result.current.handleGraphNodeClick(termNode, undefined, {
        dataModeLoadMoreBadgeClick: true,
      })
    );

    await waitFor(() =>
      expect(mockGetGlossaryTermAssets).toHaveBeenCalledWith(
        termId,
        6,
        4,
        expect.anything()
      )
    );
  });

  it('keeps the latest asset request cancellable after a stale request settles', async () => {
    const termId = '00000000-0000-0000-0000-000000000005';
    const pendingRequests = [
      createDeferredAssets(),
      createDeferredAssets(),
      createDeferredAssets(),
    ];
    const signals: AbortSignal[] = [];
    mockGetGlossaryTerms.mockResolvedValue({ data: [], paging: {} });
    mockGetOntologyDataGraph.mockResolvedValue({
      clusters: [
        {
          assetCount: 10,
          assets: [],
          term: {
            fullyQualifiedName: 'LoadedGlossary.CancellableTerm',
            id: termId,
            name: 'CancellableTerm',
          },
        },
      ],
      edges: [],
      lineageEdges: [],
      paging: { limit: 12, offset: 0, total: 1 },
      seedTermIds: [termId],
    });
    mockGetGlossaryTermAssets.mockImplementation(
      (_termId, _limit, _offset, signal) => {
        if (!signal) {
          throw new Error('Asset request did not provide an abort signal');
        }
        signals.push(signal);

        return pendingRequests[signals.length - 1].assets;
      }
    );
    const { result } = renderHook(() =>
      useOntologyExplorer({ scope: 'global' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleModeChange('data'));
    await waitFor(() =>
      expect(result.current.filteredGraphData?.nodes).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: termId })])
      )
    );
    const termNode = result.current.filteredGraphData?.nodes.find(
      (node) => node.id === termId
    );
    if (!termNode) {
      throw new Error('Cancellable term was not loaded into the data graph');
    }

    act(() => {
      result.current.handleGraphNodeClick(termNode, undefined, {
        dataModeLoadMoreBadgeClick: true,
      });
      result.current.handleGraphNodeClick(termNode, undefined, {
        dataModeLoadMoreBadgeClick: true,
      });
    });
    await waitFor(() => expect(signals).toHaveLength(2));

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    await act(async () => {
      pendingRequests[0].resolveAssets({
        data: [],
        paging: { limit: 6, offset: 0, total: 10 },
      });
      await pendingRequests[0].assets;
    });
    act(() =>
      result.current.handleGraphNodeClick(termNode, undefined, {
        dataModeLoadMoreBadgeClick: true,
      })
    );
    await waitFor(() => expect(signals).toHaveLength(3));

    expect(signals[1].aborted).toBe(true);

    await act(async () => {
      pendingRequests[1].resolveAssets({
        data: [],
        paging: { limit: 6, offset: 0, total: 10 },
      });
      pendingRequests[2].resolveAssets({
        data: [],
        paging: { limit: 6, offset: 0, total: 10 },
      });
      await Promise.all([pendingRequests[1].assets, pendingRequests[2].assets]);
    });
  });
});
