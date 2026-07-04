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

import { lazy } from 'react';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { LazyTabContent } from '../../components/common/LazyTabContent/LazyTabContent';
import type { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import type { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import i18n from '../i18next/LocalUtil';
import type { MetricDetailPageTabProps } from './MetricDetailsClassBase';

const TabsLabel = withSuspenseFallback(
  lazy(() => import('../../components/common/TabsLabel/TabsLabel.component'))
);

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component'
    ).then((module) => ({ default: module.ActivityFeedTab }))
  )
);

const GenericTab = withSuspenseFallback(
  lazy(() =>
    import('../../components/Customization/GenericTab/GenericTab').then(
      (module) => ({ default: module.GenericTab })
    )
  )
);

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
);

const MetricExpression = withSuspenseFallback(
  lazy(
    () => import('../../components/Metric/MetricExpression/MetricExpression')
  )
);

const RelatedMetrics = withSuspenseFallback(
  lazy(() => import('../../components/Metric/RelatedMetrics/RelatedMetrics'))
);

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/common/CustomPropertyTable/CustomPropertyTable'
    ).then((module) => ({ default: module.CustomPropertyTable }))
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const EntityLineageTab = lazy(() =>
  import('../../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

export const getMetricDetailsPageTabs = ({
  feedCount,
  activeTab,
  editLineagePermission,
  editCustomAttributePermission,
  viewCustomPropertiesPermission,
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
        <LazyTabContent activeTab={activeTab} tab={EntityTabs.LINEAGE}>
          <EntityLineageTab
            deleted={Boolean(metricDetails?.deleted)}
            entity={metricDetails as SourceType}
            entityType={EntityType.METRIC}
            hasEditAccess={editLineagePermission}
          />
        </LazyTabContent>
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
          hasPermission={viewCustomPropertiesPermission}
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
