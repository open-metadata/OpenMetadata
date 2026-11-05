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

import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { GraphFilters, OntologyGraphData } from './OntologyExplorer.interface';
import {
  buildNativeTreeIndex,
  buildOntologyQuerySuggestions,
  buildOntologyTreeGroups,
  buildOntologyTreeMetrics,
  findNativeTreePath,
  getNativeTreePage,
  getOntologyHealthSummary,
  nativeTreeCursorForPath,
  nestTreeRows,
  resolveOntologyTermLabel,
} from './OntologyStudio.utils';

const FILTERS: GraphFilters = {
  glossaryIds: [],
  relationTypes: [],
  searchQuery: '',
  showCrossGlossaryOnly: false,
  showIsolatedNodes: true,
  viewMode: 'overview',
};

const GLOSSARIES: Glossary[] = [
  { id: 'g1', name: 'Finance', description: '' },
  { id: 'g2', name: 'Compliance', description: '' },
];

const RELATION_TYPES: RelationshipType[] = [
  createRelationshipTypeMock({
    name: 'broader',
    displayName: 'Broader',
    rdfPredicate: 'http://www.w3.org/2004/02/skos/core#broader',
  }),
];

const GRAPH: OntologyGraphData = {
  nodes: [
    {
      id: 'a',
      label: 'Alpha parent',
      type: 'glossaryTerm',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.AlphaParent',
    },
    {
      id: 'b',
      label: 'Beta parent',
      type: 'glossaryTerm',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.BetaParent',
    },
    {
      id: 'c',
      label: 'Child',
      type: 'glossaryTerm',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.Child',
    },
    {
      id: 'd',
      label: 'Detached',
      type: 'glossaryTermIsolated',
      glossaryId: 'g1',
      fullyQualifiedName: 'Finance.Detached',
    },
    {
      id: 'e',
      label: 'External isolated',
      type: 'glossaryTermIsolated',
      glossaryId: 'g2',
      fullyQualifiedName: 'Compliance.ExternalIsolated',
    },
    { id: 'asset', label: 'Orders', type: 'dataAsset' },
  ],
  edges: [
    { from: 'a', to: 'c', label: 'Parent of', relationType: 'parentOf' },
    { from: 'c', to: 'b', label: 'Broader', relationType: 'broader' },
    {
      from: 'asset',
      to: 'd',
      label: 'Tagged with',
      relationType: 'hasGlossaryTerm',
      edgeKind: 'assetBinding',
    },
  ],
};

const parentOf = (from: string, to: string) => ({
  from,
  to,
  label: 'Parent of',
  relationType: 'parentOf',
});

