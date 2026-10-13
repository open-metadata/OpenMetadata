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
  ContextMemory,
  MemoryType,
} from '../../../generated/entity/context/contextMemory';
import { MemoryConflictReviewDispute } from '../MemoryConflictReviews/MemoryConflictReviews.types';
import {
  diffList,
  diffText,
  getKeepHints,
  getMemoryByline,
  getMemoryDiffRows,
} from './MemoryConflictCompare.utils';

const changed = (segments: { value: string; change?: string }[]) =>
  segments
    .filter(({ change }) => change)
    .map(({ value, change }) => `${change}:${value.trim()}`);

describe('diffText', () => {
  it('marks the words the proposed text drops and adds', () => {
    const sides = diffText(
      'Customers need five completed orders.',
      'Customers need three completed orders.'
    );

    expect(sides.isChanged).toBe(true);
    expect(changed(sides.current)).toEqual(['removed:five']);
    expect(changed(sides.proposed)).toEqual(['added:three']);
    expect(sides.current.map(({ value }) => value).join('')).toBe(
      'Customers need five completed orders.'
    );
    expect(sides.proposed.map(({ value }) => value).join('')).toBe(
      'Customers need three completed orders.'
    );
  });

  it('marks nothing when both say the same', () => {
    const sides = diffText('Same words.', 'Same words.');

    expect(sides.isChanged).toBe(false);
    expect(changed(sides.current)).toEqual([]);
  });

  it('gives every segment a distinct id, even for repeated words', () => {
    const { proposed } = diffText('a', 'a b a b');

    expect(new Set(proposed.map(({ id }) => id)).size).toBe(proposed.length);
  });
});

describe('diffList', () => {
  it('marks the values only one side holds', () => {
    const sides = diffList(['orders', 'customers'], ['customers', 'returns']);

    expect(sides.isChanged).toBe(true);
    expect(changed(sides.current)).toEqual(['removed:orders']);
    expect(changed(sides.proposed)).toEqual(['added:returns']);
  });

  it('is unchanged when both hold the same values', () => {
    expect(diffList(['a'], ['a']).isChanged).toBe(false);
    expect(diffList([], []).isChanged).toBe(false);
  });
});

describe('getMemoryDiffRows', () => {
  const memory = (answer: string): ContextMemory =>
    ({
      id: answer,
      name: answer,
      title: 'Active customer',
      answer,
      question: 'Who counts as active?',
      memoryType: MemoryType.Note,
      primaryEntity: { id: 't', type: 'table', name: 'dim_customer' },
    } as ContextMemory);

  it('compares every field the detail view shows and flags only what differs', () => {
    const rows = getMemoryDiffRows(
      memory('Five orders.'),
      memory('Three orders.')
    );
    const changedKeys = rows
      .filter(({ sides }) => sides.isChanged)
      .map(({ key }) => key);

    expect(rows.map(({ key }) => key)).toEqual([
      'title',
      'memory',
      'question',
      'type',
      'linked-assets',
      'visibility',
      'tags',
      'source',
      'owners',
    ]);
    expect(changedKeys).toEqual(['memory']);
  });

  it('shows one side alone while the other is missing', () => {
    const rows = getMemoryDiffRows(undefined, memory('Three orders.'));

    expect(rows.find(({ key }) => key === 'memory')?.sides.isChanged).toBe(
      true
    );
  });
});

describe('getKeepHints', () => {
  const dispute = (id: string): MemoryConflictReviewDispute => ({
    memory: { id, type: 'contextMemory', displayName: `Memory ${id}` },
    reason: 'Disagree',
  });

  it('names the other memory when there is one', () => {
    expect(getKeepHints([dispute('a')], 'In review')).toEqual({
      approved: {
        key: 'message.keep-approved-memory-hint',
        options: { title: 'In review' },
      },
      reviewed: {
        key: 'message.keep-reviewed-memory-hint',
        options: { title: 'Memory a' },
      },
    });
  });

  it('counts the memories kept or superseded when there are several', () => {
    const hints = getKeepHints([dispute('a'), dispute('b')], 'In review');

    expect(hints.approved.key).toBe('message.keep-approved-memories-hint');
    expect(hints.reviewed).toEqual({
      key: 'message.keep-reviewed-memory-hint-plural',
      options: { count: 2 },
    });
  });
});

describe('getMemoryByline', () => {
  it('names the owner and when the memory last changed', () => {
    expect(
      getMemoryByline({
        owners: [{ id: 'u', type: 'user', name: 'ana', displayName: 'Ana' }],
        updatedAt: 1700000000000,
      } as ContextMemory)
    ).toMatch(/^Ana · /);
    expect(getMemoryByline(undefined)).toBe('');
  });
});
