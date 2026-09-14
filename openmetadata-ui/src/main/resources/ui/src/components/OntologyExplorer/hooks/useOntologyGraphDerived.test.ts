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
import { renderHook } from '@testing-library/react';
import { LayoutType } from '../OntologyExplorer.constants';
import {
  GraphFilters,
  OntologyEdge,
  OntologyEdgeKind,
  OntologyNode,
} from '../OntologyExplorer.interface';
import {
  ASSET_NODE_TYPE,
  METRIC_NODE_TYPE,
  OBSERVED_LINEAGE_EDGE_KIND,
  SEMANTIC_PROJECTION_EDGE_KIND,
} from '../utils/graphBuilders';
import {
  useOntologyGraphDerived,
  UseOntologyGraphDerivedOptions,
} from './useOntologyGraphDerived';

const node = (
  overrides: Partial<OntologyNode> & { id: string }
): OntologyNode => ({
  label: overrides.id,
  type: 'glossaryTerm',
  ...overrides,
});

const edge = (
  from: string,
  to: string,
  relationType: string,
  edgeKind?: OntologyEdgeKind
): OntologyEdge => ({
  from,
  to,
  label: relationType,
  relationType,
  ...(edgeKind ? { edgeKind } : {}),
});

const baseFilters: GraphFilters = {
  viewMode: 'overview',
  glossaryIds: [],
  relationTypes: [],
  showIsolatedNodes: true,
  showCrossGlossaryOnly: false,
  searchQuery: '',
};

const baseOptions: UseOntologyGraphDerivedOptions = {
  graphData: null,
  assetGraphData: null,
  loadingTermIds: new Set<string>(),
  termAssetCounts: {},
  filters: baseFilters,
  explorationMode: 'model',
  glossaries: [],
  relationTypes: [],
  settings: { layout: LayoutType.Hierarchical, showEdgeLabels: true },
  scope: 'global',
  dataSource: 'database',
};

const renderDerived = (overrides: Partial<UseOntologyGraphDerivedOptions>) =>
  renderHook(() => useOntologyGraphDerived({ ...baseOptions, ...overrides }));

const nodeIds = (nodes: OntologyNode[] | undefined): string[] =>
  (nodes ?? []).map((n) => n.id).sort();

const edgeSignature = (e: OntologyEdge): string =>
  `${e.from}->${e.to}:${e.relationType}:${e.edgeKind ?? ''}`;

