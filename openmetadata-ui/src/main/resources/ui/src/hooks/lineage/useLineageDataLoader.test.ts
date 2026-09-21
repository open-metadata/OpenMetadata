/*
 *  Copyright 2025 Collate.
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
import { EntityType } from '../../enums/entity.enum';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import { useLineageStore } from '../useLineageStore';
import { useLineageDataLoader } from './useLineageDataLoader';

jest.mock('../../rest/lineageAPI', () => ({
  getDataQualityLineage: jest.fn(),
  getLineageDataByFQN: jest.fn().mockResolvedValue({
    nodes: {
      e: {
        entity: {
          id: 'e',
          type: 'table',
          fullyQualifiedName: 'svc.db.s.t',
          name: 't',
        },
        paging: {},
      },
    },
    downstreamEdges: {},
    upstreamEdges: {},
  }),
  getPlatformLineage: jest.fn(),
}));

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: jest.fn().mockReturnValue({
    isTourOpen: false,
    isTourPage: false,
    tourMockDatasetData: undefined,
  }),
}));

describe('useLineageDataLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLineageStore.getState().reset();
  });

  it('fetches and writes entityLineage on mount', async () => {
    renderHook(() =>
      useLineageDataLoader({
        entityType: EntityType.TABLE,
        entityFqn: 'svc.db.s.t',
        isPlatformLineage: false,
      })
    );

    await waitFor(() => {
      expect(useLineageStore.getState().entityLineage.entity?.id).toBe('e');
    });

    expect(useLineageStore.getState().init).toBe(true);
    expect(useLineageStore.getState().loading).toBe(false);
    expect(useLineageStore.getState().status).toBe('success');
  });

  it('dedupes identical fetches', async () => {
    const spy = getLineageDataByFQN as jest.Mock;
    const { rerender } = renderHook(() =>
      useLineageDataLoader({
        entityType: EntityType.TABLE,
        entityFqn: 'svc.db.s.t',
        isPlatformLineage: false,
      })
    );

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    rerender();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
