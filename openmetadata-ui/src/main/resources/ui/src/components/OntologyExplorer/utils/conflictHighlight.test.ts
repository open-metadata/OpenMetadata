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

import {
  buildConflictHighlight,
  conflictEdgeKey,
  makeReadableViolationMessage,
} from './conflictHighlight';

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

describe('makeReadableViolationMessage', () => {
  it('names concepts by display name, longest internal name first', () => {
    const concepts = [
      { name: 'imported-Record-1', iri: 'urn:x#Record', label: 'Record' },
      {
        name: 'imported-Record-1-child',
        iri: 'urn:x#Medication',
        label: 'Medication Record',
      },
    ];

    expect(
      makeReadableViolationMessage(concepts)(
        'imported-Record-1-child is disjoint with its ancestor imported-Record-1 (urn:x#Record)'
      )
    ).toBe('Medication Record is disjoint with its ancestor Record (Record)');
  });

  it('applies one built replacer to every message of the same concepts', () => {
    const readable = makeReadableViolationMessage([
      { name: 'dog', label: 'Dog' },
      { name: 'plant', label: 'Plant' },
    ]);

    expect(['dog clashes', 'plant clashes'].map(readable)).toEqual([
      'Dog clashes',
      'Plant clashes',
    ]);
  });

  it('leaves a message about unknown concepts as it is', () => {
    expect(makeReadableViolationMessage([])('Something failed')).toBe(
      'Something failed'
    );
  });
});

describe('the disjoint rule behind a clash', () => {
  const zoo = [
    { from: 'dog', to: 'mammal', relationType: 'is a' },
    { from: 'mammal', to: 'animal', relationType: 'is a' },
    { from: 'dog', to: 'plant', relationType: 'is a' },
    { from: 'animal', to: 'plant', relationType: 'disjoint with' },
    { from: 'cat', to: 'animal', relationType: 'disjoint with' },
  ];

  it('is part of a clash it causes between two inherited classes', () => {
    const { edgeKeys } = buildConflictHighlight(
      [{ conceptIds: ['dog', 'plant', 'animal'] }],
      zoo
    );

    expect(edgeKeys.has(conflictEdgeKey({ from: 'animal', to: 'plant' }))).toBe(
      true
    );
    expect(edgeKeys.has(conflictEdgeKey({ from: 'dog', to: 'mammal' }))).toBe(
      true
    );
    // A disjoint rule elsewhere in the model is not part of this clash.
    expect(edgeKeys.has(conflictEdgeKey({ from: 'cat', to: 'animal' }))).toBe(
      false
    );
  });

  it('is part of a clash when a class is disjoint with its own ancestor', () => {
    const { edgeKeys } = buildConflictHighlight(
      [{ conceptIds: ['medication', 'clinical'] }],
      [
        { from: 'medication', to: 'clinical', relationType: 'broader' },
        { from: 'medication', to: 'clinical', relationType: 'DISJOINT_WITH' },
      ]
    );

    expect([...edgeKeys]).toEqual([
      conflictEdgeKey({ from: 'medication', to: 'clinical' }),
    ]);
  });
});

describe('readable names in a conflict message', () => {
  it('replaces whole names only, so a name inside a longer one stays intact', () => {
    expect(
      makeReadableViolationMessage([
        { name: 'Customer', label: 'Customer QA Edited' },
        { name: 'VipCustomer', label: 'VIP customer' },
      ])('VipCustomer is disjoint with its ancestor Customer')
    ).toBe('VIP customer is disjoint with its ancestor Customer QA Edited');
  });

  it('does not rewrite a label it has just put in', () => {
    expect(
      makeReadableViolationMessage([
        { name: 'Order', label: 'LineItem order' },
        { name: 'LineItem', label: 'Line item' },
      ])('Order clashes with LineItem')
    ).toBe('LineItem order clashes with Line item');
  });
});
