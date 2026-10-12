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
import type { QueryFieldInterface } from '../pages/ExplorePage/ExplorePage.interface';
import {
  getJsonTreePropertyFromQueryFilter,
  getSelectEqualsNotEqualsProperties,
} from './QueryBuilderPureUtils';

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

// `Not in [a, b]` is written as one `must_not` clause per value, AND-ed. Reading
// it back as two separate `!=` rows changed nothing about the query, but the user
// lost the row they filled — and the old OR-ed shape has to keep loading, since
// saved filters and shared URLs still carry it.
describe('getJsonTreePropertyFromQueryFilter – multi-value negated select', () => {
  const FIELD = 'columns.tags.tagFQN';
  const mustNotTerm = (value: string) =>
    ({
      bool: { must_not: { term: { [FIELD]: value } } },
    } as QueryFieldInterface);

  const firstRule = (result: Record<string, unknown>) =>
    Object.values(result)[0] as {
      type: string;
      properties: { field: string; operator: string; value: unknown };
    };

  it('reads AND-ed negated terms on one field as a single Not in rule', () => {
    const rule = firstRule(
      getJsonTreePropertyFromQueryFilter(
        [],
        [{ bool: { must: [mustNotTerm('tag1'), mustNotTerm('tag2')] } }]
      )
    );

    expect(rule.type).toBe('rule');
    expect(rule.properties.field).toBe(FIELD);
    expect(rule.properties.operator).toBe('select_not_any_in');
    expect(rule.properties.value).toEqual([['tag1', 'tag2']]);
  });

  it('still reads the legacy OR-ed shape as a Not in rule', () => {
    const rule = firstRule(
      getJsonTreePropertyFromQueryFilter(
        [],
        [{ bool: { should: [mustNotTerm('tag1'), mustNotTerm('tag2')] } }]
      )
    );

    expect(rule.properties.operator).toBe('select_not_any_in');
    expect(rule.properties.value).toEqual([['tag1', 'tag2']]);
  });

  it('keeps negated terms on different fields as separate conditions', () => {
    const result = getJsonTreePropertyFromQueryFilter(
      [],
      [
        {
          bool: {
            must: [
              mustNotTerm('tag1'),
              {
                bool: {
                  must_not: { term: { 'owners.displayName.keyword': 'x' } },
                },
              } as QueryFieldInterface,
            ],
          },
        },
      ]
    );

    expect(Object.values(result)).toHaveLength(2);
    expect(
      Object.values(result).map(
        (entry) =>
          (entry as { properties: { operator: string } }).properties.operator
      )
    ).toEqual(['select_not_equals', 'select_not_equals']);
  });
});
