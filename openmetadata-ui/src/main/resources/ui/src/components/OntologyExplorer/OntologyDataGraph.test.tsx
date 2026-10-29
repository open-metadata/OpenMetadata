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
import { fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
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
