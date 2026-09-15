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

import { act, renderHook } from '@testing-library/react';
import { Edge } from 'reactflow';
import { useWorkflowEdgeManagement } from './useWorkflowEdgeManagement';

const setEdges = jest.fn();

const createProps = (): Parameters<typeof useWorkflowEdgeManagement>[0] => ({
  edges: [],
  editingEdge: null,
  isViewMode: false,
  nodes: [],
  setEditingEdge: jest.fn(),
  setEdges,
  setFocusedConnection: jest.fn(),
  setIsConnectionModalOpen: jest.fn(),
  setModalPosition: jest.fn(),
  setPendingConnection: jest.fn(),
});

describe('useWorkflowEdgeManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [
      'reject',
      'var(--om-color-fg-error, #D92D20)',
      'var(--om-color-bg-error, #FEF3F2)',
    ],
    [
      'qualityBand',
      'var(--om-color-fg-brand, #1570EF)',
      'var(--om-color-bg-brand, #EFF8FF)',
    ],
  ])(
    'applies theme-aware colors when saving a %s connection',
    (condition, labelColor, backgroundColor) => {
      const { result } = renderHook(() =>
        useWorkflowEdgeManagement(createProps())
      );

      act(() => {
        result.current.handleConnectionSave(
          {
            source: 'source',
            sourceHandle: null,
            target: 'target',
            targetHandle: null,
          },
          [{ value: condition }]
        );
      });

      const updateEdges = setEdges.mock.calls[0][0] as (
        edges: Edge[]
      ) => Edge[];
      const [edge] = updateEdges([]);

      expect(edge.labelStyle).toEqual(
        expect.objectContaining({ color: labelColor })
      );
      expect(edge.labelBgStyle).toEqual(
        expect.objectContaining({
          fill: backgroundColor,
          stroke: 'var(--om-color-bg-primary, #FFFFFF)',
        })
      );
      expect(edge.markerEnd).toEqual(
        expect.objectContaining({
          color: 'var(--om-color-border-primary)',
        })
      );
    }
  );

  it('keeps repaired custom conditions aligned with serialized edge colors', () => {
    const { result } = renderHook(() =>
      useWorkflowEdgeManagement(createProps())
    );

    act(() => {
      result.current.fixInvalidEdgeConditions('source', [
        { name: 'qualityBand' },
      ]);
    });

    const updateEdges = setEdges.mock.calls[0][0] as (edges: Edge[]) => Edge[];
    const [edge] = updateEdges([
      {
        data: { condition: 'outdatedBand' },
        id: 'source-target',
        label: 'outdatedBand',
        source: 'source',
        target: 'target',
      },
    ]);

    expect(edge.labelStyle).toEqual(
      expect.objectContaining({
        color: 'var(--om-color-fg-brand, #1570EF)',
      })
    );
    expect(edge.labelBgStyle).toEqual(
      expect.objectContaining({
        fill: 'var(--om-color-bg-brand, #EFF8FF)',
      })
    );
  });
});
