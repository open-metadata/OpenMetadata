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
  GraphData,
  GraphNode,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import {
  annotateGraphCoverage,
  buildGraphPresentation,
  filterGraphPresentation,
  getGroupMemberLabelKey,
  getMappingCoverage,
  getSharedMemberType,
  restrictToEntityLevel,
} from './knowledgeGraphPresentation.utils';

const requirePresentation = (node?: GraphNode) => {
  if (!node?.presentation) {
    throw new Error('Expected a positioned graph node');
  }

  return node.presentation;
};

const edge = (from: string, to: string, relationType: string) => ({
  from,
  to,
  label: relationType,
  relationType,
});

const graph: GraphData = {
  nodes: [
    { id: 'root', label: 'Customers', type: 'table' },
    ...Array.from({ length: 300 }, (_, i) => ({
      id: 'c' + i,
      label: 'column_' + i,
      type: 'column',
    })),
    { id: 'term', label: 'Customer', type: 'glossaryTerm' },
  ],
  edges: [
    ...Array.from({ length: 300 }, (_, i) => ({
      from: 'root',
      to: 'c' + i,
      label: 'Has column',
      relationType: 'om:hasColumn',
    })),
    {
      from: 'c0',
      to: 'term',
      label: 'Has glossary term',
      relationType: 'om:hasGlossaryTerm',
    },
    {
      from: 'c1',
      to: 'c0',
      label: 'Derived from',
      relationType: 'prov:wasDerivedFrom',
    },
  ],
};

it('bundles repeated statements without losing any original relationship or cross-link', () => {
  const scene = buildGraphPresentation(graph, graph, 'root', 'balanced', []);
  const group = scene.data.nodes.find((n) => n.presentation?.members);

  expect(group?.presentation?.members).toHaveLength(300);
  expect(scene.data.nodes).toHaveLength(3);
  expect(scene.data.edges.flatMap((e) => e.members ?? [e])).toHaveLength(302);
  expect(
    scene.data.edges.some((e) => e.relationType === 'prov:wasDerivedFrom')
  ).toBe(true);
  expect(
    scene.data.edges.some((e) => e.relationType === 'om:hasGlossaryTerm')
  ).toBe(true);
});

it('keeps the group and surrounding graph in place while revealing real members', () => {
  const bundled = buildGraphPresentation(graph, graph, 'root', 'balanced', []);
  const group = bundled.data.nodes.find((n) => n.presentation?.members);
  if (!group) {
    throw new Error('Expected columns group');
  }
  const expanded = buildGraphPresentation(graph, graph, 'root', 'balanced', [
    group.id,
  ]);

  expect(
    expanded.data.nodes.find((n) => n.id === group.id)?.presentation?.expanded
  ).toBe(true);
  expect(
    expanded.data.nodes.filter((n) => n.presentation?.groupId === group.id)
  ).toHaveLength(6);

  bundled.data.nodes.forEach((node) =>
    expect(
      expanded.data.nodes.find((n) => n.id === node.id)?.presentation?.position
    ).toEqual(node.presentation?.position)
  );

  expect(
    expanded.data.edges
      .filter((edge) => !edge.presentationOnly)
      .flatMap((edge) => edge.members ?? [edge])
  ).toHaveLength(302);

  const all = buildGraphPresentation(graph, graph, 'root', 'all', []);

  expect(all.data.nodes).toHaveLength(302);
});

it('keeps extended nodes in their original lane when filtering removes connecting nodes', () => {
  const full = buildGraphPresentation(graph, graph, 'root', 'all', []);
  const filtered = buildGraphPresentation(
    {
      nodes: graph.nodes.filter((n) => n.id === 'root' || n.id === 'term'),
      edges: [],
    },
    graph,
    'root',
    'all',
    []
  );

  expect(
    filtered.data.nodes.find((n) => n.id === 'term')?.presentation
  ).toEqual(full.data.nodes.find((n) => n.id === 'term')?.presentation);
  expect(
    filtered.data.nodes.find((n) => n.id === 'term')?.presentation?.level
  ).toBe(3);
});

