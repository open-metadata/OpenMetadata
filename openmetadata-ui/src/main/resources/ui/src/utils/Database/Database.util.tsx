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
import { Col, Row, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { t } from 'i18next';
import { isEmpty, isUndefined, toLower } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import { OwnerLabel } from '../../components/common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import { DatabaseSchemaTable } from '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable';
import EntityRightPanel from '../../components/Entity/EntityRightPanel/EntityRightPanel';
import {
  getEntityDetailsPath,
  NO_DATA_PLACEHOLDER,
} from '../../constants/constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../constants/ResizablePanel.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/type';
import { UsageDetails } from '../../generated/type/entityUsage';
import { getEntityName } from '../EntityUtils';
import { getUsagePercentile } from '../TableUtils';
import { DatabaseDetailPageTabProps } from './DatabaseClassBase';

export const getQueryFilterForDatabase = (
  serviceType: string,
  databaseName: string
) =>
  JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [{ term: { serviceType: [toLower(serviceType)] } }],
            },
          },
          {
            bool: {
              should: [{ term: { 'database.name.keyword': [databaseName] } }],
            },
          },
        ],
      },
    },
  });

export const DatabaseFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

export const schemaTableColumns: ColumnsType<DatabaseSchema> = [
  {
    title: t('label.schema-name'),
    dataIndex: 'name',
    key: 'name',
    width: 250,
    render: (_, record: DatabaseSchema) => (
      <div className="d-inline-flex w-max-90">
        <Link
          className="break-word"
          data-testid={record.name}
          to={
            record.fullyQualifiedName
              ? getEntityDetailsPath(
                  EntityType.DATABASE_SCHEMA,
                  record.fullyQualifiedName
                )
              : ''
          }>
          {getEntityName(record)}
        </Link>
      </div>
    ),
  },
  {
    title: t('label.description'),
    dataIndex: 'description',
    key: 'description',
    render: (text: string) =>
      text?.trim() ? (
        <RichTextEditorPreviewerV1 markdown={text} />
      ) : (
        <span className="text-grey-muted">
          {t('label.no-entity', { entity: t('label.description') })}
        </span>
      ),
  },
  {
    title: t('label.owner-plural'),
    dataIndex: 'owners',
    key: 'owners',
    width: 120,

    render: (owners: EntityReference[]) =>
      !isUndefined(owners) && owners.length > 0 ? (
        <OwnerLabel owners={owners} />
      ) : (
        <Typography.Text data-testid="no-owner-text">
          {NO_DATA_PLACEHOLDER}
        </Typography.Text>
      ),
  },
  {
    title: t('label.usage'),
    dataIndex: 'usageSummary',
    key: 'usageSummary',
    width: 120,
    render: (text: UsageDetails) =>
      getUsagePercentile(text?.weeklyStats?.percentileRank ?? 0),
  },
];

export const getDatabaseDetailsPageDefaultLayout = (tab: EntityTabs) => {
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

export const getDatabasePageBaseTabs = ({
  activeTab,
  database,
  description,
  editDescriptionPermission,
  editGlossaryTermsPermission,
  editTagsPermission,
  viewAllPermission,
  tags,
  schemaInstanceCount,
  feedCount,
  handleFeedCount,
  getEntityFeedCount,
  onDescriptionUpdate,
  handleTagSelection,
  settingsUpdateHandler,
  deleted,
  editCustomAttributePermission,
  getDetailsByFQN,
}: DatabaseDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={schemaInstanceCount}
          id={EntityTabs.SCHEMA}
          isActive={activeTab === EntityTabs.SCHEMA}
          name={t('label.schema-plural')}
        />
      ),
      key: EntityTabs.SCHEMA,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="p-t-sm m-x-lg">
                    <Row gutter={[16, 16]}>
                      <Col data-testid="description-container" span={24}>
                        <DescriptionV1
                          description={description}
                          entityName={getEntityName(database)}
                          entityType={EntityType.DATABASE}
                          hasEditAccess={editDescriptionPermission}
                          isDescriptionExpanded={isEmpty(database)}
                          showActions={!database.deleted}
                          onDescriptionUpdate={onDescriptionUpdate}
                        />
                      </Col>
                      <Col span={24}>
                        <DatabaseSchemaTable isDatabaseDeleted={deleted} />
                      </Col>
                    </Row>
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.DATABASE>
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={editTagsPermission}
                      entityType={EntityType.DATABASE}
                      selectedTags={tags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={settingsUpdateHandler}
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
          name={t('label.activity-feed-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DATABASE}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={getDetailsByFQN}
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
      children: database && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.DATABASE>
            entityType={EntityType.DATABASE}
            handleExtensionUpdate={settingsUpdateHandler}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
            isVersionView={false}
          />
        </div>
      ),
    },
  ];
};
