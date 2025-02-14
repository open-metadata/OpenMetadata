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
import { Col, Row } from 'antd';
import { t } from 'i18next';
import { isEmpty, omit } from 'lodash';
import { EntityTags } from 'Models';
import React from 'react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../components/common/EntityDescription/DescriptionV1';
import ResizablePanels from '../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import ContainerChildren from '../components/Container/ContainerChildren/ContainerChildren';
import ContainerDataModel from '../components/Container/ContainerDataModel/ContainerDataModel';
import EntityRightPanel from '../components/Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../constants/ResizablePanel.constants';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { EntityTabs, EntityType, TabSpecificField } from '../enums/entity.enum';
import {
  Column,
  ContainerDataModel as ContainerDataModelType,
} from '../generated/entity/data/container';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';
import { ContainerDetailPageTabProps } from './ContainerDetailsClassBase';

const getUpdatedContainerColumnTags = (
  containerColumn: Column,
  newContainerColumnTags: EntityTags[] = []
) => {
  const newTagsFqnList = newContainerColumnTags.map((newTag) => newTag.tagFQN);

  const prevTags = containerColumn?.tags?.filter((tag) =>
    newTagsFqnList.includes(tag.tagFQN)
  );

  const prevTagsFqnList = prevTags?.map((prevTag) => prevTag.tagFQN);

  const newTags: EntityTags[] = newContainerColumnTags.reduce((prev, curr) => {
    const isExistingTag = prevTagsFqnList?.includes(curr.tagFQN);

    return isExistingTag
      ? prev
      : [
          ...prev,
          {
            ...omit(curr, 'isRemovable'),
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ];
  }, [] as EntityTags[]);

  return [...(prevTags as TagLabel[]), ...newTags];
};

export const updateContainerColumnTags = (
  containerColumns: ContainerDataModelType['columns'] = [],
  changedColumnFQN: string,
  newColumnTags: EntityTags[] = []
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.tags = getUpdatedContainerColumnTags(
        containerColumn,
        newColumnTags
      );
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateContainerColumnTags(
          containerColumn.children,
          changedColumnFQN,
          newColumnTags
        );
      }
    }
  });
};

export const updateContainerColumnDescription = (
  containerColumns: ContainerDataModelType['columns'] = [],
  changedColumnFQN: string,
  description: string
) => {
  containerColumns.forEach((containerColumn) => {
    if (containerColumn.fullyQualifiedName === changedColumnFQN) {
      containerColumn.description = description;
    } else {
      const hasChildren = !isEmpty(containerColumn.children);

      // stop condition
      if (hasChildren) {
        updateContainerColumnDescription(
          containerColumn.children,
          changedColumnFQN,
          description
        );
      }
    }
  });
};

// eslint-disable-next-line max-len
export const ContainerFields = `${TabSpecificField.TAGS}, ${TabSpecificField.OWNERS},${TabSpecificField.FOLLOWERS},${TabSpecificField.DATAMODEL}, ${TabSpecificField.DOMAIN},${TabSpecificField.DATA_PRODUCTS}`;

export const getContainerDetailPageTabs = ({
  isDataModelEmpty,
  description,
  decodedContainerName,
  entityName,
  editDescriptionPermission,
  editGlossaryTermsPermission,
  editTagsPermission,
  editLineagePermission,
  editCustomAttributePermission,
  viewAllPermission,
  containerChildrenData,
  fetchContainerChildren,
  isChildrenLoading,
  handleUpdateDescription,
  handleUpdateDataModel,
  handleTagSelection,
  handleExtensionUpdate,
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  tab,
  deleted,
  owners,
  containerData,
  fetchContainerDetail,
  tags,
}: ContainerDetailPageTabProps) => {
  return [
    {
      label: (
        <TabsLabel
          id={isDataModelEmpty ? EntityTabs.CHILDREN : EntityTabs.SCHEMA}
          name={t(isDataModelEmpty ? 'label.children' : 'label.schema')}
        />
      ),
      key: isDataModelEmpty ? EntityTabs.CHILDREN : EntityTabs.SCHEMA,
      children: (
        <Row gutter={[0, 16]} wrap={false}>
          <Col className="tab-content-height-with-resizable-panel" span={24}>
            <ResizablePanels
              firstPanel={{
                className: 'entity-resizable-panel-container',
                children: (
                  <div className="d-flex flex-col gap-4 p-t-sm m-x-lg">
                    <DescriptionV1
                      description={description}
                      entityName={entityName}
                      entityType={EntityType.CONTAINER}
                      hasEditAccess={editDescriptionPermission}
                      isDescriptionExpanded={isEmpty(containerChildrenData)}
                      owner={owners}
                      showActions={!deleted}
                      onDescriptionUpdate={handleUpdateDescription}
                    />

                    {isDataModelEmpty ? (
                      <ContainerChildren
                        fetchChildren={fetchContainerChildren}
                        isLoading={isChildrenLoading}
                      />
                    ) : (
                      <ContainerDataModel
                        dataModel={containerData?.dataModel}
                        entityFqn={decodedContainerName}
                        hasDescriptionEditAccess={editDescriptionPermission}
                        hasGlossaryTermEditAccess={editGlossaryTermsPermission}
                        hasTagEditAccess={editTagsPermission}
                        isReadOnly={Boolean(deleted)}
                        onUpdate={handleUpdateDataModel}
                      />
                    )}
                  </div>
                ),
                ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
              }}
              secondPanel={{
                children: (
                  <div data-testid="entity-right-panel">
                    <EntityRightPanel<EntityType.CONTAINER>
                      editCustomAttributePermission={
                        editCustomAttributePermission
                      }
                      editGlossaryTermsPermission={editGlossaryTermsPermission}
                      editTagPermission={
                        editTagsPermission && !containerData?.deleted
                      }
                      entityType={EntityType.CONTAINER}
                      selectedTags={tags}
                      viewAllPermission={viewAllPermission}
                      onExtensionUpdate={handleExtensionUpdate}
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
    ...(isDataModelEmpty
      ? []
      : [
          {
            label: (
              <TabsLabel id={EntityTabs.CHILDREN} name={t('label.children')} />
            ),
            key: EntityTabs.CHILDREN,
            children: (
              <Row className="p-md" gutter={[0, 16]}>
                <Col span={24}>
                  <ContainerChildren
                    fetchChildren={fetchContainerChildren}
                    isLoading={isChildrenLoading}
                  />
                </Col>
              </Row>
            ),
          },
        ]),

    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={tab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-and-task-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.CONTAINER}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={() =>
            fetchContainerDetail(decodedContainerName)
          }
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
            entity={containerData as SourceType}
            entityType={EntityType.CONTAINER}
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
      children: containerData && (
        <div className="m-sm">
          <CustomPropertyTable<EntityType.CONTAINER>
            entityType={EntityType.CONTAINER}
            handleExtensionUpdate={handleExtensionUpdate}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
          />
        </div>
      ),
    },
  ];
};
