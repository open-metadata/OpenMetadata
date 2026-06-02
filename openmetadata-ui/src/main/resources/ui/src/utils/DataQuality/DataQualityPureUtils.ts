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
import { isArray, isNil, lowerCase, parseInt } from 'lodash';
import { ReactComponent as AccuracyIcon } from '../../assets/svg/ic-accuracy.svg';
import { ReactComponent as CompletenessIcon } from '../../assets/svg/ic-completeness.svg';
import { ReactComponent as ConsistencyIcon } from '../../assets/svg/ic-consistency.svg';
import { ReactComponent as IntegrityIcon } from '../../assets/svg/ic-integrity.svg';
import { ReactComponent as SqlIcon } from '../../assets/svg/ic-sql.svg';
import { ReactComponent as UniquenessIcon } from '../../assets/svg/ic-uniqueness.svg';
import { ReactComponent as ValidityIcon } from '../../assets/svg/ic-validity.svg';
import { ReactComponent as NoDimensionIcon } from '../../assets/svg/no-dimension-icon.svg';
import { TEST_CASE_FILTERS } from '../../constants/profiler.constant';
import { Table } from '../../generated/entity/data/table';
import { DataQualityReport } from '../../generated/tests/dataQualityReport';
import {
  TestCase,
  TestCaseParameterValue,
} from '../../generated/tests/testCase';
import {
  DataQualityDimensions,
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import { TableSearchSource } from '../../interface/search.interface';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import EntityLink from '../EntityLink';
import { getColumnNameFromEntityLink } from '../EntityLinkUtils';
import { getEntityFQN } from '../FeedUtils';

/**
 * Builds the parameters for a test case search based on the given filters.
 * @param params - The original test case parameters.
 * @param filters - The filters to apply to the test case parameters.
 * @returns The updated test case parameters with the applied filters.
 */
export const buildTestCaseParams = (
  params: ListTestCaseParamsBySearch | undefined,
  filters: string[]
): ListTestCaseParamsBySearch => {
  if (!params) {
    return {};
  }

  const filterParams = (
    paramKey: keyof ListTestCaseParamsBySearch,
    filterKey: string
  ) => (filters.includes(filterKey) ? { [paramKey]: params[paramKey] } : {});

  return {
    ...filterParams('endTimestamp', TEST_CASE_FILTERS.lastRun),
    ...filterParams('startTimestamp', TEST_CASE_FILTERS.lastRun),
    ...filterParams('entityLink', TEST_CASE_FILTERS.table),
    ...filterParams('testPlatforms', TEST_CASE_FILTERS.platform),
    ...filterParams('testCaseType', TEST_CASE_FILTERS.type),
    ...filterParams('testCaseStatus', TEST_CASE_FILTERS.status),
    ...filterParams('tags', TEST_CASE_FILTERS.tags),
    ...filterParams('tier', TEST_CASE_FILTERS.tier),
    ...filterParams('serviceName', TEST_CASE_FILTERS.service),
    ...filterParams('dataQualityDimension', TEST_CASE_FILTERS.dimension),
  };
};

export const createTestCaseParameters = (
  params?: Record<string, string | { [key: string]: string }[]>,
  selectedDefinition?: TestDefinition
): TestCaseParameterValue[] | undefined => {
  return params
    ? Object.entries(params).reduce((acc, [key, value]) => {
        const paramDef = selectedDefinition?.parameterDefinition?.find(
          (param) => param.name === key
        );

        if (paramDef?.dataType === TestDataType.Array && isArray(value)) {
          const arrayValues = value.map((item) => item.value).filter(Boolean);
          if (arrayValues.length) {
            acc.push({ name: key, value: JSON.stringify(arrayValues) });
          }
        } else if (!isNil(value)) {
          acc.push({ name: key, value: value as string });
        }

        return acc;
      }, [] as TestCaseParameterValue[])
    : params;
};

export const transformToTestCaseStatusObject = (
  data: DataQualityReport['data']
) => {
  const outputData = {
    success: 0,
    failed: 0,
    aborted: 0,
    total: 0,
  };

  const updatedData = data.reduce((acc, item) => {
    const count = parseInt(item.document_count);
    const status = item['testCaseResult.testCaseStatus'];

    if (status === 'success') {
      acc.success += count;
    } else if (status === 'failed') {
      acc.failed += count;
    } else if (status === 'aborted') {
      acc.aborted += count;
    }

    acc.total += count;

    return acc;
  }, outputData);

  return updatedData;
};

export const buildMustEsFilterForTags = (
  tags: string[],
  isTestCaseResult = false
) => {
  return {
    nested: {
      path: isTestCaseResult ? 'testCase.tags' : 'tags',
      query: {
        bool: {
          should: tags.map((tag) => ({
            match: {
              [isTestCaseResult ? 'testCase.tags.tagFQN' : 'tags.tagFQN']: tag,
            },
          })),
        },
      },
    },
  };
};

export const buildMustEsFilterForOwner = (
  ownerFqn: string,
  isTestCaseResult = false
) => {
  const path = isTestCaseResult ? 'testCase.owners' : 'owners';
  const field = isTestCaseResult ? 'testCase.owners.name' : 'owners.name';

  return {
    nested: {
      path,
      query: {
        term: {
          [field]: ownerFqn,
        },
      },
    },
  };
};

export const buildMustEsFilterForTier = (
  tiers: string[],
  isTestCaseResult = false
) => {
  const field = isTestCaseResult ? 'testCase.tier.tagFQN' : 'tier.tagFQN';

  return {
    bool: {
      should: tiers.map((tier) => ({
        term: { [field]: tier },
      })),
      minimum_should_match: 1,
    },
  };
};

export const buildMustEsFilterForDataProducts = (
  dataProductFqns: string[],
  testCaseFieldPrefix = ''
) => {
  const field = `${testCaseFieldPrefix}dataProducts.fullyQualifiedName`;

  return {
    bool: {
      should: dataProductFqns.map((fqn) => ({
        term: { [field]: fqn },
      })),
      minimum_should_match: 1,
    },
  };
};

export const getDimensionIcon = (dimension: DataQualityDimensions) => {
  switch (dimension) {
    case DataQualityDimensions.Accuracy:
      return AccuracyIcon;
    case DataQualityDimensions.Consistency:
      return ConsistencyIcon;
    case DataQualityDimensions.Completeness:
      return CompletenessIcon;
    case DataQualityDimensions.Integrity:
      return IntegrityIcon;
    case DataQualityDimensions.SQL:
      return SqlIcon;
    case DataQualityDimensions.Uniqueness:
      return UniquenessIcon;
    case DataQualityDimensions.Validity:
      return ValidityIcon;
    default:
      return NoDimensionIcon;
  }
};

export const convertSearchSourceToTable = (
  searchSource: TableSearchSource
): Table =>
  ({
    ...searchSource,
    columns: searchSource.columns || [],
  } as Table);

export type TestCaseCountByStatus = {
  success: number;
  failed: number;
  aborted: number;
  total: number;
};

/**
 * Calculate test case status counts from test cases array
 * @param testCases Array of test cases with testCaseResult
 * @returns Object with counts for success, failed, aborted, and total
 */
export const calculateTestCaseStatusCounts = (
  testCases: Array<{
    testCaseResult?: { testCaseStatus?: string };
  }>
): TestCaseCountByStatus => {
  return (testCases || []).reduce(
    (acc, testCase) => {
      const status = lowerCase(testCase.testCaseResult?.testCaseStatus);
      if (status) {
        switch (status) {
          case 'success':
            acc.success++;

            break;
          case 'failed':
            acc.failed++;

            break;
          case 'aborted':
            acc.aborted++;

            break;
        }
        acc.total++;
      }

      return acc;
    },
    { success: 0, failed: 0, aborted: 0, total: 0 }
  );
};

export const aggregateTestResultsByEntity = (
  data: Array<{
    document_count: string;
    entityFQN: string;
    'testCaseResult.testCaseStatus': string;
  }>
): Record<string, TestCaseCountByStatus> => {
  const overallTotal = {
    failed: 0,
    success: 0,
    aborted: 0,
    total: 0,
  };

  const entities = data.reduce((acc, item) => {
    const entity = item.entityFQN;
    const status = item['testCaseResult.testCaseStatus'] as
      | 'failed'
      | 'success'
      | 'aborted';
    const count = parseInt(item.document_count, 10);

    if (!acc[entity]) {
      acc[entity] = {
        failed: 0,
        success: 0,
        aborted: 0,
        total: 0,
      };
    }

    acc[entity][status] = (acc[entity][status] || 0) + count;
    acc[entity].total += count;

    overallTotal[status] = (overallTotal[status] || 0) + count;
    overallTotal.total += count;

    return acc;
  }, {} as Record<string, Record<string, number>>);

  return {
    ...entities,
    total: overallTotal,
  };
};

/**
 * Extracts the service type from a table entity for test definition filtering
 * @param table - The table entity
 * @returns The service type string or undefined if not available
 */
export const getServiceTypeForTestDefinition = (
  table?: Table
): string | undefined => {
  return table?.serviceType;
};

export function filterTestCasesByTableAndColumn(
  items: TestCase[],
  filterTables: string[],
  filterColumns: string[]
): TestCase[] {
  let result = items;
  if (filterTables.length > 0) {
    const tableSet = new Set(filterTables);
    result = result.filter((tc) => tableSet.has(getEntityFQN(tc.entityLink)));
  }
  if (filterColumns.length > 0) {
    const columnSet = new Set(filterColumns);
    result = result.filter((tc) => {
      if (!tc.entityLink?.includes('::columns::')) {
        return false;
      }

      const tableFqn = getEntityFQN(tc.entityLink);
      const colName = getColumnNameFromEntityLink(tc.entityLink);

      return columnSet.has(`${tableFqn}::${colName ?? ''}`);
    });
  }

  return result;
}

export const COLUMN_AGGREGATE_FIELD = 'columns.name.keyword';

export function getEntityLinkForColumnFilter(
  tableFqn: string,
  columnName: string
): string {
  return EntityLink.getTableEntityLink(tableFqn, columnName);
}

export function getColumnFilterEntityLink(
  columnFilterKey: string
): string | undefined {
  if (
    !columnFilterKey.includes('::') ||
    columnFilterKey.includes('::columns::') ||
    columnFilterKey.startsWith('<#E')
  ) {
    return undefined;
  }
  const lastSep = columnFilterKey.lastIndexOf('::');
  const tableFqn = columnFilterKey.slice(0, lastSep);
  const columnName = columnFilterKey.slice(lastSep + 2);

  return getEntityLinkForColumnFilter(tableFqn, columnName);
}

export function getColumnNameFromColumnFilterKey(
  columnFilterKey: string
): string | undefined {
  if (!columnFilterKey?.trim()) {
    return undefined;
  }

  return columnFilterKey.includes('::')
    ? columnFilterKey.slice(columnFilterKey.lastIndexOf('::') + 2)
    : columnFilterKey;
}
