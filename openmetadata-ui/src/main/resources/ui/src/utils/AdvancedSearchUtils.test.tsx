/*
 *  Copyright 2022 Collate.
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

import { FieldOrGroup } from '@react-awesome-query-builder/antd';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { AssetsOfEntity } from '../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  COMMON_DROPDOWN_ITEMS,
  DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS,
  GLOSSARY_ASSETS_DROPDOWN_ITEMS,
  LINEAGE_DROPDOWN_ITEMS,
  TAG_ASSETS_DROPDOWN_ITEMS,
} from '../constants/AdvancedSearch.constants';
import {
  EntityFields,
  EntityReferenceFields,
} from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import advancedSearchClassBase from './AdvancedSearchClassBase';
import {
  getAssetsPageQuickFilters,
  getChartsOptions,
  getColumnsOptions,
  getEmptyJsonTree,
  getEmptyJsonTreeForQueryBuilder,
  getOptionsFromAggregationBucket,
  getSchemaFieldOptions,
  getSearchDropdownLabels,
  getSearchLabel,
  getSelectedOptionLabelString,
  getServiceOptions,
  getTasksOptions,
  processCustomPropertyField,
  processEntityTypeFields,
} from './AdvancedSearchUtils';
import {
  highlightedItemLabel,
  mockBucketOptions,
  mockGetChartsOptionsData,
  mockGetChartsOptionsDataWithoutDN,
  mockGetChartsOptionsDataWithoutNameDN,
  mockGetColumnOptionsData,
  mockGetColumnOptionsDataWithoutDN,
  mockGetSchemaFieldOptionsData,
  mockGetSchemaFieldOptionsDataWithoutDN,
  mockGetServiceOptionData,
  mockGetServiceOptionDataWithoutDN,
  mockGetServiceOptionDataWithoutNameDN,
  mockGetTasksOptionsData,
  mockGetTasksOptionsDataWithoutDN,
  mockItemLabel,
  mockLongOptionsArray,
  mockOptionsArray,
  mockShortOptionsArray,
} from './mocks/AdvancedSearchUtils.mock';

jest.mock('./AdvancedSearchClassBase', () => ({
  __esModule: true,
  default: {
    getCustomPropertiesSubFields: jest.fn(),
  },
}));

const mockUuid = jest.fn();
let uuidCounter = 0;

jest.mock('@react-awesome-query-builder/antd', () => ({
  ...jest.requireActual('@react-awesome-query-builder/antd'),
  Utils: {
    uuid: () => mockUuid(),
  },
}));

describe('AdvancedSearchUtils tests', () => {
  beforeEach(() => {
    uuidCounter = 0;
    mockUuid.mockImplementation(() => {
      uuidCounter++;

      return `test-uuid-${uuidCounter}`;
    });
  });

  it('Function getSearchDropdownLabels should return menuItems for passed options', () => {
    const resultMenuItems = getSearchDropdownLabels(mockOptionsArray, true);

    expect(resultMenuItems).toHaveLength(4);
  });

  it('Function getSearchDropdownLabels should return an empty array if passed 1st argument as other than array', () => {
    const resultMenuItems = getSearchDropdownLabels(
      '' as unknown as SearchDropdownOption[],
      true
    );

    expect(resultMenuItems).toHaveLength(0);
  });

  it('Function getSearchDropdownLabels should return menuItems for passed options if third argument is passed', () => {
    const resultMenuItems = getSearchDropdownLabels(
      mockOptionsArray,
      true,
      'option'
    );

    expect(resultMenuItems).toHaveLength(4);
  });

  it('Function getSelectedOptionLabelString should return all options if the length of resultant string is less than 15', () => {
    const resultOptionsString = getSelectedOptionLabelString(
      mockShortOptionsArray
    );

    expect(resultOptionsString).toBe('str1, str2');
  });

  it('Function getSelectedOptionLabelString should return string with ellipsis if the length of resultant string is more than 15', () => {
    const resultOptionsString =
      getSelectedOptionLabelString(mockLongOptionsArray);

    expect(resultOptionsString).toBe('string1, st...');
  });

  it('Function getSelectedOptionLabelString should return an empty string when passed anything else than string array as an argument', () => {
    const resultOptionsString = getSelectedOptionLabelString(
      'invalidInput' as unknown as SearchDropdownOption[]
    );

    expect(resultOptionsString).toBe('');
  });

  it('Function getSearchLabel should return string with highlighted substring for matched searchKey', () => {
    const resultSearchLabel = getSearchLabel(mockItemLabel, 'wa');

    expect(resultSearchLabel).toBe(highlightedItemLabel);
  });

  it('Function getSearchLabel should return original string if searchKey is not matched', () => {
    const resultSearchLabel = getSearchLabel(mockItemLabel, 'wo');

    expect(resultSearchLabel).toBe(mockItemLabel);
  });

  it('Function getSearchLabel should return original string if searchKey is passed as an empty string', () => {
    const resultSearchLabel = getSearchLabel(mockItemLabel, '');

    expect(resultSearchLabel).toBe(mockItemLabel);
  });

  it('Function getServiceOptions should return displayName of the service', () => {
    const resultGetServiceOptions = getServiceOptions(mockGetServiceOptionData);

    expect(resultGetServiceOptions).toBe('sample_data display');
  });

  it('Function getServiceOptions should return name of the service if no display name present', () => {
    const resultGetServiceOptions = getServiceOptions(
      mockGetServiceOptionDataWithoutDN
    );

    expect(resultGetServiceOptions).toBe('sample_data');
  });

  it('Function getServiceOptions should return text value in case not name or display name of service present', () => {
    const resultGetServiceOptions = getServiceOptions(
      mockGetServiceOptionDataWithoutNameDN
    );

    expect(resultGetServiceOptions).toBe('sample_data text');
  });

  it('Function getColumnsOptions should return displayName of the column', () => {
    const resultGetColumnsOptions = getColumnsOptions(
      mockGetColumnOptionsData,
      SearchIndex.TABLE
    );

    expect(resultGetColumnsOptions).toBe('ad_id display');
  });

  it('Function getColumnsOptions should return name of the column if no display name present', () => {
    const resultGetColumnsOptions = getColumnsOptions(
      mockGetColumnOptionsDataWithoutDN,
      SearchIndex.TABLE
    );

    expect(resultGetColumnsOptions).toBe('ad_id');
  });

  it('Function getSchemaFieldOptions should return displayName of the schemaField', () => {
    const resultGetSchemaFieldOptions = getSchemaFieldOptions(
      mockGetSchemaFieldOptionsData
    );

    expect(resultGetSchemaFieldOptions).toBe('AddressBook display');
  });

  it('Function getSchemaFieldOptions should return name of the schemaField if no display name present', () => {
    const resultGetSchemaFieldOptions = getSchemaFieldOptions(
      mockGetSchemaFieldOptionsDataWithoutDN
    );

    expect(resultGetSchemaFieldOptions).toBe('AddressBook');
  });

  it('Function getTasksOptions should return displayName of the Task', () => {
    const resultGetTasksOptionsOptions = getTasksOptions(
      mockGetTasksOptionsData
    );

    expect(resultGetTasksOptionsOptions).toBe('task display');
  });

  it('Function getTasksOptions should return name of the Task if no display name present', () => {
    const resultGetTasksOptionsOptions = getTasksOptions(
      mockGetTasksOptionsDataWithoutDN
    );

    expect(resultGetTasksOptionsOptions).toBe('task name');
  });

  it('Function getChartsOptions should return displayName of the chart', () => {
    const resultGetChartsOptions = getChartsOptions(mockGetChartsOptionsData);

    expect(resultGetChartsOptions).toBe('chart display');
  });

  it('Function getChartsOptions should return name of the chart if no display name present', () => {
    const resultGetChartsOptions = getChartsOptions(
      mockGetChartsOptionsDataWithoutDN
    );

    expect(resultGetChartsOptions).toBe('chart name');
  });

  it('Function getChartsOptions should return text value in case no name or display name of chart is present', () => {
    const resultGetChartsOptions = getChartsOptions(
      mockGetChartsOptionsDataWithoutNameDN
    );

    expect(resultGetChartsOptions).toBe('chart text');
  });

  it('Function getOptionsFromAggregationBucket should return options which not include ingestionPipeline', () => {
    const resultGetOptionsWithoutPipeline =
      getOptionsFromAggregationBucket(mockBucketOptions);

    expect(resultGetOptionsWithoutPipeline).toStrictEqual([
      { count: 1, key: 'pipeline', label: 'pipeline' },
      { count: 3, key: 'chart', label: 'chart' },
    ]);
  });

  describe('getEmptyJsonTree', () => {
    it('should return a default JsonTree structure with OWNERS as the default field', () => {
      const result = getEmptyJsonTree();

      expect(result.type).toBe('group');
      expect(result.properties).toEqual({
        conjunction: 'AND',
        not: false,
      });

      const children1Keys = Object.keys(result.children1 ?? {});

      expect(children1Keys.length).toBe(1);

      const children1AsRecord = result.children1 as Record<
        string,
        {
          type: string;
          children1?: Record<
            string,
            { type: string; properties?: { field: string } }
          >;
        }
      >;
      const firstChild = children1AsRecord[children1Keys[0]];

      expect(firstChild?.type).toBe('group');

      const grandChildren1Keys = Object.keys(firstChild?.children1 ?? {});

      expect(grandChildren1Keys.length).toBe(1);

      const grandChildren1AsRecord = firstChild?.children1 as Record<
        string,
        { type: string; properties?: { field: string } }
      >;
      const grandChild = grandChildren1AsRecord[grandChildren1Keys[0]];

      expect(grandChild?.type).toBe('rule');
      expect(grandChild?.properties?.field).toBe(EntityFields.OWNERS);
    });

    it('should use the provided field when passed as parameter', () => {
      const customField = EntityFields.TAG;
      const result = getEmptyJsonTree(customField);

      const children1 = result.children1 as Record<
        string,
        { children1: Record<string, { properties: { field: string } }> }
      >;
      const firstChildKey = Object.keys(children1)[0];
      const firstChild = children1[firstChildKey] as {
        children1: Record<string, { properties: { field: string } }>;
      };
      const grandChildKey = Object.keys(firstChild.children1)[0];

      expect(firstChild.children1[grandChildKey]?.properties.field).toEqual(
        customField
      );
    });
  });

  describe('getEmptyJsonTreeForQueryBuilder', () => {
    it('should return a JsonTree structure with default parameters', () => {
      const result = getEmptyJsonTreeForQueryBuilder();

      expect(result.type).toBe('group');
      expect(result.properties).toEqual({
        conjunction: 'AND',
        not: false,
      });

      const children1Keys = Object.keys(result.children1 ?? {});

      expect(children1Keys.length).toBe(1);

      const children1AsRecord = result.children1 as Record<
        string,
        {
          type: string;
          properties?: { field: string; mode: string };
          children1?: Record<
            string,
            { type: string; properties?: { field: string; operator: string } }
          >;
        }
      >;
      const firstChild = children1AsRecord[children1Keys[0]];

      expect(firstChild?.type).toBe('rule_group');
      expect(firstChild?.properties?.field).toBe(EntityReferenceFields.OWNERS);
      expect(firstChild?.properties?.mode).toBe('some');

      const grandChildren1Keys = Object.keys(firstChild?.children1 ?? {});

      expect(grandChildren1Keys.length).toBe(1);

      const grandChildren1AsRecord = firstChild?.children1 as Record<
        string,
        { type: string; properties?: { field: string; operator: string } }
      >;
      const grandChild = grandChildren1AsRecord[grandChildren1Keys[0]];

      expect(grandChild?.type).toBe('rule');
      expect(grandChild?.properties?.field).toBe(
        `${EntityReferenceFields.OWNERS}.fullyQualifiedName`
      );
      expect(grandChild?.properties?.operator).toBe('select_equals');
    });

    it('should use custom field when provided', () => {
      const customField = EntityReferenceFields.TAG;
      const result = getEmptyJsonTreeForQueryBuilder(customField);

      const children1 = result.children1 as Record<
        string,
        {
          properties: { field: string };
          children1: Record<string, { properties: { field: string } }>;
        }
      >;
      const firstChildKey = Object.keys(children1)[0];
      const firstChild = children1[firstChildKey] as {
        properties: { field: string };
        children1: Record<string, { properties: { field: string } }>;
      };
      const grandChildKey = Object.keys(firstChild.children1)[0];

      expect(firstChild.properties.field).toEqual(customField);
      expect(firstChild.children1[grandChildKey]?.properties.field).toEqual(
        `${customField}.fullyQualifiedName`
      );
    });

    it('should use custom subField when provided', () => {
      const customSubField = 'name';
      const result = getEmptyJsonTreeForQueryBuilder(
        EntityReferenceFields.OWNERS,
        customSubField
      );

      const children1 = result.children1 as Record<
        string,
        { children1: Record<string, { properties: { field: string } }> }
      >;
      const firstChildKey = Object.keys(children1)[0];
      const firstChild = children1[firstChildKey] as {
        children1: Record<string, { properties: { field: string } }>;
      };
      const grandChildKey = Object.keys(firstChild.children1)[0];

      expect(firstChild.children1[grandChildKey]?.properties.field).toEqual(
        `${EntityReferenceFields.OWNERS}.${customSubField}`
      );
    });

    it('should have rule_group as the type for the first child', () => {
      const result = getEmptyJsonTreeForQueryBuilder();

      const children1 = result.children1 as Record<string, { type: string }>;
      const firstChildKey = Object.keys(children1)[0];

      expect(children1[firstChildKey].type).toEqual('rule_group');
    });
  });

  describe('processCustomPropertyField', () => {
    const mockField = {
      name: 'testField',
      type: 'string',
      description: 'Test field description',
    };

    const mockDataObject = {
      type: 'select',
      label: 'Test Field',
      valueSources: ['value'],
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return early if field.name is missing', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const fieldWithoutName = { type: 'string' };

      processCustomPropertyField(fieldWithoutName as never, 'table', subfields);

      expect(subfields).toEqual({});
    });

    it('should return early if field.type is missing', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const fieldWithoutType = { name: 'testField' };

      processCustomPropertyField(fieldWithoutType as never, 'table', subfields);

      expect(subfields).toEqual({});
    });

    it('should add subfield directly when entityType is specified', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const mockResult = {
        subfieldsKey: 'testField.keyword',
        dataObject: mockDataObject,
      };

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue(mockResult);

      processCustomPropertyField(
        mockField as never,
        'table',
        subfields,
        'table'
      );

      expect(subfields['testField.keyword']).toEqual({
        ...mockDataObject,
        valueSources: ['value'],
      });
    });

    it('should create nested subfields when entityType is not specified', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const mockResult = {
        subfieldsKey: 'testField.keyword',
        dataObject: mockDataObject,
      };

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue(mockResult);

      processCustomPropertyField(mockField as never, 'table', subfields);

      expect(subfields.table).toBeDefined();
      expect(subfields.table).toMatchObject({
        label: 'Table',
        type: '!group',
        subfields: {
          'testField.keyword': {
            ...mockDataObject,
            valueSources: ['value'],
          },
        },
      });
    });

    it('should handle array result from getCustomPropertiesSubFields', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const mockArrayResult = [
        {
          subfieldsKey: 'testField1.keyword',
          dataObject: { ...mockDataObject, label: 'Field 1' },
        },
        {
          subfieldsKey: 'testField2.keyword',
          dataObject: { ...mockDataObject, label: 'Field 2' },
        },
      ];

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue(mockArrayResult);

      processCustomPropertyField(
        mockField as never,
        'table',
        subfields,
        'table'
      );

      expect(subfields['testField1.keyword']).toBeDefined();
      expect(subfields['testField2.keyword']).toBeDefined();
    });

    it('should merge with existing entity subfields', () => {
      const subfields: Record<string, FieldOrGroup> = {
        table: {
          label: 'Table',
          type: '!group',
          subfields: {
            existingField: {
              type: 'text',
              label: 'Existing Field',
            },
          },
        },
      };

      const mockResult = {
        subfieldsKey: 'newField.keyword',
        dataObject: mockDataObject,
      };

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue(mockResult);

      processCustomPropertyField(mockField as never, 'table', subfields);

      const tableSubfields = (
        subfields.table as { subfields: Record<string, unknown> }
      ).subfields;

      expect(tableSubfields.existingField).toBeDefined();
      expect(tableSubfields['newField.keyword']).toBeDefined();
    });

    it('should pass ElasticSearch searchOutputType to getCustomPropertiesSubFields', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const mockField = { name: 'testField', type: 'string' };

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue({
        subfieldsKey: 'testField.keyword',
        dataObject: {
          type: 'text',
          label: 'Test Field',
          valueSources: ['value'],
        },
      });

      processCustomPropertyField(
        mockField as never,
        'table',
        subfields,
        'table',
        SearchOutputType.ElasticSearch
      );

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockField, SearchOutputType.ElasticSearch);
    });

    it('should pass JSONLogic searchOutputType to getCustomPropertiesSubFields', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const mockField = { name: 'testField', type: 'string' };

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue({
        subfieldsKey: 'testField',
        dataObject: {
          type: 'text',
          label: 'Test Field',
          valueSources: ['value'],
        },
      });

      processCustomPropertyField(
        mockField as never,
        'table',
        subfields,
        'table',
        SearchOutputType.JSONLogic
      );

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockField, SearchOutputType.JSONLogic);
    });

    it('should pass undefined searchOutputType to getCustomPropertiesSubFields when not provided', () => {
      const subfields: Record<string, FieldOrGroup> = {};
      const mockField = { name: 'testField', type: 'string' };

      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue({
        subfieldsKey: 'testField.keyword',
        dataObject: {
          type: 'text',
          label: 'Test Field',
          valueSources: ['value'],
        },
      });

      processCustomPropertyField(
        mockField as never,
        'table',
        subfields,
        'table'
      );

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockField, undefined);
    });
  });

  describe('getAssetsPageQuickFilters', () => {
    it('should return DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS for DOMAIN type', () => {
      expect(getAssetsPageQuickFilters(AssetsOfEntity.DOMAIN)).toEqual(
        DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS
      );
    });

    it('should return DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS for DATA_PRODUCT type', () => {
      expect(getAssetsPageQuickFilters(AssetsOfEntity.DATA_PRODUCT)).toEqual(
        DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS
      );
    });

    it('should return DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS for DATA_PRODUCT_INPUT_PORT type', () => {
      expect(
        getAssetsPageQuickFilters(AssetsOfEntity.DATA_PRODUCT_INPUT_PORT)
      ).toEqual(DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS);
    });

    it('should return DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS for DATA_PRODUCT_OUTPUT_PORT type', () => {
      expect(
        getAssetsPageQuickFilters(AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT)
      ).toEqual(DOMAIN_DATAPRODUCT_DROPDOWN_ITEMS);
    });

    it('should return GLOSSARY_ASSETS_DROPDOWN_ITEMS for GLOSSARY type', () => {
      expect(getAssetsPageQuickFilters(AssetsOfEntity.GLOSSARY)).toEqual(
        GLOSSARY_ASSETS_DROPDOWN_ITEMS
      );
    });

    it('should return TAG_ASSETS_DROPDOWN_ITEMS for TAG type', () => {
      expect(getAssetsPageQuickFilters(AssetsOfEntity.TAG)).toEqual(
        TAG_ASSETS_DROPDOWN_ITEMS
      );
    });

    it('should return LINEAGE_DROPDOWN_ITEMS for LINEAGE type', () => {
      expect(getAssetsPageQuickFilters(AssetsOfEntity.LINEAGE)).toEqual(
        LINEAGE_DROPDOWN_ITEMS
      );
    });

    it('should return COMMON_DROPDOWN_ITEMS for undefined type', () => {
      expect(getAssetsPageQuickFilters(undefined)).toEqual(
        COMMON_DROPDOWN_ITEMS
      );
    });

    it('should return a new array instance each time', () => {
      const result1 = getAssetsPageQuickFilters(AssetsOfEntity.DOMAIN);
      const result2 = getAssetsPageQuickFilters(AssetsOfEntity.DOMAIN);

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('processEntityTypeFields', () => {
    const mockFields = [
      {
        name: 'field1',
        type: 'string',
        description: 'Field 1',
      },
      {
        name: 'field2',
        type: 'integer',
        description: 'Field 2',
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      (
        advancedSearchClassBase.getCustomPropertiesSubFields as jest.Mock
      ).mockReturnValue({
        subfieldsKey: 'field.keyword',
        dataObject: {
          type: 'select',
          label: 'Field',
          valueSources: ['value'],
        },
      });
    });

    it('should process all fields when entityType is not specified', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields('table', mockFields as never, subfields);

      expect(subfields.table).toBeDefined();
    });

    it('should skip processing if entityType does not match', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields(
        'table',
        mockFields as never,
        subfields,
        'database'
      );

      expect(subfields).toEqual({});
    });

    it('should process fields when entityType matches', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields('table', mockFields as never, subfields, 'table');

      expect(Object.keys(subfields).length).toBeGreaterThan(0);
    });

    it('should process fields when entityType is ALL', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields(
        'table',
        mockFields as never,
        subfields,
        EntityType.ALL
      );

      expect(Object.keys(subfields).length).toBeGreaterThan(0);
      expect(subfields['field.keyword']).toBeDefined();
    });

    it('should handle empty fields array', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields('table', [], subfields);

      expect(subfields).toEqual({});
    });

    it('should call processCustomPropertyField for each field', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields('table', mockFields as never, subfields);

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledTimes(2);
    });

    it('should pass searchOutputType through to processCustomPropertyField with ElasticSearch', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields(
        'table',
        mockFields as never,
        subfields,
        'table',
        SearchOutputType.ElasticSearch
      );

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockFields[0], SearchOutputType.ElasticSearch);
      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockFields[1], SearchOutputType.ElasticSearch);
    });

    it('should pass searchOutputType through to processCustomPropertyField with JSONLogic', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields(
        'table',
        mockFields as never,
        subfields,
        'table',
        SearchOutputType.JSONLogic
      );

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockFields[0], SearchOutputType.JSONLogic);
      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockFields[1], SearchOutputType.JSONLogic);
    });

    it('should handle undefined searchOutputType in processEntityTypeFields', () => {
      const subfields: Record<string, FieldOrGroup> = {};

      processEntityTypeFields('table', mockFields as never, subfields, 'table');

      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockFields[0], undefined);
      expect(
        advancedSearchClassBase.getCustomPropertiesSubFields
      ).toHaveBeenCalledWith(mockFields[1], undefined);
    });
  });
});
