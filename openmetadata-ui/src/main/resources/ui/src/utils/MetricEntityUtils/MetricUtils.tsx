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

import { lazy, Suspense } from 'react';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import Loader from '../../components/common/Loader/Loader';
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

const MetricHierarchyCard = withSuspenseFallback(
  lazy(
    () =>
      import('../../components/Metric/MetricHierarchyCard/MetricHierarchyCard')
  )
);

const MetricDefinitionCard = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Metric/MetricDefinitionCard/MetricDefinitionCard'
      )
  )
);

const RelatedMetrics = withSuspenseFallback(
  lazy(() => import('../../components/Metric/RelatedMetrics/RelatedMetrics'))
);

const MetricDimensions = withSuspenseFallback(
  lazy(
    () => import('../../components/Metric/MetricDimensions/MetricDimensions')
  )
);

const MetricMeasures = withSuspenseFallback(
  lazy(() => import('../../components/Metric/MetricMeasures/MetricMeasures'))
);

const MetricObservabilityTab = lazy(
  () =>
    import(
      '../../components/Metric/MetricObservability/MetricObservabilityTab.component'
    )
);

const MetricApprovalTab = lazy(
  () =>
    import('../../components/Metric/MetricApproval/MetricApprovalTab.component')
);

const MetricAssetsTab = lazy(
  () =>
    import('../../components/Metric/MetricAssetsTab/MetricAssetsTab.component')
);

const EntityLineageTab = lazy(() =>
  import('../../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

export const getMetricDetailsPageTabs = ({
  feedCount,
  activeTab,
  editLineagePermission,
  getEntityFeedCount,
  fetchMetricDetails,
  metricDetails,
  handleFeedCount,
  labelMap,
  metricPermissions,
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
          id={EntityTabs.LINEAGE}
          name={labelMap[EntityTabs.LINEAGE] ?? i18n.t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(metricDetails?.deleted)}
            entity={metricDetails as SourceType}
            entityType={EntityType.METRIC}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
    },
    {
      label: (
        <TabsLabel
          count={metricDetails?.assets?.length ?? 0}
          id={EntityTabs.ASSETS}
          isActive={activeTab === EntityTabs.ASSETS}
          name={labelMap[EntityTabs.ASSETS] ?? i18n.t('label.asset-plural')}
        />
      ),
      key: EntityTabs.ASSETS,
      children: metricDetails && metricPermissions && (
        <Suspense fallback={<Loader />}>
          <MetricAssetsTab
            metric={metricDetails}
            permissions={metricPermissions}
            onAssetsChange={fetchMetricDetails}
          />
        </Suspense>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.DATA_OBSERVABILITY}
          name={
            labelMap[EntityTabs.DATA_OBSERVABILITY] ??
            i18n.t('label.data-observability')
          }
        />
      ),
      key: EntityTabs.DATA_OBSERVABILITY,
      children: metricDetails && (
        <Suspense fallback={<Loader />}>
          <MetricObservabilityTab metric={metricDetails} />
        </Suspense>
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
            i18n.t('label.activity-and-task-plural')
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
          id={EntityTabs.APPROVAL}
          name={labelMap[EntityTabs.APPROVAL] ?? i18n.t('label.approval')}
        />
      ),
      key: EntityTabs.APPROVAL,
      children: metricDetails && (
        <Suspense fallback={<Loader />}>
          <MetricApprovalTab
            metric={metricDetails}
            onStatusChange={fetchMetricDetails}
          />
        </Suspense>
      ),
    },
  ];
};

export const getMetricWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.RELATED_METRICS)) {
    return <RelatedMetrics />;
  }

  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.METRIC_HIERARCHY)) {
    return <MetricHierarchyCard />;
  }

  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.METRIC_DEFINITION)) {
    return <MetricDefinitionCard />;
  }

  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.METRIC_DIMENSIONS)) {
    return <MetricDimensions />;
  }

  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.METRIC_MEASURES)) {
    return <MetricMeasures />;
  }

  return (
    <CommonWidgets entityType={EntityType.METRIC} widgetConfig={widgetConfig} />
  );
};
