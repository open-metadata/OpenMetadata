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

import type { EdgeData, GraphOptions, NodeData } from '@antv/g6';
import { Graph } from '@antv/g6';
import { act, render, waitFor } from '@testing-library/react';
import { ReactNode, useRef } from 'react';
import { ThemeProvider } from '../../../context/UntitledUIThemeProvider/theme-provider';
import {
  CustomNodeProps,
  GraphData,
} from '../../../interface/discovery/knowledge-graph.interface';
import {
  useKnowledgeGraphCanvas,
  type GraphSelection,
} from './useKnowledgeGraphCanvas';

type Callback = () => void;

class MockResizeObserver {
  static callbacks: Callback[] = [];
  private cb: Callback;
  constructor(cb: Callback) {
    this.cb = cb;
    MockResizeObserver.callbacks.push(cb);
  }
  observe = jest.fn();
  disconnect = jest.fn(() => {
    MockResizeObserver.callbacks = MockResizeObserver.callbacks.filter(
      (item) => item !== this.cb
    );
  });
  unobserve = jest.fn();
}

(
  globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }
).ResizeObserver = MockResizeObserver;

const mergeItems = <T extends { id?: string }>(
  items: T[],
  updates: Partial<T>[]
) => {
  const byId = new Map(updates.map((item) => [item.id, item]));

  return items.map((item) => ({ ...item, ...byId.get(item.id) }));
};

interface MockGraph {
  destroyed: boolean;
  setTransforms: jest.Mock;
  getNodeData: (id?: string) => NodeData | NodeData[];
  getEdgeData: (id?: string) => EdgeData[] | EdgeData | undefined;
  setData: (next: { nodes: NodeData[]; edges: EdgeData[] }) => void;
  updateNodeData: (nodes: NodeData[]) => void;
  updateEdgeData: (edges: EdgeData[]) => void;
  draw: jest.Mock;
  render: jest.Mock;
  fitView: jest.Mock;
  focusElement: jest.Mock;
  translateBy: jest.Mock;
  zoomTo: jest.Mock;
  getZoom: () => number;
  getViewportByCanvas: (point: [number, number]) => [number, number];
  getSize: () => [number, number];
  on: jest.Mock;
  emit: jest.Mock;
  resize: jest.Mock;
  destroy: () => void;
}

const graphInstances: MockGraph[] = [];
let renderMode: 'ok' | 'throw' = 'ok';

jest.mock('@antv/g6', () => ({
  ExtensionCategory: { NODE: 'node' },
  register: jest.fn(),
  Graph: jest.fn().mockImplementation((options: GraphOptions) => {
    let data: { nodes: NodeData[]; edges: EdgeData[] } = {
      nodes: [],
      edges: [],
    };
    let zoom = 1;
    const canvas = document.createElement('canvas');
    (options.container as HTMLElement).appendChild(canvas);

    const graph: MockGraph = {
      destroyed: false,
      setTransforms: jest.fn(),
      getNodeData: (id?: string) =>
        id
          ? (data.nodes.find((node) => node.id === id) as NodeData)
          : data.nodes,
      getEdgeData: (id?: string) =>
        id ? data.edges.find((edge) => edge.id === id) : data.edges,
      setData: (next) => {
        data = next;
      },
      updateNodeData: (nodes) => {
        data.nodes = mergeItems(data.nodes, nodes);
      },
      updateEdgeData: (edges) => {
        data.edges = mergeItems(data.edges, edges);
      },
      draw: jest.fn().mockResolvedValue(undefined),
      render: jest.fn().mockImplementation(async () => {
        if (renderMode === 'throw') {
          throw new Error('render failed');
        }
      }),
      fitView: jest.fn().mockResolvedValue(undefined),
      focusElement: jest.fn().mockResolvedValue(undefined),
      translateBy: jest.fn().mockResolvedValue(undefined),
      zoomTo: jest.fn(async (value: number) => {
        zoom = value;
      }),
      getZoom: () => zoom,
      getViewportByCanvas: (point) => point,
      getSize: () => [800, 600],
      on: jest.fn(),
      emit: jest.fn(),
      resize: jest.fn(),
      destroy() {
        this.destroyed = true;
        canvas.remove();
      },
    };
    graphInstances.push(graph);

    return graph;
  }),
}));
jest.mock('@antv/g6-extension-react', () => ({ ReactNode: jest.fn() }));

