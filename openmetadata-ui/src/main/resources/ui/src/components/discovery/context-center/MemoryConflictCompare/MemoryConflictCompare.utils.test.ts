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
import { TFunction } from 'i18next';
import {
  ContextMemory,
  MemoryType,
  ShareVisibility,
  SourceType,
} from '../../../../generated/entity/context/contextMemory';
import { DisputedMemory } from '../../../../generated/type/memoryConflictReviewPayload';
import { DiffSegment } from './MemoryConflictCompare.types';
import {
  diffList,
  diffText,
  getComparedMemories,
  getKeepHints,
  getMemoryByline,
  getMemoryDiffRows,
  getUnavailableMemory,
} from './MemoryConflictCompare.utils';

const t = ((key: string) => `t:${key}`) as unknown as TFunction;

const changed = (segments: DiffSegment[]) =>
  segments
    .filter(({ change }) => change)
    .map(({ value, change }) => `${change}:${value.trim()}`);

const text = (segments: DiffSegment[]) =>
  segments.map(({ value }) => value).join('');

describe('diffText', () => {
  it('marks the words the proposed text drops and adds', () => {
    const sides = diffText(
      'Customers need five completed orders.',
      'Customers need three completed orders.'
    );

    expect(sides.isChanged).toBe(true);
    expect(changed(sides.current)).toEqual(['removed:five']);
    expect(changed(sides.proposed)).toEqual(['added:three']);
  });

  it('keeps each side in its own words and spacing', () => {
    const current = 'Five orders.\n\nIn the last 90 days.';
    const proposed = 'Three orders. In the last 90 days.';

    const sides = diffText(current, proposed);

    expect(text(sides.current)).toBe(current);
    expect(text(sides.proposed)).toBe(proposed);
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
  const value = (key: string, label = key) => ({ key, label });

  it('marks the values only one side holds', () => {
    const sides = diffList(
      [value('orders'), value('customers')],
      [value('customers'), value('returns')]
    );

    expect(sides.isChanged).toBe(true);
    expect(changed(sides.current)).toEqual(['removed:orders']);
    expect(changed(sides.proposed)).toEqual(['added:returns']);
  });

  it('compares what values are, not what they are called', () => {
    const sides = diffList(
      [value('prod.sales.customers', 'customers')],
      [value('staging.sales.customers', 'customers')]
    );

    expect(sides.isChanged).toBe(true);
  });

  it('is unchanged when both hold the same values', () => {
    expect(diffList([value('a')], [value('a')]).isChanged).toBe(false);
    expect(diffList([], []).isChanged).toBe(false);
  });
});

describe('getMemoryDiffRows', () => {
  const memory = (answer: string, overrides: Partial<ContextMemory> = {}) =>
    ({
      id: answer,
      name: answer,
      title: 'Active customer',
      answer,
      question: 'Who counts as active?',
      memoryType: MemoryType.Note,
      shareConfig: { visibility: ShareVisibility.Entity },
      sourceType: SourceType.FileExtraction,
      primaryEntity: {
        id: 't',
        type: 'table',
        name: 'dim_customer',
        fullyQualifiedName: 'shop.dim_customer',
      },
      ...overrides,
    } as ContextMemory);

  const rowOf = (rows: ReturnType<typeof getMemoryDiffRows>, key: string) =>
    rows.find((row) => row.key === key);

  it('compares every field the detail view shows and flags only what differs', () => {
    const rows = getMemoryDiffRows(
      memory('Five orders.'),
      memory('Three orders.'),
      t
    );

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
    expect(
      rows.filter(({ sides }) => sides.isChanged).map(({ key }) => key)
    ).toEqual(['memory']);
  });

  it('shows the type, visibility and source by their labels', () => {
    const rows = getMemoryDiffRows(memory('a'), memory('a'), t);

    expect(text(rowOf(rows, 'type')?.sides.current ?? [])).toBe('t:label.note');
    expect(text(rowOf(rows, 'visibility')?.sides.current ?? [])).toBe(
      't:label.entity'
    );
    expect(text(rowOf(rows, 'source')?.sides.current ?? [])).toBe(
      't:label.file'
    );
  });

  it('marks nothing while the other side is missing', () => {
    const rows = getMemoryDiffRows(undefined, memory('Three orders.'), t);

    expect(rows.every(({ sides }) => !sides.isChanged)).toBe(true);
    expect(text(rowOf(rows, 'memory')?.sides.proposed ?? [])).toBe(
      'Three orders.'
    );
    expect(changed(rowOf(rows, 'memory')?.sides.proposed ?? [])).toEqual([]);
  });
});

describe('getUnavailableMemory', () => {
  const failure = (status?: number) => ({ response: { status } });

  it('tells a deleted memory from one the user may not read or a failed read', () => {
    expect(getUnavailableMemory(failure(404))).toBe('gone');
    expect(getUnavailableMemory(failure(403))).toBe('hidden');
    expect(getUnavailableMemory(failure(500))).toBe('failed');
    expect(getUnavailableMemory(new Error('offline'))).toBe('failed');
    expect(getUnavailableMemory(null)).toBeUndefined();
  });
});

describe('getKeepHints', () => {
  const dispute = (id: string): DisputedMemory => ({
    memory: { id, type: 'contextMemory', name: id },
  });

  it('names the other memory when there is one', () => {
    expect(getKeepHints([dispute('a')], 'In review', 'Approved')).toEqual({
      approved: {
        key: 'message.keep-approved-memory-hint',
        options: { title: 'In review' },
      },
      reviewed: {
        key: 'message.keep-reviewed-memory-hint',
        options: { title: 'Approved' },
      },
    });
  });

  it('counts the memories kept or superseded when there are several', () => {
    const hints = getKeepHints(
      [dispute('a'), dispute('b')],
      'In review',
      'Approved'
    );

    expect(hints.approved.key).toBe('message.keep-approved-memories-hint');
    expect(hints.reviewed).toEqual({
      key: 'message.keep-reviewed-memory-hint-plural',
      options: { count: 2 },
    });
  });
});

describe('getMemoryByline', () => {
  it('names the owner and when the claim last changed', () => {
    const byline = getMemoryByline({
      owners: [{ id: 'u', type: 'user', name: 'ana', displayName: 'Ana' }],
      updatedAt: 1800000000000,
      lastContentUpdatedAt: 1700000000000,
    } as ContextMemory);

    expect(byline).toMatch(/^Ana · /);
    expect(byline).toContain('2023');
    expect(getMemoryByline(undefined)).toBe('');
  });
});

describe('getComparedMemories', () => {
  it('stamps each memory with when its claim last changed, and an unread one with nothing', () => {
    expect(
      getComparedMemories([
        {
          id: 'reviewed',
          memory: { lastContentUpdatedAt: 7, updatedAt: 9 } as ContextMemory,
        },
        { id: 'hidden', memory: undefined },
        { id: undefined, memory: undefined },
      ])
    ).toEqual([
      { id: 'reviewed', contentUpdatedAt: 7 },
      { id: 'hidden', contentUpdatedAt: undefined },
    ]);
  });
});
