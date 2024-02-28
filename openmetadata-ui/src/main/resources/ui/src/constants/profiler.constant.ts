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

import { t } from 'i18next';
import { map, values } from 'lodash';
import { DateFilterType, StepperStepType } from 'Models';
import { CSMode } from '../enums/codemirror.enum';
import { DMLOperationType } from '../generated/api/data/createTableProfile';
import {
  ColumnProfilerConfig,
  DataType,
  PartitionIntervalTypes,
  PartitionIntervalUnit,
  ProfileSampleType,
} from '../generated/entity/data/table';
import { TestCaseStatus } from '../generated/tests/testCase';
import { EntityType } from '../generated/tests/testDefinition';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../utils/date-time/DateTimeUtils';
import i18n from '../utils/i18next/LocalUtil';
import { GREEN_3, PURPLE_2, RED_3 } from './Color.constants';
import { JSON_TAB_SIZE } from './constants';

export const excludedMetrics = [
  'profilDate',
  'name',
  'nullCount',
  'nullProportion',
  'uniqueCount',
  'uniqueProportion',
  'rows',
  'histogram',
  'missingCount',
  'missingPercentage',
  'distinctProportion',
];

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

export const PROFILER_FILTER_RANGE: DateFilterType = {
  yesterday: {
    days: 1,
    title: t('label.yesterday'),
  },
  last3days: {
    days: 3,
    title: t('label.last-number-of-days', {
      numberOfDays: 3,
    }),
  },
  last7days: {
    days: 7,
    title: t('label.last-number-of-days', {
      numberOfDays: 7,
    }),
  },
  last14days: {
    days: 14,
    title: t('label.last-number-of-days', {
      numberOfDays: 14,
    }),
  },
  last30days: {
    days: 30,
    title: t('label.last-number-of-days', {
      numberOfDays: 30,
    }),
  },
  last60days: {
    days: 60,
    title: t('label.last-number-of-days', {
      numberOfDays: 60,
    }),
  },
};

export const DEFAULT_SELECTED_RANGE = {
  key: 'last3days',
  title: t('label.last-number-of-days', {
    numberOfDays: 3,
  }),
  days: 3,
};

export const DEFAULT_RANGE_DATA = {
  startTs: getEpochMillisForPastDays(DEFAULT_SELECTED_RANGE.days),
  endTs: getCurrentMillis(),
};

export const COLORS = ['#7147E8', '#B02AAC', '#B02AAC', '#1890FF', '#008376'];

export const DEFAULT_CHART_COLLECTION_VALUE = {
  distinctCount: { data: [], color: '#1890FF' },
  uniqueCount: { data: [], color: '#008376' },
  nullCount: { data: [], color: '#7147E8' },
  nullProportion: { data: [], color: '#B02AAC' },
};

export const INITIAL_COUNT_METRIC_VALUE = {
  information: [
    {
      title: t('label.entity-count', {
        entity: t('label.distinct'),
      }),
      dataKey: 'distinctCount',
      color: '#1890FF',
    },
    {
      title: t('label.entity-count', {
        entity: t('label.null'),
      }),
      dataKey: 'nullCount',
      color: '#7147E8',
    },
    {
      title: t('label.entity-count', {
        entity: t('label.unique'),
      }),
      dataKey: 'uniqueCount',
      color: '#008376',
    },
    {
      title: t('label.entity-count', {
        entity: t('label.value-plural'),
      }),
      dataKey: 'valuesCount',
      color: '#B02AAC',
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
      color: '#1890FF',
    },
    {
      title: t('label.entity-proportion', {
        entity: t('label.null'),
      }),
      dataKey: 'nullProportion',
      color: '#7147E8',
    },
    {
      title: t('label.entity-proportion', {
        entity: t('label.unique'),
      }),
      dataKey: 'uniqueProportion',
      color: '#008376',
    },
  ],
  data: [],
};

export const INITIAL_MATH_METRIC_VALUE = {
  information: [
    {
      title: t('label.max'),
      dataKey: 'max',
      color: '#1890FF',
    },
    {
      title: t('label.mean'),
      dataKey: 'mean',
      color: '#7147E8',
    },
    {
      title: t('label.min'),
      dataKey: 'min',
      color: '#008376',
    },
  ],
  data: [],
};

export const INITIAL_SUM_METRIC_VALUE = {
  information: [
    {
      title: t('label.sum'),
      dataKey: 'sum',
      color: '#1890FF',
    },
  ],
  data: [],
};
export const INITIAL_QUARTILE_METRIC_VALUE = {
  information: [
    {
      title: i18n.t('label.first-quartile'),
      dataKey: 'firstQuartile',
      color: '#1890FF',
    },
    {
      title: i18n.t('label.median'),
      dataKey: 'median',
      color: '#7147E8',
    },
    {
      title: i18n.t('label.inter-quartile-range'),
      dataKey: 'interQuartileRange',
      color: '#008376',
    },
    {
      title: i18n.t('label.third-quartile'),
      dataKey: 'thirdQuartile',
      color: '#B02AAC',
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
      color: GREEN_3,
    },
  ],
  data: [],
};

export const INITIAL_OPERATION_METRIC_VALUE = {
  information: [
    {
      title: t('label.insert'),
      dataKey: DMLOperationType.Insert,
      color: GREEN_3,
    },
    {
      title: t('label.update'),
      dataKey: DMLOperationType.Update,
      color: PURPLE_2,
    },
    {
      title: t('label.delete'),
      dataKey: DMLOperationType.Delete,
      color: RED_3,
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

export const INITIAL_TEST_RESULT_SUMMARY = {
  success: 0,
  aborted: 0,
  failed: 0,
};

export const DEFAULT_TEST_VALUE = [
  {
    value: 0,
    type: TestCaseStatus.Success,
  },
  {
    value: 0,
    type: TestCaseStatus.Aborted,
  },
  {
    value: 0,
    type: TestCaseStatus.Failed,
  },
];

export const codeMirrorOption = {
  tabSize: JSON_TAB_SIZE,
  indentUnit: JSON_TAB_SIZE,
  indentWithTabs: true,
  lineNumbers: true,
  lineWrapping: true,
  styleActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  mode: {
    name: CSMode.SQL,
  },
};

export const STEPS_FOR_ADD_TEST_CASE: Array<StepperStepType> = [
  {
    name: t('label.configure-entity', {
      entity: t('label.test-case-lowercase'),
    }),
    step: 1,
  },
  { name: t('label.success'), step: 2 },
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
  {
    label: t('label.all'),
    value: '',
  },
  ...map(EntityType, (value, key) => ({
    label: key,
    value: value,
  })),
];

export const TEST_CASE_STATUS_OPTION = [
  {
    label: t('label.all'),
    value: '',
  },
  ...values(TestCaseStatus).map((value) => ({
    label: value,
    value: value,
  })),
];

export const INITIAL_COLUMN_METRICS_VALUE = {
  countMetrics: INITIAL_COUNT_METRIC_VALUE,
  proportionMetrics: INITIAL_PROPORTION_METRIC_VALUE,
  mathMetrics: INITIAL_MATH_METRIC_VALUE,
  sumMetrics: INITIAL_SUM_METRIC_VALUE,
  quartileMetrics: INITIAL_QUARTILE_METRIC_VALUE,
};
