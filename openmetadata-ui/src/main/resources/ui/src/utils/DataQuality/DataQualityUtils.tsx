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
import { t } from 'i18next';
import {
  cloneDeep,
  isArray,
  isNil,
  isUndefined,
  lowerCase,
  omit,
  omitBy,
  parseInt,
  startCase,
  uniqBy,
} from 'lodash';
import QueryString from 'qs';
import { Surface } from 'recharts';
import { ReactComponent as AccuracyIcon } from '../../assets/svg/ic-accuracy.svg';
import { ReactComponent as ColumnIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as CompletenessIcon } from '../../assets/svg/ic-completeness.svg';
import { ReactComponent as ConsistencyIcon } from '../../assets/svg/ic-consistency.svg';
import { ReactComponent as IntegrityIcon } from '../../assets/svg/ic-integrity.svg';
import { ReactComponent as SqlIcon } from '../../assets/svg/ic-sql.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table-test.svg';
import { ReactComponent as UniquenessIcon } from '../../assets/svg/ic-uniqueness.svg';
import { ReactComponent as ValidityIcon } from '../../assets/svg/ic-validity.svg';
import { ReactComponent as NoDimensionIcon } from '../../assets/svg/no-dimension-icon.svg';
import { SelectionOption } from '../../components/common/SelectionCardGroup/SelectionCardGroup.interface';
import { StatusData } from '../../components/DataQuality/ChartWidgets/StatusCardWidget/StatusCardWidget.interface';
import { TestCaseSearchParams } from '../../components/DataQuality/DataQuality.interface';
import { SearchDropdownOption } from '../../components/SearchDropdown/SearchDropdown.interface';
import { TEXT_GREY_MUTED } from '../../constants/constants';
import { DEFAULT_DIMENSIONS_DATA } from '../../constants/DataQuality.constants';
import { TEST_CASE_FILTERS } from '../../constants/profiler.constant';
import { TestCaseType } from '../../enums/TestSuite.enum';
import { Table } from '../../generated/entity/data/table';
import { TestCaseStatus } from '../../generated/entity/feed/testCaseResult';
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
import { DataInsightChartTooltipProps } from '../../interface/data-insight.interface';
import { TableSearchSource } from '../../interface/search.interface';
import {
  DataQualityDashboardChartFilters,
  DataQualityPageTabs,
} from '../../pages/DataQuality/DataQualityPage.interface';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import { getEntryFormattedValue } from '../DataInsightUtils';
import { formatDate } from '../date-time/DateTimeUtils';
import EntityLink from '../EntityLink';
import { getColumnNameFromEntityLink } from '../EntityUtils';
import { getEntityFQN } from '../FeedUtils';
import { getDataQualityPagePath } from '../RouterUtils';
import { generateEntityLink } from '../TableUtils';

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

export const getTestCaseFiltersValue = (
  values: TestCaseSearchParams,
  selectedFilter: string[]
) => {
  const { lastRunRange, tableFqn } = values;
  const startTimestamp = lastRunRange?.startTs;
  const endTimestamp = lastRunRange?.endTs;
  const entityLink = tableFqn ? generateEntityLink(tableFqn) : undefined;

  const apiParams = {
    ...omit(values, ['lastRunRange', 'tableFqn', 'searchValue']),
    startTimestamp,
    endTimestamp,
    entityLink,
  };

  const updatedParams = omitBy(
    buildTestCaseParams(apiParams, selectedFilter),
    isUndefined
  );

  return updatedParams;
};

