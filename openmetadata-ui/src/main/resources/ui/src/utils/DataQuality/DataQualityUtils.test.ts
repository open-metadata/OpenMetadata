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

import { TestCaseSearchParams } from '../../components/DataQuality/DataQuality.interface';
import { DataQualityReport } from '../../generated/tests/dataQualityReport';
import {
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import {
  buildDataQualityDashboardFilters,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
  buildTestCaseParams,
  createTestCaseParameters,
  getTestCaseFiltersValue,
  transformToTestCaseStatusObject,
} from './DataQualityUtils';

jest.mock('../../constants/profiler.constant', () => ({
  TEST_CASE_FILTERS: {
    table: 'tableFqn',
    platform: 'testPlatforms',
    type: 'testCaseType',
    status: 'testCaseStatus',
    lastRun: 'lastRunRange',
    tier: 'tier',
    tags: 'tags',
    service: 'serviceName',
  },
}));

jest.mock('../TableUtils', () => ({
  generateEntityLink: jest.fn().mockImplementation((fqn: string) => {
    return `<#E::table::${fqn}>`;
  }),
}));

describe('DataQualityUtils', () => {
  describe('buildTestCaseParams', () => {
    it('should return an empty object if params is undefined', () => {
      const params = undefined;
      const filters = ['lastRun', 'table'];

      const result = buildTestCaseParams(params, filters);

      expect(result).toEqual({});
    });

    it('should return the updated test case parameters with the applied filters', () => {
      const params = {
        endTimestamp: 1234567890,
        startTimestamp: 1234567890,
        entityLink: 'table1',
        testPlatforms: ['DBT'],
      } as ListTestCaseParamsBySearch;
      const filters = ['lastRunRange', 'tableFqn'];

      const result = buildTestCaseParams(params, filters);

      expect(result).toEqual({
        endTimestamp: 1234567890,
        startTimestamp: 1234567890,
        entityLink: 'table1',
      });
    });
  });

  describe('createTestCaseParameters', () => {
    const mockDefinition = {
      parameterDefinition: [
        { name: 'arrayParam', dataType: TestDataType.Array },
        { name: 'stringParam', dataType: TestDataType.String },
      ],
    } as TestDefinition;

    it('should return an empty array for empty parameters', () => {
      const result = createTestCaseParameters({}, mockDefinition);

      expect(result).toEqual([]);
    });

    it('should handle parameters not matching any definition', () => {
      const params = { unrelatedParam: 'value' };
      const result = createTestCaseParameters(params, mockDefinition);

      expect(result).toEqual([{ name: 'unrelatedParam', value: 'value' }]);
    });

    it('should handle a mix of string and array parameters', () => {
      const params = {
        stringParam: 'stringValue',
        arrayParam: [{ value: 'arrayValue1' }, { value: 'arrayValue2' }],
      };
      const expected = [
        { name: 'stringParam', value: 'stringValue' },
        {
          name: 'arrayParam',
          value: JSON.stringify(['arrayValue1', 'arrayValue2']),
        },
      ];
      const result = createTestCaseParameters(params, mockDefinition);

      expect(result).toEqual(expected);
    });

    it('should ignore array items without a value', () => {
      const params = {
        arrayParam: [{ value: '' }, { value: 'validValue' }],
      };
      const expected = [
        { name: 'arrayParam', value: JSON.stringify(['validValue']) },
      ];
      const result = createTestCaseParameters(params, mockDefinition);

      expect(result).toEqual(expected);
    });

    it('should return undefined if params not present', () => {
      const result = createTestCaseParameters(undefined, undefined);

      expect(result).toBeUndefined();
    });

    it('should return params value for sqlExpression test defination type', () => {
      const data = {
        params: {
          sqlExpression: 'select * from dim_address',
          strategy: 'COUNT',
          threshold: '12',
        },
        selectedDefinition: {
          parameterDefinition: [
            {
              name: 'sqlExpression',
              displayName: 'SQL Expression',
              dataType: 'STRING',
              description: 'SQL expression to run against the table',
              required: true,
              optionValues: [],
            },
            {
              name: 'strategy',
              displayName: 'Strategy',
              dataType: 'ARRAY',
              description:
                'Strategy to use to run the custom SQL query (i.e. `SELECT COUNT(<col>)` or `SELECT <col> (defaults to ROWS)',
              required: false,
              optionValues: ['ROWS', 'COUNT'],
            },
            {
              name: 'threshold',
              displayName: 'Threshold',
              dataType: 'NUMBER',
              description:
                'Threshold to use to determine if the test passes or fails (defaults to 0).',
              required: false,
              optionValues: [],
            },
          ],
        } as TestDefinition,
      };

      const expected = [
        {
          name: 'sqlExpression',
          value: 'select * from dim_address',
        },
        {
          name: 'strategy',
          value: 'COUNT',
        },
        {
          name: 'threshold',
          value: '12',
        },
      ];

      const result = createTestCaseParameters(
        data.params,
        data.selectedDefinition
      );

      expect(result).toEqual(expected);
    });
  });

  describe('getTestCaseFiltersValue', () => {
    const testCaseSearchParams = {
      testCaseType: 'column',
      testCaseStatus: 'Success',
      searchValue: 'between',
      testPlatforms: ['DBT', 'Deequ'],
      lastRunRange: {
        startTs: '1720417883445',
        endTs: '1721022683445',
        key: 'last7days',
        title: 'Last 7 days',
      },
      tags: ['PII.None'],
      tier: 'Tier.Tier1',
      serviceName: 'sample_data',
      tableFqn: 'sample_data.ecommerce_db.shopify.fact_sale',
    } as unknown as TestCaseSearchParams;

    it('should correctly process values and selectedFilter', () => {
      const selectedFilter = [
        'testCaseStatus',
        'testCaseType',
        'searchValue',
        'testPlatforms',
        'lastRunRange',
        'tags',
        'tier',
        'serviceName',
        'tableFqn',
      ];

      const expected = {
        endTimestamp: '1721022683445',
        startTimestamp: '1720417883445',
        entityLink: '<#E::table::sample_data.ecommerce_db.shopify.fact_sale>',
        testPlatforms: ['DBT', 'Deequ'],
        testCaseType: 'column',
        testCaseStatus: 'Success',
        tags: ['PII.None'],
        tier: 'Tier.Tier1',
        serviceName: 'sample_data',
      };

      const result = getTestCaseFiltersValue(
        testCaseSearchParams,
        selectedFilter
      );

      expect(result).toEqual(expected);
    });

    it('should only create params based on selected filters', () => {
      const selectedFilter = ['testPlatforms', 'lastRunRange'];

      const expected = {
        testPlatforms: ['DBT', 'Deequ'],
        endTimestamp: '1721022683445',
        startTimestamp: '1720417883445',
      };

      const result = getTestCaseFiltersValue(
        testCaseSearchParams,
        selectedFilter
      );

      expect(result).toEqual(expected);
    });

    it('should only create params based on selected filters and available data', () => {
      const testCaseSearchParams = {
        testCaseType: 'column',
        testCaseStatus: 'Success',
        searchValue: 'between',
        testPlatforms: ['DBT', 'Deequ'],
        tags: ['PII.None'],
        tier: 'Tier.Tier1',
      } as unknown as TestCaseSearchParams;
      const selectedFilter = ['testPlatforms', 'tags', 'testCaseStatus'];

      const expected = {
        testPlatforms: ['DBT', 'Deequ'],
        tags: ['PII.None'],
        testCaseStatus: 'Success',
      };

      const result = getTestCaseFiltersValue(
        testCaseSearchParams,
        selectedFilter
      );

      expect(result).toEqual(expected);
    });

    it('should not send params if selected filter is empty', () => {
      const selectedFilter: string[] = [];

      const result = getTestCaseFiltersValue(
        testCaseSearchParams,
        selectedFilter
      );

      expect(result).toEqual({});
    });
  });

  describe('buildMustEsFilterForOwner', () => {
    it('should return filter for owner when isTestCaseResult is false', () => {
      const ownerFqn = 'owner1';
      const expectedFilter = {
        term: {
          'owners.name': ownerFqn,
        },
      };

      expect(buildMustEsFilterForOwner(ownerFqn)).toEqual(expectedFilter);
    });

    it('should return filter for test case owner when isTestCaseResult is true', () => {
      const ownerFqn = 'owner2';
      const expectedFilter = {
        term: {
          'testCase.owners.name': ownerFqn,
        },
      };

      expect(buildMustEsFilterForOwner(ownerFqn, true)).toEqual(expectedFilter);
    });
  });

  describe('buildMustEsFilterForTags', () => {
    it('should return filter for tags when isTestCaseResult is false', () => {
      const tags = ['tag1', 'tag2'];
      const expectedFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              should: [
                { match: { 'tags.tagFQN': 'tag1' } },
                { match: { 'tags.tagFQN': 'tag2' } },
              ],
            },
          },
        },
      };

      expect(buildMustEsFilterForTags(tags)).toEqual(expectedFilter);
    });

    it('should return filter for test case tags when isTestCaseResult is true', () => {
      const tags = ['tag1', 'tag2'];
      const expectedFilter = {
        nested: {
          path: 'testCase.tags',
          query: {
            bool: {
              should: [
                { match: { 'testCase.tags.tagFQN': 'tag1' } },
                { match: { 'testCase.tags.tagFQN': 'tag2' } },
              ],
            },
          },
        },
      };

      expect(buildMustEsFilterForTags(tags, true)).toEqual(expectedFilter);
    });

    it('should handle empty tags array', () => {
      const tags: string[] = [];
      const expectedFilter = {
        nested: {
          path: 'tags',
          query: {
            bool: {
              should: [],
            },
          },
        },
      };

      expect(buildMustEsFilterForTags(tags)).toEqual(expectedFilter);
    });

    it('should handle empty tags array with isTestCaseResult true', () => {
      const tags: string[] = [];
      const expectedFilter = {
        nested: {
          path: 'testCase.tags',
          query: {
            bool: {
              should: [],
            },
          },
        },
      };

      expect(buildMustEsFilterForTags(tags, true)).toEqual(expectedFilter);
    });
  });

  describe('transformToTestCaseStatusObject', () => {
    it('should return correct counts for basic input', () => {
      const inputData = [
        { document_count: '4', 'testCaseResult.testCaseStatus': 'success' },
        { document_count: '3', 'testCaseResult.testCaseStatus': 'failed' },
        { document_count: '1', 'testCaseResult.testCaseStatus': 'aborted' },
      ];
      const expectedOutput = {
        success: 4,
        failed: 3,
        aborted: 1,
        total: 8,
      };

      expect(transformToTestCaseStatusObject(inputData)).toEqual(
        expectedOutput
      );
    });

    it('should return zeros for empty input', () => {
      const inputData: DataQualityReport['data'] = [];
      const expectedOutput = {
        success: 0,
        failed: 0,
        aborted: 0,
        total: 0,
      };

      expect(transformToTestCaseStatusObject(inputData)).toEqual(
        expectedOutput
      );
    });

    it('should return correct counts for all success input', () => {
      const inputData = [
        { document_count: '2', 'testCaseResult.testCaseStatus': 'success' },
        { document_count: '3', 'testCaseResult.testCaseStatus': 'success' },
      ];
      const expectedOutput = {
        success: 5,
        failed: 0,
        aborted: 0,
        total: 5,
      };

      expect(transformToTestCaseStatusObject(inputData)).toEqual(
        expectedOutput
      );
    });

    it('should return correct counts for all failed input', () => {
      const inputData = [
        { document_count: '2', 'testCaseResult.testCaseStatus': 'failed' },
        { document_count: '3', 'testCaseResult.testCaseStatus': 'failed' },
      ];
      const expectedOutput = {
        success: 0,
        failed: 5,
        aborted: 0,
        total: 5,
      };

      expect(transformToTestCaseStatusObject(inputData)).toEqual(
        expectedOutput
      );
    });

    it('should return correct counts for all aborted input', () => {
      const inputData = [
        { document_count: '2', 'testCaseResult.testCaseStatus': 'aborted' },
        { document_count: '3', 'testCaseResult.testCaseStatus': 'aborted' },
      ];
      const expectedOutput = {
        success: 0,
        failed: 0,
        aborted: 5,
        total: 5,
      };

      expect(transformToTestCaseStatusObject(inputData)).toEqual(
        expectedOutput
      );
    });

    it('should return correct counts for mixed statuses input', () => {
      const inputData = [
        { document_count: '1', 'testCaseResult.testCaseStatus': 'success' },
        { document_count: '1', 'testCaseResult.testCaseStatus': 'failed' },
        { document_count: '1', 'testCaseResult.testCaseStatus': 'aborted' },
        { document_count: '1', 'testCaseResult.testCaseStatus': 'success' },
        { document_count: '1', 'testCaseResult.testCaseStatus': 'failed' },
      ];
      const expectedOutput = {
        success: 2,
        failed: 2,
        aborted: 1,
        total: 5,
      };

      expect(transformToTestCaseStatusObject(inputData)).toEqual(
        expectedOutput
      );
    });
  });

  describe('buildDataQualityDashboardFilters', () => {
    it('should include deleted:false filter by default', () => {
      const result = buildDataQualityDashboardFilters({});

      expect(result).toEqual([
        {
          term: {
            deleted: false,
          },
        },
      ]);
    });

    it('should include deleted:false filter along with other filters', () => {
      const result = buildDataQualityDashboardFilters({
        filters: {
          serviceName: 'test-service',
          testPlatforms: ['DBT'],
        },
      });

      expect(result).toEqual([
        {
          term: {
            'service.name.keyword': 'test-service',
          },
        },
        {
          terms: {
            testPlatforms: ['DBT'],
          },
        },
        {
          term: {
            deleted: false,
          },
        },
      ]);
    });
  });
});