describe('OntologyStudio utils', () => {
  it('resolves a human label without allowing an entity UUID to win', () => {
    const id = '002e5485-0c59-45cc-912e-15fbc7e350bf';

    expect(
      resolveOntologyTermLabel({
        displayName: 'Customer Account',
        fullyQualifiedName: 'Finance.customer_account',
        id,
        label: id,
        name: 'customer_account',
      })
    ).toBe('Customer Account');
    expect(
      resolveOntologyTermLabel({
        displayName: '  ',
        fullyQualifiedName: 'Finance.customer_account',
        id,
        label: id,
        name: 'customer_account',
      })
    ).toBe('customer_account');
    expect(
      resolveOntologyTermLabel({
        fullyQualifiedName: 'Finance."Customer.Account"',
        id,
        label: id,
        name: id,
      })
    ).toBe('Customer.Account');
  });

  it('computes scoped health without letting unrelated filters hide isolated terms', () => {
    const health = getOntologyHealthSummary(GRAPH, {
      ...FILTERS,
      glossaryIds: ['g1'],
      relationTypes: ['broader'],
      showIsolatedNodes: false,
    });

    expect(health.totalTermCount).toBe(4);
    expect(health.connectedTermCount).toBe(3);
    expect(health.connectedPercent).toBe(75);
    expect(health.isolatedTerms.map((term) => term.id)).toEqual(['d']);
  });

  it('flags every broader parent while retaining one deterministic tree depth', () => {
    const groups = buildOntologyTreeGroups(
      GRAPH,
      { ...FILTERS, glossaryIds: ['g1'] },
      GLOSSARIES,
      RELATION_TYPES
    );
    const child = groups[0].rows.find((row) => row.node.id === 'c');
    const detached = groups[0].rows.find((row) => row.node.id === 'd');

    expect(groups).toHaveLength(1);
    expect(groups[0].glossaryName).toBe('Finance');
    expect(child).toMatchObject({ depth: 1, parentCount: 2 });
    expect(detached).toMatchObject({ isIsolated: true, relationCount: 0 });
  });

  it('nests the part under the whole and counts an inverse pair once', () => {
    const graph: OntologyGraphData = {
      nodes: [
        {
          id: 'whole',
          label: 'Retention',
          type: 'glossaryTerm',
          glossaryId: 'g1',
        },
        {
          id: 'part',
          label: 'Churn Rate',
          type: 'glossaryTerm',
          glossaryId: 'g1',
        },
      ],
      edges: [
        {
          id: 'relation-1',
          from: 'part',
          to: 'whole',
          label: 'partOf',
          relationType: 'partOf',
        },
        {
          id: 'relation-1',
          from: 'whole',
          to: 'part',
          label: 'hasPart',
          relationType: 'hasPart',
        },
      ],
    };
    const [group] = buildOntologyTreeGroups(
      graph,
      { ...FILTERS, glossaryIds: ['g1'] },
      GLOSSARIES,
      [
        createRelationshipTypeMock({ name: 'partOf' }),
        createRelationshipTypeMock({ name: 'hasPart' }),
      ]
    );

    expect(group.rows.map((row) => row.node.id)).toEqual(['whole', 'part']);
    expect(group.rows[0]).toMatchObject({
      depth: 0,
      parentCount: 0,
      relationCount: 1,
    });
    expect(group.rows[1]).toMatchObject({
      depth: 1,
      parentCount: 1,
      relationCount: 1,
    });
  });

  it('lists every child directly under its own parent', () => {
    const term = (id: string, label: string) => ({
      id,
      label,
      type: 'glossaryTerm',
      glossaryId: 'g1',
    });
    const [group] = buildOntologyTreeGroups(
      {
        nodes: [
          term('retention', 'Retention'),
          term('churn', 'Churn'),
          term('voluntary', 'Voluntary Churn'),
          term('churnRate', 'Churn Rate'),
        ],
        edges: [
          parentOf('retention', 'churn'),
          parentOf('churn', 'voluntary'),
          parentOf('retention', 'churnRate'),
        ],
      },
      { ...FILTERS, glossaryIds: ['g1'] },
      GLOSSARIES,
      RELATION_TYPES
    );

    expect(group.rows.map((row) => [row.node.label, row.depth])).toEqual([
      ['Retention', 0],
      ['Churn', 1],
      ['Voluntary Churn', 2],
      ['Churn Rate', 1],
    ]);
  });

  it('starts a term whose parent is in another glossary at the root of its own glossary', () => {
    const term = (id: string, label: string, glossaryId: string) => ({
      id,
      label,
      type: 'glossaryTerm',
      glossaryId,
    });
    const groups = buildOntologyTreeGroups(
      {
        nodes: [
          term('revenue', 'Revenue', 'g1'),
          term('policy', 'Revenue Policy', 'g2'),
          term('rule', 'Recognition Rule', 'g2'),
        ],
        edges: [parentOf('revenue', 'policy'), parentOf('policy', 'rule')],
      },
      { ...FILTERS, glossaryIds: ['g1', 'g2'] },
      GLOSSARIES,
      RELATION_TYPES
    );
    const rowsOf = (glossaryName: string) =>
      groups
        .find((group) => group.glossaryName === glossaryName)
        ?.rows.map((row) => [row.node.label, row.depth]);

    expect(rowsOf('Finance')).toEqual([['Revenue', 0]]);
    expect(rowsOf('Compliance')).toEqual([
      ['Revenue Policy', 0],
      ['Recognition Rule', 1],
    ]);
  });

  it('nests depth-ordered rows back under their parents', () => {
    const row = (id: string, depth: number) => ({
      depth,
      isIsolated: false,
      node: { id, label: id, type: 'glossaryTerm' },
      parentCount: 0,
      relationCount: 1,
    });
    const tree = nestTreeRows([
      row('a', 0),
      row('b', 1),
      row('c', 2),
      row('d', 1),
      row('e', 0),
    ]);
    const shape = (items: typeof tree): unknown[] =>
      items.map((item) => [item.node.id, shape(item.children)]);

    expect(shape(tree)).toEqual([
      [
        'a',
        [
          ['b', [['c', []]]],
          ['d', []],
        ],
      ],
      ['e', []],
    ]);
  });

  it('keeps the real depth so a hierarchy deeper than the indent cap nests correctly', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `t${index}`);
    const [group] = buildOntologyTreeGroups(
      {
        nodes: ids.map((id) => ({
          id,
          label: id,
          type: 'glossaryTerm',
          glossaryId: 'g1',
        })),
        edges: ids.slice(1).map((id, index) => parentOf(ids[index], id)),
      },
      { ...FILTERS, glossaryIds: ['g1'] },
      GLOSSARIES,
      RELATION_TYPES
    );
    let item = nestTreeRows(group.rows)[0];
    const chain = [item.node.id];
    while (item.children.length > 0) {
      expect(item.children).toHaveLength(1);

      item = item.children[0];
      chain.push(item.node.id);
    }

    expect(group.rows[19].depth).toBe(19);
    expect(chain).toEqual(ids);
  });

  it('lists only metrics that measure a scoped term', () => {
    const metrics = buildOntologyTreeMetrics(
      {
        nodes: [
          { id: 'a', label: 'Revenue', type: 'glossaryTerm', glossaryId: 'g1' },
          { id: 'b', label: 'Policy', type: 'glossaryTerm', glossaryId: 'g2' },
          { id: 'm1', label: 'Net Revenue', type: 'metric' },
          { id: 'm2', label: 'Policy Count', type: 'metric' },
        ],
        edges: [
          {
            from: 'm1',
            to: 'a',
            label: 'Metric for',
            relationType: 'metricFor',
          },
          {
            from: 'm2',
            to: 'b',
            label: 'Metric for',
            relationType: 'metricFor',
          },
        ],
      },
      { ...FILTERS, glossaryIds: ['g1'] }
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0].node.id).toBe('m1');
    expect(metrics[0].measures.map((term) => term.id)).toEqual(['a']);
  });

  it('derives executable query suggestions from scoped ontology relations', () => {
    const suggestions = buildOntologyQuerySuggestions(
      GRAPH,
      ['g1'],
      RELATION_TYPES
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      label: 'Broader: Beta parent',
    });
    expect(suggestions[0].query).toContain(
      '<http://www.w3.org/2004/02/skos/core#broader>'
    );
    expect(suggestions[0].query).not.toContain('GRAPH');
    expect(suggestions[0].query).toContain('Finance.BetaParent');
    expect(suggestions[0].query).not.toContain('AntiMoneyLaundering');
  });
});

