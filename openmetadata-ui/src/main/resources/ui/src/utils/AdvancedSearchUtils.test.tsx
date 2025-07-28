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

import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { SearchIndex } from '../enums/search.enum';
import {
  getChartsOptions,
  getColumnsOptions,
  getEmptyJsonTree,
  getOptionsFromAggregationBucket,
  getSchemaFieldOptions,
  getSearchDropdownLabels,
  getSearchLabel,
  getSelectedOptionLabelString,
  getServiceOptions,
  getTasksOptions,
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

// Mock QbUtils
jest.mock('@react-awesome-query-builder/antd', () => ({
  ...jest.requireActual('@react-awesome-query-builder/antd'),
  Utils: {
    uuid: jest.fn().mockReturnValue('test-uuid'),
  },
}));

describe('AdvancedSearchUtils tests', () => {
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

      const expected = {
        id: 'test-uuid',
        type: 'group',
        properties: {
          conjunction: 'AND',
          not: false,
        },
        children1: {
          'test-uuid': {
            type: 'group',
            properties: {
              conjunction: 'AND',
              not: false,
            },
            children1: {
              'test-uuid': {
                type: 'rule',
                properties: {
                  field: EntityFields.OWNERS,
                  operator: null,
                  value: [],
                  valueSrc: ['value'],
                },
              },
            },
          },
        },
      };

      expect(result).toEqual(expected);
    });

    it('should use the provided field when passed as parameter', () => {
      const customField = EntityFields.TAG;
      const result = getEmptyJsonTree(customField);

      const children1 = result.children1 as Record<
        string,
        { children1: Record<string, { properties: { field: string } }> }
      >;

      expect(
        children1['test-uuid'].children1['test-uuid'].properties.field
      ).toEqual(customField);
    });
  });
});
