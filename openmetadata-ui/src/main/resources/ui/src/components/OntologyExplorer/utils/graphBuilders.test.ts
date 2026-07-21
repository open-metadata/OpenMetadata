/*
 *  Copyright 2025 Collate.
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
import type { TFunction } from 'i18next';
import { OntologyStudioDataGraph } from '../../../generated/api/data/ontologyStudioDataGraph';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityStatus, Provenance } from '../../../generated/type/termRelation';
import { GraphData } from '../../../rest/rdfAPI.interface';
import {
  ASSET_BINDING_EDGE_KIND,
  ASSET_RELATION_TYPE,
  buildGraphFromAllTerms,
  buildGraphFromStudioData,
  convertRdfGraphToOntologyGraph,
  projectOntologyRelationsToAssets,
  SEMANTIC_PROJECTION_EDGE_KIND,
} from './graphBuilders';

const tStub = ((key: string) => key) as unknown as TFunction;

const glossaries: Glossary[] = [
  {
    id: 'gloss-finance-id',
    name: 'Finance',
    fullyQualifiedName: 'Finance',
    description: 'd',
  } as Glossary,
  {
    id: 'gloss-renamed-id',
    name: 'NewName',
    // The RDF response carries the OLD FQN of a renamed glossary in
    // node.fullyQualifiedName until the RDF projection catches up. The
    // FQN-prefix heuristic would resolve "OldName" → undefined, but the
    // explicit glossaryId on the node should still bind correctly.
    fullyQualifiedName: 'NewName',
    description: 'd',
  } as Glossary,
];

describe('buildGraphFromStudioData', () => {
  it('maps bounded clusters into terms, detailed assets, and binding edges', () => {
    const result = buildGraphFromStudioData(
      {
        clusters: [
          {
            assetCount: 11,
            assets: [
              {
                columnCount: 7,
                entity: {
                  displayName: 'Transactions',
                  fullyQualifiedName: 'warehouse.finance.transactions',
                  id: 'asset-1',
                  type: 'table',
                },
                serviceType: 'Snowflake',
              },
            ],
            term: {
              displayName: 'Primary Cluster',
              fullyQualifiedName: 'Finance.PrimaryCluster',
              id: 'term-1',
              name: 'PrimaryCluster',
            },
          },
        ],
        edges: [],
        paging: { total: 1 },
      } as OntologyStudioDataGraph,
      glossaries,
      tStub
    );

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetCount: 11,
          glossaryId: 'gloss-finance-id',
          id: 'term-1',
          loadedAssetCount: 1,
        }),
        expect.objectContaining({
          columnCount: 7,
          id: 'asset-1',
          serviceLabel: 'Snowflake',
          type: 'dataAsset',
        }),
      ])
    );
    expect(result.edges).toContainEqual({
      edgeKind: ASSET_BINDING_EDGE_KIND,
      from: 'asset-1',
      label: 'label.tagged-with',
      relationType: ASSET_RELATION_TYPE,
      to: 'term-1',
    });
  });
});

describe('convertRdfGraphToOntologyGraph', () => {
  it('prefers the explicit glossaryId from the response over FQN heuristic', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          glossaryId: 'gloss-renamed-id',
          // Drift: old FQN no longer matches the renamed glossary; the
          // explicit glossaryId on the node MUST win.
          fullyQualifiedName: 'OldName.Revenue',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].glossaryId).toBe('gloss-renamed-id');
  });

  it('falls back to FQN-prefix lookup when glossaryId is not on the node', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Revenue',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].glossaryId).toBe('gloss-finance-id');
  });

  it('falls back to node.group when no glossaryId and FQN does not match', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          group: 'Finance',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].glossaryId).toBe('gloss-finance-id');
  });

  it('leaves glossaryId undefined when nothing resolves', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Unknown',
          type: 'glossaryTerm',
          fullyQualifiedName: 'NonExistent.Term',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].glossaryId).toBeUndefined();
  });

  it('keeps the node group passthrough so the combo can fall back to it', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          glossaryId: 'gloss-finance-id',
          group: 'Finance',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].group).toBe('Finance');
  });

  it('replaces a UUID-shaped label with the last FQN segment', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: '12345678-1234-1234-1234-123456789012',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Revenue',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].label).toBe('Revenue');
  });

  it('preserves multiple relations between the same pair of terms', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-kpi-1',
          label: 'KPI 1',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.KPI 1',
        },
        {
          id: 'term-audience',
          label: 'Audience',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Audience',
        },
      ],
      edges: [
        {
          from: 'term-kpi-1',
          to: 'term-audience',
          label: 'Related To',
          relationType: 'relatedTo',
        },
        {
          from: 'term-kpi-1',
          to: 'term-audience',
          label: 'Part Of',
          relationType: 'partOf',
        },
      ],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((e) => e.relationType).sort()).toEqual([
      'partOf',
      'relatedTo',
    ]);
  });

  it('dedupes nodes that share an id', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Revenue',
        },
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Revenue',
        },
        {
          id: 'term-2',
          label: 'Cost',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Cost',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['term-1', 'term-2']);
  });

  it('drops edges whose endpoints are not in the node set', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Revenue',
        },
        {
          id: 'term-2',
          label: 'Cost',
          type: 'glossaryTerm',
          fullyQualifiedName: 'Finance.Cost',
        },
      ],
      edges: [
        {
          from: 'term-1',
          to: 'term-2',
          label: 'Related To',
          relationType: 'relatedTo',
        },
        {
          from: 'term-1',
          to: 'missing-node',
          label: 'Related To',
          relationType: 'relatedTo',
        },
      ],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].to).toBe('term-2');
  });
});

describe('buildGraphFromAllTerms', () => {
  const baseGlossary = {
    id: 'gloss-finance-id',
    name: 'Finance',
    fullyQualifiedName: 'Finance',
    displayName: 'Finance',
  } as Glossary;

  it('preserves multiple relations between the same pair of terms', () => {
    const terms: GlossaryTerm[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'KPI 1',
        displayName: 'KPI 1',
        fullyQualifiedName: 'Finance.KPI 1',
        glossary: {
          id: 'gloss-finance-id',
          name: 'Finance',
          type: 'glossary',
        },
        relatedTerms: [
          {
            term: {
              id: '22222222-2222-2222-2222-222222222222',
              type: 'glossaryTerm',
              name: 'Audience',
              fullyQualifiedName: 'Finance.Audience',
            },
            relationType: 'relatedTo',
          },
          {
            term: {
              id: '22222222-2222-2222-2222-222222222222',
              type: 'glossaryTerm',
              name: 'Audience',
              fullyQualifiedName: 'Finance.Audience',
            },
            relationType: 'partOf',
          },
        ],
      } as GlossaryTerm,
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Audience',
        displayName: 'Audience',
        fullyQualifiedName: 'Finance.Audience',
        glossary: {
          id: 'gloss-finance-id',
          name: 'Finance',
          type: 'glossary',
        },
        relatedTerms: [
          {
            term: {
              id: '11111111-1111-1111-1111-111111111111',
              type: 'glossaryTerm',
              name: 'KPI 1',
              fullyQualifiedName: 'Finance.KPI 1',
            },
            relationType: 'relatedTo',
          },
          {
            term: {
              id: '11111111-1111-1111-1111-111111111111',
              type: 'glossaryTerm',
              name: 'KPI 1',
              fullyQualifiedName: 'Finance.KPI 1',
            },
            relationType: 'hasPart',
          },
        ],
      } as GlossaryTerm,
    ];

    const result = buildGraphFromAllTerms(terms, [baseGlossary], tStub);

    const termTermEdges = result.edges.filter(
      (e) => e.relationType !== 'parentOf'
    );
    const distinctRelationTypes = new Set(
      termTermEdges.map((e) => e.relationType)
    );

    expect(distinctRelationTypes.has('relatedTo')).toBe(true);
    expect(
      distinctRelationTypes.has('partOf') ||
        distinctRelationTypes.has('hasPart')
    ).toBe(true);
  });

  it('dedupes terms that appear more than once in the input', () => {
    const term = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'KPI 1',
      displayName: 'KPI 1',
      fullyQualifiedName: 'Finance.KPI 1',
      glossary: { id: 'gloss-finance-id', name: 'Finance', type: 'glossary' },
    } as GlossaryTerm;

    const result = buildGraphFromAllTerms([term, term], [baseGlossary], tStub);

    expect(result.nodes).toHaveLength(1);
  });

  it('drops related-term edges whose target term is not in the loaded set', () => {
    const terms: GlossaryTerm[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'KPI 1',
        displayName: 'KPI 1',
        fullyQualifiedName: 'Finance.KPI 1',
        glossary: { id: 'gloss-finance-id', name: 'Finance', type: 'glossary' },
        relatedTerms: [
          {
            term: {
              id: '99999999-9999-9999-9999-999999999999',
              type: 'glossaryTerm',
              name: 'Missing',
              fullyQualifiedName: 'Finance.Missing',
            },
            relationType: 'relatedTo',
          },
        ],
      } as GlossaryTerm,
    ];

    const result = buildGraphFromAllTerms(terms, [baseGlossary], tStub);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('propagates persisted relationship identity and governance metadata', () => {
    const relationId = '33333333-3333-3333-3333-333333333333';
    const terms = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Source',
        fullyQualifiedName: 'Finance.Source',
        glossary: { id: baseGlossary.id, type: 'glossary' },
        relatedTerms: [
          {
            createdAt: 1_700_000_000_000,
            createdBy: 'ontology-editor',
            id: relationId,
            provenance: Provenance.Imported,
            relationType: 'partOf',
            status: EntityStatus.Approved,
            term: {
              id: '22222222-2222-2222-2222-222222222222',
              type: 'glossaryTerm',
            },
          },
        ],
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Target',
        fullyQualifiedName: 'Finance.Target',
        glossary: { id: baseGlossary.id, type: 'glossary' },
      },
    ] as GlossaryTerm[];

    const result = buildGraphFromAllTerms(terms, [baseGlossary], tStub);

    expect(result.edges[0]).toMatchObject({
      createdAt: 1_700_000_000_000,
      createdBy: 'ontology-editor',
      id: relationId,
      provenance: Provenance.Imported,
      status: EntityStatus.Approved,
    });
  });
});

describe('projectOntologyRelationsToAssets', () => {
  it('creates inferred asset-to-asset edges from typed concept relations', () => {
    const result = projectOntologyRelationsToAssets({
      nodes: [
        { id: 'concept-a', label: 'Concept A', type: 'glossaryTerm' },
        { id: 'concept-b', label: 'Concept B', type: 'glossaryTerm' },
        { id: 'asset-a', label: 'Asset A', type: 'dataAsset' },
        { id: 'asset-b', label: 'Asset B', type: 'dataAsset' },
      ],
      edges: [
        {
          from: 'concept-a',
          to: 'concept-b',
          label: 'Requires',
          relationType: 'requires',
        },
        {
          from: 'asset-a',
          to: 'concept-a',
          label: 'Tagged with',
          relationType: ASSET_RELATION_TYPE,
          edgeKind: ASSET_BINDING_EDGE_KIND,
        },
        {
          from: 'asset-b',
          to: 'concept-b',
          label: 'Tagged with',
          relationType: ASSET_RELATION_TYPE,
          edgeKind: ASSET_BINDING_EDGE_KIND,
        },
      ],
    });

    expect(result.edges).toContainEqual({
      from: 'asset-a',
      to: 'asset-b',
      label: 'Requires',
      relationType: 'requires',
      edgeKind: SEMANTIC_PROJECTION_EDGE_KIND,
      provenance: Provenance.Inferred,
    });
  });

  it('does not project structural parent edges and honors the safety cap', () => {
    const result = projectOntologyRelationsToAssets(
      {
        nodes: [
          { id: 'concept-a', label: 'Concept A', type: 'glossaryTerm' },
          { id: 'concept-b', label: 'Concept B', type: 'glossaryTerm' },
          { id: 'asset-a', label: 'Asset A', type: 'dataAsset' },
          { id: 'asset-b', label: 'Asset B', type: 'dataAsset' },
        ],
        edges: [
          {
            from: 'concept-a',
            to: 'concept-b',
            label: 'Parent of',
            relationType: 'parentOf',
          },
          {
            from: 'asset-a',
            to: 'concept-a',
            label: 'Tagged with',
            relationType: ASSET_RELATION_TYPE,
          },
          {
            from: 'asset-b',
            to: 'concept-b',
            label: 'Tagged with',
            relationType: ASSET_RELATION_TYPE,
          },
        ],
      },
      0
    );

    expect(
      result.edges.filter(
        (edge) => edge.edgeKind === SEMANTIC_PROJECTION_EDGE_KIND
      )
    ).toHaveLength(0);
  });
});
