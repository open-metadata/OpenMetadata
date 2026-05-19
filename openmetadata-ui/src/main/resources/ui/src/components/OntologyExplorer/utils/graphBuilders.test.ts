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
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { GraphData } from '../../../rest/rdfAPI.interface';
import {
  buildGraphFromAllTerms,
  convertRdfGraphToOntologyGraph,
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
});
