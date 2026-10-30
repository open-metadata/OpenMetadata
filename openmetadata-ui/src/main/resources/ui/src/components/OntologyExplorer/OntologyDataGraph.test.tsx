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
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import i18next from 'i18next';
import { Profiler } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsAiMode } from '../../hooks/useAppMode';
import enUS from '../../locale/languages/en-us.json';
import {
  pageFixture,
  prefixFixture,
} from '../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import {
  applyClustersPage,
  buildNativeDataGraph,
  EMPTY_NATIVE_DATA_GRAPH,
  EMPTY_NATIVE_TOPOLOGY,
  stageTopologyPage,
} from '../../utils/governance/ontology/OntologyNativeDataGraph.utils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import OntologyDataGraph from './OntologyDataGraph';

jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

const assetSeeds = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `t${index}`,
    name: `table_${index}`,
    serviceType: ['Snowflake', 'BigQuery', 'Mysql'][index % 3],
    columns: index % 3 === 0 ? 3 : 0,
  }));

const graphData = ({
  loaded = 8,
  total = 150,
  contextFull = false,
  withEdges = true,
  lineageEdges = [{ from: 't1', to: 'acc1' }],
}: {
  loaded?: number;
  total?: number;
  contextFull?: boolean;
  withEdges?: boolean;
  lineageEdges?: { from: string; to: string }[];
} = {}) => {
  const base = applyClustersPage(
    EMPTY_NATIVE_DATA_GRAPH,
    pageFixture({
      clusters: [
        {
          id: 'transfer',
          name: 'Funds Transfer',
          count: total,
          after: loaded < total ? 'cursor' : undefined,
          assets: assetSeeds(loaded),
        },
        {
          id: 'account',
          name: 'Account',
          count: 1,
          assets: [{ id: 'acc1', name: 'accounts', serviceType: 'Mysql' }],
        },
        {
          id: 'unrelated',
          name: 'Unrelated',
          count: 1,
          assets: [{ id: 'misc1', name: 'misc', serviceType: 'Mysql' }],
        },
      ],
      loaded: [prefixFixture('transfer'), prefixFixture('account')],
      contextFull,
    })
  );
  const graph = withEdges
    ? {
        ...base,
        topology: stageTopologyPage(
          EMPTY_NATIVE_TOPOLOGY,
          pageFixture({
            conceptEdges: [
              { from: 'transfer', to: 'account', label: 'part of' },
            ],
            lineageEdges,
          }).topology
        ),
      }
    : base;

  return buildNativeDataGraph(graph, new Set(), 'label.lineage');
};

const renderGraph = (
  props: Partial<React.ComponentProps<typeof OntologyDataGraph>> = {}
) => {
  const onLoadMore = jest.fn();
  const onSelectNode = jest.fn();
  const view = render(
    <OntologyDataGraph
      data={graphData()}
      glossaryColorMap={{}}
      hasMoreTerms={false}
      isLoadingMoreTerms={false}
      relationTypes={[]}
      variant="native"
      onLoadMore={onLoadMore}
      onLoadMoreTerms={jest.fn()}
      onPaneClick={jest.fn()}
      onSelectNode={onSelectNode}
      {...props}
    />
  );

  return { ...view, onLoadMore, onSelectNode };
};

const rowIds = (clusterId: string) =>
  within(screen.getByTestId(`ontology-data-cluster-rows-${clusterId}`))
    .getAllByTestId('ontology-data-asset-name')
    .map((name) => name.textContent);

