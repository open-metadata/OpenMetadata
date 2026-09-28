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

import { Type } from '../../generated/api/rdf/sparqlResponse';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { buildGraphFromSparqlBindings } from './OntologyQueryResultGraph.utils';

const SOURCE_URI =
  'https://open-metadata.org/entity/glossaryTerm/00000000-0000-0000-0000-000000000101';
const TARGET_URI =
  'https://open-metadata.org/entity/glossaryTerm/00000000-0000-0000-0000-000000000102';
const PREDICATE_URI = 'https://open-metadata.org/ontology/relatedTo';
const tripleRow = {
  predicate: { type: Type.URI, value: PREDICATE_URI },
  source: { type: Type.URI, value: SOURCE_URI },
  target: { type: Type.URI, value: TARGET_URI },
};

describe('buildGraphFromSparqlBindings', () => {
  it('deduplicates triple rows and restores known concept labels', () => {
    const graph = buildGraphFromSparqlBindings(
      [tripleRow, tripleRow],
      ['source', 'predicate', 'target'],
      {
        edges: [],
        nodes: [
          {
            id: '00000000-0000-0000-0000-000000000101',
            label: 'Operational Risk',
            type: 'glossaryTerm',
          },
        ],
      },
      [
        createRelationshipTypeMock({
          displayName: 'Related To',
          rdfPredicate: PREDICATE_URI,
        }),
      ]
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: SOURCE_URI, label: 'Operational Risk' })
    );
    expect(graph.edges).toEqual([
      {
        from: SOURCE_URI,
        label: 'Related To',
        relationType: PREDICATE_URI,
        to: TARGET_URI,
      },
    ]);
  });

  it('does not manufacture graph edges from scalar results', () => {
    const graph = buildGraphFromSparqlBindings(
      [
        {
          count: {
            datatype: 'http://www.w3.org/2001/XMLSchema#integer',
            type: Type.Literal,
            value: '12',
          },
        },
      ],
      ['count'],
      null,
      []
    );

    expect(graph).toEqual({ edges: [], nodes: [] });
  });
});
