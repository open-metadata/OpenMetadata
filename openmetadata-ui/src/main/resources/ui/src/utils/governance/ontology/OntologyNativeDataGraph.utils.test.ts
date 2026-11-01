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
import { AxiosError, AxiosHeaders } from 'axios';
import { pageFixture, prefixFixture } from './OntologyNativeDataGraph.mock';
import {
  applyBindingsPage,
  applyClustersPage,
  bindingsRequest,
  buildNativeDataGraph,
  classifyPageFailure,
  clustersRequest,
  EMPTY_NATIVE_DATA_GRAPH,
  EMPTY_NATIVE_TOPOLOGY,
  stageTopologyPage,
  topologyRequest,
} from './OntologyNativeDataGraph.utils';

const NO_LOADING: ReadonlySet<string> = new Set();

const loadedGraph = () =>
  applyClustersPage(
    EMPTY_NATIVE_DATA_GRAPH,
    pageFixture({
      clusters: [
        {
          id: 'transfer',
          name: 'Funds Transfer',
          count: 150,
          after: 'cursor-4',
          assets: [
            {
              id: 'a1',
              name: 'transfers',
              serviceType: 'Snowflake',
              columns: 3,
            },
            { id: 'a2', name: 'payments', serviceType: 'BigQuery', columns: 2 },
          ],
        },
        {
          id: 'account',
          name: 'Account',
          count: 1,
          assets: [{ id: 'a3', name: 'accounts', serviceType: 'Mysql' }],
        },
        {
          id: 'unrelated',
          name: 'Unrelated',
          count: 1,
          assets: [{ id: 'a9', name: 'misc' }],
        },
      ],
      loaded: [
        prefixFixture('transfer', 'a2'),
        prefixFixture('account', 'a3'),
        prefixFixture('unrelated', 'a9'),
      ],
      nextClusterOffset: 12,
    })
  );

const axiosFailure = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe('request builders', () => {
  it('asks for the first 12 clusters with no loaded context', () => {
    expect(clustersRequest([], 0)).toEqual({
      loaded: [],
      page: { kind: 'clusters', limit: 12, offset: 0 },
    });
  });

  it('continues one concept from its cursor and carries the loaded prefixes', () => {
    const loaded = [prefixFixture('transfer', 'a2')];

    expect(bindingsRequest(loaded, 'transfer', 'cursor-4')).toEqual({
      loaded,
      page: {
        kind: 'bindings',
        conceptId: 'transfer',
        after: 'cursor-4',
        limit: 25,
      },
    });
  });

  it('continues topology with the cursor only', () => {
    expect(topologyRequest([], 'sealed')).toEqual({
      loaded: [],
      page: { kind: 'topology', after: 'sealed' },
    });
  });
});

describe('classifyPageFailure', () => {
  it.each([
    [400, 'invalid'],
    [412, 'stale'],
    [500, 'other'],
  ])('maps status %i to %s', (status, expected) => {
    expect(classifyPageFailure(axiosFailure(status))).toBe(expected);
  });

  it('treats a failure without a response as other', () => {
    expect(classifyPageFailure(new Error('offline'))).toBe('other');
  });
});