it('preserves direction and distinct predicates and uses deterministic positions', () => {
  const data: GraphData = {
    nodes: graph.nodes.slice(0, 2),
    edges: [
      { from: 'root', to: 'c0', label: 'Owns', relationType: 'om:owns' },
      { from: 'root', to: 'c0', label: 'Custom', relationType: 'ex:custom' },
      {
        from: 'c0',
        to: 'root',
        label: 'References',
        relationType: 'ex:references',
      },
      { from: 'root', to: 'root', label: 'Self', relationType: 'ex:self' },
    ],
  };
  const scene = buildGraphPresentation(data, data, 'root', 'balanced', []);

  expect(scene.data.edges).toHaveLength(4);
  expect(scene.data.edges.map((e) => [e.from, e.to, e.relationType])).toEqual(
    data.edges.map((e) => [e.from, e.to, e.relationType])
  );

  const reverse = {
    nodes: [...data.nodes].reverse(),
    edges: [...data.edges].reverse(),
  };

  expect(
    buildGraphPresentation(reverse, reverse, 'root', 'balanced', []).data.nodes
  ).toEqual(scene.data.nodes);
});

it('does not rearrange direct connections when an extended level arrives', () => {
  const direct = {
    nodes: graph.nodes.filter((n) => n.id !== 'term'),
    edges: graph.edges.filter((e) => e.to !== 'term'),
  };
  const before = buildGraphPresentation(
    direct,
    direct,
    'root',
    'balanced',
    []
  ).data;
  const after = buildGraphPresentation(
    graph,
    graph,
    'root',
    'balanced',
    []
  ).data;
  before.nodes.forEach((n) =>
    expect(
      after.nodes.find((a) => a.id === n.id)?.presentation?.position
    ).toEqual(n.presentation?.position)
  );
});

it('reports missing mappings only within a complete returned neighborhood', () => {
  const coverage = getMappingCoverage(graph);

  expect(coverage.get('c0')).toBe('mapped');
  expect(coverage.get('c2')).toBe('unmapped');
  expect(getMappingCoverage({ ...graph, truncated: true }).get('c2')).toBe(
    'unknown'
  );
  expect(
    getMappingCoverage({
      nodes: graph.nodes,
      edges: [
        { from: 'c2', to: 'root', label: 'Has tag', relationType: 'om:hasTag' },
      ],
    }).get('c2')
  ).toBe('unmapped');
});

it('filters confirmed gaps while retaining the selected entity and metadata context', () => {
  const data: GraphData = {
    ...graph,
    nodes: [...graph.nodes, { id: 'owner', label: 'Steward', type: 'user' }],
    edges: [...graph.edges, { from: 'root', to: 'owner', label: 'Owned by' }],
  };
  const coverage = getMappingCoverage(
    data,
    new Set([
      'root',
      ...graph.nodes
        .filter((node) => node.type === 'column')
        .map((node) => node.id),
    ])
  );
  const result = filterGraphPresentation(
    data,
    'root',
    [],
    coverage,
    'unmapped'
  );

  expect(result?.nodes.some((node) => node.id === 'root')).toBe(true);
  expect(result?.nodes.some((node) => node.id === 'owner')).toBe(true);
  expect(result?.nodes.some((node) => node.id === 'c0')).toBe(false);
  expect(result?.nodes.filter((node) => node.type === 'column')).toHaveLength(
    299
  );
  expect(
    result?.edges.every(
      (edge) =>
        result.nodes.some((node) => node.id === edge.from) &&
        result.nodes.some((node) => node.id === edge.to)
    )
  ).toBe(true);
});

it('highlights gaps within a group without changing positions or losing statements', () => {
  const grouped = buildGraphPresentation(graph, graph, 'root', 'balanced', []);
  const annotated = annotateGraphCoverage(
    grouped.data,
    getMappingCoverage(graph),
    'root',
    true
  );

  expect(
    annotated.nodes.find((node) => node.presentation?.members)?.presentation
      ?.coverage
  ).toBe('unmapped');
  expect(annotated.nodes.map((node) => node.presentation?.position)).toEqual(
    grouped.data.nodes.map((node) => node.presentation?.position)
  );
  expect(annotated.edges).toBe(grouped.data.edges);
  expect(
    annotated.edges
      .flatMap((edge) => edge.members ?? [edge])
      .every((edge) => edge.id)
  ).toBe(true);
});

