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
import { Col, Row, Tabs } from 'antd';
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

import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import ContainerChildren from '../../components/Container/ContainerChildren/ContainerChildren';
import ContainerDataModel from '../../components/Container/ContainerDataModel/ContainerDataModel';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import EntityRightPanel from '../../components/Entity/EntityRightPanel/EntityRightPanel';
import Lineage from '../../components/Lineage/Lineage.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import {
  getEntityDetailsPath,
  getVersionPath,
  ROUTES,
} from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../constants/ResizablePanel.constants';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import { Container } from '../../generated/entity/data/container';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import LimitWrapper from '../../hoc/LimitWrapper';
import { usePaging } from '../../hooks/paging/usePaging';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import { postThread } from '../../rest/feedsAPI';
import {
  addContainerFollower,
  getContainerByName,
  getContainerChildrenByName,
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
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const ContainerPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { tab } = useParams<{ tab: EntityTabs }>();

  const { fqn: decodedContainerName } = useFqn();

  // Local states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChildrenLoading, setIsChildrenLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);

  const [containerData, setContainerData] = useState<Container>();
  const [containerChildrenData, setContainerChildrenData] = useState<
    Container['children']
  >([]);
  const [containerPermissions, setContainerPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );

  const {
    paging,
    pageSize,
    currentPage,
    showPagination,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging();

  const fetchContainerDetail = async (containerFQN: string) => {
    setIsLoading(true);
    try {
      const response = await getContainerByName(containerFQN, {
        fields: [
          TabSpecificField.PARENT,
          TabSpecificField.DATAMODEL,
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.EXTENSION,
          TabSpecificField.DOMAIN,
          TabSpecificField.DATA_PRODUCTS,
          TabSpecificField.VOTES,
        ],
        include: Include.All,
      });
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
        tags: sortTagsCaseInsensitive(response.tags ?? []),
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setHasError(true);
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        history.replace(ROUTES.FORBIDDEN);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContainerChildren = async (pagingOffset?: Paging) => {
    setIsChildrenLoading(true);
    try {
      const { data, paging } = await getContainerChildrenByName(
        decodedContainerName,
        {
          limit: pageSize,
          offset: pagingOffset?.offset ?? 0,
        }
      );
      setContainerChildrenData(data);
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsChildrenLoading(false);
    }
  };

  const handleFeedCount = useCallback(
    (data: FeedCounts) => setFeedCount(data),
    []
  );

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.CONTAINER, decodedContainerName, handleFeedCount);

  const fetchResourcePermission = async (containerFQN: string) => {
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.CONTAINER,
        containerFQN
      );
      setContainerPermissions(entityPermission);

      const viewBasicPermission =
        entityPermission.ViewAll || entityPermission.ViewBasic;

      if (viewBasicPermission) {
        await fetchContainerDetail(containerFQN);
        getEntityFeedCount();
      }
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
    deleted,
    owners,
    description,
    version,
    entityName,
    isUserFollowing,
    tags,
    tier,
  } = useMemo(() => {
    return {
      deleted: containerData?.deleted,
      owners: containerData?.owners,
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
      size: containerData?.size ?? 0,
      numberOfObjects: containerData?.numberOfObjects ?? 0,
      partitioned: containerData?.dataModel?.isPartitioned,
      entityFqn: containerData?.fullyQualifiedName ?? '',
    };
  }, [containerData, currentUser]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    viewBasicPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (containerPermissions.EditTags || containerPermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (containerPermissions.EditGlossaryTerms ||
          containerPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (containerPermissions.EditDescription ||
          containerPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (containerPermissions.EditAll ||
          containerPermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (containerPermissions.EditAll || containerPermissions.EditLineage) &&
        !deleted,
      viewBasicPermission:
        containerPermissions.ViewAll || containerPermissions.ViewBasic,
      viewAllPermission: containerPermissions.ViewAll,
    }),
    [containerPermissions, deleted]
  );

  const isDataModelEmpty = useMemo(
    () => isEmpty(containerData?.dataModel),
    [containerData]
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.push({
        pathname: getEntityDetailsPath(
          EntityType.CONTAINER,
          decodedContainerName,
          tabValue
        ),
      });
    }
  };

  const handleUpdateContainerData = useCallback(
    (updatedData: Container) => {
      const jsonPatch = compare(
        omitBy(containerData, isUndefined),
        updatedData
      );

      return patchContainerDetails(containerData?.id ?? '', jsonPatch);
    },
    [containerData]
  );

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
          followers: (containerData?.followers ?? []).filter(
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
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleUpdateOwner = useCallback(
    async (updatedOwner?: Container['owners']) => {
      try {
        const { owners: newOwner, version } = await handleUpdateContainerData({
          ...(containerData as Container),
          owners: updatedOwner,
        });

        setContainerData((prev) => ({
          ...(prev as Container),
          owners: newOwner,
          version,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, containerData?.owners]
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
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleToggleDelete = (version?: number) => {
    setContainerData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
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
      const { version: newVersion } = await restoreContainer(
        containerData?.id ?? ''
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.container'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.container'),
        })
      );
    }
  };

  const handleTagUpdate = useCallback(
    async (updatedContainer: Container) => {
      if (isUndefined(containerData)) {
        return;
      }

      try {
        const response = await handleUpdateContainerData({
          ...containerData,
          tags: updatedContainer.tags,
        });
        setContainerData({
          ...response,
          tags: sortTagsCaseInsensitive(response.tags ?? []),
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, handleUpdateContainerData, setContainerData]
  );

  const handleExtensionUpdate = useCallback(
    async (updatedContainer: Container) => {
      if (isUndefined(containerData)) {
        return;
      }

      try {
        const response = await handleUpdateContainerData({
          ...containerData,
          extension: updatedContainer.extension,
        });
        setContainerData({
          ...response,
          tags: sortTagsCaseInsensitive(response.tags ?? []),
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, handleUpdateContainerData, setContainerData]
  );

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
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const versionHandler = () =>
    history.push(
      getVersionPath(
        EntityType.CONTAINER,
        decodedContainerName,
        toString(version)
      )
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
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const handleChildrenPageChange = ({ currentPage }: PagingHandlerParams) => {
    handlePageChange(currentPage);
    fetchContainerChildren({
      offset: (currentPage - 1) * pageSize,
    } as Paging);
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && containerData) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedContainer = { ...containerData, tags: updatedTags };
      await handleTagUpdate(updatedContainer);
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
            <Col className="tab-content-height-with-resizable-panel" span={24}>
              <ResizablePanels
                firstPanel={{
                  className: 'entity-resizable-panel-container',
                  children: (
                    <div className="d-flex flex-col gap-4 p-t-sm m-x-lg">
                      <DescriptionV1
                        description={description}
                        entityFqn={decodedContainerName}
                        entityName={entityName}
                        entityType={EntityType.CONTAINER}
                        hasEditAccess={editDescriptionPermission}
                        isDescriptionExpanded={isEmpty(containerChildrenData)}
                        isEdit={isEditDescription}
                        owner={owners}
                        showActions={!deleted}
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
                          pagingHookData={{
                            paging,
                            pageSize,
                            currentPage,
                            showPagination,
                            handleChildrenPageChange,
                            handlePageSizeChange,
                          }}
                        />
                      ) : (
                        <ContainerDataModel
                          dataModel={containerData?.dataModel}
                          entityFqn={decodedContainerName}
                          hasDescriptionEditAccess={editDescriptionPermission}
                          hasGlossaryTermEditAccess={
                            editGlossaryTermsPermission
                          }
                          hasTagEditAccess={editTagsPermission}
                          isReadOnly={Boolean(deleted)}
                          onThreadLinkSelect={onThreadLinkSelect}
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
                        customProperties={containerData}
                        dataProducts={containerData?.dataProducts ?? []}
                        domain={containerData?.domain}
                        editCustomAttributePermission={
                          editCustomAttributePermission
                        }
                        editGlossaryTermsPermission={
                          editGlossaryTermsPermission
                        }
                        editTagPermission={
                          editTagsPermission && !containerData?.deleted
                        }
                        entityFQN={decodedContainerName}
                        entityId={containerData?.id ?? ''}
                        entityType={EntityType.CONTAINER}
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
                      pagingHookData={{
                        paging,
                        pageSize,
                        currentPage,
                        showPagination,
                        handleChildrenPageChange,
                        handlePageSizeChange,
                      }}
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
            fqn={decodedContainerName}
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
              entityDetails={containerData}
              entityType={EntityType.CONTAINER}
              handleExtensionUpdate={handleExtensionUpdate}
              hasEditAccess={editCustomAttributePermission}
              hasPermission={viewAllPermission}
            />
          </div>
        ),
      },
    ],
    [
      isDataModelEmpty,
      containerData,
      description,
      decodedContainerName,
      decodedContainerName,
      entityName,
      editDescriptionPermission,
      editTagsPermission,
      editGlossaryTermsPermission,
      isEditDescription,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      deleted,
      owners,
      isChildrenLoading,
      tags,
      feedCount.totalCount,
      containerChildrenData,
      handleFeedCount,
      handleUpdateDataModel,
      handleUpdateDescription,
      handleTagSelection,
      onThreadLinkSelect,
      handleExtensionUpdate,
    ]
  );

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateContainerVotes(id, data);

      const details = await getContainerByName(decodedContainerName, {
        fields: [
          TabSpecificField.PARENT,
          TabSpecificField.DATAMODEL,
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.EXTENSION,
          TabSpecificField.VOTES,
        ],
      });

      setContainerData(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Effects
  useEffect(() => {
    fetchResourcePermission(decodedContainerName);
  }, [decodedContainerName]);

  // Rendering
  if (isLoading) {
    return <Loader />;
  }

  if (hasError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError(t('label.container'), decodedContainerName)}
      </ErrorPlaceHolder>
    );
  }

  if (!viewBasicPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (!containerData) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.container'),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={containerData}
            entityType={EntityType.CONTAINER}
            openTaskCount={feedCount.openTaskCount}
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

        <LimitWrapper resource="container">
          <></>
        </LimitWrapper>

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
