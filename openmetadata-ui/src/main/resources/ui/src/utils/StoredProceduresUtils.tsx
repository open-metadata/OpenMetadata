/*
 *  Copyright 2023 Collate.
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
import { Card, Col, Row } from 'antd';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../components/common/EntityDescription/DescriptionV1';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import SchemaEditor from '../components/Database/SchemaEditor/SchemaEditor';
import EntityRightPanel from '../components/Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../constants/ResizablePanel.constants';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { CSMode } from '../enums/codemirror.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import { StoredProcedureDetailPageTabProps } from './StoredProcedureBase';

// eslint-disable-next-line max-len
export const STORED_PROCEDURE_DEFAULT_FIELDS = `${TabSpecificField.OWNERS}, ${TabSpecificField.FOLLOWERS},${TabSpecificField.TAGS}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}, ${TabSpecificField.VOTES},${TabSpecificField.EXTENSION}`;

export const getStoredProceduresPageDefaultLayout = (tab: EntityTabs) => {
  switch (tab) {
    case EntityTabs.SCHEMA:
      return [
        {
          h: 2,
          i: DetailPageWidgetKeys.DESCRIPTION,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 8,
          i: DetailPageWidgetKeys.TABLE_SCHEMA,
          w: 6,
          x: 0,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
          w: 2,
          x: 6,
          y: 0,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.DATA_PRODUCTS,
          w: 2,
          x: 6,
          y: 1,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.TAGS,
          w: 2,
          x: 6,
          y: 2,
          static: false,
        },
        {
          h: 1,
          i: DetailPageWidgetKeys.GLOSSARY_TERMS,
          w: 2,
          x: 6,
          y: 3,
          static: false,
        },
        {
          h: 3,
          i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
          w: 2,
          x: 6,
          y: 4,
          static: false,
        },
      ];

    default:
      return [];
  }
};

export const getStoredProcedureDetailsPageTabs = ({
  activeTab,
  feedCount,
  description,
  entityName,
  code,
  deleted,
  owners,
  editDescriptionPermission,
  onDescriptionUpdate,
  storedProcedure,
  tags,
  editTagsPermission,
  editGlossaryTermsPermission,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  onExtensionUpdate,
  handleTagSelection,
  getEntityFeedCount,
  fetchStoredProcedureDetails,
  handleFeedCount,
}: StoredProcedureDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          data-testid={EntityTabs.CODE}
          id={EntityTabs.CODE}
          name={t('label.code')}
        />
      ),
      key: EntityTabs.CODE,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="d-flex flex-col gap-4 p-t-sm m-l-lg p-r-lg">
                    <DescriptionV1
                      description={description}
                      entityName={entityName}
                      entityType={EntityType.STORED_PROCEDURE}
                      hasEditAccess={editDescriptionPermission}
                      isDescriptionExpanded={isEmpty(code)}
                      owner={owners}
                      showActions={!deleted}
                      onDescriptionUpdate={onDescriptionUpdate}
                    />

                    <Card className="m-b-md" data-testid="code-component">
                      <SchemaEditor
                        editorClass="custom-code-mirror-theme full-screen-editor-height"
                        mode={{ name: CSMode.SQL }}
                        options={{
                          styleActiveLine: false,
                          readOnly: true,
                        }}
                        value={code}
                      />
                    </Card>
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.STORED_PROCEDURE>
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={editTagsPermission}
                      entityType={EntityType.STORED_PROCEDURE}
                      selectedTags={tags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={onExtensionUpdate}
                      onTagSelectionChange={handleTagSelection}
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
          entityType={EntityType.STORED_PROCEDURE}
          owners={storedProcedure?.owners}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchStoredProcedureDetails}
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
            entity={storedProcedure as SourceType}
            entityType={EntityType.STORED_PROCEDURE}
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
      children: storedProcedure && (
        <CustomPropertyTable<EntityType.STORED_PROCEDURE>
          entityType={EntityType.STORED_PROCEDURE}
          handleExtensionUpdate={onExtensionUpdate}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};
