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
import { get } from 'lodash';
import { lazy } from 'react';
import { ActivityFeedLayoutType } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import type { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import i18n from '../i18next/LocalUtil';
import type { APICollectionDetailPageTabProps } from './APICollectionClassBase';

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

const APIEndpointsTab = withSuspenseFallback(
  lazy(() => import('../../pages/APICollectionPage/APIEndpointsTab'))
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

const ContractTab = withSuspenseFallback(
  lazy(() =>
    import('../../components/DataContract/ContractTab/ContractTab').then(
      (m) => ({ default: m.ContractTab })
    )
  )
);

export const getApiCollectionDetailsPageTabs = ({
  activeTab,
  feedCount,
  apiCollection,
  fetchAPICollectionDetails,
  getEntityFeedCount,
  handleFeedCount,
  editCustomAttributePermission,
  viewCustomPropertiesPermission,
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
          id={EntityTabs.CONTRACT}
          name={get(labelMap, EntityTabs.CONTRACT, i18n.t('label.contract'))}
        />
      ),
      key: EntityTabs.CONTRACT,
      children: <ContractTab />,
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
          hasPermission={viewCustomPropertiesPermission}
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
