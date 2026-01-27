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

import { act, renderHook } from '@testing-library/react';
import { EntityType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { EImpactLevel } from './LineageTable.interface';
import { useLineageTableState } from './useLineageTableState';

describe('useLineageTableState Hook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useLineageTableState());

    expect(result.current.filterNodes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.filterSelectionActive).toBe(false);
    expect(result.current.searchValue).toBe('');
    expect(result.current.dialogVisible).toBe(false);
    expect(result.current.impactLevel).toBe(EImpactLevel.TableLevel);
    expect(result.current.upstreamColumnLineageNodes).toEqual([]);
    expect(result.current.downstreamColumnLineageNodes).toEqual([]);
    expect(result.current.lineageDirection).toBe(LineageDirection.Downstream);
    expect(result.current.lineagePagingInfo).toBeNull();
    expect(result.current.nodeDepth).toBe(1);
  });

  it('should update filter nodes', () => {
    const { result } = renderHook(() => useLineageTableState());

    const mockNodes = [
      {
        id: 'node1',
        fullyQualifiedName: 'test.table1',
        name: 'table1',
        entityType: EntityType.TABLE,
        nodeDepth: 1,
      },
    ];

    act(() => {
      result.current.setFilterNodes(mockNodes as any);
    });

    expect(result.current.filterNodes).toEqual(mockNodes);
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should toggle filter selection', () => {
    const { result } = renderHook(() => useLineageTableState());

    expect(result.current.filterSelectionActive).toBe(false);

    act(() => {
      result.current.toggleFilterSelection();
    });

    expect(result.current.filterSelectionActive).toBe(true);

    act(() => {
      result.current.toggleFilterSelection();
    });

    expect(result.current.filterSelectionActive).toBe(false);
  });

  it('should update search value', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setSearchValue('test search');
    });

    expect(result.current.searchValue).toBe('test search');
  });

  it('should update dialog visibility', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setDialogVisible(true);
    });

    expect(result.current.dialogVisible).toBe(true);

    act(() => {
      result.current.setDialogVisible(false);
    });

    expect(result.current.dialogVisible).toBe(false);
  });

  it('should update impact level', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setImpactLevel(EImpactLevel.ColumnLevel);
    });

    expect(result.current.impactLevel).toBe(EImpactLevel.ColumnLevel);
  });

  it('should update column lineage nodes separately', () => {
    const { result } = renderHook(() => useLineageTableState());

    const upstreamNodes = [{ id: 'upstream1' }];
    const downstreamNodes = [{ id: 'downstream1' }];

    act(() => {
      result.current.setUpstreamColumnLineageNodes(upstreamNodes as any);
    });

    expect(result.current.upstreamColumnLineageNodes).toEqual(upstreamNodes);

    act(() => {
      result.current.setDownstreamColumnLineageNodes(downstreamNodes as any);
    });

    expect(result.current.downstreamColumnLineageNodes).toEqual(
      downstreamNodes
    );
  });

  it('should update column lineage nodes together', () => {
    const { result } = renderHook(() => useLineageTableState());

    const upstreamNodes = [{ id: 'upstream1' }];
    const downstreamNodes = [{ id: 'downstream1' }];

    act(() => {
      result.current.setColumnLineageNodes(
        upstreamNodes as any,
        downstreamNodes as any
      );
    });

    expect(result.current.upstreamColumnLineageNodes).toEqual(upstreamNodes);
    expect(result.current.downstreamColumnLineageNodes).toEqual(
      downstreamNodes
    );
  });

  it('should update lineage direction', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setLineageDirection(LineageDirection.Upstream);
    });

    expect(result.current.lineageDirection).toBe(LineageDirection.Upstream);
  });

  it('should update lineage paging info', () => {
    const { result } = renderHook(() => useLineageTableState());

    const mockPagingInfo = {
      downstreamDepthInfo: [{ depth: 1, entityCount: 5 }],
      upstreamDepthInfo: [{ depth: 1, entityCount: 2 }],
      maxDownstreamDepth: 1,
      maxUpstreamDepth: 1,
      totalDownstreamEntities: 5,
      totalUpstreamEntities: 2,
    };

    act(() => {
      result.current.setLineagePagingInfo(mockPagingInfo);
    });

    expect(result.current.lineagePagingInfo).toEqual(mockPagingInfo);
  });

  it('should update node depth', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setNodeDepth(3);
    });

    expect(result.current.nodeDepth).toBe(3);
  });

  it('should reset filters', () => {
    const { result } = renderHook(() => useLineageTableState());

    // Set some values first
    act(() => {
      result.current.setSearchValue('test');
      result.current.setFilterNodes([{ id: 'test' }] as any);
      result.current.setFilterSelectionActive(true);
    });

    // Verify values are set
    expect(result.current.searchValue).toBe('test');
    expect(result.current.filterNodes).toHaveLength(1);
    expect(result.current.filterSelectionActive).toBe(true);

    // Reset filters
    act(() => {
      result.current.resetFilters();
    });

    // Verify values are reset
    expect(result.current.searchValue).toBe('');
    expect(result.current.filterNodes).toEqual([]);
    expect(result.current.filterSelectionActive).toBe(false);
  });

  it('should handle multiple state updates correctly', () => {
    const { result } = renderHook(() => useLineageTableState());

    act(() => {
      result.current.setLoading(true);
      result.current.setSearchValue('multi test');
      result.current.setImpactLevel(EImpactLevel.ColumnLevel);
      result.current.setDialogVisible(true);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.searchValue).toBe('multi test');
    expect(result.current.impactLevel).toBe(EImpactLevel.ColumnLevel);
    expect(result.current.dialogVisible).toBe(true);
  });
});

describe('EImpactLevel Enum', () => {
  it('should have correct values', () => {
    expect(EImpactLevel.TableLevel).toBe('table');
    expect(EImpactLevel.ColumnLevel).toBe('column');
  });

  it('should be used in type checking', () => {
    const tableLevel: EImpactLevel = EImpactLevel.TableLevel;
    const columnLevel: EImpactLevel = EImpactLevel.ColumnLevel;

    expect(typeof tableLevel).toBe('string');
    expect(typeof columnLevel).toBe('string');
    expect(tableLevel).not.toBe(columnLevel);
  });
});
