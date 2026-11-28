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
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ColumnGridResponse } from '../../../../generated/api/data/columnGridResponse';
import { getColumnGrid } from '../../../../rest/columnAPI';
import { useColumnGridListingData } from './useColumnGridListingData';

jest.mock('../../../../rest/columnAPI', () => ({
  getColumnGrid: jest.fn(),
}));

const mockGetColumnGrid = getColumnGrid as jest.MockedFunction<
  typeof getColumnGrid
>;

const EMPTY_RESPONSE: ColumnGridResponse = {
  columns: [],
  totalUniqueColumns: 0,
  totalOccurrences: 0,
};

const createWrapper = (initialUrl: string) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
};

const mockProps = {
  transformGridItemsToRows: jest.fn(() => []),
  columns: [],
  renderers: {},
};

describe('useColumnGridListingData — parsedFilters single-select sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetColumnGrid.mockResolvedValue(EMPTY_RESPONSE);
  });

  it.each([
    [
      'metadataStatus',
      'metadataStatus',
      '?metadataStatus=MISSING,INCOMPLETE',
      'MISSING',
    ],
    [
      'service',
      'service.displayName.keyword',
      '?service.displayName.keyword=postgres,mysql',
      'postgres',
    ],
    [
      'domains',
      'domains.displayName.keyword',
      '?domains.displayName.keyword=dom1,dom2',
      'dom1',
    ],
  ])(
    'sanitizes the %s single-select filter to only the first URL value',
    async (_label, key, url, expectedFirst) => {
      const { result } = renderHook(() => useColumnGridListingData(mockProps), {
        wrapper: createWrapper(url),
      });

      await waitFor(() => {
        expect(result.current.parsedFilters).toBeDefined();
      });

      const filter = result.current.parsedFilters.find((f) => f.key === key);

      expect(filter?.value).toHaveLength(1);
      expect(filter?.value?.[0]?.key).toBe(expectedFirst);
    }
  );

  it('does NOT sanitize multi-select filters (entityType keeps all URL values)', async () => {
    const { result } = renderHook(() => useColumnGridListingData(mockProps), {
      wrapper: createWrapper('?entityType=table,topic'),
    });

    await waitFor(() => {
      expect(result.current.parsedFilters).toBeDefined();
    });

    const filter = result.current.parsedFilters.find(
      (f) => f.key === 'entityType'
    );

    expect(filter?.value).toHaveLength(2);
    expect(filter?.value?.[0]?.key).toBe('table');
    expect(filter?.value?.[1]?.key).toBe('topic');
  });

  it('does NOT sanitize multi-select filters (serviceType keeps all URL values)', async () => {
    const { result } = renderHook(() => useColumnGridListingData(mockProps), {
      wrapper: createWrapper('?serviceType=databaseService,messagingService'),
    });

    await waitFor(() => {
      expect(result.current.parsedFilters).toBeDefined();
    });

    const filter = result.current.parsedFilters.find(
      (f) => f.key === 'serviceType'
    );

    expect(filter?.value).toHaveLength(2);
  });
});
