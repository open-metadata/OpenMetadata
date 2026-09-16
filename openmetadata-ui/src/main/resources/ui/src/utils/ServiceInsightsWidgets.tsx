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
import React from 'react';
import { ReactComponent as DescriptionPlaceholderIcon } from '../assets/svg/ic-flat-doc.svg';
import { ReactComponent as TablePlaceholderIcon } from '../assets/svg/ic-large-table.svg';
import { ReactComponent as NoDataPlaceholderIcon } from '../assets/svg/ic-no-records.svg';
import { ReactComponent as OwnersPlaceholderIcon } from '../assets/svg/key-hand.svg';
import { ReactComponent as TierPlaceholderIcon } from '../assets/svg/no-tier.svg';
import { ReactComponent as PiiPlaceholderIcon } from '../assets/svg/security-safe.svg';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import type { AgentsStatusWidgetProps } from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget.interface';
import type { PlatformInsightsWidgetProps } from '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget.interface';
import type { TotalAssetsWidgetProps } from '../components/ServiceInsights/TotalDataAssetsWidget/TotalDataAssetsWidget.interface';
import type { MetadataAgentsWidgetProps } from '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../enums/common.enum';
import { SystemChartType } from '../enums/DataInsight.enum';
import { ServiceInsightsWidgetType } from '../enums/ServiceInsights.enum';
import type { ThemeConfiguration } from '../generated/configuration/uiThemePreference';
import documentationLinksClassBase from './DocumentationLinksClassBase';
import { t, Transi18next } from './i18next/LocalUtil';

const MetadataAgentsWidgetLazy = React.lazy(
  () =>
    import(
      '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget'
    )
);

const MetadataAgentsWidget = withSuspenseFallback(
  MetadataAgentsWidgetLazy
) as React.ComponentType<MetadataAgentsWidgetProps>;

const AgentsStatusWidgetLazy = React.lazy(
  () =>
    import(
      '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget'
    )
);

const AgentsStatusWidget = withSuspenseFallback(
  AgentsStatusWidgetLazy
) as React.ComponentType<AgentsStatusWidgetProps>;

const PlatformInsightsWidgetLazy = React.lazy(
  () =>
    import(
      '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget'
    )
);

const PlatformInsightsWidget = withSuspenseFallback(
  PlatformInsightsWidgetLazy
) as React.ComponentType<PlatformInsightsWidgetProps>;

const TotalDataAssetsWidgetLazy = React.lazy(
  () =>
    import(
      '../components/ServiceInsights/TotalDataAssetsWidget/TotalDataAssetsWidget'
    )
);

const TotalDataAssetsWidget = withSuspenseFallback(
  TotalDataAssetsWidgetLazy
) as React.ComponentType<TotalAssetsWidgetProps>;

type ServiceInsightsPlaceholderConfig = {
  Icon: typeof NoDataPlaceholderIcon;
  localizationKey: string;
  getDocsLink: () => string;
};

const SERVICE_INSIGHTS_PLACEHOLDER_GROUPS: [
  Array<SystemChartType | ServiceInsightsWidgetType>,
  ServiceInsightsPlaceholderConfig
][] = [
  [
    [
      ServiceInsightsWidgetType.TOTAL_DATA_ASSETS,
      SystemChartType.TotalDataAssetsLive,
    ],
    {
      Icon: NoDataPlaceholderIcon,
      localizationKey: 'message.total-data-assets-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().TOTAL_DATA_ASSETS_WIDGET_DOCS,
    },
  ],
  [
    [
      SystemChartType.DescriptionCoverage,
      SystemChartType.AssetsWithDescriptionLive,
    ],
    {
      Icon: DescriptionPlaceholderIcon,
      localizationKey: 'message.description-coverage-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS()
          .DESCRIPTION_COVERAGE_WIDGET_DOCS,
    },
  ],
  [
    [SystemChartType.OwnersCoverage, SystemChartType.AssetsWithOwnerLive],
    {
      Icon: OwnersPlaceholderIcon,
      localizationKey: 'message.owners-coverage-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS()
          .OWNERSHIP_COVERAGE_WIDGET_DOCS,
    },
  ],
  [
    [SystemChartType.PIICoverage, SystemChartType.AssetsWithPIILive],
    {
      Icon: PiiPlaceholderIcon,
      localizationKey: 'message.pii-coverage-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().PII_COVERAGE_WIDGET_DOCS,
    },
  ],
  [
    [SystemChartType.PIIDistribution],
    {
      Icon: PiiPlaceholderIcon,
      localizationKey: 'message.pii-distribution-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().PII_DISTRIBUTION_WIDGET_DOCS,
    },
  ],
  [
    [SystemChartType.TierCoverage],
    {
      Icon: TierPlaceholderIcon,
      localizationKey: 'message.tier-coverage-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().TIER_COVERAGE_WIDGET_DOCS,
    },
  ],
  [
    [SystemChartType.TierDistribution],
    {
      Icon: TierPlaceholderIcon,
      localizationKey: 'message.tier-distribution-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().TIER_DISTRIBUTION_WIDGET_DOCS,
    },
  ],
  [
    [ServiceInsightsWidgetType.COLLATE_AI],
    {
      Icon: TablePlaceholderIcon,
      localizationKey: 'message.collate-ai-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().COLLATE_AI_WIDGET_DOCS,
    },
  ],
  [
    [ServiceInsightsWidgetType.MOST_USED_ASSETS],
    {
      Icon: TablePlaceholderIcon,
      localizationKey: 'message.most-used-assets-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS().MOST_USED_ASSETS_WIDGET_DOCS,
    },
  ],
  [
    [ServiceInsightsWidgetType.MOST_EXPENSIVE_QUERIES],
    {
      Icon: TablePlaceholderIcon,
      localizationKey: 'message.most-expensive-queries-widget-description',
      getDocsLink: () =>
        documentationLinksClassBase.getDocsURLS()
          .MOST_EXPENSIVE_QUERIES_WIDGET_DOCS,
    },
  ],
];

const DEFAULT_SERVICE_INSIGHTS_PLACEHOLDER_CONFIG: ServiceInsightsPlaceholderConfig =
  {
    Icon: NoDataPlaceholderIcon,
    localizationKey: 'server.no-records-found',
    getDocsLink: () => documentationLinksClassBase.getDocsBaseURL(),
  };

const getServiceInsightsPlaceholderConfig = (
  chartType?: SystemChartType | ServiceInsightsWidgetType
): ServiceInsightsPlaceholderConfig => {
  const match = SERVICE_INSIGHTS_PLACEHOLDER_GROUPS.find(
    ([types]) => !!chartType && types.includes(chartType)
  );

  return match?.[1] ?? DEFAULT_SERVICE_INSIGHTS_PLACEHOLDER_CONFIG;
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
  const { Icon, localizationKey, getDocsLink } =
    getServiceInsightsPlaceholderConfig(chartType);
  const docsLink = getDocsLink();

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
              aria-label={t('label.learn-more')}
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
  React.ComponentType<MetadataAgentsWidgetProps>
> => ({
  MetadataAgentsWidget,
});

export const getDefaultInsightsTabWidgets = (): {
  AgentsStatusWidget: React.ComponentType<AgentsStatusWidgetProps>;
  PlatformInsightsWidget: React.ComponentType<PlatformInsightsWidgetProps>;
  TotalDataAssetsWidget: React.ComponentType<TotalAssetsWidgetProps>;
} => ({
  AgentsStatusWidget,
  PlatformInsightsWidget,
  TotalDataAssetsWidget,
});
