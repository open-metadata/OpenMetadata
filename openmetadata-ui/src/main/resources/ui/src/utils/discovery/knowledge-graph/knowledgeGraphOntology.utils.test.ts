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

import { GraphData } from '../../../components/discovery/knowledge-graph/KnowledgeGraph.interface';
import { getOntologyScope } from './knowledgeGraphOntology.utils';

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
