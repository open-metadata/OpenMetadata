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

import { AxiosError } from 'axios';
import { get } from 'lodash';
import { lazy } from 'react';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { LazyTabContent } from '../components/common/LazyTabContent/LazyTabContent';
import type { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import type { ChartType } from '../components/Dashboard/DashboardDetails/DashboardDetails.interface';
import type { SourceType } from '../components/SearchedData/SearchedData.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { PageType } from '../generated/system/ui/page';
import { Include } from '../generated/type/include';
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getChartById } from '../rest/chartAPI';
import type { DashboardDetailsTabsProps } from './DashboardDetailsClassBase';
import { t } from './i18next/LocalUtil';

const TabsLabel = withSuspenseFallback(
  lazy(() => import('../components/common/TabsLabel/TabsLabel.component'))
);

const GenericTab = withSuspenseFallback(
  lazy(() =>
    import('../components/Customization/GenericTab/GenericTab').then(
      (module) => ({ default: module.GenericTab })
    )
  )
);

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
);

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import('../components/common/CustomPropertyTable/CustomPropertyTable').then(
      (module) => ({ default: module.CustomPropertyTable })
    )
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const EntityLineageTab = lazy(() =>
  import('../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component'
    ).then((module) => ({ default: module.ActivityFeedTab }))
  )
);

const ContractTab = withSuspenseFallback(
  lazy(() =>
    import('../components/DataContract/ContractTab/ContractTab').then(
      (module) => ({ default: module.ContractTab })
    )
  )
);

const DashboardChartTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/Dashboard/DashboardChartTable/DashboardChartTable'
    ).then((module) => ({ default: module.DashboardChartTable }))
  )
);

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.DOMAINS},${TabSpecificField.OWNERS}, ${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.CHARTS},${TabSpecificField.VOTES},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.EXTENSION}`;

export const fetchCharts = async (
  charts: Dashboard['charts'],
  showDeleted = false
) => {
  let chartsData: ChartType[] = [];
  let promiseArr: Array<Promise<ChartType>> = [];
  try {
    if (charts?.length) {
      promiseArr = charts.map((chart) =>
        getChartById(chart.id, {
          fields: TabSpecificField.TAGS,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
        })
      );
      const res = await Promise.allSettled(promiseArr);

      if (res.length) {
        chartsData = res
          .filter((chart) => chart.status === 'fulfilled')
          .map((chart) => (chart as PromiseFulfilledResult<ChartType>).value);
      }
    }
  } catch (err) {
    throw new Error((err as AxiosError).message);
  }

  return chartsData;
};

export const getDashboardDetailPageTabs = ({
  dashboardDetails,
  editLineagePermission,
  editCustomAttributePermission,
  viewCustomPropertiesPermission,
  handleFeedCount,
  feedCount,
  activeTab,
  deleted,
  getEntityFeedCount,
  fetchDashboard,
  labelMap,
}: DashboardDetailsTabsProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
      ),
      key: EntityTabs.DETAILS,
      children: <GenericTab type={PageType.Dashboard} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DASHBOARD}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchDashboard}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
      key: EntityTabs.LINEAGE,
      children: (
        <LazyTabContent activeTab={activeTab} tab={EntityTabs.LINEAGE}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={dashboardDetails as SourceType}
            entityType={EntityType.DASHBOARD}
            hasEditAccess={editLineagePermission}
          />
        </LazyTabContent>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CONTRACT}
          name={get(labelMap, EntityTabs.CONTRACT, t('label.contract'))}
        />
      ),
      key: EntityTabs.CONTRACT,
      children: <ContractTab />,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={t('label.custom-property-plural')}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.DASHBOARD>
          entityType={EntityType.DASHBOARD}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
        />
      ),
    },
  ];
};

export const getDashboardWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.CHARTS_TABLE)) {
    return <DashboardChartTable />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DASHBOARD}
      widgetConfig={widgetConfig}
    />
  );
};
