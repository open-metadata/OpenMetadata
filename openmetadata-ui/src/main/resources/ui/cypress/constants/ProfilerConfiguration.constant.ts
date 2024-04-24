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
export const PROFILER_REQUEST_CONFIG = {
  config_type: 'profilerConfiguration',
  config_value: {
    metricConfiguration: [
      {
        dataType: 'AGG_STATE',
        metrics: [
          'COLUMN_COUNT',
          'COLUMN_NAMES',
          'COUNT',
          'COUNT_IN_SET',
          'DISTINCT_COUNT',
          'DISTINCT_RATIO',
          'DUPLICATE_COUNT',
          'FIRST_QUARTILE',
          'HISTOGRAM',
          'ILIKE_COUNT',
          'ILIKE_RATIO',
          'IQR',
          'LIKE_COUNT',
          'LIKE_RATIO',
          'MAX',
          'MAX_LENGTH',
          'MEAN',
          'MEDIAN',
          'MIN',
          'MIN_LENGTH',
          'NON_PARAMETRIC_SKEW',
          'NOT_LIKE_COUNT',
          'NOT_REGEX_COUNT',
          'NULL_COUNT',
          'NULL_RATIO',
          'REGEX_COUNT',
          'ROW_COUNT',
          'STDDEV',
          'SUM',
          'SYSTEM',
          'THIRD_QUARTILE',
          'UNIQUE_COUNT',
          'UNIQUE_RATIO',
        ],
        disabled: false,
      },
      {
        dataType: 'AGGREGATEFUNCTION',
        metrics: ['COLUMN_COUNT', 'COLUMN_NAMES'],
      },
      {
        dataType: 'ARRAY',
        metrics: [
          'COLUMN_COUNT',
          'COLUMN_NAMES',
          'COUNT',
          'COUNT_IN_SET',
          'DISTINCT_COUNT',
          'DISTINCT_RATIO',
          'DUPLICATE_COUNT',
          'FIRST_QUARTILE',
          'HISTOGRAM',
          'ILIKE_COUNT',
          'ILIKE_RATIO',
          'IQR',
          'LIKE_COUNT',
          'LIKE_RATIO',
          'MAX',
          'MAX_LENGTH',
          'MEAN',
          'MEDIAN',
          'MIN',
          'MIN_LENGTH',
          'NON_PARAMETRIC_SKEW',
          'NOT_LIKE_COUNT',
          'NOT_REGEX_COUNT',
          'NULL_COUNT',
          'NULL_RATIO',
          'REGEX_COUNT',
          'ROW_COUNT',
          'STDDEV',
          'SUM',
          'SYSTEM',
          'THIRD_QUARTILE',
          'UNIQUE_COUNT',
          'UNIQUE_RATIO',
        ],
        disabled: true,
      },
    ],
  },
};

export const PROFILER_EMPTY_RESPONSE_CONFIG = {
  config_type: 'profilerConfiguration',
  config_value: { metricConfiguration: [] },
};
