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
import { Table } from '../../generated/entity/data/table';
import { DataQualityReport } from '../../generated/tests/dataQualityReport';
import { TestCase } from '../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../generated/tests/testDefinition';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import {
  buildDataQualityDashboardFilters,
  buildMustEsFilterForDataProducts,
  buildMustEsFilterForOwner,
  buildMustEsFilterForTags,
  buildTestCaseParams,
  createTestCaseParameters,
  filterTestCasesByTableAndColumn,
  getColumnFilterEntityLink,
  getColumnFilterOptions,
  getColumnNameFromColumnFilterKey,
  getEntityLinkForColumnFilter,
  getSelectedOptionsFromKeys,
  getServiceTypeForTestDefinition,
  getTestCaseFiltersValue,
  parseColumnAggregateBuckets,
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
  DEFAULT_SELECTED_RANGE: {
    key: 'last7Days',
    title: 'Last 7 days',
    days: 7,
  },
  PROFILER_CHART_DATA_SIZE: 500,
}));

jest.mock('../date-time/DateTimeUtils', () => ({
  formatDateTimeLong: jest.fn(),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(1609459200000),
  getCurrentMillis: jest.fn().mockReturnValue(1640995200000),
}));

jest.mock('../TableUtils', () => ({
  generateEntityLink: jest.fn().mockImplementation((fqn: string) => {
    return `<#E::table::${fqn}>`;
  }),
}));

jest.mock('../FeedUtils', () => ({
  getEntityFQN: jest.fn((link: string) => link),
}));

