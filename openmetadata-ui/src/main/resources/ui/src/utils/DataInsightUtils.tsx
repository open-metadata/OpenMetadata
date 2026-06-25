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

import { first, get, isUndefined, meanBy, round, sumBy } from 'lodash';
import {
  ENTITIES_SUMMARY_LIST,
  WEB_SUMMARY_LIST,
} from '../constants/DataInsight.constants';
import type { SystemChartType } from '../enums/DataInsight.enum';
import type { DataInsightChartResult } from '../generated/dataInsight/dataInsightChartResult';
import { DataInsightChartType } from '../generated/dataInsight/dataInsightChartResult';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import { t, translateWithNestedKeys } from './i18next/LocalUtil';
import { pluralize } from './StringUtils';

export const getEntitiesChartSummary = (
  chartResults?: Record<SystemChartType, DataInsightCustomChartResult>
) => {
  const updatedSummaryList = ENTITIES_SUMMARY_LIST.map((summary) => {
    const chartData = get(chartResults, summary.type) as
      | DataInsightCustomChartResult
      | undefined;

    const count = round(first(chartData?.results)?.count ?? 0, 2);
    const translatedLabel = translateWithNestedKeys(
      summary.label,
      summary.labelData
    );

    return chartData
      ? {
          ...summary,
          latest: count,
          label: translatedLabel,
        }
      : {
          ...summary,
          label: translatedLabel,
        };
  });

  return updatedSummaryList;
};

export const getWebChartSummary = (
  chartResults: (DataInsightChartResult | undefined)[]
) => {
  const updatedSummary = [];

  for (const summary of WEB_SUMMARY_LIST) {
    // grab the current chart type
    const chartData = chartResults.find(
      (chart) => chart?.chartType === summary.id
    );
    // return default summary if chart data is undefined else calculate the latest count for chartType
    if (isUndefined(chartData)) {
      updatedSummary.push(summary);

      continue;
    }

    const { chartType, data } = chartData;

    let latest;
    if (chartType === DataInsightChartType.DailyActiveUsers) {
      latest = round(meanBy(data, 'activeUsers'));
    } else {
      latest = sumBy(data, 'pageViews');
    }

    updatedSummary.push({
      ...summary,
      latest: latest,
      label: t(summary.label),
    });
  }

  return updatedSummary;
};

export const getKpiResultFeedback = (day: number, isTargetMet: boolean) => {
  if (day > 0 && isTargetMet) {
    return t('message.kpi-target-achieved-before-time');
  } else if (day <= 0 && !isTargetMet) {
    return t('message.kpi-target-overdue', {
      count: day,
    });
  } else if (isTargetMet) {
    return t('message.kpi-target-achieved');
  } else {
    return t('label.day-left', { day: pluralize(day, 'day') });
  }
};
