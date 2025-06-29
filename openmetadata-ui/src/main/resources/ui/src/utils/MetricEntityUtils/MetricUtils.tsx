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
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import Lineage from '../../components/Lineage/Lineage.component';
import MetricExpression from '../../components/Metric/MetricExpression/MetricExpression';
import RelatedMetrics from '../../components/Metric/RelatedMetrics/RelatedMetrics';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { CSMode } from '../../enums/codemirror.enum';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import {
  Language,
  Metric,
  MetricGranularity,
} from '../../generated/entity/data/metric';
import { PageType } from '../../generated/system/ui/page';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import i18n from '../i18next/LocalUtil';
import { MetricDetailPageTabProps } from './MetricDetailsClassBase';

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

export const getMetricDetailsPageTabs = ({
  feedCount,
  activeTab,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  getEntityFeedCount,
  fetchMetricDetails,
  metricDetails,
  handleFeedCount,
  labelMap,
}: MetricDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.OVERVIEW}
          name={labelMap[EntityTabs.OVERVIEW] ?? i18n.t('label.overview')}
        />
      ),
      key: EntityTabs.OVERVIEW,
      children: <GenericTab type={PageType.Metric} />,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.EXPRESSION}
          name={labelMap[EntityTabs.EXPRESSION] ?? i18n.t('label.expression')}
        />
      ),
      key: EntityTabs.EXPRESSION,
      children: (
        <div className="p-t-sm m-x-lg">
          <MetricExpression />
        </div>
      ),
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap[EntityTabs.ACTIVITY_FEED] ??
            i18n.t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.METRIC}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchMetricDetails}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },

    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={labelMap[EntityTabs.LINEAGE] ?? i18n.t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={metricDetails.deleted}
            entity={metricDetails as SourceType}
            entityType={EntityType.METRIC}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={
            labelMap[EntityTabs.CUSTOM_PROPERTIES] ??
            i18n.t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: metricDetails && (
        <CustomPropertyTable<EntityType.METRIC>
          entityType={EntityType.METRIC}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getMetricWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.RELATED_METRICS)) {
    return <RelatedMetrics />;
  }

  return (
    <CommonWidgets entityType={EntityType.METRIC} widgetConfig={widgetConfig} />
  );
};
