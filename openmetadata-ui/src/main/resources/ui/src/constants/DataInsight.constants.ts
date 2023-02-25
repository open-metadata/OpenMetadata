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
  getCurrentDateTimeMillis,
  getPastDaysDateTimeMillis,
} from '../utils/TimeUtils';

export const BAR_CHART_MARGIN: Margin = {
  top: 20,
  right: 30,
  left: 0,
  bottom: 5,
};

export const DI_STRUCTURE = {
  rowContainerGutter: 32 as RowProps['gutter'],
  leftContainerSpan: 19,
  rightContainerSpan: 5,
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
export const DEFAULT_DAYS = 30;

export const ENTITIES_BAR_COLO_MAP: Record<string, string> = {
  Chart: '#E7B85D',
  Dashboard: '#416BB3',
  Database: '#66B5AD',
  DatabaseSchema: '#8D6AF1',
  MlModel: '#699994',
  Pipeline: '#6A86EB',
  Table: '#7A57A6',
  Topic: '#7DC177',
  User: '#AD4F82',
  TestSuite: '#C870C5',
};

export const TIER_BAR_COLOR_MAP: Record<string, string> = {
  'Tier.Tier1': '#E7B85D',
  'Tier.Tier2': '#416BB3',
  'Tier.Tier3': '#66B5AD',
  'Tier.Tier4': '#8D6AF1',
  'Tier.Tier5': '#699994',
  NoTier: '#6A86EB',
};

export const DAY_FILTER = [
  {
    value: 7,
    label: i18n.t('label.last-no-of-day-plural', { day: 7 }),
  },
  {
    value: 14,
    label: i18n.t('label.last-no-of-day-plural', { day: 14 }),
  },
  {
    value: 30,
    label: i18n.t('label.last-no-of-day-plural', { day: 30 }),
  },
  {
    value: 60,
    label: i18n.t('label.last-no-of-day-plural', { day: 60 }),
  },
];

export const TIER_FILTER = {
  [i18n.t('label.tier-number', { tier: 1 })]: {
    key: 'Tier.Tier1',
    label: 'Tier1',
  },
  [i18n.t('label.tier-number', { tier: 2 })]: {
    key: 'Tier.Tier2',
    label: 'Tier2',
  },
  [i18n.t('label.tier-number', { tier: 3 })]: {
    key: 'Tier.Tier3',
    label: 'Tier3',
  },
  [i18n.t('label.tier-number', { tier: 4 })]: {
    key: 'Tier.Tier4',
    label: 'Tier4',
  },
  [i18n.t('label.tier-number', { tier: 5 })]: {
    key: 'Tier.Tier5',
    label: 'Tier5',
  },
};

export const TIER_DATA = {
  'Tier.Tier1': i18n.t('label.tier-number', { tier: 1 }),
  'Tier.Tier2': i18n.t('label.tier-number', { tier: 2 }),
  'Tier.Tier3': i18n.t('label.tier-number', { tier: 3 }),
  'Tier.Tier4': i18n.t('label.tier-number', { tier: 4 }),
  'Tier.Tier5': i18n.t('label.tier-number', { tier: 5 }),
  NoTier: i18n.t('label.no-entity', {
    entity: i18n.t('label.tier'),
  }),
};

export const INITIAL_CHART_FILTER: ChartFilter = {
  startTs: getPastDaysDateTimeMillis(DEFAULT_DAYS),
  endTs: getCurrentDateTimeMillis(),
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
      field: 'description',
    }),
    latest: 0,
    id: DataInsightChartType.PercentageOfEntitiesWithDescriptionByType,
  },
  {
    label: i18n.t('label.data-asset-plural-with-field', { field: 'owners' }),
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

export const VALIDATE_MESSAGES = {
  required: '${fieldName} is required!',
  string: {
    range: '${fieldName} must be between ${min} and ${max} character.',
  },
};

export const SUPPORTED_CHARTS_FOR_KPI = [
  DataInsightChartType.PercentageOfEntitiesWithDescriptionByType,
  DataInsightChartType.PercentageOfEntitiesWithOwnerByType,
];

export const KPI_DATE_PICKER_FORMAT = 'YYYY-MM-DD';

export const KPI_DATES = {
  startDate: '',
  endDate: '',
};
