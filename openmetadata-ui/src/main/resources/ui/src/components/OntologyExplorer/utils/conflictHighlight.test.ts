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

import { buildConflictHighlight, conflictEdgeKey } from './conflictHighlight';

describe('conflict highlight', () => {
  const edges = [
    { from: 'bottom', to: 'left' },
    { from: 'right', to: 'bottom' },
    { from: 'left', to: 'top' },
  ];

  it('marks the clashing class and the links it has to the concepts it clashes with', () => {
    const { edgeKeys, nodeIds } = buildConflictHighlight(
      [{ conceptIds: ['bottom', 'left', 'right'] }],
      edges
    );

    expect([...nodeIds]).toEqual(['bottom']);
    expect([...edgeKeys].sort()).toEqual(
      [
        conflictEdgeKey({ from: 'bottom', to: 'left' }),
        conflictEdgeKey({ from: 'bottom', to: 'right' }),
      ].sort()
    );
  });

  it('marks nothing when no violation names a concept', () => {
    const { edgeKeys, nodeIds } = buildConflictHighlight([{}, {}], edges);

    expect(nodeIds.size).toBe(0);
    expect(edgeKeys.size).toBe(0);
  });

  it('gives one key to an edge in either direction', () => {
    expect(conflictEdgeKey({ from: 'a', to: 'b' })).toBe(
      conflictEdgeKey({ from: 'b', to: 'a' })
    );
  });

  it('highlights the subclass edges from a class up to two disjoint ancestors that are not its direct parents', () => {
    const subClassOf = (from: string, to: string) => ({
      from,
      to,
      relationType: 'subClassOf',
    });
    const { edgeKeys, nodeIds } = buildConflictHighlight(
      [{ conceptIds: ['C', 'A', 'B'] }],
      [
        subClassOf('C', 'P'),
        subClassOf('C', 'Q'),
        subClassOf('P', 'A'),
        subClassOf('Q', 'B'),
        subClassOf('A', 'Top'),
        subClassOf('D', 'P'),
        { from: 'C', to: 'Other', relationType: 'relatedTo' },
      ]
    );

    expect([...nodeIds]).toEqual(['C']);
    expect([...edgeKeys].sort()).toEqual(
      [
        conflictEdgeKey({ from: 'C', to: 'P' }),
        conflictEdgeKey({ from: 'C', to: 'Q' }),
        conflictEdgeKey({ from: 'P', to: 'A' }),
        conflictEdgeKey({ from: 'Q', to: 'B' }),
      ].sort()
    );
  });
});