const StubNode = (_props: CustomNodeProps) => <div data-testid="stub-node" />;

const graphData: GraphData = {
  nodes: [
    { id: 'root', label: 'Orders', type: 'table' },
    { id: 'neighbor', label: 'Customers', type: 'table' },
  ],
  edges: [
    {
      from: 'root',
      to: 'neighbor',
      label: 'Downstream',
      relationType: 'downstream',
    },
  ],
};

interface HarnessProps {
  data?: GraphData | null;
  entityId?: string;
  selection?: GraphSelection;
  onSelectionChange?: (selection: GraphSelection) => void;
  capture?: (api: ReturnType<typeof useKnowledgeGraphCanvas>) => void;
}

const Harness = ({
  data = graphData,
  entityId = 'root',
  selection = null,
  onSelectionChange = jest.fn(),
  capture,
}: HarnessProps) => {
  const captured = useRef(capture);
  captured.current = capture;
  const canvas = useKnowledgeGraphCanvas({
    NodeComponent: StubNode,
    data,
    unfiltered: data,
    entityId,
    entityType: 'table',
    layout: 'lanes',
    mode: 'knowledge-graph',
    labelMode: 'auto',
    selection,
    fitKey: 'fit',
    viewportKey: 'view',
    onSelectionChange,
  });
  captured.current?.(canvas);

  return <div data-testid="canvas" ref={canvas.containerRef} />;
};

const withProviders = (children: ReactNode) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useKnowledgeGraphCanvas', () => {
  beforeEach(() => {
    graphInstances.length = 0;
    renderMode = 'ok';
    MockResizeObserver.callbacks = [];
    (Graph as unknown as jest.Mock).mockClear();
  });

  it('creates a Graph exactly once for a given entityKey', async () => {
    await act(async () => {
      render(withProviders(<Harness />));
    });
    await flush();
    await flush();

    expect((Graph as unknown as jest.Mock).mock.calls).toHaveLength(1);
    expect(graphInstances[0].render).toHaveBeenCalledTimes(1);
  });

  it('clears the selection when the selected node is not in the data', async () => {
    const onSelectionChange = jest.fn();
    await act(async () => {
      render(
        withProviders(
          <Harness
            selection={{ kind: 'node', id: 'gone' }}
            onSelectionChange={onSelectionChange}
          />
        )
      );
    });
    await flush();
    await flush();

    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('runs the ResizeObserver callback without throwing', async () => {
    await act(async () => {
      render(withProviders(<Harness />));
    });
    await flush();
    await flush();
    const graph = graphInstances[0];
    (graph.resize as jest.Mock).mockClear();
    await act(async () => {
      MockResizeObserver.callbacks.forEach((cb) => cb());
      await Promise.resolve();
    });

    expect(graph.resize).toHaveBeenCalled();
  });

  it('emits a G6 wheel event when the wheel handler runs on the canvas', async () => {
    await act(async () => {
      render(withProviders(<Harness />));
    });
    await flush();
    await flush();
    const graph = graphInstances[0];
    const container = document.querySelector<HTMLDivElement>(
      '[data-testid="canvas"]'
    );
    // A `<canvas>` child is what the wheel handler looks for before forwarding.
    container?.querySelector('canvas');
    const wheelEvent = new WheelEvent('wheel', {
      deltaX: 12,
      deltaY: 34,
      clientX: 40,
      clientY: 50,
      cancelable: true,
    });
    Object.defineProperty(wheelEvent, 'target', {
      value: container,
      writable: false,
    });
    await act(async () => {
      container?.dispatchEvent(wheelEvent);
    });

    expect(graph.emit).toHaveBeenCalledWith(
      'wheel',
      expect.objectContaining({ deltaX: 12, deltaY: 34 })
    );
  });

  it('sets the error state when render() rejects', async () => {
    renderMode = 'throw';
    let last: ReturnType<typeof useKnowledgeGraphCanvas> | undefined;
    await act(async () => {
      render(withProviders(<Harness capture={(api) => (last = api)} />));
    });
    await flush();
    await flush();

    await waitFor(() => expect(last?.status).toBe('error'));

    expect(last?.error).toBeInstanceOf(Error);
  });
});
