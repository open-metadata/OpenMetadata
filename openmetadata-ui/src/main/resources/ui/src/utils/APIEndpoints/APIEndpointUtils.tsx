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
import APIEndpointSchema from '../../components/APIEndpoint/APIEndpointSchema/APIEndpointSchema';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import Lineage from '../../components/Lineage/Lineage.component';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import i18n from '../i18next/LocalUtil';
import { APIEndpointDetailPageTabProps } from './APIEndpointClassBase';

export const getApiEndpointDetailsPageTabs = ({
  activeTab,
  feedCount,
  apiEndpoint,
  fetchAPIEndpointDetails,
  getEntityFeedCount,
  handleFeedCount,
  editCustomAttributePermission,
  viewAllPermission,
  editLineagePermission,
  labelMap,
}: APIEndpointDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={EntityTabs.SCHEMA}
          name={labelMap[EntityTabs.SCHEMA] || i18n.t('label.schema')}
        />
      ),
      key: EntityTabs.SCHEMA,
      children: <GenericTab type={PageType.APIEndpoint} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap[EntityTabs.ACTIVITY_FEED] ||
            i18n.t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.API_ENDPOINT}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchAPIEndpointDetails}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={labelMap[EntityTabs.LINEAGE] || i18n.t('label.lineage')}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={apiEndpoint.deleted}
            entity={apiEndpoint as SourceType}
            entityType={EntityType.API_ENDPOINT}
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
            labelMap[EntityTabs.CUSTOM_PROPERTIES] ||
            i18n.t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.API_ENDPOINT>
          entityType={EntityType.API_ENDPOINT}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getApiEndpointWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.API_SCHEMA)) {
    return <APIEndpointSchema />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.API_ENDPOINT}
      widgetConfig={widgetConfig}
    />
  );
};
