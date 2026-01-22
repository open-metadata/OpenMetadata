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
import { Box, Card, Divider, Stack, Typography } from '@mui/material';
import { t } from 'i18next';
import {
  isArray,
  isNil,
  isUndefined,
  lowerCase,
  omit,
  omitBy,
  startCase,
  uniqBy,
} from 'lodash';
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
import { TestCaseSearchParams } from '../../components/DataQuality/DataQuality.interface';
import { TEST_CASE_FILTERS } from '../../constants/profiler.constant';
import { TestCaseType } from '../../enums/TestSuite.enum';
import { Table } from '../../generated/entity/data/table';
import { DataQualityReport } from '../../generated/tests/dataQualityReport';
import { TestCaseParameterValue } from '../../generated/tests/testCase';
import {
  DataQualityDimensions,
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import { DataInsightChartTooltipProps } from '../../interface/data-insight.interface';
import { TableSearchSource } from '../../interface/search.interface';
import { DataQualityDashboardChartFilters } from '../../pages/DataQuality/DataQualityPage.interface';
import { ListTestCaseParamsBySearch } from '../../rest/testAPI';
import { getEntryFormattedValue } from '../DataInsightUtils';
import { formatDate } from '../date-time/DateTimeUtils';
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
  return {
    term: {
      [isTestCaseResult ? 'testCase.owners.name' : 'owners.name']: ownerFqn,
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

  if (active && payload && payload.length) {
    // we need to check if the xAxis is a date or not.
    const timestamp = displayDateInHeader
      ? dateTimeFormatter(payload[0].payload[timeStampKey] || 0)
      : payload[0].payload[timeStampKey];

    const payloadValue = uniqBy(payload, 'dataKey');

    return (
      <Card
        sx={(theme) => ({
          p: '10px',
          bgcolor: theme.palette.allShades.white,
        })}>
        <Typography
          sx={(theme) => ({
            color: theme.palette.allShades.gray[900],
            fontWeight: theme.typography.fontWeightMedium,
            fontSize: theme.typography.pxToRem(12),
          })}>
          {timestamp}
        </Typography>
        <Divider
          sx={(theme) => ({
            my: 2,
            borderStyle: 'dashed',
            borderColor: theme.palette.allShades.gray[300],
          })}
        />
        <Stack spacing={1}>
          {payloadValue.map((entry, index) => {
            const value = entry.value;

            return (
              <Box
                className="d-flex items-center justify-between gap-6 p-b-xss text-sm"
                key={`item-${index}`}>
                <span className="flex items-center">
                  <Surface className="mr-2" height={14} version="1.1" width={4}>
                    <rect fill={entry.color} height="14" rx="2" width="4" />
                  </Surface>
                  <Typography
                    sx={(theme) => ({
                      color: theme.palette.allShades.gray[700],
                      fontSize: theme.typography.pxToRem(11),
                    })}>
                    {transformLabel
                      ? startCase(entry.name ?? (entry.dataKey as string))
                      : entry.name ?? (entry.dataKey as string)}
                  </Typography>
                </span>
                <Typography
                  sx={(theme) => ({
                    color: theme.palette.allShades.gray[900],
                    fontWeight: theme.typography.fontWeightMedium,
                    fontSize: theme.typography.pxToRem(11),
                  })}>
                  {valueFormatter
                    ? valueFormatter(value, entry.name ?? entry.dataKey)
                    : getEntryFormattedValue(value, isPercentage)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Card>
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

/**
 * Checks if a test definition supports a given service type
 * @param testDefinition - The test definition to check
 * @param serviceType - The service type to validate against
 * @returns true if the test definition supports the service type
 */
export const isTestDefinitionSupportedForService = (
  testDefinition: TestDefinition,
  serviceType?: string
): boolean => {
  // If no service type provided, cannot determine support
  if (!serviceType) {
    return true; // Default to showing all
  }

  // If supportedServices is empty or undefined, supports all services
  if (
    !testDefinition.supportedServices ||
    testDefinition.supportedServices.length === 0
  ) {
    return true;
  }

  // Check if service type is in the supported list
  return testDefinition.supportedServices.includes(serviceType);
};