describe('applyClustersPage', () => {
  it('keeps true totals, cursors, the loaded context and the next cluster offset', () => {
    const graph = loadedGraph();

    expect(
      graph.clusters.map(({ concept, assetCount, after, assets }) => [
        concept.id,
        assetCount,
        after,
        assets.map((asset) => asset.id),
      ])
    ).toEqual([
      ['transfer', 150, 'cursor-4', ['a1', 'a2']],
      ['account', 1, undefined, ['a3']],
      ['unrelated', 1, undefined, ['a9']],
    ]);
    expect(graph.loaded.map((prefix) => prefix.conceptId)).toEqual([
      'transfer',
      'account',
      'unrelated',
    ]);
    expect(graph.nextClusterOffset).toBe(12);
    expect(graph.contextFull).toBe(false);
  });

  it('replaces a cluster that a replayed page returns again instead of duplicating it', () => {
    const replayed = applyClustersPage(
      loadedGraph(),
      pageFixture({
        clusters: [
          {
            id: 'account',
            name: 'Account',
            count: 2,
            assets: [{ id: 'a3', name: 'accounts' }],
          },
        ],
        loaded: [],
      })
    );

    expect(replayed.clusters.map((cluster) => cluster.concept.id)).toEqual([
      'transfer',
      'account',
      'unrelated',
    ]);
    expect(replayed.clusters[1].assetCount).toBe(2);
  });

  it('records a full context and drops the advertised offset', () => {
    const full = applyClustersPage(
      loadedGraph(),
      pageFixture({ contextFull: true })
    );

    expect(full.contextFull).toBe(true);
    expect(full.nextClusterOffset).toBeUndefined();
  });
});

describe('applyBindingsPage', () => {
  it('appends new assets, counts distinct column paths and moves the cursor', () => {
    const next = applyBindingsPage(
      loadedGraph(),
      'transfer',
      pageFixture({
        bindings: {
          assets: [
            { id: 'a2', name: 'payments' },
            { id: 'a4', name: 'ledger', serviceType: 'Snowflake', columns: 5 },
          ],
          after: 'cursor-8',
        },
        loaded: [prefixFixture('transfer', 'a4')],
      })
    );
    const transfer = next.clusters[0];

    expect(transfer.assets.map((asset) => asset.id)).toEqual([
      'a1',
      'a2',
      'a4',
    ]);
    expect(transfer.assets[2]).toMatchObject({
      columnCount: 5,
      serviceType: 'Snowflake',
    });
    expect(transfer.after).toBe('cursor-8');
    expect(next.loaded).toEqual([prefixFixture('transfer', 'a4')]);
  });

  it('clears the cursor when the last page has no cursor', () => {
    const next = applyBindingsPage(
      loadedGraph(),
      'transfer',
      pageFixture({ bindings: { assets: [] } })
    );

    expect(next.clusters[0].after).toBeUndefined();
  });
});

describe('stageTopologyPage', () => {
  it('deduplicates edges across continuation pages', () => {
    const first = stageTopologyPage(
      EMPTY_NATIVE_TOPOLOGY,
      pageFixture({
        conceptEdges: [{ from: 'transfer', to: 'account', label: 'part of' }],
        lineageEdges: [{ from: 'a1', to: 'a3' }],
      }).topology
    );
    const second = stageTopologyPage(
      first,
      pageFixture({
        conceptEdges: [
          { from: 'transfer', to: 'account', label: 'part of' },
          { from: 'account', to: 'transfer', label: 'owns' },
        ],
        lineageEdges: [{ from: 'a1', to: 'a3' }],
      }).topology
    );

    expect(second.conceptEdges).toHaveLength(2);
    expect(second.lineageEdges).toHaveLength(1);
  });
});

