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
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';

import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getEntityDetailsPath,
  getVersionPath,
  ROUTES,
} from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
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
import { Page } from '../../generated/system/ui/page';
import { PageType } from '../../generated/system/ui/uiCustomization';
import { Include } from '../../generated/type/include';
import { TagLabel } from '../../generated/type/tagLabel';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
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
import containerDetailsClassBase from '../../utils/ContainerDetailsClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getGlossaryTermDetailTabs,
  getTabLabelMap,
} from '../../utils/GlossaryTerm/GlossaryTermUtil';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
const ContainerPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { currentUser, selectedPersona } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { tab } = useParams<{ tab: EntityTabs }>();

  const { fqn: decodedContainerName } = useFqn();

  // Local states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChildrenLoading, setIsChildrenLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isEditDescription, setIsEditDescription] = useState<boolean>(false);
  const [customizedPage, setCustomizedPage] = useState<Page | null>(null);
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

  const fetchContainerChildren = async () => {
    setIsChildrenLoading(true);
    try {
      const { children } = await getContainerByName(decodedContainerName, {
        fields: TabSpecificField.CHILDREN,
      });
      setContainerChildrenData(children);
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

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && containerData) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedContainer = { ...containerData, tags: updatedTags };
      await handleTagUpdate(updatedContainer);
    }
  };

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMap(customizedPage?.tabs);

    if (!containerData) {
      return [];
    }

    const tabs = containerDetailsClassBase.getContainerDetailPageTabs({
      isDataModelEmpty,
      description: description ?? '',
      decodedContainerName,
      entityName,
      editDescriptionPermission,
      editTagsPermission,
      editGlossaryTermsPermission,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      containerChildrenData: containerChildrenData ?? [],
      fetchContainerChildren,
      isChildrenLoading: isChildrenLoading ?? false,
      feedCount: feedCount ?? { totalCount: 0 },
      getEntityFeedCount,
      handleFeedCount,
      tab,
      deleted: deleted ?? false,
      owners: owners ?? [],
      containerData,
      tags: tags ?? [],
      fetchContainerDetail,
      labelMap: tabLabelMap,
      onThreadLinkSelect,
      handleUpdateDescription,
      handleUpdateDataModel,
      handleTagSelection,
      handleExtensionUpdate,
    });

    return getGlossaryTermDetailTabs(
      tabs,
      customizedPage?.tabs,
      EntityTabs.CHILDREN
    );
  }, [
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
    customizedPage?.tabs,
  ]);

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

  const fetchDocument = useCallback(async () => {
    const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${selectedPersona.fullyQualifiedName}`;
    try {
      const doc = await getDocumentByFQN(pageFQN);
      setCustomizedPage(
        doc.data?.pages?.find((p: Page) => p.pageType === PageType.Container)
      );
    } catch (error) {
      // fail silent
    }
  }, [selectedPersona.fullyQualifiedName]);

  useEffect(() => {
    if (selectedPersona?.fullyQualifiedName) {
      fetchDocument();
    }
  }, [selectedPersona]);

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