jest.mock('../EntityUtils', () => ({
  getColumnNameFromEntityLink: jest.fn((link: string) => {
    const match = link?.match(/::columns::([^>]+)/);

    return match ? match[1] : link;
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
        testPlatforms: [TestPlatform.Dbt],
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
      testPlatforms: [TestPlatform.Dbt, TestPlatform.Deequ],
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
        testPlatforms: [TestPlatform.Dbt, TestPlatform.Deequ],
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
        testPlatforms: [TestPlatform.Dbt, TestPlatform.Deequ],
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
        testPlatforms: [TestPlatform.Dbt, TestPlatform.Deequ],
        tags: ['PII.None'],
        tier: 'Tier.Tier1',
      } as unknown as TestCaseSearchParams;
      const selectedFilter = ['testPlatforms', 'tags', 'testCaseStatus'];

      const expected = {
        testPlatforms: [TestPlatform.Dbt, TestPlatform.Deequ],
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
    it('should return nested filter for owner when isTestCaseResult is false', () => {
      const ownerFqn = 'owner1';
      const expectedFilter = {
        nested: {
          path: 'owners',
          query: {
            term: {
              'owners.name': ownerFqn,
            },
          },
        },
      };

      expect(buildMustEsFilterForOwner(ownerFqn)).toEqual(expectedFilter);
    });

    it('should return nested filter for test case owner when isTestCaseResult is true', () => {
      const ownerFqn = 'owner2';
      const expectedFilter = {
        nested: {
          path: 'testCase.owners',
          query: {
            term: {
              'testCase.owners.name': ownerFqn,
            },
          },
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
          testPlatforms: [TestPlatform.Dbt],
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
            testPlatforms: [TestPlatform.Dbt],
          },
        },
        {
          term: {
            deleted: false,
          },
        },
      ]);
    });

    it('should include data product filters when dataProductFqns are provided', () => {
      const fqns = ['domain.dp1', 'domain.dp2'];
      const result = buildDataQualityDashboardFilters({
        filters: {
          dataProductFqns: fqns,
        },
      });

      expect(result).toEqual([
        buildMustEsFilterForDataProducts(fqns),
        {
          term: {
            deleted: false,
          },
        },
      ]);
    });

    it('should prefix data product field for nested test case documents', () => {
      expect(buildMustEsFilterForDataProducts(['a.b'], 'testCase.')).toEqual({
        bool: {
          should: [
            { term: { 'testCase.dataProducts.fullyQualifiedName': 'a.b' } },
          ],
          minimum_should_match: 1,
        },
      });
    });
  });

  describe('getServiceTypeForTestDefinition', () => {
    it('should return serviceType when table has serviceType property', () => {
      const table = {
        id: 'test-id',
        name: 'test-table',
        serviceType: 'BigQuery',
      } as Table;

      const result = getServiceTypeForTestDefinition(table);

      expect(result).toBe('BigQuery');
    });

    it('should return serviceType for different service types', () => {
      const serviceTypes = [
        'Snowflake',
        'PostgreSQL',
        'MySQL',
        'Redshift',
        'Postgres',
      ];

      serviceTypes.forEach((serviceType) => {
        const table = {
          id: 'test-id',
          name: 'test-table',
          serviceType,
        } as Table;

        const result = getServiceTypeForTestDefinition(table);

        expect(result).toBe(serviceType);
      });
    });

    it('should return undefined when table does not have serviceType', () => {
      const table = {
        id: 'test-id',
        name: 'test-table',
      } as Table;

      const result = getServiceTypeForTestDefinition(table);

      expect(result).toBeUndefined();
    });

    it('should return undefined when table is undefined', () => {
      const result = getServiceTypeForTestDefinition();

      expect(result).toBeUndefined();
    });

    it('should return undefined when table is null', () => {
      const result = getServiceTypeForTestDefinition(null as unknown as Table);

      expect(result).toBeUndefined();
    });
  });

  describe('getColumnFilterOptions', () => {
    const mockTableCase: TestCase = {
      id: 'tc-1',
      name: 'test_1',
      entityLink: '<#E::table::service.db.schema.tableA>',
    } as TestCase;

    const mockColumnCase1: TestCase = {
      id: 'tc-2',
      name: 'test_2',
      entityLink: '<#E::table::service.db.schema.tableA::columns::col1>',
    } as TestCase;

    const mockColumnCase2: TestCase = {
      id: 'tc-3',
      name: 'test_3',
      entityLink: '<#E::table::service.db.schema.tableB::columns::col2>',
    } as TestCase;

    it('returns empty array for empty items', () => {
      expect(getColumnFilterOptions([])).toEqual([]);
    });

    it('returns empty array when no items have column links', () => {
      expect(getColumnFilterOptions([mockTableCase])).toEqual([]);
    });

    it('returns one option per unique table::column key', () => {
      const items = [mockColumnCase1, mockColumnCase2];

      expect(getColumnFilterOptions(items)).toEqual([
        {
          key: `${mockColumnCase1.entityLink ?? ''}::col1`,
          label: 'col1',
        },
        {
          key: `${mockColumnCase2.entityLink ?? ''}::col2`,
          label: 'col2',
        },
      ]);
    });

    it('deduplicates by table::column key', () => {
      const sameCol = {
        ...mockColumnCase1,
        id: 'tc-4',
        name: 'test_4',
      };
      const items = [mockColumnCase1, sameCol];

      expect(getColumnFilterOptions(items)).toHaveLength(1);
      expect(getColumnFilterOptions(items)[0].label).toBe('col1');
    });
  });

  describe('getSelectedOptionsFromKeys', () => {
    const options = [
      { key: 'k1', label: 'Label 1' },
      { key: 'k2', label: 'Label 2' },
    ];

    it('returns empty array for empty keys', () => {
      expect(
        getSelectedOptionsFromKeys([], options, (k) => `default-${k}`)
      ).toEqual([]);
    });

    it('returns matching options for keys found in options', () => {
      expect(
        getSelectedOptionsFromKeys(['k1', 'k2'], options, (k) => `default-${k}`)
      ).toEqual([
        { key: 'k1', label: 'Label 1' },
        { key: 'k2', label: 'Label 2' },
      ]);
    });

    it('uses getDefaultLabel for keys not in options', () => {
      expect(
        getSelectedOptionsFromKeys(
          ['k1', 'missing'],
          options,
          (k) => `fallback-${k}`
        )
      ).toEqual([
        { key: 'k1', label: 'Label 1' },
        { key: 'missing', label: 'fallback-missing' },
      ]);
    });
  });

  describe('filterTestCasesByTableAndColumn', () => {
    const mockTableCase: TestCase = {
      id: 'tc-1',
      name: 'test_1',
      entityLink: '<#E::table::service.db.schema.tableA>',
    } as TestCase;

    const mockColumnCase1: TestCase = {
      id: 'tc-2',
      name: 'test_2',
      entityLink: '<#E::table::service.db.schema.tableA::columns::col1>',
    } as TestCase;

    const mockColumnCase2: TestCase = {
      id: 'tc-3',
      name: 'test_3',
      entityLink: '<#E::table::service.db.schema.tableB::columns::col2>',
    } as TestCase;

    const items = [mockTableCase, mockColumnCase1, mockColumnCase2];

    it('returns all items when no filters applied', () => {
      expect(filterTestCasesByTableAndColumn(items, [], [])).toHaveLength(3);
    });

    it('filters by table when filterTables is non-empty', () => {
      const tableKey = mockTableCase.entityLink ?? '';

      expect(filterTestCasesByTableAndColumn(items, [tableKey], [])).toEqual([
        mockTableCase,
      ]);
    });

    it('filters by column when filterColumns is non-empty', () => {
      const columnKey = `${mockColumnCase1.entityLink ?? ''}::col1`;

      expect(filterTestCasesByTableAndColumn(items, [], [columnKey])).toEqual([
        mockColumnCase1,
      ]);
    });

    it('excludes table-only test cases when filtering by column', () => {
      const columnKey = `${mockColumnCase1.entityLink ?? ''}::col1`;

      expect(
        filterTestCasesByTableAndColumn(items, [], [columnKey])
      ).not.toContainEqual(mockTableCase);
    });

    it('applies both table and column filters when both provided', () => {
      const tableKey = mockColumnCase1.entityLink ?? '';
      const columnKey = `${mockColumnCase1.entityLink ?? ''}::col1`;

      expect(
        filterTestCasesByTableAndColumn(items, [tableKey], [columnKey])
      ).toEqual([mockColumnCase1]);
    });

    it('returns empty array when table filter matches no items', () => {
      expect(
        filterTestCasesByTableAndColumn(items, ['nonexistent.table'], [])
      ).toEqual([]);
    });
  });

  describe('parseColumnAggregateBuckets', () => {
    it('returns empty array for empty buckets', () => {
      expect(parseColumnAggregateBuckets([])).toEqual([]);
      expect(parseColumnAggregateBuckets([], 'table.fqn')).toEqual([]);
    });

    it('maps buckets to options with key and label when no tableFqn', () => {
      const buckets = [{ key: 'col1' }, { key: 'col2' }];

      expect(parseColumnAggregateBuckets(buckets)).toEqual([
        { key: 'col1', label: 'col1' },
        { key: 'col2', label: 'col2' },
      ]);
    });

    it('prefixes key with tableFqn:: when tableFqn provided', () => {
      const buckets = [{ key: 'col1' }];

      expect(
        parseColumnAggregateBuckets(buckets, 'svc.db.schema.table')
      ).toEqual([{ key: 'svc.db.schema.table::col1', label: 'col1' }]);
    });

    it('deduplicates by key', () => {
      const buckets = [{ key: 'col1' }, { key: 'col1' }];

      expect(parseColumnAggregateBuckets(buckets)).toHaveLength(1);
    });

    it('skips buckets with undefined key', () => {
      const buckets = [{ key: 'col1' }, { key: undefined }, { key: 'col2' }];

      expect(parseColumnAggregateBuckets(buckets)).toEqual([
        { key: 'col1', label: 'col1' },
        { key: 'col2', label: 'col2' },
      ]);
    });
  });

  describe('getEntityLinkForColumnFilter', () => {
    it('returns entity link for table and column', () => {
      const result = getEntityLinkForColumnFilter(
        'sample_snowflake.ANALYTICS_DB.prod.customer_360',
        'customer_id'
      );

      expect(result).toContain('table');
      expect(result).toContain('columns');
      expect(result).toContain('customer_id');
      expect(result).toContain('customer_360');
    });
  });

  describe('getColumnFilterEntityLink', () => {
    it('returns undefined when key has no ::', () => {
      expect(getColumnFilterEntityLink('col1')).toBeUndefined();
    });

    it('returns undefined when key contains ::columns::', () => {
      expect(
        getColumnFilterEntityLink('<#E::table::sample.table::columns::id>')
      ).toBeUndefined();
    });

    it('returns undefined when key starts with <#E', () => {
      expect(
        getColumnFilterEntityLink(
          '<#E::table::sample.table::columns::id>::something'
        )
      ).toBeUndefined();
    });

    it('returns entity link when key is tableFqn::columnName', () => {
      const result = getColumnFilterEntityLink(
        'sample_snowflake.ANALYTICS_DB.prod.customer_360::customer_id'
      );

      expect(result).toBeDefined();
      expect(result).toContain('customer_id');
    });
  });

  describe('getColumnNameFromColumnFilterKey', () => {
    it('returns undefined for empty or whitespace key', () => {
      expect(getColumnNameFromColumnFilterKey('')).toBeUndefined();
      expect(getColumnNameFromColumnFilterKey('   ')).toBeUndefined();
    });

    it('returns key as-is when no ::', () => {
      expect(getColumnNameFromColumnFilterKey('zip')).toBe('zip');
    });

    it('returns part after last :: when key contains ::', () => {
      expect(
        getColumnNameFromColumnFilterKey(
          'sample_snowflake.ANALYTICS_DB.prod.customer_360::zip'
        )
      ).toBe('zip');
    });
  });
});
