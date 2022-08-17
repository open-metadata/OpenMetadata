/*
 *  Copyright 2021 Collate
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

import { CSMode } from '../enums/codemirror.enum';
import { ColumnProfilerConfig } from '../generated/entity/data/table';
import { JSON_TAB_SIZE } from './constants';

export const ENTITY_DELETE_STATE = {
  loading: 'initial',
  state: false,
  softDelete: true,
};

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

export const PROFILER_FILTER_RANGE = {
  last3days: { days: 3, title: 'Last 3 days' },
  last7days: { days: 7, title: 'Last 7 days' },
  last14days: { days: 14, title: 'Last 14 days' },
  last30days: { days: 30, title: 'Last 30 days' },
  last60days: { days: 60, title: 'Last 60 days' },
};

export const DEFAULT_CHART_COLLECTION_VALUE = {
  distinctCount: { data: [], color: '#1890FF' },
  uniqueCount: { data: [], color: '#008376' },
  nullCount: { data: [], color: '#7147E8' },
  nullProportion: { data: [], color: '#B02AAC' },
};

export const DEFAULT_INCLUDE_PROFILE: ColumnProfilerConfig[] = [
  {
    columnName: undefined,
    metrics: ['all'],
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
