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

import { BasicConfig, Utils as QbUtils } from '@react-awesome-query-builder/ui';
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

// Extend BasicConfig with extension field metadata so lookupOmPropertyType
// resolves the OM type, which is required for the scoped between/not_between fix.
const configWithNumberType = {
  ...BasicConfig,
  fields: {
    ...BasicConfig.fields,
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
  ...BasicConfig,
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

// A builder pinned to one entity type (persona AI context, workflow Check
// Condition, Data Asset filters) keys custom properties without the entity-type
// segment: `extension.testCp`, not `extension.table.testCp`. Splitting
// positionally read `testCp` as the entity type and `keyword` as the property,
// so those builders produced a query that could never match.
describe('elasticSearchFormat – custom properties without an entity-type segment', () => {
  const PINNED_FIELD = 'extension.testCp.keyword';
  const DATE_VALUE = '2026-09-03';
  const NAMED_TEST_CP = '"customPropertiesTyped.name":"testCp"';
  const SCOPED_TO_TABLE = '"entityType":"table"';

  const pinnedConfig = {
    ...BasicConfig,
    fields: {
      ...BasicConfig.fields,
      extension: {
        subfields: {
          // pinned builders expose the property directly, as a leaf
          testCp: { __omPropertyType: 'date-cp' },
        },
      },
    },
  };

  const nestedQueryOf = (result) =>
    JSON.stringify(result).match(/customPropertiesTyped/g) ?? [];

  it('should build the nested customPropertiesTyped query for a pinned field', () => {
    const result = elasticSearchFormat(
      makeTree('equal', [DATE_VALUE], PINNED_FIELD),
      pinnedConfig
    );
    const json = JSON.stringify(result);

    expect(nestedQueryOf(result).length).toBeGreaterThan(0);
    expect(json).toContain(NAMED_TEST_CP);
    expect(json).toContain(DATE_VALUE);
    // `keyword` is a suffix on the field key, never the property name
    expect(json).not.toContain('"customPropertiesTyped.name":"keyword"');
  });

  // The pinned builder knows its entity type even though the field key does
  // not carry it, so the nested query must still be scoped to that type —
  // reading it off the key produced `entityType: "MigrationAccessPattern"`,
  // the property name mistaken for a type.
  it('should scope to the entity type the builder was configured with', () => {
    const json = JSON.stringify(
      elasticSearchFormat(makeTree('equal', [DATE_VALUE], PINNED_FIELD), {
        ...pinnedConfig,
        settings: { ...pinnedConfig.settings, omEntityType: 'table' },
      })
    );

    expect(json).toContain(SCOPED_TO_TABLE);
    expect(json).toContain(NAMED_TEST_CP);
  });

  it('should omit the entityType clause when no type is configured', () => {
    const json = JSON.stringify(
      elasticSearchFormat(
        makeTree('equal', [DATE_VALUE], PINNED_FIELD),
        pinnedConfig
      )
    );

    expect(json).not.toContain('"entityType"');
  });

  // A table-type property is itself a struct (`testCpTable.rows.name`), so it
  // looks exactly like an entity-type segment. Deciding from the key's shape
  // read `testCpTable` as the entity and `rows` as the property, and the query
  // matched nothing — a workflow filter reported 0 assets while the same
  // filter found 1 on Explore.
  it('should keep the whole path of a pinned table-type property', () => {
    const tableConfig = {
      ...BasicConfig,
      fields: {
        ...BasicConfig.fields,
        extension: {
          subfields: {
            // a pinned builder stores each column flat, dots and all
            'testCpTable.rows.name': { __omPropertyType: 'table-cp' },
          },
        },
      },
      settings: { ...BasicConfig.settings, omEntityType: 'table' },
    };
    const json = JSON.stringify(
      elasticSearchFormat(
        makeTree('equal', ['anuj'], 'extension.testCpTable.rows.name'),
        tableConfig
      )
    );

    expect(json).toContain(
      '"customPropertiesTyped.name":"testCpTable.rows.name"'
    );
    expect(json).toContain(SCOPED_TO_TABLE);
    expect(json).not.toContain('"customPropertiesTyped.name":"rows"');
    expect(json).not.toContain('"entityType":"testCpTable"');
    // A table column holds a string. A column named `name` ends with `.name`,
    // so it was classified as an entity reference and the query asked for
    // `refName`, which matched nothing.
    expect(json).toContain('"customPropertiesTyped.stringValue":"anuj"');
    expect(json).not.toContain('refName');
  });

  it('should still read the entity-type segment when the config nests one', () => {
    const json = JSON.stringify(
      elasticSearchFormat(
        makeTree('equal', ['2026-09-03'], 'extension.table.myDate.keyword'),
        configWithNumberType
      )
    );

    expect(json).toContain('"customPropertiesTyped.name":"myDate"');
    expect(json).toContain(SCOPED_TO_TABLE);
  });
});

describe('elasticSearchFormat – entityReference custom properties', () => {
  const refConfig = {
    ...BasicConfig,
    fields: {
      ...BasicConfig.fields,
      extension: {
        subfields: {
          apiCollection: {
            subfields: {
              'testApiCp.displayName.keyword': {
                __omPropertyType: 'entityReference',
              },
              'testApiCp.name.keyword': {
                __omPropertyType: 'entityReference',
              },
              'testApiCp.fullyQualifiedName.keyword': {
                __omPropertyType: 'array<entityReference>',
              },
            },
          },
        },
      },
    },
  };

  const REF_FIELD = 'extension.apiCollection.testApiCp.displayName.keyword';

  const queryFor = (field) =>
    JSON.stringify(
      elasticSearchFormat(
        makeTree('select_equals', ['address'], field),
        refConfig
      )
    );

  it('should read displayName from stringValue, where the indexer puts it', () => {
    const json = queryFor(REF_FIELD);

    expect(json).toContain('"customPropertiesTyped.name":"testApiCp"');
    expect(json).toContain(
      '"customPropertiesTyped.stringValue":{"value":"address"'
    );
    expect(json).not.toContain('refName');
  });

  // The picker's options come from a terms aggregation over `displayName.keyword`, which carries a
  // `lowercase_normalizer`. `customPropertiesTyped.*` has none and keeps the original case, so an
  // exact keyword term could never match the lower-cased option the user actually picked.
  it('should match a reference ignoring case', () => {
    const json = queryFor(REF_FIELD);

    expect(json).toContain('"case_insensitive":true');
  });

  it('should read name from refName', () => {
    const json = queryFor('extension.apiCollection.testApiCp.name.keyword');

    expect(json).toContain(
      '"customPropertiesTyped.refName":{"value":"address"'
    );
  });

  it('should read fullyQualifiedName from refFqn', () => {
    const json = queryFor(
      'extension.apiCollection.testApiCp.fullyQualifiedName.keyword'
    );

    expect(json).toContain('"customPropertiesTyped.refFqn":{"value":"address"');
  });

  it('should keep the property name free of the sub-field suffix', () => {
    const json = queryFor(REF_FIELD);

    expect(json).not.toContain('"customPropertiesTyped.name":"displayName"');
    expect(json).not.toContain('"customPropertiesTyped.name":"keyword"');
  });
});
