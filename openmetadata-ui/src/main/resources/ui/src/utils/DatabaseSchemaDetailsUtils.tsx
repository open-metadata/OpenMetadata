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

import { NavigateFunction } from 'react-router-dom';
import { ReactComponent as ExportIcon } from '../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../assets/svg/ic-import.svg';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import { useEntityExportModalProvider } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { ExportTypes } from '../constants/Export.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { PageType } from '../generated/system/ui/page';
import LimitWrapper from '../hoc/LimitWrapper';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import SchemaTablesTab from '../pages/DatabaseSchemaPage/SchemaTablesTab';
import StoredProcedureTab from '../pages/StoredProcedure/StoredProcedureTab';
import { exportDatabaseSchemaDetailsInCSV } from '../rest/databaseAPI';
import { DatabaseSchemaPageTabProps } from './DatabaseSchemaClassBase';
import { getEntityImportPath } from './EntityUtils';
import { t } from './i18next/LocalUtil';

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
          hasPermission={viewAllPermission}
          isVersionView={false}
        />
      ),
    },
  ];
};

export const ExtraDatabaseSchemaDropdownOptions = (
  fqn: string,
  permission: OperationPermission,
  deleted: boolean,
  navigate: NavigateFunction
) => {
  const { showModal } = useEntityExportModalProvider();

  const { ViewAll, EditAll } = permission;

  return [
    ...(EditAll && !deleted
      ? [
          {
            label: (
              <LimitWrapper resource="databaseSchema">
                <ManageButtonItemLabel
                  description={t('message.import-entity-help', {
                    entity: t('label.database-schema'),
                  })}
                  icon={ImportIcon}
                  id="import-button"
                  name={t('label.import')}
                  onClick={() =>
                    navigate(
                      getEntityImportPath(EntityType.DATABASE_SCHEMA, fqn)
                    )
                  }
                />
              </LimitWrapper>
            ),
            key: 'import-button',
          },
        ]
      : []),
    ...(ViewAll && !deleted
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.export-entity-help', {
                  entity: t('label.database-schema'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={t('label.export')}
                onClick={() =>
                  showModal({
                    name: fqn,
                    onExport: exportDatabaseSchemaDetailsInCSV,
                    exportTypes: [ExportTypes.CSV],
                  })
                }
              />
            ),
            key: 'export-button',
          },
        ]
      : []),
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
