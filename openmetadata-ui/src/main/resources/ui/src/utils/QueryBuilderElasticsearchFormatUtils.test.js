/*
 *  Copyright 2025 Collate.
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
  AntdConfig,
  Utils as QbUtils,
} from '@react-awesome-query-builder/antd';
import {
  elasticSearchFormat,
  hasUnfinishedRule,
} from './QueryBuilderElasticsearchFormatUtils';

// Minimal Immutable-compatible tree stub.
// elasticSearchFormat only calls .get() on the tree and its properties map.
const makeTree = (operator, value, field = 'extension.table.myNumber') => ({
  get(key) {
    if (key === 'type') {
      return 'rule';
    }
    if (key === 'properties') {
      return {
        get(k) {
          if (k === 'field') {
            return field;
          }
          if (k === 'operator') {
            return operator;
          }
          if (k === 'value') {
            return { toJS: () => value };
          }
          if (k === 'valueSrc') {
            return { get: () => 'value' };
          }

          return undefined;
        },
      };
    }

    return undefined;
  },
});

// Extend AntdConfig with extension field metadata so lookupOmPropertyType
// resolves the OM type, which is required for the scoped between/not_between fix.
const configWithNumberType = {
  ...AntdConfig,
  fields: {
    ...AntdConfig.fields,
    extension: {
      subfields: {
        table: {
          subfields: {
            myNumber: {
              __omPropertyType: 'number',
            },
            myDateTime: {
              __omPropertyType: 'dateTime-cp',
            },
            myDate: {
              __omPropertyType: 'date-cp',
            },
          },
        },
      },
    },
  },
};

describe('elasticSearchFormat – extension number field range operators (Issue #27482)', () => {
  it('between: should include both gte and lte bounds in the nested range query', () => {
    const result = JSON.stringify(
      elasticSearchFormat(makeTree('between', [5, 20]), configWithNumberType)
    );

    expect(result).toContain('"gte":5');
    expect(result).toContain('"lte":20');
  });

  it('not_between: should wrap gte/lte range in a must_not clause', () => {
    const result = JSON.stringify(
      elasticSearchFormat(
        makeTree('not_between', [10, 50]),
        configWithNumberType
      )
    );

    expect(result).toContain('"must_not"');
    expect(result).toContain('"gte":10');
    expect(result).toContain('"lte":50');
  });
});

describe('elasticSearchFormat – extension dateTime field range operators (Issue #28829)', () => {
  it('dateTime between: should include both gte (from) and lte (to) bounds', () => {
    const result = JSON.stringify(
      elasticSearchFormat(
        makeTree(
          'between',
          ['2024-01-01 00:00:00', '2024-12-31 23:59:59'],
          'extension.table.myDateTime'
        ),
        configWithNumberType
      )
    );

    expect(result).toContain('"gte":"2024-01-01 00:00:00"');
    expect(result).toContain('"lte":"2024-12-31 23:59:59"');
    // Date strings must not be routed into numeric longValue/doubleValue ranges
    // (that raises an ES number_format_exception and fails the whole search).
    expect(result).not.toContain('customPropertiesTyped.longValue');
    expect(result).not.toContain('customPropertiesTyped.doubleValue');
  });

  it('dateTime not_between: should wrap both gte/lte bounds in a must_not clause', () => {
    const result = JSON.stringify(
      elasticSearchFormat(
        makeTree(
          'not_between',
          ['2024-01-01 00:00:00', '2024-12-31 23:59:59'],
          'extension.table.myDateTime'
        ),
        configWithNumberType
      )
    );

    expect(result).toContain('"must_not"');
    expect(result).toContain('"gte":"2024-01-01 00:00:00"');
    expect(result).toContain('"lte":"2024-12-31 23:59:59"');
  });

  it('date between: should include both gte (from) and lte (to) bounds', () => {
    const result = JSON.stringify(
      elasticSearchFormat(
        makeTree(
          'between',
          ['2024-01-01', '2024-12-31'],
          'extension.table.myDate'
        ),
        configWithNumberType
      )
    );

    expect(result).toContain('"gte":"2024-01-01"');
    expect(result).toContain('"lte":"2024-12-31"');
  });
});

describe('elasticSearchFormat – rules that are not fully entered', () => {
  // A row with a field and an operator but no value used to serialize to `{"term":{}}`, which
  // both Elasticsearch and OpenSearch reject outright ("Unexpected JSON event 'END_OBJECT'
  // instead of 'KEY_NAME'"), failing every search that carried the filter.
  it('should drop a rule whose value has not been entered yet', () => {
    const result = elasticSearchFormat(
      makeTree('equal', [undefined]),
      configWithNumberType
    );

    expect(result).toBeUndefined();
  });

  it('should not emit a bodiless clause for a half-entered rule inside a group', () => {
    const result = JSON.stringify(
      elasticSearchFormat(makeTree('select_equals', [undefined]), {
        ...configWithNumberType,
      }) ?? null
    );

    expect(result).not.toMatch(/:\{\}/);
  });

  it('should drop unentered options from a multiselect rule instead of emitting nulls', () => {
    const result = JSON.stringify(
      elasticSearchFormat(
        makeTree('multiselect_equals', [[undefined]]),
        configWithNumberType
      ) ?? null
    );

    expect(result).not.toContain('null');
  });

  it('should still build a rule once the value is entered', () => {
    const result = JSON.stringify(
      elasticSearchFormat(makeTree('equal', [7]), configWithNumberType)
    );

    expect(result).toContain('7');
    expect(result).not.toMatch(/:\{\}/);
  });
});

// Immutable-compatible group stub. hasUnfinishedRule reads .get('type') and .get('children1'),
// and walks children with .valueSeq().toArray() the same way buildEsGroup does.
const makeGroup = (rules) => ({
  get(key) {
    if (key === 'type') {
      return 'group';
    }
    if (key === 'children1') {
      return { valueSeq: () => ({ toArray: () => rules }) };
    }

    return undefined;
  },
});

const makeBlankRule = () => ({
  get(key) {
    if (key === 'type') {
      return 'rule';
    }
    if (key === 'properties') {
      return { get: () => undefined };
    }

    return undefined;
  },
});

describe('hasUnfinishedRule', () => {
  it('should report a rule whose value has not been entered', () => {
    expect(
      hasUnfinishedRule(makeTree('equal', [undefined]), configWithNumberType)
    ).toBe(true);
  });

  // The query builder creates and keeps blank rows on its own (shouldCreateEmptyGroup, and
  // removeEmptyRulesOnLoad is off), and "Add condition" leaves one behind. They add no constraint
  // and always have been dropped, so flagging them would block saves that have always worked.
  it('should accept a row with no field picked at all', () => {
    expect(hasUnfinishedRule(makeBlankRule(), configWithNumberType)).toBe(
      false
    );
  });

  it('should accept a group holding an entered rule beside a blank row', () => {
    const group = makeGroup([makeTree('equal', [7]), makeBlankRule()]);

    expect(hasUnfinishedRule(group, configWithNumberType)).toBe(false);
  });

  it('should report a multiselect rule with no option picked', () => {
    expect(
      hasUnfinishedRule(
        makeTree('multiselect_equals', [[undefined]]),
        configWithNumberType
      )
    ).toBe(true);
  });

  it('should accept a fully entered rule', () => {
    expect(
      hasUnfinishedRule(makeTree('equal', [7]), configWithNumberType)
    ).toBe(false);
  });

  // "Empty selects every entity of the configured type" is documented behaviour, so a filter with
  // no conditions has to stay saveable.
  it('should accept a group with no conditions at all', () => {
    expect(hasUnfinishedRule(makeGroup([]), configWithNumberType)).toBe(false);
  });

  it('should accept an undefined tree', () => {
    expect(hasUnfinishedRule(undefined, configWithNumberType)).toBe(false);
  });

  it('should find an unfinished rule nested inside a group', () => {
    const group = makeGroup([
      makeTree('equal', [7]),
      makeTree('equal', [undefined]),
    ]);

    expect(hasUnfinishedRule(group, configWithNumberType)).toBe(true);
  });

  it('should accept a group whose conditions are all entered', () => {
    const group = makeGroup([makeTree('equal', [7]), makeTree('equal', [9])]);

    expect(hasUnfinishedRule(group, configWithNumberType)).toBe(false);
  });
});

// The cases above all use `extension.*` fields, which return from buildEsRule through
// buildExtensionQuery before the widget is ever resolved. A plain field goes the other way and
// needs the config the widget lookup expects, so it is the one that exposes issue #31564.
const SELECT_FIELD = 'service.displayName.keyword';
const SELECT_VALUE = 'banking-bigquery';

const selectFieldConfig = {
  ...AntdConfig,
  fields: {
    [SELECT_FIELD]: {
      label: 'Service',
      type: 'select',
      fieldSettings: {
        listValues: { [SELECT_VALUE]: SELECT_VALUE },
      },
    },
  },
};

const loadSelectTree = (operator, value, valueType) =>
  QbUtils.checkTree(
    QbUtils.loadTree({
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        'bbbbbbbb-2222-4222-8222-222222222222': {
          type: 'rule',
          id: 'bbbbbbbb-2222-4222-8222-222222222222',
          properties: {
            field: SELECT_FIELD,
            operator,
            value,
            valueSrc: ['value'],
            valueType: [valueType],
          },
        },
      },
    }),
    selectFieldConfig
  );

const firstRuleOf = (tree) => tree.get('children1').valueSeq().toArray()[0];

describe('elasticSearchFormat – rule node reached directly (Issue #31564)', () => {
  it('should build the same clause for a rule whether it is reached through its group or on its own', () => {
    const tree = loadSelectTree('select_equals', [SELECT_VALUE], 'select');
    const clause = { term: { [SELECT_FIELD]: SELECT_VALUE } };

    expect(
      elasticSearchFormat(firstRuleOf(tree), selectFieldConfig)
    ).toStrictEqual(clause);
    expect(elasticSearchFormat(tree, selectFieldConfig)).toStrictEqual({
      bool: { must: [clause] },
    });
  });
});

describe('hasUnfinishedRule – entered rules on plain fields (Issue #31564)', () => {
  it('should accept an entered single-value select condition', () => {
    const tree = loadSelectTree('select_equals', [SELECT_VALUE], 'select');

    expect(hasUnfinishedRule(tree, selectFieldConfig)).toBe(false);
  });

  it('should accept an entered multiselect condition', () => {
    const tree = loadSelectTree(
      'select_any_in',
      [[SELECT_VALUE]],
      'multiselect'
    );

    expect(hasUnfinishedRule(tree, selectFieldConfig)).toBe(false);
  });

  it('should still report a single-value select condition with no value entered', () => {
    const tree = loadSelectTree('select_equals', [undefined], 'select');

    expect(hasUnfinishedRule(tree, selectFieldConfig)).toBe(true);
  });
});
