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
import { MULTISELECT_FIELD_OPERATORS } from '../constants/AdvancedSearch.constants';
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

describe('getCustomPropertiesSubFields', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;
  const mockGetEntityName = getEntityName as jest.Mock;
  const mockGetCustomPropertyAdvanceSearchEnumOptions =
    getCustomPropertyAdvanceSearchEnumOptions as jest.Mock;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
    jest.clearAllMocks();
  });

  it('should return correct configuration for enum type custom property', () => {
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
      subfieldsKey: 'statusField',
      dataObject: {
        type: 'multiselect',
        label: mockLabel,
        operators: MULTISELECT_FIELD_OPERATORS,
        fieldSettings: {
          listValues: mockEnumOptions,
        },
      },
    });
  });
});

describe('elasticSearchFormatValue for text widget', () => {
  let advancedSearchClassBase: AdvancedSearchClassBase;

  beforeEach(() => {
    advancedSearchClassBase = new AdvancedSearchClassBase();
  });

  it('should format regexp operator correctly without double nesting', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue(
      'regexp',
      ['gold.*'],
      'regexp',
      'databaseSchema.displayName.keyword'
    );

    expect(result).toEqual({
      'databaseSchema.displayName.keyword': {
        value: 'gold.*',
        case_insensitive: true,
      },
    });

    // Ensure it does NOT have double-nested regexp key
    expect(result).not.toHaveProperty('regexp');
  });

  it('should format equal operator correctly', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue('term', ['testValue'], 'equal', 'fieldName');

    expect(result).toEqual({
      fieldName: 'testValue',
    });
  });

  it('should format like operator correctly', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue('wildcard', ['testValue'], 'like', 'fieldName');

    expect(result).toEqual({
      fieldName: { value: '*testValue*' },
    });
  });

  it('should format not_like operator correctly', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue(
      'wildcard',
      ['testValue'],
      'not_like',
      'fieldName'
    );

    expect(result).toEqual({
      wildcard: { fieldName: { value: '*testValue*' } },
    });
  });

  it('should format not_equal operator correctly', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue('term', ['testValue'], 'not_equal', 'fieldName');

    expect(result).toEqual({
      term: { fieldName: 'testValue' },
    });
  });

  it('should format is_null operator correctly', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue('exists', [], 'is_null', 'fieldName');

    expect(result).toEqual({
      field: 'fieldName',
    });
  });

  it('should format is_not_null operator correctly', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue('exists', [], 'is_not_null', 'fieldName');

    expect(result).toEqual({
      field: 'fieldName',
    });
  });

  it('should lowercase extension field values', () => {
    const formatValue =
      advancedSearchClassBase.configWidgets.text.elasticSearchFormatValue;
    const result = formatValue(
      'term',
      ['TestValue'],
      'equal',
      'extension.customField'
    );

    expect(result).toEqual({
      'extension.customField': 'testvalue',
    });
  });
});
