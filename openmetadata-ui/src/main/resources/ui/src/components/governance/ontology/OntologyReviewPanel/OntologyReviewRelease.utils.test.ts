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

import { diffMemberFields } from './OntologyReviewRelease.utils';

describe('diffMemberFields', () => {
  it('lists only the fields whose value changed, with old and new text', () => {
    expect(
      diffMemberFields(
        { name: 'Customer', description: 'Old meaning', synonyms: ['a'] },
        { name: 'Customer', description: 'New meaning', synonyms: ['a'] }
      )
    ).toEqual([
      { field: 'description', before: 'Old meaning', after: 'New meaning' },
    ]);
  });

  it('ignores bookkeeping the server rewrites on every save', () => {
    expect(
      diffMemberFields(
        { description: 'Same', updatedAt: 1, updatedBy: 'a', version: 0.1 },
        { description: 'Same', updatedAt: 2, updatedBy: 'b', version: 0.2 }
      )
    ).toEqual([]);
  });

  it('reads an added member as every field new and a removed one as unset', () => {
    expect(diffMemberFields(undefined, { name: 'Alpha' })).toEqual([
      { field: 'name', before: undefined, after: 'Alpha' },
    ]);
    expect(diffMemberFields({ name: 'Alpha' }, undefined)).toEqual([
      { field: 'name', before: 'Alpha', after: undefined },
    ]);
  });

  it('shows lists of named things as comma-separated names, never JSON', () => {
    expect(
      diffMemberFields(
        { owners: [{ id: '1', name: 'alice' }], tags: ['PII'] },
        {
          owners: [
            { id: '1', name: 'alice' },
            { id: '2', displayName: 'Bob' },
          ],
          tags: ['PII', 'Gold'],
        }
      )
    ).toEqual([
      { field: 'owners', before: 'alice', after: 'alice, Bob' },
      { field: 'tags', before: 'PII', after: 'PII, Gold' },
    ]);
  });

  it('flattens nested objects to dotted field names', () => {
    expect(
      diffMemberFields(
        { range: { type: 'string', min: 1 } },
        { range: { type: 'string', min: 5 } }
      )
    ).toEqual([{ field: 'range.min', before: '1', after: '5' }]);
  });

  it('tells ["New York, USA"] from ["New York", "USA"]', () => {
    expect(
      diffMemberFields(
        { synonyms: ['New York, USA'] },
        { synonyms: ['New York', 'USA'] }
      )
    ).toEqual([
      {
        field: 'synonyms',
        before: '"New York, USA"',
        after: 'New York, USA',
      },
    ]);
  });

  it('shows an owner swapped for another user with the same display name, with their ids', () => {
    expect(
      diffMemberFields(
        { owners: [{ id: 'u-1', type: 'user', displayName: 'Alice' }] },
        { owners: [{ id: 'u-2', type: 'user', displayName: 'Alice' }] }
      )
    ).toEqual([
      { field: 'owners', before: 'Alice (u-1)', after: 'Alice (u-2)' },
    ]);
  });

  it('does not report an owner whose only difference is server bookkeeping', () => {
    expect(
      diffMemberFields(
        { owners: [{ id: 'u-1', displayName: 'Alice', href: '/a' }] },
        { owners: [{ id: 'u-1', displayName: 'Alice', href: '/b' }] }
      )
    ).toEqual([]);
  });

  it('shows a change to a field of a listed object that carries the same label', () => {
    expect(
      diffMemberFields(
        { owners: [{ id: 'u-1', displayName: 'Alice', deleted: false }] },
        { owners: [{ id: 'u-1', displayName: 'Alice', deleted: true }] }
      )
    ).toHaveLength(1);
  });
});
