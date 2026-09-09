/*
 *  Copyright 2024 Collate.
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
  Config,
  ImmutableTree,
  Utils as QbUtils,
} from '@react-awesome-query-builder/ui';
import { SearchIndex } from '../enums/search.enum';
import { JSONLogicSearchClassBase } from './JSONLogicSearchClassBase';
import {
  fromLegacyTableColumnJsonLogic,
  toLegacyTableColumnJsonLogic,
} from './QueryBuilderPureUtils';

const TABLE_CP_COLUMN = 'extension.testTableCp.rows.name';

// Define extended widget interface for testing widget properties
interface ExtendedWidget {
  jsonLogic?: (...args: unknown[]) => unknown;
  jsonLogicImport?: (...args: unknown[]) => unknown;
  showSearch?: boolean;
  showCheckboxes?: boolean;
  useAsyncSearch?: boolean;
  useLoadMore?: boolean;
  customProps?: {
    popupClassName?: string;
  };
}

jest.mock('../rest/miscAPI', () => ({
  getAggregateFieldOptions: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {},
    })
  ),
}));

jest.mock('./AdvancedSearchUtils', () => ({
  getTierOptions: jest.fn().mockResolvedValue([]),
}));

describe('JSONLogicSearchClassBase', () => {
  let jsonLogicSearchClassBase: JSONLogicSearchClassBase;

  beforeEach(() => {
    jsonLogicSearchClassBase = new JSONLogicSearchClassBase();
  });

  describe('configOperators', () => {
    it('should include sqlOp property for regexp operator', () => {
      const regexpOperator = jsonLogicSearchClassBase.configOperators.regexp;

      expect(regexpOperator).toBeDefined();
      expect(regexpOperator.sqlOp).toBe('REGEXP');
      expect(regexpOperator.elasticSearchQueryType).toBe('regexp');
      expect(regexpOperator.valueSources).toEqual(['value']);
    });

    it('should have correct configuration for like operator', () => {
      const likeOperator = jsonLogicSearchClassBase.configOperators.like;

      expect(likeOperator).toBeDefined();
      expect(likeOperator.elasticSearchQueryType).toBe('wildcard');
    });

    it('should have custom operators for reviewers and owners', () => {
      const isReviewerOperator =
        jsonLogicSearchClassBase.configOperators.isReviewer;
      const isOwnerOperator = jsonLogicSearchClassBase.configOperators.isOwner;

      expect(isReviewerOperator).toBeDefined();
      expect(isReviewerOperator.jsonLogic).toBe('isReviewer');
      expect(isReviewerOperator.sqlOp).toBe('IS REVIEWER');
      expect(isReviewerOperator.cardinality).toBe(0);

      expect(isOwnerOperator).toBeDefined();
      expect(isOwnerOperator.jsonLogic).toBe('isOwner');
      expect(isOwnerOperator.sqlOp).toBe('IS OWNER');
      expect(isOwnerOperator.cardinality).toBe(0);
    });

    it('should have array operators for multiselect fields', () => {
      const arrayContains =
        jsonLogicSearchClassBase.configOperators.array_contains;
      const arrayNotContains =
        jsonLogicSearchClassBase.configOperators.array_not_contains;

      expect(arrayContains).toBeDefined();
      expect(arrayContains.jsonLogic).toBe('contains');
      expect(arrayContains.cardinality).toBe(1);
      expect(arrayContains.valueTypes).toEqual(['multiselect', 'select']);

      expect(arrayNotContains).toBeDefined();
      expect(arrayNotContains.reversedOp).toBe('array_contains');
      expect(arrayNotContains.valueTypes).toEqual(['multiselect', 'select']);
    });

    it('should have proper labels for operators', () => {
      const {
        equal,
        not_equal,
        select_equals,
        select_not_equals,
        is_null,
        is_not_null,
      } = jsonLogicSearchClassBase.configOperators;

      expect(equal.label).toContain('label.is');
      expect(not_equal.label).toContain('label.is-not');
      expect(select_equals.label).toContain('label.is');
      expect(select_not_equals.label).toContain('label.is-not');
      expect(is_null.label).toContain('label.is-not-set');
      expect(is_not_null.label).toContain('label.is-set');
    });

    it('should have table_field_* operators for table-cp columns', () => {
      const valueOps = [
        'table_field_equal',
        'table_field_not_equal',
        'table_field_like',
        'table_field_not_like',
      ];

      valueOps.forEach((key) => {
        const operator = jsonLogicSearchClassBase.configOperators[key];

        expect(operator).toBeDefined();
        expect(operator.cardinality).toBe(1);
        expect(operator.valueSources).toEqual(['value']);
        expect(typeof operator.jsonLogic).toBe('function');
        expect(valueOps).toContain(operator.reversedOp);
      });
    });

    it('should emit the field as a var node in argument zero', () => {
      // RAQB's jsonLogic importer reads the field from argument zero and skips any operator whose
      // argument zero is not itself a jsonLogic node, so the field must stay a `var` there.
      const field = { var: TABLE_CP_COLUMN };
      const emit = (key: string, val: unknown) =>
        (
          jsonLogicSearchClassBase.configOperators[key].jsonLogic as (
            ...args: unknown[]
          ) => Record<string, unknown>
        )(field, key, val);

      expect(emit('table_field_equal', ['john'])).toEqual({
        __tcvContains: [field, 'john'],
      });
      expect(emit('table_field_not_equal', ['john'])).toEqual({
        __tcvNotContains: [field, 'john'],
      });
      expect(emit('table_field_like', ['oh'])).toEqual({
        __tcvLike: [field, 'oh'],
      });
      expect(emit('table_field_not_like', ['oh'])).toEqual({
        __tcvNotLike: [field, 'oh'],
      });
    });
  });

  // A saved rule is loaded back into the builder with QbUtils.loadFromJsonLogic. When that import
  // fails the widget renders an empty "Rules To Check" panel, which is what the earlier
  // value-first shape did. These cases pin the import so the operators stay round-trippable.
  describe('table_field_* jsonLogic round-trip', () => {
    const buildConfig = (): Config =>
      ({
        ...jsonLogicSearchClassBase.baseConfig,
        types: jsonLogicSearchClassBase.configTypes,
        widgets: jsonLogicSearchClassBase.configWidgets,
        operators: jsonLogicSearchClassBase.configOperators,
        fields: {
          [TABLE_CP_COLUMN]: {
            type: 'text',
            label: 'testTableCp - name',
            operators: [
              'table_field_equal',
              'table_field_not_equal',
              'table_field_like',
              'table_field_not_like',
            ],
            valueSources: ['value'],
          },
        },
      } as unknown as Config);

    it.each([
      [
        'table_field_equal',
        { __tcvContains: [{ var: TABLE_CP_COLUMN }, 'john'] },
      ],
      [
        'table_field_not_equal',
        { __tcvNotContains: [{ var: TABLE_CP_COLUMN }, 'john'] },
      ],
      ['table_field_like', { __tcvLike: [{ var: TABLE_CP_COLUMN }, 'oh'] }],
      [
        'table_field_not_like',
        { __tcvNotLike: [{ var: TABLE_CP_COLUMN }, 'oh'] },
      ],
    ])('should import %s back into a single rule', (expectedOp, rule) => {
      const config = buildConfig();
      const logic = { and: [rule] };

      const tree = QbUtils.loadFromJsonLogic(logic, config);

      expect(tree).toBeDefined();

      const children = Object.values(
        QbUtils.getTree(tree as ImmutableTree).children1 ?? {}
      );

      const imported = children[0] as {
        properties?: { operator?: string; field?: string };
      };

      expect(children).toHaveLength(1);
      expect(imported.properties?.operator).toBe(expectedOp);
      expect(imported.properties?.field).toBe(TABLE_CP_COLUMN);

      // and exporting the imported tree reproduces the stored rule verbatim
      expect(
        QbUtils.jsonLogicFormat(tree as ImmutableTree, config).logic
      ).toEqual(logic);
    });

    it('should import the stored shape as zero rules without the transform', () => {
      // Why the transforms exist: in the stored shape argument zero is the compared value, not the
      // field, so RAQB matches no operator and drops the rule. The tree still comes back as a
      // truthy empty group, which is why the widget silently showed no rules at all.
      const stored = {
        and: [{ contains: ['john', { tableColumnValues: TABLE_CP_COLUMN }] }],
      };

      const tree = QbUtils.loadFromJsonLogic(stored, buildConfig());

      expect(
        Object.values(QbUtils.getTree(tree as ImmutableTree).children1 ?? {})
      ).toHaveLength(0);
    });

    // The whole point: a rule stored in the shape the rule engine evaluates renders as a real rule,
    // and saving it again reproduces that stored shape byte-for-byte.
    it.each([
      [
        'Is',
        'table_field_equal',
        {
          and: [{ contains: ['john', { tableColumnValues: TABLE_CP_COLUMN }] }],
        },
      ],
      [
        'Is not',
        'table_field_not_equal',
        {
          and: [
            {
              '!': {
                contains: ['john', { tableColumnValues: TABLE_CP_COLUMN }],
              },
            },
          ],
        },
      ],
      [
        'Contains',
        'table_field_like',
        {
          and: [
            {
              some: [
                { tableColumnValues: TABLE_CP_COLUMN },
                { contains: ['oh', { var: '' }] },
              ],
            },
          ],
        },
      ],
      [
        'Not contains',
        'table_field_not_like',
        {
          and: [
            {
              '!': {
                some: [
                  { tableColumnValues: TABLE_CP_COLUMN },
                  { contains: ['oh', { var: '' }] },
                ],
              },
            },
          ],
        },
      ],
    ])(
      'should round-trip the stored %s rule through the builder unchanged',
      (_label, expectedOp, stored) => {
        const config = buildConfig();

        const tree = QbUtils.loadFromJsonLogic(
          fromLegacyTableColumnJsonLogic(stored),
          config
        );

        expect(tree).toBeDefined();

        const children = Object.values(
          QbUtils.getTree(tree as ImmutableTree).children1 ?? {}
        );
        const imported = children[0] as {
          properties?: { operator?: string; field?: string };
        };

        expect(children).toHaveLength(1);
        expect(imported.properties?.operator).toBe(expectedOp);
        expect(imported.properties?.field).toBe(TABLE_CP_COLUMN);

        const exported = QbUtils.jsonLogicFormat(tree as ImmutableTree, config)
          .logic as Record<string, unknown>;

        expect(toLegacyTableColumnJsonLogic(exported)).toEqual(stored);
      }
    );
  });

  describe('configWidgets', () => {
    it('should have date widget with proper jsonLogic configuration', () => {
      const dateWidget = jsonLogicSearchClassBase.configWidgets.date;

      expect(dateWidget).toBeDefined();
      expect((dateWidget as ExtendedWidget).jsonLogic).toBeDefined();
      expect((dateWidget as ExtendedWidget).jsonLogicImport).toBeDefined();

      // Test jsonLogic function (converts to timestamp)
      expect((dateWidget as ExtendedWidget).jsonLogic).toBeDefined();

      const mockDate = '2024-01-01T00:00:00Z';
      // Mock the context with utils.moment
      const mockContext = {
        utils: {
          moment: {
            utc: (val: string) => ({
              valueOf: () => new Date(val).getTime(),
            }),
          },
        },
      };
      const result = (
        (dateWidget as ExtendedWidget).jsonLogic as NonNullable<
          ExtendedWidget['jsonLogic']
        >
      ).call(mockContext, mockDate);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);

      // Test jsonLogicImport function (converts from timestamp to ISO string)
      expect((dateWidget as ExtendedWidget).jsonLogicImport).toBeDefined();

      const timestamp = 1704067200000; // 2024-01-01T00:00:00Z
      const mockContext2 = {
        utils: {
          moment: {
            utc: (val: number) => ({
              toISOString: () => new Date(val).toISOString(),
            }),
          },
        },
      };
      const result2 = (
        (dateWidget as ExtendedWidget).jsonLogicImport as NonNullable<
          ExtendedWidget['jsonLogicImport']
        >
      ).call(mockContext2, timestamp);

      expect(typeof result2).toBe('string');
      expect(result2).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should have multiselect widget with proper configuration', () => {
      const multiselectWidget =
        jsonLogicSearchClassBase.configWidgets.multiselect;

      expect((multiselectWidget as ExtendedWidget).showSearch).toBe(true);
      expect((multiselectWidget as ExtendedWidget).showCheckboxes).toBe(true);
      expect((multiselectWidget as ExtendedWidget).useAsyncSearch).toBe(true);
      expect((multiselectWidget as ExtendedWidget).useLoadMore).toBe(false);
      expect(
        (multiselectWidget as ExtendedWidget).customProps?.popupClassName
      ).toBe('w-max-600');
    });

    it('should have select widget with proper configuration', () => {
      const selectWidget = jsonLogicSearchClassBase.configWidgets.select;

      expect((selectWidget as ExtendedWidget).showSearch).toBe(true);
      expect((selectWidget as ExtendedWidget).showCheckboxes).toBe(true);
      expect((selectWidget as ExtendedWidget).useAsyncSearch).toBe(true);
      expect((selectWidget as ExtendedWidget).useLoadMore).toBe(false);
      expect((selectWidget as ExtendedWidget).customProps?.popupClassName).toBe(
        'w-max-600'
      );
    });
  });

  describe('configTypes', () => {
    it('should have multiselect type with array operators', () => {
      const multiselectType = jsonLogicSearchClassBase.configTypes.multiselect;

      expect(multiselectType.widgets.multiselect.operators).toContain(
        'array_contains'
      );
      expect(multiselectType.widgets.multiselect.operators).toContain(
        'array_not_contains'
      );
      expect(multiselectType.widgets.text.operators).toEqual([
        'like',
        'not_like',
        'regexp',
      ]);
      expect(multiselectType.valueSources).toEqual(['value']);
    });

    it('should have select type with array operators', () => {
      const selectType = jsonLogicSearchClassBase.configTypes.select;

      expect(selectType.widgets.select.operators).toContain('array_contains');
      expect(selectType.widgets.select.operators).toContain(
        'array_not_contains'
      );
      expect(selectType.widgets.text.operators).toEqual([
        'like',
        'not_like',
        'regexp',
      ]);
      expect(selectType.valueSources).toEqual(['value']);
    });

    it('should have text and date types with proper valueSources', () => {
      const textType = jsonLogicSearchClassBase.configTypes.text;
      const dateType = jsonLogicSearchClassBase.configTypes.date;

      expect(textType.valueSources).toEqual(['value']);
      expect(dateType.valueSources).toEqual(['value']);
    });

    it('should register table_field_* operators on the text widget so the value editor renders', () => {
      const textType = jsonLogicSearchClassBase.configTypes.text;

      expect(textType.widgets.text.operators).toEqual(
        expect.arrayContaining([
          'table_field_equal',
          'table_field_not_equal',
          'table_field_like',
          'table_field_not_like',
        ])
      );
    });
  });

  describe('getQbConfigs', () => {
    it('should return config with proper operators for non-explore page', () => {
      const config = jsonLogicSearchClassBase.getQbConfigs(
        [SearchIndex.TABLE],
        false
      );

      expect(config.operators.equal.label).toContain('label.is');
      expect(config.operators.not_equal.label).toContain('label.is-not');
      expect(config.operators.is_null.label).toContain('label.is-not-set');
      expect(config.operators.is_not_null.label).toContain('label.is-set');
    });

    it('should return config with original labels for explore page', () => {
      const config = jsonLogicSearchClassBase.getQbConfigs(
        [SearchIndex.TABLE],
        true
      );

      // For explore page, labels should be original from base config
      expect(config.settings.showLabels).toBe(true);
    });

    it('should include fields configuration', () => {
      const config = jsonLogicSearchClassBase.getQbConfigs([SearchIndex.TABLE]);

      expect(config.fields).toBeDefined();
      expect(Object.keys(config.fields).length).toBeGreaterThan(0);
    });
  });

  describe('getNegativeQueryForNotContainsReverserOperation', () => {
    it('should lift negation out of some for array_not_contains (contains shape)', () => {
      const logic = {
        some: [
          { var: 'tags' },
          { '!': { contains: [{ var: 'tagFQN' }, ['Tag1']] } },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual({
        '!': {
          some: [{ var: 'tags' }, { contains: [{ var: 'tagFQN' }, ['Tag1']] }],
        },
      });
    });

    it('should lift negation out of some for select_not_any_in (in shape)', () => {
      const logic = {
        some: [
          { var: 'dataProducts' },
          {
            '!': {
              in: [{ var: 'fullyQualifiedName' }, ['TestDataProduct']],
            },
          },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual({
        '!': {
          some: [
            { var: 'dataProducts' },
            { in: [{ var: 'fullyQualifiedName' }, ['TestDataProduct']] },
          ],
        },
      });
    });

    it('should handle and-combined rules where one uses select_not_any_in', () => {
      const logic = {
        and: [
          { '==': [{ var: 'name' }, 'foo'] },
          {
            some: [
              { var: 'dataProducts' },
              {
                '!': {
                  in: [{ var: 'fullyQualifiedName' }, ['TestDataProduct']],
                },
              },
            ],
          },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual({
        and: [
          { '==': [{ var: 'name' }, 'foo'] },
          {
            '!': {
              some: [
                { var: 'dataProducts' },
                { in: [{ var: 'fullyQualifiedName' }, ['TestDataProduct']] },
              ],
            },
          },
        ],
      });
    });

    it('should leave unrelated logic unchanged', () => {
      const logic = { '==': [{ var: 'status' }, 'active'] };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual(logic);
    });

    it('should lift negation out of some for is_null (Is Not Set) on a group field', () => {
      const logic = {
        some: [
          { var: 'owners' },
          { '==': [{ var: 'fullyQualifiedName' }, null] },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual({
        '!': {
          some: [
            { var: 'owners' },
            { '!=': [{ var: 'fullyQualifiedName' }, null] },
          ],
        },
      });
    });

    it('should handle and-combined rules where one uses is_null on a group field', () => {
      const logic = {
        and: [
          { '==': [{ var: 'name' }, 'foo'] },
          {
            some: [
              { var: 'domain' },
              { '==': [{ var: 'fullyQualifiedName' }, null] },
            ],
          },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual({
        and: [
          { '==': [{ var: 'name' }, 'foo'] },
          {
            '!': {
              some: [
                { var: 'domain' },
                { '!=': [{ var: 'fullyQualifiedName' }, null] },
              ],
            },
          },
        ],
      });
    });

    it('should not alter a "some" whose condition compares to a non-null value', () => {
      const logic = {
        some: [
          { var: 'owners' },
          { '==': [{ var: 'fullyQualifiedName' }, 'x'] },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toEqual(logic);
    });
  });

  describe('mainWidgetProps', () => {
    it('should have correct main widget properties', () => {
      const props = jsonLogicSearchClassBase.mainWidgetProps;

      expect(props.fullWidth).toBe(true);
      expect(props.valueLabel).toContain('label.criteria');
    });
  });
});
