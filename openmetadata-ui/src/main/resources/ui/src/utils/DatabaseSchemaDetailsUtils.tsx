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
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import EntityRightPanel from '../components/Entity/EntityRightPanel/EntityRightPanel';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../constants/ResizablePanel.constants';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import SchemaTablesTab from '../pages/DatabaseSchemaPage/SchemaTablesTab';
import StoredProcedureTab from '../pages/StoredProcedure/StoredProcedureTab';
import { DatabaseSchemaPageTabProps } from './DatabaseSchemaClassBase';

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
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DATABASE_SCHEMA}
          fqn={databaseSchema.fullyQualifiedName ?? ''}
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
