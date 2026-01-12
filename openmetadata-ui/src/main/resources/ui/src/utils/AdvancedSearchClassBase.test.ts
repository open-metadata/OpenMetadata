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
import { Config, ConfigContext } from '@react-awesome-query-builder/core';
import {
  MULTISELECT_FIELD_OPERATORS,
  NUMBER_FIELD_OPERATORS,
  TEXT_FIELD_OPERATORS,
} from '../constants/AdvancedSearch.constants';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import { CustomPropertySummary } from '../rest/metadataTypeAPI.interface';
import { AdvancedSearchClassBase } from './AdvancedSearchClassBase';
import { getCustomPropertyAdvanceSearchEnumOptions } from './AdvancedSearchUtils';
import { getEntityName } from './EntityUtils';

jest.mock('../rest/miscAPI', () => ({
  getAggregateFieldOptions: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {},
    })
  ),
}));

jest.mock('./JSONLogicSearchClassBase', () => ({
  getQueryBuilderFields: jest.fn(),
}));

jest.mock('./EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('./AdvancedSearchUtils', () => ({
  getCustomPropertyAdvanceSearchEnumOptions: jest.fn(),
}));

describe('AdvancedSearchClassBase', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('getCommonConfig function should return expected fields', () => {
    const result = advancedSearchClassBase.getCommonConfig({});

    expect(Object.keys(result)).toEqual([
      EntityFields.DISPLAY_NAME_KEYWORD,
      EntityFields.NAME_KEYWORD,
      'deleted',
      EntityFields.OWNERS,
      EntityFields.DOMAINS,
      EntityFields.DATA_PRODUCT,
      'serviceType',
      EntityFields.TAG,
      EntityFields.CERTIFICATION,
      EntityFields.TIER,
      'extension',
      'descriptionStatus',
      EntityFields.ENTITY_TYPE,
      'descriptionSources.Suggested',
      'tags.labelType',
      'tier.labelType',
      'createdBy',
    ]);
  });
});

describe('getEntitySpecificQueryBuilderFields', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('should return table specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TABLE,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.DATABASE,
      EntityFields.DATABASE_SCHEMA,
      EntityFields.TABLE_TYPE,
      EntityFields.COLUMN_DESCRIPTION_STATUS,
    ]);
  });

  it('should return pipeline specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.PIPELINE,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.TASK]);
  });

  it('should return dashboard specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.DASHBOARD,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.DATA_MODEL,
      EntityFields.CHART,
      EntityFields.PROJECT,
    ]);
  });

  it('should return topic specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TOPIC,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.SCHEMA_FIELD]);
  });

  it('should return mlModel specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.MLMODEL,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.FEATURE]);
  });

  it('should return container specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.CONTAINER,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.CONTAINER_COLUMN]);
  });

  it('should return searchIndex specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.SEARCH_INDEX,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.FIELD]);
  });

  it('should return dataModel specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.DASHBOARD_DATA_MODEL,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.DATA_MODEL_TYPE,
      EntityFields.PROJECT,
    ]);
  });

  it('should return apiEndpoint specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.API_ENDPOINT_INDEX,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.API_COLLECTION,
      EntityFields.REQUEST_SCHEMA_FIELD,
      EntityFields.RESPONSE_SCHEMA_FIELD,
    ]);
  });

  it('should return glossary specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.GLOSSARY_TERM,
    ]);

    expect(Object.keys(result)).toEqual([
      EntityFields.GLOSSARY_TERM_STATUS,
      EntityFields.GLOSSARY,
    ]);
  });

  it('should return databaseSchema specific fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.DATABASE_SCHEMA,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.DATABASE]);
  });

  it('should return empty fields for multiple indices with no common fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TABLE,
      SearchIndex.PIPELINE,
    ]);

    expect(Object.keys(result)).toEqual([]);
  });

  it('should return combined fields for multiple indices with common fields', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      SearchIndex.TABLE,
      SearchIndex.DATABASE_SCHEMA,
    ]);

    expect(Object.keys(result)).toEqual([EntityFields.DATABASE]);
  });

  it('should return empty object for unknown index', () => {
    const result = advancedSearchClassBase.getEntitySpecificQueryBuilderFields([
      'UNKNOWN_INDEX' as SearchIndex,
    ]);

    expect(Object.keys(result)).toEqual([]);
  });
});

