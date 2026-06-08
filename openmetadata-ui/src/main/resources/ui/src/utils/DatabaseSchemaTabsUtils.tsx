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
import type { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import type { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import type { DatabaseSchemaPageTabProps } from './DatabaseSchemaClassBase';
import { t } from './i18next/LocalUtil';

const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import('../components/common/CustomPropertyTable/CustomPropertyTable').then(
      (module) => ({ default: module.CustomPropertyTable })
    )
  )
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

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

const SchemaTablesTab = withSuspenseFallback(
  lazy(() => import('../pages/DatabaseSchemaPage/SchemaTablesTab'))
);

const StoredProcedureTab = withSuspenseFallback(
  lazy(() => import('../pages/StoredProcedure/StoredProcedureTab'))
);

export const getDataBaseSchemaPageBaseTabs = ({
  feedCount,
  activeTab,
  editCustomAttributePermission,
  viewCustomPropertiesPermission,
  storedProcedureCount,
  getEntityFeedCount,
  fetchDatabaseSchemaDetails,
  handleFeedCount,
  tableCount,
  labelMap,
}: DatabaseSchemaPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={tableCount}
          id={EntityTabs.TABLE}
          isActive={activeTab === EntityTabs.TABLE}
          name={labelMap[EntityTabs.TABLE] || t('label.table-plural')}
        />
      ),
      key: EntityTabs.TABLE,
      children: <GenericTab type={PageType.DatabaseSchema} />,
    },
    {
      label: (
        <TabsLabel
          count={storedProcedureCount}
          id={EntityTabs.STORED_PROCEDURE}
          isActive={activeTab === EntityTabs.STORED_PROCEDURE}
          name={
            labelMap[EntityTabs.STORED_PROCEDURE] ||
            t('label.stored-procedure-plural')
          }
        />
      ),
      key: EntityTabs.STORED_PROCEDURE,
      children: <StoredProcedureTab />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={
            labelMap[EntityTabs.ACTIVITY_FEED] ||
            t('label.activity-feed-and-task-plural')
          }
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DATABASE_SCHEMA}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchDatabaseSchemaDetails}
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
            labelMap[EntityTabs.CUSTOM_PROPERTIES] ||
            t('label.custom-property-plural')
          }
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.DATABASE_SCHEMA>
          className=""
          entityType={EntityType.DATABASE_SCHEMA}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
          isVersionView={false}
        />
      ),
    },
  ];
};

export const getDatabaseSchemaWidgetsFromKey = (widgetConfig: WidgetConfig) => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLES)) {
    return <SchemaTablesTab />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.DATABASE_SCHEMA}
      widgetConfig={widgetConfig}
    />
  );
};
