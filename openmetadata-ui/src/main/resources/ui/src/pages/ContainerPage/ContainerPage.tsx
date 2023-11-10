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
import { Col, Row, Space, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, omitBy, toString } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { useAuthContext } from '../../components/Auth/AuthProviders/AuthProvider';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ContainerChildren from '../../components/ContainerDetail/ContainerChildren/ContainerChildren';
import ContainerDataModel from '../../components/ContainerDetail/ContainerDataModel/ContainerDataModel';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import DataProductsContainer from '../../components/DataProductsContainer/DataProductsContainer.component';
import EntityLineageComponent from '../../components/Entity/EntityLineage/EntityLineage.component';
import Loader from '../../components/Loader/Loader';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import {
  getContainerDetailPath,
  getVersionPath,
} from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import { Container } from '../../generated/entity/data/container';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Include } from '../../generated/type/include';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { postThread } from '../../rest/feedsAPI';
import {
  addContainerFollower,
  getContainerByName,
  patchContainerDetails,
  removeContainerFollower,
  restoreContainer,
  updateContainerVotes,
} from '../../rest/storageAPI';
import {
  addToRecentViewed,
  getEntityMissingError,
  getFeedCounts,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const ContainerPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { fqn: containerName, tab } =
    useParams<{ fqn: string; tab: EntityTabs }>();

  // Local states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isChildrenLoading, setIsChildrenLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);

  const [containerData, setContainerData] = useState<Container>();
  const [containerChildrenData, setContainerChildrenData] = useState<
    Container['children']
  >([]);
  const [containerPermissions, setContainerPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [feedCount, setFeedCount] = useState<number>(0);

  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const decodedContainerName = useMemo(
    () => getDecodedFqn(containerName),
    [containerName]
  );

  const fetchContainerDetail = async (containerFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getContainerByName(
        containerFQN,
        'parent,dataModel,owner,tags,followers,extension,domain,dataProducts,votes',
        Include.All
      );
      addToRecentViewed({
        displayName: getEntityName(response),
        entityType: EntityType.CONTAINER,
        fqn: response.fullyQualifiedName ?? '',
        serviceType: response.serviceType,
        timestamp: 0,
        id: response.id,
      });
      setContainerData({
        ...response,
        tags: sortTagsCaseInsensitive(response.tags || []),
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContainerChildren = async () => {
    setIsChildrenLoading(true);
    try {
      const { children } = await getContainerByName(containerName, 'children');
      setContainerChildrenData(children);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsChildrenLoading(false);
    }
  };

  const fetchResourcePermission = async (containerFQN: string) => {
    setIsLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CONTAINER,
        containerFQN
      );
      setContainerPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const {
    hasViewPermission,
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditCustomFieldsPermission,
    hasEditLineagePermission,
  } = useMemo(() => {
    return {
      hasViewPermission:
        containerPermissions.ViewAll || containerPermissions.ViewBasic,
      hasEditDescriptionPermission:
        containerPermissions.EditAll || containerPermissions.EditDescription,
      hasEditTagsPermission:
        containerPermissions.EditAll || containerPermissions.EditTags,
      hasEditCustomFieldsPermission:
        containerPermissions.EditAll || containerPermissions.EditCustomFields,
      hasEditLineagePermission:
        containerPermissions.EditAll || containerPermissions.EditLineage,
    };
  }, [containerPermissions]);

  const {
    deleted,
    owner,
    description,
    version,
    entityName,
    isUserFollowing,
    tags,
    tier,
  } = useMemo(() => {
    return {
      deleted: containerData?.deleted,
      owner: containerData?.owner,
      description: containerData?.description,
      version: containerData?.version,
      tier: getTierTags(containerData?.tags ?? []),
      tags: getTagsWithoutTier(containerData?.tags ?? []),
      entityId: containerData?.id,
      entityName: getEntityName(containerData),
      isUserFollowing: containerData?.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
      followers: containerData?.followers ?? [],
      size: containerData?.size || 0,
      numberOfObjects: containerData?.numberOfObjects || 0,
      partitioned: containerData?.dataModel?.isPartitioned,
      entityFqn: containerData?.fullyQualifiedName ?? '',
    };
  }, [containerData, currentUser]);

  const isDataModelEmpty = useMemo(
    () => isEmpty(containerData?.dataModel),
    [containerData]
  );

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.CONTAINER, decodedContainerName, setFeedCount);

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getContainerDetailPath(decodedContainerName, tabValue),
      });
    }
  };

  const handleUpdateContainerData = (updatedData: Container) => {
    const jsonPatch = compare(omitBy(containerData, isUndefined), updatedData);

    return patchContainerDetails(containerData?.id ?? '', jsonPatch);
  };

  const handleUpdateDescription = async (updatedDescription: string) => {
    try {
      const { description: newDescription, version } =
        await handleUpdateContainerData({
          ...(containerData as Container),
          description: updatedDescription,
        });

      setContainerData((prev) => ({
        ...(prev as Container),
        description: newDescription,
        version,
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEditDescription(false);
    }
  };
  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(containerData)) {
      return;
    }
    try {
      const { displayName, version } = await handleUpdateContainerData({
        ...containerData,
        displayName: data.displayName,
      });

      setContainerData((prev) => {
        if (isUndefined(prev)) {
          return;
        }

        return {
          ...prev,
          displayName,
          version,
        };
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleFollowContainer = async () => {
    const followerId = currentUser?.id ?? '';
    const containerId = containerData?.id ?? '';
    try {
      if (isUserFollowing) {
        const response = await removeContainerFollower(containerId, followerId);
        const { oldValue } = response.changeDescription.fieldsDeleted[0];

        setContainerData((prev) => ({
          ...(prev as Container),
          followers: (containerData?.followers || []).filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      } else {
        const response = await addContainerFollower(containerId, followerId);
        const { newValue } = response.changeDescription.fieldsAdded[0];

        setContainerData((prev) => ({
          ...(prev as Container),
          followers: [...(containerData?.followers ?? []), ...newValue],
        }));
      }
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: Container['owner']) => {
      try {
        const { owner: newOwner, version } = await handleUpdateContainerData({
          ...(containerData as Container),
          owner: updatedOwner ? updatedOwner : undefined,
        });

        setContainerData((prev) => ({
          ...(prev as Container),
          owner: newOwner,
          version,
        }));
        getEntityFeedCount();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, containerData?.owner]
  );

  const handleUpdateTier = async (updatedTier?: Tag) => {
    try {
      const tierTag = updateTierTag(containerData?.tags ?? [], updatedTier);
      const { tags: newTags, version } = await handleUpdateContainerData({
        ...(containerData as Container),
        tags: tierTag,
      });

      setContainerData((prev) => ({
        ...(prev as Container),
        tags: newTags,
        version,
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleToggleDelete = () => {
    setContainerData((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete : history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as Container;

    setContainerData((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  const handleRestoreContainer = async () => {
    try {
      await restoreContainer(containerData?.id ?? '');
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.container'),
        }),
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.container'),
        })
      );
    }
  };

  const handleExtensionUpdate = async (updatedContainer: Container) => {
    try {
      const response = await handleUpdateContainerData(updatedContainer);
      setContainerData({
        ...response,
        tags: sortTagsCaseInsensitive(response.tags ?? []),
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateDataModel = async (
    updatedDataModel: Container['dataModel']
  ) => {
    try {
      const { dataModel: newDataModel, version } =
        await handleUpdateContainerData({
          ...(containerData as Container),
          dataModel: updatedDataModel,
        });

      setContainerData((prev) => ({
        ...(prev as Container),
        dataModel: newDataModel,
        version,
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const versionHandler = () =>
    history.push(
      getVersionPath(EntityType.CONTAINER, containerName, toString(version))
    );

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && containerData) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedContainer = { ...containerData, tags: updatedTags };
      await handleExtensionUpdate(updatedContainer);
    }
  };

  const tabs = useMemo(
    () => [
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
            <Col className="p-t-sm m-x-lg" flex="auto">
              <div className="d-flex flex-col gap-4">
                <DescriptionV1
                  description={description}
                  entityFqn={decodedContainerName}
                  entityName={entityName}
                  entityType={EntityType.CONTAINER}
                  hasEditAccess={hasEditDescriptionPermission}
                  isEdit={isEditDescription}
                  isReadOnly={deleted}
                  owner={owner}
                  onCancel={() => setIsEditDescription(false)}
                  onDescriptionEdit={() => setIsEditDescription(true)}
                  onDescriptionUpdate={handleUpdateDescription}
                  onThreadLinkSelect={onThreadLinkSelect}
                />

                {isDataModelEmpty ? (
                  <ContainerChildren
                    childrenList={containerChildrenData}
                    fetchChildren={fetchContainerChildren}
                    isLoading={isChildrenLoading}
                  />
                ) : (
                  <ContainerDataModel
                    dataModel={containerData?.dataModel}
                    entityFqn={decodedContainerName}
                    hasDescriptionEditAccess={hasEditDescriptionPermission}
                    hasTagEditAccess={hasEditTagsPermission}
                    isReadOnly={Boolean(deleted)}
                    onThreadLinkSelect={onThreadLinkSelect}
                    onUpdate={handleUpdateDataModel}
                  />
                )}
              </div>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  activeDomain={containerData?.domain}
                  dataProducts={containerData?.dataProducts ?? []}
                  hasPermission={false}
                />
                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={decodedContainerName}
                  entityType={EntityType.CONTAINER}
                  permission={
                    hasEditDescriptionPermission && !containerData?.deleted
                  }
                  selectedTags={tags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={decodedContainerName}
                  entityType={EntityType.CONTAINER}
                  permission={
                    hasEditDescriptionPermission && !containerData?.deleted
                  }
                  selectedTags={tags}
                  tagType={TagSource.Glossary}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
              </Space>
            </Col>
          </Row>
        ),
      },
      ...(isDataModelEmpty
        ? []
        : [
            {
              label: (
                <TabsLabel
                  id={EntityTabs.CHILDREN}
                  name={t('label.children')}
                />
              ),
              key: EntityTabs.CHILDREN,
              children: (
                <Row className="p-md" gutter={[0, 16]}>
                  <Col span={24}>
                    <ContainerChildren
                      childrenList={containerChildrenData}
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
            count={feedCount}
            id={EntityTabs.ACTIVITY_FEED}
            isActive={tab === EntityTabs.ACTIVITY_FEED}
            name={t('label.activity-feed-and-task-plural')}
          />
        ),
        key: EntityTabs.ACTIVITY_FEED,
        children: (
          <ActivityFeedTab
            entityType={EntityType.CONTAINER}
            fqn={decodedContainerName}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={() => fetchContainerDetail(containerName)}
          />
        ),
      },
      {
        label: <TabsLabel id={EntityTabs.LINEAGE} name={t('label.lineage')} />,
        key: EntityTabs.LINEAGE,
        children: (
          <EntityLineageComponent
            entity={containerData}
            entityType={EntityType.CONTAINER}
            hasEditAccess={hasEditLineagePermission}
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
            entityType={EntityType.CONTAINER}
            handleExtensionUpdate={handleExtensionUpdate}
            hasEditAccess={hasEditCustomFieldsPermission}
            hasPermission={containerPermissions.ViewAll}
          />
        ),
      },
    ],
    [
      isDataModelEmpty,
      containerData,
      description,
      containerName,
      decodedContainerName,
      entityName,
      hasEditDescriptionPermission,
      hasEditTagsPermission,
      isEditDescription,
      hasEditLineagePermission,
      hasEditCustomFieldsPermission,
      deleted,
      owner,
      isChildrenLoading,
      tags,
      feedCount,
      containerChildrenData,
      handleUpdateDataModel,
      handleUpdateDescription,
      getEntityFieldThreadCounts,
      handleTagSelection,
      onThreadLinkSelect,
      handleExtensionUpdate,
    ]
  );

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateContainerVotes(id, data);
      const details = await getContainerByName(
        containerName,
        'parent,dataModel,owner,tags,followers,extension,votes'
      );
      setContainerData(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Effects
  useEffect(() => {
    if (hasViewPermission) {
      fetchContainerDetail(containerName);
    }
  }, [containerName, hasViewPermission]);

  useEffect(() => {
    fetchResourcePermission(containerName);
  }, [containerName]);

  useEffect(() => {
    if (hasViewPermission) {
      getEntityFeedCount();
    }
  }, [containerName, hasViewPermission]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.container'), containerName)}
      </ErrorPlaceHolder>
    );
  }

  if (!hasViewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (!containerData) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="Table details"
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={containerData}
            entityType={EntityType.CONTAINER}
            permissions={containerPermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowContainer}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreContainer}
            onTierUpdate={handleUpdateTier}
            onUpdateVote={updateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={
              tab ??
              (isDataModelEmpty ? EntityTabs.CHILDREN : EntityTabs.SCHEMA)
            }
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>

        {threadLink ? (
          <ActivityThreadPanel
            createThread={createThread}
            deletePostHandler={deleteFeed}
            open={Boolean(threadLink)}
            postFeedHandler={postFeed}
            threadLink={threadLink}
            threadType={threadType}
            updateThreadHandler={updateFeed}
            onCancel={onThreadPanelClose}
          />
        ) : null}
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed(ContainerPage);