describe('native Data mode clusters', () => {
  it('reads the concept with its true total and previews four rows', () => {
    renderGraph();

    const header = screen.getByTestId('ontology-data-cluster-transfer');

    expect(header).toHaveTextContent('Funds Transfer');
    expect(
      within(header).getByTestId('ontology-data-cluster-count')
    ).toHaveTextContent('· 150');
    expect(rowIds('transfer')).toEqual([
      'table_0',
      'table_1',
      'table_2',
      'table_3',
    ]);
    expect(
      screen.getByTestId('ontology-load-more-assets-transfer')
    ).toHaveTextContent('label.load-more-count');
  });

  it('asks for the logo of the row service, so each connector shows its own', () => {
    const logo = jest
      .spyOn(serviceUtilClassBase, 'getServiceTypeLogo')
      .mockImplementation(
        (source) => `/logos/${source?.serviceType ?? 'placeholder'}.svg`
      );
    renderGraph();

    const sources = ['t0', 't1', 't2'].map((id) =>
      within(screen.getByTestId(`ontology-data-asset-asset:transfer:${id}`))
        .getByRole('img', { hidden: true })
        .getAttribute('src')
    );

    expect(sources).toEqual([
      '/logos/Snowflake.svg',
      '/logos/BigQuery.svg',
      '/logos/Mysql.svg',
    ]);

    logo.mockRestore();
  });

  it('sets the logo tile on the card surface colour, not the page colour', () => {
    const logo = jest
      .spyOn(serviceUtilClassBase, 'getServiceTypeLogo')
      .mockReturnValue('/logos/Snowflake.svg');
    renderGraph();

    const tile = within(
      screen.getByTestId('ontology-data-asset-asset:transfer:t0')
    ).getByRole('img', { hidden: true }).parentElement;

    expect(tile?.className.split(' ')).toContain('tw:bg-surface');
    expect(tile?.className.split(' ')).not.toContain('tw:bg-primary');

    logo.mockRestore();
  });

  it('loads more through the callback, reveals every loaded row inside the scroll area, and shows less again', () => {
    const { onLoadMore } = renderGraph();

    fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onLoadMore.mock.calls[0][0]).toMatchObject({
      id: 'transfer',
      assetCount: 150,
    });
    expect(rowIds('transfer')).toHaveLength(8);
    expect(
      screen.getByTestId('ontology-data-cluster-rows-transfer')
    ).toHaveAttribute('data-wheel-scroll');

    fireEvent.click(screen.getByTestId('ontology-show-less-assets-transfer'));

    expect(rowIds('transfer')).toEqual([
      'table_0',
      'table_1',
      'table_2',
      'table_3',
    ]);
    expect(
      screen.queryByTestId('ontology-show-less-assets-transfer')
    ).not.toBeInTheDocument();
  });

  it('reveals loaded rows without a request once every asset is loaded', () => {
    const { onLoadMore } = renderGraph({
      data: graphData({ loaded: 8, total: 8 }),
    });

    fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));

    expect(onLoadMore).not.toHaveBeenCalled();
    expect(rowIds('transfer')).toHaveLength(8);
    expect(
      screen.queryByTestId('ontology-load-more-assets-transfer')
    ).not.toBeInTheDocument();
  });

  it('offers no footer on a cluster that fits its four rows', () => {
    renderGraph();

    expect(
      screen.queryByTestId('ontology-load-more-assets-account')
    ).not.toBeInTheDocument();
  });

  it('opens a concept from its header and an asset from its row', () => {
    const { onSelectNode } = renderGraph();

    fireEvent.click(screen.getByText('Funds Transfer'));
    fireEvent.click(
      screen.getByTestId('ontology-data-asset-asset:transfer:t0')
    );

    expect(onSelectNode.mock.calls.map(([node]) => node.id)).toEqual([
      'transfer',
      'asset:transfer:t0',
    ]);
  });

  it('marks the selected concept', () => {
    renderGraph({ selectedNodeId: 'account' });

    expect(
      screen.getByTestId('ontology-data-cluster-account').className
    ).toMatch(/border-brand/);
    expect(
      screen.getByTestId('ontology-data-cluster-transfer').className
    ).not.toMatch(/border-brand/);
  });
});