it('bundles columns around a collapsed parent branch and prefers containment over shared mappings', () => {
  const data: GraphData = {
    nodes: [
      { id: 'root', label: 'Customers', type: 'table' },
      { id: 'a-term', label: 'Customer', type: 'glossaryTerm' },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `t${i}`,
        label: `Table ${i}`,
        type: 'table',
      })),
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `c${i}`,
        label: `Column ${i}`,
        type: 'column',
      })),
    ],
    edges: [
      {
        from: 'root',
        to: 'a-term',
        label: 'Has glossary term',
        relationType: 'hasGlossaryTerm',
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        from: 'root',
        to: `t${i}`,
        label: 'Downstream',
        relationType: 'downstream',
      })),
      ...Array.from({ length: 9 }, (_, i) => ({
        from: `t${Math.floor(i / 3)}`,
        to: `c${i}`,
        label: 'Has column',
        relationType: 'hasColumn',
      })),
      ...Array.from({ length: 9 }, (_, i) => ({
        from: `c${i}`,
        to: 'a-term',
        label: 'Has glossary term',
        relationType: 'hasGlossaryTerm',
      })),
    ],
  };
  const scene = buildGraphPresentation(data, data, 'root', 'balanced', []).data;
  const tables = scene.nodes.find(
    (n) => n.type === 'table' && n.presentation?.members
  );
  const columns = scene.nodes.filter((n) => n.type === 'column');

  expect(columns).toHaveLength(1);
  expect(columns[0].presentation?.members).toHaveLength(9);
  expect(columns[0].presentation?.predicate).toBe('Has column');
  expect(
    scene.edges.find((e) => e.from === tables?.id && e.to === columns[0].id)
      ?.members
  ).toHaveLength(9);
  expect(scene.edges.flatMap((e) => e.members ?? [e])).toHaveLength(
    data.edges.length
  );

  const expanded = buildGraphPresentation(data, data, 'root', 'balanced', [
    tables?.id ?? '',
  ]).data;

  expect(expanded.nodes.filter((n) => n.type === 'column')).toHaveLength(1);
  expect(expanded.nodes.some((n) => n.id === tables?.id)).toBe(true);
  expect(
    expanded.edges.find(
      (edge) => edge.from === tables?.id && edge.to === columns[0].id
    )?.members
  ).toHaveLength(9);
  expect(
    expanded.edges
      .filter((edge) => !edge.presentationOnly)
      .flatMap((e) => e.members ?? [e])
  ).toHaveLength(data.edges.length);
});

it('keeps tier separate from tags and places metadata groups like the approved design', () => {
  const types = ['tag', 'user', 'column', 'query', 'table'];
  const data: GraphData = {
    nodes: [
      { id: 'root', label: 'Customers', type: 'table' },
      {
        id: 'tier',
        label: 'Tier 1',
        type: 'tag',
        fullyQualifiedName: 'Tier.Tier1',
      },
      { id: 'domain', label: 'Marketing', type: 'domain' },
      { id: 'concept', label: 'Customer', type: 'glossaryTerm' },
      ...types.flatMap((type) =>
        Array.from({ length: 3 }, (_, i) => ({
          id: `${type}${i}`,
          label: `${type} ${i}`,
          type,
        }))
      ),
    ],
    edges: [
      ...types.flatMap((type, index) =>
        Array.from({ length: 3 }, (_, i) => ({
          from: 'root',
          to: `${type}${i}`,
          label: [
            'Has tag',
            'Has follower',
            'Has column',
            'Mentioned in',
            'Downstream',
          ][index],
          relationType: [
            'hasTag',
            'hasFollower',
            'hasColumn',
            'mentionedIn',
            'downstream',
          ][index],
        }))
      ),
      { from: 'root', to: 'tier', label: 'Has tag', relationType: 'hasTag' },
      { from: 'root', to: 'tier', label: 'Has tier', relationType: 'hasTier' },
      {
        from: 'root',
        to: 'domain',
        label: 'In domain',
        relationType: 'domains',
      },
      { from: 'domain', to: 'root', label: 'Has', relationType: 'has' },
      {
        from: 'root',
        to: 'concept',
        label: 'Has glossary term',
        relationType: 'hasGlossaryTerm',
      },
      {
        from: 'concept',
        to: 'root',
        label: 'Mapped to',
        relationType: 'mappedTo',
      },
    ],
  };
  const scene = buildGraphPresentation(data, data, 'root', 'balanced', []).data;
  const find = (type: string) =>
    scene.nodes.find((n) => n.type === type && n.presentation?.members);

  expect(scene.nodes.some((n) => n.id === 'tier')).toBe(true);
  expect(find('tag')?.presentation?.members).toHaveLength(3);
  expect(find('tag')?.presentation?.position.y).toBeLessThan(0);

  const bottom = ['user', 'column', 'query'].map(
    (type) => requirePresentation(find(type)).position
  );

  expect(new Set(bottom.map((p) => p.y)).size).toBe(1);
  expect(bottom[0].x).toBeLessThan(bottom[1].x);
  expect(bottom[1].x).toBeLessThan(bottom[2].x);
  expect(find('table')?.presentation?.position.x).toBeGreaterThan(bottom[2].x);
  expect(
    scene.nodes.find((n) => n.id === 'domain')?.presentation?.position.x
  ).toBeGreaterThan(0);
  expect(
    scene.nodes.find((n) => n.id === 'concept')?.presentation?.position.x
  ).toBeGreaterThan(0);
});

