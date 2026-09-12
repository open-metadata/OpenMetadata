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
import { getGraphRelationshipRows } from './knowledgeGraphExport.utils';

it('exports every directed statement including grouped members and custom predicates', () => {
  const data: GraphData = {
    nodes: [
      { id: 'root', label: 'Orders', type: 'table' },
      ...Array.from({ length: 300 }, (_, index) => ({
        id: String(index),
        label: 'column_' + index,
        type: 'column',
      })),
    ],
    edges: Array.from({ length: 300 }, (_, index) => ({
      from: 'root',
      to: String(index),
      label: 'Has column',
      relationType: 'hasColumn',
    })),
  };
  data.edges.push({
    from: '299',
    to: 'root',
    label: 'Custom, relation',
    relationType: 'https://business.example/custom',
  });
  const rows = getGraphRelationshipRows(data);

  expect(rows).toHaveLength(302);
  expect(rows[300]).toEqual([
    'Orders',
    'Has column',
    'column_299',
    'structure',
    'hasColumn',
  ]);
  expect(rows[301]).toEqual([
    'column_299',
    'Custom, relation',
    'Orders',
    'other',
    'https://business.example/custom',
  ]);
});

it('exports the header without statements for the root-only scope', () => {
  expect(
    getGraphRelationshipRows({
      nodes: [{ id: 'root', label: 'Orders', type: 'table' }],
      edges: [],
    })
  ).toEqual([['subject', 'predicate', 'object', 'family', 'iri']]);
});
