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

import { Col, Row } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as ExportIcon } from '../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../assets/svg/ic-import.svg';
import ActivityFeedProvider from '../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { useEntityExportModalProvider } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import EntityRightPanel from '../components/Entity/EntityRightPanel/EntityRightPanel';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../constants/ResizablePanel.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import LimitWrapper from '../hoc/LimitWrapper';
import SchemaTablesTab from '../pages/DatabaseSchemaPage/SchemaTablesTab';
import StoredProcedureTab from '../pages/StoredProcedure/StoredProcedureTab';
import { exportDatabaseSchemaDetailsInCSV } from '../rest/databaseAPI';
import { DatabaseSchemaPageTabProps } from './DatabaseSchemaClassBase';
import { getEntityImportPath } from './EntityUtils';
import i18n from './i18next/LocalUtil';

// eslint-disable-next-line max-len
export const defaultFields = `${TabSpecificField.TAGS},${TabSpecificField.OWNERS},${TabSpecificField.USAGE_SUMMARY},${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

export const getDataBaseSchemaPageBaseTabs = ({
  feedCount,
  tableData,
  activeTab,
  currentTablesPage,
  databaseSchema,
  description,
  editDescriptionPermission,
  isEdit,
  showDeletedTables,
  tableDataLoading,
  editGlossaryTermsPermission,
  editCustomAttributePermission,
  editTagsPermission,
  decodedDatabaseSchemaFQN,
  tags,
  viewAllPermission,
  storedProcedureCount,
  onEditCancel,
  handleExtensionUpdate,
  handleTagSelection,
  onThreadLinkSelect,
  tablePaginationHandler,
  onDescriptionEdit,
  onDescriptionUpdate,
  handleShowDeletedTables,
  getEntityFeedCount,
  fetchDatabaseSchemaDetails,
  handleFeedCount,
  pagingInfo,
}: DatabaseSchemaPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={pagingInfo.paging.total}
          id={EntityTabs.TABLE}
          isActive={activeTab === EntityTabs.TABLE}
          name={t('label.table-plural')}
        />
      ),
      key: EntityTabs.TABLE,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="p-t-sm m-x-lg">
                    <SchemaTablesTab
                      currentTablesPage={currentTablesPage}
                      databaseSchemaDetails={databaseSchema}
                      description={description}
                      editDescriptionPermission={editDescriptionPermission}
                      isEdit={isEdit}
                      pagingInfo={pagingInfo}
                      showDeletedTables={showDeletedTables}
                      tableData={tableData}
                      tableDataLoading={tableDataLoading}
                      tablePaginationHandler={tablePaginationHandler}
                      onCancel={onEditCancel}
                      onDescriptionEdit={onDescriptionEdit}
                      onDescriptionUpdate={onDescriptionUpdate}
                      onShowDeletedTablesChange={handleShowDeletedTables}
                      onThreadLinkSelect={onThreadLinkSelect}
                    />
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.DATABASE_SCHEMA>
                      customProperties={databaseSchema}
                      dataProducts={databaseSchema?.dataProducts ?? []}
                      domain={databaseSchema?.domain}
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={editTagsPermission}
                      entityFQN={decodedDatabaseSchemaFQN}
                      entityId={databaseSchema?.id ?? ''}
                      entityType={EntityType.DATABASE_SCHEMA}
                      selectedTags={tags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={handleExtensionUpdate}
                      onTagSelectionChange={handleTagSelection}
                      onThreadLinkSelect={onThreadLinkSelect}
                    />
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
                className:
                  'entity-resizable-right-panel-container entity-resizable-panel-container',
              }}
            />
          </Col>
        </Row>
      ),
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
        <ActivityFeedProvider>
          <ActivityFeedTab
            refetchFeed
            entityFeedTotalCount={feedCount.totalCount}
            entityType={EntityType.DATABASE_SCHEMA}
            fqn={databaseSchema.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchDatabaseSchemaDetails}
            onUpdateFeedCount={handleFeedCount}
          />
        </ActivityFeedProvider>
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
      children: databaseSchema && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.DATABASE_SCHEMA>
            className=""
            entityDetails={databaseSchema}
            entityType={EntityType.DATABASE_SCHEMA}
            handleExtensionUpdate={handleExtensionUpdate}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
            isVersionView={false}
          />
        </div>
      ),
    },
  ];
};

export const ExtraDatabaseSchemaDropdownOptions = (
  fqn: string,
  permission: OperationPermission
) => {
  const { showModal } = useEntityExportModalProvider();
  const history = useHistory();

  const { ViewAll, EditAll } = permission;

  return [
    ...(EditAll
      ? [
          {
            label: (
              <LimitWrapper resource="databaseSchema">
                <ManageButtonItemLabel
                  description={i18n.t('message.import-entity-help', {
                    entity: i18n.t('label.database-schema'),
                  })}
                  icon={ImportIcon}
                  id="import-button"
                  name={i18n.t('label.import')}
                  onClick={() =>
                    history.push(
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
    ...(ViewAll
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={i18n.t('message.export-entity-help', {
                  entity: i18n.t('label.database-schema'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={i18n.t('label.export')}
                onClick={() =>
                  showModal({
                    name: fqn,
                    onExport: exportDatabaseSchemaDetailsInCSV,
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