it('reveals a searched member outside the preview without expanding hundreds of cards', () => {
  const grouped = buildGraphPresentation(
    graph,
    graph,
    'root',
    'balanced',
    []
  ).data;
  const group = grouped.nodes.find((node) => node.presentation?.members);
  const expanded = buildGraphPresentation(
    graph,
    graph,
    'root',
    'balanced',
    [group?.id ?? ''],
    'c299'
  ).data;

  expect(expanded.nodes.some((node) => node.id === 'c299')).toBe(true);
  expect(
    expanded.nodes.filter((node) => node.presentation?.groupId === group?.id)
  ).toHaveLength(6);
  expect(
    expanded.edges
      .filter((edge) => !edge.presentationOnly)
      .flatMap((edge) => edge.members ?? [edge])
  ).toHaveLength(302);
});

it('groups a shared relationship even when members have different structural parents', () => {
  const data: GraphData = {
    nodes: [
      { id: 'root', label: 'Customers', type: 'table' },
      { id: 'owner', label: 'Analytics', type: 'team' },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `schema${i}`,
        label: `Schema ${i}`,
        type: 'databaseSchema',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `table${i}`,
        label: `Table ${i}`,
        type: 'table',
      })),
    ],
    edges: [
      {
        from: 'root',
        to: 'owner',
        label: 'Has owner',
        relationType: 'hasOwner',
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        from: 'root',
        to: `schema${i}`,
        label: `Context ${i}`,
        relationType: `context${i}`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        from: `table${i}`,
        to: `schema${i}`,
        label: 'Belongs to schema',
        relationType: 'belongsToSchema',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        from: `table${i}`,
        to: 'owner',
        label: 'Has owner',
        relationType: 'hasOwner',
      })),
    ],
  };
  const scene = buildGraphPresentation(data, data, 'root', 'balanced', []).data;
  const group = scene.nodes.find((node) => node.presentation?.members);

  expect(group?.presentation?.members).toHaveLength(3);
  expect(group?.presentation?.predicate).toBe('Has owner');
  expect(scene.edges.flatMap((edge) => edge.members ?? [edge])).toHaveLength(
    10
  );
});