describe('useOntologyGraphDerived filteredGraphData', () => {
  it('keeps terms in the glossary filter plus their edge-incident neighbors', () => {
    const { result } = renderDerived({
      filters: { ...baseFilters, glossaryIds: ['g1'] },
      graphData: {
        nodes: [
          node({ id: 't1', glossaryId: 'g1' }),
          node({ id: 't2', glossaryId: 'g2' }),
          node({ id: 't3', glossaryId: 'g2' }),
          node({ id: 'g1', type: 'glossary' }),
        ],
        edges: [edge('t1', 't2', 'relatedTo')],
      },
    });

    const filtered = result.current.filteredGraphData;

    expect(nodeIds(filtered?.nodes)).toEqual(['g1', 't1', 't2']);
    expect(filtered?.edges.map(edgeSignature)).toEqual(['t1->t2:relatedTo:']);
  });

  it('drops a node whose only edges were filtered out but keeps a truly isolated node', () => {
    const { result } = renderDerived({
      filters: {
        ...baseFilters,
        relationTypes: ['relatedTo'],
        showIsolatedNodes: true,
      },
      graphData: {
        nodes: [
          node({ id: 'a' }),
          node({ id: 'b' }),
          node({ id: 'c' }),
          node({ id: 'd' }),
        ],
        edges: [edge('a', 'b', 'relatedTo'), edge('a', 'd', 'partOf')],
      },
    });

    const filtered = result.current.filteredGraphData;

    expect(nodeIds(filtered?.nodes)).toEqual(['a', 'b', 'c']);
    expect(filtered?.edges.map(edgeSignature)).toEqual(['a->b:relatedTo:']);
  });

  it('always keeps asset and metric edges in data mode except semantic projection edges', () => {
    const { result } = renderDerived({
      explorationMode: 'data',
      filters: { ...baseFilters, relationTypes: ['relatedTo'] },
      graphData: {
        nodes: [
          node({ id: 'asset1', type: ASSET_NODE_TYPE }),
          node({ id: 'asset2', type: ASSET_NODE_TYPE }),
          node({ id: 'metric1', type: METRIC_NODE_TYPE }),
          node({ id: 'term1' }),
        ],
        edges: [
          edge('asset1', 'asset2', 'relatedTo', OBSERVED_LINEAGE_EDGE_KIND),
          edge('asset1', 'asset2', 'requires', SEMANTIC_PROJECTION_EDGE_KIND),
          edge('asset1', 'asset2', 'relatedTo', SEMANTIC_PROJECTION_EDGE_KIND),
          edge('metric1', 'asset1', 'metricFor', OBSERVED_LINEAGE_EDGE_KIND),
        ],
      },
    });

    const signatures = (result.current.filteredGraphData?.edges ?? []).map(
      edgeSignature
    );

    expect(signatures).toContain('asset1->asset2:relatedTo:observedLineage');
    expect(signatures).toContain('metric1->asset1:metricFor:observedLineage');
    expect(signatures).toContain('asset1->asset2:relatedTo:semanticProjection');
    expect(signatures).not.toContain(
      'asset1->asset2:requires:semanticProjection'
    );
  });

  it('keeps only cross-glossary edges and prunes orphaned nodes when showCrossGlossaryOnly is on', () => {
    const { result } = renderDerived({
      filters: { ...baseFilters, showCrossGlossaryOnly: true },
      graphData: {
        nodes: [
          node({ id: 'a', glossaryId: 'g1' }),
          node({ id: 'b', glossaryId: 'g2' }),
          node({ id: 'c', glossaryId: 'g1' }),
          node({ id: 'd', glossaryId: 'g1' }),
        ],
        edges: [edge('a', 'b', 'relatedTo'), edge('a', 'c', 'relatedTo')],
      },
    });

    const filtered = result.current.filteredGraphData;

    expect(nodeIds(filtered?.nodes)).toEqual(['a', 'b']);
    expect(filtered?.edges.map(edgeSignature)).toEqual(['a->b:relatedTo:']);
  });

  it('drops unconnected nodes when showIsolatedNodes is off but always retains glossary nodes', () => {
    const { result } = renderDerived({
      filters: { ...baseFilters, showIsolatedNodes: false },
      graphData: {
        nodes: [
          node({ id: 'a' }),
          node({ id: 'b' }),
          node({ id: 'iso' }),
          node({ id: 'gloss', type: 'glossary' }),
        ],
        edges: [edge('a', 'b', 'relatedTo')],
      },
    });

    expect(nodeIds(result.current.filteredGraphData?.nodes)).toEqual([
      'a',
      'b',
      'gloss',
    ]);
  });

  it('restricts to the entity and its direct edge neighbors when scope is term', () => {
    const { result } = renderDerived({
      scope: 'term',
      entityId: 'center',
      graphData: {
        nodes: [
          node({ id: 'center' }),
          node({ id: 'n1' }),
          node({ id: 'n2' }),
          node({ id: 'far' }),
        ],
        edges: [
          edge('center', 'n1', 'relatedTo'),
          edge('n2', 'center', 'partOf'),
          edge('n1', 'far', 'relatedTo'),
        ],
      },
    });

    const filtered = result.current.filteredGraphData;

    expect(nodeIds(filtered?.nodes)).toEqual(['center', 'n1', 'n2']);
    expect(filtered?.edges.map(edgeSignature).sort()).toEqual([
      'center->n1:relatedTo:',
      'n2->center:partOf:',
    ]);
  });
});

describe('useOntologyGraphDerived statsItems', () => {
  const statsGraph = {
    nodes: [
      node({ id: 't1' }),
      node({ id: 't2' }),
      node({ id: 'iso1', type: 'glossaryTermIsolated' }),
      node({ id: 'm1', type: METRIC_NODE_TYPE }),
    ],
    edges: [edge('t1', 't2', 'relatedTo')],
  };

  it('counts terms, metrics, relations and isolated nodes and appends (RDF) for the rdf data source', () => {
    const { result } = renderDerived({
      dataSource: 'rdf',
      graphData: statsGraph,
    });

    expect(result.current.statsItems).toEqual([
      '3 label.term-plural',
      '1 label.metric-plural',
      '1 label.relation-plural',
      '1 label.isolated (RDF)',
    ]);
  });

  it('omits the (RDF) suffix for the database data source', () => {
    const { result } = renderDerived({
      dataSource: 'database',
      graphData: statsGraph,
    });

    expect(result.current.statsItems).toContain('1 label.isolated');
    expect(
      result.current.statsItems.some((item) => item.includes('(RDF)'))
    ).toBe(false);
  });
});
