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

import { t } from 'i18next';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { ChartDetailsTabsProps } from './ChartDetailsClassBase';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.DOMAINS},${TabSpecificField.OWNERS}, ${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS},${TabSpecificField.VOTES},${TabSpecificField.DATA_PRODUCTS},${TabSpecificField.EXTENSION}`;

export const getChartDetailPageTabs = ({
  chartDetails,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  handleFeedCount,
  feedCount,
  activeTab,
  deleted,
  getEntityFeedCount,
  fetchChart,
}: ChartDetailsTabsProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
      ),
      key: EntityTabs.DETAILS,
      children: <GenericTab type={PageType.Chart} />,
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
          entityType={EntityType.CHART}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchChart}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={deleted}
            entity={chartDetails as SourceType}
            entityType={EntityType.CHART}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
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
        <CustomPropertyTable
          entityType={EntityType.CHART}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getChartWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  return (
    <CommonWidgets entityType={EntityType.CHART} widgetConfig={widgetConfig} />
  );
};
