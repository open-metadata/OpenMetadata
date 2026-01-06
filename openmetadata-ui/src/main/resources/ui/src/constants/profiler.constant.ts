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

import { map, startCase, values } from 'lodash';
import { DateFilterType, StepperStepType } from 'Models';
import { TestCaseSearchParams } from '../components/DataQuality/DataQuality.interface';
import { SORT_ORDER } from '../enums/common.enum';
import { TestCaseType } from '../enums/TestSuite.enum';
import { DMLOperationType } from '../generated/api/data/createTableProfile';
import {
  ColumnProfilerConfig,
  DataType,
  PartitionIntervalTypes,
  PartitionIntervalUnit,
  ProfileSampleType,
} from '../generated/entity/data/table';
import { MetricType } from '../generated/settings/settings';
import { TestCaseStatus } from '../generated/tests/testCase';
import {
  DataQualityDimensions,
  TestPlatform,
} from '../generated/tests/testDefinition';
import {
  getCurrentMillis,
  getEndOfDayInMillis,
  getEpochMillisForPastDays,
  getStartOfDayInMillis,
} from '../utils/date-time/DateTimeUtils';
import i18n, { t } from '../utils/i18next/LocalUtil';
import { BLUE_50, BLUE_500, BLUE_800, YELLOW_3 } from './Color.constants';

export const PROFILER_METRIC = [
  'valuesCount',
  'valuesPercentage',
  'validCount',
  'duplicateCount',
  'nullCount',
  'nullProportion',
  'missingPercentage',
  'missingCount',
  'uniqueCount',
  'uniqueProportion',
  'distinctCount',
  'distinctProportion',
  'min',
  'max',
  'minLength',
  'maxLength',
  'mean',
  'sum',
  'stddev',
  'variance',
  'median',
  'histogram',
  'customMetricsProfile',
];
export const PROFILER_CHART_DATA_SIZE = 500;

export const PROFILER_FILTER_RANGE: DateFilterType = {
  yesterday: {
    days: 1,
    title: 'label.yesterday',
  },
  last3days: {
    days: 3,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 3,
    },
  },
  last7days: {
    days: 7,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 7,
    },
  },
  last14days: {
    days: 14,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 14,
    },
  },
  last30days: {
    days: 30,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 30,
    },
  },
  last60days: {
    days: 60,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 60,
    },
  },
};

export const DEFAULT_SELECTED_RANGE = {
  key: 'last7days',
  title: 'label.last-number-of-days',
  titleData: {
    numberOfDays: 7,
  },
  days: 7,
};

export const DEFAULT_RANGE_DATA = {
  startTs: getStartOfDayInMillis(
    getEpochMillisForPastDays(DEFAULT_SELECTED_RANGE.days)
  ),
  endTs: getEndOfDayInMillis(getCurrentMillis()),
};

export const COLORS = ['#7147E8', '#B02AAC', '#B02AAC', '#1890FF', '#008376'];

export const INITIAL_COUNT_METRIC_VALUE = {
  information: [
    {
      title: t('label.entity-count', {
        entity: t('label.distinct'),
      }),
      dataKey: 'distinctCount',
      color: '#467DDC',
    },
    {
      title: t('label.entity-count', {
        entity: t('label.null'),
      }),
      dataKey: 'nullCount',
      color: '#3488B5',
    },
    {
      title: t('label.entity-count', {
        entity: t('label.unique'),
      }),
      dataKey: 'uniqueCount',
      color: '#685997',
    },
    {
      title: t('label.entity-count', {
        entity: t('label.value-plural'),
      }),
      dataKey: 'valuesCount',
      color: '#464A52',
    },
  ],
  data: [],
};

export const INITIAL_PROPORTION_METRIC_VALUE = {
  information: [
    {
      title: t('label.entity-proportion', {
        entity: t('label.distinct'),
      }),
      dataKey: 'distinctProportion',
      color: '#6B97E3',
    },
    {
      title: t('label.entity-proportion', {
        entity: t('label.null'),
      }),
      dataKey: 'nullProportion',
      color: '#867AAC',
    },
    {
      title: t('label.entity-proportion', {
        entity: t('label.unique'),
      }),
      dataKey: 'uniqueProportion',
      color: '#6B6E75',
    },
  ],
  data: [],
};

