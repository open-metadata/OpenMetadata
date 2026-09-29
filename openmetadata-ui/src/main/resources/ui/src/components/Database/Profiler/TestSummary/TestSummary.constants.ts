/*
 *  Copyright 2026 Collate.
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

export interface ResultMetric {
  labelKey: string;
  /** The label takes the tested column's name, e.g. "customer_id max". */
  namesColumn?: boolean;
  /** The value the test asserts without stating it as a parameter. */
  impliedExpected?: number;
}

/**
 * What each test definition measures, for the chart card's caption. The
 * parameters say what the value is compared against; only the definition says
 * what the value is. A definition missing here reads as "Values".
 */
export const RESULT_METRIC_BY_DEFINITION: Record<string, ResultMetric> = {
  tableRowCountToEqual: { labelKey: 'label.result-metric-row-count' },
  tableRowCountToBeBetween: { labelKey: 'label.result-metric-row-count' },
  tableRowInsertedCountToBeBetween: {
    labelKey: 'label.result-metric-inserted-row-count',
  },
  tableColumnCountToEqual: { labelKey: 'label.result-metric-column-count' },
  tableColumnCountToBeBetween: {
    labelKey: 'label.result-metric-column-count',
  },
  tableCustomSQLQuery: { labelKey: 'label.result-metric-query-result' },
  columnValuesToBeUnique: {
    labelKey: 'label.result-metric-duplicate-count',
    impliedExpected: 0,
  },
  columnValuesToBeNotNull: {
    labelKey: 'label.result-metric-null-count',
    impliedExpected: 0,
  },
  columnValueMaxToBeBetween: {
    labelKey: 'label.result-metric-column-max',
    namesColumn: true,
  },
  columnValueMinToBeBetween: {
    labelKey: 'label.result-metric-column-min',
    namesColumn: true,
  },
  columnValueMeanToBeBetween: {
    labelKey: 'label.result-metric-column-mean',
    namesColumn: true,
  },
  columnValueMedianToBeBetween: {
    labelKey: 'label.result-metric-column-median',
    namesColumn: true,
  },
  columnValueStdDevToBeBetween: {
    labelKey: 'label.result-metric-column-std-dev',
    namesColumn: true,
  },
  columnValuesSumToBeBetween: {
    labelKey: 'label.result-metric-column-sum',
    namesColumn: true,
  },
  columnValueLengthsToBeBetween: {
    labelKey: 'label.result-metric-column-value-length',
    namesColumn: true,
  },
  columnValuesMissingCount: {
    labelKey: 'label.result-metric-column-missing-count',
    namesColumn: true,
  },
};

export const DEFAULT_RESULT_METRIC: ResultMetric = {
  labelKey: 'label.result-metric-values',
};
