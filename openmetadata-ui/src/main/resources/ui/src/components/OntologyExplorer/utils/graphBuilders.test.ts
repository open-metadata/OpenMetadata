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
import { Glossary } from '../../../generated/entity/data/glossary';
import { GraphData } from '../../../rest/rdfAPI.interface';
import { convertRdfGraphToOntologyGraph } from './graphBuilders';

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
});