describe('native Data mode edges', () => {
  it('draws the inferred edge dashed with its property chip and the lineage edge solid', () => {
    renderGraph();

    const edges = screen.getAllByTestId('ontology-data-semantic-edge');
    const byKind = Object.fromEntries(
      edges.map((edge) => [
        edge.getAttribute('data-edge-kind'),
        edge.getAttribute('stroke-dasharray'),
      ])
    );

    expect(edges).toHaveLength(2);
    expect(byKind).toEqual({
      semanticProjection: '4 3',
      observedLineage: null,
    });
    expect(
      screen
        .getAllByTestId('ontology-data-semantic-edge-label')
        .map((label) => label.textContent)
    ).toEqual(['part of', 'label.lineage']);
  });

  it('joins only the related clusters', () => {
    renderGraph();

    expect(screen.getAllByTestId('ontology-data-edge-arrow')).toHaveLength(2);
  });

  it('names dashed as inferred and solid as observed lineage, even before any edge loads', () => {
    renderGraph({ data: graphData({ withEdges: false }) });

    const legend = within(screen.getByTestId('ontology-data-edge-legend'));

    expect(
      legend.getByTestId('ontology-data-legend-inferred')
    ).toHaveTextContent('label.ontology-inferred-relation');
    expect(
      legend.getByTestId('ontology-data-legend-lineage')
    ).toHaveTextContent('label.observed-lineage');
    expect(screen.queryAllByTestId('ontology-data-semantic-edge')).toHaveLength(
      0
    );
  });

  it('does not deny inferred edges in the scope note', () => {
    renderGraph();

    expect(screen.getByText('message.ontology-data-graph-scope')).toBeVisible();
    expect(enUS.message['ontology-data-graph-scope']).toBe(
      'Assets you can view that are bound to each concept. Dashed lines are inferred from related concepts. Solid lines are observed lineage.'
    );
  });
});

describe('native Data mode cluster paging', () => {
  it('offers load more clusters while the context has room', () => {
    const onLoadMoreTerms = jest.fn();
    renderGraph({ hasMoreTerms: true, onLoadMoreTerms });

    fireEvent.click(screen.getByText('label.load-more'));

    expect(onLoadMoreTerms).toHaveBeenCalledTimes(1);
  });

  it('replaces load more with the limit message when the context is full', () => {
    renderGraph({
      data: graphData({ contextFull: true }),
      limitMessage: 'message.ontology-data-context-full',
    });

    expect(screen.getByTestId('ontology-data-context-full')).toHaveTextContent(
      'message.ontology-data-context-full'
    );
    expect(screen.queryByText('label.load-more')).not.toBeInTheDocument();
  });
});

