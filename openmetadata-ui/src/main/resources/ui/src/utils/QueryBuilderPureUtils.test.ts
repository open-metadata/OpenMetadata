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
  fromLegacyTableColumnJsonLogic,
  getSelectEqualsNotEqualsProperties,
  toLegacyTableColumnJsonLogic,
} from './QueryBuilderPureUtils';

const COLUMN = 'extension.testTableCp.rows.name';

type RuleProperties = {
  valueType: string[];
  asyncListValues?: { key: string; value: string; children: string }[];
};

const getRuleProperties = (
  value: unknown,
  operator: string
): RuleProperties => {
  const result = getSelectEqualsNotEqualsProperties(
    [],
    'field',
    value as string,
    operator
  );

  return (Object.values(result)[0] as { properties: RuleProperties })
    .properties;
};

describe('getSelectEqualsNotEqualsProperties valueType and asyncListValues branch', () => {
  it('uses the boolean value type for an equality op on a boolean value', () => {
    const properties = getRuleProperties(true, 'equal');

    expect(properties.valueType).toEqual(['boolean']);
    expect(properties.asyncListValues).toBeUndefined();
  });

  it('uses the text value type for an equality op on a non-boolean value', () => {
    const properties = getRuleProperties('abc', 'not_equal');

    expect(properties.valueType).toEqual(['text']);
    expect(properties.asyncListValues).toBeUndefined();
  });

  it('uses multiselect and maps array items for a membership op on an array value', () => {
    const properties = getRuleProperties(['a', 'b'], 'select_equals');

    expect(properties.valueType).toEqual(['multiselect']);
    expect(properties.asyncListValues).toEqual([
      { key: 'a', value: 'a', children: 'a' },
      { key: 'b', value: 'b', children: 'b' },
    ]);
  });

  it('uses select and a single async value for a membership op on a scalar value', () => {
    const properties = getRuleProperties('x', 'select_not_equals');

    expect(properties.valueType).toEqual(['select']);
    expect(properties.asyncListValues).toEqual([
      { key: 'x', value: 'x', children: 'x' },
    ]);
  });
});

describe('table-type custom property rule transforms', () => {
  it('rewrites the legacy contains shape to the field-first equal op', () => {
    expect(
      fromLegacyTableColumnJsonLogic({
        and: [{ contains: ['john', { tableColumnValues: COLUMN }] }],
      })
    ).toEqual({
      and: [{ __tcvContains: [{ var: COLUMN }, 'john'] }],
    });
  });

  it('rewrites the negated legacy contains shape to the not-equal op', () => {
    expect(
      fromLegacyTableColumnJsonLogic({
        and: [{ '!': { contains: ['john', { tableColumnValues: COLUMN }] } }],
      })
    ).toEqual({
      and: [{ __tcvNotContains: [{ var: COLUMN }, 'john'] }],
    });
  });

  it('rewrites the legacy some/contains shape to the like op', () => {
    expect(
      fromLegacyTableColumnJsonLogic({
        and: [
          {
            some: [
              { tableColumnValues: COLUMN },
              { contains: ['oh', { var: '' }] },
            ],
          },
        ],
      })
    ).toEqual({
      and: [{ __tcvLike: [{ var: COLUMN }, 'oh'] }],
    });
  });

  it('rewrites the negated legacy some/contains shape to the not-like op', () => {
    expect(
      fromLegacyTableColumnJsonLogic({
        and: [
          {
            '!': {
              some: [
                { tableColumnValues: COLUMN },
                { contains: ['oh', { var: '' }] },
              ],
            },
          },
        ],
      })
    ).toEqual({
      and: [{ __tcvNotLike: [{ var: COLUMN }, 'oh'] }],
    });
  });

  it('leaves rules already in the new shape untouched', () => {
    const current = {
      and: [{ __tcvContains: [{ var: COLUMN }, 'john'] }],
    };

    expect(fromLegacyTableColumnJsonLogic(current)).toEqual(current);
  });

  it('leaves an unrelated contains rule untouched', () => {
    const unrelated = { and: [{ contains: ['john', { var: 'name' }] }] };

    expect(fromLegacyTableColumnJsonLogic(unrelated)).toEqual(unrelated);
  });
});

describe('table-type custom property rules survive a builder round-trip', () => {
  // The stored shape must come back byte-identical after a load/save cycle, or the rule engine
  // stops seeing the format it evaluates.
  it.each([
    ['Is', { and: [{ contains: ['john', { tableColumnValues: COLUMN }] }] }],
    [
      'Is not',
      { and: [{ '!': { contains: ['john', { tableColumnValues: COLUMN }] } }] },
    ],
    [
      'Contains',
      {
        and: [
          {
            some: [
              { tableColumnValues: COLUMN },
              { contains: ['oh', { var: '' }] },
            ],
          },
        ],
      },
    ],
    [
      'Not contains',
      {
        and: [
          {
            '!': {
              some: [
                { tableColumnValues: COLUMN },
                { contains: ['oh', { var: '' }] },
              ],
            },
          },
        ],
      },
    ],
  ])('keeps the stored %s rule unchanged', (_label, stored) => {
    expect(
      toLegacyTableColumnJsonLogic(fromLegacyTableColumnJsonLogic(stored))
    ).toEqual(stored);
  });
});
