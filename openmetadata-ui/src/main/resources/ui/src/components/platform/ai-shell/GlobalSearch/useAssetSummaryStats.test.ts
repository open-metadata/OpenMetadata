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
import { EntityType } from '../../../../enums/entity.enum';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getLineagePagingData } from '../../../../rest/lineageAPI';
import { useAssetSummaryStats } from './useAssetSummaryStats';

jest.mock('../../../../rest/lineageAPI', () => ({
  getLineagePagingData: jest.fn(),
}));

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

const tableSource = {
  id: 't1',
  entityType: EntityType.TABLE,
  fullyQualifiedName: 'svc.db.schema.orders',
  columns: [],
} as unknown as SearchSourceAlias;

const lineage = {
  upstreamDepthInfo: [
    { depth: 1, entityCount: 2 },
    { depth: 2, entityCount: 9 },
  ],
  downstreamDepthInfo: [{ depth: 1, entityCount: 4 }],
};

describe('useAssetSummaryStats', () => {
  beforeEach(() => {
    (getLineagePagingData as jest.Mock).mockResolvedValue(lineage);
    // The server's total, not the length of one page of rows.
    (getListTestCaseIncidentStatus as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 137 },
    });
  });

  it('counts lineage at depth one and the incident total from the server', async () => {
    const { result } = renderHook(() => useAssetSummaryStats(tableSource));

    await waitFor(() =>
      expect(result.current).toEqual({
        upstream: 2,
        downstream: 4,
        incidents: 137,
      })
    );

    expect(getLineagePagingData).toHaveBeenCalledWith({
      fqn: 'svc.db.schema.orders',
      type: EntityType.TABLE,
    });
    expect(getListTestCaseIncidentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        originEntityFQN: 'svc.db.schema.orders',
        latest: true,
        limit: 0,
        startTs: expect.any(Number),
        endTs: expect.any(Number),
      })
    );
  });

  it('skips incidents for types without columns', async () => {
    const { result } = renderHook(() =>
      useAssetSummaryStats({
        ...tableSource,
        entityType: EntityType.TOPIC,
        columns: undefined,
      } as unknown as SearchSourceAlias)
    );

    await waitFor(() => expect(result.current.upstream).toBe(2));

    expect(result.current.incidents).toBeUndefined();
    expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
  });

  it('makes no calls for a column or a missing source', () => {
    renderHook(() =>
      useAssetSummaryStats({
        ...tableSource,
        entityType: EntityType.TABLE_COLUMN,
      } as unknown as SearchSourceAlias)
    );
    const { result } = renderHook(() => useAssetSummaryStats(undefined));

    expect(result.current).toEqual({});
    expect(getLineagePagingData).not.toHaveBeenCalled();
    expect(getListTestCaseIncidentStatus).not.toHaveBeenCalled();
  });

  it('leaves counts undefined when the calls fail', async () => {
    (getLineagePagingData as jest.Mock).mockRejectedValue(new Error('boom'));
    (getListTestCaseIncidentStatus as jest.Mock).mockRejectedValue(
      new Error('boom')
    );
    const { result } = renderHook(() => useAssetSummaryStats(tableSource));

    await waitFor(() =>
      expect(Object.keys(result.current)).toEqual([
        'upstream',
        'downstream',
        'incidents',
      ])
    );

    expect(Object.values(result.current)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});
