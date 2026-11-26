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
  DataType,
  SearchIndexField,
} from '../generated/entity/data/searchIndex';
import { LabelType, State, TagSource } from '../generated/type/tagLabel';
import {
  getColumnPageForFqn,
  getUpdatedTags,
  searchInFields,
} from './TablePureUtils';

describe('getUpdatedTags', () => {
  it('keeps a derived label derived, so it is not saved as the field own', () => {
    const [inheritedTerm, ownTag] = getUpdatedTags([
      {
        tagFQN: 'Finance.Revenue',
        source: TagSource.Glossary,
        labelType: LabelType.Derived,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PII.Sensitive',
        source: TagSource.Classification,
        labelType: LabelType.Automated,
        state: State.Suggested,
        isRemovable: true,
      },
    ]);

    expect(inheritedTerm.labelType).toBe(LabelType.Derived);
    expect(ownTag.labelType).toBe(LabelType.Manual);
    expect(ownTag.state).toBe(State.Confirmed);
    expect(ownTag).not.toHaveProperty('isRemovable');
  });
});

describe('searchInFields', () => {
  const fields: SearchIndexField[] = [
    { name: 'userName', dataType: DataType.Text },
    { name: 'userId', dataType: DataType.Keyword, description: 'Primary key' },
    {
      name: 'address',
      dataType: DataType.Object,
      children: [
        { name: 'streetName', dataType: DataType.Text },
        { name: 'zipCode', dataType: DataType.Keyword },
      ],
    },
  ];

  const names = (result: SearchIndexField[]) => result.map(({ name }) => name);

  it.each(['User', 'USER', 'user'])(
    'matches field names case-insensitively for %s',
    (query) => {
      expect(names(searchInFields(fields, query))).toEqual([
        'userName',
        'userId',
      ]);
    }
  );

  it('matches descriptions and data types regardless of query case', () => {
    expect(names(searchInFields(fields, 'PRIMARY'))).toEqual(['userId']);
    expect(names(searchInFields(fields, 'Keyword'))).toEqual([
      'userId',
      'address',
    ]);
  });

  it('keeps a parent with only its matching children', () => {
    const [address] = searchInFields(fields, 'Street');

    expect(address.name).toBe('address');
    expect(names(address.children ?? [])).toEqual(['streetName']);
  });

  it('returns no fields when nothing matches', () => {
    expect(searchInFields(fields, 'Missing')).toEqual([]);
  });
});

describe('getColumnPageForFqn', () => {
  type FieldStub = {
    name: string;
    ordinalPosition?: number;
    fullyQualifiedName: string;
    children?: FieldStub[];
  };
  const column = (name: string, ordinalPosition?: number): FieldStub => ({
    name,
    ordinalPosition,
    fullyQualifiedName: `t.${name}`,
  });

  it('sorts names case-insensitively like the backend', () => {
    const columns = [column('b'), column('C'), column('a')];

    expect(getColumnPageForFqn(columns, 't.a', 'name', 'asc', 1)).toBe(1);
    expect(getColumnPageForFqn(columns, 't.b', 'name', 'asc', 1)).toBe(2);
    expect(getColumnPageForFqn(columns, 't.C', 'name', 'asc', 1)).toBe(3);
  });

  it('reverses the order for desc', () => {
    const columns = [column('a'), column('b'), column('c')];

    expect(getColumnPageForFqn(columns, 't.a', 'name', 'desc', 1)).toBe(3);
  });

  it('sorts by ordinal position with nulls last', () => {
    const columns = [column('a'), column('b', 2), column('c', 1)];

    expect(
      getColumnPageForFqn(columns, 't.c', 'ordinalPosition', 'asc', 1)
    ).toBe(1);
    expect(
      getColumnPageForFqn(columns, 't.a', 'ordinalPosition', 'asc', 1)
    ).toBe(3);
  });

  it('crosses the page boundary at pageSize', () => {
    const columns = Array.from({ length: 51 }, (_, i) =>
      column(`col_${String(i).padStart(3, '0')}`)
    );

    expect(getColumnPageForFqn(columns, 't.col_049', 'name', 'asc', 50)).toBe(
      1
    );
    expect(getColumnPageForFqn(columns, 't.col_050', 'name', 'asc', 50)).toBe(
      2
    );
  });

  it("returns a nested column's top-level parent page", () => {
    const columns = [
      column('a'),
      {
        ...column('b'),
        children: [{ name: 'x', fullyQualifiedName: 't.b.x' }],
      },
    ];

    expect(getColumnPageForFqn(columns, 't.b.x', 'name', 'asc', 1)).toBe(2);
  });

  it('returns undefined when the column is not found', () => {
    expect(
      getColumnPageForFqn([column('a')], 't.missing', 'name', 'asc', 1)
    ).toBeUndefined();
  });
});
