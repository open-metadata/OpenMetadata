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
import { CSMode } from '../../enums/codemirror.enum';
import {
  Language,
  Metric,
  MetricGranularity,
} from '../../generated/entity/data/metric';

const granularityOrder = [
  MetricGranularity.Second,
  MetricGranularity.Minute,
  MetricGranularity.Hour,
  MetricGranularity.Day,
  MetricGranularity.Week,
  MetricGranularity.Month,
  MetricGranularity.Quarter,
  MetricGranularity.Year,
];

export const getSortedOptions = (
  options: {
    label: string;
    value: string;
    key: string;
  }[],
  value: string | undefined,
  valueKey: keyof Metric
) => {
  return options.sort((a, b) => {
    if (a.value === value) {
      return -1;
    }
    if (b.value === value) {
      return 1;
    }

    return valueKey === 'granularity'
      ? granularityOrder.indexOf(a.value as MetricGranularity) -
          granularityOrder.indexOf(b.value as MetricGranularity)
      : 0;
  });
};

export const getMetricExpressionLanguageName = (language?: Language) => {
  if (!language) {
    return CSMode.SQL;
  }

  if (language === Language.Java) {
    return CSMode.CLIKE;
  }

  return language.toLowerCase() as CSMode;
};
