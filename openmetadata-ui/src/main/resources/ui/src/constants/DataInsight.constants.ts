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
  rightRowGutter: [8, 16] as RowProps['gutter'],
};

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

export const BAR_SIZE = 15;

export const INITIAL_CHART_FILTER: ChartFilter = {
  startTs: getEpochMillisForPastDays(DEFAULT_SELECTED_RANGE.days),
  endTs: getCurrentMillis(),
};

export const ENTITIES_CHARTS = [
  DataInsightChartType.TotalEntitiesByType,
  DataInsightChartType.PercentageOfEntitiesWithDescriptionByType,
  DataInsightChartType.PercentageOfEntitiesWithOwnerByType,
  DataInsightChartType.TotalEntitiesByTier,
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
    label: i18n.t('label.daily-active-users-on-the-platform'),
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
    id: DataInsightChartType.TotalEntitiesByType,
  },
  {
    label: i18n.t('label.data-asset-plural-with-field', {
      field: i18n.t('label.description'),
    }),
    latest: 0,
    id: DataInsightChartType.PercentageOfEntitiesWithDescriptionByType,
  },
  {
    label: i18n.t('label.data-asset-plural-with-field', {
      field: i18n.t('label.owner-plural'),
    }),
    latest: 0,
    id: DataInsightChartType.PercentageOfEntitiesWithOwnerByType,
  },
  {
    label: i18n.t('label.total-entity', {
      entity: i18n.t('label.data-assets-with-tier-plural'),
    }),
    latest: 0,
    id: DataInsightChartType.TotalEntitiesByTier,
  },
];

export const SUPPORTED_CHARTS_FOR_KPI = [
  DataInsightChartType.PercentageOfEntitiesWithDescriptionByType,
  DataInsightChartType.PercentageOfEntitiesWithOwnerByType,
];

export const KPI_DATE_PICKER_FORMAT = 'YYYY-MM-DD';

export const KPI_DATES = {
  startDate: '',
  endDate: '',
};

export const TOTAL_ENTITY_CHART_COLOR = [
  '#1FA1F0',
  '#416BB3',
  '#5CAE95',
  '#2269F5',
  '#76E9C6',
  '#FEB019',
  '#9747FF',
  '#FF7C50',
  '#AD4F82',
  '#C870C5',
  '#ED7014',
  '#FCAE1E',
  '#B56727',
  '#F9E076',
  '#3CB043',
  '#48AAAD',
  '#0492C2',
  '#A1045A',
  '#B65FCF',
  '#67032F',
  '#4E2A84',
  '#78184A',
  '#563C5C',
  '#5F5498',
  '#4E8C9C',
  '#F4F2FF',
  '#ECFBFF',
];

export const KPI_WIDGET_GRAPH_COLORS = ['#5F5498', '#4E8C9C'];
export const KPI_WIDGET_GRAPH_BG_COLORS = ['#F4F2FF', '#ECFBFF'];