describe('restrictToEntityLevel', () => {
  const profile: GraphData = {
    nodes: [
      { id: 'root', label: 'Customers', type: 'table' },
      { id: 'team', label: 'Analytics', type: 'team' },
      { id: 'schema', label: 'sales', type: 'databaseSchema' },
      { id: 'tag', label: 'PII', type: 'tag' },
      { id: 'column', label: 'email', type: 'column' },
      { id: 'domain', label: 'Marketing', type: 'domain' },
      { id: 'downstream', label: 'customer_mart', type: 'table' },
      { id: 'term', label: 'Customer', type: 'glossaryTerm' },
      { id: 'tagTerm', label: 'Personal data', type: 'glossaryTerm' },
      { id: 'follower', label: 'Alex', type: 'user' },
      { id: 'suite', label: 'Checks', type: 'testSuite' },
    ],
    edges: [
      edge('root', 'team', 'hasOwner'),
      edge('root', 'schema', 'belongsToSchema'),
      edge('schema', 'root', 'contains'),
      edge('root', 'tag', 'hasTag'),
      edge('root', 'column', 'hasColumn'),
      edge('domain', 'root', 'has'),
      edge('root', 'downstream', 'downstream'),
      edge('root', 'term', 'hasGlossaryTerm'),
      edge('root', 'tagTerm', 'hasTag'),
      edge('root', 'follower', 'hasFollower'),
      edge('root', 'suite', 'contains'),
      edge('schema', 'downstream', 'contains'),
    ],
  };

  it('keeps the ownership, structure and governance profile of the entity only', () => {
    const scoped = restrictToEntityLevel(profile, 'root', 'knowledge-graph');

    expect(scoped?.edges.map((item) => [item.from, item.to])).toEqual([
      ['root', 'team'],
      ['root', 'schema'],
      ['schema', 'root'],
      ['root', 'tag'],
      ['root', 'column'],
      ['domain', 'root'],
    ]);
    expect(scoped?.nodes.map((node) => node.id)).toEqual([
      'root',
      'team',
      'schema',
      'tag',
      'column',
      'domain',
    ]);
  });

  it('leaves business concepts to level 2 even when they arrive as tags', () => {
    const scoped = restrictToEntityLevel(profile, 'root', 'knowledge-graph');

    expect(scoped?.nodes.some((node) => node.type === 'glossaryTerm')).toBe(
      false
    );
  });

  it('shows a concept with its mapped assets and declared properties in the ontology', () => {
    const ontology: GraphData = {
      nodes: [
        { id: 'concept', label: 'Customer', type: 'glossaryTerm' },
        { id: 'party', label: 'Party', type: 'glossaryTerm' },
        { id: 'asset', label: 'customers', type: 'table' },
        { id: 'property', label: 'customerId', type: 'property' },
      ],
      edges: [
        edge('concept', 'party', 'broader'),
        edge('asset', 'concept', 'mappedTo'),
        { ...edge('property', 'concept', 'domain'), category: 'structure' },
        edge('party', 'asset', 'mappedTo'),
      ],
    };

    const scoped = restrictToEntityLevel(ontology, 'concept', 'ontology');

    expect(scoped?.edges.map((item) => item.from)).toEqual([
      'asset',
      'property',
    ]);
    expect(scoped?.nodes.map((node) => node.id)).toEqual([
      'concept',
      'asset',
      'property',
    ]);
  });

  it('passes an absent graph through', () => {
    expect(restrictToEntityLevel(null, 'root', 'knowledge-graph')).toBeNull();
  });
});

describe('concept docking', () => {
  const ontology: GraphData = {
    nodes: [
      { id: 'concept', label: 'Customer', type: 'glossaryTerm' },
      { id: 'party', label: 'Party', type: 'glossaryTerm' },
      { id: 'asset', label: 'customers', type: 'table' },
      { id: 'property', label: 'customerId', type: 'property' },
    ],
    edges: [
      edge('concept', 'party', 'broader'),
      edge('asset', 'concept', 'mappedTo'),
      { ...edge('property', 'concept', 'domain'), category: 'structure' },
    ],
  };

  it("docks a concept's mapped assets above it and its properties below it", () => {
    const scene = buildGraphPresentation(
      ontology,
      ontology,
      'concept',
      'balanced',
      []
    );
    const side = (id: string) =>
      requirePresentation(scene.data.nodes.find((node) => node.id === id)).side;

    expect(side('asset')).toBe('top');
    expect(side('property')).toBe('bottom');
    expect(['left', 'right']).toContain(side('party'));
  });

  it('keeps single tags and columns in the lanes of an asset', () => {
    const asset: GraphData = {
      nodes: [
        { id: 'root', label: 'orders', type: 'table' },
        { id: 'tag', label: 'PII', type: 'tag' },
        { id: 'term', label: 'Order', type: 'glossaryTerm' },
      ],
      edges: [
        edge('root', 'tag', 'hasTag'),
        edge('root', 'term', 'hasGlossaryTerm'),
      ],
    };
    const scene = buildGraphPresentation(asset, asset, 'root', 'balanced', []);
    const side = (id: string) =>
      requirePresentation(scene.data.nodes.find((node) => node.id === id)).side;

    expect(side('tag')).toBe('right');
    expect(side('term')).toBe('right');
  });
});