describe('native Data mode lineage', () => {
  const lineageEdge = () =>
    screen
      .getAllByTestId('ontology-data-semantic-edge')
      .find(
        (edge) => edge.getAttribute('data-edge-kind') === 'observedLineage'
      );
  const lineageChip = () =>
    screen
      .getAllByTestId('ontology-data-semantic-edge-label')
      .map((label) => label.textContent)
      .filter((text) => text !== 'part of');
  const pathStart = (path?: Element) =>
    (path?.getAttribute('d') ?? '').split(' ').slice(1, 3).map(Number);
  const cardTop = (id: string) =>
    parseFloat(screen.getByTestId(`ontology-data-cluster-${id}`).style.top);

  it('joins the two rows when both are in view', () => {
    renderGraph();

    const edge = lineageEdge();

    expect(edge).toHaveAttribute('data-anchor', 'rows');
    expect(pathStart(edge)[1]).toBe(cardTop('transfer') + 50 + 64 + 32);
    expect(lineageChip()).toEqual(['label.lineage']);
  });

  it('joins the cards and names both tables when an endpoint row is not shown', () => {
    renderGraph({
      data: graphData({ lineageEdges: [{ from: 't5', to: 'acc1' }] }),
    });

    expect(lineageEdge()).toHaveAttribute('data-anchor', 'cards');
    expect(lineageChip()).toEqual(['table_5 → accounts']);
  });

  it('falls back to the cards once the row scrolls out of the card', () => {
    renderGraph({ data: graphData({ loaded: 8, total: 8 }) });
    fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));

    expect(lineageEdge()).toHaveAttribute('data-anchor', 'rows');

    const rows = screen.getByTestId('ontology-data-cluster-rows-transfer');
    rows.scrollTop = 192;
    fireEvent.scroll(rows);

    expect(lineageEdge()).toHaveAttribute('data-anchor', 'cards');
    expect(lineageChip()).toEqual(['table_1 → accounts']);
  });

  describe('once the rows stop scrolling', () => {
    beforeEach(() => jest.useFakeTimers());

    afterEach(() => jest.useRealTimers());

    const restAt = (top: number) => {
      renderGraph({ data: graphData({ loaded: 8, total: 8 }) });
      fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));
      const rows = screen.getByTestId('ontology-data-cluster-rows-transfer');
      rows.scrollTop = top;
      fireEvent.scroll(rows);
      act(() => {
        jest.advanceTimersByTime(100);
      });
    };

    it('anchors the row where it rests inside a row', () => {
      restAt(40);

      expect(lineageEdge()).toHaveAttribute('data-anchor', 'rows');
      expect(pathStart(lineageEdge())[1]).toBe(
        cardTop('transfer') + 50 + 64 + 32 - 40
      );
    });

    it.each([50, 63])(
      'keeps the edge on table_1 when the card rests at %d, past half a row',
      (top) => {
        restAt(top);

        expect(lineageEdge()).toHaveAttribute('data-anchor', 'rows');
        expect(pathStart(lineageEdge())[1]).toBe(
          cardTop('transfer') + 50 + 64 + 32 - top
        );
      }
    );

    it('anchors a card that leaves the graph and returns where its rows now sit, not at its old rest', () => {
      const graph = (data: ReturnType<typeof graphData>) => (
        <OntologyDataGraph
          data={data}
          glossaryColorMap={{}}
          hasMoreTerms={false}
          isLoadingMoreTerms={false}
          relationTypes={[]}
          variant="native"
          onLoadMore={jest.fn()}
          onLoadMoreTerms={jest.fn()}
          onPaneClick={jest.fn()}
          onSelectNode={jest.fn()}
        />
      );
      const { rerender } = render(graph(graphData({ loaded: 8, total: 8 })));
      fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));
      const rows = screen.getByTestId('ontology-data-cluster-rows-transfer');
      rows.scrollTop = 40;
      fireEvent.scroll(rows);
      act(() => {
        jest.advanceTimersByTime(100);
      });
      rows.scrollTop = 43;
      fireEvent.scroll(rows);

      rerender(
        graph(
          buildNativeDataGraph(
            EMPTY_NATIVE_DATA_GRAPH,
            new Set(),
            'label.lineage'
          )
        )
      );
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      rerender(graph(graphData({ loaded: 8, total: 8 })));

      expect(lineageEdge()).toHaveAttribute('data-anchor', 'rows');
      expect(pathStart(lineageEdge())[1]).toBe(
        cardTop('transfer') + 50 + 64 + 32
      );
    });
  });

  it('anchors the rows where the rendered rows sit, not where the default font puts them', () => {
    const rowIndex = (element: HTMLElement) =>
      [...(element.parentElement?.children ?? [])].indexOf(element);
    const isRow = (element: HTMLElement) =>
      element.parentElement?.dataset.rowsId !== undefined;
    const isRows = (element: HTMLElement) =>
      element.dataset.rowsId !== undefined;
    const getters = [
      jest
        .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return isRow(this) ? 80 : 0;
        }),
      jest
        .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
        .mockImplementation(function (this: HTMLElement) {
          if (isRows(this)) {
            return 62;
          }

          return isRow(this) ? 62 + 80 * rowIndex(this) : 0;
        }),
      jest
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return isRows(this) ? 320 : 0;
        }),
      jest
        .spyOn(HTMLElement.prototype, 'clientTop', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return this.dataset.termId ? 1 : 0;
        }),
    ];
    renderGraph();

    const edge = lineageEdge();

    expect(edge).toHaveAttribute('data-anchor', 'rows');
    expect(pathStart(edge)[1]).toBe(cardTop('transfer') + 1 + 62 + 80 + 40);

    getters.forEach((getter) => getter.mockRestore());
  });

  it('keeps the merged lineage edge of 25 pairs one slot apart from the relation edge', () => {
    renderGraph({
      data: graphData({
        loaded: 30,
        total: 30,
        lineageEdges: Array.from({ length: 25 }, (_, index) => ({
          from: `t${index + 5}`,
          to: 'acc1',
        })),
      }),
    });

    const edges = screen.getAllByTestId('ontology-data-semantic-edge');
    const [relation, lineage] = edges.map((edge) =>
      (edge.getAttribute('d') ?? '').split(' ').map(Number)
    );
    const [relationChip, lineageChip] = screen
      .getAllByTestId('ontology-data-semantic-edge-label')
      .map((label) => parseFloat((label as HTMLElement).style.top));

    expect(edges.map((edge) => edge.getAttribute('data-edge-kind'))).toEqual([
      'semanticProjection',
      'observedLineage',
    ]);
    expect(lineage.slice(1, 3)).toEqual([relation[1], relation[2] + 14]);
    expect(lineage.slice(-2)).toEqual([
      relation[relation.length - 2],
      relation[relation.length - 1] + 14,
    ]);
    expect(lineageChip - relationChip).toBeCloseTo(18);
  });

  it('marks both rows of a lineage edge inside one cluster, naming the other table', () => {
    renderGraph({
      data: graphData({ lineageEdges: [{ from: 't0', to: 't2' }] }),
    });

    expect(
      screen
        .queryAllByTestId('ontology-data-semantic-edge')
        .map((edge) => edge.getAttribute('data-edge-kind'))
    ).toEqual(['semanticProjection']);
    expect(
      screen.getByTestId('ontology-data-asset-asset:transfer:t0')
    ).toHaveTextContent('message.lineage-to-table');
    expect(
      screen.getByTestId('ontology-data-asset-asset:transfer:t2')
    ).toHaveTextContent('message.lineage-from-table');
    expect(
      screen.getByTestId('ontology-data-asset-asset:transfer:t1')
    ).not.toHaveTextContent('message.lineage');
  });
});