export const transformToTestCaseStatusObject = (
  data: DataQualityReport['data']
) => {
  // Initialize output data with zeros
  const outputData = {
    success: 0,
    failed: 0,
    aborted: 0,
    total: 0,
  };

  // Use reduce to process input data and calculate the counts
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

    acc.total += count; // Update total count

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

export const buildDataQualityDashboardFilters = (data: {
  filters?: DataQualityDashboardChartFilters;
  unhealthy?: boolean;
  isTableApi?: boolean;
}) => {
  const { filters, unhealthy = false, isTableApi = false } = data;
  const mustFilter = [];

  if (unhealthy) {
    mustFilter.push({
      terms: {
        'testCaseStatus.keyword': ['Failed', 'Aborted'],
      },
    });
  }

  if (filters?.ownerFqn) {
    mustFilter.push(buildMustEsFilterForOwner(filters.ownerFqn));
  }

  if (filters?.tags && isTableApi) {
    mustFilter.push({
      bool: {
        should: filters.tags.map((tag) => ({
          term: {
            'tags.tagFQN': tag,
          },
        })),
      },
    });
  }

  if (filters?.tier && isTableApi) {
    mustFilter.push({
      bool: {
        should: filters.tier.map((tag) => ({
          term: {
            'tier.tagFQN': tag,
          },
        })),
      },
    });
  }

  if ((filters?.tags || filters?.tier) && !isTableApi) {
    mustFilter.push(
      buildMustEsFilterForTags([
        ...(filters?.tags ?? []),
        ...(filters?.tier ?? []),
      ])
    );
  }

  if (filters?.dataProductFqns && filters.dataProductFqns.length > 0) {
    mustFilter.push(buildMustEsFilterForDataProducts(filters.dataProductFqns));
  }

  if (filters?.entityFQN) {
    mustFilter.push({
      term: {
        [isTableApi ? 'fullyQualifiedName.keyword' : 'originEntityFQN']:
          filters.entityFQN,
      },
    });
  }

  if (filters?.serviceName) {
    mustFilter.push({
      term: {
        'service.name.keyword': filters.serviceName,
      },
    });
  }

  if (filters?.testPlatforms) {
    mustFilter.push({
      terms: {
        testPlatforms: filters.testPlatforms,
      },
    });
  }

  if (filters?.dataQualityDimension) {
    mustFilter.push({
      term: {
        dataQualityDimension: filters.dataQualityDimension,
      },
    });
  }

  if (filters?.testCaseStatus) {
    mustFilter.push({
      term: {
        'testCaseResult.testCaseStatus': filters.testCaseStatus,
      },
    });
  }

  if (filters?.testCaseType) {
    if (filters.testCaseType === TestCaseType.table) {
      mustFilter.push({
        bool: { must_not: [{ regexp: { entityLink: '.*::columns::.*' } }] },
      });
    }

    if (filters.testCaseType === TestCaseType.column) {
      mustFilter.push({ regexp: { entityLink: '.*::columns::.*' } });
    }
  }

  if (filters?.startTs && filters?.endTs && !isTableApi) {
    mustFilter.push({
      range: {
        'testCaseResult.timestamp': {
          gte: filters.startTs,
          lte: filters.endTs,
        },
      },
    });
  }

  // Add the deleted filter to the mustFilter array
  mustFilter.push({
    term: {
      deleted: false,
    },
  });

  return mustFilter;
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

export const TEST_LEVEL_OPTIONS: SelectionOption[] = [
  {
    value: TestCaseType.table,
    label: t('label.table-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.table-lowercase'),
    }),
    icon: <TableIcon />,
  },
  {
    value: TestCaseType.column,
    label: t('label.column-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.column-lowercase'),
    }),
    icon: <ColumnIcon />,
  },
];

