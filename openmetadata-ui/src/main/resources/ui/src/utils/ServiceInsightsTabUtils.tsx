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
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { first, isEmpty, last, round, sortBy, toLower } from 'lodash';
import { ServiceTypes } from 'Models';
import { FunctionComponent } from 'react';
import { ReactComponent as SuccessIcon } from '../assets/svg/ic-check-circle-new.svg';
import { ReactComponent as DescriptionPlaceholderIcon } from '../assets/svg/ic-flat-doc.svg';
import { ReactComponent as TablePlaceholderIcon } from '../assets/svg/ic-large-table.svg';
import { ReactComponent as LoadingIcon } from '../assets/svg/ic-loader.svg';
import { ReactComponent as NoDataPlaceholderIcon } from '../assets/svg/ic-no-records.svg';
import { ReactComponent as WarningIcon } from '../assets/svg/incident-icon.svg';
import { ReactComponent as OwnersPlaceholderIcon } from '../assets/svg/key-hand.svg';
import { ReactComponent as TierPlaceholderIcon } from '../assets/svg/no-tier.svg';
import { ReactComponent as PiiPlaceholderIcon } from '../assets/svg/security-safe.svg';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ChartsResults } from '../components/ServiceInsights/ServiceInsightsTab.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../enums/common.enum';
import { SystemChartType } from '../enums/DataInsight.enum';
import { EntityType } from '../enums/entity.enum';
import { ServiceInsightsWidgetType } from '../enums/ServiceInsights.enum';
import { ThemeConfiguration } from '../generated/configuration/uiThemePreference';
import { WorkflowStatus } from '../generated/governance/workflows/workflowInstance';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import i18n from '../utils/i18next/LocalUtil';
import { Transi18next } from './CommonUtils';
import documentationLinksClassBase from './DocumentationLinksClassBase';
import Fqn from './Fqn';
import { getAutoPilotStatuses } from './LocalStorageUtils';

const { t } = i18n;

export const getAssetsByServiceType = (serviceType: ServiceTypes): string[] => {
  switch (serviceType) {
    case 'databaseServices':
      return [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.STORED_PROCEDURE,
        EntityType.TABLE,
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
      return t('label.entity-coverage', {
        entity: t('label.description'),
      });
    case SystemChartType.OwnersCoverage:
      return t('label.entity-coverage', {
        entity: t('label.ownership'),
      });
    case SystemChartType.PIICoverage:
      return t('label.entity-coverage', {
        entity: t('label.pii-uppercase'),
      });
    case SystemChartType.TierCoverage:
      return t('label.entity-coverage', {
        entity: t('label.tier'),
      });
    default:
      return '';
  }
};

export const getPlatformInsightsChartDataFormattingMethod =
  (chartsData: Record<SystemChartType, DataInsightCustomChartResult>) =>
  (chartType: SystemChartType) => {
    const summaryChartData = chartsData[chartType];
    const lastDay = last(summaryChartData.results)?.day ?? 1;

    const sortedResults = sortBy(summaryChartData.results, 'day');

    let data = sortedResults.length >= 2 ? sortedResults : [];

    if (summaryChartData.results.length === 1) {
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
      2
    );

    // This is true if the current data is greater than or equal to the earliest day data
    const isIncreased = (lastDayData ?? 0) >= (earliestDayData ?? 0);

    return {
      chartType,
      isIncreased,
      percentageChange: percentageChangeOverall,
      currentPercentage: round(lastDayData ?? 0, 2),
      noRecords: summaryChartData.results.every((item) => isEmpty(item)),
      numberOfDays: data.length > 0 ? data.length - 1 : 0,
    };
  };

export const getStatusIconFromStatusType = (status?: WorkflowStatus) => {
  let Icon: FunctionComponent<any>;
  let message;
  let description;

  switch (status) {
    case WorkflowStatus.Exception:
      Icon = WarningIcon;
      message = t('message.workflow-status-exception');
      description = t('message.workflow-status-failure-description');

      break;
    case WorkflowStatus.Failure:
      Icon = ExclamationCircleOutlined;
      message = t('message.workflow-status-failure');
      description = t('message.workflow-status-failure-description');

      break;
    case WorkflowStatus.Finished:
      Icon = SuccessIcon;
      message = t('message.workflow-status-finished');
      description = t('message.workflow-status-finished-description');

      break;
    case WorkflowStatus.Running:
    default:
      Icon = LoadingIcon;
      message = t('message.workflow-status-running');
      description = t('message.workflow-status-running-description');

      break;
  }

  return {
    Icon,
    message,
    description,
  };
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
      Icon = NoDataPlaceholderIcon;
      localizationKey = 'message.total-data-assets-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS().TOTAL_DATA_ASSETS_WIDGET_DOCS;

      break;
    case SystemChartType.DescriptionCoverage:
      Icon = DescriptionPlaceholderIcon;
      localizationKey = 'message.description-coverage-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS()
          .DESCRIPTION_COVERAGE_WIDGET_DOCS;

      break;
    case SystemChartType.OwnersCoverage:
      Icon = OwnersPlaceholderIcon;
      localizationKey = 'message.owners-coverage-widget-description';
      docsLink =
        documentationLinksClassBase.getDocsURLS()
          .OWNERSHIP_COVERAGE_WIDGET_DOCS;

      break;
    case SystemChartType.PIICoverage:
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

export const checkIfAutoPilotStatusIsDismissed = (
  serviceFQN?: string,
  workflowStatus?: WorkflowStatus
) => {
  if (!serviceFQN || !workflowStatus) {
    return false;
  }

  const autoPilotStatuses = getAutoPilotStatuses();

  return autoPilotStatuses.some(
    (status) =>
      status.serviceFQN === serviceFQN && status.status === workflowStatus
  );
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
