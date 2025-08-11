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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../../generated/entity/data/storedProcedure';
import { PageType } from '../../generated/system/ui/page';
import { Include } from '../../generated/type/include';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  addStoredProceduresFollower,
  getStoredProceduresByFqn,
  patchStoredProceduresDetails,
  removeStoredProceduresFollower,
  restoreStoredProcedures,
  updateStoredProcedureVotes,
} from '../../rest/storedProceduresAPI';
import { addToRecentViewed, getFeedCounts } from '../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import {
  getStoredProcedureDetailsPageTabs,
  STORED_PROCEDURE_DEFAULT_FIELDS,
} from '../../utils/StoredProceduresUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { updateCertificationTag, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const StoredProcedurePage = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const USER_ID = currentUser?.id ?? '';
  const navigate = useNavigate();
  const { tab: activeTab = EntityTabs.CODE } =
    useRequiredParams<{ tab: EntityTabs }>();

  const { fqn: decodedStoredProcedureFQN } = useFqn();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [storedProcedure, setStoredProcedure] = useState<StoredProcedure>();
  const [storedProcedurePermissions, setStoredProcedurePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const { customizedPage, isLoading: loading } = useCustomPages(
    PageType.StoredProcedure
  );
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const {
    id: storedProcedureId = '',
    followers,
    owners,
    tags,
    version,
    code,
    deleted,
    entityName,
    entityFQN,
  } = useMemo(() => {
    return {
      ...storedProcedure,
      tier: getTierTags(storedProcedure?.tags ?? []),
      tags: getTagsWithoutTier(storedProcedure?.tags ?? []),
      entityName: getEntityName(storedProcedure),
      entityFQN: storedProcedure?.fullyQualifiedName ?? '',
      code:
        (storedProcedure?.storedProcedureCode as StoredProcedureCodeObject)
          ?.code ?? '',
    };
  }, [storedProcedure]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USER_ID),
    };
  }, [followers, USER_ID]);

  const fetchResourcePermission = useCallback(async () => {
    try {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.STORED_PROCEDURE,
        decodedStoredProcedureFQN
      );

      setStoredProcedurePermissions(permission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [getEntityPermissionByFqn]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.STORED_PROCEDURE,
      decodedStoredProcedureFQN,
      handleFeedCount
    );
  };

  const fetchStoredProcedureDetails = async () => {
    setIsLoading(true);
    try {
      const response = await getStoredProceduresByFqn(
        decodedStoredProcedureFQN,
        {
          fields: STORED_PROCEDURE_DEFAULT_FIELDS,
          include: Include.All,
        }
      );

      setStoredProcedure(response);

      addToRecentViewed({
        displayName: getEntityName(response),
        entityType: EntityType.STORED_PROCEDURE,
        fqn: response.fullyQualifiedName ?? '',
        serviceType: response.serviceType,
        timestamp: 0,
        id: response.id ?? '',
      });
    } catch (error) {
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const versionHandler = useCallback(() => {
    version &&
      navigate(
        getVersionPath(
          EntityType.STORED_PROCEDURE,
          decodedStoredProcedureFQN,
          version + ''
        )
      );
  }, [decodedStoredProcedureFQN, version]);

  const saveUpdatedStoredProceduresData = useCallback(
    (updatedData: StoredProcedure) => {
      if (!storedProcedure) {
        return updatedData;
      }
      const jsonPatch = compare(storedProcedure ?? '', updatedData);

      return patchStoredProceduresDetails(storedProcedureId ?? '', jsonPatch);
    },
    [storedProcedure, storedProcedureId]
  );

  const handleStoreProcedureUpdate = async (
    updatedData: StoredProcedure,
    key?: keyof StoredProcedure
  ) => {
    try {
      const res = await saveUpdatedStoredProceduresData(updatedData);

      setStoredProcedure((previous) => {
        if (!previous) {
          return;
        }

        return {
          ...previous,
          ...res,
          ...(key && { [key]: res[key] }),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followEntity = useCallback(async () => {
    try {
      const res = await addStoredProceduresFollower(storedProcedureId, USER_ID);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setStoredProcedure((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(storedProcedure),
        })
      );
    }
  }, [USER_ID, followers, storedProcedure, storedProcedureId]);

  const unFollowEntity = useCallback(async () => {
    try {
      const res = await removeStoredProceduresFollower(
        storedProcedureId,
        USER_ID
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setStoredProcedure((pre) => {
        if (!pre) {
          return pre;
        }

        return {
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(storedProcedure),
        })
      );
    }
  }, [USER_ID, storedProcedureId]);

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!storedProcedure) {
      return;
    }
    const updatedData = { ...storedProcedure, displayName: data.displayName };
    await handleStoreProcedureUpdate(updatedData, 'displayName');
  };

  const handleFollow = useCallback(async () => {
    isFollowing ? await unFollowEntity() : await followEntity();
  }, [isFollowing]);

  const handleUpdateOwner = useCallback(
    async (newOwner?: StoredProcedure['owners']) => {
      if (!storedProcedure) {
        return;
      }
      const updatedEntityDetails = {
        ...storedProcedure,
        owners: newOwner,
      };
      await handleStoreProcedureUpdate(updatedEntityDetails, 'owners');
    },
    [owners, storedProcedure]
  );

  const handleToggleDelete = (version?: number) => {
    setStoredProcedure((prev) => {
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

  const handleRestoreStoredProcedures = async () => {
    try {
      const { version: newVersion } = await restoreStoredProcedures(
        storedProcedureId
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.stored-procedure-plural'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.stored-procedure-plural'),
        })
      );
    }
  };

  const onTierUpdate = useCallback(
    async (newTier?: Tag) => {
      if (storedProcedure) {
        const tierTag: StoredProcedure['tags'] = updateTierTag(tags, newTier);
        const updatedDetails = {
          ...storedProcedure,
          tags: tierTag,
        };

        await handleStoreProcedureUpdate(updatedDetails, 'tags');
      }
    },
    [storedProcedure, tags]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    [navigate]
  );

  const afterDomainUpdateAction = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as StoredProcedure;

    setStoredProcedure((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

  const handleTabChange = (activeKey: EntityTabs) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(
          EntityType.STORED_PROCEDURE,
          decodedStoredProcedureFQN,
          activeKey
        )
      );
    }
  };

  const onExtensionUpdate = useCallback(
    async (updatedData: StoredProcedure) => {
      if (storedProcedure) {
        const response = await saveUpdatedStoredProceduresData({
          ...storedProcedure,
          extension: updatedData.extension,
        });
        setStoredProcedure((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            extension: response.extension,
          };
        });
      }
    },
    [saveUpdatedStoredProceduresData, storedProcedure]
  );

  const {
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
    viewBasicPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (storedProcedurePermissions.EditTags ||
          storedProcedurePermissions.EditAll) &&
        !storedProcedure?.deleted,
      editGlossaryTermsPermission:
        (storedProcedurePermissions.EditGlossaryTerms ||
          storedProcedurePermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (storedProcedurePermissions.EditDescription ||
          storedProcedurePermissions.EditAll) &&
        !storedProcedure?.deleted,
      editCustomAttributePermission:
        (storedProcedurePermissions.EditAll ||
          storedProcedurePermissions.EditCustomFields) &&
        !storedProcedure?.deleted,
      editLineagePermission:
        (storedProcedurePermissions.EditAll ||
          storedProcedurePermissions.EditLineage) &&
        !storedProcedure?.deleted,
      viewAllPermission: storedProcedurePermissions.ViewAll,
      viewBasicPermission:
        storedProcedurePermissions.ViewAll ||
        storedProcedurePermissions.ViewBasic,
    }),
    [storedProcedurePermissions, storedProcedure]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = getStoredProcedureDetailsPageTabs({
      activeTab,
      feedCount,
      decodedStoredProcedureFQN,
      entityName,
      code,
      deleted: deleted ?? false,
      owners: owners ?? [],
      storedProcedure: storedProcedure as StoredProcedure,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      onExtensionUpdate,
      getEntityFeedCount: getEntityFeedCount,
      fetchStoredProcedureDetails,
      handleFeedCount: handleFeedCount,
      labelMap: tabLabelMap,
    });

    const updatedTabs = getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.CODE
    );

    return updatedTabs;
  }, [
    code,
    deleted,
    feedCount.totalCount,
    activeTab,
    entityFQN,
    entityName,
    storedProcedure,
    decodedStoredProcedureFQN,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    onExtensionUpdate,
    getEntityFeedCount,
    fetchStoredProcedureDetails,
    handleFeedCount,
  ]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () =>
      checkIfExpandViewSupported(tabs[0], activeTab, PageType.StoredProcedure),
    [tabs[0], activeTab]
  );

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateStoredProcedureVotes(id, data);
      const details = await getStoredProceduresByFqn(
        decodedStoredProcedureFQN,
        {
          fields: STORED_PROCEDURE_DEFAULT_FIELDS,
        }
      );
      setStoredProcedure(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (storedProcedure) {
        const certificationTag: StoredProcedure['certification'] =
          updateCertificationTag(newCertification);
        const updatedStoredProcedureDetails = {
          ...storedProcedure,
          certification: certificationTag,
        };

        await handleStoreProcedureUpdate(
          updatedStoredProcedureDetails,
          'certification'
        );
      }
    },
    [storedProcedure, handleStoreProcedureUpdate]
  );
  useEffect(() => {
    if (decodedStoredProcedureFQN) {
      fetchResourcePermission();
    }
  }, [decodedStoredProcedureFQN]);

  useEffect(() => {
    if (viewBasicPermission) {
      fetchStoredProcedureDetails();
      getEntityFeedCount();
    }
  }, [decodedStoredProcedureFQN, storedProcedurePermissions]);

  if (isLoading || loading) {
    return <Loader />;
  }

  if (!viewBasicPermission) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.stored-procedure'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (!storedProcedure) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.stored-procedure'),
      })}>
      <Row gutter={[0, 12]}>
        <Col data-testid="entity-page-header" span={24}>
          <DataAssetsHeader
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={afterDomainUpdateAction}
            dataAsset={storedProcedure}
            entityType={EntityType.STORED_PROCEDURE}
            openTaskCount={feedCount.openTaskCount}
            permissions={storedProcedurePermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleDisplayNameUpdate}
            onFollowClick={handleFollow}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreStoredProcedures}
            onTierUpdate={onTierUpdate}
            onUpdateVote={updateVote}
            onVersionClick={versionHandler}
          />
        </Col>

        <GenericProvider<StoredProcedure>
          customizedPage={customizedPage}
          data={storedProcedure}
          isTabExpanded={isTabExpanded}
          permissions={storedProcedurePermissions}
          type={EntityType.STORED_PROCEDURE}
          onUpdate={handleStoreProcedureUpdate}>
          {/* Entity Tabs */}
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={activeTab}
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
              onChange={(activeKey: string) =>
                handleTabChange(activeKey as EntityTabs)
              }
            />
          </Col>
        </GenericProvider>

        <LimitWrapper resource="storedProcedure">
          <></>
        </LimitWrapper>
      </Row>
    </PageLayoutV1>
  );
};

export default withActivityFeed(StoredProcedurePage);
