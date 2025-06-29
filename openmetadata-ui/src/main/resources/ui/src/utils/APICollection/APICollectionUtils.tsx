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
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import APIEndpointsTab from '../../pages/APICollectionPage/APIEndpointsTab';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import i18n from '../i18next/LocalUtil';
import { APICollectionDetailPageTabProps } from './APICollectionClassBase';

export const getApiCollectionDetailsPageTabs = ({
  activeTab,
  feedCount,
  apiCollection,
  fetchAPICollectionDetails,
  getEntityFeedCount,
  handleFeedCount,
  editCustomAttributePermission,
  viewAllPermission,
  apiEndpointCount,
  labelMap,
}: APICollectionDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          count={apiEndpointCount}
          id={EntityTabs.API_ENDPOINT}
          isActive={activeTab === EntityTabs.API_ENDPOINT}
          name={
            labelMap?.[EntityTabs.API_ENDPOINT] ??
            i18n.t('label.endpoint-plural')
          }
        />
      ),
      key: EntityTabs.API_ENDPOINT,
      children: <GenericTab type={PageType.APICollection} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap?.[EntityTabs.ACTIVITY_FEED] ??
            i18n.t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.API_COLLECTION}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchAPICollectionDetails}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={
            labelMap?.[EntityTabs.CUSTOM_PROPERTIES] ??
            i18n.t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: apiCollection && (
        <CustomPropertyTable<EntityType.API_COLLECTION>
          className=""
          entityType={EntityType.API_COLLECTION}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
          isVersionView={false}
        />
      ),
    },
  ];
};

export const getApiCollectionWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.API_ENDPOINTS)) {
    return <APIEndpointsTab />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.API_COLLECTION}
      widgetConfig={widgetConfig}
    />
  );
};
