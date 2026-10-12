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
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  getGlossariesList,
  getGlossaryTerms,
  getGlossaryTermsAssetCounts,
  getGlossaryTermsByIds,
} from '../../../rest/glossaryAPI';
import { getMetrics } from '../../../rest/metricsAPI';
import { checkRdfEnabled } from '../../../rest/rdfAPI';
import { getGlossaryTermRelationSettings } from '../../../rest/settingConfigAPI';
import { useOntologyExplorer } from './useOntologyExplorer';

jest.mock('../../../rest/glossaryAPI');
jest.mock('../../../rest/metricsAPI');
jest.mock('../../../rest/rdfAPI');
jest.mock('../../../rest/settingConfigAPI');

const mockGetGlossariesList = getGlossariesList as jest.MockedFunction<
  typeof getGlossariesList
>;
const mockGetGlossaryTerms = getGlossaryTerms as jest.MockedFunction<
  typeof getGlossaryTerms
>;

const loadedGlossary: Glossary = {
  description: 'Loaded glossary',
  fullyQualifiedName: 'LoadedGlossary',
  id: '00000000-0000-0000-0000-000000000001',
  name: 'LoadedGlossary',
};
const filteredGlossary: Glossary = {
  description: 'Filtered glossary',
  fullyQualifiedName: 'FilteredGlossary',
  id: '00000000-0000-0000-0000-000000000002',
  name: 'FilteredGlossary',
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

describe('useOntologyExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRdfEnabled as jest.Mock).mockResolvedValue(false);
    (getGlossaryTermRelationSettings as jest.Mock).mockResolvedValue({
      relationTypes: [],
    });
    (getGlossaryTermsAssetCounts as jest.Mock).mockResolvedValue({});
    (getGlossaryTermsByIds as jest.Mock).mockResolvedValue([]);
    (getMetrics as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetGlossariesList.mockResolvedValue({
      data: [loadedGlossary, filteredGlossary],
      paging: { total: 2 },
    });
    mockGetGlossaryTerms.mockImplementation(({ glossary }) =>
      Promise.resolve(
        glossary === loadedGlossary.id
          ? { data: createLoadedTerms(), paging: { total: 300 } }
          : { data: [filteredTerm], paging: {} }
      )
    );
  });

  it('keeps the filtered glossary loaded after a global refresh', async () => {
    const { result } = renderHook(() =>
      useOntologyExplorer({ scope: 'global' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setFilters((previous) => ({
        ...previous,
        glossaryIds: [filteredGlossary.id],
      }));
    });
    await waitFor(() =>
      expect(result.current.filteredGraphData?.nodes).toEqual([
        expect.objectContaining({ id: filteredTerm.id }),
      ])
    );

    const callsFor = (glossary: string) =>
      mockGetGlossaryTerms.mock.calls.filter(
        ([request]) => request.glossary === glossary
      ).length;
    const globalCallsBeforeRefresh = callsFor(loadedGlossary.id);

    act(() => result.current.handleRefresh());

    await waitFor(() =>
      expect(callsFor(loadedGlossary.id)).toBe(globalCallsBeforeRefresh + 1)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.filteredGraphData?.nodes).toEqual([
      expect.objectContaining({ id: filteredTerm.id }),
    ]);
  });
});