export const CustomDQTooltip = (props: DataInsightChartTooltipProps) => {
  const {
    active,
    dateTimeFormatter = formatDate,
    isPercentage,
    payload = [],
    timeStampKey = 'timestampValue',
    transformLabel = true,
    valueFormatter,
    displayDateInHeader = true,
  } = props;

  if (active && payload?.length) {
    // we need to check if the xAxis is a date or not.
    const timestamp = displayDateInHeader
      ? dateTimeFormatter(payload[0].payload[timeStampKey] || 0)
      : payload[0].payload[timeStampKey];

    const payloadValue = uniqBy(payload, 'dataKey');

    return (
      <div className="tw:bg-primary tw:rounded-xl tw:border tw:border-border-secondary tw:shadow-md tw:p-2.5">
        <p className="tw:m-0 tw:text-primary tw:font-medium tw:text-xs">
          {timestamp}
        </p>
        <hr className="tw:border-primary tw:my-2 tw:border-dashed" />
        <div className="tw:flex tw:flex-col tw:gap-1">
          {payloadValue.map((entry, index) => {
            const value = entry.value;

            return (
              <div
                className="tw:flex tw:items-center tw:justify-between tw:gap-6 tw:pb-1 tw:text-sm"
                key={`item-${index}`}>
                <span className="tw:flex tw:items-center">
                  <Surface
                    className="tw:mr-2"
                    height={14}
                    version="1.1"
                    width={4}>
                    <rect fill={entry.color} height="14" rx="2" width="4" />
                  </Surface>
                  <span className="tw:text-tertiary tw:text-[11px]">
                    {transformLabel
                      ? startCase(entry.name ?? (entry.dataKey as string))
                      : entry.name ?? (entry.dataKey as string)}
                  </span>
                </span>
                <span className="tw:font-medium tw:text-primary tw:text-[11px]">
                  {valueFormatter
                    ? valueFormatter(value, entry.name ?? entry.dataKey)
                    : getEntryFormattedValue(value, isPercentage)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

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

    // Initialize entity if not exists
    if (!acc[entity]) {
      acc[entity] = {
        failed: 0,
        success: 0,
        aborted: 0,
        total: 0,
      };
    }

    // Add the count to the appropriate status for the entity
    acc[entity][status] = (acc[entity][status] || 0) + count;
    acc[entity].total += count;

    // Also add to the overall total
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

export function getColumnFilterOptions(
  items: TestCase[]
): SearchDropdownOption[] {
  const withColumn = items.filter((tc) =>
    tc.entityLink?.includes('::columns::')
  );
  const pairs = withColumn.map((tc) => {
    const tableFqn = getEntityFQN(tc.entityLink);
    const colName = getColumnNameFromEntityLink(tc.entityLink);

    return {
      key: `${tableFqn}::${colName ?? ''}`,
      label: colName ?? '--',
    };
  });
  const seen = new Set<string>();

  return pairs.filter((p) => {
    if (seen.has(p.key)) {
      return false;
    }

    seen.add(p.key);

    return true;
  });
}

export function getSelectedOptionsFromKeys(
  keys: string[],
  options: SearchDropdownOption[],
  getDefaultLabel: (key: string) => string
): SearchDropdownOption[] {
  return keys.map((key) => {
    const opt = options.find((o) => o.key === key);

    return opt ?? { key, label: getDefaultLabel(key) };
  });
}

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

export function parseColumnAggregateBuckets(
  buckets: { key?: string }[],
  tableFqn?: string
): SearchDropdownOption[] {
  const seen = new Set<string>();

  return (buckets ?? []).reduce<SearchDropdownOption[]>((acc, b) => {
    const colKey = b.key ?? '';
    const key = tableFqn ? `${tableFqn}::${colKey}` : colKey;
    if (!key || seen.has(key)) {
      return acc;
    }
    seen.add(key);
    acc.push({ key, label: colKey });

    return acc;
  }, []);
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

/** Returns path and search for navigating to the Test Cases tab with a status filter. */
export const getTestCaseTabPath = (testCaseStatus: TestCaseStatus) => ({
  pathname: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
  search: QueryString.stringify({ testCaseStatus }),
});

export const transformToTestCaseStatusByDimension = (
  inputData: DataQualityReport['data']
): StatusData[] => {
  const result: { [key: string]: StatusData } = cloneDeep(
    DEFAULT_DIMENSIONS_DATA
  );

  inputData.forEach((item) => {
    const {
      document_count,
      'testCaseResult.testCaseStatus': status,
      dataQualityDimension = DataQualityDimensions.NoDimension,
    } = item;
    const count = parseInt(document_count, 10);

    if (!result[dataQualityDimension]) {
      result[dataQualityDimension] = {
        title: dataQualityDimension,
        success: 0,
        failed: 0,
        aborted: 0,
        total: 0,
      };
    }

    if (status === 'success') {
      result[dataQualityDimension].success += count;
    } else if (status === 'failed') {
      result[dataQualityDimension].failed += count;
    } else if (status === 'aborted') {
      result[dataQualityDimension].aborted += count;
    }

    result[dataQualityDimension].total += count;
  });

  return Object.values(result);
};

export const getPieChartLabel = (label: string, value = 0) => {
  return (
    <>
      <text
        dy={8}
        fill="#1D2939"
        fontSize={20}
        fontWeight={600}
        textAnchor="middle"
        x="50%"
        y="56%">
        {value}
      </text>
      <text
        dy={8}
        fill={TEXT_GREY_MUTED}
        fontSize={12}
        fontWeight={500}
        textAnchor="middle"
        x="50%"
        y="44%">
        {label}
      </text>
    </>
  );
};