describe('relationship bundling', () => {
  const asset: GraphNode = { id: 'root', label: 'customers', type: 'table' };
  const scenefor = (data: GraphData, rootId = 'root') =>
    buildGraphPresentation(data, data, rootId, 'balanced', []).data;
  const bundleOf = (scene: GraphData) => {
    const group = scene.nodes.find((node) => node.presentation?.members);

    return { group, members: requirePresentation(group).members ?? [] };
  };

  it('bundles a repeated concept fan instead of stacking one label per term', () => {
    const terms = Array.from({ length: 5 }, (_, index) => ({
      id: 'term' + index,
      label: 'Term ' + index,
      type: 'glossaryTerm',
    }));
    const data: GraphData = {
      nodes: [asset, ...terms],
      edges: terms.flatMap((term) => [
        {
          from: 'root',
          to: term.id,
          label: 'Has glossary term',
          relationType: 'hasGlossaryTerm',
        },
        { from: 'root', to: term.id, label: 'Has tag', relationType: 'hasTag' },
      ]),
    };
    const scene = scenefor(data);
    const { group, members } = bundleOf(scene);

    expect(members).toHaveLength(5);
    expect(group?.type).toBe('glossaryTerm');
    expect(getSharedMemberType(members)).toBe('glossaryTerm');
    expect(getGroupMemberLabelKey(members, group?.type ?? '')).toBe(
      'label.glossary-term-plural'
    );
    expect(scene.nodes).toHaveLength(2);
    expect(
      scene.edges.map((item) => [item.label, item.members?.length])
    ).toEqual([
      ['Has glossary term', 5],
      ['Has tag', 5],
    ]);
    expect(scene.edges.flatMap((item) => item.members ?? [item])).toHaveLength(
      10
    );
  });

  it('keeps neighbouring concepts individual around a concept root', () => {
    const concepts = Array.from({ length: 5 }, (_, index) => ({
      id: 'concept' + index,
      label: 'Concept ' + index,
      type: 'glossaryTerm',
    }));
    const data: GraphData = {
      nodes: [
        { id: 'root', label: 'Customer', type: 'glossaryTerm' },
        ...concepts,
      ],
      edges: concepts.map((concept) => edge('root', concept.id, 'isRelatedTo')),
    };
    const scene = scenefor(data);

    expect(scene.nodes.filter((node) => node.presentation?.members)).toEqual(
      []
    );
    expect(scene.nodes).toHaveLength(6);
    expect(scene.edges).toHaveLength(5);
  });

  it('bundles a pair of owners that arrive as a user and a team', () => {
    const data: GraphData = {
      nodes: [
        asset,
        { id: 'finance', label: 'Finance', type: 'team' },
        { id: 'pere', label: 'Pere Miquel Brull', type: 'user' },
      ],
      edges: [
        { from: 'finance', to: 'root', label: 'Owns', relationType: 'owns' },
        { from: 'pere', to: 'root', label: 'Owns', relationType: 'owns' },
      ],
    };
    const scene = scenefor(data);
    const { group, members } = bundleOf(scene);

    expect(members.map((member) => member.label)).toEqual([
      'Finance',
      'Pere Miquel Brull',
    ]);
    expect(getSharedMemberType(members)).toBeUndefined();
    expect(getGroupMemberLabelKey(members, group?.type ?? '')).toBe(
      'label.people'
    );
    expect(
      scene.edges.map((item) => [item.label, item.members?.length])
    ).toEqual([['Owns', 2]]);
  });

  it('names a lineage bundle after its family when it mixes asset types', () => {
    const data: GraphData = {
      nodes: [
        asset,
        { id: 'accounts', label: 'AccountsModel', type: 'dashboardDataModel' },
        { id: 'sales', label: 'sales_datamart', type: 'dashboardDataModel' },
        { id: 'view', label: 'new_view', type: 'table' },
      ],
      edges: ['accounts', 'sales', 'view'].map((id) => ({
        from: 'root',
        to: id,
        label: 'Downstream',
        relationType: 'downstream',
      })),
    };
    const scene = scenefor(data);
    const { group, members } = bundleOf(scene);

    expect(members).toHaveLength(3);
    expect(group?.type).toBe('dashboardDataModel');
    expect(getSharedMemberType(members)).toBeUndefined();
    expect(getGroupMemberLabelKey(members, group?.type ?? '')).toBe(
      'label.data-asset-plural'
    );
    expect(
      scene.edges.map((item) => [item.label, item.members?.length])
    ).toEqual([['Downstream', 3]]);
  });

  it('bundles a pair of tags while tier keeps its own card', () => {
    const data: GraphData = {
      nodes: [
        asset,
        { id: 'person', label: 'Person', type: 'tag' },
        { id: 'channels', label: 'Channels', type: 'tag' },
        { id: 'tier', label: 'Tier4', type: 'tag' },
      ],
      edges: [
        ...['person', 'channels', 'tier'].map((id) => ({
          from: 'root',
          to: id,
          label: 'Has tag',
          relationType: 'hasTag',
        })),
        {
          from: 'root',
          to: 'tier',
          label: 'Has tier',
          relationType: 'hasTier',
        },
      ],
    };
    const scene = scenefor(data);
    const { members } = bundleOf(scene);

    expect(members.map((member) => member.label)).toEqual([
      'Channels',
      'Person',
    ]);
    expect(scene.nodes.some((node) => node.id === 'tier')).toBe(true);
    expect(
      scene.edges.map((item) => [item.label, (item.members ?? [item]).length])
    ).toEqual([
      ['Has tag', 2],
      ['Has tag', 1],
      ['Has tier', 1],
    ]);
  });

  it('never bundles neighbours of unrelated families reached by one predicate', () => {
    const data: GraphData = {
      nodes: [
        asset,
        { id: 'contract', label: 'Customers DC', type: 'dataContract' },
        { id: 'suite', label: 'Quality checks', type: 'testSuite' },
      ],
      edges: ['contract', 'suite'].map((id) => edge('root', id, 'contains')),
    };
    const scene = scenefor(data);

    expect(scene.nodes.filter((node) => node.presentation?.members)).toEqual(
      []
    );
    expect(scene.nodes).toHaveLength(3);
  });
});

