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

import { GraphData } from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  addDeclaredOntologyProperties,
  getOntologyScope,
} from './knowledgeGraphOntology.utils';

const graph: GraphData = {
  nodes: [
    { id: 'customer', label: 'Customer', type: 'glossaryTerm' },
    { id: 'order', label: 'Order', type: 'glossaryTerm' },
    { id: 'table', label: 'Customers', type: 'table' },
    { id: 'owner', label: 'Steward', type: 'user' },
  ],
  edges: [
    {
      from: 'customer',
      to: 'order',
      label: 'Places',
      relationType: 'https://business.example/places',
    },
    {
      from: 'order',
      to: 'customer',
      label: 'Ordered by',
      relationType: 'https://business.example/orderedBy',
    },
    {
      from: 'table',
      to: 'customer',
      label: 'Has glossary term',
      relationType: 'hasGlossaryTerm',
    },
    { from: 'table', to: 'owner', label: 'Owned by', relationType: 'ownedBy' },
  ],
};
const terms = [
  {
    id: 'customer',
    name: 'Customer',
    attributes: [
      {
        id: 'email',
        name: 'emailAddress',
        dataType: 'STRING',
        iri: 'https://business.example/email',
      },
      {
        id: 'identifier',
        name: 'customerId',
        dataType: 'STRING',
        isIdentifier: true,
      },
    ],
    effectiveAttributes: [
      { id: 'inherited', name: 'inheritedProperty', dataType: 'STRING' },
    ],
  },
] as GlossaryTerm[];

it('shows actual directional concept predicates and their asset mappings', () => {
  const result = getOntologyScope(graph, 'customer');

  expect(result?.nodes.map((node) => node.id)).toEqual([
    'customer',
    'order',
    'table',
  ]);
  expect(result?.edges).toEqual(graph.edges.slice(0, 3));
  expect(
    result?.edges.some((edge) => edge.from === 'table' && edge.to === 'order')
  ).toBe(false);
});

it('preserves an isolated selected concept and partial response information', () => {
  expect(getOntologyScope(null, 'customer')).toBeNull();
  expect(
    getOntologyScope({ ...graph, edges: [], truncated: true }, 'customer')
  ).toEqual({ nodes: [graph.nodes[0]], edges: [], truncated: true });
});

it('exposes declared property domains without inventing inherited declarations', () => {
  const result = addDeclaredOntologyProperties(
    graph,
    graph,
    terms,
    'customer',
    1,
    'Domain'
  );

  expect(
    result?.nodes
      .filter((node) => node.type === 'property')
      .map((node) => node.label)
  ).toEqual(['emailAddress', 'customerId']);
  expect(result?.edges.slice(-2)).toEqual([
    expect.objectContaining({
      from: 'https://business.example/email',
      to: 'customer',
      relationType: 'http://www.w3.org/2000/01/rdf-schema#domain',
    }),
    expect.objectContaining({ to: 'customer', label: 'Domain' }),
  ]);
});

it('keeps property expansion within the selected level and honors filters', () => {
  expect(
    addDeclaredOntologyProperties(graph, graph, terms, 'customer', 0, 'Domain')
  ).toBe(graph);
  expect(
    addDeclaredOntologyProperties(graph, graph, terms, 'table', 1, 'Domain')
      ?.nodes
  ).toHaveLength(4);
  expect(
    addDeclaredOntologyProperties(graph, graph, terms, 'table', 2, 'Domain')
      ?.nodes
  ).toHaveLength(6);
  expect(
    addDeclaredOntologyProperties(
      graph,
      graph,
      terms,
      'customer',
      2,
      'Domain',
      { entityTypes: ['table'], relationshipTypes: [] }
    )
  ).toBe(graph);
});
