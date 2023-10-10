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

import { Col, Row, Space, Table, Tabs, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import DescriptionV1 from '../../components/common/description/DescriptionV1';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import EntityLineageComponent from '../../components/Entity/EntityLineage/EntityLineage.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { withActivityFeed } from '../../components/router/withActivityFeed';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { getMlModelDetailsPath } from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { MlHyperParameter } from '../../generated/api/data/createMlModel';
import { Tag } from '../../generated/entity/classification/tag';
import { Mlmodel, MlStore } from '../../generated/entity/data/mlmodel';
import { ThreadType } from '../../generated/entity/feed/thread';
import { TagLabel, TagSource } from '../../generated/type/schema';
import { restoreMlmodel } from '../../rest/mlModelAPI';
import { getEmptyPlaceholder, getFeedCounts } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { MlModelDetailProp } from './MlModelDetail.interface';
import MlModelFeaturesList from './MlModelFeaturesList';

const MlModelDetail: FC<MlModelDetailProp> = ({
  updateMlModelDetailsState,
  mlModelDetail,
  fetchMlModel,
  followMlModelHandler,
  unFollowMlModelHandler,
  descriptionUpdateHandler,
  settingsUpdateHandler,
  updateMlModelFeatures,
  onExtensionUpdate,
  createThread,
  onUpdateVote,
  versionHandler,
  tagUpdateHandler,
  handleToggleDelete,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { fqn: mlModelFqn, tab: activeTab } =
    useParams<{ tab: EntityTabs; fqn: string }>();

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);

  const [mlModelPermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [threadLink, setThreadLink] = useState<string>('');

  const { getEntityPermission } = usePermissionProvider();

  const decodedMlModelFqn = useMemo(
    () => getDecodedFqn(mlModelFqn),
    [mlModelFqn]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.ML_MODEL,
        mlModelDetail.id
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  }, [mlModelDetail.id, getEntityPermission, setPipelinePermissions]);

  useEffect(() => {
    if (mlModelDetail.id) {
      fetchResourcePermission();
    }
  }, [mlModelDetail.id]);

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.nonSecureUserDetails, AppState.userDetails]
  );

  const { mlModelTags, isFollowing, tier } = useMemo(() => {
    return {
      ...mlModelDetail,
      tier: getTierTags(mlModelDetail.tags ?? []),
      mlModelTags: getTagsWithoutTier(mlModelDetail.tags || []),
      entityName: getEntityName(mlModelDetail),
      isFollowing: mlModelDetail.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [mlModelDetail]);

  const fetchEntityFeedCount = () => {
    getFeedCounts(EntityType.MLMODEL, decodedMlModelFqn, setFeedCount);
  };

  useEffect(() => {
    if (mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic) {
      fetchEntityFeedCount();
    }
  }, [mlModelPermissions, decodedMlModelFqn]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(getMlModelDetailsPath(decodedMlModelFqn, activeKey));
    }
  };

  const followMlModel = async () => {
    if (isFollowing) {
      await unFollowMlModelHandler();
    } else {
      await followMlModelHandler();
    }
  };

  const onDescriptionEdit = () => setIsEdit(true);

  const onCancel = () => setIsEdit(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (mlModelDetail.description !== updatedHTML) {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        description: updatedHTML,
      };
      await descriptionUpdateHandler(updatedMlModelDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwner?: Mlmodel['owner']) => {
      const updatedMlModelDetails = {
        ...mlModelDetail,
        owner: newOwner
          ? {
              ...mlModelDetail.owner,
              ...newOwner,
            }
          : undefined,
      };
      await settingsUpdateHandler(updatedMlModelDetails);
    },
    [mlModelDetail, mlModelDetail.owner]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(mlModelDetail?.tags ?? [], newTier);
    const updatedMlModelDetails = {
      ...mlModelDetail,
      tags: tierTag,
    };

    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedMlModelDetails = {
      ...mlModelDetail,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedMlModelDetails);
  };

  const handleRestoreMlmodel = async () => {
    try {
      await restoreMlmodel(mlModelDetail.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.ml-model'),
        }),
        // Autoclose timer
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.ml-model'),
        })
      );
    }
  };

  const onFeaturesUpdate = async (features: Mlmodel['mlFeatures']) => {
    await updateMlModelFeatures({ ...mlModelDetail, mlFeatures: features });
  };

  const handleThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const handleThreadPanelClose = () => {
    setThreadLink('');
  };

  const getMlHyperParametersColumn: ColumnsType<MlHyperParameter> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
      },
    ],
    []
  );

  const mlModelStoreColumn = useMemo(() => {
    const column: ColumnsType<MlStore> = [
      {
        title: t('label.storage'),
        dataIndex: 'storage',
        key: 'storage',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
      {
        title: t('label.image-repository'),
        dataIndex: 'imageRepository',
        key: 'imageRepository',
        render: (value: string) => {
          return (
            <a href={value} rel="noreferrer" target="_blank">
              {value}
            </a>
          );
        },
      },
    ];

    return column;
  }, []);

  const getMlHyperParameters = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>
          {t('label.hyper-parameter-plural')}{' '}
        </Typography.Title>
        {isEmpty(mlModelDetail.mlHyperParameters) ? (
          getEmptyPlaceholder()
        ) : (
          <Table
            bordered
            columns={getMlHyperParametersColumn}
            data-testid="hyperparameters-table"
            dataSource={mlModelDetail.mlHyperParameters}
            pagination={false}
            rowKey="name"
            size="small"
          />
        )}
      </>
    );
  }, [mlModelDetail, getMlHyperParametersColumn]);

  const getMlModelStore = useMemo(() => {
    return (
      <>
        <Typography.Title level={5}>{t('label.model-store')}</Typography.Title>
        {mlModelDetail.mlStore ? (
          <Table
            bordered
            columns={mlModelStoreColumn}
            data-testid="model-store-table"
            dataSource={[mlModelDetail.mlStore]}
            id="model-store-table"
            pagination={false}
            rowKey="name"
            size="small"
          />
        ) : (
          getEmptyPlaceholder()
        )}
      </>
    );
  }, [mlModelDetail, mlModelStoreColumn]);

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && mlModelDetail) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedMlModel = { ...mlModelDetail, tags: updatedTags };
      await tagUpdateHandler(updatedMlModel);
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete : history.push('/'),
    []
  );

  const tabs = useMemo(
    () => [
      {
        name: t('label.feature-plural'),
        label: (
          <TabsLabel
            id={EntityTabs.FEATURES}
            name={t('label.feature-plural')}
          />
        ),
        key: EntityTabs.FEATURES,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <div className="d-flex flex-col gap-4">
                <DescriptionV1
                  description={mlModelDetail.description}
                  entityFqn={decodedMlModelFqn}
                  entityName={mlModelDetail.name}
                  entityType={EntityType.MLMODEL}
                  hasEditAccess={
                    mlModelPermissions.EditAll ||
                    mlModelPermissions.EditDescription
                  }
                  isEdit={isEdit}
                  isReadOnly={mlModelDetail.deleted}
                  owner={mlModelDetail.owner}
                  onCancel={onCancel}
                  onDescriptionEdit={onDescriptionEdit}
                  onDescriptionUpdate={onDescriptionUpdate}
                  onThreadLinkSelect={handleThreadLinkSelect}
                />
                <MlModelFeaturesList
                  entityFqn={decodedMlModelFqn}
                  handleFeaturesUpdate={onFeaturesUpdate}
                  isDeleted={mlModelDetail.deleted}
                  mlFeatures={mlModelDetail.mlFeatures}
                  permissions={mlModelPermissions}
                  onThreadLinkSelect={handleThreadLinkSelect}
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
                  entityFqn={decodedMlModelFqn}
                  entityType={EntityType.MLMODEL}
                  permission={
                    (mlModelPermissions.EditAll ||
                      mlModelPermissions.EditTags) &&
                    !mlModelDetail.deleted
                  }
                  selectedTags={mlModelTags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={handleThreadLinkSelect}
                />

                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={decodedMlModelFqn}
                  entityType={EntityType.MLMODEL}
                  permission={
                    (mlModelPermissions.EditAll ||
                      mlModelPermissions.EditTags) &&
                    !mlModelDetail.deleted
                  }
                  selectedTags={mlModelTags}
                  tagType={TagSource.Glossary}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={handleThreadLinkSelect}
                />
              </Space>
            </Col>
          </Row>
        ),
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
            entityType={EntityType.MLMODEL}
            fqn={mlModelDetail?.fullyQualifiedName ?? ''}
            onFeedUpdate={fetchEntityFeedCount}
            onUpdateEntityDetails={fetchMlModel}
          />
        ),
      },
      {
        label: (
          <TabsLabel id={EntityTabs.DETAILS} name={t('label.detail-plural')} />
        ),
        key: EntityTabs.DETAILS,
        children: (
          <Row className="p-md" gutter={[16, 16]}>
            <Col span={12}>{getMlHyperParameters}</Col>
            <Col span={12}>{getMlModelStore}</Col>
          </Row>
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <EntityLineageComponent
            entity={mlModelDetail}
            entityType={EntityType.MLMODEL}
            hasEditAccess={
              mlModelPermissions.EditAll || mlModelPermissions.EditLineage
            }
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
          <CustomPropertyTable
            entityType={EntityType.MLMODEL}
            handleExtensionUpdate={onExtensionUpdate}
            hasEditAccess={
              mlModelPermissions.EditAll || mlModelPermissions.EditCustomFields
            }
            hasPermission={mlModelPermissions.ViewAll}
          />
        ),
      },
    ],
    [
      feedCount,
      activeTab,
      mlModelDetail,
      mlModelPermissions,
      isEdit,
      getMlHyperParameters,
      getMlModelStore,
      onCancel,
      onExtensionUpdate,
      onFeaturesUpdate,
      handleThreadLinkSelect,
      onDescriptionUpdate,
      onDescriptionEdit,
      getEntityFieldThreadCounts,
    ]
  );

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateMlModelDetailsState}
            dataAsset={mlModelDetail}
            entityType={EntityType.MLMODEL}
            permissions={mlModelPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followMlModel}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreMlmodel}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab ?? EntityTabs.FEATURES}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>
      </Row>

      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateFeed}
          onCancel={handleThreadPanelClose}
        />
      ) : null}
    </PageLayoutV1>
  );
};

export default withActivityFeed<MlModelDetailProp>(MlModelDetail);