describe('scrolling the rows of a native cluster', () => {
  const renderCounted = () => {
    const commits = jest.fn();
    const view = render(
      <Profiler id="graph" onRender={commits}>
        <OntologyDataGraph
          data={graphData({ loaded: 8, total: 8 })}
          glossaryColorMap={{}}
          hasMoreTerms={false}
          isLoadingMoreTerms={false}
          relationTypes={[]}
          variant="native"
          onLoadMore={jest.fn()}
          onLoadMoreTerms={jest.fn()}
          onPaneClick={jest.fn()}
          onSelectNode={jest.fn()}
        />
      </Profiler>
    );
    fireEvent.click(screen.getByTestId('ontology-load-more-assets-transfer'));
    commits.mockClear();

    return { commits, unmount: view.unmount };
  };
  const scrollTo = (top: number) => {
    const rows = screen.getByTestId('ontology-data-cluster-rows-transfer');
    rows.scrollTop = top;
    fireEvent.scroll(rows);
  };

  it('renders nothing for a burst of scroll events inside one row', () => {
    const { commits } = renderCounted();

    [10, 25, 40, 63].forEach(scrollTo);

    expect(commits).not.toHaveBeenCalled();
  });

  describe('once a burst of scroll events settles', () => {
    let logo: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      logo = jest.spyOn(serviceUtilClassBase, 'getServiceTypeLogo');
    });

    afterEach(() => {
      logo.mockRestore();
      jest.useRealTimers();
    });

    it('renders once, 100 ms after the last event of a burst inside one row, and leaves no timer on unmount', () => {
      const { commits, unmount } = renderCounted();
      logo.mockClear();

      [10, 25, 40, 63].forEach((top, index) => {
        if (index > 0) {
          act(() => {
            jest.advanceTimersByTime(30);
          });
        }
        scrollTo(top);
      });
      act(() => {
        jest.advanceTimersByTime(99);
      });

      expect(commits).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(commits).toHaveBeenCalledTimes(1);
      expect(logo).not.toHaveBeenCalled();

      scrollTo(20);
      unmount();

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  it('renders once when the first row in view changes, and renders no row again', () => {
    const { commits } = renderCounted();
    const logo = jest.spyOn(serviceUtilClassBase, 'getServiceTypeLogo');

    scrollTo(70);
    scrollTo(90);

    expect(commits).toHaveBeenCalledTimes(1);
    expect(logo).not.toHaveBeenCalled();

    logo.mockRestore();
  });
});

describe('native Data mode in English', () => {
  const english = i18next.createInstance();
  english.init({
    initAsync: false,
    lng: 'en-US',
    resources: { 'en-US': { translation: enUS } },
  });
  const translate = useTranslation as jest.Mock;
  let keyTranslation: ReturnType<typeof useTranslation>;

  beforeEach(() => {
    keyTranslation = translate();
    translate.mockReturnValue({ ...keyTranslation, t: english.t });
  });

  afterEach(() => {
    translate.mockReturnValue(keyTranslation);
  });

  const heading = () =>
    screen.getByTestId('ontology-data-layer-heading').textContent;

  it('draws the AI-mode heading as a card, and the classic heading without a surface', () => {
    renderGraph();
    const classic = screen.getByTestId('ontology-data-layer-heading');

    expect(classic.className.split(' ')).not.toContain('tw:bg-surface');
    expect(classic.className.split(' ')).toContain('tw:top-15');

    cleanup();
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    renderGraph();
    const card = screen.getByTestId('ontology-data-layer-heading');

    expect(card.className.split(' ')).toContain('tw:bg-surface');
    expect(card.className.split(' ')).not.toContain('tw:top-15');
    expect(card).toHaveTextContent('Data layer');
    expect(card).toHaveTextContent('3 concepts · 152 bindings');

    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('counts the bindings each cluster totals, in the plural', () => {
    renderGraph();

    expect(heading()).toContain('3 concepts · 152 bindings');
  });

  it('counts one concept and one binding in the singular', () => {
    renderGraph({
      data: buildNativeDataGraph(
        applyClustersPage(
          EMPTY_NATIVE_DATA_GRAPH,
          pageFixture({
            clusters: [
              {
                id: 'single',
                name: 'Single',
                count: 1,
                assets: [{ id: 's1', name: 'single_table' }],
              },
            ],
          })
        ),
        new Set(),
        'label.lineage'
      ),
    });

    expect(heading()).toContain('1 concept · 1 binding');
  });

  it('names the first pair of tables and counts the rest on one lineage edge between two cards', () => {
    renderGraph({
      data: graphData({
        lineageEdges: [
          { from: 't5', to: 'acc1' },
          { from: 't6', to: 'acc1' },
          { from: 't7', to: 'acc1' },
        ],
      }),
    });

    const lineage = screen
      .getAllByTestId('ontology-data-semantic-edge')
      .filter(
        (edge) => edge.getAttribute('data-edge-kind') === 'observedLineage'
      );

    expect(lineage).toHaveLength(1);
    expect(lineage[0]).toHaveAttribute('data-anchor', 'cards');
    expect(
      screen
        .getAllByTestId('ontology-data-semantic-edge-label')
        .map((label) => label.textContent)
    ).toEqual(['part of', 'table_5 → accounts and 2 more']);
  });

  it('shows the first lineage note on a row, counts the rest, and describes them all', () => {
    renderGraph({
      data: graphData({
        lineageEdges: [
          { from: 't0', to: 't1' },
          { from: 't0', to: 't2' },
          { from: 't0', to: 't3' },
        ],
      }),
    });

    const row = screen.getByTestId('ontology-data-asset-asset:transfer:t0');

    expect(row).toHaveTextContent(
      'Snowflake · 3 cols · Lineage to table_1 and 2 more'
    );
    expect(row).toHaveAccessibleDescription(
      'Lineage to table_1 · Lineage to table_2 · Lineage to table_3'
    );
  });

  it('shows the connector with its column count, zero included', () => {
    renderGraph();

    expect(
      screen.getByTestId('ontology-data-asset-asset:transfer:t0')
    ).toHaveTextContent('Snowflake · 3 cols');
    expect(
      screen.getByTestId('ontology-data-asset-asset:transfer:t1')
    ).toHaveTextContent('BigQuery · 0 cols');
  });
});
