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

import { EdgeData, Graph, GraphOptions, NodeData } from '@antv/g6';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/UntitledUIThemeProvider/theme-provider';
import { downloadEntityGraph, getEntityGraphData } from '../../rest/rdfAPI';
import { GraphData } from '../../rest/rdfAPI.interface';
import KnowledgeGraph from './KnowledgeGraph';

jest.mock('@antv/g6', () => ({
  ExtensionCategory: { NODE: 'node' },
  register: jest.fn(),
  Graph: jest.fn().mockImplementation((options: GraphOptions) => {
    const mergeItems = <T extends { id?: string }>(
      items: T[],
      updates: Partial<T>[]
    ) => {
      const byId = new Map(updates.map((item) => [item.id, item]));

      return items.map((item) => ({ ...item, ...byId.get(item.id) }));
    };
    let data: { nodes: NodeData[]; edges: EdgeData[] } = {
      nodes: [],
      edges: [],
    };
    let zoom = 1;
    const canvas = document.createElement('canvas');
    (options.container as HTMLElement).appendChild(canvas);

    return {
      destroyed: false,
      setTransforms: jest.fn(),
      getNodeData: () => data.nodes,
      getEdgeData: () => data.edges,
      setData: (next: typeof data) => {
        data = next;
      },
      updateNodeData: (nodes: NodeData[]) => {
        data.nodes = mergeItems(data.nodes, nodes);
      },
      updateEdgeData: (edges: EdgeData[]) => {
        data.edges = mergeItems(data.edges, edges);
      },
      draw: jest.fn().mockResolvedValue(undefined),
      render: jest.fn().mockResolvedValue(undefined),
      fitView: jest.fn().mockResolvedValue(undefined),
      focusElement: jest.fn().mockResolvedValue(undefined),
      zoomTo: async (value: number) => {
        zoom = value;
      },
      getZoom: () => zoom,
      getViewportByCanvas: (point: [number, number]) => point,
      on: jest.fn(),
      resize: jest.fn(),
      destroy() {
        this.destroyed = true;
        canvas.remove();
      },
    };
  }),
}));
jest.mock('@antv/g6-extension-react', () => ({ ReactNode: jest.fn() }));
jest.mock('../../rest/rdfAPI', () => ({
  getEntityGraphData: jest.fn(),
  downloadEntityGraph: jest.fn(),
}));
jest.mock('../../rest/tableAPI', () => ({
  getTableColumnsById: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));
jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermsByIds: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../utils/TableUtils', () => ({ getEntityIcon: () => <svg /> }));
jest.mock(
  '../Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => () => <div />
);

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
    {
      from: 'root',
      to: 'neighbor',
      label: 'Related to',
      relationType: 'custom',
    },
  ],
  filterOptions: {
    entityTypes: [{ id: 'table', label: 'Table', count: 2 }],
    relationshipTypes: [
      { id: 'downstream', label: 'Downstream', count: 1 },
      { id: 'custom', label: 'Related to', count: 1 },
    ],
  },
  truncated: false,
};
const api = getEntityGraphData as jest.MockedFunction<
  typeof getEntityGraphData
>;
const entity = { id: 'root', type: 'table', name: 'Orders' };
const openGraph = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <KnowledgeGraph entity={entity} entityType="table" />
      </MemoryRouter>
    </ThemeProvider>
  );
const press = async (element: Element) =>
  act(async () => {
    await userEvent.click(element);
  });
const chooseLevel = async (level: number) => {
  await press(screen.getByRole('button', { name: /label.kg-levels/ }));
  await press(screen.getByTestId('graph-level-' + level));
};
const openView = async () =>
  userEvent.click(screen.getByTestId('graph-view-menu'));

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  api.mockReset();
  api.mockResolvedValue(graphData);
  (
    downloadEntityGraph as jest.MockedFunction<typeof downloadEntityGraph>
  ).mockResolvedValue(undefined);
});