describe('elasticSearchFormatValue function', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('should format regexp operator correctly without nested regexp object', () => {
    const textWidget = advancedSearchClassBase.configWidgets.text;
    const formatValue = textWidget.elasticSearchFormatValue;

    expect(formatValue).toBeDefined();

    const mockContext = { utils: {}, W: {}, O: {} } as ConfigContext;
    const result = formatValue!.call(
      mockContext,
      'text',
      ['test.*pattern'],
      'regexp',
      'testField',
      {} as Config
    );

    expect(result).toEqual({
      testField: { value: 'test.*pattern', case_insensitive: true },
    });
  });

  it('should handle is_null operator correctly', () => {
    const textWidget = advancedSearchClassBase.configWidgets.text;
    const formatValue = textWidget.elasticSearchFormatValue;

    expect(formatValue).toBeDefined();

    const mockContext = { utils: {}, W: {}, O: {} } as ConfigContext;
    const result = formatValue!.call(
      mockContext,
      'text',
      [],
      'is_null',
      'testField',
      {} as Config
    );

    expect(result).toEqual({
      field: 'testField',
    });
  });

  it('should handle is_not_null operator correctly', () => {
    const textWidget = advancedSearchClassBase.configWidgets.text;
    const formatValue = textWidget.elasticSearchFormatValue;

    expect(formatValue).toBeDefined();

    const mockContext = { utils: {}, W: {}, O: {} } as ConfigContext;
    const result = formatValue!.call(
      mockContext,
      'text',
      [],
      'is_not_null',
      'testField',
      {} as Config
    );

    expect(result).toEqual({
      field: 'testField',
    });
  });
});

describe('configOperators', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('should include sqlOp property for regexp operator', () => {
    const regexpOperator = advancedSearchClassBase.configOperators.regexp;

    expect(regexpOperator).toBeDefined();
    expect(regexpOperator.sqlOp).toBe('REGEXP');
    expect(regexpOperator.elasticSearchQueryType).toBe('regexp');
    expect(regexpOperator.valueSources).toEqual(['value']);
  });

  it('should have correct configuration for like operator', () => {
    const likeOperator = advancedSearchClassBase.configOperators.like;

    expect(likeOperator).toBeDefined();
    expect(likeOperator.elasticSearchQueryType).toBe('wildcard');
  });
});