export const INITIAL_MATH_METRIC_VALUE = {
  information: [
    {
      title: t('label.max'),
      dataKey: 'max',
      color: '#6B97E3',
    },
    {
      title: t('label.mean'),
      dataKey: 'mean',
      color: '#6B6E75',
    },
    {
      title: t('label.min'),
      dataKey: 'min',
      color: '#867AAC',
    },
  ],
  data: [],
};

export const INITIAL_SUM_METRIC_VALUE = {
  information: [
    {
      title: t('label.sum'),
      dataKey: 'sum',
      color: BLUE_500,
      fill: BLUE_50,
    },
  ],
  data: [],
};
export const INITIAL_QUARTILE_METRIC_VALUE = {
  information: [
    {
      title: t('label.first-quartile'),
      dataKey: 'firstQuartile',
      color: '#467DDC',
    },
    {
      title: t('label.median'),
      dataKey: 'median',
      color: '#3488B5',
    },
    {
      title: t('label.inter-quartile-range'),
      dataKey: 'interQuartileRange',
      color: '#685997',
    },
    {
      title: t('label.third-quartile'),
      dataKey: 'thirdQuartile',
      color: '#464A52',
    },
  ],
  data: [],
};

export const INITIAL_ROW_METRIC_VALUE = {
  information: [
    {
      title: t('label.entity-count', {
        entity: t('label.row'),
      }),
      dataKey: 'rowCount',
      color: BLUE_500,
      fill: BLUE_50,
    },
  ],
  data: [],
};

export const INITIAL_OPERATION_METRIC_VALUE = {
  information: [
    {
      title: t('label.insert'),
      dataKey: DMLOperationType.Insert,
      color: BLUE_800,
      stackId: 'operation-metrics',
    },
    {
      title: t('label.update'),
      dataKey: DMLOperationType.Update,
      color: BLUE_500,
      stackId: 'operation-metrics',
    },
    {
      title: t('label.delete'),
      dataKey: DMLOperationType.Delete,
      color: YELLOW_3,
      stackId: 'operation-metrics',
    },
  ],
  data: [],
};

export const DEFAULT_INCLUDE_PROFILE: ColumnProfilerConfig[] = [
  {
    columnName: undefined,
    metrics: ['all'],
  },
];

export const INITIAL_ENTITY_HEALTH_MATRIX = {
  healthy: 0,
  unhealthy: 0,
  total: 0,
};

export const INITIAL_DATA_ASSETS_COVERAGE_STATES = {
  covered: 0,
  notCovered: 0,
  total: 0,
};

export const STEPS_FOR_ADD_TEST_CASE: Array<StepperStepType> = [
  {
    name: 'label.configure-entity',
    nameData: { entity: 'label.test-case-lowercase' },
    step: 1,
  },
  { name: 'label.success', step: 2 },
];

export const SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME = [
  DataType.Timestamp,
  DataType.Date,
  DataType.Datetime,
  DataType.Timestampz,
];

export const SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL = {
  [PartitionIntervalTypes.IngestionTime]:
    SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME,
  [PartitionIntervalTypes.TimeUnit]: SUPPORTED_PARTITION_TYPE_FOR_DATE_TIME,
  [PartitionIntervalTypes.IntegerRange]: [DataType.Int, DataType.Bigint],
  [PartitionIntervalTypes.ColumnValue]: [DataType.Varchar, DataType.String],
} as Record<PartitionIntervalTypes, DataType[]>;

export const INTERVAL_TYPE_OPTIONS = Object.keys(
  SUPPORTED_COLUMN_DATA_TYPE_FOR_INTERVAL
).map((value) => ({
  value,
  label: value,
}));
export const INTERVAL_UNIT_OPTIONS = Object.values(PartitionIntervalUnit).map(
  (value) => ({
    value,
    label: value,
  })
);

export const PROFILE_SAMPLE_OPTIONS = [
  {
    label: t('label.percentage'),
    key: ProfileSampleType.Percentage,
    value: ProfileSampleType.Percentage,
  },
  {
    label: t('label.entity-count', {
      entity: t('label.row'),
    }),
    key: ProfileSampleType.Rows,
    value: ProfileSampleType.Rows,
  },
];

