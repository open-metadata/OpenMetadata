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
import { LayoutEngine } from '../OntologyExplorer.constants';
import type { OntologyNode } from '../OntologyExplorer.interface';
import { useOntologyGraph } from './useOntologyGraph';

interface FakeNode {
  id: string;
  style: Record<string, unknown>;
}

const mockGraphs: Array<{
  destroy: jest.Mock;
  updateNodeData: jest.Mock;
  nodes: FakeNode[];
}> = [];

jest.mock('@antv/g6', () => {
  const graphEvents = {
    AFTER_DRAW: 'afterdraw',
    AFTER_TRANSFORM: 'aftertransform',
  };

  return {
    Circle: class {},
    CanvasEvent: { CLICK: 'canvas:click' },
    DagreLayout: class {},
    ExtensionCategory: { COMBO: 'combo', EDGE: 'edge', NODE: 'node' },
    Graph: class {
      constructor() {
        const nodes: FakeNode[] = [
          { id: 'a', style: { size: [200, 40], x: 300, y: 100 } },
          { id: 'b', style: { size: [200, 40], x: 700, y: 300 } },
        ];
        const recorded = {
          destroy: jest.fn(),
          updateNodeData: jest.fn(),
          nodes,
        };
        mockGraphs.push(recorded);

        return new Proxy(recorded, {
          get: (target, property) => {
            if (property in target) {
              return target[property as keyof typeof target];
            }
            const fixed: Record<string, unknown> = {
              getNodeData: () => nodes,
              getEdgeData: () => [],
              getComboData: () => [],
              getElementPosition: (id: string) => {
                const style = nodes.find((n) => n.id === id)?.style;

                return [style?.x, style?.y];
              },
              getZoom: () => 1,
              getCanvasCenter: () => [0, 0],
              on: () => undefined,
              off: () => undefined,
            };

            return property in fixed
              ? fixed[property as string]
              : () => Promise.resolve();
          },
        });
      }
    },
    GraphEvent: graphEvents,
    Line: class {},
    NodeEvent: {
      CLICK: 'node:click',
      DBLCLICK: 'node:dblclick',
      DRAG_END: 'node:dragend',
      DRAG_START: 'node:dragstart',
    },
    Polyline: class {},
    Quadratic: class {},
    Rect: class {},
    RectCombo: class {},
    idOf: (value: unknown) => value,
    register: jest.fn(),
  };
});

jest.mock('../utils/textMeasure', () => ({
  getCanvasContext: jest.fn(() => null),
  measureTextWidth: jest.fn(
    (text: string, _font: string, fallbackCharWidth: number) =>
      text.length * fallbackCharWidth
  ),
  truncateToFit: jest.fn((text: string) => text),
}));

const node = (id: string) => ({ id, label: id } as unknown as OntologyNode);
const inputNodes = [node('a'), node('b')];
const graphData = {
  nodes: inputNodes.map(({ id }) => ({ id })),
  edges: [],
  combos: [],
};
const positions = {
  a: { x: 300, y: 100 },
  b: { x: 700, y: 300 },
};
const containerRef = {
  current: Object.assign(document.createElement('div'), {}),
};
Object.defineProperty(containerRef.current, 'offsetWidth', { value: 1200 });
Object.defineProperty(containerRef.current, 'offsetHeight', { value: 800 });

const renderStudioGraph = (
  nodePositions: Record<string, { x: number; y: number }>
) =>
  renderHook(
    (props: { nodePositions: Record<string, { x: number; y: number }> }) =>
      useOntologyGraph({
        ...props,
        assetToTermMap: {},
        computeNodeColor: () => '#000',
        containerRef,
        glossaryColorMap: {},
        graphData: graphData as never,
        inputNodes,
        layoutType: LayoutEngine.Dagre,
        mergedEdgesList: [],
        neighborSet: new Set(),
        explorationMode: 'model',
        onNodeClick: jest.fn(),
        onNodeDoubleClick: jest.fn(),
        onPaneClick: jest.fn(),
        setClickedEdgeId: jest.fn(),
        settings: { layout: 'dagre', showEdgeLabels: true } as never,
        studioMode: true,
      }),
    { initialProps: { nodePositions } }
  );

beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  } as never;
});

beforeEach(() => {
  mockGraphs.length = 0;
});

describe('studio graph node positions', () => {
  it('keeps the canvas, with its pan and zoom, when the placed positions change', async () => {
    const { rerender } = renderStudioGraph(positions);
    await waitFor(() => expect(mockGraphs).toHaveLength(1));

    rerender({ nodePositions: { ...positions, c: { x: 1000, y: 100 } } });

    expect(mockGraphs).toHaveLength(1);
    expect(mockGraphs[0].destroy).not.toHaveBeenCalled();
  });

  it('reports node centers that the canvas accepts back unchanged', async () => {
    const { result } = renderStudioGraph(positions);
    await waitFor(() => expect(mockGraphs).toHaveLength(1));

    expect(result.current.extractNodePositions()).toEqual(positions);
  });

  it('moves nodes in place to the placed centers', async () => {
    const { rerender } = renderStudioGraph(positions);
    await waitFor(() => expect(mockGraphs).toHaveLength(1));
    mockGraphs[0].updateNodeData.mockClear();

    rerender({ nodePositions: { ...positions, a: { x: 350, y: 120 } } });

    await waitFor(() =>
      expect(mockGraphs[0].updateNodeData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'a',
            style: expect.objectContaining({ x: 350, y: 120 }),
          }),
        ])
      )
    );
  });
});
