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
import React, { Suspense } from 'react';
import { ReactComponent as DescriptionPlaceholderIcon } from '../assets/svg/ic-flat-doc.svg';
import { ReactComponent as TablePlaceholderIcon } from '../assets/svg/ic-large-table.svg';
import { ReactComponent as NoDataPlaceholderIcon } from '../assets/svg/ic-no-records.svg';
import { ReactComponent as OwnersPlaceholderIcon } from '../assets/svg/key-hand.svg';
import { ReactComponent as TierPlaceholderIcon } from '../assets/svg/no-tier.svg';
import { ReactComponent as PiiPlaceholderIcon } from '../assets/svg/security-safe.svg';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../enums/common.enum';
import { SystemChartType } from '../enums/DataInsight.enum';
import { ServiceInsightsWidgetType } from '../enums/ServiceInsights.enum';
import type { ThemeConfiguration } from '../generated/configuration/uiThemePreference';
import documentationLinksClassBase from './DocumentationLinksClassBase';
import { Transi18next } from './i18next/LocalUtil';

const MetadataAgentsWidgetLazy = React.lazy(
  () =>
    import(
      '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget'
    )
);

const MetadataAgentsWidget = (props: Record<string, unknown>) => {
  const widgetProps = props as React.ComponentProps<
    typeof MetadataAgentsWidgetLazy
  >;

  return (
    <Suspense fallback={null}>
      <MetadataAgentsWidgetLazy {...widgetProps} />
    </Suspense>
  );
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

export const getDefaultAgentsTabWidgets = (): Record<
  string,
  React.ComponentType<Record<string, unknown>>
> => ({
  MetadataAgentsWidget,
});