describe('buildNativeDataGraph', () => {
  const withTopology = () => ({
    ...loadedGraph(),
    topology: stageTopologyPage(
      EMPTY_NATIVE_TOPOLOGY,
      pageFixture({
        conceptEdges: [
          { from: 'transfer', to: 'account', label: 'part of' },
          { from: 'transfer', to: 'not-loaded', label: 'part of' },
        ],
        lineageEdges: [
          { from: 'a1', to: 'a3' },
          { from: 'a2', to: 'a3' },
          { from: 'a1', to: 'a-not-loaded' },
        ],
      }).topology
    ),
  });

  it('builds one concept node per cluster with its visible total and cursor-based loaded count', () => {
    const { nodes } = buildNativeDataGraph(
      withTopology(),
      new Set(['account']),
      'Lineage'
    );
    const transfer = nodes.find((node) => node.id === 'transfer');
    const account = nodes.find((node) => node.id === 'account');

    expect(transfer).toMatchObject({
      label: 'Funds Transfer',
      assetCount: 150,
      loadedAssetCount: 2,
      isLoadingAssets: false,
    });
    expect(account).toMatchObject({
      assetCount: 1,
      loadedAssetCount: 1,
      isLoadingAssets: true,
    });
  });

  it('gives every asset row its connector, column count and a node per cluster', () => {
    const { nodes, edges } = buildNativeDataGraph(
      withTopology(),
      NO_LOADING,
      'Lineage'
    );
    const row = nodes.find((node) => node.id === 'asset:transfer:a1');

    expect(row).toMatchObject({
      label: 'transfers',
      serviceLabel: 'Snowflake',
      columnCount: 3,
      type: 'dataAsset',
    });
    expect(
      edges.filter((edge) => edge.edgeKind === 'assetBinding')
    ).toHaveLength(4);
  });

  it('draws an inferred edge with the property label only between loaded concepts', () => {
    const { edges } = buildNativeDataGraph(
      withTopology(),
      NO_LOADING,
      'Lineage'
    );
    const inferred = edges.filter(
      (edge) => edge.edgeKind === 'semanticProjection'
    );

    expect(inferred).toEqual([
      expect.objectContaining({
        from: 'transfer',
        to: 'account',
        label: 'part of',
        relationType: 'inferred',
      }),
    ]);
  });

  it('draws one lineage edge per joined pair of rows, naming the rows it joins', () => {
    const { edges } = buildNativeDataGraph(
      withTopology(),
      NO_LOADING,
      'Lineage'
    );
    const lineage = edges.filter((edge) => edge.edgeKind === 'observedLineage');

    expect(lineage).toEqual([
      expect.objectContaining({
        id: 'lineage:asset:transfer:a1:asset:account:a3',
        from: 'transfer',
        to: 'account',
        label: 'Lineage',
        relationType: 'observedLineage',
        lineage: {
          from: { nodeId: 'asset:transfer:a1', label: 'transfers' },
          to: { nodeId: 'asset:account:a3', label: 'accounts' },
        },
      }),
      expect.objectContaining({
        id: 'lineage:asset:transfer:a2:asset:account:a3',
        lineage: {
          from: { nodeId: 'asset:transfer:a2', label: 'payments' },
          to: { nodeId: 'asset:account:a3', label: 'accounts' },
        },
      }),
    ]);
  });

  it('never joins the unrelated cluster', () => {
    const { edges } = buildNativeDataGraph(
      withTopology(),
      NO_LOADING,
      'Lineage'
    );
    const related = edges.filter((edge) => edge.edgeKind !== 'assetBinding');

    expect(related.map((edge) => edge.id)).toEqual([
      'inferred:transfer|account|urn:property:part of',
      'lineage:asset:transfer:a1:asset:account:a3',
      'lineage:asset:transfer:a2:asset:account:a3',
    ]);
    expect(
      related.some(
        (edge) => edge.from === 'unrelated' || edge.to === 'unrelated'
      )
    ).toBe(false);
  });

  describe('lineage between two tables of one cluster', () => {
    const sameCluster = () => ({
      ...loadedGraph(),
      topology: stageTopologyPage(
        EMPTY_NATIVE_TOPOLOGY,
        pageFixture({ lineageEdges: [{ from: 'a1', to: 'a2' }] }).topology
      ),
    });

    it('marks both rows and names the table on the other end instead of drawing an edge', () => {
      const { edges, nodes } = buildNativeDataGraph(
        sameCluster(),
        NO_LOADING,
        'Lineage'
      );
      const notes = (id: string) =>
        nodes.find((node) => node.id === id)?.lineageNotes;

      expect(notes('asset:transfer:a1')).toEqual([
        { direction: 'downstream', label: 'payments' },
      ]);
      expect(notes('asset:transfer:a2')).toEqual([
        { direction: 'upstream', label: 'transfers' },
      ]);
      expect(notes('asset:account:a3')).toBeUndefined();
      expect(
        edges.filter((edge) => edge.edgeKind === 'observedLineage')
      ).toEqual([]);
    });
  });
});
