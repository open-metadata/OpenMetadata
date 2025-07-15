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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { CustomizeEntityType } from '../../constants/Customize.constants';
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
import { Tag } from '../../generated/entity/classification/tag';
import { Container } from '../../generated/entity/data/container';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/page';
import { Include } from '../../generated/type/include';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
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
} from '../../utils/CommonUtils';
import containerDetailsClassBase from '../../utils/ContainerDetailsClassBase';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { updateCertificationTag, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const ContainerPage = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const { customizedPage, isLoading: loading } = useCustomPages(
    PageType.Container
  );
  const { fqn: decodedContainerName } = useFqn();

  // Local states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [containerData, setContainerData] = useState<Container>();
  const [containerPermissions, setContainerPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [childrenCount, setChildrenCount] = useState<number>(0);

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
      setContainerData(response);
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

      const viewBasicPermission = getPrioritizedViewPermission(
        entityPermission,
        Operation.ViewBasic
      );

      if (viewBasicPermission) {
        await fetchContainerDetail(containerFQN);
        getEntityFeedCount();
      }
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch children count to show it in Tab label
  const fetchContainerChildren = useCallback(async () => {
    try {
      const { paging } = await getContainerChildrenByName(
        decodedContainerName,
        {
          limit: 0,
        }
      );
      setChildrenCount(paging.total);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [decodedContainerName]);

  const { deleted, version, isUserFollowing } = useMemo(() => {
    return {
      deleted: containerData?.deleted,
      version: containerData?.version,
      isUserFollowing: containerData?.followers?.some(
        ({ id }: { id: string }) => id === currentUser?.id
      ),
    };
  }, [containerData]);

  const {
    editCustomAttributePermission,
    editLineagePermission,
    viewBasicPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditTags
        ) && !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          containerPermissions,
          Operation.EditLineage
        ) && !deleted,
      viewBasicPermission: getPrioritizedViewPermission(
        containerPermissions,
        Operation.ViewBasic
      ),
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
      history.replace({
        pathname: getEntityDetailsPath(
          EntityType.CONTAINER,
          decodedContainerName,
          tabValue
        ),
      });
    }
  };

  const handleUpdateContainerData = useCallback(
    async (updatedData: Container) => {
      const jsonPatch = compare(
        omitBy(containerData, isUndefined),
        updatedData
      );

      return patchContainerDetails(containerData?.id ?? '', jsonPatch);
    },
    [containerData]
  );

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
    (isSoftDelete?: boolean) => !isSoftDelete && history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as Container;

    setContainerData((data) => ({
      ...(updatedData ?? data),
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
        })
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
        setContainerData(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [containerData, handleUpdateContainerData, setContainerData]
  );

  const versionHandler = () =>
    history.push(
      getVersionPath(
        EntityType.CONTAINER,
        decodedContainerName,
        toString(version)
      )
    );

  const handleContainerUpdate = async (updatedData: Container) => {
    try {
      const updatedContainer = await handleUpdateContainerData(updatedData);
      setContainerData((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, ...updatedContainer };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onContainerUpdateCertification = async (
    updatedContainer: Container,
    key?: keyof Container
  ) => {
    try {
      const response = await handleUpdateContainerData(updatedContainer);
      setContainerData((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          version: response.version,
          ...(key ? { [key]: response[key] } : response),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = containerDetailsClassBase.getContainerDetailPageTabs({
      isDataModelEmpty,
      decodedContainerName,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      feedCount: feedCount ?? { totalCount: 0 },
      getEntityFeedCount,
      handleFeedCount,
      tab,
      deleted: deleted ?? false,
      containerData,
      fetchContainerDetail,
      labelMap: tabLabelMap,
      childrenCount,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      isDataModelEmpty ? EntityTabs.CHILDREN : EntityTabs.SCHEMA
    );
  }, [
    isDataModelEmpty,
    containerData,
    decodedContainerName,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    deleted,
    feedCount.totalCount,
    handleFeedCount,
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

  // Effects
  useEffect(() => {
    fetchResourcePermission(decodedContainerName);
    fetchContainerChildren();
  }, [decodedContainerName]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], tab, PageType.Container),
    [tabs[0], tab]
  );

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (containerData) {
        const certificationTag: Container['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...containerData,
          certification: certificationTag,
        };

        await onContainerUpdateCertification(
          updatedTableDetails,
          'certification'
        );
      }
    },
    [containerData, handleContainerUpdate]
  );
  // Rendering
  if (isLoading || loading) {
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
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.container'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!containerData) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.container'),
      })}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={containerData}
            entityType={EntityType.CONTAINER}
            openTaskCount={feedCount.openTaskCount}
            permissions={containerPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={handleFollowContainer}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreContainer}
            onTierUpdate={handleUpdateTier}
            onUpdateVote={updateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Container>
          customizedPage={customizedPage}
          data={containerData}
          isTabExpanded={isTabExpanded}
          permissions={containerPermissions}
          type={EntityType.CONTAINER as CustomizeEntityType}
          onUpdate={handleContainerUpdate}>
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={tab}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
              tabBarExtraContent={
                isExpandViewSupported && (
                  <AlignRightIconButton
                    className={isTabExpanded ? 'rotate-180' : ''}
                    title={
                      isTabExpanded ? t('label.collapse') : t('label.expand')
                    }
                    onClick={toggleTabExpanded}
                  />
                )
              }
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>

        <LimitWrapper resource="container">
          <></>
        </LimitWrapper>
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed(ContainerPage);