/**
 * Every entity type the RDF graph endpoint can return as a neighbour. A bundle
 * of them is a count plus a noun, so the noun has to be plural —
 * `getPluralizeEntityName` answers with the singular for most of these, which
 * is why bundles resolve their own label first.
 */
describe('bundle naming across the returned entity types', () => {
  const graphTypes = [
    'table',
    'column',
    'dashboard',
    'dashboardDataModel',
    'chart',
    'pipeline',
    'topic',
    'container',
    'searchIndex',
    'mlmodel',
    'apiEndpoint',
    'apiCollection',
    'metric',
    'storedProcedure',
    'spreadsheet',
    'worksheet',
    'directory',
    'file',
    'database',
    'databaseSchema',
    'databaseService',
    'dashboardService',
    'messagingService',
    'pipelineService',
    'storageService',
    'mlmodelService',
    'metadataService',
    'searchService',
    'apiService',
    'driveService',
    'user',
    'team',
    'role',
    'policy',
    'persona',
    'bot',
    'domain',
    'dataProduct',
    'dataContract',
    'tag',
    'classification',
    'certification',
    'glossaryTerm',
    'glossary',
    'term',
    'concept',
    'property',
    'testCase',
    'testSuite',
    'testDefinition',
    'task',
    'query',
    'page',
    'document',
    'contextMemory',
  ];

  it.each(graphTypes)('names a bundle of %s in the plural', (type) => {
    const members = [
      { id: 'a', label: 'a', type },
      { id: 'b', label: 'b', type },
    ];

    expect(getGroupMemberLabelKey(members, type)).toMatch(/-plural$/);
  });
});

it('puts a person who both owns and follows the entity on the ownership bundle', () => {
  const followers = ['Ram', 'admin', 'Karthick Sharan', 'harsha'];
  const data: GraphData = {
    nodes: [
      { id: 'root', label: 'customers', type: 'table' },
      ...[...followers, 'Pere Miquel Brull'].map((label) => ({
        id: 'user:' + label,
        label,
        type: 'user',
      })),
      { id: 'team:Finance', label: 'Finance', type: 'team' },
    ],
    edges: [
      ...followers.flatMap((label) => [
        {
          from: 'root',
          to: 'user:' + label,
          label: 'Has follower',
          relationType: 'hasFollower',
        },
        {
          from: 'user:' + label,
          to: 'root',
          label: 'Follows',
          relationType: 'follows',
        },
      ]),
      ...['team:Finance', 'user:Pere Miquel Brull', 'user:Karthick Sharan'].map(
        (from) => ({ from, to: 'root', label: 'Owns', relationType: 'owns' })
      ),
    ],
  };
  const scene = buildGraphPresentation(data, data, 'root', 'balanced', []).data;
  const bundle = (predicate: string) =>
    scene.nodes
      .find((node) => node.presentation?.predicate === predicate)
      ?.presentation?.members?.map((member) => member.label);

  expect(bundle('Owns')).toEqual([
    'Finance',
    'Karthick Sharan',
    'Pere Miquel Brull',
  ]);
  expect(bundle('Follows')).not.toContain('Karthick Sharan');
  expect(scene.edges.flatMap((edge) => edge.members ?? [edge])).toHaveLength(
    data.edges.length
  );
});
