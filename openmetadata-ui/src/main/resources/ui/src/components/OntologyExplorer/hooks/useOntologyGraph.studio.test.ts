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
import { placeNewClass } from '../../governance/ontology/OntologyNewClassPanel/OntologyNewClassPanel.utils';
import { LayoutEngine } from '../OntologyExplorer.constants';
import type { OntologyNode } from '../OntologyExplorer.interface';
import { MODEL_NODE_MAX_WIDTH, NODE_HEIGHT } from '../utils/graphConfig';
import { useOntologyGraph } from './useOntologyGraph';

interface FakeNode {
  id: string;
  style?: Record<string, unknown>;
}

interface FakeEdge {
  id: string;
  source: string;
  target: string;
}

interface FakeGraph {
  destroy: jest.Mock;
  updateNodeData: jest.Mock;
  zoomTo: jest.Mock;
  translateTo: jest.Mock;
  nodes: Required<FakeNode>[];
  edges: FakeEdge[];
}

const mockGraphs: FakeGraph[] = [];

jest.mock('@antv/g6', () => {
  const graphEvents = {
    AFTER_DRAW: 'afterdraw',
    AFTER_TRANSFORM: 'aftertransform',
  };
  const sized = (node: FakeNode): Required<FakeNode> => ({
    id: node.id,
    style: { size: [200, 40], ...node.style },
  });

  return {
    Circle: class {},
    CanvasEvent: { CLICK: 'canvas:click' },
    DagreLayout: class {},
    ExtensionCategory: { COMBO: 'combo', EDGE: 'edge', NODE: 'node' },
    Graph: class {
      constructor(options: {
        data?: { nodes?: FakeNode[]; edges?: FakeEdge[] };
      }) {
        const nodes = (options.data?.nodes ?? []).map(sized);
        const edges = [...(options.data?.edges ?? [])];
        const recorded: FakeGraph = {
          destroy: jest.fn(),
          updateNodeData: jest.fn((updates: FakeNode[]) =>
            updates.forEach((update) => {
              const target = nodes.find((n) => n.id === update.id);
              if (target) {
                target.style = { ...target.style, ...update.style };
              }
            })
          ),
          zoomTo: jest.fn(() => Promise.resolve()),
          translateTo: jest.fn(() => Promise.resolve()),
          nodes,
          edges,
        };
        mockGraphs.push(recorded);

        return new Proxy(recorded, {
          get: (target, property) => {
            if (property in target) {
              return target[property as keyof typeof target];
            }
            const fixed: Record<string, unknown> = {
              destroyed: false,
              addNodeData: (added: FakeNode[]) =>
                nodes.push(...added.map(sized)),
              addEdgeData: (added: FakeEdge[]) => edges.push(...added),
              getNodeData: () => nodes,
              getEdgeData: () => edges,
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

type Positions = Record<string, { x: number; y: number }>;

interface StudioProps {
  nodePositions?: Positions;
  inputNodes: OntologyNode[];
  graphData: { nodes: FakeNode[]; edges: FakeEdge[]; combos: never[] };
  mergedEdgesList: Array<{ from: string; to: string; relationType: string }>;
}

const node = (id: string) => ({ id, label: id } as unknown as OntologyNode);
const inputNodes = [node('a'), node('b')];
const positions = {
  a: { x: 300, y: 100 },
  b: { x: 700, y: 300 },
};
const initialProps: StudioProps = {
  nodePositions: positions,
  inputNodes,
  graphData: {
    nodes: inputNodes.map(({ id }) => ({ id })),
    edges: [],
    combos: [],
  },
  mergedEdgesList: [],
};
const withCreatedClass = (
  props: StudioProps,
  id: string,
  nodePositions: Positions | undefined
): StudioProps => ({
  nodePositions,
  inputNodes: [...props.inputNodes, node(id)],
  graphData: {
    ...props.graphData,
    nodes: [...props.graphData.nodes, { id }],
    edges: [
      ...props.graphData.edges,
      { id: id + '>a', source: id, target: 'a' },
    ],
  },
  mergedEdgesList: [
    ...props.mergedEdgesList,
    { from: id, to: 'a', relationType: 'is a' },
  ],
});
const containerRef = {
  current: Object.assign(document.createElement('div'), {}),
};
Object.defineProperty(containerRef.current, 'offsetWidth', { value: 1200 });
Object.defineProperty(containerRef.current, 'offsetHeight', { value: 800 });

const renderStudioGraph = (props: StudioProps = initialProps) =>
  renderHook(
    (current: StudioProps) =>
      useOntologyGraph({
        ...current,
        assetToTermMap: {},
        computeNodeColor: () => '#000',
        containerRef,
        glossaryColorMap: {},
        graphData: current.graphData as never,
        layoutType: LayoutEngine.Dagre,
        neighborSet: new Set(),
        explorationMode: 'model',
        onNodeClick: jest.fn(),
        onNodeDoubleClick: jest.fn(),
        onPaneClick: jest.fn(),
        setClickedEdgeId: jest.fn(),
        settings: { layout: 'dagre', showEdgeLabels: true } as never,
        studioMode: true,
      }),
    { initialProps: props }
  );

const renderSettledCanvas = async () => {
  const rendered = renderStudioGraph();
  await waitFor(() => expect(mockGraphs[0].translateTo).toHaveBeenCalled());
  mockGraphs[0].zoomTo.mockClear();
  mockGraphs[0].translateTo.mockClear();

  return rendered;
};

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
  it('adds a created class to the live canvas without rebuilding it or moving the viewport', async () => {
    const { rerender, result } = await renderSettledCanvas();
    const created = withCreatedClass(initialProps, 'c', {
      ...positions,
      c: { x: 1000, y: 100 },
    });

    rerender(created);

    await waitFor(() =>
      expect(result.current.extractNodePositions()).toEqual(
        created.nodePositions
      )
    );

    expect(mockGraphs).toHaveLength(1);
    expect(mockGraphs[0].destroy).not.toHaveBeenCalled();
    expect(mockGraphs[0].zoomTo).not.toHaveBeenCalled();
    expect(mockGraphs[0].translateTo).not.toHaveBeenCalled();
    expect(mockGraphs[0].edges).toEqual([
      { id: 'c>a', source: 'c', target: 'a' },
    ]);
  });

  it('keeps one canvas through five creations and places each class clear of the others', async () => {
    const { rerender, result } = await renderSettledCanvas();
    let props = initialProps;
    for (let index = 0; index < 5; index++) {
      const id = 'new' + index;
      const placed = placeNewClass(
        result.current.extractNodePositions(),
        props.inputNodes,
        id
      );
      if (!placed) {
        throw new Error('placement needs every center on the canvas');
      }
      props = withCreatedClass(props, id, placed);
      rerender(props);
      await waitFor(() =>
        expect(result.current.extractNodePositions()).toEqual(placed)
      );
    }
    const centers = Object.values(result.current.extractNodePositions());
    const overlapping = centers.flatMap((center, index) =>
      centers
        .slice(index + 1)
        .filter(
          (other) =>
            Math.abs(center.x - other.x) <= MODEL_NODE_MAX_WIDTH &&
            Math.abs(center.y - other.y) <= NODE_HEIGHT
        )
        .map((other) => [center, other])
    );

    expect(centers).toHaveLength(7);
    expect(overlapping).toEqual([]);
    expect(mockGraphs).toHaveLength(1);
    expect(mockGraphs[0].destroy).not.toHaveBeenCalled();
    expect(mockGraphs[0].zoomTo).not.toHaveBeenCalled();
    expect(mockGraphs[0].translateTo).not.toHaveBeenCalled();
  });

  it('reports node centers that the canvas accepts back unchanged', async () => {
    const { result } = renderStudioGraph();
    await waitFor(() => expect(mockGraphs).toHaveLength(1));

    expect(result.current.extractNodePositions()).toEqual(positions);
  });

  it('moves nodes in place to the placed centers', async () => {
    const { rerender } = renderStudioGraph();
    await waitFor(() => expect(mockGraphs).toHaveLength(1));
    mockGraphs[0].updateNodeData.mockClear();

    rerender({
      ...initialProps,
      nodePositions: { ...positions, a: { x: 350, y: 120 } },
    });

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
