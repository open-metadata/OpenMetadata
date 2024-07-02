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

const metrics = [
  'columnCount',
  'columnNames',
  'countInSet',
  'distinctCount',
  'distinctProportion',
  'duplicateCount',
  'firstQuartile',
  'histogram',
  'iLikeCount',
  'iLikeRatio',
  'interQuartileRange',
  'likeCount',
  'likeRatio',
  'max',
  'maxLength',
  'mean',
  'median',
  'min',
  'minLength',
  'nonParametricSkew',
  'notLikeCount',
  'notRegexCount',
  'nullCount',
  'nullProportion',
  'regexCount',
  'rowCount',
  'stddev',
  'sum',
  'system',
  'thirdQuartile',
  'uniqueCount',
  'uniqueProportion',
  'valuesCount',
];

export const PROFILER_REQUEST_CONFIG = {
  config_type: 'profilerConfiguration',
  config_value: {
    metricConfiguration: [
      {
        dataType: 'AGG_STATE',
        metrics,
        disabled: false,
      },
      {
        dataType: 'AGGREGATEFUNCTION',
        metrics: ['columnCount', 'columnNames'],
      },
      {
        dataType: 'ARRAY',
        metrics,
        disabled: true,
      },
    ],
  },
};

export const PROFILER_EMPTY_RESPONSE_CONFIG = {
  config_type: 'profilerConfiguration',
  config_value: { metricConfiguration: [] },
};