describe('native ontology placements', () => {
  const disclosure = { expanded: true, overrides: new Map<string, boolean>() };

  it('places a class and its descendants beneath each parent with stable path identities', () => {
    const graph = {
      nodes: [
        ...GRAPH.nodes,
        { id: 'leaf', label: 'Leaf', type: 'glossaryTerm', glossaryId: 'g1' },
      ],
      edges: [...GRAPH.edges, parentOf('c', 'leaf'), parentOf('a', 'c')],
    };
    const index = buildNativeTreeIndex(graph, FILTERS, []);
    const page = getNativeTreePage(index, disclosure);
    const children = page.placements.filter(({ node }) => node.id === 'c');

    expect(children.map(({ path }) => path)).toEqual([
      ['a', 'c'],
      ['b', 'c'],
    ]);
    expect(new Set(children.map(({ key }) => key)).size).toBe(2);
    expect(
      children.map(({ otherParents }) => otherParents.map(({ id }) => id))
    ).toEqual([['b'], ['a']]);
    expect(
      page.placements.filter(({ node }) => node.id === 'leaf')
    ).toHaveLength(2);
    expect(index.nodes.size).toBe(6);
    expect(index.health.totalTermCount).toBe(6);
    expect(
      getNativeTreePage(
        buildNativeTreeIndex(
          {
            nodes: [...graph.nodes].reverse(),
            edges: [...graph.edges].reverse(),
          },
          FILTERS,
          []
        ),
        disclosure
      ).placements.map(({ key }) => key)
    ).toEqual(page.placements.map(({ key }) => key));
  });

  it('keeps disclosure per placement and reveals a shortest path without unfolding the DAG', () => {
    const index = buildNativeTreeIndex(GRAPH, FILTERS, []);
    const a = getNativeTreePage(index, disclosure).placements.find(
      ({ node }) => node.id === 'a'
    );
    const page = getNativeTreePage(index, {
      expanded: true,
      overrides: new Map([[a?.key ?? '', false]]),
    });

    expect(
      page.placements
        .filter(({ node }) => node.id === 'c')
        .map(({ path }) => path)
    ).toEqual([['b', 'c']]);
    expect(findNativeTreePath(index, 'c')).toEqual(['a', 'c']);
    expect(findNativeTreePath(index, 'missing')).toBeUndefined();
    expect(
      getNativeTreePage(
        index,
        disclosure,
        nativeTreeCursorForPath(index, ['b', 'c'])
      ).placements[0].path
    ).toEqual(['b', 'c']);
  });

  it('ends ancestor cycles and includes every disconnected rootless component', () => {
    const ids = ['a', 'b', 'c', 'd', 'self'];
    const index = buildNativeTreeIndex(
      {
        nodes: ids.map((id) => ({
          id,
          label: id,
          type: 'glossaryTerm',
          glossaryId: 'g1',
        })),
        edges: [
          parentOf('a', 'b'),
          parentOf('b', 'a'),
          parentOf('c', 'd'),
          parentOf('d', 'c'),
          parentOf('self', 'self'),
        ],
      },
      FILTERS,
      []
    );
    const page = getNativeTreePage(index, disclosure);

    expect(new Set(page.placements.map(({ node }) => node.id))).toEqual(
      new Set(ids)
    );
    expect(page.placements).toHaveLength(5);
    expect(
      page.placements.every(({ path }) => path.length === new Set(path).size)
    ).toBe(true);
  });

  it('walks bounded windows forward and backward through a layered diamond', () => {
    const nodes = Array.from({ length: 24 }, (_, n) => ({
      id: String(n),
      label: String(n).padStart(2, '0'),
      type: 'glossaryTerm',
      glossaryId: 'g1',
    }));
    const edges = nodes
      .slice(2)
      .flatMap((node, n) => [
        parentOf(String(Math.floor(n / 2) * 2), node.id),
        parentOf(String(Math.floor(n / 2) * 2 + 1), node.id),
      ]);
    const index = buildNativeTreeIndex({ nodes, edges }, FILTERS, []);
    const first = getNativeTreePage(index, disclosure);

    expect(first.placements).toHaveLength(2048);
    expect(first.previous).toBeUndefined();
    expect(first.next).toBeDefined();

    const next = getNativeTreePage(index, disclosure, first.next);

    expect(next.placements).toHaveLength(2048);
    expect(
      new Set([...first.placements, ...next.placements].map(({ key }) => key))
        .size
    ).toBe(4096);

    const back = getNativeTreePage(
      index,
      disclosure,
      next.previous,
      'backward'
    );

    expect(back.placements.map(({ key }) => key)).toEqual(
      first.placements.map(({ key }) => key)
    );

    const seek = nativeTreeCursorForPath(
      index,
      findNativeTreePath(index, '23') ?? []
    );

    expect(
      getNativeTreePage(index, disclosure, seek).placements[0].node.id
    ).toBe('23');
  });

  it('keeps owner boundaries and treats an inverse edge as the same parent edge', () => {
    const index = buildNativeTreeIndex(
      {
        ...GRAPH,
        edges: [
          ...GRAPH.edges,
          parentOf('a', 'e'),
          { ...parentOf('c', 'a'), relationType: 'isA' },
        ],
      },
      FILTERS,
      []
    );

    expect(index.parents.get('c')).toEqual(['a', 'b']);
    expect(index.parents.get('e')).toEqual([]);
    expect(index.roots).toContain('e');
    expect(buildNativeTreeIndex(null, FILTERS, []).nodes.size).toBe(0);
  });

  it('indexes a deep hierarchy iteratively and finds its shortest reveal path', () => {
    const nodes = Array.from({ length: 8000 }, (_, n) => ({
      id: String(n),
      label: String(n),
      type: 'glossaryTerm',
      glossaryId: 'g1',
    }));
    const index = buildNativeTreeIndex(
      {
        nodes,
        edges: nodes.slice(1).map((node, i) => parentOf(String(i), node.id)),
      },
      FILTERS,
      []
    );

    expect(index.nodes.size).toBe(8000);
    expect(findNativeTreePath(index, '7999')).toHaveLength(8000);
    expect(
      getNativeTreePage(index, {
        expanded: false,
        overrides: new Map(),
      }).placements.map(({ node }) => node.id)
    ).toEqual(['0']);
  });
});
