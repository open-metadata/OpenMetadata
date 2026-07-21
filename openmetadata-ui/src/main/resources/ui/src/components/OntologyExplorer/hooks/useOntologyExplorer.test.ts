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
  getGlossaryTerms,
  getGlossaryTermsAssetCounts,
  getGlossaryTermsByIds,
  getOntologyStudioAssets,
  getOntologyStudioDataGraph,
  getOntologyStudioSummary,
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
const mockGetOntologyStudioAssets =
  getOntologyStudioAssets as jest.MockedFunction<
    typeof getOntologyStudioAssets
  >;
const mockGetOntologyStudioDataGraph =
  getOntologyStudioDataGraph as jest.MockedFunction<
    typeof getOntologyStudioDataGraph
  >;
const mockGetOntologyStudioSummary =
  getOntologyStudioSummary as jest.MockedFunction<
    typeof getOntologyStudioSummary
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

describe('useOntologyExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRdfEnabled.mockResolvedValue(false);
    mockGetOntologyStudioDataGraph.mockResolvedValue({
      clusters: [],
      edges: [],
      paging: { limit: 12, offset: 0, total: 0 },
    });
    mockGetOntologyStudioSummary.mockResolvedValue({
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
      expect(mockGetOntologyStudioDataGraph).toHaveBeenCalledWith({
        assetPreviewSize: 4,
        limit: 12,
        offset: 0,
        parent: undefined,
      })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetOntologyStudioAssets).not.toHaveBeenCalled();
    expect(mockGetGlossaryTermsAssetCounts).not.toHaveBeenCalled();
  });
});
