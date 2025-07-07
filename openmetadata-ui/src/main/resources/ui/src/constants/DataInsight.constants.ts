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

import { RowProps } from 'antd/lib/grid/row';
import i18n from 'i18next';
import { Margin } from 'recharts/types/util/types';
import { SystemChartType } from '../enums/DataInsight.enum';
import { DataReportIndex } from '../generated/dataInsight/dataInsightChart';
import { DataInsightChartType } from '../generated/dataInsight/dataInsightChartResult';
import { ChartFilter } from '../interface/data-insight.interface';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../utils/date-time/DateTimeUtils';
import { DEFAULT_SELECTED_RANGE } from './profiler.constant';

export const BAR_CHART_MARGIN: Margin = {
  top: 20,
  right: 30,
  left: 0,
  bottom: 5,
};

export const DI_STRUCTURE = {
  rowContainerGutter: 32 as RowProps['gutter'],
  leftContainerSpan: 16,
  rightContainerSpan: 8,
  rightRowGutter: [8, 0] as RowProps['gutter'],
};

export const GRAPH_HEIGHT = 500;

export const DATA_INSIGHT_GRAPH_COLORS = [
  '#E7B85D',
  '#416BB3',
  '#66B5AD',
  '#8D6AF1',
  '#699994',
  '#6A86EB',
  '#7A57A6',
  '#7DC177',
  '#AD4F82',
  '#C870C5',
  '#D87F7F',
  '#DA996A',
];

export const INITIAL_CHART_FILTER: ChartFilter = {
  startTs: getEpochMillisForPastDays(DEFAULT_SELECTED_RANGE.days),
  endTs: getCurrentMillis(),
};

export const ENTITIES_CHARTS = [
  SystemChartType.TotalDataAssets,
  SystemChartType.PercentageOfDataAssetWithDescription,
  SystemChartType.PercentageOfDataAssetWithOwner,
  SystemChartType.TotalDataAssetsByTier,
];

export const WEB_CHARTS = [
  {
    chart: DataInsightChartType.PageViewsByEntities,
    index: DataReportIndex.WebAnalyticEntityViewReportDataIndex,
  },
  {
    chart: DataInsightChartType.DailyActiveUsers,
    index: DataReportIndex.WebAnalyticUserActivityReportDataIndex,
  },
];

export const WEB_SUMMARY_LIST = [
  {
    label: i18n.t('label.page-views-by-data-asset-plural'),
    latest: 0,
    id: DataInsightChartType.PageViewsByEntities,
  },
  {
    label: i18n.t('label.average-daily-active-users-on-the-platform'),
    latest: 0,
    id: DataInsightChartType.DailyActiveUsers,
  },
];

export const ENTITIES_SUMMARY_LIST = [
  {
    label: i18n.t('label.total-entity', {
      entity: i18n.t('label.data-asset-plural'),
    }),
    latest: 0,
    type: SystemChartType.TotalDataAssetsSummaryCard,
    id: SystemChartType.TotalDataAssets,
  },
  {
    label: i18n.t('label.data-asset-plural-with-field', {
      field: i18n.t('label.description'),
    }),
    latest: 0,
    type: SystemChartType.DataAssetsWithDescriptionSummaryCard,
    id: SystemChartType.PercentageOfDataAssetWithDescription,
  },
  {
    label: i18n.t('label.data-asset-plural-with-field', {
      field: i18n.t('label.owner-plural'),
    }),
    latest: 0,
    type: SystemChartType.DataAssetsWithOwnerSummaryCard,
    id: SystemChartType.PercentageOfDataAssetWithOwner,
  },
  {
    label: i18n.t('label.total-entity', {
      entity: i18n.t('label.data-assets-with-tier-plural'),
    }),
    latest: 0,
    type: SystemChartType.TotalDataAssetsWithTierSummaryCard,
    id: SystemChartType.TotalDataAssetsByTier,
  },
];

export const KPI_DATE_PICKER_FORMAT = 'yyyy-MM-dd';

export const BASE_COLORS = [
  '#E57373',
  '#BA68C8',
  '#64B5F6',
  '#4DB6AC',
  '#81C784',
  '#FFD54F',
  '#FF8A65',
  '#A1887F',
  '#90A4AE',
  '#7986CB',
  '#F06292',
  '#4FC3F7',
  '#FFD740',
  '#AED581',
  '#CE93D8',
  '#B39DDB',
  '#EF5350',
  '#FF7043',
  '#7986CB',
  '#FFCA28',
  '#FFB74D',
  '#A5D6A7',
  '#80CBC4',
  '#F48FB1',
];

export const KPI_WIDGET_GRAPH_COLORS = ['#5F5498', '#4E8C9C'];
export const KPI_WIDGET_GRAPH_BG_COLORS = ['#F4F2FF', '#ECFBFF'];
