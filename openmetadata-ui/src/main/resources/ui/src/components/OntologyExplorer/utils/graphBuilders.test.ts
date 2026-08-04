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

const GLOSS_FINANCE_ID = 'gloss-finance-id';
const GLOSS_RENAMED_ID = 'gloss-renamed-id';
const FINANCE_REVENUE = 'Finance.Revenue';
const TERM_KPI_1 = 'term-kpi-1';
const FINANCE_KPI_1 = 'Finance.KPI 1';
const TERM_AUDIENCE = 'term-audience';
const FINANCE_AUDIENCE = 'Finance.Audience';
const RELATED_TO = 'Related To';
const _11111111_1111_1111_1111_111111111111 =
  '11111111-1111-1111-1111-111111111111';
const _22222222_2222_2222_2222_222222222222 =
  '22222222-2222-2222-2222-222222222222';

const tStub = ((key: string) => key) as unknown as TFunction;

const glossaries: Glossary[] = [
  {
    id: GLOSS_FINANCE_ID,
    name: 'Finance',
    fullyQualifiedName: 'Finance',
    description: 'd',
  } as Glossary,
  {
    id: GLOSS_RENAMED_ID,
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
          glossaryId: GLOSS_RENAMED_ID,
          // Drift: old FQN no longer matches the renamed glossary; the
          // explicit glossaryId on the node MUST win.
          fullyQualifiedName: 'OldName.Revenue',
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].glossaryId).toBe(GLOSS_RENAMED_ID);
  });

  it('falls back to FQN-prefix lookup when glossaryId is not on the node', () => {
    const rdf: GraphData = {
      nodes: [
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          fullyQualifiedName: FINANCE_REVENUE,
        },
      ],
      edges: [],
    };

    const result = convertRdfGraphToOntologyGraph(rdf, glossaries);

    expect(result.nodes[0].glossaryId).toBe(GLOSS_FINANCE_ID);
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

    expect(result.nodes[0].glossaryId).toBe(GLOSS_FINANCE_ID);
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
          glossaryId: GLOSS_FINANCE_ID,
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
          fullyQualifiedName: FINANCE_REVENUE,
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
          id: TERM_KPI_1,
          label: 'KPI 1',
          type: 'glossaryTerm',
          fullyQualifiedName: FINANCE_KPI_1,
        },
        {
          id: TERM_AUDIENCE,
          label: 'Audience',
          type: 'glossaryTerm',
          fullyQualifiedName: FINANCE_AUDIENCE,
        },
      ],
      edges: [
        {
          from: TERM_KPI_1,
          to: TERM_AUDIENCE,
          label: RELATED_TO,
          relationType: 'relatedTo',
        },
        {
          from: TERM_KPI_1,
          to: TERM_AUDIENCE,
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
          fullyQualifiedName: FINANCE_REVENUE,
        },
        {
          id: 'term-1',
          label: 'Revenue',
          type: 'glossaryTerm',
          fullyQualifiedName: FINANCE_REVENUE,
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
          fullyQualifiedName: FINANCE_REVENUE,
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
          label: RELATED_TO,
          relationType: 'relatedTo',
        },
        {
          from: 'term-1',
          to: 'missing-node',
          label: RELATED_TO,
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
    id: GLOSS_FINANCE_ID,
    name: 'Finance',
    fullyQualifiedName: 'Finance',
    displayName: 'Finance',
  } as Glossary;

  it('preserves multiple relations between the same pair of terms', () => {
    const terms: GlossaryTerm[] = [
      {
        id: _11111111_1111_1111_1111_111111111111,
        name: 'KPI 1',
        displayName: 'KPI 1',
        fullyQualifiedName: FINANCE_KPI_1,
        glossary: {
          id: GLOSS_FINANCE_ID,
          name: 'Finance',
          type: 'glossary',
        },
        relatedTerms: [
          {
            term: {
              id: _22222222_2222_2222_2222_222222222222,
              type: 'glossaryTerm',
              name: 'Audience',
              fullyQualifiedName: FINANCE_AUDIENCE,
            },
            relationType: 'relatedTo',
          },
          {
            term: {
              id: _22222222_2222_2222_2222_222222222222,
              type: 'glossaryTerm',
              name: 'Audience',
              fullyQualifiedName: FINANCE_AUDIENCE,
            },
            relationType: 'partOf',
          },
        ],
      } as GlossaryTerm,
      {
        id: _22222222_2222_2222_2222_222222222222,
        name: 'Audience',
        displayName: 'Audience',
        fullyQualifiedName: FINANCE_AUDIENCE,
        glossary: {
          id: GLOSS_FINANCE_ID,
          name: 'Finance',
          type: 'glossary',
        },
        relatedTerms: [
          {
            term: {
              id: _11111111_1111_1111_1111_111111111111,
              type: 'glossaryTerm',
              name: 'KPI 1',
              fullyQualifiedName: FINANCE_KPI_1,
            },
            relationType: 'relatedTo',
          },
          {
            term: {
              id: _11111111_1111_1111_1111_111111111111,
              type: 'glossaryTerm',
              name: 'KPI 1',
              fullyQualifiedName: FINANCE_KPI_1,
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
      id: _11111111_1111_1111_1111_111111111111,
      name: 'KPI 1',
      displayName: 'KPI 1',
      fullyQualifiedName: FINANCE_KPI_1,
      glossary: { id: GLOSS_FINANCE_ID, name: 'Finance', type: 'glossary' },
    } as GlossaryTerm;

    const result = buildGraphFromAllTerms([term, term], [baseGlossary], tStub);

    expect(result.nodes).toHaveLength(1);
  });

  it('drops related-term edges whose target term is not in the loaded set', () => {
    const terms: GlossaryTerm[] = [
      {
        id: _11111111_1111_1111_1111_111111111111,
        name: 'KPI 1',
        displayName: 'KPI 1',
        fullyQualifiedName: FINANCE_KPI_1,
        glossary: { id: GLOSS_FINANCE_ID, name: 'Finance', type: 'glossary' },
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
});
