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
import { Edge, Node } from 'reactflow';
import { ZOOM_VALUE } from '../constants/Lineage.constants';
import { LineagePlatformView } from '../context/LineageProvider/LineageProvider.interface';
import { LineageLayer, PipelineViewMode } from '../generated/settings/settings';
import { useLineageStore } from './useLineageStore';

describe('useLineageStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useLineageStore());
    act(() => {
      result.current.reset();
    });
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useLineageStore());

    expect(result.current.isEditMode).toBe(false);
    expect(result.current.lineageConfig).toEqual({
      upstreamDepth: 3,
      downstreamDepth: 3,
      nodesPerLayer: 50,
      pipelineViewMode: PipelineViewMode.Node,
    });
    expect(result.current.tracedColumns).toEqual(new Set());
    expect(result.current.tracedNodes).toEqual(new Set());
    expect(result.current.zoomValue).toBe(ZOOM_VALUE);
    expect(result.current.activeLayer).toEqual([]);
    expect(result.current.platformView).toBe(LineagePlatformView.None);
    expect(result.current.isPlatformLineage).toBe(false);
    expect(result.current.columnsInCurrentPages).toEqual(new Map());
    expect(result.current.nodeFilterState).toEqual(new Map());
  });

  it('sets lineage config', () => {
    const { result } = renderHook(() => useLineageStore());

    const newConfig = {
      upstreamDepth: 5,
      downstreamDepth: 5,
      nodesPerLayer: 100,
      pipelineViewMode: PipelineViewMode.Edge,
    };

    act(() => {
      result.current.setLineageConfig(newConfig);
    });

    expect(result.current.lineageConfig).toEqual(newConfig);
  });

  it('toggles edit mode', () => {
    const { result } = renderHook(() => useLineageStore());

    expect(result.current.isEditMode).toBe(false);

    act(() => {
      result.current.toggleEditMode();
    });

    expect(result.current.isEditMode).toBe(true);
    expect(result.current.activeLayer).toContain(
      LineageLayer.ColumnLevelLineage
    );

    act(() => {
      result.current.toggleEditMode();
    });

    expect(result.current.isEditMode).toBe(false);
    expect(result.current.activeLayer).toContain(
      LineageLayer.ColumnLevelLineage
    );
  });

  it('sets isEditMode directly', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setIsEditMode(true);
    });

    expect(result.current.isEditMode).toBe(true);

    act(() => {
      result.current.setIsEditMode(false);
    });

    expect(result.current.isEditMode).toBe(false);
  });

  it('sets traced columns', () => {
    const { result } = renderHook(() => useLineageStore());

    const columns = new Set(['col1', 'col2', 'col3']);

    act(() => {
      result.current.setTracedColumns(columns);
    });

    expect(result.current.tracedColumns).toEqual(columns);
  });

  it('adds traced column', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.addTracedColumns('col1');
    });

    expect(result.current.tracedColumns.has('col1')).toBe(true);

    act(() => {
      result.current.addTracedColumns('col2');
    });

    expect(result.current.tracedColumns.has('col1')).toBe(true);
    expect(result.current.tracedColumns.has('col2')).toBe(true);
  });

  it('sets traced nodes', () => {
    const { result } = renderHook(() => useLineageStore());

    const nodes = new Set(['node1', 'node2']);

    act(() => {
      result.current.setTracedNodes(nodes);
    });

    expect(result.current.tracedNodes).toEqual(nodes);
  });

  it('adds traced node', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.addTracedNodes('node1');
    });

    expect(result.current.tracedNodes.has('node1')).toBe(true);

    act(() => {
      result.current.addTracedNodes('node2');
    });

    expect(result.current.tracedNodes.has('node1')).toBe(true);
    expect(result.current.tracedNodes.has('node2')).toBe(true);
  });

  it('sets zoom value', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setZoomValue(2);
    });

    expect(result.current.zoomValue).toBe(2);
  });

  it('sets columns having lineage', () => {
    const { result } = renderHook(() => useLineageStore());

    const columnsMap = new Map([
      ['node1', new Set(['col1', 'col2'])],
      ['node2', new Set(['col3'])],
    ]);

    act(() => {
      result.current.setColumnsHavingLineage(columnsMap);
    });

    expect(result.current.columnsHavingLineage).toEqual(columnsMap);
  });

  it('updates columns having lineage by id', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.updateColumnsHavingLineageById(
        'node1',
        new Set(['col1', 'col2'])
      );
    });

    expect(result.current.columnsHavingLineage.get('node1')).toEqual(
      new Set(['col1', 'col2'])
    );

    act(() => {
      result.current.updateColumnsHavingLineageById('node1', new Set(['col3']));
    });

    expect(result.current.columnsHavingLineage.get('node1')).toEqual(
      new Set(['col3'])
    );
  });

  it('sets active layer', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setActiveLayer([LineageLayer.ColumnLevelLineage]);
    });

    expect(result.current.activeLayer).toEqual([
      LineageLayer.ColumnLevelLineage,
    ]);
    expect(result.current.isColumnLevelLineage).toBe(true);
  });

  it('clears traced columns when column lineage layer is removed', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setTracedColumns(new Set(['col1', 'col2']));
      result.current.setActiveLayer([LineageLayer.ColumnLevelLineage]);
    });

    expect(result.current.tracedColumns.size).toBe(2);

    act(() => {
      result.current.setActiveLayer([]);
    });

    expect(result.current.tracedColumns.size).toBe(0);
  });

  it('sets platform view to None when column lineage is enabled', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setPlatformView(LineagePlatformView.Service);
      result.current.setActiveLayer([LineageLayer.ColumnLevelLineage]);
    });

    expect(result.current.platformView).toBe(LineagePlatformView.None);
  });

  it('updates active layer', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.updateActiveLayer(LineageLayer.ColumnLevelLineage);
    });

    expect(result.current.activeLayer).toContain(
      LineageLayer.ColumnLevelLineage
    );

    act(() => {
      result.current.updateActiveLayer(LineageLayer.DataObservability);
    });

    expect(result.current.activeLayer).toContain(
      LineageLayer.ColumnLevelLineage
    );
    expect(result.current.activeLayer).toContain(
      LineageLayer.DataObservability
    );
    expect(result.current.isDQEnabled).toBe(true);
  });

  it('updates active layer with array', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.updateActiveLayer([
        LineageLayer.ColumnLevelLineage,
        LineageLayer.DataObservability,
      ]);
    });

    expect(result.current.activeLayer).toContain(
      LineageLayer.ColumnLevelLineage
    );
    expect(result.current.activeLayer).toContain(
      LineageLayer.DataObservability
    );
  });

  it('sets platform view', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setPlatformView(LineagePlatformView.Service);
    });

    expect(result.current.platformView).toBe(LineagePlatformView.Service);
  });

  it('sets isPlatformLineage', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setIsPlatformLineage(true);
    });

    expect(result.current.isPlatformLineage).toBe(true);
  });

  it('sets active node', () => {
    const { result } = renderHook(() => useLineageStore());

    const node: Node = {
      id: 'node1',
      position: { x: 0, y: 0 },
      data: {},
    };

    act(() => {
      result.current.setActiveNode(node);
    });

    expect(result.current.activeNode).toEqual(node);
  });

  it('sets selected node', () => {
    const { result } = renderHook(() => useLineageStore());

    const selectedNode = {
      id: 'node1',
      name: 'Test Node',
    };

    act(() => {
      result.current.setSelectedNode(selectedNode as any);
    });

    expect(result.current.selectedNode).toEqual(selectedNode);
  });

  it('sets selected edge', () => {
    const { result } = renderHook(() => useLineageStore());

    const edge: Edge = {
      id: 'edge1',
      source: 'node1',
      target: 'node2',
    };

    act(() => {
      result.current.setSelectedEdge(edge);
    });

    expect(result.current.selectedEdge).toEqual(edge);
  });

  it('sets selected column', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setSelectedColumn('col1');
    });

    expect(result.current.selectedColumn).toBe('col1');
  });

  it('sets isCreatingEdge', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setIsCreatingEdge(true);
    });

    expect(result.current.isCreatingEdge).toBe(true);
  });

  it('sets columns in current pages', () => {
    const { result } = renderHook(() => useLineageStore());

    const columnsMap = new Map([
      ['node1', ['col1', 'col2']],
      ['node2', ['col3']],
    ]);

    act(() => {
      result.current.setColumnsInCurrentPages(columnsMap);
    });

    expect(result.current.columnsInCurrentPages).toEqual(columnsMap);
  });

  it('updates columns in current pages', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.updateColumnsInCurrentPages('node1', ['col1', 'col2']);
    });

    expect(result.current.columnsInCurrentPages.get('node1')).toEqual([
      'col1',
      'col2',
    ]);

    act(() => {
      result.current.updateColumnsInCurrentPages('node1', ['col3']);
    });

    expect(result.current.columnsInCurrentPages.get('node1')).toEqual(['col3']);
  });

  it('resets to default state', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setIsEditMode(true);
      result.current.setZoomValue(2);
      result.current.setTracedColumns(new Set(['col1']));
      result.current.setActiveLayer([LineageLayer.ColumnLevelLineage]);
      result.current.reset();
    });

    expect(result.current.isEditMode).toBe(false);
    expect(result.current.zoomValue).toBe(ZOOM_VALUE);
    expect(result.current.tracedColumns.size).toBe(0);
    expect(result.current.activeLayer).toEqual([]);
  });

  it('clears selected items when toggling edit mode off', () => {
    const { result } = renderHook(() => useLineageStore());

    const node: Node = { id: 'node1', position: { x: 0, y: 0 }, data: {} };
    const edge: Edge = { id: 'edge1', source: 'node1', target: 'node2' };

    act(() => {
      result.current.setActiveNode(node);
      result.current.setSelectedEdge(edge);
      result.current.toggleEditMode();
    });

    expect(result.current.isEditMode).toBe(true);

    act(() => {
      result.current.toggleEditMode();
    });

    expect(result.current.activeNode).toBeUndefined();
    expect(result.current.selectedEdge).toBeUndefined();
  });

  it('sets isDQEnabled when DataObservability layer is active', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setActiveLayer([LineageLayer.DataObservability]);
    });

    expect(result.current.isDQEnabled).toBe(true);
  });

  it('maintains unique layers when updating', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.updateActiveLayer(LineageLayer.ColumnLevelLineage);
      result.current.updateActiveLayer(LineageLayer.ColumnLevelLineage);
    });

    const columnLineageLayers = result.current.activeLayer.filter(
      (layer) => layer === LineageLayer.ColumnLevelLineage
    );

    expect(columnLineageLayers.length).toBe(1);
  });

  it('clears traced columns and nodes when toggling edit mode off', () => {
    const { result } = renderHook(() => useLineageStore());

    act(() => {
      result.current.setTracedColumns(new Set(['col1', 'col2']));
      result.current.setTracedNodes(new Set(['node1', 'node2']));
      result.current.toggleEditMode();
    });

    expect(result.current.isEditMode).toBe(true);

    act(() => {
      result.current.toggleEditMode();
    });

    expect(result.current.tracedColumns.size).toBe(0);
    expect(result.current.tracedNodes.size).toBe(0);
  });

  describe('Node Filter State', () => {
    it('sets node filter state', () => {
      const { result } = renderHook(() => useLineageStore());

      act(() => {
        result.current.setNodeFilterState('node1', true);
      });

      expect(result.current.nodeFilterState.get('node1')).toBe(true);

      act(() => {
        result.current.setNodeFilterState('node1', false);
      });

      expect(result.current.nodeFilterState.get('node1')).toBe(false);
    });

    it('sets filter state for multiple nodes', () => {
      const { result } = renderHook(() => useLineageStore());

      act(() => {
        result.current.setNodeFilterState('node1', true);
        result.current.setNodeFilterState('node2', false);
        result.current.setNodeFilterState('node3', true);
      });

      expect(result.current.nodeFilterState.get('node1')).toBe(true);
      expect(result.current.nodeFilterState.get('node2')).toBe(false);
      expect(result.current.nodeFilterState.get('node3')).toBe(true);
    });

    it('updates existing node filter state', () => {
      const { result } = renderHook(() => useLineageStore());

      act(() => {
        result.current.setNodeFilterState('node1', true);
      });

      expect(result.current.nodeFilterState.get('node1')).toBe(true);

      act(() => {
        result.current.setNodeFilterState('node1', false);
      });

      expect(result.current.nodeFilterState.get('node1')).toBe(false);
    });

    it('returns undefined for nodes without filter state', () => {
      const { result } = renderHook(() => useLineageStore());

      expect(result.current.nodeFilterState.get('nonexistent')).toBeUndefined();
    });

    it('resets node filter state on reset', () => {
      const { result } = renderHook(() => useLineageStore());

      act(() => {
        result.current.setNodeFilterState('node1', true);
        result.current.setNodeFilterState('node2', false);
      });

      expect(result.current.nodeFilterState.size).toBe(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.nodeFilterState.size).toBe(0);
    });

    it('handles setting filter state for same node multiple times', () => {
      const { result } = renderHook(() => useLineageStore());

      act(() => {
        result.current.setNodeFilterState('node1', true);
        result.current.setNodeFilterState('node1', false);
        result.current.setNodeFilterState('node1', true);
      });

      expect(result.current.nodeFilterState.size).toBe(1);
      expect(result.current.nodeFilterState.get('node1')).toBe(true);
    });
  });
});
