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

import { Card, Col, Row, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined, toString } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import DescriptionV1 from '../../components/common/description/DescriptionV1';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityLineageComponent from '../../components/Entity/EntityLineage/EntityLineage.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { withActivityFeed } from '../../components/router/withActivityFeed';
import SchemaEditor from '../../components/schema-editor/SchemaEditor';
import { SourceType } from '../../components/searched-data/SearchedData.interface';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import {
  getDataModelDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { restoreDataModel } from '../../rest/dataModelsAPI';
import { getFeedCounts } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import { createTagObject } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { DataModelDetailsProps } from './DataModelDetails.interface';
import ModelTab from './ModelTab/ModelTab.component';

const DataModelDetails = ({
  updateDataModelDetailsState,
  dataModelData,
  dataModelPermissions,
  fetchDataModel,
  createThread,
  handleFollowDataModel,
  handleUpdateTags,
  handleUpdateOwner,
  handleUpdateTier,
  handleUpdateDescription,
  handleColumnUpdateDataModel,
  onUpdateDataModel,
  handleToggleDelete,
  onUpdateVote,
}: DataModelDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { fqn: dashboardDataModelFQN, tab: activeTab } =
    useParams<{ fqn: string; tab: EntityTabs }>();

  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const [feedCount, setFeedCount] = useState<number>(0);

  const decodedDataModelFQN = useMemo(
    () => getDecodedFqn(dashboardDataModelFQN),
    [dashboardDataModelFQN]
  );

  const { deleted, owner, description, version, entityName, tags } =
    useMemo(() => {
      return {
        deleted: dataModelData?.deleted,
        owner: dataModelData?.owner,
        description: dataModelData?.description,
        version: dataModelData?.version,
        entityName: getEntityName(dataModelData),
        tags: getTagsWithoutTier(dataModelData.tags ?? []),
      };
    }, [dataModelData]);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.DASHBOARD_DATA_MODEL,
      decodedDataModelFQN,
      setFeedCount
    );
  };

  useEffect(() => {
    dashboardDataModelFQN && getEntityFeedCount();
  }, [dashboardDataModelFQN]);

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
        pathname: getDataModelDetailsPath(
          getDecodedFqn(dashboardDataModelFQN),
          tabValue
        ),
      });
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);
    handleUpdateTags(updatedTags);
  };

  const handleRestoreDataModel = async () => {
    try {
      await restoreDataModel(dataModelData.id ?? '');
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.data-model'),
        }),
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.data-model'),
        })
      );
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete() : history.push('/'),
    []
  );

  const {
    editDescriptionPermission,
    editTagsPermission,
    editLineagePermission,
  } = useMemo(() => {
    return {
      editDescriptionPermission:
        (dataModelPermissions.EditAll ||
          dataModelPermissions.EditDescription) &&
        !deleted,
      editTagsPermission:
        (dataModelPermissions.EditAll || dataModelPermissions.EditTags) &&
        !deleted,
      editLineagePermission:
        (dataModelPermissions.EditAll || dataModelPermissions.EditLineage) &&
        !deleted,
    };
  }, [dataModelPermissions, deleted]);

  const modelComponent = useMemo(() => {
    return (
      <Row gutter={[0, 16]} wrap={false}>
        <Col className="p-t-sm m-x-lg" flex="auto">
          <div className="d-flex flex-col gap-4">
            <DescriptionV1
              description={description}
              entityFqn={decodedDataModelFQN}
              entityName={entityName}
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              hasEditAccess={editDescriptionPermission}
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
              entityFqn={decodedDataModelFQN}
              hasEditDescriptionPermission={editDescriptionPermission}
              hasEditTagsPermission={editTagsPermission}
              isReadOnly={Boolean(deleted)}
              onThreadLinkSelect={onThreadLinkSelect}
              onUpdate={handleColumnUpdateDataModel}
            />
          </div>
        </Col>
        <Col
          className="entity-tag-right-panel-container"
          data-testid="entity-right-panel"
          flex="320px">
          <Space className="w-full" direction="vertical" size="large">
            <TagsContainerV2
              displayType={DisplayType.READ_MORE}
              entityFqn={decodedDataModelFQN}
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              permission={editTagsPermission}
              selectedTags={tags}
              tagType={TagSource.Classification}
              onSelectionChange={handleTagSelection}
              onThreadLinkSelect={onThreadLinkSelect}
            />
            <TagsContainerV2
              displayType={DisplayType.READ_MORE}
              entityFqn={decodedDataModelFQN}
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              permission={editTagsPermission}
              selectedTags={tags}
              tagType={TagSource.Glossary}
              onSelectionChange={handleTagSelection}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          </Space>
        </Col>
      </Row>
    );
  }, [
    decodedDataModelFQN,
    dataModelData,
    description,
    dashboardDataModelFQN,
    editTagsPermission,
    deleted,
    editDescriptionPermission,
    isEditDescription,
    entityName,
    handleTagSelection,
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
          <ActivityFeedTab
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            fqn={dataModelData?.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={fetchDataModel}
          />
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
          <EntityLineageComponent
            deleted={deleted}
            entity={dataModelData as SourceType}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            hasEditAccess={editLineagePermission}
          />
        ),
      },
    ];

    return allTabs;
  }, [
    feedCount,
    dataModelData?.sql,
    modelComponent,
    deleted,
    editLineagePermission,
  ]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.data-model'),
      })}
      title="Data Model Details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDataModelDetailsState}
            dataAsset={dataModelData}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            permissions={dataModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowDataModel}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreDataModel}
            onTierUpdate={handleUpdateTier}
            onUpdateVote={onUpdateVote}
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

export default withActivityFeed<DataModelDetailsProps>(DataModelDetails);
