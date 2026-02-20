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
import { SearchIndex } from '../enums/search.enum';
import { JSONLogicSearchClassBase } from './JSONLogicSearchClassBase';

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
      const result = (dateWidget as ExtendedWidget).jsonLogic!.call(
        mockContext,
        mockDate
      );

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
      const result2 = (dateWidget as ExtendedWidget).jsonLogicImport!.call(
        mockContext2,
        timestamp
      );

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
    it('should handle array_not_contains logic reversal', () => {
      const logic = {
        '!': {
          contains: ['field_value', 'search_term'],
        },
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          logic
        );

      expect(result).toBeDefined();
      // The function should return appropriate logic for reversing not_contains operations
    });

    it('should handle complex nested logic structures', () => {
      const complexLogic = {
        and: [
          { '==': ['field1', 'value1'] },
          {
            '!': {
              contains: ['array_field', 'excluded_value'],
            },
          },
        ],
      };

      const result =
        jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
          complexLogic
        );

      expect(result).toBeDefined();
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