describe('KnowledgeGraph', () => {
  it('opens the selected concept model with exact ontology predicates', async () => {
    api.mockImplementation(async (query) =>
      query.entityType === 'glossaryTerm'
        ? {
            nodes: [
              { id: 'term', label: 'Customer', type: 'glossaryTerm' },
              { id: 'order', label: 'Order', type: 'glossaryTerm' },
            ],
            edges: [
              {
                from: 'term',
                to: 'order',
                label: 'Places',
                relationType: 'https://example.org/places',
              },
            ],
          }
        : {
            ...graphData,
            nodes: [
              ...graphData.nodes,
              { id: 'term', label: 'Customer', type: 'glossaryTerm' },
            ],
            edges: [
              ...graphData.edges,
              {
                from: 'root',
                to: 'term',
                label: 'Has glossary term',
                relationType: 'hasGlossaryTerm',
              },
            ],
          }
    );
    await act(async () => {
      openGraph();
    });
    await press(screen.getByRole('radio', { name: 'label.ontology' }));
    await screen.findByTestId('edge-Customer-Places-Order');

    expect(
      screen.queryByTestId('edge-Orders-Downstream-Customers')
    ).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'term',
        entityType: 'glossaryTerm',
        depth: 1,
      }),
      { signal: expect.any(AbortSignal) }
    );

    await press(screen.getByRole('radio', { name: 'label.knowledge-graph' }));
    await screen.findByTestId('edge-Orders-Downstream-Customers');
  });

  it('defaults to the direct neighborhood with exactly three level choices', async () => {
    await act(async () => {
      openGraph();
    });
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(expect.objectContaining({ depth: 1 }), {
        signal: expect.any(AbortSignal),
      })
    );
    await press(screen.getByRole('button', { name: /label.kg-levels/ }));

    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByTestId('graph-level-2')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByTestId('graph-level-4')).not.toBeInTheDocument();

    await screen.findByTestId('edge-Orders-Related to-Customers');
  });

  it.each([
    [1, 1, 0],
    [2, 1, 1],
    [3, 2, 2],
  ])(
    'requests level %i as depth %i and exports it as depth %i',
    async (level, depth, exportDepth) => {
      await act(async () => {
        openGraph();
      });
      await waitFor(() =>
        expect(screen.getByTestId('knowledge-graph-edges').innerHTML).toContain(
          'Downstream'
        )
      );
      await chooseLevel(level);
      await waitFor(() =>
        expect(api).toHaveBeenLastCalledWith(
          expect.objectContaining({ depth }),
          { signal: expect.any(AbortSignal) }
        )
      );
      await openView();
      await press(screen.getByTestId('knowledge-graph-export'));
      await press(
        screen.getByRole('menuitemradio', { name: 'label.skos-turtle' })
      );
      await waitFor(() =>
        expect(downloadEntityGraph).toHaveBeenCalledWith(
          expect.objectContaining({ depth: exportDepth, format: 'turtle' })
        )
      );
    }
  );

  it('shows the entity profile at level 1 and re-fits the viewport for each level', async () => {
    api.mockResolvedValue({
      ...graphData,
      nodes: [
        ...graphData.nodes,
        { id: 'team', label: 'Analytics', type: 'team' },
      ],
      edges: [
        ...graphData.edges,
        {
          from: 'root',
          to: 'team',
          label: 'Has owner',
          relationType: 'hasOwner',
        },
      ],
    });
    await act(async () => {
      openGraph();
    });
    await screen.findByTestId('edge-Orders-Downstream-Customers');
    const graph = (Graph as unknown as jest.Mock).mock.results[0]
      .value as Graph;
    await waitFor(() =>
      expect(graph.focusElement).toHaveBeenCalledWith('root', false)
    );
    (graph.focusElement as jest.Mock).mockClear();
    (graph.zoomTo as jest.Mock) = jest.fn(graph.zoomTo);

    await chooseLevel(1);

    await screen.findByTestId('edge-Orders-Has owner-Analytics');

    expect(
      screen.queryByTestId('edge-Orders-Downstream-Customers')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('graph-status')).toHaveTextContent(
      'label.kg-returned-counts'
    );
    expect(screen.queryByText('message.kg-root-only')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(graph.focusElement).toHaveBeenCalledWith('root', false)
    );

    expect(graph.zoomTo).toHaveBeenCalled();
    expect(api).toHaveBeenLastCalledWith(
      expect.objectContaining({ depth: 1 }),
      {
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('explains an empty level 1 as a missing profile rather than a hidden graph', async () => {
    await act(async () => {
      openGraph();
    });
    await screen.findByTestId('edge-Orders-Downstream-Customers');

    await chooseLevel(1);

    await screen.findByText('message.kg-root-only');

    expect(
      screen.queryByTestId('edge-Orders-Downstream-Customers')
    ).not.toBeInTheDocument();
  });

  it('keeps its canvas and zoom when labels change and keeps every relationship', async () => {
    await act(async () => {
      openGraph();
    });
    await screen.findByTestId('edge-Orders-Related to-Customers');
    const canvas = screen
      .getByTestId('knowledge-graph-canvas')
      .querySelector('canvas');
    const graph = (Graph as unknown as jest.Mock).mock.results[0]
      .value as Graph;
    await waitFor(() => expect(graph.render).toHaveBeenCalled());
    await press(screen.getByTestId('zoom-in'));
    const zoom = graph.getZoom();
    await openView();
    await press(
      within(screen.getByTestId('graph-label-chooser')).getByRole('button')
    );
    await press(screen.getByRole('option', { name: 'label.kg-no-labels' }));
    await waitFor(() =>
      expect(
        graph.getEdgeData().every((edge) => edge.style?.labelText === '')
      ).toBe(true)
    );

    expect(graph.getEdgeData()).toHaveLength(2);
    expect(
      screen.getByTestId('knowledge-graph-canvas').querySelector('canvas')
    ).toBe(canvas);
    expect(graph.getZoom()).toBe(zoom);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('keeps controls on failure and retries the selected level', async () => {
    api.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      openGraph();
    });
    await screen.findByRole('alert');

    expect(screen.getByTestId('level-chooser')).toBeVisible();

    await press(screen.getByRole('button', { name: 'label.retry' }));
    await screen.findByTestId('edge-Orders-Downstream-Customers');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks partial responses and keeps the prior graph on a failed refresh', async () => {
    api.mockResolvedValueOnce({ ...graphData, truncated: true });
    await act(async () => {
      openGraph();
    });
    await screen.findByTestId('graph-partial');
    api.mockRejectedValueOnce(new Error('offline'));
    await press(screen.getByTestId('refresh'));
    await screen.findByRole('alert');

    expect(
      screen.getByTestId('edge-Orders-Downstream-Customers')
    ).toBeInTheDocument();
    expect(screen.getByTestId('graph-partial')).toBeVisible();
  });

  it('clears filters without changing the level', async () => {
    await act(async () => {
      openGraph();
    });
    await screen.findByTestId('edge-Orders-Downstream-Customers');
    await chooseLevel(3);
    await press(screen.getByTestId('graph-filters-toggle'));
    await press(screen.getByRole('button', { name: 'label.entity-type' }));
    await press(screen.getByRole('menuitemcheckbox', { name: 'Table (2)' }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    await press(
      screen.getByRole('button', { name: 'label.clear-filter-plural' })
    );
    await waitFor(() =>
      expect(api).toHaveBeenLastCalledWith(
        expect.objectContaining({ depth: 2 }),
        { signal: expect.any(AbortSignal) }
      )
    );

    expect(
      screen.getByRole('button', { name: /label.kg-levels/ })
    ).toHaveTextContent('3 · label.extended');
  });
});
