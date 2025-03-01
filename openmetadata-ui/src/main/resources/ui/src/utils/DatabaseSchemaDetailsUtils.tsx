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
import React from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import SchemaTablesTab from '../pages/DatabaseSchemaPage/SchemaTablesTab';
import StoredProcedureTab from '../pages/StoredProcedure/StoredProcedureTab';
import { DatabaseSchemaPageTabProps } from './DatabaseSchemaClassBase';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

export const getDataBaseSchemaPageBaseTabs = ({
  feedCount,
  activeTab,
  editCustomAttributePermission,
  viewAllPermission,
  storedProcedureCount,
  getEntityFeedCount,
  fetchDatabaseSchemaDetails,
  handleFeedCount,
  tableCount,
}: DatabaseSchemaPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={tableCount}
          id={EntityTabs.TABLE}
          isActive={activeTab === EntityTabs.TABLE}
          name={t('label.table-plural')}
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
          name={t('label.stored-procedure-plural')}
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
          name={t('label.activity-feed-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DATABASE_SCHEMA}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchDatabaseSchemaDetails}
          onUpdateFeedCount={handleFeedCount}
        />
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
        <div className="m-sm">
          <CustomPropertyTable<EntityType.DATABASE_SCHEMA>
            className=""
            entityType={EntityType.DATABASE_SCHEMA}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
            isVersionView={false}
          />
        </div>
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
