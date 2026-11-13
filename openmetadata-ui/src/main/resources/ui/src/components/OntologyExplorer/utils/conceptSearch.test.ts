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
import { OntologyNode } from '../OntologyExplorer.interface';
import { rankConceptMatches } from './conceptSearch';

const node = (id: string, label: string): OntologyNode => ({
  id,
  label,
  type: 'ontologyConcept',
});

describe('rankConceptMatches', () => {
  const nodes = [
    node('a', 'Lab Order'),
    node('b', 'Order'),
    node('c', 'Patient'),
    node('d', 'Order Line'),
    node('e', 'Reorder Reason'),
  ];

  it('puts labels that start with the query first, then labels that contain it', () => {
    const ranked = rankConceptMatches(
      nodes,
      new Set(['a', 'b', 'd', 'e']),
      'order'
    );

    expect(ranked.map(({ label }) => label)).toEqual([
      'Order',
      'Order Line',
      'Lab Order',
      'Reorder Reason',
    ]);
  });

  it('keeps matches found only outside the label last', () => {
    const ranked = rankConceptMatches(nodes, new Set(['c', 'b']), 'order');

    expect(ranked.map(({ label }) => label)).toEqual(['Order', 'Patient']);
  });

  it('limits the list', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      node(`n${index}`, `Item ${String(index).padStart(2, '0')}`)
    );

    const ranked = rankConceptMatches(
      many,
      new Set(many.map(({ id }) => id)),
      'item'
    );

    expect(ranked).toHaveLength(8);
    expect(ranked[0].label).toBe('Item 00');
  });
});