describe('getCustomPropertiesSubFields', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;
  const mockGetEntityName = getEntityName as jest.Mock;
  const mockGetCustomPropertyAdvanceSearchEnumOptions =
    getCustomPropertyAdvanceSearchEnumOptions as jest.Mock;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
    jest.clearAllMocks();
  });

  it('should return correct configuration for enum type custom property with keyword suffix', () => {
    const mockField = {
      name: 'statusField',
      type: 'enum',
      customPropertyConfig: {
        config: {
          values: ['ACTIVE', 'INACTIVE', 'PENDING'],
        },
      },
    };

    const mockLabel = 'Status Field';
    const mockEnumOptions = [
      { value: 'ACTIVE', title: 'Active' },
      { value: 'INACTIVE', title: 'Inactive' },
      { value: 'PENDING', title: 'Pending' },
    ];

    mockGetEntityName.mockReturnValue(mockLabel);
    mockGetCustomPropertyAdvanceSearchEnumOptions.mockReturnValue(
      mockEnumOptions
    );

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(mockGetEntityName).toHaveBeenCalledWith(mockField);
    expect(mockGetCustomPropertyAdvanceSearchEnumOptions).toHaveBeenCalledWith([
      'ACTIVE',
      'INACTIVE',
      'PENDING',
    ]);

    expect(result).toEqual({
      subfieldsKey: 'statusField.keyword',
      dataObject: {
        type: 'multiselect',
        label: mockLabel,
        operators: MULTISELECT_FIELD_OPERATORS,
        fieldSettings: {
          listValues: mockEnumOptions,
          showSearch: true,
          useAsyncSearch: false,
        },
      },
    });
  });

  it('should return correct configuration for entityReference type with displayName.keyword suffix', () => {
    const mockField = {
      name: 'ownerField',
      type: 'entityReference',
    };

    const mockLabel = 'Owner Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'ownerField.displayName.keyword',
      dataObject: {
        type: 'select',
        label: mockLabel,
        fieldSettings: {
          asyncFetch: expect.any(Function),
          useAsyncSearch: true,
        },
      },
    });
  });

  it('should return correct configuration for array<entityReference> type with displayName.keyword suffix', () => {
    const mockField = {
      name: 'ownersField',
      type: 'array<entityReference>',
    };

    const mockLabel = 'Owners Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'ownersField.displayName.keyword',
      dataObject: {
        type: 'select',
        label: mockLabel,
        fieldSettings: {
          asyncFetch: expect.any(Function),
          useAsyncSearch: true,
        },
      },
    });
  });

  it('should return correct configuration for date-cp type with keyword suffix', () => {
    const mockField = {
      name: 'dateField',
      type: 'date-cp',
    };

    const mockLabel = 'Date Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'dateField.keyword',
      dataObject: {
        type: 'date',
        label: mockLabel,
        operators: expect.any(Array),
        fieldSettings: {
          valueFormat: expect.any(String),
        },
      },
    });
  });

  it('should return correct configuration for date-cp type with custom format from customPropertyConfig', () => {
    const mockField = {
      name: 'dateField',
      type: 'date-cp',
      customPropertyConfig: {
        config: 'dd/MM/yyyy',
      },
    };

    const mockLabel = 'Date Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'dateField.keyword',
      dataObject: {
        type: 'date',
        label: mockLabel,
        operators: expect.any(Array),
        fieldSettings: {
          valueFormat: 'DD/MM/YYYY',
        },
      },
    });
  });

  it('should return correct configuration for number type without keyword suffix', () => {
    const mockField = {
      name: 'numberField',
      type: 'number',
    };

    const mockLabel = 'Number Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'numberField',
      dataObject: {
        type: 'number',
        label: mockLabel,
        operators: expect.any(Array),
      },
    });
  });

  it('should return correct configuration for integer type without keyword suffix', () => {
    const mockField = {
      name: 'integerField',
      type: 'integer',
    };

    const mockLabel = 'Integer Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'integerField',
      dataObject: {
        type: 'number',
        label: mockLabel,
        operators: expect.any(Array),
      },
    });
  });

  it('should return correct configuration for timestamp type without keyword suffix', () => {
    const mockField = {
      name: 'timestampField',
      type: 'timestamp',
    };

    const mockLabel = 'Timestamp Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'timestampField',
      dataObject: {
        type: 'number',
        label: mockLabel,
        operators: expect.any(Array),
      },
    });
  });

  it('should return correct configuration for default text type with keyword suffix', () => {
    const mockField = {
      name: 'textField',
      type: 'string',
    };

    const mockLabel = 'Text Field';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(result).toEqual({
      subfieldsKey: 'textField.keyword',
      dataObject: {
        type: 'text',
        label: mockLabel,
        valueSources: ['value'],
        operators: expect.any(Array),
      },
    });
  });

  it('should return array with start and end subfields for timeInterval type', () => {
    const mockField = {
      name: 'testInterval',
      type: 'timeInterval',
    };
    const mockLabel = 'Test Interval';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(Array.isArray(result)).toBe(true);

    if (!Array.isArray(result)) {
      return;
    }

    expect(result).toHaveLength(2);

    expect(result[0].subfieldsKey).toBe('testInterval.start');
    expect(result[0].dataObject.type).toBe('number');
    expect(result[0].dataObject.label).toContain('label.start');
    expect(result[0].dataObject.operators).toBe(NUMBER_FIELD_OPERATORS);
    expect(result[0].dataObject.fieldSettings).toEqual({ min: 0 });

    expect(result[1].subfieldsKey).toBe('testInterval.end');
    expect(result[1].dataObject.type).toBe('number');
    expect(result[1].dataObject.label).toContain('label.end');
    expect(result[1].dataObject.operators).toBe(NUMBER_FIELD_OPERATORS);
    expect(result[1].dataObject.fieldSettings).toEqual({ min: 0 });
  });

  it('should return array with subfields for each column in table-cp type', () => {
    const mockField = {
      name: 'testTable',
      type: 'table-cp',
      customPropertyConfig: {
        config: {
          columns: ['Col1', 'Col2', 'Col3'],
        },
      },
    };
    const mockLabel = 'Test Table';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(Array.isArray(result)).toBe(true);

    if (!Array.isArray(result)) {
      return;
    }

    expect(result).toHaveLength(3);

    expect(result[0].subfieldsKey).toBe('testTable.rows.Col1.keyword');
    expect(result[0].dataObject.type).toBe('text');
    expect(result[0].dataObject.label).toContain('Col1');
    expect(result[0].dataObject.operators).toBe(TEXT_FIELD_OPERATORS);
    expect(result[0].dataObject.valueSources).toEqual(['value']);

    expect(result[1].subfieldsKey).toBe('testTable.rows.Col2.keyword');
    expect(result[1].dataObject.label).toContain('Col2');

    expect(result[2].subfieldsKey).toBe('testTable.rows.Col3.keyword');
    expect(result[2].dataObject.label).toContain('Col3');
  });

  it('should return empty array when table-cp has no columns defined', () => {
    const mockField = {
      name: 'testTable',
      type: 'table-cp',
      customPropertyConfig: {
        config: {
          columns: [],
        },
      },
    };
    const mockLabel = 'Test Table';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('should return empty array when table-cp has no config', () => {
    const mockField = {
      name: 'testTable',
      type: 'table-cp',
    };
    const mockLabel = 'Test Table';
    mockGetEntityName.mockReturnValue(mockLabel);

    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      mockField as CustomPropertySummary
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});
