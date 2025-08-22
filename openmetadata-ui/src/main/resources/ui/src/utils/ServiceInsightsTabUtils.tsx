/*
 *  Copyright 2025 Collate.
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
import { Typography } from 'antd';
import {
  first,
  isEmpty,
  isUndefined,
  last,
  round,
  sortBy,
  toLower,
} from 'lodash';
import { ServiceTypes } from 'Models';
import { ReactComponent as DescriptionPlaceholderIcon } from '../assets/svg/ic-flat-doc.svg';
import { ReactComponent as TablePlaceholderIcon } from '../assets/svg/ic-large-table.svg';
import { ReactComponent as NoDataPlaceholderIcon } from '../assets/svg/ic-no-records.svg';
import { ReactComponent as OwnersPlaceholderIcon } from '../assets/svg/key-hand.svg';
import { ReactComponent as TierPlaceholderIcon } from '../assets/svg/no-tier.svg';
import { ReactComponent as PiiPlaceholderIcon } from '../assets/svg/security-safe.svg';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ChartsResults } from '../components/ServiceInsights/ServiceInsightsTab.interface';
import { SERVICE_AUTOPILOT_AGENT_TYPES } from '../constants/Services.constant';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../enums/common.enum';
import { SystemChartType } from '../enums/DataInsight.enum';
import { EntityType } from '../enums/entity.enum';
import { ServiceInsightsWidgetType } from '../enums/ServiceInsights.enum';
import { ThemeConfiguration } from '../generated/configuration/uiThemePreference';
import {
  IngestionPipeline,
  ProviderType,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import i18n from '../utils/i18next/LocalUtil';
import { Transi18next } from './CommonUtils';
import documentationLinksClassBase from './DocumentationLinksClassBase';
import { getEntityNameLabel } from './EntityUtils';
import Fqn from './Fqn';
import { getEntityIcon } from './TableUtils';

const { t } = i18n;

export const getAssetsByServiceType = (serviceType: ServiceTypes): string[] => {
  switch (serviceType) {
    case 'databaseServices':
      return [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.STORED_PROCEDURE,
        EntityType.TABLE,
        EntityType.QUERY,
      ];
    case 'messagingServices':
      return [EntityType.TOPIC];
    case 'dashboardServices':
      return [
        EntityType.CHART,
        EntityType.DASHBOARD,
        EntityType.DASHBOARD_DATA_MODEL,
      ];
    case 'pipelineServices':
      return [EntityType.PIPELINE];
    case 'mlmodelServices':
      return [EntityType.MLMODEL];
    case 'storageServices':
      return [EntityType.CONTAINER];
    case 'searchServices':
      return [EntityType.SEARCH_SERVICE];
    case 'apiServices':
      return [EntityType.API_COLLECTION, EntityType.API_ENDPOINT];
    default:
      return [];
  }
};

export const getTitleByChartType = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.DescriptionCoverage:
    case SystemChartType.AssetsWithDescriptionLive:
      return t('label.entity-coverage', {
        entity: t('label.description'),
      });
    case SystemChartType.OwnersCoverage:
    case SystemChartType.AssetsWithOwnerLive:
      return t('label.entity-coverage', {
        entity: t('label.ownership'),
      });
    case SystemChartType.PIICoverage:
    case SystemChartType.AssetsWithPIILive:
      return t('label.entity-coverage', {
        entity: t('label.pii-uppercase'),
      });
    case SystemChartType.TierCoverage:
    case SystemChartType.AssetsWithTierLive:
      return t('label.entity-coverage', {
        entity: t('label.tier'),
      });
    case SystemChartType.HealthyDataAssets:
      return t('label.healthy-data-asset-plural');
    default:
      return '';
  }
};

export const getChartTypeForWidget = (chartType: SystemChartType) => {
  switch (chartType) {
    case SystemChartType.AssetsWithDescriptionLive:
      return SystemChartType.DescriptionCoverage;
    case SystemChartType.AssetsWithOwnerLive:
      return SystemChartType.OwnersCoverage;
    case SystemChartType.AssetsWithPIILive:
      return SystemChartType.PIICoverage;
    case SystemChartType.AssetsWithTierLive:
      return SystemChartType.TierCoverage;
    default:
      return chartType;
  }
};

export const getPlatformInsightsChartDataFormattingMethod =
  (chartsData: Record<SystemChartType, DataInsightCustomChartResult>) =>
  (chartType: SystemChartType) => {
    const summaryChartData = chartsData[chartType];
    const lastDay = last(summaryChartData?.results)?.day ?? 1;

    const sortedResults = sortBy(summaryChartData?.results, 'day');

    let data = sortedResults.length >= 2 ? sortedResults : [];

    if (summaryChartData?.results.length === 1) {
      const previousDay = sortedResults[0].day - 86400000; // 1 day in milliseconds

      data = [
        {
          day: previousDay,
          count: 0,
          group: sortedResults[0].group,
          term: sortedResults[0].term,
        },
        {
          day: lastDay,
          count: sortedResults[0].count,
          group: sortedResults[0].group,
          term: sortedResults[0].term,
        },
      ];
    }

    // Data for the earliest day
    const earliestDayData = first(data)?.count ?? 0;
    // Data for the last day
    const lastDayData = last(data)?.count ?? 0;

    // Percentage change for the last 7 days
    const percentageChangeOverall = round(
      Math.abs(lastDayData - earliestDayData),
      1
    );

    // This is true if the current data is greater than or equal to the earliest day data
    const isIncreased = (lastDayData ?? 0) >= (earliestDayData ?? 0);

    return {
      chartType: getChartTypeForWidget(chartType),
      isIncreased,
      percentageChange: percentageChangeOverall,
      currentPercentage: round(lastDayData ?? 0, 1),
      noRecords: summaryChartData?.results.every((item) => isEmpty(item)),
      numberOfDays: data.length > 0 ? data.length - 1 : 0,
    };
  };

export const getFormattedTotalAssetsDataFromSocketData = (
  socketData: DataInsightCustomChartResult,
  serviceCategory: ServiceTypes
) => {
  const assets = getAssetsByServiceType(serviceCategory);

  const buckets = assets.reduce((acc, curr) => {
    const bucket = socketData.results.find((bucket) => bucket.group === curr);

    if (!isUndefined(bucket)) {
      return [...acc, bucket];
    }

    return acc;
  }, [] as DataInsightCustomChartResult['results']);

  const entityCountsArray = buckets.map((result) => ({
    name: getEntityNameLabel(result.group),
    value: result.count ?? 0,
    icon: getEntityIcon(result.group, '', { height: 16, width: 16 }) ?? <></>,
  }));

  return entityCountsArray;
};

export const getServiceInsightsWidgetPlaceholder = ({
  chartType,
  iconClassName = 'text-grey-14',
  placeholderClassName = '',
  height = 60,
  width = 60,
  theme,
}: {
  chartType?: SystemChartType | ServiceInsightsWidgetType;
  iconClassName?: string;
  placeholderClassName?: string;
  height?: number;
  width?: number;
  theme: ThemeConfiguration;
}) => {
  let Icon = NoDataPlaceholderIcon;
  let localizationKey = `server.no-records-found`;
  let docsLink = documentationLinksClassBase.getDocsBaseURL();

  switch (chartType) {
    case ServiceInsightsWidgetType.TOTAL_DATA_ASSETS:
    case SystemChartType.TotalDataAssetsLive:
      Icon = NoDataPlaceholderIcon;
      localizationKey = 'message.total-data-assets-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().TOTAL_DATA_ASSETS_WIDGET_DOCS;

      break;
    case SystemChartType.DescriptionCoverage:
    case SystemChartType.AssetsWithDescriptionLive:
      Icon = DescriptionPlaceholderIcon;
      localizationKey = 'message.description-coverage-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS()
          .DESCRIPTION_COVERAGE_WIDGET_DOCS;

      break;
    case SystemChartType.OwnersCoverage:
    case SystemChartType.AssetsWithOwnerLive:
      Icon = OwnersPlaceholderIcon;
      localizationKey = 'message.owners-coverage-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS()
          .OWNERSHIP_COVERAGE_WIDGET_DOCS;

      break;
    case SystemChartType.PIICoverage:
    case SystemChartType.AssetsWithPIILive:
      Icon = PiiPlaceholderIcon;
      localizationKey = 'message.pii-coverage-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().PII_COVERAGE_WIDGET_DOCS;

      break;
    case SystemChartType.PIIDistribution:
      Icon = PiiPlaceholderIcon;
      localizationKey = 'message.pii-distribution-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().PII_DISTRIBUTION_WIDGET_DOCS;

      break;
    case SystemChartType.TierCoverage:
      Icon = TierPlaceholderIcon;
      localizationKey = 'message.tier-coverage-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().TIER_COVERAGE_WIDGET_DOCS;

      break;
    case SystemChartType.TierDistribution:
      Icon = TierPlaceholderIcon;
      localizationKey = 'message.tier-distribution-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().TIER_DISTRIBUTION_WIDGET_DOCS;

      break;
    case ServiceInsightsWidgetType.COLLATE_AI:
      Icon = TablePlaceholderIcon;
      localizationKey = 'message.collate-ai-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().COLLATE_AI_WIDGET_DOCS;

      break;
    case ServiceInsightsWidgetType.MOST_USED_ASSETS:
      Icon = TablePlaceholderIcon;
      localizationKey = 'message.most-used-assets-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().MOST_USED_ASSETS_WIDGET_DOCS;

      break;
    case ServiceInsightsWidgetType.MOST_EXPENSIVE_QUERIES:
      Icon = TablePlaceholderIcon;
      localizationKey = 'message.most-expensive-queries-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS()
          .MOST_EXPENSIVE_QUERIES_WIDGET_DOCS;

      break;
  }

  return (
    <ErrorPlaceHolder
      className={placeholderClassName}
      icon={<Icon className={iconClassName} height={height} width={width} />}
      size={SIZE.MEDIUM}
      type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
      <Typography.Paragraph className="w-max-350">
        <Transi18next
          i18nKey={localizationKey}
          renderElement={
            <a
              href={docsLink}
              rel="noreferrer"
              style={{ color: theme.primaryColor }}
              target="_blank"
              title="learn-more"
            />
          }
        />
      </Typography.Paragraph>
    </ErrorPlaceHolder>
  );
};

export const filterDistributionChartItem = (item: {
  term: string;
  group: string;
}) => {
  // Add input validation to prevent DOS vulnerabilities | typescript:S5852
  if (
    !item.term ||
    !item.group ||
    item.term.length > 1000 ||
    item.group.length > 1000
  ) {
    return false;
  }

  // Split once and cache the result
  const termParts = Fqn.split(item.term);
  if (termParts.length !== 2) {
    // Invalid Tag FQN
    return false;
  }

  // clean start and end quotes
  const tag_name = termParts[1].replace(/(^["']+|["']+$)/g, '');

  return toLower(tag_name) === toLower(item.group);
};

export const getChartsDataFromWidgetName = (
  widgetName: string,
  chartsResults?: ChartsResults
) => {
  switch (widgetName) {
    case 'PlatformInsightsWidget':
      return chartsResults?.platformInsightsChart ?? [];
    case 'PIIDistributionWidget':
      return chartsResults?.piiDistributionChart ?? [];
    case 'TierDistributionWidget':
      return chartsResults?.tierDistributionChart ?? [];
    default:
      return [];
  }
};

export const getAutoPilotIngestionPipelines = (
  ingestionPipelines?: IngestionPipeline[]
) => {
  if (isEmpty(ingestionPipelines)) {
    return undefined;
  }

  return ingestionPipelines?.filter(
    (pipeline) =>
      SERVICE_AUTOPILOT_AGENT_TYPES.includes(pipeline.pipelineType) &&
      pipeline.provider === ProviderType.Automation
  );
};
