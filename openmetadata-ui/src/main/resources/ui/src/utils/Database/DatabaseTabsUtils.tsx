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
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { t } from '../i18next/LocalUtil';
import { DatabaseDetailPageTabProps } from './DatabaseClassBase';

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/common/CustomPropertyTable/CustomPropertyTable'
    ).then((module) => ({ default: module.CustomPropertyTable }))
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

const ActivityFeedTab = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component'
    ).then((module) => ({ default: module.ActivityFeedTab }))
  )
);

const ContractTab = withSuspenseFallback(
  lazy(() =>
    import('../../components/DataContract/ContractTab/ContractTab').then(
      (module) => ({ default: module.ContractTab })
    )
  )
);

const DatabaseSchemaTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable'
    ).then((module) => ({ default: module.DatabaseSchemaTable }))
  )
);

export const getDatabasePageBaseTabs = ({
  activeTab,
  database,
  viewCustomPropertiesPermission,
  schemaInstanceCount,
  feedCount,
  handleFeedCount,
  getEntityFeedCount,
  editCustomAttributePermission,
  getDetailsByFQN,
  labelMap,
}: DatabaseDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={schemaInstanceCount}
          id={EntityTabs.SCHEMAS}
          isActive={activeTab === EntityTabs.SCHEMAS}
          name={labelMap?.[EntityTabs.SCHEMAS] ?? t('label.database-schema')}
        />
      ),
      key: EntityTabs.SCHEMAS,
      children: <GenericTab type={PageType.Database} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap?.[EntityTabs.ACTIVITY_FEED] ??
            t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DATABASE}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={getDetailsByFQN}
          onUpdateFeedCount={handleFeedCount}
        />
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
          name={
            labelMap?.[EntityTabs.CUSTOM_PROPERTIES] ??
            t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: database && (
        <CustomPropertyTable<EntityType.DATABASE>
          entityType={EntityType.DATABASE}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
          isVersionView={false}
        />
      ),
    },
  ];
};

export const getDatabaseWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DATABASE_SCHEMA)) {
    return <DatabaseSchemaTable />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DATABASE}
      widgetConfig={widgetConfig}
    />
  );
};