export const DEFAULT_HISTOGRAM_DATA = {
  boundaries: [],
  frequencies: [],
};

export const PROFILER_MODAL_LABEL_STYLE = {
  style: {
    paddingBottom: 8,
  },
};

export const TIME_BASED_PARTITION = [
  PartitionIntervalTypes.IngestionTime,
  PartitionIntervalTypes.TimeUnit,
];

export const TEST_CASE_TYPE_OPTION = [
  ...map(TestCaseType, (value) => ({
    label: t('label.' + value),
    value: value,
  })),
];

export const TEST_CASE_STATUS_OPTION = [
  {
    label: t('label.all'),
    value: '',
  },
  ...values(TestCaseStatus).map((value) => ({
    label: t('label.' + value.toLowerCase()),
    value: value,
  })),
];

export const TEST_CASE_FILTERS: Record<string, keyof TestCaseSearchParams> = {
  table: 'tableFqn',
  platform: 'testPlatforms',
  type: 'testCaseType',
  status: 'testCaseStatus',
  lastRun: 'lastRunRange',
  tier: 'tier',
  tags: 'tags',
  service: 'serviceName',
  dimension: 'dataQualityDimension',
};

export const TEST_CASE_FILTERS_LABELS: Record<
  keyof typeof TEST_CASE_FILTERS,
  string
> = {
  table: i18n.t('label.table'),
  platform: i18n.t('label.platform'),
  type: i18n.t('label.type'),
  status: i18n.t('label.status'),
  lastRun: i18n.t('label.last-run'),
  tier: i18n.t('label.tier'),
  tags: i18n.t('label.tag-plural'),
  service: i18n.t('label.service'),
  dimension: i18n.t('label.dimension'),
};

export const TEST_CASE_PLATFORM_OPTION = values(TestPlatform).map((value) => ({
  label: value,
  value: value,
}));

export const TEST_CASE_DIMENSION_LABELS: Record<DataQualityDimensions, string> =
  {
    [DataQualityDimensions.Accuracy]: i18n.t('label.accuracy'),
    [DataQualityDimensions.Completeness]: i18n.t('label.completeness'),
    [DataQualityDimensions.Consistency]: i18n.t('label.consistency'),
    [DataQualityDimensions.Integrity]: i18n.t('label.integrity'),
    [DataQualityDimensions.NoDimension]: i18n.t('label.no-dimension'),
    [DataQualityDimensions.SQL]: i18n.t('label.sql-uppercase'),
    [DataQualityDimensions.Uniqueness]: i18n.t('label.uniqueness'),
    [DataQualityDimensions.Validity]: i18n.t('label.validity'),
  };

export const TEST_CASE_STATUS_LABELS: Record<TestCaseStatus, string> = {
  [TestCaseStatus.Aborted]: i18n.t('label.aborted'),
  [TestCaseStatus.Failed]: i18n.t('label.failed'),
  [TestCaseStatus.Queued]: i18n.t('label.queued'),
  [TestCaseStatus.Success]: i18n.t('label.success'),
};

export const TEST_CASE_DIMENSIONS_OPTION = values(DataQualityDimensions).map(
  (value) => ({
    label: TEST_CASE_DIMENSION_LABELS[value],
    value: value,
  })
);

export const INITIAL_COLUMN_METRICS_VALUE = {
  countMetrics: INITIAL_COUNT_METRIC_VALUE,
  proportionMetrics: INITIAL_PROPORTION_METRIC_VALUE,
  mathMetrics: INITIAL_MATH_METRIC_VALUE,
  sumMetrics: INITIAL_SUM_METRIC_VALUE,
  quartileMetrics: INITIAL_QUARTILE_METRIC_VALUE,
};

export const PROFILER_METRICS_TYPE_OPTIONS = [
  {
    label: 'All',
    key: 'all',
    value: 'all',
    children: values(MetricType).map((value) => ({
      label: startCase(value),
      key: value,
      value,
    })),
  },
];

export const DEFAULT_PROFILER_CONFIG_VALUE = {
  metricConfiguration: [
    {
      dataType: undefined,
      metrics: undefined,
      disabled: false,
    },
  ],
};

export const DEFAULT_SORT_ORDER = {
  sortType: SORT_ORDER.DESC,
  sortField: 'testCaseResult.timestamp',
};
