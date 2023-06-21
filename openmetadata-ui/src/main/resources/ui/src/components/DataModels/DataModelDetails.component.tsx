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

import { Card, Col, Row, Tabs } from 'antd';
import ActivityFeedProvider, {
  useActivityFeedProvider,
} from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityLineageComponent from 'components/EntityLineage/EntityLineage.component';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV1 from 'components/Tag/TagsContainerV1/TagsContainerV1';
import { getDataModelDetailsPath, getVersionPath } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { CSMode } from 'enums/codemirror.enum';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import { LabelType, State, TagLabel } from 'generated/type/tagLabel';
import { isUndefined, toString } from 'lodash';
import { EntityTags } from 'Models';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { getEntityFieldThreadCounts } from 'utils/FeedUtils';
import { getTagsWithoutTier } from 'utils/TableUtils';
import { DataModelDetailsProps } from './DataModelDetails.interface';
import ModelTab from './ModelTab/ModelTab.component';

const DataModelDetails = ({
  entityFieldThreadCount,
  feedCount,
  dataModelData,
  dataModelPermissions,
  createThread,
  handleFollowDataModel,
  handleUpdateTags,
  handleUpdateOwner,
  handleUpdateTier,
  handleUpdateDescription,
  handleColumnUpdateDataModel,
  onUpdateDataModel,
}: DataModelDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { dashboardDataModelFQN, tab: activeTab } =
    useParams<{ dashboardDataModelFQN: string; tab: EntityTabs }>();

  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);
  const [threadLink, setThreadLink] = useState<string>('');

  const {
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditLineagePermission,
  } = useMemo(() => {
    return {
      hasEditDescriptionPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditDescription,
      hasEditTagsPermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditTags,
      hasEditLineagePermission:
        dataModelPermissions.EditAll || dataModelPermissions.EditLineage,
    };
  }, [dataModelPermissions]);

  const { deleted, owner, description, version, entityName, tags } =
    useMemo(() => {
      return {
        deleted: dataModelData?.deleted,
        owner: dataModelData?.owner,
        description: dataModelData?.description,
        version: dataModelData?.version,
        entityName: getEntityName(dataModelData),
        tags: getTagsWithoutTier(dataModelData.tags || []),
      };
    }, [dataModelData]);

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(dataModelData)) {
      return;
    }

    const updatedData = {
      ...dataModelData,
      displayName: data.displayName,
    };

    await onUpdateDataModel(updatedData, 'displayName');
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(
        EntityType.DASHBOARD_DATA_MODEL,
        dashboardDataModelFQN,
        toString(version)
      )
    );
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const handleTabChange = (tabValue: EntityTabs) => {
    if (tabValue !== activeTab) {
      history.push({
        pathname: getDataModelDetailsPath(dashboardDataModelFQN, tabValue),
      });
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = selectedTags?.map((tag) => ({
      source: tag.source,
      tagFQN: tag.tagFQN,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    }));
    handleUpdateTags(updatedTags);
  };

  const modelComponent = useMemo(() => {
    return (
      <Row gutter={[0, 16]} wrap={false}>
        <Col className="p-t-sm m-l-lg" flex="auto">
          <div className="d-flex flex-col gap-4">
            <DescriptionV1
              description={description}
              entityFieldThreads={getEntityFieldThreadCounts(
                EntityField.DESCRIPTION,
                entityFieldThreadCount
              )}
              entityFqn={dashboardDataModelFQN}
              entityName={entityName}
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              hasEditAccess={hasEditDescriptionPermission}
              isEdit={isEditDescription}
              isReadOnly={deleted}
              owner={owner}
              onCancel={() => setIsEditDescription(false)}
              onDescriptionEdit={() => setIsEditDescription(true)}
              onDescriptionUpdate={handleUpdateDescription}
              onThreadLinkSelect={onThreadLinkSelect}
            />
            <ModelTab
              data={dataModelData?.columns || []}
              hasEditDescriptionPermission={hasEditDescriptionPermission}
              hasEditTagsPermission={hasEditTagsPermission}
              isReadOnly={Boolean(deleted)}
              onUpdate={handleColumnUpdateDataModel}
            />
          </div>
        </Col>
        <Col
          className="entity-tag-right-panel-container"
          data-testid="entity-right-panel"
          flex="320px">
          <TagsContainerV1
            editable={hasEditTagsPermission}
            entityFieldThreads={getEntityFieldThreadCounts(
              EntityField.TAGS,
              entityFieldThreadCount
            )}
            entityFqn={dashboardDataModelFQN}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            selectedTags={tags}
            onSelectionChange={handleTagSelection}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        </Col>
      </Row>
    );
  }, [
    description,
    dashboardDataModelFQN,
    entityFieldThreadCount,
    hasEditTagsPermission,
    deleted,
    hasEditDescriptionPermission,
    isEditDescription,
    entityName,
    handleTagSelection,
    onThreadLinkSelect,
    onThreadLinkSelect,
    handleColumnUpdateDataModel,
    handleUpdateDescription,
    getEntityFieldThreadCounts,
  ]);

  const tabs = useMemo(() => {
    const allTabs = [
      {
        label: (
          <TabsLabel
            data-testid={EntityTabs.MODEL}
            id={EntityTabs.DETAILS}
            name={t('label.model')}
          />
        ),
        key: EntityTabs.MODEL,
        children: modelComponent,
      },
      {
        label: (
          <TabsLabel
            count={feedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={activeTab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedProvider>
            <ActivityFeedTab
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              fqn={dataModelData?.fullyQualifiedName ?? ''}
              onFeedUpdate={() => Promise.resolve()}
            />
          </ActivityFeedProvider>
        ),
      },
      ...(dataModelData?.sql
        ? [
            {
              label: (
                <TabsLabel
                  data-testid={EntityTabs.SQL}
                  id={EntityTabs.SQL}
                  name={t('label.sql-uppercase')}
                />
              ),
              key: EntityTabs.SQL,
              children: (
                <Card>
                  <SchemaEditor
                    editorClass="custom-code-mirror-theme full-screen-editor-height"
                    mode={{ name: CSMode.SQL }}
                    options={{
                      styleActiveLine: false,
                      readOnly: 'nocursor',
                    }}
                    value={dataModelData?.sql}
                  />
                </Card>
              ),
            },
          ]
        : []),
      {
        label: (
          <TabsLabel
            data-testid={EntityTabs.LINEAGE}
            id={EntityTabs.LINEAGE}
            name={t('label.lineage')}
          />
        ),
        key: EntityTabs.LINEAGE,
        children: (
          <Card
            className="card-body-full m-md w-auto h-60vh"
            data-testid="lineage-details">
            <EntityLineageComponent
              deleted={deleted}
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              hasEditAccess={hasEditLineagePermission}
            />
          </Card>
        ),
      },
    ];

    return allTabs;
  }, [feedCount, dataModelData?.sql, modelComponent]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Data Model Details"
      title="Data Model Details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            dataAsset={dataModelData}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            permissions={dataModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowDataModel}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={() => Promise.resolve()}
            onTierUpdate={handleUpdateTier}
            onVersionClick={versionHandler}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab ?? EntityTabs.MODEL}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={(activeKey: string) =>
              handleTabChange(activeKey as EntityTabs)
            }
          />
        </Col>

        {threadLink ? (
          <ActivityThreadPanel
            createThread={createThread}
            deletePostHandler={deleteFeed}
            open={Boolean(threadLink)}
            postFeedHandler={postFeed}
            threadLink={threadLink}
            updateThreadHandler={updateFeed}
            onCancel={onThreadPanelClose}
          />
        ) : null}
      </Row>
    </PageLayoutV1>
  );
};

export default DataModelDetails;
