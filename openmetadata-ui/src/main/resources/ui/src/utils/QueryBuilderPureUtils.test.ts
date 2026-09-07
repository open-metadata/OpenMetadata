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
import { getSelectEqualsNotEqualsProperties } from './QueryBuilderPureUtils';

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
